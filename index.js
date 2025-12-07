import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import helmet from 'helmet'
import morgan from 'morgan'


import authRoute from './src/routes/authRoute.js'
import profileRoute from './src/routes/profileRoute.js'
import learnRoute from './src/routes/learnRoute.js'
import practiceRoute from './src/routes/practiceRoute.js'
import leaderboardRoute from './src/routes/leaderboardRoutes.js'

// ADMIN
import userRoute from './src/routes/userRoute.js'
import courseRoute from './src/routes/courseRoute.js'
import lessonRoute from './src/routes/lessonRoute.js'
import collectionRoute from './src/routes/collectionRoute.js'
import quizRoute from './src/routes/quizRoute.js'
import questionRoute from './src/routes/questionRoute.js'
import badgeRoute from './src/routes/badgeRoute.js'

dotenv.config()
const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended:true }))
app.use(morgan('dev'))
app.use(cors({
    origin: ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE']
}))
app.use(helmet())

app.use('/auth', authRoute)
app.use('/profile', profileRoute)
app.use('/learn', learnRoute)
app.use('/practice', practiceRoute)
app.use('/leaderboard', leaderboardRoute)

app.use('/admin/users', userRoute)
app.use('/admin/courses', courseRoute)
app.use('/admin/lessons', lessonRoute)
app.use('/admin/collections', collectionRoute)
app.use('/admin/quizzes', quizRoute)
app.use('/admin/questions', questionRoute)
app.use('/admin/badges', badgeRoute)

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`)
})