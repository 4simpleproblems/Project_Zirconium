
// Ask for notification permission
function requestNotificationPermission() {
    Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            // Get the token
            getFCMToken();
        } else {
            console.log('Unable to get permission to notify.');
        }
    });
}

// Get the FCM token
function getFCMToken() {
    const messaging = firebase.messaging();
    messaging.getToken().then((currentToken) => {
        if (currentToken) {
            console.log('FCM Token:', currentToken);
            // Save the token to the user's profile
            saveTokenToProfile(currentToken);
        } else {
            console.log('No Instance ID token available. Request permission to generate one.');
        }
    }).catch((err) => {
        console.log('An error occurred while retrieving token. ', err);
    });
}

// Save the token to the user's profile
function saveTokenToProfile(token) {
    const user = firebase.auth().currentUser;
    if (user) {
        const db = firebase.firestore();
        db.collection('users').doc(user.uid).update({
            fcmToken: token
        }).then(() => {
            console.log('FCM token saved to profile.');
        }).catch((error) => {
            console.error('Error saving FCM token to profile: ', error);
        });
    }
}

// Initialize Firebase Cloud Messaging
function initializeFCM() {
    const messaging = firebase.messaging();
    messaging.onMessage((payload) => {
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

// Check if the user is authenticated and then initialize everything
firebase.auth().onAuthStateChanged(function(user) {
    if (user) {
        // User is signed in.
        requestNotificationPermission();
        initializeFCM();
    }
});
