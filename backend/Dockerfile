# Используем официальный Python образ
FROM python:3.12-slim

# Устанавливаем рабочую директорию
WORKDIR /app

# Устанавливаем системные зависимости
RUN apt-get update && apt-get install -y \
    gcc \
    git \
    g++ \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Копируем файлы зависимостей
COPY requirements/requirement.txt .

# Устанавливаем Python зависимости
RUN pip install --no-cache-dir -r requirement.txt

# Копируем исходный код
COPY src/ ./src/

# Создаем пользователя для безопасности
RUN useradd --create-home --shell /bin/bash app \
    && chown -R app:app /app
USER app

# Открываем порт
EXPOSE 8000

# Запускаем приложение
CMD ["python", "src/service.py"]
