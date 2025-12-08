import pool from "../config/db.js"

export const getAllBadgesPaginate = async ({ limit, offset, sort, sortby }) => {
    const result = await pool.query(`SELECT * FROM badges ORDER BY ${sortby} ${sort} LIMIT $1 OFFSET $2`, [limit, offset])
    return result.rows
}

export const getBadgeById = async (id) => {
    const result = await pool.query(`SELECT * FROM badges WHERE id = $1`, [id])
    return result.rows[0]
}

export const getBadgeByCourseId = async (course_id) => {
    const result = await pool.query(`
        SELECT * FROM badges WHERE course_id = $1    
    `, [course_id])
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

export const checkUserBadge = async (user_id, badge_id) => {
    const result = await pool.query(`
        SELECT * FROM user_badges
        WHERE user_id = $1 AND badge_id = $2    
    `, [user_id, badge_id])
    return result.rows[0]
}

export const awardBadge = async (client, user_id, badge_id) => {
    const result = await client.query(`
        INSERT INTO user_badges (user_id, badge_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, badge_id) DO NOTHING
        RETURNING *     
    `, [user_id, badge_id])
    return result.rows[0]
}

export const getUserBadges = async (user_id) => {
    const result = await pool.query(`
        SELECT
            b.*,
            ub.earned_at,
            c.title as course_title
        FROM user_badges ub
        JOIN badges b ON ub.badge_id = b.id
        JOIN courses c ON b.course_id = c.id
        WHERE ub.user_id = $1
        ORDER BY ub.earned_at DESC
    `, [user_id])

    return result.rows
}

export const getBadgeWithCourse = async (badge_id) => {
    const result = await pool.query(`
        SELECT
            b.*,
            c.title as course_title,
            c.proficiency_level
        FROM badges b 
        JOIN courses c ON b.course_id = c.id
        WHERE b.id = $1
    `, [badge_id])
    return result.rows[0]
}

export const checkAndAwardCourseBadge = async (client, user_id, course_id) => {
    const badge = await getBadgeByCourseId(course_id)
    if(!badge) return null

    const existingBadge = await checkUserBadge(user_id, badge.id)
    if(existingBadge) return null

    await awardBadge(client, user_id, badge.id)
    if(badge.xp_reward > 0) {
        await client.query(`
            UPDATE users
            SET xp = xp + $1
            WHERE id = $2    
        `, [badge.xp_reward, user_id])

        await client.query(`
            INSERT INTO xp_transactions (user_id, xp_amount, source, reference_id)
            VALUES ($1, $2, $3, $4)    
        `, [user_id, badge.xp_reward, 'badge_earned', badge.id])
    }

    return {
        id: badge.id,
        name: badge.name,
        description: badge.description,
        icon_url: badge.icon_url,
        xp_reward: badge.xp_reward
    }
}