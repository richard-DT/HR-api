import express from 'express';
import { login, getMe, register } from '../controllers/authController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

router.post('/login',    login);
router.get('/me',        protect, getMe);
router.post('/register', protect, adminOnly, register); // admin only mag-create ng accounts

export default router;