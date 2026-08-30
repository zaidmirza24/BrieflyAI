from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database

from config import AppConfig
from backend.auth import Principal, get_principal
from backend.db import get_db
from backend.schemas import LoginRequest, LoginResponse, MeResponse
from backend.security import create_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])
_cfg = AppConfig()


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Database = Depends(get_db)):
    user = db.users.find_one({"username": payload.username})
    if user is None or user.get("disabled") or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password.")

    token = create_token({"sub": str(user["_id"]), "role": user["role"]}, _cfg.jwt_secret, _cfg.jwt_ttl_seconds)
    return LoginResponse(token=token, role=user["role"], username=user["username"])


@router.get("/me", response_model=MeResponse)
def me(principal: Principal = Depends(get_principal), db: Database = Depends(get_db)):
    mentor_name = None
    area = None
    if principal.mentor_oid() is not None:
        mentor = db.mentors.find_one({"_id": principal.mentor_oid()})
        if mentor:
            mentor_name = mentor.get("name")
            area = mentor.get("area")
    return MeResponse(
        username=principal.username,
        role=principal.role,
        mentor_id=principal.mentor_id,
        mentor_name=mentor_name,
        area=area,
    )
