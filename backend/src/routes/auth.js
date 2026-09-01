import express from 'express';
import {
  register, login, getMe, updateLanguage,
  validateRegister, validateLogin,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.get('/me', authenticate, getMe);
router.put('/language', authenticate, updateLanguage);

export default router;
