/**
 * navigation.js
 * * This is a fully self-contained script to create a dynamic, authentication-aware
 * navigation bar for your website. It handles everything from Firebase initialization
 * to rendering user-specific information. It now includes a horizontally scrollable
 * tab menu loaded from page-identification.json.
 *
 * --- IMPORTANT FIXES ---
 * 1. API KEY FIX: The AI Agent now uses the apiKey stored explicitly in the FIREBASE_CONFIG object
 * for all Gemini API calls, as requested.
 * 2. CRITICAL CDN FIX (COMPLETE): Ensures the navigation bar renders by using stable Firebase Compat SDKs.
 * 3. RENDER PRIORITY: Ensures the navigation bar is rendered immediately after CSS injection, preventing the AI logic failure from blocking the UI.
 * 4. AI MODE STYLING: Updated AI mode toggle and modal with Geist font, Playfair Display hints, and a modern orange/creme color scheme (#eb8334, #fff1d4).
 */

// =========================================================================
// >> ACTION REQUIRED: PASTE YOUR FIREBASE CONFIGURATION OBJECT HERE <<
// =========================================================================
const FIREBASE_CONFIG = {
    // This apiKey is now used for both Firebase Auth and the Gemini API calls.
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
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=";
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

// Variables to hold Firebase objects
let auth;
let db;
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
    const loadScript = (src) => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    };

    // Helper to load external CSS files (Faster for icons and fonts)
    const loadCSS = (href) => {
        return new Promise((resolve) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = resolve;
            link.onerror = resolve; // Resolve even on error to not block page loading
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

    /**
     * Attempts to get general location and time data for the system prompt.
     * @returns {Promise<{ location: string, time: string, timezone: string }>}
     */
    const getSystemInfo = async () => {
        const date = new Date();
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const time = date.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true, timeZoneName: 'short' });
        
        let generalLocation = 'Unknown (Location permission denied or not supported)';

        try {
            const position = await new Promise((resolve, reject) => {
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
                        { timeout: 500, enableHighAccuracy: false }
                    );
                } else {
                    clearTimeout(timeoutId);
                    reject(new Error('Geolocation not supported'));
                }
            });
            generalLocation = `Coordinates: Lat ${position.coords.latitude.toFixed(2)}, Lon ${position.coords.longitude.toFixed(2)}`;
        } catch (error) {
            // Error, or user denied location, keep the default genericLocation message
        }

        return {
            location: generalLocation,
            time: `Local Time: ${time}`,
            timezone: `Timezone: ${timezone}`
        };
    };

    const run = async () => {
        let pages = {};

        // Load Icons CSS first
        await loadCSS("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css");
        // Load Playfair Display font for hints
        await loadCSS("https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap");
        
        // Fetch page configuration for the tabs
        try {
            const response = await fetch(PAGE_CONFIG_URL);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            pages = await response.json();
        } catch (error) {
            console.error("Failed to load page identification config:", error);
            // Continue execution
        }

        try {
            // ONLY load the stable Firebase Compat modules
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js");
            
            // Initialize Firebase and start the rendering/auth process
            initializeApp(pages);

        } catch (error) {
            // This error now only captures issues with the core Firebase SDKs, not the AI SDK
            console.error("Failed to load core Firebase SDKs:", error);
        }
    };

    // --- 2. INITIALIZE FIREBASE AND RENDER NAVBAR ---
    const initializeApp = (pages) => {
        // Initialize Firebase with the compat libraries
        const app = firebase.initializeApp(FIREBASE_CONFIG);
        auth = firebase.auth();
        db = firebase.firestore();

        // --- 3. INJECT CSS STYLES (Includes new AI Modal Styles) ---
        const injectStyles = () => {
            const style = document.createElement('style');
            style.textContent = `
                /* --- FONT IMPORTS AND CONFIGURATION --- */
                /* Geist conversion/loading */
                @font-face {
                    font-family: 'Geist';
                    src: url('https://cdn.jsdelivr.net/npm/@geist-ui/font@latest/dist/Geist-Regular.woff2') format('woff2');
                    font-weight: 400;
                    font-style: normal;
                }
                @font-face {
                    font-family: 'Geist';
                    src: url('https://cdn.jsdelivr.net/npm/@geist-ui/font@latest/dist/Geist-Medium.woff2') format('woff2');
                    font-weight: 500;
                    font-style: normal;
                }
                @font-face {
                    font-family: 'Geist';
                    src: url('https://cdn.jsdelivr.net/npm/@geist-ui/font@latest/dist/Geist-Bold.woff2') format('woff2');
                    font-weight: 700;
                    font-style: normal;
                }
                
                :root {
                    --geist-font: 'Geist', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                    --playfair-font: 'Playfair Display', Georgia, serif;
                    --ai-primary-orange: #eb8334; /* The 'Popsicle' Orange */
                    --ai-creme: #fff1d4; /* The 'Popsicle' Creme */
                    --ai-background-dark: #1e293b; /* Slate-700 equivalent for modal base */
                    --ai-text-light: #f3f4f6; /* Light gray text */
                }

                /* Base Styles */
                body { padding-top: 4rem; font-family: var(--geist-font); }
                .auth-navbar { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; background: #000000; border-bottom: 1px solid rgb(31 41 55); height: 4rem; }
                .auth-navbar nav { max-width: 80rem; margin: auto; padding: 0 1rem; height: 100%; display: flex; align-items: center; justify-content: space-between; gap: 1rem; position: relative; }
                .initial-avatar { background: linear-gradient(135deg, #374151 0%, #111827 100%); font-family: var(--geist-font); text-transform: uppercase; display: flex; align-items: center; justify-content: center; color: white; }
                
                /* Auth Dropdown Menu Styles (unchanged) */
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
                    font-family: var(--geist-font);
                }
                .auth-menu-link:hover, .auth-menu-button:hover { background-color: rgb(55 65 81); color: white; }
                .logged-out-auth-toggle { background: #010101; border: 1px solid #374151; }
                .logged-out-auth-toggle i { color: #DADADA; }

                /* Tab Wrapper and Glide Buttons (Playfair hint on active tab) */
                .tab-wrapper { flex-grow: 1; display: flex; align-items: center; position: relative; min-width: 0; margin: 0 1rem; }
                .tab-scroll-container { flex-grow: 1; display: flex; align-items: center; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; -ms-overflow-style: none; padding-bottom: 5px; margin-bottom: -5px; scroll-behavior: smooth; }
                .tab-scroll-container::-webkit-scrollbar { display: none; }
                .scroll-glide-button {
                    position: absolute; top: 0; height: 100%; width: 4rem; display: flex; align-items: center; justify-content: center; background: #000000; 
                    color: white; font-size: 1.2rem; cursor: pointer; opacity: 0.8; transition: opacity 0.3s, background 0.3s; z-index: 10; pointer-events: auto;
                }
                .scroll-glide-button:hover { opacity: 1; }
                #glide-left { left: 0; background: linear-gradient(to right, #000000 50%, transparent); justify-content: flex-start; padding-left: 0.5rem; }
                #glide-right { right: 0; background: linear-gradient(to left, #000000 50%, transparent); justify-content: flex-end; padding-right: 0.5rem; }
                .scroll-glide-button.hidden { opacity: 0 !important; pointer-events: none !important; }
                .nav-tab { 
                    flex-shrink: 0; padding: 0.5rem 1rem; color: #9ca3af; font-size: 0.875rem; 
                    font-weight: 500; border-radius: 0.5rem; transition: all 0.2s; text-decoration: none; 
                    line-height: 1.5; display: flex; align-items: center; margin-right: 0.5rem; 
                    border: 1px solid transparent; 
                    font-family: var(--geist-font);
                }
                .nav-tab:not(.active):hover { color: white; border-color: #d1d5db; background-color: rgba(235, 131, 52, 0.05); }
                .nav-tab.active { 
                    color: var(--ai-primary-orange); 
                    border-color: var(--ai-primary-orange); 
                    background-color: rgba(235, 131, 52, 0.1); 
                    font-family: var(--playfair-font); /* Playfair hint for active tab */
                    font-weight: 700;
                }
                .nav-tab.active:hover { color: #ff944d; border-color: #ff944d; background-color: rgba(235, 131, 52, 0.15); }
                
                /* --- AI Agent Toggle Button (NEW POPSICLE STYLE) --- */
                @keyframes orange-creme-pulse {
                    0% { box-shadow: 0 0 0 0 rgba(235, 131, 52, 0.7); }
                    70% { box-shadow: 0 0 0 10px rgba(235, 131, 52, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(235, 131, 52, 0); }
                }

                #ai-mode-toggle {
                    background-color: var(--ai-primary-orange);
                    color: #111827; /* Dark text for contrast */
                    width: 3rem; 
                    height: 3rem;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.1rem;
                    font-weight: 700;
                    cursor: pointer;
                    border: 3px solid var(--ai-creme); /* Creme border */
                    box-shadow: 0 0 15px rgba(235, 131, 52, 0.8);
                    transition: all 0.2s ease-in-out;
                    font-family: var(--geist-font);
                    position: relative;
                }
                #ai-mode-toggle:hover {
                    background-color: #ff944d; /* Lighter orange on hover */
                    box-shadow: 0 0 20px #ff944d, 0 0 30px rgba(235, 131, 52, 0.5);
                    transform: scale(1.05);
                }
                
                /* Pulse effect when active/new for visual cue */
                #ai-mode-toggle.active {
                    animation: orange-creme-pulse 2s infinite;
                }


                /* --- AI Agent Modal Styles (Updated with Orange/Creme) --- */
                .ai-modal {
                    position: fixed;
                    bottom: 2rem; right: 2rem;
                    width: min(90vw, 24rem);
                    height: min(80vh, 32rem);
                    background: var(--ai-background-dark);
                    border: 1px solid var(--ai-primary-orange); /* Orange outline for modal */
                    border-radius: 0.75rem;
                    box-shadow: 0 5px 25px rgba(0,0,0,0.7), 0 0 20px rgba(235, 131, 52, 0.2);
                    z-index: 1001;
                    display: flex;
                    flex-direction: column;
                    transition: transform 0.3s ease-out, opacity 0.3s ease-out;
                    transform: scale(0.95);
                    opacity: 0;
                    pointer-events: none;
                    font-family: var(--geist-font);
                }
                .ai-modal.active {
                    transform: scale(1);
                    opacity: 1;
                    pointer-events: auto;
                }
                
                /* Modal Header (Playfair hint in header) */
                .ai-header {
                    padding: 0.75rem 1rem;
                    background: #111827; /* Near black for contrast */
                    color: var(--ai-creme);
                    border-bottom: 1px solid rgba(235, 131, 52, 0.5);
                    border-top-left-radius: 0.75rem;
                    border-top-right-radius: 0.75rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-family: var(--playfair-font); 
                    font-weight: 600;
                    font-size: 1.1rem;
                }
                
                /* Chat Messages */
                .ai-chat-area { flex-grow: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
                .ai-chat-message {
                    max-width: 85%;
                    padding: 0.6rem 0.9rem;
                    border-radius: 0.75rem;
                    font-size: 0.9rem;
                    line-height: 1.4;
                }
                .ai-user-message {
                    align-self: flex-end;
                    background: var(--ai-primary-orange); /* User message in Orange */
                    color: #111827; /* Dark text for contrast */
                    border-bottom-right-radius: 0;
                }
                .ai-agent-message {
                    align-self: flex-start;
                    background: #2f3e53; /* Darker slate for agent bubble */
                    color: var(--ai-text-light); 
                    border-bottom-left-radius: 0;
                }
                .ai-loading-indicator { font-style: italic; color: #9ca3af; align-self: flex-start; padding-left: 0.75rem; }
                
                /* Input Area */
                .ai-input-area {
                    padding: 0.75rem 1rem;
                    border-top: 1px solid #374151;
                    background-color: #111827;
                    border-bottom-left-radius: 0.75rem;
                    border-bottom-right-radius: 0.75rem;
                }
                .ai-input-area form { display: flex; gap: 0.5rem; }
                .ai-input-area textarea {
                    flex-grow: 1; 
                    background: var(--ai-background-dark); 
                    border: 1px solid rgba(235, 131, 52, 0.3); 
                    color: var(--ai-creme); 
                    padding: 0.5rem; 
                    border-radius: 0.5rem; 
                    resize: none; 
                    height: 2.5rem; 
                    overflow-y: hidden; 
                    font-family: var(--geist-font);
                }
                .ai-input-area button { 
                    background: var(--ai-primary-orange); 
                    color: #111827; 
                    padding: 0.5rem 1rem; 
                    border-radius: 0.5rem; 
                    transition: background 0.2s; 
                    min-width: 5rem; 
                    font-family: var(--geist-font);
                    font-weight: 600;
                    border: none;
                }
                .ai-input-area button:hover { background: #ff944d; }

                /* Agent Selector */
                .ai-agent-select { 
                    background: #1f2937; 
                    color: var(--ai-creme); 
                    border: 1px solid var(--ai-primary-orange); 
                    border-radius: 0.375rem; 
                    padding: 0.25rem 0.5rem; 
                    font-size: 0.8rem; 
                    cursor: pointer; 
                    margin-right: 0.5rem; 
                    appearance: none; 
                    font-family: var(--geist-font);
                    /* Update SVG color for the dropdown arrow to creme */
                    background-image: url('data:image/svg+xml;utf8,<svg fill="%23fff1d4" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>');
                    background-repeat: no-repeat;
                    background-position: right 0.5rem center;
                    padding-right: 1.5rem;
                }
            `;
            document.head.appendChild(style);
        };

        // --- 4. FIREBASE AUTH LISTENER ---
        auth.onAuthStateChanged(async (user) => {
            const isPrivilegedUser = user && user.email === PRIVILEGED_EMAIL;
            if (user) {
                // User is signed in. Fetch user data from Firestore.
                try {
                    // Use Firestore to fetch user data if needed (e.g., username, profile pic URL)
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
                    if (error.code !== 'auth/operation-not-allowed') {
                        console.error("Anonymous sign-in error:", error);
                    }
                });
            }
        });

        // --- 5. RENDER THE NAVBAR ---
        const renderNavbar = (user, userData, pages, isPrivilegedUser) => {
            // Get the current URL path to determine the active tab
            const currentPath = window.location.pathname.replace(/\/$/, '');
            let navContent = '';
            
            // --- Tabs Section ---
            let tabsHtml = '';
            if (pages && Array.isArray(pages.tabs)) {
                tabsHtml = pages.tabs.map(tab => {
                    // Check if the tab's path matches the current path
                    const isActive = tab.path.replace(/\/$/, '') === currentPath;
                    const iconClass = getIconClass(tab.icon);
                    return `
                        <a href="${tab.path}" class="nav-tab ${isActive ? 'active' : ''}">
                            ${iconClass ? `<i class="${iconClass}" style="margin-right: 0.5rem;"></i>` : ''}
                            ${tab.title}
                        </a>
                    `;
                }).join('');
            }
            
            const dropdownOpen = document.getElementById('auth-menu-container') ? document.getElementById('auth-menu-container').classList.contains('open') : false;

            // --- User/Auth Section ---
            let authHtml = '';
            if (user && user.isAnonymous === false) {
                const displayName = user.displayName || user.email || 'User';
                const firstInitial = displayName ? displayName[0].toUpperCase() : '?';
                const avatar = user.photoURL ? 
                    `<img src="${user.photoURL}" alt="Avatar" class="w-full h-full object-cover rounded-full" onerror="this.onerror=null; this.src='https://placehold.co/40x40/374151/ffffff?text=${firstInitial}'">` :
                    `<div class="initial-avatar w-full h-full rounded-full text-lg">${firstInitial}</div>`;

                authHtml = `
                    <button id="auth-toggle" class="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-600 hover:border-white transition-colors">
                        ${avatar}
                    </button>
                    <div id="auth-menu-container" class="auth-menu-container ${dropdownOpen ? 'open' : 'closed'}">
                        <div class="px-3 py-2 border-b border-gray-700">
                            <p class="text-sm font-medium text-white">${displayName}</p>
                            <p class="text-xs text-gray-400">${user.email}</p>
                        </div>
                        <a href="/profile" class="auth-menu-link">
                            <i class="fa-solid fa-user w-5 text-gray-400"></i> My Profile
                        </a>
                        <button id="sign-out-button" class="auth-menu-button">
                            <i class="fa-solid fa-right-from-bracket w-5 text-gray-400"></i> Sign Out
                        </button>
                    </div>
                `;
            } else {
                // Logged out or Anonymous User
                authHtml = `
                    <button id="sign-in-up-toggle" class="logged-out-auth-toggle text-gray-300 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
                        <i class="fa-solid fa-arrow-right-to-bracket mr-2"></i> Log In / Sign Up
                    </button>
                `;
            }

            // --- Full Navigation Bar HTML ---
            navContent = `
                <div class="auth-navbar">
                    <nav>
                        <a href="/" class="text-xl font-bold text-white tracking-wider" style="font-family: var(--playfair-font);"><i class="fa-solid fa-layer-group text-gray-400 mr-2"></i>APP</a>
                        
                        <!-- Tabs Scroll Container -->
                        <div class="tab-wrapper">
                            <button id="glide-left" class="scroll-glide-button hidden"><i class="fa-solid fa-angle-left"></i></button>
                            <div id="tab-scroll-container" class="tab-scroll-container">
                                ${tabsHtml}
                            </div>
                            <button id="glide-right" class="scroll-glide-button"><i class="fa-solid fa-angle-right"></i></button>
                        </div>

                        <!-- AI Mode Toggle & Auth -->
                        <div class="flex items-center gap-4">
                            <!-- AI Mode Toggle Button -->
                            ${isPrivilegedUser ? 
                                `<button id="ai-mode-toggle" title="Toggle AI Agent"><i class="fa-solid fa-wand-magic-sparkles"></i></button>` : 
                                `<button id="ai-mode-toggle" title="AI Mode (User Access Required)" disabled style="cursor: not-allowed; opacity: 0.5;"><i class="fa-solid fa-lock"></i></button>`
                            }

                            <!-- Auth Toggle -->
                            ${authHtml}
                        </div>
                    </nav>
                </div>
            `;

            // Inject the navbar HTML
            const navbarContainer = document.getElementById('navbar-container');
            if (navbarContainer) {
                navbarContainer.innerHTML = navContent;
                attachEventListeners(user, isPrivilegedUser);
            }
        };

        // --- 6. AI AGENT LOGIC ---

        const sendMessage = async (user, chatArea, prompt) => {
            if (!prompt.trim()) return;

            const apiKey = FIREBASE_CONFIG.apiKey;
            const apiUrl = GEMINI_API_URL + apiKey;

            // 1. Add user message to chat
            const userMessage = document.createElement('div');
            userMessage.className = 'ai-chat-message ai-user-message';
            userMessage.textContent = prompt;
            chatArea.appendChild(userMessage);
            chatArea.scrollTop = chatArea.scrollHeight;

            // 2. Add loading indicator
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'ai-loading-indicator';
            loadingIndicator.textContent = 'Agent is thinking...';
            chatArea.appendChild(loadingIndicator);
            chatArea.scrollTop = chatArea.scrollHeight;

            // 3. Prepare system prompt (Agent Persona + Context)
            const agentPersona = AGENT_CATEGORIES[currentAgent] || AGENT_CATEGORIES.Standard;
            const systemInfo = await getSystemInfo(); // Get local time/location
            
            const systemPrompt = `
                You are the specified AI Agent. Follow the persona strictly: ${agentPersona}.
                The user's environment details are: ${systemInfo.location}, ${systemInfo.time}, ${systemInfo.timezone}.
                The user has asked the following:
            `;

            const payload = {
                contents: [{ parts: [{ text: prompt }] }],
                tools: [{ google_search: {} }], // Enable Google Search grounding
                systemInstruction: {
                    parts: [{ text: systemPrompt }]
                }
            };

            const retryFetch = async (url, options, retries = 3) => {
                for (let i = 0; i < retries; i++) {
                    try {
                        const response = await fetch(url, options);
                        if (!response.ok) {
                            if (response.status === 429 && i < retries - 1) { // 429 Too Many Requests
                                const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
                                await new Promise(res => setTimeout(res, delay));
                                continue;
                            }
                            throw new Error(`HTTP error! Status: ${response.status}`);
                        }
                        return response;
                    } catch (error) {
                        if (i === retries - 1) throw error;
                    }
                }
            };

            try {
                const response = await retryFetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();
                const candidate = result.candidates?.[0];

                let agentText = 'I encountered an error generating a response.';
                
                if (candidate && candidate.content?.parts?.[0]?.text) {
                    agentText = candidate.content.parts[0].text;
                }

                // 4. Remove loading indicator
                loadingIndicator.remove();

                // 5. Add Agent message to chat
                const agentMessage = document.createElement('div');
                agentMessage.className = 'ai-chat-message ai-agent-message';
                agentMessage.innerHTML = agentText.replace(/\n/g, '<br>'); // Simple newline formatting
                chatArea.appendChild(agentMessage);
                chatArea.scrollTop = chatArea.scrollHeight;

            } catch (error) {
                console.error("Gemini API call failed:", error);
                loadingIndicator.textContent = 'Error: Could not connect to AI Agent.';
                loadingIndicator.style.color = 'red';
                loadingIndicator.className = 'ai-chat-message ai-agent-message';
            }
        };

        // --- 7. ATTACH EVENT LISTENERS ---
        const attachEventListeners = (user, isPrivilegedUser) => {
            const authToggle = document.getElementById('auth-toggle');
            const authMenu = document.getElementById('auth-menu-container');
            const signOutButton = document.getElementById('sign-out-button');
            const signInUpToggle = document.getElementById('sign-in-up-toggle');
            const aiModeToggle = document.getElementById('ai-mode-toggle');
            const scrollContainer = document.getElementById('tab-scroll-container');
            const glideLeft = document.getElementById('glide-left');
            const glideRight = document.getElementById('glide-right');

            // --- Auth Dropdown Listener ---
            if (authToggle && authMenu) {
                authToggle.onclick = (e) => {
                    e.stopPropagation();
                    authMenu.classList.toggle('open');
                    authMenu.classList.toggle('closed');
                };
                document.body.onclick = () => {
                    if (authMenu.classList.contains('open')) {
                        authMenu.classList.remove('open');
                        authMenu.classList.add('closed');
                    }
                };
            }

            // --- Sign Out Listener ---
            if (signOutButton) {
                signOutButton.onclick = () => {
                    auth.signOut().then(() => {
                        console.log("User signed out successfully.");
                    }).catch((error) => {
                        console.error("Sign out error:", error);
                    });
                };
            }
            
            // --- Sign In/Up Listener (Placeholder) ---
            if (signInUpToggle) {
                signInUpToggle.onclick = () => {
                    alert('Please implement your full sign-in/sign-up logic.');
                };
            }

            // --- Tab Scrolling Listeners ---
            const checkScroll = () => {
                if (scrollContainer) {
                    const { scrollLeft, scrollWidth, clientWidth } = scrollContainer;
                    glideLeft.classList.toggle('hidden', scrollLeft === 0);
                    glideRight.classList.toggle('hidden', scrollLeft + clientWidth >= scrollWidth - 5); // 5px tolerance
                }
            };

            const scrollDebounced = debounce(checkScroll, 100);

            if (scrollContainer) {
                scrollContainer.addEventListener('scroll', scrollDebounced);
                window.addEventListener('resize', scrollDebounced);
                // Initial check after content is rendered
                setTimeout(checkScroll, 0); 
            }
            if (glideLeft) {
                glideLeft.onclick = () => scrollContainer.scrollBy({ left: -200, behavior: 'smooth' });
            }
            if (glideRight) {
                glideRight.onclick = () => scrollContainer.scrollBy({ left: 200, behavior: 'smooth' });
            }


            // --- AI MODE (MODAL) LOGIC ---
            if (aiModeToggle && isPrivilegedUser) {
                // 1. Create the AI Modal if it doesn't exist
                if (!document.getElementById('ai-modal')) {
                    const aiModal = document.createElement('div');
                    aiModal.id = 'ai-modal';
                    aiModal.className = 'ai-modal';
                    aiModal.innerHTML = `
                        <div class="ai-header">
                            <span style="font-size: 0.9rem; color: var(--ai-creme);">AI Agent Mode</span>
                            <select id="ai-agent-select" class="ai-agent-select">
                                ${Object.keys(AGENT_CATEGORIES).map(agent => 
                                    `<option value="${agent}" ${agent === currentAgent ? 'selected' : ''}>${agent}</option>`
                                ).join('')}
                            </select>
                            <button id="ai-modal-close" style="background: none; border: none; color: var(--ai-creme); font-size: 1.2rem; cursor: pointer;">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <div id="ai-chat-area" class="ai-chat-area">
                            <div class="ai-chat-message ai-agent-message">
                                Hello! I'm the ${currentAgent} Agent. Ask me anything to get started. My current persona: ${AGENT_CATEGORIES[currentAgent]}
                            </div>
                        </div>
                        <div class="ai-input-area">
                            <form id="ai-chat-form">
                                <textarea id="ai-input" placeholder="Ask your agent..." rows="1"></textarea>
                                <button type="submit" id="ai-send-button"><i class="fa-solid fa-paper-plane"></i> Send</button>
                            </form>
                        </div>
                    `;
                    document.body.appendChild(aiModal);
                    
                    // Attach modal-specific listeners
                    const chatForm = document.getElementById('ai-chat-form');
                    const chatInput = document.getElementById('ai-input');
                    const chatArea = document.getElementById('ai-chat-area');
                    const agentSelect = document.getElementById('ai-agent-select');

                    // Auto-resize textarea
                    const resizeTextarea = () => {
                        chatInput.style.height = 'auto';
                        chatInput.style.height = (chatInput.scrollHeight) + 'px';
                    };
                    chatInput.addEventListener('input', resizeTextarea);

                    // Form Submission
                    chatForm.onsubmit = (e) => {
                        e.preventDefault();
                        sendMessage(user, chatArea, chatInput.value);
                        chatInput.value = '';
                        resizeTextarea(); // Reset size
                    };
                    
                    // Agent Select Change
                    agentSelect.onchange = (e) => {
                        currentAgent = e.target.value;
                        const initialMessage = document.createElement('div');
                        initialMessage.className = 'ai-chat-message ai-agent-message';
                        initialMessage.innerHTML = `Switching to <b>${currentAgent} Agent</b>. Persona: ${AGENT_CATEGORIES[currentAgent]}`;
                        chatArea.appendChild(initialMessage);
                        chatArea.scrollTop = chatArea.scrollHeight;
                        aiModeToggle.classList.add('active'); // Re-trigger pulse effect
                        setTimeout(() => aiModeToggle.classList.remove('active'), 2000); // Stop after a pulse cycle
                    };
                    
                    // Close button
                    document.getElementById('ai-modal-close').onclick = () => {
                        aiModal.classList.remove('active');
                        aiModeToggle.classList.remove('active');
                    };
                }

                // 2. Toggle button listener
                aiModeToggle.onclick = () => {
                    const aiModal = document.getElementById('ai-modal');
                    aiModal.classList.toggle('active');
                    aiModeToggle.classList.toggle('active', aiModal.classList.contains('active'));
                    
                    // Focus on input when opened
                    if (aiModal.classList.contains('active')) {
                        document.getElementById('ai-input').focus();
                    }
                };
            }
        };

        // --- FINAL SETUP ---
        // Create a div for the navbar to live in if it doesn't exist.
        if (!document.getElementById('navbar-container')) {
            const navbarDiv = document.createElement('div');
            navbarDiv.id = 'navbar-container';
            document.body.prepend(navbarDiv);
        }
        // Inject styles before anything else is rendered for best stability
        injectStyles();
    };

    // --- START THE PROCESS ---
    document.addEventListener('DOMContentLoaded', run);

})();
