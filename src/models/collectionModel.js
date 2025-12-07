import pool from "../config/db.js"

export const getAllCollections = async ({ limit, offset, sort, sortby }) => {
    const result = await pool.query(`SELECT * FROM quiz_collections ORDER BY ${sortby} ${sort} LIMIT $1 OFFSET $2`, [limit, offset])
    return result.rows
}

export const getCollectionById = async (id) => {
    const result = await pool.query(`SELECT * FROM quiz_collections WHERE id = $1`, [id])
    return result.rows[0]
}

export const createCollection = async (collection) => {
    const { title, category, icon_url = null, difficulty = null } = collection
    const result = await pool.query(`INSERT INTO quiz_collections (title, category, icon_url, difficulty, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *`, [title, category, icon_url, difficulty])
    return result.rows[0]
}

export const updateCollection = async (id, collection) => {
    const updates = []
    const values = []
    let paramCount = 1

    if(collection.title !== undefined) {
        updates.push(`title = $${paramCount}`)
        values.push(collection.title)
        paramCount++
    }
    if(collection.category !== undefined) {
        updates.push(`category = $${paramCount}`)
        values.push(collection.category)
        paramCount++
    }
    if(collection.icon_url !== undefined) {
        updates.push(`icon_url = $${paramCount}`)
        values.push(collection.icon_url)
        paramCount++
    }
    if(collection.difficulty !== undefined) {
        updates.push(`difficulty = $${paramCount}`)
        values.push(collection.difficulty)
        paramCount++
    }

    updates.push(`updated_at = NOW()`)
    values.push(id)
    const result = await pool.query(`UPDATE quiz_collections SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`, values)
    return result.rows[0]
}

export const deleteCollection = async (id) => {
    await pool.query(`DELETE FROM quiz_collections WHERE id = $1`, [id])
}

export const countDataCollections = async () => {
    const result = await pool.query(`SELECT COUNT(*) AS count FROM quiz_collections`)
    return result
}