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
 * 22. **(NEW)** LOGO TINTING: Replaced logo `<img>` tag with a `<div>` using `mask-image`. `window.applyTheme` now supports `logo-tint-color` from themes.json to dynamically color the logo, with smart defaults for themes without a tint color.
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
    'name': 'Dark', // --- NEW: Added name to default theme
    'logo-src': '/images/logo.png',
    'logo-tint-color': null, // --- NEW: Added logo-tint-color key
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
// --- UPDATED: This function is now modified to support logo tinting ---
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

    // --- NEW: Handle logo tint color ---
    let logoTintColor = themeToApply['logo-tint-color']; // Get tint from the applied theme

    // If the theme doesn't specify a tint (i.e., it's null or undefined), we must provide a sensible default.
    if (!logoTintColor) {
        // Check if it's one of the known light themes (which use logo-dark.png)
        if (themeToApply.name && lightThemeNames.includes(themeToApply.name)) {
            // These themes use the dark logo, so the default "tint" should be a dark color.
            logoTintColor = '#111827'; // Default dark color
        } else {
            // Otherwise, it's a dark theme (using logo.png), so the default "tint" is white.
            logoTintColor = '#ffffff'; // Default white color
        }
    }
    
    root.style.setProperty('--logo-tint-color', logoTintColor);
    // --- END NEW LOGO TINT LOGIC ---


    // --- UPDATED: Handle logo swap (now a mask on a div) ---
    const logoEl = document.getElementById('navbar-logo');
    if (logoEl) {
        // Get the logo src from the applied theme, or fall back to the default theme's src
        const newLogoSrc = themeToApply['logo-src'] || DEFAULT_THEME['logo-src'];
        const newMaskUrl = `url(${newLogoSrc})`;
        
        // Apply the new logo src as a mask image
        if (logoEl.style.maskImage !== newMaskUrl) {
            logoEl.style.webkitMaskImage = newMaskUrl;
            logoEl.style.maskImage = newMaskUrl;
        }
    }
    // --- END UPDATED LOGO LOGIC ---
};
// --- End Theming Configuration ---


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
            
            /* --- NEW: Logo Div Styling --- */
            #navbar-logo {
                background-color: var(--logo-tint-color); /* Color is set by applyTheme logic */
                -webkit-mask-size: contain;
                mask-size: contain;
                -webkit-mask-position: center;
                mask-position: center;
                -webkit-mask-repeat: no-repeat;
                mask-repeat: no-repeat;
                transition: background-color 0.3s ease; /* Add transition */
            }
            /* --- END NEW LOGO STYLE --- */
            
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
                background: var(--glass-menu-bg); 
                backdrop-filter: blur(10px); 
                -webkit-backdrop-filter: blur(10px); 
                border: 1px solid var(--glass-menu-border);
                transition: background-color 0.3s ease, border-color 0.3s ease;
            }
            /* Helper for icons in menus */
            .auth-menu-link i.w-4, .auth-menu-button i.w-4 { width: 1rem; text-align: center; } 

            /* Tab Wrapper and Glide Buttons */
            .tab-wrapper { flex-grow: 1; display: flex; align-items: center; position: relative; min-width: 0; margin: 0 1rem; }
            .tab-scroll-container { flex-grow: 1; display: flex; align-items: center; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; -ms-overflow-style: none; padding-bottom: 5px; margin-bottom: -5px; scroll-behavior: smooth; }
            .tab-scroll-container::-webkit-scrollbar { display: none; }
            .scroll-glide-button {
                position: absolute; top: 0; height: 100%; width: 4rem; display: flex; align-items: center; justify-content: center; 
                color: var(--glide-icon-color); font-size: 1.2rem; cursor: pointer; 
                opacity: 1; 
                transition: opacity 0.3s, color 0.3s ease; 
                z-index: 10; pointer-events: auto;
            }
            #glide-left { 
                left: 0; background: var(--glide-gradient-left); 
                justify-content: flex-start; padding-left: 0.5rem; 
                transition: opacity 0.3s, color 0.3s ease, background 0.3s ease;
            }
            #glide-right { 
                right: 0; background: var(--glide-gradient-right); 
                justify-content: flex-end; padding-right: 0.5rem; 
                transition: opacity 0.3s, color 0.3s ease, background 0.3s ease;
            }
            .scroll-glide-button.hidden { opacity: 0 !important; pointer-events: none !important; }
            
            .nav-tab { 
                flex-shrink: 0; padding: 0.5rem 1rem; color: var(--tab-text); 
                font-size: 0.875rem; font-weight: 500; border-radius: 0.5rem; 
                transition: all 0.2s, color 0.3s ease, border-color 0.3s ease, background-color 0.3s ease; 
                text-decoration: none; line-height: 1.5; display: flex; align-items: center; margin-right: 0.5rem; 
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
                border-radius: 0.75rem;
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
        `;
        document.head.appendChild(style);
    };


    // --- 2. INITIALIZE FIREBASE AND RENDER NAVBAR ---
    const initializeApp = (pages) => {
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
         * NEW: Generates the HTML for the entire right-side auth/pin controls area.
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
                                <p class="text-sm font-semibold auth-menu-username truncate">${username}</p>
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

            // --- UPDATED: logoPath variable is no longer needed as logo is a styled div
            // const logoPath = "/images/logo.png"; 
            
            // Filter and map pages for tabs, applying adminOnly filter
            const tabsHtml = Object.values(pages || {})
                .filter(page => !(page.adminOnly && !isPrivilegedUser)) // Filter out adminOnly tabs for non-privileged users
                .map(page => {
                    const isActive = isTabActive(page.url);
                    const activeClass = isActive ? 'active' : '';
                    const iconClasses = getIconClass(page.icon);
                    
                    // Admin class removed
                    return `<a href="${page.url}" class="nav-tab ${activeClass}"><i class="${iconClasses} mr-2"></i>${page.name}</a>`;
                }).join('');

            
            // --- NEW: Auth controls HTML is generated by a helper ---
            // This now uses the global state, as renderNavbar is only called
            // after the global state is updated.
            const authControlsHtml = getAuthControlsHtml();

            // --- Assemble Final Navbar HTML ---
            container.innerHTML = `
                <header class="auth-navbar">
                    <nav>
                        <a href="/" class="flex items-center space-x-2" title="4SP Logo">
                            <div id="navbar-logo" class="h-8 w-auto"></div> 
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

            // --- Apply theme again after render ---
            // This ensures the logo src is correct if it was just rendered.
            let savedTheme;
            try {
                savedTheme = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY));
            } catch (e) { savedTheme = null; }
            window.applyTheme(savedTheme || DEFAULT_THEME); 
            // --- End theme apply ---

            const tabContainer = document.querySelector('.tab-scroll-container');
            
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
                    // Removed old logic: const extraRoomOnRight = maxScroll - idealCenterScroll; 
                    
                    let scrollTarget;

                    // =================================================================
                    // ========= FIX: Scroll all the way to the end for last tabs ========
                    // =================================================================
                    // FIX: If centering the tab would position it near the end (within 100px of max scroll), 
                    // snap all the way to the right to prevent the last tab from being obscured 
                    // by the glide button's fading texture.
                    if (idealCenterScroll >= (maxScroll - 100)) {
                        scrollTarget = maxScroll; 
                    } else {
                        scrollTarget = Math.max(0, idealCenterScroll);
                    }
                    // =================================================================
                    // ====================== END FIX =========================
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
        };


        // =================================================================
        // ========= FIX: Ensure right glide arrow hides at end ========
        // =================================================================
        const updateScrollGilders = () => {
            const container = document.querySelector('.tab-scroll-container');
            const leftButton = document.getElementById('glide-left');
            const rightButton = document.getElementById('glide-right');

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
        // ====================== END FIX =========================
        // =================================================================


        // =================================================================
        // ========= HELPER: Force scroll to absolute end ========
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
        // ====================== END HELPER =========================
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
            // This function now contains the auth toggle, logout, and "show pin" listeners
            setupAuthToggleListeners(user);

            // --- NEW: Pin Button Event Listeners (Called on full render) ---
            setupPinEventListeners();

            // Global click listener to close *both* menus
            // NEW: Only add this listener ONCE
            if (!globalClickListenerAdded) {
                document.addEventListener('click', (e) => {
                    // --- FIX START: Bug 1 ---
                    // Fetched elements *inside* the listener to avoid stale references
                    // after a re-render. Used .contains() to handle clicks on child icons.
                    const menu = document.getElementById('auth-menu-container');
                    const toggleButton = document.getElementById('auth-toggle');
                    
                    if (menu && menu.classList.contains('open')) {
                        // Check if the click was outside the menu AND outside the toggle button
                        if (!menu.contains(e.target) && (toggleButton && !toggleButton.contains(e.target))) {
                            menu.classList.add('closed');
                            menu.classList.remove('open');
                        }
                    }
                    
                    const pinButton = document.getElementById('pin-button');
                    const pinContextMenu = document.getElementById('pin-context-menu');

                    if (pinContextMenu && pinContextMenu.classList.contains('open')) {
                         // Check if the click was outside the pin menu AND outside the pin button
                        if (!pinContextMenu.contains(e.target) && (pinButton && !pinButton.contains(e.target))) {
                            pinContextMenu.classList.add('closed');
                            pinContextMenu.classList.remove('open');
                        }
                    }
                    // --- FIX END: Bug 1 ---
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
        // (MOVED to start of initializeApp)
    };

    // --- START THE PROCESS ---
    document.addEventListener('DOMContentLoaded', run);

})();
