import express from 'express'
import { addUser, editUser, getUser, getUsers, removeUser } from '../controllers/userController.js'
import upload from '../middleware/upload.js'
import { isAdmin, verifyToken } from '../middleware/auth.js'

const router = express.Router()

router.get('/', verifyToken, isAdmin, getUsers)
router.get('/:id', verifyToken, isAdmin, getUser)
router.post('/', upload.single('avatar'), verifyToken, isAdmin, addUser)
router.put('/:id', upload.single('avatar'), verifyToken, isAdmin, editUser)
router.delete('/:id', verifyToken, isAdmin, removeUser)

export default router