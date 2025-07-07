import { initializeApp } from 'firebase/app';
import { getMessaging } from 'firebase/messaging';
import { firebaseConfig } from './firebaseConfig-data.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export { app, messaging, firebaseConfig };
