export const validateRequiredFields = (body, requiredFields) => {
    const missingFields = requiredFields.filter(field => !body[field])

    if(missingFields.length > 0) {
        return {
            valid: false,
            message: `Missing required fields: ${missingFields.join(', ')}`
        }
    }

    return { isValid: true }
}

export const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
}

export const validatePassword = (password) => {
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/
    return passwordRegex.test(password)
}