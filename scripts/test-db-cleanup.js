import knex from 'knex';
import config from '../knexfile.js';

const db = knex(config.test);

async function cleanupTestDatabase() {
    try {
        // Clear all test data while preserving the schema
        await db('user_fcm_tokens').del();
        await db('chores').del();
        await db('users').del();

        console.log('Test database cleaned successfully');
    }
    catch (error) {
        console.error('Error cleaning test database:', error);
        throw error;
    }
    finally {
        await db.destroy();
    }
}

// If this script is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    cleanupTestDatabase().catch(console.error);
}

export default cleanupTestDatabase;