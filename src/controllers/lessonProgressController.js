import pool from "../config/db.js"
import { errorResponse, notFoundResponse, successResponse } from "../helper/common.js"
import { getLessonOrder, getLessonWithCourse, getTotalLessonsInCourse } from "../models/lessonModel.js"
import { areAllLessonsCompleted, awardXpForCourse, awardXpForLesson, checkAndAwardBadges, checkCourseEnrollment, completeLesson, getCourseProgressStats, getLessonProgress, getNextLesson, updateCourseEnrollmentProgress } from "../models/lessonProgressModel.js"

export const finishLesson = async (req, res) => {
    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        const user_id = req.user.id
        const lesson_id = parseInt(req.params.lesson_id)

        const lesson = await getLessonWithCourse(lesson_id)
        if(!lesson){
            await client.query('ROLLBACK')
            return notFoundResponse(res, 'Lesson')
        }

        const enrollment = await checkCourseEnrollment(user_id, lesson.course_id)
        if(!enrollment) {
            await client.query('ROLLBACK')
            return errorResponse(res, 'You are not enrolled in this course. Please enroll first', 403)
        }

        const existingProgress = await getLessonProgress(user_id, lesson_id)
        if(existingProgress&&existingProgress.status === 'completed') {
            await client.query('ROLLBACK')
            return res.status(409).json({
                success: false,
                message: 'Lesson already completed',
                data: {
                    lessonId: lesson_id,
                    completedAt: existingProgress.completed_at
                }
            })
        }

        await completeLesson(client, user_id, lesson_id)

        const lessonXp = 25
        await awardXpForLesson(client, user_id, lesson_id, lessonXp)
        
        const progressStats = await getCourseProgressStats(client, user_id, lesson.course_id)
        const totalLessons = await getTotalLessonsInCourse(lesson.course_id)
        const progressPercent = Math.round((progressStats.completed_lessons / totalLessons) * 100)

        await updateCourseEnrollmentProgress(client, user_id, lesson.course_id, progressPercent)
        const allCompleted = await areAllLessonsCompleted(client, user_id, lesson.course_id)

        let courseCompletionData = null
        let awardedBadges = []

        if(allCompleted) {
            if(lesson.course_xp_reward > 0) {
                await awardXpForCourse(client, user_id, lesson.course_id, lesson.course_xp_reward)
            }

            awardedBadges = await checkAndAwardBadges(client, user_id, lesson.course_id)

            courseCompletionData = {
                courseCompleted: true,
                xpAwarded: lesson.course_xp_reward,
                badgesAwarded: awardedBadges.map(b => ({
                    id: b.id,
                    name: b.name,
                    iconUrl: b.icon_url,
                    xpReward: b.xp_reward
                }))
            }
        }

        const totalXpEarned = lessonXp + (allCompleted ? lesson.course_xp_reward : 0)

        const lessonOrder = await getLessonOrder(lesson_id)
        const nextLesson = await getNextLesson(lesson.course_id, lessonOrder.order_index)

        await client.query('COMMIT')

        const responseData = {
            lesson: {
                id: lesson.id,
                title: lesson.title,
                courseId: lesson.course_id,
                courseTitle: lesson.course_title
            },
            progress: {
                completedLessons: progressStats.completed_lessons,
                totalLessons: totalLessons,
                percentage: progressPercent,
                status: allCompleted ? 'course_completed' : 'in_progress'
            },
            rewards: {
                xpEarned: lessonXp,
                totalXpEarned: totalXpEarned
            },
            nextLesson: nextLesson ? {
                id: nextLesson.id,
                title: nextLesson.title,
                orderIndex: nextLesson.order_index
            } : null,
            ...(allCompleted && courseCompletionData ? { courseCompletion: courseCompletionData } : {})
        }
        

        return successResponse(res, responseData, 'Lesson completed successfully')
    } catch (err) {
        await client.query('ROLLBACK')

        return errorResponse(res, 'Failed to complete lesson', 500, err)
    } finally {
        client.release()
    }
}

export const startLesson = async (req, res) => {
    const client = await pool.connect() 
    
    try {
        await client.query('BEGIN')
        
        const user_id = req.user.id
        const lesson_id = req.params.lesson_id 
        
        const lesson = await getLessonWithCourse(lesson_id) 
        if (!lesson) {
            await client.query('ROLLBACK') 
            return notFoundResponse(res, 'Lesson') 
        }
        
        const enrollment = await checkCourseEnrollment(user_id, lesson.course_id) 
        if (!enrollment) {
            await client.query('ROLLBACK') 
            return errorResponse(res, 'You are not enrolled in this course', 403) 
        }
        
        const existingProgress = await getLessonProgress(user_id, lesson_id) 
        
        if (existingProgress) {
            if (existingProgress.status === 'completed') {
                await client.query('ROLLBACK') 
                return res.status(409).json({
                    success: false,
                    message: 'Lesson already completed',
                    data: {
                        startedAt: existingProgress.started_at,
                        completedAt: existingProgress.completed_at
                    }
                }) 
            }
            
            if (existingProgress.status === 'in_progress') {
                await client.query('ROLLBACK') 
                return res.status(200).json({
                    success: true,
                    message: 'Lesson already in progress',
                    data: {
                        lessonId: lesson_id,
                        startedAt: existingProgress.started_at
                    }
                }) 
            }
        }
        
        const progress = await pool.query(`
            INSERT INTO lesson_progress 
            (user_id, lesson_id, status, started_at, updated_at)
            VALUES ($1, $2, 'in_progress', NOW(), NOW())
            ON CONFLICT (user_id, lesson_id) 
            DO UPDATE SET 
                status = 'in_progress',
                started_at = CASE 
                    WHEN lesson_progress.started_at IS NULL THEN NOW()
                    ELSE lesson_progress.started_at 
                END,
                updated_at = NOW()
            RETURNING *
        `, [user_id, lesson_id]) 
        
        await client.query('COMMIT') 
        
        return successResponse(res, {
            lessonId: lesson_id,
            status: 'in_progress',
            startedAt: progress.rows[0].started_at
        }, 'Lesson started successfully') 
        
    } catch (err) {
        await client.query('ROLLBACK') 
        console.error('Start lesson error:', err) 
        
        return errorResponse(res, 'Failed to start lesson', 500, err) 
    } finally {
        client.release() 
    }
}

export const lessonProgress = async (req, res) => {
    try {
        const user_id = req.user.id 
        const lesson_id = req.params.lesson_id 
        console.log(lesson_id)
        
        const lesson = await getLessonWithCourse(lesson_id) 
        if (!lesson) {
            return notFoundResponse(res, 'Lesson') 
        }
        
        const progress = await getLessonProgress(user_id, lesson_id) 
        
        const enrollment = await checkCourseEnrollment(user_id, lesson.course_id) 
        
        const lessonOrder = await getLessonOrder(lesson_id) 
        const nextLesson = await getNextLesson(lesson.course_id, lessonOrder.order_index) 
        
        const courseStats = await pool.query(`
            SELECT 
                COUNT(l.id) as total_lessons,
                COUNT(lp.lesson_id) as completed_lessons
            FROM lessons l
            LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id 
                AND lp.user_id = $1 
                AND lp.status = 'completed'
            WHERE l.course_id = $2
        `, [user_id, lesson.course_id]) 
        
        const responseData = {
            lesson: {
                id: lesson.id,
                title: lesson.title,
                orderIndex: lesson.order_index,
                courseId: lesson.course_id,
                courseTitle: lesson.course_title,
                videoUrl: lesson.videos,
                overview: lesson.overviews,
                estimatedDuration: lesson.estimated_duration
            },
            enrollment: enrollment ? {
                status: enrollment.status,
                progress: enrollment.percent_progress,
                startedAt: enrollment.started_at
            } : null,
            progress: progress ? {
                status: progress.status,
                startedAt: progress.started_at,
                completedAt: progress.completed_at,
                lastUpdated: progress.updated_at
            } : {
                status: 'not_started'
            },
            courseProgress: {
                completedLessons: parseInt(courseStats.rows[0].completed_lessons),
                totalLessons: parseInt(courseStats.rows[0].total_lessons),
                percentage: courseStats.rows[0].total_lessons > 0 
                    ? Math.round((parseInt(courseStats.rows[0].completed_lessons) / parseInt(courseStats.rows[0].total_lessons)) * 100)
                    : 0
            },
            nextLesson: nextLesson ? {
                id: nextLesson.id,
                title: nextLesson.title,
                orderIndex: nextLesson.order_index
            } : null
        } 
        
        return successResponse(res, responseData, 'Lesson progress retrieved successfully') 
        
    } catch (err) {
        console.error('Get lesson progress error:', err) 
        return errorResponse(res, 'Failed to get lesson progress', 500, err) 
    }
}

export const courseProgress = async (req, res) => {
    try {
        const user_id = req.user.id 
        const course_id = req.params.course_id 
        
        const enrollment = await checkCourseEnrollment(user_id, course_id) 
        if (!enrollment) {
            return errorResponse(res, 'You are not enrolled in this course', 404) 
        }
        
        const courseResult = await pool.query(`
            SELECT * FROM courses WHERE id = $1
        `, [course_id]) 
        
        if (courseResult.rows.length === 0) {
            return notFoundResponse(res, 'Course') 
        }
        
        const course = courseResult.rows[0] 
        
        const lessonsResult = await pool.query(`
            SELECT 
                l.id,
                l.title,
                l.order_index,
                l.videos,
                l.overviews,
                l.estimated_duration,
                COALESCE(lp.status, 'not_started') as status,
                lp.started_at,
                lp.completed_at
            FROM lessons l
            LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id 
                AND lp.user_id = $1
            WHERE l.course_id = $2
            ORDER BY l.order_index
        `, [user_id, course_id]) 
        
        const totalLessons = lessonsResult.rows.length 
        const completedLessons = lessonsResult.rows.filter(l => l.status === 'completed').length 
        const inProgressLessons = lessonsResult.rows.filter(l => l.status === 'in_progress').length 
        
        const xpResult = await pool.query(`
            SELECT 
                COALESCE(SUM(CASE 
                    WHEN source = 'lesson_completion' THEN xp_amount
                    ELSE 0
                END), 0) as lesson_xp,
                COALESCE(SUM(CASE 
                    WHEN source = 'course_completion' THEN xp_amount
                    ELSE 0
                END), 0) as course_xp
            FROM xp_transactions
            WHERE user_id = $1 
                AND (
                    reference_id::text IN (
                        SELECT id::text FROM lessons WHERE course_id = $2
                    )
                    OR reference_id = $2::integer
                )
        `, [user_id, course_id]) 
        
        const xpEarned = xpResult.rows[0] || { lesson_xp: 0, course_xp: 0 } 
        const totalXpEarned = xpEarned.lesson_xp + xpEarned.course_xp 
        
        const responseData = {
            course: {
                id: course.id,
                title: course.title,
                description: course.description,
                thumbnailUrl: course.thumbnail_url,
                proficiencyLevel: course.proficiency_level,
                estimatedDuration: course.estimated_duration,
                totalXpReward: course.xp_reward
            },
            enrollment: {
                status: enrollment.status,
                progress: enrollment.percent_progress,
                startedAt: enrollment.started_at,
                completedAt: enrollment.completed_at
            },
            statistics: {
                lessons: {
                    total: totalLessons,
                    completed: completedLessons,
                    inProgress: inProgressLessons,
                    notStarted: totalLessons - completedLessons - inProgressLessons,
                    completionRate: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0
                },
                xp: {
                    earned: totalXpEarned,
                    fromLessons: xpEarned.lesson_xp,
                    fromCourse: xpEarned.course_xp,
                    remaining: Math.max(0, course.xp_reward - totalXpEarned)
                }
            },
            lessons: lessonsResult.rows.map(lesson => ({
                id: lesson.id,
                title: lesson.title,
                order: lesson.order_index,
                status: lesson.status,
                duration: lesson.estimated_duration,
                startedAt: lesson.started_at,
                completedAt: lesson.completed_at,
            }))
        } 
        
        return successResponse(res, responseData, 'Course progress retrieved successfully') 
        
    } catch (err) {
        console.error('Get course progress error:', err) 
        return errorResponse(res, 'Failed to get course progress', 500, err) 
    }
}