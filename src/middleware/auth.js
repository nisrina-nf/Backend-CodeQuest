import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import pool from '../config/db.js'
dotenv.config()

const ADMIN_DOMAINS = process.env.ADMIN_DOMAINS 
    ? process.env.ADMIN_DOMAINS.split(',').map(domain => domain.trim())
    : []

export const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization']
        const token = authHeader && authHeader.split(' ')[1]
        if(!token) {
            return res.status(403).json({
                success: false,
                message:'Access token required'
            })
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        const userResult = await pool.query(`
            SELECT id, username, email, avatar_url, xp, level, streak 
            FROM users WHERE id = $1
        `, [decoded.id])

        if(userResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            })
        }
        const user = userResult.rows[0]

        const isAdmin = ADMIN_DOMAINS.length > 0 && ADMIN_DOMAINS.some(domain =>
            user.email.toLowerCase().endsWith(domain.toLowerCase())
        )

        req.user = {
            ...user,
            role: isAdmin? 'admin' : 'user'
        }
        next()
    } catch (err) {
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            })
        }
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired'
            })
        }
        console.error('Auth error:', err);
        return res.status(500).json({
            success: false,
            message: 'Authentication failed'
        })
    }
}

export const isAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'User not authenticated'
        })
    }
    
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Admin only.'
        })
    }
    
    next()
}