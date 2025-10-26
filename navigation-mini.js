/**
 * navigation-mini.js
 * * This is a fully self-contained script to create a dynamic, authentication-aware
 * navigation bar for your website. It handles everything from Firebase initialization
 * to rendering user-specific information.
 *
 * --- FIXES/UPDATES ---
 * 1. Styling: Updated CSS to use pure black (#000000) for the navbar and dropdown menu, removing the blur effect to match navigation.js.
 * 2. Icons: Added dynamic loading for Font Awesome 7.1.0 (fa-solid) and implemented icons (with the correct 'fa-solid' prefix) next to all menu links.
 * 3. FIX: **Font Awesome Loading:** Ensured the Font Awesome CSS is fully loaded and applied BEFORE the navbar HTML, which contains the <i> tags, is rendered.
 * 4. USER REQUEST: Replaced Login/Signup links with a single "Authenticate" link pointing to /authentication.html.
 * 5. USER REQUEST: Updated logged-out button background to #010101 and icon color to #DADADA, using 'fa-solid fa-user'.
 * 6. WIDESCREEN UPDATE: Removed max-width from the 'nav' element to allow it to fill the screen.
 * 7. NEW FEATURE: Added conditional "Documentation," "Terms & Policies," and "Donate" links to the logged-out menu.
 * 8. NEW FEATURE: Links are hidden if the user is currently on the destination page (e.g., "Authenticate" is hidden on /authentication.html).
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
    // Global references for Firebase objects
    let auth, db;

    // Stop execution if Firebase config is not provided
    if (!FIREBASE_CONFIG || !FIREBASE_CONFIG.apiKey) {
        console.error("Firebase configuration is missing! Please paste your config into navigation.js.");
        return;
    }

    // --- 1. DYNAMICALLY LOAD EXTERNAL ASSETS ---
    // Helper to load external JS files
    const loadScript = (src) => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    };

    // Helper to load external CSS files
    const loadCSS = (href) => {
        return new Promise((resolve) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = resolve;
            link.onerror = resolve; // Resolve even on error to not block the app
            document.head.appendChild(link);
        });
    };

    const run = async () => {
        try {
            // Load Font Awesome 6.5.2 CSS - **WAIT FOR IT TO BE ADDED TO HEAD**
            await loadCSS("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css");
            
            // Sequentially load Firebase modules.
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js");

            // Now that scripts are loaded, we can use the `firebase` global object
            initializeApp();
            
            // We need to inject the styles and setup the container immediately
            // so the onAuthStateChanged listener can call renderNavbar successfully.
            injectStyles();
            setupContainer(); 
            
        } catch (error) {
            console.error("Failed to load necessary SDKs or Font Awesome:", error);
        }
    };

    // Helper to create the navbar container
    const setupContainer = () => {
        if (!document.getElementById('navbar-container')) {
            const navbarDiv = document.createElement('div');
            navbarDiv.id = 'navbar-container';
            document.body.prepend(navbarDiv);
        }
    }


    // --- 2. INITIALIZE FIREBASE AND RENDER NAVBAR ---
    const initializeApp = () => {
        // Initialize Firebase with the compat libraries
        const app = firebase.initializeApp(FIREBASE_CONFIG);
        auth = firebase.auth(); // Assign to global reference
        db = firebase.firestore(); // Assign to global reference

        // Start the Auth listener immediately after initialization
        setupAuthListener();
    };

    // --- 3. INJECT CSS STYLES (UPDATED for black theme/no blur) ---
    const injectStyles = () => {
        const style = document.createElement('style');
        style.textContent = `
            body { padding-top: 4rem; /* 64px, equal to navbar height */ }
            /* Updated to pure black and removed backdrop filter */
            .auth-navbar { 
                position: fixed; top: 0; left: 0; right: 0; z-index: 1000; 
                background: #000000; /* Pure Black */
                border-bottom: 1px solid rgb(31 41 55); height: 4rem; 
            }
            /* WIDESCREEN UPDATE: Removed 'max-width: 80rem;' and 'margin: auto;' */
            .auth-navbar nav { padding: 0 1rem; height: 100%; display: flex; align-items: center; justify-content: space-between; }
            
            /* Updated to pure black and removed backdrop filter */
            .auth-menu-container { 
                position: absolute; right: 0; top: 50px; width: 16rem; 
                background: #000000; /* Pure Black */
                backdrop-filter: none; /* Removed blur */
                -webkit-backdrop-filter: none;
                border: 1px solid rgb(55 65 81); border-radius: 0.75rem; padding: 0.5rem; 
                box-shadow: 0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -2px rgba(0,0,0,0.2); /* Darker shadow */
                transition: transform 0.2s ease-out, opacity 0.2s ease-out; transform-origin: top right; 
            }
            .auth-menu-container.open { opacity: 1; transform: translateY(0) scale(1); }
            .auth-menu-container.closed { opacity: 0; pointer-events: none; transform: translateY(-10px) scale(0.95); }
            .initial-avatar { background: linear-gradient(135deg, #374151 0%, #111827 100%); font-family: 'Geist', sans-serif; text-transform: uppercase; display: flex; align-items: center; justify-content: center; color: white; }
            
            /* Icon/Text Styling for Links */
            .auth-menu-link, .auth-menu-button { 
                display: flex; /* Changed to flex for icon alignment */
                align-items: center; /* Vertically center icon and text */
                width: 100%; text-align: left; padding: 0.5rem 0.75rem; font-size: 0.875rem; 
                color: #d1d5db; border-radius: 0.375rem; transition: background-color 0.2s, color 0.2s; 
                /* Ensure buttons look like links */
                border: none;
                cursor: pointer;
            }
            .auth-menu-link:hover, .auth-menu-button:hover { background-color: rgb(55 65 81); color: white; }
            /* Margin for icons */
            .auth-menu-link i, .auth-menu-button i { margin-right: 0.5rem; }

            /* New custom style for the logged out button's icon and background */
            .logged-out-auth-toggle {
                background: #010101; /* Requested dark background */
                border: 1px solid #374151; /* Keep a subtle border */
            }
            .logged-out-auth-toggle i {
                color: #DADADA; /* Requested icon color */
            }
        `;
        document.head.appendChild(style);
    };

    // --- NEW HELPER: CONDITIONAL LINKS ---
    /**
     * Generates HTML for the optional links, hiding them if the user is on that page.
     * @param {string} currentPage The current window.location.pathname.
     * @returns {string} The HTML string for the links.
     */
    const getOptionalLinks = (currentPage) => {
        let links = '';
        const normalizePath = (path) => path.replace(/^\/+/, '').toLowerCase();
        const currentPath = normalizePath(currentPage);

        // 1. Authenticate Link
        if (!currentPath.includes('authentication.html')) {
             links += `<a href="/authentication.html" class="auth-menu-link"><i class="fa-solid fa-lock"></i>Authenticate</a>`;
        }

        // 2. Documentation Link
        if (!currentPath.includes('documentation.html')) {
            links += `<a href="/documentation.html" class="auth-menu-link"><i class="fa-solid fa-book"></i>Documentation</a>`;
        }
        
        // 3. Terms & Policies Link (Assumes file is named legal.html)
        if (!currentPath.includes('legal.html')) {
            links += `<a href="/legal.html" class="auth-menu-link"><i class="fa-solid fa-gavel"></i>Terms & Policies</a>`;
        }

        // 4. Donate Link (Always visible, opens in new tab)
        links += `<a href="https://buymeacoffee.com/4simpleproblems" target="_blank" class="auth-menu-link"><i class="fa-solid fa-mug-hot"></i>Donate</a>`;
        
        return links;
    }


    // --- 4. RENDER THE NAVBAR HTML (UPDATED with Icons and Authenticate link) ---
    const renderNavbar = (user, userData) => {
        const container = document.getElementById('navbar-container');
        if (!container) return; // Should not happen if setupContainer runs

        const logoPath = "/images/logo.png"; // Using root-relative path
        const currentPagePath = window.location.pathname; // Get current path for conditional links

        // UPDATED: Use a function to render the conditional links
        const loggedOutView = (currentPage) => {
            const optionalLinks = getOptionalLinks(currentPage);

            return `
                <div class="relative">
                    <button id="auth-toggle" class="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-gray-700 transition logged-out-auth-toggle">
                        <i class="fa-solid fa-user"></i>
                    </button>
                    <div id="auth-menu-container" class="auth-menu-container closed">
                        ${optionalLinks}
                    </div>
                </div>
            `;
        }

        const loggedInView = (user, userData) => {
            const photoURL = user.photoURL || userData?.photoURL;
            const username = userData?.username || user.displayName || 'User';
            const email = user.email || 'No email';
            const initial = username.charAt(0).toUpperCase();

            const avatar = photoURL ?
                `<img src="${photoURL}" class="w-full h-full object-cover rounded-full" alt="Profile">` :
                `<div class="initial-avatar w-full h-8 rounded-full text-sm font-semibold">${initial}</div>`; // Note: w-8 h-8 is defined by the button, but added w-full h-full to inner div

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
                        <a href="/logged-in/dashboard.html" class="auth-menu-link"><i class="fa-solid fa-house-chimney-user"></i>Dashboard</a>
                        <a href="/logged-in/settings.html" class="auth-menu-link"><i class="fa-solid fa-gear"></i>Settings</a>
                        <button id="logout-button" class="auth-menu-button text-red-400 hover:bg-red-900/50 hover:text-red-300"><i class="fa-solid fa-right-from-bracket"></i>Log Out</button>
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
                    ${user ? loggedInView(user, userData) : loggedOutView(currentPagePath)}
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
                // Use the globally available 'auth' reference
                logoutButton.addEventListener('click', () => {
                    auth.signOut().catch(err => console.error("Logout failed:", err));
                });
            }
        }
    };

    // --- 6. AUTH STATE LISTENER ---
    const setupAuthListener = () => {
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
    }

    // --- START THE PROCESS ---
    // Wait for the DOM to be ready, then start loading scripts.
    document.addEventListener('DOMContentLoaded', run);

})();
