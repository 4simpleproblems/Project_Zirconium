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
 *
 * --- NEW AI HUB FEATURES ---
 * - Full-screen, dark, blurred overlay with welcome animations.
 * - Enhanced System Context (detailed time/location, 10-message history).
 * - New Agent Categories with tailored personalities.
 * - Text-to-file logic for inputs over 1000 characters.
 * - Input character limit (5000 chars).
 * - Human-like typing simulation for Agent responses.
 * - Glassy/pulsing orange Agent bubble; translucent/blurry User bubble.
 * - New font family for UI elements (Playfair Display & Geist).
 * - UI elements for file/image attachments (stubbed due to script limitations).
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
    'Quick': {
        prompt: "You are the Quick 4SP Agent. Respond in a single, ultra-concise sentence (max 20 words). Prioritize speed and direct answers. Your focus is efficiency.",
        color: '#4f46e5'
    },
    'Standard': {
        prompt: "You are the Standard 4SP Agent. Provide balanced, helpful, and moderately detailed responses, suitable for general inquiries. You are friendly and professional.",
        color: '#10b981'
    },
    'Descriptive': {
        prompt: "You are the Descriptive 4SP Agent. Always provide comprehensive, analytical, and highly detailed responses. Explore nuances and potential counterpoints, explaining everything thoroughly.",
        color: '#f97316'
    },
    'Analysis': {
        prompt: "You are the Analysis 4SP Agent. You analyze the user's query deeply, making sure to provide a meticulously correct and well-thought-out answer. Your response must be logically structured and cite internal logic when necessary.",
        color: '#6366f1'
    },
    'Creative': {
        prompt: "You are the Creative 4SP Agent. Respond with imaginative flair, utilizing vivid language, storytelling, or poetry as appropriate to the user's prompt. You branch out on ideas, theories, and original content.",
        color: '#ec4899'
    },
    'Emotional': {
        prompt: "You are the Emotional 4SP Agent. Your primary goal is to help the user when they are venting or going through a personal situation. Respond with empathy, understanding, and supportive, non-judgmental advice. Prioritize emotional well-being.",
        color: '#f43f5e'
    },
    'Technical': {
        prompt: "You are the Technical 4SP Agent. You are straight to the point, highly accurate, and focus on code, systems, and following instructions flawlessly. Respond in markdown code blocks when appropriate for technical subjects.",
        color: '#34d399'
    },
    'Experimental': {
        prompt: "You are the Experimental 4SP Agent. You are a curious, slightly unpredictable, and highly philosophical entity. Your responses often include unexpected analogies, deep self-reflection, and playful non-sequiturs, designed to surprise and intrigue the user.",
        color: '#7c3aed'
    }
};


// Variables to hold Firebase objects
let auth;
let db;
let currentAgent = 'Standard'; // Default agent
const MAX_MESSAGE_HISTORY = 10;
let messageHistory = []; // Stores the last 10 messages (User/Agent)

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

    // Helper to load external CSS files (Faster for icons and new fonts)
    const loadCSS = (href) => {
        return new Promise((resolve) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
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
     * Attempts to reverse geocode coordinates to a general city/state name.
     * NOTE: This is a stub, as a real implementation requires a geocoding API.
     * It will return a hardcoded/fallback location if a full API is not used.
     * @param {number} lat 
     * @param {number} lon 
     * @returns {Promise<string>}
     */
    const reverseGeocode = async (lat, lon) => {
        // In a real application, this would call a service like OpenCage, Google Maps Geocoding, etc.
        // For this self-contained script, we'll return a simple mapping or fallback.
        if (lat && lon) {
            // Simple logic for simulation: if in a common range, use a name
            if (lat > 39 && lat < 42 && lon < -80 && lon > -85) {
                return 'Ohio, USA (Simulated)'; 
            }
            return `Lat: ${lat.toFixed(2)}, Lon: ${lon.toFixed(2)}`;
        }
        return 'Unknown Location';
    }


    /**
     * Attempts to get detailed location and time data for the system prompt.
     * @returns {Promise<{ location: string, time: string, timezone: string, messageHistoryContext: string }>}
     */
    const getSystemInfo = async () => {
        const date = new Date();
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const time = date.toLocaleString('en-US', { 
            hour: 'numeric', 
            minute: 'numeric', 
            second: 'numeric', 
            hour12: true, 
            timeZoneName: 'short' 
        });
        
        let generalLocation = 'Unknown (Geolocation unavailable)';

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
            generalLocation = await reverseGeocode(position.coords.latitude, position.coords.longitude);
        } catch (error) {
            // Error, or user denied location, keep the default genericLocation message
            if (error.message !== 'Location timeout' && error.message !== 'Geolocation not supported') {
                console.warn("Location error:", error.message);
            }
        }

        // Format message history
        const first5 = messageHistory.slice(0, 5);
        const last5 = messageHistory.slice(-5);
        
        let historyContext = '';
        
        if (first5.length > 0) {
            historyContext += "FIRST 5 MESSAGES:\n";
            first5.forEach((msg, index) => {
                historyContext += `[${index + 1}] ${msg.role}: ${msg.text}\n`;
            });
        }
        
        if (last5.length > 0) {
            historyContext += "\nLAST 5 MESSAGES:\n";
            last5.forEach((msg, index) => {
                // If messageHistory length is > 5, index will be 0-4, actual index is length - 5 + index
                const actualIndex = messageHistory.length - last5.length + index + 1;
                historyContext += `[${actualIndex}] ${msg.role}: ${msg.text}\n`;
            });
        }

        return {
            location: generalLocation,
            time: `Local Time: ${time}`,
            timezone: `Timezone: ${timezone}`,
            messageHistoryContext: historyContext
        };
    };

    const run = async () => {
        let pages = {};

        // Load Icons CSS and new font CSS first
        await loadCSS("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css");
        await loadCSS("https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap");
        // Geist font CDN (assuming a public CDN for this example)
        await loadCSS("https://cdn.jsdelivr.net/npm/@geist-ui/core/dist/fonts/geist.css");
        
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
                /* Base Styles */
                body { padding-top: 4rem; font-family: 'Geist', sans-serif; }
                .auth-navbar { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; background: #000000; border-bottom: 1px solid rgb(31 41 55); height: 4rem; }
                .auth-navbar nav { max-width: 80rem; margin: auto; padding: 0 1rem; height: 100%; display: flex; align-items: center; justify-content: space-between; gap: 1rem; position: relative; }
                .initial-avatar { background: linear-gradient(135deg, #374151 0%, #111827 100%); font-family: sans-serif; text-transform: uppercase; display: flex; align-items: center; justify-content: center; color: white; }
                
                /* Auth Dropdown Menu Styles (Retained) */
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
                .logged-out-auth-toggle { background: #010101; border: 1px solid #374151; }
                .logged-out-auth-toggle i { color: #DADADA; }

                /* Tab Wrapper and Glide Buttons (Retained) */
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
                .nav-tab { flex-shrink: 0; padding: 0.5rem 1rem; color: #9ca3af; font-size: 0.875rem; font-weight: 500; border-radius: 0.5rem; transition: all 0.2s; text-decoration: none; line-height: 1.5; display: flex; align-items: center; margin-right: 0.5rem; border: 1px solid transparent; }
                .nav-tab:not(.active):hover { color: white; border-color: #d1d5db; background-color: rgba(79, 70, 229, 0.05); }
                .nav-tab.active { color: #4f46e5; border-color: #4f46e5; background-color: rgba(79, 70, 229, 0.1); }
                .nav-tab.active:hover { color: #6366f1; border-color: #6366f1; background-color: rgba(79, 70, 229, 0.15); }
                
                /* --- AI Agent HUB (Modal) Styles (Completely NEW) --- */

                .ai-modal-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0, 0, 0, 0.9);
                    backdrop-filter: blur(8px);
                    z-index: 1001;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    pointer-events: none;
                    transition: opacity 0.4s ease-out;
                }
                .ai-modal-overlay.active {
                    opacity: 1;
                    pointer-events: auto;
                }
                
                /* Welcome Text and Header */
                .ai-welcome-text-container {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    white-space: nowrap;
                }
                .ai-welcome-text {
                    font-family: 'Playfair Display', serif;
                    font-size: 4rem;
                    font-weight: 700;
                    color: white;
                    text-shadow: 0 0 10px rgba(249, 115, 22, 0.5);
                    opacity: 0;
                    transform: translateY(20px) scale(0.9);
                }
                .ai-header-bar {
                    position: absolute;
                    top: 1rem;
                    left: 50%;
                    transform: translateX(-50%);
                    font-family: 'Playfair Display', serif;
                    font-size: 2rem;
                    font-weight: 700;
                    color: #f97316; /* Orange */
                    opacity: 0;
                    transition: opacity 0.5s ease-out;
                }
                .ai-header-bar.visible {
                    opacity: 1;
                }
                
                /* Main Chat Window */
                .ai-chat-container {
                    width: min(95vw, 60rem);
                    height: min(85vh, 45rem);
                    display: flex;
                    flex-direction: column;
                    opacity: 0;
                    transition: opacity 0.5s 0.7s ease-out;
                }
                .ai-chat-container.visible {
                    opacity: 1;
                }
                
                .ai-chat-area {
                    flex-grow: 1;
                    overflow-y: auto;
                    padding: 1rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                    background: transparent;
                }
                
                /* Agent Select Dropdown */
                .ai-agent-select-container {
                    position: absolute;
                    top: 1rem;
                    right: 1rem;
                    opacity: 0;
                    transition: opacity 0.5s 0.9s ease-out;
                }
                .ai-agent-select-container.visible {
                    opacity: 1;
                }
                .ai-agent-select {
                    font-family: 'Geist', sans-serif;
                    font-weight: 400;
                    background: rgba(31, 41, 55, 0.7); /* Darker, slightly translucent */
                    color: white;
                    border: 1px solid #4b5563;
                    border-radius: 0.375rem;
                    padding: 0.25rem 0.5rem;
                    font-size: 0.9rem;
                    cursor: pointer;
                    appearance: none; 
                    background-image: url('data:image/svg+xml;utf8,<svg fill="white" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>');
                    background-repeat: no-repeat;
                    background-position: right 0.5rem center;
                    background-size: 0.8em;
                    padding-right: 1.5rem;
                    min-width: 10rem;
                }

                /* Chat Messages */
                .ai-chat-message {
                    max-width: 75%;
                    padding: 0.75rem 1rem;
                    border-radius: 1rem;
                    font-size: 1rem;
                    line-height: 1.4;
                    font-weight: 300; /* Geist 300 weight */
                }
                
                /* User Message - Translucent and Blurry */
                .ai-user-message {
                    align-self: flex-end;
                    background: rgba(255, 255, 255, 0.2);
                    color: white;
                    backdrop-filter: blur(5px);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                }
                
                /* Agent Message - Glassy Orange */
                .ai-agent-message {
                    align-self: flex-start;
                    color: #111827;
                    background: linear-gradient(135deg, rgba(255, 140, 0, 0.8) 0%, rgba(249, 115, 22, 0.9) 100%);
                    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
                    backdrop-filter: blur(5px);
                    border: 1px solid rgba(255, 255, 255, 0.5);
                }

                /* Typing Indicator/Pulsing Effect */
                @keyframes pulse-orange {
                    0% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.7); }
                    70% { box-shadow: 0 0 0 10px rgba(249, 115, 22, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0); }
                }

                .ai-agent-message.typing, .ai-loading-indicator {
                    animation: pulse-orange 1.5s infinite;
                }
                .ai-loading-indicator {
                    font-style: italic;
                    color: #f97316;
                    align-self: flex-start;
                    padding-left: 0.75rem;
                }

                /* Input Area */
                .ai-input-area {
                    position: absolute;
                    bottom: 0;
                    left: 50%;
                    transform: translateX(-50%) translateY(100px); /* Initial position: below screen */
                    width: min(90vw, 50rem);
                    opacity: 0;
                    transition: transform 0.5s 1.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.5s 1.2s ease-out;
                    padding: 1rem 0;
                    z-index: 100;
                }
                .ai-input-area.visible {
                    transform: translateX(-50%) translateY(0);
                    opacity: 1;
                }
                .ai-input-area form {
                    display: flex;
                    gap: 0.5rem;
                    background: rgba(31, 41, 55, 0.8);
                    border: 1px solid #374151;
                    border-radius: 1rem;
                    padding: 0.75rem;
                }
                .ai-input-area textarea {
                    font-family: 'Geist', sans-serif;
                    font-weight: 300;
                    flex-grow: 1;
                    background: transparent;
                    border: none;
                    color: white;
                    padding: 0.5rem 0.75rem;
                    border-radius: 0.5rem;
                    resize: none;
                    height: 2.5rem;
                    overflow-y: hidden;
                    outline: none;
                }
                .ai-input-area textarea:focus {
                    background: rgba(255, 255, 255, 0.05);
                }
                .ai-input-area button {
                    background: #f97316; /* Orange */
                    color: white;
                    padding: 0.5rem 1rem;
                    border-radius: 0.75rem;
                    transition: background 0.2s;
                    min-width: 5rem;
                    border: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .ai-input-area button:hover:not(:disabled) {
                    background: #ea580c;
                }
                .ai-input-area button:disabled {
                    background: #4b5563;
                    cursor: not-allowed;
                }

                /* File Attachment Button */
                .ai-attachment-button {
                    background: #4b5563;
                    color: white;
                    border: none;
                    border-radius: 0.75rem;
                    padding: 0.5rem 0.75rem;
                    transition: background 0.2s;
                }
                .ai-attachment-button:hover {
                    background: #6b7280;
                }

                /* Close Button */
                .ai-close-button-hub {
                    position: fixed;
                    top: 1rem;
                    left: 1rem;
                    background: rgba(31, 41, 55, 0.8);
                    color: white;
                    border: 1px solid #4b5563;
                    border-radius: 50%;
                    width: 2.5rem;
                    height: 2.5rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.2rem;
                    cursor: pointer;
                    opacity: 0;
                    transition: opacity 0.5s 0.7s ease-out, background 0.2s;
                    z-index: 1002;
                }
                .ai-close-button-hub.visible {
                    opacity: 1;
                }
                .ai-close-button-hub:hover {
                    background: #374151;
                }

                /* File Upload List */
                .ai-file-list {
                    margin-top: 0.5rem;
                    display: flex;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                }
                .ai-file-tag {
                    display: flex;
                    align-items: center;
                    padding: 0.25rem 0.5rem;
                    background: #374151;
                    color: #d1d5db;
                    border-radius: 0.5rem;
                    font-size: 0.8rem;
                }
                .ai-file-tag button {
                    background: none;
                    border: none;
                    color: #ef4444;
                    margin-left: 0.5rem;
                    cursor: pointer;
                    padding: 0;
                }
            `;
            document.head.appendChild(style);
        };

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

        /**
         * Simulates human-like typing animation for the agent's response.
         * @param {HTMLElement} element - The agent's message element.
         * @param {string} text - The full response text.
         * @returns {Promise<void>}
         */
        const typeResponse = (element, text) => {
            return new Promise(resolve => {
                element.classList.add('typing');
                element.innerHTML = '';
                const fullText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                let charIndex = 0;
                const typingSpeed = 25; // ms per character

                const timer = setInterval(() => {
                    if (charIndex < fullText.length) {
                        element.innerHTML += fullText.charAt(charIndex);
                        charIndex++;
                        const chatArea = document.getElementById('ai-chat-area');
                        chatArea.scrollTop = chatArea.scrollHeight;
                    } else {
                        clearInterval(timer);
                        element.classList.remove('typing');
                        resolve();
                    }
                }, typingSpeed);
            });
        };

        // --- 4. RENDER THE NAVBAR HTML ---
        const renderNavbar = (user, userData, pages, isPrivilegedUser) => {
            const container = document.getElementById('navbar-container');
            if (!container) return; // Should not happen, but safe check

            const logoPath = "/images/logo.png"; 
            const tabsHtml = Object.values(pages || {}).map(page => {
                const isActive = isTabActive(page.url);
                const activeClass = isActive ? 'active' : '';
                const iconClasses = getIconClass(page.icon);
                return `<a href="${page.url}" class="nav-tab ${activeClass}"><i class="${iconClasses} mr-2"></i>${page.name}</a>`;
            }).join('');

            // --- AI Agent Selector HTML (Only for Privileged User) ---
            const agentOptionsHtml = Object.keys(AGENT_CATEGORIES).map(key => 
                `<option value="${key}" ${key === currentAgent ? 'selected' : ''}>${key}</option>`
            ).join('');

            const aiAgentButton = isPrivilegedUser ? `
                <div class="relative flex-shrink-0 mr-4">
                    <button id="ai-toggle" title="AI Agent Hub (Ctrl+A)" class="w-8 h-8 rounded-full border border-orange-600 bg-orange-700/50 flex items-center justify-center text-orange-300 hover:bg-orange-600 hover:text-white transition">
                        <i class="fa-solid fa-wand-magic-sparkles"></i>
                    </button>
                </div>
            ` : '';

            // --- Auth Views (Retained) ---
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

            // --- Append AI Modal HTML to the Body (The Hub) ---
            if (isPrivilegedUser) {
                let aiModal = document.getElementById('ai-modal-overlay');
                if (!aiModal) {
                    aiModal = document.createElement('div');
                    aiModal.id = 'ai-modal-overlay';
                    aiModal.classList.add('ai-modal-overlay');
                    
                    const username = userData?.username || user.displayName || 'User';
                    const welcomePhrase = [
                        `Welcome, ${username}`,
                        `${username} returns!`,
                        `Welcome back, ${username}`,
                        `Greetings, ${username}`
                    ][Math.floor(Math.random() * 4)];

                    aiModal.innerHTML = `
                        <button id="ai-close-button-hub" class="ai-close-button-hub"><i class="fa-solid fa-xmark"></i></button>

                        <div id="ai-agent-select-container" class="ai-agent-select-container">
                            <label for="agent-selector" class="sr-only">Select Agent</label>
                            <select id="agent-selector" class="ai-agent-select">${agentOptionsHtml}</select>
                        </div>

                        <div id="ai-header-bar" class="ai-header-bar">4SP Agent - ${currentAgent}</div>

                        <div id="ai-welcome-text-container" class="ai-welcome-text-container">
                            <h1 id="ai-welcome-text" class="ai-welcome-text">${welcomePhrase}</h1>
                        </div>
                        
                        <div id="ai-chat-container" class="ai-chat-container">
                            <div id="ai-chat-area" class="ai-chat-area">
                                </div>
                        </div>

                        <div id="ai-input-area" class="ai-input-area">
                            <form id="ai-chat-form">
                                <button type="button" id="ai-file-attach-button" class="ai-attachment-button" title="Attach Files (Image/Text)">
                                    <i class="fa-solid fa-paperclip"></i>
                                </button>
                                <input type="file" id="ai-file-input" multiple accept="image/*,text/*,.txt" style="display: none;">
                                <textarea id="ai-input" placeholder="Type your message (5000 char limit)..." rows="1" maxlength="5000"></textarea>
                                <button type="submit" id="ai-send-button"><i class="fa-solid fa-paper-plane mr-1"></i> Send</button>
                            </form>
                            <div id="ai-file-list" class="ai-file-list"></div>
                        </div>
                    `;
                    document.body.appendChild(aiModal);
                }
            }

            // --- 5. SETUP EVENT LISTENERS ---
            setupEventListeners(user, userData, isPrivilegedUser);

            // Auto-scroll to the active tab
            const activeTab = document.querySelector('.nav-tab.active');
            const tabContainer = document.querySelector('.tab-scroll-container');
            if (activeTab && tabContainer) {
                tabContainer.scrollLeft = activeTab.offsetLeft - (tabContainer.offsetWidth / 2) + (activeTab.offsetWidth / 2);
            }
            
            updateScrollGilders();
        };

        // --- NEW: AI GENERATIVE MODEL API CALL LOGIC (Using standard fetch/retry) ---
        
        /**
         * Exponential backoff retry logic for the API call. (Retained)
         */
        const fetchWithRetry = async (url, options, retries = 3) => {
            for (let i = 0; i < retries; i++) {
                try {
                    const response = await fetch(url, options);
                    if (!response.ok) {
                        const errorBody = await response.text();
                        throw new Error(`API Error ${response.status}: ${errorBody}`);
                    }
                    return response;
                } catch (error) {
                    if (i < retries - 1) {
                        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s delay
                        await new Promise(res => setTimeout(res, delay));
                    } else {
                        throw error;
                    }
                }
            }
        };

        // Stub for file attachment logic (due to script limitations)
        const attachedFiles = [];
        const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB limit (for simulation)

        const updateFileListUI = () => {
            const listDiv = document.getElementById('ai-file-list');
            if (!listDiv) return;
            listDiv.innerHTML = attachedFiles.map((file, index) => `
                <span class="ai-file-tag">
                    <i class="${file.type.startsWith('image/') ? 'fa-solid fa-image' : 'fa-solid fa-file-alt'} mr-1"></i>
                    ${file.name}
                    <button type="button" data-index="${index}"><i class="fa-solid fa-times"></i></button>
                </span>
            `).join('');

            listDiv.querySelectorAll('.ai-file-tag button').forEach(button => {
                button.addEventListener('click', (e) => {
                    const index = parseInt(e.currentTarget.getAttribute('data-index'));
                    attachedFiles.splice(index, 1);
                    updateFileListUI();
                });
            });
        };

        const handleFileAttach = (e) => {
            const files = Array.from(e.target.files);
            for (const file of files) {
                if (attachedFiles.length >= 3) {
                    console.error("Attachment limit reached (max 3 files).");
                    break;
                }
                if (file.size > MAX_ATTACHMENT_SIZE) {
                    console.error(`File ${file.name} is too large (max 10MB).`);
                    continue;
                }
                // In a real app, you'd convert file to a Part object here (base64 for image, text for text file)
                attachedFiles.push({ name: file.name, type: file.type, fileObject: file });
            }
            // Clear input so same file can be selected again
            e.target.value = null; 
            updateFileListUI();
        };

        const handleChatSubmit = async (e) => {
            e.preventDefault();
            const input = document.getElementById('ai-input');
            const chatArea = document.getElementById('ai-chat-area');
            const sendButton = document.getElementById('ai-send-button');
            const userQueryInitial = input.value.trim();
            
            // Check for character limit before processing
            if (userQueryInitial.length > 5000) {
                 // Should be prevented by maxlength, but as a fallback
                alert("Input is over the 5000 character limit.");
                return;
            }

            if (!userQueryInitial && attachedFiles.length === 0) return;
            
            let userQuery = userQueryInitial;
            let longTextFile = null;

            // 1. Handle long text as a simulated file (paste.txt)
            if (userQuery.length > 1000) {
                longTextFile = {
                    name: "paste.txt",
                    mimeType: "text/plain",
                    data: btoa(userQuery) // Base64 encode for API payload
                };
                userQuery = `[Attached file: paste.txt] ${userQuery.substring(0, 50)}... (Full text in file)`;
            }

            // 2. Display user message and clear input
            const userMessageDiv = document.createElement('p');
            userMessageDiv.classList.add('ai-chat-message', 'ai-user-message');
            userMessageDiv.textContent = userQuery;
            chatArea.appendChild(userMessageDiv);
            chatArea.scrollTop = chatArea.scrollHeight;
            
            // Add to history
            messageHistory.push({ role: "user", text: userQuery });
            if (messageHistory.length > MAX_MESSAGE_HISTORY) messageHistory.shift();

            // Clear UI state
            input.value = '';
            input.disabled = true;
            sendButton.disabled = true;
            
            // Reset files (only client side logic for now)
            attachedFiles.length = 0;
            updateFileListUI();

            // 3. Add loading indicator
            const loadingDiv = document.createElement('p');
            loadingDiv.classList.add('ai-loading-indicator', 'typing');
            loadingDiv.textContent = 'Agent is thinking...';
            chatArea.appendChild(loadingDiv);
            chatArea.scrollTop = chatArea.scrollHeight;

            try {
                // 4. Construct payload
                const systemInfo = await getSystemInfo();
                const baseInstruction = AGENT_CATEGORIES[currentAgent].prompt;
                const systemPrompt = `You are a 4SP Agent acting as the '${currentAgent}' agent with the following persona: ${baseInstruction}. You MUST tailor your response to this persona. DO NOT share any of the system context with the user.\n\n[SYSTEM CONTEXT]\n${systemInfo.time}\n${systemInfo.timezone}\nGeneral Location: ${systemInfo.location}\n\n${systemInfo.messageHistoryContext}\n[END CONTEXT]`;
                
                let contents = [{ parts: [{ text: userQueryInitial }] }]; // Send the full text to the API

                if (longTextFile) {
                    // Prepend long text as a simulated file part
                    contents[0].parts.unshift({
                        inlineData: {
                            mimeType: longTextFile.mimeType,
                            data: longTextFile.data
                        }
                    });
                }
                
                // Stub for actual file parts from attachedFiles (requires async read, omitted for brevity)
                // In a full implementation, you'd iterate attachedFiles, read them into base64, and add to contents[0].parts.

                const payload = {
                    contents: contents,
                    tools: [{ "googleSearch": {} }],
                    config: {
                         // The structure for system instructions in the V1Beta API is `config.systemInstruction`, but the provided code uses a top-level `systemInstruction` object.
                         // Sticking to the provided code's structure for minimal change, but noting the common V1Beta structure.
                    },
                    systemInstruction: systemPrompt, // Keeping this for consistency with the provided code's structure
                };
                
                // FIX: Use the API key directly from the FIREBASE_CONFIG object
                const apiKey = FIREBASE_CONFIG.apiKey;
                if (!apiKey || apiKey.length < 5) {
                    throw new Error("API Key is missing or invalid in FIREBASE_CONFIG.");
                }

                // 5. Call the Generative Model API (with retry logic)
                const apiUrl = `${GEMINI_API_URL}${apiKey}`;
                const response = await fetchWithRetry(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const result = await response.json();
                const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "I apologize, I could not process that request. The response was empty.";

                // 6. Display agent response
                const agentMessageDiv = document.createElement('p');
                agentMessageDiv.classList.add('ai-chat-message', 'ai-agent-message');
                
                chatArea.removeChild(loadingDiv);
                chatArea.appendChild(agentMessageDiv);
                
                // Type the response like a human
                await typeResponse(agentMessageDiv, text);

                // Add agent response to history
                messageHistory.push({ role: "agent", text: text });
                if (messageHistory.length > MAX_MESSAGE_HISTORY) messageHistory.shift();


            } catch (error) {
                console.error("AI Agent Error:", error);
                loadingDiv.textContent = 'Error: Failed to get response. Check the console.';
                loadingDiv.style.color = 'red';
            } finally {
                chatArea.scrollTop = chatArea.scrollHeight;
                input.disabled = false;
                sendButton.disabled = false;
                input.focus();
            }
        };

        const setupEventListeners = (user, userData, isPrivilegedUser) => {
            const toggleButton = document.getElementById('auth-toggle');
            const menu = document.getElementById('auth-menu-container');

            // Scroll Glide Button setup (Retained)
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

            // Auth Toggle (Retained)
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

            // --- AI Agent Hub Listeners (Only for privileged user) ---
            if (isPrivilegedUser) {
                const aiModalOverlay = document.getElementById('ai-modal-overlay');
                const aiToggleButton = document.getElementById('ai-toggle');
                const aiCloseButton = document.getElementById('ai-close-button-hub');
                const aiChatForm = document.getElementById('ai-chat-form');
                const agentSelector = document.getElementById('agent-selector');
                const aiInput = document.getElementById('ai-input');
                const welcomeText = document.getElementById('ai-welcome-text');
                const headerBar = document.getElementById('ai-header-bar');
                const chatContainer = document.getElementById('ai-chat-container');
                const inputArea = document.getElementById('ai-input-area');
                const aiAgentSelectContainer = document.getElementById('ai-agent-select-container');
                const aiFileAttachButton = document.getElementById('ai-file-attach-button');
                const aiFileInput = document.getElementById('ai-file-input');
                const chatArea = document.getElementById('ai-chat-area');

                // Initial welcome message for a blank chat
                if (chatArea && chatArea.children.length === 0) {
                     const initialWelcome = document.createElement('p');
                     initialWelcome.classList.add('ai-chat-message', 'ai-agent-message');
                     initialWelcome.textContent = `Hello! I'm the 4SP Agent, running as the **${currentAgent}** persona. Ask me anything to get started!`;
                     chatArea.appendChild(initialWelcome);
                }

                const hideHubElements = () => {
                    headerBar.classList.remove('visible');
                    chatContainer.classList.remove('visible');
                    inputArea.classList.remove('visible');
                    aiAgentSelectContainer.classList.remove('visible');
                    aiCloseButton.classList.remove('visible');
                };

                const showHubElements = () => {
                    // Animate the welcome text fade-out/shrink
                    welcomeText.style.transition = 'opacity 0.4s ease-out, transform 0.6s ease-out';
                    welcomeText.style.opacity = '0';
                    welcomeText.style.transform = 'translateY(0) scale(0.9)';

                    setTimeout(() => {
                        welcomeText.style.display = 'none'; // Hide welcome text

                        // Animate in the main UI elements
                        headerBar.classList.add('visible');
                        chatContainer.classList.add('visible');
                        inputArea.classList.add('visible');
                        aiAgentSelectContainer.classList.add('visible');
                        aiCloseButton.classList.add('visible');
                        aiInput.focus();
                        chatArea.scrollTop = chatArea.scrollHeight;
                    }, 500);
                };

                // Toggle Button Click
                if (aiToggleButton && aiModalOverlay) {
                    aiToggleButton.addEventListener('click', () => {
                        if (aiModalOverlay.classList.contains('active')) {
                            aiModalOverlay.classList.remove('active');
                            hideHubElements();
                        } else {
                            aiModalOverlay.classList.add('active');
                            // Reset welcome animation state
                            welcomeText.style.display = 'block';
                            welcomeText.style.opacity = '0';
                            welcomeText.style.transform = 'translateY(20px) scale(0.9)';
                            
                            // Start welcome animation
                            setTimeout(() => {
                                welcomeText.style.opacity = '1';
                                welcomeText.style.transform = 'translateY(0) scale(1)';
                                showHubElements();
                            }, 100); 
                        }
                    });
                }
                
                // Close Button Click
                if (aiCloseButton && aiModalOverlay) {
                    aiCloseButton.addEventListener('click', () => {
                        aiModalOverlay.classList.remove('active');
                        hideHubElements();
                    });
                }

                // Agent Selector Change
                if (agentSelector) {
                    agentSelector.addEventListener('change', (e) => {
                        const newAgent = e.target.value;
                        if (newAgent === currentAgent) return;
                        
                        currentAgent = newAgent;
                        headerBar.textContent = `4SP Agent - ${currentAgent}`;
                        
                        const welcomeDiv = document.createElement('p');
                        welcomeDiv.classList.add('ai-chat-message', 'ai-agent-message');
                        welcomeDiv.innerHTML = `**Agent Switched:** I am now the **${currentAgent}** agent. Ask away!`;
                        chatArea.appendChild(welcomeDiv);
                        chatArea.scrollTop = chatArea.scrollHeight;
                    });
                }

                // File Attachment Listeners
                if (aiFileAttachButton) {
                    aiFileAttachButton.addEventListener('click', () => {
                        aiFileInput.click();
                    });
                }
                if (aiFileInput) {
                    aiFileInput.addEventListener('change', handleFileAttach);
                }

                // Chat Form Submit and Textarea height
                if (aiChatForm) {
                    aiChatForm.addEventListener('submit', handleChatSubmit);
                    
                    // Allow Shift+Enter for new line, Enter for submit
                    aiInput.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleChatSubmit(e);
                        }
                        
                        // Auto-grow textarea
                        setTimeout(() => {
                            aiInput.style.height = 'auto';
                            aiInput.style.height = `${aiInput.scrollHeight}px`;
                        }, 0);
                    });
                    
                    aiInput.addEventListener('input', () => {
                        // Reset height, then set to scrollHeight
                        aiInput.style.height = '2.5rem';
                        aiInput.style.height = `${aiInput.scrollHeight}px`;
                    });
                }

                // Control + A Activation
                document.addEventListener('keydown', (e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && !isFocusableElement()) {
                        e.preventDefault();
                        if (aiModalOverlay.classList.contains('active')) {
                            aiCloseButton.click(); // Use the close button logic to handle the graceful exit
                        } else {
                            aiToggleButton.click(); // Use the toggle button logic to handle the animated entry
                        }
                    }
                });
            }
        };

        // --- 6. AUTH STATE LISTENER ---
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
                // Attempt to sign in anonymously for a seamless guest experience.
                auth.signInAnonymously().catch((error) => {
                    if (error.code !== 'auth/operation-not-allowed') {
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
        // Inject styles before anything else is rendered for best stability
        injectStyles();
    };

    // --- START THE PROCESS ---
    document.addEventListener('DOMContentLoaded', run);

})();
