// --- Firebase Messaging Service Worker ---
// This file must be placed in the ROOT directory of your web app (e.g., your_project_root/firebase-messaging-sw.js)

// Import the Firebase components needed for the Service Worker (compatibility version)
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js');

// 🚨 IMPORTANT: The configuration details MUST be correct.
// Using the config that was identified in previous steps
const firebaseConfig = {
    apiKey: "AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro",
    authDomain: "project-zirconium.firebaseapp.com",
    projectId: "project-zirconium",
    storageBucket: "project-zirconium.firebasestorage.app",
    messagingSenderId: "1096564243475",
    appId: "1:1096564243475:web:6d0956a70125eeea1ad3e6" 
};

// Initialize the Firebase app
firebase.initializeApp(firebaseConfig);

// Retrieve the Firebase Messaging service worker instance
const messaging = firebase.messaging();

/**
 * Handles incoming push messages when the app is in the background or closed.
 * NOW INCLUDES RICH OPTIONS FOR CHROMEOS DISPLAY
 */
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    const notificationTitle = payload.notification.title;
    const notificationBody = payload.notification.body;

    let actions = [];
    try {
        // Safely parse actions string from data payload
        if (payload.data.actions) {
            actions = JSON.parse(payload.data.actions);
        }
    } catch (e) {
        console.error("Failed to parse notification actions:", e);
    }

    const notificationOptions = {
        body: notificationBody,
        icon: payload.notification.icon || '/images/logo.png',
        image: payload.notification.image, // Add the larger image for rich display
        data: payload.data, 
        
        // Add action buttons
        actions: actions
    };

    // Show the notification using the Service Worker's registration
    self.registration.showNotification(notificationTitle, notificationOptions);
});

/**
 * Handles what happens when the user clicks the notification or one of its action buttons.
 */
self.addEventListener('notificationclick', (event) => {
    // Determine if an action button was clicked or the main body
    const clickedAction = event.action;
    event.notification.close();
    
    let url = '/dailyphoto.html'; 
    const payloadData = event.notification.data;

    // --- Action Button Handling (for rich notifications) ---
    if (clickedAction === 'view-requests-action') {
        url = `/dailyphoto.html?view=friends`;
    } else if (clickedAction === 'share-daily-action') {
        url = `/dailyphoto.html?view=share`;
    } 
    // --- Main Notification Body Click Handling (fallback to existing logic) ---
    else {
        const actionType = payloadData.action;

        if (actionType === 'VIEW_POST' && payloadData.postId) {
            url = `/dailyphoto.html?view=post&id=${payloadData.postId}`;
        } else if (actionType === 'VIEW_REQUESTS') {
            url = `/dailyphoto.html?view=friends`;
        } else if (actionType === 'FRIEND_ACCEPTED') {
            url = `/dailyphoto.html?view=friends`;
        } else if (payloadData.click_action) {
            // Use the click_action specified in the data payload as a fallback default URL
            url = payloadData.click_action; 
        }
    }
    
    // Look at all the window clients (browser tabs) and focus an existing one or open a new one
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            for (const client of clientList) {
                // If a client is already open at the target URL, focus it
                if (client.url.includes(url) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise, open a new window
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});
