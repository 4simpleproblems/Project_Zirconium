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
 * 22. **(NEW)** LOGO TINT SUPPORT: Added logic to set/clear the `--logo-tint-color` CSS variable, allowing the logo to be tinted only when a value is present in the theme.
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
    // NEW: Added the logo tint color to the default. An empty string ensures no tint is applied by default.
    'logo-tint-color': '', 
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
window.applyTheme = (theme) => {
    const root = document.documentElement;
    if (!root) return;

    // Fallback to default theme if input is invalid
    const themeToApply = theme && typeof theme === 'object' ? theme : DEFAULT_THEME;

    // --- NEW: Explicitly handle and clear logo-tint-color ---
    const logoTintColor = themeToApply['logo-tint-color'];
    // If the value exists (like in "Matrix" theme), set it. If it's missing or falsy (like in "Dark" or "Light"), 
    // set the variable to an empty string to clear any previous tint value.
    root.style.setProperty('--logo-tint-color', logoTintColor || ''); 
    // --- END NEW: logo-tint-color handling ---

    // Set all other CSS variables
    for (const [key, value] of Object.entries(themeToApply)) {
        // Don't try to set 'name', 'logo-src', or the explicitly handled 'logo-tint-color' as a CSS variable
        if (key !== 'logo-src' && key !== 'name' && key !== 'logo-tint-color') {
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
let currentUser = null;
let currentUserData = null;
let currentIsPrivileged = false;
let pagesConfig = {};


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
        // --- CRITICAL FIX: Ensure CSS is injected first and listeners are set up
        injectStyles();
        document.addEventListener('click', handleGlobalClick);
        window.addEventListener('resize', debounce(updateGlideVisibility, 150));
        // --- END CRITICAL FIX

        let pages = {};

        // Load Icons CSS first
        await loadCSS("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css");
        
        // Fetch page configuration for the tabs
        try {
            const response = await fetch(PAGE_CONFIG_URL);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            pages = await response.json();
            pagesConfig = pages; // Save globally
            
        } catch (error) {
            console.error("Failed to load page identification config:", error);
            // If the configuration fails to load, use a minimal set of pages for stability
            pagesConfig = {
                'home': { name: "Home", url: "../index.html", icon: "fa-solid fa-house" },
            };
        }

        try {
            // ONLY load the stable Firebase Compat modules
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js");
            
            // Initialize Firebase and start the rendering/auth process
            initializeApp(pagesConfig);

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
            
            /* NEW: Logo Tinting CSS */
            #navbar-logo {
                /* Applies the color tint using a drop-shadow filter. An empty variable will result in no filter effect. */
                filter: drop-shadow(0 0 0 var(--logo-tint-color, transparent));
                transition: filter 0.3s ease; 
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

            /* Scrollable Tab Menu Styles */
            .tab-scroll-container { 
                -ms-overflow-style: none; /* IE and Edge */
                scrollbar-width: none; /* Firefox */
                scroll-behavior: smooth;
            }
            .tab-scroll-container::-webkit-scrollbar { display: none; }
            .tab-item { 
                color: var(--tab-text); 
                border-bottom: 2px solid transparent; 
                transition: color 0.2s, border-color 0.2s, background-color 0.3s ease;
            }
            .tab-item:hover { 
                color: var(--tab-hover-text); 
                border-color: var(--tab-hover-border);
                background-color: var(--tab-hover-bg);
            }
            .tab-item.active { 
                color: var(--tab-active-text); 
                border-color: var(--tab-active-border); 
                background-color: var(--tab-active-bg);
            }
            .tab-item.active:hover { 
                color: var(--tab-active-hover-text); 
                border-color: var(--tab-active-hover-border); 
                background-color: var(--tab-active-hover-bg);
            }
            
            /* Scroll Glide Buttons */
            .glide-btn { 
                height: 100%; width: 3rem; position: absolute; top: 0; 
                display: flex; align-items: center; cursor: pointer; opacity: 0; 
                color: var(--glide-icon-color);
                transition: opacity 0.3s, color 0.3s ease; z-index: 10; pointer-events: none;
            }
            .glide-btn.show { opacity: 1; pointer-events: auto; }
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

            /* Pin Button Styles */
            #pin-button {
                border: 1px solid var(--pin-btn-border);
                transition: background-color 0.2s ease, border-color 0.3s ease;
            }
            #pin-button:hover {
                background-color: var(--pin-btn-hover-bg);
            }
            #pin-button i {
                color: var(--pin-btn-icon-color);
                transition: color 0.3s ease;
            }
            
            /* Pin Menu Styles (Using glass styles for pin menu) */
            .pin-menu-container {
                background: var(--glass-menu-bg);
                border: 1px solid var(--glass-menu-border);
                transition: background-color 0.3s ease, border-color 0.3s ease; 
            }

            /* Hint Styles */
            .pin-hint {
                background-color: var(--hint-bg);
                border: 1px solid var(--hint-border);
                color: var(--hint-text);
                box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
            }
        `;
        document.head.appendChild(style);
    };

    // --- 4. FIREBASE INITIALIZATION AND AUTH/DB SETUP ---

    const initializeApp = (allPages) => {
        // Initialize the app with the config
        const app = firebase.initializeApp(FIREBASE_CONFIG);
        auth = firebase.auth();
        db = firebase.firestore();

        // Load the stored theme immediately before we start listening to auth
        loadAndApplySavedTheme();
        
        // --- 5. AUTH LISTENER & REDIRECT LOGIC ---
        let initialLoad = true;
        
        auth.onAuthStateChanged(async (user) => {
            let isPrivilegedUser = false;
            let userData = null;

            if (user) {
                isPrivilegedUser = user.email === PRIVILEGED_EMAIL;

                // Fetch user data from Firestore for display
                try {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    if (userDoc.exists) {
                        userData = userDoc.data();
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
            renderNavbar(currentUser, currentUserData, allPages, currentIsPrivileged, initialLoad);
            initialLoad = false; // Initial rendering done

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

    // --- 6. CORE RENDERING FUNCTION ---
    let scrollPosition = 0;
    let containerScrollRef = null; 

    // Function to handle the logo and tabs section rendering
    const renderTabs = (pages) => {
        const path = window.location.pathname;
        const logo = `<a href="../index.html" class="flex-shrink-0 mr-4">
            <img id="navbar-logo" class="h-8 w-auto" src="${DEFAULT_THEME['logo-src']}" alt="Logo">
        </a>`;

        const tabItems = Object.entries(pages).map(([key, page]) => {
            const isActive = isTabActive(page.url);
            const activeClass = isActive ? 'active' : '';
            return `<a href="${page.url}" 
                       data-tab-key="${key}"
                       class="tab-item flex-shrink-0 px-3 py-2 text-sm font-medium ${activeClass} transition-all duration-200">
                        <i class="${getIconClass(page.icon)} mr-2"></i>
                        <span>${page.name}</span>
                    </a>`;
        }).join('');

        const tabsHtml = `
            <div id="tabs-section" class="flex items-center h-full overflow-hidden">
                ${logo}
                <div class="relative flex-grow h-full">
                    <div id="tab-scroll-container" 
                         class="tab-scroll-container flex h-full items-center whitespace-nowrap overflow-x-auto scroll-behavior-smooth pr-6" 
                         onscroll="window.updateGlideVisibility()">
                        ${tabItems}
                    </div>
                    <div id="glide-left" class="glide-btn" onclick="window.scrollTabs('left')"><i class="fas fa-chevron-left text-xl"></i></div>
                    <div id="glide-right" class="glide-btn" onclick="window.scrollTabs('right')"><i class="fas fa-chevron-right text-xl"></i></div>
                </div>
            </div>
        `;
        return tabsHtml;
    };

    // Function to handle the authentication and pin section rendering
    const renderAuthControls = (user, userData, isPrivilegedUser, pinnedPageKey) => {
        const pinButton = renderPinButton(pinnedPageKey);
        const pinMenu = renderPinMenu(pinnedPageKey, user);

        let authIconHtml;
        let authMenuHtml;

        if (user) {
            const displayName = userData?.username || user.email.split('@')[0];
            const initial = displayName.charAt(0).toUpperCase();
            
            // Admin Status Badge (only for privileged user)
            const adminBadge = isPrivilegedUser 
                ? `<span class="bg-red-600 text-xs font-semibold px-2 py-0.5 rounded-full ml-2">Admin</span>` 
                : '';

            // Auth Icon (Initial Avatar)
            authIconHtml = `
                <button id="auth-toggle" class="h-10 w-10 rounded-full border-2 cursor-pointer transition-all duration-200 initial-avatar flex-shrink-0" data-menu-target="auth-menu">
                    <span class="text-lg">${initial}</span>
                </button>
            `;

            // Auth Dropdown Menu
            authMenuHtml = `
                <div id="auth-menu" class="auth-menu-container closed">
                    <div class="flex flex-col items-start px-4 py-2 border-b border-gray-700 mb-2">
                        <span class="text-sm font-medium auth-menu-username">${displayName}</span>
                        <div class="flex items-center text-xs text-gray-400">
                            ${user.email} ${adminBadge}
                        </div>
                    </div>
                    <a href="../settings.html" class="auth-menu-link">
                        <i class="fas fa-cog w-4"></i>
                        <span>Settings</span>
                    </a>
                    <button class="auth-menu-button" onclick="window.logout(event)">
                        <i class="fas fa-sign-out-alt w-4"></i>
                        <span>Sign Out</span>
                    </button>
                </div>
            `;
        } else {
            // Logged Out Icon
            authIconHtml = `
                <a href="../authentication.html" id="auth-toggle" class="h-10 w-10 rounded-full border-2 cursor-pointer flex-shrink-0 logged-out-auth-toggle flex items-center justify-center">
                    <i class="fas fa-user text-xl"></i>
                </a>
            `;
            authMenuHtml = ''; // No menu for logged-out users
        }

        return `
            <div id="auth-pin-controls" class="relative flex items-center h-full gap-2">
                ${pinButton}
                ${authIconHtml}
                ${authMenuHtml}
                ${pinMenu}
            </div>
        `;
    };

    // The main rendering function
    const renderNavbar = (user, userData, pages, isPrivilegedUser, initialLoad = false) => {
        // **The outer <div> for the navbar MUST be present in your HTML as <div id="auth-navbar"></div>**
        const navbar = document.getElementById('auth-navbar');
        if (!navbar) {
            console.error("Critical Error: The <div id='auth-navbar'> element is missing from the HTML page.");
            return;
        }

        // 1. Get pinned page key
        const pinnedPageKey = localStorage.getItem('pinned-page-key');

        // 2. Render all sections
        const tabsSectionHtml = renderTabs(pages);
        const authControlsHtml = renderAuthControls(user, userData, isPrivilegedUser, pinnedPageKey);
        
        // 3. Assemble full navbar HTML
        navbar.innerHTML = `
            <nav class="container mx-auto">
                ${tabsSectionHtml}
                ${authControlsHtml}
            </nav>
        `;

        // 4. Post-render logic
        const scrollContainer = document.getElementById('tab-scroll-container');
        if (scrollContainer) {
            containerScrollRef = scrollContainer; // Store reference
            
            // --- SCROLL PERSISTENCE ---
            if (scrollPosition > 0) {
                // Restore scroll position using requestAnimationFrame for smoother rendering
                requestAnimationFrame(() => {
                    scrollContainer.scrollLeft = scrollPosition;
                    updateGlideVisibility();
                });
            } else if (initialLoad) {
                // --- INITIAL SCROLL TO ACTIVE TAB ---
                const activeTab = scrollContainer.querySelector('.tab-item.active');
                if (activeTab) {
                    centerActiveTab(scrollContainer, activeTab);
                }
            }
            
            // Ensure glide visibility is correct after rendering
            updateGlideVisibility();

            // Attach scroll listener
            scrollContainer.onscroll = updateGlideVisibility;
        }

        // Hide hint after re-render if it was shown once
        if (localStorage.getItem('pin-hint-shown') === 'true') {
            const hint = document.getElementById('pin-hint');
            if (hint) hint.classList.add('hidden');
        }
    };
    
    // Renders only the authentication and pin controls area (for pin updates)
    window.partialRenderAuthControls = (user) => {
        // Save current scroll position before the update
        if (containerScrollRef) {
            scrollPosition = containerScrollRef.scrollLeft;
        }

        const authControlsContainer = document.getElementById('auth-pin-controls');
        if (!authControlsContainer || !pagesConfig) return;

        const pinnedPageKey = localStorage.getItem('pinned-page-key');
        const newAuthControlsHtml = renderAuthControls(user || currentUser, currentUserData, currentIsPrivileged, pinnedPageKey);
        
        // Use a temporary container to preserve the DOM structure before swap
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newAuthControlsHtml;
        const newContent = tempDiv.firstChild;

        // Replace the old container content with the new content
        authControlsContainer.innerHTML = newContent.innerHTML;

        // Restore scroll position after the update
        if (containerScrollRef) {
            requestAnimationFrame(() => {
                containerScrollRef.scrollLeft = scrollPosition;
                updateGlideVisibility();
            });
        }
    };


    // --- 7. UTILITY FUNCTIONS ---

    // Centers the active tab within the scroll container
    const centerActiveTab = (container, tabElement) => {
        if (!container || !tabElement) return;

        const containerWidth = container.clientWidth;
        const tabWidth = tabElement.offsetWidth;
        const tabLeft = tabElement.offsetLeft;

        // Calculate the scroll amount needed to center the tab
        const scrollAmount = tabLeft - (containerWidth / 2) + (tabWidth / 2);
        
        container.scrollLeft = scrollAmount;
    };

    // Handles tab scrolling via glide buttons
    window.scrollTabs = (direction) => {
        const container = document.getElementById('tab-scroll-container');
        if (!container) return;

        const scrollAmount = container.clientWidth * 0.4; // Scroll by 40% of the container width

        if (direction === 'left') {
            container.scrollLeft -= scrollAmount;
        } else if (direction === 'right') {
            container.scrollLeft += scrollAmount;
        }
    };

    // Updates visibility of the glide (scroll) buttons
    window.updateGlideVisibility = () => {
        const container = document.getElementById('tab-scroll-container');
        const glideLeft = document.getElementById('glide-left');
        const glideRight = document.getElementById('glide-right');

        if (!container || !glideLeft || !glideRight) return;

        const isScrollable = container.scrollWidth > container.clientWidth;
        
        if (!isScrollable) {
            glideLeft.classList.remove('show');
            glideRight.classList.remove('show');
            return;
        }

        const scrollLeft = container.scrollLeft;
        const maxScroll = container.scrollWidth - container.clientWidth;

        // Show left glide button if not at the far left
        if (scrollLeft > 5) {
            glideLeft.classList.add('show');
        } else {
            glideLeft.classList.remove('show');
        }

        // Show right glide button if not at the far right (with a small tolerance)
        if (scrollLeft < maxScroll - 5) {
            glideRight.classList.add('show');
        } else {
            glideRight.classList.remove('show');
        }
    };

    // Helper to load the theme saved in local storage
    const loadAndApplySavedTheme = async () => {
        // Fetch themes.json
        let themes = [];
        try {
            const response = await fetch('../themes.json');
            if (!response.ok) throw new Error("Failed to load themes.json");
            themes = await response.json();
        } catch (error) {
            console.error("Error loading themes list:", error);
            // Fallback: Use DEFAULT_THEME if themes list can't be loaded
            window.applyTheme(DEFAULT_THEME);
            return;
        }

        // Load saved theme name from Local Storage
        const savedThemeName = localStorage.getItem(THEME_STORAGE_KEY);
        
        // Find the saved theme object, or fall back to the first theme in the list (Dark)
        const themeToApply = themes.find(t => t.name === savedThemeName) || themes[0] || DEFAULT_THEME;

        window.applyTheme(themeToApply);
    };

    // Handles clicks outside the auth menu and pin menu to close them
    const handleGlobalClick = (event) => {
        // --- Auth Menu Logic ---
        const authMenu = document.getElementById('auth-menu');
        const authToggle = document.getElementById('auth-toggle');
        
        // Get fresh references for pin elements on every click
        const pinMenu = document.getElementById('pin-menu');
        const pinButton = document.getElementById('pin-button');

        // Close Auth Menu
        if (authMenu && authToggle) {
            const isAuthToggleClick = authToggle.contains(event.target);
            const isInsideAuthMenu = authMenu.contains(event.target);

            if (isAuthToggleClick) {
                authMenu.classList.toggle('closed');
                authMenu.classList.toggle('open');
            } else if (!isInsideAuthMenu) {
                authMenu.classList.remove('open');
                authMenu.classList.add('closed');
            }
        }

        // Close Pin Menu
        if (pinMenu && pinButton) {
            const isPinToggleClick = pinButton.contains(event.target);
            const isInsidePinMenu = pinMenu.contains(event.target);
            
            if (isPinToggleClick) {
                // Toggling Pin Menu Visibility
                pinMenu.classList.toggle('closed');
                pinMenu.classList.toggle('open');

                // --- PIN HINT LOGIC ---
                if (pinMenu.classList.contains('open') && localStorage.getItem('pin-hint-shown') !== 'true') {
                    const hint = document.getElementById('pin-hint');
                    if (hint) {
                        hint.classList.remove('hidden');
                        setTimeout(() => {
                            if (hint) hint.classList.add('opacity-0');
                        }, 2000); // Start fade out after 2 seconds
                        setTimeout(() => {
                            if (hint) hint.classList.add('hidden');
                            localStorage.setItem('pin-hint-shown', 'true');
                        }, 2500); // Hide completely after fade
                    }
                }
            } else if (!isInsidePinMenu) {
                pinMenu.classList.remove('open');
                pinMenu.classList.add('closed');
            }
        }
    };


    // --- 8. AUTH ACTIONS ---

    window.logout = async (e) => {
        e.preventDefault();
        try {
            await auth.signOut();
            console.log("User signed out successfully.");
            // onAuthStateChanged listener handles the re-render and redirect
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    // --- 9. PIN LOGIC ---
    
    // Renders the Pin button, which is always visible when authenticated
    const renderPinButton = (pinnedPageKey) => {
        if (!currentUser) return '';
        
        const pinIconClass = pinnedPageKey ? 'fas fa-thumbtack' : 'fas fa-thumbtack'; // Always solid now
        
        return `<button id="pin-button" class="h-10 w-10 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 flex-shrink-0" data-menu-target="pin-menu">
            <i class="${pinIconClass} text-lg"></i>
        </button>`;
    };
    
    // Renders the Pin menu dropdown
    const renderPinMenu = (pinnedPageKey, user) => {
        if (!user) return '';

        const currentPage = Object.entries(pagesConfig).find(([, page]) => isTabActive(page.url));
        const currentPageKey = currentPage ? currentPage[0] : null;

        let pinMenuItems = '';
        let hintHtml = '';
        
        if (pinnedPageKey && pagesConfig[pinnedPageKey]) {
            const pinnedPage = pagesConfig[pinnedPageKey];
            const isCurrentPagePinned = pinnedPageKey === currentPageKey;

            // 1. Pinned Page Link
            pinMenuItems += `
                <div class="flex flex-col items-start px-4 py-2 border-b border-gray-700 mb-2">
                    <span class="text-xs text-gray-400">Currently Pinned</span>
                    <a href="${pinnedPage.url}" class="auth-menu-link justify-start p-0">
                        <i class="${getIconClass(pinnedPage.icon)} w-4"></i>
                        <span class="text-base font-medium">${pinnedPage.name}</span>
                    </a>
                </div>
            `;
            
            // 2. Unpin Button
            pinMenuItems += `
                <button class="auth-menu-button ${isCurrentPagePinned ? 'hidden' : ''}" onclick="window.unpinPage()">
                    <i class="fas fa-times w-4"></i>
                    <span>Unpin Current</span>
                </button>
            `;

            // 3. Repin/Pin Current Button
            if (!isCurrentPagePinned) {
                pinMenuItems += `
                    <button class="auth-menu-button" onclick="window.pinCurrentPage()">
                        <i class="fas fa-thumbtack w-4"></i>
                        <span>Repin to Current Page</span>
                    </button>
                `;
            }

        } else if (currentPageKey) {
             // 1. Pin Current Page Button (if nothing is pinned)
            pinMenuItems += `
                <button class="auth-menu-button" onclick="window.pinCurrentPage()">
                    <i class="fas fa-thumbtack w-4"></i>
                    <span>Pin Current Page</span>
                </button>
            `;
        } else {
             // Message if no page is pinned and current page is not pin-able
             pinMenuItems += `
                <div class="flex flex-col items-center px-4 py-2">
                    <span class="text-sm font-medium text-gray-400">No Page Pinned</span>
                </div>
            `;
        }

        // Pin Hint (always render, hide with class)
        hintHtml = `
            <div id="pin-hint" class="pin-hint absolute -top-16 left-1/2 transform -translate-x-1/2 px-3 py-1 text-xs rounded-lg hidden opacity-100 transition-opacity duration-500 pointer-events-none whitespace-nowrap">
                <i class="fas fa-hand-point-up mr-1"></i> Quick page access!
            </div>
        `;

        return `
            <div id="pin-menu" class="pin-menu-container auth-menu-container closed left-auto right-0 top-12 backdrop-blur-sm">
                ${hintHtml}
                ${pinMenuItems}
            </div>
        `;
    };

    // Pins the current page
    window.pinCurrentPage = () => {
        const currentPage = Object.entries(pagesConfig).find(([, page]) => isTabActive(page.url));
        if (currentPage) {
            localStorage.setItem('pinned-page-key', currentPage[0]);
            window.partialRenderAuthControls(currentUser); // Partial re-render to update the menu
            document.getElementById('pin-menu')?.classList.remove('open');
            document.getElementById('pin-menu')?.classList.add('closed');
        } else {
            console.warn("Current page is not recognized or defined in page-identification.json.");
        }
    };
    
    // Unpins the current page
    window.unpinPage = () => {
        localStorage.removeItem('pinned-page-key');
        window.partialRenderAuthControls(currentUser); // Partial re-render to update the menu
        document.getElementById('pin-menu')?.classList.remove('open');
        document.getElementById('pin-menu')?.classList.add('closed');
    };


    // --- START THE PROCESS ---
    // Execute the 'run' function once the entire HTML document is loaded.
    document.addEventListener('DOMContentLoaded', run);

})();
