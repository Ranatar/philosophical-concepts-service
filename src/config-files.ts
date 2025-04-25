// src/config/index.ts

import dotenv from 'dotenv';
import path from 'path';

// Загрузка переменных окружения из .env файла
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Настройки приложения
const config = {
  // Настройки сервера
  server: {
    port: parseInt(process.env.PORT || '5000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    apiPrefix: process.env.API_PREFIX || '/api',
    corsOrigin: process.env.CORS_ORIGIN || '*'
  },
  
  // Настройки базы данных
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'philosophical_concepts',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10)
  },
  
  // Настройки Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '0', 10)
  },
  
  // Настройки JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'default_secret_change_in_production',
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '1h',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d'
  },
  
  // Настройки Claude API
  claude: {
    apiKey: process.env.CLAUDE_API_KEY || '',
    apiUrl: process.env.CLAUDE_API_URL || 'https://api.anthropic.com/v1/messages',
    model: process.env.CLAUDE_MODEL || 'claude-3-opus-20240229',
    maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '4000', 10),
    temperature: parseFloat(process.env.CLAUDE_TEMPERATURE || '0.7'),
    promptTemplatesDir: process.env.PROMPT_TEMPLATES_DIR || path.resolve(__dirname, '../prompts')
  },
  
  // Настройки логирования
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || path.resolve(__dirname, '../../logs/app.log'),
    maxSize: process.env.LOG_MAX_SIZE || '10m',
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '7', 10)
  },
  
  // Настройки безопасности
  security: {
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),
    rateLimit: {
      window: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 минут
      max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10) // 100 запросов
    },
    claudeRateLimit: {
      window: parseInt(process.env.CLAUDE_RATE_LIMIT_WINDOW || '3600000', 10), // 1 час
      max: parseInt(process.env.CLAUDE_RATE_LIMIT_MAX || '50', 10) // 50 запросов
    }
  }
};

export default config;

// src/config/redis.ts

import { createClient } from 'redis';
import config from './index';
import { logger } from '../utils/logger';

// Создание клиента Redis
export const redisClient = createClient({
  url: `redis://${config.redis.password ? `:${config.redis.password}@` : ''}${config.redis.host}:${config.redis.port}/${config.redis.db}`
});

// Обработчики событий Redis
redisClient.on('connect', () => {
  logger.info('Redis client connected');
});

redisClient.on('error', (err) => {
  logger.error(`Redis error: ${err}`);
});

// Инициализация соединения с Redis
export const initRedis = async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    logger.error(`Failed to connect to Redis: ${error}`);
    process.exit(1);
  }
};

// src/config/database.ts

import { Pool } from 'pg';
import config from './index';
import { logger } from '../utils/logger';

// Создание пула соединений PostgreSQL
export const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
  max: config.database.maxPoolSize,
  idleTimeoutMillis: config.database.idleTimeoutMillis,
  connectionTimeoutMillis: config.database.connectionTimeoutMillis
});

// Обработчик ошибок пула
pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Проверка соединения с базой данных
export const testDatabaseConnection = async () => {
  try {
    const client = await pool.connect();
    logger.info('Database connection successful');
    client.release();
    return true;
  } catch (error) {
    logger.error(`Database connection error: ${error}`);
    return false;
  }
};

// Инициализация базы данных
export const initDatabase = async () => {
  // Функция для проверки существования таблиц и создания их при необходимости
  // В реальном проекте здесь бы использовались миграции
  const isConnected = await testDatabaseConnection();
  
  if (!isConnected) {
    logger.error('Could not connect to the database. Exiting...');
    process.exit(1);
  }
  
  return pool;
};

// .env.example

# Настройки сервера
PORT=5000
NODE_ENV=development
API_PREFIX=/api
CORS_ORIGIN=http://localhost:3000

# Настройки базы данных PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=philosophical_concepts
DB_USER=postgres
DB_PASSWORD=postgres
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

# src/app.ts

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import routes from './routes';
import config from './config';
import { 
  errorHandler, 
  notFoundHandler, 
  requestLogger,
  apiLimiter
} from './middleware';
import { initDatabase } from './config/database';
import { initRedis } from './config/redis';
import { logger } from './utils/logger';

// Инициализация Express приложения
const app = express();

// Безопасность, CORS и сжатие
app.use(helmet());
app.use(cors({
  origin: config.server.corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(compression());

// Парсинг JSON и URL-encoded данных
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Логирование запросов
app.use(requestLogger);

// Ограничение количества запросов
app.use(apiLimiter);

// Маршруты API
app.use(config.server.apiPrefix, routes);

// Обработка 404 и ошибок
app.use(notFoundHandler);
app.use(errorHandler);

// Функция запуска сервера
const startServer = async () => {
  try {
    // Инициализация базы данных
    await initDatabase();
    
    // Инициализация Redis
    await initRedis();
    
    // Запуск сервера
    app.listen(config.server.port, () => {
      logger.info(`Server running on port ${config.server.port} in ${config.server.nodeEnv} mode`);
      logger.info(`API available at ${config.server.apiPrefix}`);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error}`);
    process.exit(1);
  }
};

// Обработка необработанных исключений и обещаний
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`, error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});

// Экспорт для использования в тестах
export { app, startServer };

// Запуск сервера, если файл запущен напрямую (не импортирован)
if (require.main === module) {
  startServer();
}

// src/server.ts

import { startServer } from './app';

startServer();
