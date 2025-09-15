import { getMessaging, getToken } from 'firebase/messaging';
import { app, firebaseConfig } from './firebaseConfig.js'; // Import app and firebaseConfig

// Ensure firebaseConfig.vapidKey is defined in your firebaseConfig.js
// TODO: Add your VAPID key to firebaseConfig.js:
// const firebaseConfig = {
//   ...
//   vapidKey: "YOUR_VAPID_KEY"
// };

const requestNotificationPermissionAndToken = async () => {
  if (!('Notification' in window)) {
    console.error('This browser does not support desktop notification');
    alert('This browser does not support desktop notification');

    return null;
  }

  if (!firebaseConfig.vapidKey) {
    console.error('VAPID key is not set in firebaseConfig.js. Please add it to enable push notifications.');
    alert('Push notification setup is incomplete. Administrator needs to configure VAPID key.');

    return null;
  }

  const messagingInstance = getMessaging(app);

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notification permission granted.');
      const swRegistration = await navigator.serviceWorker.getRegistration();

      const currentToken = await getToken(messagingInstance, {
        vapidKey: firebaseConfig.vapidKey,
        serviceWorkerRegistration: swRegistration,
      });

      if (currentToken) {
        console.log('FCM Token:', currentToken);

        return currentToken;
      }
      else {
        console.log('No registration token available. Request permission to generate one.');

        return null;
      }
    }
    else {
      console.log('Unable to get permission to notify.');

      return null;
    }
  }
  catch (error) {
    console.error('An error occurred while getting token. ', error);

    return null;
  }
};

import { saveFCMToken as saveFCMTokenAPI } from '../api';

async function saveFCMToken(userId, token) {
    if (!userId || !token) {
        console.error('User ID and token are required to save FCM token.');
        return null;
    }

    try {
        const data = await saveFCMTokenAPI(userId, token);
        console.log('FCM token saved to database:', data);
        return data;
    } catch (err) {
        console.error('Unexpected error saving FCM token:', err);
        return null;
    }
}


export { requestNotificationPermissionAndToken, saveFCMToken };
