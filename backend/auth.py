"""Single hardcoded admin/admin123-style credential gate, checked on every
protected request. No sessions, no user table -- the frontend sends
`Authorization: Basic <base64(user:pass)>` on every call and this dependency
verifies it against env-configured credentials."""

import secrets

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from config import AppConfig

_cfg = AppConfig()
_security = HTTPBasic()


def require_auth(credentials: HTTPBasicCredentials = Depends(_security)) -> str:
    valid_username = secrets.compare_digest(credentials.username, _cfg.admin_username)
    valid_password = secrets.compare_digest(credentials.password, _cfg.admin_password)
    if not (valid_username and valid_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username
