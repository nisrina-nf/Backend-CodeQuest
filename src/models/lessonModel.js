import pool from "../config/db.js"

export const getAllLessons = async ({ limit, offset, sort, sortby }) => {
    const result = await pool.query(`SELECT * FROM lessons ORDER BY ${sortby} ${sort} LIMIT $1 OFFSET $2`, [limit, offset])
    return result.rows
}

export const getLessonById = async (id) => {
    const result = await pool.query(`SELECT * FROM lessons WHERE id = $1`, [id])
    return result.rows[0]
}

export const getLessonWithCourse = async (lesson_id) => {
    const result = await pool.query(`
        SELECT 
            l.*,
            c.title as course_title,
            c.xp_reward as course_xp_reward,
            c.proficiency_level
        FROM lessons l
        JOIN courses c ON l.course_id = c.id
        WHERE l.id = $1
    `, [lesson_id])
    return result.rows[0]
}

export const getLessonOrder = async (lesson_id) => {
    const result = await pool.query(`
        SELECT order_index, course_id FROM lessons WHERE id = $1    
    `, [lesson_id])
    return result.rows[0]
}

export const getTotalLessonsInCourse = async (course_id) => {
    const result = await pool.query(`
        SELECT COUNT(*) as total FROM lessons WHERE course_id = $1
    `, [course_id])
    return parseInt(result.rows[0].total)
}

export const createLesson = async (lesson) => {
    const { course_id, title, order_index, videos, overviews = null, estimated_duration = null } = lesson
    const result = await pool.query(`INSERT INTO lessons (course_id, title, order_index, videos, overviews, estimated_duration, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *`, [course_id, title, order_index, videos, overviews, estimated_duration])
    return result.rows[0]
}

export const updateLesson = async (id, lesson) => {
    const updates = []
    const values = []
    let paramCount = 1

    if(lesson.course_id !== undefined) {
        updates.push(`course_id = $${paramCount}`)
        values.push(lesson.course_id)
        paramCount++
    }
    if(lesson.title !== undefined) {
        updates.push(`title = $${paramCount}`)
        values.push(lesson.title)
        paramCount++
    }
    if(lesson.order_index !== undefined) {
        updates.push(`order_index = $${paramCount}`)
        values.push(lesson.order_index)
        paramCount++
    }
    if(lesson.videos !== undefined) {
        updates.push(`videos = $${paramCount}`)
        values.push(lesson.videos)
        paramCount++
    }
    if(lesson.overviews !== undefined) {
        updates.push(`overviews = $${paramCount}`)
        values.push(lesson.overviews)
        paramCount++
    }
    if(lesson.estimated_duration !== undefined) {
        updates.push(`estimated_duration = $${paramCount}`)
        values.push(lesson.estimated_duration)
        paramCount++
    }

    updates.push(`updated_at = NOW()`)
    values.push(id)
    const result = await pool.query(`UPDATE lessons SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`, values)
    return result.rows[0]
}

export const deleteLesson = async (id) => {
    await pool.query(`DELETE FROM lessons WHERE id = $1`, [id])
}

export const countDataLessons = async () => {
    const result = await pool.query(`SELECT COUNT(*) AS count FROM lessons`)
    return result
}

export const checkExistingOrderIndex = async (course_id, order_index) => {
    const result = await pool.query(`SELECT * FROM lessons WHERE course_id = $1 AND order_index = $2`, [course_id, order_index])
    return result.rows[0]
}