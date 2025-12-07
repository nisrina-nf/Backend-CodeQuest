import express from 'express'
import { isAdmin, verifyToken } from '../middleware/auth.js'
import { addBadge, editBadge, getBadge, getBadges, removeBadge } from '../controllers/badgeController.js'
import upload from '../middleware/upload.js'

const router = express.Router()

router.get('/', verifyToken, isAdmin, getBadges)
router.get('/:id', verifyToken, isAdmin, getBadge)
router.post('/', verifyToken, isAdmin, upload.single('icon'), addBadge)
router.put('/:id', verifyToken, isAdmin, upload.single('icon'), editBadge)
router.delete('/:id', verifyToken, isAdmin, removeBadge)

export default router