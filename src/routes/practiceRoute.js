import express from 'express'
import { showQuizCollectionDetail, showQuizCollections } from '../controllers/catalogController.js'
import { verifyToken } from '../middleware/auth.js'
import { getQuizAttemptDetails, getQuizAtttempts, startQuiz, submitQuiz } from '../controllers/quizProgressController.js'

const router = express.Router()

router.get('/collections', showQuizCollections)
router.get('/collections/:id', showQuizCollectionDetail)
router.post('/start/:quiz_id', verifyToken, startQuiz)
router.post('/submit/:quiz_id', verifyToken, submitQuiz)
router.get('/attempts/:quiz_id', verifyToken, getQuizAtttempts)
router.get('/attempts/:quiz_id/:attempt_id', verifyToken, getQuizAttemptDetails)

export default router