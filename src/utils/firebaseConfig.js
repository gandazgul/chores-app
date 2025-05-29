import { initializeApp } from "firebase/app";
// Import and initialize Firebase Auth
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBjVO-EIYN7N6sT4hEBxlNTA4Zo9nqJrsw",
  authDomain: "chores-25a18.firebaseapp.com",
  projectId: "chores-25a18",
  storageBucket: "chores-25a18.firebasestorage.app",
  messagingSenderId: "965302916763",
  appId: "1:965302916763:web:7bc4760f8e8b105599583e",
  measurementId: "G-VS8FKP4WHN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { app, auth };
