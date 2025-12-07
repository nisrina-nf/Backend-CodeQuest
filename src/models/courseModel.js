import pool from "../config/db.js"

export const getAllCourses = async ({ limit, offset, sort, sortby }) => {
    const result = await pool.query(`SELECT * FROM courses ORDER BY ${sortby} ${sort} LIMIT $1 OFFSET $2`, [limit, offset])
    return result.rows
}

export const getCourseById = async (id) => {
    const result = await pool.query(`SELECT * FROM courses WHERE id = $1`, [id])
    return result.rows[0]
}

export const createCourse = async (course) => {
    const { title, category, proficiency_level = null, description = null, thumbnail_url = null, estimated_duration = null, xp_reward = 0 } = course
    const result = await pool.query(`INSERT INTO courses (title, category, proficiency_level, description, thumbnail_url, estimated_duration, xp_reward, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *`, [title, category, proficiency_level, description, thumbnail_url, estimated_duration, xp_reward])
    return result.rows[0]
}

export const updateCourse = async (id, course) => {
    const updates = []
    const values = []
    let paramCount = 1

    if(course.title !== undefined) {
        updates.push(`title = $${paramCount}`)
        values.push(course.title)
        paramCount++
    }
    if(course.category !== undefined) {
        updates.push(`category = $${paramCount}`)
        values.push(course.category)
        paramCount++
    }
    if(course.proficiency_level !== undefined) {
        updates.push(`proficiency_level = $${paramCount}`)
        values.push(course.proficiency_level)
        paramCount++
    }
    if(course.description !== undefined) {
        updates.push(`description = $${paramCount}`)
        values.push(course.description)
        paramCount++
    }
    if(course.thumbnail_url !== undefined) {
        updates.push(`thumbnail_url = $${paramCount}`)
        values.push(course.thumbnail_url)
        paramCount++
    }
    if(course.estimated_duration !== undefined) {
        updates.push(`estimated_duration = $${paramCount}`)
        values.push(course.estimated_duration)
        paramCount++
    }
    if(course.xp_reward !== undefined) {
        updates.push(`xp_reward = $${paramCount}`)
        values.push(course.xp_reward)
        paramCount++
    }

    updates.push(`updated_at = NOW()`)
    values.push(id)
    const result = await pool.query(`UPDATE courses SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`, values)
    return result.rows[0]
}

export const deleteCourse = async (id) => {
    await pool.query(`DELETE FROM courses WHERE id = $1`, [id])
}

export const countDataCourses = async () => {
    const result = await pool.query(`SELECT COUNT(*) AS count FROM courses`)
    return result
}