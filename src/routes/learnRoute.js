import express from 'express'
import { showCourseDetail, showCourses } from '../controllers/catalogController.js'
import { verifyToken } from '../middleware/auth.js'
import { enrollCourse, unenrollCourse } from '../controllers/courseController.js'
import { finishLesson, startLesson } from '../controllers/lessonProgressController.js'

const router = express.Router()

router.get('/courses', showCourses)
router.get('/courses/:id', showCourseDetail)
router.post('/enroll/:course_id', verifyToken, enrollCourse)
router.delete('/unenroll/:course_id', verifyToken, unenrollCourse)
router.post('/start/:lesson_id', verifyToken, startLesson)
router.post('/complete/:lesson_id', verifyToken, finishLesson)

export default router