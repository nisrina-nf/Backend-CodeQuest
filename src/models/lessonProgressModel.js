import pool from "../config/db.js"

export const getLessonProgress = async (user_id, lesson_id) => {
    const result = await pool.query(`
        SELECT * FROM lesson_progress
        WHERE user_id = $1 AND lesson_id = $2    
    `, [user_id, lesson_id])
    return result.rows[0]
}

export const completeLesson = async (client, user_id, lesson_id) => {
    const result = await client.query(`
        INSERT INTO lesson_progress 
        (user_id, lesson_id, status, started_at, completed_at, updated_at)
        VALUES ($1, $2, 'completed', NOW(), NOW(), NOW())
        ON CONFLICT (user_id, lesson_id) 
        DO UPDATE SET 
            status = 'completed',
            completed_at = NOW(),
            updated_at = NOW()
        RETURNING *
    `, [user_id, lesson_id])
    return result.rows[0]
}

export const getCourseProgressStats = async (client, user_id, course_id) => {
    const result = await client.query(`
        SELECT 
            COUNT(l.id) as total_lessons,
            COUNT(lp.lesson_id) as completed_lessons
        FROM lessons l
        LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id 
            AND lp.user_id = $1 
            AND lp.status = 'completed'
        WHERE l.course_id = $2
    `, [user_id, course_id])
    return result.rows[0]
}

export const updateCourseEnrollmentProgress = async (client, user_id, course_id, progress_percent) => {
    const result = await client.query(`
        UPDATE course_enrollments 
        SET 
            percent_progress = $1::numeric,
            status = CASE 
                WHEN $1::numeric >= 100 THEN 'completed'
                WHEN $1::numeric > 0 THEN 'in_progress'
                ELSE 'not_started'
            END,
            completed_at = CASE 
                WHEN $1::numeric >= 100 THEN NOW()
                ELSE completed_at 
            END,
            updated_at = NOW()
        WHERE user_id = $2 AND course_id = $3
        RETURNING *
    `, [progress_percent, user_id, course_id])
    
    return result.rows[0]
}

export const checkCourseEnrollment = async (user_id, course_id) => {
    const result = await pool.query(`
        SELECT * FROM course_enrollments 
        WHERE user_id = $1 AND course_id = $2
    `, [user_id, course_id])
    return result.rows[0]
}

export const getNextLesson = async (course_id, current_order) => {
    const result = await pool.query(`
        SELECT * FROM lessons 
        WHERE course_id = $1 AND order_index > $2
        ORDER BY order_index ASC
        LIMIT 1
    `, [course_id, current_order])
    return result.rows[0]
}

export const areAllLessonsCompleted = async (client, user_id, course_id) => {
    const result = await client.query(`
        SELECT 
            (SELECT COUNT(*) FROM lessons WHERE course_id = $2) as total,
            COUNT(lp.lesson_id) as completed
        FROM lesson_progress lp
        JOIN lessons l ON lp.lesson_id = l.id
        WHERE lp.user_id = $1 
            AND l.course_id = $2 
            AND lp.status = 'completed'
    `, [user_id, course_id])

    const { total, completed } = result.rows[0]
    return total === completed
}

export const awardXpForCourse = async (client, user_id, course_id, xp_amount) => {
    await client.query(`
        UPDATE users SET xp = xp + $1 WHERE id = $2
    `, [xp_amount, user_id])

    const xpResult = await client.query(`
        INSERT INTO xp_transactions 
        (user_id, xp_amount, source, reference_id)
        VALUES ($1, $2, 'course_completion', $3)
        RETURNING *
    `, [user_id, xp_amount, course_id])

    return xpResult.rows[0]
}