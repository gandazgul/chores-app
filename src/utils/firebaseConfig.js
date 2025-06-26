import { initializeApp } from 'firebase/app';
import { getMessaging } from 'firebase/messaging';

// TODO: Replace with your Firebase project's configuration
const firebaseConfig = {
  apiKey: "AIzaSyBjVO-EIYN7N6sT4hEBxlNTA4Zo9nqJrsw",
  projectId: "chores-25a18",
  messagingSenderId: "965302916763",
  appId: "1:965302916763:web:7bc4760f8e8b105599583e",
  vapidKey: "BBg85IkPHxZvi_FD90Uglf8lYG8MIJsSkeqdXgZpUIxD2Xqi0H7sNRuatBKn1Ik_PuLxR8O1YG-cLg9LXliZTTw" // User provided
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export { app, messaging, firebaseConfig };
