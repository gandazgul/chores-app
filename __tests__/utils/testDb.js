import knex from 'knex';
import config from '../../knexfile.js';

// Simple UUID generator for predictable test IDs
let testUuidCounter = 0;
function generateTestUuid() {
    return `test-uuid-${String(testUuidCounter++).padStart(3, '0')}`;
}

// Reset counter function to be used by tests
export function resetTestUuidCounter() {
    testUuidCounter = 0;
}

const testDb = knex(config.test);

/**
 * Test database utilities for Jest integration tests
 */
class TestDbUtils {
    constructor() {
        this.db = testDb;
    }

    /**
     * Set up test database - run migrations and prepare for testing
     */
    async setup() {
        try {
            // Run migrations to ensure database schema is up to date
            await this.db.migrate.latest();
        }
        catch (error) {
            console.error('❌ Test database setup failed:', error);
            throw error;
        }
    }

    /**
     * Clean up test database - remove all test data
     */
    async cleanup() {
        try {
            // Clear all test data while preserving the schema
            await this.db('user_fcm_tokens').del();
            await this.db('chores').del();
            await this.db('users').del();
        }
        catch (error) {
            console.error('❌ Test database cleanup failed:', error);
            throw error;
        }
    }

    /**
     * Destroy the database connection
     */
    async destroy() {
        await this.db.destroy();
    }

    /**
     * Create test user data
     * @param {Object} userData - User data to insert
     * @returns {Promise<Object>} Created user data
     */
    async createTestUser(userData = {}) {
        const defaultUser = {
            id: 'test-user-' + generateTestUuid(),
            email: `test-${Date.now()}@example.com`,
            ...userData
        };

        await this.db('users').insert(defaultUser);

        return defaultUser;
    }

    /**
     * Create test chore data
     * @param {Object} choreData - Chore data to insert
     *
     * @returns {Promise<Object>} Created chore data
     */
    async createTestChore(choreData = {}) {
        const defaultChore = {
            id: generateTestUuid(),
            user_id: 'test-user-123',
            title: 'Test Chore',
            description: 'This is a test chore',
            priority: 1,
            done: false,
            ...choreData
        };

        // Handle recurrence field - ensure it's properly serialized
        if (defaultChore.recurrence && typeof defaultChore.recurrence === 'object') {
            defaultChore.recurrence = JSON.stringify(defaultChore.recurrence);
        }

        await this.db('chores').insert(defaultChore);

        return defaultChore;
    }

    /**
     * Seed the database with test data
     * @param {string} userId - User ID to create chores for
     * @returns {Array} Array of created chores
     */
    async seedTestData(userId = 'test-user-123') {
        // Create test user first
        await this.createTestUser({ id: userId });

        // Create test chores
        const testChores = [
            {
                user_id: userId,
                title: 'Wash the dishes',
                description: 'Wash all the dishes in the sink.',
                priority: 1,
                done: false,
            },
            {
                user_id: userId,
                title: 'Take out the trash',
                description: 'Take out the trash and recycling.',
                priority: 2,
                done: true,
            },
            {
                user_id: userId,
                title: 'Clean the bathroom',
                description: 'Clean the toilet, sink, and shower.',
                priority: 3,
                done: false,
                recurrence: {
                    type: 'weekly',
                    interval: 1,
                    daysOfWeek: ['Monday']
                }
            }
        ];

        const createdChores = [];
        for (const choreData of testChores) {
            const chore = await this.createTestChore(choreData);
            createdChores.push(chore);
        }

        return createdChores;
    }
}

export default TestDbUtils;