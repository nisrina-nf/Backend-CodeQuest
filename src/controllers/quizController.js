import { conflictResponse, errorResponse, notFoundResponse, successResponse, withPagination } from "../helper/common.js"
import { deleteFromCloudinary, extractPublicId, uploadToCloudinary } from "../helper/upload.js"
import { validateRequiredFields } from "../helper/validation.js"
import { getCollectionById } from "../models/collectionModel.js"
import { checkExistingQuizOrder, countDataQuizzes, createQuiz, deleteQuiz, getAllQuizzes, getQuizById, updateQuiz } from "../models/quizModel.js"

export const getQuizzes = async (req, res) => {
    try {
        const page = Number(req.query.page) || 1
        const limit = Number(req.query.limit) || 10
        const sortby = req.query.sortby || 'id'
        const sort = req.query.sort || 'ASC'
        const offset = (page - 1) * limit

        const quizzes = await getAllQuizzes({limit, offset, sort, sortby})
        const { rows: [{ count }] } = await countDataQuizzes()
        const totalData = parseInt(count)
        const totalPage = Math.ceil(totalData / limit)
        
        const pagination = {
            currentPage: page,
            limit: limit,
            totalData: totalData,
            totalPage: totalPage
        }

        const responseData = withPagination({ quizzes }, pagination)
        return successResponse(res, responseData, 'Quizzes retrieved successfully')
    } catch (err) {
        return errorResponse(res, 'Error retrieving quizzes', 500, err)
    }
}

export const getQuiz = async (req, res) => {
    try {
        const { id } = req.params
        const quiz = await getQuizById(id)
        if(!quiz) return notFoundResponse(res, 'Quiz')
        return successResponse(res, quiz, 'Quiz retrieved successfully')
    } catch (err) {
        return errorResponse(res, 'Error retrieving quiz', 500, err)
    }
}

export const addQuiz = async (req, res) => {
    try {
        const { collection_id, title, estimated_duration, xp_reward, quiz_order } = req.body

        const validation = validateRequiredFields(req.body, ['collection_id', 'title', 'quiz_order'])
        if(!validation.isValid) return errorResponse(res, validation.message, 400)

        const collection = await getCollectionById(collection_id)
        if(!collection) return notFoundResponse(res, 'Quiz Collection')
        
        const existingOrder = await checkExistingQuizOrder(collection_id, quiz_order)
        if(existingOrder)  return conflictResponse(res, `Quiz order ${quiz_order} already exists in this quiz collection`)
        
        let thumbnail_url
        if(req.file) {
            try {
                const uploadResult = await uploadToCloudinary(req.file.buffer, 'codequest/quizzes')
                thumbnail_url = uploadResult.secure_url
            } catch (uploadError) {
                return errorResponse(res, 'Error uploading thumbnail', 500, uploadError)
            }
        }
        
        const newQuiz = await createQuiz({ collection_id, title, thumbnail_url, estimated_duration, xp_reward, quiz_order })
        return successResponse(res, newQuiz, 'Quiz created successfully', 201)
    } catch (err) {
        return errorResponse(res, 'Error creating quiz', 500, err)
    }
}

export const editQuiz = async (req, res) => {
    try {
        const { id } = req.params
        const { collection_id, title, estimated_duration, xp_reward, quiz_order } = req.body

        const existingQuiz = await getQuizById(id)
        if(!existingQuiz) return notFoundResponse(res, 'Quiz')

        if(collection_id!==undefined&&collection_id!==existingQuiz.collection_id) {
            const collection = await getCollectionById(collection_id)
            if(!collection) return notFoundResponse(res, 'Quiz collection')
        }
        if(quiz_order!==undefined&&quiz_order!==existingQuiz.quiz_order) {
            const existingOrder = await checkExistingQuizOrder(collection_id, quiz_order)
            if(existingOrder&&existingOrder.id!==parseInt(id)) return conflictResponse(res, `Quiz order ${quiz_order} already exists in this quiz collection`)
        }

        const updateData = {}
        if(collection_id !== undefined) updateData.collection_id = collection_id
        if(title !== undefined) updateData.title = title
        if(estimated_duration !== undefined) updateData.estimated_duration = estimated_duration
        if(xp_reward !== undefined) updateData.xp_reward = xp_reward
        if(quiz_order !== undefined) updateData.quiz_order = quiz_order

        if(req.file) {
            try {
                const uploadResult = await uploadToCloudinary(req.file.buffer, 'codequest/quizzes')
                updateData.thumbnail_url = uploadResult.secure_url
                if(existingQuiz.thumbnail_url) {
                    const publicId = extractPublicId(existingQuiz.thumbnail_url)
                    await deleteFromCloudinary(publicId)
                }
            } catch (uploadError) {
                return errorResponse(res, 'Error uploading thumbnail', 500, uploadError)
            }
        }

        const updatedQuiz = await updateQuiz(id, updateData)

        return successResponse(res, updatedQuiz, 'Quiz updated successfully')
    } catch (err) {
        return errorResponse(res, 'Error updating quiz', 500, err)
    }
}

export const removeQuiz = async (req, res) => {
    try {
        const { id } = req.params

        const existingQuiz = await getQuizById(id)
        if(!existingQuiz) return notFoundResponse(res, 'Quiz')

        if(existingQuiz.thumbnail_url) {
            const publicId = extractPublicId(existingQuiz.thumbnail_url)
            await deleteFromCloudinary(publicId)
        }

        await deleteQuiz(id)
        return successResponse(res, null, 'Quiz deleted successfully')
    } catch (err) {
        return errorResponse(res, 'Error deleting quiz', 500, err)
    }
}