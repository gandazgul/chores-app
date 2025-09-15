import cleanupTestDatabase from '../scripts/test-db-cleanup.js';

export async function cleanTestData() {
    await cleanupTestDatabase();
}