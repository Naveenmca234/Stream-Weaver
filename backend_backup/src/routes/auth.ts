import { Router } from 'express';
import * as auth from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { auditLog } from '../middleware/audit';

const router = Router();

router.post('/register', auth.register);
router.post('/login', auditLog('login', 'auth'), auth.login);
router.post('/refresh', auth.refreshToken);
router.post('/logout', authenticate, auth.logout);
router.get('/me', authenticate, auth.me);

export default router;
