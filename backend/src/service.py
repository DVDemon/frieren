from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
import logging
from routers import students, lectures, attendance, homework, homework_review, teachers, student_homework_variants, export, import_all, google_sheet, config, exam_grades


# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = FastAPI(redirect_slashes=False)

# Настройка CORS для предотвращения OPTIONS запросов
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], #"http://localhost:3000", "http://localhost:3004"],  # Разрешаем фронтенд на разных портах
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],  # Разрешенные HTTP методы
    allow_headers=["*"],  # Разрешаем все заголовки
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Request: {request.method} {request.url}")
    response = await call_next(request)
    logger.info(f"Response: {request.method} {request.url} - Status: {response.status_code}")
    return response

# Обработчик ошибок валидации для детального логирования 422 ошибок
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Обработчик ошибок валидации, который логирует детальную информацию
    для отладки проблем с 422 ошибками
    """
    logger.error(f"422 Validation Error for {request.method} {request.url}")
    logger.error(f"Validation errors: {exc.errors()}")
    
    # Пытаемся получить тело запроса для логирования (если доступно)
    try:
        if hasattr(request, '_body'):
            logger.error(f"Request body: {request._body}")
    except:
        pass
    
    # Возвращаем стандартный ответ FastAPI
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()}
    )

# Увеличиваем таймаут для длительных операций
@app.middleware("http")
async def timeout_middleware(request: Request, call_next):
    import asyncio
    try:
        # Устанавливаем таймаут 15 минут (900 секунд) для всех запросов
        response = await asyncio.wait_for(call_next(request), timeout=900.0)
        return response
    except asyncio.TimeoutError:
        logger.error(f"Request timeout after 15 minutes: {request.method} {request.url}")
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=408,
            content={"detail": "Request timeout after 15 minutes"}
        )

# Подключаем роутеры
app.include_router(config.router)  # Подключаем роутер конфигурации первым
app.include_router(students.router)
app.include_router(lectures.router)
app.include_router(attendance.router)
app.include_router(homework.router)
app.include_router(homework_review.router)
app.include_router(teachers.router)
app.include_router(student_homework_variants.router)
app.include_router(exam_grades.router)
app.include_router(export.router)
app.include_router(import_all.router)
app.include_router(google_sheet.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "service:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=True, 
        timeout_keep_alive=9000,
        timeout_graceful_shutdown=9000
    )
