// src/utils/logger.ts

import winston from 'winston';
import path from 'path';
import fs from 'fs';
import config from '../config';

// Создание директории для логов, если она не существует
const logDir = path.dirname(config.logging.filePath);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Формат для консольного вывода логов
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    info => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Формат для файловых логов
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json()
);

// Создание логгера
export const logger = winston.createLogger({
  level: config.logging.level,
  transports: [
    // Логирование в консоль
    new winston.transports.Console({
      format: consoleFormat
    }),
    // Логирование в файл
    new winston.transports.File({
      filename: config.logging.filePath,
      format: fileFormat,
      maxsize: parseFileSize(config.logging.maxSize),
      maxFiles: config.logging.maxFiles,
      tailable: true
    }),
    // Отдельный файл для ошибок
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: parseFileSize(config.logging.maxSize),
      maxFiles: config.logging.maxFiles,
      tailable: true
    })
  ],
  // Не завершать процесс при необработанных ошибках
  exitOnError: false
});

// Функция для преобразования размера файла из строки в байты
function parseFileSize(size: string): number {
  const units = {
    b: 1,
    k: 1024,
    m: 1024 * 1024,
    g: 1024 * 1024 * 1024
  };
  
  const match = size.toLowerCase().match(/^(\d+)([bkmg])$/);
  if (!match) {
    return 10 * 1024 * 1024; // По умолчанию 10MB
  }
  
  const value = parseInt(match[1], 10);
  const unit = match[2] as keyof typeof units;
  
  return value * units[unit];
}

// src/utils/auth.ts

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import config from '../config';
import { User } from '../types';

/**
 * Хеширование пароля
 */
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, config.security.bcryptSaltRounds);
};

/**
 * Проверка соответствия пароля и хеша
 */
export const comparePasswords = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

/**
 * Создание JWT токена доступа
 */
export const generateAccessToken = (user: User): string => {
  const payload = {
    userId: user.user_id,
    username: user.username,
    email: user.email,
    accountType: user.account_type
  };
  
  return jwt.sign(
    payload,
    config.jwt.secret,
    { expiresIn: config.jwt.accessTokenExpiry }
  );
};

/**
 * Создание JWT токена обновления
 */
export const generateRefreshToken = (user: User): string => {
  const payload = {
    userId: user.user_id,
    tokenType: 'refresh'
  };
  
  return jwt.sign(
    payload,
    config.jwt.secret,
    { expiresIn: config.jwt.refreshTokenExpiry }
  );
};

/**
 * Проверка JWT токена
 */
export const verifyToken = (token: string): any => {
  return jwt.verify(token, config.jwt.secret);
};

// src/utils/errors.ts

/**
 * Базовый класс для ошибок приложения
 */
export class AppError extends Error {
  public statusCode: number;
  
  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Ошибка для 400 Bad Request
 */
export class ValidationError extends AppError {
  constructor(message: string = 'Validation error') {
    super(message, 400);
  }
}

/**
 * Ошибка для 401 Unauthorized
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

/**
 * Ошибка для 403 Forbidden
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}

/**
 * Ошибка для 404 Not Found
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

/**
 * Ошибка для 409 Conflict
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409);
  }
}

/**
 * Ошибка для 429 Too Many Requests
 */
export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429);
  }
}

/**
 * Ошибка для 500 Internal Server Error, используется для непредвиденных ошибок
 */
export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error') {
    super(message, 500);
  }
}

// src/utils/validation.ts

import { body, param, query } from 'express-validator';

/**
 * Валидатор для регистрации пользователя
 */
export const registerValidator = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  
  body('email')
    .trim()
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
];

/**
 * Валидатор для входа в систему
 */
export const loginValidator = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

/**
 * Валидатор для создания концепции
 */
export const conceptCreateValidator = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Concept name must be between 1 and 100 characters'),
  
  body('description')
    .optional()
    .trim(),
  
  body('focus_area')
    .optional()
    .isIn(['ontological', 'epistemological', 'ethical', 'aesthetic', 'political', 'metaphysical'])
    .withMessage('Invalid focus area')
];

/**
 * Валидатор для создания категории
 */
export const categoryCreateValidator = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Category name must be between 1 and 100 characters'),
  
  body('definition')
    .trim()
    .notEmpty()
    .withMessage('Definition is required')
];

/**
 * Валидатор для создания связи
 */
export const connectionCreateValidator = [
  body('source_category_id')
    .isUUID()
    .withMessage('Source category ID must be a valid UUID'),
  
  body('target_category_id')
    .isUUID()
    .withMessage('Target category ID must be a valid UUID'),
  
  body('connection_type')
    .isIn(['hierarchical', 'causal', 'dialectical', 'functional', 'derivative', 'associative'])
    .withMessage('Invalid connection type'),
  
  body('direction')
    .isIn(['directed', 'bidirectional', 'undirected'])
    .withMessage('Invalid direction')
];

/**
 * Валидатор для создания атрибута
 */
export const attributeCreateValidator = [
  body('attribute_type')
    .notEmpty()
    .withMessage('Attribute type is required'),
  
  body('value')
    .isFloat({ min: 0, max: 1 })
    .withMessage('Value must be a number between 0 and 1')
];

/**
 * Валидатор для генерации тезисов
 */
export const thesisGenerationValidator = [
  body('count')
    .isInt({ min: 1, max: 10 })
    .withMessage('Count must be between 1 and 10'),
  
  body('type')
    .isIn(['ontological', 'epistemological', 'ethical', 'aesthetic', 'political', 'metaphysical'])
    .withMessage('Invalid thesis type'),
  
  body('style')
    .optional()
    .isIn(['academic', 'popular', 'aphoristic'])
    .withMessage('Invalid style')
];

/**
 * Валидатор для параметров синтеза
 */
export const synthesisParamsValidator = [
  body('concept_ids')
    .isArray({ min: 2 })
    .withMessage('At least two concepts are required'),
  
  body('concept_ids.*')
    .isUUID()
    .withMessage('Concept IDs must be valid UUIDs'),
  
  body('synthesis_method')
    .isIn(['dialectical', 'integrative', 'transformational', 'complementary'])
    .withMessage('Invalid synthesis method'),
  
  body('innovation_level')
    .optional()
    .isIn(['conservative', 'moderate', 'radical'])
    .withMessage('Invalid innovation level'),
  
  body('abstraction_level')
    .optional()
    .isIn(['concrete', 'intermediate', 'abstract'])
    .withMessage('Invalid abstraction level'),
  
  body('historical_context')
    .optional()
    .isIn(['contemporary', 'historical', 'timeless'])
    .withMessage('Invalid historical context')
];

// src/utils/helpers.ts

/**
 * Функция для пагинации результатов запроса
 */
export const paginate = <T>(items: T[], page: number = 1, limit: number = 10): { data: T[], pagination: PaginationInfo } => {
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  
  const data = items.slice(startIndex, endIndex);
  
  const pagination: PaginationInfo = {
    total: items.length,
    page,
    limit,
    pages: Math.ceil(items.length / limit)
  };
  
  if (startIndex > 0) {
    pagination.previous = page - 1;
  }
  
  if (endIndex < items.length) {
    pagination.next = page + 1;
  }
  
  return { data, pagination };
};

interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  pages: number;
  previous?: number;
  next?: number;
}

/**
 * Функция для форматирования данных ответа API
 */
export const formatApiResponse = <T>(data: T, message: string = 'Success'): ApiResponse<T> => {
  return {
    success: true,
    message,
    data
  };
};

/**
 * Функция для форматирования ошибки ответа API
 */
export const formatApiError = (message: string, errors?: any): ApiErrorResponse => {
  return {
    success: false,
    message,
    errors: errors || null
  };
};

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

interface ApiErrorResponse {
  success: boolean;
  message: string;
  errors: any;
}

/**
 * Функция для удаления чувствительных данных из объекта пользователя
 */
export const sanitizeUser = (user: any): any => {
  const { password_hash, ...sanitizedUser } = user;
  return sanitizedUser;
};

/**
 * Генерация случайной строки указанной длины
 */
export const generateRandomString = (length: number = 32): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const charactersLength = chars.length;
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * charactersLength));
  }
  
  return result;
};

// src/utils/claude.ts

import axios from 'axios';
import { redisClient } from '../config/redis';
import config from '../config';
import { logger } from './logger';
import { ClaudeApiRequest, ClaudeApiResponse } from '../types';

/**
 * Функция для отправки запроса к Claude API с кэшированием
 */
export const sendCachedClaudeRequest = async (
  prompt: string,
  maxTokens: number = config.claude.maxTokens,
  temperature: number = config.claude.temperature,
  cacheExpiry: number = 3600, // время жизни кэша в секундах (по умолчанию 1 час)
  userId: string = 'system'
): Promise<{ response: string; tokensUsed: number }> => {
  // Генерация ключа кэша на основе параметров запроса
  const cacheKey = `claude:${hash(prompt)}:${maxTokens}:${temperature}`;
  
  try {
    // Проверка наличия результата в кэше
    const cachedResult = await redisClient.get(cacheKey);
    if (cachedResult) {
      logger.debug(`Claude API cache hit for key: ${cacheKey}`);
      return JSON.parse(cachedResult);
    }
    
    // Отправка запроса к Claude API
    logger.debug(`Claude API cache miss, querying API for key: ${cacheKey}`);
    
    const apiRequest: ClaudeApiRequest = {
      model: config.claude.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: temperature
    };
    
    const startTime = Date.now();
    
    const response = await axios.post<ClaudeApiResponse>(
      config.claude.apiUrl,
      apiRequest,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.claude.apiKey,
          'anthropic-version': '2023-06-01'
        }
      }
    );
    
    const result = {
      response: response.data.message.content,
      tokensUsed: response.data.usage.input_tokens + response.data.usage.output_tokens
    };
    
    const durationMs = Date.now() - startTime;
    
    // Сохранение результата в кэше
    await redisClient.set(cacheKey, JSON.stringify(result), 'EX', cacheExpiry);
    
    // Логирование использования
    logger.info(`Claude API request by ${userId}: tokens=${result.tokensUsed}, duration=${durationMs}ms`);
    
    return result;
  } catch (error) {
    logger.error(`Claude API error: ${error}`);
    throw new Error(`Failed to get response from Claude API: ${error}`);
  }
};

/**
 * Генерация хеша строки для ключей кэширования
 */
function hash(str: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(str).digest('hex');
}
