# Инструкция по запуску сервиса философских концепций

## Содержание
1. [Предварительные требования](#1-предварительные-требования)
2. [Клонирование репозитория](#2-клонирование-репозитория)
3. [Настройка базы данных PostgreSQL](#3-настройка-базы-данных-postgresql)
4. [Настройка Redis](#4-настройка-redis)
5. [Конфигурация системы](#5-конфигурация-системы)
6. [Настройка API Claude](#6-настройка-api-claude)
7. [Установка и запуск бэкенда](#7-установка-и-запуск-бэкенда)
8. [Установка и запуск фронтенда](#8-установка-и-запуск-фронтенда)
9. [Проверка работоспособности](#9-проверка-работоспособности)
10. [Устранение типичных проблем](#10-устранение-типичных-проблем)

## 1. Предварительные требования

Перед началом установки убедитесь, что у вас установлены:

- **Node.js** (версия 16.x или выше)
- **npm** (версия 7.x или выше)
- **PostgreSQL** (версия 13.x или выше)
- **Redis** (версия 6.x или выше)
- **Git**

### Проверка версий:

```bash
# Проверка версии Node.js
node -v

# Проверка версии npm
npm -v

# Проверка версии PostgreSQL
psql --version

# Проверка версии Redis
redis-server --version

# Проверка версии Git
git --version
```

## 2. Клонирование репозитория

```bash
# Клонирование репозитория
git clone https://github.com/your-username/philosophical-concepts-service.git

# Переход в директорию проекта
cd philosophical-concepts-service
```

## 3. Настройка базы данных PostgreSQL

### Установка PostgreSQL (если не установлен)

#### Ubuntu/Debian:
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

#### macOS (с использованием Homebrew):
```bash
brew install postgresql
brew services start postgresql
```

#### Windows:
- Скачайте и установите PostgreSQL с официального сайта: https://www.postgresql.org/download/windows/
- Следуйте инструкциям мастера установки

### Создание базы данных и пользователя

#### Linux/macOS:
```bash
# Вход в PostgreSQL
sudo -u postgres psql

# В консоли PostgreSQL
CREATE DATABASE philosophical_concepts;
CREATE USER philo_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE philosophical_concepts TO philo_user;
\q
```

#### Windows:
```bash
# Вход в PostgreSQL через psql (установленный с PostgreSQL)
psql -U postgres

# В консоли PostgreSQL
CREATE DATABASE philosophical_concepts;
CREATE USER philo_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE philosophical_concepts TO philo_user;
\q
```

### Инициализация схемы базы данных

```bash
# Переход в директорию проекта (если вы еще не там)
cd philosophical-concepts-service

# Применение схемы базы данных
psql -U philo_user -d philosophical_concepts -f database/full-database-schema.sql
```

## 4. Настройка Redis

### Установка Redis (если не установлен)

#### Ubuntu/Debian:
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

#### macOS (с использованием Homebrew):
```bash
brew install redis
brew services start redis
```

#### Windows:
- Скачайте Redis для Windows с GitHub: https://github.com/tporadowski/redis/releases
- Распакуйте архив и запустите `redis-server.exe`

### Проверка работы Redis:
```bash
redis-cli ping
```

Вы должны получить ответ `PONG`, что означает, что Redis работает корректно.

## 5. Конфигурация системы

### Создание .env файла

Создайте файл `.env` в корневой директории проекта со следующим содержимым:

```
# Настройки сервера
PORT=5000
NODE_ENV=development
API_PREFIX=/api
CORS_ORIGIN=http://localhost:3000

# Настройки базы данных PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=philosophical_concepts
DB_USER=philo_user
DB_PASSWORD=your_secure_password
DB_MAX_POOL_SIZE=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000

# Настройки Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Настройки JWT
JWT_SECRET=your_jwt_secret_key_change_in_production
JWT_ACCESS_EXPIRY=1h
JWT_REFRESH_EXPIRY=7d

# Настройки Claude API
CLAUDE_API_KEY=your_claude_api_key
CLAUDE_API_URL=https://api.anthropic.com/v1/messages
CLAUDE_MODEL=claude-3-opus-20240229
CLAUDE_MAX_TOKENS=4000
CLAUDE_TEMPERATURE=0.7
PROMPT_TEMPLATES_DIR=src/prompts

# Настройки логирования
LOG_LEVEL=info
LOG_FILE_PATH=logs/app.log
LOG_MAX_SIZE=10m
LOG_MAX_FILES=7

# Настройки безопасности
BCRYPT_SALT_ROUNDS=10
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
CLAUDE_RATE_LIMIT_WINDOW=3600000
CLAUDE_RATE_LIMIT_MAX=50
```

Замените значения в файле на соответствующие вашей среде, особенно:
- `your_secure_password` - пароль пользователя PostgreSQL
- `your_jwt_secret_key_change_in_production` - секретный ключ для JWT
- `your_claude_api_key` - ваш API-ключ для Claude (см. следующий раздел)

## 6. Настройка API Claude

### Получение API ключа Claude

1. Перейдите на сайт Anthropic: https://www.anthropic.com/
2. Зарегистрируйтесь или войдите в свой аккаунт
3. Перейдите в раздел разработчика или API
4. Создайте новый API ключ
5. Скопируйте полученный ключ и вставьте его в файл `.env` в поле `CLAUDE_API_KEY`

Обратите внимание, что использование API Claude может быть платным. Ознакомьтесь с текущими тарифами на сайте Anthropic.

## 7. Установка и запуск бэкенда

### Установка зависимостей бэкенда

```bash
# Переход в директорию проекта (если вы еще не там)
cd philosophical-concepts-service

# Установка зависимостей
npm install
```

### Создание директории для шаблонов промптов

```bash
mkdir -p src/prompts
```

### Копирование шаблонов промптов

Скопируйте файлы шаблонов промптов из репозитория в директорию `src/prompts`. Если у вас есть отдельные файлы с шаблонами (из artifacts/prompt-templates), скопируйте их в эту директорию.

```bash
# Пример команды для копирования (предполагается, что файлы находятся в директории templates)
cp -r templates/* src/prompts/
```

### Создание директории для логов

```bash
mkdir -p logs
```

### Компиляция TypeScript кода

```bash
# Компиляция TypeScript
npm run build
```

### Запуск бэкенда

```bash
# Запуск сервера
npm start
```

Для разработки можно использовать режим с автоматической перезагрузкой:

```bash
npm run dev
```

## 8. Установка и запуск фронтенда

### Переход в директорию фронтенда

```bash
# Если фронтенд находится в поддиректории client
cd client
```

### Установка зависимостей фронтенда

```bash
npm install
```

### Создание .env файла для фронтенда

Создайте файл `.env` в директории фронтенда со следующим содержимым:

```
REACT_APP_API_URL=http://localhost:5000/api
```

### Запуск фронтенда

```bash
npm start
```

Фронтенд будет доступен по адресу http://localhost:3000

## 9. Проверка работоспособности

### Проверка бэкенда

1. Откройте веб-браузер и перейдите по адресу:
   ```
   http://localhost:5000/api/health
   ```
   
   Вы должны увидеть сообщение о том, что сервер работает.

2. Убедитесь, что в логах нет ошибок:
   ```bash
   cat logs/app.log
   ```

### Проверка фронтенда

1. Откройте веб-браузер и перейдите по адресу:
   ```
   http://localhost:3000
   ```
   
   Вы должны увидеть интерфейс сервиса философских концепций.

2. Зарегистрируйте тестового пользователя через интерфейс.

3. Создайте тестовую концепцию, чтобы убедиться, что взаимодействие с бэкендом работает корректно.

## 10. Устранение типичных проблем

### Проблемы с подключением к базе данных

**Симптом:** Сообщения об ошибках подключения к базе данных в логах.

**Решение:**
1. Проверьте, что PostgreSQL запущен:
   ```bash
   # Linux
   sudo systemctl status postgresql
   
   # macOS
   brew services list | grep postgresql
   
   # Windows
   sc query postgresql
   ```

2. Проверьте настройки подключения в файле `.env`.

3. Убедитесь, что пользователь базы данных имеет правильные права:
   ```bash
   psql -U postgres
   
   # В консоли PostgreSQL
   \du philo_user
   ```

### Проблемы с Redis

**Симптом:** Ошибки подключения к Redis в логах.

**Решение:**
1. Проверьте, что Redis запущен:
   ```bash
   # Linux
   sudo systemctl status redis-server
   
   # macOS
   brew services list | grep redis
   
   # Windows
   # Проверьте, запущен ли процесс redis-server.exe
   ```

2. Проверьте настройки подключения в файле `.env`.

3. Тестовое подключение к Redis:
   ```bash
   redis-cli ping
   ```

### Проблемы с API Claude

**Симптом:** Ошибки при взаимодействии с Claude.

**Решение:**
1. Проверьте валидность вашего API-ключа Claude.
2. Убедитесь, что модель `CLAUDE_MODEL` в файле `.env` существует и доступна.
3. Проверьте, не исчерпан ли лимит запросов к API.

### Проблемы при компиляции TypeScript

**Симптом:** Ошибки при выполнении `npm run build`.

**Решение:**
1. Проверьте версию Node.js и TypeScript:
   ```bash
   node -v
   npx tsc -v
   ```

2. Очистите кэш npm и переустановите зависимости:
   ```bash
   npm cache clean --force
   rm -rf node_modules
   npm install
   ```

### Проблемы с CORS

**Симптом:** Ошибки CORS в консоли браузера при запросах с фронтенда на бэкенд.

**Решение:**
1. Убедитесь, что настройка `CORS_ORIGIN` в файле `.env` бэкенда соответствует адресу вашего фронтенда.
2. Перезапустите бэкенд после изменения настроек.

---

Следуя этой инструкции, вы должны успешно запустить сервис философских концепций. Если у вас возникнут дополнительные вопросы или проблемы, не описанные в разделе устранения неполадок, обратитесь к документации по отдельным компонентам системы или к сообществу разработчиков.