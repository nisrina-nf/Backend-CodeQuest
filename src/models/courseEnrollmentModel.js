import pool from "../config/db.js"

export const createEnrollment = async (client, user_id, course_id) => {
    const result = await client.query(`
        INSERT INTO course_enrollments
        (user_id, course_id, status, started_at, percent_progress)
        VALUES ($1, $2, 'not_started', NOW(), 0)
        RETURNING id, user_id, course_id, status, started_at, percent_progress, created_at        
    `, [user_id, course_id])
    return result.rows[0]
}

export const getEnrollmentByIds = async (client, user_id, course_id) => {
    const result = await client.query(`
        SELECT * FROM course_enrollments 
        WHERE user_id = $1 AND course_id = $2    
    `, [user_id, course_id])
    return result.rows[0]
}

export const getEnrollmentDetail = async (user_id, course_id) => {
    const result = await pool.query(`
        SELECT
            ce.*,
            c.title as course_title,
            c.description as course_description,
            c.thumbnail_url as course_thumbnail,
            c.proficiency_level,
            c.estimated_duration,
            c.xp_reward
        FROM course_enrollments ce
        JOIN courses c ON ce.course_id = c.id
        WHERE ce.user_id = $1 AND ce.course_id = $2  
    `, [user_id, course_id])
    return result.rows[0]
}

export const getUserEnroll = async (user_id, status, limit, offset) => {
    let query = `
        SELECT
            ce.id as enrollment_id,
            ce.status as enrollment_status,
            ce.percent_progress,
            ce.started_at,
            ce.completed_at,
            ce.created_at as enrolled_at,
            c.id as course_id,
            c.title,
            c.description,
            c.thumbnail_url,
            c.proficiency_level,
            c.estimated_duration,
            c.xp_reward,
            COUNT(DISTINCT l.id) as total_lessons,
            COUNT(DISTINCT lp.lesson_id) as completed_lessons
        FROM course_enrollments ce
        JOIN courses c ON ce.course_id = c.id
        LEFT JOIN lessons l ON c.id = l.course_id
        LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id
            AND lp.user_id = ce.user_id
            AND lp.status = 'completed'
        WHERE ce.user_id = $1
    `
    const queryParams = [user_id]
    let paramCount = 1

    if(status&&['not_started', 'in_progress', 'completed'].includes(status)) {
        paramCount++
        query += ` AND ce.status = $${paramCount}`
        queryParams.push(status)
    }

    query += `
        GROUP BY ce.id, c.id
        ORDER BY
            CASE ce.status
                WHEN 'in_progress' THEN 1
                WHEN 'not_started' THEN 2
                WHEN 'completed' THEN 3
            END,
            ce.updated_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `

    queryParams.push(limit, offset)
    const result = await pool.query(query, queryParams)
    return result.rows
}

export const countUserEnrollments = async (user_id, status) => {
    let query = `SELECT COUNT(*) FROM course_enrollments WHERE user_id = $1`
    const queryParams = [user_id]

    if(status) {
        query += ` AND status = $2`
        queryParams.push(status)
    }

    const result = await pool.query(query, queryParams)
    return parseInt(result.rows[0].count)
}

export const deleteEnrollment = async (client, user_id, course_id) => {
    await client.query(`
        DELETE FROM course_enrollments
        WHERE user_id = $1 AND course_id = $2
    `, [user_id, course_id])
}

export const getCourseLessonsWithProgress = async (user_id, course_id) => {
    const result = await pool.query(`
        SELECT
            l.id,
            l.title,
            l.order_index,
            l.videos,
            l.overviews,
            l.estimated_duration,
            COALESCE(lp.status, 'not_started') as status,
            lp.started_at as lesson_started,
            lp.completed_at as lesson_completed
        FROM lessons l
        LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id
            AND lp.user_id = $1
        WHERE l.course_id = $2
        ORDER BY l.order_index
    `, [user_id, course_id])
    return result.rows
}

export const getCourseXpSummary = async (user_id, course_id) => {
    const result = await pool.query(`
        SELECT 
            COALESCE(SUM(CASE 
                WHEN xt.source = 'lesson_completion' THEN xt.xp_amount
                ELSE 0
            END), 0) as lesson_xp,
            COALESCE(SUM(CASE 
                WHEN xt.source = 'course_completion' THEN xt.xp_amount
                ELSE 0 
            END), 0) as completion_xp
        FROM xp_transactions xt
        WHERE xt.user_id = $1
            AND (
                xt.reference_id::text IN (
                    SELECT id::text FROM lessons WHERE course_id = $2
                )
                OR xt.reference_id = $2::integer
            )
    `, [user_id, course_id])
    return result.rows[0] || { lesson_xp: 0, completion_xp: 0 }
}

export const getEnrolledUsers = async (course_id, status, limit, offset) => {
    let query = `
        SELECT 
            u.id,
            u.username,
            u.email,
            u.avatar_url,
            u.xp,
            u.level,
            ce.status,
            ce.percent_progress,
            ce.started_at,
            ce.completed_at,
            ce.created_at as enrolled_at,
            COUNT(DISTINCT lp.lesson_id) as lessons_completed,
            (SELECT COUNT(*) FROM lessons WHERE course_id = $1) as total_lessons
        FROM course_enrollments ce
        JOIN users u ON ce.user_id = u.id
        LEFT JOIN lesson_progress lp ON u.id = lp.user_id 
            AND lp.status = 'completed'
            AND lp.lesson_id IN (SELECT id FROM lessons WHERE course_id = $1)
        WHERE ce.course_id = $1
    `
    
    const queryParams = [course_id]
    let paramCount = 1
    
    if (status && ['not_started', 'in_progress', 'completed'].includes(status)) {
        paramCount++
        query += ` AND ce.status = $${paramCount}`
        queryParams.push(status)
    }
    
    query += `
        GROUP BY u.id, ce.id
        ORDER BY ce.updated_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `
    
    queryParams.push(limit, offset)
    const result = await pool.query(query, queryParams)
    return result.rows
}

export const countEnrolledUsers = async (course_id, status) => {
    let query = `SELECT COUNT(*) FROM course_enrollments WHERE course_id = $1`
    const queryParams = [course_id]
    
    if (status) {
        query += ` AND status = $2`
        queryParams.push(status)
    }
    
    const result = await pool.query(query, queryParams)
    return parseInt(result.rows[0].count)
}