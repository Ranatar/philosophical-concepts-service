// src/routes/index.ts

import express from 'express';
import conceptRoutes from './concept.routes';
import categoryRoutes from './category.routes';
import connectionRoutes from './connection.routes';
import thesisRoutes from './thesis.routes';
import synthesisRoutes from './synthesis.routes';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import { authenticateJWT } from '../middleware/auth';

const router = express.Router();

// Открытые маршруты (не требуют аутентификации)
router.use('/auth', authRoutes);

// Защищенные маршруты (требуют аутентификации)
router.use('/concepts', authenticateJWT, conceptRoutes);
router.use('/categories', authenticateJWT, categoryRoutes);
router.use('/connections', authenticateJWT, connectionRoutes);
router.use('/theses', authenticateJWT, thesisRoutes);
router.use('/synthesis', authenticateJWT, synthesisRoutes);
router.use('/users', authenticateJWT, userRoutes);

export default router;

// src/routes/auth.routes.ts

import express from 'express';
import { AuthController } from '../controllers/auth.controller';

const router = express.Router();
const authController = new AuthController();

// Регистрация нового пользователя
router.post('/register', (req, res) => authController.register(req, res));

// Вход в систему
router.post('/login', (req, res) => authController.login(req, res));

// Обновление токена доступа
router.post('/refresh-token', (req, res) => authController.refreshToken(req, res));

// Выход из системы
router.post('/logout', (req, res) => authController.logout(req, res));

export default router;

// src/routes/concept.routes.ts

import express from 'express';
import { ConceptController } from '../controllers/concept.controller';

const router = express.Router();
const conceptController = new ConceptController();

// Получение списка концепций пользователя
router.get('/', (req, res) => conceptController.getUserConcepts(req, res));

// Создание новой концепции
router.post('/', (req, res) => conceptController.createConcept(req, res));

// Получение концепции по ID
router.get('/:id', (req, res) => conceptController.getConcept(req, res));

// Обновление концепции
router.put('/:id', (req, res) => conceptController.updateConcept(req, res));

// Удаление концепции
router.delete('/:id', (req, res) => conceptController.deleteConcept(req, res));

// Получение графа концепции
router.get('/:id/graph', (req, res) => conceptController.getConceptGraph(req, res));

// Валидация графа концепции
router.post('/:id/validate', (req, res) => conceptController.validateGraph(req, res));

// Историческая контекстуализация концепции
router.get('/:id/historical-context', (req, res) => conceptController.historicalContextualize(req, res));

// Эволюция концепции
router.get('/:id/evolution', (req, res) => conceptController.suggestConceptEvolution(req, res));

// Статистика использования концепции
router.get('/:id/stats', (req, res) => conceptController.getConceptStats(req, res));

// Поиск концепций
router.get('/search', (req, res) => conceptController.searchConcepts(req, res));

// Категории концепции
router.get('/:conceptId/categories', (req, res) => 
  categoryController.getConceptCategories(req, res));
router.post('/:conceptId/categories', (req, res) => 
  categoryController.addCategory(req, res));

// Связи концепции
router.get('/:conceptId/connections', (req, res) => 
  connectionController.getConceptConnections(req, res));
router.post('/:conceptId/connections', (req, res) => 
  connectionController.createConnection(req, res));

// Тезисы концепции
router.get('/:conceptId/theses', (req, res) => 
  thesisController.getConceptTheses(req, res));
router.post('/:conceptId/theses/generate', (req, res) => 
  thesisController.generateTheses(req, res));
router.post('/:conceptId/theses/generate-with-weights', (req, res) => 
  thesisController.generateThesesWithWeights(req, res));
router.post('/:conceptId/theses/generate-without-weights', (req, res) => 
  thesisController.generateThesesWithoutWeights(req, res));

export default router;

// src/routes/category.routes.ts

import express from 'express';
import { CategoryController } from '../controllers/category.controller';

const router = express.Router();
const categoryController = new CategoryController();

// Получение категории по ID
router.get('/:id', (req, res) => categoryController.getCategory(req, res));

// Получение полной категории с атрибутами
router.get('/:id/full', (req, res) => categoryController.getFullCategory(req, res));

// Обновление категории
router.put('/:id', (req, res) => categoryController.updateCategory(req, res));

// Удаление категории
router.delete('/:id', (req, res) => categoryController.deleteCategory(req, res));

// Обогащение категории
router.post('/:id/enrich', (req, res) => categoryController.enrichCategory(req, res));

// Атрибуты категории
router.get('/:id/attributes', (req, res) => categoryController.getCategoryAttributes(req, res));
router.post('/:id/attributes', (req, res) => categoryController.addCategoryAttribute(req, res));
router.put('/:id/attributes/:attributeId', (req, res) => categoryController.updateCategoryAttribute(req, res));
router.delete('/:id/attributes/:attributeId', (req, res) => categoryController.deleteCategoryAttribute(req, res));

export default router;

// src/routes/connection.routes.ts

import express from 'express';
import { ConnectionController } from '../controllers/connection.controller';

const router = express.Router();
const connectionController = new ConnectionController();

// Получение связи по ID
router.get('/:id', (req, res) => connectionController.getConnection(req, res));

// Получение полной связи с атрибутами
router.get('/:id/full', (req, res) => connectionController.getFullConnection(req, res));

// Обновление связи
router.put('/:id', (req, res) => connectionController.updateConnection(req, res));

// Удаление связи
router.delete('/:id', (req, res) => connectionController.deleteConnection(req, res));

// Обогащение связи
router.post('/:id/enrich', (req, res) => connectionController.enrichConnection(req, res));

// Атрибуты связи
router.get('/:id/attributes', (req, res) => connectionController.getConnectionAttributes(req, res));
router.post('/:id/attributes', (req, res) => connectionController.addConnectionAttribute(req, res));
router.put('/:id/attributes/:attributeId', (req, res) => connectionController.updateConnectionAttribute(req, res));
router.delete('/:id/attributes/:attributeId', (req, res) => connectionController.deleteConnectionAttribute(req, res));

export default router;

// src/routes/thesis.routes.ts

import express from 'express';
import { ThesisController } from '../controllers/thesis.controller';

const router = express.Router();
const thesisController = new ThesisController();

// Получение тезиса по ID
router.get('/:id', (req, res) => thesisController.getThesis(req, res));

// Получение тезиса с версиями
router.get('/:id/with-versions', (req, res) => thesisController.getThesisWithVersions(req, res));

// Удаление тезиса
router.delete('/:id', (req, res) => thesisController.deleteThesis(req, res));

// Развитие и обоснование тезиса
router.post('/:id/develop', (req, res) => thesisController.developThesis(req, res));

// Версии тезиса
router.post('/:id/versions', (req, res) => thesisController.createThesisVersion(req, res));
router.get('/:id/versions', (req, res) => thesisController.getThesisVersions(req, res));

// Сравнение наборов тезисов
router.post('/compare', (req, res) => thesisController.compareThesisSets(req, res));

export default router;

// src/routes/synthesis.routes.ts

import express from 'express';
import { SynthesisController } from '../controllers/synthesis.controller';

const router = express.Router();
const synthesisController = new SynthesisController();

// Анализ совместимости концепций для синтеза
router.post('/compatibility', (req, res) => synthesisController.analyzeSynthesisCompatibility(req, res));

// Синтез концепций
router.post('/synthesize', (req, res) => synthesisController.synthesizeConcepts(req, res));

// Синтез с учетом весов
router.post('/synthesize-with-weights', (req, res) => synthesisController.synthesizeConceptsWithWeights(req, res));

// Синтез без учета весов
router.post('/synthesize-without-weights', (req, res) => synthesisController.synthesizeConceptsWithoutWeights(req, res));

// Получение метаданных синтеза по ID
router.get('/:id', (req, res) => synthesisController.getSynthesisMeta(req, res));

// Получение метаданных синтеза по ID результирующей концепции
router.get('/by-concept/:conceptId', (req, res) => synthesisController.getSynthesisMetaByResultConcept(req, res));

// Критический анализ синтезированной концепции
router.get('/:id/analysis', (req, res) => synthesisController.criticallyAnalyzeSynthesis(req, res));

// Создание диалогической интерпретации
router.post('/dialogue', (req, res) => synthesisController.createDialogicalInterpretation(req, res));

// Получение синтезированных концепций пользователя
router.get('/user-synthesized', (req, res) => synthesisController.getUserSynthesizedConcepts(req, res));

export default router;

// src/routes/user.routes.ts

import express from 'express';
import { UserController } from '../controllers/user.controller';

const router = express.Router();
const userController = new UserController();

// Получение информации о текущем пользователе
router.get('/me', (req, res) => userController.getCurrentUser(req, res));

// Обновление профиля пользователя
router.put('/me', (req, res) => userController.updateUserProfile(req, res));

// Получение концепций пользователя
router.get('/:id/concepts', (req, res) => userController.getUserConcepts(req, res));

// Получение статистики использования Claude API пользователем
router.get('/:id/claude-usage', (req, res) => userController.getClaudeUsageStats(req, res));

export default router;
