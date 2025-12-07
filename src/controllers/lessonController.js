import { conflictResponse, errorResponse, notFoundResponse, successResponse, withPagination } from "../helper/common.js"
import { validateRequiredFields } from "../helper/validation.js"
import { getCourseById } from "../models/courseModel.js"
import { checkExistingOrderIndex, countDataLessons, createLesson, deleteLesson, getAllLessons, getLessonById, updateLesson, } from "../models/lessonModel.js"

export const getLessons = async (req, res) => {
    try {
        const page = Number(req.query.page) || 1
        const limit = Number(req.query.limit) || 10
        const sortby = req.query.sortby || 'id'
        const sort = req.query.sort || 'ASC'
        const offset = (page - 1) * limit

        const lessons = await getAllLessons({limit, offset, sort, sortby})
        const { rows: [{ count }] } = await countDataLessons()
        const totalData = parseInt(count)
        const totalPage = Math.ceil(totalData / limit)

        const pagination = {
            currentPage: page,
            limit: limit,
            totalData: totalData,
            totalPage: totalPage
        }

        const responseData = withPagination({ lessons }, pagination)
        return successResponse(res, responseData, 'Lessons retrieved successfully')
    } catch (err) {
        return errorResponse(res, 'Error retrieving lessons', 500, err)
    }
}

export const getLesson = async (req, res) => {
    try {
        const { id } = req.params
        const lesson = await getLessonById(id)
        if(!lesson) return notFoundResponse(res, 'Lesson')
        return successResponse(res, lesson, 'Lesson retrieved successfully')
    } catch (err) {
        return errorResponse(res, 'Error retrieving lesson', 500, err)
    }
}

export const addLesson = async (req, res) => {
    try {
        const { course_id, title, order_index, videos, overviews, estimated_duration } = req.body

        const validation = validateRequiredFields(req.body, ['course_id', 'title', 'order_index'])
        if(!validation.isValid) return errorResponse(res, validation.message, 400)
        
        const course = await getCourseById(course_id)
        if(!course) return notFoundResponse(res, 'Course')
        
        const existingOrder = await checkExistingOrderIndex(course_id, order_index)
        if(existingOrder) return conflictResponse(res, `Order index ${order_index} already exists in this course`)

        const newLesson = await createLesson({ course_id, title, order_index, videos, overviews, estimated_duration })
        return successResponse(res, newLesson, 'Lesson created successfully', 201)
    } catch (err) {
        if(err.code === '23503') return notFoundResponse(res, 'Course')
        if(err.code === '23505') return errorResponse(res, 'Lesson with similar data already exists', 409)
        return errorResponse(res, 'Error creating lesson', 500, err)
    }
}

export const editLesson = async (req, res) => {
    try {
        const { id } = req.params
        const { course_id, title, order_index, videos, overviews, estimated_duration } = req.body

        const existingLesson = await getLessonById(id)
        if(!existingLesson) return notFoundResponse(res, 'Lesson')

        if(course_id!==undefined&&course_id!==existingLesson.course_id) {
            const course = await getCourseById(course_id)
            if(!course) return notFoundResponse(res, 'Course')
        }

        if(order_index!==undefined&&order_index!==existingLesson.order_index) {
            const existingOrder = await checkExistingOrderIndex(course_id || existingLesson.course_id, order_index)
            if(existingOrder&&existingOrder.id!==parseInt(id)) return conflictResponse(res, `Order index ${order_index} already exists in this course`)
        }

        const updateData = {}
        if(course_id !== undefined) updateData.course_id = course_id
        if(title !== undefined) updateData.title = title
        if(order_index !== undefined) updateData.order_index = order_index
        if(videos !== undefined) updateData.videos = videos
        if(overviews !== undefined) updateData.overviews = overviews
        if(estimated_duration !== undefined) updateData.estimated_duration = estimated_duration

        const updatedLesson = await updateLesson(id, updateData)

        return successResponse(res, updatedLesson, 'Lesson updated successfully')
    } catch (err) {
        if(err.code === '23503') return notFoundResponse(res, 'Course')
        if(err.code === '23505') return errorResponse(res, 'Lesson with similar data already exists', 409)
        return errorResponse(res, 'Error updating lesson', 500, err)
    }
}

export const removeLesson = async (req, res) => {
    try {
        const { id } = req.params

        const existingLesson = await getLessonById(id)
        if(!existingLesson) return notFoundResponse(res, 'Lesson')

        await deleteLesson(id)
        return successResponse(res, null, 'Lesson deleted successfully')
    } catch (err) {
        if(err.code === '23503') return errorResponse(res, 'Cannot delete lesson because it has related data', 409)
        return errorResponse(res, 'Error deleting lesson', 500, err)
    }
}