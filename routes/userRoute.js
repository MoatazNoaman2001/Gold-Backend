import express from 'express';
import {  updateUser, deleteUser, resetPassword, forgotPassword,resetPasswordWithToken , getUser} from '../controllers/userController.js';
import { authenticateUser } from '../middlewares/auth.js';
const router = express.Router();

router.put('/',authenticateUser, updateUser);
router.delete('/',authenticateUser, deleteUser);
router.post('/reset_password',authenticateUser, resetPassword);
router.post('/forgot-password',forgotPassword);
router.post('/reset-password/:token',resetPasswordWithToken);
router.get('/me', authenticateUser, getUser);


export default router;