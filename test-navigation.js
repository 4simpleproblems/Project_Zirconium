/**
 * navigation.js
 * * This is a fully self-contained script to create a dynamic, authentication-aware
 * navigation bar for your website. It handles everything from Firebase initialization
 * to rendering user-specific information.
 *
 * --- UPDATES & FEATURES ---
 * 1. ADMIN EMAIL SET: The privileged email is set to 4simpleproblems@gmail.com.
 * 2. (REVERTED) THEMEING: All theme logic has been removed.
 * 3. DYNAMIC STYLING: The script now reads a 'navbar_style_settings' object 
 * from localStorage. This object contains all CSS variables and a logo path.
 * 4. NEW HEX VARIABLES: Now supports hex code variables for button text, icons, 
 * and highlights (`--nav-tab-dim-hex`, `--nav-accent-hex`, etc.) defined in the HTML settings.
 * 5. GLOBAL APPLIER: Exposes 'window.applyNavbarStyle(styleObject)' for
 * external pages (like settings) to call for live previews.
 * 6. LOGO SWITCHING: Reads a 'logoPath' from the style object to support light/dark logos.
 */

// =========================================================================
// >> ACTION REQUIRED: PASTE YOUR FIREBASE CONFIGURATION OBJECT HERE <<
// =========================================================================
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro",
    authDomain: "project-zirconium.firebaseapp.com",
    projectId: "project-zirconium",
    storageBucket: "project-zirconium.firebaseapp.com",
    messagingSenderId: "1096564243475",
    appId: "1:1096564243475:web:6d0956a70125eeea1ad3e6",
    measurementId: "G-1D4F692C1Q"
};
// =========================================================================

// --- Configuration ---
const PAGE_CONFIG_URL = '../page-identification.json';

// NEW: Set the specific email that is considered an administrator.
const PRIVILEGED_EMAIL = '4simpleproblems@gmail.com'; 

// =========================================================================
// >> NEW: DEFAULT STYLE DEFINITION (With Hex Variables) <<
// =========================================================================
// This is the fallback style if nothing is found in localStorage.
// The hex values match the default #000000 theme from test.html
const DEFAULT_STYLE = {
    '--nav-bg-rgb': '0, 0, 0',
    '--nav-border': 'rgb(31, 41, 55)',
    
    // Navbar Text/Icon Hex Codes
    '--nav-tab-dim-hex': '#9CA3AF',   
    '--nav-tab-normal-hex': '#E5E7EB',
    '--nav-tab-hover-hex': '#FFFFFF', 
    
    // Active/Accent Color
    '--nav-accent-hex': '#A5B4FC',    
    '--nav-accent-hover-hex': '#C7D2FE',
    '--nav-highlight-bg-rgb': '165, 180, 252', // RGB of #A5B4FC
    
    // Menu Text RGB
    '--nav-text-dim': 'rgb(156, 163, 175)', 
    '--nav-text-normal': 'rgb(229, 231, 235)', 
    '--nav-text-hover': 'rgb(255, 255, 255)',
    
    // Menu Backgrounds (Dark Mode)
    '--nav-menu-bg': 'rgb(0, 0, 0)',
    '--nav-menu-border': 'rgb(55, 65, 81)',
    '--nav-menu-hover-bg': 'rgb(55, 65, 81)',
    '--nav-menu-glass-bg': 'rgba(10, 10, 10, 0.8)',
    '--nav-menu-border-glass': 'rgba(55, 65, 81, 0.8)',
    '--nav-avatar-bg': 'linear-gradient(135deg, #374151 0%, #111827 100%)',
    'logoPath': '/images/logo.png',
    'isLight': false
};
// =========================================================================

// Variables to hold Firebase objects
let auth;
let db;

// --- Self-invoking function to encapsulate all logic ---
(function() {
    // Stop execution if Firebase config is not provided
    if (!FIREBASE_CONFIG || !FIREBASE_CONFIG.apiKey) {
        console.error("Firebase configuration is missing! Please paste your config into navigation.js.");
        return;
    }

    // --- 1. DYNAMICALLY LOAD EXTERNAL ASSETS (UNCHANGED) ---

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

    // Helper to load external CSS files (For icons)
    const loadCSS = (href) => {
        return new Promise((resolve) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = resolve;
            document.head.appendChild(link);
        });
    };

    // Simple debounce utility for performance (still used for 'resize')
    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    };
    
    // Icon class utility remains the same
    const getIconClass = (iconName) => {
        if (!iconName) return '';
        const nameParts = iconName.trim().split(/\s+/).filter(p => p.length > 0);
        let stylePrefix = 'fa-solid'; 
        let baseName = '';
        const stylePrefixes = ['fa-solid', 'fa-regular', 'fa-light', 'fa-thin', 'fa-brands'];

        const existingPrefix = nameParts.find(p => stylePrefixes.includes(p));
        if (existingPrefix) {
            stylePrefix = existingPrefix;
        }

        const nameCandidate = nameParts.find(p => p.startsWith('fa-') && !stylePrefixes.includes(p));

        if (nameCandidate) {
            baseName = nameCandidate;
        } else {
            baseName = nameParts.find(p => !stylePrefixes.includes(p));
            if (baseName && !baseName.startsWith('fa-')) {
                 baseName = `fa-${baseName}`;
            }
        }

        if (baseName) {
            return `${stylePrefix} ${baseName}`;
        }
        
        return '';
    };

    // Moved isTabActive here as it has no dependencies on firebase init
    const isTabActive = (tabUrl) => {
        const tabPathname = new URL(tabUrl, window.location.origin).pathname.toLowerCase();
        const currentPathname = window.location.pathname.toLowerCase();

        const cleanPath = (path) => {
            if (path.endsWith('/index.html')) {
                path = path.substring(0, path.lastIndexOf('/')) + '/';
            }
            if (path.length > 1 && path.endsWith('/')) {
                path = path.slice(0, -1);
            }
            return path;
        };

        const currentCanonical = cleanPath(currentPathname);
        const tabCanonical = cleanPath(tabPathname);
        
        if (currentCanonical === tabCanonical) {
            return true;
        }

        const tabPathSuffix = tabPathname.startsWith('/') ? tabPathname.substring(1) : tabPathname;
        
        if (currentPathname.endsWith(tabPathSuffix)) {
            return true;
        }

        return false;
    };


    const run = async () => {
        let pages = {};

        // Load Icons CSS first
        await loadCSS("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css");
        
        // Fetch page configuration for the tabs
        try {
            const response = await fetch(PAGE_CONFIG_URL);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            pages = await response.json();
            
            // INJECTION: Add the requested admin-only tab for demonstration
            pages['beta-settings'] = { 
                name: "Beta Settings", 
                url: "../logged-in/beta-settings.html", // <--- UPDATED PATH
                icon: "fa-solid fa-flask", 
                adminOnly: true 
            };
            
        } catch (error) {
            console.error("Failed to load page identification config:", error);
            // If the configuration fails to load, use a minimal set of pages for stability
            pages = {
                'home': { name: "Home", url: "../../index.html", icon: "fa-solid fa-house" },
                // Fallback using the new path
                'admin': { name: "Beta Settings", url: "../logged-in/beta-settings.html", icon: "fa-solid fa-flask", adminOnly: true } 
            };
        }

        try {
            // ONLY load the stable Firebase Compat modules
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js");
            
            // Initialize Firebase and start the rendering/auth process
            initializeApp(pages);

        } catch (error) {
            console.error("Failed to load core Firebase SDKs:", error);
        }
    };

    // --- 2. INITIALIZE FIREBASE AND RENDER NAVBAR (UNCHANGED LOGIC) ---
    const initializeApp = (pages) => {
        // Initialize Firebase with the compat libraries
        const app = firebase.initializeApp(FIREBASE_CONFIG);
        auth = firebase.auth();
        db = firebase.firestore();

        // --- State variables for re-rendering ---
        let allPages = pages;
        let currentUser = null;
        let currentUserData = null;
        let currentIsPrivileged = false;
        // State for current scroll position
        let currentScrollLeft = 0; 
        // Flag to ensure active tab centering only happens once per page load
        let hasScrolledToActiveTab = false; 
        // NEW: Flag to ensure global click listener is only added once
        let globalClickListenerAdded = false;

        // --- LocalStorage Keys ---
        const PINNED_PAGE_KEY = 'navbar_pinnedPage';
        const PIN_BUTTON_HIDDEN_KEY = 'navbar_pinButtonHidden';
        const PIN_HINT_SHOWN_KEY = 'navbar_pinHintShown';
        const NAVBAR_STYLE_KEY = 'navbar_style_settings'; // NEW: Style object key

        // --- Helper Functions (UNCHANGED) ---

        // Gets the key (e.g., 'home', 'dashboard') of the current page from the config
        const getCurrentPageKey = () => {
            for (const [key, page] of Object.entries(allPages)) {
                if (isTabActive(page.url)) {
                    return key;
                }
            }
            return null;
        };
        
        /**
         * Generates the HTML for the pin button and its context menu.
         * @returns {string} The HTML string for the pin button area.
         */
        const getPinButtonHtml = () => {
            const pinnedPageKey = localStorage.getItem(PINNED_PAGE_KEY);
            const isPinButtonHidden = localStorage.getItem(PIN_BUTTON_HIDDEN_KEY) === 'true';
            const currentPageKey = getCurrentPageKey();
            const pages = allPages;
            const pinnedPageData = (pinnedPageKey && pages[pinnedPageKey]) ? pages[pinnedPageKey] : null;

            if (isPinButtonHidden) {
                return '';
            }
            
            const pinButtonIcon = pinnedPageData ? getIconClass(pinnedPageData.icon) : 'fa-solid fa-map-pin';
            const pinButtonUrl = pinnedPageData ? pinnedPageData.url : '#'; // '#' signals 'pin current'
            const pinButtonTitle = pinnedPageData ? `Go to ${pinnedPageData.name}` : 'Pin current page';

            // Context Menu Options

            // NEW: Only show 'Repin' if a pin exists AND it's not the current page, OR if no pin exists but the current page is pin-able.
            const shouldShowRepin = (pinnedPageKey && pinnedPageKey !== currentPageKey) || (!pinnedPageKey && currentPageKey);
            
            const repinOption = shouldShowRepin
                ? `<button id="repin-button" class="auth-menu-link"><i class="fa-solid fa-thumbtack w-4"></i>Repin</button>` 
                : ''; 
            
            const removeOrHideOption = pinnedPageData 
                ? `<button id="remove-pin-button" class="auth-menu-link text-red-400 hover:text-red-300"><i class="fa-solid fa-xmark w-4"></i>Remove Pin</button>`
                : `<button id="hide-pin-button" class="auth-menu-link text-red-400 hover:text-red-300"><i class="fa-solid fa-eye-slash w-4"></i>Hide Button</button>`;

            return `
                <div id="pin-area-wrapper" class="relative flex-shrink-0 flex items-center">
                    <a href="${pinButtonUrl}" id="pin-button" class="w-8 h-8 rounded-full border border-gray-600 flex items-center justify-center hover:bg-gray-700 transition" title="${pinButtonTitle}">
                        <i id="pin-button-icon" class="${pinButtonIcon}"></i>
                    </a>
                    <div id="pin-context-menu" class="auth-menu-container glass-menu closed" style="width: 12rem;">
                        ${repinOption}
                        ${removeOrHideOption}
                    </div>
                    <div id="pin-hint" class="pin-hint-container">
                        Right-click for options!
                    </div>
                </div>
            `;
        }

        /**
         * Replaces the pin button area HTML and re-attaches its event listeners.
         * Used for all pin interactions that do not require a full navbar re-render.
         */
        const updatePinButtonArea = () => {
            const pinWrapper = document.getElementById('pin-area-wrapper');
            const newPinHtml = getPinButtonHtml();

            if (pinWrapper) {
                 // Check if the pin button is now hidden, if so, remove the wrapper entirely
                if (newPinHtml === '') {
                    pinWrapper.remove();
                } else {
                    // Update the HTML content
                    pinWrapper.outerHTML = newPinHtml;
                }
                // Need to re-attach listeners after DOM replacement
                setupPinEventListeners();
            } else {
                // If wrapper was not found, it might be the initial render of the pin button 
                // after it was hidden, so we need to find the parent and append.
                const authButtonContainer = document.getElementById('auth-controls-wrapper');
                if (authButtonContainer) {
                    authButtonContainer.insertAdjacentHTML('afterbegin', newPinHtml);
                    setupPinEventListeners();
                }
            }
            
            // Ensure auth menu closes if it was open when the pin area was updated
            document.getElementById('auth-menu-container')?.classList.add('closed');
            document.getElementById('auth-menu-container')?.classList.remove('open');
        };

        /**
         * Generates the HTML for the entire right-side auth/pin controls area.
         * This uses the global state variables (currentUser, currentUserData).
         * @returns {string} The HTML string for the auth controls.
         */
        const getAuthControlsHtml = () => {
            // Use the global state variables
            const user = currentUser;
            const userData = currentUserData;
            
            const pinButtonHtml = getPinButtonHtml();

            // --- Auth Views ---
            const loggedOutView = `
                <div id="auth-button-container" class="relative flex-shrink-0 flex items-center">
                    <button id="auth-toggle" class="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-gray-700 transition logged-out-auth-toggle">
                        <i class="fa-solid fa-user"></i>
                    </button>
                    <div id="auth-menu-container" class="auth-menu-container closed" style="width: 12rem;">
                        <a href="/authentication.html" class="auth-menu-link">
                            <i class="fa-solid fa-lock w-4"></i>
                            Authenticate
                        </a>
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
                    `<div class="initial-avatar w-8 h-8 rounded-full text-sm font-semibold">${initial}</div>`;
                
                const isPinHidden = localStorage.getItem(PIN_BUTTON_HIDDEN_KEY) === 'true';
                const showPinOption = isPinHidden 
                    ? `<button id="show-pin-button" class="auth-menu-link"><i class="fa-solid fa-map-pin w-4"></i>Show Pin Button</button>` 
                    : '';
                
                // FIX: Added w-full and min-w-0 to the header div to prevent centering bug
                return `
                    <div id="auth-button-container" class="relative flex-shrink-0 flex items-center">
                        <button id="auth-toggle" class="w-8 h-8 rounded-full border border-gray-600 overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500">
                            ${avatar}
                        </button>
                        <div id="auth-menu-container" class="auth-menu-container closed">
                            <div class="px-3 py-2 border-b border-gray-700 mb-2 w-full min-w-0">
                                <p class="text-sm font-semibold text-white truncate">${username}</p>
                                <p class="text-xs text-gray-400 truncate">${email}</p>
                            </div>
                            <a href="/logged-in/dashboard.html" class="auth-menu-link">
                                <i class="fa-solid fa-house-user w-4"></i>
                                Dashboard
                            </a>
                            <a href="/logged-in/settings.html" class="auth-menu-link">
                                <i class="fa-solid fa-gear w-4"></i>
                                Settings
                            </a>
                            ${showPinOption}
                            <button id="logout-button" class="auth-menu-button text-red-400 hover:bg-red-900/50 hover:text-red-300">
                                <i class="fa-solid fa-right-from-bracket w-4"></i>
                                Log Out
                            </button>
                        </div>
                    </div>
                `;
            };

            return `
                ${pinButtonHtml}
                ${user ? loggedInView(user, userData) : loggedOutView}
            `;
        }

        /**
         * Encapsulates all listeners for the auth button, dropdown, and actions.
         * This is separated so it can be re-called during a partial update.
         * @param {object} user - The current Firebase user object (or null)
         */
        const setupAuthToggleListeners = (user) => {
            const toggleButton = document.getElementById('auth-toggle');
            const menu = document.getElementById('auth-menu-container');

            // Auth Toggle
            if (toggleButton && menu) {
                toggleButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    menu.classList.toggle('closed');
                    menu.classList.toggle('open');
                    // Close pin menu if open
                    document.getElementById('pin-context-menu')?.classList.add('closed');
                    document.getElementById('pin-context-menu')?.classList.remove('open');
                });
            }

            // Auth Menu Action (Show Pin Button)
            const showPinButton = document.getElementById('show-pin-button');
            if (showPinButton) {
                showPinButton.addEventListener('click', () => {
                    localStorage.setItem(PIN_BUTTON_HIDDEN_KEY, 'false'); // 'false' string
                    // UPDATED: Call partial update instead of full re-render
                    updateAuthControlsArea();
                });
            }

            if (user) {
                const logoutButton = document.getElementById('logout-button');
                if (logoutButton) {
                    logoutButton.addEventListener('click', () => {
                        auth.signOut().catch(err => console.error("Logout failed:", err));
                    });
                }
            }
        };

        /**
         * Replaces the auth/pin area HTML and re-attaches its event listeners.
         * Used for all pin/auth-menu interactions that do not require a full navbar re-render.
         */
        const updateAuthControlsArea = () => {
            const authWrapper = document.getElementById('auth-controls-wrapper');
            if (!authWrapper) return;

            // Get new HTML using the *current* global state
            authWrapper.innerHTML = getAuthControlsHtml();

            // Re-attach listeners for the new DOM elements
            setupPinEventListeners();
            setupAuthToggleListeners(currentUser); // Pass in the global user state
        }


        /**
         * The rerenderNavbar function is now primarily for initial load and auth changes.
         * Pin interactions will use updatePinButtonArea or updateAuthControlsArea.
         * @param {boolean} preserveScroll - If true, saves and restores the current scroll position.
         */
        const rerenderNavbar = (preserveScroll = false) => {
             if (preserveScroll) {
                const tabContainer = document.querySelector('.tab-scroll-container');
                if (tabContainer) {
                    currentScrollLeft = tabContainer.scrollLeft;
                } else {
                    currentScrollLeft = 0;
                }
            }
            renderNavbar(currentUser, currentUserData, allPages, currentIsPrivileged);
        };


        // --- 3. INJECT CSS STYLES (UPDATED WITH HEX VARIABLES) ---
        const injectStyles = () => {
            const style = document.createElement('style');
            style.textContent = `
                /* NEW: :root definition for default theme and variables */
                :root {
                    --nav-bg-rgb: ${DEFAULT_STYLE['--nav-bg-rgb']};
                    --nav-border: ${DEFAULT_STYLE['--nav-border']};
                    
                    /* NEW HEX VARIABLES */
                    --nav-tab-dim-hex: ${DEFAULT_STYLE['--nav-tab-dim-hex']};
                    --nav-tab-normal-hex: ${DEFAULT_STYLE['--nav-tab-normal-hex']};
                    --nav-tab-hover-hex: ${DEFAULT_STYLE['--nav-tab-hover-hex']};
                    --nav-accent-hex: ${DEFAULT_STYLE['--nav-accent-hex']};
                    --nav-accent-hover-hex: ${DEFAULT_STYLE['--nav-accent-hover-hex']};
                    --nav-highlight-bg-rgb: ${DEFAULT_STYLE['--nav-highlight-bg-rgb']};
                    
                    /* Menu Text/RGB Variables */
                    --nav-text-dim: ${DEFAULT_STYLE['--nav-text-dim']};
                    --nav-text-normal: ${DEFAULT_STYLE['--nav-text-normal']};
                    --nav-text-hover: ${DEFAULT_STYLE['--nav-text-hover']};
                    
                    /* Menu/Avatar Variables */
                    --nav-menu-bg: ${DEFAULT_STYLE['--nav-menu-bg']};
                    --nav-menu-border: ${DEFAULT_STYLE['--nav-menu-border']};
                    --nav-menu-hover-bg: ${DEFAULT_STYLE['--nav-menu-hover-bg']};
                    --nav-menu-glass-bg: ${DEFAULT_STYLE['--nav-menu-glass-bg']};
                    --nav-menu-border-glass: ${DEFAULT_STYLE['--nav-menu-border-glass']};
                    --nav-avatar-bg: ${DEFAULT_STYLE['--nav-avatar-bg']};
                }

                /* Base Styles */
                body { padding-top: 4rem; }
                .auth-navbar { 
                    position: fixed; top: 0; left: 0; right: 0; z-index: 1000; 
                    background: rgb(var(--nav-bg-rgb)); 
                    border-bottom: 1px solid var(--nav-border); 
                    height: 4rem; 
                    transition: background-color 0.7s ease, border-color 0.7s ease;
                }
                .auth-navbar nav { padding: 0 1rem; height: 100%; display: flex; align-items: center; justify-content: space-between; gap: 1rem; position: relative; }
                .initial-avatar { 
                    background: var(--nav-avatar-bg); 
                    font-family: sans-serif; text-transform: uppercase; display: flex; align-items: center; justify-content: center; color: white;
                    transition: background 0.7s ease;
                }
                
                /* Auth Dropdown Menu Styles (Uses RGB variables for menu items) */
                .auth-menu-container { 
                    position: absolute; right: 0; top: 50px; width: 16rem; 
                    background: var(--nav-menu-bg);
                    border: 1px solid var(--nav-menu-border); 
                    border-radius: 0.75rem; padding: 0.5rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -2px rgba(0,0,0,0.2); 
                    transition: transform 0.2s ease-out, opacity 0.2s ease-out, background-color 0.7s ease, border-color 0.7s ease; 
                    transform-origin: top right; z-index: 1010;
                }
                .auth-menu-container.open { opacity: 1; transform: translateY(0) scale(1); }
                .auth-menu-container.closed { opacity: 0; pointer-events: none; transform: translateY(-10px) scale(0.95); }
                .auth-menu-link, .auth-menu-button { 
                    display: flex; align-items: center; gap: 0.75rem; width: 100%; text-align: left; 
                    padding: 0.5rem 0.75rem; font-size: 0.875rem; 
                    color: var(--nav-text-normal); /* Uses standard menu text color */
                    border-radius: 0.375rem; 
                    transition: background-color 0.2s, color 0.2s; 
                    border: none; cursor: pointer;
                }
                .auth-menu-link:hover, .auth-menu-button:hover { 
                    background-color: var(--nav-menu-hover-bg); 
                    color: var(--nav-text-hover); 
                }
                /* Special state for user info in dropdown */
                .auth-menu-container .text-white { color: var(--nav-text-hover); }
                .auth-menu-container .text-gray-400 { color: var(--nav-text-dim); }
                .auth-menu-container .border-gray-700 { border-color: var(--nav-menu-border); }

                .logged-out-auth-toggle { 
                    background: var(--nav-menu-hover-bg); 
                    border: 1px solid var(--nav-menu-border); 
                    transition: background-color 0.7s ease, border-color 0.7s ease;
                }
                .logged-out-auth-toggle i { 
                    color: var(--nav-text-normal); 
                    transition: color 0.7s ease;
                }

                /* Pin Context Menu Style */
                .glass-menu { 
                    background: var(--nav-menu-glass-bg); 
                    backdrop-filter: blur(10px); 
                    -webkit-backdrop-filter: blur(10px); 
                    border: 1px solid var(--nav-menu-border-glass);
                }
                .auth-menu-link i.w-4, .auth-menu-button i.w-4 { width: 1rem; text-align: center; } 

                /* Tab Wrapper and Glide Buttons (UNCHANGED) */
                .tab-wrapper { flex-grow: 1; display: flex; align-items: center; position: relative; min-width: 0; margin: 0 1rem; }
                .tab-scroll-container { flex-grow: 1; display: flex; align-items: center; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; -ms-overflow-style: none; padding-bottom: 5px; margin-bottom: -5px; scroll-behavior: smooth; }
                .tab-scroll-container::-webkit-scrollbar { display: none; }
                .scroll-glide-button {
                    position: absolute; top: 0; height: 100%; width: 4rem; display: flex; align-items: center; justify-content: center; 
                    color: var(--nav-text-hover); font-size: 1.2rem; cursor: pointer; 
                    opacity: 1; 
                    transition: opacity 0.3s, color 0.7s ease; 
                    z-index: 10; pointer-events: auto;
                }
                #glide-left { left: 0; background: linear-gradient(to right, rgb(var(--nav-bg-rgb)), transparent); justify-content: flex-start; padding-left: 0.5rem; }
                #glide-right { right: 0; background: linear-gradient(to left, rgb(var(--nav-bg-rgb)), transparent); justify-content: flex-end; padding-right: 0.5rem; }
                .scroll-glide-button.hidden { opacity: 0 !important; pointer-events: none !important; }
                
                /* NAV TAB STYLING (UPDATED TO USE HEX VARIABLES) */
                .nav-tab { 
                    flex-shrink: 0; padding: 0.5rem 1rem; 
                    color: var(--nav-tab-dim-hex); /* Inactive text/icon color */
                    font-size: 0.875rem; font-weight: 500; border-radius: 0.5rem; 
                    transition: all 0.2s, background-color 0.7s ease, color 0.7s ease, border-color 0.7s ease; 
                    text-decoration: none; line-height: 1.5; display: flex; align-items: center; margin-right: 0.5rem; border: 1px solid transparent; 
                }
                .nav-tab:not(.active):hover { 
                    color: var(--nav-tab-hover-hex); /* Inactive hover text/icon color */
                    border-color: var(--nav-tab-normal-hex); /* Inactive hover border color */
                    background-color: rgba(var(--nav-highlight-bg-rgb), 0.1); /* Highlight BG */
                }
                .nav-tab.active { 
                    color: var(--nav-accent-hex); /* Active text/icon color */
                    border-color: var(--nav-accent-hex); 
                    background-color: rgba(var(--nav-highlight-bg-rgb), 0.1); /* Highlight BG */
                }
                .nav-tab.active:hover { 
                    color: var(--nav-accent-hover-hex); /* Active hover text/icon color */
                    border-color: var(--nav-accent-hover-hex); 
                    background-color: rgba(var(--nav-highlight-bg-rgb), 0.15); /* Slightly stronger Highlight BG */
                }
                
                /* Pin Button Styles */
                #pin-button {
                    border-color: var(--nav-menu-border);
                    color: var(--nav-tab-dim-hex); /* Uses dimmed tab color for pin icon */
                    transition: background-color 0.2s, border-color 0.7s ease, color 0.7s ease;
                }
                #pin-button:hover {
                    background-color: var(--nav-menu-hover-bg);
                }

                /* Pin Hint Styles */
                .pin-hint-container {
                    position: absolute;
                    bottom: calc(100% + 10px); 
                    left: 50%;
                    transform: translateX(-50%) scale(0.8);
                    background: var(--nav-menu-hover-bg);
                    border: 1px solid var(--nav-menu-border);
                    color: var(--nav-text-hover);
                    padding: 0.5rem 1rem;
                    border-radius: 0.75rem;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.5);
                    opacity: 0;
                    pointer-events: none;
                    z-index: 1020;
                    transition: opacity 0.3s ease, transform 0.3s ease, background-color 0.7s ease, border-color 0.7s ease, color 0.7s ease;
                    white-space: nowrap;
                    font-size: 0.875rem;
                }
                .pin-hint-container.show {
                    opacity: 1;
                    transform: translateX(-50%) scale(1);
                    transition-delay: 0.2s; 
                }
            `;
            document.head.appendChild(style);
        };

        const updateScrollGilders = () => {
            const container = document.querySelector('.tab-scroll-container');
            const leftButton = document.getElementById('glide-left');
            const rightButton = document.getElementById('glide-right');

            if (!container || !leftButton || !rightButton) return;
            
            const hasHorizontalOverflow = container.scrollWidth > container.offsetWidth;

            if (hasHorizontalOverflow) {
                // Tolerance for floating point math
                const isScrolledToLeft = container.scrollLeft < 5; 
                const isScrolledToRight = container.scrollLeft + container.offsetWidth >= container.scrollWidth - 5; 

                // Ensure the buttons are visible initially if there is overflow
                leftButton.classList.remove('hidden');
                rightButton.classList.remove('hidden');

                if (isScrolledToLeft) {
                    leftButton.classList.add('hidden');
                }
                if (isScrolledToRight) {
                    rightButton.classList.add('hidden');
                }
            } else {
                // If there is no overflow, hide both buttons
                leftButton.classList.add('hidden');
                rightButton.classList.add('hidden');
            }
        };

        // --- 4. RENDER THE NAVBAR HTML (UNCHANGED LOGIC) ---
        const renderNavbar = (user, userData, pages, isPrivilegedUser) => {
            const container = document.getElementById('navbar-container');
            if (!container) return; 

            // Get the logo path from the default style for initial render
            const logoPath = DEFAULT_STYLE.logoPath; 
            
            // Filter and map pages for tabs
            const tabsHtml = Object.values(pages || {})
                .filter(page => !(page.adminOnly && !isPrivilegedUser)) 
                .map(page => {
                    const isActive = isTabActive(page.url);
                    const activeClass = isActive ? 'active' : '';
                    const iconClasses = getIconClass(page.icon);
                    
                    return `<a href="${page.url}" class="nav-tab ${activeClass}"><i class="${iconClasses} mr-2"></i>${page.name}</a>`;
                }).join('');

            
            // Auth controls HTML is generated by a helper
            const authControlsHtml = getAuthControlsHtml();

            // --- Assemble Final Navbar HTML ---
            container.innerHTML = `
                <header class="auth-navbar">
                    <nav>
                        <a href="/" class="flex items-center space-x-2 flex-shrink-0">
                            <img src="${logoPath}" alt="4SP Logo" class="h-8 w-auto" id="navbar-logo-img">
                        </a>

                        <div class="tab-wrapper">
                            <button id="glide-left" class="scroll-glide-button"><i class="fa-solid fa-chevron-left"></i></button>

                            <div class="tab-scroll-container">
                                ${tabsHtml}
                            </div>
                            
                            <button id="glide-right" class="scroll-glide-button"><i class="fa-solid fa-chevron-right"></i></button>
                        </div>

                        <div id="auth-controls-wrapper" class="flex items-center gap-3 flex-shrink-0">
                            ${authControlsHtml}
                        </div>
                    </nav>
                </header>
            `;

            // --- 5. SETUP EVENT LISTENERS (Called after full render) ---
            setupEventListeners(user);

            const tabContainer = document.querySelector('.tab-scroll-container');
            
            // Check if we need to restore scroll position (from a full re-render)
            if (currentScrollLeft > 0) {
                const savedScroll = currentScrollLeft;
                requestAnimationFrame(() => {
                    if (tabContainer) {
                        tabContainer.scrollLeft = savedScroll;
                    }
                    currentScrollLeft = 0; // Reset state after restoration
                });
            } else if (!hasScrolledToActiveTab) { 
                // If it's the first load, center the active tab.
                const activeTab = document.querySelector('.nav-tab.active');
                if (activeTab && tabContainer) {
                    const centerOffset = (tabContainer.offsetWidth - activeTab.offsetWidth) / 2;
                    let scrollTarget = activeTab.offsetLeft - centerOffset;
                    
                    const maxScroll = tabContainer.scrollWidth - tabContainer.offsetWidth;
                    scrollTarget = Math.max(0, Math.min(scrollTarget, maxScroll));

                    tabContainer.scrollLeft = scrollTarget;
                    hasScrolledToActiveTab = true; 
                }
            }


            // Initial check to hide/show them correctly after load
            updateScrollGilders();
        };
        
        // Split setupEventListeners into main and pin-specific, 
        // as pin listeners need to be re-attached on partial update.
        const setupPinEventListeners = () => {
            const pinButton = document.getElementById('pin-button');
            const pinContextMenu = document.getElementById('pin-context-menu');
            const repinButton = document.getElementById('repin-button');
            const removePinButton = document.getElementById('remove-pin-button');
            const hidePinButton = document.getElementById('hide-pin-button');

            if (pinButton && pinContextMenu) {
                // Left-click: Navigate or Pin
                pinButton.addEventListener('click', (e) => {
                    if (pinButton.getAttribute('href') === '#') {
                        e.preventDefault(); // Stop navigation
                        
                        // --- NEW HINT LOGIC ---
                        const hintShown = localStorage.getItem(PIN_HINT_SHOWN_KEY) === 'true';
                        if (!hintShown) {
                            const hintEl = document.getElementById('pin-hint');
                            if (hintEl) {
                                hintEl.classList.add('show');
                                localStorage.setItem(PIN_HINT_SHOWN_KEY, 'true');
                                setTimeout(() => {
                                    hintEl.classList.remove('show');
                                }, 6000); // 6 seconds
                            }
                        }
                        // --- END HINT LOGIC ---

                        const currentPageKey = getCurrentPageKey();
                        if (currentPageKey) {
                            localStorage.setItem(PINNED_PAGE_KEY, currentPageKey);
                            updatePinButtonArea(); // Use partial update!
                        } else {
                            // Optional: Add feedback that page can't be pinned
                            console.warn("This page cannot be pinned as it's not in page-identification.json");
                        }
                    }
                });

                // Right-click: Open Context Menu
                pinButton.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    pinContextMenu.classList.toggle('closed');
                    pinContextMenu.classList.toggle('open');
                    // Close auth menu if open
                    document.getElementById('auth-menu-container')?.classList.add('closed');
                    document.getElementById('auth-menu-container')?.classList.remove('open');
                });
            }

            // Context Menu Actions
            if (repinButton) {
                repinButton.addEventListener('click', () => {
                    const currentPageKey = getCurrentPageKey();
                    if (currentPageKey) {
                        localStorage.setItem(PINNED_PAGE_KEY, currentPageKey);
                        updatePinButtonArea(); // This only affects the pin button, so partial update is fine
                    }
                    // Regardless of success, close the menu
                    pinContextMenu.classList.add('closed');
                    pinContextMenu.classList.remove('open');
                });
            }
            if (removePinButton) {
                removePinButton.addEventListener('click', () => {
                    localStorage.removeItem(PINNED_PAGE_KEY);
                    updatePinButtonArea(); // This only affects the pin button, so partial update is fine
                });
            }
            if (hidePinButton) {
                hidePinButton.addEventListener('click', () => {
                    localStorage.setItem(PIN_BUTTON_HIDDEN_KEY, 'true');
                    // **UPDATED**: Call the full auth controls update,
                    // as this action needs to update the auth menu too.
                    updateAuthControlsArea();
                });
            }
        }

        const setupEventListeners = (user) => {
            // Scroll Glide Button setup
            const tabContainer = document.querySelector('.tab-scroll-container');
            const leftButton = document.getElementById('glide-left');
            const rightButton = document.getElementById('glide-right');

            // Debounce resize, but NOT scroll
            const debouncedUpdateGilders = debounce(updateScrollGilders, 50);

            if (tabContainer) {
                const scrollAmount = tabContainer.offsetWidth * 0.8; 
                // UPDATED: Scroll listener is no longer debounced
                tabContainer.addEventListener('scroll', updateScrollGilders);
                window.addEventListener('resize', debouncedUpdateGilders);
                
                if (leftButton) {
                    leftButton.addEventListener('click', () => {
                        tabContainer.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
                    });
                }
                if (rightButton) {
                    rightButton.addEventListener('click', () => {
                        tabContainer.scrollBy({ left: scrollAmount, behavior: 'smooth' });
                    });
                }
            }

            // --- Auth Toggle Listeners ---
            setupAuthToggleListeners(user);

            // --- Pin Button Event Listeners ---
            setupPinEventListeners();

            // Global click listener to close *both* menus
            // NEW: Only add this listener ONCE
            if (!globalClickListenerAdded) {
                document.addEventListener('click', (e) => {
                    const menu = document.getElementById('auth-menu-container');
                    const toggleButton = document.getElementById('auth-toggle');
                    if (menu && menu.classList.contains('open') && !menu.contains(e.target) && e.target !== toggleButton) {
                        menu.classList.add('closed');
                        menu.classList.remove('open');
                    }
                    
                    const pinButton = document.getElementById('pin-button');
                    const pinContextMenu = document.getElementById('pin-context-menu');
                    if (pinContextMenu && pinContextMenu.classList.contains('open') && !pinContextMenu.contains(e.target) && pinButton && !pinButton.contains(e.target)) {
                        pinContextMenu.classList.add('closed');
                        pinContextMenu.classList.remove('open');
                    }
                });
                globalClickListenerAdded = true;
            }
        };

        // --- 6. AUTH STATE LISTENER (UNCHANGED) ---
        auth.onAuthStateChanged(async (user) => {
            let isPrivilegedUser = false;
            let userData = null;
            
            if (user) {
                // Check for the privileged user email
                isPrivilegedUser = user.email === PRIVILEGED_EMAIL;

                // User is signed in. Fetch their data from Firestore.
                try {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    userData = userDoc.exists ? userDoc.data() : null;
                } catch (error) {
                    console.error("Error fetching user data:", error);
                    // Continue rendering even if Firestore fails
                }
            }
            
            // Update global state
            currentUser = user;
            currentUserData = userData;
            currentIsPrivileged = isPrivilegedUser;
            
            // Render the navbar with the new state. 
            renderNavbar(currentUser, currentUserData, allPages, currentIsPrivileged);

            if (!user) {
                // User is signed out.
                // KICK USER TO INDEX: If the user is logged out, redirect them to /index.html
                const targetUrl = '/index.html'; 
                const currentPathname = window.location.pathname;
                
                const isEntryPoint = currentPathname.includes('index.html') || currentPathname.includes('authentication.html') || currentPathname === '/';
                
                if (!isEntryPoint) {
                    console.log(`User logged out. Restricting access and redirecting to ${targetUrl}`);
                    window.location.href = targetUrl;
                }
            }
        });

        // --- FINAL SETUP ---
        // Create a div for the navbar to live in if it doesn't exist.
        if (!document.getElementById('navbar-container')) {
            const navbarDiv = document.createElement('div');
            navbarDiv.id = 'navbar-container';
            document.body.prepend(navbarDiv);
        }
        
        // Inject styles before anything else is rendered for best stability
        // This sets the :root defaults immediately.
        injectStyles();

        // --- NEW: STYLE APPLY LOGIC (UPDATED) ---
        
        /**
         * Applies a style object by setting CSS variables on the :root element
         * and updating the logo.
         * @param {object | null} styleObject - The full style object, or null to apply defaults.
         */
        const applyStyleSettings = (styleObject) => {
            const root = document.documentElement;
            // The logo image might not exist yet on the very first call, so we check
            const logoImg = document.getElementById('navbar-logo-img');
            
            // If null or undefined, use default
            if (!styleObject) {
                styleObject = DEFAULT_STYLE;
            }
            
            // Ensure all defaults are present just in case of a partial/old object
            styleObject = { ...DEFAULT_STYLE, ...styleObject };

            // Apply all CSS variables
            for (const [key, value] of Object.entries(styleObject)) {
                if (key.startsWith('--')) {
                    root.style.setProperty(key, value);
                }
            }

            // Update logo path
            if (logoImg && styleObject.logoPath) {
                logoImg.src = styleObject.logoPath;
            } else if (logoImg) {
                // Fallback if logoPath is missing
                logoImg.src = DEFAULT_STYLE.logoPath;
            }
        };

        // Expose the style setter so settings.html can call it for live preview.
        window.applyNavbarStyle = applyStyleSettings;

        // On initial page load, check localStorage for saved style settings.
        const savedSettingsString = localStorage.getItem(NAVBAR_STYLE_KEY);
        let settingsToApply = null; // Will trigger default
        
        if (savedSettingsString) {
            try {
                settingsToApply = JSON.parse(savedSettingsString);
            } catch (e) {
                console.error("Failed to parse navbar style settings, reverting to default.", e);
                settingsToApply = null; // Use default
            }
        }
        
        // Apply either the loaded settings or the defaults.
        applyStyleSettings(settingsToApply);
        
        // -----------------------------
    };

    // --- START THE PROCESS ---
    document.addEventListener('DOMContentLoaded', run);

})();
