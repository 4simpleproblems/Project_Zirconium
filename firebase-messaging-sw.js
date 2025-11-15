// --- Firebase Messaging Service Worker ---
// This file must be placed in the ROOT directory of your web app (e.g., your_project_root/firebase-messaging-sw.js)

// Import the Firebase components needed for the Service Worker (compatibility version)
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js');

// !!! IMPORTANT: You MUST replace these placeholders with your actual Firebase config details.
// You can copy this from your project settings in the Firebase Console.
const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize the Firebase app
firebase.initializeApp(firebaseConfig);

// Retrieve the Firebase Messaging service worker instance
const messaging = firebase.messaging();

/**
 * Handles incoming push messages when the app is in the background or closed.
 * The payload structure matches the one sent from your Cloud Functions.
 */
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        // The icon path must be correct relative to the root (as used in functions/index.js)
        icon: payload.notification.icon || '/images/logo.png',
        data: payload.data, // Contains action type ('VIEW_POST', 'VIEW_REQUESTS', etc.)
    };

    // Show the notification using the Service Worker's registration
    self.registration.showNotification(notificationTitle, notificationOptions);
});

/**
 * Handles what happens when the user clicks the notification.
 * It uses the 'action' data sent from the Cloud Function to determine the destination URL.
 */
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    let url = '/dailyphoto.html'; 
    const action = event.notification.data?.action;

    if (action === 'VIEW_POST' && event.notification.data?.postId) {
        url = `/dailyphoto.html?view=post&id=${event.notification.data.postId}`;
    } else if (action === 'VIEW_REQUESTS') {
        url = `/dailyphoto.html?view=friends`; // Redirects to the page to manage requests
    } else if (action === 'FRIEND_ACCEPTED') {
        url = `/dailyphoto.html?view=friends`;
    }
    
    // Look at all the window clients (browser tabs) and focus an existing one or open a new one
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes(url) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});
