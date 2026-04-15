import { Router } from 'express';
import { ChatController } from '../controllers/ChatController';
import { OpenAIService } from '../services/OpenAIService';
import { ConversationService } from '../services/ConversationService';

const router = Router();

// Initialize services
const openAIService = new OpenAIService(process.env.OPENAI_API_KEY || '');
const conversationService = new ConversationService();
const chatController = new ChatController(openAIService, conversationService);

// Routes
router.post('/message', (req, res) => chatController.sendMessage(req, res));
router.get('/conversations', (req, res) => chatController.getConversations(req, res));
router.get('/conversations/:id', (req, res) => chatController.getConversation(req, res));
router.delete('/conversations/:id', (req, res) => chatController.deleteConversation(req, res));

export default router;