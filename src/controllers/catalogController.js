import pool from "../config/db.js"
import { errorResponse, successResponse } from "../helper/common.js"

const COURSE_CATEGORIES = [
    'web-development',
    'data-science',
    'computer-science'
]

export const showCourses = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 12, 
            category 
        } = req.query
        
        const offset = (page - 1) * limit
        
        if (category && !COURSE_CATEGORIES.includes(category)) {
            return errorResponse(res, `Invalid category. Must be one of: ${COURSE_CATEGORIES.join(', ')}`, 400)
        }
        
        let query = `
            SELECT 
                c.*,
                COUNT(DISTINCT ce.id) as enrollment_count,
                COUNT(DISTINCT l.id) as lesson_count
            FROM courses c
            LEFT JOIN course_enrollments ce ON c.id = ce.course_id
            LEFT JOIN lessons l ON c.id = l.course_id
        `
        
        let countQuery = `SELECT COUNT(*) FROM courses c`
        const params = []
        const countParams = []
        let paramCount = 0
        
        if (category) {
            paramCount++
            query += ` WHERE c.category = $${paramCount}`
            countQuery += ` WHERE c.category = $${paramCount}`
            params.push(category)
            countParams.push(category)
        }
        
        query += ` GROUP BY c.id`
        query += ` ORDER BY c.created_at DESC`
        query += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`
        
        params.push(limit, offset)
        
        const coursesResult = await pool.query(query, params)
        const countResult = await pool.query(countQuery, countParams)
        
        const totalData = parseInt(countResult.rows[0].count)
        const totalPage = Math.ceil(totalData / limit)
        
        const formattedCourses = coursesResult.rows.map(course => ({
            id: course.id,
            title: course.title,
            description: course.description,
            category: course.category,
            proficiency_level: course.proficiency_level,
            thumbnail_url: course.thumbnail_url,
            estimated_duration: course.estimated_duration,
            xp_reward: course.xp_reward,
            stats: {
                enrollment_count: parseInt(course.enrollment_count),
                lesson_count: parseInt(course.lesson_count)
            },
            created_at: course.created_at
        }))
        
        const responseData = {
            courses: formattedCourses,
            pagination: {
                current_page: parseInt(page),
                total_page: totalPage,
                total_data: totalData,
                items_per_page: parseInt(limit)
            }
        }
        
        return successResponse(res, responseData, 'Courses retrieved successfully')
        
    } catch (err) {
        console.error('Show courses error:', err)
        return errorResponse(res, 'Failed to retrieve courses', 500, err)
    }
}

export const showCourseDetail = async (req, res) => {
    try {
        const { id } = req.params
        
        const courseResult = await pool.query(`
            SELECT 
                c.*,
                COUNT(DISTINCT ce.id) as total_enrollments,
                COUNT(DISTINCT l.id) as total_lessons
            FROM courses c
            LEFT JOIN course_enrollments ce ON c.id = ce.course_id
            LEFT JOIN lessons l ON c.id = l.course_id
            WHERE c.id = $1
            GROUP BY c.id
        `, [id])
        
        if (courseResult.rows.length === 0) {
            return errorResponse(res, 'Course not found', 404)
        }
        
        const course = courseResult.rows[0]
        
        const lessonsResult = await pool.query(`
            SELECT 
                id,
                title,
                videos,
                overviews,
                order_index,
                estimated_duration
            FROM lessons 
            WHERE course_id = $1 
            ORDER BY order_index
        `, [id])
        
        let userEnrollment = null
        if (req.user) {
            const enrollmentResult = await pool.query(
                `SELECT status, percent_progress FROM course_enrollments 
                 WHERE user_id = $1 AND course_id = $2`,
                [req.user.id, id]
            )
            if (enrollmentResult.rows.length > 0) {
                userEnrollment = enrollmentResult.rows[0]
            }
        }
        
        const responseData = {
            course: {
                id: course.id,
                title: course.title,
                description: course.description,
                category: formatCategoryName(course.category),
                proficiency_level: course.proficiency_level,
                thumbnail_url: course.thumbnail_url,
                estimated_duration: course.estimated_duration,
                xp_reward: course.xp_reward,
                created_at: course.created_at
            },
            stats: {
                total_enrollments: parseInt(course.total_enrollments),
                total_lessons: parseInt(course.total_lessons)
            },
            lessons: lessonsResult.rows.map(lesson => ({
                id: lesson.id,
                title: lesson.title,
                order: lesson.order_index,
                duration: lesson.estimated_duration
            })),
            user_enrollment: userEnrollment,
        }
        
        return successResponse(res, responseData, 'Course details retrieved')
        
    } catch (err) {
        console.error('Course detail error:', err)
        return errorResponse(res, 'Failed to retrieve course details', 500, err)
    }
}

export const showQuizCollections = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 12, 
            category 
        } = req.query
        
        const offset = (page - 1) * limit
        
        if (category && !COURSE_CATEGORIES.includes(category)) {
            return errorResponse(res, `Invalid category. Must be one of: ${COURSE_CATEGORIES.join(', ')}`, 400)
        }
        
        let query = `
            SELECT 
                qc.*,
                COUNT(DISTINCT q.id) as quiz_count,
                COUNT(DISTINCT qq.id) as total_questions,
                COALESCE(SUM(q.xp_reward), 0) as total_xp
            FROM quiz_collections qc
            LEFT JOIN quizzes q ON qc.id = q.collection_id
            LEFT JOIN quiz_questions qq ON q.id = qq.quiz_id
        `
        
        let countQuery = `SELECT COUNT(*) FROM quiz_collections qc`
        const params = []
        const countParams = []
        let paramCount = 0
        
        if (category) {
            paramCount++
            query += ` WHERE qc.category = $${paramCount}`
            countQuery += ` WHERE qc.category = $${paramCount}`
            params.push(category)
            countParams.push(category)
        }
        
        query += ` GROUP BY qc.id`
        query += ` ORDER BY qc.created_at DESC`
        query += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`
        
        params.push(limit, offset)
        
        const collectionsResult = await pool.query(query, params)
        const countResult = await pool.query(countQuery, countParams)
        
        const totalData = parseInt(countResult.rows[0].count)
        const totalPage = Math.ceil(totalData / limit)
        
        const formattedCollections = collectionsResult.rows.map(collection => ({
            id: collection.id,
            title: collection.title,
            category: formatCategoryName(collection.category),
            icon_url: collection.icon_url,
            difficulty: collection.difficulty,
            stats: {
                quiz_count: parseInt(collection.quiz_count),
                total_questions: parseInt(collection.total_questions),
                total_xp: parseInt(collection.total_xp)
            },
            created_at: collection.created_at
        }))
        
        const responseData = {
            collections: formattedCollections,
            pagination: {
                current_page: parseInt(page),
                total_page: totalPage,
                total_data: totalData,
                items_per_page: parseInt(limit)
            }
        }
        
        return successResponse(res, responseData, 'Quiz collections retrieved')
        
    } catch (err) {
        console.error('Browse collections error:', err)
        return errorResponse(res, 'Failed to retrieve collections', 500, err)
    }
}

export const showQuizCollectionDetail = async (req, res) => {
    try {
        const { id } = req.params
        
        const collectionResult = await pool.query(`
            SELECT 
                qc.*,
                COUNT(DISTINCT q.id) as quiz_count,
                COUNT(DISTINCT qq.id) as total_questions,
                COALESCE(SUM(q.xp_reward), 0) as total_xp
            FROM quiz_collections qc
            LEFT JOIN quizzes q ON qc.id = q.collection_id
            LEFT JOIN quiz_questions qq ON q.id = qq.quiz_id
            WHERE qc.id = $1
            GROUP BY qc.id
        `, [id])
        
        if (collectionResult.rows.length === 0) {
            return errorResponse(res, 'Collection not found', 404)
        }
        
        const collection = collectionResult.rows[0]
        
        const quizzesResult = await pool.query(`
            SELECT 
                q.*,
                COUNT(DISTINCT qa.id) as attempt_count,
                COALESCE(AVG(qa.score), 0) as average_score
            FROM quizzes q
            LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id
            WHERE q.collection_id = $1
            GROUP BY q.id
            ORDER BY q.created_at ASC
        `, [id])

        const responseData = {
            collection: {
                id: collection.id,
                title: collection.title,
                category: formatCategoryName(collection.category),
                icon_url: collection.icon_url,
                difficulty: collection.difficulty,
                created_at: collection.created_at
            },
            stats: {
                quiz_count: parseInt(collection.quiz_count),
                total_questions: parseInt(collection.total_questions),
                total_xp: parseInt(collection.total_xp)
            },
            quizzes: quizzesResult.rows.map(quiz => ({
                id: quiz.id,
                title: quiz.title,
                description: quiz.description,
                total_question: quiz.total_question,
                estimated_duration: quiz.estimated_duration,
                xp_reward: quiz.xp_reward,
                attempt_count: parseInt(quiz.attempt_count),
                average_score: parseFloat(quiz.average_score)
            }))
        }
        
        return successResponse(res, responseData, 'Collection details retrieved')
        
    } catch (err) {
        console.error('Collection detail error:', err)
        return errorResponse(res, 'Failed to retrieve collection details', 500, err)
    }
}

const formatCategoryName = (categoryId) => {
    const names = {
        'web-development': 'Web Development',
        'data-science': 'Data Science',
        'computer-science': 'Computer Science Foundations'
    }
    return names[categoryId] || categoryId
}