import pool from "../config/db.js"
import { errorResponse, successResponse } from "../helper/common.js"
import { getGlobalLeaderboard, getLeaderboardAroundUser, getLeaderboardStat, getTopUsers, getTotalUsersCount, getUserLeaderboardPosition } from "../models/leaderboardModel.js"

export const getLeaderboard = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query
        const offset = (page - 1) * limit
        
        const leaderboardData = await getGlobalLeaderboard(limit, offset)
        const totalItems = await getTotalUsersCount()
        const totalPages = Math.ceil(totalItems / limit)
        
        let currentUserPosition = null
        if (req.user) {
            const position = await getUserLeaderboardPosition(req.user.id)
            if (position) {
                currentUserPosition = {
                    rank: position.rank,
                    position: position.position
                }
            }
        }
        
        const topUsers = await getTopUsers(3)
        const stats = await getLeaderboardStat()

        const formattedLeaderboard = leaderboardData.map(user => ({
            rank: user.rank,
            user: {
                id: user.id,
                username: user.username,
                avatar_url: user.avatar_url,
                xp: user.xp,
                level: user.level,
                streak: user.streak,
                joined_at: user.created_at
            },
            is_current_user: req.user ? user.id === req.user.id : false
        }))
        
        const responseData = {
            leaderboard: formattedLeaderboard,
            podium: topUsers.map((user, index) => ({
                position: index + 1,
                user: {
                    id: user.id,
                    username: user.username,
                    avatar_url: user.avatar_url,
                    xp: user.xp,
                    level: user.level
                }
            })),
            statistics: {
                total_users: parseInt(stats.total_users),
                average_xp: parseInt(stats.average_xp),
                max_xp: parseInt(stats.max_xp),
                average_level: parseFloat(stats.average_level),
                max_level: parseInt(stats.max_level),
                active_users: parseInt(stats.active_users),
                average_streak: parseFloat(stats.average_streak)
            },
            current_user_position: currentUserPosition,
            pagination: {
                current_page: parseInt(page),
                total_pages: totalPages,
                total_items: totalItems,
                items_per_page: parseInt(limit)
            }
        }
        
        return successResponse(res, responseData, 'Leaderboard retrieved successfully')
        
    } catch (err) {
        return errorResponse(res, 'Failed to get leaderboard', 500, err)
    }
}

export const getMyLeaderboardPosition = async (req, res) => {
    try {
        const user_id = req.user.id
        const neighbors = parseInt(req.query.neighbors) || 5
        
        const position = await getUserLeaderboardPosition(user_id)
        if (!position) {
            return successResponse(res, {
                message: 'User not found in leaderboard'
            }, 'Leaderboard position')
        }
        
        const leaderboardAround = await getLeaderboardAroundUser(user_id, neighbors)
        
        const userResult = await pool.query(`
            SELECT 
                u.id,
                u.username,
                u.avatar_url,
                u.xp,
                u.level,
                u.streak,
                COUNT(DISTINCT ce.course_id) as courses_enrolled,
                COUNT(DISTINCT CASE WHEN ce.status = 'completed' THEN ce.course_id END) as courses_completed,
                COUNT(DISTINCT qa.quiz_id) as quizzes_attempted,
                COUNT(DISTINCT ub.badge_id) as badges_earned
            FROM users u
            LEFT JOIN course_enrollments ce ON u.id = ce.user_id
            LEFT JOIN quiz_attempts qa ON u.id = qa.user_id
            LEFT JOIN user_badges ub ON u.id = ub.user_id
            WHERE u.id = $1
            GROUP BY u.id
        `, [user_id])
        
        const user = userResult.rows[0]
        
        const nextLevelResult = await pool.query(`
            SELECT * FROM level_configurations 
            WHERE level = $1 OR level = $2
            ORDER BY level
        `, [user.level, user.level + 1])
        
        const currentLevel = nextLevelResult.rows.find(r => r.level === user.level)
        const nextLevel = nextLevelResult.rows.find(r => r.level === user.level + 1)
        
        const xpProgress = nextLevel ? {
            current_xp: user.xp,
            next_level_xp: nextLevel.xp_required,
            xp_needed: nextLevel.xp_required - user.xp,
            progress_percentage: Math.min(100, Math.round(
                (user.xp - currentLevel.xp_required) / 
                (nextLevel.xp_required - currentLevel.xp_required) * 100
            ))
        } : null
        
        const responseData = {
            position: {
                rank: position.rank,
                position: position.position,
                total_users: await getTotalUsersCount(),
                top_percentage: Math.round((position.position / (await getTotalUsersCount())) * 100)
            },
            user: {
                ...user,
                xp_progress: xpProgress
            },
            neighbors: leaderboardAround.map(entry => ({
                rank: entry.rank,
                user: {
                    id: entry.id,
                    username: entry.username,
                    avatar_url: entry.avatar_url,
                    xp: entry.xp,
                    level: entry.level,
                    streak: entry.streak
                },
                xp_difference: entry.xp - user.xp,
                is_current_user: entry.is_current_user
            }))
        }
        
        return successResponse(res, responseData, 'Leaderboard position retrieved successfully')
        
    } catch (err) {
        return errorResponse(res, 'Failed to get leaderboard position', 500, err)
    }
}

export const getTopLeaderboard = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10
        const topUsers = await getTopUsers(limit)
        
        const formattedTopUsers = topUsers.map(user => ({
            rank: user.rank,
            user: {
                id: user.id,
                username: user.username,
                avatar_url: user.avatar_url,
                xp: user.xp,
                level: user.level,
                streak: user.streak
            }
        }))
        
        return successResponse(res, {
            top_users: formattedTopUsers
        }, 'Top users retrieved successfully')
        
    } catch (err) {
        return errorResponse(res, 'Failed to get top users', 500, err)
    }
}

export const getLeaderboardStats = async (req, res) => {
    try {
        const stats = await getLeaderboardStat()
        
        const topUsers = await getTopUsers(3)
        
        const recentActive = await pool.query(`
            SELECT COUNT(DISTINCT user_id) as recent_active
            FROM xp_transactions
            WHERE created_at >= NOW() - INTERVAL '7 days'
        `)
        
        const responseData = {
            overall: {
                total_users: parseInt(stats.total_users),
                average_xp: parseInt(stats.average_xp),
                max_xp: parseInt(stats.max_xp),
                average_level: parseFloat(stats.average_level),
                max_level: parseInt(stats.max_level),
                active_users: parseInt(stats.active_users),
                average_streak: parseFloat(stats.average_streak),
                recent_active_users: parseInt(recentActive.rows[0].recent_active)
            },
            podium: topUsers.map((user, index) => ({
                position: index + 1,
                user: {
                    username: user.username,
                    xp: user.xp,
                    level: user.level
                }
            }))
        }
        
        return successResponse(res, responseData, 'Leaderboard statistics retrieved successfully')
        
    } catch (err) {
        return errorResponse(res, 'Failed to get leaderboard statistics', 500, err)
    }
}