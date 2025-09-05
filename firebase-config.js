/**
 * @file firebase-config.js
 * @description Initializes the Firebase app and exports auth and firestore services.
 * This file should be included before any other script that uses Firebase.
 */

// --- Firebase Configuration ---
// IMPORTANT: Replace the placeholder values below with your actual Firebase project configuration.
// You can find these details in your project's settings on the Firebase console.
const firebaseConfig = {
  apiKey: "AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro",
  authDomain: "project-zirconium.firebaseapp.com",
  projectId: "project-zirconium",
  storageBucket: "project-zirconium.firebasestorage.app",
  messagingSenderId: "1096564243475",
  appId: "1:1096564243475:web:6d0956a70125eeea1ad3e6",
  measurementId: "G-1D4F692C1Q"
};

// --- Firebase Initialization ---
// We'll check if Firebase has already been initialized to prevent errors.
let app;
if (!firebase.apps.length) {
  app = firebase.initializeApp(firebaseConfig);
} else {
  app = firebase.app(); // Get the already initialized app
}

// --- Initialize and export services ---
// These variables will be globally available to other scripts loaded after this one.
const auth = firebase.auth();
const db = firebase.firestore();

// Optional: Log to the console for debugging to confirm successful initialization.
console.log("Firebase initialized successfully.");
