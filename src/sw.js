import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { StaleWhileRevalidate, NetworkFirst } from 'workbox-strategies';

// Firebase imports
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';
import { firebaseConfig } from './utils/firebaseConfig-data.js'; // Adjust path as necessary

// Initialize Firebase app and messaging
if (firebaseConfig && firebaseConfig.projectId) {
  const firebaseApp = initializeApp(firebaseConfig);
  const messaging = getMessaging(firebaseApp);

  onBackgroundMessage(messaging, (payload) => {
    console.log('[Service Worker] Received background message ', payload);
    // Customize notification here
    const notificationTitle = payload.notification?.title || 'New Message';
    const notificationOptions = {
      body: payload.notification?.body || 'You have a new message.',
      icon: payload.notification?.icon || '/icon.png', // Default icon
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} else {
  console.error('[Service Worker] Firebase config not found or incomplete. Background messaging will not work.');
}


// Precache all assets defined in the Workbox configuration
// Make sure __WB_MANIFEST is populated by Workbox CLI
precacheAndRoute(self.__WB_MANIFEST || []);

// Handle navigations (SPA support)
if (import.meta.env.PROD && self.__WB_MANIFEST && self.__WB_MANIFEST.find(entry => entry.url === 'index.html' || entry.url === '/index.html')) {
  // In production, if index.html is precached, use createHandlerBoundToURL
  console.log('[Service Worker] Production mode: Using createHandlerBoundToURL for navigation.');
  const handler = createHandlerBoundToURL('/index.html');
  const navigationRoute = new NavigationRoute(handler, {
    // denylist: [/^\/_/, /\/[^/]+\.[^/]+$/], // Example: ignore files with extensions or starting with _
  });
  registerRoute(navigationRoute);
} else if (import.meta.env.DEV) {
  // In dev mode, use a NetworkFirst strategy for navigation.
  // This avoids issues with createHandlerBoundToURL if index.html isn't in the (likely empty) dev precache manifest.
  console.log('[Service Worker] Development mode: Using NetworkFirst for navigation.');
  registerRoute(
    ({request}) => request.mode === 'navigate',
    new NetworkFirst({
      cacheName: 'dev-navigation-cache',
      networkTimeoutSeconds: 3, // Optional: Timeout for network before falling back to cache
      // plugins: [ // Optional: Add a CacheableResponsePlugin if you want to cache only 200 responses
      //   new workbox.cacheableResponse.CacheableResponsePlugin({
      //     statuses: [0, 200], 
      //   }),
      // ],
    })
  );
}
// Note: For a production build without index.html in __WB_MANIFEST (e.g. if it's dynamically generated or not meant to be precached),
// you might need a similar NetworkFirst or StaleWhileRevalidate strategy for navigation for production as well.
// The current `if (import.meta.env.PROD && ...)` assumes index.html WILL be in the prod manifest.

// Example: Cache API calls
registerRoute(
  ({url}) => url.pathname.startsWith('/api/'),
  new StaleWhileRevalidate({
    cacheName: 'api-cache',
  })
);

// The generic 'push' event listener might be redundant if FCM's onBackgroundMessage is handling everything.
// However, it can be a fallback or for non-FCM push events.
// For FCM, onBackgroundMessage is preferred.
// self.addEventListener('push', (event) => {
//   console.log('[Service Worker] Generic push event received:', event);
//   const title = 'New Chore Alert!';
//   const options = {
//     body: event.data ? event.data.text() : 'Something new happened!',
//     // icon: 'images/icon.png', 
//     // badge: 'images/badge.png' 
//   };
//   event.waitUntil(self.registration.showNotification(title, options));
// });

self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click Received.', event.notification.data);
  event.notification.close();
  // Optional: Add logic to open a specific page or perform an action
  // event.waitUntil(
  //   clients.openWindow('https://example.com')
  // );
});

// Skip waiting and activate new service worker immediately
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
