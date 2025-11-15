import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";
import { getFirestore, doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getMessaging } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";

// Save the token to the user's profile
async function saveTokenToProfile(db, token) {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
        const userProfileRef = doc(db, 'users', user.uid);
        try {
            await updateDoc(userProfileRef, {
                fcmToken: token,
                tokenTimestamp: serverTimestamp()
            });
            console.log('FCM token saved to profile.');
        } catch (error) {
            console.error('Error saving FCM token to profile: ', error);
        }
    }
}

// Initialize Firebase Cloud Messaging
function initializeFCM(messaging) {
    onMessage(messaging, (payload) => {
        console.log('Message received. ', payload);
        // Customize notification here
        const notificationTitle = payload.notification.title;
        const notificationOptions = {
            body: payload.notification.body,
            icon: 'https://v5-4simpleproblems.github.io/images/logo.png'
        };
        new Notification(notificationTitle, notificationOptions);
    });
}


export async function initializeNotifications(app, db) {
    const VAPID_KEY = 'BHYM9iOhL3KZqDwYo-_Qx9Nh7bksKoZT-XZ0IJa6RN-vqJ0DT-2EM1Y7V0fMpjyseMNszEj-CU0e3pj87z3lcbw';
    const auth = getAuth(app);
    const messaging = getMessaging(app);

    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
        console.log('Notifications or Service Workers are not supported in this browser.');
        return;
    }

    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registered with scope:', registration.scope);

    auth.onAuthStateChanged(function(user) {
        if (user) {
            Notification.requestPermission().then((permission) => {
                if (permission === 'granted') {
                    console.log('Notification permission granted.');
                    // Get the token
                    getToken(messaging, { serviceWorkerRegistration: registration, vapidKey: VAPID_KEY }).then((currentToken) => {
                        if (currentToken) {
                            console.log('FCM Token:', currentToken);
                            // Save the token to the user's profile
                            saveTokenToProfile(db, currentToken);
                        } else {
                            console.log('No Instance ID token available. Request permission to generate one.');
                        }
                    }).catch((err) => {
                        console.log('An error occurred while retrieving token. ', err);
                    });
                } else {
                    console.log('Unable to get permission to notify.');
                }
            });

            initializeFCM(messaging);
        }
    });
}
