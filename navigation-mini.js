import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut, signInWithCustomToken, signInAnonymously } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

/**
 * navigation-mini.js
 * Renders the full header dynamically based on the real Firebase authentication state.
 * This file is now FULLY SELF-CONTAINED. All configuration, token handling, and logic 
 * are handled internally to prevent runtime module and dependency errors.
 * * NOTE: The script is designed to:
 * 1. Prioritize the local FIREBASE_CONFIG object (where you paste your config).
 * 2. Use the global __initial_auth_token. If the token is present, it uses signInWithCustomToken.
 * 3. If the token is NOT present, it attempts signInAnonymously.
 * * The last error shown in your screenshot (auth/admin-restricted-operation) is a security rule issue, 
 * which this code change cannot fix directly. If you still see it, ensure your Firebase 
 * security rules allow anonymous authentication (if you use it) and custom token sign-in.
 */

// =========================================================================
// !!! ACTION REQUIRED: PASTE YOUR FIREBASE CONFIGURATION HERE !!!
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

let app, auth, db;
let isFirebaseReady = false;

// --- Utility Functions ---
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

async function retryFetch(fn, maxRetries = MAX_RETRIES) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) throw error; // Re-throw on last attempt
            const delay = BASE_DELAY_MS * 2 ** i;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// --- Initialization ---
async function initializeFirebase() {
    // 1. Determine which configuration to use (local object over global variable)
    let configToUse = FIREBASE_CONFIG;
    if (Object.keys(FIREBASE_CONFIG).length === 0 && typeof __firebase_config !== 'undefined') {
        try {
            configToUse = JSON.parse(__firebase_config);
        } catch (e) {
            console.error("Error parsing __firebase_config:", e);
        }
    }
    
    // 2. Get the global token
    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
    
    // 3. Check for critical configuration
    if (Object.keys(configToUse).length === 0 || !configToUse.apiKey) {
        console.error("Firebase configuration is missing. Please paste your config into the FIREBASE_CONFIG object.");
        return;
    }

    try {
        app = initializeApp(configToUse);
        auth = getAuth(app);
        db = getFirestore(app);

        // 4. Sign-in logic
        const authSignIn = async () => {
            if (initialAuthToken) {
                // If token exists, use custom token sign-in
                await signInWithCustomToken(auth, initialAuthToken);
            } else {
                // If token is missing, fall back to anonymous sign-in
                await signInAnonymously(auth);
            }
        };

        await retryFetch(authSignIn);
        
        isFirebaseReady = true;
        console.log("Firebase initialized and user signed in successfully.");
        
        injectAuthNavbar();
    } catch (error) {
        console.error("Firebase initialization or sign-in failed:", error.code, error.message);
        // This is where your 'auth/admin-restricted-operation' error originates.
    }
}


// --- Styling and DOM Setup ---
function injectTopbarCSS() {
    const head = document.head;
    
    if (!document.querySelector('link[href*="fontawesome.com"]')) {
        const faLink = document.createElement('link');
        faLink.rel = 'stylesheet';
        faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css';
        head.appendChild(faLink);
    }

    if (!document.querySelector('link[href*="Poppins"]')) {
        const poppinsLink = document.createElement('link');
        poppinsLink.rel = 'stylesheet';
        poppinsLink.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@600&display=swap';
        head.appendChild(poppinsLink);
    }
    
    const style = document.createElement('style');
    style.textContent = `
        body {
            padding-top: 4rem !important; /* 4rem = 64px, matching h-16 */
        }
        .auth-menu-container {
            transition: transform 0.3s ease-out, opacity 0.3s ease-out;
            transform-origin: top right;
            backdrop-filter: blur(16px); 
            -webkit-backdrop-filter: blur(16px);
        }
        .auth-menu-container.open {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
        .auth-menu-container.closed {
            opacity: 0;
            pointer-events: none;
            transform: translateY(-10px) scale(0.95);
        }
        .initial-avatar {
            background: linear-gradient(135deg, #1f1f1f 0%, #444444 100%); 
            font-family: 'Poppins', sans-serif; 
            text-transform: uppercase;
        }
        #auth-toggle {
            position: relative;
            z-index: 10;
        }
    `;
    head.appendChild(style);
}

function setupAuthMenuLogic() {
    const toggleButton = document.getElementById('auth-toggle');
    const menuContainer = document.getElementById('auth-menu-container');

    if (toggleButton && menuContainer) {
        const toggleMenu = () => {
            const isExpanded = toggleButton.getAttribute('aria-expanded') === 'true';
            const newExpandedState = String(!isExpanded);
            toggleButton.setAttribute('aria-expanded', newExpandedState);
            
            if (isExpanded) {
                menuContainer.classList.remove('open');
                menuContainer.classList.add('closed');
            } else {
                menuContainer.classList.remove('closed');
                menuContainer.classList.add('open');
            }
        };

        toggleButton.addEventListener('click', toggleMenu);

        document.addEventListener('click', (event) => {
            if (!menuContainer.contains(event.target) && !toggleButton.contains(event.target)) {
                if (toggleButton.getAttribute('aria-expanded') === 'true') {
                    toggleMenu();
                }
            }
        });
    }
}

// --- Rendering Functions ---
function renderLoggedOutNavbar() {
    return `
        <div class="relative">
            <button 
                id="auth-toggle"
                aria-expanded="false"
                aria-controls="auth-menu-container"
                class="w-8 h-8 rounded-full border border-white flex items-center justify-center bg-black/50 hover:bg-gray-900/50 transition-colors duration-200 focus:outline-none focus:ring-1 focus:ring-white"
            >
                <i class="fas fa-user text-white text-base"></i>
            </button>
            
            <div 
                id="auth-menu-container" 
                class="auth-menu-container closed absolute right-0 top-10 w-40 p-2 rounded-xl bg-black/70 backdrop-blur-xl border border-gray-800 shadow-xl"
            >
                <!-- Links relative to the current page -->
                <a href="login.html" class="block px-3 py-2 text-sm font-normal text-white hover:bg-gray-800 rounded-lg transition-colors">
                    Login
                </a>
                <a href="signup.html" class="block px-3 py-2 text-sm font-normal text-white hover:bg-gray-800 rounded-lg transition-colors mt-1">
                    Sign Up
                </a>
            </div>
        </div>
    `;
}

function renderLoggedInNavbar(user) {
    const { username, email, photoURL } = user;
    
    const initial = username 
        ? username.charAt(0).toUpperCase() 
        : (email ? email.charAt(0).toUpperCase() : '?');

    let profileContent;
    
    if (photoURL) {
        profileContent = `<img src="${photoURL}" alt="${username} Profile" class="w-full h-full object-cover rounded-full" />`;
    } else {
        profileContent = `
            <div class="initial-avatar w-full h-full flex items-center justify-center text-white text-sm font-semibold">
                ${initial}
            </div>
        `;
    }

    return `
        <div class="relative">
            <button 
                id="auth-toggle"
                aria-expanded="false"
                aria-controls="auth-menu-container"
                class="w-8 h-8 rounded-full border border-white flex items-center justify-center bg-black/50 hover:bg-gray-900/50 transition-colors duration-200 focus:outline-none focus:ring-1 focus:ring-white overflow-hidden"
            >
                ${profileContent}
            </button>
            
            <div 
                id="auth-menu-container" 
                class="auth-menu-container closed absolute right-0 top-10 w-64 p-3 rounded-xl bg-black/70 backdrop-blur-xl border border-gray-800 shadow-xl"
            >
                <div class="px-3 py-1 mb-2 border-b border-gray-700">
                    <p class="text-sm font-semibold text-white truncate">${username}</p>
                    <p class="text-xs text-gray-400 truncate">${email}</p>
                </div>

                <a href="../logged-in/dashboard.html" class="block px-3 py-2 text-sm font-normal text-white hover:bg-gray-800 rounded-lg transition-colors">
                    <i class="fas fa-house-user mr-2"></i> Dashboard
                </a>
                
                <a href="../logged-in/settings.html" class="block px-3 py-2 text-sm font-normal text-white hover:bg-gray-800 rounded-lg transition-colors">
                    <i class="fas fa-cog mr-2"></i> Settings
                </a>
                
                <button id="logout-button" class="w-full text-left px-3 py-2 text-sm font-normal text-red-400 hover:bg-red-900/30 rounded-lg transition-colors mt-1">
                    <i class="fas fa-sign-out-alt mr-2"></i> Log Out
                </button>
            </div>
        </div>
    `;
}

// --- Main Logic ---
async function injectAuthNavbar() {
    if (!isFirebaseReady) {
        // Fallback if initialization failed
        const navbarContainer = document.getElementById('navbar-container');
        if (navbarContainer) {
             navbarContainer.innerHTML = `
                <header class="fixed top-0 w-full z-50 backdrop-blur-md bg-black/80 border-b border-gray-900">
                    <nav class="h-16 flex items-center justify-between px-4">
                        <a href="../index.html" class="flex items-center space-x-2">
                            <img src="../images/logo.png" alt="Logo" class="h-8 w-auto">
                        </a>
                        ${renderLoggedOutNavbar()}
                    </nav>
                </header>
            `;
            setupAuthMenuLogic();
        }
        return;
    }
    
    const navbarContainer = document.getElementById('navbar-container');
    if (!navbarContainer) return;

    onAuthStateChanged(auth, async (user) => {
        let authContent;
        
        if (user) {
            let userData = null;

            if (db && user.uid) { 
                try {
                    const fetchUserData = async () => {
                        const userDocRef = doc(db, 'users', user.uid); 
                        return await getDoc(userDocRef);
                    };
                    
                    const userDocSnap = await retryFetch(fetchUserData);
                    
                    if (userDocSnap.exists()) {
                        userData = userDocSnap.data();
                    }
                } catch (e) {
                    console.error("Error fetching user data from Firestore:", e);
                }
            }

            const combinedUser = {
                username: userData?.username || user.displayName || user.email?.split('@')[0] || 'User',
                email: userData?.email || user.email || 'N/A',
                photoURL: user.photoURL
            };

            authContent = renderLoggedInNavbar(combinedUser);
        } else {
            authContent = renderLoggedOutNavbar();
        }

        navbarContainer.innerHTML = `
            <header class="fixed top-0 w-full z-50 backdrop-blur-md bg-black/80 border-b border-gray-900">
                <nav class="h-16 flex items-center justify-between px-4">
                    <a href="../index.html" class="flex items-center space-x-2">
                        <img src="../images/logo.png" alt="4simpleproblems Logo" class="h-8 w-auto">
                    </a>
                    ${authContent}
                </nav>
            </header>
        `;

        setupAuthMenuLogic();

        if (user) {
            const logoutButton = document.getElementById('logout-button');
            if (logoutButton) {
                logoutButton.addEventListener('click', async () => {
                    try {
                        await retryFetch(() => signOut(auth)); 
                        window.location.href = 'login.html'; 
                    } catch (error) {
                        console.error("Logout failed:", error);
                    }
                });
            }
        }
    });
}

// --- Execution Entry Point ---
injectTopbarCSS(); 
document.addEventListener('DOMContentLoaded', initializeFirebase);
