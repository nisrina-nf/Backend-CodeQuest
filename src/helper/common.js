export const successResponse = (res, data, message = 'Success', statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data
    })
}

export const errorResponse = (res, message = 'Internal Server Error', statusCode = 500, error = null) => {
    const response = {
        success: false,
        message
    }

    if(error && process.env.NODE_ENV === 'development') {
        response.error = error.message
    }

    return res.status(statusCode).json(response)
}

export const notFoundResponse = (res, resource = 'Resource') => {
    return errorResponse(res, `${resource} not found`, 404)
}

export const validationErrorResponse = (res, message = 'Validation Error', errors = null) => {
    const response = {
        success: false,
        message
    }

    if(errors) {
        response.errors = errors
    }

    return res.status(400).json(response)
}

export const conflictResponse = (res, message = 'Resource already exists') => {
    return errorResponse(res, message, 409)
}

export const withPagination = (data, pagination) => {
    return {
        ...data,
        pagination
    }
}