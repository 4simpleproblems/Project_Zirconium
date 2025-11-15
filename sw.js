// [START initialize_firebase_in_sw]

// ⚠️ IMPORTANT: These scripts must use the compatibility version of the Firebase SDK
// and MUST be accessible via Google's CDN.
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// 🚨 REQUIRED ACTION: As the Service Worker runs in a separate thread and context, 
// you MUST manually copy the contents of your `firebaseConfig` object from 
const firebaseConfig = {
  apiKey: "AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro",
  authDomain: "project-zirconium.firebaseapp.com",
  projectId: "project-zirconium",
  storageBucket: "project-zirconium.firebasestorage.app",
  messagingSenderId: "1096564243475",
  appId: "1:1096564243475:web:6d0956a70125eeea1ad3e6",
  measurementId: "G-1D4F692C1Q"
};

// Initialize Firebase in the service worker.
firebase.initializeApp(firebaseConfig);

// Retrieve the messaging module.
const messaging = firebase.messaging();

// Handle incoming messages in the background (when the app is closed or in a background tab).
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    // Default title if not provided by the message payload
    const notificationTitle = payload.notification?.title || 'New 4SP Notification';
    
    // Customize notification options
    const notificationOptions = {
        body: payload.notification?.body || 'You have a new update.',
        icon: '../images/logo.png', // ⬅️ UPDATED ICON PATH
        // Arbitrary data passed with the message, often used for click tracking
        data: payload.data 
    };

    // Display the notification
    self.registration.showNotification(notificationTitle, notificationOptions);
});

// [END initialize_firebase_in_sw]
