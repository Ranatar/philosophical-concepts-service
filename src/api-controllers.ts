// src/controllers/concept.controller.ts

import { Request, Response } from 'express';
import { ConceptService } from '../services/concept.service';
import { logger } from '../utils/logger';

export class ConceptController {
  private conceptService: ConceptService;

  constructor() {
    this.conceptService = new ConceptService();
  }

  /**
   * Создает новую концепцию
   */
  async createConcept(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      const concept = await this.conceptService.createConcept(userId, req.body);
      res.status(201).json(concept);
    } catch (error) {
      logger.error(`Error creating concept: ${error}`);
      res.status(500).json({ error: `Failed to create concept: ${error.message}` });
    }
  }

  /**
   * Получает концепцию по ID
   */
  async getConcept(req: Request, res: Response): Promise<void> {
    try {
      const conceptId = req.params.id;
      const concept = await this.conceptService.getConcept(conceptId);
      res.json(concept);
    } catch (error) {
      logger.error(`Error getting concept: ${error}`);
      res.status(404).json({ error: `Concept not found: ${error.message}` });
    }
  }

  /**
   * Обновляет концепцию
   */
  async updateConcept(req: Request, res: Response): Promise<void> {
    try {
      const conceptId = req.params.id;
      const concept = await this.conceptService.updateConcept(conceptId, req.body);
      res.json(concept);
    } catch (error) {
      logger.error(`Error updating concept: ${error}`);
      res.status(500).json({ error: `Failed to update concept: ${error.message}` });
    }
  }

  /**
   * Удаляет концепцию
   */
  async deleteConcept(req: Request, res: Response): Promise<void> {
    try {
      const conceptId = req.params.id;
      await this.conceptService.deleteConcept(conceptId);
      res.status(204).end();
    } catch (error) {
      logger.error(`Error deleting concept: ${error}`);
      res.status(500).json({ error: `Failed to delete concept: ${error.message}` });
    }
  }

  /**
   * Получает список концепций пользователя
   */
  async getUserConcepts(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      const concepts = await this.conceptService.listUserConcepts(userId);
      res.json(concepts);
    } catch (error) {
      logger.error(`Error getting user concepts: ${error}`);
      res.status(500).json({ error: `Failed to get concepts: ${error.message}` });
    }
  }

  /**
   * Получает граф концепции
   */
  async getConceptGraph(req: Request, res: Response): Promise<void> {
    try {
      const conceptId = req.params.id;
      const graph = await this.conceptService.getConceptGraph(conceptId);
      res.json(graph);
    } catch (error) {
      logger.error(`Error getting concept graph: ${error}`);
      res.status(500).json({ error: `Failed to get concept graph: ${error.message}` });
    }
  }

  /**
   * Валидирует граф концепции
   */
  async validateGraph(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      const conceptId = req.params.id;
      const validationResult = await this.conceptService.validateGraph(userId, conceptId);
      res.json(validationResult);
    } catch (error) {
      logger.error(`Error validating graph: ${error}`);
      res.status(500).json({ error: `Failed to validate graph: ${error.message}` });
    }
  }

  /**
   * Историческая контекстуализация концепции
   */
  async historicalContextualize(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      const conceptId = req.params.id;
      const historicalContext = await this.conceptService.historicalContextualize(userId, conceptId);
      res.json(historicalContext);
    } catch (error) {
      logger.error(`Error generating historical context: ${error}`);
      res.status(500).json({ error: `Failed to generate historical context: ${error.message}` });
    }
  }

  /**
   * Предложение возможных направлений эволюции концепции
   */
  async suggestConceptEvolution(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      const conceptId = req.params.id;
      const evolution = await this.conceptService.suggestConceptEvolution(userId, conceptId);
      res.json(evolution);
    } catch (error) {
      logger.error(`Error suggesting concept evolution: ${error}`);
      res.status(500).json({ error: `Failed to suggest concept evolution: ${error.message}` });
    }
  }

  /**
   * Поиск концепций
   */
  async searchConcepts(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query.q as string;
      const userId = req.query.userId as string;
      
      if (!query) {
        res.status(400).json({ error: 'Query parameter is required' });
        return;
      }
      
      const concepts = await this.conceptService.searchConcepts(query, userId);
      res.json(concepts);
    } catch (error) {
      logger.error(`Error searching concepts: ${error}`);
      res.status(500).json({ error: `Failed to search concepts: ${error.message}` });
    }
  }

  /**
   * Получает статистику по концепции
   */
  async getConceptStats(req: Request, res: Response): Promise<void> {
    try {
      const conceptId = req.params.id;
      const stats = await this.conceptService.getConceptStats(conceptId);
      res.json(stats);
    } catch (error) {
      logger.error(`Error getting concept stats: ${error}`);
      res.status(500).json({ error: `Failed to get concept stats: ${error.message}` });
    }
  }
}

// src/controllers/category.controller.ts

import { Request, Response } from 'express';
import { CategoryService } from '../services/category.service';
import { logger } from '../utils/logger';

export class CategoryController {
  private categoryService: CategoryService;

  constructor() {
    this.categoryService = new CategoryService();
  }

  /**
   * Добавляет категорию в концепцию
   */
  async addCategory(req: Request, res: Response): Promise<void> {
    try {
      const conceptId = req.params.conceptId;
      const category = await this.categoryService.addCategory(conceptId, req.body);
      res.status(201).json(category);
    } catch (error) {
      logger.error(`Error adding category: ${error}`);
      res.status(500).json({ error: `Failed to add category: ${error.message}` });
    }
  }

  /**
   * Обновляет категорию
   */
  async updateCategory(req: Request, res: Response): Promise<void> {
    try {
      const categoryId = req.params.id;
      const category = await this.categoryService.updateCategory(categoryId, req.body);
      res.json(category);
    } catch (error) {
      logger.error(`Error updating category: ${error}`);
      res.status(500).json({ error: `Failed to update category: ${error.message}` });
    }
  }

  /**
   * Удаляет категорию
   */
  async deleteCategory(req: Request, res: Response): Promise<void> {
    try {
      const categoryId = req.params.id;
      await this.categoryService.deleteCategory(categoryId);
      res.status(204).end();
    } catch (error) {
      logger.error(`Error deleting category: ${error}`);
      res.status(500).json({ error: `Failed to delete category: ${error.message}` });
    }
  }

  /**
   * Получает категорию по ID
   */
  async getCategory(req: Request, res: Response): Promise<void> {
    try {
      const categoryId = req.params.id;
      const category = await this.categoryService.getCategoryById(categoryId);
      res.json(category);
    } catch (error) {
      logger.error(`Error getting category: ${error}`);
      res.status(404).json({ error: `Category not found: ${error.message}` });
    }
  }

  /**
   * Получает полную категорию с атрибутами
   */
  async getFullCategory(req: Request, res: Response): Promise<void> {
    try {
      const categoryId = req.params.id;
      const category = await this.categoryService.getFullCategory(categoryId);
      res.json(category);
    } catch (error) {
      logger.error(`Error getting full category: ${error}`);
      res.status(404).json({ error: `Category not found: ${error.message}` });
    }
  }

  /**
   * Получает список категорий концепции
   */
  async getConceptCategories(req: Request, res: Response): Promise<void> {
    try {
      const conceptId = req.params.conceptId;
      const categories = await this.categoryService.listConceptCategories(conceptId);
      res.json(categories);
    } catch (error) {
      logger.error(`Error getting concept categories: ${error}`);
      res.status(500).json({ error: `Failed to get categories: ${error.message}` });
    }
  }

  /**
   * Получает список категорий концепции с их атрибутами
   */
  async getConceptCategoriesWithAttributes(req: Request, res: Response): Promise<void> {
    try {
      const conceptId = req.params.conceptId;
      const categories = await this.categoryService.listConceptCategoriesWithAttributes(conceptId);
      res.json(categories);
    } catch (error) {
      logger.error(`Error getting categories with attributes: ${error}`);
      res.status(500).json({ error: `Failed to get categories with attributes: ${error.message}` });
    }
  }

  /**
   * Обогащает категорию дополнительной информацией
   */
  async enrichCategory(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      const categoryId = req.params.id;
      const enrichmentResult = await this.categoryService.enrichCategory(userId, categoryId);
      res.json(enrichmentResult);
    } catch (error) {
      logger.error(`Error enriching category: ${error}`);
      res.status(500).json({ error: `Failed to enrich category: ${error.message}` });
    }
  }

  /**
   * Добавляет атрибут категории
   */
  async addCategoryAttribute(req: Request, res: Response): Promise<void> {
    try {
      const categoryId = req.params.id;
      const attribute = await this.categoryService.addCategoryAttribute(categoryId, req.body);
      res.status(201).json(attribute);
    } catch (error) {
      logger.error(`Error adding category attribute: ${error}`);
      res.status(500).json({ error: `Failed to add category attribute: ${error.message}` });
    }
  }

  /**
   * Обновляет атрибут категории
   */
  async updateCategoryAttribute(req: Request, res: Response): Promise<void> {
    try {
      const attributeId = req.params.attributeId;
      const attribute = await this.categoryService.updateCategoryAttribute(attributeId, req.body);
      res.json(attribute);
    } catch (error) {
      logger.error(`Error updating category attribute: ${error}`);
      res.status(500).json({ error: `Failed to update category attribute: ${error.message}` });
    }
  }

  /**
   * Удаляет атрибут категории
   */
  async deleteCategoryAttribute(req: Request, res: Response): Promise<void> {
    try {
      const attributeId = req.params.attributeId;
      await this.categoryService.deleteCategoryAttribute(attributeId);
      res.status(204).end();
    } catch (error) {
      logger.error(`Error deleting category attribute: ${error}`);
      res.status(500).json({ error: `Failed to delete category attribute: ${error.message}` });
    }
  }

  /**
   * Получает атрибуты категории
   */
  async getCategoryAttributes(req: Request, res: Response): Promise<void> {
    try {
      const categoryId = req.params.id;
      const attributes = await this.categoryService.getCategoryAttributes(categoryId);
      res.json(attributes);
    } catch (error) {
      logger.error(`Error getting category attributes: ${error}`);
      res.status(500).json({ error: `Failed to get category attributes: ${error.message}` });
    }
  }
}

// src/controllers/connection.controller.ts

import { Request, Response } from 'express';
import { ConnectionService } from '../services/connection.service';
import { logger } from '../utils/logger';

export class ConnectionController {
  private connectionService: ConnectionService;

  constructor() {
    this.connectionService = new ConnectionService();
  }

  /**
   * Создает связь между категориями
   */
  async createConnection(req: Request, res: Response): Promise<void> {
    try {
      const conceptId = req.params.conceptId;
      const connection = await this.connectionService.createConnection(conceptId, req.body);
      res.status(201).json(connection);
    } catch (error) {
      logger.error(`Error creating connection: ${error}`);
      res.status(500).json({ error: `Failed to create connection: ${error.message}` });
    }
  }

  /**
   * Обновляет связь
   */
  async updateConnection(req: Request, res: Response): Promise<void> {
    try {
      const connectionId = req.params.id;
      const connection = await this.connectionService.updateConnection(connectionId, req.body);
      res.json(connection);
    } catch (error) {
      logger.error(`Error updating connection: ${error}`);
      res.status(500).json({ error: `Failed to update connection: ${error.message}` });
    }
  }

  /**
   * Удаляет связь
   */
  async deleteConnection(req: Request, res: Response): Promise<void> {
    try {
      const connectionId = req.params.id;
      await this.connectionService.deleteConnection(connectionId);
      res.status(204).end();
    } catch (error) {
      logger.error(`Error deleting connection: ${error}`);
      res.status(500).json({ error: `Failed to delete connection: ${error.message}` });
    }
  }

  /**
   * Получает связь по ID
   */
  async getConnection(req: Request, res: Response): Promise<void> {
    try {
      const connectionId = req.params.id;
      const connection = await this.connectionService.getConnectionById(connectionId);
      res.json(connection);
    } catch (error) {
      logger.error(`Error getting connection: ${error}`);
      res.status(404).json({ error: `Connection not found: ${error.message}` });
    }
  }

  /**
   * Получает полную связь с атрибутами
   */
  async getFullConnection(req: Request, res: Response): Promise<void> {
    try {
      const connectionId = req.params.id;
      const connection = await this.connectionService.getFullConnection(connectionId);
      res.json(connection);
    } catch (error) {
      logger.error(`Error getting full connection: ${error}`);
      res.status(404).json({ error: `Connection not found: ${error.message}` });
    }
  }

  /**
   * Получает список связей концепции
   */
  async getConceptConnections(req: Request, res: Response): Promise<void> {
    try {
      const conceptId = req.params.conceptId;
      const connections = await this.connectionService.listConceptConnections(conceptId);
      res.json(connections);
    } catch (error) {
      logger.error(`Error getting concept connections: ${error}`);
      res.status(500).json({ error: `Failed to get connections: ${error.message}` });
    }
  }

  /**
   * Получает список связей концепции с их атрибутами
   */
  async getConceptConnectionsWithAttributes(req: Request, res: Response): Promise<void> {
    try {
      const conceptId = req.params.conceptId;
      const connections = await this.connectionService.listConceptConnectionsWithAttributes(conceptId);
      res.json(connections);
    } catch (error) {
      logger.error(`Error getting connections with attributes: ${error}`);
      res.status(500).json({ error: `Failed to get connections with attributes: ${error.message}` });
    }
  }

  /**
   * Обогащает связь дополнительной информацией
   */
  async enrichConnection(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      const connectionId = req.params.id;
      const enrichmentResult = await this.connectionService.enrichConnection(userId, connectionId);
      res.json(enrichmentResult);
    } catch (error) {
      logger.error(`Error enriching connection: ${error}`);
      res.status(500).json({ error: `Failed to enrich connection: ${error.message}` });
    }
  }

  /**
   * Добавляет атрибут связи
   */
  async addConnectionAttribute(req: Request, res: Response): Promise<void> {
    try {
      const connectionId = req.params.id;
      const attribute = await this.connectionService.addConnectionAttribute(connectionId, req.body);
      res.status(201).json(attribute);
    } catch (error) {
      logger.error(`Error adding connection attribute: ${error}`);
      res.status(500).json({ error: `Failed to add connection attribute: ${error.message}` });
    }
  }

  /**
   * Обновляет атрибут связи
   */
  async updateConnectionAttribute(req: Request, res: Response): Promise<void> {
    try {
      const attributeId = req.params.attributeId;
      const attribute = await this.connectionService.updateConnectionAttribute(attributeId, req.body);
      res.json(attribute);
    } catch (error) {
      logger.error(`Error updating connection attribute: ${error}`);
      res.status(500).json({ error: `Failed to update connection attribute: ${error.message}` });
    }
  }

  /**
   * Удаляет атрибут связи
   */
  async deleteConnectionAttribute(req: Request, res: Response): Promise<void> {
    try {
      const attributeId = req.params.attributeId;
      await this.connectionService.deleteConnectionAttribute(attributeId);
      res.status(204).end();
    } catch (error) {
      logger.error(`Error deleting connection attribute: ${error}`);
      res.status(500).json({ error: `Failed to delete connection attribute: ${error.message}` });
    }
  }

  /**
   * Получает атрибуты связи
   */
  async getConnectionAttributes(req: Request, res: Response): Promise<void> {
    try {
      const connectionId = req.params.id;
      const attributes = await this.connectionService.getConnectionAttributes(connectionId);
      res.json(attributes);
    } catch (error) {
      logger.error(`Error getting connection attributes: ${error}`);
      res.status(500).json({ error: `Failed to get connection attributes: ${error.message}` });
    }
  }
}

// src/controllers/thesis.controller.ts

import { Request, Response } from 'express';
import { ThesisService } from '../services/thesis.service';
import { logger } from '../utils/logger';

export class ThesisController {
  private thesisService: ThesisService;

  constructor() {
    this.thesisService = new ThesisService();
  }

  /**
   * Генерирует тезисы для концепции
   */
  async generateTheses(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      const conceptId = req.params.conceptId;
      const theses = await this.thesisService.generateTheses(userId, conceptId, req.body);
      res.json(theses);
    } catch (error) {
      logger.error(`Error generating theses: ${error}`);
      res.status(500).json({ error: `Failed to generate theses: ${error.message}` });
    }
  }

  /**
   * Генерирует тезисы с учетом весов
   */
  async generateThesesWithWeights(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      const conceptId = req.params.conceptId;
      const theses = await this.thesisService.generateThesesWithWeights(userId, conceptId, req.body);
      res.json(theses);
    } catch (error) {
      logger.error(`Error generating theses with weights: ${error}`);
      res.status(500).json({ error: `Failed to generate theses with weights: ${error.message}` });
    }
  }

  /**
   * Генерирует тезисы без учета весов
   */
  async generateThesesWithoutWeights(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      const conceptId = req.params.conceptId;
      const theses = await this.thesisService.generateThesesWithoutWeights(userId, conceptId, req.body);
      res.json(theses);
    } catch (error) {
      logger.error(`Error generating theses without weights: ${error}`);
      res.status(500).json({ error: `Failed to generate theses without weights: ${error.message}` });
    }
  }

  /**
   * Получает тезис по ID
   */
  async getThesis(req: Request, res: Response): Promise<void> {
    try {
      const thesisId = req.params.id;
      const thesis = await this.thesisService.getThesis(thesisId);
      res.json(thesis);
    } catch (error) {
      logger.error(`Error getting thesis: ${error}`);
      res.status(404).json({ error: `Thesis not found: ${error.message}` });
    }
  }

  /**
   * Получает тезис с его версиями
   */
  async getThesisWithVersions(req: Request, res: Response): Promise<void> {
    try {
      const thesisId = req.params.id;
      const thesis = await this.thesisService.getThesisWithVersions(thesisId);
      res.json(thesis);
    } catch (error) {
      logger.error(`Error getting thesis with versions: ${error}`);
      res.status(404).json({ error: `Thesis not found: ${error.message}` });
    }
  }

  /**
   * Получает тезисы концепции
   */
  async getConceptTheses(req: Request, res: Response): Promise<void> {
    try {
      const conceptId = req.params.conceptId;
      const theses = await this.thesisService.getConceptTheses(conceptId);
      res.json(theses);
    } catch (error) {
      logger.error(`Error getting concept theses: ${error}`);
      res.status(500).json({ error: `Failed to get theses: ${error.message}` });
    }
  }

  /**
   * Удаляет тезис
   */
  async deleteThesis(req: Request, res: Response): Promise<void> {
    try {
      const thesisId = req.params.id;
      await this.thesisService.deleteThesis(thesisId);
      res.status(204).end();
    } catch (error) {
      logger.error(`Error deleting thesis: ${error}`);
      res.status(500).json({ error: `Failed to delete thesis: ${error.message}` });
    }
  }

  /**
   * Развивает и обосновывает тезис
   */
  async developThesis(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      const thesisId = req.params.id;
      const thesisVersion = await this.thesisService.developThesis(userId, thesisId);
      res.json(thesisVersion);
    } catch (error) {
      logger.error(`Error developing thesis: ${error}`);
      res.status(500).json({ error: `Failed to develop thesis: ${error.message}` });
    }
  }

  /**
   * Создает версию тезиса
   */
  async createThesisVersion(req: Request, res: Response): Promise<void> {
    try {
      const thesisId = req.params.id;
      const thesisVersion = await this.thesisService.createThesisVersion(thesisId, req.body);
      res.status(201).json(thesisVersion);
    } catch (error) {
      logger.error(`Error creating thesis version: ${error}`);
      res.status(500).json({ error: `Failed to create thesis version: ${error.message}` });
    }
  }

  /**
   * Получает версии тезиса
   */
  async getThesisVersions(req: Request, res: Response): Promise<void> {
    try {
      const thesisId = req.params.id;
      const versions = await this.thesisService.getThesisVersions(thesisId);
      res.json(versions);
    } catch (error) {
      logger.error(`Error getting thesis versions: ${error}`);
      res.status(500).json({ error: `Failed to get thesis versions: ${error.message}` });
    }
  }

  /**
   * Сравнивает два набора тезисов
   */
  async compareThesisSets(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      const { conceptId, withWeightsIds, withoutWeightsIds } = req.body;
      
      if (!conceptId || !withWeightsIds || !withoutWeightsIds) {
        res.status(400).json({ error: 'Missing required parameters' });
        return;
      }
      
      const comparison = await this.thesisService.compareThesisSets(
        userId,
        conceptId,
        withWeightsIds,
        withoutWeightsIds
      );
      
      res.json(comparison);
    } catch (error) {
      logger.error(`Error comparing thesis sets: ${error}`);
      res.status(500).json({ error: `Failed to compare thesis sets: ${error.message}` });
    }
  }
}

// src/controllers/synthesis.controller.ts

import { Request, Response } from 'express';
import { SynthesisService } from '../services/synthesis.service';
import { logger } from '../utils/logger';

export class SynthesisController {
  private synthesisService: SynthesisService;

  constructor() {
    this.synthesisService = new SynthesisService();
  }

  /**
   * Анализирует совместимость концепций для синтеза
   */
  async analyzeSynthesisCompatibility(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      const { conceptIds } = req.body;
      
      if (!conceptIds || !Array.isArray(conceptIds) || conceptIds.length < 2) {
        res.status(400).json({ error: 'At least two valid concept IDs are required' });
        return;
      }
      
      const compatibilityAnalysis = await this.synthesisService.analyzeSynthesisCompatibility(userId, conceptIds);
      res.json(compatibilityAnalysis);
    } catch (error) {
      logger.error(`Error analyzing synthesis compatibility: ${error}`);
      res.status(500).json({ error: `Failed to analyze synthesis compatibility: ${error.message}` });
    }
  }

  /**
   * Синтезирует новую концепцию
   */
  async synthesizeConcepts(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      const synthesisResult = await this.synthesisService.synthesizeConcepts(userId, req.body);
      res.json(synthesisResult);
    } catch (error) {
      logger.error(`Error synthesizing concepts: ${error}`);
      res.status(500).json({ error: `Failed to synthesize concepts: ${error.message}` });
    }
  }

  /**
   * Синтезирует концепции с учетом количественных характеристик
   */
  async synthesizeConceptsWithWeights(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      const synthesisResult = await this.synthesisService.synthesizeConceptsWithWeights(userId, req.body);
      res.json(synthesisResult);
    } catch (error) {
      logger.error(`Error synthesizing concepts with weights: ${error}`);
      res.status(500).json({ error: `Failed to synthesize concepts with weights: ${error.message}` });
    }
  }

  /**
   * Синтезирует концепции без учета количественных характеристик
   */
  async synthesizeConceptsWithoutWeights(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      const synthesisResult = await this.synthesisService.synthesizeConceptsWithoutWeights(userId, req.body);
      res.json(synthesisResult);
    } catch (error) {
      logger.error(`Error synthesizing concepts without weights: ${error}`);
      res.status(500).json({ error: `Failed to synthesize concepts without weights: ${error.message}` });
    }
  }

  /**
   * Критический анализ синтезированной концепции
   */
  async criticallyAnalyzeSynthesis(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      const synthesisId = req.params.id;
      const criticalAnalysis = await this.synthesisService.criticallyAnalyzeSynthesis(userId, synthesisId);
      res.json(criticalAnalysis);
    } catch (error) {
      logger.error(`Error critically analyzing synthesis: ${error}`);
      res.status(500).json({ error: `Failed to critically analyze synthesis: ${error.message}` });
    }
  }

  /**
   * Получает метаданные синтеза по ID
   */
  async getSynthesisMeta(req: Request, res: Response): Promise<void> {
    try {
      const synthesisId = req.params.id;
      const synthesisMeta = await this.synthesisService.getSynthesisMeta(synthesisId);
      res.json(synthesisMeta);
    } catch (error) {
      logger.error(`Error getting synthesis meta: ${error}`);
      res.status(404).json({ error: `Synthesis not found: ${error.message}` });
    }
  }

  /**
   * Получает метаданные синтеза по ID результирующей концепции
   */
  async getSynthesisMetaByResultConcept(req: Request, res: Response): Promise<void> {
    try {
      const conceptId = req.params.conceptId;
      const synthesisMeta = await this.synthesisService.getSynthesisMetaByResultConcept(conceptId);
      
      if (!synthesisMeta) {
        res.status(404).json({ error: `No synthesis found for concept ${conceptId}` });
        return;
      }
      
      res.json(synthesisMeta);
    } catch (error) {
      logger.error(`Error getting synthesis meta by result concept: ${error}`);
      res.status(500).json({ error: `Failed to get synthesis meta: ${error.message}` });
    }
  }

  /**
   * Создает диалогическую интерпретацию между концепциями
   */
  async createDialogicalInterpretation(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      const { conceptId1, conceptId2, question } = req.body;
      
      if (!conceptId1 || !conceptId2 || !question) {
        res.status(400).json({ error: 'Missing required parameters' });
        return;
      }
      
      const interpretation = await this.synthesisService.createDialogicalInterpretation(
        userId,
        conceptId1,
        conceptId2,
        question
      );
      
      res.json(interpretation);
    } catch (error) {
      logger.error(`Error creating dialogical interpretation: ${error}`);
      res.status(500).json({ error: `Failed to create dialogical interpretation: ${error.message}` });
    }
  }

  /**
   * Получает все синтезированные концепции пользователя
   */
  async getUserSynthesizedConcepts(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      const concepts = await this.synthesisService.getUserSynthesizedConcepts(userId);
      res.json(concepts);
    } catch (error) {
      logger.error(`Error getting user synthesized concepts: ${error}`);
      res.status(500).json({ error: `Failed to get user synthesized concepts: ${error.message}` });
    }
  }
}
