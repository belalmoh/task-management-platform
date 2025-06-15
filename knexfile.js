require('dotenv').config();

require('ts-node').register({
    compilerOptions: {
        module: 'commonjs'
    }
});

module.exports = {
    development: {
        client: 'postgresql',
        connection: {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME || 'task_management_dev',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'password'
        },
        migrations: {
            directory: './src/database/migrations',
        },
        seeds: {
            directory: './src/database/seeds',
        },
        pool: {
            min: 2,
            max: 10
        },
    },
    test: {
        client: 'postgresql',
        connection: {
            host: process.env.TEST_DB_HOST || 'localhost',
            port: parseInt(process.env.TEST_DB_PORT || '5432'),
            database: process.env.TEST_DB_NAME || 'task_management_test',
            user: process.env.TEST_DB_USER || 'postgres',
            password: process.env.TEST_DB_PASSWORD || 'password'
        },
        migrations: {
            directory: './src/database/migrations',
            extension: 'ts'
        },
        pool: {
            min: 1,
            max: 5
        }
    }
}