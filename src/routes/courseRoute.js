import express from 'express'
import { isAdmin, verifyToken } from '../middleware/auth.js'
import { addCourse, editCourse, getCourse, getCourseEnrolledUsers, getCourses, removeCourse } from '../controllers/courseController.js'
import upload from '../middleware/upload.js'

const router = express.Router()

router.get('/', verifyToken, isAdmin, getCourses)
router.get('/:id', verifyToken, isAdmin, getCourse)
router.post('/', upload.single('thumbnail'), verifyToken, isAdmin, addCourse)
router.put('/:id', upload.single('thumbnail'), verifyToken, isAdmin, editCourse)
router.delete('/:id', verifyToken, isAdmin, removeCourse)
router.get('/:course_id/enrolled-users', verifyToken, isAdmin, getCourseEnrolledUsers)

export default router