import { Router } from 'express';
import * as uploadController from '../controllers/uploadController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.post('/sign', authenticate, uploadController.signUpload);

export default router;
