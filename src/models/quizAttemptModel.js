import pool from "../config/db.js"

export const createQuizAttempt = async (client, attemptData) => {
    const { user_id, quiz_id, total_questions, total_correct, score, completion_time, xp_earned } = attemptData

    const result = await client.query(`
        INSERT INTO quiz_attempts
        (user_id, quiz_id, total_questions, total_correct, score, completion_time, xp_earned, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING *
    `, [user_id, quiz_id, total_questions, total_correct, score, completion_time, xp_earned])

    return result.rows[0]
}

export const saveUserAnswers = async (client, answers) => {
    const savedAnswers = []

    for(const answer of answers) {
        const result = await client.query(`
            INSERT INTO user_answers
            (user_id, question_id, user_answer, is_correct, answered_at)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING *
        `, [answer.user_id, answer.question_id, answer.user_answer, answer.is_correct])
        savedAnswers.push(result.rows[0])
    }
    return savedAnswers
}

export const getAttemptDetails = async (attempt_id, user_id) => {
    const result = await pool.query(`
        SELECT 
            qa.*,
            q.title as quiz_title,
            JSON_AGG(
                JSON_BUILD_OBJECT(
                    'id', ua.id,
                    'question_id', ua.question_id,
                    'user_answer', ua.user_answer,
                    'is_correct', ua.is_correct,
                    'answered_at', ua.answered_at,
                    'question', qq.question,
                    'correct_answer', qq.correct_answer,
                    'explanation', qq.explanation,
                    'options', qq.options
                )
            ) as answers
        FROM quiz_attempts qa
        JOIN quizzes q ON qa.quiz_id = q.id
        JOIN user_answers ua ON qa.id = (
            SELECT id FROM quiz_attempts 
            WHERE user_id = qa.user_id AND quiz_id = qa.quiz_id 
            ORDER BY created_at DESC LIMIT 1
        )
        JOIN quiz_questions qq ON ua.question_id = qq.id
        WHERE qa.id = $1 AND qa.user_id = $2
        GROUP BY qa.id, q.title
    `, [attempt_id, user_id])

    return result.rows[0]
}

export const calculateXpEarned = (score, quiz_xp_reward) => {
    if (score >= 90) return quiz_xp_reward
    else if (score >= 80) return quiz_xp_reward * 0.8
    else if (score >= 70) return quiz_xp_reward * 0.6
    else if (score >= 60) return quiz_xp_reward * 0.4
    else return 0
}

export const updateUserXp = async (client, user_id, xp_amount) => {
    await client.query(`
        UPDATE users
        SET xp = xp + $1, updated_at = NOW()
        WHERE id = $2    
    `, [xp_amount, user_id])
}

export const logXpTransaction = async (client, transactionData) => {
    const { user_id, xp_amount, source, reference_id } = transactionData

    const result = await client.query(`
        INSERT INTO xp_transactions 
        (user_id, xp_amount, source, reference_id, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
    `, [user_id, xp_amount, source, reference_id])

    return result.rows[0]
}

export const getUserBestAttempt = async (user_id, quiz_id) => {
    const result = await pool.query(`
        SELECT *
        FROM quiz_attempts 
        WHERE user_id = $1 AND quiz_id = $2
        ORDER BY score DESC, completion_time ASC
        LIMIT 1
    `, [user_id, quiz_id])

    return result.rows[0]
}