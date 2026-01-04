#!/bin/bash
# Скрипт инициализации RabbitMQ для создания очереди checkin
# Этот скрипт выполняется автоматически при запуске контейнера RabbitMQ

set -e

echo "Waiting for RabbitMQ to be ready..."
sleep 15

# Ждем, пока RabbitMQ полностью запустится
for i in {1..30}; do
  if rabbitmqctl status > /dev/null 2>&1; then
    echo "RabbitMQ is ready!"
    break
  fi
  echo "Waiting for RabbitMQ... (attempt $i/30)"
  sleep 2
done

# Проверяем, существует ли очередь
if rabbitmqctl list_queues name | grep -q "^checkin$"; then
  echo "Queue 'checkin' already exists"
else
  echo "Creating queue 'checkin'..."
  rabbitmqctl declare queue name=checkin durable=true auto_delete=false
  echo "Queue 'checkin' created successfully"
fi

# Выводим список очередей для проверки
echo "Current queues:"
rabbitmqctl list_queues name durable

