// src/services/connection.service.ts

import { DatabaseService } from './database.service';
import { ClaudeService } from './claude.service';
import { ConceptService } from './concept.service';
import { logger } from '../utils/logger';
import {
  Connection,
  ConnectionCreateDTO,
  ConnectionUpdateDTO,
  ConnectionAttribute,
  AttributeCreateDTO,
  AttributeUpdateDTO,
  EnrichmentResult
} from '../types';

/**
 * Сервис для управления связями философских концепций
 */
export class ConnectionService {
  private dbService: DatabaseService;
  private claudeService: ClaudeService;
  private conceptService: ConceptService;

  constructor() {
    this.dbService = new DatabaseService();
    this.claudeService = new ClaudeService();
    this.conceptService = new ConceptService();
    logger.info('ConnectionService initialized');
  }

  /**
   * Создает связь между категориями
   */
  async createConnection(conceptId: string, data: ConnectionCreateDTO): Promise<Connection> {
    try {
      logger.info(`Creating connection in concept ${conceptId}`);
      
      // Проверка существования концепции
      await this.conceptService.getConcept(conceptId);
      
      // Проверка существования исходной категории
      const client = await this.dbService.getClient();
      try {
        const sourceExists = await client.query(
          'SELECT 1 FROM categories WHERE category_id = $1 AND concept_id = $2',
          [data.source_category_id, conceptId]
        );
        
        if (sourceExists.rows.length === 0) {
          throw new Error(`Source category with ID ${data.source_category_id} not found in concept ${conceptId}`);
        }
        
        // Проверка существования целевой категории
        const targetExists = await client.query(
          'SELECT 1 FROM categories WHERE category_id = $1 AND concept_id = $2',
          [data.target_category_id, conceptId]
        );
        
        if (targetExists.rows.length === 0) {
          throw new Error(`Target category with ID ${data.target_category_id} not found in concept ${conceptId}`);
        }
      } finally {
        client.release();
      }
      
      // Создание связи
      const connection: Omit<Connection, 'connection_id' | 'created_at' | 'last_modified' | 'source_category' | 'target_category'> = {
        concept_id: conceptId,
        source_category_id: data.source_category_id,
        target_category_id: data.target_category_id,
        connection_type: data.connection_type,
        direction: data.direction,
        description: data.description
      };
      
      return await this.dbService.createConnection(connection);
    } catch (error) {
      logger.error(`Failed to create connection: ${error}`);
      throw new Error(`Failed to create connection: ${error}`);
    }
  }

  /**
   * Обновляет связь
   */
  async updateConnection(connectionId: string, data: ConnectionUpdateDTO): Promise<Connection> {
    try {
      logger.info(`Updating connection ${connectionId}`);
      
      // Проверка существования связи
      await this.getConnectionById(connectionId);
      
      return await this.dbService.updateConnection(connectionId, data);
    } catch (error) {
      logger.error(`Failed to update connection: ${error}`);
      throw new Error(`Failed to update connection: ${error}`);
    }
  }

  /**
   * Удаляет связь
   */
  async deleteConnection(connectionId: string): Promise<void> {
    try {
      logger.info(`Deleting connection ${connectionId}`);
      
      // Проверка существования связи
      await this.getConnectionById(connectionId);
      
      await this.dbService.deleteConnection(connectionId);
    } catch (error) {
      logger.error(`Failed to delete connection: ${error}`);
      throw new Error(`Failed to delete connection: ${error}`);
    }
  }

  /**
   * Получает связь по ID
   */
  async getConnectionById(connectionId: string): Promise<Connection> {
    try {
      const connection = await this.dbService.getConnectionById(connectionId);
      
      if (!connection) {
        throw new Error(`Connection with ID ${connectionId} not found`);
      }
      
      return connection;
    } catch (error) {
      logger.error(`Failed to get connection: ${error}`);
      throw new Error(`Failed to get connection: ${error}`);
    }
  }

  /**
   * Получает полную связь с атрибутами
   */
  async getFullConnection(connectionId: string): Promise<Connection & { attributes: ConnectionAttribute[] }> {
    try {
      // Получение базовой связи
      const connection = await this.getConnectionById(connectionId);
      
      // Получение атрибутов связи
      const attributes = await this.dbService.getConnectionAttributes(connectionId);
      
      return {
        ...connection,
        attributes
      };
    } catch (error) {
      logger.error(`Failed to get full connection: ${error}`);
      throw new Error(`Failed to get full connection: ${error}`);
    }
  }

  /**
   * Получает список связей концепции
   */
  async listConceptConnections(conceptId: string): Promise<Connection[]> {
    try {
      // Проверка существования концепции
      await this.conceptService.getConcept(conceptId);
      
      return await this.dbService.getConceptConnections(conceptId);
    } catch (error) {
      logger.error(`Failed to list concept connections: ${error}`);
      throw new Error(`Failed to list concept connections: ${error}`);
    }
  }

  /**
   * Получает список связей концепции с их атрибутами
   */
  async listConceptConnectionsWithAttributes(conceptId: string): Promise<(Connection & { attributes: ConnectionAttribute[] })[]> {
    try {
      // Получение связей концепции
      const connections = await this.listConceptConnections(conceptId);
      
      // Для каждой связи получаем атрибуты
      const fullConnections = await Promise.all(
        connections.map(async (connection) => {
          const attributes = await this.dbService.getConnectionAttributes(connection.connection_id);
          return {
            ...connection,
            attributes
          };
        })
      );
      
      return fullConnections;
    } catch (error) {
      logger.error(`Failed to list connections with attributes: ${error}`);
      throw new Error(`Failed to list connections with attributes: ${error}`);
    }
  }

  /**
   * Обогащает связь дополнительной информацией с помощью Claude
   */
  async enrichConnection(userId: string, connectionId: string): Promise<EnrichmentResult> {
    try {
      logger.info(`Enriching connection ${connectionId}`);
      
      // Получение связи с информацией о категориях
      const connection = await this.getConnectionById(connectionId);
      
      // Проверка, что у связи есть информация о категориях
      if (!connection.source_category || !connection.target_category) {
        throw new Error('Connection does not have category information');
      }
      
      // Получение концепции
      const concept = await this.conceptService.getConcept(connection.concept_id);
      
      // Обогащение через Claude API
      const enrichmentResult = await this.claudeService.enrichConnection(userId, connection, concept);
      
      // Обновление описания связи в базе данных, если оно получено
      if (enrichmentResult.extended_description) {
        await this.dbService.updateConnection(connectionId, {
          description: enrichmentResult.extended_description
        });
      }
      
      return enrichmentResult;
    } catch (error) {
      logger.error(`Failed to enrich connection: ${error}`);
      throw new Error(`Failed to enrich connection: ${error}`);
    }
  }

  /**
   * Добавляет атрибут связи
   */
  async addConnectionAttribute(connectionId: string, data: AttributeCreateDTO): Promise<ConnectionAttribute> {
    try {
      logger.info(`Adding ${data.attribute_type} attribute to connection ${connectionId}`);
      
      // Проверка существования связи
      await this.getConnectionById(connectionId);
      
      // Проверка допустимого типа атрибута
      this.validateAttributeType(data.attribute_type);
      
      // Проверка допустимого значения атрибута
      this.validateAttributeValue(data.value);
      
      const attribute: Omit<ConnectionAttribute, 'attribute_id' | 'created_at' | 'last_modified'> = {
        connection_id: connectionId,
        attribute_type: data.attribute_type as any, // Приведение типа
        value: data.value,
        justification: data.justification,
        methodology: data.methodology
      };
      
      return await this.dbService.createConnectionAttribute(attribute);
    } catch (error) {
      logger.error(`Failed to add connection attribute: ${error}`);
      throw new Error(`Failed to add connection attribute: ${error}`);
    }
  }

  /**
   * Обновляет атрибут связи
   */
  async updateConnectionAttribute(attributeId: string, data: AttributeUpdateDTO): Promise<ConnectionAttribute> {
    try {
      logger.info(`Updating connection attribute ${attributeId}`);
      
      // Получение атрибута для проверки существования
      const attribute = await this.getConnectionAttributeById(attributeId);
      
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
      return await this.updateConnectionAttribute(attributeId, updates);
    } catch (error) {
      logger.error(`Failed to update connection attribute: ${error}`);
      throw new Error(`Failed to update connection attribute: ${error}`);
    }
  }

  /**
   * Удаляет атрибут связи
   */
  async deleteConnectionAttribute(attributeId: string): Promise<void> {
    try {
      logger.info(`Deleting connection attribute ${attributeId}`);
      
      // Проверка существования атрибута
      await this.getConnectionAttributeById(attributeId);
      
      await this.dbService.deleteConnectionAttribute(attributeId);
    } catch (error) {
      logger.error(`Failed to delete connection attribute: ${error}`);
      throw new Error(`Failed to delete connection attribute: ${error}`);
    }
  }

  /**
   * Получает атрибут связи по ID
   */
  async getConnectionAttributeById(attributeId: string): Promise<ConnectionAttribute> {
    try {
      const client = await this.dbService.getClient();
      
      try {
        const result = await client.query(
          'SELECT * FROM connection_attributes WHERE attribute_id = $1',
          [attributeId]
        );
        
        if (result.rows.length === 0) {
          throw new Error(`Connection attribute with ID ${attributeId} not found`);
        }
        
        return result.rows[0];
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error(`Failed to get connection attribute: ${error}`);
      throw new Error(`Failed to get connection attribute: ${error}`);
    }
  }

  /**
   * Получает атрибуты связи
   */
  async getConnectionAttributes(connectionId: string): Promise<ConnectionAttribute[]> {
    try {
      // Проверка существования связи
      await this.getConnectionById(connectionId);
      
      return await this.dbService.getConnectionAttributes(connectionId);
    } catch (error) {
      logger.error(`Failed to get connection attributes: ${error}`);
      throw new Error(`Failed to get connection attributes: ${error}`);
    }
  }

  /**
   * Проверяет допустимость типа атрибута связи
   */
  private validateAttributeType(type: string): void {
    const validTypes = ['strength', 'obviousness'];
    if (!validTypes.includes(type)) {
      throw new Error(`Invalid connection attribute type: ${type}. Valid types are: ${validTypes.join(', ')}`);
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
   * Обновляет атрибут связи
   */
  private async updateConnectionAttribute(attributeId: string, updates: Partial<ConnectionAttribute>): Promise<ConnectionAttribute> {
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
        `UPDATE connection_attributes 
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
