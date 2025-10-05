/**
 * navigation.js
 * * This is a fully self-contained script to create a dynamic, authentication-aware
 * navigation bar for your website. It handles everything from Firebase initialization
 * to rendering user-specific information. It now includes a horizontally scrollable
 * tab menu loaded from page-identification.json.
 *
 * --- INSTRUCTIONS ---
 * 1. ACTION REQUIRED: Paste your own Firebase project configuration into the `FIREBASE_CONFIG` object below.
 * 2. Place this script in the root directory of your website.
 * 3. Add `<script src="/navigation.js" defer></script>` to the <head> of any HTML file where you want the navbar.
 * 4. Ensure your file paths for images and links are root-relative (e.g., "/images/logo.png", "/login.html").
 * * --- HOW IT WORKS ---
 * - It runs automatically once the HTML document is loaded.
 * - It injects its own CSS for styling the navbar, dropdown menu, and the new tab bar.
 * - It fetches the page configuration JSON to build the scrollable navigation tabs.
 * - It creates a placeholder div and then renders the navbar inside it.
 * - It initializes Firebase, listens for auth state, and fetches user data.
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

// --- Configuration for the navigation tabs ---
const PAGE_CONFIG_URL = '../page-identification.json';

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
        let pages = {};
        // Fetch page configuration for the tabs
        try {
            const response = await fetch(PAGE_CONFIG_URL);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            pages = await response.json();
            console.log("Page configuration loaded successfully.");
        } catch (error) {
            console.error("Failed to load page identification config:", error);
            // Continue execution even if pages fail to load, just without tabs
        }

        try {
            // Sequentially load Firebase modules. This is crucial for correct initialization.
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js");
            // Load Font Awesome for tab icons (assuming user has Font Awesome configured)
            await loadScript("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/js/all.min.js");


            // Now that scripts are loaded, we can use the `firebase` global object
            initializeApp(pages);
        } catch (error) {
            console.error("Failed to load necessary SDKs:", error);
        }
    };

    // --- 2. INITIALIZE FIREBASE AND RENDER NAVBAR ---
    const initializeApp = (pages) => {
        // Initialize Firebase with the compat libraries
        const app = firebase.initializeApp(FIREBASE_CONFIG);
        const auth = firebase.auth();
        const db = firebase.firestore();

        // --- 3. INJECT CSS STYLES ---
        const injectStyles = () => {
            const style = document.createElement('style');
            style.textContent = `
                /* Base Styles */
                body { padding-top: 4rem; /* 64px, equal to navbar height */ }
                .auth-navbar { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; background: rgba(0,0,0,0.8); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-bottom: 1px solid rgb(31 41 55); height: 4rem; }
                /* Nav now needs relative positioning for glide buttons */
                .auth-navbar nav { max-width: 80rem; margin: auto; padding: 0 1rem; height: 100%; display: flex; align-items: center; justify-content: space-between; gap: 1rem; position: relative; }
                .initial-avatar { background: linear-gradient(135deg, #374151 0%, #111827 100%); font-family: 'Geist', sans-serif; text-transform: uppercase; display: flex; align-items: center; justify-content: center; color: white; }
                
                /* Auth Dropdown Menu Styles (UPDATED: Black background and blur) */
                .auth-menu-container { 
                    position: absolute; right: 0; top: 50px; width: 16rem; 
                    background: rgba(0, 0, 0, 0.9); /* Closer to black */
                    backdrop-filter: blur(8px); 
                    -webkit-backdrop-filter: blur(8px);
                    border: 1px solid rgb(55 65 81); border-radius: 0.75rem; padding: 0.5rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -2px rgba(0,0,0,0.2); 
                    transition: transform 0.2s ease-out, opacity 0.2s ease-out; transform-origin: top right; 
                }
                .auth-menu-container.open { opacity: 1; transform: translateY(0) scale(1); }
                .auth-menu-container.closed { opacity: 0; pointer-events: none; transform: translateY(-10px) scale(0.95); }
                .auth-menu-link, .auth-menu-button { display: block; width: 100%; text-align: left; padding: 0.5rem 0.75rem; font-size: 0.875rem; color: #d1d5db; border-radius: 0.375rem; transition: background-color 0.2s, color 0.2s; }
                .auth-menu-link:hover, .auth-menu-button:hover { background-color: rgb(55 65 81); color: white; }

                /* Scrollable Tab Wrapper (NEW) */
                .tab-wrapper {
                    flex-grow: 1;
                    display: flex;
                    align-items: center;
                    position: relative; /* Context for absolute buttons */
                    min-width: 0; /* Needed for flex item to shrink properly */
                    margin: 0 1rem; /* Added margin for visual spacing */
                }

                /* Horizontal Scrollable Tabs Styles */
                .tab-scroll-container {
                    flex-grow: 1; /* Allows the tab container to take up available space */
                    display: flex;
                    align-items: center;
                    overflow-x: auto; /* Enable horizontal scrolling */
                    -webkit-overflow-scrolling: touch; /* Smoother scrolling on iOS */
                    scrollbar-width: none; /* Hide scrollbar for Firefox */
                    -ms-overflow-style: none; /* Hide scrollbar for IE and Edge */
                    padding-bottom: 5px; /* Add padding for scroll visibility */
                    margin-bottom: -5px; /* Counteract padding-bottom for visual alignment */
                    scroll-behavior: smooth; /* ADDED for smooth scrolling */
                }
                /* Hide scrollbar for Chrome, Safari, and Opera */
                .tab-scroll-container::-webkit-scrollbar { display: none; }

                /* Scroll Glide Buttons (NEW) */
                .scroll-glide-button {
                    position: absolute;
                    top: 0;
                    height: 100%;
                    width: 2rem; /* Half button width */
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(0, 0, 0, 0.7); /* Black, semi-transparent */
                    color: white;
                    font-size: 1.2rem;
                    cursor: pointer;
                    opacity: 0; /* Hidden by default, managed by JS */
                    transition: opacity 0.3s, background 0.3s;
                    z-index: 10;
                    pointer-events: none; /* Disable interaction when hidden */
                }
                .scroll-glide-button:hover {
                    background: rgba(0, 0, 0, 0.9);
                }
                
                /* Position and gradient for left button */
                #glide-left {
                    left: 0;
                    border-top-right-radius: 0.5rem;
                    border-bottom-right-radius: 0.5rem;
                    /* Fade effect to blend into the tabs */
                    background: linear-gradient(to right, rgba(0, 0, 0, 0.7), transparent);
                }

                /* Position and gradient for right button */
                #glide-right {
                    right: 0;
                    border-top-left-radius: 0.5rem;
                    border-bottom-left-radius: 0.5rem;
                    /* Fade effect to blend into the tabs */
                    background: linear-gradient(to left, rgba(0, 0, 0, 0.7), transparent);
                }

                /* Visibility class controlled by JS */
                .scroll-glide-button.visible {
                    opacity: 1;
                    pointer-events: auto;
                }

                .nav-tab {
                    flex-shrink: 0; /* Prevents tabs from shrinking */
                    padding: 0.5rem 1rem;
                    color: #9ca3af; /* gray-400 */
                    font-size: 0.875rem;
                    font-weight: 500;
                    border-radius: 0.5rem;
                    transition: all 0.2s;
                    text-decoration: none;
                    line-height: 1.5;
                    display: flex;
                    align-items: center;
                    margin-right: 0.5rem; /* Spacing between tabs */
                    border: 1px solid transparent;
                }
                .nav-tab:hover {
                    color: white;
                    background-color: rgb(55 65 81); /* gray-700 */
                }
                .nav-tab.active {
                    color: #4f46e5; /* indigo-600 - Highlight color */
                    border-color: #4f46e5;
                    background-color: rgba(79, 70, 229, 0.1); /* indigo-600 with opacity */
                }
                .nav-tab.active:hover {
                    color: #6366f1; /* indigo-500 */
                    border-color: #6366f1;
                    background-color: rgba(79, 70, 229, 0.15);
                }
            `;
            document.head.appendChild(style);
        };

        // --- Helper to normalize URL paths for comparison ---
        const normalizePath = (url) => {
            try {
                // Ensure URL is absolute for proper parsing relative to the current domain
                let path = new URL(url, window.location.origin).pathname;
                // Replace multiple slashes with single slash (for consistency)
                path = path.replace(/\/+/g, '/');
                // Ensure it starts with a '/' and doesn't end with one (unless it's just '/')
                if (path !== '/' && path.endsWith('/')) {
                    path = path.slice(0, -1);
                }
                // Ensure it starts with '/'
                if (!path.startsWith('/')) {
                    path = '/' + path;
                }
                // Convert to lowercase for case-insensitive comparison
                return path.toLowerCase();
            } catch (e) {
                console.error("Error normalizing URL:", url, e);
                return '';
            }
        };
        
        // --- NEW: Function to control visibility of scroll glide buttons ---
        const updateScrollGilders = () => {
            const container = document.querySelector('.tab-scroll-container');
            const leftButton = document.getElementById('glide-left');
            const rightButton = document.getElementById('glide-right');

            if (!container || !leftButton || !rightButton) return;
            
            // Determine scroll state
            // scrollLeft < 1 means it's scrolled all the way to the start (left)
            const isScrolledToLeft = container.scrollLeft < 1; 
            // Check if scrollLeft + offsetWidth is very close to scrollWidth (scrolled all the way to the end/right)
            const isScrolledToRight = container.scrollLeft + container.offsetWidth >= container.scrollWidth - 1; 
            const hasHorizontalOverflow = container.scrollWidth > container.offsetWidth;

            // Visibility logic
            if (hasHorizontalOverflow) {
                // Show left button if not at the start
                leftButton.classList.toggle('visible', !isScrolledToLeft);
                // Show right button if not at the end
                rightButton.classList.toggle('visible', !isScrolledToRight);
            } else {
                // Hide both buttons if there is no content overflow
                leftButton.classList.remove('visible');
                rightButton.classList.remove('visible');
            }
        };

        // --- 4. RENDER THE NAVBAR HTML ---
        const renderNavbar = (user, userData, pages) => {
            const container = document.getElementById('navbar-container');
            if (!container) return;

            const logoPath = "/images/logo.png"; // Using root-relative path
            const currentPagePath = normalizePath(window.location.pathname);

            // --- Tab Generation ---
            const tabsHtml = Object.values(pages || {}).map(page => {
                const tabPath = normalizePath(page.url);

                // Determine active state by comparing normalized paths
                const isActive = tabPath === currentPagePath;
                const activeClass = isActive ? 'active' : '';

                return `
                    <a href="${page.url}" class="nav-tab ${activeClass}">
                        <i class="fas ${page.icon} mr-2"></i>
                        ${page.name}
                    </a>
                `;
            }).join('');

            // --- Auth Views (Unchanged) ---
            const loggedOutView = `
                <div class="relative flex-shrink-0">
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
                    <div class="relative flex-shrink-0">
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

            // --- Assemble Final Navbar HTML ---
            container.innerHTML = `
                <header class="auth-navbar">
                    <nav>
                        <!-- 1. Logo (Left) -->
                        <a href="/" class="flex items-center space-x-2 flex-shrink-0">
                            <img src="${logoPath}" alt="4SP Logo" class="h-8 w-auto">
                        </a>

                        <!-- 2. Scrollable Tabs (Center, takes up all remaining space) -->
                        <div class="tab-wrapper">
                            <button id="glide-left" class="scroll-glide-button"><i class="fas fa-chevron-left"></i></button>

                            <div class="tab-scroll-container">
                                ${tabsHtml}
                            </div>
                            
                            <button id="glide-right" class="scroll-glide-button"><i class="fas fa-chevron-right"></i></button>
                        </div>

                        <!-- 3. Auth Menu (Right) -->
                        ${user ? loggedInView(user, userData) : loggedOutView}
                    </nav>
                </header>
            `;

            // --- 5. SETUP EVENT LISTENERS (Including auto-scroll and glide buttons) ---
            setupEventListeners(user);

            // Auto-scroll to the active tab if one is found
            const activeTab = document.querySelector('.nav-tab.active');
            const tabContainer = document.querySelector('.tab-scroll-container');
            if (activeTab && tabContainer) {
                // Scroll the container so the active tab is centered
                tabContainer.scrollLeft = activeTab.offsetLeft - (tabContainer.offsetWidth / 2) + (activeTab.offsetWidth / 2);
            }
            
            // INITIAL CHECK: After rendering and auto-scrolling, update glide button visibility
            // This is crucial to ensure the buttons are visible/hidden correctly on page load.
            updateScrollGilders();
        };

        const setupEventListeners = (user) => {
            const toggleButton = document.getElementById('auth-toggle');
            const menu = document.getElementById('auth-menu-container');

            // Scroll Glide Button setup
            const tabContainer = document.querySelector('.tab-scroll-container');
            const leftButton = document.getElementById('glide-left');
            const rightButton = document.getElementById('glide-right');

            if (tabContainer) {
                // Calculate dynamic scroll amount based on container width (e.g., 80% of visible width)
                // This replaces the fixed '150' to ensure a larger, more satisfying jump.
                const scrollAmount = tabContainer.offsetWidth * 0.8; 

                // Update visibility on scroll
                tabContainer.addEventListener('scroll', updateScrollGilders);
                
                // Add click behavior for glide buttons
                if (leftButton) {
                    leftButton.addEventListener('click', () => {
                        // Scroll back by 80% of the container width
                        tabContainer.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
                    });
                }
                if (rightButton) {
                    rightButton.addEventListener('click', () => {
                        // Scroll forward by 80% of the container width
                        tabContainer.scrollBy({ left: scrollAmount, behavior: 'smooth' });
                    });
                }
            }

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
                    renderNavbar(user, userData, pages);
                } catch (error) {
                    console.error("Error fetching user data:", error);
                    renderNavbar(user, null, pages); // Render even if Firestore fails
                }
            } else {
                // User is signed out.
                renderNavbar(null, null, pages);
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
