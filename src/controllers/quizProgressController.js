import pool from "../config/db.js"
import { errorResponse, notFoundResponse, successResponse } from "../helper/common.js"
import { calculateXpEarned, createQuizAttempt, getAttemptDetails, getUserBestAttempt, logXpTransaction, saveUserAnswers, updateUserXp } from "../models/quizAttemptModel.js"
import { getQuizCorrectAnswers, getQuizQuestions, getQuizWithQuestions, getUserQuizAttempt } from "../models/quizModel.js"
import { updateStreak } from "../models/streakModel.js"

export const startQuiz = async (req, res) => {
    try {
        const user_id = req.user.id
        const quiz_id = req.params.quiz_id

        const quiz = await getQuizWithQuestions(quiz_id)
        if(!quiz) return notFoundResponse(res, 'Quiz')
        
        const questions = await getQuizQuestions(quiz_id)
        const previousAttempt = await getUserQuizAttempt(user_id, quiz_id)

        const responseData = {
            quiz: {
                id: quiz.id,
                title: quiz.title,
                description: quiz.description,
                total_questions: quiz.total_questions || questions.length,
                estimated_duration: quiz.estimated_duration,
                xp_reward: quiz.xp_reward
            },
            questions: questions.map(q => ({
                id: q.id,
                question: q.question,
                options: q.options,
                question_order: q.question_order
            })),
            previousAttempt: previousAttempt ? {
                best_score: previousAttempt.score,
                attempts_count: await getAttemptCount(user_id, quiz_id),
                last_attempt: previousAttempt.created_at
            } : null,
            instructions: {
                passing_score: 60,
                xp_info: `Earn up to ${quiz.xp_reward} XP based on your score`
            }
        }

        return successResponse(res, responseData, 'Quiz started successfully')

    } catch (err) {
        return errorResponse(res, 'Failed to start quiz', 500, err)
    }
}

export const submitQuiz = async (req, res) => {
    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        const user_id = req.user.id
        const quiz_id = req.params.quiz_id
        const { answers, completion_time } = req.body

        if(!answers || !Array.isArray(answers)) {
            await client.query('ROLLBACK')
            return errorResponse(res, 'Answers array is required', 400)
        }

        const quiz = await getQuizWithQuestions(quiz_id)
        if(!quiz) {
            await client.query('ROLLBACK')
            return notFoundResponse(res, 'Quiz')
        }

        const correctAnswers = await getQuizCorrectAnswers(quiz_id)

        const correctAnswersMap = new Map(
            correctAnswers.map(ca => [ca.id.toString(), ca.correct_answer])
        )

        let totalCorrect = 0
        const userAnswersData = []

        for(const answer of answers) {
            const correctAnswer = correctAnswersMap.get(answer.question_id.toString())
            const isCorrect = correctAnswer === answer.user_answer

            if(isCorrect) totalCorrect++

            userAnswersData.push({
                user_id,
                question_id: answer.question_id,
                user_answer: answer.user_answer,
                is_correct: isCorrect
            })
        }
        const totalQuestions = quiz.total_questions || correctAnswers.length
        const score = Math.round((totalCorrect / totalQuestions) * 100)

        const xpEarned = calculateXpEarned(score, quiz.xp_reward)

        const attempt = await createQuizAttempt(client, { 
            user_id, 
            quiz_id, 
            total_questions: totalQuestions,
            total_correct: totalCorrect,
            score,
            completion_time,
            xp_earned: xpEarned
        })

        const savedAnswers = await saveUserAnswers(client, userAnswersData)

        if(xpEarned > 0) {
            await updateUserXp(client, user_id, xpEarned)

            await logXpTransaction(client, {
                user_id,
                xp_amount: xpEarned,
                source: 'quiz_completion',
                reference_id: quiz_id
            })
        }

        await updateStreak(client, user_id)

        await client.query('COMMIT')

        const resultDetails = await getQuizResultDetails(quiz_id, savedAnswers)

        const responseData = {
            attempt: {
                id: attempt.id,
                score,
                total_correct: totalCorrect,
                total_questions: totalQuestions,
                completion_time,
                xp_earned: xpEarned,
                created_at: attempt.created_at
            },
            quiz: {
                id: quiz.id,
                title: quiz.title,
                xp_reward: quiz.xp_reward
            },
            performance: {
                grade: getGradeFromScore(score),
                passed: score >= 60,
                message: getPerformanceMessage(score)
            },
            details: resultDetails,
        }

        return successResponse(res, responseData, 'Quiz submitted successfully')

    } catch (err) {
        await client.query('ROLLBACK')
        if(err.code === '23503') return errorResponse(res, 'Invalid questions ID', 400)
        return errorResponse(res, 'Failed to submit quiz', 500, err)
    } finally {
        client.release()
    }
}

export const getQuizAtttempts = async (req, res) => {
    try {
        const user_id = req.user.id
        const quiz_id = req.params.quiz_id
        const { page = 1, limit = 10 } = req.query
        const offset = (page - 1) * limit

        const attempts = await pool.query(`
            SELECT *
            FROM quiz_attempts 
            WHERE user_id = $1 AND quiz_id = $2
            ORDER BY created_at DESC
            LIMIT $3 OFFSET $4
        `, [user_id, quiz_id, limit, offset])

        const countResult = await pool.query(`
            SELECT COUNT(*) FROM quiz_attempts 
            WHERE user_id = $1 AND quiz_id = $2
        `, [user_id, quiz_id])

        const totalData = parseInt(countResult.rows[0].count)
        const totalPage = Math.ceil(totalData / limit)

        const bestAttempt = await getUserBestAttempt(user_id, quiz_id)
        const quizResult = await pool.query(`
            SELECT title, xp_reward FROM quizzes WHERE id = $1
        `, [quiz_id])
        const quiz = quizResult.rows[0]

        const responseData = {
            quiz: quiz ? {
                id: quiz_id,
                title: quiz.title,
                max_xp: quiz.xp_reward
            } : null,
            best_attempt: bestAttempt ? {
                score: bestAttempt.score,
                xp_earned: bestAttempt.xp_earned,
                created_at: bestAttempt.created_at
            } : null,
            attempts: attempts.rows.map(attempt => ({
                id: attempt.id,
                score: attempt.score,
                total_correct: attempt.total_correct,
                total_questions: attempt.total_questions,
                xp_earned: attempt.xp_earned,
                completion_time: attempt.completion_time,
                created_at: attempt.created_at
            })),
            pagination: {
                current_page: parseInt(page),
                total_page: totalPage,
                total_data: totalData,
                data_per_page: parseInt(limit)
            }
        }

        return successResponse(res, responseData, 'Quiz attemps retrieved successfully')

    } catch (err) {
        return errorResponse(res, 'Failed to get quiz attempts', 500, err)
    }
}

export const getQuizAttemptDetails = async (req, res) => {
    try {
        const user_id = req.user.id
        const { attempt_id } = req.params

        const attemptDetails = await getAttemptDetails(attempt_id, user_id)
        if(!attemptDetails) return notFoundResponse(res, 'Quiz attempt')

        return successResponse(res, attemptDetails, 'Quiz attempt details retrieved successfully')
    } catch (err) {
        return errorResponse(res, 'Failed to get attempt details', 500, err)
    }
}

export const getUserQuizHistory = async (req, res) => {
    try {
        const user_id = req.user.id
        const { page = 1, limit = 10, quiz_id } = req.query
        const offset = (page - 1) * limit
        
        let query = `
            SELECT 
                qa.*,
                q.title as quiz_title,
                q.thumbnail_url as quiz_thumbnail
            FROM quiz_attempts qa
            JOIN quizzes q ON qa.quiz_id = q.id
            WHERE qa.user_id = $1
        `
        
        const params = [user_id]
        let paramCount = 1
        
        if (quiz_id) {
            paramCount++
            query += ` AND qa.quiz_id = $${paramCount}`
            params.push(quiz_id)
        }
        
        query += ` ORDER BY qa.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`
        params.push(limit, offset)
        
        const result = await pool.query(query, params)
        
        let countQuery = `SELECT COUNT(*) FROM quiz_attempts WHERE user_id = $1`
        let countParams = [user_id]
        
        if (quiz_id) {
            countQuery += ` AND quiz_id = $2`
            countParams.push(quiz_id)
        }
        
        const countResult = await pool.query(countQuery, countParams)
        const totalItems = parseInt(countResult.rows[0].count)
        const totalPages = Math.ceil(totalItems / limit)
        
        const statsResult = await pool.query(`
            SELECT 
                COUNT(DISTINCT quiz_id) as total_quizzes_attempted,
                COUNT(*) as total_attempts,
                COALESCE(AVG(score), 0) as average_score,
                COALESCE(SUM(xp_earned), 0) as total_xp_earned
            FROM quiz_attempts 
            WHERE user_id = $1
        `, [user_id])
        
        const stats = statsResult.rows[0]
        
        const responseData = {
            history: result.rows.map(row => ({
                id: row.id,
                quiz: {
                    id: row.quiz_id,
                    title: row.quiz_title,
                    thumbnail: row.quiz_thumbnail
                },
                score: row.score,
                total_correct: row.total_correct,
                total_questions: row.total_questions,
                xp_earned: row.xp_earned,
                completion_time: row.completion_time,
                attempted_at: row.created_at,
                passed: row.score >= 60
            })),
            statistics: {
                total_quizzes_attempted: parseInt(stats.total_quizzes_attempted),
                total_attempts: parseInt(stats.total_attempts),
                average_score: Math.round(stats.average_score),
                total_xp_earned: parseInt(stats.total_xp_earned)
            },
            pagination: {
                current_page: parseInt(page),
                total_pages: totalPages,
                total_items: totalItems,
                items_per_page: parseInt(limit)
            }
        }
        
        return successResponse(res, responseData, 'Quiz history retrieved successfully')
        
    } catch (err) {
        return errorResponse(res, 'Failed to get quiz history', 500, err)
    }
}

const getAttemptCount = async (user_id, quiz_id) => {
    const result = await pool.query(`
        SELECT COUNT(*) FROM quiz_attempts 
        WHERE user_id = $1 AND quiz_id = $2
    `, [user_id, quiz_id])
    
    return parseInt(result.rows[0].count)
}

const getQuizResultDetails = async (quiz_id, savedAnswers) => {
    const questions = await getQuizQuestions(quiz_id)
    
    return questions.map(q => {
        const userAnswer = savedAnswers.find(a => a.question_id === q.id)
        return {
            question_id: q.id,
            question: q.question,
            options: q.options,
            user_answer: userAnswer ? userAnswer.user_answer : null,
            correct_answer: q.correct_answer,
            is_correct: userAnswer ? userAnswer.is_correct : false,
            explanation: q.explanation
        }
    })
}

const getGradeFromScore = (score) => {
    if (score >= 90) return 'A'
    else if (score >= 80) return 'B'
    else if (score >= 70) return 'C'
    else if (score >= 60) return 'D'
    else return 'F'
}

const getPerformanceMessage = (score) => {
    if (score >= 90) return 'Excellent! Perfect understanding!'
    else if (score >= 80) return 'Great job! Solid understanding!'
    else if (score >= 70) return 'Good work! Room for improvement.'
    else if (score >= 60) return 'You passed! Review the material.'
    else return 'Keep practicing! Review and try again.'
}