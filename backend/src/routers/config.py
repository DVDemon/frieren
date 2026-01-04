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
    
    config = {
        "backendUrl": os.getenv("BACKEND_URL", "http://frieren-backend:8000"),
        "nodeEnv": os.getenv("NODE_ENV", "production"),
        "timestamp": __import__("datetime").datetime.now().isoformat(),
        "source": "backend-api",
        "debug": {
            "message": "Backend configuration endpoint",
            "availableEnvVars": [key for key in os.environ.keys() if "BACKEND" in key or "NODE" in key]
        }
    }
    
    logger.info(f"GET /api/config - Returning config: {config}")
    return config
