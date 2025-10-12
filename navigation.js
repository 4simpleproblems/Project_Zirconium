/**
 * navigation.js
 * * This is a fully self-contained script to create a dynamic, authentication-aware
 * navigation bar for your website. It handles everything from Firebase initialization
 * to rendering user-specific information. It now includes a horizontally scrollable
 * tab menu loaded from page-identification.json.
 *
 * --- FIXES / UPDATES ---
 * 1. USER REQUEST: Replaced Login/Signup links with a single "Authenticate" link pointing to /authentication.html.
 * 2. USER REQUEST: Updated logged-out button background to #010101 and icon color to #DADADA, using 'fa-solid fa-user'. (As per navigation-mini.js)
 * 3. Dashboard Icon Updated: Changed Dashboard icon from 'fa-chart-line' to 'fa-house-user'. (Original fix retained)
 * 4. Glide Button Style: Removed border-radius and adjusted gradients for full opacity at the edge. (Original fix retained)
 * 5. NEW FEATURE: Integrated exclusive AI Agent Chat Modal, accessible only by '4simpleproblems@gmail.com'
 * and activated via Control + A (when no text input is focused). Uses Gemini API logic.
 *
 * --- INSTRUCTIONS ---
 * 1. ACTION REQUIRED: Paste your own Firebase project configuration into the `FIREBASE_CONFIG` object below.
 * 2. Place this script in the root directory of your website.
 * 3. Add `<script src="/navigation.js" defer></script>` to the <head> of any HTML file where you want the navbar.
 * 4. Ensure your file paths for images and links are root-relative (e.g., "/images/logo.png", "/login.html").
 * * --- HOW IT WORKS ---
 * - It runs automatically once the HTML document is loaded.
 * - It injects its own CSS for styling the navbar, dropdown menu, and the new tab bar.
 * - It fetches the page configuration JSON to build the scrollable navigation tabs.
 * - It creates a placeholder div and then renders the navbar inside it.
 * - It initializes Firebase, listens for auth state, and fetches user data.
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

// --- Configuration for the navigation tabs ---
const PAGE_CONFIG_URL = '../page-identification.json';
// --- Exclusive AI Agent Configuration ---
const EXCLUSIVE_AI_USER_EMAIL = '4simpleproblems@gmail.com';
const GEMINI_API_KEY = ""; // Use the provided canvas API key placeholder.

const AI_AGENT_CATEGORIES = [
    { name: 'Quick', icon: 'fa-gauge-high', instruction: 'Act as a swift and concise assistant. Your goal is to provide the shortest, most direct answer possible. Never elaborate or use lists.' },
    { name: 'Standard', icon: 'fa-robot', instruction: 'Act as a professional and balanced general-purpose assistant. Respond clearly and provide relevant details where necessary.' },
    { name: 'Deep Thinking', icon: 'fa-brain', instruction: 'Act as a meticulous researcher. Before answering, consider all aspects of the query, verify details, and provide a well-structured, thoroughly researched, and correct response. Use the provided context to inform your answer.' },
    { name: 'Creative Muse', icon: 'fa-lightbulb', instruction: 'Act as an imaginative and inspiring writer. Focus on generating ideas, stories, poems, or creative marketing copy. Prioritize originality and style.' },
    { name: 'Technical Dev', icon: 'fa-code', instruction: 'Act as an expert software developer. Provide solutions with clean, modern code, explain algorithms, and focus on technical accuracy and best practices. Respond in markdown code blocks when applicable.' },
    { name: 'Historical Expert', icon: 'fa-landmark', instruction: 'Act as a professional historian. Ground all answers in historical fact, providing dates, names, and context. Maintain a formal academic tone.' },
    { name: 'Casual Friend', icon: 'fa-face-smile', instruction: 'Act as a relaxed, friendly, and conversational peer. Use emojis and informal language, keeping the chat light and engaging.' },
    { name: 'Critical Reviewer', icon: 'fa-clipboard-check', instruction: 'Act as a demanding editor or critic. Analyze the user\'s input for flaws, suggest improvements, and provide constructive, critical feedback.' }
];

// Variables to hold Firebase objects, which must be globally accessible after loading scripts
let auth;
let db;

// --- Self-invoking function to encapsulate all logic ---
(function() {
    // Stop execution if Firebase config is not provided
    if (!FIREBASE_CONFIG || !FIREBASE_CONFIG.apiKey) {
        console.error("Firebase configuration is missing! Please paste your config into navigation.js.");
        return;
    }

    // --- 1. DYNAMICALLY LOAD EXTERNAL ASSETS (Optimized) ---

    // Helper to load external JS files
    const loadScript = (src) => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            // Removed type='module' to match navigation-mini.js style for compat libraries,
            // though the original navigation.js used it. Keeping it as is to not break module usage.
            script.type = 'module'; 
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    };

    // Helper to load external CSS files (Faster for icons)
    const loadCSS = (href) => {
        return new Promise((resolve) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            // Resolve immediately and proceed, as icons are non-critical path for the script logic
            link.onload = resolve;
            link.onerror = resolve;
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

    /**
     * **UPDATED UTILITY FUNCTION: Bulletproof Fix for Font Awesome 7.x icon loading for JSON.**
     * Ensures both the style prefix (e.g., 'fa-solid') and the icon name prefix (e.g., 'fa-house-user') are present.
     * @param {string} iconName The icon class name from page-identification.json (e.g., 'fa-house-user' or just 'house-user').
     * @returns {string} The complete, correctly prefixed Font Awesome class string (e.g., 'fa-solid fa-house-user').
     */
    const getIconClass = (iconName) => {
        if (!iconName) return '';

        const nameParts = iconName.trim().split(/\s+/).filter(p => p.length > 0);
        let stylePrefix = 'fa-solid'; // Default style
        let baseName = '';
        const stylePrefixes = ['fa-solid', 'fa-regular', 'fa-light', 'fa-thin', 'fa-brands'];

        // 1. Identify and extract the style prefix (if present)
        const existingPrefix = nameParts.find(p => stylePrefixes.includes(p));
        if (existingPrefix) {
            stylePrefix = existingPrefix;
        }

        // 2. Identify and sanitize the icon name
        const nameCandidate = nameParts.find(p => p.startsWith('fa-') && !stylePrefixes.includes(p));

        if (nameCandidate) {
            // Case: Input is 'fa-volume-up' (or 'fa-solid fa-volume-up')
            baseName = nameCandidate;
        } else {
            // Case: Input is 'volume-up' (less likely but covered) or missing 'fa-'
            // We assume the non-style part is the base name and ensure it has the 'fa-' prefix.
            baseName = nameParts.find(p => !stylePrefixes.includes(p));
            if (baseName && !baseName.startsWith('fa-')) {
                 baseName = `fa-${baseName}`;
            }
        }

        // If after all checks we have a baseName, ensure it's not a duplicate class.
        if (baseName) {
            // Return the necessary style prefix and the icon name.
            return `${stylePrefix} ${baseName}`;
        }
        
        // Fallback for completely invalid/empty input
        return '';
    };

    const run = async () => {
        let pages = {};

        // Load Icons CSS first for immediate visual display
        await loadCSS("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css");

        // Fetch page configuration for the tabs
        try {
            const response = await fetch(PAGE_CONFIG_URL);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            pages = await response.json();
            console.log("Page configuration loaded successfully.");
        } catch (error) {
            console.error("Failed to load page identification config:", error);
            // Continue execution even if pages fail to load, just without tabs
        }

        try {
            // Sequentially load Firebase modules (compat versions for simplicity).
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js");

            // Now that scripts are loaded, we can use the `firebase` global object
            initializeApp(pages);
        } catch (error) {
            console.error("Failed to load necessary SDKs:", error);
        }
    };

    // --- 2. INITIALIZE FIREBASE AND RENDER NAVBAR ---
    const initializeApp = (pages) => {
        // Initialize Firebase with the compat libraries
        const app = firebase.initializeApp(FIREBASE_CONFIG);
        // Assign auth and db to module-scope variables
        auth = firebase.auth();
        db = firebase.firestore();

        // --- 3. INJECT CSS STYLES (UPDATED with AI Agent styles) ---
        const injectStyles = () => {
            const style = document.createElement('style');
            style.textContent = `
                /* Base Styles */
                body { padding-top: 4rem; /* 64px, equal to navbar height */ }
                /* Nav bar is now fully opaque (#000000 - pure black) */
                .auth-navbar { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; background: #000000; border-bottom: 1px solid rgb(31 41 55); height: 4rem; }
                /* Nav now needs relative positioning for glide buttons */
                .auth-navbar nav { max-width: 80rem; margin: auto; padding: 0 1rem; height: 100%; display: flex; align-items: center; justify-content: space-between; gap: 1rem; position: relative; }
                .initial-avatar { background: linear-gradient(135deg, #374151 0%, #111827 100%); font-family: 'Geist', sans-serif; text-transform: uppercase; display: flex; align-items: center; justify-content: center; color: white; }
                
                /* Auth Dropdown Menu Styles (UPDATED: Pure Black background) */
                .auth-menu-container { 
                    position: absolute; right: 0; top: 50px; width: 16rem; 
                    background: #000000; /* Pure black */
                    backdrop-filter: none; /* Removed backdrop filter for pure black */
                    -webkit-backdrop-filter: none;
                    border: 1px solid rgb(55 65 81); border-radius: 0.75rem; padding: 0.5rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -2px rgba(0,0,0,0.2); 
                    transition: transform 0.2s ease-out, opacity 0.2s ease-out; transform-origin: top right; 
                }
                .auth-menu-container.open { opacity: 1; transform: translateY(0) scale(1); }
                .auth-menu-container.closed { opacity: 0; pointer-events: none; transform: translateY(-10px) scale(0.95); }
                /* ADDED: flex and gap for icon alignment */
                .auth-menu-link, .auth-menu-button { 
                    display: flex; /* Changed from block to flex */
                    align-items: center; /* Vertically align icon and text */
                    gap: 0.75rem; /* Space between icon and text */
                    width: 100%; 
                    text-align: left; 
                    padding: 0.5rem 0.75rem; 
                    font-size: 0.875rem; 
                    color: #d1d5db; 
                    border-radius: 0.375rem; 
                    transition: background-color 0.2s, color 0.2s; 
                    /* Ensure buttons look like links */
                    border: none;
                    cursor: pointer;
                }
                .auth-menu-link:hover, .auth-menu-button:hover { background-color: rgb(55 65 81); color: white; }

                /* NEW: Custom style for the logged out button's icon and background (from navigation-mini.js) */
                .logged-out-auth-toggle {
                    background: #010101; /* Requested dark background */
                    border: 1px solid #374151; /* Keep a subtle border */
                }
                .logged-out-auth-toggle i {
                    color: #DADADA; /* Requested icon color */
                }

                /* Scrollable Tab Wrapper (NEW) */
                .tab-wrapper {
                    flex-grow: 1;
                    display: flex;
                    align-items: center;
                    position: relative; /* Context for absolute buttons */
                    min-width: 0; /* Needed for flex item to shrink properly */
                    margin: 0 1rem; /* Added margin for visual spacing */
                }

                /* Horizontal Scrollable Tabs Styles */
                .tab-scroll-container {
                    flex-grow: 1; /* Allows the tab container to take up available space */
                    display: flex;
                    align-items: center;
                    overflow-x: auto; /* Enable horizontal scrolling */
                    -webkit-overflow-scrolling: touch; /* Smoother scrolling on iOS */
                    scrollbar-width: none; /* Hide scrollbar for Firefox */
                    -ms-overflow-style: none; /* Hide scrollbar for IE and Edge */
                    padding-bottom: 5px; /* Add padding for scroll visibility */
                    margin-bottom: -5px; /* Counteract padding-bottom for visual alignment */
                    scroll-behavior: smooth; 
                }
                /* Hide scrollbar for Chrome, Safari, and Opera */
                .tab-scroll-container::-webkit-scrollbar { display: none; }

                /* Scroll Glide Buttons (UPDATED: Removed border-radius, adjusted gradients) */
                .scroll-glide-button {
                    position: absolute;
                    top: 0;
                    height: 100%;
                    width: 4rem; /* Increased width to accommodate the gradient stop change */
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #000000; /* Solid color matching navbar */
                    color: white;
                    font-size: 1.2rem;
                    cursor: pointer;
                    opacity: 0.8; /* Always visible slightly so they don't 'wake up' */
                    transition: opacity 0.3s, background 0.3s;
                    z-index: 10;
                    pointer-events: auto; /* Allow interaction */
                    /* Removed border-radius for no roundness */
                }
                .scroll-glide-button:hover {
                    opacity: 1;
                }
                
                /* Position and gradient for left button */
                #glide-left {
                    left: 0;
                    /* Gradient updated to go to 100% opaque at the edge (50% stop) */
                    background: linear-gradient(to right, #000000 50%, transparent); 
                    justify-content: flex-start; /* Align icon to the inner side of the gradient */
                    padding-left: 0.5rem;
                }

                /* Position and gradient for right button */
                #glide-right {
                    right: 0;
                    /* Gradient updated to go to 100% opaque at the edge (50% stop) */
                    background: linear-gradient(to left, #000000 50%, transparent); 
                    justify-content: flex-end; /* Align icon to the inner side of the gradient */
                    padding-right: 0.5rem;
                }
                
                /* Visibility class controlled by JS to hide when not needed */
                .scroll-glide-button.hidden {
                    opacity: 0 !important;
                    pointer-events: none !important;
                }

                /* Tab Base Styles */
                .nav-tab {
                    flex-shrink: 0; /* Prevents tabs from shrinking */
                    padding: 0.5rem 1rem;
                    color: #9ca3af; /* gray-400 */
                    font-size: 0.875rem;
                    font-weight: 500;
                    border-radius: 0.5rem;
                    transition: all 0.2s;
                    text-decoration: none;
                    line-height: 1.5;
                    display: flex;
                    align-items: center;
                    margin-right: 0.5rem; /* Spacing between tabs */
                    border: 1px solid transparent;
                }
                
                /* INACTIVE Tab Hover Styles (NEW) */
                .nav-tab:not(.active):hover {
                    color: white; /* Text color remains white */
                    border-color: #d1d5db; /* light color for outline: gray-300 */
                    background-color: rgba(79, 70, 229, 0.05); /* very slight indigo-600 tint for lighter background */
                }

                /* Active Tab Styles (Unchanged) */
                .nav-tab.active {
                    color: #4f46e5; /* indigo-600 - Highlight color */
                    border-color: #4f46e5;
                    background-color: rgba(79, 70, 229, 0.1); /* indigo-600 with opacity */
                }
                .nav-tab.active:hover {
                    color: #6366f1; /* indigo-500 */
                    border-color: #6366f1;
                    background-color: rgba(79, 70, 229, 0.15);
                }

                /* --- NEW: AI AGENT CHAT MODAL STYLES --- */
                #ai-agent-modal {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    width: min(100%, 350px);
                    height: min(80vh, 550px);
                    z-index: 10000;
                    background: #111827; /* Dark background */
                    border: 1px solid #374151;
                    border-radius: 1rem;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
                    display: flex;
                    flex-direction: column;
                    transform: translateX(400px); /* Initially hidden off-screen */
                    transition: transform 0.3s ease-out;
                }

                #ai-agent-modal.open {
                    transform: translateX(0);
                }

                #ai-chat-header {
                    padding: 0.75rem 1rem;
                    background: #1f2937;
                    border-bottom: 1px solid #374151;
                    color: white;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-radius: 1rem 1rem 0 0;
                }
                
                #ai-chat-messages {
                    flex-grow: 1;
                    overflow-y: auto;
                    padding: 1rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                
                .ai-message-bubble, .user-message-bubble {
                    max-width: 85%;
                    padding: 0.6rem 0.8rem;
                    border-radius: 0.75rem;
                    font-size: 0.9rem;
                    line-height: 1.4;
                }

                .user-message-bubble {
                    align-self: flex-end;
                    background-color: #4f46e5; /* indigo-600 */
                    color: white;
                    border-bottom-right-radius: 0.1rem;
                }

                .ai-message-bubble {
                    align-self: flex-start;
                    background-color: #374151; /* gray-700 */
                    color: #d1d5db;
                    border-bottom-left-radius: 0.1rem;
                    white-space: pre-wrap;
                }

                #ai-chat-input-area {
                    padding: 0.5rem 1rem 1rem 1rem;
                    border-top: 1px solid #374151;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                #ai-prompt-input {
                    width: 100%;
                    padding: 0.5rem;
                    border: 1px solid #4b5563;
                    border-radius: 0.5rem;
                    background: #000000;
                    color: white;
                    outline: none;
                    resize: none;
                    min-height: 40px;
                    max-height: 150px;
                }

                #ai-prompt-send-button {
                    background-color: #4f46e5;
                    color: white;
                    padding: 0.5rem 1rem;
                    border-radius: 0.5rem;
                    font-weight: 600;
                    transition: background-color 0.2s;
                }
                #ai-prompt-send-button:hover {
                    background-color: #6366f1;
                }
                
                #ai-agent-selector {
                    padding: 0.4rem 0.7rem;
                    background: #374151;
                    border: 1px solid #4b5563;
                    color: white;
                    border-radius: 0.5rem;
                    font-size: 0.85rem;
                    appearance: none; /* Hide default dropdown arrow */
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%23d1d5db'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z' clip-rule='evenodd' /%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    background-position: right 0.5rem center;
                    background-size: 1.25em;
                    cursor: pointer;
                    width: 100%;
                }
                /* End AI AGENT CHAT MODAL STYLES */

                /* Active Tab Styles (Unchanged) */
                .nav-tab.active {
                    color: #4f46e5; /* indigo-600 - Highlight color */
                    border-color: #4f46e5;
                    background-color: rgba(79, 70, 229, 0.1); /* indigo-600 with opacity */
                }
            `;
            document.head.appendChild(style);
        };

        // --- NEW: Function to robustly determine active tab (GitHub Pages fix) ---
        const isTabActive = (tabUrl) => {
            const tabPathname = new URL(tabUrl, window.location.origin).pathname.toLowerCase();
            const currentPathname = window.location.pathname.toLowerCase();

            // Helper to clean paths: remove trailing slash (unless it's root) and replace /index.html with /
            const cleanPath = (path) => {
                // If it ends with /index.html, strip that part to treat it as the folder path
                if (path.endsWith('/index.html')) {
                    path = path.substring(0, path.lastIndexOf('/')) + '/';
                }
                // Remove trailing slash unless it's the root path '/'
                if (path.length > 1 && path.endsWith('/')) {
                    path = path.slice(0, -1);
                }
                return path;
            };

            const currentCanonical = cleanPath(currentPathname);
            const tabCanonical = cleanPath(tabPathname);
            
            // 1. Exact canonical match (e.g., /dashboard === /dashboard)
            if (currentCanonical === tabCanonical) {
                return true;
            }

            // 2. GitHub Pages/Subdirectory match: Check if the current path ends with the tab path.
            // This handles cases like: current: /my-repo/about.html, tab: /about.html
            const tabPathSuffix = tabPathname.startsWith('/') ? tabPathname.substring(1) : tabPathname;
            
            if (currentPathname.endsWith(tabPathSuffix)) {
                return true;
            }

            return false;
        };
        
        // --- NEW: Function to control visibility of scroll glide buttons ---
        const updateScrollGilders = () => {
            const container = document.querySelector('.tab-scroll-container');
            const leftButton = document.getElementById('glide-left');
            const rightButton = document.getElementById('glide-right');

            if (!container || !leftButton || !rightButton) return;
            
            // Check if there is any content overflow
            const hasHorizontalOverflow = container.scrollWidth > container.offsetWidth;

            if (hasHorizontalOverflow) {
                // A threshold of 5px is used to account for minor rendering/subpixel discrepancies.
                const isScrolledToLeft = container.scrollLeft < 5; 
                // Check if scrolled to right end (within a 5px threshold)
                const isScrolledToRight = container.scrollLeft + container.offsetWidth >= container.scrollWidth - 5; 

                // Show buttons if there is overflow
                leftButton.classList.remove('hidden');
                rightButton.classList.remove('hidden');

                // Hide left button if at the start
                if (isScrolledToLeft) {
                    leftButton.classList.add('hidden');
                }
                // Hide right button if at the end
                if (isScrolledToRight) {
                    rightButton.classList.add('hidden');
                }
            } else {
                // Hide both buttons if there is no content overflow (most common case)
                leftButton.classList.add('hidden');
                rightButton.classList.add('hidden');
            }
        };

        // --- 4. RENDER THE NAVBAR HTML (UPDATED: Auth views match navigation-mini.js changes) ---
        const renderNavbar = (user, userData, pages) => {
            const container = document.getElementById('navbar-container');
            if (!container) return;

            const logoPath = "/images/logo.png"; // Using root-relative path

            // --- Tab Generation ---
            const tabsHtml = Object.values(pages || {}).map(page => {
                // Use the new robust check for active state
                const isActive = isTabActive(page.url);
                const activeClass = isActive ? 'active' : '';
                
                // Use the simplified and now robust getIconClass
                const iconClasses = getIconClass(page.icon);

                return `
                    <a href="${page.url}" class="nav-tab ${activeClass}">
                        <i class="${iconClasses} mr-2"></i>
                        ${page.name}
                    </a>
                `;
            }).join('');

            // --- Auth Views (UPDATED: Logged Out View to match navigation-mini.js) ---
            const loggedOutView = `
                <div class="relative flex-shrink-0">
                    <button id="auth-toggle" class="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-gray-700 transition logged-out-auth-toggle">
                        <i class="fa-solid fa-user"></i>
                    </button>
                    <div id="auth-menu-container" class="auth-menu-container closed">
                        <a href="/authentication.html" class="auth-menu-link">
                            <i class="fa-solid fa-lock"></i>
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

                // --- Dashboard icon is fa-house-user ---
                return `
                    <div class="relative flex-shrink-0">
                        <button id="auth-toggle" class="w-8 h-8 rounded-full border border-gray-600 overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500">
                            ${avatar}
                        </button>
                        <div id="auth-menu-container" class="auth-menu-container closed">
                            <div class="px-3 py-2 border-b border-gray-700 mb-2">
                                <p class="text-sm font-semibold text-white truncate">${username}</p>
                                <p class="text-xs text-gray-400 truncate">${email}</p>
                            </div>
                            <a href="/logged-in/dashboard.html" class="auth-menu-link">
                                <i class="fa-solid fa-house-user"></i>
                                Dashboard
                            </a>
                            <a href="/logged-in/settings.html" class="auth-menu-link">
                                <i class="fa-solid fa-gear"></i>
                                Settings
                            </a>
                            ${user.email === EXCLUSIVE_AI_USER_EMAIL ? 
                                // NEW: Add AI Agent activation link for the exclusive user
                                `<button id="ai-agent-toggle-button" class="auth-menu-button text-indigo-400 hover:bg-indigo-900/50 hover:text-indigo-300">
                                    <i class="fa-solid fa-wand-magic-sparkles"></i>
                                    AI Agent (Ctrl+A)
                                </button>` : ''}
                            <button id="logout-button" class="auth-menu-button text-red-400 hover:bg-red-900/50 hover:text-red-300">
                                <i class="fa-solid fa-right-from-bracket"></i>
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
                            <img src="${logoPath}" alt="4SP Logo" class="h-8 w-auto">
                        </a>

                        <div class="tab-wrapper">
                            <button id="glide-left" class="scroll-glide-button hidden"><i class="fa-solid fa-chevron-left"></i></button>

                            <div class="tab-scroll-container">
                                ${tabsHtml}
                            </div>
                            
                            <button id="glide-right" class="scroll-glide-button hidden"><i class="fa-solid fa-chevron-right"></i></button>
                        </div>

                        ${user ? loggedInView(user, userData) : loggedOutView}
                    </nav>
                </header>
            `;

            // --- 5. SETUP EVENT LISTENERS (Including auto-scroll and glide buttons) ---
            setupEventListeners(user);

            // Auto-scroll to the active tab if one is found
            const activeTab = document.querySelector('.nav-tab.active');
            const tabContainer = document.querySelector('.tab-scroll-container');
            if (activeTab && tabContainer) {
                // Scroll the container so the active tab is centered
                tabContainer.scrollLeft = activeTab.offsetLeft - (tabContainer.offsetWidth / 2) + (activeTab.offsetWidth / 2);
            }
            
            // INITIAL CHECK: After rendering and auto-scrolling, update glide button visibility
            // This is the key change to make the arrows dynamic upon load.
            updateScrollGilders();
        };

        const setupEventListeners = (user) => {
            const toggleButton = document.getElementById('auth-toggle');
            const menu = document.getElementById('auth-menu-container');

            // Scroll Glide Button setup
            const tabContainer = document.querySelector('.tab-scroll-container');
            const leftButton = document.getElementById('glide-left');
            const rightButton = document.getElementById('glide-right');

            // Use debounced function for scroll and resize updates (Performance fix)
            const debouncedUpdateGilders = debounce(updateScrollGilders, 50);

            if (tabContainer) {
                // Calculate dynamic scroll amount based on container width
                const scrollAmount = tabContainer.offsetWidth * 0.8; 

                // Update visibility on scroll
                tabContainer.addEventListener('scroll', debouncedUpdateGilders);
                
                // Update visibility on window resize
                window.addEventListener('resize', debouncedUpdateGilders);
                
                // Add click behavior for glide buttons
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
                    // Use the module-scope 'auth' variable
                    logoutButton.addEventListener('click', () => {
                        auth.signOut().catch(err => console.error("Logout failed:", err));
                    });
                }

                // NEW: Setup AI Agent toggle button click listener
                const aiAgentButton = document.getElementById('ai-agent-toggle-button');
                const aiModal = document.getElementById('ai-agent-modal');
                if (aiAgentButton && aiModal) {
                    aiAgentButton.addEventListener('click', () => {
                        aiModal.classList.toggle('open');
                        menu.classList.add('closed'); // Close the auth menu when opening modal
                        menu.classList.remove('open');
                        // Ensure input is focused when opening
                        if(aiModal.classList.contains('open')) {
                            document.getElementById('ai-prompt-input')?.focus();
                        }
                    });
                }
            }
        };

        // --- NEW: AI Agent Logic Implementation ---
        const getSystemContext = () => {
            const date = new Date();
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const localTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
            // Attempt a rough location approximation from timezone, or default
            const locationParts = timeZone.split('/');
            const generalLocation = locationParts.length > 1 ? locationParts[locationParts.length - 1].replace(/_/g, ' ') : 'Unknown Region';
        
            return `
[System Context Provided by Client]:
- Current Local Time: ${localTime}
- Current Time Zone: ${timeZone}
- General Location (Approximate): ${generalLocation}
- Browser/OS: ${navigator.userAgent.substring(0, 100)}...
`;
        };

        const setupAIAgentLogic = (user) => {
            const modal = document.createElement('div');
            modal.id = 'ai-agent-modal';
            modal.innerHTML = `
                <div id="ai-chat-header">
                    <span class="font-bold text-sm">Gemini AI Agent Console</span>
                    <i id="ai-chat-close" class="fa-solid fa-xmark text-gray-400 hover:text-white cursor-pointer transition"></i>
                </div>
                <div id="ai-chat-messages">
                    <div class="ai-message-bubble">
                        Welcome, ${user.displayName || 'Master'}! Select an agent below, then press Ctrl+A to toggle this console.
                    </div>
                </div>
                <div id="ai-chat-input-area">
                    <select id="ai-agent-selector">
                        ${AI_AGENT_CATEGORIES.map((agent, index) => 
                            `<option value="${index}" data-instruction="${agent.instruction}">
                                ${agent.name} - ${agent.instruction.split('.')[0]}
                            </option>`).join('')}
                    </select>
                    <div class="flex items-center gap-2">
                        <textarea id="ai-prompt-input" placeholder="Ask your agent a question..." rows="1"></textarea>
                        <button id="ai-prompt-send-button" title="Send (or Shift+Enter)">
                            <i class="fa-solid fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            const messagesContainer = document.getElementById('ai-chat-messages');
            const input = document.getElementById('ai-prompt-input');
            const sendButton = document.getElementById('ai-prompt-send-button');
            const selector = document.getElementById('ai-agent-selector');
            const closeButton = document.getElementById('ai-chat-close');

            let chatHistory = [];
            let isSending = false;

            // Chat Toggle Logic (Ctrl + A)
            document.addEventListener('keydown', (e) => {
                const isInputActive = document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.isContentEditable;
                if (e.ctrlKey && e.key === 'a' && !isInputActive) {
                    e.preventDefault();
                    modal.classList.toggle('open');
                    if (modal.classList.contains('open')) {
                        input?.focus();
                    }
                }
            });

            // Close Button Logic
            closeButton?.addEventListener('click', () => {
                modal.classList.remove('open');
            });
            
            // Auto-resize textarea
            const autoResize = () => {
                if (input) {
                    input.style.height = 'auto';
                    input.style.height = input.scrollHeight + 'px';
                }
            };
            input?.addEventListener('input', autoResize);
            
            // Send on click or Shift + Enter
            const handleSend = () => {
                if (isSending) return;
                const prompt = input?.value.trim();
                if (!prompt) return;

                // Disable UI and show loading
                isSending = true;
                sendButton.disabled = true;
                sendButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                input.disabled = true;

                // Add user message to UI and history
                addMessage(prompt, 'user');
                chatHistory.push({ role: 'user', parts: [{ text: prompt }] });
                input.value = '';
                autoResize();
                
                // Determine current system instruction
                const selectedOption = selector.options[selector.selectedIndex];
                const systemInstruction = selectedOption.getAttribute('data-instruction');
                
                // Add system context to the user's prompt
                const fullPrompt = `${getSystemContext()}\n---\nUser Query: ${prompt}`;

                // Call the Gemini API with exponential backoff
                const callApi = async (attempt = 1) => {
                    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`;
                    
                    const historyWithContext = [...chatHistory.slice(0, -1), { role: 'user', parts: [{ text: fullPrompt }] }];
                    
                    const payload = {
                        contents: historyWithContext,
                        tools: [{ "google_search": {} }],
                        systemInstruction: {
                            parts: [{ text: systemInstruction }]
                        },
                    };

                    try {
                        const response = await fetch(apiUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });

                        if (!response.ok) {
                            if (response.status === 429 && attempt < 5) { // Retry on rate limit
                                const delay = Math.pow(2, attempt) * 1000;
                                await new Promise(resolve => setTimeout(resolve, delay));
                                return callApi(attempt + 1); // Exponential backoff retry
                            }
                            throw new Error(`API error: ${response.statusText}`);
                        }

                        const result = await response.json();
                        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "Error: Could not retrieve a valid response.";
                        
                        // Add AI message to UI and history
                        addMessage(text, 'ai');
                        chatHistory.push({ role: 'model', parts: [{ text: text }] });
                        
                    } catch (error) {
                        console.error('Gemini API request failed:', error);
                        addMessage(`[ERROR] AI Agent failed to respond: ${error.message}`, 'ai');
                    } finally {
                        // Re-enable UI
                        isSending = false;
                        sendButton.disabled = false;
                        sendButton.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
                        input.disabled = false;
                        input.focus();
                    }
                };

                callApi();
            };

            sendButton?.addEventListener('click', handleSend);
            
            input?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                }
            });

            const addMessage = (text, sender) => {
                const bubble = document.createElement('div');
                bubble.className = sender === 'user' ? 'user-message-bubble' : 'ai-message-bubble';
                bubble.textContent = text;
                messagesContainer.appendChild(bubble);
                messagesContainer.scrollTop = messagesContainer.scrollHeight; // Scroll to bottom
            };
        };


        // --- 6. AUTH STATE LISTENER ---
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                // User is signed in. Fetch their data from Firestore.
                try {
                    // Use the module-scope 'db' variable
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    const userData = userDoc.exists ? userDoc.data() : null;
                    renderNavbar(user, userData, pages);
                    
                    // NEW: Setup AI Agent only for the exclusive user
                    if (user.email === EXCLUSIVE_AI_USER_EMAIL) {
                        setupAIAgentLogic(user);
                    }
                } catch (error) {
                    console.error("Error fetching user data:", error);
                    renderNavbar(user, null, pages); // Render even if Firestore fails
                }
            } else {
                // User is signed out.
                renderNavbar(null, null, pages);
                // Attempt to sign in anonymously for a seamless guest experience.
                auth.signInAnonymously().catch((error) => {
                    if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/admin-restricted-operation') {
                        console.warn(
                            "Anonymous sign-in is disabled. Enable it in the Firebase Console (Authentication > Sign-in method) for guest features."
                        );
                    } else {
                        console.error("Anonymous sign-in error:", error);
                    }
                });
            }
        });

        // --- FINAL SETUP ---
        // Create a div for the navbar to live in if it doesn't exist.
        if (!document.getElementById('navbar-container')) {
            const navbarDiv = document.createElement('div');
            navbarDiv.id = 'navbar-container';
            document.body.prepend(navbarDiv);
        }
        injectStyles();
    };

    // --- START THE PROCESS ---
    // Wait for the DOM to be ready, then start loading scripts.
    document.addEventListener('DOMContentLoaded', run);

})();
