"""Presigned direct-to-storage upload endpoints. The backend never receives
audio bytes here -- it only mints a short-lived signed PUT URL and the
browser uploads straight to Backblaze B2 (temporary staging only)."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from config import AppConfig
from backend.auth import require_auth
from backend.services.storage_service import (
    StorageError,
    StorageNotConfigured,
    confirm_object_exists,
    create_presigned_upload,
)

router = APIRouter(prefix="/api/uploads", tags=["uploads"])
_cfg = AppConfig()


class PresignRequest(BaseModel):
    filename: str
    content_type: str | None = None
    size_bytes: int | None = None


class PresignResponse(BaseModel):
    upload_url: str
    storage_key: str
    content_type: str | None
    expires_in_seconds: int


class ConfirmResponse(BaseModel):
    storage_key: str
    exists: bool
    size_bytes: int | None = None


@router.post("/presign", response_model=PresignResponse)
def presign_upload(payload: PresignRequest, _user: str = Depends(require_auth)):
    try:
        result = create_presigned_upload(
            _cfg, payload.filename, payload.content_type, payload.size_bytes
        )
    except StorageNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except StorageError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return PresignResponse(**result)


@router.get("/{storage_key:path}/confirm", response_model=ConfirmResponse)
def confirm_upload(storage_key: str, _user: str = Depends(require_auth)):
    try:
        info = confirm_object_exists(_cfg, storage_key)
    except StorageError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    if info is None:
        return ConfirmResponse(storage_key=storage_key, exists=False)
    return ConfirmResponse(storage_key=storage_key, exists=True, size_bytes=info["size"])
