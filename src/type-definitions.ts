// src/types/index.ts

// Основные модели данных
export interface User {
  user_id: string;
  username: string;
  email: string;
  password_hash?: string; // Не передается на клиент
  created_at: Date;
  last_login?: Date;
  account_type: 'basic' | 'premium' | 'admin';
}

export interface Concept {
  concept_id: string;
  user_id: string;
  name: string;
  description?: string;
  creation_date: Date;
  last_modified: Date;
  historical_context?: string;
  is_synthesis: boolean;
  parent_concepts?: string[]; // IDs родительских концепций
  synthesis_method?: 'dialectical' | 'integrative' | 'transformational' | 'complementary';
  focus_area?: 'ontological' | 'epistemological' | 'ethical' | 'aesthetic' | 'political' | 'metaphysical';
}

export interface Category {
  category_id: string;
  concept_id: string;
  name: string;
  definition: string;
  extended_description?: string;
  source?: string;
  tradition_concepts: string[];  // Изменено на массив
  philosophers: string[];        // Изменено на массив
  created_at: Date;
  last_modified: Date;
  attributes?: CategoryAttribute[];
}

export interface CategoryAttribute {
  attribute_id: string;
  category_id: string;
  attribute_type: 'centrality' | 'definiteness' | 'historical_significance';
  value: number; // от 0 до 1
  justification?: string;
  methodology?: string;
  created_at: Date;
  last_modified: Date;
}

export interface Connection {
  connection_id: string;
  concept_id: string;
  source_category_id: string;
  target_category_id: string;
  connection_type: string;
  direction: 'directed' | 'bidirectional' | 'undirected';
  description?: string;
  tradition_concepts: string[];  // Изменено на массив
  philosophers: string[];        // Изменено на массив
  created_at: Date;
  last_modified: Date;
  attributes?: ConnectionAttribute[];
  // Для удобства в UI - заполняются при запросе
  source_category?: Category;
  target_category?: Category;
}

export interface ConnectionAttribute {
  attribute_id: string;
  connection_id: string;
  attribute_type: 'strength' | 'obviousness';
  value: number; // от 0 до 1
  justification?: string;
  methodology?: string;
  created_at: Date;
  last_modified: Date;
}

export interface Thesis {
  thesis_id: string;
  concept_id: string;
  text: string;
  type: 'ontological' | 'epistemological' | 'ethical' | 'aesthetic' | 'political' | 'metaphysical';
  derived_from?: { categories: string[], connections: string[] }; // IDs категорий и связей
  generation_parameters?: ThesisGenerationParams;
  used_weights: boolean;
  style?: 'academic' | 'popular' | 'aphoristic';
  created_at: Date;
  last_modified: Date;
  versions?: ThesisVersion[];
}

export interface ThesisVersion {
  version_id: string;
  thesis_id: string;
  text: string;
  justification?: string;
  counterarguments?: string;
  historical_analogs?: string;
  practical_implications?: string;
  created_at: Date;
}

export interface SynthesisMeta {
  synthesis_id: string;
  result_concept_id: string;
  source_concept_ids: string[]; // IDs исходных концепций
  synthesis_method: 'dialectical' | 'integrative' | 'transformational' | 'complementary';
  innovation_level?: 'conservative' | 'moderate' | 'radical';
  abstraction_level?: 'concrete' | 'intermediate' | 'abstract';
  historical_context?: 'contemporary' | 'historical' | 'timeless';
  target_application?: string;
  created_at: Date;
  compatibility_analysis?: CompatibilityAnalysis;
}

export interface ClaudeInteraction {
  interaction_id: string;
  user_id: string;
  concept_id?: string;
  interaction_type: 
    | 'graph_validation' 
    | 'category_enrichment' 
    | 'connection_enrichment'
    | 'thesis_generation' 
    | 'thesis_development' 
    | 'compatibility_analysis'
    | 'concept_synthesis' 
    | 'critical_analysis' 
    | 'historical_contextualization'
    | 'practical_application' 
    | 'dialogical_interpretation' 
    | 'concept_evolution';
  prompt: string;
  response?: string;
  tokens_used?: number;
  created_at: Date;
  duration_ms?: number;
}

// Составные / Дополнительные структуры

export interface ConceptGraph {
  concept_id: string;
  concept_name: string;
  concept_description?: string;
  categories: (Category & { attributes: CategoryAttribute[] })[];
  connections: (Connection & { 
    attributes: ConnectionAttribute[],
    source_category: Category,
    target_category: Category 
  })[];
}

export interface ValidationResult {
  general_analysis: string;
  contradictions: ValidationIssue[];
  missing_elements: ValidationIssue[];
  improvement_suggestions: ValidationSuggestion[];
}

export interface ValidationIssue {
  issue_type: 'contradiction' | 'missing_element';
  description: string;
  affected_elements?: {
    categories?: string[];
    connections?: string[];
  };
  severity: 'low' | 'medium' | 'high';
}

export interface ValidationSuggestion {
  suggestion_type: 'add_category' | 'add_connection' | 'modify_category' | 'modify_connection';
  description: string;
  proposed_change?: {
    category?: Partial<Category>;
    connection?: Partial<Connection>;
  };
}

export interface EnrichmentResult {
  extended_description: string;
  alternative_interpretations?: string[];
  historical_analogs?: string[];
  related_concepts?: string[];
}

export interface CompatibilityAnalysis {
  fully_compatible: CompatibilityElement[];
  potentially_compatible: CompatibilityElement[];
  incompatible: CompatibilityElement[];
  synthesis_strategies: SynthesisStrategy[];
}

export interface CompatibilityElement {
  element_type: 'category' | 'connection';
  element_id: string;
  name: string;
  description: string;
  compatibility_explanation: string;
}

export interface SynthesisStrategy {
  strategy_name: string;
  description: string;
  benefits: string[];
  limitations: string[];
  recommended: boolean;
}

export interface SynthesisResult {
  concept: Concept;
  graph: ConceptGraph;
  synthesis_meta: SynthesisMeta;
  origin_mapping: {
    category_mapping: {
      [new_category_id: string]: {
        origin_concept_id: string;
        origin_category_id?: string;
        transformation?: string;
      }
    };
    connection_mapping: {
      [new_connection_id: string]: {
        origin_concept_id: string;
        origin_connection_id?: string;
        transformation?: string;
      }
    };
  };
}

export interface CriticalAnalysis {
  internal_consistency: {
    score: number; // от 0 до 1
    analysis: string;
    issues?: string[];
  };
  philosophical_novelty: {
    score: number; // от 0 до 1
    analysis: string;
    novel_elements?: string[];
  };
  preservation_of_value: {
    score: number; // от 0 до 1
    analysis: string;
    preserved_elements?: string[];
    lost_elements?: string[];
  };
  contradiction_resolution: {
    score: number; // от 0 до 1
    analysis: string;
    resolved_contradictions?: string[];
    remaining_contradictions?: string[];
  };
  potential_issues: {
    severity: 'low' | 'medium' | 'high';
    issue: string;
    potential_solution?: string;
  }[];
}

export interface HistoricalContext {
  influences: {
    philosopher: string;
    concept: string;
    description: string;
  }[];
  contemporaries: {
    philosopher: string;
    relationship: 'similar' | 'contrasting' | 'complementary';
    description: string;
  }[];
  influenced: {
    philosopher: string;
    concept: string;
    description: string;
  }[];
  historical_period: string;
  cultural_context: string;
}

export interface PracticalApplication {
  domains: {
    domain: 'education' | 'ethics' | 'politics' | 'personal_development' | 'social_institutions';
    relevant_theses: string[];
    application: string;
    challenges: string;
  }[];
  implementation_strategy: string;
  potential_impact: string;
}

// DTOs для запросов

export interface ConceptCreateDTO {
  name: string;
  description?: string;
  historical_context?: string;
  focus_area?: 'ontological' | 'epistemological' | 'ethical' | 'aesthetic' | 'political' | 'metaphysical';
}

export interface ConceptUpdateDTO {
  name?: string;
  description?: string;
  historical_context?: string;
  focus_area?: 'ontological' | 'epistemological' | 'ethical' | 'aesthetic' | 'political' | 'metaphysical';
}

export interface CategoryCreateDTO {
  name: string;
  definition: string;
  extended_description?: string;
  source?: string;
  tradition_concepts?: string[];  // Массив
  philosophers?: string[];        // Массив
}

export interface CategoryUpdateDTO {
  name?: string;
  definition?: string;
  extended_description?: string;
  source?: string;
  tradition_concepts?: string[];  // Массив
  philosophers?: string[];        // Массив
}

export interface ConnectionCreateDTO {
  source_category_id: string;
  target_category_id: string;
  connection_type: string;
  description?: string;
  tradition_concepts?: string[];  // Массив
  philosophers?: string[];        // Массив
}

export interface ConnectionUpdateDTO {
  connection_type?: string;
  description?: string;
  tradition_concepts?: string[];  // Массив
  philosophers?: string[];        // Массив
}

export interface AttributeCreateDTO {
  attribute_type: string;
  value: number;
  justification?: string;
  methodology?: string;
}

export interface AttributeUpdateDTO {
  value?: number;
  justification?: string;
  methodology?: string;
}

export interface ThesisGenerationParams {
  count: number;
  type: 'ontological' | 'epistemological' | 'ethical' | 'aesthetic' | 'political' | 'metaphysical';
  detail_level?: 'low' | 'medium' | 'high';
  style?: 'academic' | 'popular' | 'aphoristic';
  focus_categories?: string[]; // IDs категорий для акцента
  useWeights: boolean;
}

export interface ThesisVersionCreateDTO {
  text: string;
  justification?: string;
  counterarguments?: string;
  historical_analogs?: string;
  practical_implications?: string;
}

export interface SynthesisParams {
  concept_ids: string[];
  synthesis_method: 'dialectical' | 'integrative' | 'transformational' | 'complementary';
  innovation_level?: 'conservative' | 'moderate' | 'radical';
  abstraction_level?: 'concrete' | 'intermediate' | 'abstract';
  historical_context?: 'contemporary' | 'historical' | 'timeless';
  target_application?: string;
  priorities?: { [concept_id: string]: number }; // Приоритетность концепций в синтезе
  focus_area?: 'ontological' | 'epistemological' | 'ethical' | 'aesthetic' | 'political' | 'metaphysical';
  use_weights: boolean;
}

// Структуры для взаимодействия с Claude API

export interface ClaudeApiRequest {
  model: string;
  messages: ClaudeMessage[];
  max_tokens?: number;
  temperature?: number;
  system?: string;
}

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeApiResponse {
  id: string;
  type: string;
  message: {
    role: string;
    content: string;
  };
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  stop_reason: string;
  stop_sequence?: string;
}

// Интерфейсы для хранения промптов

export interface PromptTemplate {
  name: string;
  description: string;
  template: string;
  parameters: string[]; // Список параметров, которые нужно заменить
  expected_response_structure?: Record<string, any>; // Ожидаемая структура ответа
  fallback_strategy?: string;
}

export interface CacheKey {
  prompt_hash: string;
  timestamp: Date;
  ttl: number; // Time-to-live в секундах
}

// Интерфейсы для статистики и аналитики

export interface UsageStats {
  user_id: string;
  username: string;
  period: 'day' | 'week' | 'month';
  start_date: Date;
  end_date: Date;
  total_interactions: number;
  total_tokens: number;
  interaction_types: {
    [key: string]: number;
  };
  concepts_created: number;
  theses_generated: number;
  syntheses_performed: number;
}

export interface ConceptStats {
  concept_id: string;
  name: string;
  user_id: string;
  categories_count: number;
  connections_count: number;
  theses_count: number;
  claude_interactions: number;
  total_tokens: number;
  last_activity: Date;
}
