import bcrypt from 'bcryptjs'
import pool from "../config/db.js"
import { getAllUsers, getUserById, createUser, updateUser, deleteUser, countDataUsers } from '../models/userModel.js'
import { conflictResponse, errorResponse, notFoundResponse, successResponse, withPagination } from '../helper/common.js'
import { validateEmail, validatePassword, validateRequiredFields } from '../helper/validation.js'
import { deleteFromCloudinary, extractPublicId, uploadToCloudinary } from '../helper/upload.js'

export const getUsers = async (req, res) => {
    try {
        const page = Number(req.query.page) || 1
        const limit = Number(req.query.limit) || 10
        const sortby = req.query.sortby || 'id'
        const sort = req.query.sort || 'ASC'
        const offset = (page - 1) * limit

        const users = await getAllUsers({limit, offset, sort, sortby})
        const { rows: [{ count }] } = await countDataUsers()
        const totalData = parseInt(count)
        const totalPage = Math.ceil(totalData / limit)

        const pagination = {
            currentPage: page,
            limit: limit,
            totalData: totalData,
            totalPage: totalPage
        }

        const responseData = withPagination({ users }, pagination)
        return successResponse(res, responseData, 'Users retrieved successfully')
    } catch (err) {
        return errorResponse(res, 'Error retrieving users', 500, err)
    }
}

export const getUser = async (req, res) => {
    try {
        const { id } = req.params
        const user = await getUserById(id)
        if(!user) {
            return notFoundResponse(res, 'User')
        } 
        return successResponse(res, user, 'User retrieved successfully')
    } catch (err) {
        return errorResponse(res, 'Error retrieving user', 500, err)
    }
}

export const addUser = async (req, res) => {
    try {
        const { username, email, password } = req.body

        const validation = validateRequiredFields(req.body, ['username', 'email', 'password'])
        if(!validation.isValid) return errorResponse(res, validation.message, 400)
        if(!validateEmail(email)) return errorResponse(res, 'Invalid email format, e.g myname@domain.com', 400)
        if(!validatePassword(password)) return errorResponse(res, 'Invalid password format. Password must have at least 8 characters with letters and numbers', 500)
        
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

        let avatar_url = null
        if(req.file) {
            try {
                const uploadResult = await uploadToCloudinary(req.file.buffer, 'codequest/avatars')
                avatar_url = uploadResult.secure_url
            } catch (uploadError) {
                return errorResponse(res, 'Error uploading avatar', 500, uploadError)
            }
        }

        const hashed = await bcrypt.hash(password, 10)
        const newUser = await createUser({ username, email, password:hashed, avatar_url })

        return successResponse(res, newUser, 'User created successfully', 201)
    } catch (err) {
        if(err.code === 'P2002') {
            return conflictResponse(res, 'Username or email already exists')
        }
        return errorResponse(res, 'Error creating user', 500, err)
    }
}

export const editUser = async (req, res) => {
    try {
        const { id } = req.params
        const { username, email } = req.body

        const existingUser = await getUserById(id)
        if(!existingUser) {
            return notFoundResponse(res, 'User')
        }

        const existingEmailName = await pool.query(`SELECT * FROM users WHERE email = $1 OR username = $2`, [email, username])

        if(existingEmailName.rows.length > 0) {
            const errors = []
            existingEmailName.rows.forEach(user => {
                if(user.email === email) errors.push('Email already in use')
                if(user.username === username) errors.push('Username already in use')
            })
            return res.status(409).json({
                success: false,
                message: errors.join(', ')
            })
        }

        const updateData = {}
        if(username !== undefined) updateData.username = username
        if(email !== undefined) {
            if(!validateEmail(email)) {
                return errorResponse(res, 'Invalid email format', 400)
            }
            updateData.email = email
        }
        
        if(req.file) {
            try {
                const uploadResult = await uploadToCloudinary(req.file.buffer, 'codequest/avatars')
                updateData.avatar_url = uploadResult.secure_url
                if(existingUser.avatar_url) {
                    const publicId = extractPublicId(existingUser.avatar_url)
                    await deleteFromCloudinary(publicId)
                }
            } catch (uploadError) {
                return errorResponse(res, 'Error uploading avatar', 500, uploadError)
            }
        }

        const updatedUser = await updateUser(id, updateData)
        
        return successResponse(res, updatedUser, 'User updated successfully')
    } catch (err) {
        if(err.code === 'P2002') {
            return conflictResponse(res, 'Username or email already exists')
        }
        return errorResponse(res, 'Error updating user', 500, err)
    }
}

export const removeUser = async (req, res) => {
    try {
        const { id } = req.params

        const existingUser = await getUserById(id)
        if(!existingUser) return notFoundResponse(res, 'User')

        if(existingUser.avatar_url) {
            const publicId = extractPublicId(existingUser.avatar_url)
            await deleteFromCloudinary(publicId)
        }

        await deleteUser(id)
        return successResponse(res, null, 'User deleted successfully')
    } catch (err) {
        return errorResponse(res, 'Error deleting user', 500, err)
    }
}

export const editProfile = async (req, res) => {
    const client = await pool.connect()

    try {
        await client.query('BEGIN')
        
        const { username, email } = req.body || {}
        const user_id = req.user.id

        const currentUser = await client.query(`
            SELECT id, username, email, avatar_url, xp, level, streak, created_at, updated_at 
            FROM users WHERE id = $1 FOR UPDATE
        `, [user_id])

        if(currentUser.rows.length === 0) {
            await client.query('ROLLBACK')
            return notFoundResponse(res, 'User')
        }

        const existingUser = currentUser.rows[0]

        if(username || email) {
            const duplicateCheck = await client.query(`SELECT * FROM users WHERE (email = $1 OR username = $2) AND id != $3`, [email || existingUser.email, username || existingUser.username, user_id])
            if(duplicateCheck.rows.length>0) {
                const errors = []
                duplicateCheck.rows.forEach(user => {
                    if(user.email===email) {
                        errors.push('Email already in use')
                    }
                    if(user.username===username) {
                        errors.push('Username already in use')
                    }
                })
                if(errors.length > 0) {
                    await client.query('ROLLBACK')
                    return res.status(409).json({
                        success:false,
                        message: errors.join(', ')
                    })
                }
            }
        }

        const updateFields = []
        const updateValues = []
        let valueCount = 1

        if(username !== undefined && username !== null && username !== existingUser.username) {
            updateFields.push(`username = $${valueCount}`)
            updateValues.push(username)
            valueCount++
        }
        if(email !== undefined && email !== null && email !== existingUser.email) {
            if(!validateEmail(email)) {
                await client.query('ROLLBACK')
                return errorResponse(res, 'Invalid email format', 400)
            }
            updateFields.push(`email = $${valueCount}`)
            updateValues.push(email)
            valueCount++
        }

        let newAvatarUrl = null
        if(req.file) {
            try {
                const uploadResult = await uploadToCloudinary(req.file.buffer, 'codequest/avatars')
                newAvatarUrl = uploadResult.secure_url
                if(existingUser.avatar_url) {
                    const publicId = extractPublicId(existingUser.avatar_url)
                    await deleteFromCloudinary(publicId)
                }
                updateFields.push(`avatar_url = $${valueCount}`)
                updateValues.push(newAvatarUrl)
                valueCount++
            } catch (uploadError) {
                await client.query('ROLLBACK')
                return errorResponse(res, 'Error uploading avatar', 500, uploadError)
            }
        }
        let updatedProfile = existingUser

        if(updateFields.length>0) {
            updateFields.push(`updated_at = $${valueCount}`)
            updateValues.push(new Date())
            valueCount++

            updateValues.push(user_id)
            const result = await client.query(`UPDATE users SET ${updateFields.join(', ')} WHERE id = $${valueCount} RETURNING id, username, email, avatar_url, xp, level, streak, created_at, updated_at`, updateValues)
            updatedProfile = result.rows[0]
        }
        await client.query('COMMIT')
        return successResponse(res, updatedProfile, 'Profile updated successfully')
    } catch (err) {
        await client.query('ROLLBACK')
        return errorResponse(res, 'Edit profile failed', 500, err)
    } finally {
        client.release()
    }
}

export const getMyStats = async (req, res) => {
    try {
        const user_id = req.user.id

        const userResult = await pool.query(`
            SELECT
                id,
                username,
                email,
                avatar_url,
                xp,
                level, 
                streak,
                last_active,
                created_at
            FROM users
            WHERE id = $1    
        `, [user_id])

        const user = userResult.rows[0]

        const responseData = {
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                avatarUrl: user.avatar_url,
                joinedSince: user.created_at
            },
            stats: {
                xp: user.xp,
                level: user.level,
                streak: user.streak,
                lastActive: user.last_active
            }
        }
        return successResponse(res, responseData, 'User stats retrieved successfully')
    } catch (err) {
        return errorResponse(res, 'Failed to retrieve user stats', 500, err)
    }
}