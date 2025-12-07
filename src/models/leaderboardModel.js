import pool from "../config/db.js"

export const getGlobalLeaderboard = async (limit = 100, offset = 0) => {
    const result = await pool.query(`
        SELECT 
            id,
            username,
            email,
            avatar_url,
            xp,
            level,
            streak,
            created_at,
            RANK() OVER (ORDER BY xp DESC, created_at ASC) as rank,
            ROW_NUMBER() OVER (ORDER BY xp DESC, created_at ASC) as position
        FROM users
        ORDER BY xp DESC, created_at ASC
        LIMIT $1 OFFSET $2
    `, [limit, offset])

    return result.rows
}

export const getTotalUsersCount = async () => {
    const result = await pool.query(`SELECT COUNT(*) FROM users`)
    return parseInt(result.rows[0].count)
}

export const getUserLeaderboardPosition = async (user_id) => {
    const result = await pool.query(`
        WITH ranked_users AS (
            SELECT 
                id,
                RANK() OVER (ORDER BY xp DESC, created_at ASC) as rank,
                ROW_NUMBER() OVER (ORDER BY xp DESC, created_at ASC) as position
            FROM users
        )
        SELECT rank, position
        FROM ranked_users
        WHERE id = $1
    `, [user_id])
    
    return result.rows[0]
}

export const getLeaderboardAroundUser = async (user_id, limit = 5) => {
    const result = await pool.query(`
        WITH ranked_users AS (
            SELECT 
                id,
                username,
                avatar_url,
                xp,
                level,
                streak,
                RANK() OVER (ORDER BY xp DESC, created_at ASC) as rank,
                ROW_NUMBER() OVER (ORDER BY xp DESC, created_at ASC) as row_num
            FROM users
        ),
        user_rank AS (
            SELECT row_num FROM ranked_users WHERE id = $1
        )
        SELECT 
            ru.id,
            ru.username,
            ru.avatar_url,
            ru.xp,
            ru.level,
            ru.streak,
            ru.rank,
            CASE 
                WHEN ru.id = $1 THEN true 
                ELSE false 
            END as is_current_user
        FROM ranked_users ru, user_rank ur
        WHERE ru.row_num BETWEEN ur.row_num - $2 AND ur.row_num + $2
        ORDER BY ru.rank
    `, [user_id, limit])
    
    return result.rows
}

export const getTopUsers = async (limit = 10) => {
    const result = await pool.query(`
        SELECT 
            id,
            username,
            avatar_url,
            xp,
            level,
            streak,
            RANK() OVER (ORDER BY xp DESC, created_at ASC) as rank
        FROM users
        ORDER BY xp DESC
        LIMIT $1
    `, [limit])
    
    return result.rows
}

export const getLeaderboardStat = async () => {
    const result = await pool.query(`
        SELECT 
            COUNT(*) as total_users,
            AVG(xp)::INTEGER as average_xp,
            MAX(xp) as max_xp,
            AVG(level)::NUMERIC(10,1) as average_level,
            MAX(level) as max_level,
            SUM(CASE WHEN streak > 0 THEN 1 ELSE 0 END) as active_users,
            AVG(streak)::NUMERIC(10,1) as average_streak
        FROM users
    `)
    
    return result.rows[0]
}