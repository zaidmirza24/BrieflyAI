from fastapi import APIRouter, Depends
from pymongo.database import Database

from config import AppConfig
from backend.auth import require_admin
from backend.db import get_db
from backend.services.cleanup_service import cleanup_stale_sessions

router = APIRouter(prefix="/api/maintenance", tags=["maintenance"])
_cfg = AppConfig()


@router.post("/cleanup")
def run_cleanup(db: Database = Depends(get_db), _admin=Depends(require_admin)):
    cleaned = cleanup_stale_sessions(db, _cfg)
    return {"cleaned": cleaned}
