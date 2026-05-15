import express from 'express';
import {
  endAgentSession,
  getBookStatus,
  sendAgentMessage,
  startAgentSession,
} from '../controllers/agentController.js';

const router = express.Router();

router.post('/start', startAgentSession);
router.post('/message', sendAgentMessage);
router.post('/end', endAgentSession);
router.get('/book/:gutenbergId/status', getBookStatus);

export default router;

