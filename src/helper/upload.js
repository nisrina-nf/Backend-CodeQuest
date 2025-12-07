import cloudinary from "../config/cloudinary.js"
import streamifier from "streamifier"

export const uploadToCloudinary = (fileBuffer, folder) => {
    return new Promise((resolve, reject) => {
        const uploadOptions = {
            folder,
            resource_type: 'auto',
            quality: 'auto:good'
        }

        const stream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (err, result) => {
                if (err) reject(err)
                else resolve(result)
            }
        )

        streamifier.createReadStream(fileBuffer).pipe(stream)
    })
}

export const deleteFromCloudinary = async (publicId) => {
    try {
        const result = await cloudinary.uploader.destroy(publicId)
        return result
    } catch (error) {
        console.error('Error deleting from Cloudinary:', error)
        throw error
    }
}
export const extractPublicId = (url) => {
    const matches = url.match(/\/upload\/(?:v\d+\/)?([^\.]+)/)
    return matches ? matches[1] : null
}

export const uploadMultipleFiles = async (files, folder = 'codequest/files') => {
    const uploadPromises = files.map(file => uploadToCloudinary(file.buffer, folder))
    return Promise.all(uploadPromises)
}