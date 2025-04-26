// src/services/category.service.ts

import { DatabaseService } from './database.service';
import { ClaudeService } from './claude.service';
import { ConceptService } from './concept.service';
import { logger } from '../utils/logger';
import {
  Category,
  CategoryCreateDTO,
  CategoryUpdateDTO,
  CategoryAttribute,
  AttributeCreateDTO,
  AttributeUpdateDTO,
  EnrichmentResult
} from '../types';

/**
 * Сервис для управления категориями философских концепций
 */
export class CategoryService {
  private dbService: DatabaseService;
  private claudeService: ClaudeService;
  private conceptService: ConceptService;

  constructor() {
    this.dbService = new DatabaseService();
    this.claudeService = new ClaudeService();
    this.conceptService = new ConceptService();
    logger.info('CategoryService initialized');
  }

  /**
   * Добавляет категорию в концепцию
   */
  async addCategory(conceptId: string, data: CategoryCreateDTO): Promise<Category> {
    try {
      logger.info(`Adding category "${data.name}" to concept ${conceptId}`);
      
      // Проверка существования концепции
      await this.conceptService.getConcept(conceptId);
      
      const category: Omit<Category, 'category_id' | 'created_at' | 'last_modified'> = {
        concept_id: conceptId,
        name: data.name,
        definition: data.definition,
        extended_description: data.extended_description,
        source: data.source,
        tradition_concepts: data.tradition_concepts || [],  // По умолчанию пустой массив
        philosophers: data.philosophers || []                // По умолчанию пустой массив
      };
      
      return await this.dbService.createCategory(category);
    } catch (error) {
      logger.error(`Failed to add category: ${error}`);
      throw new Error(`Failed to add category: ${error}`);
    }
  }

  /**
   * Обновляет категорию
   */
  async updateCategory(categoryId: string, data: CategoryUpdateDTO): Promise<Category> {
    try {
      logger.info(`Updating category ${categoryId}`);
      
      // Проверка существования категории
      await this.getCategoryById(categoryId);
      
      return await this.dbService.updateCategory(categoryId, data);
    } 
    if (updates.tradition_concepts !== undefined) {
      updateFields.push(`tradition_concepts = $${valueIndex++}`);
      values.push(JSON.stringify(updates.tradition_concepts));
    }

    if (updates.philosophers !== undefined) {
      updateFields.push(`philosophers = $${valueIndex++}`);
      values.push(JSON.stringify(updates.philosophers));
    } catch (error) {
      logger.error(`Failed to update category: ${error}`);
      throw new Error(`Failed to update category: ${error}`);
    }
  }

  /**
   * Удаляет категорию
   */
  async deleteCategory(categoryId: string): Promise<void> {
    try {
      logger.info(`Deleting category ${categoryId}`);
      
      // Проверка существования категории
      await this.getCategoryById(categoryId);
      
      await this.dbService.deleteCategory(categoryId);
    } catch (error) {
      logger.error(`Failed to delete category: ${error}`);
      throw new Error(`Failed to delete category: ${error}`);
    }
  }

  /**
   * Получает категорию по ID
   */
  async getCategoryById(categoryId: string): Promise<Category> {
    try {
      const category = await this.dbService.getCategoryById(categoryId);
      
      if (!category) {
        throw new Error(`Category with ID ${categoryId} not found`);
      }
      
      return category;
    } catch (error) {
      logger.error(`Failed to get category: ${error}`);
      throw new Error(`Failed to get category: ${error}`);
    }
  }

  /**
   * Получает полную категорию с атрибутами
   */
  async getFullCategory(categoryId: string): Promise<Category & { attributes: CategoryAttribute[] }> {
    try {
      // Получение базовой категории
      const category = await this.getCategoryById(categoryId);
      
      // Получение атрибутов категории
      const attributes = await this.dbService.getCategoryAttributes(categoryId);
      
      return {
        ...category,
        attributes
      };
    } catch (error) {
      logger.error(`Failed to get full category: ${error}`);
      throw new Error(`Failed to get full category: ${error}`);
    }
  }

  /**
   * Получает список категорий концепции
   */
  async listConceptCategories(conceptId: string): Promise<Category[]> {
    try {
      // Проверка существования концепции
      await this.conceptService.getConcept(conceptId);
      
      return await this.dbService.getConceptCategories(conceptId);
    } catch (error) {
      logger.error(`Failed to list concept categories: ${error}`);
      throw new Error(`Failed to list concept categories: ${error}`);
    }
  }

  /**
   * Получает список категорий концепции с их атрибутами
   */
  async listConceptCategoriesWithAttributes(conceptId: string): Promise<(Category & { attributes: CategoryAttribute[] })[]> {
    try {
      // Получение категорий концепции
      const categories = await this.listConceptCategories(conceptId);
      
      // Для каждой категории получаем атрибуты
      const fullCategories = await Promise.all(
        categories.map(async (category) => {
          const attributes = await this.dbService.getCategoryAttributes(category.category_id);
          return {
            ...category,
            attributes
          };
        })
      );
      
      return fullCategories;
    } catch (error) {
      logger.error(`Failed to list categories with attributes: ${error}`);
      throw new Error(`Failed to list categories with attributes: ${error}`);
    }
  }

  /**
   * Обогащает категорию дополнительной информацией с помощью Claude
   */
  async enrichCategory(userId: string, categoryId: string): Promise<EnrichmentResult> {
    try {
      logger.info(`Enriching category ${categoryId}`);
      
      // Получение категории
      const category = await this.getCategoryById(categoryId);
      
      // Получение концепции
      const concept = await this.conceptService.getConcept(category.concept_id);
      
      // Обогащение через Claude API
      const enrichmentResult = await this.claudeService.enrichCategory(userId, category, concept);
      
      // Обновление расширенного описания категории в базе данных
      if (enrichmentResult.extended_description) {
        await this.dbService.updateCategory(categoryId, {
          extended_description: enrichmentResult.extended_description
        });
      }
      
      return enrichmentResult;
    } catch (error) {
      logger.error(`Failed to enrich category: ${error}`);
      throw new Error(`Failed to enrich category: ${error}`);
    }
  }

  /**
   * Добавляет атрибут категории
   */
  async addCategoryAttribute(categoryId: string, data: AttributeCreateDTO): Promise<CategoryAttribute> {
    try {
      logger.info(`Adding ${data.attribute_type} attribute to category ${categoryId}`);
      
      // Проверка существования категории
      await this.getCategoryById(categoryId);
      
      // Проверка допустимого типа атрибута
      this.validateAttributeType(data.attribute_type, 'category');
      
      // Проверка допустимого значения атрибута
      this.validateAttributeValue(data.value);
      
      const attribute: Omit<CategoryAttribute, 'attribute_id' | 'created_at' | 'last_modified'> = {
        category_id: categoryId,
        attribute_type: data.attribute_type as any, // Приведение типа
        value: data.value,
        justification: data.justification,
        methodology: data.methodology
      };
      
      return await this.dbService.createCategoryAttribute(attribute);
    } catch (error) {
      logger.error(`Failed to add category attribute: ${error}`);
      throw new Error(`Failed to add category attribute: ${error}`);
    }
  }

  /**
   * Обновляет атрибут категории
   */
  async updateCategoryAttribute(attributeId: string, data: AttributeUpdateDTO): Promise<CategoryAttribute> {
    try {
      logger.info(`Updating category attribute ${attributeId}`);
      
      // Получение атрибута для проверки существования
      const attribute = await this.getCategoryAttributeById(attributeId);
      
      // Проверка допустимого значения атрибута
      if (data.value !== undefined) {
        this.validateAttributeValue(data.value);
      }
      
      // Формирование объекта обновления
      const updates: any = {};
      
      if (data.value !== undefined) updates.value = data.value;
      if (data.justification !== undefined) updates.justification = data.justification;
      if (data.methodology !== undefined) updates.methodology = data.methodology;
      
      // Обновление атрибута
      return await this.dbService.updateCategoryAttribute(attributeId, updates);
    } catch (error) {
      logger.error(`Failed to update category attribute: ${error}`);
      throw new Error(`Failed to update category attribute: ${error}`);
    }
  }

  /**
   * Удаляет атрибут категории
   */
  async deleteCategoryAttribute(attributeId: string): Promise<void> {
    try {
      logger.info(`Deleting category attribute ${attributeId}`);
      
      // Проверка существования атрибута
      await this.getCategoryAttributeById(attributeId);
      
      await this.dbService.deleteCategoryAttribute(attributeId);
    } catch (error) {
      logger.error(`Failed to delete category attribute: ${error}`);
      throw new Error(`Failed to delete category attribute: ${error}`);
    }
  }

  /**
   * Получает атрибут категории по ID
   */
  async getCategoryAttributeById(attributeId: string): Promise<CategoryAttribute> {
    try {
      const client = await this.dbService.getClient();
      
      try {
        const result = await client.query(
          'SELECT * FROM category_attributes WHERE attribute_id = $1',
          [attributeId]
        );
        
        if (result.rows.length === 0) {
          throw new Error(`Category attribute with ID ${attributeId} not found`);
        }
        
        return result.rows[0];
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error(`Failed to get category attribute: ${error}`);
      throw new Error(`Failed to get category attribute: ${error}`);
    }
  }

  /**
   * Получает атрибуты категории
   */
  async getCategoryAttributes(categoryId: string): Promise<CategoryAttribute[]> {
    try {
      // Проверка существования категории
      await this.getCategoryById(categoryId);
      
      return await this.dbService.getCategoryAttributes(categoryId);
    } catch (error) {
      logger.error(`Failed to get category attributes: ${error}`);
      throw new Error(`Failed to get category attributes: ${error}`);
    }
  }

  /**
   * Проверяет допустимость типа атрибута
   */
  private validateAttributeType(type: string, entity: 'category' | 'connection'): void {
    if (entity === 'category') {
      const validTypes = ['centrality', 'definiteness', 'historical_significance'];
      if (!validTypes.includes(type)) {
        throw new Error(`Invalid category attribute type: ${type}. Valid types are: ${validTypes.join(', ')}`);
      }
    } else {
      const validTypes = ['strength', 'obviousness'];
      if (!validTypes.includes(type)) {
        throw new Error(`Invalid connection attribute type: ${type}. Valid types are: ${validTypes.join(', ')}`);
      }
    }
  }

  /**
   * Проверяет допустимость значения атрибута
   */
  private validateAttributeValue(value: number): void {
    if (value < 0 || value > 1) {
      throw new Error(`Invalid attribute value: ${value}. Value must be between 0 and 1`);
    }
  }

  /**
   * Обновляет атрибут категории
   */
  private async updateCategoryAttribute(attributeId: string, updates: Partial<CategoryAttribute>): Promise<CategoryAttribute> {
    const client = await this.dbService.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Формирование строки обновления только для указанных полей
      const updateFields: string[] = [];
      const values: any[] = [];
      let valueIndex = 1;
      
      if (updates.value !== undefined) {
        updateFields.push(`value = $${valueIndex++}`);
        values.push(updates.value);
      }
      
      if (updates.justification !== undefined) {
        updateFields.push(`justification = $${valueIndex++}`);
        values.push(updates.justification);
      }
      
      if (updates.methodology !== undefined) {
        updateFields.push(`methodology = $${valueIndex++}`);
        values.push(updates.methodology);
      }
      
      updateFields.push(`last_modified = CURRENT_TIMESTAMP`);
      
      if (updateFields.length === 1) { // Только last_modified
        throw new Error('No fields to update');
      }
      
      // Добавление ID атрибута в список параметров
      values.push(attributeId);
      
      const result = await client.query(
        `UPDATE category_attributes 
         SET ${updateFields.join(', ')} 
         WHERE attribute_id = $${valueIndex} 
         RETURNING *`,
        values
      );
      
      await client.query('COMMIT');
      
      if (result.rows.length === 0) {
        throw new Error(`Attribute with ID ${attributeId} not found`);
      }
      
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
