/**
 * navigation.js
 * * This is a fully self-contained script to create a dynamic, authentication-aware
 * navigation bar for your website. It handles everything from Firebase initialization
 * to rendering user-specific information. It now includes a horizontally scrollable
 * tab menu loaded from page-identification.json.
 *
 * --- NEW AI AGENT FEATURE ---
 * - Activated by Control + A (when not in a text box).
 * - Only available to user: 4simpleproblems@gmail.com.
 * - Uses the new Firebase AI SDK (gemini-2.5-flash) for chat.
 * - Provides 8 selectable agent personas.
 * - Automatically injects current time, timezone, and general location (if available) into the system prompt.
 *
 * --- INSTRUCTIONS ---
 * 1. ACTION REQUIRED: Paste your own Firebase project configuration into the `FIREBASE_CONFIG` object below.
 * 2. Place this script in the root directory of your website.
 * 3. Add `<script src="/navigation.js" defer></script>` to the <head> of any HTML file where you want the navbar.
 * 4. Ensure your file paths for images and links are root-relative (e.g., "/images/logo.png", "/login.html").
 * * --- HOW IT WORKS ---
 * - It runs automatically once the HTML document is loaded.
 * - It injects its own CSS for styling the navbar, dropdown menu, tab bar, and the new AI Chat Modal.
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

// --- AI Agent Configuration ---
const PRIVILEGED_EMAIL = '4simpleproblems@gmail.com';
const AGENT_CATEGORIES = {
    'Quick': "You are a Quick Agent. Respond in a single, concise paragraph (max 3 sentences). Prioritize speed and direct answers.",
    'Standard': "You are a Standard Agent. Provide balanced, helpful, and moderately detailed responses, suitable for general inquiries.",
    'Deep Thinking': "You are a Deep Thinking Agent. Always provide comprehensive, analytical, and highly detailed responses. Explore nuances and potential counterpoints.",
    'Creative Writer': "You are a Creative Writer Agent. Respond with imaginative flair, utilizing vivid language, storytelling, or poetry as appropriate to the user's prompt.",
    'Code Reviewer': "You are a Code Reviewer Agent. Analyze code snippets for best practices, potential bugs, security issues, and provide refactoring suggestions. Respond in markdown code blocks when appropriate.",
    'Historian': "You are a Historian Agent. Focus on providing historically accurate facts, context, and chronological narratives in your answers.",
    'Financial Analyst': "You are a Financial Analyst Agent. Provide formal, data-driven advice and market summaries. Always use a professional and cautious tone.",
    'Philosopher': "You are a Philosopher Agent. Respond with open-ended questions and critical inquiry, encouraging the user to think deeper about the topic."
};

// Variables to hold Firebase objects, which must be globally accessible after loading scripts
let auth;
let db;
let ai;
let model; // The GenerativeModel instance
let currentAgent = 'Standard'; // Default agent

// --- Self-invoking function to encapsulate all logic ---
(function() {
    // Stop execution if Firebase config is not provided
    if (!FIREBASE_CONFIG || !FIREBASE_CONFIG.apiKey) {
        console.error("Firebase configuration is missing! Please paste your config into navigation.js.");
        return;
    }

    // --- 1. DYNAMICALLY LOAD EXTERNAL ASSETS (Optimized) ---

    // Helper to load external JS files
    const loadScript = (src, isModule = false) => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            // Use type='module' for modern SDKs like AI
            if (isModule) {
                script.type = 'module';
                // For modern modules, we need to ensure the correct export is handled,
                // but since these are from gstatic, they are often side-effect imports
                // that make the function available globally or via a specific pattern.
            }
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
    
    // ... [getIconClass remains the same] ...
    const getIconClass = (iconName) => {
        if (!iconName) return '';

        const nameParts = iconName.trim().split(/\s+/).filter(p => p.length > 0);
        let stylePrefix = 'fa-solid'; // Default style
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
    // ... [end getIconClass] ...

    /**
     * Attempts to get general location and time data for the system prompt.
     * @returns {Promise<{ location: string, time: string }>}
     */
    const getSystemInfo = async () => {
        const date = new Date();
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const time = date.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true, timeZoneName: 'short' });
        
        let generalLocation = 'Unknown (Location permission denied or not supported)';

        try {
            // Attempt to get city/state using a reverse geocoding service based on IP (Fallback: not implemented here)
            // For security and simplicity within the sandbox, we will use the local time and timezone and *try* to get a generic city/state from the browser.
            // Using navigator.geolocation is the most reliable *local* method.
            const position = await new Promise((resolve, reject) => {
                // Set a timeout for location acquisition
                const timeoutId = setTimeout(() => reject(new Error('Location timeout')), 500);
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        (pos) => { 
                            clearTimeout(timeoutId);
                            resolve(pos);
                        },
                        (err) => { 
                            clearTimeout(timeoutId);
                            reject(err);
                        },
                        { timeout: 500, enableHighAccuracy: false } // Low accuracy, fast response
                    );
                } else {
                    clearTimeout(timeoutId);
                    reject(new Error('Geolocation not supported'));
                }
            });

            // Since we cannot reliably reverse geocode in the browser without an external API key,
            // we will use the coordinates as a proxy for the location context.
            generalLocation = `Coordinates: Lat ${position.coords.latitude.toFixed(2)}, Lon ${position.coords.longitude.toFixed(2)}`;

        } catch (error) {
            // Error, or user denied location, keep the default genericLocation message
            // console.warn('Could not retrieve general location:', error.message);
        }

        return {
            location: generalLocation,
            time: `Local Time: ${time}`,
            timezone: `Timezone: ${timezone}`
        };
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
            // NOTE: The Firebase AI SDK is *only* available in the modular format,
            // so we rely on the side-effect imports creating the necessary global functions.
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js");
            
            // NEW: Load Firebase AI SDK (Modular, required for getAI)
            // We use the common cdn path for the modular version 
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js", true);
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-ai.js", true);


            // Now that scripts are loaded, we can use the `firebase` global object (for compat) 
            // and assume the modular functions (initializeApp, getAI, GoogleAIBackend) are now accessible.
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

        // --- 3. INJECT CSS STYLES (Includes new AI Modal Styles) ---
        const injectStyles = () => {
            const style = document.createElement('style');
            style.textContent = `
                /* Base Styles */
                body { padding-top: 4rem; /* 64px, equal to navbar height */ }
                .auth-navbar { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; background: #000000; border-bottom: 1px solid rgb(31 41 55); height: 4rem; }
                .auth-navbar nav { max-width: 80rem; margin: auto; padding: 0 1rem; height: 100%; display: flex; align-items: center; justify-content: space-between; gap: 1rem; position: relative; }
                .initial-avatar { background: linear-gradient(135deg, #374151 0%, #111827 100%); font-family: 'Geist', sans-serif; text-transform: uppercase; display: flex; align-items: center; justify-content: center; color: white; }
                
                /* Auth Dropdown Menu Styles (UPDATED: Pure Black background) */
                .auth-menu-container { 
                    position: absolute; right: 0; top: 50px; width: 16rem; 
                    background: #000000;
                    border: 1px solid rgb(55 65 81); border-radius: 0.75rem; padding: 0.5rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -2px rgba(0,0,0,0.2); 
                    transition: transform 0.2s ease-out, opacity 0.2s ease-out; transform-origin: top right; 
                }
                .auth-menu-container.open { opacity: 1; transform: translateY(0) scale(1); }
                .auth-menu-container.closed { opacity: 0; pointer-events: none; transform: translateY(-10px) scale(0.95); }
                .auth-menu-link, .auth-menu-button { 
                    display: flex; align-items: center; gap: 0.75rem; width: 100%; text-align: left; 
                    padding: 0.5rem 0.75rem; font-size: 0.875rem; color: #d1d5db; border-radius: 0.375rem; 
                    transition: background-color 0.2s, color 0.2s; border: none; cursor: pointer;
                }
                .auth-menu-link:hover, .auth-menu-button:hover { background-color: rgb(55 65 81); color: white; }

                /* Custom style for the logged out button's icon and background */
                .logged-out-auth-toggle { background: #010101; border: 1px solid #374151; }
                .logged-out-auth-toggle i { color: #DADADA; }

                /* Scrollable Tab Wrapper */
                .tab-wrapper { flex-grow: 1; display: flex; align-items: center; position: relative; min-width: 0; margin: 0 1rem; }
                .tab-scroll-container { flex-grow: 1; display: flex; align-items: center; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; -ms-overflow-style: none; padding-bottom: 5px; margin-bottom: -5px; scroll-behavior: smooth; }
                .tab-scroll-container::-webkit-scrollbar { display: none; }

                /* Scroll Glide Buttons */
                .scroll-glide-button {
                    position: absolute; top: 0; height: 100%; width: 4rem; display: flex; align-items: center; justify-content: center; background: #000000; 
                    color: white; font-size: 1.2rem; cursor: pointer; opacity: 0.8; transition: opacity 0.3s, background 0.3s; z-index: 10; pointer-events: auto;
                }
                .scroll-glide-button:hover { opacity: 1; }
                #glide-left { left: 0; background: linear-gradient(to right, #000000 50%, transparent); justify-content: flex-start; padding-left: 0.5rem; }
                #glide-right { right: 0; background: linear-gradient(to left, #000000 50%, transparent); justify-content: flex-end; padding-right: 0.5rem; }
                .scroll-glide-button.hidden { opacity: 0 !important; pointer-events: none !important; }

                /* Tab Base Styles */
                .nav-tab { flex-shrink: 0; padding: 0.5rem 1rem; color: #9ca3af; font-size: 0.875rem; font-weight: 500; border-radius: 0.5rem; transition: all 0.2s; text-decoration: none; line-height: 1.5; display: flex; align-items: center; margin-right: 0.5rem; border: 1px solid transparent; }
                .nav-tab:not(.active):hover { color: white; border-color: #d1d5db; background-color: rgba(79, 70, 229, 0.05); }
                .nav-tab.active { color: #4f46e5; border-color: #4f46e5; background-color: rgba(79, 70, 229, 0.1); }
                .nav-tab.active:hover { color: #6366f1; border-color: #6366f1; background-color: rgba(79, 70, 229, 0.15); }
                
                /* --- AI Agent Modal Styles (NEW) --- */
                .ai-modal {
                    position: fixed;
                    bottom: 2rem; right: 2rem;
                    width: min(90vw, 24rem);
                    height: min(80vh, 32rem);
                    background: #111827; /* dark slate */
                    border: 1px solid #374151;
                    border-radius: 0.75rem;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                    z-index: 1001;
                    display: flex;
                    flex-direction: column;
                    transition: transform 0.3s ease-out, opacity 0.3s ease-out;
                    transform: scale(0.95);
                    opacity: 0;
                    pointer-events: none;
                }
                .ai-modal.active {
                    transform: scale(1);
                    opacity: 1;
                    pointer-events: auto;
                }
                .ai-header {
                    padding: 0.75rem 1rem;
                    background: #1f2937;
                    color: white;
                    border-top-left-radius: 0.75rem;
                    border-top-right-radius: 0.75rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .ai-chat-area {
                    flex-grow: 1;
                    overflow-y: auto;
                    padding: 1rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }
                .ai-chat-message {
                    max-width: 85%;
                    padding: 0.5rem 0.75rem;
                    border-radius: 0.5rem;
                    font-size: 0.875rem;
                }
                .ai-user-message {
                    align-self: flex-end;
                    background: #4f46e5; /* indigo-600 */
                    color: white;
                }
                .ai-agent-message {
                    align-self: flex-start;
                    background: #374151; /* gray-700 */
                    color: #e5e7eb; /* gray-200 */
                }
                .ai-input-area {
                    padding: 0.75rem 1rem;
                    border-top: 1px solid #374151;
                }
                .ai-input-area form {
                    display: flex;
                    gap: 0.5rem;
                }
                .ai-input-area textarea {
                    flex-grow: 1;
                    background: #1f2937;
                    border: 1px solid #4b5563;
                    color: white;
                    padding: 0.5rem;
                    border-radius: 0.5rem;
                    resize: none;
                    height: 2.5rem; /* Single line height */
                    overflow-y: hidden;
                }
                .ai-input-area button {
                    background: #4f46e5;
                    color: white;
                    padding: 0.5rem 1rem;
                    border-radius: 0.5rem;
                    transition: background 0.2s;
                    min-width: 5rem;
                }
                .ai-input-area button:hover {
                    background: #6366f1;
                }
                .ai-loading-indicator {
                    font-style: italic;
                    color: #9ca3af;
                    align-self: flex-start;
                    padding-left: 0.75rem;
                }
                .ai-agent-select {
                    background: #1f2937;
                    color: white;
                    border: 1px solid #4b5563;
                    border-radius: 0.375rem;
                    padding: 0.25rem 0.5rem;
                    font-size: 0.8rem;
                    cursor: pointer;
                    margin-right: 0.5rem;
                    appearance: none; /* Hide default dropdown arrow */
                    background-image: url('data:image/svg+xml;utf8,<svg fill="white" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>');
                    background-repeat: no-repeat;
                    background-position: right 0.5rem center;
                    background-size: 0.8em;
                    padding-right: 1.5rem;
                }
            `;
            document.head.appendChild(style);
        };

        // --- NEW: Function to check if focused element is an input/textarea ---
        const isFocusableElement = () => {
            const activeElement = document.activeElement;
            if (!activeElement) return false;
            const tagName = activeElement.tagName.toLowerCase();
            return (
                tagName === 'input' && activeElement.type !== 'button' && activeElement.type !== 'checkbox' && activeElement.type !== 'radio' ||
                tagName === 'textarea' ||
                activeElement.contentEditable === 'true'
            );
        };

        // ... [isTabActive and updateScrollGilders remain the same] ...
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
        // ... [end isTabActive and updateScrollGilders] ...

        // --- NEW: AI GENERATIVE MODEL INITIALIZATION ---
        // This is where we use the modular SDK functions. We assume they are now available
        // in the global scope due to the side-effect imports of the CDN scripts.
        try {
            // Note: We use the global `app` variable for the FirebaseApp instance.
            ai = getAI(app, { backend: new GoogleAIBackend() });
            model = getGenerativeModel(ai, { model: "gemini-2.5-flash" });
            console.log("Firebase AI Generative Model initialized successfully.");
        } catch (e) {
            console.error("Failed to initialize Firebase AI SDK. Ensure all dependencies are loaded.", e);
        }


        // --- 4. RENDER THE NAVBAR HTML (UPDATED: Auth views match navigation-mini.js changes) ---
        const renderNavbar = (user, userData, pages, isPrivilegedUser) => {
            const container = document.getElementById('navbar-container');
            if (!container) return;

            const logoPath = "/images/logo.png"; // Using root-relative path

            // --- Tab Generation ---
            const tabsHtml = Object.values(pages || {}).map(page => {
                const isActive = isTabActive(page.url);
                const activeClass = isActive ? 'active' : '';
                const iconClasses = getIconClass(page.icon);

                return `
                    <a href="${page.url}" class="nav-tab ${activeClass}">
                        <i class="${iconClasses} mr-2"></i>
                        ${page.name}
                    </a>
                `;
            }).join('');

            // --- AI Agent Selector HTML (Only for Privileged User) ---
            const agentOptionsHtml = Object.keys(AGENT_CATEGORIES).map(key => 
                `<option value="${key}" ${key === currentAgent ? 'selected' : ''}>${key}</option>`
            ).join('');

            const aiAgentButton = isPrivilegedUser ? `
                <div class="relative flex-shrink-0 mr-4">
                    <button id="ai-toggle" title="AI Agent (Ctrl+A)" class="w-8 h-8 rounded-full border border-indigo-600 bg-indigo-700/50 flex items-center justify-center text-indigo-300 hover:bg-indigo-600 hover:text-white transition">
                        <i class="fa-solid fa-wand-magic-sparkles"></i>
                    </button>
                </div>
            ` : '';

            // --- Auth Views ---
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

                return `
                    ${aiAgentButton}
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

            // --- Append AI Modal HTML to the Body ---
            if (isPrivilegedUser) {
                let aiModal = document.getElementById('ai-modal');
                if (!aiModal) {
                    aiModal = document.createElement('div');
                    aiModal.id = 'ai-modal';
                    aiModal.classList.add('ai-modal');
                    // Add the structure for the modal
                    aiModal.innerHTML = `
                        <div class="ai-header">
                            <div class="text-sm font-bold">
                                AI Agent: 
                                <select id="agent-selector" class="ai-agent-select">${agentOptionsHtml}</select>
                            </div>
                            <button id="ai-close-button" class="text-gray-400 hover:text-white transition">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <div id="ai-chat-area" class="ai-chat-area">
                            <p class="ai-agent-message">Hello! I'm the **${currentAgent}** agent. Ask me anything. Remember, you can change my persona using the dropdown above!</p>
                        </div>
                        <div class="ai-input-area">
                            <form id="ai-chat-form">
                                <textarea id="ai-input" placeholder="Type your message..." rows="1"></textarea>
                                <button type="submit" id="ai-send-button"><i class="fa-solid fa-paper-plane mr-1"></i> Send</button>
                            </form>
                        </div>
                    `;
                    document.body.appendChild(aiModal);
                }
            }


            // --- 5. SETUP EVENT LISTENERS (Including auto-scroll and glide buttons) ---
            setupEventListeners(user, isPrivilegedUser);

            // Auto-scroll to the active tab if one is found
            const activeTab = document.querySelector('.nav-tab.active');
            const tabContainer = document.querySelector('.tab-scroll-container');
            if (activeTab && tabContainer) {
                tabContainer.scrollLeft = activeTab.offsetLeft - (tabContainer.offsetWidth / 2) + (activeTab.offsetWidth / 2);
            }
            
            // INITIAL CHECK: After rendering and auto-scrolling, update glide button visibility
            updateScrollGilders();
        };

        // --- NEW: AI CHAT LOGIC ---
        const handleChatSubmit = async (e) => {
            e.preventDefault();
            const input = document.getElementById('ai-input');
            const chatArea = document.getElementById('ai-chat-area');
            const sendButton = document.getElementById('ai-send-button');
            const userQuery = input.value.trim();

            if (!userQuery) return;

            // 1. Display user message and clear input
            const userMessageDiv = document.createElement('p');
            userMessageDiv.classList.add('ai-chat-message', 'ai-user-message');
            userMessageDiv.textContent = userQuery;
            chatArea.appendChild(userMessageDiv);
            chatArea.scrollTop = chatArea.scrollHeight;
            input.value = '';
            input.disabled = true;
            sendButton.disabled = true;

            // 2. Add loading indicator
            const loadingDiv = document.createElement('p');
            loadingDiv.classList.add('ai-loading-indicator');
            loadingDiv.textContent = 'Agent is thinking...';
            chatArea.appendChild(loadingDiv);
            chatArea.scrollTop = chatArea.scrollHeight;

            try {
                // 3. Get system context
                const systemInfo = await getSystemInfo();
                const baseInstruction = AGENT_CATEGORIES[currentAgent];
                const systemPrompt = `You are acting as the '${currentAgent}' agent with the following persona: ${baseInstruction}. You MUST tailor your response to this persona.\n\n[SYSTEM CONTEXT]\n${systemInfo.time}\n${systemInfo.timezone}\nGeneral Location: ${systemInfo.location}\n[END CONTEXT]`;

                // 4. Call the Generative Model
                const response = await model.generateContent({
                    contents: [
                        { role: 'user', parts: [{ text: userQuery }] }
                    ],
                    config: {
                        systemInstruction: systemPrompt,
                        // Enable Google Search for grounded responses for Standard/Deep Thinking agents
                        tools: [{ googleSearch: {} }]
                    }
                });

                // 5. Display agent response
                const agentMessageDiv = document.createElement('p');
                agentMessageDiv.classList.add('ai-chat-message', 'ai-agent-message');
                agentMessageDiv.innerHTML = response.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // Basic markdown conversion
                chatArea.removeChild(loadingDiv);
                chatArea.appendChild(agentMessageDiv);

            } catch (error) {
                console.error("AI Agent Error:", error);
                loadingDiv.textContent = 'Error: Failed to get response.';
                loadingDiv.style.color = 'red';
            } finally {
                chatArea.scrollTop = chatArea.scrollHeight;
                input.disabled = false;
                sendButton.disabled = false;
                input.focus();
            }
        };

        const setupEventListeners = (user, isPrivilegedUser) => {
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
                        auth.signOut().catch(err => console.error("Logout failed:", err));
                    });
                }
            }

            // --- NEW: AI Agent Listeners (Only for privileged user) ---
            if (isPrivilegedUser) {
                const aiModal = document.getElementById('ai-modal');
                const aiToggleButton = document.getElementById('ai-toggle');
                const aiCloseButton = document.getElementById('ai-close-button');
                const aiChatForm = document.getElementById('ai-chat-form');
                const agentSelector = document.getElementById('agent-selector');
                const aiInput = document.getElementById('ai-input');

                // Toggle Button Click
                if (aiToggleButton && aiModal) {
                    aiToggleButton.addEventListener('click', () => {
                        aiModal.classList.toggle('active');
                        if (aiModal.classList.contains('active')) {
                            aiInput.focus();
                        }
                    });
                }
                
                // Close Button Click
                if (aiCloseButton && aiModal) {
                    aiCloseButton.addEventListener('click', () => {
                        aiModal.classList.remove('active');
                    });
                }

                // Agent Selector Change
                if (agentSelector) {
                    agentSelector.addEventListener('change', (e) => {
                        currentAgent = e.target.value;
                        const chatArea = document.getElementById('ai-chat-area');
                        const welcomeDiv = document.createElement('p');
                        welcomeDiv.classList.add('ai-agent-message');
                        welcomeDiv.innerHTML = `**Agent Switched:** I am now the **${currentAgent}** agent. Ask away!`;
                        chatArea.appendChild(welcomeDiv);
                        chatArea.scrollTop = chatArea.scrollHeight;
                    });
                }

                // Chat Form Submit
                if (aiChatForm) {
                    aiChatForm.addEventListener('submit', handleChatSubmit);
                    
                    // Allow Shift+Enter for new line, Enter for submit
                    aiInput.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleChatSubmit(e);
                        }
                    });
                }

                // Control + A Activation
                document.addEventListener('keydown', (e) => {
                    // Check for Control (or Command on Mac) and A
                    if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !isFocusableElement()) {
                        e.preventDefault(); // Prevent text selection/browser shortcuts
                        aiModal.classList.toggle('active');
                        if (aiModal.classList.contains('active')) {
                            aiInput.focus();
                        }
                    }
                });
            }
        };

        // --- 6. AUTH STATE LISTENER ---
        auth.onAuthStateChanged(async (user) => {
            let isPrivilegedUser = false;
            
            if (user) {
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
