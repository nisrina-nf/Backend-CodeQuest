import pool from "../config/db.js"

export const getAllBadgesPaginate = async ({ limit, offset, sort, sortby }) => {
    const result = await pool.query(`SELECT * FROM badges ORDER BY ${sortby} ${sort} LIMIT $1 OFFSET $2`, [limit, offset])
    return result.rows
}

export const getBadgeById = async (id) => {
    const result = await pool.query(`SELECT * FROM badges WHERE id = $1`, [id])
    return result.rows[0]
}

export const createBadge = async (badge) => {
    const { course_id, name, description = null, icon_url = null, xp_reward = 0 } = badge
    const result = await pool.query(`INSERT INTO badges (course_id, name, description, icon_url, xp_reward, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`, [course_id, name, description, icon_url, xp_reward])
    return result.rows[0]
}

export const updateBadge = async (id, badge) => {
    const updates = []
    const values = []
    let paramCount = 1

    if(badge.course_id !== undefined) {
        updates.push(`course_id = $${paramCount}`)
        values.push(badge.course_id)
        paramCount++
    }
    if(badge.name !== undefined) {
        updates.push(`name = $${paramCount}`)
        values.push(badge.name)
        paramCount++
    }
    if(badge.description !== undefined) {
        updates.push(`description = $${paramCount}`)
        values.push(badge.description)
        paramCount++
    }
    if(badge.icon_url !== undefined) {
        updates.push(`icon_url = $${paramCount}`)
        values.push(badge.icon_url)
        paramCount++
    }
    if(badge.xp_reward !== undefined) {
        updates.push(`xp_reward = $${paramCount}`)
        values.push(badge.xp_reward)
        paramCount++
    }

    values.push(id)
    const result = await pool.query(`UPDATE badges SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`, values)
    return result.rows[0]
}

export const deleteBadge = async (id) => {
    await pool.query(`DELETE FROM badges WHERE id = $1`, [id])
}

export const countDataBadges = async () => {
    const result = await pool.query(`SELECT COUNT(*) AS count FROM badges`)
    return result
}