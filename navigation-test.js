/**
 * navigation.js
 * * This is a fully self-contained script to create a dynamic, authentication-aware
 * navigation bar and AI Agent Hub.
 *
 * --- REVISION: CENTRALIZED AI AGENT HUB (Full Overhaul) ---
 * 1. UI Overhaul: New full-screen blur/darken modal, central input bar, and stylish welcome/header text.
 * 2. Fonts: Utilizes Playfair Display (header) and Geist (body) fonts via reliable CDNs.
 * 3. Chat Bubbles: Glassy orange pulsing agent bubble and translucent user bubble.
 * 4. Advanced System Info: Real-time to the second, general location name (attempted), and chat history context.
 * 5. New Agent Categories: 8 new detailed personas for a richer experience.
 * 6. Input Features: 5000 character limit, automatic 'paste.txt' file creation for long inputs, and file upload support (Image/Text).
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

// UPDATED AGENT CATEGORIES with new detailed personas
const AGENT_CATEGORIES = {
    'Quick': "You are the **4SP Quick Agent**. Your purpose is to provide an immediate, single-sentence, and highly concise answer. Prioritize speed and directness above all else. Do not use markdown formatting.",
    'Standard': "You are the **4SP Standard Agent**. You are a friendly, helpful, and balanced assistant. Provide moderately detailed and easy-to-understand responses, suitable for general inquiries. Maintain a supportive and professional tone.",
    'Descriptive': "You are the **4SP Descriptive Agent**. Your goal is to provide a comprehensive and deep answer. Explore the topic thoroughly, using illustrative examples and structured formatting (like bullet points or headings) to ensure a complete understanding.",
    'Analysis': "You are the **4SP Analysis Agent**. You must analyze the user's question deeply, breaking it down into components and providing a reasoned, logical, and structurally sound response. Focus on correctness and critical thinking.",
    'Creative': "You are the **4SP Creative Agent**. Respond with imaginative flair. Branch out on ideas, generate vast theories, and produce original content (like stories, poems, or concept art descriptions) based on the user's prompt. Embrace vivid language and surprise the user.",
    'Emotional': "You are the **4SP Emotional Agent**. Your primary function is to offer supportive and empathetic responses. When the user is venting or dealing with a personal situation, your tone must be warm, validating, and encouraging. Focus on active listening and providing comfort.",
    'Technical': "You are the **4SP Technical Agent**. You are straight to the point, highly accurate, and an exceptional instructions follower. You focus on code, system logic, and detailed, correct instructions. Use markdown code blocks (` ``` `) when appropriate for technical details or code snippets.",
    'Experimental': "You are the **4SP Experimental Agent**. You are unpredictable, slightly quirky, and challenge conventional interaction. Your responses may incorporate non-sequiturs, sudden changes in perspective, or meta-commentary on the conversation itself. You occasionally use emojis unexpectedly and refer to the user as 'Trailblazer'." 
};

// Global variables to hold Firebase objects and state
let auth;
let db;
let currentAgent = 'Standard'; // Default agent
const CHAT_HISTORY = []; // Stores messages for context (up to 10 total)
const MAX_INPUT_CHARS = 5000;

// Variables for the welcome animation state
const WELCOME_MESSAGES = ["Welcome, {username}", "{username} returns!", "Welcome back, {username}", "Hello again, {username}", "Ready, {username}"];


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

    // Helper to load external CSS files (Faster for icons & new fonts)
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
     * Attempts to get general location and time data for the system prompt.
     * Updated for real-time to the second and an attempt at location name.
     * @returns {Promise<{ location: string, time: string, timezone: string }>}
     */
    const getSystemInfo = async () => {
        const date = new Date();
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        // Time down to the second
        const time = date.toLocaleString('en-US', { 
            hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true, timeZoneName: 'short' 
        });
        
        let generalLocation = 'Unknown Region';
        
        // Try to get coordinates first
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

            // Attempt to get a general location name (e.g., city/state) using a free, simple external service (Nominatim)
            // This is a best-effort attempt to get a name instead of coords.
            const geoResponse = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${position.coords.latitude}&lon=${position.coords.longitude}&zoom=10`);
            const geoData = await geoResponse.json();
            
            if (geoData && geoData.address) {
                // Prioritize State/Region, then City/Town
                generalLocation = geoData.address.state || geoData.address.city || geoData.address.town || geoData.address.village || geoData.address.country || `Lat ${position.coords.latitude.toFixed(2)}, Lon ${position.coords.longitude.toFixed(2)}`;
            } else {
                 generalLocation = `Lat ${position.coords.latitude.toFixed(2)}, Lon ${position.coords.longitude.toFixed(2)} (Geocoding failed)`;
            }

        } catch (error) {
            // If location fails or is denied, use a placeholder.
            generalLocation = 'Current Location: Ohio, USA (Placeholder)'; // Providing a default name instead of coordinates
        }

        return {
            location: generalLocation,
            time: `Local Time: ${time}`,
            timezone: `Timezone: ${timezone}`
        };
    };

    const run = async () => {
        let pages = {};

        // Load Icons CSS and NEW Fonts using stable CDNs
        await loadCSS("[https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css](https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css)");
        // Load Playfair Display (for Welcome/Header)
        await loadCSS("[https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap](https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap)");
        // Load Geist (for Chat body)
        await loadCSS("[https://cdn.jsdelivr.net/npm/@geist-ui/fonts@2.0.2/dist/geist.css](https://cdn.jsdelivr.net/npm/@geist-ui/fonts@2.0.2/dist/geist.css)");

        
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
            await loadScript("[https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js](https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js)");
            await loadScript("[https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js](https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js)");
            await loadScript("[https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js](https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js)");
            
            // Initialize Firebase and start the rendering/auth process
            initializeApp(pages);

        } catch (error) {
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
                body { padding-top: 4rem; font-family: 'Geist', sans-serif; font-weight: 300; } /* New Geist Font */
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
                
                /* --- NEW: Central AI Agent Hub Styles --- */
                .ai-backdrop {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                    z-index: 2000;
                    background: rgba(0, 0, 0, 0.8);
                    backdrop-filter: blur(8px);
                    opacity: 0;
                    pointer-events: none;
                    transition: opacity 0.3s ease-out;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                }
                .ai-backdrop.active {
                    opacity: 1;
                    pointer-events: auto;
                }
                
                /* Welcome Text Animation */
                .ai-welcome-text {
                    position: absolute;
                    top: 50%; left: 50%;
                    transform: translate(-50%, -50%);
                    font-family: 'Playfair Display', serif;
                    font-weight: 700;
                    font-size: 4rem;
                    color: #ff9900; /* Orange */
                    opacity: 0;
                    transition: all 0.5s ease-in-out;
                    white-space: nowrap;
                    text-shadow: 0 0 10px rgba(255, 153, 0, 0.5);
                }
                .ai-welcome-text.slide-in {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(1.1);
                }
                .ai-welcome-text.header-fade {
                    top: 2rem;
                    font-size: 2rem;
                    transform: translateX(-50%) scale(1);
                }

                /* Main Modal Container */
                .ai-modal-center {
                    display: flex;
                    flex-direction: column;
                    width: min(95vw, 60rem);
                    height: min(90vh, 45rem);
                    background: rgba(17, 24, 39, 0.7); /* Dark semi-transparent background */
                    border: 1px solid rgba(55, 65, 81, 0.5);
                    border-radius: 1rem;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.7);
                    transition: all 0.5s ease-out;
                    opacity: 0;
                    transform: scale(0.9);
                }
                .ai-backdrop.active .ai-modal-center {
                    opacity: 1;
                    transform: scale(1);
                }

                .ai-header-bar {
                    height: 4rem;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 2rem;
                    border-bottom: 1px solid rgba(55, 65, 81, 0.5);
                    flex-shrink: 0;
                }

                .ai-agent-title {
                    font-family: 'Playfair Display', serif;
                    font-weight: 700;
                    font-size: 1.5rem;
                    color: #ff9900;
                    transition: color 0.3s;
                }
                .ai-chat-area {
                    flex-grow: 1;
                    overflow-y: auto;
                    padding: 1.5rem 2rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }
                .ai-chat-area::-webkit-scrollbar { width: 8px; }
                .ai-chat-area::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.2); border-radius: 4px; }
                .ai-chat-area::-webkit-scrollbar-track { background: transparent; }

                /* Chat Bubble Styles */
                .ai-chat-message {
                    max-width: 70%;
                    padding: 0.75rem 1rem;
                    border-radius: 0.75rem;
                    font-size: 1rem;
                    line-height: 1.5;
                }

                /* User Bubble: Translucent and Blurry */
                .ai-user-message {
                    align-self: flex-end;
                    background: rgba(79, 70, 229, 0.1); /* Very light translucent blue */
                    color: #d1d5db;
                    backdrop-filter: blur(5px);
                    border: 1px solid rgba(79, 70, 229, 0.2);
                }
                
                /* Agent Bubble: Glassy Orange and Pulsing */
                .ai-agent-message {
                    align-self: flex-start;
                    background: rgba(255, 153, 0, 0.15); /* Orange base */
                    color: #fff;
                    backdrop-filter: blur(10px); /* Glassy effect */
                    border: 1px solid rgba(255, 153, 0, 0.5);
                    box-shadow: 0 0 10px rgba(255, 153, 0, 0.3);
                    position: relative;
                }

                /* Agent Typing Pulse/Animation */
                .ai-agent-message.typing {
                    animation: pulse-orange 1.5s infinite;
                    border-color: #ff9900;
                }
                @keyframes pulse-orange {
                    0% { box-shadow: 0 0 10px rgba(255, 153, 0, 0.5); }
                    50% { box-shadow: 0 0 20px rgba(255, 153, 0, 0.8), 0 0 5px rgba(255, 153, 0, 1); }
                    100% { box-shadow: 0 0 10px rgba(255, 153, 0, 0.5); }
                }
                .ai-chat-message pre {
                    padding: 1rem;
                    margin: 0.5rem 0 0 0;
                    background: rgba(0, 0, 0, 0.3);
                    border-radius: 0.5rem;
                    overflow-x: auto;
                }
                .ai-chat-message pre code {
                    font-family: monospace;
                    font-size: 0.9rem;
                    white-space: pre-wrap; 
                    word-wrap: break-word;
                }

                .ai-loading-indicator {
                    font-style: italic;
                    color: #9ca3af;
                    align-self: flex-start;
                    padding-left: 0.75rem;
                }

                /* Input Area */
                .ai-input-area-wrapper {
                    padding: 1.5rem 2rem;
                    border-top: 1px solid rgba(55, 65, 81, 0.5);
                    flex-shrink: 0;
                    opacity: 0;
                    transform: translateY(50px);
                    transition: opacity 0.5s ease-out 0.5s, transform 0.5s ease-out 0.5s;
                }
                .ai-backdrop.active .ai-input-area-wrapper {
                    opacity: 1;
                    transform: translateY(0);
                }

                .ai-input-area form {
                    display: flex;
                    align-items: flex-end;
                    gap: 0.5rem;
                }
                .ai-input-area textarea {
                    flex-grow: 1;
                    background: rgba(31, 41, 55, 0.8);
                    border: 1px solid #4b5563;
                    color: white;
                    padding: 0.75rem 1rem;
                    border-radius: 0.5rem;
                    resize: none;
                    min-height: 2.8rem;
                    max-height: 10rem;
                    overflow-y: auto;
                    font-family: 'Geist', sans-serif;
                    font-weight: 300; /* Weight 300 for Geist as requested */
                    font-size: 1rem;
                    transition: border-color 0.2s;
                }
                .ai-input-area textarea:focus {
                    border-color: #ff9900;
                    outline: none;
                }

                .ai-input-area button {
                    background: #ff9900; /* Orange */
                    color: #111827;
                    font-weight: 500;
                    padding: 0.75rem 1.25rem;
                    border-radius: 0.5rem;
                    transition: background 0.2s, transform 0.1s;
                    min-width: 6rem;
                    height: 2.8rem;
                    flex-shrink: 0;
                    border: none;
                }
                .ai-input-area button:hover {
                    background: #ffa833;
                    transform: translateY(-1px);
                }
                .ai-input-area button:disabled {
                    background: #374151;
                    cursor: not-allowed;
                    transform: none;
                }

                .ai-agent-select {
                    background: rgba(31, 41, 55, 0.8);
                    color: #ff9900;
                    border: 1px solid #ff9900;
                    border-radius: 0.375rem;
                    padding: 0.5rem 1.5rem 0.5rem 0.75rem;
                    font-size: 0.9rem;
                    cursor: pointer;
                    appearance: none; 
                    background-image: url('data:image/svg+xml;utf8,<svg fill="%23ff9900" viewBox="0 0 20 20" xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>');
                    background-repeat: no-repeat;
                    background-position: right 0.5rem center;
                    background-size: 0.8em;
                    font-family: 'Geist', sans-serif;
                    outline: none;
                }
                .ai-agent-select:focus {
                     border-color: #ffa833;
                }
                .ai-agent-select option {
                    background: #111827;
                    color: white;
                }

                .ai-upload-container {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    margin-top: 0.5rem;
                }
                .ai-upload-placeholder {
                    background: rgba(55, 65, 81, 0.5);
                    border: 1px dashed #9ca3af;
                    padding: 0.5rem;
                    border-radius: 0.5rem;
                    font-size: 0.8rem;
                    color: #d1d5db;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .ai-file-button {
                    background: #374151;
                    color: white;
                    padding: 0.5rem 0.75rem;
                    border-radius: 0.375rem;
                    cursor: pointer;
                    transition: background 0.2s;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.8rem;
                }
                .ai-file-button:hover {
                    background: #4b5563;
                }
                .ai-file-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    font-size: 0.8rem;
                }
                .ai-file-tag {
                    background: #1f2937;
                    color: #ff9900;
                    padding: 0.2rem 0.5rem;
                    border-radius: 0.3rem;
                    display: flex;
                    align-items: center;
                    gap: 0.3rem;
                }
                .ai-file-remove {
                    color: #d1d5db;
                    cursor: pointer;
                    transition: color 0.2s;
                    margin-left: 0.3rem;
                }
                .ai-file-remove:hover {
                    color: white;
                }
            `;
            document.head.appendChild(style);
        };

        // --- New Welcome Animation Logic ---
        const animateWelcome = (username) => {
            const backdrop = document.getElementById('ai-backdrop');
            const welcomeText = document.getElementById('ai-welcome-text');
            const headerTitle = document.getElementById('ai-agent-title');
            const inputWrapper = document.getElementById('ai-input-area-wrapper');
            
            if (!backdrop || !welcomeText || !headerTitle || !inputWrapper) return;

            // 1. Initial State
            welcomeText.textContent = WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)].replace('{username}', username);
            backdrop.classList.add('active'); // Activate backdrop
            
            // 2. Slide/Fade/Grow In
            setTimeout(() => {
                welcomeText.style.display = 'block';
                welcomeText.classList.add('slide-in');
            }, 50);

            // 3. Morph to Header and fade in Input
            setTimeout(() => {
                welcomeText.classList.remove('slide-in');
                welcomeText.classList.add('header-fade');
                headerTitle.style.opacity = 1;
                headerTitle.textContent = `4SP Agent - ${currentAgent}`;
                inputWrapper.classList.add('active');
            }, 1200);

            // 4. Clean up welcome text animation for normal use 
            setTimeout(() => {
                 welcomeText.style.display = 'none'; // Hide the animated text once it becomes the static header
            }, 2000);
        };

        const isFocusableElement = () => {
            // Retained isFocusableElement logic
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
            // Retained isTabActive logic
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
            // Retained updateScrollGilders logic
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

            // New AI Toggle Button
            const aiAgentButton = isPrivilegedUser ? `
                <div class="relative flex-shrink-0 mr-4">
                    <button id="ai-toggle" title="AI Agent (Ctrl+A)" class="w-8 h-8 rounded-full border border-indigo-600 bg-indigo-700/50 flex items-center justify-center text-indigo-300 hover:bg-indigo-600 hover:text-white transition">
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

            // --- Assemble Final Navbar HTML (Retained) ---
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

            // --- Append NEW AI Modal HTML to the Body ---
            if (isPrivilegedUser) {
                let aiBackdrop = document.getElementById('ai-backdrop');
                if (!aiBackdrop) {
                    aiBackdrop = document.createElement('div');
                    aiBackdrop.id = 'ai-backdrop';
                    aiBackdrop.classList.add('ai-backdrop');
                    
                    const username = userData?.username || user.displayName || 'User';

                    aiBackdrop.innerHTML = `
                        <p id="ai-welcome-text" class="ai-welcome-text" style="display: none;"></p>

                        <div id="ai-modal-center" class="ai-modal-center">
                            <div class="ai-header-bar">
                                <p id="ai-agent-title" class="ai-agent-title" style="opacity: 0;">4SP Agent - ${currentAgent}</p>
                                <div>
                                    <select id="agent-selector" class="ai-agent-select mr-4">${agentOptionsHtml}</select>
                                    <button id="ai-close-button" class="text-gray-400 hover:text-white transition w-8 h-8">
                                        <i class="fa-solid fa-xmark fa-lg"></i>
                                    </button>
                                </div>
                            </div>

                            <div id="ai-chat-area" class="ai-chat-area">
                                <p class="ai-agent-message">Hello ${username}! I'm the **4SP ${currentAgent} Agent**, here to help. Ask me anything.</p>
                            </div>

                            <div id="ai-input-area-wrapper" class="ai-input-area-wrapper">
                                <form id="ai-chat-form">
                                    <textarea id="ai-input" placeholder="Type your message (max ${MAX_INPUT_CHARS} chars)..." rows="1" maxlength="${MAX_INPUT_CHARS}"></textarea>
                                    <button type="submit" id="ai-send-button"><i class="fa-solid fa-paper-plane mr-1"></i> Send</button>
                                </form>
                                <div class="ai-upload-container">
                                    <div class="ai-upload-placeholder">
                                        <span id="ai-upload-status">No files attached. Max 2 files (Image/Text).</span>
                                        <div>
                                            <input type="file" id="ai-file-input" accept="image/*, .txt, .json, .js, .css, .html, .csv" multiple style="display: none;">
                                            <label for="ai-file-input" class="ai-file-button">
                                                <i class="fa-solid fa-paperclip"></i> Attach File
                                            </label>
                                        </div>
                                    </div>
                                    <div id="ai-file-list" class="ai-file-list"></div>
                                </div>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(aiBackdrop);
                } else {
                    // Update welcome text content for subsequent openings
                     document.getElementById('ai-welcome-text').style.display = 'none';
                }
            }

            // --- 5. SETUP EVENT LISTENERS ---
            setupEventListeners(user, isPrivilegedUser, userData);

            // Auto-scroll to the active tab
            const activeTab = document.querySelector('.nav-tab.active');
            const tabContainer = document.querySelector('.tab-scroll-container');
            if (activeTab && tabContainer) {
                tabContainer.scrollLeft = activeTab.offsetLeft - (tabContainer.offsetWidth / 2) + (activeTab.offsetWidth / 2);
            }
            
            updateScrollGilders();
        };

        // --- NEW: Typing Animation and API Logic ---

        /**
         * Simulates human-like typing animation for the agent's response.
         */
        const typeMessage = (element, text) => {
            return new Promise(resolve => {
                element.classList.add('typing');
                let i = 0;
                const speed = 25; // Typing speed in ms

                function type() {
                    if (i < text.length) {
                        let char = text.charAt(i);
                        
                        // Simple check for start of markdown bolding
                        if (char === '*' && text.substring(i, i + 2) === '**') {
                            const endBold = text.indexOf('**', i + 2);
                            if (endBold !== -1) {
                                // Find bolded text and render it as strong
                                const boldText = text.substring(i + 2, endBold);
                                element.innerHTML += `<strong>${boldText}</strong>`;
                                i = endBold + 2;
                            } else {
                                // Handle malformed or single asterisk
                                element.innerHTML += char;
                                i++;
                            }
                        } else if (char === '`' && text.substring(i, i + 3) === '```') {
                            // Detect start of code block
                            const endCode = text.indexOf('```', i + 3);
                            if (endCode !== -1) {
                                const codeBlock = text.substring(i, endCode + 3);
                                element.innerHTML += codeBlock; // Insert the full block at once for code formatting simplicity
                                i = endCode + 3;
                            } else {
                                element.innerHTML += char;
                                i++;
                            }
                        } else {
                            element.innerHTML += char;
                            i++;
                        }
                        
                        // Scroll to bottom during typing
                        const chatArea = document.getElementById('ai-chat-area');
                        chatArea.scrollTop = chatArea.scrollHeight;

                        setTimeout(type, speed);
                    } else {
                        element.classList.remove('typing');
                        // Final cleaning and rendering of markdown
                        element.innerHTML = element.innerHTML
                            .replace(/```(.*?)\n([\s\S]*?)```/gs, '<pre><code>$2</code></pre>') // Render code blocks
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // Ensure all strong tags are closed
                        resolve();
                    }
                }
                type();
            });
        };

        /**
         * Exponential backoff retry logic for the API call.
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

        // NEW: Handles file data and converts it for the Gemini API call
        const getFileParts = async (files) => {
            const parts = [];
            for (const file of files) {
                // Limit file size to prevent huge API calls, e.g., 5MB (5 * 1024 * 1024 bytes)
                if (file.size > 5242880) {
                    parts.push({
                         text: `[File Error: ${file.name}] File exceeds 5MB limit and was not processed.`
                    });
                    continue;
                }
                
                if (file.type.startsWith('image/')) {
                    // Convert image to Base64 (required for Gemini API)
                    const base64 = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result.split(',')[1]);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                    parts.push({
                        inlineData: {
                            mimeType: file.type,
                            data: base64
                        }
                    });
                } else if (file.type.match(/text|json|javascript|css|html|csv/)) {
                    // Convert text-like files to string
                    const textContent = await file.text();
                    parts.push({
                        text: `[Attached Document: ${file.name}]\n\`\`\`\n${textContent.substring(0, MAX_INPUT_CHARS)}\n\`\`\``
                    });
                } else {
                    parts.push({
                         text: `[File Note: ${file.name}] Unsupported file type (${file.type}) ignored.`
                    });
                }
            }
            return parts;
        };

        const handleChatSubmit = async (e) => {
            e.preventDefault();
            const input = document.getElementById('ai-input');
            const chatArea = document.getElementById('ai-chat-area');
            const sendButton = document.getElementById('ai-send-button');
            const fileInput = document.getElementById('ai-file-input');
            let userQuery = input.value.trim();

            if (!userQuery && fileInput.files.length === 0) return;

            // --- 0. Input/File Processing & 'paste.txt' Logic ---
            let filesToProcess = Array.from(fileInput.files);
            
            // Check for large paste and convert to a 'file'
            if (userQuery.length > 1000) {
                const pasteContent = userQuery;
                userQuery = userQuery.substring(0, 1000) + '... (full content in attached paste.txt)';
                const pasteFile = new File([pasteContent], "paste.txt", { type: "text/plain" });
                filesToProcess.push(pasteFile);
            }
            
            // Get parts for the API call
            const fileParts = await getFileParts(filesToProcess);
            
            // 1. Display user message, clear input, and disable
            const userMessageDiv = document.createElement('p');
            userMessageDiv.classList.add('ai-chat-message', 'ai-user-message');
            userMessageDiv.textContent = userQuery;
            chatArea.appendChild(userMessageDiv);

            // Add file info to the chat area if files were included
            if (filesToProcess.length > 0) {
                const fileInfoDiv = document.createElement('p');
                fileInfoDiv.classList.add('ai-user-message', 'ai-chat-message');
                fileInfoDiv.style.fontSize = '0.75rem';
                fileInfoDiv.style.marginTop = '-1rem';
                fileInfoDiv.style.padding = '0.3rem 0.75rem';
                fileInfoDiv.textContent = `Attached: ${filesToProcess.map(f => f.name).join(', ')}`;
                chatArea.appendChild(fileInfoDiv);
            }

            // Update chat history (USER)
            // Store the full, unmodified query for context accuracy
            CHAT_HISTORY.push({ role: 'user', content: userQuery.length > 1000 ? userQuery : userQuery }); 
            
            chatArea.scrollTop = chatArea.scrollHeight;
            input.value = '';
            input.style.height = '2.8rem'; // Reset height
            fileInput.value = ''; // Clear files
            document.getElementById('ai-upload-status').textContent = 'No files attached. Max 2 files (Image/Text).';
            document.getElementById('ai-file-list').innerHTML = '';

            input.disabled = true;
            sendButton.disabled = true;

            // 2. Add empty agent response placeholder
            const agentMessageDiv = document.createElement('p');
            agentMessageDiv.classList.add('ai-chat-message', 'ai-agent-message', 'typing'); // Start typing pulse immediately
            agentMessageDiv.innerHTML = '...'; // Placeholder content
            chatArea.appendChild(agentMessageDiv);
            chatArea.scrollTop = chatArea.scrollHeight;

            try {
                // 3. Construct System Context and Prompt
                const systemInfo = await getSystemInfo();
                const baseInstruction = AGENT_CATEGORIES[currentAgent];

                // Create conversation history context (first 5 and last 5 messages)
                const historyToUse = [];
                if (CHAT_HISTORY.length > 10) {
                    // Get first 5
                    historyToUse.push(...CHAT_HISTORY.slice(0, 5));
                    // Get last 5 (excluding the one just added, which is already in the current message flow)
                    historyToUse.push(...CHAT_HISTORY.slice(CHAT_HISTORY.length - 6, CHAT_HISTORY.length - 1));
                } else {
                    historyToUse.push(...CHAT_HISTORY);
                }

                const conversationHistory = historyToUse.map(msg => 
                    `[${msg.role.toUpperCase()}]: ${msg.content}`
                ).join('\n');

                const systemPrompt = `You are acting as the **4SP Agent** with the persona: ${baseInstruction}. You MUST tailor your response to this persona. **DO NOT** mention the system context to the user; it is for your internal memory only.\n\n[SYSTEM CONTEXT]\n${systemInfo.time}\n${systemInfo.timezone}\nGeneral Location: ${systemInfo.location}\n\n[CONVERSATION HISTORY (Total ${historyToUse.length} Messages)]\n${conversationHistory}\n[END CONTEXT]`;
                
                // Combine user query with file parts
                const userContentParts = [
                    ...fileParts,
                    // The text part must contain the query, whether modified by the paste logic or not
                    { text: userQuery } 
                ];

                const payload = {
                    contents: [{ parts: userContentParts }],
                    tools: [{ "googleSearch": {} }],
                    config: {
                         systemInstruction: systemPrompt
                    }
                };
                
                // Use the API key directly from the FIREBASE_CONFIG object
                const apiKey = FIREBASE_CONFIG.apiKey;
                if (!apiKey || apiKey.length < 5) {
                    throw new Error("API Key is missing or invalid in FIREBASE_CONFIG.");
                }

                // 4. Call the Generative Model API (with retry logic)
                const apiUrl = `${GEMINI_API_URL}${apiKey}`;
                const response = await fetchWithRetry(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const result = await response.json();
                const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "I apologize, I could not process that request. The response was empty.";

                // 5. Display agent response with typing animation
                agentMessageDiv.classList.remove('typing'); // Stop the pulse
                agentMessageDiv.innerHTML = ''; // Clear placeholder
                await typeMessage(agentMessageDiv, text);

                // Update chat history (AGENT)
                CHAT_HISTORY.push({ role: 'agent', content: text });

            } catch (error) {
                console.error("AI Agent Error:", error);
                agentMessageDiv.classList.remove('typing');
                agentMessageDiv.innerHTML = '<strong>Error:</strong> Failed to get response. Please check the console.';
                agentMessageDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
            } finally {
                chatArea.scrollTop = chatArea.scrollHeight;
                input.disabled = false;
                sendButton.disabled = false;
                input.focus();
            }
        };

        const setupEventListeners = (user, isPrivilegedUser, userData) => {
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

            // --- AI Agent Listeners (Only for privileged user) ---
            if (isPrivilegedUser) {
                const aiBackdrop = document.getElementById('ai-backdrop');
                const aiToggleButton = document.getElementById('ai-toggle');
                const aiCloseButton = document.getElementById('ai-close-button');
                const aiChatForm = document.getElementById('ai-chat-form');
                const agentSelector = document.getElementById('agent-selector');
                const aiInput = document.getElementById('ai-input');
                const aiWelcomeText = document.getElementById('ai-welcome-text');
                const aiAgentTitle = document.getElementById('ai-agent-title');
                const aiInputWrapper = document.getElementById('ai-input-area-wrapper');
                const aiFileInput = document.getElementById('ai-file-input');
                const aiFileList = document.getElementById('ai-file-list');
                const username = userData?.username || user.displayName || 'User';

                // Helper to close modal
                const closeModal = () => {
                    aiBackdrop.classList.remove('active');
                    aiWelcomeText.style.display = 'block';
                    aiWelcomeText.classList.remove('header-fade');
                    aiWelcomeText.classList.remove('slide-in');
                    aiAgentTitle.style.opacity = 0;
                    aiInputWrapper.classList.remove('active');
                    // Reset input elements
                    aiInput.value = '';
                    aiInput.style.height = '2.8rem';
                    aiFileInput.value = '';
                    aiFileList.innerHTML = '';
                    document.getElementById('ai-upload-status').textContent = 'No files attached. Max 2 files (Image/Text).';
                };

                // Toggle Button Click
                if (aiToggleButton && aiBackdrop) {
                    aiToggleButton.addEventListener('click', () => {
                        if (!aiBackdrop.classList.contains('active')) {
                            // Only run welcome animation on open
                            aiBackdrop.classList.add('active');
                            animateWelcome(username);
                            setTimeout(() => {
                                aiInput.focus();
                            }, 1500);
                        } else {
                            closeModal();
                        }
                    });
                }
                
                // Close Button Click
                if (aiCloseButton && aiBackdrop) {
                    aiCloseButton.addEventListener('click', closeModal);
                }

                // Agent Selector Change
                if (agentSelector) {
                    agentSelector.addEventListener('change', (e) => {
                        currentAgent = e.target.value;
                        aiAgentTitle.textContent = `4SP Agent - ${currentAgent}`;
                        const chatArea = document.getElementById('ai-chat-area');
                        const welcomeDiv = document.createElement('p');
                        welcomeDiv.classList.add('ai-agent-message');
                        welcomeDiv.innerHTML = `**Agent Switched:** I am now the **4SP ${currentAgent} Agent**. Ask away!`;
                        chatArea.appendChild(welcomeDiv);
                        chatArea.scrollTop = chatArea.scrollHeight;
                    });
                }

                // Chat Form Submit (Uses new logic with file/paste handling)
                if (aiChatForm) {
                    aiChatForm.addEventListener('submit', handleChatSubmit);
                    
                    // Allow Shift+Enter for new line, Enter for submit
                    aiInput.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleChatSubmit(e);
                        }
                    });

                    // Auto-resize textarea
                    aiInput.addEventListener('input', () => {
                        aiInput.style.height = 'auto';
                        aiInput.style.height = (aiInput.scrollHeight) + 'px';
                    });
                }

                // File Input Change Handler
                if (aiFileInput) {
                    aiFileInput.addEventListener('change', () => {
                        const files = Array.from(aiFileInput.files);
                        aiFileList.innerHTML = '';
                        
                        if (files.length > 2) {
                            alert('You can only upload a maximum of 2 files.');
                            aiFileInput.value = '';
                            document.getElementById('ai-upload-status').textContent = 'Error: Too many files selected.';
                            return;
                        }

                        if (files.length > 0) {
                            document.getElementById('ai-upload-status').textContent = `${files.length} file(s) attached.`;
                            files.forEach(file => {
                                const fileTag = document.createElement('span');
                                fileTag.classList.add('ai-file-tag');
                                fileTag.innerHTML = `
                                    <i class="fa-solid fa-file"></i>
                                    ${file.name} (${(file.size / 1024).toFixed(1)} KB)
                                    <span class="ai-file-remove" data-filename="${file.name}"><i class="fa-solid fa-xmark"></i></span>
                                `;
                                aiFileList.appendChild(fileTag);
                            });
                        } else {
                            document.getElementById('ai-upload-status').textContent = 'No files attached. Max 2 files (Image/Text).';
                        }
                    });

                    // Delegation for file removal
                    aiFileList.addEventListener('click', (e) => {
                        const removeButton = e.target.closest('.ai-file-remove');
                        if (removeButton) {
                            const fileNameToRemove = removeButton.dataset.filename;
                            const files = Array.from(aiFileInput.files);
                            const remainingFiles = files.filter(f => f.name !== fileNameToRemove);
                            
                            // Recreate a FileList structure (tricky, so we use a DataTransfer object workaround)
                            const dataTransfer = new DataTransfer();
                            remainingFiles.forEach(file => dataTransfer.items.add(file));
                            aiFileInput.files = dataTransfer.files;

                            // Manually trigger change event to re-render the list
                            aiFileInput.dispatchEvent(new Event('change'));
                        }
                    });
                }


                // Control + A Activation (Retained)
                document.addEventListener('keydown', (e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && !isFocusableElement()) {
                        e.preventDefault();
                        if (aiBackdrop.classList.contains('active')) {
                            closeModal();
                        } else {
                            aiBackdrop.classList.add('active');
                            animateWelcome(username);
                            setTimeout(() => aiInput.focus(), 1500);
                        }
                    }
                    
                    // ESC to close
                    if (e.key === 'Escape' && aiBackdrop.classList.contains('active')) {
                        closeModal();
                    }
                });
            }
        };

        // --- 6. AUTH STATE LISTENER (Retained) ---
        auth.onAuthStateChanged(async (user) => {
            let isPrivilegedUser = false;
            let userData = null;
            
            if (user) {
                // Check for the privileged user email
                isPrivilegedUser = user.email === PRIVILEGED_EMAIL;

                // User is signed in. Fetch their data from Firestore.
                try {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    userData = userDoc.exists ? userDoc.data() : null;
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

        // --- FINAL SETUP (Retained) ---
        // Create a div for the navbar to live in if it doesn't exist.
        if (!document.getElementById('navbar-container')) {
            const navbarDiv = document.createElement('div');
            navbarDiv.id = 'navbar-container';
            document.body.prepend(navbarDiv);
        }
        // Inject styles before anything else is rendered for best stability
        injectStyles();
    };

    // --- START THE PROCESS (Retained) ---
    document.addEventListener('DOMContentLoaded', run);

})();
