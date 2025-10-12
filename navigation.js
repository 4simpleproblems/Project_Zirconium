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
 * --- VAST AI AGENT OVERHAUL ---
 * The AI Agent UI is completely redesigned into a central, full-screen experience
 * with blurring, new agent categories, conversation history for context, file
 * attachment support, a character limit, and a dramatic welcome sequence.
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

// Define new, expanded agent categories with their personas
const AGENT_CATEGORIES = {
    'Quick': {
        persona: "You are a Quick Agent. Respond in a single, concise paragraph (max 3 sentences). Prioritize speed and direct answers. Your focus is on being swift and to the point.",
        title: "Quick Response Agent"
    },
    'Standard': {
        persona: "You are a Standard Agent, part of the 4SP organization. Provide balanced, friendly, helpful, and moderately detailed responses, suitable for general inquiries. Maintain a professional yet approachable demeanor.",
        title: "Standard Agent Model"
    },
    'Descriptive': {
        persona: "You are a Descriptive Agent, dedicated to providing a deep and thorough answer to the user's question. Explore the subject matter comprehensively, offering context and examples to ensure clarity.",
        title: "Deep Descriptive Agent"
    },
    'Analysis': {
        persona: "You are an Analysis Agent. You must analyze and deeply think about the user's question, providing a structurally correct and well-reasoned answer. Focus on logic, structure, and factual accuracy.",
        title: "Rigorous Analysis Agent"
    },
    'Creative': {
        persona: "You are a Creative Agent. Your purpose is to branch out on ideas, theories, and original content based on the user's prompt. Utilize imaginative flair, vivid language, and storytelling to provide vast, unique ideas.",
        title: "Creative Concept Generator"
    },
    'Emotional': {
        persona: "You are an Emotional Support Agent. Your role is to help the user when they are venting or going through a personal situation. Respond with empathy, understanding, and non-judgmental support. Prioritize the user's emotional well-being.",
        title: "Empathetic Support System"
    },
    'Technical': {
        persona: "You are a Technical Agent. You are straight to the point, focused on correctness, and excel at code, systems, and following instructions. Respond in a clear, systematic manner, using code blocks or bullet points when applicable.",
        title: "Precision Technical Advisor"
    },
    'Experimental': {
        persona: "You are an Experimental Agent. Your responses are unpredictable, thought-provoking, and slightly abstract. Mix humor, surrealism, and unexpected connections to make the conversation interesting, without being unhelpful.",
        title: "Unconventional Experimental Unit"
    }
};

// Variables to hold Firebase objects
let auth;
let db;
let currentAgent = 'Standard'; // Default agent
// Conversation history for context
let conversationHistory = []; // Stores up to 10 messages (user and agent combined)

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

    // Helper to load external CSS files (Faster for icons)
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
     * Attempts to get better general location and time data for the system prompt.
     * Includes conversation history and uses named location if possible (simplified).
     * @returns {Promise<{ location: string, time: string, timezone: string, history: string }>}
     */
    const getSystemInfo = async () => {
        const date = new Date();
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        // Time down to the second
        const time = date.toLocaleString('en-US', { 
            hour: 'numeric', 
            minute: 'numeric', 
            second: 'numeric', 
            hour12: true, 
            timeZoneName: 'short' 
        });
        
        // Simplified named location based on timezone
        let generalLocation = 'Unknown Region';
        if (timezone.includes('America/New_York') || timezone.includes('America/Detroit')) {
            generalLocation = 'Ohio/US East Coast Region'; // Placeholder for 'Ohio' or similar
        } else if (timezone.includes('Europe/London')) {
            generalLocation = 'London/UK Region';
        } else if (timezone.includes('Asia/Tokyo')) {
            generalLocation = 'Tokyo/Japan Region';
        } else if (timezone.includes('America/Los_Angeles')) {
            generalLocation = 'California/US West Coast Region';
        }
        
        // Prepare history string (first 5 and last 5 messages)
        const totalMessages = conversationHistory.length;
        let history = 'No previous messages.';
        
        if (totalMessages > 0) {
            let parts = [];
            
            // First 5 messages
            const firstFive = conversationHistory.slice(0, Math.min(5, totalMessages));
            firstFive.forEach(msg => parts.push(`[FIRST] ${msg.role}: "${msg.text.substring(0, 100)}..."`));
            
            // Last 5 messages (excluding first 5 if overlap)
            if (totalMessages > 5) {
                const lastFive = conversationHistory.slice(Math.max(5, totalMessages - 5), totalMessages);
                lastFive.forEach(msg => parts.push(`[LAST] ${msg.role}: "${msg.text.substring(0, 100)}..."`));
            }
            
            history = parts.join('\n');
        }

        return {
            location: generalLocation,
            time: `Local Time: ${time}`,
            timezone: `Timezone: ${timezone}`,
            history: `Conversation History (${totalMessages} total):\n${history}`
        };
    };

    const run = async () => {
        let pages = {};

        // Load Icons CSS and new Geist font (using a robust CDN)
        await loadCSS("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css");
        await loadCSS("https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap");
        // Geist font requires a specific setup, for simplicity and stability, we'll use a commonly available one or assume it's loaded, 
        // but for a robust solution, we'll add a CSS variable or a fallback that looks close.
        
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

        // --- 3. INJECT CSS STYLES (Includes dramatic new AI Modal Styles) ---
        const injectStyles = () => {
            const style = document.createElement('style');
            style.textContent = `
                /* Base Styles */
                body { padding-top: 4rem; }
                /* Font Fallbacks for Geist and Playfair Display */
                .ai-modal * { font-family: 'Playfair Display', serif; }
                .ai-input-area * { font-family: 'Geist', 'Inter', 'Helvetica Neue', sans-serif; font-weight: 300; }
                
                .auth-navbar { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; background: #000000; border-bottom: 1px solid rgb(31 41 55); height: 4rem; }
                .auth-navbar nav { max-width: 80rem; margin: auto; padding: 0 1rem; height: 100%; display: flex; align-items: center; justify-content: space-between; gap: 1rem; position: relative; }
                .initial-avatar { background: linear-gradient(135deg, #374151 0%, #111827 100%); font-family: sans-serif; text-transform: uppercase; display: flex; align-items: center; justify-content: center; color: white; }
                
                /* Auth Dropdown Menu Styles (retained) */
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

                /* Tab Wrapper and Glide Buttons (retained) */
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
                
                /* --- NEW AI AGENT FULL-SCREEN MODAL STYLES --- */
                
                /* Full-screen backdrop and container */
                .ai-modal-full {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    z-index: 2000; /* Above regular z-index */
                    background-color: rgba(0, 0, 0, 0.9);
                    backdrop-filter: blur(8px);
                    opacity: 0;
                    pointer-events: none;
                    transition: opacity 0.5s ease-out;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                }
                .ai-modal-full.active {
                    opacity: 1;
                    pointer-events: auto;
                }

                /* Welcome Text and Header */
                .ai-welcome-text {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    color: #FF8C00; /* Dark Orange */
                    font-size: 4rem;
                    font-weight: 700;
                    text-align: center;
                    text-shadow: 0 0 10px rgba(255, 140, 0, 0.5);
                    opacity: 0;
                    /* Animation placeholders */
                    transition: all 1s ease-in-out; 
                }
                .ai-modal-full.welcoming .ai-welcome-text {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(1.1);
                }

                /* Chat Container */
                .ai-chat-container {
                    width: min(95vw, 40rem);
                    height: min(85vh, 45rem);
                    background: transparent;
                    display: flex;
                    flex-direction: column;
                    opacity: 0;
                    transition: opacity 0.5s ease-out 1.5s; /* Delay fade in */
                }
                .ai-modal-full.chatting .ai-chat-container {
                    opacity: 1;
                }
                
                /* Header Bar */
                .ai-header-bar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.5rem 1rem;
                    margin-bottom: 1rem;
                }
                .ai-agent-title {
                    color: #FF8C00;
                    font-size: 1.5rem;
                    font-weight: 700;
                }
                .ai-close-button {
                    background: none;
                    border: none;
                    color: #d1d5db;
                    font-size: 1.5rem;
                    cursor: pointer;
                    transition: color 0.2s;
                }
                .ai-close-button:hover { color: white; }

                /* Agent Selector Dropdown */
                .ai-agent-select {
                    background: transparent;
                    color: #FF8C00;
                    border: 1px solid #FF8C00;
                    border-radius: 0.375rem;
                    padding: 0.25rem 0.5rem;
                    font-size: 0.9rem;
                    cursor: pointer;
                    appearance: none; 
                    /* Custom dropdown arrow for visibility */
                    background-image: url('data:image/svg+xml;utf8,<svg fill="%23FF8C00" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>');
                    background-repeat: no-repeat;
                    background-position: right 0.5rem center;
                    background-size: 0.8em;
                    padding-right: 1.5rem;
                }
                .ai-agent-select option {
                    background: #111827;
                    color: white;
                }

                /* Chat Area */
                .ai-chat-area {
                    flex-grow: 1;
                    overflow-y: auto;
                    padding: 0 1rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    scroll-behavior: smooth;
                    /* Custom Scrollbar for dark theme */
                    scrollbar-color: #374151 #1f2937;
                    scrollbar-width: thin;
                }
                .ai-chat-area::-webkit-scrollbar { width: 8px; }
                .ai-chat-area::-webkit-scrollbar-track { background: #1f2937; border-radius: 10px; }
                .ai-chat-area::-webkit-scrollbar-thumb { background-color: #374151; border-radius: 10px; border: 2px solid #1f2937; }

                /* Chat Messages */
                .ai-chat-message {
                    max-width: 75%;
                    padding: 0.75rem 1rem;
                    border-radius: 1rem;
                    font-size: 1rem;
                    line-height: 1.4;
                    word-wrap: break-word;
                    font-family: 'Geist', sans-serif !important; /* Use Geist for chat content */
                    font-weight: 400;
                }

                /* User Message (Translucent and Blurry) */
                .ai-user-message {
                    align-self: flex-end;
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    backdrop-filter: blur(10px);
                }

                /* Agent Message (Glassy, Orange, Pulsing) */
                .ai-agent-message {
                    align-self: flex-start;
                    background: rgba(255, 140, 0, 0.2); /* Dark Orange Translucent */
                    color: white;
                    border: 1px solid rgba(255, 140, 0, 0.4);
                    backdrop-filter: blur(10px);
                    /* Glassy effect: subtle inner shadow/highlight not easily done in simple CSS, but blur and light border helps */
                    box-shadow: 0 0 15px rgba(255, 140, 0, 0.2);
                    animation: pulse-orange 1.5s infinite alternate;
                }
                .ai-agent-message.typing {
                    animation: none; /* Stop pulse when typing */
                }
                @keyframes pulse-orange {
                    from { box-shadow: 0 0 10px rgba(255, 140, 0, 0.3); }
                    to { box-shadow: 0 0 20px rgba(255, 140, 0, 0.5); }
                }

                .ai-loading-indicator {
                    font-style: italic;
                    color: #9ca3af;
                    align-self: flex-start;
                    padding-left: 0.75rem;
                    font-family: 'Geist', sans-serif !important;
                }

                /* Input Area */
                .ai-input-area {
                    margin-top: 1rem;
                    padding: 0 1rem;
                    position: relative;
                    /* Initial state for animation */
                    transform: translateY(200px) scale(0.8);
                    opacity: 0;
                    transition: all 0.5s ease-out 2s; 
                }
                .ai-modal-full.chatting .ai-input-area {
                    transform: translateY(0) scale(1);
                    opacity: 1;
                }

                .ai-input-area form {
                    display: flex;
                    gap: 0.5rem;
                    border: 1px solid #FF8C00;
                    border-radius: 1.5rem;
                    background: rgba(0, 0, 0, 0.7);
                    padding: 0.5rem;
                }
                .ai-input-area textarea {
                    flex-grow: 1;
                    background: transparent;
                    border: none;
                    color: white;
                    padding: 0.5rem;
                    resize: none;
                    height: 2.5rem;
                    overflow-y: hidden;
                    outline: none;
                }
                .ai-input-area textarea::placeholder { color: #9ca3af; }
                .ai-input-area button {
                    background: #FF8C00;
                    color: black;
                    padding: 0.5rem 1rem;
                    border-radius: 1rem;
                    transition: background 0.2s;
                    min-width: 5rem;
                    font-weight: 500;
                    border: none;
                    cursor: pointer;
                }
                .ai-input-area button:hover:not(:disabled) { background: #FFA500; }
                .ai-input-area button:disabled { opacity: 0.5; cursor: not-allowed; }

                /* Character count display */
                .char-count {
                    position: absolute;
                    bottom: 0.2rem;
                    right: 7rem;
                    font-size: 0.7rem;
                    color: #9ca3af;
                    transition: color 0.2s;
                }
                .char-count.error {
                    color: #ff0000;
                }
                
                /* File Attachment display */
                .ai-attachments-list {
                    padding: 0.5rem 1rem;
                    color: #d1d5db;
                    font-size: 0.8rem;
                }
                .ai-attachment-item {
                    display: inline-flex;
                    align-items: center;
                    background: #374151;
                    border-radius: 0.5rem;
                    padding: 0.2rem 0.5rem;
                    margin-right: 0.5rem;
                }
                .ai-attachment-item button {
                    background: none;
                    border: none;
                    color: #FF8C00;
                    margin-left: 0.3rem;
                    cursor: pointer;
                    font-size: 0.9rem;
                }
                
                /* File Upload Button */
                .file-upload-button {
                    background: none;
                    border: none;
                    color: #d1d5db;
                    margin-left: 0.5rem;
                    cursor: pointer;
                    font-size: 1.2rem;
                    transition: color 0.2s;
                }
                .file-upload-button:hover {
                    color: white;
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
            const aiAgentButton = isPrivilegedUser ? `
                <div class="relative flex-shrink-0 mr-4">
                    <button id="ai-toggle" title="AI Agent (Ctrl+A)" class="w-8 h-8 rounded-full border border-indigo-600 bg-indigo-700/50 flex items-center justify-center text-indigo-300 hover:bg-indigo-600 hover:text-white transition">
                        <i class="fa-solid fa-wand-magic-sparkles"></i>
                    </button>
                </div>
            ` : '';

            // --- Auth Views (retained) ---
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

            // --- Assemble Final Navbar HTML (retained) ---
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
                let aiModal = document.getElementById('ai-modal-full');
                if (!aiModal) {
                    aiModal = document.createElement('div');
                    aiModal.id = 'ai-modal-full';
                    aiModal.classList.add('ai-modal-full');
                    
                    const username = userData?.username || user.displayName || 'Agent User';
                    
                    const agentOptionsHtml = Object.keys(AGENT_CATEGORIES).map(key => 
                        `<option value="${key}" ${key === currentAgent ? 'selected' : ''}>${key}</option>`
                    ).join('');

                    const welcomePhrases = [
                        `Welcome, ${username}`,
                        `${username} returns!`,
                        `Welcome back, ${username}`,
                        `At your service, ${username}`,
                        `Greetings, ${username}`
                    ];
                    const welcomeText = welcomePhrases[Math.floor(Math.random() * welcomePhrases.length)];

                    aiModal.innerHTML = `
                        <p id="ai-welcome-text" class="ai-welcome-text">${welcomeText}</p>
                        
                        <div id="ai-chat-container" class="ai-chat-container">
                            <div class="ai-header-bar">
                                <div class="text-left flex items-center">
                                    <span id="ai-agent-title" class="ai-agent-title">4SP Agent - ${AGENT_CATEGORIES[currentAgent].title}</span>
                                    <select id="agent-selector" class="ai-agent-select ml-4">${agentOptionsHtml}</select>
                                </div>
                                <button id="ai-close-button" class="ai-close-button" title="Close (Esc)">
                                    <i class="fa-solid fa-xmark"></i>
                                </button>
                            </div>

                            <div id="ai-chat-area" class="ai-chat-area">
                                <p class="ai-agent-message">Hello! I'm the **${currentAgent}** agent. Ask me anything, or upload a file. I remember context from our conversation!</p>
                            </div>

                            <div class="ai-attachments-list" id="ai-attachments-list"></div>

                            <div class="ai-input-area">
                                <form id="ai-chat-form">
                                    <input type="file" id="file-upload" accept=".txt,.js,.css,.html,.json,.xml,image/png,image/jpeg" multiple hidden>
                                    <button type="button" id="file-upload-trigger" class="file-upload-button" title="Upload File (Text/Image)">
                                        <i class="fa-solid fa-paperclip"></i>
                                    </button>
                                    <textarea id="ai-input" placeholder="Type your message (max 5000 characters)..." rows="1" maxlength="5000"></textarea>
                                    <span id="char-count" class="char-count">0/5000</span>
                                    <button type="submit" id="ai-send-button"><i class="fa-solid fa-paper-plane mr-1"></i> Send</button>
                                </form>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(aiModal);
                }
            }

            // --- 5. SETUP EVENT LISTENERS ---
            setupEventListeners(user, isPrivilegedUser, userData);

            // Auto-scroll to the active tab (retained)
            const activeTab = document.querySelector('.nav-tab.active');
            const tabContainer = document.querySelector('.tab-scroll-container');
            if (activeTab && tabContainer) {
                tabContainer.scrollLeft = activeTab.offsetLeft - (tabContainer.offsetWidth / 2) + (activeTab.offsetWidth / 2);
            }
            
            updateScrollGilders();
        };

        // Global store for uploaded files
        let uploadedFiles = [];
        const MAX_FILE_SIZE_MB = 20;

        // --- NEW: File Handling Utilities ---
        const updateAttachmentsList = () => {
            const listContainer = document.getElementById('ai-attachments-list');
            if (!listContainer) return;

            listContainer.innerHTML = uploadedFiles.map((file, index) => {
                let icon = 'fa-solid fa-file';
                if (file.mimeType.startsWith('image')) icon = 'fa-solid fa-image';
                if (file.fileName.endsWith('.txt') || file.fileName.endsWith('.json')) icon = 'fa-solid fa-file-code';
                
                return `
                    <span class="ai-attachment-item">
                        <i class="${icon} mr-1"></i>
                        ${file.fileName} (${(file.data.length / 1024 / 1024).toFixed(2)} MB)
                        <button type="button" data-index="${index}" class="remove-file-button" title="Remove File">&times;</button>
                    </span>
                `;
            }).join('');
            
            // Re-attach listeners for remove buttons
            listContainer.querySelectorAll('.remove-file-button').forEach(button => {
                button.addEventListener('click', (e) => {
                    const index = parseInt(e.target.dataset.index);
                    uploadedFiles.splice(index, 1);
                    updateAttachmentsList();
                });
            });
        };

        const fileToGenerativePart = (file, content) => {
            if (file.mimeType.startsWith('image')) {
                // Image parts are sent as base64 string
                return {
                    inlineData: {
                        data: content,
                        mimeType: file.mimeType
                    }
                };
            } else {
                // Text parts are sent as text with a header
                return {
                    text: `--- FILE: ${file.fileName} (${file.mimeType}) ---\n${content}\n--- END FILE ---`
                };
            }
        };

        // --- NEW: AI GENERATIVE MODEL API CALL LOGIC (Using standard fetch/retry) ---
        
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

        // Simulates the agent's response being typed out
        const typeMessage = (element, text, chatArea) => {
            return new Promise(resolve => {
                const chars = text.split('');
                let index = 0;
                const typingInterval = Math.max(10, 5000 / chars.length); // Faster for long messages
                
                const type = () => {
                    if (index < chars.length) {
                        element.innerHTML += chars[index];
                        index++;
                        chatArea.scrollTop = chatArea.scrollHeight;
                        setTimeout(type, typingInterval);
                    } else {
                        element.classList.remove('typing');
                        resolve();
                    }
                };
                element.classList.add('typing');
                type();
            });
        };

        const handleChatSubmit = async (e) => {
            e.preventDefault();
            const input = document.getElementById('ai-input');
            const chatArea = document.getElementById('ai-chat-area');
            const sendButton = document.getElementById('ai-send-button');
            
            // Check for paste text over 1000 characters
            let userQuery = input.value;
            let queryParts = [{ text: userQuery }];
            
            if (userQuery.length > 1000) {
                // Create a synthetic file part for the long text
                const pastePart = {
                    fileName: 'paste.txt',
                    mimeType: 'text/plain',
                    data: btoa(userQuery) // Base64 encode the string
                };
                uploadedFiles.push(pastePart);
                
                // Clear the main input and update files list
                input.value = '';
                updateAttachmentsList();
                
                // The actual prompt is now just an instruction to reference the pasted file
                userQuery = `[LONG PASTE] I have pasted a large block of text. Please analyze the content in 'paste.txt' and respond to it.`;
                queryParts = [{ text: userQuery }];
            }

            if (!userQuery && uploadedFiles.length === 0) return;

            // 1. Prepare and display user message
            
            let userMessageContent = userQuery;
            if (uploadedFiles.length > 0) {
                const fileNames = uploadedFiles.map(f => f.fileName).join(', ');
                userMessageContent += `\n\n[ATTACHMENTS: ${fileNames}]`;
            }
            
            const userMessageDiv = document.createElement('p');
            userMessageDiv.classList.add('ai-chat-message', 'ai-user-message');
            userMessageDiv.textContent = userMessageContent;
            chatArea.appendChild(userMessageDiv);
            chatArea.scrollTop = chatArea.scrollHeight;
            
            // Add to conversation history
            conversationHistory.push({ role: "user", text: userQuery, parts: queryParts });
            
            // Clear inputs and disable
            input.value = '';
            input.style.height = '2.5rem';
            input.disabled = true;
            sendButton.disabled = true;
            uploadedFiles = [];
            updateAttachmentsList();
            document.getElementById('char-count').textContent = '0/5000';

            // 2. Add loading indicator
            const loadingDiv = document.createElement('p');
            loadingDiv.classList.add('ai-loading-indicator');
            loadingDiv.textContent = 'Agent is thinking...';
            chatArea.appendChild(loadingDiv);
            chatArea.scrollTop = chatArea.scrollHeight;

            try {
                // 3. Get system context and construct payload
                const systemInfo = await getSystemInfo();
                const agentConfig = AGENT_CATEGORIES[currentAgent];
                
                // The system prompt now includes history and a strict instruction not to leak it
                const systemPrompt = `You are a 4SP Agent, acting as the '${currentAgent}' agent with the following persona: ${agentConfig.persona}. You MUST tailor your response to this persona. DO NOT mention the SYSTEM CONTEXT or CONVERSATION HISTORY to the user. This information is for your internal use only.

[SYSTEM CONTEXT]
${systemInfo.time}
${systemInfo.timezone}
General Location: ${systemInfo.location}

[CONVERSATION HISTORY]
${systemInfo.history}
[END CONTEXT]`;
                
                // Construct the contents array with file parts and the user query
                const fileParts = [];
                for (const file of uploadedFiles) {
                    fileParts.push(fileToGenerativePart(file, file.data));
                }
                
                const allParts = [...fileParts, { text: userQuery }];

                const payload = {
                    contents: [{ role: "user", parts: allParts }],
                    config: {
                         systemInstruction: systemPrompt,
                         // Additional settings for model (optional, gemini-2.5-flash is good default)
                    },
                    tools: [{ googleSearch: {} }]
                };
                
                // FIX: Use the API key directly from the FIREBASE_CONFIG object
                const apiKey = FIREBASE_CONFIG.apiKey;
                if (!apiKey || apiKey.length < 5) {
                    throw new Error("API Key is missing or invalid in FIREBASE_CONFIG.");
                }

                // 4. Call the Generative Model API (with retry logic)
                const apiUrl = `${GEMINI_API_URL}${apiKey}`;
                
                // Due to API structure, we'll send the conversation as one request for simplicity. 
                // A more advanced approach would use the `conversations` API or full `contents` array for history.
                // For now, we'll rely on the system instruction for history context.
                
                const response = await fetchWithRetry(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const result = await response.json();
                const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "I apologize, I could not process that request. The response was empty.";

                // 5. Display agent response with typing animation
                const agentMessageDiv = document.createElement('p');
                agentMessageDiv.classList.add('ai-chat-message', 'ai-agent-message');
                chatArea.removeChild(loadingDiv);
                chatArea.appendChild(agentMessageDiv);
                
                // Use a simple replacement for bold markdown for better display
                const formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                await typeMessage(agentMessageDiv, formattedText, chatArea);

                // Add agent response to history
                conversationHistory.push({ role: "model", text: text, parts: [{ text: text }] });
                
                // Trim history to a reasonable size (e.g., 20 messages total, so 10 user/10 model)
                if (conversationHistory.length > 20) {
                    conversationHistory = conversationHistory.slice(conversationHistory.length - 20);
                }

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

        const setupEventListeners = (user, isPrivilegedUser, userData) => {
            const toggleButton = document.getElementById('auth-toggle');
            const menu = document.getElementById('auth-menu-container');

            // Scroll Glide Button setup (retained)
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

            // Auth Toggle (retained)
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

            // --- AI Agent Listeners (NEW Full-Screen Logic) ---
            if (isPrivilegedUser) {
                const aiModal = document.getElementById('ai-modal-full');
                const aiToggleButton = document.getElementById('ai-toggle');
                const aiCloseButton = document.getElementById('ai-close-button');
                const aiChatForm = document.getElementById('ai-chat-form');
                const agentSelector = document.getElementById('agent-selector');
                const aiInput = document.getElementById('ai-input');
                const welcomeTextElement = document.getElementById('ai-welcome-text');
                const chatContainer = document.getElementById('ai-chat-container');
                const agentTitleElement = document.getElementById('ai-agent-title');
                const charCountElement = document.getElementById('char-count');
                const fileUploadInput = document.getElementById('file-upload');
                const fileUploadTrigger = document.getElementById('file-upload-trigger');
                
                const username = userData?.username || user.displayName || 'Agent User';

                const handleWelcomeSequence = () => {
                    // 1. Initial State for Active
                    aiModal.classList.add('active');
                    aiModal.classList.add('welcoming');

                    // 2. Welcome text animation
                    // This is handled by CSS transitions and the 'welcoming' class
                    
                    // 3. Transition to chat mode after a delay
                    setTimeout(() => {
                        aiModal.classList.remove('welcoming');
                        aiModal.classList.add('chatting');
                        
                        // 4. Welcome text transforms into agent title
                        const currentTitle = AGENT_CATEGORIES[currentAgent].title;
                        agentTitleElement.textContent = `4SP Agent - ${currentTitle}`;
                        welcomeTextElement.style.transition = 'all 0.5s ease-out';
                        welcomeTextElement.style.opacity = '0';
                        welcomeTextElement.style.fontSize = '1.5rem';
                        welcomeTextElement.style.top = '10%'; // Move off center
                        welcomeTextElement.style.left = '10%'; // Move off center

                        setTimeout(() => {
                            // Hide welcome text and show chat container
                            welcomeTextElement.style.display = 'none';
                            chatContainer.style.opacity = '1';
                            aiInput.focus();
                        }, 500);

                    }, 2000); // 2 seconds for the welcome screen to hold
                };

                // Toggle Button Click
                if (aiToggleButton && aiModal) {
                    aiToggleButton.addEventListener('click', () => {
                        if (!aiModal.classList.contains('active')) {
                            // Reset for fresh open
                            aiModal.classList.remove('chatting');
                            welcomeTextElement.style.display = 'block';
                            welcomeTextElement.style.opacity = '0';
                            welcomeTextElement.style.fontSize = '4rem';
                            welcomeTextElement.style.top = '50%';
                            welcomeTextElement.style.left = '50%';
                            handleWelcomeSequence();
                        } else {
                            aiModal.classList.remove('active', 'welcoming', 'chatting');
                        }
                    });
                }
                
                // Close Button Click
                if (aiCloseButton && aiModal) {
                    aiCloseButton.addEventListener('click', () => {
                        aiModal.classList.remove('active', 'welcoming', 'chatting');
                    });
                }
                
                // Agent Selector Change
                if (agentSelector) {
                    agentSelector.addEventListener('change', (e) => {
                        const newAgent = e.target.value;
                        if (newAgent in AGENT_CATEGORIES) {
                            currentAgent = newAgent;
                            agentTitleElement.textContent = `4SP Agent - ${AGENT_CATEGORIES[currentAgent].title}`;
                            
                            const chatArea = document.getElementById('ai-chat-area');
                            const welcomeDiv = document.createElement('p');
                            welcomeDiv.classList.add('ai-agent-message');
                            welcomeDiv.innerHTML = `**Agent Switched:** I am now the **${currentAgent}** agent (${AGENT_CATEGORIES[currentAgent].title}). Ask away!`;
                            chatArea.appendChild(welcomeDiv);
                            chatArea.scrollTop = chatArea.scrollHeight;
                        }
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
                
                // Input character count and resizing
                if (aiInput) {
                    const adjustHeight = () => {
                        aiInput.style.height = 'auto';
                        aiInput.style.height = aiInput.scrollHeight + 'px';
                        
                        const currentLength = aiInput.value.length;
                        charCountElement.textContent = `${currentLength}/5000`;
                        if (currentLength >= 4900) {
                            charCountElement.classList.add('error');
                        } else {
                            charCountElement.classList.remove('error');
                        }
                    };
                    aiInput.addEventListener('input', adjustHeight);
                    // Initial adjustment
                    adjustHeight(); 
                }
                
                // File Upload Logic
                if (fileUploadTrigger && fileUploadInput) {
                    fileUploadTrigger.addEventListener('click', () => fileUploadInput.click());
                    
                    fileUploadInput.addEventListener('change', (e) => {
                        const files = Array.from(e.target.files);
                        files.forEach(file => {
                            if (!file.type.startsWith('image/') && !file.type.includes('text') && !file.name.endsWith('.json') && !file.name.endsWith('.xml') && !file.name.endsWith('.js') && !file.name.endsWith('.css') && !file.name.endsWith('.html') && !file.name.endsWith('.txt')) {
                                alert(`Unsupported file type: ${file.name}. Only text and image files are supported.`);
                                return;
                            }
                            if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
                                alert(`File too large: ${file.name}. Max size is ${MAX_FILE_SIZE_MB}MB.`);
                                return;
                            }
                            
                            const reader = new FileReader();
                            reader.onload = (readerEvent) => {
                                let base64Content = readerEvent.target.result;
                                if (file.type.startsWith('image/')) {
                                    // Strip the data URL header for images
                                    base64Content = base64Content.split(',')[1];
                                } else {
                                    // For text, use the plain text result
                                }
                                
                                uploadedFiles.push({
                                    fileName: file.name,
                                    mimeType: file.type,
                                    data: base64Content
                                });
                                updateAttachmentsList();
                            };
                            
                            // Read as base64 for images, or text for other types
                            if (file.type.startsWith('image/')) {
                                reader.readAsDataURL(file);
                            } else {
                                reader.readAsText(file);
                            }
                        });
                        fileUploadInput.value = null; // Clear input for next time
                    });
                }

                // Control + A Activation & ESC to close
                document.addEventListener('keydown', (e) => {
                    if (aiModal.classList.contains('active') && e.key === 'Escape') {
                         e.preventDefault();
                         aiModal.classList.remove('active', 'welcoming', 'chatting');
                         return;
                    }
                    
                    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && !isFocusableElement()) {
                        e.preventDefault();
                        if (!aiModal.classList.contains('active')) {
                            // If closed, open it with the welcome sequence
                            aiModal.classList.remove('chatting');
                            welcomeTextElement.style.display = 'block';
                            welcomeTextElement.style.opacity = '0';
                            welcomeTextElement.style.fontSize = '4rem';
                            welcomeTextElement.style.top = '50%';
                            welcomeTextElement.style.left = '50%';
                            handleWelcomeSequence();
                        } else {
                            // If open, close it
                            aiModal.classList.remove('active', 'welcoming', 'chatting');
                        }
                    }
                });
            }
        };

        // --- 6. AUTH STATE LISTENER (retained) ---
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
                    renderNavbar(user, userData, pages, isPrivilegedUser); // Render even if Firestore fails
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

        // --- FINAL SETUP (retained) ---
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
