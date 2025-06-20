import knex from 'knex';

import config from '../../knexfile';

const environment = process.env.NODE_ENV || 'development';
const knexConfig = config[environment];

if(!config) {
    throw new Error(`No database configuration found for environment: ${environment}`);
}

export const db = knex(knexConfig);

const testConnection = async () => {
    try {
        await db.raw('SELECT 1');
        console.log(`✅ Database connected successfully to ${knexConfig.connection.database}`);
    } catch (error) {
        console.error(`❌ Database connection failed to ${knexConfig.connection.database}:`, error);
        throw error;
    }
}

testConnection();

export default db;