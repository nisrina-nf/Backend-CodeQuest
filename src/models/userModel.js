import pool from '../config/db.js'

export const getAllUsers = async ({limit, offset, sort, sortby}) => {
    const result = await pool.query(`
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
        ORDER BY ${sortby} ${sort}
        LIMIT $1 OFFSET $2
    `, [limit, offset])
    return result.rows
}

export const getUserById = async (id) => {
    const result = await pool.query(`
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
    `, [id])
    return result.rows[0]
}

export const createUser = async (user) => {
    const { username, email, password, avatar_url = null, xp = 0, level = 1, streak = 0, last_active = new Date() } = user
    
    const result = await pool.query(`
        INSERT INTO users (
            username, 
            email, 
            password, 
            avatar_url, 
            xp, 
            level, 
            streak, 
            last_active,
            created_at,
            updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING 
            id,
            username,
            email,
            avatar_url,
            xp,
            level,
            streak,
            last_active,
            created_at
    `, [username, email, password, avatar_url, xp, level, streak, last_active])
    
    return result.rows[0]
}

export const updateUser = async (id, user) => {
    const updates = []
    const values = []
    let paramCount = 1
    
    if (user.username !== undefined) {
        updates.push(`username = $${paramCount}`)
        values.push(user.username)
        paramCount++
    }
    if (user.email !== undefined) {
        updates.push(`email = $${paramCount}`)
        values.push(user.email)
        paramCount++
    }
    if (user.password !== undefined) {
        updates.push(`password = $${paramCount}`)
        values.push(user.password)
        paramCount++
    }
    if (user.avatar_url !== undefined) {
        updates.push(`avatar_url = $${paramCount}`)
        values.push(user.avatar_url)
        paramCount++
    }
    if (user.xp !== undefined) {
        updates.push(`xp = $${paramCount}`)
        values.push(user.xp)
        paramCount++
    }
    if (user.level !== undefined) {
        updates.push(`level = $${paramCount}`)
        values.push(user.level)
        paramCount++
    }
    if (user.streak !== undefined) {
        updates.push(`streak = $${paramCount}`)
        values.push(user.streak)
        paramCount++
    }
    if (user.last_active !== undefined) {
        updates.push(`last_active = $${paramCount}`)
        values.push(user.last_active)
        paramCount++
    }
    
    updates.push(`updated_at = NOW()`)
    values.push(id)
    
    const result = await pool.query(`
        UPDATE users 
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING 
            id,
            username,
            email,
            avatar_url,
            xp,
            level,
            streak,
            last_active,
            updated_at
    `, values)
    return result.rows[0]
}

export const deleteUser = async (id) => {
    await pool.query(`
        DELETE FROM users 
        WHERE id = $1
    `, [id])
}

export const countDataUsers = async () => {
    const result = await pool.query(`
        SELECT COUNT(*) AS count FROM users
    `)
    return result
}