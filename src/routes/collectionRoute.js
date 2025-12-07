import express from 'express'
import { isAdmin, verifyToken } from '../middleware/auth.js'
import { addCollection, editCollection, getCollection, getCollections, removeCollection } from '../controllers/collectionController.js'
import upload from '../middleware/upload.js'

const router = express.Router()

router.get('/', verifyToken, isAdmin, getCollections)
router.get('/:id', verifyToken, isAdmin, getCollection)
router.post('/', upload.single('icon'), verifyToken, isAdmin, addCollection)
router.put('/:id', upload.single('icon'), verifyToken, isAdmin, editCollection)
router.delete('/:id', verifyToken, isAdmin, removeCollection)

export default router