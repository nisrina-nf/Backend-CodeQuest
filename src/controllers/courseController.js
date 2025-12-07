import pool from "../config/db.js"
import { errorResponse, notFoundResponse, successResponse, withPagination } from "../helper/common.js"
import { deleteFromCloudinary, extractPublicId, uploadToCloudinary } from "../helper/upload.js"
import { validateRequiredFields } from "../helper/validation.js"
import { countEnrolledUsers, countUserEnrollments, createEnrollment, deleteEnrollment, getCourseLessonsWithProgress, getCourseXpSummary, getEnrolledUsers, getEnrollmentByIds, getEnrollmentDetail, getUserEnroll } from "../models/courseEnrollmentModel.js"
import { countDataCourses, createCourse, deleteCourse, getAllCourses, getCourseById, updateCourse } from "../models/courseModel.js"

export const getCourses = async (req, res) => {
    try {
        const page = Number(req.query.page) || 1
        const limit = Number(req.query.limit) || 10
        const sortby = req.query.sortby || 'id'
        const sort = req.query.sort || 'ASC'
        const offset = (page - 1) * limit

        const courses = await getAllCourses({limit, offset, sort, sortby})
        const { rows: [{ count }] } = await countDataCourses()
        const totalData = parseInt(count)
        const totalPage = Math.ceil(totalData / limit)

        const pagination = {
            currentPage: page,
            limit: limit,
            totalData: totalData,
            totalPage: totalPage
        }

        const responseData = withPagination({ courses }, pagination)
        return successResponse(res, responseData, 'Courses retrieved successfully')
    } catch (err) {
        return errorResponse(res, 'Error retrieving courses', 500, err)
    }
}

export const getCourse = async (req, res) => {
    try {
        const { id } = req.params
        const course = await getCourseById(id)
        if(!course) {
            return notFoundResponse(res, 'Course')
        }
        return successResponse(res, course, 'Course retrieved successfully')
    } catch (err) {
        return errorResponse(res, 'Error retrieving course', 500, err)
    }
}

export const addCourse = async (req, res) => {
    try {
        const { title, category, proficiency_level, description, estimated_duration, xp_reward } = req.body

        const validation = validateRequiredFields(req.body, ['title', 'category'])
        if(!validation.isValid) return errorResponse(res, validation.message, 400)

        let thumbnail_url
        if(req.file) {
            try {
                const uploadResult = await uploadToCloudinary(req.file.buffer, 'codequest/courses')
                thumbnail_url = uploadResult.secure_url
            } catch (uploadError) {
                return errorResponse(res, 'Error uploading thumbnail', 500, uploadError)
            }
        }

        const newCourse = await createCourse({ title, category, proficiency_level, description, thumbnail_url, estimated_duration, xp_reward })
        return successResponse(res, newCourse, 'Course created successfully', 201)
    } catch (err) {
        return errorResponse(res, 'Error creating course', 500, err)
    }
}

export const editCourse = async (req, res) => {
    try {
        const { id } = req.params
        const { title, category, proficiency_level, description, estimated_duration, xp_reward } = req.body

        const existingCourse = await getCourseById(id)
        if(!existingCourse) {
            return notFoundResponse(res, 'Course')
        }

        const updateData = {}
        if(title !== undefined) updateData.title = title
        if(category !== undefined) updateData.category = category
        if(proficiency_level !== undefined) updateData.proficiency_level = proficiency_level
        if(description !== undefined) updateData.description = description
        if(estimated_duration !== undefined) updateData.estimated_duration = estimated_duration
        if(xp_reward !== undefined) updateData.xp_reward = xp_reward

        if(req.file) {
            try {
                const uploadResult = await uploadToCloudinary(req.file.buffer, 'codequest/courses')
                updateData.thumbnail_url = uploadResult.secure_url
                if(existingCourse.thumbnail_url) {
                    const publicId = extractPublicId(existingCourse.thumbnail_url)
                    await deleteFromCloudinary(publicId)
                }
            } catch (uploadError) {
                return errorResponse(res, 'Error uploading thumbnail', 500, uploadError)
            }
        }

        const updatedCourse = await updateCourse(id, updateData)

        return successResponse(res, updatedCourse, 'Course updated successfully')
    } catch (err) {
        return errorResponse(res, 'Error updating course', 500, err)
    }
}

export const removeCourse = async (req, res) => {
    try {
        const { id } = req.params

        const existingCourse = await getCourseById(id)
        if(!existingCourse) return notFoundResponse(res, 'Course')

        if(existingCourse.thumbnail_url) {
            const publicId = extractPublicId(existingCourse.thumbnail_url)
            await deleteFromCloudinary(publicId)
        }

        await deleteCourse(id)
        return successResponse(res, null, 'Course deleted successfully')
    } catch (err) {
        return errorResponse(res, 'Error deleting course', 500, err)
    }
}

export const enrollCourse = async (req, res) => {
    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        const user_id = req.user.id
        const { course_id } = req.params

        const courseResult = await client.query(`
            SELECT id, title, xp_reward, proficiency_level
            FROM courses WHERE id = $1    
        `, [course_id])

        if(courseResult.rows.length === 0) {
            await client.query('ROLLBACK')
            return notFoundResponse(res, 'Course')
        }

        const course = courseResult.rows[0]
        
        const existingEnrollment = await getEnrollmentByIds(client, user_id, course_id)
        if(existingEnrollment) {
            await client.query('ROLLBACK')

            const message = enrollment.status === 'completed' ? 'You have already completed this course' : 'You are already enrolled in this course'
            return res.status(409).json({
                success: false,
                message,
                data: {
                    enrollmentId: existingEnrollment.id,
                    status: existingEnrollment.status,
                    enrolledAt: existingEnrollment.created_at      
                }
            })
        }

        const enrollment = await createEnrollment(client, user_id, course_id)
        await client.query('COMMIT')
        
        const responseData = {
            enrollment: {
                ...enrollment,
                course: {
                    id: course.id,
                    title: course.title,
                    xp_reward: course.xp_reward,
                    proficiency_level: course.proficiency_level
                }
            }
        }
        return successResponse(res, responseData, 'Successfully enrolled in course', 201)
    } catch (err) {
        await client.query('ROLLBACK')
        if(err.code === '23503') return notFoundResponse(res, 'Course')
        return errorResponse(res, 'Failed to enroll in course', 500, err)
    } finally {
        client.release()
    }
}

export const getUserEnrollments = async (req, res) => {
    try {
        const user_id = req.user.id
        const { status, page = 1, limit = 10 } = req.query
        
        const offset = (page - 1) * limit

        const enrollmentsData = await getUserEnroll(user_id, status, limit, offset)
        
        const totalData = await countUserEnrollments(user_id, status)
        const totalPage = Math.ceil(totalData/limit)
        
        const enrollments = enrollmentsData.map(row => ({
            enrollmentId: row.enrollment_id,
            status: row.enrollment_status,
            progress: {
                percentage: row.percent_progress,
                completedLessons: row.completed_lessons,
                totalLessons: row.total_lessons
            },
            timeline: {
                startedAt: row.started_at,
                completedAt: row.completed_at,
                enrolledAt: row.enrolled_at
            },
            course: {
                id: row.course_id,
                title: row.title,
                description: row.description,
                thumbnailUrl: row.thumbnail_url,
                proficiencyLevel: row.proficiency_level,
                estimatedDuration: row.estimated_duration,
                xpReward: row.xp_reward
            }
        }))

        const pagination = {
            currentPage: parseInt(page),
            limit: parseInt(limit),
            totalData: totalData,
            totalPage: totalPage
        }
        const responseData = withPagination({ enrollments }, pagination)
        return successResponse(res, responseData, 'Enrollments retrieved successfully')
    } catch (err) {
        return errorResponse(res, 'Failed to retrieve enrollments', 500, err)
    }
}

export const getEnrollmentDetails = async (req, res) => {
    try {
        const user_id = req.user.id
        const course_id = req.params.course_id

        const enrollment = await getEnrollmentDetail(user_id, course_id)
        if(!enrollment) return errorResponse(res, 'You are not enrolled in this course', 404)

        const lessons = await getCourseLessonsWithProgress(user_id, course_id)
        const xpEarned = await getCourseXpSummary(user_id, course_id)
        
        const totalLessons = lessons.length
        const completedLessons = lessons.filter(l => l.status === 'completed').length
        const inProgressLessons = lessons.filter(l => l.status === 'in_progress').length
        const totalDuration = lessons.reduce((sum, lesson) => sum + (lesson.estimated_duration || 0), 0)
        const totalXpEarned = xpEarned.lesson_xp + xpEarned.completion_xp

        const responseData = {
            enrollment: {
                id: enrollment.id,
                status: enrollment.status,
                progress: enrollment.percent_progress,
                startedAt: enrollment.started_at,
                completedAt: enrollment.completed_at,
                lastAccessed: enrollment.updated_at
            },
            course: {
                id: course_id,
                title: enrollment.course_title,
                description: enrollment.course_description,
                thumbnail: enrollment.course_thumbnail,
                proficiencyLevel: enrollment.proficiency_level,
                estimatedDuration: enrollment.estimated_duration,
                totalXpReward: enrollment.xp_reward
            },
            statistics: {
                lessons: {
                    total: totalLessons,
                    completed: completedLessons,
                    inProgress: inProgressLessons,
                    notStarted: totalLessons - completedLessons - inProgressLessons,
                    completionRate: totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0 
                },
                time: {
                    totalDuration
                },
                xp: {
                    totalEarned: totalXpEarned,
                    fromLessons: xpEarned.lesson_xp,
                    fromCompletion: xpEarned.completion_xp
                }
            },
            lessons: lessons.map(lesson => ({
                id: lesson.id,
                title: lesson.title,
                order: lesson.order_index,
                status: lesson.status,
                duration: lesson.estimated_duration,
                startedAt: lesson.lesson_started,
                completedAt: lesson.lesson_completed
            }))
        }

        return successResponse(res, responseData, 'Enrollment details retrieved successfully')
    } catch (err) {
        return errorResponse(res, 'Failed to retrieve enrollment details', 500, err)
    }
}

export const unenrollCourse = async (req, res) => {
    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        const user_id = req.user.id
        const course_id = req.params.course_id
        
        const enrollment = await getEnrollmentByIds(client, user_id, course_id)
        if(!enrollment) {
            await client.query('ROLLBACK')
            return errorResponse(res, 'You are not enrolled in this course', 404)
        }
        if(enrollment.status === 'completed') {
            await client.query('ROLLBACK')
            return errorResponse(res, 'Cannot unenroll from a completed course', 400)
        }

        const courseResult = await client.query(`
            SELECT title FROM courses WHERE id = $1    
        `, [course_id])
        const courseTitle = courseResult.rows[0]?.title || 'Unknown Course'
        
        await deleteEnrollment(client, user_id, course_id)
        await client.query(`
            DELETE FROM lesson_progress
            WHERE user_id = $1 AND lesson_id IN (SELECT id FROM lessons WHERE course_id = $2)
        `, [user_id, course_id])

        await client.query('COMMIT')

        return successResponse(res, {
            course_id, 
            courseTitle, 
            unenrollAt: new Date()
        }, 'Successfully unenrolled from course')
    } catch (err) {
        await client.query('ROLLBACK')
        return errorResponse(res, 'Failed to unenroll from course', 500, err)
    } finally {
        client.release()
    }
}

export const getCourseEnrolledUsers = async (req, res) => {
    try {
        const course_id = req.params.course_id
        const { page = 1, limit = 20, status } = req.query
        
        const offset = (page - 1) * limit
        
        const enrolledUserData = await getEnrolledUsers(course_id, status, limit, offset)
        const totalData = await countEnrolledUsers(course_id, status) 
        const totalPage = Math.ceil(totalData / limit) 
        
        const courseResult = await pool.query(`
            SELECT title, proficiency_level FROM courses WHERE id = $1
            `, [course_id]) 
        const course = courseResult.rows[0] 
        
        const enrolledUsers = enrolledUserData.map(user => ({
            userId: user.id,
            username: user.username,
            avatar: user.avatar_url,
            level: user.level,
            xp: user.xp,
            enrollment: {
                status: user.status,
                progress: user.percent_progress,
                lessonsCompleted: user.lessons_completed,
                totalLessons: user.total_lessons,
                startedAt: user.started_at,
                completedAt: user.completed_at,
                enrolledAt: user.enrolled_at
            }
        })) 
        
        const pagination = {
            currentPage: parseInt(page),
            limit: parseInt(limit),
            totalData: totalData,
            totalPage: totalPage
        }
        const responseData = withPagination({ 
            course: {
                id: course_id,
                title: course?.title,
                proficiencyLevel: course?.proficiency_level
            },
            enrolledUsers
        }, pagination)
        return successResponse(res, responseData, 'Enrolled users retrieved successfully')
    } catch (err) {
        return errorResponse(res, 'Failed to retrieve enrolled users', 500, err)
    }
}