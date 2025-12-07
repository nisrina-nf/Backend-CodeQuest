import express from 'express'
import { isAdmin, verifyToken } from '../middleware/auth.js'
import { addQuiz, editQuiz, getQuiz, getQuizzes, removeQuiz } from '../controllers/quizController.js'
import upload from '../middleware/upload.js'

const router = express.Router()

router.get('/', verifyToken, isAdmin, getQuizzes)
router.get('/:id', verifyToken, isAdmin, getQuiz)
router.post('/', upload.single('thumbnail'), verifyToken, isAdmin, addQuiz)
router.put('/:id', upload.single('thumbnail'), verifyToken, isAdmin, editQuiz)
router.delete('/:id', verifyToken, isAdmin, removeQuiz)

export default router