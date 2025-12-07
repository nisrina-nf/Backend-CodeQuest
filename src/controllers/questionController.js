import { conflictResponse, errorResponse, notFoundResponse, successResponse, withPagination } from "../helper/common.js"
import { validateRequiredFields } from "../helper/validation.js"
import { checkExistingOrderIndex, countDataQuestions, createQuestion, deleteQuestion, getAllQuestions, getQuestionById, getQuestionByQuiz, updateQuestion } from "../models/questionModel.js"
import { getQuizById } from "../models/quizModel.js"

export const getQuestions = async (req, res) => {
    try {
        const page = Number(req.query.page) || 1
        const limit = Number(req.query.limit) || 10
        const sortby = req.query.sortby || 'id'
        const sort = req.query.sort || 'ASC'
        const offset = (page-1) * limit

        const questions = await getAllQuestions({limit, offset, sort, sortby})
        const { rows: [{ count }] } = await countDataQuestions()
        const totalData = parseInt(count)
        const totalPage = Math.ceil(totalData / limit)

        const pagination = {
            currentPage: page,
            limit: limit,
            totalData: totalData,
            totalPage: totalPage
        }

        const responseData = withPagination({questions}, pagination)
        return successResponse(res, responseData, 'Questions retrieved successfully')
    } catch (err) {
        return errorResponse(res, 'Error retrieving questions', 500, err)
    }
}

export const getQuestionsFromQuiz = async (req, res) => {
    try {
        const { quiz_id } = req.params
        const questions = await getQuestionByQuiz(quiz_id)
        return successResponse(res, questions, 'Questions retrieved successfully')
    } catch (err) {
        return errorResponse(res, 'Error retrieving questions', 500)
    }
}

export const getQuestion = async (req, res) => {
    try {
        const { id } = req.params
        const question = await getQuestionById(id)
        if(!question) return notFoundResponse(res, 'Question')
        return successResponse(res, question, 'Question retrieved successfully')
    } catch (err) {
        return errorResponse(res, 'Error retrieving question', 500, err)
    }
}

export const addQuestion = async (req, res) => {
    try {
        const { quiz_id, question, options, correct_answer, explanation, question_order } = req.body

        const validation = validateRequiredFields(req.body, ['quiz_id', 'question', 'correct_answer', 'question_order'])
        if(!validation.isValid) return errorResponse(res, validation.message, 400)

        const quiz = await getQuizById(quiz_id)
        if(!quiz) return notFoundResponse(res, 'Quiz')

        const existingOrder = await checkExistingOrderIndex(quiz_id, question_order)
        if(existingOrder) return conflictResponse(res, `Question order ${question_order} already exists in this quiz`)

        if(!Array.isArray(options)) return errorResponse(res, 'Options must be an array', 400)
        
        const validatedOptions = options.map((opt, index) => {
            const id = opt.id || String.fromCharCode(97 + index)
            const text = opt.text || String(opt)

            if(!text || text.trim() === '') throw new Error(`Option ${id} must have text`)

            return {
                id: id.toLowerCase(),
                text: text.trim()
            }
        })
        const optionIds = validatedOptions.map(opt => opt.id)
        if(!optionIds.includes(correct_answer)) return errorResponse(res, `Correct answer "${correct_answer}" not found in options`, 400)

        const uniqueIds = new Set(optionIds)
        if(uniqueIds.size !== optionIds.length) return errorResponse(res, 'Duplicate option IDs found', 400)

        const newQuestion = await createQuestion({ quiz_id, question, options: validatedOptions, correct_answer, explanation, question_order })
        return successResponse(res, newQuestion, 'Question created successfully', 201)
    } catch (err) {
        if(err.message.includes('must have text')) return errorResponse(res, err.message, 400)
        if(err.code === '23505') return errorResponse(res, 'Question with similar data already exists', 409)
        return errorResponse(res, 'Error creating question', 500, err)
    }
}

export const editQuestion = async (req, res) => {
    try {
        const { id } = req.params
        const { quiz_id, question, options, correct_answer, explanation, question_order } = req.body

        const existingQuestion = await getQuestionById(id)
        if(!existingQuestion) return notFoundResponse(res, 'Question')
        
        if(quiz_id!==undefined&&quiz_id!==existingQuestion.quiz_id) {
            const quiz = await getQuizById(quiz_id)
            if(!quiz) return notFoundResponse(res, 'Quiz')
        }
        
        if(question_order!==undefined&&question_order!==existingQuestion.question_order) {
            const existingOrder = await checkExistingOrderIndex(quiz_id || existingQuestion.quiz_id, question_order)
            if(existingOrder&&existingOrder.id!==parseInt(id)) return conflictResponse(res, `Question order ${question_order} already exists in this quiz`)
        }

        const updateData = {}
        if(quiz_id !== undefined) updateData.quiz_id = quiz_id
        if(question !== undefined) updateData.question = question
        if(explanation !== undefined) updateData.explanation = explanation
        if(question_order !== undefined) updateData.question_order = question_order
        if(options !== undefined) {
            if(!Array.isArray(options)) return errorResponse(res, 'Options must be an array', 400)
            
            const validatedOptions = options.map((opt, index) => {
                const id = opt.id || String.fromCharCode(97 + index)
                const text = opt.text || String(opt)

                if(!text || text.trim() === '') throw new Error(`Option ${id} must have text`)

                return {
                    id: id.toLowerCase(),
                    text: text.trim()
                }
            })
            const optionIds = validatedOptions.map(opt => opt.id)
            const uniqueIds = new Set(optionIds)
            if(uniqueIds.size !== optionIds.length) return errorResponse(res, 'Duplicate option IDs found', 400)
            
            updateData.options = validatedOptions

            if(correct_answer !== undefined) {
                if(!optionIds.includes(correct_answer)) return errorResponse(res, `Correct answer "${correct_answer}" not found in options`, 400)
            }
            updateData.correct_answer = correct_answer
        } else if(correct_answer!==undefined) {
            let existingOptions = existingQuestion.options
            if(typeof existingOptions === 'string') existingOptions = JSON.parse(existingOptions)

            const existingIds = existingOptions.map(opt => opt.id)
            if(!existingIds.includes(correct_answer)) return errorResponse(res, `Correct answer "${correct_answer}" not found in existing options`, 400)

            updateData.correct_answer = correct_answer
        }

        const updatedQuestion = await updateQuestion(id, updateData)
        return successResponse(res, updatedQuestion, 'Question updated successfully')

    } catch (err) {
        if(err.code === '23503') return notFoundResponse(res, 'Quiz')
        if(err.code === '23505') return errorResponse(res, 'Question with similar data already exists', 409)
        return errorResponse(res, 'Error updating question', 500, err)
    }
}

export const removeQuestion = async (req, res) => {
    try {
        const { id } = req.params

        const existingQuestion = await getQuestionById(id)
        if(!existingQuestion) return notFoundResponse(res, 'Question')

        await deleteQuestion(id)
        return successResponse(res, null, 'Question deleted successfully')
    } catch (err) {
        if(err.code === '23503') return errorResponse(res, 'Cannot delete lesson because it has related data', 409)
        return errorResponse(res, 'Error deleting question', 500, err)
    }
}