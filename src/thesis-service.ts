// src/services/thesis.service.ts

import { DatabaseService } from './database.service';
import { ClaudeService } from './claude.service';
import { ConceptService } from './concept.service';
import { logger } from '../utils/logger';
import {
  Thesis,
  ThesisVersion,
  ThesisGenerationParams,
  ThesisVersionCreateDTO,
  ComparisonResult
} from '../types';

/**
 * Сервис для управления тезисами философских концепций
 */
export class ThesisService {
  private dbService: DatabaseService;
  private claudeService: ClaudeService;
  private conceptService: ConceptService;

  constructor() {
    this.dbService = new DatabaseService();
    this.claudeService = new ClaudeService();
    this.conceptService = new ConceptService();
    logger.info('ThesisService initialized');
  }

  /**
   * Генерирует тезисы для концепции
   */
  async generateTheses(userId: string, conceptId: string, parameters: ThesisGenerationParams): Promise<Thesis[]> {
    try {
      logger.info(`Generating theses for concept ${conceptId}`);
      
      // Получение полного графа концепции
      const conceptGraph = await this.conceptService.getConceptGraph(conceptId);
      
      // Генерация тезисов через Claude API
      const generatedTheses = await this.claudeService.generateTheses(userId, conceptGraph, parameters);
      
      // Сохранение тезисов в базе данных
      const savedTheses: Thesis[] = [];
      
      for (const thesis of generatedTheses) {
        const savedThesis = await this.dbService.createThesis({
          concept_id: conceptId,
          text: thesis.text,
          type: parameters.type,
          derived_from: thesis.derived_from,
          generation_parameters: parameters,
          used_weights: parameters.useWeights,
          style: parameters.style
        });
        
        savedTheses.push(savedThesis);
      }
      
      return savedTheses;
    } catch (error) {
      logger.error(`Failed to generate theses: ${error}`);
      throw new Error(`Failed to generate theses: ${error}`);
    }
  }

  /**
   * Генерирует тезисы с учетом весов
   */
  async generateThesesWithWeights(userId: string, conceptId: string, parameters: Omit<ThesisGenerationParams, 'useWeights'>): Promise<Thesis[]> {
    return this.generateTheses(userId, conceptId, { ...parameters, useWeights: true });
  }

  /**
   * Генерирует тезисы без учета весов
   */
  async generateThesesWithoutWeights(userId: string, conceptId: string, parameters: Omit<ThesisGenerationParams, 'useWeights'>): Promise<Thesis[]> {
    return this.generateTheses(userId, conceptId, { ...parameters, useWeights: false });
  }

  /**
   * Получает тезис по ID
   */
  async getThesis(thesisId: string): Promise<Thesis> {
    try {
      const thesis = await this.dbService.getThesisById(thesisId);
      
      if (!thesis) {
        throw new Error(`Thesis with ID ${thesisId} not found`);
      }
      
      return thesis;
    } catch (error) {
      logger.error(`Failed to get thesis: ${error}`);
      throw new Error(`Failed to get thesis: ${error}`);
    }
  }

  /**
   * Получает тезис с его версиями
   */
  async getThesisWithVersions(thesisId: string): Promise<Thesis & { versions: ThesisVersion[] }> {
    try {
      // Получение тезиса
      const thesis = await this.getThesis(thesisId);
      
      // Получение версий тезиса
      const versions = await this.dbService.getThesisVersions(thesisId);
      
      return {
        ...thesis,
        versions
      };
    } catch (error) {
      logger.error(`Failed to get thesis with versions: ${error}`);
      throw new Error(`Failed to get thesis with versions: ${error}`);
    }
  }

  /**
   * Получает тезисы концепции
   */
  async getConceptTheses(conceptId: string): Promise<Thesis[]> {
    try {
      // Проверка существования концепции
      await this.conceptService.getConcept(conceptId);
      
      return await this.dbService.getConceptTheses(conceptId);
    } catch (error) {
      logger.error(`Failed to get concept theses: ${error}`);
      throw new Error(`Failed to get concept theses: ${error}`);
    }
  }

  /**
   * Удаляет тезис
   */
  async deleteThesis(thesisId: string): Promise<void> {
    try {
      logger.info(`Deleting thesis ${thesisId}`);
      
      // Получение тезиса для проверки существования
      await this.getThesis(thesisId);
      
      // Удаление тезиса (каскадное удаление версий настроено в схеме БД)
      const client = await this.dbService.getClient();
      
      try {
        await client.query('BEGIN');
        
        // Удаление тезиса
        await client.query(
          'DELETE FROM theses WHERE thesis_id = $1',
          [thesisId]
        );
        
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error(`Failed to delete thesis: ${error}`);
      throw new Error(`Failed to delete thesis: ${error}`);
    }
  }

  /**
   * Развивает и обосновывает тезис
   */
  async developThesis(userId: string, thesisId: string): Promise<ThesisVersion> {
    try {
      logger.info(`Developing thesis ${thesisId}`);
      
      // Получение тезиса
      const thesis = await this.getThesis(thesisId);
      
      // Получение концепции
      const concept = await this.conceptService.getConcept(thesis.concept_id);
      
      // Развитие тезиса через Claude API
      const development = await this.claudeService.developThesis(userId, thesis, concept);
      
      // Сохранение версии тезиса
      const versionData: Omit<ThesisVersion, 'version_id' | 'created_at'> = {
        thesis_id: thesisId,
        text: thesis.text, // Текст остается тем же
        justification: development.justification,
        counterarguments: development.counterarguments,
        historical_analogs: development.historical_analogs,
        practical_implications: development.practical_implications
      };
      
      return await this.dbService.createThesisVersion(versionData);
    } catch (error) {
      logger.error(`Failed to develop thesis: ${error}`);
      throw new Error(`Failed to develop thesis: ${error}`);
    }
  }

  /**
   * Создает вручную заданную версию тезиса
   */
  async createThesisVersion(thesisId: string, data: ThesisVersionCreateDTO): Promise<ThesisVersion> {
    try {
      logger.info(`Creating thesis version for thesis ${thesisId}`);
      
      // Проверка существования тезиса
      await this.getThesis(thesisId);
      
      // Создание версии тезиса
      const versionData: Omit<ThesisVersion, 'version_id' | 'created_at'> = {
        thesis_id: thesisId,
        text: data.text,
        justification: data.justification,
        counterarguments: data.counterarguments,
        historical_analogs: data.historical_analogs,
        practical_implications: data.practical_implications
      };
      
      return await this.dbService.createThesisVersion(versionData);
    } catch (error) {
      logger.error(`Failed to create thesis version: ${error}`);
      throw new Error(`Failed to create thesis version: ${error}`);
    }
  }

  /**
   * Получает версии тезиса
   */
  async getThesisVersions(thesisId: string): Promise<ThesisVersion[]> {
    try {
      // Проверка существования тезиса
      await this.getThesis(thesisId);
      
      return await this.dbService.getThesisVersions(thesisId);
    } catch (error) {
      logger.error(`Failed to get thesis versions: ${error}`);
      throw new Error(`Failed to get thesis versions: ${error}`);
    }
  }

  /**
   * Сравнивает два набора тезисов (с учетом и без учета весов)
   */
  async compareThesisSets(userId: string, conceptId: string, withWeightsIds: string[], withoutWeightsIds: string[]): Promise<ComparisonResult> {
    try {
      logger.info(`Comparing thesis sets for concept ${conceptId}`);
      
      // Получение тезисов с учетом весов
      const withWeightsTheses = await Promise.all(
        withWeightsIds.map(id => this.getThesis(id))
      );
      
      // Получение тезисов без учета весов
      const withoutWeightsTheses = await Promise.all(
        withoutWeightsIds.map(id => this.getThesis(id))
      );
      
      // Подготовка данных для запроса к Claude
      const withWeightsText = withWeightsTheses.map(t => t.text).join('\n\n');
      const withoutWeightsText = withoutWeightsTheses.map(t => t.text).join('\n\n');
      
      // Запрос к Claude для анализа различий
      const prompt = `
      Сравни два набора тезисов, сгенерированных на основе одного графа философской концепции:
      
      ТЕЗИСЫ С УЧЕТОМ КОЛИЧЕСТВЕННЫХ ХАРАКТЕРИСТИК:
      ${withWeightsText}
      
      ТЕЗИСЫ БЕЗ УЧЕТА КОЛИЧЕСТВЕННЫХ ХАРАКТЕРИСТИК:
      ${withoutWeightsText}
      
      Выяви ключевые различия, их причины и оцени, какой набор лучше отражает суть концепции и почему.
      
      Структурируй ответ следующим образом:
      1. Общий анализ различий
      2. Конкретные примеры различий с пояснениями
      3. Влияние количественных характеристик на результат
      4. Оценка, какой набор тезисов более эффективен и почему
      `;
      
      const response = await this.claudeService.sendRequest(
        userId,
        conceptId,
        'thesis_comparison',
        prompt
      );
      
      // Простая структура результата сравнения
      const comparisonResult: ComparisonResult = {
        general_analysis: '',
        specific_examples: [],
        weights_impact: '',
        evaluation: {
          better_set: '',
          explanation: ''
        },
        raw_comparison: response.response
      };
      
      // Парсинг ответа Claude для извлечения структурированных данных
      const sections = response.response.split(/\d+\.\s+/);
      
      if (sections.length >= 5) {
        comparisonResult.general_analysis = sections[1].trim();
        
        // Извлечение конкретных примеров
        const examplesSection = sections[2].trim();
        const examples = examplesSection.split(/\n-\s+|\n•\s+/).slice(1);
        comparisonResult.specific_examples = examples.map(ex => ex.trim());
        
        // Влияние весов
        comparisonResult.weights_impact = sections[3].trim();
        
        // Оценка
        const evaluationSection = sections[4].trim();
        if (evaluationSection.toLowerCase().includes('с учетом количественных характеристик')) {
          comparisonResult.evaluation.better_set = 'with_weights';
        } else if (evaluationSection.toLowerCase().includes('без учета количественных характеристик')) {
          comparisonResult.evaluation.better_set = 'without_weights';
        } else {
          comparisonResult.evaluation.better_set = 'inconclusive';
        }
        
        comparisonResult.evaluation.explanation = evaluationSection;
      }
      
      return comparisonResult;
    } catch (error) {
      logger.error(`Failed to compare thesis sets: ${error}`);
      throw new Error(`Failed to compare thesis sets: ${error}`);
    }
  }

  /**
   * Вспомогательный метод для отправки запроса к Claude
   */
  private async sendRequest(userId: string, conceptId: string | null, type: string, prompt: string): Promise<any> {
    try {
      // Реализация в зависимости от структуры claudeService
      return { response: 'Результат запроса к Claude API' };
    } catch (error) {
      logger.error(`Failed to send request to Claude API: ${error}`);
      throw new Error(`Failed to send request to Claude API: ${error}`);
    }
  }
}

// Тип для результата сравнения наборов тезисов
interface ComparisonResult {
  general_analysis: string;
  specific_examples: string[];
  weights_impact: string;
  evaluation: {
    better_set: 'with_weights' | 'without_weights' | 'inconclusive';
    explanation: string;
  };
  raw_comparison: string;
}
