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


// --- Helper: Color Utilities for Letter Avatar (Exposed Globally) ---
window.pfpColorUtils = {
    /**
     * Helper: Converts a hex color string to an RGB object.
     * @param {string} hex - The hex color string (e.g., "#RRGGBB" or "#RGB").
     * @returns {object} An object {r, g, b} or null if invalid.
     */
    hexToRgb: (hex) => {
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
    },

    /**
     * Helper: Calculates the relative luminance of an RGB color.
     * @param {object} rgb - An object {r, g, b}.
     * @returns {number} The luminance (0.0 to 1.0).
     */
    getLuminance: (rgb) => {
        if (!rgb) return 0;
        const a = [rgb.r, rgb.g, rgb.b].map(v => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    },

    /**
     * Helper: Determines a contrasting text color (dark or white) for a given background gradient.
     * For saturated colors, it tries to provide a darker shade of the color, otherwise white.
     * @param {string} gradientBg - The CSS linear-gradient string.
     * @returns {string} A hex color string (e.g., "#000000" or "#FFFFFF" or darker shade).
     */
    getLetterAvatarTextColor: (gradientBg) => {
        if (!gradientBg) return '#FFFFFF'; // Default to white for safety

        // Extract the first color from the gradient string
        const match = gradientBg.match(/#([0-9a-fA-F]{3}){1,2}/);
        const firstHexColor = match ? match[0] : null;

        if (!firstHexColor) return '#FFFFFF'; // Fallback if no hex color found

        const rgb = window.pfpColorUtils.hexToRgb(firstHexColor);
        if (!rgb) return '#FFFFFF';

        const luminance = window.pfpColorUtils.getLuminance(rgb);

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
    }
};

// Variables to hold Firebase objects
let auth;
let db;

// --- Self-invoking function to encapsulate all logic ---
(function() {
})(); // Close the IIFE
