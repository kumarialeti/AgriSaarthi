import express from 'express';
import {
  startSession, getSessions, getSessionMessages, sendMessage,
} from '../controllers/chatController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.post('/sessions', startSession);
router.get('/sessions', getSessions);
router.get('/sessions/:session_id/messages', getSessionMessages);
router.post('/sessions/:session_id/messages', (req, res, next) => {
  req.body.session_id = req.params.session_id;
  sendMessage(req, res, next);
});

export default router;
