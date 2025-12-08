import express from 'express'
import upload from '../middleware/upload.js'
import { verifyToken } from '../middleware/auth.js'
import { editProfile, getMyStats } from '../controllers/userController.js'
import { getUserQuizHistory } from '../controllers/quizProgressController.js'
import { getEnrollmentDetails, getUserEnrollments } from '../controllers/courseController.js'
import { getMyLeaderboardPosition } from '../controllers/leaderboardController.js'
import { courseProgress, lessonProgress } from '../controllers/lessonProgressController.js'
import { getMyBadges } from '../controllers/badgeController.js'

const router = express.Router()

router.get('/stats', verifyToken, getMyStats)
router.put('/edit', upload.single('avatar'), verifyToken, editProfile)
router.get('/badge', verifyToken, getMyBadges)
router.get('/enrollments', verifyToken, getUserEnrollments)
router.get('/enrollments/:course_id', verifyToken, getEnrollmentDetails)
router.get('/course-progress/:course_id', verifyToken, courseProgress)
router.get('/lesson-progress/:lesson_id', verifyToken, lessonProgress)
router.get('/quiz-history', verifyToken, getUserQuizHistory)
router.get('/leaderboard', verifyToken, getMyLeaderboardPosition)

export default router