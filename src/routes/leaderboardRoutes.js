import express from 'express'
import { getLeaderboard, getLeaderboardStats, getTopLeaderboard } from '../controllers/leaderboardController.js'

const router = express.Router()

router.get('/', getLeaderboard)
router.get('/top', getTopLeaderboard)
router.get('/stats', getLeaderboardStats)

export default router