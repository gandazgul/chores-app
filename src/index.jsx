/* @refresh reload */
import { createRoot } from 'react-dom/client';
import './utils/firebaseConfig.js'; // Initialize Firebase
import App from './App.jsx';
// Use the virtual module for PWA registration
import { registerSW } from 'virtual:pwa-register';

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);

// Register the service worker
const updateSW = registerSW({
  onNeedRefresh() {
    // Show a prompt to the user asking them to refresh the page.
    if (confirm('New content available, reload?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('App is ready to work offline.');
  },
  onRegistered(registration) {
    console.log('Service Worker registered:', registration);
  },
  onRegisterError(error) {
    console.error('Service Worker registration error:', error);
  }
});
