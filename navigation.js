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
    
    // =========================================================================
    // >> START: SCROLLING LOGIC FROM TEST-NAVIGATION.JS <<
    // =========================================================================
    
    /**
     * Updates the visibility of the left and right scroll glide buttons 
     * based on the scroll position of the tab container.
     * Logic copied from test-navigation.js.
     * @param {HTMLElement} scrollContainer - The .tab-scroll-container element.
     */
    const updateGlideButtonVisibility = (scrollContainer) => {
        const leftGlide = document.getElementById('glide-left');
        const rightGlide = document.getElementById('glide-right');
        
        if (!scrollContainer || !leftGlide || !rightGlide) return;

        // Check scroll position
        const isAtLeft = scrollContainer.scrollLeft <= 0;
        // The scroll width check needs a slight tolerance for fractional rendering differences (from test-navigation.js)
        const isAtRight = (scrollContainer.scrollWidth - scrollContainer.clientWidth - scrollContainer.scrollLeft) < 1;

        // Update visibility instantly
        leftGlide.classList.toggle('hidden', isAtLeft);
        rightGlide.classList.toggle('hidden', isAtRight);
    };

    /**
     * Handles the click event for the scroll glide buttons by scrolling the container.
     * Logic copied from test-navigation.js.
     * @param {('left'|'right')} direction - The direction to scroll.
     */
    const handleGlideClick = (direction) => {
        const scrollContainer = document.querySelector('.tab-scroll-container');
        if (!scrollContainer) return;

        // Determine scroll distance: 80% of the visible container width (from test-navigation.js)
        const scrollDistance = scrollContainer.clientWidth * 0.8;
        
        // Calculate new scroll position
        const newScrollLeft = direction === 'left' 
            ? scrollContainer.scrollLeft - scrollDistance
            : scrollContainer.scrollLeft + scrollDistance;

        // Perform the scroll (smooth behavior is set in CSS)
        scrollContainer.scroll(newScrollLeft, 0);
    };

    // =========================================================================
    // >> END: SCROLLING LOGIC FROM TEST-NAVIGATION.JS <<
    // =========================================================================

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
        
        // State for current scroll position (Kept for persistence feature)
        let currentScrollLeft = 0; 

        // Flag to ensure active tab centering only happens once per page load
        let hasScrolledToActiveTab = false; 
        
        // NEW: Flag to ensure global click listener is only added once
        let globalClickListenerAdded = false; 

        // --- LocalStorage Keys ---
        const PINNED_PAGE_KEY = 'navbar_pinnedPage';
        const HINT_SHOWN_KEY = 'navbar_pinHintShown';

        // Helper to get the currently pinned page object
        const getPinnedPage = () => {
            try {
                const pinnedId = localStorage.getItem(PINNED_PAGE_KEY);
                return pinnedId ? allPages[pinnedId] : null;
            } catch (e) {
                console.error("Could not retrieve pinned page.", e);
                return null;
            }
        };

        // Helper to save the pinned page
        const setPinnedPage = (pageId) => {
             try {
                if (pageId === null) {
                    localStorage.removeItem(PINNED_PAGE_KEY);
                } else {
                    localStorage.setItem(PINNED_PAGE_KEY, pageId);
                }
            } catch (e) {
                console.error("Could not set pinned page.", e);
            }
        };

        // Helper to check if the pin hint has been shown
        const getHintShown = () => {
            try {
                return localStorage.getItem(HINT_SHOWN_KEY) === 'true';
            } catch (e) {
                return false;
            }
        };

        // Helper to mark the pin hint as shown
        const setHintShown = () => {
             try {
                localStorage.setItem(HINT_SHOWN_KEY, 'true');
            } catch (e) {
                console.error("Could not set pin hint shown flag.", e);
            }
        };
        
        // Helper to hide the pin hint on subsequent clicks
        const hidePinHint = (delay = 0) => {
            const hint = document.getElementById('pin-hint');
            if (hint) {
                setTimeout(() => {
                    hint.classList.remove('show');
                }, delay);
            }
        };


        /**
         * Renders the entire navigation bar HTML based on the current state.
         * @param {firebase.User|null} user 
         * @param {object|null} userData 
         * @param {object} pages 
         * @param {boolean} isPrivileged 
         * @param {boolean} preserveScroll - NEW: Flag to skip centering the active tab.
         */
        const renderNavbar = (user, userData, pages, isPrivileged, preserveScroll = false) => {
            const container = document.getElementById('navbar-container');
            if (!container) return;

            // --- 1. BUILD TABS ---
            const tabHTML = Object.entries(pages)
                .filter(([, page]) => !page.adminOnly || isPrivileged)
                .map(([id, page]) => {
                    const isActive = isTabActive(page.url);
                    const tabClasses = `nav-tab ${isActive ? 'active' : ''}`;
                    const icon = getIconClass(page.icon);
                    return `
                        <a href="${page.url}" id="tab-${id}" class="${tabClasses}">
                            <i class="${icon} mr-2"></i>
                            ${page.name}
                        </a>
                    `;
                })
                .join('');
            
            // --- 2. BUILD PIN BUTTON/MENU ---
            const currentPageId = Object.keys(pages).find(id => isTabActive(pages[id].url));
            const pinnedPage = getPinnedPage();
            const isCurrentPagePinned = pinnedPage && isTabActive(pinnedPage.url);
            
            const pinMenuHTML = `
                <div id="pin-menu-container" class="auth-menu-container closed glass-menu">
                    ${pinnedPage ? `
                        <p class="px-3 py-2 text-sm text-white font-medium">Pinned Page</p>
                        <a href="${pinnedPage.url}" class="auth-menu-link">
                            <i class="${getIconClass(pinnedPage.icon)} w-4"></i>
                            <span>${pinnedPage.name}</span>
                        </a>
                        ${isCurrentPagePinned ? '' : `
                            <button id="repin-current-btn" class="auth-menu-button">
                                <i class="fa-solid fa-thumbtack w-4"></i>
                                <span>Repin Current Page</span>
                            </button>
                        `}
                        <div class="h-px my-1 mx-2 bg-gray-700 bg-[var(--menu-divider)]"></div>
                        <button id="unpin-btn" class="auth-menu-button text-red-400 hover:text-red-300 hover:!bg-red-900/40">
                            <i class="fa-solid fa-xmark w-4"></i>
                            <span>Unpin Page</span>
                        </button>
                    ` : `
                        <p class="px-3 py-2 text-sm text-gray-400">No page pinned.</p>
                        ${currentPageId ? `
                            <button id="repin-current-btn" class="auth-menu-button">
                                <i class="fa-solid fa-thumbtack w-4"></i>
                                <span>Pin Current Page</span>
                            </button>
                        ` : ''}
                    `}
                </div>
            `;
            
            const pinButtonHTML = user && !user.isAnonymous && currentPageId ? `
                <div id="pin-control-wrapper" class="relative">
                    <button id="pin-button" class="w-10 h-10 flex items-center justify-center rounded-full bg-transparent border-2 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-gray-900">
                        <i id="pin-button-icon" class="fa-solid fa-thumbtack ${pinnedPage ? 'text-indigo-400' : ''} text-lg"></i>
                    </button>
                    <div id="pin-hint" class="pin-hint-container">
                        Click to Pin/Unpin the menu.
                    </div>
                    ${pinMenuHTML}
                </div>
            ` : '';
            

            // --- 3. BUILD AUTH CONTROL ---
            let authControlHTML;
            
            if (user && !user.isAnonymous) {
                // Logged in user
                const displayName = user.displayName || 'User';
                const initial = displayName.charAt(0).toUpperCase();
                const isAdmin = isPrivileged;
                
                authControlHTML = `
                    <div class="relative">
                        <button id="auth-toggle" class="w-10 h-10 flex items-center justify-center rounded-full bg-gray-700 border-2 border-gray-600 overflow-hidden shadow-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-gray-900" aria-expanded="false" aria-controls="auth-menu">
                            <div class="initial-avatar w-full h-full text-lg">${initial}</div>
                        </button>
                        <div id="auth-menu" class="auth-menu-container closed">
                            <div class="px-4 py-2 border-b border-gray-700 mb-2">
                                <p class="text-sm font-medium auth-menu-username text-center">${displayName}</p>
                                <p class="text-xs text-gray-400 truncate text-center">${user.email || 'N/A'}</p>
                            </div>
                            ${isAdmin ? `
                                <a href="../logged-in/admin-dashboard.html" class="auth-menu-link">
                                    <i class="fa-solid fa-user-shield w-4 text-yellow-400"></i>
                                    <span>Admin Dashboard</span>
                                </a>
                            ` : ''}
                            <a href="../logged-in/settings.html" class="auth-menu-link">
                                <i class="fa-solid fa-gear w-4"></i>
                                <span>Settings</span>
                            </a>
                            <div class="h-px my-1 mx-2 bg-gray-700 bg-[var(--menu-divider)]"></div>
                            <button id="logout-btn" class="auth-menu-button text-red-400 hover:text-red-300 hover:!bg-red-900/40">
                                <i class="fa-solid fa-right-from-bracket w-4"></i>
                                <span>Sign out</span>
                            </button>
                        </div>
                    </div>
                `;
            } else {
                // Logged out/Anonymous user
                authControlHTML = `
                    <a id="auth-toggle" href="../../authentication.html" class="logged-out-auth-toggle w-10 h-10 flex items-center justify-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-gray-900">
                        <i class="fa-solid fa-user text-lg"></i>
                    </a>
                `;
            }

            // --- 4. ASSEMBLE FULL NAVBAR HTML ---
            const navbarHTML = `
                <header class="auth-navbar shadow-lg">
                    <nav>
                        <a href="../../index.html" class="flex-shrink-0">
                            <img id="navbar-logo" class="h-8 w-auto" src="${DEFAULT_THEME['logo-src']}" alt="Logo">
                        </a>

                        <div class="tab-wrapper">
                            <div id="glide-left" class="scroll-glide-button hidden">
                                <i class="fa-solid fa-chevron-left"></i>
                            </div>

                            <div id="tab-scroll-container" class="tab-scroll-container">
                                ${tabHTML}
                            </div>

                            <div id="glide-right" class="scroll-glide-button hidden">
                                <i class="fa-solid fa-chevron-right"></i>
                            </div>
                        </div>

                        <div class="flex items-center gap-4 flex-shrink-0">
                            ${pinButtonHTML}
                            ${authControlHTML}
                        </div>
                    </nav>
                </header>
            `;

            // --- 5. RENDER ---
            const oldScrollContainer = container.querySelector('#tab-scroll-container');
            const wasAtScrollEnd = oldScrollContainer 
                ? (oldScrollContainer.scrollWidth - oldScrollContainer.clientWidth - oldScrollContainer.scrollLeft) < 1 
                : false;
            
            // Only update the pin/auth area for partial updates (Feature 13 & 14)
            if (container.querySelector('#pin-control-wrapper') && preserveScroll) {
                // Partial update (only replace the pin/auth controls)
                const pinAuthWrapper = container.querySelector('.flex.items-center.gap-4.flex-shrink-0');
                if (pinAuthWrapper) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = `<div class="flex items-center gap-4 flex-shrink-0">${pinButtonHTML} ${authControlHTML}</div>`;
                    pinAuthWrapper.replaceWith(tempDiv.firstChild);
                    
                    // The rest of the setup below handles listeners, including the ones on the new buttons
                }
            } else {
                // Full re-render
                container.innerHTML = navbarHTML;
            }

            // --- 6. ATTACH LISTENERS & SCROLL LOGIC ---
            
            // Re-fetch all elements after (re)render
            const tabScrollContainer = document.getElementById('tab-scroll-container');
            const authToggle = document.getElementById('auth-toggle');
            const authMenu = document.getElementById('auth-menu');
            const logoutButton = document.getElementById('logout-btn');
            const pinButton = document.getElementById('pin-button');
            const pinMenu = document.getElementById('pin-menu-container');
            const repinButton = document.getElementById('repin-current-btn');
            const unpinButton = document.getElementById('unpin-btn');

            // --- 6A. SCROLLING (Updated to use test-navigation.js logic) ---
            if (tabScrollContainer) {
                const centerActiveTab = () => {
                    const activeTab = tabScrollContainer.querySelector('.nav-tab.active');
                    if (activeTab) {
                        // Calculate scroll position to center the tab
                        const scrollPosition = activeTab.offsetLeft - (tabScrollContainer.clientWidth / 2) + (activeTab.clientWidth / 2);
                        
                        // Use requestAnimationFrame for smooth, non-blocking scroll (Feature 12)
                        requestAnimationFrame(() => {
                            tabScrollContainer.scrollLeft = scrollPosition;
                            updateGlideButtonVisibility(tabScrollContainer); // Update after centering
                        });
                    }
                };

                if (preserveScroll) {
                    // SCROLL PERSISTENCE RESTORE (From navigation.js feature 12)
                    // Restore scroll position saved from the last render/interaction
                    requestAnimationFrame(() => {
                        tabScrollContainer.scrollLeft = currentScrollLeft;
                        updateGlideButtonVisibility(tabScrollContainer); // Update glide buttons after restoring scroll
                    });
                } else {
                    // ACTIVE TAB SCROLL (From navigation.js feature 5)
                    // Only center the active tab on the initial page load (full render)
                    if (!hasScrolledToActiveTab) {
                        centerActiveTab();
                        hasScrolledToActiveTab = true;
                    } else if (wasAtScrollEnd) {
                        // Re-check visibility if the scroll was at the end to ensure glide buttons are hidden
                        updateGlideButtonVisibility(tabScrollContainer);
                    }
                }
                
                // SCROLL EVENT LISTENER (Updated to use test-navigation.js logic for glide button update 
                // and keeping navigation.js logic for scroll persistence saving)
                tabScrollContainer.onscroll = () => {
                    // Update glide buttons (from test-navigation.js logic)
                    updateGlideButtonVisibility(tabScrollContainer);
                    // Save the current scroll position (for navigation.js persistence feature)
                    currentScrollLeft = tabScrollContainer.scrollLeft; 
                };
                
                // RESIZE EVENT LISTENER (Kept existing navigation.js debounce logic)
                window.removeEventListener('resize', window.scrollResizeHandler); // Remove old one first
                window.scrollResizeHandler = debounce(() => {
                    updateGlideButtonVisibility(tabScrollContainer);
                }, 150);
                window.addEventListener('resize', window.scrollResizeHandler);

                // GLIDE BUTTON HANDLERS (Updated to use the new handleGlideClick function from test-navigation.js)
                document.getElementById('glide-left')?.addEventListener('click', () => handleGlideClick('left'));
                document.getElementById('glide-right')?.addEventListener('click', () => handleGlideClick('right'));

                // Initial visibility check if not centering or restoring scroll
                if (!preserveScroll && !hasScrolledToActiveTab) {
                    updateGlideButtonVisibility(tabScrollContainer);
                }
            }


            // --- 6B. AUTH MENU LISTENER ---
            if (authToggle && authMenu) {
                // Function to toggle the menu state
                const toggleMenu = (open) => {
                    authMenu.classList.toggle('open', open);
                    authMenu.classList.toggle('closed', !open);
                    authToggle.setAttribute('aria-expanded', open);
                    if (pinMenu) pinMenu.classList.add('closed'); // Close pin menu when auth menu opens
                };

                // Add toggle listener to the button
                authToggle.onclick = (e) => {
                    e.stopPropagation();
                    const isOpen = authMenu.classList.contains('open');
                    toggleMenu(!isOpen);
                };

                // Add logout listener
                if (logoutButton) {
                    logoutButton.onclick = async () => {
                        try {
                            await auth.signOut();
                            // Redirect is handled by the onAuthStateChanged listener below
                            toggleMenu(false); 
                        } catch (error) {
                            console.error("Logout failed:", error);
                        }
                    };
                }

                // Close menu on outside click (global listener added below)
            }

            // --- 6C. PIN BUTTON LISTENER ---
            if (pinButton && pinMenu) {
                // Function to toggle the pin menu state
                const togglePinMenu = (open) => {
                    pinMenu.classList.toggle('open', open);
                    pinMenu.classList.toggle('closed', !open);
                    if (authMenu) authMenu.classList.add('closed'); // Close auth menu when pin menu opens
                };

                pinButton.onclick = (e) => {
                    e.stopPropagation();
                    const isOpen = pinMenu.classList.contains('open');
                    togglePinMenu(!isOpen);
                    
                    // Handle pin hint visibility (Feature 10)
                    const hint = document.getElementById('pin-hint');
                    if (!getHintShown() && hint) {
                        if (!isOpen) {
                            // Show hint on first open
                            hint.classList.add('show');
                            setHintShown();
                        }
                        // Hide hint after a delay
                        hidePinHint(1000); 
                    } else {
                        hidePinHint();
                    }
                };

                // Handler for repin/pin current button
                if (repinButton) {
                    repinButton.onclick = (e) => {
                        e.stopPropagation();
                        setPinnedPage(currentPageId);
                        // Re-render only the pin/auth area, preserving scroll (Feature 13)
                        renderNavbar(user, userData, allPages, currentIsPrivileged, true); 
                    };
                }

                // Handler for unpin button
                if (unpinButton) {
                    unpinButton.onclick = (e) => {
                        e.stopPropagation();
                        setPinnedPage(null);
                        // Re-render only the pin/auth area, preserving scroll (Feature 13)
                        renderNavbar(user, userData, allPages, currentIsPrivileged, true); 
                    };
                }
            }
            
            // --- 6D. GLOBAL CLICK LISTENER (Feature 19) ---
            if (!globalClickListenerAdded) {
                document.addEventListener('click', (e) => {
                    // Re-fetch all menus on every click to prevent stale references (Feature 19)
                    const currentAuthMenu = document.getElementById('auth-menu');
                    const currentPinMenu = document.getElementById('pin-menu-container');
                    const currentAuthToggle = document.getElementById('auth-toggle');
                    const currentPinButton = document.getElementById('pin-button');

                    // Check if click is outside auth menu/toggle
                    if (currentAuthMenu && currentAuthMenu.classList.contains('open') && 
                        !currentAuthMenu.contains(e.target) && !currentAuthToggle.contains(e.target)) {
                        currentAuthMenu.classList.add('closed');
                        currentAuthMenu.classList.remove('open');
                        currentAuthToggle.setAttribute('aria-expanded', 'false');
                    }

                    // Check if click is outside pin menu/button
                    if (currentPinMenu && currentPinMenu.classList.contains('open') && 
                        !currentPinMenu.contains(e.target) && !currentPinButton.contains(e.target)) {
                        currentPinMenu.classList.add('closed');
                        currentPinMenu.classList.remove('open');
                    }
                });
                globalClickListenerAdded = true;
            }
        };

        // --- AUTHENTICATION STATE OBSERVER ---
        auth.onAuthStateChanged(async (user) => {
            currentScrollLeft = document.getElementById('tab-scroll-container')?.scrollLeft || 0;
            
            if (user && !user.isAnonymous) {
                // User is signed in. Fetch user data from Firestore.
                try {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    const userData = userDoc.exists ? userDoc.data() : null;
                    
                    const userEmail = user.email || '';
                    const isPrivilegedUser = userEmail === PRIVILEGED_EMAIL;

                    // Update global state
                    currentUser = user;
                    currentUserData = userData;
                    currentIsPrivileged = isPrivilegedUser;
                    
                    // Render the navbar with the new state. 
                    // Full re-render on auth change, don't preserve scroll unless explicitly requested.
                    renderNavbar(currentUser, currentUserData, allPages, currentIsPrivileged);

                } catch (error) {
                    console.error("Error fetching user data:", error);
                    // Render even if Firestore fails
                    renderNavbar(user, null, allPages, user.email === PRIVILEGED_EMAIL); 
                }
            } else {
                // User is signed out/anonymous.
                const isPrivilegedUser = false;

                // Update global state
                currentUser = user;
                currentUserData = null;
                currentIsPrivileged = isPrivilegedUser;

                renderNavbar(null, null, allPages, false);

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
