import pool from "../config/db.js"

export const getAllQuestions = async ({ limit, offset, sort, sortby }) => {
    const result = await pool.query(`SELECT * FROM quiz_questions ORDER BY ${sortby} ${sort} LIMIT $1 OFFSET $2`, [limit, offset])
    return result.rows
}

export const getQuestionById = async (id) => {
    const result = await pool.query(`
        SELECT
            id,
            quiz_id,
            question,
            options,
            question_order,
            created_at
        FROM quiz_questions
        WHERE id = $1
    `, [id])
    return result.rows[0]
}

export const getQuestionByQuiz = async (quiz_id) => {
    const result = await pool.query(`
        SELECT
            id,
            quiz_id,
            question,
            options,
            question_order,
            created_at
        FROM quiz_questions
        WHERE quiz_id = $1
        ORDER BY question_order ASC
    `, [quiz_id])
    return result.rows
}

export const createQuestion = async (quiz_question) => {
    const { quiz_id, question, options = null, correct_answer, explanation = null, question_order } = quiz_question
    const result = await pool.query(`INSERT INTO quiz_questions (quiz_id, question, options, correct_answer, explanation, question_order, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`, [quiz_id, question, JSON.stringify(options), correct_answer, explanation, question_order])
    return result.rows[0]
}

export const updateQuestion = async (id, quiz_question) => {
    const updates = []
    const values = []
    let paramCount = 1

    if(quiz_question.quiz_id !== undefined) {
        updates.push(`quiz_id = $${paramCount}`)
        values.push(quiz_question.quiz_id)
        paramCount++
    }
    if(quiz_question.question !== undefined) {
        updates.push(`question = $${paramCount}`)
        values.push(quiz_question.question)
        paramCount++
    }
    if(quiz_question.options !== undefined) {
        updates.push(`options = $${paramCount}`)
        values.push(JSON.stringify(quiz_question.options))
        paramCount++
    }
    if(quiz_question.correct_answer !== undefined) {
        updates.push(`correct_answer = $${paramCount}`)
        values.push(quiz_question.correct_answer)
        paramCount++
    }
    if(quiz_question.explanation !== undefined) {
        updates.push(`explanation = $${paramCount}`)
        values.push(quiz_question.explanation)
        paramCount++
    }
    if(quiz_question.question_order !== undefined) {
        updates.push(`question_order = $${paramCount}`)
        values.push(quiz_question.question_order)
        paramCount++
    }

    values.push(id)
    const result = await pool.query(`UPDATE quiz_questions SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`, values)
    return result.rows[0]
}

export const deleteQuestion = async (id) => {
    await pool.query(`DELETE FROM quiz_questions WHERE id = $1`, [id])
}

export const countDataQuestions = async () => {
    const result = await pool.query(`SELECT COUNT(*) AS count FROM quiz_questions`)
    return result
}

export const checkExistingOrderIndex = async (quiz_id, question_order) => {
    const result = await pool.query(`SELECT * FROM quiz_questions WHERE quiz_id = $1 AND question_order = $2`, [quiz_id, question_order])
    return result.rows[0]
}