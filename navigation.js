/**
 * navigation.js
 * * This is a fully self-contained script to create a dynamic, authentication-aware
 * navigation bar for your website. It handles everything from Firebase initialization
 * to rendering user-specific information. It now includes a horizontally scrollable
 * tab menu loaded from page-identification.json.
 *
 * --- UPDATES & FEATURES ---
 * 1. ADMIN EMAIL SET: The privileged email is set to 4simpleproblems@gmail.com.
 * 2. AI FEATURES REMOVED: All AI-related code has been removed.
 * 3. GOLD ADMIN TAB REMOVED: The 'Beta Settings' tab no longer has a special texture.
 * 4. SETTINGS LINK: Includes the 'Settings' link in the authenticated user's dropdown menu.
 * 5. ACTIVE TAB SCROLL: Now scrolls the active tab to the center only on the initial page load, preventing unwanted centering during subsequent re-renders (like sign-in/out).
 * 6. LOGOUT REDIRECT: Redirects logged-out users away from logged-in pages.
 * 7. PIN BUTTON: Adds a persistent 'Pin' button next to the auth icon for quick page access.
 * 8. GLIDE FADE UPDATED: Glide button fade now spans the full navbar height smoothly.
 * 9. INSTANT GLIDE: Scroll-end glide buttons (arrows) now update instantly with no delay.
 * 10. PIN HINT: A one-time hint now appears on first click of the pin button.
 * 11. PIN ICON: Pin icon is now solid at all times (hover effect removed).
 * 12. SCROLL PERSISTENCE: The scroll position is now saved and restored using requestAnimationFrame during re-renders caused by pin interactions, ensuring a smooth experience.
 * 13. PARTIAL UPDATE: Pin menu interactions now only refresh the pin area's HTML, leaving the main tab scroll container untouched, eliminating all scrolling jumps.
 * 14. AUTH PARTIAL UPDATE: Hiding or showing the pin button now partially refreshes the *entire* auth/pin control area (excluding the scroll menu), ensuring the auth dropdown menu updates instantly.
 * 15. (FIXED) DASHBOARD MENU ALIGNMENT: Fixed an issue where the user info in the dropdown menu was incorrectly centered.
 * 16. (UPDATED) REPIN BUTTON: Repurposed 'Repin Current' to a simple 'Repin' button that shows up whenever the current page is not the one pinned, or no page is pinned.
 * 17. (UPDATED) LOGOUT REDIRECT PATH: Changed redirect path for logged-out users to an absolute path (`/index.html`) for consistency.
 * 18. (NEW) FULL THEMING SYSTEM: Replaced all hardcoded colors with CSS variables. Added a global `window.applyTheme` function to set themes. Navbar now loads the user's saved theme from Local Storage on startup. Added CSS transitions for smooth theme fading.
 * 19. (FIXED) GLOBAL CLICK LISTENER: The global click listener now fetches button references on every click, preventing stale references after a navbar re-render.
 * 20. (FIXED) SCROLL GLIDER LOGIC: Updated scroll arrow logic to be explicit, ensuring arrows hide/show correctly at scroll edges.
 * 21. (FIXED) USERNAME COLOR: Replaced hardcoded `text-white` on username with a CSS variable (`--menu-username-text`) and updated `window.applyTheme` to set this to black for specific light themes.
 * 22. **(NEW)** LOGO TINT COLOR: Added support for `logo-tint-color` property from `themes.json`.
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

// --- NEW: Theming Configuration ---
const THEME_STORAGE_KEY = 'user-navbar-theme';

// This object defines the default "Dark" theme.
// It must contain ALL CSS variables used in injectStyles.
const DEFAULT_THEME = {
    'logo-src': '/images/logo.png',
    'logo-tint-color': 'transparent', // <--- ADDED: Default value for logo tint
    'navbar-bg': '#000000',
    'navbar-border': 'rgb(31 41 55)',
    'avatar-gradient': 'linear-gradient(135deg, #374151 0%, #111827 100%)',
    'avatar-border': '#4b5563',
    'menu-bg': '#000000',
    'menu-border': 'rgb(55 65 81)',
    'menu-divider': '#374151',
    'menu-text': '#d1d5db',
    'menu-username-text': '#ffffff', 
    'menu-item-hover-bg': 'rgb(55 65 81)',
    'menu-item-hover-text': '#ffffff',
    'glass-menu-bg': 'rgba(10, 10, 10, 0.8)',
    'glass-menu-border': 'rgba(55, 65, 81, 0.8)',
    'logged-out-icon-bg': '#010101',
    'logged-out-icon-border': '#374151',
    'logged-out-icon-color': '#DADADA',
    'glide-icon-color': '#ffffff',
    'glide-gradient-left': 'linear-gradient(to right, #000000, transparent)',
    'glide-gradient-right': 'linear-gradient(to left, #000000, transparent)',
    'tab-text': '#9ca3af',
    'tab-hover-text': '#ffffff',
    'tab-hover-border': '#d1d5db',
    'tab-hover-bg': 'rgba(79, 70, 229, 0.05)',
    'tab-active-text': '#4f46e5',
    'tab-active-border': '#4f46e5',
    'tab-active-bg': 'rgba(79, 70, 229, 0.1)',
    'tab-active-hover-text': '#6366f1',
    'tab-active-hover-border': '#6366f1',
    'tab-active-hover-bg': 'rgba(79, 70, 229, 0.15)',
    'pin-btn-border': '#4b5563',
    'pin-btn-hover-bg': '#374151',
    'pin-btn-icon-color': '#d1d5db',
    'hint-bg': '#010101',
    'hint-border': '#374151',
    'hint-text': '#ffffff'
};

/**
 * NEW: Global Theme Applicator Function
 * Applies a theme object to the :root element and updates the logo.
 * This is exposed on `window` so settings.html can call it for live preview.
 * @param {object} theme - A theme object (like DEFAULT_THEME)
 */
window.applyTheme = (theme) => {
    const root = document.documentElement;
    if (!root) return;

    // Fallback to default theme if input is invalid
    const themeToApply = theme && typeof theme === 'object' ? theme : DEFAULT_THEME;

    // Set all CSS variables
    for (const [key, value] of Object.entries(themeToApply)) {
        // Don't try to set 'name' or 'logo-src' as a CSS variable
        if (key !== 'logo-src' && key !== 'name') {
            root.style.setProperty(`--${key}`, value);
        }
    }

    // --- FIX: Handle username color for light themes ---
    // Get the default from the theme object, or the hardcoded default
    let usernameColor = themeToApply['menu-username-text'] || DEFAULT_THEME['menu-username-text']; 
    
    // Check if the theme name matches one of the light themes
    const lightThemeNames = ['Light', 'Lavender', 'Rose Gold', 'Mint'];
    if (themeToApply.name && lightThemeNames.includes(themeToApply.name)) {
        usernameColor = '#000000'; // Force black
    }
    
    root.style.setProperty('--menu-username-text', usernameColor);
    // --- END FIX ---

    // Handle logo swap
    const logoImg = document.getElementById('navbar-logo');
    if (logoImg) {
        const newLogoSrc = themeToApply['logo-src'] || DEFAULT_THEME['logo-src'];
        if (logoImg.src !== newLogoSrc) {
            logoImg.src = newLogoSrc;
        }
    }
};
// --- End Theming Configuration ---


// Variables to hold Firebase objects
let auth;
let db;

// Global state variables
let currentScrollPosition = 0; // Stores the scroll position of the tab menu
let scrollPositionRestored = false; // Flag to ensure scroll restoration runs only once per re-render
let pagesData = {}; // Stores the fetched pages from the JSON
let currentUser = null;
let currentUserData = {};
let currentIsPrivileged = false;
let isPinHintShown = false; // Flag for the one-time hint
let currentPinnedPageId = localStorage.getItem('pinned-page-id');


// --- Self-invoking function to encapsulate all logic ---
(function() {
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
    
    // Utility to get the correct icon class string
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

    // Utility to determine if a tab is currently active (handles index.html vs folder path)
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
            pagesData = pages; // Save globally
            
        } catch (error) {
            console.error("Failed to load page identification config:", error);
            // If the configuration fails to load, use a minimal set of pages for stability
            pages = {
                'home': { name: "Home", url: "../index.html", icon: "fa-solid fa-house" },
            };
            pagesData = pages;
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

    // --- 3. INJECT CSS STYLES ---
    const injectStyles = () => {
        const style = document.createElement('style');
        style.textContent = `
            /* Base Styles */
            body { padding-top: 4rem; }
            .auth-navbar { 
                position: fixed; top: 0; left: 0; right: 0; z-index: 1000; 
                background: var(--navbar-bg); 
                border-bottom: 1px solid var(--navbar-border); 
                height: 4rem; 
                transition: background-color 0.3s ease, border-color 0.3s ease;
            }
            .auth-navbar nav { padding: 0 1rem; height: 100%; display: flex; align-items: center; justify-content: space-between; gap: 1rem; position: relative; }
            
            /* NEW: Logo Tinting Support */
            #navbar-logo {
                /* Set color for SVG logos or icon fonts */
                color: var(--logo-tint-color, inherit); 
                /* Apply a subtle drop shadow to tint a white image (common trick for PNGs/JPEGs) */
                filter: drop-shadow(0 0 0.1px var(--logo-tint-color, transparent));
                transition: color 0.3s ease, filter 0.3s ease;
            }
            
            .initial-avatar { 
                background: var(--avatar-gradient); 
                font-family: sans-serif; text-transform: uppercase; display: flex; align-items: center; justify-content: center; color: white; 
            }
            #auth-toggle {
                border-color: var(--avatar-border);
                transition: border-color 0.3s ease;
            }
            
            /* Auth Dropdown Menu Styles */
            .auth-menu-container { 
                position: absolute; right: 0; top: 50px; width: 16rem; 
                background: var(--menu-bg);
                border: 1px solid var(--menu-border); 
                border-radius: 0.75rem; padding: 0.5rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -2px rgba(0,0,0,0.2); 
                transition: transform 0.2s ease-out, opacity 0.2s ease-out, background-color 0.3s ease, border-color 0.3s ease; 
                transform-origin: top right; z-index: 1010;
            }
            .auth-menu-container .border-b { /* User info divider */
                border-color: var(--menu-divider) !important;
                transition: border-color 0.3s ease;
            }
            /* Username color */
            .auth-menu-username {
                color: var(--menu-username-text);
                transition: color 0.3s ease;
            }
            .auth-menu-container.open { opacity: 1; transform: translateY(0) scale(1); }
            .auth-menu-container.closed { opacity: 0; pointer-events: none; transform: translateY(-10px) scale(0.95); }
            .auth-menu-link, .auth-menu-button { 
                display: flex; align-items: center; gap: 0.75rem; width: 100%; text-align: left; 
                padding: 0.5rem 0.75rem; font-size: 0.875rem; color: var(--menu-text); border-radius: 0.375rem; 
                transition: background-color 0.2s, color 0.3s; border: none; cursor: pointer;
            }
            .auth-menu-link:hover, .auth-menu-button:hover { 
                background-color: var(--menu-item-hover-bg); 
                color: var(--menu-item-hover-text); 
            }
            .logged-out-auth-toggle { 
                background: var(--logged-out-icon-bg); 
                border: 1px solid var(--logged-out-icon-border); 
                transition: background-color 0.3s ease, border-color 0.3s ease;
            }
            .logged-out-auth-toggle i { 
                color: var(--logged-out-icon-color); 
                transition: color 0.3s ease;
            }

            /* Glass Menu Style for Pin Context Menu */
            .glass-menu { 
                background: var(--glass-menu-bg); 
                border: 1px solid var(--glass-menu-border); 
                transition: background-color 0.3s ease, border-color 0.3s ease;
                backdrop-filter: blur(8px); 
            }
            .glass-menu::before {
                background: var(--glass-menu-bg); 
                border-top: 1px solid var(--glass-menu-border);
                border-left: 1px solid var(--glass-menu-border);
            }
            
            /* Tab Styles */
            .tab-link { 
                color: var(--tab-text);
                transition: color 0.3s, border-color 0.3s, background-color 0.3s; 
            }
            .tab-link:hover { 
                color: var(--tab-hover-text);
            }
            .tab-link.active {
                color: var(--tab-active-text);
                border-color: var(--tab-active-border);
                background-color: var(--tab-active-bg);
            }
            .tab-link.active:hover {
                color: var(--tab-active-hover-text);
                border-color: var(--tab-active-hover-border);
                background-color: var(--tab-active-hover-bg);
            }
            
            /* Glide/Scroll Button Styles */
            .glide-btn {
                color: var(--glide-icon-color);
                transition: color 0.3s;
            }
            .glide-fade-left { 
                background: var(--glide-gradient-left);
                transition: background 0.3s ease;
            }
            .glide-fade-right { 
                background: var(--glide-gradient-right);
                transition: background 0.3s ease;
            }
            
            /* Pin Button Styles */
            .pin-btn {
                border-color: var(--pin-btn-border);
                color: var(--pin-btn-icon-color);
                transition: background-color 0.2s, border-color 0.3s, color 0.3s;
            }
            .pin-btn:hover {
                background-color: var(--pin-btn-hover-bg);
            }
            .pin-btn.pinned {
                background-color: var(--pin-btn-hover-bg); /* Use hover background when pinned */
            }
            
            /* Pin Hint Styles */
            #pin-hint-popover {
                background: var(--hint-bg);
                border: 1px solid var(--hint-border);
                color: var(--hint-text);
                transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease;
            }
            #pin-hint-popover::before {
                background: var(--hint-bg);
                border-top: 1px solid var(--hint-border);
                border-left: 1px solid var(--hint-border);
            }

            /* Custom Utility Classes (Tailwind-like) */
            .flex-grow-0 { flex-grow: 0; }
            .flex-shrink-0 { flex-shrink: 0; }
            .hidden { display: none !important; }
            .block { display: block !important; }
            .w-12 { width: 3rem; }
            .h-12 { height: 3rem; }
            .rounded-full { border-radius: 9999px; }
            .p-1 { padding: 0.25rem; }
            .p-2 { padding: 0.5rem; }
            .ml-auto { margin-left: auto; }
            .mr-4 { margin-right: 1rem; }
            .text-sm { font-size: 0.875rem; }
            .font-semibold { font-weight: 600; }
            .text-gray-400 { color: #9ca3af; }
            .border { border-width: 1px; border-style: solid; }
            .absolute { position: absolute; }
            .relative { position: relative; }
            .z-10 { z-index: 10; }
            .items-center { align-items: center; }
            .justify-center { justify-content: center; }
            .cursor-pointer { cursor: pointer; }
            .text-center { text-align: center; }
            .whitespace-nowrap { white-space: nowrap; }
            .overflow-x-scroll { overflow-x: scroll; }
            .scrollbar-hide::-webkit-scrollbar { display: none; }
            .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        `;
        document.head.appendChild(style);
    };

    // --- 4. FIREBASE INITIALIZATION ---
    const initializeApp = (allPages) => {
        // Apply initial default theme (or saved theme) immediately
        injectStyles();
        loadInitialTheme();

        // 1. Initialize Firebase
        if (!firebase.apps.length) {
            firebase.initializeApp(FIREBASE_CONFIG);
        }
        auth = firebase.auth();
        db = firebase.firestore();

        // 2. Set up global click listener for dropdowns
        document.addEventListener('click', (event) => {
            const authToggle = document.getElementById('auth-toggle');
            const authMenu = document.getElementById('auth-menu');
            const pinBtn = document.getElementById('pin-button');
            const pinMenu = document.getElementById('pin-context-menu');
            const pinHint = document.getElementById('pin-hint-popover');
            
            // Handle Auth Menu
            if (authMenu) {
                const isAuthToggle = authToggle && authToggle.contains(event.target);
                const isInsideMenu = authMenu.contains(event.target);
                
                if (isAuthToggle) {
                    // Toggle the menu
                    authMenu.classList.toggle('open');
                    authMenu.classList.toggle('closed');
                } else if (!isInsideMenu) {
                    // Close the menu if clicked outside
                    authMenu.classList.remove('open');
                    authMenu.classList.add('closed');
                }
            }

            // Handle Pin Menu
            if (pinMenu) {
                const isPinToggle = pinBtn && pinBtn.contains(event.target);
                const isInsidePinMenu = pinMenu.contains(event.target);

                if (isPinToggle) {
                    // Toggle the pin menu
                    pinMenu.classList.toggle('closed');
                    // Hide the hint if it was shown and the button was clicked
                    if (pinHint) pinHint.classList.add('closed');
                } else if (!isInsidePinMenu) {
                    // Close the pin menu if clicked outside
                    pinMenu.classList.add('closed');
                }
            }
        });


        // 3. Set up Auth State Listener
        auth.onAuthStateChanged(async (user) => {
            let userData = null;
            let isPrivilegedUser = false;

            if (user) {
                // User is signed in. Fetch Firestore data.
                try {
                    const docRef = db.collection('users').doc(user.uid);
                    const doc = await docRef.get();
                    if (doc.exists) {
                        userData = doc.data();
                    }
                    // Check for admin status
                    isPrivilegedUser = user.email.toLowerCase() === PRIVILEGED_EMAIL.toLowerCase();

                } catch (error) {
                    console.error("Error fetching user data:", error);
                    userData = { displayName: user.displayName || 'User', theme: 'Dark' };
                }
            }
            
            // Ensure userData has a fallback if Firestore fetch failed or doc didn't exist
            if (!userData && user) {
                 userData = { displayName: user.displayName || 'User', theme: 'Dark' };
            }

            // Update global state
            currentUser = user;
            currentUserData = userData;
            currentIsPrivileged = isPrivilegedUser;
            
            // Apply the user's saved theme before rendering
            if (userData && userData.theme) {
                loadTheme(userData.theme);
            } else {
                 loadTheme(DEFAULT_THEME.name || 'Dark'); // Apply default theme if no user/data
            }


            // Render the navbar with the new state. 
            // Full re-render on auth change, don't preserve scroll unless explicitly requested.
            renderNavbar(currentUser, currentUserData, allPages, currentIsPrivileged);

            if (!user) {
                // User is signed out.
                // KICK USER TO INDEX: If the user is logged out, redirect them to /index.html
                const targetUrl = '/index.html'; // <--- UPDATED TO ABSOLUTE PATH
                const currentPathname = window.location.pathname;
                
                // Determine if the current page is one of the designated entry points 
                // (index or authentication page) to prevent an infinite loop.
                const isEntryPoint = currentPathname.includes('index.html') || currentPathname.includes('authentication.html') || currentPathname === '/';
                
                if (!isEntryPoint) {
                    console.log(`User logged out. Restricting access and redirecting to ${targetUrl}`);
                    window.location.href = targetUrl;
                }
            }
        });

        // --- FINAL SETUP ---
        document.addEventListener('DOMContentLoaded', run);
    };

    // --- 5. THEME UTILITIES ---
    /**
     * Loads the initial theme from Local Storage or uses the default.
     * This runs before the auth listener fires, for immediate styling.
     */
    const loadInitialTheme = () => {
        const savedThemeName = localStorage.getItem(THEME_STORAGE_KEY);
        if (savedThemeName) {
            // Load the full theme object from themes.json and apply it
            loadTheme(savedThemeName);
        } else {
            // Apply default theme immediately
            window.applyTheme(DEFAULT_THEME);
        }
    };

    /**
     * Loads a theme by name from themes.json and applies it.
     * @param {string} themeName - The name of the theme to load.
     */
    const loadTheme = async (themeName) => {
        try {
            const response = await fetch('../themes.json');
            const themes = await response.json();
            const themeToApply = themes.find(t => t.name === themeName) || DEFAULT_THEME;
            window.applyTheme(themeToApply);
            // Save the applied theme name for next load, even if from auth data
            localStorage.setItem(THEME_STORAGE_KEY, themeToApply.name);
        } catch (error) {
            console.error("Failed to load themes.json or apply theme:", error);
            window.applyTheme(DEFAULT_THEME);
        }
    };

    // --- 6. PIN UTILITIES ---

    const setPinnedPage = (pageId, preserveScroll = true) => {
        const oldPinId = currentPinnedPageId;
        if (oldPinId === pageId) {
            // Unpin if the same page is clicked
            currentPinnedPageId = null;
            localStorage.removeItem('pinned-page-id');
        } else {
            currentPinnedPageId = pageId;
            localStorage.setItem('pinned-page-id', pageId);
            // Show the one-time hint on first pin action
            if (!isPinHintShown) {
                showPinHint();
                isPinHintShown = true; 
            }
        }
        
        // Only update the controls (pin button and menu) for a smooth, no-jump experience
        renderAuthAndPinControls(currentUser, currentUserData, currentIsPrivileged, currentPinnedPageId, pagesData, preserveScroll);
    };

    const showPinHint = () => {
        const hint = document.getElementById('pin-hint-popover');
        if (!hint) return;

        hint.classList.remove('closed');
        setTimeout(() => {
            hint.classList.add('closed');
        }, 5000); // Hint remains for 5 seconds
    };
    
    // --- 7. RENDERING LOGIC ---

    /**
     * Generates the HTML for the main tab menu.
     * @param {object} allPages - The page configuration object.
     */
    const createTabMenuHTML = (allPages) => {
        const tabs = Object.entries(allPages).map(([id, page]) => {
            // Check if the current window location matches the tab's URL
            const isActive = isTabActive(page.url);
            const activeClass = isActive ? 'active border-b-2' : 'border-b-2 border-transparent';
            const iconClass = getIconClass(page.icon);

            return `
                <a href="${page.url}" 
                   id="tab-${id}"
                   class="tab-link flex-shrink-0 flex items-center h-full px-4 text-sm font-medium ${activeClass} transition-colors duration-200"
                   data-tab-id="${id}"
                   title="${page.name}">
                    ${iconClass ? `<i class="${iconClass} mr-2"></i>` : ''}
                    ${page.name}
                </a>
            `;
        }).join('');

        return `
            <div id="tab-menu-container" class="relative flex flex-grow-0 flex-shrink-0 items-center h-full mr-4">
                <div id="glide-fade-left" class="glide-fade-left absolute left-0 top-0 h-full w-12 hidden transition-opacity duration-200 pointer-events-none"></div>
                <div id="tab-menu" class="flex items-center h-full overflow-x-scroll scrollbar-hide" style="scroll-behavior: auto;">
                    ${tabs}
                </div>
                <div id="glide-fade-right" class="glide-fade-right absolute right-0 top-0 h-full w-12 transition-opacity duration-200 pointer-events-none"></div>
                
                <button id="scroll-left-btn" class="glide-btn absolute left-0 top-0 h-full w-12 flex items-center justify-start p-1.5 transition-opacity duration-200 z-10 hidden" style="background: transparent;">
                    <i class="fa-solid fa-chevron-left text-xl"></i>
                </button>
                <button id="scroll-right-btn" class="glide-btn absolute right-0 top-0 h-full w-12 flex items-center justify-end p-1.5 transition-opacity duration-200 z-10" style="background: transparent;">
                    <i class="fa-solid fa-chevron-right text-xl"></i>
                </button>
            </div>
        `;
    };

    /**
     * Generates the HTML for the user's dropdown menu.
     * @param {object} user - The Firebase user object.
     * @param {object} userData - The Firestore user data.
     * @param {boolean} isPrivileged - True if the user is the admin.
     */
    const createAuthMenuHTML = (user, userData, isPrivileged) => {
        const name = (userData && userData.displayName) ? userData.displayName : 'Loading...';
        const email = user ? user.email : 'user@example.com';
        const initial = name.charAt(0).toUpperCase();

        return `
            <div id="auth-controls" class="relative flex flex-shrink-0 items-center gap-2">
                
                ${createPinButtonAndMenuHTML(currentPinnedPageId, pagesData)}
                
                <button id="auth-toggle" class="relative w-10 h-10 rounded-full border-2 border-solid border-gray-400 overflow-hidden cursor-pointer flex-shrink-0" title="Account Settings">
                    <div class="initial-avatar w-full h-full text-lg font-bold">${initial}</div>
                </button>

                <div id="auth-menu" class="auth-menu-container closed">
                    <div class="flex flex-col items-center py-2 px-3 mb-2 border-b border-gray-700">
                        <div class="w-10 h-10 rounded-full border-2 border-solid border-gray-400 overflow-hidden mb-2">
                            <div class="initial-avatar w-full h-full text-lg font-bold">${initial}</div>
                        </div>
                        <p class="auth-menu-username text-sm font-semibold whitespace-nowrap overflow-hidden text-ellipsis max-w-full">${name}</p>
                        <p class="text-xs text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis max-w-full">${email}</p>
                    </div>
                    
                    <a href="/settings.html" class="auth-menu-link">
                        <i class="fa-solid fa-gear w-5 h-5"></i>
                        Settings
                    </a>
                    
                    ${isPrivileged ? `
                        <a href="/beta/settings.html" class="auth-menu-link">
                            <i class="fa-solid fa-screwdriver-wrench w-5 h-5"></i>
                            Beta Settings
                        </a>
                    ` : ''}

                    <button id="logout-button" class="auth-menu-button mt-2">
                        <i class="fa-solid fa-arrow-right-from-bracket w-5 h-5"></i>
                        Sign out
                    </button>
                </div>
            </div>
        `;
    };
    
    /**
     * Generates the HTML for the Pin Button and its context menu.
     * @param {string | null} pinnedId - The ID of the currently pinned page.
     * @param {object} allPages - The page configuration object.
     */
    const createPinButtonAndMenuHTML = (pinnedId, allPages) => {
        // --- Pin Button ---
        const isCurrentPagePinned = isTabActive(pinnedId ? allPages[pinnedId].url : 'NO_MATCH');
        const pinButtonClass = pinnedId ? 'pinned' : '';
        const pinIcon = pinnedId ? 'fa-solid fa-thumbtack' : 'fa-solid fa-thumbtack'; // Icon is solid regardless

        let pinTitle = 'Pin a page for quick access';
        if (pinnedId) {
            pinTitle = `Pinned: ${allPages[pinnedId].name} (Click to manage)`;
        }

        // --- Context Menu Content ---
        let contextMenuContent = '';
        
        if (pinnedId) {
            const pinnedPage = allPages[pinnedId];
            contextMenuContent += `
                <div class="px-3 py-2 text-sm font-semibold text-gray-400 border-b border-gray-700">
                    <i class="fa-solid fa-thumbtack mr-2"></i>
                    Pinned: ${pinnedPage.name}
                </div>
                <a href="${pinnedPage.url}" class="auth-menu-link block">
                    <i class="fa-solid fa-arrow-up-right-from-square w-5 h-5"></i>
                    Go to Pinned Page
                </a>
                <button data-action="unpin" class="auth-menu-button block">
                    <i class="fa-solid fa-trash-can w-5 h-5"></i>
                    Unpin Current Page
                </button>
            `;
            
            // Only show 'Repin Current' if a page is pinned, but it's *not* the current page
            if (!isCurrentPagePinned) {
                 contextMenuContent += `
                    <button data-action="repin-current" class="auth-menu-button block mt-1">
                        <i class="fa-solid fa-location-arrow w-5 h-5"></i>
                        Repin to Current Page
                    </button>
                `;
            }

        } else {
            // No page is pinned. Offer to pin the current page.
            const currentPageId = getCurrentPageId(allPages);
            const currentPage = currentPageId ? allPages[currentPageId] : null;

            if (currentPage) {
                 contextMenuContent += `
                    <div class="px-3 py-2 text-sm font-semibold text-gray-400 border-b border-gray-700">
                        <i class="fa-solid fa-thumbtack mr-2"></i>
                        No Page Pinned
                    </div>
                    <button data-action="pin-current" class="auth-menu-button block">
                        <i class="fa-solid fa-location-dot w-5 h-5"></i>
                        Pin Current Page (${currentPage.name})
                    </button>
                `;
            } else {
                contextMenuContent += `
                    <div class="px-3 py-2 text-sm font-semibold text-gray-400">
                        <i class="fa-solid fa-thumbtack mr-2"></i>
                        No Page Pinned. Browse to a page to pin it!
                    </div>
                `;
            }
        }
        
        // --- Pin Hint (One-time popover) ---
        const pinHintHTML = isPinHintShown ? '' : `
            <div id="pin-hint-popover" class="absolute bottom-full right-0 mb-3 w-48 p-2 rounded-lg text-xs font-medium border glass-menu closed z-20 transition-all duration-300 transform-origin-bottom-right">
                <div class="absolute w-3 h-3 bg-red-500 transform rotate-45 -right-0.5 bottom-0 border-r border-b"></div>
                Click this button to pin a page for instant access, regardless of your current location!
            </div>
        `;


        return `
            <div class="relative flex flex-shrink-0 items-center">
                <button id="pin-button" class="pin-btn relative w-10 h-10 rounded-full border-2 border-solid overflow-hidden cursor-pointer flex items-center justify-center flex-shrink-0 ${pinButtonClass}" title="${pinTitle}">
                    <i class="${pinIcon} text-lg"></i>
                </button>
                
                <div id="pin-context-menu" class="auth-menu-container glass-menu closed" style="width: 15rem;">
                    ${contextMenuContent}
                </div>
                
                ${pinHintHTML}
            </div>
        `;
    };


    /**
     * Generates the HTML for the logged out state.
     */
    const createLoggedOutHTML = () => {
        return `
            <div id="auth-controls" class="relative flex flex-shrink-0 items-center gap-2">
                <a href="/authentication.html" id="logged-out-auth-link" class="logged-out-auth-toggle w-10 h-10 rounded-full border-2 border-solid border-gray-400 overflow-hidden cursor-pointer flex items-center justify-center flex-shrink-0 transition-colors duration-200" title="Sign In / Register">
                    <i class="fa-solid fa-right-to-bracket text-lg text-gray-300"></i>
                </a>
            </div>
        `;
    };

    /**
     * Utility to get the ID of the current page from the config.
     * @param {object} allPages - The page configuration object.
     * @returns {string | null} The ID of the current page, or null.
     */
    const getCurrentPageId = (allPages) => {
        const url = window.location.pathname;
        const currentId = Object.keys(allPages).find(id => {
            const pageUrl = allPages[id].url;
            return isTabActive(pageUrl);
        });
        return currentId || null;
    };
    
    /**
     * Binds all necessary event listeners to the rendered elements.
     */
    const bindEventListeners = () => {
        const tabMenu = document.getElementById('tab-menu');
        const scrollLeftBtn = document.getElementById('scroll-left-btn');
        const scrollRightBtn = document.getElementById('scroll-right-btn');
        const glideFadeLeft = document.getElementById('glide-fade-left');
        const glideFadeRight = document.getElementById('glide-fade-right');
        const logoutButton = document.getElementById('logout-button');
        const pinMenu = document.getElementById('pin-context-menu');
        const authControls = document.getElementById('auth-controls');
        const pinBtn = document.getElementById('pin-button');
        
        // --- Pin Menu Actions ---
        if (pinMenu) {
            pinMenu.querySelectorAll('[data-action]').forEach(button => {
                button.addEventListener('click', (e) => {
                    const action = e.currentTarget.getAttribute('data-action');
                    const currentPageId = getCurrentPageId(pagesData);
                    
                    if (action === 'unpin') {
                        setPinnedPage(currentPinnedPageId); // Calling setPinnedPage with current ID unpins it
                    } else if (action === 'pin-current' || action === 'repin-current') {
                        // For 'pin-current' (when nothing is pinned) or 'repin-current' (when something else is pinned)
                        if (currentPageId) {
                            setPinnedPage(currentPageId);
                        } else {
                            console.warn("Cannot pin: Current page is not in the configuration.");
                        }
                    }
                    pinMenu.classList.add('closed');
                });
            });
        }
        
        // --- Logout ---
        if (logoutButton) {
            logoutButton.addEventListener('click', async () => {
                try {
                    await auth.signOut();
                    // Auth state listener handles the redirect
                    console.log("User signed out.");
                } catch (error) {
                    console.error("Error signing out:", error);
                }
            });
        }

        // --- Tab Scrolling Logic ---
        const SCROLL_DISTANCE = 150; // Pixels to scroll per click

        const updateScrollUI = () => {
            if (!tabMenu) return;

            const maxScroll = tabMenu.scrollWidth - tabMenu.clientWidth;
            const current = tabMenu.scrollLeft;

            // Update Scroll Buttons
            scrollLeftBtn.classList.toggle('hidden', current <= 5);
            scrollRightBtn.classList.toggle('hidden', current >= maxScroll - 5);

            // Update Glide Fades
            glideFadeLeft.classList.toggle('hidden', current <= 5);
            glideFadeRight.classList.toggle('hidden', current >= maxScroll - 5);
        };
        
        // Scroll function using requestAnimationFrame for smoothness
        const performScroll = (amount) => {
            if (!tabMenu) return;
            // Prevent immediate re-render updates from scrolling the preserved position
            scrollPositionRestored = false; 
            tabMenu.scrollBy({ left: amount, behavior: 'smooth' });
            // Update UI instantly on scroll button click
            // Use setTimeout to allow the smooth scroll to start before updating the state
            setTimeout(updateScrollUI, 10); 
        };

        if (tabMenu) {
            tabMenu.addEventListener('scroll', updateScrollUI);
            
            // Initial UI setup
            requestAnimationFrame(updateScrollUI);
            
            // Attach scroll button listeners
            if (scrollLeftBtn) scrollLeftBtn.addEventListener('click', () => performScroll(-SCROLL_DISTANCE));
            if (scrollRightBtn) scrollRightBtn.addEventListener('click', () => performScroll(SCROLL_DISTANCE));
            
            // Save scroll position on scroll
            tabMenu.addEventListener('scroll', () => {
                currentScrollPosition = tabMenu.scrollLeft;
            });
            
            // Center the active tab only on the FIRST full render
            if (authControls && !authControls.dataset.initialRenderDone) {
                 centerActiveTab();
                 authControls.dataset.initialRenderDone = 'true';
            }
        }
        
        // --- Window Resize Listener (Debounced) ---
        window.addEventListener('resize', debounce(() => {
            if (tabMenu) {
                updateScrollUI();
            }
        }, 100));
        
        // --- Restore Scroll Position after Partial Updates ---
        // This runs after re-renderAuthAndPinControls()
        if (tabMenu && !scrollPositionRestored) {
            // Use requestAnimationFrame to ensure the scroll position is set
            // after the browser has painted the new DOM content
            requestAnimationFrame(() => {
                tabMenu.scrollLeft = currentScrollPosition;
                updateScrollUI();
                scrollPositionRestored = true;
            });
        }
    };
    
    /**
     * Centers the active tab within the scroll container.
     */
    const centerActiveTab = () => {
        const tabMenu = document.getElementById('tab-menu');
        if (!tabMenu) return;
        
        const activeTab = tabMenu.querySelector('.tab-link.active');
        if (activeTab) {
            const scrollContainerWidth = tabMenu.clientWidth;
            const tabWidth = activeTab.offsetWidth;
            const tabOffset = activeTab.offsetLeft;
            
            // Calculate the position to scroll to:
            // tabOffset (start of tab) - (half of container width) + (half of tab width)
            const scrollTarget = tabOffset - (scrollContainerWidth / 2) + (tabWidth / 2);
            
            tabMenu.scrollLeft = scrollTarget;
            currentScrollPosition = scrollTarget; // Update global position
            
            // The scroll listener will call updateScrollUI
        }
    };
    

    /**
     * Renders or re-renders the entire navbar.
     * @param {object} user - The Firebase user object.
     * @param {object} userData - The Firestore user data.
     * @param {object} allPages - The page configuration object.
     * @param {boolean} isPrivileged - True if the user is the admin.
     */
    const renderNavbar = (user, userData, allPages, isPrivileged) => {
        const navbar = document.getElementById('auth-navbar');
        if (!navbar) {
            // Create the main navbar container if it doesn't exist
            const navbarHTML = `
                <header id="auth-navbar" class="auth-navbar">
                    <nav class="container mx-auto">
                        <div class="flex-shrink-0 mr-4">
                            <a href="/index.html" class="flex items-center">
                                <img id="navbar-logo" src="${DEFAULT_THEME['logo-src']}" alt="Logo" class="h-8 w-auto">
                            </a>
                        </div>
                        
                        ${createTabMenuHTML(allPages)}

                        ${user ? createAuthMenuHTML(user, userData, isPrivileged) : createLoggedOutHTML()}
                    </nav>
                </header>
            `;
            document.body.insertAdjacentHTML('afterbegin', navbarHTML);
            bindEventListeners();
        } else {
            // Only update the Tab Menu and Auth/Pin controls on re-render
            const tabMenuContainer = navbar.querySelector('#tab-menu-container');
            if (tabMenuContainer) {
                // To preserve scroll position, we only replace the inner HTML of the AUTH/PIN controls
            }

            // Update Auth/Pin Controls
            renderAuthAndPinControls(user, userData, isPrivileged, currentPinnedPageId, allPages, true);
        }
    };
    
    /**
     * Partially re-renders only the Auth and Pin control area.
     * This is used when the pin state changes to avoid re-rendering the whole scroll menu.
     * @param {object} user - The Firebase user object.
     * @param {object} userData - The Firestore user data.
     * @param {boolean} isPrivileged - True if the user is the admin.
     * @param {string | null} pinnedId - The ID of the currently pinned page.
     * @param {object} allPages - The page configuration object.
     * @param {boolean} preserveScroll - Whether to attempt to restore the scroll position.
     */
    const renderAuthAndPinControls = (user, userData, isPrivileged, pinnedId, allPages, preserveScroll) => {
        const navbar = document.getElementById('auth-navbar');
        if (!navbar) return;

        let existingControls = navbar.querySelector('#auth-controls');
        const newControlsHTML = user ? createAuthMenuHTML(user, userData, isPrivileged) : createLoggedOutHTML();

        if (existingControls) {
            // Replace the old controls with the new HTML to update state/icons
            existingControls.outerHTML = newControlsHTML;
        } else {
            // Fallback: If controls are missing, insert them
            const navElement = navbar.querySelector('nav');
            if (navElement) {
                navElement.insertAdjacentHTML('beforeend', newControlsHTML);
            }
        }
        
        // Re-bind all listeners, ensuring pin actions and logout work on the new DOM elements
        bindEventListeners();
    };


    // --- START THE PROCESS ---
    document.addEventListener('DOMContentLoaded', run);

})();
