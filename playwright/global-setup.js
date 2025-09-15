import knex from 'knex';
import config from '../knexfile.js';
import cleanupTestDatabase from '../scripts/test-db-cleanup.js';

async function globalSetup() {
    console.log('Setting up test database...');

    const db = knex(config.test);

    try {
        // Run migrations to ensure the test database schema is up to date
        await db.migrate.latest();
        console.log('Test database migrations complete');

        // Clean the database before tests
        await cleanupTestDatabase();
        console.log('Test database cleaned');

    } catch (error) {
        console.error('Error during test setup:', error);
        throw error;
    } finally {
        await db.destroy();
    }
}

export default globalSetup;