from fastapi import APIRouter
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/config", tags=["config"])

@router.get("/")
@router.get("")  # Поддержка как с trailing slash, так и без него
def get_config():
    """
    Возвращает конфигурацию backend для frontend
    """
    logger.info("GET /api/config - Returning backend configuration")
    
    # Получаем конфигурацию из переменных окружения или используем значения по умолчанию
    import os
    
    google_sheet_id = os.getenv("GOOGLE_SHEET_ID")
    google_sheet_url = None
    if google_sheet_id and google_sheet_id.strip():
        google_sheet_url = f"https://docs.google.com/spreadsheets/d/{google_sheet_id.strip()}/edit"
        logger.info(f"GOOGLE_SHEET_ID found, generated URL: {google_sheet_url}")
    else:
        logger.warning("GOOGLE_SHEET_ID not set or empty")
    
    config = {
        "backendUrl": os.getenv("BACKEND_URL", "http://frieren-backend:8000"),
        "nodeEnv": os.getenv("NODE_ENV", "production"),
        "googleSheetUrl": google_sheet_url,
        "timestamp": __import__("datetime").datetime.now().isoformat(),
        "source": "backend-api",
        "debug": {
            "message": "Backend configuration endpoint",
            "availableEnvVars": [key for key in os.environ.keys() if "BACKEND" in key or "NODE" in key],
            "googleSheetIdSet": bool(google_sheet_id and google_sheet_id.strip())
        }
    }
    
    logger.info(f"GET /api/config - Returning config. googleSheetUrl: {google_sheet_url}")
    return config
