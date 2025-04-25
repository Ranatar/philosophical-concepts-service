// src/services/prompt-template.service.ts

import { PromptTemplate } from '../types';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { logger } from '../utils/logger';
import { redisClient } from '../config/redis';

/**
 * Сервис для управления шаблонами промптов для Claude API
 */
export class PromptTemplateService {
  private templates: Map<string, PromptTemplate> = new Map();
  private templatesLoaded: boolean = false;
  private readonly templateDir: string;

  constructor() {
    this.templateDir = process.env.PROMPT_TEMPLATES_DIR || join(__dirname, '..', 'prompts');
    logger.info(`PromptTemplateService initialized with template directory: ${this.templateDir}`);
  }

  /**
   * Загружает все шаблоны промптов из файлов
   */
  async loadTemplates(): Promise<void> {
    if (this.templatesLoaded) {
      return;
    }

    try {
      // Проверка кэша Redis для шаблонов
      const cachedTemplates = await redisClient.get('prompt_templates');
      if (cachedTemplates) {
        const templates = JSON.parse(cachedTemplates);
        for (const [name, template] of Object.entries(templates)) {
          this.templates.set(name, template as PromptTemplate);
        }
        this.templatesLoaded = true;
        logger.info(`Loaded ${this.templates.size} templates from Redis cache`);
        return;
      }

      // Список всех файлов шаблонов
      const templateFiles = [
        'graph_validation',
        'category_enrichment',
        'connection_enrichment',
        'thesis_generation',
        'thesis_development',
        'synthesis_compatibility',
        'concept_synthesis',
        'critical_analysis',
        'historical_contextualization',
        'practical_application',
        'dialogical_interpretation',
        'concept_evolution'
      ];

      // Загрузка каждого шаблона
      for (const templateName of templateFiles) {
        const filePath = join(this.templateDir, `${templateName}.json`);
        const content = await readFile(filePath, 'utf-8');
        const template: PromptTemplate = JSON.parse(content);
        this.templates.set(templateName, template);
        logger.debug(`Loaded template: ${templateName}`);
      }

      // Кэширование шаблонов в Redis
      const templatesObj = Object.fromEntries(this.templates);
      await redisClient.set('prompt_templates', JSON.stringify(templatesObj), 'EX', 3600); // Кэш на 1 час

      this.templatesLoaded = true;
      logger.info(`Successfully loaded ${this.templates.size} templates`);
    } catch (error) {
      logger.error(`Failed to load templates: ${error}`);
      throw new Error(`Failed to load prompt templates: ${error}`);
    }
  }

  /**
   * Получает шаблон промпта по имени
   */
  async getTemplate(name: string): Promise<PromptTemplate | null> {
    if (!this.templatesLoaded) {
      await this.loadTemplates();
    }

    const template = this.templates.get(name);
    if (!template) {
      logger.warn(`Template not found: ${name}`);
      return null;
    }

    return template;
  }

  /**
   * Обновляет существующий шаблон промпта
   */
  async updateTemplate(name: string, template: PromptTemplate): Promise<boolean> {
    if (!this.templatesLoaded) {
      await this.loadTemplates();
    }

    if (!this.templates.has(name)) {
      logger.warn(`Cannot update non-existent template: ${name}`);
      return false;
    }

    try {
      // Сохранение шаблона в файл
      const filePath = join(this.templateDir, `${name}.json`);
      await new Promise<void>((resolve, reject) => {
        const fs = require('fs');
        fs.writeFile(filePath, JSON.stringify(template, null, 2), 'utf-8', (err: any) => {
          if (err) reject(err);
          resolve();
        });
      });

      // Обновление в памяти
      this.templates.set(name, template);

      // Обновление кэша Redis
      const templatesObj = Object.fromEntries(this.templates);
      await redisClient.set('prompt_templates', JSON.stringify(templatesObj), 'EX', 3600);

      logger.info(`Template updated: ${name}`);
      return true;
    } catch (error) {
      logger.error(`Failed to update template ${name}: ${error}`);
      return false;
    }
  }

  /**
   * Создает новый шаблон промпта
   */
  async createTemplate(name: string, template: PromptTemplate): Promise<boolean> {
    if (!this.templatesLoaded) {
      await this.loadTemplates();
    }

    if (this.templates.has(name)) {
      logger.warn(`Template already exists: ${name}`);
      return false;
    }

    try {
      // Сохранение шаблона в файл
      const filePath = join(this.templateDir, `${name}.json`);
      await new Promise<void>((resolve, reject) => {
        const fs = require('fs');
        fs.writeFile(filePath, JSON.stringify(template, null, 2), 'utf-8', (err: any) => {
          if (err) reject(err);
          resolve();
        });
      });

      // Добавление в память
      this.templates.set(name, template);

      // Обновление кэша Redis
      const templatesObj = Object.fromEntries(this.templates);
      await redisClient.set('prompt_templates', JSON.stringify(templatesObj), 'EX', 3600);

      logger.info(`Template created: ${name}`);
      return true;
    } catch (error) {
      logger.error(`Failed to create template ${name}: ${error}`);
      return false;
    }
  }

  /**
   * Получает список всех доступных шаблонов
   */
  async getAllTemplateNames(): Promise<string[]> {
    if (!this.templatesLoaded) {
      await this.loadTemplates();
    }

    return Array.from(this.templates.keys());
  }

  /**
   * Удаляет шаблон промпта
   */
  async deleteTemplate(name: string): Promise<boolean> {
    if (!this.templatesLoaded) {
      await this.loadTemplates();
    }

    if (!this.templates.has(name)) {
      logger.warn(`Cannot delete non-existent template: ${name}`);
      return false;
    }

    try {
      // Удаление файла
      const filePath = join(this.templateDir, `${name}.json`);
      await new Promise<void>((resolve, reject) => {
        const fs = require('fs');
        fs.unlink(filePath, (err: any) => {
          if (err) reject(err);
          resolve();
        });
      });

      // Удаление из памяти
      this.templates.delete(name);

      // Обновление кэша Redis
      const templatesObj = Object.fromEntries(this.templates);
      await redisClient.set('prompt_templates', JSON.stringify(templatesObj), 'EX', 3600);

      logger.info(`Template deleted: ${name}`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete template ${name}: ${error}`);
      return false;
    }
  }
}
