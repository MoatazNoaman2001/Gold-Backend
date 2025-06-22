import express from 'express';
import { protect } from '../middlewares/protect.js';
import {  updateUser, deleteUser, resetPassword, forgotPassword,resetPasswordWithToken , getUser} from '../controllers/userController.js';

const router = express.Router();

router.patch('/',protect, updateUser);
router.delete('/',protect, deleteUser);
router.post('/reset_password',protect, resetPassword);
router.post('/forgot-password',forgotPassword);
router.post('/reset-password/:token',resetPasswordWithToken);
router.get('/me', protect, getUser);


export default router;