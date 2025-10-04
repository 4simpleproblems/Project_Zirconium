import { firebaseConfig } from '../firebase-config.js'; 
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

/**
 * navigation-mini.js
 * Renders the full header dynamically based on the real Firebase authentication state.
 * This script is now self-executing and handles all its Firebase dependencies internally
 * by importing the necessary libraries and the external firebase-config.js.
 * * NOTE: For this script to work, the HTML file loading it MUST use <script type="module" src=".../navigation-mini.js">.
 */

// --- 1. CONFIGURATION & INITIALIZATION ---
// These are initialized once when the module loads
let app, auth, db;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
} catch (error) {
    console.error("Firebase initialization failed. Ensure firebaseConfig is correct and dependencies are loaded.", error);
}

// --- 2. INJECT TOPBAR-SPECIFIC STYLES INTO THE HEAD ---
function injectTopbarCSS() {
    const head = document.head;
    
    // Inject Font Awesome for icons
    if (!document.querySelector('link[href*="fontawesome.com"]')) {
        const faLink = document.createElement('link');
        faLink.rel = 'stylesheet';
        faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css';
        head.appendChild(faLink);
    }

    // Inject Poppins font for the profile initial
    if (!document.querySelector('link[href*="Poppins"]')) {
        const poppinsLink = document.createElement('link');
        poppinsLink.rel = 'stylesheet';
        poppinsLink.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@600&display=swap';
        head.appendChild(poppinsLink);
    }
    
    const style = document.createElement('style');
    style.textContent = `
        /* --- AUTH MENU STYLES (Required for dropdown) --- */
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
        
        /* Gradient profile avatar style */
        .initial-avatar {
            background: linear-gradient(135deg, #1f1f1f 0%, #444444 100%); 
            font-family: 'Poppins', sans-serif; 
            text-transform: uppercase;
        }

        /* Ensure smooth animation and proper positioning for the avatar */
        #auth-toggle {
            position: relative;
            z-index: 10;
        }
        /* --- END AUTH MENU STYLES --- */
    `;
    head.appendChild(style);
}


// --- 3. AUTH MENU DROPDOWN LOGIC ---
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

        // Close when clicking outside the menu or toggle button
        document.addEventListener('click', (event) => {
            if (!menuContainer.contains(event.target) && !toggleButton.contains(event.target)) {
                if (toggleButton.getAttribute('aria-expanded') === 'true') {
                    toggleMenu();
                }
            }
        });
    }
}

// --- 4. NAVBAR RENDERING FUNCTIONS ---
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
    
    // Get the first letter of the username (or email) for the initial
    const initial = username 
        ? username.charAt(0).toUpperCase() 
        : (email ? email.charAt(0).toUpperCase() : '?');

    let profileContent;
    
    // Check for photoURL
    if (photoURL) {
        profileContent = `<img src="${photoURL}" alt="${username} Profile" class="w-full h-full object-cover rounded-full" />`;
    } else {
        // Gradient initial avatar
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

                <!-- Links relative to the current page's parent directory -->
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

// --- 5. MAIN INJECTION FUNCTION (Handles Auth State) ---
async function injectAuthNavbar() {
    if (!auth || !db) {
        console.error("Firebase services were not initialized. Cannot run navigation logic.");
        return;
    }
    
    const navbarContainer = document.getElementById('navbar-container');
    if (!navbarContainer) return;

    // Use onAuthStateChanged for real-time state management
    onAuthStateChanged(auth, async (user) => {
        let authContent;
        
        if (user) {
            let userData = null;

            // Fetch user data from Firestore
            if (db && user.uid) { 
                try {
                    const userDocRef = doc(db, 'users', user.uid);
                    const userDocSnap = await getDoc(userDocRef);
                    if (userDocSnap.exists()) {
                        userData = userDocSnap.data();
                    }
                } catch (e) {
                    console.error("Error fetching user data from Firestore:", e);
                }
            }

            // Combine Firebase Auth and Firestore data, prioritizing Firestore
            const combinedUser = {
                // Prioritize Firestore username, then Auth display name, then Auth email prefix
                username: userData?.username || user.displayName || user.email.split('@')[0],
                email: userData?.email || user.email,
                photoURL: user.photoURL // Use Auth photoURL unless explicitly stored differently
            };

            authContent = renderLoggedInNavbar(combinedUser);
        } else {
            authContent = renderLoggedOutNavbar();
        }

        // Inject the full header structure
        navbarContainer.innerHTML = `
            <header class="sticky top-0 z-50 backdrop-blur-md bg-black/80 border-b border-gray-900">
                <nav class="h-16 flex items-center justify-between px-4">
                    <a href="../index.html" class="flex items-center space-x-2">
                        <picture>
                            <source srcset="../images/logo.png" media="(prefers-color-scheme: dark)">
                            <img src="../images/logo.png" alt="4simpleproblems Logo" class="h-8 w-auto">
                        </picture>
                    </a>
                    ${authContent}
                </nav>
            </header>
        `;

        // Setup logic for the menu dropdown
        setupAuthMenuLogic();

        if (user) {
            const logoutButton = document.getElementById('logout-button');
            if (logoutButton) {
                logoutButton.addEventListener('click', async () => {
                    try {
                        await signOut(auth); // Use the imported signOut function
                        // Redirect to the login page
                        window.location.href = 'login.html'; 
                    } catch (error) {
                        console.error("Logout failed:", error);
                    }
                });
            }
        }
    });
}

// --- 6. SELF-EXECUTION ENTRY POINT ---
// 1. Inject CSS immediately
injectTopbarCSS(); 
// 2. Start the main logic once the DOM is ready
document.addEventListener('DOMContentLoaded', injectAuthNavbar);
