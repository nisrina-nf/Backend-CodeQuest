import pool from '../config/db.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import { createUser } from '../models/userModel.js'
import { validateEmail, validatePassword, validateRequiredFields } from '../helper/validation.js'
import { errorResponse, notFoundResponse, successResponse } from '../helper/common.js'
dotenv.config()

export const register = async (req, res) => {
    try {
        const { username, email, password } = req.body

        const validation = validateRequiredFields(req.body, ['username', 'email', 'password'])
        if(!validation.isValid) return errorResponse(res, validation.message, 400)
        if(!validateEmail(email)) return errorResponse(res, 'Invalid email format, e.g myname@domain.com', 400)
        if(!validatePassword(password)) return errorResponse(res, 'Invalid password format. Password must have at least 8 characters with letters and numbers', 400)

        const existingUser = await pool.query(`SELECT * FROM users WHERE email = $1 OR username = $2`, [email, username])

        if(existingUser.rows.length > 0) {
            const errors = []
            existingUser.rows.forEach(user => {
                if(user.email === email) errors.push('Email already in use')
                if(user.username === username) errors.push('Username already in use')
            })
            return res.status(409).json({
                success: false,
                message: errors.join(', ')
            })
        }
        
        const hashed = await bcrypt.hash(password, 10)
        const registered = await createUser({ username, email, password:hashed })
        
        return successResponse(res, registered, 'Register Success', 201)
    } catch (err) {
        return errorResponse(res, 'Register failed', 500, err)
    }
}

export const login = async (req, res) => {
    try {
        const { email, password } = req.body
        const validation = validateRequiredFields(req.body, ['email', 'password'])
        if(!validation.isValid) return errorResponse(res, validation.message, 400)

        const query = 'select * from users where email = $1'
        const { rows } = await pool.query(query, [email])


        if(!rows.length) {
            return notFoundResponse(res, 'User')
        }

        const valid = await bcrypt.compare(password, rows[0].password)
        if(!valid) {
            return res.status(401).json({
                success: false,
                message:'Invalid credentials'
            })
        }
        
        const token = jwt.sign({id:rows[0].id, email:rows[0].email}, process.env.JWT_SECRET, {expiresIn:'7d'})
        
        res.status(201).json({
            success: true,
            message: 'Login success',
            token: token
        })
    } catch (err) {
        return errorResponse(register, 'Login failed', 500, err)
    }
}