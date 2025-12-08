export const updateStreak = async (client, user_id) => {
    const userResult = await client.query(`
        SELECT last_active, streak FROM users WHERE id = $1    
    `, [user_id])

    const user = userResult.rows[0]
    const today = new Date().toLocaleDateString('en-CA').split('T')[0]
    const lastActive = user.last_active ? new Date(user.last_active).toLocaleDateString('en-CA').split('T')[0] : null

    let newStreak = user.streak
    if(!lastActive) {
        newStreak = 1
    } else if(lastActive === today) {
        return newStreak
    } else {
        const lastActiveDate = new Date(lastActive)
        const todayDate = new Date(today)
        const daysDiff = Math.floor((todayDate - lastActiveDate) / (1000 * 60 * 60 * 24))

        if(daysDiff === 1) {
            newStreak += 1
        } else {
            newStreak = 1
        }
    }

    await client.query(`
        UPDATE users
        SET streak = $1, last_active = $2, updated_at = NOW()
        WHERE id = $3    
    `, [newStreak, today, user_id])

    return newStreak
}