const functions = require('firebase-functions');
const admin = require('firebase-admin');
// Initializes the app using credentials automatically found when deployed
admin.initializeApp(); 

const db = admin.firestore();

// The maximum number of notifications to send in a batch to avoid exceeding limits
const MAX_NOTIFICATIONS_PER_BATCH = 500;
