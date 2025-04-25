// src/services/claude.service.ts

import axios from 'axios';
import { createHash } from 'crypto';
import { 
  ClaudeApiRequest, 
  ClaudeApiResponse, 
  ConceptGraph, 
  ValidationResult,
  Category,
  Concept,
  Connection,
  EnrichmentResult,
  ThesisGenerationParams,
  Thesis,
  CompatibilityAnalysis,
  SynthesisMethod,
  SynthesisParams,
  SynthesisResult,
  CriticalAnalysis,
  PromptTemplate
} from '../types';
import { redisClient } from '../config/redis';
import { logger } from '../utils/logger';
import { DatabaseService } from './database.service';
import { PromptTemplateService } from './prompt-template.service';

export class ClaudeService {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly model: string;
  private readonly dbService: DatabaseService;
  private readonly promptService: PromptTemplateService;

  constructor() {
    this.apiKey = process.env.CLAUDE_API_KEY || '';
    this.apiUrl = process.env.CLAUDE_API_URL || 'https://api.anthropic.com/v1/messages';
    this.model = process.env.CLAUDE_MODEL || 'claude-3-opus-20240229';
    
    if (!this.apiKey) {
      throw new Error('CLAUDE_API_KEY is not defined in environment variables');
    }
    
    this.dbService = new DatabaseService();
    this.promptService = new PromptTemplateService();
    
    logger.info('ClaudeService initialized');
  }

  /**
   * Проверяет кэш на наличие ответа для данного запроса
   */
  private async checkCache(promptHash: string): Promise<any | null> {
    try {
      const cachedResponse = await redisClient.get(`claude:${promptHash}`);
      if (cachedResponse) {
        logger.debug(`Cache hit for prompt hash: ${promptHash}`);
        return JSON.parse(cachedResponse);
      }
      return null;
    } catch (error) {
      logger.error(`Cache check error: ${error}`);
      return null;
    }
  }

  /**
   * Сохраняет ответ в кэш
   */
  private async cacheResponse(promptHash: string, response: any, ttlSeconds: number = 3600): Promise<void> {
    try {
      await redisClient.set(`claude:${promptHash}`, JSON.stringify(response), 'EX', ttlSeconds);
      logger.debug(`Cached response for prompt hash: ${promptHash}`);
    } catch (error) {
      logger.error(`Cache save error: ${error}`);
    }
  }

  /**
   * Генерирует хэш запроса для кэширования
   */
  private generatePromptHash(prompt: string): string {
    return createHash('sha256').update(prompt).digest('hex');
  }

  /**
   * Логирует взаимодействие с Claude API
   */
  private async logInteraction(
    userId: string, 
    conceptId: string | null, 
    interactionType: string, 
    prompt: string, 
    response: string, 
    tokensUsed: number, 
    durationMs: number
  ): Promise<void> {
    try {
      await this.dbService.logClaudeInteraction({
        user_id: userId,
        concept_id: conceptId,
        interaction_type: interactionType,
        prompt,
        response,
        tokens_used: tokensUsed,
        duration_ms: durationMs
      });
      logger.info(`Logged ${interactionType} interaction for user ${userId}`);
    } catch (error) {
      logger.error(`Failed to log interaction: ${error}`);
    }
  }

  /**
   * Отправляет запрос к Claude API
   */
  private async sendRequest(
    userId: string,
    conceptId: string | null,
    interactionType: string,
    prompt: string,
    maxTokens: number = 4000,
    temperature: number = 0.7,
    useCaching: boolean = true,
    systemPrompt?: string
  ): Promise<{ response: string; tokensUsed: number }> {
    const promptHash = this.generatePromptHash(prompt);
    
    // Проверка кэша, если включено кэширование
    if (useCaching) {
      const cachedResponse = await this.checkCache(promptHash);
      if (cachedResponse) {
        return cachedResponse;
      }
    }
    
    const startTime = Date.now();
    
    try {
      const request: ClaudeApiRequest = {
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: temperature
      };
      
      if (systemPrompt) {
        request.system = systemPrompt;
      }
      
      const response = await axios.post<ClaudeApiResponse>(
        this.apiUrl,
        request,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          }
        }
      );
      
      const result = {
        response: response.data.message.content,
        tokensUsed: response.data.usage.input_tokens + response.data.usage.output_tokens
      };
      
      const durationMs = Date.now() - startTime;
      
      // Кэширование результата
      if (useCaching) {
        await this.cacheResponse(promptHash, result);
      }
      
      // Логирование взаимодействия
      await this.logInteraction(
        userId,
        conceptId,
        interactionType,
        prompt,
        result.response,
        result.tokensUsed,
        durationMs
      );
      
      return result;
    } catch (error) {
      logger.error(`Claude API error: ${error}`);
      throw new Error(`Failed to get response from Claude API: ${error}`);
    }
  }

  /**
   * Подготавливает промпт из шаблона и данных
   */
  private async preparePrompt(templateName: string, data: Record<string, any>): Promise<string> {
    try {
      const template = await this.promptService.getTemplate(templateName);
      if (!template) {
        throw new Error(`Template not found: ${templateName}`);
      }
      
      let prompt = template.template;
      
      // Замена параметров в шаблоне
      for (const param of template.parameters) {
        const regex = new RegExp(`\\{\\{${param}\\}\\}`, 'g');
        
        if (data[param] === undefined) {
          logger.warn(`Parameter ${param} is missing in data for template ${templateName}`);
          prompt = prompt.replace(regex, '');
        } else {
          let value = data[param];
          if (typeof value === 'object') {
            value = JSON.stringify(value, null, 2);
          }
          prompt = prompt.replace(regex, value);
        }
      }
      
      return prompt;
    } catch (error) {
      logger.error(`Error preparing prompt: ${error}`);
      throw new Error(`Failed to prepare prompt: ${error}`);
    }
  }

  /**
   * Обрабатывает ответ Claude, пытаясь извлечь структурированные данные
   */
  private async processResponse(response: string, expectedStructure: any): Promise<any> {
    try {
      // Попытка извлечь JSON из ответа, если он там есть
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          return JSON.parse(jsonMatch[1]);
        } catch (e) {
          logger.warn(`Failed to parse JSON in response: ${e}`);
        }
      }
      
      // Если JSON не найден, пытаемся разобрать ответ по структуре
      // В зависимости от типа ожидаемой структуры применяем разные алгоритмы извлечения данных
      
      // Для простоты этот метод можно расширить для более сложной обработки,
      // здесь представлен базовый вариант возврата текстового ответа
      return { text: response };
    } catch (error) {
      logger.error(`Error processing response: ${error}`);
      return { text: response };
    }
  }

  /**
   * Валидирует созданный граф концепции
   */
  async validateGraph(userId: string, conceptGraph: ConceptGraph): Promise<ValidationResult> {
    try {
      const prompt = await this.preparePrompt('graph_validation', {
        concept_name: conceptGraph.concept_name,
        concept_description: conceptGraph.concept_description,
        categories: conceptGraph.categories,
        connections: conceptGraph.connections
      });
      
      const { response, tokensUsed } = await this.sendRequest(
        userId,
        conceptGraph.concept_id,
        'graph_validation',
        prompt
      );
      
      // Здесь можно добавить более сложную логику извлечения структурированных данных
      // из текстового ответа Claude
      
      // Пример простой обработки
      const validationResult: ValidationResult = {
        general_analysis: '',
        contradictions: [],
        missing_elements: [],
        improvement_suggestions: []
      };
      
      // Парсинг ответа
      const sections = response.split(/\d+\.\s+/);
      
      if (sections.length >= 4) {
        validationResult.general_analysis = sections[1].trim();
        
        // Парсинг противоречий
        const contradictionsText = sections[2].trim();
        const contradictions = contradictionsText
          .split(/\n-\s+/)
          .slice(1)
          .map(text => ({
            issue_type: 'contradiction',
            description: text.trim(),
            severity: this.determineSeverity(text)
          }));
        validationResult.contradictions = contradictions;
        
        // Парсинг пропущенных элементов
        const missingText = sections[3].trim();
        const missing = missingText
          .split(/\n-\s+/)
          .slice(1)
          .map(text => ({
            issue_type: 'missing_element',
            description: text.trim(),
            severity: this.determineSeverity(text)
          }));
        validationResult.missing_elements = missing;
        
        // Парсинг предложений по улучшению
        const suggestionsText = sections[4].trim();
        const suggestions = suggestionsText
          .split(/\n-\s+/)
          .slice(1)
          .map(text => ({
            suggestion_type: this.determineSuggestionType(text),
            description: text.trim()
          }));
        validationResult.improvement_suggestions = suggestions;
      } else {
        validationResult.general_analysis = response;
      }
      
      return validationResult;
    } catch (error) {
      logger.error(`Graph validation error: ${error}`);
      throw new Error(`Failed to validate graph: ${error}`);
    }
  }

  /**
   * Определяет тип предложения по улучшению на основе текста
   */
  private determineSuggestionType(text: string): 'add_category' | 'add_connection' | 'modify_category' | 'modify_connection' {
    if (text.toLowerCase().includes('добавить категорию') || text.toLowerCase().includes('add category')) {
      return 'add_category';
    } else if (text.toLowerCase().includes('добавить связь') || text.toLowerCase().includes('add connection')) {
      return 'add_connection';
    } else if (text.toLowerCase().includes('изменить категорию') || text.toLowerCase().includes('modify category')) {
      return 'modify_category';
    } else {
      return 'modify_connection';
    }
  }

  /**
   * Определяет серьезность проблемы на основе текста
   */
  private determineSeverity(text: string): 'low' | 'medium' | 'high' {
    const lowKeywords = ['minor', 'slight', 'незначительный', 'небольшой'];
    const highKeywords = ['critical', 'severe', 'major', 'критический', 'серьезный'];
    
    const textLower = text.toLowerCase();
    
    if (highKeywords.some(word => textLower.includes(word))) {
      return 'high';
    } else if (lowKeywords.some(word => textLower.includes(word))) {
      return 'low';
    } else {
      return 'medium';
    }
  }

  /**
   * Обогащает категорию дополнительной информацией
   */
  async enrichCategory(userId: string, category: Category, concept: Concept): Promise<EnrichmentResult> {
    try {
      const prompt = await this.preparePrompt('category_enrichment', {
        category_name: category.name,
        category_definition: category.definition,
        concept_name: concept.name,
        concept_description: concept.description
      });
      
      const { response, tokensUsed } = await this.sendRequest(
        userId,
        concept.concept_id,
        'category_enrichment',
        prompt
      );
      
      // Парсинг ответа для извлечения структурированных данных
      const enrichmentResult: EnrichmentResult = {
        extended_description: '',
        alternative_interpretations: [],
        historical_analogs: [],
        related_concepts: []
      };
      
      // Попытка извлечь разделы ответа
      const extendedDescMatch = response.match(/## Расширенное описание\s+([\s\S]*?)(?=##|$)/i);
      if (extendedDescMatch) {
        enrichmentResult.extended_description = extendedDescMatch[1].trim();
      } else {
        enrichmentResult.extended_description = response;
      }
      
      const altInterpMatch = response.match(/## Альтернативные трактовки\s+([\s\S]*?)(?=##|$)/i);
      if (altInterpMatch) {
        enrichmentResult.alternative_interpretations = altInterpMatch[1]
          .split(/\n-\s+/)
          .slice(1)
          .map(text => text.trim())
          .filter(text => text.length > 0);
      }
      
      const histAnalogsMatch = response.match(/## Исторические аналоги\s+([\s\S]*?)(?=##|$)/i);
      if (histAnalogsMatch) {
        enrichmentResult.historical_analogs = histAnalogsMatch[1]
          .split(/\n-\s+/)
          .slice(1)
          .map(text => text.trim())
          .filter(text => text.length > 0);
      }
      
      const relConceptsMatch = response.match(/## Связанные концепты\s+([\s\S]*?)(?=##|$)/i);
      if (relConceptsMatch) {
        enrichmentResult.related_concepts = relConceptsMatch[1]
          .split(/\n-\s+/)
          .slice(1)
          .map(text => text.trim())
          .filter(text => text.length > 0);
      }
      
      return enrichmentResult;
    } catch (error) {
      logger.error(`Category enrichment error: ${error}`);
      throw new Error(`Failed to enrich category: ${error}`);
    }
  }

  /**
   * Обогащает связь дополнительной информацией
   */
  async enrichConnection(userId: string, connection: Connection, concept: Concept): Promise<EnrichmentResult> {
    try {
      const prompt = await this.preparePrompt('connection_enrichment', {
        connection_type: connection.connection_type,
        source_category: connection.source_category?.name || '',
        target_category: connection.target_category?.name || '',
        connection_description: connection.description || '',
        concept_name: concept.name,
        concept_description: concept.description || ''
      });
      
      const { response, tokensUsed } = await this.sendRequest(
        userId,
        concept.concept_id,
        'connection_enrichment',
        prompt
      );
      
      // Парсинг ответа
      const enrichmentResult: EnrichmentResult = {
        extended_description: '',
        alternative_interpretations: [],
        historical_analogs: [],
        related_concepts: []
      };
      
      // Извлечение разделов
      const philosophicalBasisMatch = response.match(/## Философское обоснование\s+([\s\S]*?)(?=##|$)/i);
      if (philosophicalBasisMatch) {
        enrichmentResult.extended_description = philosophicalBasisMatch[1].trim();
      } else {
        enrichmentResult.extended_description = response;
      }
      
      const counterargsMatch = response.match(/## Возможные контраргументы\s+([\s\S]*?)(?=##|$)/i);
      if (counterargsMatch) {
        enrichmentResult.alternative_interpretations = counterargsMatch[1]
          .split(/\n-\s+/)
          .slice(1)
          .map(text => text.trim())
          .filter(text => text.length > 0);
      }
      
      const analogsMatch = response.match(/## Аналогичные связи\s+([\s\S]*?)(?=##|$)/i);
      if (analogsMatch) {
        enrichmentResult.historical_analogs = analogsMatch[1]
          .split(/\n-\s+/)
          .slice(1)
          .map(text => text.trim())
          .filter(text => text.length > 0);
      }
      
      return enrichmentResult;
    } catch (error) {
      logger.error(`Connection enrichment error: ${error}`);
      throw new Error(`Failed to enrich connection: ${error}`);
    }
  }

  /**
   * Генерирует тезисы на основе концепции
   */
  async generateTheses(userId: string, conceptGraph: ConceptGraph, parameters: ThesisGenerationParams): Promise<Thesis[]> {
    try {
      // Подготовка данных для промпта
      const categoriesData = conceptGraph.categories.map(cat => {
        let catText = `- ${cat.name}: ${cat.definition}`;
        if (parameters.useWeights && cat.attributes && cat.attributes.length > 0) {
          catText += ` [Характеристики: ${cat.attributes.map(attr => 
            `${attr.attribute_type}: ${attr.value}`
          ).join(', ')}]`;
        }
        return catText;
      }).join('\n');
      
      const connectionsData = conceptGraph.connections.map(conn => {
        let connText = `- ${conn.source_category?.name || ''} ${conn.direction === 'directed' ? '->' : '<->'} ${conn.target_category?.name || ''} (${conn.connection_type}): ${conn.description || ''}`;
        if (parameters.useWeights && conn.attributes && conn.attributes.length > 0) {
          connText += ` [Характеристики: ${conn.attributes.map(attr => 
            `${attr.attribute_type}: ${attr.value}`
          ).join(', ')}]`;
        }
        return connText;
      }).join('\n');
      
      const prompt = await this.preparePrompt('thesis_generation', {
        concept_name: conceptGraph.concept_name,
        concept_description: conceptGraph.concept_description,
        categories: categoriesData,
        connections: connectionsData,
        thesis_count: parameters.count,
        thesis_type: parameters.type,
        style: parameters.style || 'academic',
        use_weights: parameters.useWeights,
        focus_categories: parameters.focus_categories ? 
          parameters.focus_categories.map(id => {
            const cat = conceptGraph.categories.find(c => c.category_id === id);
            return cat ? cat.name : '';
          }).join(', ') : ''
      });
      
      const { response, tokensUsed } = await this.sendRequest(
        userId,
        conceptGraph.concept_id,
        'thesis_generation',
        prompt,
        5000, // Увеличиваем лимит токенов для генерации тезисов
        0.7
      );
      
      // Парсинг тезисов из ответа
      const theses: Thesis[] = [];
      
      const thesisRegex = /^\d+\.\s+(.+?)(?:\n\s+-\s+Источник:\s+(.+?))?(?:\n\s+-\s+Обоснование:\s+(.+?))?(?=\n\d+\.|$)/gms;
      let match;
      
      while ((match = thesisRegex.exec(response)) !== null) {
        const thesisText = match[1].trim();
        const sourcesText = match[2] ? match[2].trim() : '';
        const justificationText = match[3] ? match[3].trim() : '';
        
        // Извлечение идентификаторов категорий и связей из текста источников
        // Это упрощенная реализация, в реальности нужен более сложный алгоритм сопоставления
        const categories = sourcesText
          .split(/,\s*/)
          .map(name => {
            const category = conceptGraph.categories.find(c => c.name.toLowerCase() === name.toLowerCase());
            return category ? category.category_id : null;
          })
          .filter(id => id !== null) as string[];
        
        const connections: string[] = []; // Здесь нужна более сложная логика извлечения ID связей
        
        theses.push({
          thesis_id: '', // ID будет назначен при сохранении в БД
          concept_id: conceptGraph.concept_id,
          text: thesisText,
          type: parameters.type,
          derived_from: { categories, connections },
          generation_parameters: parameters,
          used_weights: parameters.useWeights,
          style: parameters.style,
          created_at: new Date(),
          last_modified: new Date()
        });
      }
      
      return theses;
    } catch (error) {
      logger.error(`Thesis generation error: ${error}`);
      throw new Error(`Failed to generate theses: ${error}`);
    }
  }

  /**
   * Развивает и обосновывает тезис
   */
  async developThesis(userId: string, thesis: Thesis, concept: Concept): Promise<any> {
    try {
      const prompt = await this.preparePrompt('thesis_development', {
        thesis_text: thesis.text,
        concept_name: concept.name,
        concept_description: concept.description || ''
      });
      
      const { response, tokensUsed } = await this.sendRequest(
        userId,
        concept.concept_id,
        'thesis_development',
        prompt
      );
      
      // Парсинг ответа для извлечения разделов
      const result = {
        text: thesis.text,
        justification: '',
        counterarguments: '',
        historical_analogs: '',
        practical_implications: ''
      };
      
      const justificationMatch = response.match(/## Философское обоснование\s+([\s\S]*?)(?=##|$)/i);
      if (justificationMatch) {
        result.justification = justificationMatch[1].trim();
      }
      
      const counterargsMatch = response.match(/## Возможные контраргументы\s+([\s\S]*?)(?=##|$)/i);
      if (counterargsMatch) {
        result.counterarguments = counterargsMatch[1].trim();
      }
      
      const analogsMatch = response.match(/## Исторические аналоги\s+([\s\S]*?)(?=##|$)/i);
      if (analogsMatch) {
        result.historical_analogs = analogsMatch[1].trim();
      }
      
      const implicationsMatch = response.match(/## Практические следствия\s+([\s\S]*?)(?=##|$)/i);
      if (implicationsMatch) {
        result.practical_implications = implicationsMatch[1].trim();
      }
      
      return result;
    } catch (error) {
      logger.error(`Thesis development error: ${error}`);
      throw new Error(`Failed to develop thesis: ${error}`);
    }
  }

  /**
   * Анализирует совместимость концепций для синтеза
   */
  async analyseSynthesisCompatibility(userId: string, concepts: Concept[], conceptGraphs: ConceptGraph[]): Promise<CompatibilityAnalysis> {
    try {
      // Подготовка данных для промпта
      const conceptsData = concepts.map((concept, index) => ({
        name: concept.name,
        description: concept.description,
        categories: conceptGraphs[index].categories.map(c => ({
          name: c.name,
          definition: c.definition
        })),
        connections: conceptGraphs[index].connections.map(conn => ({
          source: conn.source_category?.name || '',
          target: conn.target_category?.name || '',
          type: conn.connection_type,
          description: conn.description
        }))
      }));
      
      const prompt = await this.preparePrompt('synthesis_compatibility', {
        concepts: JSON.stringify(conceptsData, null, 2)
      });
      
      const { response, tokensUsed } = await this.sendRequest(
        userId,
        null, // Не привязано к конкретной концепции
        'compatibility_analysis',
        prompt,
        6000 // Увеличенный лимит токенов для анализа совместимости
      );
      
      // Базовый анализ ответа
      // В реальной реализации здесь должен быть более сложный алгоритм извлечения структурированных данных
      
      const compatibilityAnalysis: CompatibilityAnalysis = {
        fully_compatible: [],
        potentially_compatible: [],
        incompatible: [],
        synthesis_strategies: []
      };
      
      // Извлечение совместимых элементов
      const compatibleMatch = response.match(/## Полностью совместимые элементы\s+([\s\S]*?)(?=##|$)/i);
      if (compatibleMatch) {
        compatibilityAnalysis.fully_compatible = this.extractCompatibilityElements(compatibleMatch[1], 'fully');
      }
      
      // Извлечение потенциально совместимых элементов
      const potentialMatch = response.match(/## Потенциально совместимые элементы\s+([\s\S]*?)(?=##|$)/i);
      if (potentialMatch) {
        compatibilityAnalysis.potentially_compatible = this.extractCompatibilityElements(potentialMatch[1], 'potentially');
      }
      
      // Извлечение несовместимых элементов
      const incompatibleMatch = response.match(/## Принципиально несовместимые элементы\s+([\s\S]*?)(?=##|$)/i);
      if (incompatibleMatch) {
        compatibilityAnalysis.incompatible = this.extractCompatibilityElements(incompatibleMatch[1], 'incompatible');
      }
      
      // Извлечение стратегий синтеза
      const strategiesMatch = response.match(/## Возможные стратегии синтеза\s+([\s\S]*?)(?=##|$)/i);
      if (strategiesMatch) {
        const strategiesText = strategiesMatch[1];
        const strategyRegex = /### (.+?)\s+([\s\S]*?)(?=###|$)/g;
        let strategyMatch;
        
        while ((strategyMatch = strategyRegex.exec(strategiesText)) !== null) {
          const strategyName = strategyMatch[1].trim();
          const strategyContent = strategyMatch[2].trim();
          
          const descriptionMatch = strategyContent.match(/Описание:\s+([\s\S]*?)(?=Преимущества:|$)/i);
          const benefitsMatch = strategyContent.match(/Преимущества:\s+([\s\S]*?)(?=Ограничения:|$)/i);
          const limitationsMatch = strategyContent.match(/Ограничения:\s+([\s\S]*?)(?=Рекомендуется:|$)/i);
          const recommendedMatch = strategyContent.match(/Рекомендуется:\s+([\s\S]*)/i);
          
          compatibilityAnalysis.synthesis_strategies.push({
            strategy_name: strategyName,
            description: descriptionMatch ? descriptionMatch[1].trim() : '',
            benefits: benefitsMatch ? 
              benefitsMatch[1]
                .split(/\n-\s+/)
                .slice(1)
                .map(text => text.trim())
                .filter(text => text.length > 0) : [],
            limitations: limitationsMatch ? 
              limitationsMatch[1]
                .split(/\n-\s+/)
                .slice(1)
                .map(text => text.trim())
                .filter(text => text.length > 0) : [],
            recommended: recommendedMatch ? 
              recommendedMatch[1].trim().toLowerCase() === 'да' : false
          });
        }
      }
      
      return compatibilityAnalysis;
    } catch (error) {
      logger.error(`Synthesis compatibility analysis error: ${error}`);
      throw new Error(`Failed to analyze synthesis compatibility: ${error}`);
    }
  }

  /**
   * Извлекает элементы совместимости из текста ответа
   */
  private extractCompatibilityElements(text: string, type: 'fully' | 'potentially' | 'incompatible') {
    const elements = [];
    const elementRegex = /### (.+?)\s+([\s\S]*?)(?=###|$)/g;
    let elementMatch;
    
    while ((elementMatch = elementRegex.exec(text)) !== null) {
      const elementName = elementMatch[1].trim();
      const elementContent = elementMatch[2].trim();
      
      // Определение типа элемента
      let elementType: 'category' | 'connection' = 'category';
      if (elementName.includes('->') || 
          elementContent.includes('связь') || 
          elementContent.includes('отношение')) {
        elementType = 'connection';
      }
      
      elements.push({
        element_type: elementType,
        element_id: '', // ID будет сопоставлен позже
        name: elementName,
        description: elementContent,
        compatibility_explanation: this.extractCompatibilityExplanation(elementContent, type)
      });
    }
    
    return elements;
  }

  /**
   * Извлекает объяснение совместимости из текста
   */
  private extractCompatibilityExplanation(text: string, type: 'fully' | 'potentially' | 'incompatible'): string {
    switch (type) {
      case 'fully':
        return text.includes('Причина совместимости:') ? 
          text.split('Причина совместимости:')[1].trim() : text;
      case 'potentially':
        return text.includes('Условия совместимости:') ? 
          text.split('Условия совместимости:')[1].trim() : text;
      case 'incompatible':
        return text.includes('Причина несовместимости:') ? 
          text.split('Причина несовместимости:')[1].trim() : text;
      default:
        return text;
    }
  }

  /**
   * Синтезирует новую концепцию на основе существующих
   */
  async synthesizeConcepts(
    userId: string, 
    concepts: Concept[], 
    conceptGraphs: ConceptGraph[],
    method: SynthesisMethod, 
    parameters: SynthesisParams
  ): Promise<SynthesisResult> {
    try {
      // Подготовка данных для промпта
      const conceptsData = concepts.map((concept, index) => ({
        id: concept.concept_id,
        name: concept.name,
        description: concept.description,
        priority: parameters.priorities ? (parameters.priorities[concept.concept_id] || 1) : 1,
        graph: {
          categories: conceptGraphs[index].categories.map(c => ({
            id: c.category_id,
            name: c.name,
            definition: c.definition,
            attributes: parameters.use_weights ? c.attributes : []
          })),
          connections: conceptGraphs[index].connections.map(conn => ({
            id: conn.connection_id,
            source: {
              id: conn.source_category_id,
              name: conn.source_category?.name || ''
            },
            target: {
              id: conn.target_category_id,
              name: conn.target_category?.name || ''
            },
            type: conn.connection_type,
            direction: conn.direction,
            description: conn.description,
            attributes: parameters.use_weights ? conn.attributes : []
          }))
        }
      }));
      
      const prompt = await this.preparePrompt('concept_synthesis', {
        concepts: JSON.stringify(conceptsData, null, 2),
        synthesis_method: method,
        innovation_level: parameters.innovation_level || 'moderate',
        abstraction_level: parameters.abstraction_level || 'intermediate',
        historical_context: parameters.historical_context || 'contemporary',
        focus_area: parameters.focus_area || '',
        use_weights: parameters.use_weights
      });
      
      const { response, tokensUsed } = await this.sendRequest(
        userId,
        null, // Не привязано к конкретной концепции
        'concept_synthesis',
        prompt,
        8000, // Увеличенный лимит токенов для синтеза
        0.8 // Немного повышенная температура для креативности
      );
      
      // Обработка ответа
      // В реальной реализации здесь должен быть сложный алгоритм 
      // преобразования текстового ответа в структурированные данные
      
      // Упрощенный вариант обработки
      const newConceptNameMatch = response.match(/# Синтезированная концепция: (.+?)(?=\n|$)/);
      const newConceptDescMatch = response.match(/## Описание\s+([\s\S]*?)(?=##|$)/i);
      
      const newConceptName = newConceptNameMatch ? newConceptNameMatch[1].trim() : `Синтез: ${concepts.map(c => c.name).join(' + ')}`;
      const newConceptDesc = newConceptDescMatch ? newConceptDescMatch[1].trim() : '';
      
      // Извлечение категорий
      const categoriesMatch = response.match(/## Категории\s+([\s\S]*?)(?=##|$)/i);
      const newCategories = [];
      
      if (categoriesMatch) {
        const categoriesText = categoriesMatch[1];
        const categoryRegex = /### (.+?)\s+(.+?)(?:\nПроисхождение: (.+?))?(?=###|$)/gs;
        let categoryMatch;
        
        while ((categoryMatch = categoryRegex.exec(categoriesText)) !== null) {
          const categoryName = categoryMatch[1].trim();
          const categoryDefinition = categoryMatch[2].trim();
          const originInfo = categoryMatch[3] ? categoryMatch[3].trim() : '';
          
          newCategories.push({
            name: categoryName,
            definition: categoryDefinition,
            source: originInfo
          });
        }
      }
      
      // Извлечение связей
      const connectionsMatch = response.match(/## Связи\s+([\s\S]*?)(?=##|$)/i);
      const newConnections = [];
      
      if (connectionsMatch) {
        const connectionsText = connectionsMatch[1];
        const connectionRegex = /- (.+?) (->|<->|<-) (.+?) \((.+?)\)(?:: (.+?))?(?:\nПроисхождение: (.+?))?(?=\n-|\n##|$)/gs;
        let connectionMatch;
        
        while ((connectionMatch = connectionRegex.exec(connectionsText)) !== null) {
          const sourceCategory = connectionMatch[1].trim();
          const direction = connectionMatch[2].trim() === '->' ? 'directed' : 
                           connectionMatch[2].trim() === '<->' ? 'bidirectional' : 'directed';
          const targetCategory = connectionMatch[3].trim();
          const connectionType = connectionMatch[4].trim();
          const description = connectionMatch[5] ? connectionMatch[5].trim() : '';
          const originInfo = connectionMatch[6] ? connectionMatch[6].trim() : '';
          
          newConnections.push({
            source_category: sourceCategory,
            target_category: targetCategory,
            connection_type: connectionType,
            direction,
            description,
            source: originInfo
          });
        }
      }
      
      // Создание результата синтеза
      // Обратите внимание, что это упрощенная реализация,
      // в реальной системе нужно будет создать объекты в базе данных
      // и вернуть полноценную структуру SynthesisResult
      
      const synthesisResult: Partial<SynthesisResult> = {
        concept: {
          concept_id: '', // Будет заполнено при сохранении
          user_id: userId,
          name: newConceptName,
          description: newConceptDesc,
          creation_date: new Date(),
          last_modified: new Date(),
          is_synthesis: true,
          parent_concepts: concepts.map(c => c.concept_id),
          synthesis_method: method,
          focus_area: parameters.focus_area
        },
        synthesis_meta: {
          synthesis_id: '', // Будет заполнено при сохранении
          result_concept_id: '', // Будет заполнено при сохранении
          source_concept_ids: concepts.map(c => c.concept_id),
          synthesis_method: method,
          innovation_level: parameters.innovation_level,
          abstraction_level: parameters.abstraction_level,
          historical_context: parameters.historical_context,
          target_application: parameters.target_application,
          created_at: new Date()
        },
        origin_mapping: {
          category_mapping: {},
          connection_mapping: {}
        }
      };
      
      // Создание частичного графа для вывода
      const partialGraph: Partial<ConceptGraph> = {
        concept_id: '', // Будет заполнено при сохранении
        concept_name: newConceptName,
        concept_description: newConceptDesc,
        categories: newCategories.map((cat, idx) => ({
          category_id: `new_category_${idx}`, // Временный ID
          concept_id: '', // Будет заполнено при сохранении
          name: cat.name,
          definition: cat.definition,
          extended_description: '',
          source: cat.source,
          created_at: new Date(),
          last_modified: new Date(),
          attributes: []
        })),
        connections: newConnections.map((conn, idx) => {
          // Нахождение ID категорий
          const sourceCategory = partialGraph.categories?.find(c => c.name === conn.source_category);
          const targetCategory = partialGraph.categories?.find(c => c.name === conn.target_category);
          
          return {
            connection_id: `new_connection_${idx}`, // Временный ID
            concept_id: '', // Будет заполнено при сохранении
            source_category_id: sourceCategory?.category_id || '',
            target_category_id: targetCategory?.category_id || '',
            connection_type: conn.connection_type as any, // Приведение типа
            direction: conn.direction as any, // Приведение типа
            description: conn.description,
            created_at: new Date(),
            last_modified: new Date(),
            attributes: [],
            source_category: sourceCategory,
            target_category: targetCategory
          };
        })
      };
      
      synthesisResult.graph = partialGraph as ConceptGraph;
      
      return synthesisResult as SynthesisResult;
    } catch (error) {
      logger.error(`Concept synthesis error: ${error}`);
      throw new Error(`Failed to synthesize concepts: ${error}`);
    }
  }

  /**
   * Критический анализ синтезированной концепции
   */
  async criticallyAnalyzeSynthesis(userId: string, synthesis: ConceptGraph, sourceGraphs: ConceptGraph[]): Promise<CriticalAnalysis> {
    try {
      // Подготовка данных для промпта
      const synthesisData = {
        name: synthesis.concept_name,
        description: synthesis.concept_description,
        categories: synthesis.categories.map(c => ({
          name: c.name,
          definition: c.definition
        })),
        connections: synthesis.connections.map(conn => ({
          source: conn.source_category?.name || '',
          target: conn.target_category?.name || '',
          type: conn.connection_type,
          direction: conn.direction,
          description: conn.description
        }))
      };
      
      const sourceData = sourceGraphs.map(graph => ({
        name: graph.concept_name,
        description: graph.concept_description,
        categories: graph.categories.map(c => ({
          name: c.name,
          definition: c.definition
        })),
        connections: graph.connections.map(conn => ({
          source: conn.source_category?.name || '',
          target: conn.target_category?.name || '',
          type: conn.connection_type,
          direction: conn.direction,
          description: conn.description
        }))
      }));
      
      const prompt = await this.preparePrompt('critical_analysis', {
        synthesis: JSON.stringify(synthesisData, null, 2),
        source_concepts: JSON.stringify(sourceData, null, 2)
      });
      
      const { response, tokensUsed } = await this.sendRequest(
        userId,
        synthesis.concept_id,
        'critical_analysis',
        prompt
      );
      
      // Обработка ответа
      const criticalAnalysis: CriticalAnalysis = {
        internal_consistency: {
          score: 0,
          analysis: ''
        },
        philosophical_novelty: {
          score: 0,
          analysis: ''
        },
        preservation_of_value: {
          score: 0,
          analysis: ''
        },
        contradiction_resolution: {
          score: 0,
          analysis: ''
        },
        potential_issues: []
      };
      
      // Извлечение внутренней согласованности
      const consistencyMatch = response.match(/## Внутренняя согласованность\s+(\d+(?:\.\d+)?)\s*\/\s*1(?:\n|\r\n)([\s\S]*?)(?=##|$)/i);
      if (consistencyMatch) {
        criticalAnalysis.internal_consistency.score = parseFloat(consistencyMatch[1]);
        criticalAnalysis.internal_consistency.analysis = consistencyMatch[2].trim();
        
        // Извлечение проблем, если они есть
        const issuesMatch = criticalAnalysis.internal_consistency.analysis.match(/Проблемы:([\s\S]*?)(?=\n\n|$)/i);
        if (issuesMatch) {
          criticalAnalysis.internal_consistency.issues = issuesMatch[1]
            .split(/\n-\s+/)
            .slice(1)
            .map(text => text.trim())
            .filter(text => text.length > 0);
        }
      }
      
      // Извлечение философской новизны
      const noveltyMatch = response.match(/## Философская новизна\s+(\d+(?:\.\d+)?)\s*\/\s*1(?:\n|\r\n)([\s\S]*?)(?=##|$)/i);
      if (noveltyMatch) {
        criticalAnalysis.philosophical_novelty.score = parseFloat(noveltyMatch[1]);
        criticalAnalysis.philosophical_novelty.analysis = noveltyMatch[2].trim();
        
        // Извлечение новых элементов
        const novelElementsMatch = criticalAnalysis.philosophical_novelty.analysis.match(/Новые элементы:([\s\S]*?)(?=\n\n|$)/i);
        if (novelElementsMatch) {
          criticalAnalysis.philosophical_novelty.novel_elements = novelElementsMatch[1]
            .split(/\n-\s+/)
            .slice(1)
            .map(text => text.trim())
            .filter(text => text.length > 0);
        }
      }
      
      // Извлечение сохранения ценных аспектов
      const preservationMatch = response.match(/## Сохранение ценных аспектов\s+(\d+(?:\.\d+)?)\s*\/\s*1(?:\n|\r\n)([\s\S]*?)(?=##|$)/i);
      if (preservationMatch) {
        criticalAnalysis.preservation_of_value.score = parseFloat(preservationMatch[1]);
        criticalAnalysis.preservation_of_value.analysis = preservationMatch[2].trim();
        
        // Извлечение сохраненных элементов
        const preservedMatch = criticalAnalysis.preservation_of_value.analysis.match(/Сохраненные элементы:([\s\S]*?)(?=Утраченные элементы:|$)/i);
        if (preservedMatch) {
          criticalAnalysis.preservation_of_value.preserved_elements = preservedMatch[1]
            .split(/\n-\s+/)
            .slice(1)
            .map(text => text.trim())
            .filter(text => text.length > 0);
        }
        
        // Извлечение утраченных элементов
        const lostMatch = criticalAnalysis.preservation_of_value.analysis.match(/Утраченные элементы:([\s\S]*?)(?=\n\n|$)/i);
        if (lostMatch) {
          criticalAnalysis.preservation_of_value.lost_elements = lostMatch[1]
            .split(/\n-\s+/)
            .slice(1)
            .map(text => text.trim())
            .filter(text => text.length > 0);
        }
      }
      
      // Извлечение разрешения противоречий
      const resolutionMatch = response.match(/## Разрешение противоречий\s+(\d+(?:\.\d+)?)\s*\/\s*1(?:\n|\r\n)([\s\S]*?)(?=##|$)/i);
      if (resolutionMatch) {
        criticalAnalysis.contradiction_resolution.score = parseFloat(resolutionMatch[1]);
        criticalAnalysis.contradiction_resolution.analysis = resolutionMatch[2].trim();
        
        // Извлечение разрешенных противоречий
        const resolvedMatch = criticalAnalysis.contradiction_resolution.analysis.match(/Разрешенные противоречия:([\s\S]*?)(?=Оставшиеся противоречия:|$)/i);
        if (resolvedMatch) {
          criticalAnalysis.contradiction_resolution.resolved_contradictions = resolvedMatch[1]
            .split(/\n-\s+/)
            .slice(1)
            .map(text => text.trim())
            .filter(text => text.length > 0);
        }
        
        // Извлечение оставшихся противоречий
        const remainingMatch = criticalAnalysis.contradiction_resolution.analysis.match(/Оставшиеся противоречия:([\s\S]*?)(?=\n\n|$)/i);
        if (remainingMatch) {
          criticalAnalysis.contradiction_resolution.remaining_contradictions = remainingMatch[1]
            .split(/\n-\s+/)
            .slice(1)
            .map(text => text.trim())
            .filter(text => text.length > 0);
        }
      }
      
      // Извлечение потенциальных проблем
      const issuesMatch = response.match(/## Потенциальные проблемы([\s\S]*?)(?=##|$)/i);
      if (issuesMatch) {
        const issuesText = issuesMatch[1];
        const issueRegex = /### (.+?)\s+Серьезность: (.+?)\s+([\s\S]*?)(?=###|$)/g;
        let issueMatch;
        
        while ((issueMatch = issueRegex.exec(issuesText)) !== null) {
          const issueTitle = issueMatch[1].trim();
          const severityText = issueMatch[2].trim().toLowerCase();
          const issueDescription = issueMatch[3].trim();
          
          let severity: 'low' | 'medium' | 'high' = 'medium';
          if (severityText.includes('низк') || severityText.includes('low')) {
            severity = 'low';
          } else if (severityText.includes('высок') || severityText.includes('high')) {
            severity = 'high';
          }
          
          // Извлечение потенциального решения
          const solutionMatch = issueDescription.match(/Потенциальное решение:\s+([\s\S]*?)(?=\n\n|$)/i);
          const potentialSolution = solutionMatch ? solutionMatch[1].trim() : undefined;
          
          // Формирование описания проблемы без "Потенциального решения"
          let issue = issueTitle;
          if (issueDescription.includes('Потенциальное решение:')) {
            issue = issueDescription.split('Потенциальное решение:')[0].trim();
          } else {
            issue = issueDescription;
          }
          
          criticalAnalysis.potential_issues.push({
            severity,
            issue,
            potential_solution: potentialSolution
          });
        }
      }
      
      return criticalAnalysis;
    } catch (error) {
      logger.error(`Critical analysis error: ${error}`);
      throw new Error(`Failed to critically analyze synthesis: ${error}`);
    }
  }

  /**
   * Историческая контекстуализация концепции
   */
  async historicalContextualize(userId: string, concept: Concept, conceptGraph: ConceptGraph): Promise<any> {
    try {
      const prompt = await this.preparePrompt('historical_contextualization', {
        concept_name: concept.name,
        concept_description: concept.description || '',
        categories: conceptGraph.categories.map(c => `${c.name}: ${c.definition}`).join('\n'),
        connections: conceptGraph.connections.map(conn => 
          `${conn.source_category?.name || ''} ${conn.direction === 'directed' ? '->' : '<->'} ${conn.target_category?.name || ''} (${conn.connection_type}): ${conn.description || ''}`
        ).join('\n')
      });
      
      const { response, tokensUsed } = await this.sendRequest(
        userId,
        concept.concept_id,
        'historical_contextualization',
        prompt
      );
      
      // Обработка ответа - аналогично другим методам
      // ...
      
      return { text: response }; // Упрощенный вариант
    } catch (error) {
      logger.error(`Historical contextualization error: ${error}`);
      throw new Error(`Failed to historically contextualize concept: ${error}`);
    }
  }

  /**
   * Предложение практических применений концепции
   */
  async practicalApplication(userId: string, concept: Concept, theses: Thesis[]): Promise<any> {
    try {
      const prompt = await this.preparePrompt('practical_application', {
        concept_name: concept.name,
        concept_description: concept.description || '',
        theses: theses.map(t => t.text).join('\n\n')
      });
      
      const { response, tokensUsed } = await this.sendRequest(
        userId,
        concept.concept_id,
        'practical_application',
        prompt
      );
      
      // Обработка ответа - аналогично другим методам
      // ...
      
      return { text: response }; // Упрощенный вариант
    } catch (error) {
      logger.error(`Practical application error: ${error}`);
      throw new Error(`Failed to suggest practical applications: ${error}`);
    }
  }

  /**
   * Создание диалогической интерпретации между концепциями
   */
  async dialogicalInterpretation(
    userId: string, 
    concept1: Concept, 
    concept2: Concept, 
    question: string
  ): Promise<any> {
    try {
      const prompt = await this.preparePrompt('dialogical_interpretation', {
        concept1_name: concept1.name,
        concept1_description: concept1.description || '',
        concept2_name: concept2.name,
        concept2_description: concept2.description || '',
        philosophical_question: question
      });
      
      const { response, tokensUsed } = await this.sendRequest(
        userId,
        null, // Не привязано к конкретной концепции
        'dialogical_interpretation',
        prompt,
        6000, // Увеличенный лимит токенов для диалога
        0.8 // Немного повышенная температура для креативности
      );
      
      // Обработка ответа - аналогично другим методам
      // ...
      
      return { text: response }; // Упрощенный вариант
    } catch (error) {
      logger.error(`Dialogical interpretation error: ${error}`);
      throw new Error(`Failed to create dialogical interpretation: ${error}`);
    }
  }

  /**
   * Предложение возможных направлений эволюции концепции
   */
  async conceptEvolution(userId: string, concept: Concept, conceptGraph: ConceptGraph): Promise<any> {
    try {
      const prompt = await this.preparePrompt('concept_evolution', {
        concept_name: concept.name,
        concept_description: concept.description || '',
        categories: conceptGraph.categories.map(c => `${c.name}: ${c.definition}`).join('\n'),
        connections: conceptGraph.connections.map(conn => 
          `${conn.source_category?.name || ''} ${conn.direction === 'directed' ? '->' : '<->'} ${conn.target_category?.name || ''} (${conn.connection_type}): ${conn.description || ''}`
        ).join('\n')
      });
      
      const { response, tokensUsed } = await this.sendRequest(
        userId,
        concept.concept_id,
        'concept_evolution',
        prompt
      );
      
      // Обработка ответа - аналогично другим методам
      // ...
      
      return { text: response }; // Упрощенный вариант
    } catch (error) {
      logger.error(`Concept evolution error: ${error}`);
      throw new Error(`Failed to suggest concept evolution: ${error}`);
    }
  }
}
