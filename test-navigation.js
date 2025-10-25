/**
 * navigation.js
 * * This is a fully self-contained script to create a dynamic, authentication-aware
 * navigation bar for your website. It handles everything from Firebase initialization
 * to rendering user-specific information.
 *
 * --- UPDATES & FEATURES ---
 * 1. FIX: Restored correct HTML structure and styling for the logged-in and logged-out menu buttons and dropdowns.
 * 2. TINTING FIX: Updated color logic to prevent tinting on backgrounds that are very close to pure white or pure black, 
 * ensuring the text/icons remain pure black/white for maximum contrast (e.g., pure white background gets pure black text).
 * 3. STYLE REMOVAL: The special gold styling for the 'Beta Settings' tab has been removed.
 * 4. DYNAMIC LOGO SWITCHING: Uses '/images/logo-dark.png' for light backgrounds (Luminance > 0.4) and '/images/logo.png' for dark backgrounds.
 * 5. TINTED LOGO: The logo is fully tinted to match the text/icon color using a CSS filter.
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
const PRIVILEGED_EMAIL = '4simpleproblems@gmail.com'; 
const NAVBAR_COLOR_KEY = '4sp_navbar_color';
const DEFAULT_NAVBAR_COLOR = '#000000'; // Default black

// Variables to hold Firebase objects
let auth;
let db;

// --- Global Variable for User Settings ---
let userSettings = {
    navbarColor: DEFAULT_NAVBAR_COLOR,
    textColor: 'white', // Final determined text color (tinted or pure)
    linkBaseColor: '#9ca3af' // Base color for non-active links
};

// --- HSL Utility Functions ---

/**
 * Converts Hex to HSL. Used for tint calculation.
 */
const hexToHsl = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // grayscale
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    // Return HSL as (0-360, 0-100, 0-100)
    return { h: h * 360, s: s * 100, l: l * 100 };
};

/**
 * Converts HSL (0-360, 0-100, 0-100) back to Hex.
 */
const hslToHex = (h, s, l) => {
    h = h < 0 ? h + 360 : h % 360;
    s = Math.max(0, Math.min(100, s)) / 100;
    l = Math.max(0, Math.min(100, l)) / 100;

    let r, g, b;

    if (s === 0) {
        r = g = b = l; // grayscale
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    const toHex = (c) => {
        const hex = Math.round(c * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// --- Luminance and Contrast Functions ---

/**
 * Calculates the perceived luminance of a hex color (0 to 1).
 */
const getLuminance = (hex) => {
    // Standard WCAG luminance calculation
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    const [R, G, B] = [r, g, b].map(c => {
        c /= 255;
        // Gamma correction
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};

/**
 * Determines the final, possibly tinted, color for text/icons based on a three-tier luminance system.
 * * * Logic:
 * L > 0.9 (Near White) OR (L > 0.5 AND S < 15) -> Pure Black (#000000)
 * L < 0.1 (Near Black) OR (L <= 0.5 AND S < 15) -> Pure White (#FFFFFF)
 * 0.5 < L <= 0.9 (Light) -> Very Dark Tinted Text (L: 5)
 * 0.2 < L <= 0.5 (Mid-Dark) -> Dark Tinted Text (L: 15)
 * L <= 0.2 (Very Dark) -> Very Light Tinted Text (L: 95)
 * * * @param {string} bgColor - The background hex color.
 * @returns {string} The final hex color for the text/icons.
 */
const getTintedContrastColor = (bgColor) => {
    const luminance = getLuminance(bgColor);
    const { h, s } = hexToHsl(bgColor);
    
    // --- ACHROMATIC COLOR CHECK (Pure Black/White Requirement) ---
    // If the color is very close to white (L > 0.9) OR light/mid-range but low saturation (S < 15), force black text.
    if (luminance > 0.9 || (luminance > 0.5 && s < 15)) { 
        return '#000000'; 
    }
    
    // If the color is very close to black (L < 0.1) OR mid-dark but low saturation (S < 15), force white text.
    if (luminance < 0.1 || (luminance <= 0.5 && s < 15)) {
        return '#FFFFFF';
    }

    // --- TINT APPLICATION (Saturated Colors) ---
    // Use a moderate saturation (20-30) for a visible but subtle tint
    const tintSaturation = 25;

    const isVeryDarkBg = luminance <= 0.2; 
    const isMidDarkBg = luminance > 0.2 && luminance <= 0.5;
    const isLightBg = luminance > 0.5;
    
    if (isVeryDarkBg) {
        // Very Dark Background (L <= 0.2): Use very bright text
        return hslToHex(h, tintSaturation, 95); 
    } else if (isMidDarkBg) {
        // Mid-Dark Background (0.2 < L <= 0.5): Use dark text
        return hslToHex(h, tintSaturation, 15); 
    } else if (isLightBg) {
        // Light Background (L > 0.5): Use very dark text
        return hslToHex(h, tintSaturation, 5); 
    }

    // Fallback (should not be reached)
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
};

/**
 * Applies the given color to the CSS variables and updates global settings.
 */
const applyNavbarColor = (color) => {
    if (!/^#[0-9A-F]{6}$/i.test(color)) {
        color = DEFAULT_NAVBAR_COLOR;
    }
    
    const finalTextColor = getTintedContrastColor(color);
    const luminance = getLuminance(color);
    const textHsl = hexToHsl(finalTextColor);
    
    // Determine if the text color is black or white for link color calculation
    const isDarkText = getLuminance(finalTextColor) < 0.5;

    // Calculate a muted, less saturated link base color for non-active tabs.
    let linkBaseColor;
    if (isDarkText) {
        // If text is dark, use a muted gray (L: 45) slightly tinted
        linkBaseColor = hslToHex(textHsl.h, 15, 45); 
    } else {
        // If text is light, use a muted light gray (L: 75) slightly tinted
        linkBaseColor = hslToHex(textHsl.h, 10, 75); 
    }
    
    // Set global settings and CSS variables
    userSettings.navbarColor = color;
    userSettings.textColor = finalTextColor;
    userSettings.linkBaseColor = linkBaseColor;

    document.documentElement.style.setProperty('--navbar-color', color);
    document.documentElement.style.setProperty('--navbar-text-color', finalTextColor);
    document.documentElement.style.setProperty('--navbar-link-base-color', linkBaseColor);

    // Fixed colors used in the dropdown menu for links that don't need tinting
    document.documentElement.style.setProperty('--navbar-text-color-dark', '#374151'); 
    document.documentElement.style.setProperty('--navbar-text-color-light', '#d1d5db'); 
};

/**
 * Loads the navbar color from Local Storage and applies it.
 */
const loadLocalNavbarColor = () => {
    try {
        // Use a color saved in local storage, or the default black if none is found.
        const localColor = localStorage.getItem(NAVBAR_COLOR_KEY);
        const finalColor = localColor && /^#[0-9A-F]{6}$/i.test(localColor) ? localColor : DEFAULT_NAVBAR_COLOR;
        applyNavbarColor(finalColor);
    } catch (e) {
        console.error("Could not read from Local Storage, applying default:", e);
        applyNavbarColor(DEFAULT_NAVBAR_COLOR);
    }
};

// --- Core Logic Wrapped for Refreshability ---

/**
 * Handles cleanup of old elements before re-running the script.
 */
const reinitializeNavigation = () => {
    const navbarContainer = document.getElementById('navbar-container');
    if (navbarContainer) {
        // Remove the existing navbar and all its children (and thus, event listeners)
        navbarContainer.remove();
    }
    const dynamicStyles = document.getElementById('navbar-dynamic-styles');
    if (dynamicStyles) {
        dynamicStyles.remove();
    }
};

/**
 * Main bootstrap function containing all application logic.
 */
const startNavigationBootstrap = () => {
    
    // ⭐️ Step 1: Immediate cleanup before starting to prevent duplicates.
    reinitializeNavigation();

    // ⭐️ Step 2: Load the color from Local Storage IMMEDIATELY and set CSS variables
    loadLocalNavbarColor(); 
    
    if (!FIREBASE_CONFIG || !FIREBASE_CONFIG.apiKey) {
        console.error("Firebase configuration is missing! Please paste your config into navigation.js.");
        return;
    }

    // --- 3. DYNAMICALLY INJECT STYLES ---

    /**
     * Injects the dynamic CSS styles using the currently set global color variables.
     */
    const injectStyles = () => {
        const navbarColor = userSettings.navbarColor; 
        const isLightBg = getLuminance(navbarColor) > 0.4;
        
        // Dynamic fade effect colors: use the navbar color for the gradient background
        const fadeLeft = `linear-gradient(to right, var(--navbar-color) 50%, transparent)`;
        const fadeRight = `linear-gradient(to left, var(--navbar-color) 50%, transparent)`;
        
        const style = document.createElement('style');
        style.id = 'navbar-dynamic-styles';
        
        style.textContent = `
            /* Base Styles */
            body { padding-top: 4rem; }
            .auth-navbar { 
                position: fixed; top: 0; left: 0; right: 0; z-index: 1000; 
                background: var(--navbar-color); 
                /* Text color is the fully tinted color */
                color: var(--navbar-text-color); 
                /* Border color based on contrast */
                border-bottom: 1px solid ${isLightBg ? '#dddddd' : 'rgb(31 41 55)'}; 
                height: 4rem; 
            }
            .auth-navbar nav { padding: 0 1rem; height: 100%; display: flex; align-items: center; justify-content: space-between; gap: 1rem; position: relative; }
            .initial-avatar { 
                background: var(--navbar-color); 
                border: 1px solid var(--navbar-text-color);
                font-family: sans-serif; text-transform: uppercase; display: flex; align-items: center; justify-content: center; 
                /* Text color of initial must be the fully tinted color */
                color: var(--navbar-text-color); 
            }
            
            /* Dynamic Logo Tinting */
            .navbar-logo {
                height: 2rem;
                /* Apply the text color tint to the logo image. This requires the logo to be monochromatic (white/light on transparent). */
                filter: drop-shadow(0 0 0 var(--navbar-text-color));
            }
            
            /* Auth Dropdown Menu Container (Fixing the menu) */
            .auth-menu-container { 
                position: absolute; right: 0; top: 50px; width: 16rem; 
                background: var(--navbar-color);
                border: 1px solid ${isLightBg ? '#bbbbbb' : 'rgb(55 65 81)'}; 
                border-radius: 0.75rem; padding: 0.5rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -2px rgba(0,0,0,0.2); 
                transition: transform 0.2s ease-out, opacity 0.2s ease-out; transform-origin: top right; 
                z-index: 999; /* Ensure menu is on top of everything but the navbar itself */
            }
            .auth-menu-container.closed { opacity: 0; pointer-events: none; transform: translateY(-10px) scale(0.95); }
            
            /* User Info Header in Dropdown */
            .user-info-header {
                 border-bottom: 1px solid ${isLightBg ? '#e5e7eb' : '#374151'}; 
                 margin-bottom: 0.5rem;
                 padding: 0.5rem 0.75rem;
            }
            .user-info-header p {
                 color: ${isLightBg ? 'var(--navbar-text-color-dark)' : 'var(--navbar-text-color-light)'};
            }

            /* Dropdown Links and Buttons */
            .auth-menu-link, .auth-menu-button { 
                /* Link color uses a fixed dark/light gray for contrast in the dropdown */
                color: ${isLightBg ? 'var(--navbar-text-color-dark)' : 'var(--navbar-text-color-light)'}; 
                display: flex; align-items: center; gap: 0.75rem; width: 100%; text-align: left; 
                padding: 0.5rem 0.75rem; font-size: 0.875rem; 
                border-radius: 0.375rem; transition: background-color 0.2s, color 0.2s; border: none; cursor: pointer;
            }
            .auth-menu-link:hover, .auth-menu-button:hover { 
                /* Hover color is the fully tinted color (high contrast) */
                color: var(--navbar-text-color); 
                background-color: ${isLightBg ? '#f3f4f6' : 'rgb(55 65 81)'}; 
            }
            
            /* Logged out button styling */
            .logged-out-auth-toggle { 
                /* Use the calculated background/text color for the button */
                background: var(--navbar-color); 
                border: 1px solid var(--navbar-text-color); 
            }
            .logged-out-auth-toggle i { 
                /* Icon color is the fully tinted color */
                color: var(--navbar-text-color); 
            }

            /* Tab Wrapper and Glide Buttons */
            .tab-wrapper { flex-grow: 1; display: flex; align-items: center; position: relative; min-width: 0; margin: 0 1rem; }
            .tab-scroll-container { flex-grow: 1; display: flex; align-items: center; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; -ms-overflow-style: none; padding-bottom: 5px; margin-bottom: -5px; scroll-behavior: smooth; }
            .tab-scroll-container::-webkit-scrollbar { display: none; }
            .scroll-glide-button {
                position: absolute; top: 0; height: 100%; width: 4rem; display: flex; align-items: center; justify-content: center; 
                background: var(--navbar-color); 
                /* Icon color is the fully tinted color */
                color: var(--navbar-text-color); 
                font-size: 1.2rem; cursor: pointer; 
                opacity: 1; transition: opacity 0.3s, background 0.3s; z-index: 10; pointer-events: auto;
            }
            /* Dynamic fade effect using the navbar color */
            #glide-left { left: 0; background: ${fadeLeft}; justify-content: flex-start; padding-left: 0.5rem; }
            #glide-right { right: 0; background: ${fadeRight}; justify-content: flex-end; padding-right: 0.5rem; }
            .scroll-glide-button.hidden { opacity: 0 !important; pointer-events: none !important; }
            
            /* Tab Links - Default state */
            .nav-tab { 
                flex-shrink: 0; padding: 0.5rem 1rem; 
                /* Base link color is the MUTED tinted color */
                color: var(--navbar-link-base-color); 
                font-size: 0.875rem; font-weight: 500; border-radius: 0.5rem; 
                transition: all 0.2s; text-decoration: none; line-height: 1.5; 
                display: flex; align-items: center; margin-right: 0.5rem; border: 1px solid transparent; 
            }
            /* Tab Hover state */
            .nav-tab:not(.active):hover { 
                /* Hover color is the fully tinted color */
                color: var(--navbar-text-color); 
                border-color: ${isLightBg ? '#9ca3af' : '#d1d5db'}; 
                background-color: ${isLightBg ? 'rgba(0,0,0,0.05)' : 'rgba(79, 70, 229, 0.05)'}; 
            }
            /* Tab Active state (uses fixed blue for consistency) */
            .nav-tab.active { color: #4f46e5; border-color: #4f46e5; background-color: rgba(79, 70, 229, 0.1); }
            .nav-tab.active:hover { color: #6366f1; border-color: #6366f1; background-color: rgba(79, 70, 229, 0.15); }
        `;
        document.head.appendChild(style);
    };

    // ⭐️ Step 4: Inject styles immediately after color load.
    injectStyles();


    // --- 4. DYNAMICALLY LOAD EXTERNAL ASSETS (Helper functions) ---

    const loadScript = (src) => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    };

    const loadCSS = (href) => {
        return new Promise((resolve) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = resolve;
            document.head.appendChild(link);
        });
    };

    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    };
    
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

    // --- Main run sequence ---
    const run = async () => {
        let pages = {};

        await loadCSS("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css");
        
        // Fetch page config for tabs
        try {
            const response = await fetch(PAGE_CONFIG_URL);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            pages = await response.json();
            
            // Re-adding the beta settings page with no special styling
            pages['beta-settings'] = { 
                name: "Beta Settings", 
                url: "../logged-in/beta-settings.html", 
                icon: "fa-solid fa-flask", 
                adminOnly: true 
            };
            
        } catch (error) {
            console.error("Failed to load page identification config:", error);
            pages = {
                'home': { name: "Home", url: "../../index.html", icon: "fa-solid fa-house" },
                'admin': { name: "Beta Settings", url: "../logged-in/beta-settings.html", icon: "fa-solid fa-flask", adminOnly: true } 
            };
        }

        try {
            // Load Firebase
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js");
            
            initializeApp(pages);

        } catch (error) {
            console.error("Failed to load core Firebase SDKs:", error);
        }
    };

    // --- 5. INITIALIZE FIREBASE AND RENDER NAVBAR ---
    const initializeApp = (pages) => {
        const app = firebase.initializeApp(FIREBASE_CONFIG);
        auth = firebase.auth();
        db = firebase.firestore();

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

        const updateScrollGilders = () => {
            const container = document.querySelector('.tab-scroll-container');
            const leftButton = document.getElementById('glide-left');
            const rightButton = document.getElementById('glide-right');

            if (!container || !leftButton || !rightButton) return;
            
            const hasHorizontalOverflow = container.scrollWidth > container.offsetWidth;

            if (hasHorizontalOverflow) {
                const isScrolledToLeft = container.scrollLeft < 5; 
                const isScrolledToRight = container.scrollLeft + container.offsetWidth >= container.scrollWidth - 5; 

                leftButton.classList.remove('hidden');
                rightButton.classList.remove('hidden');

                if (isScrolledToLeft) {
                    leftButton.classList.add('hidden');
                }
                if (isScrolledToRight) {
                    rightButton.classList.add('hidden');
                }
            } else {
                leftButton.classList.add('hidden');
                rightButton.classList.add('hidden');
            }
        };

        // --- 6. RENDER THE NAVBAR HTML ---
        const renderNavbar = (user, userData, pages, isPrivilegedUser) => {
            const container = document.getElementById('navbar-container');
            if (!container) return; 
            
            // Re-inject styles here to catch potential live updates from the settings page
            injectStyles();
            
            const navbarColor = userSettings.navbarColor; 
            const isLightBg = getLuminance(navbarColor) > 0.4;

            // Determine the logo based on background luminance
            const logoPath = isLightBg ? "/images/logo-dark.png" : "/images/logo.png";
            
            const tabsHtml = Object.values(pages || {})
                .filter(page => !(page.adminOnly && !isPrivilegedUser))
                .map(page => {
                    const isActive = isTabActive(page.url);
                    const activeClass = isActive ? 'active' : '';
                    // Removed admin-tab class and logic
                    const iconClasses = getIconClass(page.icon);
                    
                    return `<a href="${page.url}" class="nav-tab ${activeClass}"><i class="${iconClasses} mr-2"></i>${page.name}</a>`;
                }).join('');

            // --- Auth Views (loggedInView and loggedOutView definitions) ---
            const loggedOutView = `
                <div class="relative flex-shrink-0">
                    <button id="auth-toggle" class="w-10 h-10 rounded-full border border-gray-600 flex items-center justify-center hover:bg-gray-700 transition logged-out-auth-toggle">
                        <i class="fa-solid fa-user text-xl"></i>
                    </button>
                    <div id="auth-menu-container" class="auth-menu-container closed">
                        <a href="/authentication.html" class="auth-menu-link">
                            <i class="fa-solid fa-right-to-bracket w-5"></i>
                            Log In / Sign Up
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
                    `<div class="initial-avatar w-10 h-10 rounded-full text-lg font-semibold">${initial}</div>`; // Increased size for better touch target

                return `
                    <div class="relative flex-shrink-0">
                        <button id="auth-toggle" class="w-10 h-10 rounded-full border ${isLightBg ? 'border-gray-400' : 'border-gray-600'} overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2 ${isLightBg ? 'focus:ring-offset-white focus:ring-blue-500' : 'focus:ring-offset-gray-900 focus:ring-blue-500'}">
                            ${avatar}
                        </button>
                        
                        <div id="auth-menu-container" class="auth-menu-container closed">
                            <!-- User Info Header -->
                            <div class="user-info-header">
                                <p class="text-sm font-semibold truncate">${username}</p>
                                <p class="text-xs truncate">${email}</p>
                            </div>

                            <a href="/logged-in/dashboard.html" class="auth-menu-link">
                                <i class="fa-solid fa-house-user w-5"></i>
                                Dashboard
                            </a>
                            <a href="/logged-in/settings.html" class="auth-menu-link">
                                <i class="fa-solid fa-gear w-5"></i>
                                Settings
                            </a>
                            <button id="logout-button" class="auth-menu-button ${isLightBg ? 'text-red-600 hover:bg-red-50' : 'text-red-400 hover:bg-red-900/50 hover:text-red-300'}">
                                <i class="fa-solid fa-right-from-bracket w-5"></i>
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
                        <a href="/" class="flex items-center space-x-2 flex-shrink-0">
                            <img src="${logoPath}" alt="4SP Logo" class="navbar-logo">
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

            // --- 7. SETUP EVENT LISTENERS ---
            setupEventListeners(user);

            // Auto-scroll to active tab
            const activeTab = document.querySelector('.nav-tab.active');
            const tabContainer = document.querySelector('.tab-scroll-container');
            if (activeTab && tabContainer) {
                const centerOffset = (tabContainer.offsetWidth - activeTab.offsetWidth) / 2;
                let scrollTarget = activeTab.offsetLeft - centerOffset;
                const maxScroll = tabContainer.scrollWidth - tabContainer.offsetWidth;
                scrollTarget = Math.max(0, Math.min(scrollTarget, maxScroll));

                setTimeout(() => {
                    tabContainer.scrollLeft = scrollTarget;
                }, 100);
            }
            
            updateScrollGilders();
        };

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
                if (menu && menu.classList.contains('open') && !menu.contains(e.target) && e.target !== toggleButton) {
                    menu.classList.add('closed');
                    menu.classList.remove('open');
                }
            });

            if (user) {
                const logoutButton = document.getElementById('logout-button');
                if (logoutButton) {
                    logoutButton.addEventListener('click', () => {
                        // Clear local color on logout
                        try {
                            localStorage.removeItem(NAVBAR_COLOR_KEY);
                        } catch (e) {
                            console.error("Could not remove item from Local Storage:", e);
                        }
                        auth.signOut().catch(err => console.error("Logout failed:", err));
                    });
                }
            }
        };


        // --- 8. AUTH STATE LISTENER ---
        auth.onAuthStateChanged(async (user) => {
            let isPrivilegedUser = false;
            
            // Re-apply the locally saved color (or default) inside the listener
            // to ensure the latest setting is used when state changes.
            loadLocalNavbarColor();

            if (user) {
                isPrivilegedUser = user.email === PRIVILEGED_EMAIL;
                
                let userData = null;
                try {
                    // Fetch user data for the dropdown (username/photo)
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    userData = userDoc.exists ? userDoc.data() : null;
                } catch (error) {
                    console.error("Error fetching user data for dropdown:", error);
                }
                
                // Re-render the navbar with authenticated data
                renderNavbar(user, userData, pages, isPrivilegedUser);
                
            } else {
                // User is signed out.
                renderNavbar(null, null, pages, false);
                
                // KICK USER TO INDEX: 
                const targetUrl = '../../index.html';
                const currentPathname = window.location.pathname;
                
                const isEntryPoint = currentPathname.includes('index.html') || currentPathname.includes('authentication.html') || currentPathname === '/';
                
                if (!isEntryPoint) {
                    console.log(`User logged out. Restricting access and redirecting to ${targetUrl}`);
                    window.location.href = targetUrl;
                }
            }
        });

        // --- 9. FINAL DOM SETUP ---
        if (!document.getElementById('navbar-container')) {
            const navbarDiv = document.createElement('div');
            navbarDiv.id = 'navbar-container';
            document.body.prepend(navbarDiv);
        }
    };

    // --- START THE PROCESS ---
    document.addEventListener('DOMContentLoaded', run);

}; // End of startNavigationBootstrap

// Call the bootstrap function to start the application.
// This is the entry point for both initial load and automatic refreshes.
startNavigationBootstrap();
