// src/services/synthesis.service.ts

import { DatabaseService } from './database.service';
import { ClaudeService } from './claude.service';
import { ConceptService } from './concept.service';
import { logger } from '../utils/logger';
import {
  Concept,
  ConceptGraph,
  SynthesisParams,
  SynthesisResult,
  SynthesisMeta,
  CompatibilityAnalysis,
  CriticalAnalysis,
  SynthesisMethod
} from '../types';

/**
 * Сервис для синтеза философских концепций
 */
export class SynthesisService {
  private dbService: DatabaseService;
  private claudeService: ClaudeService;
  private conceptService: ConceptService;

  constructor() {
    this.dbService = new DatabaseService();
    this.claudeService = new ClaudeService();
    this.conceptService = new ConceptService();
    logger.info('SynthesisService initialized');
  }

  /**
   * Анализирует совместимость концепций для синтеза
   */
  async analyzeSynthesisCompatibility(userId: string, conceptIds: string[]): Promise<CompatibilityAnalysis> {
    try {
      logger.info(`Analyzing compatibility of concepts: ${conceptIds.join(', ')}`);
      
      if (conceptIds.length < 2) {
        throw new Error('At least two concepts are required for compatibility analysis');
      }
      
      // Получение концепций
      const concepts: Concept[] = [];
      const conceptGraphs: ConceptGraph[] = [];
      
      for (const conceptId of conceptIds) {
        const concept = await this.conceptService.getConcept(conceptId);
        concepts.push(concept);
        
        const graph = await this.conceptService.getConceptGraph(conceptId);
        conceptGraphs.push(graph);
      }
      
      // Анализ совместимости через Claude API
      return await this.claudeService.analyseSynthesisCompatibility(userId, concepts, conceptGraphs);
    } catch (error) {
      logger.error(`Compatibility analysis error: ${error}`);
      throw new Error(`Failed to analyze synthesis compatibility: ${error}`);
    }
  }

  /**
   * Синтезирует новую концепцию на основе существующих
   */
  async synthesizeConcepts(userId: string, parameters: SynthesisParams): Promise<SynthesisResult> {
    try {
      logger.info(`Synthesizing concepts: ${parameters.concept_ids.join(', ')}`);
      
      if (parameters.concept_ids.length < 2) {
        throw new Error('At least two concepts are required for synthesis');
      }
      
      // Получение концепций
      const concepts: Concept[] = [];
      const conceptGraphs: ConceptGraph[] = [];
      
      for (const conceptId of parameters.concept_ids) {
        const concept = await this.conceptService.getConcept(conceptId);
        concepts.push(concept);
        
        const graph = await this.conceptService.getConceptGraph(conceptId);
        conceptGraphs.push(graph);
      }
      
      // Синтез через Claude API
      const synthesisResult = await this.claudeService.synthesizeConcepts(
        userId,
        concepts,
        conceptGraphs,
        parameters.synthesis_method as SynthesisMethod,
        parameters
      );
      
      // Сохранение результата синтеза в базе данных
      
      // 1. Сохранение новой концепции
      const newConcept = await this.dbService.createConcept({
        user_id: userId,
        name: synthesisResult.concept.name,
        description: synthesisResult.concept.description,
        is_synthesis: true,
        parent_concepts: parameters.concept_ids,
        synthesis_method: parameters.synthesis_method,
        focus_area: parameters.focus_area
      });
      
      // 2. Сохранение категорий
      const categoryIdMapping: Record<string, string> = {};
      
      for (const category of synthesisResult.graph.categories) {
        const savedCategory = await this.dbService.createCategory({
          concept_id: newConcept.concept_id,
          name: category.name,
          definition: category.definition,
          extended_description: category.extended_description,
          source: category.source
        });
        
        // Сохранение маппинга ID категорий для создания связей
        categoryIdMapping[category.category_id] = savedCategory.category_id;
      }
      
      // 3. Сохранение связей
      for (const connection of synthesisResult.graph.connections) {
        // Получение ID сохраненных категорий
        const sourceId = categoryIdMapping[connection.source_category_id];
        const targetId = categoryIdMapping[connection.target_category_id];
        
        if (!sourceId || !targetId) {
          logger.warn(`Skipping connection due to missing category mapping: source=${connection.source_category_id}, target=${connection.target_category_id}`);
          continue;
        }
        
        await this.dbService.createConnection({
          concept_id: newConcept.concept_id,
          source_category_id: sourceId,
          target_category_id: targetId,
          connection_type: connection.connection_type,
          direction: connection.direction,
          description: connection.description
        });
      }
      
      // 4. Сохранение метаданных синтеза
      const synthesisMeta = await this.dbService.createSynthesisMeta({
        result_concept_id: newConcept.concept_id,
        source_concept_ids: parameters.concept_ids,
        synthesis_method: parameters.synthesis_method,
        innovation_level: parameters.innovation_level,
        abstraction_level: parameters.abstraction_level,
        historical_context: parameters.historical_context,
        target_application: parameters.target_application,
        compatibility_analysis: synthesisResult.compatibility_analysis
      });
      
      // 5. Получение полного графа новой концепции
      const newGraph = await this.conceptService.getConceptGraph(newConcept.concept_id);
      
      return {
        concept: newConcept,
        graph: newGraph,
        synthesis_meta: synthesisMeta,
        origin_mapping: synthesisResult.origin_mapping
      };
    } catch (error) {
      logger.error(`Synthesis error: ${error}`);
      throw new Error(`Failed to synthesize concepts: ${error}`);
    }
  }

  /**
   * Синтезирует концепции с учетом количественных характеристик
   */
  async synthesizeConceptsWithWeights(userId: string, parameters: Omit<SynthesisParams, 'use_weights'>): Promise<SynthesisResult> {
    return this.synthesizeConcepts(userId, { ...parameters, use_weights: true });
  }

  /**
   * Синтезирует концепции без учета количественных характеристик
   */
  async synthesizeConceptsWithoutWeights(userId: string, parameters: Omit<SynthesisParams, 'use_weights'>): Promise<SynthesisResult> {
    return this.synthesizeConcepts(userId, { ...parameters, use_weights: false });
  }

  /**
   * Критический анализ синтезированной концепции
   */
  async criticallyAnalyzeSynthesis(userId: string, synthesisId: string): Promise<CriticalAnalysis> {
    try {
      logger.info(`Critically analyzing synthesis ${synthesisId}`);
      
      // Получение метаданных синтеза
      const synthesisMeta = await this.getSynthesisMeta(synthesisId);
      
      // Получение результирующей концепции
      const resultConcept = await this.conceptService.getConcept(synthesisMeta.result_concept_id);
      
      // Получение графа результирующей концепции
      const resultGraph = await this.conceptService.getConceptGraph(resultConcept.concept_id);
      
      // Получение исходных концепций
      const sourceGraphs: ConceptGraph[] = [];
      
      for (const sourceId of synthesisMeta.source_concept_ids) {
        const sourceGraph = await this.conceptService.getConceptGraph(sourceId);
        sourceGraphs.push(sourceGraph);
      }
      
      // Критический анализ через Claude API
      return await this.claudeService.criticallyAnalyzeSynthesis(userId, resultGraph, sourceGraphs);
    } catch (error) {
      logger.error(`Critical analysis error: ${error}`);
      throw new Error(`Failed to critically analyze synthesis: ${error}`);
    }
  }

  /**
   * Получает метаданные синтеза по ID
   */
  async getSynthesisMeta(synthesisId: string): Promise<SynthesisMeta> {
    try {
      const client = await this.dbService.getClient();
      
      try {
        const result = await client.query(
          'SELECT * FROM synthesis_meta WHERE synthesis_id = $1',
          [synthesisId]
        );
        
        if (result.rows.length === 0) {
          throw new Error(`Synthesis with ID ${synthesisId} not found`);
        }
        
        return result.rows[0];
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error(`Failed to get synthesis meta: ${error}`);
      throw new Error(`Failed to get synthesis meta: ${error}`);
    }
  }

  /**
   * Получает метаданные синтеза по ID результирующей концепции
   */
  async getSynthesisMetaByResultConcept(conceptId: string): Promise<SynthesisMeta | null> {
    try {
      return await this.dbService.getSynthesisMetaByResultConcept(conceptId);
    } catch (error) {
      logger.error(`Failed to get synthesis meta by result concept: ${error}`);
      throw new Error(`Failed to get synthesis meta by result concept: ${error}`);
    }
  }

  /**
   * Создает диалогическую интерпретацию между концепциями
   */
  async createDialogicalInterpretation(userId: string, conceptId1: string, conceptId2: string, question: string): Promise<any> {
    try {
      logger.info(`Creating dialogical interpretation between concepts ${conceptId1} and ${conceptId2}`);
      
      // Получение концепций
      const concept1 = await this.conceptService.getConcept(conceptId1);
      const concept2 = await this.conceptService.getConcept(conceptId2);
      
      // Диалогическая интерпретация через Claude API
      return await this.claudeService.dialogicalInterpretation(userId, concept1, concept2, question);
    } catch (error) {
      logger.error(`Dialogical interpretation error: ${error}`);
      throw new Error(`Failed to create dialogical interpretation: ${error}`);
    }
  }

  /**
   * Получает все синтезированные концепции пользователя
   */
  async getUserSynthesizedConcepts(userId: string): Promise<Concept[]> {
    try {
      const client = await this.dbService.getClient();
      
      try {
        const result = await client.query(
          'SELECT * FROM concepts WHERE user_id = $1 AND is_synthesis = TRUE ORDER BY creation_date DESC',
          [userId]
        );
        
        return result.rows;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error(`Failed to get user synthesized concepts: ${error}`);
      throw new Error(`Failed to get user synthesized concepts: ${error}`);
    }
  }
}
