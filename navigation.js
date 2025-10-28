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
 * 22. (NEW) LOGO TINT COLOR: Added support for `logo-tint-color` property from `themes.json`.
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
    'logo-tint-color': 'transparent', // <-- ADDED: Default value for logo tint
    'navbar-bg': '#000000',
    'navbar-border': 'rgb(31 41 55)',
    'avatar-gradient': 'linear-gradient(135deg, #374151 0%, #111827 100%)',
    'avatar-border': '#4b5563',
    'menu-bg': '#000000',
    'menu-border': 'rgb(55 65 81)',
    'menu-divider': '#374151',
    'menu-text': '#d1d5db',
    'menu-username-text': '#ffffff', // --- USERNAME COLOR FIX --- (1/3) Added new variable
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
// --- USERNAME COLOR FIX --- (2/3) Modified this function
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
let currentPagesConfig = {}; // Stores all page definitions from page-identification.json
let currentUser = null; // Stores the Firebase User object
let currentUserData = null; // Stores the Firestore document data for the user
let currentIsPrivileged = false; // Is the user an admin?
let pinHintShown = localStorage.getItem('pinHintShown') === 'true'; // Has the one-time pin hint been shown?

// State for scroll persistence
let scrollPosition = 0; // Stores the scrollLeft position of the tab menu

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

    // Checks if the current page URL matches a tab's URL
    const isTabActive = (tabUrl) => {
        const tabPathname = new URL(tabUrl, window.location.origin).pathname.toLowerCase();
        const currentPathname = window.location.pathname.toLowerCase();

        // Standardize paths for comparison
        const cleanPath = (path) => {
            // Treat /folder/index.html the same as /folder/
            if (path.endsWith('/index.html')) {
                path = path.substring(0, path.lastIndexOf('/')) + '/';
            }
            // Remove trailing slash unless it's just '/'
            if (path.length > 1 && path.endsWith('/')) {
                path = path.slice(0, -1);
            }
            return path;
        };

        const currentCanonical = cleanPath(currentPathname);
        const tabCanonical = cleanPath(tabPathname);
        
        // Exact match of canonical paths (e.g., /dashboard === /dashboard)
        if (currentCanonical === tabCanonical) {
            return true;
        }

        // Secondary check for partial match, in case paths don't match exactly 
        // but the current page is a sub-page of the tab (e.g., /blog/post-1 and /blog/)
        const tabPathSuffix = tabPathname.startsWith('/') ? tabPathname.substring(1) : tabPathname;
        
        if (tabPathSuffix && currentPathname.includes(tabPathSuffix)) {
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
          
            
        } catch (error) {
            console.error("Failed to load page identification config:", error);
            // If the configuration fails to load, use a minimal set of pages for stability
            pages = {
                'home': { name: "Home", url: "../index.html", icon: "fa-solid fa-house" },
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

    // --- 3. INJECT CSS STYLES (MOVED BEFORE INITIALIZEAPP) ---
    // This now uses CSS variables for all colors and adds transitions.
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
            /* --- USERNAME COLOR FIX --- (3/3) Added new style rule */
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

            /* NEW: Glass Menu Style for Pin Context Menu */
            .glass-menu { 
                backdrop-filter: blur(10px); 
                background: var(--glass-menu-bg); 
                border: 1px solid var(--glass-menu-border); 
                transition: background-color 0.3s ease, border-color 0.3s ease;
            }

            /* Tab Menu Styles */
            .scroll-container { 
                -ms-overflow-style: none; /* IE and Edge */
                scrollbar-width: none; /* Firefox */
                scroll-behavior: smooth; /* For glide buttons */
            }
            .scroll-container::-webkit-scrollbar { display: none; }
            .tab-link { 
                white-space: nowrap; 
                padding: 0.5rem 1rem; 
                display: flex; align-items: center; gap: 0.5rem; 
                font-weight: 500; 
                color: var(--tab-text); 
                border-bottom: 2px solid transparent; 
                transition: color 0.3s, border-color 0.3s, background-color 0.3s;
            }
            .tab-link:hover { 
                color: var(--tab-hover-text); 
                border-bottom-color: var(--tab-hover-border); 
                background-color: var(--tab-hover-bg);
            }
            .tab-link.active { 
                color: var(--tab-active-text); 
                border-bottom-color: var(--tab-active-border); 
                background-color: var(--tab-active-bg);
            }
            .tab-link.active:hover { 
                color: var(--tab-active-hover-text); 
                border-bottom-color: var(--tab-active-hover-border); 
                background-color: var(--tab-active-hover-bg);
            }

            /* Glide Button Styles (Scroll Arrows) */
            .glide-button {
                position: absolute; top: 0; width: 4rem; height: 100%; z-index: 10;
                display: flex; align-items: center; cursor: pointer; opacity: 0; 
                transition: opacity 0.3s ease;
                pointer-events: none; /* Default to off */
            }
            .glide-button i { color: var(--glide-icon-color); transition: color 0.3s ease; }
            .glide-button.left { left: 0; justify-content: flex-start; background: var(--glide-gradient-left); }
            .glide-button.right { right: 0; justify-content: flex-end; background: var(--glide-gradient-right); }
            .glide-button.active { opacity: 1; pointer-events: auto; }
            .glide-button:hover i { color: #f0f0f0; }

            /* Pin Button Styles */
            .pin-btn { 
                border: 1px solid var(--pin-btn-border); 
                background-color: transparent; 
                transition: background-color 0.2s, border-color 0.3s; 
            }
            .pin-btn:hover { background-color: var(--pin-btn-hover-bg); }
            .pin-btn i { color: var(--pin-btn-icon-color); transition: color 0.3s; }
            .pin-btn:hover i { color: #ffffff; }

            /* Pin Hint Styles */
            .pin-hint { 
                background: var(--hint-bg); 
                border: 1px solid var(--hint-border); 
                color: var(--hint-text); 
                transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease;
            }
        `;
        document.head.appendChild(style);
    };

    // --- 4. FIREBASE INITIALIZATION ---

    const initializeApp = (pages) => {
        // Inject styles before the navbar is rendered
        injectStyles();
        
        // Initial Firebase setup
        const app = firebase.initializeApp(FIREBASE_CONFIG);
        auth = firebase.auth();
        db = firebase.firestore();
        currentPagesConfig = pages;
        
        // Load the user's saved theme from Local Storage
        loadAndApplyInitialTheme();

        // Add event listeners for dynamic elements that exist immediately
        setupGlobalEventListeners();

        // Set up the Auth State Listener
        auth.onAuthStateChanged(async (user) => {
            const isFirstLoad = currentUser === null; // Flag to center scroll only once
            
            // 1. Fetch user data if logged in
            let userData = null;
            let isPrivilegedUser = false;
            if (user) {
                isPrivilegedUser = user.email === PRIVILEGED_EMAIL;
                
                try {
                    const doc = await db.collection('users').doc(user.uid).get();
                    if (doc.exists) {
                        userData = doc.data();
                    } else {
                        // Create a new user record with default data
                        const newUserDoc = {
                            email: user.email,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            theme: 'Dark', // Default theme
                            pinnedPage: null,
                            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                        };
                        await db.collection('users').doc(user.uid).set(newUserDoc);
                        userData = newUserDoc;
                    }

                    // Ensure theme is always set after login
                    const themeName = userData.theme || 'Dark';
                    if (themeName !== getCurrentThemeName()) {
                         fetchThemeAndApply(themeName);
                    }

                } catch (error) {
                    console.error("Error fetching or creating user data:", error);
                }
            }

            // 2. Update global state
            currentUser = user;
            currentUserData = userData;
            currentIsPrivileged = isPrivilegedUser;
            
            // 3. Render the navbar with the new state. 
            // Full re-render on auth change, don't preserve scroll unless explicitly requested.
            renderNavbar(currentUser, currentUserData, currentPagesConfig, currentIsPrivileged, isFirstLoad);

            // 4. Handle redirect on sign-out
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
    };

    // --- 5. THEME HANDLING FUNCTIONS ---

    const getCurrentThemeName = () => {
        const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        try {
            return storedTheme ? JSON.parse(storedTheme).name : 'Dark';
        } catch (e) {
            return 'Dark';
        }
    }

    // Fetches themes.json, finds the specified theme, and applies it globally
    const fetchThemeAndApply = async (themeName) => {
        try {
            const response = await fetch('../themes.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const themes = await response.json();
            const themeToApply = themes.find(t => t.name === themeName);

            if (themeToApply) {
                window.applyTheme(themeToApply);
                localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(themeToApply)); // Save for next load
            } else {
                console.error(`Theme "${themeName}" not found in themes.json. Applying default theme.`);
                window.applyTheme(DEFAULT_THEME);
                localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(DEFAULT_THEME));
            }
        } catch (error) {
            console.error("Failed to load or apply theme:", error);
            window.applyTheme(DEFAULT_THEME);
            localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(DEFAULT_THEME));
        }
    };

    // Loads theme on initial page load (before auth state is known)
    const loadAndApplyInitialTheme = () => {
        const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        if (storedTheme) {
            try {
                const theme = JSON.parse(storedTheme);
                window.applyTheme(theme);
                return;
            } catch (e) {
                console.error("Invalid theme in Local Storage, using default.");
            }
        }
        window.applyTheme(DEFAULT_THEME);
    };

    // --- 6. CORE RENDERING FUNCTION ---

    /**
     * Renders or re-renders the entire navbar HTML structure.
     * @param {firebase.User} user - The current authenticated user object.
     * @param {object} userData - The user's firestore document data.
     * @param {object} allPages - The page configuration object.
     * @param {boolean} isPrivileged - Is the user an admin?
     * @param {boolean} isFirstLoad - Is this the very first render? Used to center scroll.
     */
    const renderNavbar = (user, userData, allPages, isPrivileged, isFirstLoad = false) => {
        const appContainer = document.getElementById('app-navbar-container');
        if (!appContainer) {
            console.error("Container #app-navbar-container not found!");
            return;
        }

        const pagesArray = Object.values(allPages);
        const tabLinksHTML = pagesArray
            .filter(page => !page.hide || isPrivileged) // Filter pages by hide property
            .map(page => {
                const isActive = isTabActive(page.url);
                const activeClass = isActive ? 'active' : '';
                const iconClass = getIconClass(page.icon);
                
                // Add special class for the 'Beta Settings' tab (now just 'Settings') if it's the target.
                // NOTE: All special styling for 'Beta Settings' texture has been removed.
                const isSettings = page.name === 'Settings' || page.name === 'Beta Settings'; 
                const settingsClass = isSettings ? 'font-semibold' : ''; 

                return `
                    <a href="${page.url}" class="tab-link ${activeClass} ${settingsClass}" data-page-key="${page.key}">
                        ${iconClass ? `<i class="${iconClass} text-lg"></i>` : ''}
                        ${page.name}
                    </a>
                `;
            })
            .join('');

        const userPinId = userData?.pinnedPage;
        const pinnedPage = userPinId ? allPages[userPinId] : null;

        const authControlsHTML = user
            ? getAuthenticatedControlsHTML(user, isPrivileged, pinnedPage)
            : getLoggedOutControlsHTML();

        const navbarHTML = `
            <header class="auth-navbar shadow-lg">
                <nav>
                    <div class="flex items-center space-x-6 h-full">
                        <a href="../index.html" class="flex items-center space-x-2">
                            <img id="navbar-logo" src="${getCurrentThemeLogoSrc()}" alt="Logo" class="h-8 w-8 object-contain">
                        </a>

                        <div class="relative flex-grow h-full max-w-full hidden md:flex">
                            <div id="glide-left" class="glide-button left hidden md:flex">
                                <i class="fa-solid fa-angle-left text-2xl"></i>
                            </div>
                            <div id="glide-right" class="glide-button right hidden md:flex">
                                <i class="fa-solid fa-angle-right text-2xl"></i>
                            </div>
                            
                            <div id="tabs-scroll-container" class="scroll-container flex items-center h-full overflow-x-scroll whitespace-nowrap">
                                ${tabLinksHTML}
                            </div>
                        </div>
                    </div>
                    
                    <div id="auth-and-pin-controls" class="relative flex items-center h-full space-x-3">
                        ${authControlsHTML}
                    </div>
                </nav>
            </header>
        `;

        appContainer.innerHTML = navbarHTML;

        // --- Post-Render Setup ---
        
        // 1. Setup Scroll Gliders (Arrows)
        const scrollContainer = document.getElementById('tabs-scroll-container');
        if (scrollContainer) {
            // Initial check and setup for scroll gliders
            const updateGliders = () => {
                if (scrollContainer.scrollWidth > scrollContainer.clientWidth) {
                    const leftGlide = document.getElementById('glide-left');
                    const rightGlide = document.getElementById('glide-right');
                    
                    const isAtStart = scrollContainer.scrollLeft < 5;
                    const isAtEnd = scrollContainer.scrollWidth - scrollContainer.clientWidth - scrollContainer.scrollLeft < 5;

                    if (leftGlide) leftGlide.classList.toggle('active', !isAtStart);
                    if (rightGlide) rightGlide.classList.toggle('active', !isAtEnd);
                } else {
                    // Hide both gliders if no scrolling is possible
                    document.getElementById('glide-left')?.classList.remove('active');
                    document.getElementById('glide-right')?.classList.remove('active');
                }
            };

            // Event listener for scroll to update gliders
            scrollContainer.addEventListener('scroll', updateGliders);
            
            // Event listeners for gliding
            document.getElementById('glide-left')?.addEventListener('click', () => {
                scrollContainer.scrollLeft -= 200;
            });
            document.getElementById('glide-right')?.addEventListener('click', () => {
                scrollContainer.scrollLeft += 200;
            });

            // Initial and debounced resize check
            updateGliders(); 
            window.addEventListener('resize', debounce(updateGliders, 100));

            // 2. Scroll Active Tab to Center on FIRST LOAD ONLY
            if (isFirstLoad) {
                const activeTab = scrollContainer.querySelector('.tab-link.active');
                if (activeTab) {
                    // Use setTimeout to ensure the DOM has settled, then scroll
                    setTimeout(() => {
                        const containerWidth = scrollContainer.clientWidth;
                        const tabWidth = activeTab.offsetWidth;
                        const tabOffset = activeTab.offsetLeft;
                        const scrollAmount = tabOffset - (containerWidth / 2) + (tabWidth / 2);
                        scrollContainer.scrollLeft = scrollAmount;
                    }, 50); // Small delay to allow layout to finish
                }
            } else {
                // Restore saved scroll position for re-renders caused by pin interactions
                requestAnimationFrame(() => {
                    scrollContainer.scrollLeft = scrollPosition;
                });
            }
            
            // 3. Save scroll position on interaction
            scrollContainer.addEventListener('scroll', () => {
                scrollPosition = scrollContainer.scrollLeft;
            });
        }
    };

    /**
     * Renders or re-renders *only* the right-side auth/pin controls.
     * Preserves the tab scroll container's state.
     * @param {firebase.User} user - The current authenticated user object.
     * @param {object} userData - The user's firestore document data.
     * @param {object} allPages - The page configuration object.
     * @param {boolean} isPrivileged - Is the user an admin?
     */
    const partialRenderAuthControls = () => {
        const authControlsContainer = document.getElementById('auth-and-pin-controls');
        if (!authControlsContainer) return;

        // Get the updated pin status
        const userPinId = currentUserData?.pinnedPage;
        const pinnedPage = userPinId ? currentPagesConfig[userPinId] : null;

        const authControlsHTML = currentUser
            ? getAuthenticatedControlsHTML(currentUser, currentIsPrivileged, pinnedPage)
            : getLoggedOutControlsHTML();

        // Save and restore the menu state to prevent flicker
        const menuContainer = document.getElementById('auth-menu-container');
        const menuState = menuContainer ? menuContainer.className : 'closed';
        
        authControlsContainer.innerHTML = authControlsHTML;

        // Restore menu state (if it was open)
        const newMenuContainer = document.getElementById('auth-menu-container');
        if (newMenuContainer && menuState.includes('open')) {
             newMenuContainer.classList.remove('closed');
             newMenuContainer.classList.add('open');
             newMenuContainer.style.pointerEvents = 'auto'; // Ensure it's clickable
        }
    };


    // --- 7. HTML TEMPLATE FUNCTIONS ---

    const getAvatarHtml = (user, sizeClass = 'h-8 w-8') => {
        const initial = user.displayName ? user.displayName.charAt(0).toUpperCase() : (user.email ? user.email.charAt(0).toUpperCase() : '?');
        
        // Use photoURL if available, otherwise use initial avatar
        if (user.photoURL) {
            return `<img class="${sizeClass} rounded-full" src="${user.photoURL}" alt="User Avatar">`;
        } else {
            return `<div class="initial-avatar ${sizeClass} rounded-full text-lg font-semibold">${initial}</div>`;
        }
    };

    const getCurrentThemeLogoSrc = () => {
        const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        if (storedTheme) {
            try {
                const theme = JSON.parse(storedTheme);
                return theme['logo-src'] || DEFAULT_THEME['logo-src'];
            } catch (e) {
                // Fallthrough to default
            }
        }
        return DEFAULT_THEME['logo-src'];
    };

    const getPinButtonHtml = (pinnedPage) => {
        const isCurrentPagePinned = pinnedPage && isTabActive(pinnedPage.url);
        const iconClass = isCurrentPagePinned ? 'fa-solid fa-thumbtack' : 'fa-solid fa-thumbtack'; // Always solid now
        
        let buttonAction = 'pin';
        let buttonTitle = 'Pin Current Page';
        let buttonColor = '';

        if (pinnedPage) {
            if (isCurrentPagePinned) {
                buttonAction = 'unpin';
                buttonTitle = 'Unpin This Page';
                buttonColor = 'text-red-400';
            } else {
                // 'Repin' is shown if a page is pinned, but it's not the current one.
                buttonAction = 'repin';
                buttonTitle = 'Repin Current Page';
                buttonColor = 'text-yellow-400';
            }
        }

        return `
            <button id="pin-button" 
                    data-action="${buttonAction}" 
                    title="${buttonTitle}"
                    class="pin-btn h-10 w-10 flex items-center justify-center rounded-full focus:outline-none transition duration-150 ease-in-out">
                <i class="${iconClass} text-xl ${buttonColor}"></i>
            </button>
        `;
    };

    const getPinnedMenuHtml = (pinnedPage) => {
        if (!pinnedPage) {
            return `
                <div class="px-3 py-2 text-sm text-gray-400">
                    <i class="fa-solid fa-thumbtack mr-2"></i>No page is currently pinned.
                </div>
            `;
        }

        const iconClass = getIconClass(pinnedPage.icon);
        const pinActionTitle = isTabActive(pinnedPage.url) ? 'Unpin This Page' : 'Unpin Pinned Page';

        return `
            <div class="px-3 py-2">
                <p class="text-xs font-semibold uppercase text-gray-400 mb-1">Pinned Page</p>
                <a href="${pinnedPage.url}" class="auth-menu-link">
                    ${iconClass ? `<i class="${iconClass} text-xl"></i>` : '<i class="fa-solid fa-arrow-up-right-from-square text-xl"></i>'}
                    ${pinnedPage.name}
                </a>
            </div>
            <div class="border-t border-gray-700 my-1"></div>
            <button id="unpin-from-menu-button" data-action="unpin" class="auth-menu-button text-red-400">
                <i class="fa-solid fa-thumbtack text-xl"></i>
                ${pinActionTitle}
            </button>
        `;
    };

    const getAuthenticatedControlsHTML = (user, isPrivileged, pinnedPage) => {
        const displayName = user.displayName || user.email || 'User';
        const pinnedMenuHtml = getPinnedMenuHtml(pinnedPage);

        return `
            <div class="relative flex items-center">
                ${getPinButtonHtml(pinnedPage)}
            </div>

            <div id="pin-hint-container" class="absolute top-full right-0 mt-3 hidden">
                <div class="pin-hint p-2 rounded-lg text-sm shadow-xl min-w-max">
                    <p class="font-semibold">Quick Access Pin</p>
                    <p class="text-xs mt-1">Click to pin the current page for one-click navigation.</p>
                </div>
            </div>

            <button id="auth-toggle" class="h-10 w-10 flex items-center justify-center border-2 rounded-full focus:outline-none transition duration-150 ease-in-out">
                ${getAvatarHtml(user)}
            </button>

            <div id="auth-menu-container" class="auth-menu-container closed">
                <div class="p-2 border-b border-gray-700 mb-2">
                    <div class="flex items-center space-x-3">
                        ${getAvatarHtml(user, 'h-10 w-10')}
                        <div>
                            <p class="text-sm font-semibold truncate auth-menu-username">${displayName}</p>
                            <p class="text-xs text-gray-400 truncate">${user.email}</p>
                        </div>
                    </div>
                </div>

                <div id="pin-context-menu" class="glass-menu rounded-lg p-1 mb-2">
                    ${pinnedMenuHtml}
                </div>

                <div class="flex flex-col space-y-1">
                    <a href="/dashboard.html" class="auth-menu-link">
                        <i class="fa-solid fa-gauge-high text-xl"></i>Dashboard
                    </a>
                    <a href="/settings.html" class="auth-menu-link">
                        <i class="fa-solid fa-gear text-xl"></i>Settings
                    </a>
                    ${isPrivileged ? `
                        <div class="border-t border-gray-700 my-1"></div>
                        <a href="/admin/settings.html" class="auth-menu-link text-yellow-400">
                            <i class="fa-solid fa-flask text-xl"></i>Admin Portal
                        </a>
                    ` : ''}
                    <div class="border-t border-gray-700 my-1"></div>
                    <button id="logout-button" class="auth-menu-button text-red-400">
                        <i class="fa-solid fa-right-from-bracket text-xl"></i>Sign out
                    </button>
                </div>
            </div>
        `;
    };

    const getLoggedOutControlsHTML = () => {
        return `
            <a href="/authentication.html" 
               class="logged-out-auth-toggle h-10 w-10 flex items-center justify-center rounded-full transition duration-150 ease-in-out" 
               title="Sign In / Register">
                <i class="fa-solid fa-user-circle text-xl"></i>
            </a>
        `;
    };


    // --- 8. EVENT LISTENERS AND HANDLERS ---

    const setupGlobalEventListeners = () => {
        // Global click listener to handle:
        // 1. Toggling the Auth Menu
        // 2. Logging out
        // 3. Pin actions
        // 4. Closing the Auth Menu when clicking outside

        document.addEventListener('click', (event) => {
            const authToggle = document.getElementById('auth-toggle');
            const authMenu = document.getElementById('auth-menu-container');
            const logoutButton = document.getElementById('logout-button');
            const pinButton = document.getElementById('pin-button');
            const unpinFromMenuButton = document.getElementById('unpin-from-menu-button');
            const pinHintContainer = document.getElementById('pin-hint-container');
            const authAndPinControls = document.getElementById('auth-and-pin-controls');

            // --- 1. & 4. Toggle/Close Auth Menu ---
            if (authToggle && authMenu) {
                const isToggleClick = authToggle.contains(event.target);
                const isMenuClick = authMenu.contains(event.target);

                if (isToggleClick) {
                    authMenu.classList.toggle('open');
                    authMenu.classList.toggle('closed');
                    // Prevent immediate close from global click if it's the toggle
                    event.stopPropagation();
                } else if (!isMenuClick && !authAndPinControls.contains(event.target)) {
                    // Clicked outside the menu and not on the pin/auth area
                    authMenu.classList.remove('open');
                    authMenu.classList.add('closed');
                }
            }

            // --- 2. Logout Action ---
            if (logoutButton && logoutButton.contains(event.target)) {
                event.preventDefault();
                handleLogout();
            }

            // --- 3. Pin Actions ---
            if (pinButton && pinButton.contains(event.target)) {
                const action = pinButton.getAttribute('data-action');
                handlePinAction(action);

                // Show one-time hint
                if (pinHintContainer && !pinHintShown) {
                    pinHintContainer.classList.remove('hidden');
                    pinHintShown = true;
                    localStorage.setItem('pinHintShown', 'true');
                    setTimeout(() => {
                        pinHintContainer.classList.add('hidden');
                    }, 5000);
                }
            }

            if (unpinFromMenuButton && unpinFromMenuButton.contains(event.target)) {
                 handlePinAction('unpin');
                 // Close the menu after unpinning
                 if (authMenu) {
                     authMenu.classList.remove('open');
                     authMenu.classList.add('closed');
                 }
            }
        });
    };

    // Handler for signing out
    const handleLogout = async () => {
        try {
            await auth.signOut();
            // The onAuthStateChanged listener will handle the UI update and redirect.
            console.log("User signed out successfully.");
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    // Handler for all pin-related button clicks
    const handlePinAction = async (action) => {
        if (!currentUser) return;

        let newPinnedPageKey = null;

        // Find the page key for the current URL
        const currentPage = Object.entries(currentPagesConfig).find(([key, page]) => isTabActive(page.url));
        if (!currentPage) {
            console.warn("Cannot pin: Current page is not in the page configuration.");
            return;
        }
        const currentPageKey = currentPage[0];
        const currentPinnedPageKey = currentUserData?.pinnedPage;

        switch(action) {
            case 'pin':
            case 'repin':
                // Set the current page as the new pinned page
                newPinnedPageKey = currentPageKey;
                break;
            case 'unpin':
                if (currentPinnedPageKey === currentPageKey) {
                    // Unpin only if the current page is the pinned page
                    newPinnedPageKey = null;
                } else if (currentPinnedPageKey) {
                    // If 'unpin' is clicked from the menu when it's not the current page, unpin it anyway.
                    newPinnedPageKey = null; 
                } else {
                    // Nothing to unpin
                    return;
                }
                break;
            default:
                return;
        }

        // Only proceed if the pin state is actually changing
        if (newPinnedPageKey === currentPinnedPageKey) return;

        try {
            // Update Firestore
            await db.collection('users').doc(currentUser.uid).update({
                pinnedPage: newPinnedPageKey
            });

            // Update local state and partially re-render the controls
            currentUserData = { ...currentUserData, pinnedPage: newPinnedPageKey };
            
            // Partial update ensures scroll position is preserved
            partialRenderAuthControls();

        } catch (error) {
            console.error("Error updating pinned page:", error);
        }
    };


    // --- START THE PROCESS ---
    document.addEventListener('DOMContentLoaded', run);

})();
