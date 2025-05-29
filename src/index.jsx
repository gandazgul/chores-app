/* @refresh reload */
import { render } from 'solid-js/web'
import App from './App.jsx'
// Use the virtual module for PWA registration
import { registerSW } from 'virtual:pwa-register'

const root = document.getElementById('root')

render(() => <App />, root)

// Register the service worker
const updateSW = registerSW({
  onNeedRefresh() {
    // Show a prompt to the user asking them to refresh the page.
    // You can use a confirm dialog or a more sophisticated UI element.
    if (confirm('New content available, reload?')) {
      updateSW(true); // Reloads the page and activates the new service worker
    }
  },
  onOfflineReady() {
    // Content has been cached for offline use.
    console.log('App is ready to work offline.');
  },
  onRegistered(registration) {
    console.log('Service Worker registered:', registration);
  },
  onRegisterError(error) {
    console.error('Service Worker registration error:', error);
  }
});
