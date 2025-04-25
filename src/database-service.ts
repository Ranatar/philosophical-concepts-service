// src/services/database.service.ts

import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';
import {
  User,
  Concept,
  Category,
  CategoryAttribute,
  Connection,
  ConnectionAttribute,
  Thesis,
  ThesisVersion,
  SynthesisMeta,
  ClaudeInteraction,
  ConceptGraph
} from '../types';

/**
 * Сервис для работы с базой данных PostgreSQL
 */
export class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'philosophical_concepts',
      password: process.env.DB_PASSWORD || 'postgres',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      max: 20, // максимальное количество клиентов в пуле
      idleTimeoutMillis: 30000, // время простоя клиента перед закрытием соединения
      connectionTimeoutMillis: 2000, // время ожидания соединения
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err);
    });

    logger.info('Database service initialized');
  }

  /**
   * Получает клиент из пула соединений
   */
  private async getClient(): Promise<PoolClient> {
    try {
      return await this.pool.connect();
    } catch (error) {
      logger.error(`Error getting database client: ${error}`);
      throw new Error(`Failed to connect to database: ${error}`);
    }
  }

  /**
   * Закрывает соединение с базой данных
   */
  async closeConnection(): Promise<void> {
    try {
      await this.pool.end();
      logger.info('Database connection pool closed');
    } catch (error) {
      logger.error(`Error closing database connection: ${error}`);
    }
  }

  /**
   * Регистрирует нового пользователя
   */
  async createUser(user: Omit<User, 'user_id' | 'created_at'>): Promise<User> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      
      const result = await client.query(
        `INSERT INTO users(username, email, password_hash, account_type) 
         VALUES($1, $2, $3, $4) 
         RETURNING *`,
        [user.username, user.email, user.password_hash, user.account_type]
      );
      
      await client.query('COMMIT');
      
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error creating user: ${error}`);
      throw new Error(`Failed to create user: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Получает пользователя по email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error(`Error getting user by email: ${error}`);
      throw new Error(`Failed to get user: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Обновляет время последнего входа пользователя
   */
  async updateUserLastLogin(userId: string): Promise<void> {
    const client = await this.getClient();
    try {
      await client.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1',
        [userId]
      );
    } catch (error) {
      logger.error(`Error updating last login: ${error}`);
      throw new Error(`Failed to update last login: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Создает новую философскую концепцию
   */
  async createConcept(concept: Omit<Concept, 'concept_id' | 'creation_date' | 'last_modified'>): Promise<Concept> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      
      const result = await client.query(
        `INSERT INTO concepts(
          user_id, name, description, historical_context, 
          is_synthesis, parent_concepts, synthesis_method, focus_area
        ) 
        VALUES($1, $2, $3, $4, $5, $6, $7, $8) 
        RETURNING *`,
        [
          concept.user_id,
          concept.name,
          concept.description || null,
          concept.historical_context || null,
          concept.is_synthesis,
          JSON.stringify(concept.parent_concepts || []),
          concept.synthesis_method || null,
          concept.focus_area || null
        ]
      );
      
      await client.query('COMMIT');
      
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error creating concept: ${error}`);
      throw new Error(`Failed to create concept: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Получает концепцию по ID
   */
  async getConceptById(conceptId: string): Promise<Concept | null> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        'SELECT * FROM concepts WHERE concept_id = $1',
        [conceptId]
      );
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error(`Error getting concept: ${error}`);
      throw new Error(`Failed to get concept: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Обновляет концепцию
   */
  async updateConcept(conceptId: string, updates: Partial<Concept>): Promise<Concept> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      
      // Формирование строки обновления только для указанных полей
      const updateFields: string[] = [];
      const values: any[] = [];
      let valueIndex = 1;
      
      if (updates.name !== undefined) {
        updateFields.push(`name = $${valueIndex++}`);
        values.push(updates.name);
      }
      
      if (updates.description !== undefined) {
        updateFields.push(`description = $${valueIndex++}`);
        values.push(updates.description);
      }
      
      if (updates.historical_context !== undefined) {
        updateFields.push(`historical_context = $${valueIndex++}`);
        values.push(updates.historical_context);
      }
      
      if (updates.focus_area !== undefined) {
        updateFields.push(`focus_area = $${valueIndex++}`);
        values.push(updates.focus_area);
      }
      
      if (updateFields.length === 0) {
        throw new Error('No fields to update');
      }
      
      // Добавление ID концепции в список параметров
      values.push(conceptId);
      
      const result = await client.query(
        `UPDATE concepts 
         SET ${updateFields.join(', ')} 
         WHERE concept_id = $${valueIndex} 
         RETURNING *`,
        values
      );
      
      await client.query('COMMIT');
      
      if (result.rows.length === 0) {
        throw new Error(`Concept with ID ${conceptId} not found`);
      }
      
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error updating concept: ${error}`);
      throw new Error(`Failed to update concept: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Удаляет концепцию
   */
  async deleteConcept(conceptId: string): Promise<void> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      
      // Удаление концепции (каскадное удаление связанных сущностей настроено в схеме БД)
      const result = await client.query(
        'DELETE FROM concepts WHERE concept_id = $1 RETURNING concept_id',
        [conceptId]
      );
      
      if (result.rows.length === 0) {
        throw new Error(`Concept with ID ${conceptId} not found`);
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error deleting concept: ${error}`);
      throw new Error(`Failed to delete concept: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Получает список концепций пользователя
   */
  async getUserConcepts(userId: string): Promise<Concept[]> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        'SELECT * FROM concepts WHERE user_id = $1 ORDER BY creation_date DESC',
        [userId]
      );
      
      return result.rows;
    } catch (error) {
      logger.error(`Error getting user concepts: ${error}`);
      throw new Error(`Failed to get concepts: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Добавляет категорию в концепцию
   */
  async createCategory(category: Omit<Category, 'category_id' | 'created_at' | 'last_modified'>): Promise<Category> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      
      const result = await client.query(
        `INSERT INTO categories(
          concept_id, name, definition, extended_description, source
        ) 
        VALUES($1, $2, $3, $4, $5) 
        RETURNING *`,
        [
          category.concept_id,
          category.name,
          category.definition,
          category.extended_description || null,
          category.source || null
        ]
      );
      
      await client.query('COMMIT');
      
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error creating category: ${error}`);
      throw new Error(`Failed to create category: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Обновляет категорию
   */
  async updateCategory(categoryId: string, updates: Partial<Category>): Promise<Category> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      
      // Формирование строки обновления только для указанных полей
      const updateFields: string[] = [];
      const values: any[] = [];
      let valueIndex = 1;
      
      if (updates.name !== undefined) {
        updateFields.push(`name = $${valueIndex++}`);
        values.push(updates.name);
      }
      
      if (updates.definition !== undefined) {
        updateFields.push(`definition = $${valueIndex++}`);
        values.push(updates.definition);
      }
      
      if (updates.extended_description !== undefined) {
        updateFields.push(`extended_description = $${valueIndex++}`);
        values.push(updates.extended_description);
      }
      
      if (updates.source !== undefined) {
        updateFields.push(`source = $${valueIndex++}`);
        values.push(updates.source);
      }
      
      if (updateFields.length === 0) {
        throw new Error('No fields to update');
      }
      
      // Добавление ID категории в список параметров
      values.push(categoryId);
      
      const result = await client.query(
        `UPDATE categories 
         SET ${updateFields.join(', ')} 
         WHERE category_id = $${valueIndex} 
         RETURNING *`,
        values
      );
      
      await client.query('COMMIT');
      
      if (result.rows.length === 0) {
        throw new Error(`Category with ID ${categoryId} not found`);
      }
      
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error updating category: ${error}`);
      throw new Error(`Failed to update category: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Удаляет категорию
   */
  async deleteCategory(categoryId: string): Promise<void> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      
      // Удаление категории (каскадное удаление связанных атрибутов настроено в схеме БД)
      const result = await client.query(
        'DELETE FROM categories WHERE category_id = $1 RETURNING category_id',
        [categoryId]
      );
      
      if (result.rows.length === 0) {
        throw new Error(`Category with ID ${categoryId} not found`);
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error deleting category: ${error}`);
      throw new Error(`Failed to delete category: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Получает категории концепции
   */
  async getConceptCategories(conceptId: string): Promise<Category[]> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        'SELECT * FROM categories WHERE concept_id = $1 ORDER BY name',
        [conceptId]
      );
      
      return result.rows;
    } catch (error) {
      logger.error(`Error getting concept categories: ${error}`);
      throw new Error(`Failed to get categories: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Получает категорию по ID
   */
  async getCategoryById(categoryId: string): Promise<Category | null> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        'SELECT * FROM categories WHERE category_id = $1',
        [categoryId]
      );
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error(`Error getting category: ${error}`);
      throw new Error(`Failed to get category: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Добавляет атрибут категории
   */
  async createCategoryAttribute(
    attribute: Omit<CategoryAttribute, 'attribute_id' | 'created_at' | 'last_modified'>
  ): Promise<CategoryAttribute> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      
      // Проверка существования категории
      const categoryExists = await client.query(
        'SELECT 1 FROM categories WHERE category_id = $1',
        [attribute.category_id]
      );
      
      if (categoryExists.rows.length === 0) {
        throw new Error(`Category with ID ${attribute.category_id} not found`);
      }
      
      // Проверка наличия атрибута данного типа у категории
      const existingAttribute = await client.query(
        'SELECT attribute_id FROM category_attributes WHERE category_id = $1 AND attribute_type = $2',
        [attribute.category_id, attribute.attribute_type]
      );
      
      let result;
      
      if (existingAttribute.rows.length > 0) {
        // Обновление существующего атрибута
        result = await client.query(
          `UPDATE category_attributes 
           SET value = $1, justification = $2, methodology = $3, last_modified = CURRENT_TIMESTAMP 
           WHERE attribute_id = $4 
           RETURNING *`,
          [
            attribute.value,
            attribute.justification || null,
            attribute.methodology || null,
            existingAttribute.rows[0].attribute_id
          ]
        );
      } else {
        // Создание нового атрибута
        result = await client.query(
          `INSERT INTO category_attributes(
            category_id, attribute_type, value, justification, methodology
          ) 
          VALUES($1, $2, $3, $4, $5) 
          RETURNING *`,
          [
            attribute.category_id,
            attribute.attribute_type,
            attribute.value,
            attribute.justification || null,
            attribute.methodology || null
          ]
        );
      }
      
      await client.query('COMMIT');
      
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error creating category attribute: ${error}`);
      throw new Error(`Failed to create category attribute: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Получает атрибуты категории
   */
  async getCategoryAttributes(categoryId: string): Promise<CategoryAttribute[]> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        'SELECT * FROM category_attributes WHERE category_id = $1',
        [categoryId]
      );
      
      return result.rows;
    } catch (error) {
      logger.error(`Error getting category attributes: ${error}`);
      throw new Error(`Failed to get category attributes: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Удаляет атрибут категории
   */
  async deleteCategoryAttribute(attributeId: string): Promise<void> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      
      const result = await client.query(
        'DELETE FROM category_attributes WHERE attribute_id = $1 RETURNING attribute_id',
        [attributeId]
      );
      
      if (result.rows.length === 0) {
        throw new Error(`Attribute with ID ${attributeId} not found`);
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error deleting category attribute: ${error}`);
      throw new Error(`Failed to delete category attribute: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Создает связь между категориями
   */
  async createConnection(
    connection: Omit<Connection, 'connection_id' | 'created_at' | 'last_modified'>
  ): Promise<Connection> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      
      // Проверка существования исходной категории
      const sourceExists = await client.query(
        'SELECT 1 FROM categories WHERE category_id = $1 AND concept_id = $2',
        [connection.source_category_id, connection.concept_id]
      );
      
      if (sourceExists.rows.length === 0) {
        throw new Error(`Source category with ID ${connection.source_category_id} not found in concept ${connection.concept_id}`);
      }
      
      // Проверка существования целевой категории
      const targetExists = await client.query(
        'SELECT 1 FROM categories WHERE category_id = $1 AND concept_id = $2',
        [connection.target_category_id, connection.concept_id]
      );
      
      if (targetExists.rows.length === 0) {
        throw new Error(`Target category with ID ${connection.target_category_id} not found in concept ${connection.concept_id}`);
      }
      
      const result = await client.query(
        `INSERT INTO connections(
          concept_id, source_category_id, target_category_id, 
          connection_type, direction, description
        ) 
        VALUES($1, $2, $3, $4, $5, $6) 
        RETURNING *`,
        [
          connection.concept_id,
          connection.source_category_id,
          connection.target_category_id,
          connection.connection_type,
          connection.direction,
          connection.description || null
        ]
      );
      
      await client.query('COMMIT');
      
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error creating connection: ${error}`);
      throw new Error(`Failed to create connection: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Обновляет связь
   */
  async updateConnection(connectionId: string, updates: Partial<Connection>): Promise<Connection> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      
      // Формирование строки обновления только для указанных полей
      const updateFields: string[] = [];
      const values: any[] = [];
      let valueIndex = 1;
      
      if (updates.connection_type !== undefined) {
        updateFields.push(`connection_type = $${valueIndex++}`);
        values.push(updates.connection_type);
      }
      
      if (updates.direction !== undefined) {
        updateFields.push(`direction = $${valueIndex++}`);
        values.push(updates.direction);
      }
      
      if (updates.description !== undefined) {
        updateFields.push(`description = $${valueIndex++}`);
        values.push(updates.description);
      }
      
      if (updateFields.length === 0) {
        throw new Error('No fields to update');
      }
      
      // Добавление ID связи в список параметров
      values.push(connectionId);
      
      const result = await client.query(
        `UPDATE connections 
         SET ${updateFields.join(', ')} 
         WHERE connection_id = $${valueIndex} 
         RETURNING *`,
        values
      );
      
      await client.query('COMMIT');
      
      if (result.rows.length === 0) {
        throw new Error(`Connection with ID ${connectionId} not found`);
      }
      
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error updating connection: ${error}`);
      throw new Error(`Failed to update connection: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Удаляет связь
   */
  async deleteConnection(connectionId: string): Promise<void> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      
      // Удаление связи (каскадное удаление связанных атрибутов настроено в схеме БД)
      const result = await client.query(
        'DELETE FROM connections WHERE connection_id = $1 RETURNING connection_id',
        [connectionId]
      );
      
      if (result.rows.length === 0) {
        throw new Error(`Connection with ID ${connectionId} not found`);
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error deleting connection: ${error}`);
      throw new Error(`Failed to delete connection: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Получает связи концепции
   */
  async getConceptConnections(conceptId: string): Promise<Connection[]> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `SELECT c.*, 
                sc.name as source_category_name, 
                sc.definition as source_category_definition,
                tc.name as target_category_name, 
                tc.definition as target_category_definition
         FROM connections c
         JOIN categories sc ON c.source_category_id = sc.category_id
         JOIN categories tc ON c.target_category_id = tc.category_id
         WHERE c.concept_id = $1`,
        [conceptId]
      );
      
      // Преобразование результата для соответствия типу Connection
      return result.rows.map(row => ({
        connection_id: row.connection_id,
        concept_id: row.concept_id,
        source_category_id: row.source_category_id,
        target_category_id: row.target_category_id,
        connection_type: row.connection_type,
        direction: row.direction,
        description: row.description,
        created_at: row.created_at,
        last_modified: row.last_modified,
        source_category: {
          category_id: row.source_category_id,
          name: row.source_category_name,
          definition: row.source_category_definition
        } as any,
        target_category: {
          category_id: row.target_category_id,
          name: row.target_category_name,
          definition: row.target_category_definition
        } as any
      }));
    } catch (error) {
      logger.error(`Error getting concept connections: ${error}`);
      throw new Error(`Failed to get connections: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Получает связь по ID
   */
  async getConnectionById(connectionId: string): Promise<Connection | null> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `SELECT c.*, 
                sc.name as source_category_name, 
                sc.definition as source_category_definition,
                tc.name as target_category_name, 
                tc.definition as target_category_definition
         FROM connections c
         JOIN categories sc ON c.source_category_id = sc.category_id
         JOIN categories tc ON c.target_category_id = tc.category_id
         WHERE c.connection_id = $1`,
        [connectionId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      
      return {
        connection_id: row.connection_id,
        concept_id: row.concept_id,
        source_category_id: row.source_category_id,
        target_category_id: row.target_category_id,
        connection_type: row.connection_type,
        direction: row.direction,
        description: row.description,
        created_at: row.created_at,
        last_modified: row.last_modified,
        source_category: {
          category_id: row.source_category_id,
          name: row.source_category_name,
          definition: row.source_category_definition
        } as any,
        target_category: {
          category_id: row.target_category_id,
          name: row.target_category_name,
          definition: row.target_category_definition
        } as any
      };
    } catch (error) {
      logger.error(`Error getting connection: ${error}`);
      throw new Error(`Failed to get connection: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Добавляет атрибут связи
   */
  async createConnectionAttribute(
    attribute: Omit<ConnectionAttribute, 'attribute_id' | 'created_at' | 'last_modified'>
  ): Promise<ConnectionAttribute> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      
      // Проверка существования связи
      const connectionExists = await client.query(
        'SELECT 1 FROM connections WHERE connection_id = $1',
        [attribute.connection_id]
      );
      
      if (connectionExists.rows.length === 0) {
        throw new Error(`Connection with ID ${attribute.connection_id} not found`);
      }
      
      // Проверка наличия атрибута данного типа у связи
      const existingAttribute = await client.query(
        'SELECT attribute_id FROM connection_attributes WHERE connection_id = $1 AND attribute_type = $2',
        [attribute.connection_id, attribute.attribute_type]
      );
      
      let result;
      
      if (existingAttribute.rows.length > 0) {
        // Обновление существующего атрибута
        result = await client.query(
          `UPDATE connection_attributes 
           SET value = $1, justification = $2, methodology = $3, last_modified = CURRENT_TIMESTAMP 
           WHERE attribute_id = $4 
           RETURNING *`,
          [
            attribute.value,
            attribute.justification || null,
            attribute.methodology || null,
            existingAttribute.rows[0].attribute_id
          ]
        );
      } else {
        // Создание нового атрибута
        result = await client.query(
          `INSERT INTO connection_attributes(
            connection_id, attribute_type, value, justification, methodology
          ) 
          VALUES($1, $2, $3, $4, $5) 
          RETURNING *`,
          [
            attribute.connection_id,
            attribute.attribute_type,
            attribute.value,
            attribute.justification || null,
            attribute.methodology || null
          ]
        );
      }
      
      await client.query('COMMIT');
      
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error creating connection attribute: ${error}`);
      throw new Error(`Failed to create connection attribute: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Получает атрибуты связи
   */
  async getConnectionAttributes(connectionId: string): Promise<ConnectionAttribute[]> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        'SELECT * FROM connection_attributes WHERE connection_id = $1',
        [connectionId]
      );
      
      return result.rows;
    } catch (error) {
      logger.error(`Error getting connection attributes: ${error}`);
      throw new Error(`Failed to get connection attributes: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Удаляет атрибут связи
   */
  async deleteConnectionAttribute(attributeId: string): Promise<void> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      
      const result = await client.query(
        'DELETE FROM connection_attributes WHERE attribute_id = $1 RETURNING attribute_id',
        [attributeId]
      );
      
      if (result.rows.length === 0) {
        throw new Error(`Attribute with ID ${attributeId} not found`);
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error deleting connection attribute: ${error}`);
      throw new Error(`Failed to delete connection attribute: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Получает полный граф концепции с категориями, связями и атрибутами
   */
  async getConceptGraph(conceptId: string): Promise<ConceptGraph> {
    const client = await this.getClient();
    try {
      // Получение информации о концепции
      const conceptResult = await client.query(
        'SELECT * FROM concepts WHERE concept_id = $1',
        [conceptId]
      );
      
      if (conceptResult.rows.length === 0) {
        throw new Error(`Concept with ID ${conceptId} not found`);
      }
      
      const concept = conceptResult.rows[0];
      
      // Получение категорий
      const categoriesResult = await client.query(
        'SELECT * FROM categories WHERE concept_id = $1',
        [conceptId]
      );
      
      const categories = categoriesResult.rows;
      
      // Получение связей
      const connectionsResult = await client.query(
        `SELECT c.*, 
                sc.name as source_category_name, 
                sc.definition as source_category_definition,
                tc.name as target_category_name, 
                tc.definition as target_category_definition
         FROM connections c
         JOIN categories sc ON c.source_category_id = sc.category_id
         JOIN categories tc ON c.target_category_id = tc.category_id
         WHERE c.concept_id = $1`,
        [conceptId]
      );
      
      const connections = connectionsResult.rows;
      
      // Получение атрибутов категорий
      const categoryAttributes: Record<string, CategoryAttribute[]> = {};
      
      if (categories.length > 0) {
        const categoryIds = categories.map(c => c.category_id);
        
        const categoryAttrsResult = await client.query(
          'SELECT * FROM category_attributes WHERE category_id = ANY($1)',
          [categoryIds]
        );
        
        // Группировка атрибутов по ID категории
        for (const attr of categoryAttrsResult.rows) {
          if (!categoryAttributes[attr.category_id]) {
            categoryAttributes[attr.category_id] = [];
          }
          categoryAttributes[attr.category_id].push(attr);
        }
      }
      
      // Получение атрибутов связей
      const connectionAttributes: Record<string, ConnectionAttribute[]> = {};
      
      if (connections.length > 0) {
        const connectionIds = connections.map(c => c.connection_id);
        
        const connectionAttrsResult = await client.query(
          'SELECT * FROM connection_attributes WHERE connection_id = ANY($1)',
          [connectionIds]
        );
        
        // Группировка атрибутов по ID связи
        for (const attr of connectionAttrsResult.rows) {
          if (!connectionAttributes[attr.connection_id]) {
            connectionAttributes[attr.connection_id] = [];
          }
          connectionAttributes[attr.connection_id].push(attr);
        }
      }
      
      // Построение графа концепции
      const graph: ConceptGraph = {
        concept_id: concept.concept_id,
        concept_name: concept.name,
        concept_description: concept.description,
        categories: categories.map(category => ({
          ...category,
          attributes: categoryAttributes[category.category_id] || []
        })),
        connections: connections.map(conn => ({
          connection_id: conn.connection_id,
          concept_id: conn.concept_id,
          source_category_id: conn.source_category_id,
          target_category_id: conn.target_category_id,
          connection_type: conn.connection_type,
          direction: conn.direction,
          description: conn.description,
          created_at: conn.created_at,
          last_modified: conn.last_modified,
          attributes: connectionAttributes[conn.connection_id] || [],
          source_category: {
            category_id: conn.source_category_id,
            concept_id: conn.concept_id,
            name: conn.source_category_name,
            definition: conn.source_category_definition
          } as any,
          target_category: {
            category_id: conn.target_category_id,
            concept_id: conn.concept_id,
            name: conn.target_category_name,
            definition: conn.target_category_definition
          } as any
        }))
      };
      
      return graph;
    } catch (error) {
      logger.error(`Error getting concept graph: ${error}`);
      throw new Error(`Failed to get concept graph: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Создает тезис
   */
  async createThesis(thesis: Omit<Thesis, 'thesis_id' | 'created_at' | 'last_modified'>): Promise<Thesis> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      
      const result = await client.query(
        `INSERT INTO theses(
          concept_id, text, type, derived_from, 
          generation_parameters, used_weights, style
        ) 
        VALUES($1, $2, $3, $4, $5, $6, $7) 
        RETURNING *`,
        [
          thesis.concept_id,
          thesis.text,
          thesis.type,
          thesis.derived_from ? JSON.stringify(thesis.derived_from) : null,
          thesis.generation_parameters ? JSON.stringify(thesis.generation_parameters) : null,
          thesis.used_weights,
          thesis.style || null
        ]
      );
      
      await client.query('COMMIT');
      
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error creating thesis: ${error}`);
      throw new Error(`Failed to create thesis: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Получает тезисы концепции
   */
  async getConceptTheses(conceptId: string): Promise<Thesis[]> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        'SELECT * FROM theses WHERE concept_id = $1 ORDER BY created_at DESC',
        [conceptId]
      );
      
      return result.rows;
    } catch (error) {
      logger.error(`Error getting concept theses: ${error}`);
      throw new Error(`Failed to get theses: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Получает тезис по ID
   */
  async getThesisById(thesisId: string): Promise<Thesis | null> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        'SELECT * FROM theses WHERE thesis_id = $1',
        [thesisId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      logger.error(`Error getting thesis: ${error}`);
      throw new Error(`Failed to get thesis: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Создает версию тезиса
   */
  async createThesisVersion(
    version: Omit<ThesisVersion, 'version_id' | 'created_at'>
  ): Promise<ThesisVersion> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      
      // Проверка существования тезиса
      const thesisExists = await client.query(
        'SELECT 1 FROM theses WHERE thesis_id = $1',
        [version.thesis_id]
      );
      
      if (thesisExists.rows.length === 0) {
        throw new Error(`Thesis with ID ${version.thesis_id} not found`);
      }
      
      const result = await client.query(
        `INSERT INTO thesis_versions(
          thesis_id, text, justification, counterarguments, 
          historical_analogs, practical_implications
        ) 
        VALUES($1, $2, $3, $4, $5, $6) 
        RETURNING *`,
        [
          version.thesis_id,
          version.text,
          version.justification || null,
          version.counterarguments || null,
          version.historical_analogs || null,
          version.practical_implications || null
        ]
      );
      
      await client.query('COMMIT');
      
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error creating thesis version: ${error}`);
      throw new Error(`Failed to create thesis version: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Получает версии тезиса
   */
  async getThesisVersions(thesisId: string): Promise<ThesisVersion[]> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        'SELECT * FROM thesis_versions WHERE thesis_id = $1 ORDER BY created_at DESC',
        [thesisId]
      );
      
      return result.rows;
    } catch (error) {
      logger.error(`Error getting thesis versions: ${error}`);
      throw new Error(`Failed to get thesis versions: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Сохраняет метаданные о синтезе концепций
   */
  async createSynthesisMeta(
    synthesisMeta: Omit<SynthesisMeta, 'synthesis_id' | 'created_at'>
  ): Promise<SynthesisMeta> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      
      const result = await client.query(
        `INSERT INTO synthesis_meta(
          result_concept_id, source_concept_ids, synthesis_method, 
          innovation_level, abstraction_level, historical_context, 
          target_application, compatibility_analysis
        ) 
        VALUES($1, $2, $3, $4, $5, $6, $7, $8) 
        RETURNING *`,
        [
          synthesisMeta.result_concept_id,
          JSON.stringify(synthesisMeta.source_concept_ids),
          synthesisMeta.synthesis_method,
          synthesisMeta.innovation_level || null,
          synthesisMeta.abstraction_level || null,
          synthesisMeta.historical_context || null,
          synthesisMeta.target_application || null,
          synthesisMeta.compatibility_analysis ? JSON.stringify(synthesisMeta.compatibility_analysis) : null
        ]
      );
      
      await client.query('COMMIT');
      
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error creating synthesis meta: ${error}`);
      throw new Error(`Failed to create synthesis meta: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Получает метаданные о синтезе по ID результирующей концепции
   */
  async getSynthesisMetaByResultConcept(conceptId: string): Promise<SynthesisMeta | null> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        'SELECT * FROM synthesis_meta WHERE result_concept_id = $1',
        [conceptId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      logger.error(`Error getting synthesis meta: ${error}`);
      throw new Error(`Failed to get synthesis meta: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Логирует взаимодействие с Claude API
   */
  async logClaudeInteraction(
    interaction: Omit<ClaudeInteraction, 'interaction_id' | 'created_at'>
  ): Promise<ClaudeInteraction> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `INSERT INTO claude_interactions(
          user_id, concept_id, interaction_type, 
          prompt, response, tokens_used, duration_ms
        ) 
        VALUES($1, $2, $3, $4, $5, $6, $7) 
        RETURNING *`,
        [
          interaction.user_id,
          interaction.concept_id || null,
          interaction.interaction_type,
          interaction.prompt,
          interaction.response || null,
          interaction.tokens_used || null,
          interaction.duration_ms || null
        ]
      );
      
      return result.rows[0];
    } catch (error) {
      logger.error(`Error logging Claude interaction: ${error}`);
      throw new Error(`Failed to log Claude interaction: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Получает статистику использования Claude API
   */
  async getClaudeUsageStats(userId: string, days: number = 30): Promise<any> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `SELECT 
           date_trunc('day', created_at) as date,
           interaction_type,
           COUNT(*) as count,
           SUM(tokens_used) as tokens,
           AVG(duration_ms) as avg_duration
         FROM claude_interactions
         WHERE user_id = $1 AND created_at > NOW() - INTERVAL '${days} days'
         GROUP BY date_trunc('day', created_at), interaction_type
         ORDER BY date DESC, interaction_type`,
        [userId]
      );
      
      return result.rows;
    } catch (error) {
      logger.error(`Error getting Claude usage stats: ${error}`);
      throw new Error(`Failed to get Claude usage stats: ${error}`);
    } finally {
      client.release();
    }
  }

  /**
   * Поиск концепций по тексту
   */
  async searchConcepts(query: string, userId?: string): Promise<Concept[]> {
    const client = await this.getClient();
    try {
      let sql = `
        SELECT c.* FROM concepts c
        WHERE to_tsvector('english', c.name || ' ' || COALESCE(c.description, '')) @@ plainto_tsquery('english', $1)
      `;
      
      const params = [query];
      
      // Если указан ID пользователя, ищем только среди его концепций
      if (userId) {
        sql += ' AND c.user_id = $2';
        params.push(userId);
      }
      
      sql += ' ORDER BY c.name';
      
      const result = await client.query(sql, params);
      
      return result.rows;
    } catch (error) {
      logger.error(`Error searching concepts: ${error}`);
      throw new Error(`Failed to search concepts: ${error}`);
    } finally {
      client.release();
    }
  }
}
