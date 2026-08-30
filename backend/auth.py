"""Request authentication: a JWT bearer token (issued by POST /api/auth/login)
is verified here and resolved to a Principal on every protected request.

Two roles:
  - "admin"  -- full access, no scoping
  - "mentor" -- scoped to their own mentor record (principal.mentor_id) and
                the mentees assigned to it

The env ADMIN_USERNAME / ADMIN_PASSWORD pair is seeded into the `users`
collection on startup (see backend/main.py) so there is always one admin.
"""

from dataclasses import dataclass

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pymongo.database import Database

from config import AppConfig
from backend.db import get_db
from backend.security import TokenError, decode_token

_cfg = AppConfig()
_bearer = HTTPBearer(auto_error=True)

ROLE_ADMIN = "admin"
ROLE_MENTOR = "mentor"


@dataclass
class Principal:
    user_id: str
    username: str
    role: str
    mentor_id: str | None = None

    @property
    def is_admin(self) -> bool:
        return self.role == ROLE_ADMIN

    def mentor_oid(self) -> ObjectId | None:
        if not self.mentor_id:
            return None
        try:
            return ObjectId(self.mentor_id)
        except InvalidId:
            return None


def get_principal(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Database = Depends(get_db),
) -> Principal:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(credentials.credentials, _cfg.jwt_secret)
    except TokenError:
        raise unauthorized

    try:
        user = db.users.find_one({"_id": ObjectId(payload.get("sub", ""))})
    except InvalidId:
        raise unauthorized
    if user is None or user.get("disabled"):
        raise unauthorized

    return Principal(
        user_id=str(user["_id"]),
        username=user["username"],
        role=user["role"],
        mentor_id=str(user["mentor_id"]) if user.get("mentor_id") else None,
    )


# Back-compat alias: routes that only need "a logged-in user" still import this.
require_auth = get_principal


def require_admin(principal: Principal = Depends(get_principal)) -> Principal:
    if not principal.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required.")
    return principal
