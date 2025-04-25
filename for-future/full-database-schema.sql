-- Полная схема базы данных для сервиса философских концепций

-- Создание базы данных
CREATE DATABASE philosophical_concepts;

-- Подключение к созданной базе данных
\c philosophical_concepts;

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
        focus_area IS NULL OR
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_connection_type CHECK (
        connection_type IN (
            'hierarchical', 'causal', 'dialectical', 
            'functional', 'derivative', 'associative'
        )
    ),
    CONSTRAINT check_direction CHECK (
        direction IN ('directed', 'bidirectional', 'undirected')
    )
);

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
        style IS NULL OR
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
        innovation_level IS NULL OR
        innovation_level IN ('conservative', 'moderate', 'radical')
    ),
    CONSTRAINT check_abstraction_level CHECK (
        abstraction_level IS NULL OR
        abstraction_level IN ('concrete', 'intermediate', 'abstract')
    ),
    CONSTRAINT check_historical_context CHECK (
        historical_context IS NULL OR
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

-- Таблица для хранения токенов обновления
CREATE TABLE refresh_tokens (
    token_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMP WITH TIME ZONE
);

-- Таблица для настроек пользователей
CREATE TABLE user_settings (
    setting_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    theme VARCHAR(20) DEFAULT 'light',
    language VARCHAR(10) DEFAULT 'en',
    default_use_weights BOOLEAN DEFAULT TRUE,
    default_thesis_style VARCHAR(20) DEFAULT 'academic',
    claude_tokens_budget INTEGER DEFAULT 100000,
    settings_json JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_theme CHECK (theme IN ('light', 'dark', 'system')),
    CONSTRAINT check_language CHECK (language IN ('en', 'ru', 'fr', 'de', 'es', 'it', 'zh', 'ja'))
);

-- Таблица для сохранения истории изменений концепций
CREATE TABLE concept_history (
    history_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    concept_id UUID NOT NULL REFERENCES concepts(concept_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    action_type VARCHAR(20) NOT NULL,
    action_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_action_type CHECK (
        action_type IN ('create', 'update', 'delete', 'add_category', 'remove_category', 'add_connection', 'remove_connection')
    )
);

-- Таблица для комментариев к элементам системы
CREATE TABLE comments (
    comment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    entity_type VARCHAR(20) NOT NULL,
    entity_id UUID NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_entity_type CHECK (
        entity_type IN ('concept', 'category', 'connection', 'thesis')
    )
);

-- Таблица для тегов концепций
CREATE TABLE tags (
    tag_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблица для связи концепций с тегами
CREATE TABLE concept_tags (
    concept_id UUID NOT NULL REFERENCES concepts(concept_id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(tag_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (concept_id, tag_id)
);

-- Таблица для совместного доступа к концепциям
CREATE TABLE concept_sharing (
    sharing_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    concept_id UUID NOT NULL REFERENCES concepts(concept_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    permission_level VARCHAR(20) NOT NULL DEFAULT 'read',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT check_permission_level CHECK (
        permission_level IN ('read', 'comment', 'edit', 'admin')
    ),
    UNIQUE (concept_id, user_id)
);

-- Индексы для оптимизации запросов

-- Индексы для таблицы users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- Индексы для таблицы concepts
CREATE INDEX idx_concepts_user_id ON concepts(user_id);
CREATE INDEX idx_concepts_is_synthesis ON concepts(is_synthesis);
CREATE INDEX idx_concepts_creation_date ON concepts(creation_date);
CREATE INDEX idx_concepts_focus_area ON concepts(focus_area);
CREATE INDEX idx_concepts_text_search ON concepts USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Индексы для таблицы categories
CREATE INDEX idx_categories_concept_id ON categories(concept_id);
CREATE INDEX idx_categories_name ON categories(name);
CREATE INDEX idx_categories_text_search ON categories USING GIN (to_tsvector('english', name || ' ' || definition || ' ' || COALESCE(extended_description, '')));

-- Индексы для таблицы connections
CREATE INDEX idx_connections_concept_id ON connections(concept_id);
CREATE INDEX idx_connections_source_category_id ON connections(source_category_id);
CREATE INDEX idx_connections_target_category_id ON connections(target_category_id);
CREATE INDEX idx_connections_connection_type ON connections(connection_type);

-- Индексы для таблицы category_attributes
CREATE INDEX idx_category_attributes_category_id ON category_attributes(category_id);
CREATE INDEX idx_category_attributes_type_value ON category_attributes(attribute_type, value);

-- Индексы для таблицы connection_attributes
CREATE INDEX idx_connection_attributes_connection_id ON connection_attributes(connection_id);
CREATE INDEX idx_connection_attributes_type_value ON connection_attributes(attribute_type, value);

-- Индексы для таблицы theses
CREATE INDEX idx_theses_concept_id ON theses(concept_id);
CREATE INDEX idx_theses_type ON theses(type);
CREATE INDEX idx_theses_used_weights ON theses(used_weights);
CREATE INDEX idx_theses_text_search ON theses USING GIN (to_tsvector('english', text));

-- Индексы для таблицы thesis_versions
CREATE INDEX idx_thesis_versions_thesis_id ON thesis_versions(thesis_id);
CREATE INDEX idx_thesis_versions_created_at ON thesis_versions(created_at);

-- Индексы для таблицы synthesis_meta
CREATE INDEX idx_synthesis_meta_result_concept_id ON synthesis_meta(result_concept_id);
CREATE INDEX idx_synthesis_meta_method ON synthesis_meta(synthesis_method);
CREATE INDEX idx_synthesis_meta_created_at ON synthesis_meta(created_at);

-- Индексы для таблицы claude_interactions
CREATE INDEX idx_claude_interactions_user_id ON claude_interactions(user_id);
CREATE INDEX idx_claude_interactions_concept_id ON claude_interactions(concept_id);
CREATE INDEX idx_claude_interactions_interaction_type ON claude_interactions(interaction_type);
CREATE INDEX idx_claude_interactions_created_at ON claude_interactions(created_at);

-- Индексы для таблицы refresh_tokens
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Индексы для таблицы user_settings
CREATE UNIQUE INDEX idx_user_settings_user_id ON user_settings(user_id);

-- Индексы для таблицы concept_history
CREATE INDEX idx_concept_history_concept_id ON concept_history(concept_id);
CREATE INDEX idx_concept_history_user_id ON concept_history(user_id);
CREATE INDEX idx_concept_history_action_type ON concept_history(action_type);
CREATE INDEX idx_concept_history_created_at ON concept_history(created_at);

-- Индексы для таблицы comments
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_entity_type_id ON comments(entity_type, entity_id);
CREATE INDEX idx_comments_created_at ON comments(created_at);

-- Индексы для таблицы concept_tags
CREATE INDEX idx_concept_tags_tag_id ON concept_tags(tag_id);
CREATE INDEX idx_concept_tags_concept_id ON concept_tags(concept_id);

-- Индексы для таблицы concept_sharing
CREATE INDEX idx_concept_sharing_concept_id ON concept_sharing(concept_id);
CREATE INDEX idx_concept_sharing_user_id ON concept_sharing(user_id);
CREATE INDEX idx_concept_sharing_permission_level ON concept_sharing(permission_level);

-- Триггеры для автоматического обновления полей last_modified

-- Функция для обновления last_modified
CREATE OR REPLACE FUNCTION update_last_modified()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_modified = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для таблицы concepts
CREATE TRIGGER update_concepts_last_modified
BEFORE UPDATE ON concepts
FOR EACH ROW
EXECUTE FUNCTION update_last_modified();

-- Триггер для таблицы categories
CREATE TRIGGER update_categories_last_modified
BEFORE UPDATE ON categories
FOR EACH ROW
EXECUTE FUNCTION update_last_modified();

-- Триггер для таблицы connections
CREATE TRIGGER update_connections_last_modified
BEFORE UPDATE ON connections
FOR EACH ROW
EXECUTE FUNCTION update_last_modified();

-- Триггер для таблицы theses
CREATE TRIGGER update_theses_last_modified
BEFORE UPDATE ON theses
FOR EACH ROW
EXECUTE FUNCTION update_last_modified();

-- Триггер для таблицы category_attributes
CREATE TRIGGER update_category_attributes_last_modified
BEFORE UPDATE ON category_attributes
FOR EACH ROW
EXECUTE FUNCTION update_last_modified();

-- Триггер для таблицы connection_attributes
CREATE TRIGGER update_connection_attributes_last_modified
BEFORE UPDATE ON connection_attributes
FOR EACH ROW
EXECUTE FUNCTION update_last_modified();

-- Триггер для таблицы user_settings
CREATE TRIGGER update_user_settings_last_modified
BEFORE UPDATE ON user_settings
FOR EACH ROW
EXECUTE FUNCTION update_last_modified();

-- Триггер для таблицы comments
CREATE TRIGGER update_comments_last_modified
BEFORE UPDATE ON comments
FOR EACH ROW
EXECUTE FUNCTION update_last_modified();

-- Функция и триггер для логирования изменений концепции
CREATE OR REPLACE FUNCTION log_concept_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO concept_history (concept_id, user_id, action_type, action_details)
        VALUES (NEW.concept_id, NEW.user_id, 'create', json_build_object('name', NEW.name, 'description', NEW.description));
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO concept_history (concept_id, user_id, action_type, action_details)
        VALUES (NEW.concept_id, NEW.user_id, 'update', 
            json_build_object(
                'old_name', OLD.name, 
                'new_name', NEW.name,
                'old_description', OLD.description,
                'new_description', NEW.description
            )
        );
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO concept_history (concept_id, user_id, action_type, action_details)
        VALUES (OLD.concept_id, OLD.user_id, 'delete', json_build_object('name', OLD.name));
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER concept_change_trigger
AFTER INSERT OR UPDATE OR DELETE ON concepts
FOR EACH ROW
EXECUTE FUNCTION log_concept_change();

-- Функция и триггер для логирования изменений категорий
CREATE OR REPLACE FUNCTION log_category_change()
RETURNS TRIGGER AS $$
DECLARE
    concept_owner_id UUID;
BEGIN
    -- Получение владельца концепции
    SELECT user_id INTO concept_owner_id FROM concepts WHERE concept_id = 
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.concept_id
            ELSE NEW.concept_id
        END;
    
    IF TG_OP = 'INSERT' THEN
        INSERT INTO concept_history (concept_id, user_id, action_type, action_details)
        VALUES (NEW.concept_id, concept_owner_id, 'add_category', 
            json_build_object('category_id', NEW.category_id, 'name', NEW.name)
        );
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO concept_history (concept_id, user_id, action_type, action_details)
        VALUES (OLD.concept_id, concept_owner_id, 'remove_category', 
            json_build_object('category_id', OLD.category_id, 'name', OLD.name)
        );
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER category_change_trigger
AFTER INSERT OR DELETE ON categories
FOR EACH ROW
EXECUTE FUNCTION log_category_change();

-- Функция и триггер для логирования изменений связей
CREATE OR REPLACE FUNCTION log_connection_change()
RETURNS TRIGGER AS $$
DECLARE
    concept_owner_id UUID;
    source_category_name VARCHAR;
    target_category_name VARCHAR;
BEGIN
    -- Получение владельца концепции
    SELECT user_id INTO concept_owner_id FROM concepts WHERE concept_id = 
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.concept_id
            ELSE NEW.concept_id
        END;
    
    IF TG_OP = 'INSERT' THEN
        -- Получение имен категорий
        SELECT name INTO source_category_name FROM categories WHERE category_id = NEW.source_category_id;
        SELECT name INTO target_category_name FROM categories WHERE category_id = NEW.target_category_id;
        
        INSERT INTO concept_history (concept_id, user_id, action_type, action_details)
        VALUES (NEW.concept_id, concept_owner_id, 'add_connection', 
            json_build_object(
                'connection_id', NEW.connection_id, 
                'source_category', source_category_name,
                'target_category', target_category_name,
                'connection_type', NEW.connection_type
            )
        );
    ELSIF TG_OP = 'DELETE' THEN
        -- Получение имен категорий
        SELECT name INTO source_category_name FROM categories WHERE category_id = OLD.source_category_id;
        SELECT name INTO target_category_name FROM categories WHERE category_id = OLD.target_category_id;
        
        INSERT INTO concept_history (concept_id, user_id, action_type, action_details)
        VALUES (OLD.concept_id, concept_owner_id, 'remove_connection', 
            json_build_object(
                'connection_id', OLD.connection_id, 
                'source_category', source_category_name,
                'target_category', target_category_name,
                'connection_type', OLD.connection_type
            )
        );
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER connection_change_trigger
AFTER INSERT OR DELETE ON connections
FOR EACH ROW
EXECUTE FUNCTION log_connection_change();

-- Создание представлений для удобных запросов

-- Представление полного графа концепции
CREATE OR REPLACE VIEW concept_graph_view AS
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
CREATE OR REPLACE VIEW claude_api_usage_view AS
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

-- Представление для статистики по концепциям
CREATE OR REPLACE VIEW concept_stats_view AS
SELECT 
    c.concept_id,
    c.name,
    c.user_id,
    u.username AS owner_username,
    (SELECT COUNT(*) FROM categories cat WHERE cat.concept_id = c.concept_id) AS categories_count,
    (SELECT COUNT(*) FROM connections conn WHERE conn.concept_id = c.concept_id) AS connections_count,
    (SELECT COUNT(*) FROM theses t WHERE t.concept_id = c.concept_id) AS theses_count,
    (SELECT COUNT(*) FROM claude_interactions ci WHERE ci.concept_id = c.concept_id) AS claude_interactions_count,
    (SELECT COALESCE(SUM(ci.tokens_used), 0) FROM claude_interactions ci WHERE ci.concept_id = c.concept_id) AS total_tokens_used,
    c.creation_date,
    c.last_modified,
    c.is_synthesis,
    c.focus_area,
    (
        SELECT COUNT(*) 
        FROM concept_sharing cs 
        WHERE cs.concept_id = c.concept_id
    ) AS sharing_count
FROM 
    concepts c
JOIN 
    users u ON c.user_id = u.user_id;

-- Представление для тезисов с информацией о концепции
CREATE OR REPLACE VIEW thesis_with_concept_view AS
SELECT 
    t.thesis_id,
    t.text,
    t.type,
    t.used_weights,
    t.style,
    t.created_at,
    t.concept_id,
    c.name AS concept_name,
    c.user_id,
    u.username AS owner_username,
    (
        SELECT COUNT(*) 
        FROM thesis_versions tv 
        WHERE tv.thesis_id = t.thesis_id
    ) AS versions_count
FROM 
    theses t
JOIN 
    concepts c ON t.concept_id = c.concept_id
JOIN 
    users u ON c.user_id = u.user_id;

-- Представление для синтеза концепций с информацией о результате и источниках
CREATE OR REPLACE VIEW synthesis_detailed_view AS
SELECT 
    sm.synthesis_id,
    sm.result_concept_id,
    rc.name AS result_concept_name,
    rc.description AS result_concept_description,
    rc.user_id,
    u.username AS owner_username,
    sm.synthesis_method,
    sm.innovation_level,
    sm.abstraction_level,
    sm.historical_context,
    sm.created_at,
    json_array_length(sm.source_concept_ids) AS source_concepts_count,
    (
        SELECT json_agg(
            json_build_object(
                'concept_id', c.concept_id,
                'name', c.name,
                'user_id', c.user_id,
                'username', (SELECT username FROM users WHERE user_id = c.user_id)
            )
        )
        FROM concepts c
        WHERE c.concept_id = ANY(ARRAY(SELECT jsonb_array_elements_text(sm.source_concept_ids)))
    ) AS source_concepts
FROM 
    synthesis_meta sm
JOIN 
    concepts rc ON sm.result_concept_id = rc.concept_id
JOIN 
    users u ON rc.user_id = u.user_id;
