import express from 'express'
import { isAdmin, verifyToken } from '../middleware/auth.js'
import { addQuestion, editQuestion, getQuestion, getQuestions, getQuestionsFromQuiz, removeQuestion } from '../controllers/questionController.js'

const router = express.Router()

router.get('/', verifyToken, isAdmin, getQuestions)
router.get('/quiz/:quiz_id', verifyToken, isAdmin, getQuestionsFromQuiz)
router.get('/:id', verifyToken, isAdmin, getQuestion)
router.post('/', verifyToken, isAdmin, addQuestion)
router.put('/:id', verifyToken, isAdmin, editQuestion)
router.delete('/:id', verifyToken, isAdmin, removeQuestion)

export default router