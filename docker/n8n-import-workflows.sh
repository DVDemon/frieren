#!/bin/bash
# Скрипт для автоматического импорта N8N workflows через API

set -e

N8N_URL="http://n8n:5678"
N8N_USER="admin"
N8N_PASSWORD="admin123"
WORKFLOWS_DIR="/workflows"

echo "Waiting for N8N to be ready..."
for i in {1..30}; do
  if curl -sf -u "${N8N_USER}:${N8N_PASSWORD}" "${N8N_URL}/api/v1/health" > /dev/null 2>&1; then
    echo "N8N is ready!"
    break
  fi
  echo "Waiting for N8N... (attempt $i/30)"
  sleep 3
done

# Получаем session cookie для аутентификации
echo "Authenticating with N8N..."
SESSION_COOKIE=$(curl -s -c /tmp/cookies.txt -u "${N8N_USER}:${N8N_PASSWORD}" \
  -X POST "${N8N_URL}/api/v1/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${N8N_USER}\",\"password\":\"${N8N_PASSWORD}\"}" | \
  grep -o '"cookie":"[^"]*"' | cut -d'"' -f4 || echo "")

# Если basic auth не работает, пробуем через API key или session
AUTH_HEADER=""
if [ -n "$SESSION_COOKIE" ]; then
  AUTH_HEADER="-b /tmp/cookies.txt"
else
  AUTH_HEADER="-u ${N8N_USER}:${N8N_PASSWORD}"
fi

echo "Importing workflows from ${WORKFLOWS_DIR}..."

# Импортируем каждый workflow
for workflow_file in "${WORKFLOWS_DIR}"/*.json; do
  if [ -f "$workflow_file" ]; then
    workflow_name=$(basename "$workflow_file" .json)
    echo "Importing workflow: $workflow_name..."
    
    # Читаем workflow из файла
    workflow_data=$(cat "$workflow_file")
    
    # Импортируем через API
    response=$(curl -s -w "\n%{http_code}" $AUTH_HEADER \
      -X POST "${N8N_URL}/api/v1/workflows" \
      -H "Content-Type: application/json" \
      -d "$workflow_data")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
      echo "✓ Workflow '$workflow_name' imported successfully (HTTP $http_code)"
    elif [ "$http_code" = "409" ]; then
      echo "⚠ Workflow '$workflow_name' already exists, skipping..."
    else
      echo "✗ Error importing workflow '$workflow_name': HTTP $http_code"
      echo "Response: $body"
    fi
  fi
done

echo "Workflow import completed!"

