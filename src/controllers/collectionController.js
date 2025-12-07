import { errorResponse, notFoundResponse, successResponse, withPagination } from "../helper/common.js"
import { deleteFromCloudinary, extractPublicId, uploadToCloudinary } from "../helper/upload.js"
import { validateRequiredFields } from "../helper/validation.js"
import { countDataCollections, createCollection, deleteCollection, getAllCollections, getCollectionById, updateCollection } from "../models/collectionModel.js"

export const getCollections = async (req, res) => {
    try {
        const page = Number(req.query.page) || 1
        const limit = Number(req.query.limit) || 10
        const sortby = req.query.sortby || 'id'
        const sort = req.query.sort || 'ASC'
        const offset = (page - 1) * limit

        const collections = await getAllCollections({limit, offset, sort, sortby})
        const { rows: [{count}] } = await countDataCollections()
        const totalData = parseInt(count)
        const totalPage = Math.ceil(totalData / limit)

        const pagination = {
            currentPage: page,
            limit: limit,
            totalData: totalData,
            totalPage: totalPage
        }

        const responseData = withPagination({collections}, pagination)
        return successResponse(res, responseData, 'Quiz collections retrieved successfully')
    } catch (err) {
        return errorResponse(res, 'Error retrieving quiz collections', 500, err)
    }
}

export const getCollection = async (req, res) => {
    try {
        const { id } = req.params
        const collection = await getCollectionById(id)
        if(!collection) {
            return notFoundResponse(res, 'Quiz Collection')
        }
        return successResponse(res, collection, 'Quiz collection retrieved successfully')
    } catch (err) {
        return errorResponse(res, 'Error retrieving quiz collection', 500, err)
    }
}

export const addCollection = async (req, res) => {
    try {
        const { title, category, difficulty } = req.body

        const validation = validateRequiredFields(req.body, ['title', 'category'])
        if(!validation.isValid) return errorResponse(res, validation.message, 400)

        let icon_url
        if(req.file) {
            try {
                const uploadResult = await uploadToCloudinary(req.file.buffer, 'codequest/collections')
                icon_url = uploadResult.secure_url
            } catch (uploadError) {
                return errorResponse(res, 'Error uploading icon', 500, uploadError)
            }
        }

        const newCollection = await createCollection({ title, category, icon_url, difficulty })
        return successResponse(res, newCollection, 'Quiz collection created successfully', 201)
    } catch (err) {
        return errorResponse(res, 'Error creating quiz collection', 500, err)
    }
}

export const editCollection = async (req, res) => {
    try {
        const { id } = req.params
        const { title, category, difficulty } = req.body

        const existingCollection = await getCollectionById(id)
        if(!existingCollection) {
            return notFoundResponse(res, 'Quiz collection')
        }

        const updateData = {}
        if(title !== undefined) updateData.title = title
        if(category !== undefined) updateData.category = category
        if(difficulty !== undefined) updateData.difficulty = difficulty

        if(req.file) {
            try {
                const uploadResult = await uploadToCloudinary(req.file.buffer, 'codequest/collections')
                updateData.icon_url = uploadResult.secure_url
                if(existingCollection.icon_url) {
                    const publicId = extractPublicId(existingCollection.icon_url)
                    await deleteFromCloudinary(publicId)
                }
            } catch (uploadError) {
                return errorResponse(res, 'Error uploading thumbnail', 500, uploadError)
            }
        }

        const updatedCollection = await updateCollection(id, updateData)

        return successResponse(res, updatedCollection, 'Quiz collection updated successfully')
    } catch (err) {
        return errorResponse(res, 'Error updating quiz collection', 500, err)
    }
}

export const removeCollection = async (req, res) => {
    try {
        const { id } = req.params

        const existingCollection = await getCollectionById(id)
        if(!existingCollection) return notFoundResponse(res, 'Quiz collection')

        if(existingCollection.icon_url) {
            const publicId = extractPublicId(existingCollection.icon_url)
            await deleteFromCloudinary(publicId)
        }

        await deleteCollection(id)
        return successResponse(res, null, 'Quiz collection deleted successfully')
    } catch (err) {
        return errorResponse(res, 'Error deleting quiz collection', 500, err)
    }
}