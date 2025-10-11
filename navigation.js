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
 *
 * --- FIXES & UPDATES ---
 * - **MINI.JS ICON FIX:** The 'getIconClassSimple' function continues to force the 'fa-solid' prefix for simplified icon loading, matching the 'navigation-mini.js' approach.
 * - **JSON SYNC RESTORED:** The script now fetches configuration data from the external **`../page-identification.json`** file again, as requested.
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
// REVERTED to using the external file path.
const PAGE_CONFIG_URL = '../page-identification.json';

// --- Self-invoking function to encapsulate all logic ---
(function() {
    // Stop execution if Firebase config is not provided
    if (!FIREBASE_CONFIG || !FIREBASE_CONFIG.apiKey) {
        console.error("Firebase configuration is missing! Please paste your config into navigation.js.");
        return;
    }

    // --- 1. DYNAMICALLY LOAD EXTERNAL ASSETS (Optimized) ---

    // Helper to load external JS files
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

    // Helper to load external CSS files (Faster for icons)
    const loadCSS = (href) => {
        return new Promise((resolve) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            // Resolve immediately and proceed, as icons are non-critical path for the script logic
            link.onload = resolve;
            link.onerror = resolve;
            document.head.appendChild(link);
        });
    };

    // Simple debounce utility for performance
    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    };

    /**
     * **MODIFIED UTILITY FUNCTION (MINI.JS STYLE):**
     * This simpler logic forces the 'fa-solid' prefix to mimic the direct approach
     * of navigation-mini.js.
     * @param {string} iconName The icon class name from page-identification.json (e.g., 'fa-house-user').
     * @returns {string} The complete, correctly prefixed Font Awesome class string with 'fa-solid'.
     */
    const getIconClassSimple = (iconName) => {
        if (!iconName) return '';
        // 1. Remove any existing Font Awesome style prefix (fa-regular, fa-light, etc.) 
        const baseClass = iconName.replace(/fa-(solid|regular|light|thin|brands)\s*/, '').trim();
        // 2. Force the 'fa-solid' prefix and ensure it's separated by a space.
        return `fa-solid ${baseClass}`;
    };

    const run = async () => {
        let pages = {};

        // Load Icons CSS first for immediate visual display
        await loadCSS("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.1.0/css/all.min.css");

        // Fetch page configuration for the tabs
        try {
            // RESTORED: Fetching from the external JSON file.
            const response = await fetch(PAGE_CONFIG_URL);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            pages = await response.json();
            console.log("Page configuration loaded successfully from external JSON.");

        } catch (error) {
            console.error("Failed to load page identification config from external file:", error);
            // Continue execution even if pages fail to load, just without tabs
        }

        try {
            // Sequentially load Firebase modules (compat versions for simplicity).
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js");

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

        // --- 3. INJECT CSS STYLES (UPDATED for Opacity) ---
        const injectStyles = () => {
            const style = document.createElement('style');
            style.textContent = `
                /* Base Styles */
                body { padding-top: 4rem; /* 64px, equal to navbar height */ }
                /* Nav bar is now fully opaque (#000000 - pure black) */
                .auth-navbar { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; background: #000000; border-bottom: 1px solid rgb(31 41 55); height: 4rem; }
                /* Nav now needs relative positioning for glide buttons */
                .auth-navbar nav { max-width: 80rem; margin: auto; padding: 0 1rem; height: 100%; display: flex; align-items: center; justify-content: space-between; gap: 1rem; position: relative; }
                .initial-avatar { background: linear-gradient(135deg, #374151 0%, #111827 100%); font-family: 'Geist', sans-serif; text-transform: uppercase; display: flex; align-items: center; justify-content: center; color: white; }
                
                /* Auth Dropdown Menu Styles (UPDATED: Pure Black background) */
                .auth-menu-container { 
                    position: absolute; right: 0; top: 50px; width: 16rem; 
                    background: #000000; /* Pure black */
                    backdrop-filter: none; /* Removed backdrop filter for pure black */
                    -webkit-backdrop-filter: none;
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
                    scroll-behavior: smooth; 
                }
                /* Hide scrollbar for Chrome, Safari, and Opera */
                .tab-scroll-container::-webkit-scrollbar { display: none; }

                /* Scroll Glide Buttons (UPDATED: opacity is 0.8 by default for instant load) */
                .scroll-glide-button {
                    position: absolute;
                    top: 0;
                    height: 100%;
                    width: 2rem; 
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #000000; /* Solid color matching navbar */
                    color: white;
                    font-size: 1.2rem;
                    cursor: pointer;
                    opacity: 0.8; /* Always visible slightly so they don't 'wake up' */
                    transition: opacity 0.3s, background 0.3s;
                    z-index: 10;
                    pointer-events: auto; /* Allow interaction */
                }
                .scroll-glide-button:hover {
                    opacity: 1;
                }
                
                /* Position and gradient for left button */
                #glide-left {
                    left: 0;
                    border-top-right-radius: 0.5rem;
                    border-bottom-right-radius: 0.5rem;
                    background: linear-gradient(to right, #000000 50%, transparent); /* Opaque fade */
                }

                /* Position and gradient for right button */
                #glide-right {
                    right: 0;
                    border-top-left-radius: 0.5rem;
                    border-bottom-left-radius: 0.5rem;
                    background: linear-gradient(to left, #000000 50%, transparent); /* Opaque fade */
                }
                
                /* Visibility class controlled by JS to hide when not needed */
                .scroll-glide-button.hidden {
                    opacity: 0 !important;
                    pointer-events: none !important;
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

        // --- NEW: Function to robustly determine active tab (GitHub Pages fix) ---
        const isTabActive = (tabUrl) => {
            const tabPathname = new URL(tabUrl, window.location.origin).pathname.toLowerCase();
            const currentPathname = window.location.pathname.toLowerCase();

            // Helper to clean paths: remove trailing slash (unless it's root) and replace /index.html with /
            const cleanPath = (path) => {
                // If it ends with /index.html, strip that part to treat it as the folder path
                if (path.endsWith('/index.html')) {
                    path = path.substring(0, path.lastIndexOf('/')) + '/';
                }
                // Remove trailing slash unless it's the root path '/'
                if (path.length > 1 && path.endsWith('/')) {
                    path = path.substring(0, path.length - 1);
                }
                return path;
            };

            const cleanedTabPath = cleanPath(tabPathname);
            const cleanedCurrentPath = cleanPath(currentPathname);

            // Exact match
            if (cleanedTabPath === cleanedCurrentPath) {
                return true;
            }

            // Special case for root-level index files (e.g. '/' should match '/index.html')
            if (cleanedTabPath === '/' && (cleanedCurrentPath === '' || cleanedCurrentPath === '/index.html')) {
                return true;
            }
            if (cleanedCurrentPath === '/' && (cleanedTabPath === '' || cleanedTabPath === '/index.html')) {
                return true;
            }

            // Fallback: simple substring match (less reliable but catches some cases)
            if (currentPathname.includes(tabPathname.replace(/\.\./g, ''))) {
                 // A slight modification for relative paths, but the cleanPath logic should cover most.
                // This is a weak check, prefer the cleanPath exact match.
            }

            return false;
        };

        // --- 4. RENDER HTML STRUCTURE ---
        const renderNavbar = (user, pages) => {
            const currentUrl = window.location.pathname;

            // 1. Create the main navbar container
            const navbarHtml = document.createElement('header');
            navbarHtml.className = 'auth-navbar';
            navbarHtml.innerHTML = `
                <nav>
                    <a href="/" class="text-xl font-bold text-white tracking-tight flex-shrink-0 mr-4">
                        <img src="/images/logo.png" alt="Logo" class="h-8 inline-block mr-2" />
                        PROJECT ZIRCON
                    </a>

                    <div class="tab-wrapper">
                        <div id="glide-left" class="scroll-glide-button hidden">
                            <i class="${getIconClassSimple('fa-chevron-left')}"></i>
                        </div>
                        <div class="tab-scroll-container" id="nav-tabs-container">
                            ${Object.values(pages).map(page => {
                                // **CRITICAL FIX APPLIED HERE:** Use the simplified icon class utility
                                const iconClass = getIconClassSimple(page.icon);
                                const isActive = isTabActive(page.url);
                                
                                // Ensured the space before 'mr-2' is present
                                return `
                                    <a href="${page.url}" class="nav-tab ${isActive ? 'active' : ''}">
                                        <i class="${iconClass} mr-2"></i> ${page.name}
                                    </a>
                                `;
                            }).join('')}
                        </div>
                        <div id="glide-right" class="scroll-glide-button hidden">
                            <i class="${getIconClassSimple('fa-chevron-right')}"></i>
                        </div>
                    </div>
                    
                    <div class="relative flex-shrink-0 ml-4">
                        <button id="auth-button" class="flex items-center justify-center h-10 w-10 rounded-full text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-shadow">
                            </button>

                        <div id="auth-menu" class="auth-menu-container closed">
                            </div>
                    </div>
                </nav>
            `;

            // Insert placeholder for the navbar if it doesn't exist
            let existingNavbar = document.querySelector('.auth-navbar');
            if (existingNavbar) {
                existingNavbar.remove(); // Remove old one to prevent duplicates during re-render
            }
            document.body.prepend(navbarHtml);

            // Set up event listeners for the scrollable tabs
            setupScrollListeners();
            
            // Return the necessary elements for the UI update logic
            return {
                authButton: document.getElementById('auth-button'),
                authMenu: document.getElementById('auth-menu'),
                authMenuContainer: navbarHtml.querySelector('.relative.flex-shrink-0')
            };
        };

        // --- 5. HANDLE AUTH STATE AND UI UPDATES ---
        const updateAuthUI = async (user, elements) => {
            const { authButton, authMenu, authMenuContainer } = elements;
            let displayName = 'Guest';
            let photoURL = null;
            let initial = 'G';

            if (user) {
                // Fetch user data from Firestore (assuming a 'users' collection with 'uid' as doc id)
                try {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    const userData = userDoc.data();
                    
                    if (userData) {
                        displayName = userData.displayName || user.email;
                        photoURL = userData.photoURL || user.photoURL;
                    } else {
                        // Use basic Firebase user info if no Firestore data
                        displayName = user.displayName || user.email;
                        photoURL = user.photoURL;
                    }
                    
                    initial = (displayName.charAt(0) || user.email.charAt(0) || '?').toUpperCase();
                    
                } catch (error) {
                    console.warn("Error fetching user data from Firestore:", error);
                    // Fallback to basic Firebase user info
                    displayName = user.displayName || user.email || 'User';
                    initial = (displayName.charAt(0) || '?').toUpperCase();
                    photoURL = user.photoURL;
                }

                // Render Profile Picture/Initial
                if (photoURL) {
                    authButton.innerHTML = `<img src="${photoURL}" alt="Profile" class="h-full w-full object-cover rounded-full" />`;
                } else {
                    authButton.innerHTML = `<div class="initial-avatar h-full w-full rounded-full text-white">${initial}</div>`;
                }
                authButton.setAttribute('title', displayName);
                
                // Render Logged-In Menu
                authMenu.innerHTML = `
                    <div class="p-2 border-b border-gray-700">
                        <p class="text-white font-medium text-sm truncate">${displayName}</p>
                        <p class="text-gray-400 text-xs truncate">${user.email}</p>
                    </div>
                    <a href="/profile.html" class="auth-menu-link">
                        <i class="${getIconClassSimple('fa-user')} mr-2"></i> Profile
                    </a>
                    <a href="/settings.html" class="auth-menu-link">
                        <i class="${getIconClassSimple('fa-cog')} mr-2"></i> Settings
                    </a>
                    <button id="logout-button" class="auth-menu-button text-red-400 hover:text-white hover:bg-red-700/50">
                        <i class="${getIconClassSimple('fa-sign-out-alt')} mr-2"></i> Sign Out
                    </button>
                `;
                
                // Logout button listener
                document.getElementById('logout-button').onclick = () => auth.signOut();
                
            } else {
                // Render Login Icon
                authButton.innerHTML = `<i class="${getIconClassSimple('fa-user-circle')} text-gray-400 text-3xl"></i>`;
                authButton.setAttribute('title', 'Sign In');
                
                // Render Logged-Out Menu
                authMenu.innerHTML = `
                    <a href="/login.html" class="auth-menu-link">
                        <i class="${getIconClassSimple('fa-sign-in-alt')} mr-2"></i> Sign In
                    </a>
                    <a href="/register.html" class="auth-menu-link">
                        <i class="${getIconClassSimple('fa-user-plus')} mr-2"></i> Register
                    </a>
                `;
            }

            // Toggle logic for the dropdown menu
            const toggleMenu = (event) => {
                event.stopPropagation(); // Prevents click from immediately triggering the window listener
                authMenu.classList.toggle('open');
                authMenu.classList.toggle('closed');
            };

            authButton.onclick = toggleMenu;

            // Close menu when clicking outside
            window.addEventListener('click', (event) => {
                if (authMenu.classList.contains('open') && !authMenuContainer.contains(event.target)) {
                    authMenu.classList.remove('open');
                    authMenu.classList.add('closed');
                }
            });
        };

        // --- 6. SCROLL GLIDE LOGIC (NEW) ---
        const setupScrollListeners = () => {
            const container = document.getElementById('nav-tabs-container');
            const leftButton = document.getElementById('glide-left');
            const rightButton = document.getElementById('glide-right');
            const scrollDistance = 150; // Pixels to scroll

            if (!container || !leftButton || !rightButton) return;

            const checkScroll = () => {
                const scrollLeft = container.scrollLeft;
                const scrollWidth = container.scrollWidth;
                const clientWidth = container.clientWidth;

                // Toggle visibility based on scroll position
                leftButton.classList.toggle('hidden', scrollLeft === 0);
                rightButton.classList.toggle('hidden', scrollLeft + clientWidth >= scrollWidth - 1); // -1 is a buffer for floating point issues
            };

            const debouncedCheckScroll = debounce(checkScroll, 100);

            const scrollHandler = (direction) => {
                const currentScroll = container.scrollLeft;
                let newScroll;

                if (direction === 'left') {
                    newScroll = Math.max(0, currentScroll - scrollDistance);
                } else {
                    newScroll = currentScroll + scrollDistance;
                }
                
                container.scrollTo({
                    left: newScroll,
                    behavior: 'smooth'
                });
            };

            // Initial check and listeners
            checkScroll(); 
            container.addEventListener('scroll', debouncedCheckScroll);
            leftButton.addEventListener('click', () => scrollHandler('left'));
            rightButton.addEventListener('click', () => scrollHandler('right'));

            // Re-check on window resize
            window.addEventListener('resize', debouncedCheckScroll);
        };

        // --- 7. MAIN EXECUTION FLOW ---
        injectStyles();

        // Initial render of the structure (without user data yet)
        const elements = renderNavbar(null, pages);

        // Listen for Firebase Auth State Changes
        auth.onAuthStateChanged(user => {
            console.log("Auth state changed. User:", user ? user.uid : 'null');
            updateAuthUI(user, elements);
        });
    };

    // Execute the main setup function
    run();

})();
