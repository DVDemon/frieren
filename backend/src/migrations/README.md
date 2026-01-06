# Миграции базы данных

Эта директория содержит SQL скрипты миграции для обновления схемы базы данных.

## Использование

### Добавление поля presentation_blob в таблицу lectures

#### Локально через psql:

```bash
# Убедитесь, что переменные окружения установлены
export PGHOST=localhost
export PGPORT=5432
export PGDATABASE=frieren_db
export PGUSER=frieren
export PGPASSWORD=frieren

# Запустите миграцию
psql -f src/migrations/add_presentation_blob_to_lectures.sql
```

#### С явным указанием параметров:

```bash
psql -h localhost -p 5432 -U frieren -d frieren_db -f src/migrations/add_presentation_blob_to_lectures.sql
```

#### В Docker контейнере:

```bash
# Если база данных в Docker контейнере
docker exec -i frieren_postgres psql -U frieren -d frieren_db < src/migrations/add_presentation_blob_to_lectures.sql
```

Или через docker-compose:

```bash
docker-compose exec postgres psql -U frieren -d frieren_db -f /app/src/migrations/add_presentation_blob_to_lectures.sql
```

#### Через переменные окружения в Docker:

```bash
docker exec -i frieren_postgres psql \
  -h localhost \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -f /app/src/migrations/add_presentation_blob_to_lectures.sql
```

### Откат миграции

Если необходимо откатить миграцию (удалить поле):

```bash
psql -h localhost -p 5432 -U frieren -d frieren_db -f src/migrations/rollback_presentation_blob.sql
```

**ВНИМАНИЕ**: Откат удалит все данные в поле `presentation_blob`!

## Особенности

- **Идемпотентность**: SQL скрипты можно запускать несколько раз безопасно благодаря проверке существования поля
- **Проверка существования**: Перед добавлением/удалением поля проверяется, существует ли оно уже
- **Транзакции**: Миграции выполняются в транзакциях (DO блоки) для безопасности
- **Логирование**: Используется RAISE NOTICE для вывода информации о выполнении

## Доступные миграции

1. **`add_presentation_blob_to_lectures.sql`** - Добавляет поле `presentation_blob` (BYTEA, nullable) в таблицу `lectures` для хранения презентаций в формате PDF/PPTX.

2. **`rollback_presentation_blob.sql`** - Откатывает миграцию, удаляя поле `presentation_blob` из таблицы `lectures`.

## Структура SQL миграций

Каждая миграция использует PostgreSQL DO блоки для:
- Проверки существования поля через `information_schema.columns`
- Условного выполнения ALTER TABLE только если поле отсутствует
- Вывода информационных сообщений через RAISE NOTICE
- Проверки результата миграции

