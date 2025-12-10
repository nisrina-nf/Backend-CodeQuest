process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

import pkg from 'pg'
import dotenv from 'dotenv'
dotenv.config()

const { Pool } = pkg

const pool = new Pool ({
    connectionString: process.env.POSTGRES_URL_NON_POOLING,
    ssl: {
        rejectUnauthorized: false,
        require: true
    }
})

export default pool