import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';

// Set up environment variables for testing
process.env.NODE_ENV = 'test';
process.env.VITE_SKIP_AUTH = 'true';

/**
 * Global setup for Jest tests
 * This file runs before all tests and sets up the testing environment
 */
beforeAll(() => {
    console.log('🧪 Starting Jest test suite');
});

afterAll(() => {
    console.log('✅ Jest test suite completed');
});