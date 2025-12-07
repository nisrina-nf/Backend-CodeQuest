import pool from '../config/db.js'

export const getAllQuizzes = async ({ limit, offset, sort, sortby }) => {
    const result = await pool.query(`
        SELECT 
            q.*, 
            COUNT(qq.id) as total_questions
        FROM quizzes q
        LEFT JOIN quiz_questions qq ON q.id = qq.quiz_id
        GROUP BY q.id 
        ORDER BY ${sortby} ${sort} 
        LIMIT $1 OFFSET $2
    `, [limit, offset])
    return result.rows
}

export const getQuizById = async (id) => {
    const result = await pool.query(`
        SELECT 
            q.*, 
            COUNT(qq.id) as total_questions 
        FROM quizzes q 
        LEFT JOIN quiz_questions qq ON q.id = qq.quiz_id 
        WHERE q.id = $1 
        GROUP BY q.id
    `, [id])
    return result.rows[0]
}

export const getQuizWithQuestions = async (quiz_id) => {
    const result = await pool.query(`
        SELECT 
            q.*,
            COUNT(qq.id) as total_questions
        FROM quizzes q
        LEFT JOIN quiz_questions qq ON q.id = qq.quiz_id
        WHERE q.id = $1
        GROUP BY q.id
    `, [quiz_id])
    return result.rows[0]
}

export const getQuizQuestions = async (quiz_id) => {
    const result = await pool.query(`
        SELECT 
            id,
            question,
            options,
            question_order,
            explanation
        FROM quiz_questions 
        WHERE quiz_id = $1
        ORDER BY question_order
    `, [quiz_id])
    return result.rows
}

export const getQuizCorrectAnswers = async (quiz_id) => {
    const result = await pool.query(`
        SELECT id, correct_answer 
        FROM quiz_questions 
        WHERE quiz_id = $1
    `, [quiz_id])
    return result.rows
}

export const createQuiz = async (quiz) => {
    const { collection_id, title, thumbnail_url = null, estimated_duration = null, xp_reward = 0, quiz_order } = quiz
    const result = await pool.query(`INSERT INTO quizzes (collection_id, title, thumbnail_url, estimated_duration, xp_reward, quiz_order, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *`, [collection_id, title, thumbnail_url, estimated_duration, xp_reward, quiz_order])
    return result.rows[0]
}

export const updateQuiz = async (id, quiz) => {
    const updates = []
    const values = []
    let paramCount = 1

    if(quiz.collection_id !== undefined) {
        updates.push(`collection_id = $${paramCount}`)
        values.push(quiz.collection_id)
        paramCount++
    }
    if(quiz.title !== undefined) {
        updates.push(`title = $${paramCount}`)
        values.push(quiz.title)
        paramCount++
    }
    if(quiz.thumbnail_url !== undefined) {
        updates.push(`thumbnail_url = $${paramCount}`)
        values.push(quiz.thumbnail_url)
        paramCount++
    }
    if(quiz.estimated_duration !== undefined) {
        updates.push(`estimated_duration = $${paramCount}`)
        values.push(quiz.estimated_duration)
        paramCount++
    }
    if(quiz.xp_reward !== undefined) {
        updates.push(`xp_reward = $${paramCount}`)
        values.push(quiz.xp_reward)
        paramCount++
    }
    if(quiz.quiz_order !== undefined) {
        updates.push(`quiz_order = $${paramCount}`)
        values.push(quiz.quiz_order)
        paramCount++
    }

    updates.push(`updated_at = NOW()`)
    values.push(id)
    const result = await pool.query(`UPDATE quizzes SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`, values)
    return result.rows[0]
}

export const deleteQuiz = async (id) => {
    await pool.query(`DELETE FROM quizzes WHERE id = $1`, [id])
}

export const countDataQuizzes = async () => {
    const result = await pool.query(`SELECT COUNT(*) AS count FROM quizzes`)
    return result
}

export const checkExistingQuizOrder = async (collection_id, quiz_order) => {
    const result = await pool.query(`SELECT * FROM quizzes WHERE collection_id = $1 AND quiz_order = $2`, [collection_id, quiz_order])
    return result.rows[0]
}

export const getUserQuizAttempt = async (user_id, quiz_id) => {
    const result = await pool.query(`
        SELECT * FROM quiz_attempts 
        WHERE user_id = $1 AND quiz_id = $2
        ORDER BY created_at DESC
        LIMIT 1
    `, [user_id, quiz_id])
    return result.rows[0]
}