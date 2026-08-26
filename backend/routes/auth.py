from fastapi import APIRouter, Depends

from backend.auth import require_auth

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/check")
def check(_user: str = Depends(require_auth)):
    return {"ok": True}
