// src/controllers/auth.controller.ts

import { Request, Response } from 'express';
import { hashPassword, comparePasswords, generateAccessToken, generateRefreshToken, verifyToken } from '../utils/auth';
import { formatApiResponse, formatApiError, sanitizeUser } from '../utils/helpers';
import { logger } from '../utils/logger';
import { DatabaseService } from '../services/database.service';
import { UnauthorizedError, ValidationError, ConflictError } from '../utils/errors';
import { redisClient } from '../config/redis';

export class AuthController {
  private dbService: DatabaseService;

  constructor() {
    this.dbService = new DatabaseService();
  }

  /**
   * Регистрация нового пользователя
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { username, email, password } = req.body;
      
      // Проверка, что пользователь с таким email или username еще не существует
      const existingByEmail = await this.dbService.getUserByEmail(email);
      if (existingByEmail) {
        throw new ConflictError('User with this email already exists');
      }
      
      // Дополнительная проверка username
      const client = await this.dbService.getClient();
      try {
        const existingByUsername = await client.query(
          'SELECT * FROM users WHERE username = $1',
          [username]
        );
        
        if (existingByUsername.rows.length > 0) {
          throw new ConflictError('User with this username already exists');
        }
      } finally {
        client.release();
      }
      
      // Хеширование пароля
      const passwordHash = await hashPassword(password);
      
      // Создание пользователя
      const user = await this.dbService.createUser({
        username,
        email,
        password_hash: passwordHash,
        account_type: 'basic'
      });
      
      // Генерация токенов
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);
      
      // Сохранение refresh токена в Redis
      await redisClient.set(`refresh_token:${user.user_id}`, refreshToken, 'EX', 60 * 60 * 24 * 7); // 7 дней
      
      // Удаление чувствительных данных перед отправкой ответа
      const sanitizedUser = sanitizeUser(user);
      
      res.status(201).json(formatApiResponse({
        user: sanitizedUser,
        accessToken,
        refreshToken
      }, 'User registered successfully'));
    } catch (error) {
      logger.error(`Registration error: ${error.message}`);
      
      if (error instanceof ValidationError || error instanceof ConflictError) {
        res.status(error.statusCode).json(formatApiError(error.message));
      } else {
        res.status(500).json(formatApiError('Failed to register user'));
      }
    }
  }

  /**
   * Вход в систему
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      
      // Поиск пользователя по email
      const user = await this.dbService.getUserByEmail(email);
      if (!user) {
        throw new UnauthorizedError('Invalid email or password');
      }
      
      // Проверка пароля
      const isPasswordValid = await comparePasswords(password, user.password_hash);
      if (!isPasswordValid) {
        throw new UnauthorizedError('Invalid email or password');
      }
      
      // Обновление времени последнего входа
      await this.dbService.updateUserLastLogin(user.user_id);
      
      // Генерация токенов
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);
      
      // Сохранение refresh токена в Redis
      await redisClient.set(`refresh_token:${user.user_id}`, refreshToken, 'EX', 60 * 60 * 24 * 7); // 7 дней
      
      // Удаление чувствительных данных перед отправкой ответа
      const sanitizedUser = sanitizeUser(user);
      
      res.json(formatApiResponse({
        user: sanitizedUser,
        accessToken,
        refreshToken
      }, 'Login successful'));
    } catch (error) {
      logger.error(`Login error: ${error.message}`);
      
      if (error instanceof UnauthorizedError) {
        res.status(error.statusCode).json(formatApiError(error.message));
      } else {
        res.status(500).json(formatApiError('Failed to login'));
      }
    }
  }

  /**
   * Обновление токена доступа
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        throw new UnauthorizedError('Refresh token is required');
      }
      
      // Верификация refresh токена
      const decoded = verifyToken(refreshToken);
      
      if (!decoded || decoded.tokenType !== 'refresh') {
        throw new UnauthorizedError('Invalid refresh token');
      }
      
      // Проверка наличия токена в Redis
      const storedToken = await redisClient.get(`refresh_token:${decoded.userId}`);
      if (!storedToken || storedToken !== refreshToken) {
        throw new UnauthorizedError('Invalid or expired refresh token');
      }
      
      // Получение информации о пользователе
      const user = await this.dbService.getClient().then(async client => {
        try {
          const result = await client.query(
            'SELECT * FROM users WHERE user_id = $1',
            [decoded.userId]
          );
          
          if (result.rows.length === 0) {
            throw new UnauthorizedError('User not found');
          }
          
          return result.rows[0];
        } finally {
          client.release();
        }
      });
      
      // Генерация нового токена доступа
      const accessToken = generateAccessToken(user);
      
      res.json(formatApiResponse({
        accessToken,
        refreshToken
      }, 'Token refreshed successfully'));
    } catch (error) {
      logger.error(`Token refresh error: ${error.message}`);
      
      if (error instanceof UnauthorizedError) {
        res.status(error.statusCode).json(formatApiError(error.message));
      } else {
        res.status(500).json(formatApiError('Failed to refresh token'));
      }
    }
  }

  /**
   * Выход из системы
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        throw new ValidationError('User ID is required');
      }
      
      // Удаление refresh токена из Redis
      await redisClient.del(`refresh_token:${userId}`);
      
      res.json(formatApiResponse(null, 'Logout successful'));
    } catch (error) {
      logger.error(`Logout error: ${error.message}`);
      
      if (error instanceof ValidationError) {
        res.status(error.statusCode).json(formatApiError(error.message));
      } else {
        res.status(500).json(formatApiError('Failed to logout'));
      }
    }
  }
}
