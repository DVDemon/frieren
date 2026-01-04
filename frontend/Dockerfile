# Используем официальный Node.js образ для сборки
FROM node:18-alpine AS builder

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci

# Копируем исходный код
COPY . .

# Собираем приложение
RUN npm run build

# Используем официальный Node.js образ для production
FROM node:18-alpine AS runner

# Устанавливаем рабочую директорию
WORKDIR /app

# Создаем непривилегированного пользователя
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Копируем собранное приложение
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Копируем папку public для статических файлов
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Создаем entrypoint скрипт
RUN echo '#!/bin/sh' > /app/entrypoint.sh && \
    echo 'echo "🚀 Starting Next.js with environment variables:"' >> /app/entrypoint.sh && \
    echo 'echo "   BACKEND_URL: $BACKEND_URL"' >> /app/entrypoint.sh && \
    echo 'echo "   NODE_ENV: $NODE_ENV"' >> /app/entrypoint.sh && \
    echo '' >> /app/entrypoint.sh && \
    echo '# Экспортируем переменные окружения для дочерних процессов' >> /app/entrypoint.sh && \
    echo 'export BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"' >> /app/entrypoint.sh && \
    echo 'export NODE_ENV="${NODE_ENV:-development}"' >> /app/entrypoint.sh && \
    echo '' >> /app/entrypoint.sh && \
    echo 'echo "🔧 Exported variables:"' >> /app/entrypoint.sh && \
    echo 'echo "   BACKEND_URL: $BACKEND_URL"' >> /app/entrypoint.sh && \
    echo 'echo "   NODE_ENV: $NODE_ENV"' >> /app/entrypoint.sh && \
    echo '' >> /app/entrypoint.sh && \
    echo 'exec node server.js' >> /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

# Устанавливаем права доступа
RUN chown -R nextjs:nodejs /app
USER nextjs

# Открываем порт
EXPOSE 3000

# Устанавливаем переменную окружения для порта
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Запускаем приложение через entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]
