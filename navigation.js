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
 * 21. **(FIXED)** USERNAME COLOR: Replaced hardcoded `text-white` on username with a CSS variable (`--menu-username-text`) and updated `window.applyTheme` to set this to black for specific light themes.
 * 22. **(NEW)** TAB CENTERING: If 9 or fewer tabs are loaded, the scroll menu is hidden, and the tabs are centered.
 * 23. **(NEW)** FIXED NAVBAR SIZING: Changed navbar height, padding, and tab dimensions from `rem` to `px` to prevent scaling with browser font-size settings.
 * 24. **(FIXED)** INITIAL AVATAR CENTERING: Changed `w-8 h-8` to `w-full h-full` on the `initial-avatar` div to ensure perfect centering of the user's initial letter inside the button.
 * 25. **(NEW)** DROPDOWN STYLING: Updated dropdown buttons to match the "Notes" app style (gap, darker hover).
 * 26. **(UPDATED)** THEME LOGIC: Removed hardcoded theme name checks from `window.applyTheme`. Theme properties (like logo and colors) are now pulled *only* from the theme object, falling back to `DEFAULT_THEME`.
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
// UPDATED: This now matches the "Dark" theme from themes.json
const DEFAULT_THEME = {
    'logo-src': '/images/logo.png', // UPDATED: Matched to Dark theme from themes.json
    'navbar-bg': '#000000',
    'navbar-border': 'rgb(31 41 55)',
    'avatar-gradient': 'linear-gradient(135deg, #374151 0%, #111827 100%)',
    'avatar-border': '#4b5563',
    'menu-bg': '#000000',
    'menu-border': 'rgb(55 65 81)',
    'menu-divider': '#374151',
    'menu-text': '#d1d5db',
    'menu-username-text': '#ffffff', 
    'menu-item-hover-bg': 'rgb(55 65 81)', // UPDATED: Matched to Dark theme from themes.json
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
        // Don't try to set 'name' or 'logo-src' as CSS variables
        if (key !== 'logo-src' && key !== 'name') {
            root.style.setProperty(`--${key}`, value);
        }
    }

    // --- UPDATED: Simplified username color logic ---
    // Get the color from the theme object, or fall back to the default theme's color
    const usernameColor = themeToApply['menu-username-text'] || DEFAULT_THEME['menu-username-text'];
    root.style.setProperty('--menu-username-text', usernameColor);
    // --- END UPDATE ---

    // Handle logo swap
    const logoImg = document.getElementById('navbar-logo');
    if (logoImg) {
        let newLogoSrc;
        if (themeToApply.name === 'Christmas') {
            newLogoSrc = '/images/logo-christmas.png';
        } else {
            newLogoSrc = themeToApply['logo-src'] || DEFAULT_THEME['logo-src'];
        }

        // Update logo source if different
        const currentSrc = logoImg.src;
        const expectedSrc = new URL(newLogoSrc, window.location.origin).href;
        if (currentSrc !== expectedSrc) {
            logoImg.src = newLogoSrc;
        }
    }
};

// --- REMOVED hexToFilter and rgbToHsl functions ---
// --- End Theming Configuration ---


// Variables to hold Firebase objects
let auth;
let db;

// --- Self-invoking function to encapsulate all logic ---
(function() {
    // This check is now performed after firebaseConfig is imported within the 'run' function.
    // if (!FIREBASE_CONFIG || !FIREBASE_CONFIG.apiKey) {
    //     console.error("Firebase configuration is missing! Please paste your config into navigation.js.");
    //     return;
    // }

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
        // Ensure the navbar container exists immediately
        if (!document.getElementById('navbar-container')) {
            const navbarDiv = document.createElement('div');
            navbarDiv.id = 'navbar-container';
            document.body.prepend(navbarDiv);
        }
        
        // Inject styles immediately so placeholders are styled
        injectStyles();

        // Inject placeholder HTML
        const container = document.getElementById('navbar-container');
        const logoPath = DEFAULT_THEME['logo-src']; 
        container.innerHTML = `
            <header class="auth-navbar">
                <nav>
                    <a href="/" class="flex items-center space-x-2 flex-shrink-0">
                        <img src="${logoPath}" alt="4SP Logo" class="h-10 w-auto" id="navbar-logo">
                    </a>

                    <div class="tab-wrapper">
                        <!-- Scroll glide buttons and tab scroll container will be dynamically added -->
                        <div class="tab-scroll-container flex justify-center items-center overflow-hidden">
                            <div class="nav-tab-placeholder"></div>
                            <div class="nav-tab-placeholder hidden sm:block"></div>
                            <div class="nav-tab-placeholder hidden md:block"></div>
                        </div>
                    </div>

                    <div id="auth-controls-wrapper" class="flex items-center gap-3 flex-shrink-0">
                        <div class="auth-toggle-placeholder"></div>
                    </div>
                </nav>
            </header>
        `;

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
            initializeApp(pages, FIREBASE_CONFIG);
        } catch (error) {
            console.error("Failed to load core Firebase SDKs:", error);
            // Optionally, render a degraded navbar if Firebase fails to load
            renderNavbar(null, null, pages, false);
        }
    };

    // --- 3. INJECT CSS STYLES (MOVED BEFORE INITIALIZEAPP) ---
    // This now uses CSS variables for all colors and transitions.
    // *** UPDATED to use px for fixed layout sizing ***
    const injectStyles = () => {
        const style = document.createElement('style');
        style.textContent = `
            /* Base Styles */
            body { padding-top: 64px; } /* UPDATED */
                        .auth-navbar {
                            position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
                            background: var(--navbar-bg);
                            border-bottom: 1px solid var(--navbar-border);
                            height: 64px; /* UPDATED */
                            transition: background-color 0.3s ease, border-color 0.3s ease;
                        }
                        .auth-navbar nav { padding: 0 1rem; height: 100%; display: flex; align-items: center; justify-content: space-between; gap: 1rem; position: relative; } /* UPDATED */
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
                            position: absolute; right: 0; top: 50px; width: 16rem; /* UPDATED top from 50px */
                            background: var(--menu-bg);
                            border: 1px solid var(--menu-border);
                            border-radius: 0.9rem; padding: 0.75rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -2px rgba(0,0,0,0.2);
                            transition: transform 0.2s ease-out, opacity 0.2s ease-out, background-color 0.3s ease, border-color 0.3s ease;
                            transform-origin: top right; z-index: 1010;
                        }                        .auth-menu-container .border-b { /* User info divider */
                            border-color: var(--menu-divider) !important;
                            transition: border-color 0.3s ease;
                        }
                        /* --- USERNAME COLOR FIX --- (3/3) Added new style rule */
                                    .auth-menu-username {
                                        color: var(--menu-username-text);
                                        transition: color 0.3s ease;
                                        text-align: left !important; /* Force left alignment */
                                        margin: 0 !important;
                                        font-weight: 400 !important;
                                    }
                                    /* NEW: Force email left alignment */
                                    .auth-menu-email {
                                        text-align: left !important;
                                        margin: 0 !important;
                                        font-weight: 400 !important;
                                    }            .auth-menu-container.open { opacity: 1; transform: translateY(0) scale(1); }
            .auth-menu-container.closed { opacity: 0; pointer-events: none; transform: translateY(-10px) scale(0.95); }

            /* NEW: Styles for the expandable "More" section */
            .auth-menu-more-section {
                display: none; /* Hidden by default */
                padding-top: 0.5rem;
                margin-top: 0.5rem;
                border-top: 1px solid var(--menu-divider);
            }

            /* UPDATED: Dropdown button styling to match notes.html */
            .auth-menu-link, .auth-menu-button { 
                display: flex; align-items: center; 
                gap: 10px; /* Replaces margin on icons */
                width: 100%; text-align: left; 
                padding: 0.5rem 0.75rem; font-size: 0.875rem; color: var(--menu-text); border-radius: 0.7rem; 
                transition: background-color 0.15s, color 0.15s; border: none; cursor: pointer;
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
                background: var(--glass-menu-bg); 
                backdrop-filter: blur(10px); 
                -webkit-backdrop-filter: blur(10px); 
                border: 1px solid var(--glass-menu-border);
                transition: background-color 0.3s ease, border-color 0.3s ease;
            }
            /* Helper for icons in menus */
            .auth-menu-link i.w-4, .auth-menu-button i.w-4 { width: 1rem; text-align: center; } 

            /* Tab Wrapper and Glide Buttons */
            .tab-wrapper { flex-grow: 1; display: flex; align-items: center; position: relative; min-width: 0; margin: 0 1rem; justify-content: center; } /* UPDATED: Added justify-content */
            .tab-scroll-container { 
                flex-grow: 1; display: flex; align-items: center; 
                overflow-x: auto; -webkit-overflow-scrolling: touch; 
                scrollbar-width: none; -ms-overflow-style: none; 
                padding-bottom: 5px; margin-bottom: -5px; 
                scroll-behavior: smooth;
                max-width: 100%; /* UPDATED: ensure it doesn't overflow parent */
                padding-left: 16px; /* MODIFICATION: Added to prevent first tab cutoff */
                padding-right: 16px; /* MODIFICATION: Added for symmetry */
            }
            .tab-scroll-container::-webkit-scrollbar { display: none; }
            .scroll-glide-button {
                position: absolute; top: 0; height: 100%; width: 64px; display: flex; align-items: center; justify-content: center; /* UPDATED width */
                color: var(--glide-icon-color); font-size: 1.2rem; cursor: pointer; 
                opacity: 1; 
                transition: opacity 0.3s, color 0.3s ease; 
                z-index: 10; pointer-events: auto;
            }
            #glide-left { 
                left: 0; background: var(--glide-gradient-left); 
                justify-content: flex-start; padding-left: 8px; /* UPDATED */
                transition: opacity 0.3s, color 0.3s ease, background 0.3s ease;
            }
            #glide-right { 
                right: 0; background: var(--glide-gradient-right); 
                justify-content: flex-end; padding-right: 8px; /* UPDATED */
                transition: opacity 0.3s, color 0.3s ease, background 0.3s ease;
            }
            .scroll-glide-button.hidden { opacity: 0 !important; pointer-events: none !important; }
            
            .nav-tab { 
                flex-shrink: 0; padding: 8px 12px; color: var(--tab-text); /* UPDATED */
                font-size: 0.875rem; font-weight: 500; border-radius: 0.7rem; 
                transition: all 0.2s, color 0.3s ease, border-color 0.3s ease, background-color 0.3s ease; 
                text-decoration: none; line-height: 1.5; display: flex; align-items: center; margin-right: 8px; /* UPDATED */
                border: 1px solid transparent; 
            }
            .nav-tab:not(.active):hover { 
                color: var(--tab-hover-text); 
                border-color: var(--tab-hover-border); 
                background-color: var(--tab-hover-bg); 
            }
            .nav-tab.active { 
                color: var(--tab-active-text); 
                border-color: var(--tab-active-border); 
                background-color: var(--tab-active-bg); 
            }
            .nav-tab.active:hover { 
                color: var(--tab-active-hover-text); 
                border-color: var(--tab-active-hover-border); 
                background-color: var(--tab-active-hover-bg); 
            }
            
            /* Pin Button */
            #pin-button {
                border-color: var(--pin-btn-border);
                transition: background-color 0.2s, border-color 0.3s ease;
            }
            #pin-button:hover {
                background-color: var(--pin-btn-hover-bg);
            }
            #pin-button-icon {
                color: var(--pin-btn-icon-color);
                transition: color 0.3s ease;
            }

            /* NEW: Pin Hint Styles */
            .pin-hint-container {
                position: absolute;
                bottom: calc(100% + 10px); /* 10px above the button */
                left: 50%;
                transform: translateX(-50%) scale(0.8);
                background: var(--hint-bg);
                border: 1px solid var(--hint-border);
                color: var(--hint-text);
                padding: 0.5rem 1rem;
                border-radius: 0.9rem;
                box-shadow: 0 4px 10px rgba(0,0,0,0.5);
                opacity: 0;
                pointer-events: none;
                z-index: 1020;
                transition: opacity 0.3s ease, transform 0.3s ease, background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease;
                white-space: nowrap;
                font-size: 0.875rem;
            }
            .pin-hint-container.show {
                opacity: 1;
                transform: translateX(-50%) scale(1);
                transition-delay: 0.2s; /* Slight delay on show */
            }

            /* --- Marquee Styles --- */
            .marquee-container {
                overflow: hidden;
                white-space: nowrap;
                position: relative;
                max-width: 100%;
            }
            
            /* Only apply mask and animation when active */
            .marquee-container.active {
                mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%);
                -webkit-mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%);
            }
            
            .marquee-content {
                display: inline-block;
                white-space: nowrap;
            }
            
            .marquee-container.active .marquee-content {
                animation: marquee 10s linear infinite;
                /* Make sure there is enough width for the scroll */
                min-width: 100%; 
            }
            
            @keyframes marquee {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); } /* Move half way (since content is duplicated) */
            }
        `;
        document.head.appendChild(style);
    };


    // --- 2. INITIALIZE FIREBASE AND RENDER NAVBAR ---
    const initializeApp = (pages, firebaseConfig) => {
        // --- Create a div for the navbar to live in if it doesn't exist.
        if (!document.getElementById('navbar-container')) {
            const navbarDiv = document.createElement('div');
            navbarDiv.id = 'navbar-container';
            document.body.prepend(navbarDiv);
        }
        
        // --- Inject styles *before* anything else.
        injectStyles();
        
        // --- NEW: Load and apply theme *before* first render.
        let savedTheme;
        try {
            savedTheme = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY));
        } catch (e) {
            savedTheme = null;
            console.warn("Could not parse saved theme from Local Storage.");
        }
        // Apply saved theme or default theme
        window.applyTheme(savedTheme || DEFAULT_THEME); 
        // --- End Theme Loading ---

        // Initialize Firebase with the compat libraries
        const app = firebase.initializeApp(firebaseConfig);
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

        // --- Helper Functions ---

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
                    <a href="${pinButtonUrl}" id="pin-button" class="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-gray-700 transition" title="${pinButtonTitle}">
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
         * Helper: Converts a hex color string to an RGB object.
         * @param {string} hex - The hex color string (e.g., "#RRGGBB" or "#RGB").
         * @returns {object} An object {r, g, b} or null if invalid.
         */
        const hexToRgb = (hex) => {
            if (!hex || typeof hex !== 'string') return null;
            let c = hex.substring(1); // Remove #
            if (c.length === 3) {
                c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
            }
            if (c.length !== 6) return null;
            const num = parseInt(c, 16);
            return {
                r: (num >> 16) & 0xFF,
                g: (num >> 8) & 0xFF,
                b: (num >> 0) & 0xFF
            };
        };

        /**
         * Helper: Calculates the relative luminance of an RGB color.
         * @param {object} rgb - An object {r, g, b}.
         * @returns {number} The luminance (0.0 to 1.0).
         */
        const getLuminance = (rgb) => {
            if (!rgb) return 0;
            const a = [rgb.r, rgb.g, rgb.b].map(v => {
                v /= 255;
                return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
            });
            return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
        };

        /**
         * Helper: Determines a contrasting text color (dark or white) for a given background gradient.
         * For saturated colors, it tries to provide a darker shade of the color, otherwise white.
         * @param {string} gradientBg - The CSS linear-gradient string.
         * @returns {string} A hex color string (e.g., "#000000" or "#FFFFFF" or darker shade).
         */
        const getLetterAvatarTextColor = (gradientBg) => {
            if (!gradientBg) return '#FFFFFF'; // Default to white for safety

            // Extract the first color from the gradient string
            const match = gradientBg.match(/#([0-9a-fA-F]{3}){1,2}/);
            const firstHexColor = match ? match[0] : null;

            if (!firstHexColor) return '#FFFFFF'; // Fallback if no hex color found

            const rgb = hexToRgb(firstHexColor);
            if (!rgb) return '#FFFFFF';

            const luminance = getLuminance(rgb);

            // If background is bright, provide a darker version of the color.
            // If background is dark, use white.
            // Threshold 0.5 is subjective, adjust as needed.
            if (luminance > 0.5) { 
                // Darken the color by reducing RGB values
                // A simple darkening: reduce R, G, B by a factor
                const darkenFactor = 0.5; // Reduce lightness by 50%
                const darkerR = Math.floor(rgb.r * darkenFactor);
                const darkerG = Math.floor(rgb.g * darkenFactor);
                const darkerB = Math.floor(rgb.b * darkenFactor);
                
                // Convert back to hex
                return `#${((1 << 24) + (darkerR << 16) + (darkerG << 8) + darkerB).toString(16).slice(1)}`;
            } else {
                return '#FFFFFF';
            }
        };
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
                        <button id="more-button" class="auth-menu-button">
                            <i id="more-button-icon" class="fa-solid fa-chevron-down w-4"></i>
                            <span id="more-button-text">Show More</span>
                        </button>
                        <div id="more-section" class="auth-menu-more-section">
                            <a href="/documentation.html" class="auth-menu-link">
                                <i class="fa-solid fa-book w-4"></i>
                                Documentation
                            </a>
                            <a href="../legal.html" class="auth-menu-link">
                                <i class="fa-solid fa-gavel w-4"></i>
                                Terms & Policies
                            </a>
                            <a href="https://buymeacoffee.com/4simpleproblems" class="auth-menu-link" target="_blank">
                                <i class="fa-solid fa-mug-hot w-4"></i>
                                Donate
                            </a>
                        </div>
                    </div>
                </div>
            `;

            const loggedInView = (user, userData) => {
                const username = userData?.username || user.displayName || 'User';
                const email = user.email || 'No email';
                const initial = (userData?.pfpLetters || username.charAt(0)).toUpperCase();
                
                // --- NEW PROFILE PICTURE LOGIC ---
                let avatarHtml = '';
                const pfpType = userData?.pfpType || 'google'; // Default to 'google'

                if (pfpType === 'custom' && userData?.customPfp) {
                    avatarHtml = `<img src="${userData.customPfp}" class="w-full h-full object-cover rounded-full" alt="Profile">`;
                } else if (pfpType === 'letter') {
                    const bg = userData?.pfpLetterBg || DEFAULT_THEME['avatar-gradient'];
                    const textColor = getLetterAvatarTextColor(bg); // Use new helper
                    const fontSizeClass = initial.length >= 3 ? 'text-xs' : (initial.length === 2 ? 'text-sm' : 'text-base'); // Dynamic font size
                    
                    avatarHtml = `<div class="initial-avatar w-full h-full rounded-full font-semibold ${fontSizeClass}" style="background: ${bg}; color: ${textColor}">${initial}</div>`;
                } else {
                    // 'google' or fallback
                    // Try to find specific Google photo first if available in providerData
                    const googleProvider = user.providerData.find(p => p.providerId === 'google.com');
                    const googlePhoto = googleProvider ? googleProvider.photoURL : null;
                    const displayPhoto = googlePhoto || user.photoURL;

                    if (displayPhoto) {
                        avatarHtml = `<img src="${displayPhoto}" class="w-full h-full object-cover rounded-full" alt="Profile">`;
                    } else {
                        // Fallback to standard letter avatar
                        const bg = DEFAULT_THEME['avatar-gradient'];
                        const textColor = getLetterAvatarTextColor(bg);
                        const fontSizeClass = initial.length >= 3 ? 'text-xs' : (initial.length === 2 ? 'text-sm' : 'text-base');
                        avatarHtml = `<div class="initial-avatar w-full h-full rounded-full font-semibold ${fontSizeClass}" style="background: ${bg}; color: ${textColor}">${initial}</div>`;
                    }
                }
                // --- END NEW LOGIC ---
                
                const isPinHidden = localStorage.getItem(PIN_BUTTON_HIDDEN_KEY) === 'true';
                const showPinOption = isPinHidden 
                    ? `<button id="show-pin-button" class="auth-menu-link"><i class="fa-solid fa-map-pin w-4"></i>Show Pin Button</button>` 
                    : '';
                
                // FIX: Added w-full and min-w-0 to the header div to prevent centering bug
                // UPDATED: Added avatar to the menu header
                return `
                    <div id="auth-button-container" class="relative flex-shrink-0 flex items-center">
                        <button id="auth-toggle" class="w-8 h-8 rounded-full border border-gray-600 overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500">
                            ${avatarHtml}
                        </button>
                        <div id="auth-menu-container" class="auth-menu-container closed">
                            <div class="border-b border-gray-700 mb-2 w-full min-w-0 flex items-center">
                                <div class="min-w-0 flex-1 overflow-hidden">
                                    <div class="marquee-container" id="username-marquee">
                                        <p class="text-sm font-semibold auth-menu-username marquee-content">${username}</p>
                                    </div>
                                    <div class="marquee-container" id="email-marquee">
                                        <p class="text-xs text-gray-400 auth-menu-email marquee-content">${email}</p>
                                    </div>
                                </div>
                            </div>
                            <a href="/logged-in/settings.html" class="auth-menu-link">
                                <i class="fa-solid fa-gear w-4"></i>
                                Settings
                            </a>
                            ${showPinOption}
                            <button id="logout-button" class="auth-menu-button text-red-400 hover:bg-red-900/50 hover:text-red-300">
                                <i class="fa-solid fa-right-from-bracket w-4"></i>
                                Log Out
                            </button>
                             <button id="more-button" class="auth-menu-button">
                                <i id="more-button-icon" class="fa-solid fa-chevron-down w-4"></i>
                                <span id="more-button-text">Show More</span>
                            </button>
                            <div id="more-section" class="auth-menu-more-section">
                                <a href="/documentation.html" class="auth-menu-link">
                                    <i class="fa-solid fa-book w-4"></i>
                                    Documentation
                                </a>
                                <a href="../legal.html" class="auth-menu-link">
                                    <i class="fa-solid fa-gavel w-4"></i>
                                    Terms & Policies
                                </a>
                                <a href="https://buymeacoffee.com/4simpleproblems" class="auth-menu-link" target="_blank">
                                    <i class="fa-solid fa-mug-hot w-4"></i>
                                    Donate
                                </a>
                            </div>
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
         * NEW: Encapsulates all listeners for the auth button, dropdown, and actions.
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
                    
                    // Check marquees when menu becomes visible
                    if (menu.classList.contains('open')) {
                        checkMarquees();
                    }
                });
            }

            // More Button Toggle
            const moreButton = document.getElementById('more-button');
            const moreSection = document.getElementById('more-section');
            const moreButtonIcon = document.getElementById('more-button-icon');
            const moreButtonText = document.getElementById('more-button-text');

            if (moreButton && moreSection) {
                moreButton.addEventListener('click', () => {
                    const isExpanded = moreSection.style.display === 'block';
                    moreSection.style.display = isExpanded ? 'none' : 'block';
                    moreButtonText.textContent = isExpanded ? 'Show More' : 'Show Less';
                    moreButtonIcon.classList.toggle('fa-chevron-down', isExpanded);
                    moreButtonIcon.classList.toggle('fa-chevron-up', !isExpanded);
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
         * NEW: Replaces the auth/pin area HTML and re-attaches its event listeners.
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
         * NEW: Checks for text overflow in marquee containers and activates animation.
         */
        const checkMarquees = () => {
            // Use a small timeout to ensure DOM is rendered/visible
            requestAnimationFrame(() => {
                const containers = document.querySelectorAll('.marquee-container');
                
                containers.forEach(container => {
                    const content = container.querySelector('.marquee-content');
                    if (!content) return;

                    // Check if overflow exists
                    // Note: container must be visible to measure scrollWidth properly.
                    // If parent is hidden (display: none), widths are 0.
                    // The auth menu uses 'opacity: 0' and 'pointer-events: none', but NOT display: none.
                    // So measurement *should* work.
                    
                    // Reset to measure true width
                    container.classList.remove('active');
                    // Remove duplicate if exists
                    if (content.nextElementSibling && content.nextElementSibling.classList.contains('marquee-content')) {
                        content.nextElementSibling.remove();
                    }

                    if (content.offsetWidth > container.offsetWidth) {
                        container.classList.add('active');
                        // Duplicate content for seamless loop
                        const duplicate = content.cloneNode(true);
                        duplicate.setAttribute('aria-hidden', 'true'); // Accessibilty
                        // Add padding to original to create gap
                        content.style.paddingRight = '2rem'; 
                        duplicate.style.paddingRight = '2rem';
                        container.appendChild(duplicate);
                    } else {
                        // Clean up
                        content.style.paddingRight = '';
                    }
                });
            });
        };

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

        // --- 4. RENDER THE NAVBAR HTML ---
        const renderNavbar = (user, userData, pages, isPrivilegedUser) => {
            const container = document.getElementById('navbar-container');
            if (!container) return; 

            // Get references to the existing elements from the placeholder
            const navElement = container.querySelector('nav');
            const tabWrapper = navElement.querySelector('.tab-wrapper');
            const authControlsWrapper = document.getElementById('auth-controls-wrapper');
            const navbarLogo = document.getElementById('navbar-logo');

            // Set the logo src (it might already be there from placeholder, but good to ensure correct final src)
            const logoPath = DEFAULT_THEME['logo-src']; 
            if (navbarLogo) {
                navbarLogo.src = logoPath;
            }
            
            // Filter and map pages for tabs, applying adminOnly filter
            const tabsHtml = Object.values(pages || {})
                .filter(page => !(page.adminOnly && !isPrivilegedUser)) // Filter out adminOnly tabs for non-privileged users
                .map(page => {
                    const isActive = isTabActive(page.url);
                    const activeClass = isActive ? 'active' : '';
                    const iconClasses = getIconClass(page.icon);
                    
                    return `<a href="${page.url}" class="nav-tab ${activeClass}"><i class="${iconClasses} mr-2"></i>${page.name}</a>`;
                }).join('');

            // --- NEW: Auth controls HTML is generated by a helper ---
            const authControlsHtml = getAuthControlsHtml();

            // Populate the tab-wrapper
            if (tabWrapper) {
                // Clear existing placeholder content and inject actual tabs and glide buttons
                tabWrapper.innerHTML = `
                    <button id="glide-left" class="scroll-glide-button"><i class="fa-solid fa-chevron-left"></i></button>
                    <div class="tab-scroll-container">
                        ${tabsHtml}
                    </div>
                    <button id="glide-right" class="scroll-glide-button"><i class="fa-solid fa-chevron-right"></i></button>
                `;
            }

            // Populate the auth-controls-wrapper
            if (authControlsWrapper) {
                authControlsWrapper.innerHTML = authControlsHtml;
            }
            
            // --- NEW: Handle tab centering and overflow based on tab count ---
            const tabContainer = tabWrapper.querySelector('.tab-scroll-container'); // Need to re-query as it was just updated
            const tabCount = tabContainer ? tabContainer.querySelectorAll('.nav-tab').length : 0;

            // =================================================================
            // ========= MODIFICATION (1/2) - Center Tab Container ========
            // =================================================================
            if (tabCount <= 9) {
                // If 9 or fewer tabs, center them and disable scrolling
                if(tabContainer) {
                    tabContainer.style.justifyContent = 'center';
                    tabContainer.style.overflowX = 'hidden';
                    // NEW: Remove flex-grow to allow the container itself to be centered
                    // by its parent's (tab-wrapper) justify-content: center.
                    tabContainer.style.flexGrow = '0';
                }
            } else {
                // If more than 9 tabs, align left and enable scrolling
                if(tabContainer) {
                    tabContainer.style.justifyContent = 'flex-start';
                    tabContainer.style.overflowX = 'auto';
                    // NEW: Restore flex-grow to allow the container to fill
                    // the space and enable scrolling.
                    tabContainer.style.flexGrow = '1';
                }
            }
            // =================================================================
            // ====================== END MODIFICATION =========================
            // =================================================================
            // --- END NEW ---

            // --- 5. SETUP EVENT LISTENERS (Called after full render) ---
            setupEventListeners(user);

            // --- Apply theme again after render ---
            // This ensures the logo src is correct if it was just rendered.
            let savedTheme;
            try {
                savedTheme = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY));
            } catch (e) { savedTheme = null; }
            window.applyTheme(savedTheme || DEFAULT_THEME); 
            // --- End theme apply ---

            // const tabContainer = document.querySelector('.tab-scroll-container'); // Already defined above
            
            // Check if we need to restore scroll position (from a full re-render)
            if (currentScrollLeft > 0) {
                const savedScroll = currentScrollLeft;
                // Use requestAnimationFrame to ensure the DOM has painted the new content
                // before setting the scroll, preventing the jump.
                requestAnimationFrame(() => {
                    if (tabContainer) {
                        tabContainer.scrollLeft = savedScroll;
                    }
                    currentScrollLeft = 0; // Reset state after restoration
                    // Nested frame to update arrows *after* scroll is applied
                    requestAnimationFrame(() => {
                        updateScrollGilders();
                    });
                });
            // NEW: Only run centering logic if we are NOT restoring scroll AND we haven't scrolled yet.
            } else if (!hasScrolledToActiveTab) { 
                // If it's the first load, center the active tab.
                const activeTab = document.querySelector('.nav-tab.active');
                if (activeTab && tabContainer) {
                    
                    const centerOffset = (tabContainer.offsetWidth - activeTab.offsetWidth) / 2;
                    const idealCenterScroll = activeTab.offsetLeft - centerOffset;
                    
                    const maxScroll = tabContainer.scrollWidth - tabContainer.offsetWidth;
                    const extraRoomOnRight = maxScroll - idealCenterScroll;
                    
                    let scrollTarget;

                    // =================================================================
                    // ========= MODIFICATION 1 of 3 (Aggressive Set) ========
                    // =================================================================
                    if (idealCenterScroll > 0 && extraRoomOnRight < centerOffset) {
                        // Snap all the way to the right by setting a value
                        // *larger* than the max, forcing the browser to clamp.
                        scrollTarget = maxScroll + 50;
                    } else {
                        scrollTarget = Math.max(0, idealCenterScroll);
                    }
                    // =================================================================
                    // ====================== END MODIFICATION =========================
                    // =================================================================

                    // Set scroll and update gilders in the next frame to ensure
                    // the scrollLeft value is processed by the browser first.
                    requestAnimationFrame(() => {
                        tabContainer.scrollLeft = scrollTarget;
                        // Nested frame to update arrows *after* scroll is applied
                        requestAnimationFrame(() => {
                            updateScrollGilders();
                        });
                    });
                    
                    // IMPORTANT: Set flag to prevent future automatic centering
                    hasScrolledToActiveTab = true; 
                } else if (tabContainer) {
                    // If no active tab (or no tabContainer), still need to update gilders
                    // to ensure they are hidden correctly on a blank page.
                    requestAnimationFrame(() => {
                        updateScrollGilders();
                    });
                }
            }
            
            // --- NEW: Init Marquees ---
            checkMarquees();
        };


        // =================================================================
        // ========= MODIFICATION 2 of 3 (Tolerant Check) ========
        // =================================================================
        const updateScrollGilders = () => {
            const container = document.querySelector('.tab-scroll-container');
            const leftButton = document.getElementById('glide-left');
            const rightButton = document.getElementById('glide-right');

            // --- NEW: Check tab count. If 9 or less, hide gliders and exit. ---
            const tabCount = document.querySelectorAll('.nav-tab').length;
            // =================================================================
            // ========= MODIFICATION (2/2) - Check Tab Container ========
            // =================================================================
            // Check if the container is *not* in scroll mode (flex-grow is 0)
            const isNotScrolling = container && container.style.flexGrow === '0';
            
            if (tabCount <= 9 || isNotScrolling) {
            // =================================================================
            // ====================== END MODIFICATION =========================
            // =================================================================
                if (leftButton) leftButton.classList.add('hidden');
                if (rightButton) rightButton.classList.add('hidden');
                return; // Do not run the rest of the scroll logic
            }
            // --- END NEW ---

            if (!container || !leftButton || !rightButton) return;
            
            const hasHorizontalOverflow = container.scrollWidth > container.offsetWidth + 2; // Add 2px tolerance

            if (hasHorizontalOverflow) {
                // Use a small tolerance
                const isScrolledToLeft = container.scrollLeft <= 5;
                
                // Calculate max scroll and check against it with tolerance
                const maxScrollLeft = container.scrollWidth - container.offsetWidth;

                // NEW TOLERANCE LOGIC:
                // Check if the current scroll position, *plus a 5px tolerance*,
                // is greater than or equal to the max scroll. This handles
                // browser sub-pixel rounding errors.
                const isScrolledToRight = (container.scrollLeft + 5) >= maxScrollLeft;

                // Explicitly add or remove the class
                if (isScrolledToLeft) {
                    leftButton.classList.add('hidden');
                } else {
                    leftButton.classList.remove('hidden');
                }

                if (isScrolledToRight) {
                    rightButton.classList.add('hidden');
                } else {
                    rightButton.classList.remove('hidden');
                }
            } else {
                // If there is no overflow, hide both buttons
                leftButton.classList.add('hidden');
                rightButton.classList.add('hidden');
            }
        };
        // =================================================================
        // ====================== END MODIFICATION =========================
        // =================================================================


        // =================================================================
        // ========= MODIFICATION 3 of 3 (Aggressive Set) ========
        // =================================================================
        /**
         * NEW: Forcefully scrolls the tab container all the way to the right
         * and ensures the right arrow is hidden.
         */
        const forceScrollToRight = () => {
            const tabContainer = document.querySelector('.tab-scroll-container');
            if (!tabContainer) return;

            // Calculate the maximum possible scroll position
            const maxScroll = tabContainer.scrollWidth - tabContainer.offsetWidth;

            // Use requestAnimationFrame to guarantee the scroll happens,
            // and *then* the arrow visibility is updated.
            requestAnimationFrame(() => {
                // Set scrollLeft to a value *larger* than the max.
                // The browser will automatically clamp this to the
                // highest possible value, which is more reliable.
                tabContainer.scrollLeft = maxScroll + 50;
                
                // Use a nested frame to update arrows *after* scroll is applied
                requestAnimationFrame(() => {
                    updateScrollGilders();
                });
            });
        };
        // =================================================================
        // ====================== END MODIFICATION =========================
        // =================================================================
        
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

            // --- NEW: Auth Toggle Listeners (Called on full render) ---
            setupAuthToggleListeners(user);

            // --- NEW: Pin Button Event Listeners (Called on full render) ---
            setupPinEventListeners();

            // Global click listener to close *both* menus
            if (!globalClickListenerAdded) {
                document.addEventListener('click', (e) => {
                    const menu = document.getElementById('auth-menu-container');
                    const toggleButton = document.getElementById('auth-toggle');
                    
                    if (menu && menu.classList.contains('open')) {
                        if (!menu.contains(e.target) && (toggleButton && !toggleButton.contains(e.target))) {
                            menu.classList.add('closed');
                            menu.classList.remove('open');
                        }
                    }
                    
                    const pinButton = document.getElementById('pin-button');
                    const pinContextMenu = document.getElementById('pin-context-menu');

                    if (pinContextMenu && pinContextMenu.classList.contains('open')) {
                        if (!pinContextMenu.contains(e.target) && (pinButton && !pinButton.contains(e.target))) {
                            pinContextMenu.classList.add('closed');
                            pinContextMenu.classList.remove('open');
                        }
                    }
                });
                
                // --- NEW: PFP Update Listener ---
                window.addEventListener('pfp-updated', (e) => {
                    if (!currentUserData) currentUserData = {};
                    
                    // Update local state
                    Object.assign(currentUserData, e.detail);
                    
                    // Generate new content
                    const username = currentUserData.username || currentUser?.displayName || 'User';
                    const initial = (currentUserData.pfpLetters) ? currentUserData.pfpLetters : username.charAt(0).toUpperCase();
                    let newContent = '';
                    
                    if (currentUserData.pfpType === 'custom' && currentUserData.customPfp) {
                        newContent = `<img src="${currentUserData.customPfp}" class="w-full h-full object-cover rounded-full" alt="Profile">`;
                    } else if (currentUserData.pfpType === 'letter') {
                        const bg = currentUserData.pfpLetterBg || DEFAULT_THEME['avatar-gradient'];
                        const textColor = getLetterAvatarTextColor(bg);
                        const fontSizeClass = initial.length >= 3 ? 'text-xs' : (initial.length === 2 ? 'text-sm' : 'text-base');
                        newContent = `<div class="initial-avatar w-full h-full rounded-full font-semibold ${fontSizeClass}" style="background: ${bg}; color: ${textColor}">${initial}</div>`;
                    } else {
                        // 'google' or fallback
                        // Try to find specific Google photo first if available in providerData
                        // Note: currentUser is available in this scope
                        const googleProvider = currentUser?.providerData.find(p => p.providerId === 'google.com');
                        const googlePhoto = googleProvider ? googleProvider.photoURL : null;
                        const displayPhoto = googlePhoto || currentUser?.photoURL;

                        if (displayPhoto) {
                            newContent = `<img src="${displayPhoto}" class="w-full h-full object-cover rounded-full" alt="Profile">`;
                        } else {
                            const bg = DEFAULT_THEME['avatar-gradient'];
                            const textColor = getLetterAvatarTextColor(bg);
                            const fontSizeClass = initial.length >= 3 ? 'text-xs' : (initial.length === 2 ? 'text-sm' : 'text-base');
                            newContent = `<div class="initial-avatar w-full h-full rounded-full font-semibold ${fontSizeClass}" style="background: ${bg}; color: ${textColor}">${initial}</div>`;
                        }
                    }

                    // Update Toggle Button
                    const authToggle = document.getElementById('auth-toggle');
                    if (authToggle) {
                        authToggle.style.transition = 'opacity 0.2s ease';
                        authToggle.style.opacity = '0';
                        
                        setTimeout(() => {
                            authToggle.innerHTML = newContent;
                            authToggle.style.opacity = '1';
                        }, 200);
                    }
                    
                    // Update Dropdown Menu Avatar (if open or exists)
                    const menuAvatar = document.getElementById('auth-menu-avatar-container');
                    if (menuAvatar) {
                        // Instant update for menu, no fade needed as it's usually hidden during update
                        menuAvatar.innerHTML = newContent; 
                    }
                });

                globalClickListenerAdded = true;
            }
        };

        // --- 6. AUTH STATE LISTENER ---
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
            // Full re-render on auth change, don't preserve scroll unless explicitly requested.
            renderNavbar(currentUser, currentUserData, allPages, currentIsPrivileged);

            if (!user) {
                // User is signed out.
                // KICK USER TO INDEX: If the user is logged out, redirect them to /index.html
                const targetUrl = '../index.html'; // <--- UPDATED TO ABSOLUTE PATH
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
        // (MOVED to start of initializeApp)
    };

    // --- START THE PROCESS ---
    document.addEventListener('DOMContentLoaded', run);

})();
