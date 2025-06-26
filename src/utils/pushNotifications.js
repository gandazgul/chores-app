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
      const currentToken = await getToken(messagingInstance, {
        vapidKey: firebaseConfig.vapidKey,
      });
      if (currentToken) {
        console.log('FCM Token:', currentToken);
        return currentToken;
      } else {
        console.log('No registration token available. Request permission to generate one.');
        return null;
      }
    } else {
      console.log('Unable to get permission to notify.');
      return null;
    }
  } catch (error) {
    console.error('An error occurred while getting token. ', error);
    return null;
  }
};

const saveFCMTokenToSupabase = async (userId, token) => {
  if (!userId || !token) {
    console.error('User ID and token are required to save FCM token.');
    return null;
  }

  // Assuming you have supabase client imported and configured
  // You might need to import it if it's not globally available or passed in
  // import { supabase } from './supabaseConfig'; // Or wherever your supabase client is

  // Use supabase client from window if available, or import it.
  // This example assumes supabase is available globally or imported within this scope.
  // For a cleaner approach, ensure supabase client is properly imported.
  const { supabase } = await import('./supabaseConfig.js');


  try {
    const { data, error } = await supabase
      .from('user_fcm_tokens')
      .upsert({ user_id: userId, fcm_token: token }, { onConflict: 'fcm_token' }) // Upsert based on fcm_token to avoid duplicates for the same token
      .select(); // Optionally select the inserted/updated row

    if (error) {
      console.error('Error saving FCM token to Supabase:', error);
      // If the error is due to a unique constraint violation on (user_id, fcm_token)
      // and you want to treat it as a success (token already exists for user),
      // you might need more specific error handling here.
      // For now, we consider any error as a failure.
      if (error.code === '23505') { // Unique violation
        // Check if it's a duplicate for the same user, which is fine.
        // A more robust check might involve querying first.
        console.log('FCM token already exists for this user or another user.');
        // If we want to ensure one token per user, the upsert should be on user_id
        // and update the token if it changes.
        // Current onConflict: 'fcm_token' means if this token exists for *any* user, it updates.
        // If we want one token per user, and a user can have only one token:
        // .upsert({ user_id: userId, fcm_token: token }, { onConflict: 'user_id' })
        // For now, let's stick to onConflict: 'fcm_token' which is simpler if tokens are globally unique.
      }
      return null;
    }
    console.log('FCM token saved to Supabase:', data);
    return data;
  } catch (err) {
    console.error('Unexpected error saving FCM token:', err);
    return null;
  }
};


export { requestNotificationPermissionAndToken, saveFCMTokenToSupabase };
