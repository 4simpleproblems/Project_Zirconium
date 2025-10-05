/**
 * navigation.js
 * * This is a fully self-contained script to create a dynamic, authentication-aware
 * navigation bar for your website. It handles everything from Firebase initialization
 * to rendering user-specific information.
 *
 * --- INSTRUCTIONS ---
 * 1. ACTION REQUIRED: Paste your own Firebase project configuration into the `FIREBASE_CONFIG` object below.
 * 2. Place this script in the root directory of your website.
 * 3. Add `<script src="/navigation.js" defer></script>` to the <head> of any HTML file where you want the navbar.
 * 4. Ensure your file paths for images and links are root-relative (e.g., "/images/logo.png", "/login.html").
 * * --- HOW IT WORKS ---
 * - It runs automatically once the HTML document is loaded.
 * - It injects its own CSS for styling the navbar and dropdown menu.
 * - It creates a placeholder div and then renders the navbar inside it.
 * - It initializes Firebase using the configuration you provide.
 * - It listens for authentication state changes (logins/logouts) in real-time.
 * - If a user is logged in, it fetches their username from Firestore and displays it.
 * - It automatically tries to sign in the user anonymously if they are not logged in.
 * (NOTE: This requires "Anonymous" sign-in to be enabled in your Firebase console).
 */

// =========================================================================
// >> ACTION REQUIRED: PASTE YOUR FIREBASE CONFIGURATION OBJECT HERE <<
// =========================================================================
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro",
  authDomain: "project-zirconium.firebaseapp.com",
  projectId: "project-zirconium",
  storageBucket: "project-zirconium.firebasestorage.app",
  messagingSenderId: "1096564243475",
  appId: "1:1096564243475:web:6d0956a70125eeea1ad3e6",
  measurementId: "G-1D4F692C1Q"
};
// =========================================================================


// --- Self-invoking function to encapsulate all logic ---
(function() {
    // Stop execution if Firebase config is not provided
    if (!FIREBASE_CONFIG || !FIREBASE_CONFIG.apiKey) {
        console.error("Firebase configuration is missing! Please paste your config into navigation.js.");
        return;
    }

    // --- 1. DYNAMICALLY LOAD FIREBASE SDKs ---
    // This ensures Firebase is loaded before our code runs.
    const loadScript = (src) => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.type = 'module';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    };

    const run = async () => {
        try {
            // Sequentially load Firebase modules. This is crucial for correct initialization.
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js");

            // Now that scripts are loaded, we can use the `firebase` global object
            initializeApp();
        } catch (error) {
            console.error("Failed to load Firebase SDKs:", error);
        }
    };

    // --- 2. INITIALIZE FIREBASE AND RENDER NAVBAR ---
    const initializeApp = () => {
        // Initialize Firebase with the compat libraries
        const app = firebase.initializeApp(FIREBASE_CONFIG);
        const auth = firebase.auth();
        const db = firebase.firestore();

        // --- 3. INJECT CSS STYLES ---
        const injectStyles = () => {
            const style = document.createElement('style');
            style.textContent = `
                body { padding-top: 4rem; /* 64px, equal to navbar height */ }
                .auth-navbar { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; background: rgba(0,0,0,0.8); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-bottom: 1px solid rgb(31 41 55); height: 4rem; }
                .auth-navbar nav { max-width: 80rem; margin: auto; padding: 0 1rem; height: 100%; display: flex; align-items: center; justify-content: space-between; }
                .auth-menu-container { position: absolute; right: 0; top: 50px; width: 16rem; background: rgba(17, 24, 39, 0.9); border: 1px solid rgb(55 65 81); border-radius: 0.75rem; padding: 0.5rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05); transition: transform 0.2s ease-out, opacity 0.2s ease-out; transform-origin: top right; }
                .auth-menu-container.open { opacity: 1; transform: translateY(0) scale(1); }
                .auth-menu-container.closed { opacity: 0; pointer-events: none; transform: translateY(-10px) scale(0.95); }
                .initial-avatar { background: linear-gradient(135deg, #374151 0%, #111827 100%); font-family: 'Geist', sans-serif; text-transform: uppercase; display: flex; align-items: center; justify-content: center; color: white; }
                .auth-menu-link, .auth-menu-button { display: block; width: 100%; text-align: left; padding: 0.5rem 0.75rem; font-size: 0.875rem; color: #d1d5db; border-radius: 0.375rem; transition: background-color 0.2s, color 0.2s; }
                .auth-menu-link:hover, .auth-menu-button:hover { background-color: rgb(55 65 81); color: white; }
            `;
            document.head.appendChild(style);
        };

        // --- 4. RENDER THE NAVBAR HTML ---
        const renderNavbar = (user, userData) => {
            const container = document.getElementById('navbar-container');
            if (!container) return;

            const logoPath = "/images/logo.png"; // Using root-relative path

            const loggedOutView = `
                <div class="relative">
                    <button id="auth-toggle" class="w-8 h-8 rounded-full border border-gray-700 flex items-center justify-center bg-gray-800 hover:bg-gray-700 transition">
                        <svg class="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                    </button>
                    <div id="auth-menu-container" class="auth-menu-container closed">
                        <a href="/login.html" class="auth-menu-link">Login</a>
                        <a href="/signup.html" class="auth-menu-link">Sign Up</a>
                    </div>
                </div>
            `;

            const loggedInView = (user, userData) => {
                const photoURL = user.photoURL || userData?.photoURL;
                const username = userData?.username || user.displayName || 'User';
                const email = user.email || 'No email';
                const initial = username.charAt(0).toUpperCase();

                const avatar = photoURL ?
                    `<img src="${photoURL}" class="w-full h-full object-cover rounded-full" alt="Profile">` :
                    `<div class="initial-avatar w-full h-full rounded-full text-sm font-semibold">${initial}</div>`;

                return `
                    <div class="relative">
                        <button id="auth-toggle" class="w-8 h-8 rounded-full border border-gray-600 overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500">
                            ${avatar}
                        </button>
                        <div id="auth-menu-container" class="auth-menu-container closed">
                            <div class="px-3 py-2 border-b border-gray-700 mb-2">
                                <p class="text-sm font-semibold text-white truncate">${username}</p>
                                <p class="text-xs text-gray-400 truncate">${email}</p>
                            </div>
                            <a href="/logged-in/dashboard.html" class="auth-menu-link">Dashboard</a>
                            <a href="/logged-in/settings.html" class="auth-menu-link">Settings</a>
                            <button id="logout-button" class="auth-menu-button text-red-400 hover:bg-red-900/50 hover:text-red-300">Log Out</button>
                        </div>
                    </div>
                `;
            };

            container.innerHTML = `
                <header class="auth-navbar">
                    <nav>
                        <a href="/" class="flex items-center space-x-2">
                            <img src="${logoPath}" alt="4SP Logo" class="h-8 w-auto">
                        </a>
                        ${user ? loggedInView(user, userData) : loggedOutView}
                    </nav>
                </header>
            `;

            // --- 5. SETUP EVENT LISTENERS ---
            setupEventListeners(user);
        };

        const setupEventListeners = (user) => {
            const toggleButton = document.getElementById('auth-toggle');
            const menu = document.getElementById('auth-menu-container');

            if (toggleButton && menu) {
                toggleButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    menu.classList.toggle('closed');
                    menu.classList.toggle('open');
                });
            }

            document.addEventListener('click', (e) => {
                if (menu && menu.classList.contains('open') && !menu.contains(e.target) && e.target !== toggleButton) {
                    menu.classList.add('closed');
                    menu.classList.remove('open');
                }
            });

            if (user) {
                const logoutButton = document.getElementById('logout-button');
                if (logoutButton) {
                    logoutButton.addEventListener('click', () => {
                        auth.signOut().catch(err => console.error("Logout failed:", err));
                    });
                }
            }
        };

        // --- 6. AUTH STATE LISTENER ---
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                // User is signed in. Fetch their data from Firestore.
                try {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    const userData = userDoc.exists ? userDoc.data() : null;
                    renderNavbar(user, userData);
                } catch (error) {
                    console.error("Error fetching user data:", error);
                    renderNavbar(user, null); // Render even if Firestore fails
                }
            } else {
                // User is signed out.
                renderNavbar(null, null);
                // Attempt to sign in anonymously for a seamless guest experience.
                auth.signInAnonymously().catch((error) => {
                    if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/admin-restricted-operation') {
                        console.warn(
                            "Anonymous sign-in is disabled. Enable it in the Firebase Console (Authentication > Sign-in method) for guest features."
                        );
                    } else {
                        console.error("Anonymous sign-in error:", error);
                    }
                });
            }
        });

        // --- FINAL SETUP ---
        // Create a div for the navbar to live in if it doesn't exist.
        if (!document.getElementById('navbar-container')) {
            const navbarDiv = document.createElement('div');
            navbarDiv.id = 'navbar-container';
            document.body.prepend(navbarDiv);
        }
        injectStyles();
    };

    // --- START THE PROCESS ---
    // Wait for the DOM to be ready, then start loading scripts.
    document.addEventListener('DOMContentLoaded', run);

})();
