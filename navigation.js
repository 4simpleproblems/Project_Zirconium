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
 * 27. **(NEW)** !important ADDED: Every CSS declaration in `injectStyles` now has `!important`.
 * 28. **(NEW)** GLIDE REMOVED: Scroll glide buttons are removed from HTML and all related JS logic has been removed/disabled.
 * 29. **(NEW)** FORCED LAYOUT: Tabs are forced to left-align, take up all available space, and scroll if they overflow.
 * * --- USER MODIFICATIONS APPLIED ---
 * 30. **(MODIFIED)** TAB CENTERING: The tabs within the scroll container are now **forced to be centered** using `justify-content: center !important`.
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

    // --- 3. INJECT CSS STYLES (MODIFIED: ADDED !IMPORTANT TO ALL DECLARATIONS, FORCED CENTERING) ---
    // This now uses CSS variables for all colors and transitions.
    // *** UPDATED to use px for fixed layout sizing and ADDED !IMPORTANT ***
    const injectStyles = () => {
        const style = document.createElement('style');
        style.textContent = `
            /* Base Styles */
            body { padding-top: 64px !important; } /* UPDATED */
                        .auth-navbar {
                            position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; z-index: 1000 !important;
                            background: var(--navbar-bg) !important;
                            border-bottom: 1px solid var(--navbar-border) !important;
                            height: 64px !important; /* UPDATED */
                            transition: background-color 0.3s ease, border-color 0.3s ease !important;
                        }
                        .auth-navbar nav { padding: 0 1rem !important; height: 100% !important; display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 1rem !important; position: relative !important; } /* UPDATED */
                        .initial-avatar {
                            background: var(--avatar-gradient) !important;
                            font-family: sans-serif !important; text-transform: uppercase !important; display: flex !important; align-items: center !important; justify-content: center !important; color: white !important;
                        }
                        #auth-toggle {
                            border-color: var(--avatar-border) !important;
                            transition: border-color 0.3s ease !important;
                        }
            
                        /* Auth Dropdown Menu Styles */
                        .auth-menu-container {
                            position: absolute !important; right: 0 !important; top: 50px !important; width: 16rem !important; /* UPDATED top from 50px */
                            background: var(--menu-bg) !important;
                            border: 1px solid var(--menu-border) !important;
                            border-radius: 0.9rem !important; padding: 0.75rem !important; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -2px rgba(0,0,0,0.2) !important;
                            transition: transform 0.2s ease-out, opacity 0.2s ease-out, background-color 0.3s ease, border-color 0.3s ease !important;
                            transform-origin: top right !important; z-index: 1010 !important;
                        }                        .auth-menu-container .border-b { /* User info divider */
                            border-color: var(--menu-divider) !important !important;
                            transition: border-color 0.3s ease !important;
                        }
                        /* --- USERNAME COLOR FIX --- (3/3) Added new style rule */
                                    .auth-menu-username {
                                        color: var(--menu-username-text) !important;
                                        transition: color 0.3s ease !important;
                                        text-align: left !important !important; /* Force left alignment */
                                        margin: 0 !important !important;
                                        font-weight: 400 !important !important;
                                    }
                                    /* NEW: Force email left alignment */
                                    .auth-menu-email {
                                        text-align: left !important !important;
                                        margin: 0 !important !important;
                                        font-weight: 400 !important !important;
                                    }            .auth-menu-container.open { opacity: 1 !important; transform: translateY(0) scale(1) !important; }
            .auth-menu-container.closed { opacity: 0 !important; pointer-events: none !important; transform: translateY(-10px) scale(0.95) !important; }

            /* NEW: Styles for the expandable "More" section */
            .auth-menu-more-section {
                display: none !important; /* Hidden by default */
                padding-top: 0.5rem !important;
                margin-top: 0.5rem !important;
                border-top: 1px solid var(--menu-divider) !important;
            }

            /* UPDATED: Dropdown button styling to match notes.html */
            .auth-menu-link, .auth-menu-button { 
                display: flex !important; align-items: center !important; 
                gap: 10px !important; /* Replaces margin on icons */
                width: 100% !important; text-align: left !important; 
                padding: 0.5rem 0.75rem !important; font-size: 0.875rem !important; color: var(--menu-text) !important; border-radius: 0.7rem !important; 
                transition: background-color 0.15s, color 0.15s !important; border: none !important; cursor: pointer !important;
            }
            .auth-menu-link:hover, .auth-menu-button:hover { 
                background-color: var(--menu-item-hover-bg) !important; 
                color: var(--menu-item-hover-text) !important; 
            }

            .logged-out-auth-toggle { 
                background: var(--logged-out-icon-bg) !important; 
                border: 1px solid var(--logged-out-icon-border) !important; 
                transition: background-color 0.3s ease, border-color 0.3s ease !important;
            }
            .logged-out-auth-toggle i { 
                color: var(--logged-out-icon-color) !important; 
                transition: color 0.3s ease !important;
            }

            /* NEW: Glass Menu Style for Pin Context Menu */
            .glass-menu { 
                background: var(--glass-menu-bg) !important; 
                backdrop-filter: blur(10px) !important; 
                -webkit-backdrop-filter: blur(10px) !important; 
                border: 1px solid var(--glass-menu-border) !important;
                transition: background-color 0.3s ease, border-color 0.3s ease !important;
            }
            /* Helper for icons in menus */
            .auth-menu-link i.w-4, .auth-menu-button i.w-4 { width: 1rem !important; text-align: center !important; } 

            /* Tab Wrapper and Glide Buttons */
            /* UPDATED: Removed justify-content: center */
            .tab-wrapper { flex-grow: 1 !important; display: flex !important; align-items: center !important; position: relative !important; min-width: 0 !important; margin: 0 1rem !important; } 
            .tab-scroll-container { 
                flex-grow: 1 !important; display: flex !important; align-items: center !important; 
                overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; 
                scrollbar-width: none !important; -ms-overflow-style: none !important; 
                padding-bottom: 5px !important; margin-bottom: -5px !important; 
                scroll-behavior: smooth !important;
                max-width: 100% !important; /* UPDATED: ensure it doesn't overflow parent */
                padding-left: 16px !important; /* MODIFICATION: Added to prevent first tab cutoff */
                padding-right: 16px !important; /* MODIFICATION: Added for symmetry */
                justify-content: center !important; /* FORCED CENTER-ALIGN */
            }
            .tab-scroll-container::-webkit-scrollbar { display: none !important; }
            /* Glide Button Styles Removed/Commented Out */
            /*
            .scroll-glide-button {
                position: absolute !important; top: 0 !important; height: 100% !important; width: 64px !important; display: flex !important; align-items: center !important; justify-content: center !important; 
                color: var(--glide-icon-color) !important; font-size: 1.2rem !important; cursor: pointer !important; 
                opacity: 1 !important; 
                transition: opacity 0.3s, color 0.3s ease !important; 
                z-index: 10 !important; pointer-events: auto !important;
            }
            #glide-left { 
                left: 0 !important; background: var(--glide-gradient-left) !important; 
                justify-content: flex-start !important; padding-left: 8px !important; 
                transition: opacity 0.3s, color 0.3s ease, background 0.3s ease !important;
            }
            #glide-right { 
                right: 0 !important; background: var(--glide-gradient-right) !important; 
                justify-content: flex-end !important; padding-right: 8px !important; 
                transition: opacity 0.3s, color 0.3s ease, background 0.3s ease !important;
            }
            .scroll-glide-button.hidden { opacity: 0 !important !important; pointer-events: none !important !important; }
            */
            
            .nav-tab { 
                flex-shrink: 0 !important; padding: 8px 12px !important; color: var(--tab-text) !important; /* UPDATED */
                font-size: 0.875rem !important; font-weight: 500 !important; border-radius: 0.7rem !important; 
                transition: all 0.2s, color 0.3s ease, border-color 0.3s ease, background-color 0.3s ease !important; 
                text-decoration: none !important; line-height: 1.5 !important; display: flex !important; align-items: center !important; margin-right: 8px !important; /* UPDATED */
                border: 1px solid transparent !important; 
            }
            .nav-tab:not(.active):hover { 
                color: var(--tab-hover-text) !important; 
                border-color: var(--tab-hover-border) !important; 
                background-color: var(--tab-hover-bg) !important; 
            }
            .nav-tab.active { 
                color: var(--tab-active-text) !important; 
                border-color: var(--tab-active-border) !important; 
                background-color: var(--tab-active-bg) !important; 
            }
            .nav-tab.active:hover { 
                color: var(--tab-active-hover-text) !important; 
                border-color: var(--tab-active-hover-border) !important; 
                background-color: var(--tab-active-hover-bg) !important; 
            }
            
            /* Pin Button */
            #pin-button {
                border-color: var(--pin-btn-border) !important;
                transition: background-color 0.2s, border-color 0.3s ease !important;
            }
            #pin-button:hover {
                background-color: var(--pin-btn-hover-bg) !important;
            }
            #pin-button-icon {
                color: var(--pin-btn-icon-color) !important;
                transition: color 0.3s ease !important;
            }

            /* NEW: Pin Hint Styles */
            .pin-hint-container {
                position: absolute !important;
                bottom: calc(100% + 10px) !important; /* 10px above the button */
                left: 50% !important;
                transform: translateX(-50%) scale(0.8) !important;
                background: var(--hint-bg) !important;
                border: 1px solid var(--hint-border) !important;
                color: var(--hint-text) !important;
                padding: 0.5rem 1rem !important;
                border-radius: 0.9rem !important;
                box-shadow: 0 4px 10px rgba(0,0,0,0.5) !important;
                opacity: 0 !important;
                pointer-events: none !important;
                z-index: 1020 !important;
                transition: opacity 0.3s ease, transform 0.3s ease, background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease !important;
                white-space: nowrap !important;
                font-size: 0.875rem !important;
            }
            .pin-hint-container.show {
                opacity: 1 !important;
                transform: translateX(-50%) scale(1) !important;
                transition-delay: 0.2s !important; /* Slight delay on show */
            }

            /* --- Marquee Styles --- */
            .marquee-container {
                overflow: hidden !important;
                white-space: nowrap !important;
                position: relative !important;
                max-width: 100% !important;
            }
            
            /* Only apply mask and animation when active */
            .marquee-container.active {
                mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%) !important;
                -webkit-mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%) !important;
            }
            
            .marquee-content {
                display: inline-block !important;
                white-space: nowrap !important;
            }
            
            .marquee-container.active .marquee-content {
                animation: marquee 10s linear infinite !important;
                /* Make sure there is enough width for the scroll */
                min-width: 100% !important; 
            }
            
            @keyframes marquee {
                0% { transform: translateX(0) !important; }
                100% { transform: translateX(-50%) !important; } /* Move half way (since content is duplicated) */
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
                const initial = (userData?.letterAvatarText || username.charAt(0)).toUpperCase();
                
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
                // Clear existing placeholder content and inject actual tabs. 
                // GLIDE BUTTONS REMOVED as per user request.
                tabWrapper.innerHTML = `
                    <div class="tab-scroll-container">
                        ${tabsHtml}
                    </div>
                `;
            }

            // Populate the auth-controls-wrapper
            if (authControlsWrapper) {
                authControlsWrapper.innerHTML = authControlsHtml;
            }
            
            // --- MODIFIED: Force tab-scroll-container to take up space and align CENTER ---
            const tabContainer = tabWrapper.querySelector('.tab-scroll-container'); 
            
            if(tabContainer) {
                // Force tabs to be space-filling, center-aligned, and scrollable if they overflow.
                tabContainer.style.justifyContent = 'center'; // Force center align tabs
                tabContainer.style.overflowX = 'auto'; // Allow scrolling if needed
                tabContainer.style.flexGrow = '1'; // Force it to take up available space
            }
            
            // --- END MODIFIED ---

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

            // --- Scroll Logic Modified to remove glide button checks and centering ---
            // The scroll position is restored if a re-render occurred, but no centering is performed.
            if (currentScrollLeft > 0) {
                const savedScroll = currentScrollLeft;
                requestAnimationFrame(() => {
                    if (tabContainer) {
                        tabContainer.scrollLeft = savedScroll;
                    }
                    currentScrollLeft = 0; // Reset state after restoration
                });
            }
            
            // --- NEW: Init Marquees ---
            checkMarquees();
        };


        // --- MODIFIED: Removed updateScrollGilders and forceScrollToRight functions ---
        
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
            // --- MODIFIED: Removed Scroll Glide Button setup and listeners ---
            /*
            const tabContainer = document.querySelector('.tab-scroll-container');
            const leftButton = document.getElementById('glide-left');
            const rightButton = document.getElementById('glide-right');

            const debouncedUpdateGilders = debounce(updateScrollGilders, 50);

            if (tabContainer) {
                const scrollAmount = tabContainer.offsetWidth * 0.8; 
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
            */

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
                    const initial = (currentUserData.letterAvatarText) ? currentUserData.letterAvatarText : username.charAt(0).toUpperCase();
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
