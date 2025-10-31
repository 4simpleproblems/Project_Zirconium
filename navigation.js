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
 * 3. GOLD ADMIN TAB: The 'Beta Settings' tab now has a premium gold-textured look and uses the path: ../logged-in/beta-settings.html.
 * 4. SETTINGS LINK: Includes the 'Settings' link in the authenticated user's dropdown menu.
 * 5. ACTIVE TAB SCROLL: Auto-scrolls the active tab to the center of the viewport for visibility.
 * 6. LOGOUT REDIRECT: Redirects logged-out users away from logged-in pages.
 * 7. (NEW) FULL THEMING SYSTEM: Replaced all hardcoded colors with CSS variables. Added a global `window.applyTheme` function to set themes. Navbar now loads the user's saved theme from Local Storage on startup. Added CSS transitions for smooth theme fading. (MERGED FROM navigation-new.js)
 * 8. (NEW) LOGO TINTING: Replaced logo `<img>` tag with a `<div>` using `mask-image`. `window.applyTheme` now supports `logo-tint-color` from themes.json to dynamically color the logo. (MERGED FROM navigation-new.js)
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

// --- NEW: Theming Configuration (from navigation-new.js) ---
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
 * NEW: Global Theme Applicator Function (from navigation-new.js)
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

    // Simple debounce utility for performance
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

    // --- 2. INITIALIZE FIREBASE AND RENDER NAVBAR ---
    const initializeApp = (pages) => {
        // --- Create a div for the navbar to live in if it doesn't exist.
        if (!document.getElementById('navbar-container')) {
            const navbarDiv = document.createElement('div');
            navbarDiv.id = 'navbar-container';
            document.body.prepend(navbarDiv);
        }

        // --- 3. INJECT CSS STYLES (MOVED BEFORE INITIALIZEAPP) ---
        // This now uses CSS variables for all colors and adds transitions.
        injectStyles(); // <--- MOVED HERE
        
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

        // --- 3. INJECT CSS STYLES ---
        // REPLACED with version from navigation-new.js, then added admin-tab styles back.
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

                /* NEW: Glass Menu Style for Pin Context Menu (from navigation-new.js) */
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
                
                /* --- PRESERVED: Gold textured style for Admin Tab (from original navigation.js) --- */
                .nav-tab.admin-tab {
                    /* Gold Gradient Text - ensures the text color is not overridden by default states */
                    background: linear-gradient(45deg, #f0e68c, #ffd700, #daa520, #f0e68c);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    color: transparent; /* Required for the gradient effect to work */
                    font-weight: 700;
                    border: 2px solid gold;
                    box-shadow: 0 0 8px rgba(255, 215, 0, 0.6); /* Soft glow */
                    transition: all 0.3s ease;
                }
                
                .nav-tab.admin-tab:not(.active):hover {
                    border-color: #ffd700;
                    background-color: rgba(255, 215, 0, 0.1);
                    box-shadow: 0 0 12px rgba(255, 215, 0, 0.9);
                }

                .nav-tab.admin-tab.active {
                    background-color: rgba(255, 215, 0, 0.25);
                    border-color: #f0e68c;
                    box-shadow: 0 0 10px rgba(255, 215, 0, 1);
                }
                
                /* Pin Button Styles (from navigation-new.js) - Kept for theme completeness */
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

                /* Pin Hint Styles (from navigation-new.js) - Kept for theme completeness */
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

        // PRESERVED: Original updateScrollGilders from navigation.js
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

        // --- 4. RENDER THE NAVBAR HTML ---
        const renderNavbar = (user, userData, pages, isPrivilegedUser) => {
            const container = document.getElementById('navbar-container');
            if (!container) return; 

            // REMOVED: const logoPath = "/images/logo.png"; (no longer needed)
            
            // Filter and map pages for tabs, applying adminOnly filter
            const tabsHtml = Object.values(pages || {})
                .filter(page => !(page.adminOnly && !isPrivilegedUser)) // Filter out adminOnly tabs for non-privileged users
                .map(page => {
                    const isActive = isTabActive(page.url);
                    const activeClass = isActive ? 'active' : '';
                    const adminClass = page.adminOnly ? 'admin-tab' : ''; // <--- PRESERVED: Apply admin-tab class
                    const iconClasses = getIconClass(page.icon);
                    
                    // PRESERVED: The admin badge (span) is removed, now styling is applied to the tab anchor tag itself
                    return `<a href="${page.url}" class="nav-tab ${activeClass} ${adminClass}"><i class="${iconClasses} mr-2"></i>${page.name}</a>`;
                }).join('');

            // --- Auth Views ---
            const loggedOutView = `
                <div class="relative flex-shrink-0">
                    <button id="auth-toggle" class="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-gray-700 transition logged-out-auth-toggle">
                        <i class="fa-solid fa-user"></i>
                    </button>
                    <div id="auth-menu-container" class="auth-menu-container closed">
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

                return `
                    <div class="relative flex-shrink-0">
                        <button id="auth-toggle" class="w-8 h-8 rounded-full border border-gray-600 overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500">
                            ${avatar}
                        </button>
                        <div id="auth-menu-container" class="auth-menu-container closed">
                            <div class="px-3 py-2 border-b border-gray-700 mb-2">
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
                            <button id="logout-button" class="auth-menu-button text-red-400 hover:bg-red-900/50 hover:text-red-300">
                                <i class="fa-solid fa-right-from-bracket w-4"></i>
                                Log Out
                            </button>
                        </div>
                    </div>
                `;
            };

            // --- Assemble Final Navbar HTML ---
            container.innerHTML = `
                <header class="auth-navbar">
                    <nav>
                        <a href="/" class="flex items-center space-x-2 flex-shrink-0" title="4SP Logo">
                            <div id="navbar-logo" class="h-8 w-24"></div>
                        </a>

                        <div class="tab-wrapper">
                            <button id="glide-left" class="scroll-glide-button"><i class="fa-solid fa-chevron-left"></i></button>

                            <div class="tab-scroll-container">
                                ${tabsHtml}
                            </div>
                            
                            <button id="glide-right" class="scroll-glide-button"><i class="fa-solid fa-chevron-right"></i></button>
                        </div>

                        ${user ? loggedInView(user, userData) : loggedOutView}
                    </nav>
                </header>
            `;
            
            // --- NEW: Apply theme again after render (from navigation-new.js) ---
            // This ensures the logo src is correct if it was just rendered.
            let savedTheme;
            try {
                savedTheme = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY));
            } catch (e) { savedTheme = null; }
            window.applyTheme(savedTheme || DEFAULT_THEME); 
            // --- End theme apply ---

            // --- 5. SETUP EVENT LISTENERS ---
            setupEventListeners(user);

            // PRESERVED: Auto-scroll to the active tab, centering it in the view.
            const activeTab = document.querySelector('.nav-tab.active');
            const tabContainer = document.querySelector('.tab-scroll-container');
            if (activeTab && tabContainer) {
                // Calculate the scroll position needed to center the active tab
                const centerOffset = (tabContainer.offsetWidth - activeTab.offsetWidth) / 2;
                let scrollTarget = activeTab.offsetLeft - centerOffset;
                
                // Clamp the scroll target to prevent scrolling beyond content
                const maxScroll = tabContainer.scrollWidth - tabContainer.offsetWidth;
                scrollTarget = Math.max(0, Math.min(scrollTarget, maxScroll));

                // Wait a brief moment to ensure the layout is settled before scrolling
                setTimeout(() => {
                    tabContainer.scrollLeft = scrollTarget;
                }, 100);
            }
            
            // Initial check to hide/show them correctly after load
            updateScrollGilders();
        };

        // PRESERVED: Original setupEventListeners from navigation.js
        const setupEventListeners = (user) => {
            const toggleButton = document.getElementById('auth-toggle');
            const menu = document.getElementById('auth-menu-container');

            // Scroll Glide Button setup
            const tabContainer = document.querySelector('.tab-scroll-container');
            const leftButton = document.getElementById('glide-left');
            const rightButton = document.getElementById('glide-right');

            const debouncedUpdateGilders = debounce(updateScrollGilders, 50);

            if (tabContainer) {
                const scrollAmount = tabContainer.offsetWidth * 0.8; 
                tabContainer.addEventListener('scroll', debouncedUpdateGilders);
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

            // Auth Toggle
            if (toggleButton && menu) {
                toggleButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    menu.classList.toggle('closed');
                    menu.classList.toggle('open');
                });
            }

            document.addEventListener('click', (e) => {
                // MODIFIED to check for `toggleButton.contains(e.target)` to support clicks on child <i>
                if (menu && menu.classList.contains('open') && !menu.contains(e.target) && (toggleButton && !toggleButton.contains(e.target))) {
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
        // PRESERVED: Original onAuthStateChanged from navigation.js
        auth.onAuthStateChanged(async (user) => {
            let isPrivilegedUser = false;
            
            if (user) {
                // Check for the privileged user email
                isPrivilegedUser = user.email === PRIVILEGED_EMAIL;

                // User is signed in. Fetch their data from Firestore.
                try {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    const userData = userDoc.exists ? userDoc.data() : null;
                    renderNavbar(user, userData, pages, isPrivilegedUser);
                } catch (error) {
                    console.error("Error fetching user data:", error);
                    renderNavbar(user, null, pages, isPrivilegedUser); // Render even if Firestore fails
                }
            } else {
                // User is signed out.
                renderNavbar(null, null, pages, false);
                
                // KICK USER TO INDEX: If the user is logged out, redirect them to ../../index.html
                const targetUrl = '../../index.html'; // <--- PRESERVED PATH
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
        // PRESERVED: Original setup
        // Create a div for the navbar to live in if it doesn't exist.
        // (This was moved to the top of initializeApp)
        
        // Inject styles before anything else is rendered for best stability
        // (This was moved to the top of initializeApp)
    };

    // --- START THE PROCESS ---
    document.addEventListener('DOMContentLoaded', run);

})();
