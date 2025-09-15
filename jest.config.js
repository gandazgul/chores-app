export default {
    // Set the test environment
    testEnvironment: 'node',

    // Enable ESM support
    preset: null,
    transform: {},

    // Test file patterns
    testMatch: [
        '**/__tests__/**/*.js',
        '**/?(*.)+(spec|test).js'
    ],

    // Setup and teardown files
    setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],

    // Coverage configuration
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/index.jsx',
        '!src/sw.js',
        '!**/node_modules/**'
    ],

    // Module file extensions
    moduleFileExtensions: ['js', 'json'],

    // Clear mocks between tests
    clearMocks: true,

    // Force exit after tests complete
    forceExit: true,

    // Detect open handles
    detectOpenHandles: true,

    // Timeout for tests
    testTimeout: 30000
};