// src/services/concept.service.ts

import { DatabaseService } from './database.service';
import { ClaudeService } from './claude.service';
import { logger } from '../utils/logger';
import {
  Concept,
  ConceptCreateDTO,
  ConceptUpdateDTO,
  ConceptGraph,
  ValidationResult,
  HistoricalContext,
  ConceptStats
} from '../types';

/**
 * Сервис для управления философскими концепциями
 */
export class ConceptService {
  private dbService: DatabaseService;
  private claudeService: ClaudeService;

  constructor() {
    this.dbService = new DatabaseService();
    this.claudeService = new ClaudeService();
    logger.info('ConceptService initialized');
  }

  /**
   * Создает новую концепцию
   */
  async createConcept(userId: string, data: ConceptCreateDTO): Promise<Concept> {
    try {
      logger.info(`Creating new concept "${data.name}" for user ${userId}`);
      
      const concept: Omit<Concept, 'concept_id' | 'creation_date' | 'last_modified'> = {
        user_id: userId,
        name: data.name,
        description: data.description,
        historical_context: data.historical_context,
        is_synthesis: false,
        focus_area: data.focus_area
      };
      
      return await this.dbService.createConcept(concept);
    } catch (error) {
      logger.error(`Failed to create concept: ${error}`);
      throw new Error(`Failed to create concept: ${error}`);
    }
  }

  /**
   * Получает концепцию по ID
   */
  async getConcept(conceptId: string): Promise<Concept> {
    try {
      const concept = await this.dbService.getConceptById(conceptId);
      
      if (!concept) {
        throw new Error(`Concept with ID ${conceptId} not found`);
      }
      
      return concept;
    } catch (error) {
      logger.error(`Failed to get concept: ${error}`);
      throw new Error(`Failed to get concept: ${error}`);
    }
  }

  /**
   * Обновляет концепцию
   */
  async updateConcept(conceptId: string, data: ConceptUpdateDTO): Promise<Concept> {
    try {
      logger.info(`Updating concept ${conceptId}`);
      
      // Проверка существования концепции
      await this.getConcept(conceptId);
      
      return await this.dbService.updateConcept(conceptId, data);
    } catch (error) {
      logger.error(`Failed to update concept: ${error}`);
      throw new Error(`Failed to update concept: ${error}`);
    }
  }

  /**
   * Удаляет концепцию
   */
  async deleteConcept(conceptId: string): Promise<void> {
    try {
      logger.info(`Deleting concept ${conceptId}`);
      
      // Проверка существования концепции
      await this.getConcept(conceptId);
      
      await this.dbService.deleteConcept(conceptId);
    } catch (error) {
      logger.error(`Failed to delete concept: ${error}`);
      throw new Error(`Failed to delete concept: ${error}`);
    }
  }

  /**
   * Получает список концепций пользователя
   */
  async listUserConcepts(userId: string): Promise<Concept[]> {
    try {
      return await this.dbService.getUserConcepts(userId);
    } catch (error) {
      logger.error(`Failed to list user concepts: ${error}`);
      throw new Error(`Failed to list user concepts: ${error}`);
    }
  }

  /**
   * Получает полный граф концепции
   */
  async getConceptGraph(conceptId: string): Promise<ConceptGraph> {
    try {
      return await this.dbService.getConceptGraph(conceptId);
    } catch (error) {
      logger.error(`Failed to get concept graph: ${error}`);
      throw new Error(`Failed to get concept graph: ${error}`);
    }
  }

  /**
   * Валидирует граф концепции с помощью Claude
   */
  async validateGraph(userId: string, conceptId: string): Promise<ValidationResult> {
    try {
      logger.info(`Validating graph for concept ${conceptId}`);
      
      // Получение полного графа концепции
      const graph = await this.getConceptGraph(conceptId);
      
      // Валидация через Claude API
      return await this.claudeService.validateGraph(userId, graph);
    } catch (error) {
      logger.error(`Failed to validate graph: ${error}`);
      throw new Error(`Failed to validate graph: ${error}`);
    }
  }

  /**
   * Историческая контекстуализация концепции с помощью Claude
   */
  async historicalContextualize(userId: string, conceptId: string): Promise<HistoricalContext> {
    try {
      logger.info(`Generating historical context for concept ${conceptId}`);
      
      // Получение концепции
      const concept = await this.getConcept(conceptId);
      
      // Получение полного графа концепции
      const graph = await this.getConceptGraph(conceptId);
      
      // Историческая контекстуализация через Claude API
      return await this.claudeService.historicalContextualize(userId, concept, graph);
    } catch (error) {
      logger.error(`Failed to generate historical context: ${error}`);
      throw new Error(`Failed to generate historical context: ${error}`);
    }
  }

  /**
   * Предложение возможных направлений эволюции концепции с помощью Claude
   */
  async suggestConceptEvolution(userId: string, conceptId: string): Promise<any> {
    try {
      logger.info(`Suggesting evolution for concept ${conceptId}`);
      
      // Получение концепции
      const concept = await this.getConcept(conceptId);
      
      // Получение полного графа концепции
      const graph = await this.getConceptGraph(conceptId);
      
      // Эволюция концепции через Claude API
      return await this.claudeService.conceptEvolution(userId, concept, graph);
    } catch (error) {
      logger.error(`Failed to suggest concept evolution: ${error}`);
      throw new Error(`Failed to suggest concept evolution: ${error}`);
    }
  }

  /**
   * Поиск концепций по тексту
   */
  async searchConcepts(query: string, userId?: string): Promise<Concept[]> {
    try {
      return await this.dbService.searchConcepts(query, userId);
    } catch (error) {
      logger.error(`Failed to search concepts: ${error}`);
      throw new Error(`Failed to search concepts: ${error}`);
    }
  }

  /**
   * Получает статистику по концепции
   */
  async getConceptStats(conceptId: string): Promise<ConceptStats> {
    try {
      // Получение концепции
      const concept = await this.getConcept(conceptId);
      
      // Получение количества категорий
      const categories = await this.dbService.getConceptCategories(conceptId);
      const categoriesCount = categories.length;
      
      // Получение количества связей
      const connections = await this.dbService.getConceptConnections(conceptId);
      const connectionsCount = connections.length;
      
      // Получение количества тезисов
      const theses = await this.dbService.getConceptTheses(conceptId);
      const thesesCount = theses.length;
      
      // Получение статистики использования Claude для данной концепции
      const client = await this.dbService.getClient();
      
      const claudeStatsResult = await client.query(
        `SELECT 
           COUNT(*) as interactions_count,
           SUM(tokens_used) as total_tokens,
           MAX(created_at) as last_activity
         FROM claude_interactions
         WHERE concept_id = $1`,
        [conceptId]
      );
      
      client.release();
      
      const claudeStats = claudeStatsResult.rows[0];
      
      return {
        concept_id: conceptId,
        name: concept.name,
        user_id: concept.user_id,
        categories_count: categoriesCount,
        connections_count: connectionsCount,
        theses_count: thesesCount,
        claude_interactions: parseInt(claudeStats.interactions_count) || 0,
        total_tokens: parseInt(claudeStats.total_tokens) || 0,
        last_activity: claudeStats.last_activity || concept.last_modified
      };
    } catch (error) {
      logger.error(`Failed to get concept stats: ${error}`);
      throw new Error(`Failed to get concept stats: ${error}`);
    }
  }
}
