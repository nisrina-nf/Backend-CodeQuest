import { errorResponse, notFoundResponse, successResponse, withPagination } from "../helper/common.js"
import { validateRequiredFields } from '../helper/validation.js'
import { deleteFromCloudinary, extractPublicId, uploadToCloudinary } from "../helper/upload.js"
import { countDataBadges, createBadge, deleteBadge, getAllBadgesPaginate, getBadgeById, updateBadge } from "../models/badgeModel.js"
import { getCourseById } from "../models/courseModel.js"

export const getBadges = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1
        const limit = parseInt(req.query.limit) || 10
        const sortby = req.query.sortby || 'id'
        const sort = req.query.sort || 'ASC'
        const offset = (page - 1) * limit

        const badges = await getAllBadgesPaginate({limit, offset, sort, sortby})
        const { rows: [{ count }] } = await countDataBadges()
        const totalData = parseInt(count)
        const totalPage = Math.ceil(totalData / limit)

        const pagination = {
            currentPage: page,
            limit: limit,
            totalData: totalData,
            totalPage: totalPage
        }

        const responseData = withPagination({ badges }, pagination)
        return successResponse(res, responseData, 'Badges retrieved successfully')
    } catch (err) {
        return errorResponse(res, 'Error retrieving badges', 500, err)
    }
}

export const getBadge = async (req, res) => {
    try {
        const { id } = req.params
        const badge = await getBadgeById(id)
        if(!badge) return notFoundResponse(res, 'Badge')
        return successResponse(res, badge, 'Badge retrieved successfully')
    } catch (err) {
        return errorResponse(res, 'Error retrieving badge', 500, err)
    }
}

export const addBadge = async (req, res) => {
    try {
        const { course_id, name, description, xp_reward } = req.body

        const validation = validateRequiredFields(req.body, ['course_id', 'name', 'description'])
        if(!validation.isValid) return errorResponse(res, validation.message, 400)

        const course = await getCourseById(course_id)
        if(!course) return notFoundResponse(res, 'Course')

        let icon_url
        if(req.file) {
            try {
                const uploadResult = await uploadToCloudinary(req.file.buffer, 'codequest/badges')
                icon_url = uploadResult.secure_url
            } catch (uploadError) {
                return errorResponse(res, 'Error uploading icon', 500, uploadError)
            }
        }
        const newBadge = await createBadge({ course_id, name, description, icon_url, xp_reward })
        return successResponse(res, newBadge, 'Badge created successfully')
    } catch (err) {
        if(err.code === '23503') return notFoundResponse(res, 'Course')
        if(err.code === '23505') return errorResponse(res, 'Badge with similar data already exists', 409)
        return errorResponse(res, 'Error creating badge', 500, err)
    }
}

export const editBadge = async (req, res) => {
    try {
        const { id } = req.params
        const { course_id, name, description, xp_reward } = req.body

        const existingBadge = await getBadgeById(id)
        if(!existingBadge) return notFoundResponse(res, 'Badge')

        const updateData = {}
        if(course_id !== undefined) updateData.course_id = course_id
        if(name !== undefined) updateData.name = name
        if(description !== undefined) updateData.description = description
        if(xp_reward !== undefined) updateData.xp_reward = xp_reward

        if(req.file) {
            try {
                const uploadResult = await uploadToCloudinary(req.file.buffer, 'codequest/badges')
                updateData.icon_url = uploadResult.secure_url
                if(existingBadge.icon_url) {
                    const publicId = extractPublicId(existingBadge.icon_url)
                    await deleteFromCloudinary(publicId)
                }
            } catch (uploadError) {
                return errorResponse(res, 'Error uploading icon', 500, uploadError)
            }
        }

        const updatedBadge = await updateBadge(id, updateData)
        
        return successResponse(res, updatedBadge, 'Badge updated successfully')
    } catch (err) {
        if(err.code === '23503') return notFoundResponse(res, 'Course')
        if(err.code === '23505') return errorResponse(res, 'Badge with similar data already exists', 409)
        return errorResponse(res, 'Error updating badge', 500, err)
    }
}

export const removeBadge = async (req, res) => {
    try {
        const { id } = req.params

        const existingBadge = await getBadgeById(id)
        if(!existingBadge) return notFoundResponse(res, 'Badge')
        
        if(existingBadge.icon_url) {
            const publicId = extractPublicId(existingBadge.icon_url)
            await deleteFromCloudinary(publicId)
        }
        await deleteBadge(id)
        return successResponse(res, null, 'Badge deleted successfully')
    } catch (err) {
        if(err.code === '23503') return errorResponse(res, 'Cannot delete badge because it has related data', 409)
        return errorResponse(res, 'Error deleting badge', 500, err)
    }
}