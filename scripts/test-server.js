// Set NODE_ENV to test before importing anything
process.env.NODE_ENV = 'test';
process.env.VITE_SKIP_AUTH = 'true';

// Now import and start the server
import '../server.js';