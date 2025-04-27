-- Создание таблиц базы данных для сервиса философских концепций

-- Создание расширения UUID для генерации уникальных идентификаторов
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Таблица пользователей
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    account_type VARCHAR(20) DEFAULT 'basic',
    CONSTRAINT check_account_type CHECK (account_type IN ('basic', 'premium', 'admin'))
);

-- Таблица философских концепций
CREATE TABLE concepts (
    concept_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    creation_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    historical_context TEXT,
    is_synthesis BOOLEAN DEFAULT FALSE,
    parent_concepts JSONB DEFAULT '[]',
    synthesis_method VARCHAR(50),
    focus_area VARCHAR(50),
    CONSTRAINT check_synthesis_method CHECK (
        is_synthesis = FALSE OR 
        synthesis_method IN ('dialectical', 'integrative', 'transformational', 'complementary')
    ),
    CONSTRAINT check_focus_area CHECK (
        focus_area IN (
            'ontological', 'epistemological', 'ethical', 
            'aesthetic', 'political', 'metaphysical'
        )
    )
);

-- Таблица категорий в концепциях
CREATE TABLE categories (
    category_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    concept_id UUID NOT NULL REFERENCES concepts(concept_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    definition TEXT NOT NULL,
    extended_description TEXT,
    source TEXT,
    tradition_concepts JSONB DEFAULT '[]'::jsonb,  -- Массив традиций/концепций
    philosophers JSONB DEFAULT '[]'::jsonb,        -- Массив философов
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблица атрибутов категорий (опциональные количественные характеристики)
CREATE TABLE category_attributes (
    attribute_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES categories(category_id) ON DELETE CASCADE,
    attribute_type VARCHAR(50) NOT NULL,
    value FLOAT NOT NULL,
    justification TEXT,
    methodology TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_attribute_type CHECK (
        attribute_type IN ('centrality', 'definiteness', 'historical_significance')
    ),
    CONSTRAINT check_value_range CHECK (value >= 0 AND value <= 1)
);

-- Таблица связей между категориями
CREATE TABLE connections (
    connection_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    concept_id UUID NOT NULL REFERENCES concepts(concept_id) ON DELETE CASCADE,
    source_category_id UUID NOT NULL REFERENCES categories(category_id) ON DELETE CASCADE,
    target_category_id UUID NOT NULL REFERENCES categories(category_id) ON DELETE CASCADE,
    connection_type VARCHAR(50) NOT NULL,
    direction VARCHAR(20) NOT NULL,
    description TEXT,
    tradition_concepts JSONB DEFAULT '[]'::jsonb,  -- Массив традиций/концепций
    philosophers JSONB DEFAULT '[]'::jsonb,        -- Массив философов
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_direction CHECK (
        direction IN ('directed', 'bidirectional', 'undirected')
    )
);

-- Добавляем индексы для поиска по JSONB массивам
CREATE INDEX idx_categories_tradition_concepts ON categories USING GIN (tradition_concepts);
CREATE INDEX idx_categories_philosophers ON categories USING GIN (philosophers);
CREATE INDEX idx_connections_tradition_concepts ON connections USING GIN (tradition_concepts);
CREATE INDEX idx_connections_philosophers ON connections USING GIN (philosophers);

-- Таблица атрибутов связей (опциональные количественные характеристики)
CREATE TABLE connection_attributes (
    attribute_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES connections(connection_id) ON DELETE CASCADE,
    attribute_type VARCHAR(50) NOT NULL,
    value FLOAT NOT NULL,
    justification TEXT,
    methodology TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_attribute_type CHECK (
        attribute_type IN ('strength', 'obviousness')
    ),
    CONSTRAINT check_value_range CHECK (value >= 0 AND value <= 1)
);

-- Таблица тезисов
CREATE TABLE theses (
    thesis_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    concept_id UUID NOT NULL REFERENCES concepts(concept_id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    derived_from JSONB,
    generation_parameters JSONB,
    used_weights BOOLEAN DEFAULT FALSE,
    style VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_thesis_type CHECK (
        type IN (
            'ontological', 'epistemological', 'ethical', 
            'aesthetic', 'political', 'metaphysical'
        )
    ),
    CONSTRAINT check_style CHECK (
        style IN ('academic', 'popular', 'aphoristic')
    )
);

-- Таблица версий тезисов
CREATE TABLE thesis_versions (
    version_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thesis_id UUID NOT NULL REFERENCES theses(thesis_id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    justification TEXT,
    counterarguments TEXT,
    historical_analogs TEXT,
    practical_implications TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблица метаданных о синтезе концепций
CREATE TABLE synthesis_meta (
    synthesis_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    result_concept_id UUID NOT NULL REFERENCES concepts(concept_id) ON DELETE CASCADE,
    source_concept_ids JSONB NOT NULL,
    synthesis_method VARCHAR(50) NOT NULL,
    innovation_level VARCHAR(20),
    abstraction_level VARCHAR(20),
    historical_context VARCHAR(50),
    target_application TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    compatibility_analysis JSONB,
    CONSTRAINT check_synthesis_method CHECK (
        synthesis_method IN ('dialectical', 'integrative', 'transformational', 'complementary')
    ),
    CONSTRAINT check_innovation_level CHECK (
        innovation_level IN ('conservative', 'moderate', 'radical')
    ),
    CONSTRAINT check_abstraction_level CHECK (
        abstraction_level IN ('concrete', 'intermediate', 'abstract')
    ),
    CONSTRAINT check_historical_context CHECK (
        historical_context IN ('contemporary', 'historical', 'timeless')
    )
);

-- Таблица логов взаимодействий с Claude API
CREATE TABLE claude_interactions (
    interaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    concept_id UUID REFERENCES concepts(concept_id) ON DELETE SET NULL,
    interaction_type VARCHAR(50) NOT NULL,
    prompt TEXT NOT NULL,
    response TEXT,
    tokens_used INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    duration_ms INTEGER,
    CONSTRAINT check_interaction_type CHECK (
        interaction_type IN (
            'graph_validation', 'category_enrichment', 'connection_enrichment',
            'thesis_generation', 'thesis_development', 'compatibility_analysis',
            'concept_synthesis', 'critical_analysis', 'historical_contextualization',
            'practical_application', 'dialogical_interpretation', 'concept_evolution'
        )
    )
);

-- Индексы для оптимизации запросов
CREATE INDEX idx_concepts_user_id ON concepts(user_id);
CREATE INDEX idx_categories_concept_id ON categories(concept_id);
CREATE INDEX idx_connections_concept_id ON connections(concept_id);
CREATE INDEX idx_connections_categories ON connections(source_category_id, target_category_id);
CREATE INDEX idx_category_attributes_category_id ON category_attributes(category_id);
CREATE INDEX idx_connection_attributes_connection_id ON connection_attributes(connection_id);
CREATE INDEX idx_theses_concept_id ON theses(concept_id);
CREATE INDEX idx_thesis_versions_thesis_id ON thesis_versions(thesis_id);
CREATE INDEX idx_claude_interactions_user_id ON claude_interactions(user_id);
CREATE INDEX idx_claude_interactions_concept_id ON claude_interactions(concept_id);
CREATE INDEX idx_claude_interactions_type ON claude_interactions(interaction_type);

-- Создание полнотекстовых индексов для поиска
CREATE INDEX idx_concepts_text_search ON concepts USING GIN (
    to_tsvector('english', name || ' ' || COALESCE(description, ''))
);
CREATE INDEX idx_categories_text_search ON categories USING GIN (
    to_tsvector('english', name || ' ' || definition || ' ' || COALESCE(extended_description, ''))
);
CREATE INDEX idx_theses_text_search ON theses USING GIN (
    to_tsvector('english', text)
);

-- Триггеры для автоматического обновления last_modified
CREATE OR REPLACE FUNCTION update_last_modified()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_modified = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_concepts_last_modified
BEFORE UPDATE ON concepts
FOR EACH ROW
EXECUTE FUNCTION update_last_modified();

CREATE TRIGGER update_categories_last_modified
BEFORE UPDATE ON categories
FOR EACH ROW
EXECUTE FUNCTION update_last_modified();

CREATE TRIGGER update_connections_last_modified
BEFORE UPDATE ON connections
FOR EACH ROW
EXECUTE FUNCTION update_last_modified();

CREATE TRIGGER update_theses_last_modified
BEFORE UPDATE ON theses
FOR EACH ROW
EXECUTE FUNCTION update_last_modified();

-- Создание представления для получения полного графа концепции
CREATE VIEW concept_graph_view AS
SELECT 
    c.concept_id,
    c.name AS concept_name,
    c.description AS concept_description,
    json_agg(
        json_build_object(
            'category_id', cat.category_id,
            'name', cat.name,
            'definition', cat.definition,
            'extended_description', cat.extended_description,
            'attributes', COALESCE(
                (SELECT json_agg(
                    json_build_object(
                        'attribute_id', ca.attribute_id,
                        'attribute_type', ca.attribute_type,
                        'value', ca.value,
                        'justification', ca.justification
                    )
                )
                FROM category_attributes ca
                WHERE ca.category_id = cat.category_id),
                '[]'::json
            )
        )
    ) AS categories,
    json_agg(
        json_build_object(
            'connection_id', conn.connection_id,
            'source_category_id', conn.source_category_id,
            'target_category_id', conn.target_category_id,
            'connection_type', conn.connection_type,
            'direction', conn.direction,
            'description', conn.description,
            'attributes', COALESCE(
                (SELECT json_agg(
                    json_build_object(
                        'attribute_id', conna.attribute_id,
                        'attribute_type', conna.attribute_type,
                        'value', conna.value,
                        'justification', conna.justification
                    )
                )
                FROM connection_attributes conna
                WHERE conna.connection_id = conn.connection_id),
                '[]'::json
            )
        )
    ) AS connections
FROM 
    concepts c
LEFT JOIN 
    categories cat ON c.concept_id = cat.concept_id
LEFT JOIN 
    connections conn ON c.concept_id = conn.concept_id
GROUP BY 
    c.concept_id, c.name, c.description;

-- Представление для анализа использования API Claude
CREATE VIEW claude_api_usage_view AS
SELECT 
    u.user_id,
    u.username,
    c.concept_id,
    c.name AS concept_name,
    ci.interaction_type,
    date_trunc('day', ci.created_at) AS interaction_date,
    COUNT(*) AS interaction_count,
    SUM(ci.tokens_used) AS total_tokens,
    AVG(ci.duration_ms) AS avg_duration_ms
FROM 
    claude_interactions ci
JOIN 
    users u ON ci.user_id = u.user_id
LEFT JOIN 
    concepts c ON ci.concept_id = c.concept_id
GROUP BY 
    u.user_id, u.username, c.concept_id, c.name, ci.interaction_type, date_trunc('day', ci.created_at)
ORDER BY 
    interaction_date DESC;
