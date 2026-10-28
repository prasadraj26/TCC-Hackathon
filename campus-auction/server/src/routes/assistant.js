import { Router } from 'express';
import { handleAssistantSearch } from '../controllers/assistantController.js';

const router = Router();

// POST /api/assistant/search — Public listing inquiry
router.post('/search', handleAssistantSearch);

export default router;
