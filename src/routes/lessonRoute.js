import express from 'express'
import { isAdmin, verifyToken } from '../middleware/auth.js'
import { addLesson, editLesson, getLesson, getLessons, removeLesson } from '../controllers/lessonController.js'

const router = express.Router()

router.get('/', verifyToken, isAdmin, getLessons)
router.get('/:id', verifyToken, isAdmin, getLesson)
router.post('/', verifyToken, isAdmin, addLesson)
router.put('/:id', verifyToken, isAdmin, editLesson)
router.delete('/:id', verifyToken, isAdmin, removeLesson)

export default router