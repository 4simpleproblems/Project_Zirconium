/**
 * navigation.js
 * * This is a fully self-contained script to create a dynamic, authentication-aware
 * navigation bar for your website. It handles everything from Firebase initialization
 * to rendering user-specific information. It now includes a horizontally scrollable
 * tab menu loaded from page-identification.json, and an exclusive AI Chatbot feature
 * for the official website administrator.
 *
 * --- INSTRUCTIONS ---
 * 1. ACTION REQUIRED: Paste your own Firebase project configuration into the `FIREBASE_CONFIG` object below.
 * 2. Place this script in the root directory of your website.
 * 3. Add `<script src="/navigation.js" defer></script>` to the <head> of any HTML file where you want the navbar.
 * 4. Ensure your file paths for images and links are root-relative (e.g., "/images/logo.png", "/login.html").
 *
 * --- NEW FEATURES (4SP AI Mode) ---
 * - The special user (4simpleproblems@gmail.com) gets an exclusive AI Chatbot button.
 * - Chat uses Firebase AI Logic (Vertex AI) with specialized "Agents."
 * - Agents control the AI's persona, system instructions, and generation settings (like temperature).
 *
 * --- FIXES ---
 * - Scroll Glide Buttons are now immediately fully visible (opacity 1) as requested.
 * - The isTabActive logic is designed to be robust for static websites (like GitHub Pages).
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

// --- Exclusive AI Feature Configuration ---
const SPECIAL_USER_EMAIL = '4simpleproblems@gmail.com';

const AGENTS = {
    "General": {
        systemInstruction: "You are 4SP AI Mode, a supportive and creative general assistant. Keep responses engaging and friendly.",
        temperature: 0.8
    },
    "Math": {
        systemInstruction: "You are 4SP AI Mode, a precise and rigorous mathematics tutor. Provide clear step-by-step explanations for problem-solving. Use LaTeX for all mathematical expressions.",
        temperature: 0.2
    },
    "Science": {
        systemInstruction: "You are 4SP AI Mode, an expert in scientific concepts (Physics, Chemistry, Biology). Use analogies and up-to-date information. Use LaTeX for all scientific notation and formulas.",
        temperature: 0.5
    },
    "Language Arts": {
        systemInstruction: "You are 4SP AI Mode, a critical reader and writing coach. Focus on structure, grammar, and literary analysis.",
        temperature: 0.7
    },
    "History": {
        systemInstruction: "You are 4SP AI Mode, a knowledgeable historian. Provide context and multiple perspectives on historical events.",
        temperature: 0.6
    },
    "STEM": {
        systemInstruction: "You are 4SP AI Mode, an interdisciplinary guide for Science, Technology, Engineering, and Mathematics. Connect fields where possible. Use LaTeX for all technical expressions.",
        temperature: 0.4
    },
    "Coding": {
        systemInstruction: "You are 4SP AI Mode, a concise and effective programming assistant. Provide well-commented code snippets and explanations. Use simple code blocks for output.",
        temperature: 0.1
    }
};
// Default model to use for all agents
const AI_MODEL = "gemini-2.5-flash";


// Variables to hold Firebase objects and AI state
let auth;
let db;
let vertexAI;
let currentChat; // Holds the currently active chat session object
let selectedAgent = 'General'; // Initial default agent

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
            script.type = 'module';
            // Use resolve/reject only for critical files like Firebase SDKs
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

    /**
     * **UPDATED UTILITY FUNCTION: Bulletproof Fix for Font Awesome 7.x icon loading for JSON.**
     * (Retained from original file for icon functionality)
     */
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
        }

        try {
            // Sequentially load Firebase modules
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js");
            // NEW: Load Vertex AI Logic SDK
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-vertex.js");

            // Now that scripts are loaded, we can initialize
            initializeApp(pages);
        } catch (error) {
            console.error("Failed to load necessary SDKs:", error);
        }
    };

    // --- AI Logic Functions ---
    const initializeVertexAI = (app) => {
        try {
            // Initialize the Vertex AI client
            vertexAI = firebase.vertex(app);
            console.log("Firebase Vertex AI initialized.");
        } catch (error) {
            console.error("Failed to initialize Firebase Vertex AI:", error);
        }
    };

    const getAgentConfig = (agentName) => {
        const config = AGENTS[agentName] || AGENTS['General'];
        const agentNameFormatted = agentName.toUpperCase().replace(/\s/g, '_'); // E.g., MATH
        const systemInstruction = config.systemInstruction;
        
        // This structure is ready for the Firebase AI Logic SDK
        return {
            systemInstruction: systemInstruction,
            generationConfig: {
                temperature: config.temperature,
                // maxOutputTokens is often a good default, though can be omitted
                maxOutputTokens: 2048, 
            },
            model: AI_MODEL,
        };
    };

    // Function to create or reset the chat session
    const createChatSession = () => {
        const chatConfig = getAgentConfig(selectedAgent);
        
        // Clear old chat history display
        const chatDisplay = document.getElementById('chat-messages');
        if (chatDisplay) {
             // Add a new system message to start the conversation
             chatDisplay.innerHTML = `<div class="p-3 bg-gray-900 text-gray-400 rounded-lg mb-2 text-sm">
                <i class="fa-solid fa-star-of-life mr-2"></i>
                4SP AI Mode (${selectedAgent} Agent) is ready. Ask me anything!
             </div>`;
             chatDisplay.scrollTop = chatDisplay.scrollHeight;
        }

        // Use the 'startChat' method from the SDK
        currentChat = vertexAI.chats.startChat({ 
            ...chatConfig,
            // Include history if you had prior conversations, but we reset here
            history: [] 
        });

        console.log(`New chat session started with ${selectedAgent} Agent.`);
    };

    const handleAgentSelection = (agentName) => {
        selectedAgent = agentName;
        // Update the active button visually
        document.querySelectorAll('.agent-button').forEach(btn => {
            btn.classList.remove('active-agent');
        });
        document.getElementById(`agent-${agentName.replace(/\s/g, '-')}`).classList.add('active-agent');
        
        // Re-initialize the chat session with the new agent settings
        createChatSession();
    };

    const displayMessage = (role, text) => {
        const chatDisplay = document.getElementById('chat-messages');
        if (!chatDisplay) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `p-3 mb-3 max-w-[80%] rounded-xl shadow-lg relative ${
            role === 'user' 
                ? 'bg-indigo-600 text-white self-end rounded-br-none' 
                : 'bg-gray-700 text-gray-200 self-start rounded-tl-none'
        }`;
        
        // Use a simple markdown-like rendering for text, including LaTeX support hint
        const formattedText = text
            // Basic markdown for code blocks
            .replace(/```(.*?)\n/g, '<pre class="bg-gray-800 p-2 rounded-md overflow-x-auto text-xs mt-2 mb-1">')
            .replace(/```/g, '</pre>')
            // Basic markdown for bold
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            
        messageDiv.innerHTML = formattedText;
        chatDisplay.appendChild(messageDiv);
        chatDisplay.scrollTop = chatDisplay.scrollHeight; // Auto-scroll to bottom
    };

    const sendMessageToAI = async (e) => {
        e.preventDefault();
        const input = document.getElementById('chat-input');
        const userPrompt = input.value.trim();
        if (!userPrompt || !currentChat) return;

        displayMessage('user', userPrompt);
        input.value = ''; // Clear input immediately
        input.disabled = true;
        document.getElementById('send-button').disabled = true;
        document.getElementById('loading-indicator').classList.remove('hidden');

        try {
            // The SDK's sendMessageStream is preferred for responsiveness
            const responseStream = await currentChat.sendMessageStream({ message: userPrompt });

            // Create a temporary message div for the streaming response
            const chatDisplay = document.getElementById('chat-messages');
            const streamMessageDiv = document.createElement('div');
            streamMessageDiv.className = 'p-3 mb-3 max-w-[80%] bg-gray-700 text-gray-200 self-start rounded-xl rounded-tl-none shadow-lg relative';
            streamMessageDiv.innerHTML = '<i class="fa-solid fa-hourglass-start text-indigo-400 mr-2 animate-pulse"></i>Generating...';
            chatDisplay.appendChild(streamMessageDiv);
            chatDisplay.scrollTop = chatDisplay.scrollHeight;

            let fullResponseText = '';

            for await (const chunk of responseStream) {
                if (chunk.text) {
                    fullResponseText += chunk.text;
                    // Update the streaming message div content
                    streamMessageDiv.innerHTML = fullResponseText;
                    chatDisplay.scrollTop = chatDisplay.scrollHeight;
                }
            }

            // After streaming is complete, finalize the content and remove the indicator
            streamMessageDiv.innerHTML = fullResponseText.replace(/```(.*?)\n/g, '<pre class="bg-gray-800 p-2 rounded-md overflow-x-auto text-xs mt-2 mb-1">').replace(/```/g, '</pre>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            
        } catch (error) {
            console.error("AI Chat Error:", error);
            displayMessage('system', `<i class="fa-solid fa-triangle-exclamation text-red-400 mr-2"></i>Error: The AI encountered an issue. Please try again. (${error.message})`);
        } finally {
            input.disabled = false;
            document.getElementById('send-button').disabled = false;
            document.getElementById('loading-indicator').classList.add('hidden');
            input.focus();
        }
    };


    // --- 2. INITIALIZE FIREBASE AND RENDER NAVBAR ---
    const initializeApp = (pages) => {
        // Initialize Firebase with the compat libraries
        const app = firebase.initializeApp(FIREBASE_CONFIG);
        // Assign auth and db to module-scope variables
        auth = firebase.auth();
        db = firebase.firestore();
        
        // Initialize the Vertex AI client
        initializeVertexAI(app);

        // --- 3. INJECT CSS STYLES (UPDATED for AI Modal and Scrollbar) ---
        const injectStyles = () => {
            const style = document.createElement('style');
            style.textContent = `
                /* Base Styles */
                body { padding-top: 4rem; /* 64px, equal to navbar height */ }
                .auth-navbar { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; background: #000000; border-bottom: 1px solid rgb(31 41 55); height: 4rem; }
                .auth-navbar nav { max-width: 80rem; margin: auto; padding: 0 1rem; height: 100%; display: flex; align-items: center; justify-content: space-between; gap: 1rem; position: relative; }
                .initial-avatar { background: linear-gradient(135deg, #374151 0%, #111827 100%); font-family: 'Inter', sans-serif; text-transform: uppercase; display: flex; align-items: center; justify-content: center; color: white; }
                
                /* Auth Dropdown Menu Styles (Pure Black background) */
                .auth-menu-container { 
                    position: absolute; right: 0; top: 50px; width: 16rem; 
                    background: #000000; /* Pure black */
                    border: 1px solid rgb(55 65 81); border-radius: 0.75rem; padding: 0.5rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -2px rgba(0,0,0,0.2); 
                    transition: transform 0.2s ease-out, opacity 0.2s ease-out; transform-origin: top right; 
                }
                .auth-menu-container.open { opacity: 1; transform: translateY(0) scale(1); z-index: 10000; }
                .auth-menu-container.closed { opacity: 0; pointer-events: none; transform: translateY(-10px) scale(0.95); }
                .auth-menu-link, .auth-menu-button { display: block; width: 100%; text-align: left; padding: 0.5rem 0.75rem; font-size: 0.875rem; color: #d1d5db; border-radius: 0.375rem; transition: background-color 0.2s, color 0.2s; }
                .auth-menu-link:hover, .auth-menu-button:hover { background-color: rgb(55 65 81); color: white; }

                /* Scrollable Tab Wrapper */
                .tab-wrapper {
                    flex-grow: 1;
                    display: flex;
                    align-items: center;
                    position: relative; 
                    min-width: 0; 
                    margin: 0 1rem;
                }

                /* Horizontal Scrollable Tabs Styles - Custom Scrollbar */
                .tab-scroll-container {
                    flex-grow: 1;
                    display: flex;
                    align-items: center;
                    overflow-x: scroll; /* Changed from auto to scroll for explicit scrollbar */
                    -webkit-overflow-scrolling: touch;
                    padding-bottom: 5px;
                    margin-bottom: -5px;
                    scroll-behavior: smooth; 
                    /* Force scrollbar visibility (Best effort: CSS scrollbar styling is limited) */
                    scrollbar-color: #4f46e5 #1f2937; /* thumb color track color for Firefox */
                    scrollbar-width: thin; /* Show scrollbar for Firefox */
                }
                /* Custom scrollbar track/thumb for Webkit (Chrome, Safari) */
                .tab-scroll-container::-webkit-scrollbar { height: 5px; }
                .tab-scroll-container::-webkit-scrollbar-track { background: #1f2937; border-radius: 10px; }
                .tab-scroll-container::-webkit-scrollbar-thumb { background-color: #4f46e5; border-radius: 10px; }


                /* Scroll Glide Buttons - UPDATED: Always fully visible */
                .scroll-glide-button {
                    position: absolute;
                    top: 0;
                    height: 100%;
                    width: 2rem; 
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #000000; 
                    color: white;
                    font-size: 1.2rem;
                    cursor: pointer;
                    opacity: 1; /* Always visible */
                    transition: background 0.3s;
                    z-index: 10;
                    pointer-events: auto;
                }
                .scroll-glide-button:hover { background: #1f2937; } /* Slight hover for feedback */
                
                #glide-left { left: 0; background: linear-gradient(to right, #000000 50%, transparent); }
                #glide-right { right: 0; background: linear-gradient(to left, #000000 50%, transparent); }
                
                /* Keep the hidden class for functional control, although opacity is 1 */
                .scroll-glide-button.hidden { pointer-events: none !important; opacity: 0 !important; }

                .nav-tab {
                    flex-shrink: 0; 
                    padding: 0.5rem 1rem;
                    color: #9ca3af; 
                    font-size: 0.875rem;
                    font-weight: 500;
                    border-radius: 0.5rem;
                    transition: all 0.2s;
                    text-decoration: none;
                    line-height: 1.5;
                    display: flex;
                    align-items: center;
                    margin-right: 0.5rem; 
                    border: 1px solid transparent;
                }
                .nav-tab:hover { color: white; background-color: rgb(55 65 81); } 
                /* Active state highlighting fix: relies on clean pathing for static sites */
                .nav-tab.active {
                    color: #4f46e5; 
                    border-color: #4f46e5;
                    background-color: rgba(79, 70, 229, 0.1); 
                }
                .nav-tab.active:hover {
                    color: #6366f1;
                    border-color: #6366f1;
                    background-color: rgba(79, 70, 229, 0.15);
                }

                /* --- NEW AI Chat Modal Styles --- */
                .ai-modal-backdrop {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
                    background: rgba(0, 0, 0, 0.95); 
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                    z-index: 2000; 
                    display: flex; 
                    justify-content: center; 
                    align-items: center;
                    opacity: 0;
                    pointer-events: none;
                    transition: opacity 0.3s ease;
                }
                .ai-modal-backdrop.open {
                    opacity: 1;
                    pointer-events: auto;
                }
                .ai-chat-container {
                    background: #111827; 
                    width: 95%; 
                    max-width: 60rem; 
                    height: 90%; 
                    border-radius: 1rem; 
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                    display: grid;
                    grid-template-rows: auto 1fr auto;
                    padding: 1.5rem;
                    gap: 1rem;
                }
                .agent-selector-container {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    padding-bottom: 0.5rem;
                    border-bottom: 1px solid #374151;
                }
                .agent-button {
                    padding: 0.3rem 0.75rem;
                    font-size: 0.75rem;
                    font-weight: 600;
                    border-radius: 9999px;
                    border: 1px solid #4b5563;
                    color: #d1d5db;
                    background-color: #1f2937;
                    transition: all 0.2s;
                    cursor: pointer;
                }
                .agent-button:hover {
                    background-color: #374151;
                    border-color: #6b7280;
                }
                .agent-button.active-agent {
                    background-color: #4f46e5;
                    border-color: #4f46e5;
                    color: white;
                    box-shadow: 0 0 10px rgba(79, 70, 229, 0.5);
                }
                #chat-messages {
                    display: flex;
                    flex-direction: column;
                    overflow-y: scroll;
                    gap: 0.5rem;
                    padding-right: 1rem;
                    /* Custom scrollbar for Webkit to force arrow visibility on either end */
                    scrollbar-color: #4f46e5 #1f2937;
                    scrollbar-width: thin;
                }
                #chat-messages::-webkit-scrollbar { width: 8px; }
                #chat-messages::-webkit-scrollbar-thumb { background-color: #4f46e5; border-radius: 10px; }
                #chat-messages::-webkit-scrollbar-track { background: #1f2937; border-radius: 10px; }
                
                .chat-input-area {
                    display: flex;
                    gap: 0.5rem;
                    align-items: center;
                }
                .chat-input-area input {
                    flex-grow: 1;
                    padding: 0.75rem 1rem;
                    border-radius: 0.5rem;
                    background: #1f2937;
                    color: white;
                    border: 1px solid #374151;
                }
                .chat-input-area button {
                    padding: 0.75rem 1rem;
                    border-radius: 0.5rem;
                    background: #4f46e5;
                    color: white;
                    font-weight: 600;
                    transition: background 0.2s;
                }
                .chat-input-area button:hover:not(:disabled) {
                    background: #6366f1;
                }
                .chat-input-area button:disabled {
                    background: #374151;
                    cursor: not-allowed;
                }
            `;
            document.head.appendChild(style);
        };

        // --- NEW: Function to robustly determine active tab (GitHub Pages fix) ---
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
            
            // 1. Exact canonical match
            if (currentCanonical === tabCanonical) {
                return true;
            }

            // 2. GitHub Pages/Subdirectory match: Check if the current path ends with the tab path.
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
            
            const isScrolledToLeft = container.scrollLeft < 5; 
            const isScrolledToRight = container.scrollLeft + container.offsetWidth >= container.scrollWidth - 5; 
            const hasHorizontalOverflow = container.scrollWidth > container.offsetWidth;

            // Glide buttons remain visible but functionality is controlled by hiding/showing
            if (hasHorizontalOverflow) {
                leftButton.classList.toggle('hidden', isScrolledToLeft);
                rightButton.classList.toggle('hidden', isScrolledToRight);
            } else {
                leftButton.classList.add('hidden');
                rightButton.classList.add('hidden');
            }
        };

        // --- 4. RENDER THE NAVBAR HTML ---
        const renderNavbar = (user, userData, pages) => {
            const container = document.getElementById('navbar-container');
            if (!container) return;

            const isSpecialUser = user && user.email === SPECIAL_USER_EMAIL;
            const logoPath = "/images/logo.png"; 

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

            // --- AI Button (Exclusive) ---
            const aiButton = isSpecialUser ? `
                <button id="ai-toggle-button" class="w-8 h-8 rounded-full border border-gray-600 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 transition shadow-lg flex-shrink-0">
                    <i class="fa-solid fa-robot text-white text-sm"></i>
                </button>
            ` : '';

            // --- Auth Views (Unchanged) ---
            const loggedOutView = `
                <div class="relative flex-shrink-0">
                    <button id="auth-toggle" class="w-8 h-8 rounded-full border border-gray-700 flex items-center justify-center bg-gray-800 hover:bg-gray-700 transition">
                        <svg class="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                    </button>
                    <div id="auth-menu-container" class="auth-menu-container closed">
                        <a href="/login.html" class="auth-menu-link">Login</a>
                        <a href="/signup.html" class="auth-menu-link">Sign Up</a>
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
                                <p class="text-sm font-semibold text-white truncate">${username}</p>
                                <p class="text-xs text-gray-400 truncate">${email}</p>
                            </div>
                            <a href="/logged-in/dashboard.html" class="auth-menu-link">Dashboard</a>
                            <a href="/logged-in/settings.html" class="auth-menu-link">Settings</a>
                            <button id="logout-button" class="auth-menu-button text-red-400 hover:bg-red-900/50 hover:text-red-300">Log Out</button>
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

                        ${aiButton}
                        ${user ? loggedInView(user, userData) : loggedOutView}
                    </nav>
                </header>
                ${isSpecialUser ? renderChatModal() : ''}
            `;

            // --- 5. SETUP EVENT LISTENERS (Including auto-scroll and glide buttons) ---
            setupEventListeners(user);

            // Auto-scroll to the active tab if one is found
            const activeTab = document.querySelector('.nav-tab.active');
            const tabContainer = document.querySelector('.tab-scroll-container');
            if (activeTab && tabContainer) {
                tabContainer.scrollLeft = activeTab.offsetLeft - (tabContainer.offsetWidth / 2) + (activeTab.offsetWidth / 2);
            }
            
            // INITIAL CHECK: After rendering and auto-scrolling, update glide button visibility
            updateScrollGilders();
            
            // If special user, initialize the chat
            if (isSpecialUser && vertexAI) {
                handleAgentSelection(selectedAgent); // Initializes the default chat session
            }
        };
        
        const renderChatModal = () => {
            const agentButtons = Object.keys(AGENTS).map(agent => `
                <button 
                    id="agent-${agent.replace(/\s/g, '-')}" 
                    class="agent-button ${agent === selectedAgent ? 'active-agent' : ''}" 
                    data-agent="${agent}"
                >
                    <i class="fa-solid fa-microchip mr-1"></i> ${agent} Agent
                </button>
            `).join('');

            return `
                <div id="ai-modal-backdrop" class="ai-modal-backdrop">
                    <div class="ai-chat-container">
                        <div class="flex justify-between items-center text-white pb-3">
                            <h2 class="text-2xl font-bold text-indigo-400">4SP AI Mode <i class="fa-solid fa-brain ml-2"></i></h2>
                            <button id="ai-close-button" class="text-gray-400 hover:text-white transition">
                                <i class="fa-solid fa-xmark text-2xl"></i>
                            </button>
                        </div>

                        <!-- Agent Selection Area -->
                        <div class="agent-selector-container">
                            <span class="text-gray-400 text-sm font-semibold mr-2 flex items-center">Agents:</span>
                            ${agentButtons}
                        </div>

                        <!-- Chat Display Area -->
                        <div id="chat-messages" class="flex flex-col space-y-3 overflow-y-auto">
                            <!-- Messages will be appended here by JavaScript -->
                        </div>

                        <!-- Chat Input Area -->
                        <form id="chat-form" class="chat-input-area">
                            <input type="text" id="chat-input" placeholder="Message 4SP AI Mode..." autocomplete="off" />
                            <div id="loading-indicator" class="hidden text-indigo-400 text-sm flex items-center pr-2">
                                <i class="fa-solid fa-spinner fa-spin mr-2"></i> AI Thinking
                            </div>
                            <button type="submit" id="send-button">
                                <i class="fa-solid fa-paper-plane"></i> Send
                            </button>
                        </form>
                    </div>
                </div>
            `;
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

            // Auth Menu Toggle
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

            // Logout
            if (user) {
                const logoutButton = document.getElementById('logout-button');
                if (logoutButton) {
                    logoutButton.addEventListener('click', () => {
                        auth.signOut().catch(err => console.error("Logout failed:", err));
                    });
                }
            }
            
            // --- NEW: AI Chat Modal Listeners (Exclusive) ---
            const aiToggleButton = document.getElementById('ai-toggle-button');
            const aiCloseButton = document.getElementById('ai-close-button');
            const aiModal = document.getElementById('ai-modal-backdrop');
            const chatForm = document.getElementById('chat-form');

            if (aiToggleButton && aiModal && aiCloseButton && chatForm) {
                // Open Chat Modal
                aiToggleButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    aiModal.classList.add('open');
                    document.getElementById('chat-input')?.focus();
                });

                // Close Chat Modal
                aiCloseButton.addEventListener('click', () => {
                    aiModal.classList.remove('open');
                });
                
                // Close Chat Modal by clicking outside (but not on the container itself)
                aiModal.addEventListener('click', (e) => {
                    if (e.target.id === 'ai-modal-backdrop') {
                        aiModal.classList.remove('open');
                    }
                });

                // Agent Selection
                document.querySelectorAll('.agent-button').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const agent = e.currentTarget.getAttribute('data-agent');
                        if (agent) {
                            handleAgentSelection(agent);
                        }
                    });
                });

                // Chat Form Submission
                chatForm.addEventListener('submit', sendMessageToAI);
            }
        };

        // --- 6. AUTH STATE LISTENER ---
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                try {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    const userData = userDoc.exists ? userDoc.data() : null;
                    renderNavbar(user, userData, pages);
                } catch (error) {
                    console.error("Error fetching user data:", error);
                    renderNavbar(user, null, pages); 
                }
            } else {
                renderNavbar(null, null, pages);
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
        if (!document.getElementById('navbar-container')) {
            const navbarDiv = document.createElement('div');
            navbarDiv.id = 'navbar-container';
            document.body.prepend(navbarDiv);
        }
        injectStyles();
    };

    // --- START THE PROCESS ---
    document.addEventListener('DOMContentLoaded', run);

})();
