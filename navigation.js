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
 * 22. (NEW) LOGO TINTING: Implemented CSS filter based logo tinting for all custom themes using `logo-tint-color` property.
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
    'name': 'Dark',
    'logo-src': '/images/logo.png',
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
// --- UPDATED to handle logo tinting ---
window.applyTheme = (theme) => {
    const root = document.documentElement;
    if (!root) return;

    // Fallback to default theme if input is invalid
    const themeToApply = theme && typeof theme === 'object' ? theme : DEFAULT_THEME;

    // Set all CSS variables
    for (const [key, value] of Object.entries(themeToApply)) {
        // EXCLUDE 'name', 'logo-src', and the NEW 'logo-tint-color' from being set as a standard CSS variable
        if (key !== 'logo-src' && key !== 'name' && key !== 'logo-tint-color') {
            root.style.setProperty(`--${key}`, value);
        }
    }

    const logoImg = document.getElementById('navbar-logo');
    
    // --- START NEW: Handle Logo Tinting (Applies to all themes except Dark/Light) ---
    const tintColor = themeToApply['logo-tint-color'];

    if (logoImg) {
        if (tintColor) {
            // 1. Set the tint color variable for CSS filter
            root.style.setProperty('--logo-tint-color-value', tintColor);
            // 2. Add the class to enable the CSS filter effect
            logoImg.classList.add('logo-tinted');
        } else {
            // 3. Remove the class for themes that should not be tinted (Dark/Light)
            logoImg.classList.remove('logo-tinted');
            // 4. Clear the variable (optional, but good practice)
            root.style.removeProperty('--logo-tint-color-value');
        }
    }
    // --- END NEW: Handle Logo Tinting ---


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

// Variables to hold authentication state and data
let currentUser = null;
let currentUserData = null;
let currentIsPrivileged = false;
let initialScrollDone = false;
let currentPinPage = null;

// --- Self-invoking function to encapsulate all logic ---
(function() {
    // Stop execution if Firebase config is not provided
    if (!FIREBASE_CONFIG || !FIREBASE_CONFIG.apiKey) {
        console.error("Firebase configuration is missing! Please paste your config into navigation.js.");
        return;
    }

    // --- 1. DYNAMICALLY LOAD EXTERNAL ASSETS & HELPERS ---

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

    // Simple debounce utility for performance
    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    };
    
    // Icon class utility to handle custom icon names
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

    // Checks if the given tab URL is the active page
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
    
    // Gets the current page key from the config by matching the URL
    const getCurrentPageKey = (pages) => {
        const urlMatch = Object.entries(pages).find(([key, page]) => isTabActive(page.url));
        return urlMatch ? urlMatch[0] : null;
    };


    // --- 2. INJECT CSS STYLES ---
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

            /* --- NEW: Logo Tinting Styles (Applies to all themes with the logo-tinted class) --- */
            #navbar-logo.logo-tinted {
                /* Uses the drop-shadow filter to effectively color a black/white logo image 
                 * to the color defined in --logo-tint-color-value. */
                filter: 
                    brightness(0) 
                    invert(1) 
                    drop-shadow(0 0 0 var(--logo-tint-color-value)) 
                    drop-shadow(0 0 0 var(--logo-tint-color-value)); /* Multiple shadows for strength */
                opacity: 0.9; /* Slightly reduce opacity for effect */
                transition: filter 0.3s ease, opacity 0.3s ease;
            }
            /* --- END NEW: Logo Tinting Styles --- */

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
            /* USERNAME COLOR FIX */
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
            #pin-button i {
                color: var(--pin-btn-icon-color);
                transition: color 0.3s ease;
            }

            /* Pin Hint */
            #pin-hint-box {
                background: var(--hint-bg);
                border: 1px solid var(--hint-border);
                color: var(--hint-text);
                transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease;
            }
        `;
        document.head.appendChild(style);
    };

    // --- 3. CORE RENDERING FUNCTIONS ---

    // Generates the HTML for the authenticated user dropdown menu
    const getAuthenticatedMenuHTML = (user, isPrivileged) => {
        const displayName = user.displayName || (user.email ? user.email.split('@')[0] : 'User');
        const userEmail = user.email || 'N/A';
        const isAdmin = isPrivileged;

        let adminLink = isAdmin 
            ? `<a href="../settings.html" class="auth-menu-link">
                   <i class="fa-solid fa-gear w-4"></i>
                   <span class="font-bold">Settings</span>
               </a>`
            : `<a href="../settings.html" class="auth-menu-link">
                   <i class="fa-solid fa-gear w-4"></i>
                   <span>Settings</span>
               </a>`;


        return `
            <div id="auth-menu" class="auth-menu-container closed">
                <div class="p-2">
                    <div class="flex items-center space-x-3 pb-3 mb-2 border-b border-gray-700">
                        ${getAvatarHTML(user, 'w-10 h-10', 'text-lg')}
                        <div class="flex-grow min-w-0">
                            <div class="truncate font-semibold auth-menu-username">${displayName}</div>
                            <div class="text-xs text-gray-400 truncate">${userEmail}</div>
                        </div>
                    </div>
                    ${adminLink}
                    <button id="logout-button" class="auth-menu-button">
                        <i class="fa-solid fa-right-from-bracket w-4"></i>
                        <span>Log out</span>
                    </button>
                </div>
            </div>
        `;
    };

    // Generates the HTML for the logged-out menu
    const getLoggedOutMenuHTML = () => {
        return `
            <div id="auth-menu" class="auth-menu-container closed">
                <div class="p-2">
                    <a href="../authentication.html" class="auth-menu-link">
                        <i class="fa-solid fa-arrow-right-to-bracket w-4"></i>
                        <span>Sign In / Register</span>
                    </a>
                </div>
            </div>
        `;
    };

    // Generates the HTML for the avatar/toggle button
    const getAuthToggleHTML = (user) => {
        if (user) {
            return `
                <button id="auth-toggle" class="rounded-full overflow-hidden w-8 h-8 border-2 shadow-md">
                    ${getAvatarHTML(user, 'w-7 h-7', 'text-sm')}
                </button>
            `;
        } else {
            return `
                <button id="auth-toggle" class="logged-out-auth-toggle rounded-full w-8 h-8 flex items-center justify-center border shadow-md">
                    <i class="fa-solid fa-user"></i>
                </button>
            `;
        }
    };

    // Generates the HTML for the avatar image or initial
    const getAvatarHTML = (user, sizeClass, fontSizeClass) => {
        const defaultIcon = '<i class="fa-solid fa-user-circle"></i>';
        const defaultInitial = (user.displayName || user.email || 'U').charAt(0).toUpperCase();

        if (user.photoURL) {
            return `<img src="${user.photoURL}" alt="User Avatar" class="w-full h-full object-cover">`;
        } else {
            return `<div class="initial-avatar ${sizeClass} ${fontSizeClass}">${defaultInitial}</div>`;
        }
    };

    // Generates the HTML for a single navigation tab
    const getTabHTML = (page) => {
        const isActive = isTabActive(page.url);
        const iconClass = getIconClass(page.icon);
        const activeClass = isActive ? 'active' : '';

        return `
            <a href="${page.url}" class="nav-tab ${activeClass}">
                <i class="${iconClass} mr-2"></i>
                <span>${page.name}</span>
            </a>
        `;
    };

    // Generates the HTML for the pin menu
    const getPinMenuHTML = (pinPage, currentPageKey, pages) => {
        let menuContent = '';
        let pinIconClass = 'fa-solid fa-thumbtack';
        const isCurrentPagePinned = pinPage && currentPageKey && pinPage.key === currentPageKey;
        const currentPage = pages[currentPageKey];

        // 1. Current Pinned Page
        if (pinPage) {
            const iconClass = getIconClass(pinPage.icon);
            const pinLink = pinPage.key === currentPageKey 
                ? `<a href="#" class="auth-menu-link disabled text-gray-500 cursor-default"><i class="${iconClass} w-4"></i> ${pinPage.name} (Pinned)</a>`
                : `<a href="${pinPage.url}" class="auth-menu-link"><i class="${iconClass} w-4"></i> ${pinPage.name} (Pinned)</a>`;
            
            menuContent += `
                <div class="px-3 pt-2 pb-1 text-xs text-gray-400">Pinned Page</div>
                ${pinLink}
                <button id="unpin-button" class="auth-menu-button mt-1">
                    <i class="fa-solid fa-xmark w-4"></i>
                    <span>Unpin</span>
                </button>
                <div class="my-2 border-b border-gray-700"></div>
            `;
        }

        // 2. Repin/Pin Current Page
        if (currentPage && !isCurrentPagePinned) {
            const iconClass = getIconClass(currentPage.icon);
            menuContent += `
                <button id="pin-current-button" data-page-key="${currentPageKey}" class="auth-menu-button">
                    <i class="${pinIconClass} w-4"></i>
                    <span>${pinPage ? 'Repin' : 'Pin'} Current Page: ${currentPage.name}</span>
                </button>
            `;
        }

        if (!pinPage && !currentPage) {
            menuContent += `
                <div class="p-2 text-sm text-gray-400">Navigate to a page to pin it.</div>
            `;
        }


        return `
            <div id="pin-menu" class="auth-menu-container closed glass-menu">
                <div class="p-1">
                    ${menuContent}
                </div>
            </div>
        `;
    };

    // Main function to compose and inject the navbar HTML
    const renderNavbar = (user, userData, allPages, isPrivileged, preserveScroll = false) => {
        let navbar = document.getElementById('auth-navbar');
        if (!navbar) {
            navbar = document.createElement('header');
            navbar.id = 'auth-navbar';
            navbar.className = 'auth-navbar';
            document.body.prepend(navbar);
        }

        const pagesArray = Object.values(allPages);
        const tabsHTML = pagesArray.map(getTabHTML).join('');
        const currentPageKey = getCurrentPageKey(allPages);

        // Save scroll position before re-render
        const scrollContainer = document.getElementById('tab-scroll-container');
        const scrollPos = scrollContainer ? scrollContainer.scrollLeft : 0;

        // Determine if pin is available and get the pinned page data
        const pinPage = getPinPage(allPages);
        currentPinPage = pinPage;

        navbar.innerHTML = `
            <nav>
                <a href="../index.html">
                    <img id="navbar-logo" src="/images/logo.png" alt="Logo" class="w-8 h-8" />
                </a>

                <div class="tab-wrapper">
                    <div id="glide-left" class="scroll-glide-button hidden"><i class="fa-solid fa-chevron-left"></i></div>
                    <div id="tab-scroll-container" class="tab-scroll-container">
                        ${tabsHTML}
                    </div>
                    <div id="glide-right" class="scroll-glide-button hidden"><i class="fa-solid fa-chevron-right"></i></div>
                </div>

                <div id="auth-controls" class="relative flex items-center space-x-3">
                    ${user ? renderPinAreaHTML(pinPage, currentPageKey, allPages) : ''}
                    
                    ${getAuthToggleHTML(user)}
                    ${user ? getAuthenticatedMenuHTML(user, isPrivileged) : getLoggedOutMenuHTML()}
                </div>
            </nav>
        `;

        // Load saved theme now that elements exist
        loadAndApplyTheme();

        // Attach event listeners for the new DOM elements
        attachEventListeners(user, allPages);

        const newScrollContainer = document.getElementById('tab-scroll-container');
        
        if (newScrollContainer) {
            // Restore scroll position first
            if (preserveScroll) {
                // Use rAF for smoother restoration
                requestAnimationFrame(() => {
                    newScrollContainer.scrollLeft = scrollPos;
                    updateGlideButtons(newScrollContainer);
                });
            } else {
                // Only center the active tab once on initial page load (full render)
                if (!initialScrollDone) {
                    const activeTab = newScrollContainer.querySelector('.nav-tab.active');
                    if (activeTab) {
                        centerElementInContainer(newScrollContainer, activeTab);
                    }
                    initialScrollDone = true;
                }
                updateGlideButtons(newScrollContainer);
            }
        }
    };

    // Partial re-render for the Pin/Auth area only
    const renderAuthControlsPartial = (user, allPages) => {
        const authControls = document.getElementById('auth-controls');
        if (!authControls) return;

        const currentPageKey = getCurrentPageKey(allPages);
        const pinPage = getPinPage(allPages);
        currentPinPage = pinPage;

        const newAuthControlsHTML = `
            ${user ? renderPinAreaHTML(pinPage, currentPageKey, allPages) : ''}
            ${getAuthToggleHTML(user)}
            ${user ? getAuthenticatedMenuHTML(user, currentIsPrivileged) : getLoggedOutMenuHTML()}
        `;

        authControls.innerHTML = newAuthControlsHTML;
        
        // Re-attach listeners for the new buttons
        attachEventListeners(user, allPages);
    };

    // Partial render for Pin button and menu only
    const renderPinAreaHTML = (pinPage, currentPageKey, pages) => {
        return `
            <button id="pin-button" class="w-8 h-8 flex items-center justify-center rounded-full border-2 shadow-md">
                <i class="fa-solid fa-thumbtack text-sm"></i>
            </button>
            ${getPinMenuHTML(pinPage, currentPageKey, pages)}
            <div id="pin-hint-box" class="absolute right-0 bottom-full mb-3 p-2 text-xs rounded-lg shadow-xl hidden">
                <i class="fa-solid fa-arrow-up-long mr-2"></i> Click this button to quickly save a link.
                <button id="pin-hint-close" class="ml-2 text-gray-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `;
    };


    // --- 4. SCROLL & GLIDE UTILITIES ---

    const centerElementInContainer = (container, element) => {
        const containerWidth = container.offsetWidth;
        const elementWidth = element.offsetWidth;
        const elementOffset = element.offsetLeft;

        // Calculate scroll position to center the element
        const scrollPosition = elementOffset - (containerWidth / 2) + (elementWidth / 2);
        container.scrollLeft = scrollPosition;
    };

    // Updates the visibility of the scroll glide buttons
    const updateGlideButtons = (container) => {
        if (!container) return;
        const glideLeft = document.getElementById('glide-left');
        const glideRight = document.getElementById('glide-right');
        
        if (!glideLeft || !glideRight) return;

        const maxScroll = container.scrollWidth - container.clientWidth;
        const currentScroll = container.scrollLeft;
        const threshold = 5; // A small threshold to account for fractional scroll positions

        // Left button: Hide if scroll is at or near the start
        if (currentScroll <= threshold) {
            glideLeft.classList.add('hidden');
        } else {
            glideLeft.classList.remove('hidden');
        }

        // Right button: Hide if scroll is at or near the end
        if (currentScroll >= maxScroll - threshold) {
            glideRight.classList.add('hidden');
        } else {
            glideRight.classList.remove('hidden');
        }

        // Hide both if scroll is not needed
        if (maxScroll <= threshold) {
            glideLeft.classList.add('hidden');
            glideRight.classList.add('hidden');
        }
    };

    // Smooth scroll the container by a certain amount
    const scrollContainer = (container, distance) => {
        container.scrollLeft += distance;
    };


    // --- 5. PINNING LOGIC (Uses LocalStorage) ---
    
    const PIN_KEY = 'pinned-page-link';
    const HINT_KEY = 'pin-hint-shown';

    // Saves the current page URL and its key to Local Storage
    const savePin = (pageKey, page) => {
        const pinData = {
            key: pageKey,
            name: page.name,
            url: page.url,
            icon: page.icon
        };
        localStorage.setItem(PIN_KEY, JSON.stringify(pinData));
        currentPinPage = pinData; // Update state immediately
        renderAuthControlsPartial(currentUser, allPages); // Partial re-render
    };

    // Retrieves the pinned page data from Local Storage
    const getPinPage = (pages) => {
        try {
            const data = localStorage.getItem(PIN_KEY);
            if (!data) return null;
            const pinData = JSON.parse(data);
            
            // Validation: Ensure the pinned key still exists in the pages config
            if (pages[pinData.key]) {
                 return pinData;
            } else {
                // If the pinned page key no longer exists (e.g., config changed), unpin it.
                unpin();
                return null;
            }

        } catch (e) {
            console.error("Error retrieving pinned page:", e);
            return null;
        }
    };

    // Clears the pinned page from Local Storage
    const unpin = () => {
        localStorage.removeItem(PIN_KEY);
        currentPinPage = null; // Update state immediately
        renderAuthControlsPartial(currentUser, allPages); // Partial re-render
    };

    // Shows the one-time hint box
    const showPinHint = () => {
        if (localStorage.getItem(HINT_KEY) !== 'true') {
            const hintBox = document.getElementById('pin-hint-box');
            if (hintBox) {
                hintBox.classList.remove('hidden');
                localStorage.setItem(HINT_KEY, 'true'); // Mark as shown
            }
        }
    };

    // Hides the one-time hint box
    const hidePinHint = () => {
        const hintBox = document.getElementById('pin-hint-box');
        if (hintBox) {
            hintBox.classList.add('hidden');
        }
    };

    // --- 6. THEME LOGIC ---

    // Fetches all themes from themes.json
    const fetchThemes = async () => {
        try {
            const response = await fetch('../themes.json');
            if (!response.ok) throw new Error('Could not load themes.json');
            return response.json();
        } catch (error) {
            console.error('Error fetching themes:', error);
            return [DEFAULT_THEME]; // Fallback
        }
    };

    // Loads the user's saved theme and applies it
    const loadAndApplyTheme = async () => {
        const themeName = localStorage.getItem(THEME_STORAGE_KEY) || 'Dark';
        const themes = await fetchThemes();
        const selectedTheme = themes.find(t => t.name === themeName) || DEFAULT_THEME;
        window.applyTheme(selectedTheme);
    };


    // --- 7. EVENT LISTENERS AND HANDLERS ---

    // Global click handler to close menus
    const globalClickHandler = (event) => {
        const authToggle = document.getElementById('auth-toggle');
        const authMenu = document.getElementById('auth-menu');
        const pinToggle = document.getElementById('pin-button');
        const pinMenu = document.getElementById('pin-menu');
        const pinHintBox = document.getElementById('pin-hint-box');

        // Check and close Auth Menu
        if (authToggle && authMenu) {
            if (!authToggle.contains(event.target) && !authMenu.contains(event.target)) {
                authMenu.classList.remove('open');
                authMenu.classList.add('closed');
            }
        }

        // Check and close Pin Menu
        if (pinToggle && pinMenu) {
            if (!pinToggle.contains(event.target) && !pinMenu.contains(event.target)) {
                pinMenu.classList.remove('open');
                pinMenu.classList.add('closed');
            }
        }
        
        // Hide hint box if user clicks anywhere else
        if (pinHintBox && !pinHintBox.contains(event.target) && pinToggle && !pinToggle.contains(event.target)) {
            hidePinHint();
        }
    };

    const attachEventListeners = (user, allPages) => {
        // 1. Auth Toggle Button
        const authToggle = document.getElementById('auth-toggle');
        const authMenu = document.getElementById('auth-menu');
        if (authToggle && authMenu) {
            authToggle.onclick = (e) => {
                e.stopPropagation();
                authMenu.classList.toggle('closed');
                authMenu.classList.toggle('open');
                // Ensure pin menu is closed
                const pinMenu = document.getElementById('pin-menu');
                if (pinMenu) {
                    pinMenu.classList.remove('open');
                    pinMenu.classList.add('closed');
                }
            };
        }

        // 2. Logout Button
        const logoutButton = document.getElementById('logout-button');
        if (logoutButton && auth) {
            logoutButton.onclick = async () => {
                try {
                    await auth.signOut();
                    // State change listener handles re-render
                } catch (error) {
                    console.error("Error signing out:", error);
                }
            };
        }

        // 3. Tab Scroll and Glide Buttons
        const scrollContainer = document.getElementById('tab-scroll-container');
        const glideLeft = document.getElementById('glide-left');
        const glideRight = document.getElementById('glide-right');

        if (scrollContainer) {
            // Update glide buttons on scroll
            scrollContainer.onscroll = debounce(() => updateGlideButtons(scrollContainer), 10);
            // Also update instantly on scroll end, which is important for glide button clicks
            scrollContainer.addEventListener('scroll', () => {
                if (scrollContainer.scrollTimer) {
                    clearTimeout(scrollContainer.scrollTimer);
                }
                scrollContainer.scrollTimer = setTimeout(() => {
                    updateGlideButtons(scrollContainer);
                }, 100); 
                updateGlideButtons(scrollContainer); // Update instantly as well
            });
            
            // Scroll buttons
            if (glideLeft) {
                glideLeft.onclick = () => scrollContainer.scrollBy({ left: -200, behavior: 'smooth' });
            }
            if (glideRight) {
                glideRight.onclick = () => scrollContainer.scrollBy({ left: 200, behavior: 'smooth' });
            }
            
            // Initial check for glide buttons
            // Must be called after the tabs are rendered and scroll position is set
            // Debounce or rAF handles this in renderNavbar.
        }

        // 4. Pin Button
        const pinButton = document.getElementById('pin-button');
        const pinMenu = document.getElementById('pin-menu');
        if (pinButton && pinMenu) {
            pinButton.onclick = (e) => {
                e.stopPropagation();
                pinMenu.classList.toggle('closed');
                pinMenu.classList.toggle('open');
                
                // Ensure auth menu is closed
                const authMenu = document.getElementById('auth-menu');
                if (authMenu) {
                    authMenu.classList.remove('open');
                    authMenu.classList.add('closed');
                }
                
                // Show hint if first time
                showPinHint();
            };
        }

        // 5. Pin Menu Actions
        const unpinButton = document.getElementById('unpin-button');
        if (unpinButton) {
            unpinButton.onclick = () => {
                unpin();
                pinMenu.classList.remove('open');
                pinMenu.classList.add('closed');
            };
        }

        const pinCurrentButton = document.getElementById('pin-current-button');
        if (pinCurrentButton) {
            pinCurrentButton.onclick = (e) => {
                const pageKey = e.currentTarget.dataset.pageKey;
                const page = allPages[pageKey];
                if (pageKey && page) {
                    savePin(pageKey, page);
                    pinMenu.classList.remove('open');
                    pinMenu.classList.add('closed');
                }
            };
        }
        
        // 6. Pin Hint Close Button
        const pinHintClose = document.getElementById('pin-hint-close');
        if (pinHintClose) {
            pinHintClose.onclick = hidePinHint;
        }
        
        // 7. Global listener for menu closing
        document.body.addEventListener('click', globalClickHandler);
        // Clean up previous listeners to prevent duplicates
        // Note: The global listener is the only one that needs this. All others 
        // are attached to elements that are completely re-rendered.
    };


    // --- 8. FIREBASE INITIALIZATION AND AUTH STATE LISTENER ---

    const initializeApp = (allPages) => {
        try {
            // Firebase setup
            if (!window.firebase.apps.length) {
                window.firebase.initializeApp(FIREBASE_CONFIG);
            }
            auth = window.firebase.auth();
            db = window.firebase.firestore();

        } catch (e) {
            console.error("Firebase SDK not initialized correctly:", e);
            // Fallback render for basic non-auth functionality
            renderNavbar(null, null, allPages, false);
            return;
        }

        // Auth state observer
        auth.onAuthStateChanged(async (user) => {
            let userData = null;
            let isPrivilegedUser = false;

            if (user) {
                // User is signed in. Fetch custom data.
                isPrivilegedUser = user.email === PRIVILEGED_EMAIL;
                
                try {
                    const doc = await db.collection('users').doc(user.uid).get();
                    if (doc.exists) {
                        userData = doc.data();
                    }
                } catch (e) {
                    console.error("Error fetching user data:", e);
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
    };

    const run = async () => {
        let pages = {};
        
        // Inject styles immediately on load
        injectStyles();

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
            // Render basic non-auth version if firebase fails
            renderNavbar(null, null, pages, false);
        }
    };

    // --- START THE PROCESS ---
    document.addEventListener('DOMContentLoaded', run);

})();
