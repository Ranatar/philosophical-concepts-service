// src/middleware/auth.ts

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
    accountType: string;
  };
}

/**
 * Middleware для аутентификации через JWT токен
 */
export const authenticateJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header is missing' });
  }
  
  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Authorization format is invalid. Use "Bearer [token]"' });
  }
  
  const token = parts[1];
  
  try {
    const secret = process.env.JWT_SECRET || 'default_secret_change_in_production';
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload;
    
    // Установка данных пользователя в объект запроса
    req.user = {
      id: decoded.userId,
      username: decoded.username,
      email: decoded.email,
      accountType: decoded.accountType
    };
    
    next();
  } catch (error) {
    logger.error(`JWT verification error: ${error}`);
    
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token has expired' });
    }
    
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Middleware для проверки ролей пользователя
 */
export const checkRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (!roles.includes(req.user.accountType)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};

/**
 * Middleware для проверки владения ресурсом
 */
export const checkResourceOwnership = (resourceType: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const resourceId = req.params.id;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
      // Проверка владения ресурсом будет зависеть от типа ресурса
      let isOwner = false;
      
      switch (resourceType) {
        case 'concept':
          // Проверка, является ли пользователь владельцем концепции
          const { DatabaseService } = require('../services/database.service');
          const dbService = new DatabaseService();
          const concept = await dbService.getConceptById(resourceId);
          
          if (concept && concept.user_id === userId) {
            isOwner = true;
          }
          break;
          
        // Можно добавить другие типы ресурсов по необходимости
          
        default:
          logger.warn(`Unknown resource type: ${resourceType}`);
          return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!isOwner && req.user?.accountType !== 'admin') {
        return res.status(403).json({ error: 'You do not have permission to access this resource' });
      }
      
      next();
    } catch (error) {
      logger.error(`Resource ownership check error: ${error}`);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// src/middleware/error.ts

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Middleware для обработки ошибок запросов
 */
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error(`Error: ${err.message}`);
  logger.error(err.stack || '');
  
  // Проверка типа ошибки и отправка соответствующего кода статуса
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  if (err.name === 'ForbiddenError') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  if (err.name === 'NotFoundError') {
    return res.status(404).json({ error: 'Resource not found' });
  }
  
  // Общая обработка для всех остальных ошибок
  res.status(500).json({ error: 'Internal server error' });
};

/**
 * Middleware для обработки не найденных маршрутов
 */
export const notFoundHandler = (req: Request, res: Response) => {
  logger.warn(`Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Route not found' });
};

// src/middleware/validation.ts

import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';

/**
 * Middleware для проверки результатов валидации
 */
export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  next();
};

/**
 * Фабрика для создания middleware валидации
 */
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    await Promise.all(validations.map(validation => validation.run(req)));
    validateRequest(req, res, next);
  };
};

// src/middleware/rateLimit.ts

import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redisClient } from '../config/redis';

/**
 * Middleware для ограничения количества запросов к API
 */
export const apiLimiter = rateLimit({
  store: new RedisStore({
    // @ts-ignore: Несоответствие типов в библиотеке
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  }),
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // Лимит запросов на IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});

/**
 * Middleware для ограничения количества запросов к Claude API
 */
export const claudeLimiter = rateLimit({
  store: new RedisStore({
    // @ts-ignore: Несоответствие типов в библиотеке
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  }),
  windowMs: 60 * 60 * 1000, // 1 час
  max: 50, // Лимит запросов на IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Claude API rate limit exceeded. Please try again later' }
});

// src/middleware/logging.ts

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

/**
 * Middleware для логирования HTTP запросов
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Генерация уникального ID для запроса
  const requestId = uuidv4();
  res.setHeader('X-Request-ID', requestId);
  
  // Маскирование чувствительных данных в логах
  const maskedUrl = req.url.replace(/password=[^&]*/, 'password=***');
  
  // Логирование начала запроса
  logger.info(`[${requestId}] ${req.method} ${maskedUrl} - Start`);
  
  // Засечка времени для определения длительности запроса
  const startTime = Date.now();
  
  // Модифицированный метод end для логирования окончания запроса
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - startTime;
    logger.info(`[${requestId}] ${req.method} ${maskedUrl} - ${res.statusCode} (${duration}ms)`);
    
    // Вызов оригинального метода end
    return originalEnd.call(res, chunk, encoding);
  };
  
  next();
};

// src/middleware/index.ts

export * from './auth';
export * from './error';
export * from './validation';
export * from './rateLimit';
export * from './logging';
