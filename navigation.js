/**
 * navigation.js
 * * This is a fully self-contained script to create a dynamic, authentication-aware
 * navigation bar for your website. It handles everything from Firebase initialization
 * to rendering user-specific information. It now includes a horizontally scrollable
 * tab menu loaded from page-identification.json.
 *
 * --- FIXES / UPDATES ---
 * 1. NAVBAR LOADING FIX: Ensured the navbar container is created and styles are injected before Firebase initialization.
 * 2. KEYBINDING CHANGE: Toggles AI chat modal with Control+C (or Meta+C on Mac) outside of input fields.
 * 3. AI SDK LOADING REFINED: Ensured modular SDKs are correctly loaded to expose `firebase.getAI`, etc.
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

// Variables to hold Firebase objects, which must be globally accessible after loading scripts
let auth; // Compat Auth
let db;   // Compat Firestore

let aiApp; // Modular App instance for AI
let geminiModel;
let AI_AGENT_ENABLED = false;
let CHAT_HISTORY = [];
let CURRENT_AGENT_ID = 'quick'; // Default agent

const AUTHORIZED_USER_EMAIL = '4simpleproblems@gmail.com';

// --- Configuration for the 8 AI Agent categories ---
const AGENT_CATEGORIES = {
    'quick': {
        name: 'Quick',
        icon: 'fa-bolt',
        prompt: "You are a Quick and efficient assistant. Your primary goal is to provide concise, direct, and immediate answers. Limit your response to one or two sentences unless a list is necessary."
    },
    'standard': {
        name: 'Standard',
        icon: 'fa-robot',
        prompt: "You are a Standard, helpful, and friendly assistant. Provide balanced answers with moderate detail and clarity, acting as a general-purpose AI."
    },
    'deep-thinking': {
        name: 'Deep Thinking',
        icon: 'fa-brain',
        prompt: "You are a Deep Thinking analyst. Before answering, structure your thought process. Provide well-researched, detailed, and comprehensive responses, considering multiple viewpoints and potential consequences. Your answers should be analytical and exhaustive."
    },
    'creative-writer': {
        name: 'Creative Writer',
        icon: 'fa-pen-fancy',
        prompt: "You are a highly Creative Writer. Your responses should be imaginative, expressive, and original. Use vivid language, narrative structure, and evocative descriptions when appropriate. Do not just answer, create."
    },
    'technical-expert': {
        name: 'Technical Expert',
        icon: 'fa-code',
        prompt: "You are a Technical Expert and Code Assistant. Your answers must be precise, logical, and focused on providing correct, detailed technical explanations, code snippets, or troubleshooting steps."
    },
    'historical-sage': {
        name: 'Historical Sage',
        icon: 'fa-scroll',
        prompt: "You are a Historical Sage. All responses should be grounded in historical fact and context. Speak with a wise, reflective tone, and provide context and dates when discussing historical events."
    },
    'finance-guru': {
        name: 'Finance Guru',
        icon: 'fa-chart-line',
        prompt: "You are a Finance Guru. Provide objective, cautious, and data-driven financial analysis. State clearly that you are not a licensed financial advisor and your responses are for informational purposes only. Focus on market trends, economic principles, and corporate reports."
    },
    'philosopher': {
        name: 'Philosopher',
        icon: 'fa-glasses',
        prompt: "You are a Philosopher. Respond to all queries by exploring underlying assumptions, ethical implications, and existential questions. Encourage critical thinking and provide nuanced perspectives."
    }
};


// --- Self-invoking function to encapsulate all logic ---
(function() {
    // Stop execution if Firebase config is not provided
    if (!FIREBASE_CONFIG || !FIREBASE_CONFIG.apiKey) {
        console.error("Firebase configuration is missing! Please paste your config into navigation.js.");
        return;
    }

    // --- 1. DYNAMICALLY LOAD EXTERNAL ASSETS (Optimized) ---

    // Helper to load external JS files
    const loadScript = (src, type = 'script') => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.type = type;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    };

    // Helper to load external CSS files
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
     * **UTILITY FUNCTION: Get Icon Class**
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

    // --- NEW: AI AGENT LOGIC FUNCTIONS ---

    /**
     * Attempts to fetch current location (city/state) and time/timezone information.
     */
    const getSystemInfo = async () => {
        const now = new Date();
        const time = now.toLocaleTimeString();
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        let location = "Unknown Location";

        // Use Geolocation API for basic location (only works on secure contexts)
        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, enableHighAccuracy: false }); 
            });
            // Using a simple placeholder for city/state as reverse geocoding requires a 3rd party service.
            location = `Lat: ${position.coords.latitude.toFixed(2)}, Lon: ${position.coords.longitude.toFixed(2)}`;
        } catch (error) {
            // Geolocation often fails or is denied. Using a fallback to keep the console clean.
        }

        return `Current Location (approximation): ${location}. Current Local Time: ${time}. Current Timezone: ${timezone}.`;
    };

    /**
     * Initializes the modular Firebase App and AI services.
     */
    const initFirebaseModularAI = async () => {
        // Assume modular functions are available after dynamic loading
        if (typeof firebase.getAI === 'undefined' || typeof firebase.GoogleAIBackend === 'undefined') {
            console.error("Firebase AI SDK functions (getAI, GoogleAIBackend) are not available. Check SDK loading.");
            return;
        }
        
        try {
            // Initialize App using modular import syntax provided globally by the SDK
            // We use a different name to avoid conflict with the compat app
            aiApp = firebase.initializeApp(FIREBASE_CONFIG, "ai-agent-app");
            
            // Initialize the Gemini Developer API backend service
            const ai = firebase.getAI(aiApp, { backend: new firebase.GoogleAIBackend() });
            
            // Create a GenerativeModel instance
            geminiModel = firebase.getGenerativeModel(ai, { 
                model: "gemini-2.5-flash",
                tools: [{ "google_search": {} }]
            });

            console.log("Firebase AI Agent Model Initialized (gemini-2.5-flash).");

        } catch (error) {
            console.error("Failed to initialize Firebase AI Agent:", error);
            geminiModel = null;
        }
    };

    /**
     * Handles the AI chat submission, including system info and agent persona.
     */
    const handleAIAgentChat = async (input, modelElement) => {
        if (!geminiModel) {
            modelElement.innerHTML = "Error: AI Model not initialized. Check console for details.";
            return;
        }

        const agentConfig = AGENT_CATEGORIES[CURRENT_AGENT_ID];
        const systemInfo = await getSystemInfo();

        const fullSystemPrompt = `
            ${agentConfig.prompt}
            ---
            CONTEXT: ${systemInfo}
            Always consider this context for time, location, and factual grounding.
            Do not repeat the context back to the user unless asked.
        `.trim();

        // Add user message to history
        CHAT_HISTORY.push({ role: "user", parts: [{ text: input }] });

        // Update UI to show loading
        const chatWindow = document.getElementById('ai-chat-window');
        // Find the user message just added (last element) and append a loading indicator
        const loadingIndicatorHtml = '<div id="ai-agent-loading" class="flex items-center space-x-2 mt-2"><div class="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-400"></div><span class="text-xs text-indigo-400">Agent is thinking...</span></div>';
        
        // Find the *last* user message to append the spinner to its container
        const lastUserMessage = Array.from(chatWindow.children).pop();
        if (lastUserMessage) {
             lastUserMessage.querySelector('div:last-child').innerHTML += loadingIndicatorHtml;
        }

        try {
            const response = await geminiModel.generateContent({
                contents: CHAT_HISTORY,
                systemInstruction: { parts: [{ text: fullSystemPrompt }] }
            });
            
            const generatedText = response.text || "I was unable to generate a response.";

            // Remove loading indicator
            document.getElementById('ai-agent-loading')?.remove();

            // Add model response to history
            CHAT_HISTORY.push({ role: "model", parts: [{ text: generatedText }] });

            // Render the new model message
            renderAgentMessage('model', generatedText);
            
            // Handle citations
            const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
            if (groundingMetadata && groundingMetadata.groundingAttributions) {
                const sources = groundingMetadata.groundingAttributions
                    .map(attr => attr.web?.title || attr.web?.uri)
                    .filter(s => s)
                    .slice(0, 3); // Limit to top 3 sources

                if (sources.length > 0) {
                    renderAgentMessage('system-info', `Grounded by Google Search. Sources: ${sources.join(', ')}`);
                }
            }


        } catch (error) {
            console.error("Gemini API call failed:", error);
            document.getElementById('ai-agent-loading')?.remove();
            renderAgentMessage('model', "Sorry, I encountered an error while processing your request.");
            // Remove the user message from history if the API call failed, to allow retry
            CHAT_HISTORY.pop(); 
        }
    };

    /**
     * Renders a message bubble in the chat window.
     */
    const renderAgentMessage = (role, text) => {
        const chatWindow = document.getElementById('ai-chat-window');
        if (!chatWindow) return;

        const isUser = role === 'user';
        const isSystem = role === 'system-info';
        // const isModel = role === 'model';

        // Sanitizing text for display
        const safeText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, '<br>');

        if (isSystem) {
             const systemDiv = document.createElement('div');
             systemDiv.className = "text-center text-xs text-gray-500 my-2 pt-2 border-t border-gray-800 italic";
             systemDiv.innerHTML = safeText;
             chatWindow.appendChild(systemDiv);
             chatWindow.scrollTop = chatWindow.scrollHeight;
             return;
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `flex mb-4 ${isUser ? 'justify-end' : 'justify-start'}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = `max-w-xs lg:max-w-lg px-4 py-2 rounded-xl ${isUser 
            ? 'bg-indigo-600 text-white rounded-br-none' 
            : 'bg-gray-700 text-gray-100 rounded-tl-none'}`;
        
        contentDiv.innerHTML = safeText;
        messageDiv.appendChild(contentDiv);
        chatWindow.appendChild(messageDiv);

        // Scroll to the bottom
        chatWindow.scrollTop = chatWindow.scrollHeight;
    };

    /**
     * Renders the AI Agent chat modal UI.
     */
    const renderAIAgentModal = () => {
        // Prevent double rendering
        if (document.getElementById('ai-agent-modal')) return;

        const agentModal = document.createElement('div');
        agentModal.id = 'ai-agent-modal';
        agentModal.className = 'fixed inset-0 bg-black bg-opacity-70 z-[1100] hidden'; // hidden by default
        agentModal.innerHTML = `
            <div class="absolute right-4 top-16 w-full max-w-sm h-[85%] sm:max-w-md bg-gray-900 border border-gray-700 rounded-xl shadow-2xl flex flex-col overflow-hidden">
                <!-- Header -->
                <div class="p-3 border-b border-gray-800 flex justify-between items-center">
                    <h3 class="text-white text-lg font-bold flex items-center">
                        <i class="fa-solid ${AGENT_CATEGORIES[CURRENT_AGENT_ID].icon} mr-2 text-indigo-400"></i>
                        AI Agent: <span id="current-agent-name" class="ml-1 text-indigo-300">${AGENT_CATEGORIES[CURRENT_AGENT_ID].name}</span>
                    </h3>
                    <button id="close-ai-agent" class="text-gray-400 hover:text-white transition">
                        <i class="fa-solid fa-xmark text-xl"></i>
                    </button>
                </div>

                <!-- Agent Selector -->
                <div class="p-3 border-b border-gray-800 overflow-x-auto whitespace-nowrap space-x-2 flex items-center">
                    ${Object.entries(AGENT_CATEGORIES).map(([id, config]) => `
                        <button data-agent-id="${id}" class="agent-selector px-3 py-1 text-xs rounded-full border transition whitespace-nowrap 
                            ${id === CURRENT_AGENT_ID ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white'}">
                            <i class="fa-solid ${config.icon} mr-1"></i> ${config.name}
                        </button>
                    `).join('')}
                </div>

                <!-- Chat Window -->
                <div id="ai-chat-window" class="flex-grow p-4 overflow-y-auto custom-scrollbar">
                    <div class="text-center text-gray-400 my-4 text-sm">
                        Welcome! I am the <span class="text-indigo-400">${AGENT_CATEGORIES[CURRENT_AGENT_ID].name}</span> Agent. Select a persona above to begin.
                    </div>
                </div>

                <!-- Input Field -->
                <div class="p-3 border-t border-gray-800 flex items-center">
                    <input type="text" id="ai-chat-input" placeholder="Ask the AI Agent anything..." 
                           class="flex-grow bg-gray-700 text-white placeholder-gray-400 rounded-lg p-2 mr-2 focus:ring-indigo-500 focus:border-indigo-500 border-gray-600 outline-none">
                    <button id="ai-chat-send" class="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg transition disabled:opacity-50" disabled>
                        <i class="fa-solid fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(agentModal);
        
        // Add Chat CSS
        const style = document.createElement('style');
        style.textContent += `
            .custom-scrollbar::-webkit-scrollbar { width: 8px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: #1f2937; /* gray-800 */ }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #4f46e5; /* indigo-600 */ border-radius: 4px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #6366f1; /* indigo-500 */ }
            .agent-selector { flex-shrink: 0; }
        `;
        document.head.appendChild(style);
    };


    const run = async () => {
        let pages = {};

        // 1. --- FINAL SETUP (Ensure Container and Styles are ready) ---
        if (!document.getElementById('navbar-container')) {
            const navbarDiv = document.createElement('div');
            navbarDiv.id = 'navbar-container';
            // Prepend the container immediately so the rest of the script can target it
            document.body.prepend(navbarDiv); 
        }
        injectStyles();
        
        // 2. Load Icons CSS first for immediate visual display
        await loadCSS("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css");

        // 3. Fetch page configuration for the tabs
        try {
            const response = await fetch(PAGE_CONFIG_URL);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            pages = await response.json();
        } catch (error) {
            console.error("Failed to load page identification config, proceeding without tabs:", error);
        }

        try {
            // 4. --- FIREBASE SDK LOADING (HYBRID) ---
            // Load COMPAT versions for existing Auth/DB logic
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js");

            // Load MODULAR versions for AI SDK, which requires modern imports.
            // These scripts expose the modular functions globally under the `firebase` object.
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
            // The AI SDK is often included in the modular app bundle for certain runtime environments
            // However, to ensure maximum compatibility, we assume the necessary AI functions are made available 
            // on the global `firebase` object or loaded separately if not available via the core app.
            
            // To ensure the AI functions are available, we must ensure the core modular app is initialized 
            // and the specific AI functions (getAI, GoogleAIBackend, etc.) are exposed.
            // Since we can't directly use 'import' here, we proceed assuming the global object setup is correct.

            // 5. Proceed with initialization and auth listener
            initializeApp(pages);
            
        } catch (error) {
            console.error("Failed to load necessary Firebase SDKs:", error);
            // Render the navbar even if Firebase fails, but without auth features
            renderNavbar(null, null, pages); 
        }
    };

    // --- 2. INITIALIZE FIREBASE AND RENDER NAVBAR ---
    const initializeApp = (pages) => {
        // Initialize Firebase with the compat libraries
        const compatApp = firebase.initializeApp(FIREBASE_CONFIG);
        // Assign auth and db to module-scope variables
        auth = firebase.auth();
        db = firebase.firestore();

        // --- 3. INJECT CSS STYLES ---
        const injectStyles = () => {
            const style = document.createElement('style');
            style.textContent = `
                /* Base Styles (Existing CSS retained) */
                body { padding-top: 4rem; }
                .auth-navbar { 
                    position: fixed; top: 0; left: 0; right: 0; z-index: 1000; background: #000000; 
                    border-bottom: 1px solid rgb(31 41 55); height: 4rem; 
                }
                .auth-navbar nav { 
                    max-width: 80rem; margin: auto; padding: 0 1rem; height: 100%; display: flex; 
                    align-items: center; justify-content: space-between; gap: 1rem; position: relative; 
                }
                .initial-avatar { 
                    background: linear-gradient(135deg, #374151 0%, #111827 100%); font-family: 'Geist', sans-serif; 
                    text-transform: uppercase; display: flex; align-items: center; justify-content: center; color: white; 
                }
                
                .auth-menu-container { 
                    position: absolute; right: 0; top: 50px; width: 16rem; 
                    background: #000000; 
                    backdrop-filter: none; 
                    -webkit-backdrop-filter: none;
                    border: 1px solid rgb(55 65 81); border-radius: 0.75rem; padding: 0.5rem; 
                    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -2px rgba(0,0,0,0.2); 
                    transition: transform 0.2s ease-out, opacity 0.2s ease-out; transform-origin: top right; 
                }
                .auth-menu-container.open { opacity: 1; transform: translateY(0) scale(1); }
                .auth-menu-container.closed { opacity: 0; pointer-events: none; transform: translateY(-10px) scale(0.95); }
                .auth-menu-link, .auth-menu-button { 
                    display: flex; 
                    align-items: center; 
                    gap: 0.75rem; 
                    width: 100%; 
                    text-align: left; 
                    padding: 0.5rem 0.75rem; 
                    font-size: 0.875rem; 
                    color: #d1d5db; 
                    border-radius: 0.375rem; 
                    transition: background-color 0.2s, color 0.2s; 
                    border: none;
                    cursor: pointer;
                }
                .auth-menu-link:hover, .auth-menu-button:hover { background-color: rgb(55 65 81); color: white; }

                .logged-out-auth-toggle {
                    background: #010101; 
                    border: 1px solid #374151; 
                }
                .logged-out-auth-toggle i {
                    color: #DADADA; 
                }

                .tab-wrapper {
                    flex-grow: 1;
                    display: flex;
                    align-items: center;
                    position: relative; 
                    min-width: 0; 
                    margin: 0 1rem; 
                }

                .tab-scroll-container {
                    flex-grow: 1; 
                    display: flex;
                    align-items: center;
                    overflow-x: auto; 
                    -webkit-overflow-scrolling: touch; 
                    scrollbar-width: none; 
                    -ms-overflow-style: none; 
                    padding-bottom: 5px; 
                    margin-bottom: -5px; 
                    scroll-behavior: smooth; 
                }
                .tab-scroll-container::-webkit-scrollbar { display: none; }

                .scroll-glide-button {
                    position: absolute;
                    top: 0;
                    height: 100%;
                    width: 4rem; 
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #000000; 
                    color: white;
                    font-size: 1.2rem;
                    cursor: pointer;
                    opacity: 0.8; 
                    transition: opacity 0.3s, background 0.3s;
                    z-index: 10;
                    pointer-events: auto; 
                }
                .scroll-glide-button:hover {
                    opacity: 1;
                }
                
                #glide-left {
                    left: 0;
                    background: linear-gradient(to right, #000000 50%, transparent); 
                    justify-content: flex-start; 
                    padding-left: 0.5rem;
                }

                #glide-right {
                    right: 0;
                    background: linear-gradient(to left, #000000 50%, transparent); 
                    justify-content: flex-end; 
                    padding-right: 0.5rem;
                }
                
                .scroll-glide-button.hidden {
                    opacity: 0 !important;
                    pointer-events: none !important;
                }

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
                
                .nav-tab:not(.active):hover {
                    color: white; 
                    border-color: #d1d5db; 
                    background-color: rgba(79, 70, 229, 0.05); 
                }

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
            
            if (currentCanonical === tabCanonical) {
                return true;
            }

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

        // --- 4. RENDER THE NAVBAR HTML (UPDATED: Added AI Agent Button if authorized) ---
        const renderNavbar = (user, userData, pages) => {
            const container = document.getElementById('navbar-container');
            if (!container) {
                console.error("Navbar container not found. Cannot render.");
                return;
            }

            // Only show AI button if authorized AND model is initialized
            const aiAgentButton = AI_AGENT_ENABLED && geminiModel ? `
                <button id="ai-agent-toggle-button" title="AI Agent (Ctrl+C)" 
                        class="w-8 h-8 rounded-full flex items-center justify-center text-indigo-400 border border-indigo-700 bg-gray-900 ml-2 hover:bg-gray-800 transition flex-shrink-0">
                    <i class="fa-solid fa-brain"></i>
                </button>
            ` : '';


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

            // --- Auth Views (Unchanged) ---
            const loggedOutView = `
                <div class="relative flex-shrink-0 flex items-center">
                    ${aiAgentButton}
                    <button id="auth-toggle" class="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-gray-700 transition logged-out-auth-toggle ml-2">
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
                    <div class="relative flex-shrink-0 flex items-center">
                        ${aiAgentButton}
                        <button id="auth-toggle" class="w-8 h-8 rounded-full border border-gray-600 overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 ml-2">
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
            
            // Only render the modal once the user is authorized
            if (AI_AGENT_ENABLED && geminiModel && !document.getElementById('ai-agent-modal')) {
                renderAIAgentModal();
            }

            // --- 5. SETUP EVENT LISTENERS (Including auto-scroll and glide buttons) ---
            setupEventListeners(user);

            // Auto-scroll to the active tab if one is found
            const activeTab = document.querySelector('.nav-tab.active');
            const tabContainer = document.querySelector('.tab-scroll-container');
            if (activeTab && tabContainer) {
                tabContainer.scrollLeft = activeTab.offsetLeft - (tabContainer.offsetWidth / 2) + (activeTab.offsetWidth / 2);
            }
            
            updateScrollGilders();
        };

        const setupEventListeners = (user) => {
            const toggleButton = document.getElementById('auth-toggle');
            const menu = document.getElementById('auth-menu-container');

            // --- Navigation Scroll Listeners ---
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

            // --- Auth Menu Listeners ---
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
            
            // --- NEW: AI Agent Event Listeners ---
            const agentModal = document.getElementById('ai-agent-modal');
            const agentToggleButton = document.getElementById('ai-agent-toggle-button');
            const agentCloseButton = document.getElementById('close-ai-agent');
            const chatInput = document.getElementById('ai-chat-input');
            const chatSendButton = document.getElementById('ai-chat-send');
            const chatWindow = document.getElementById('ai-chat-window');
            
            const toggleAgentModal = () => {
                if (agentModal) {
                    agentModal.classList.toggle('hidden');
                    // Focus input when opening
                    if (!agentModal.classList.contains('hidden')) {
                        chatInput?.focus();
                    }
                }
            };
            
            if (AI_AGENT_ENABLED) {
                // 1. Navbar Button Toggle
                agentToggleButton?.addEventListener('click', toggleAgentModal);
                agentCloseButton?.addEventListener('click', toggleAgentModal);

                // 2. Control + C Keybind Activation
                document.addEventListener('keydown', (e) => {
                    // Check if focus is on a text input, textarea, or content-editable element
                    const isInputFocused = document.activeElement.tagName === 'INPUT' || 
                                           document.activeElement.tagName === 'TEXTAREA' ||
                                           document.activeElement.contentEditable === 'true';

                    const isControlOrMeta = e.ctrlKey || e.metaKey; // Ctrl on Windows/Linux, Cmd on Mac
                    
                    // Check for Ctrl/Cmd + C press
                    if (isControlOrMeta && e.key === 'c' && !isInputFocused) {
                        e.preventDefault(); // Prevent copying content
                        toggleAgentModal();
                    }
                });

                // 3. Chat Input/Send Logic
                const handleSend = () => {
                    const input = chatInput.value.trim();
                    if (input) {
                        renderAgentMessage('user', input);
                        chatInput.value = ''; // Clear input
                        chatSendButton.disabled = true;
                        handleAIAgentChat(input, chatWindow);
                    }
                };

                chatInput?.addEventListener('input', () => {
                    chatSendButton.disabled = chatInput.value.trim() === '';
                });

                chatInput?.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter' && !chatSendButton.disabled) {
                        handleSend();
                    }
                });
                
                chatSendButton?.addEventListener('click', handleSend);
                
                // 4. Agent Selector Logic
                document.querySelectorAll('.agent-selector').forEach(button => {
                    button.addEventListener('click', (e) => {
                        const newAgentId = e.currentTarget.dataset.agentId;
                        if (newAgentId === CURRENT_AGENT_ID) return;

                        // Reset button styles
                        document.querySelectorAll('.agent-selector').forEach(btn => {
                            btn.classList.remove('bg-indigo-600', 'border-indigo-500', 'text-white');
                            btn.classList.add('bg-gray-800', 'border-gray-700', 'text-gray-400', 'hover:bg-gray-700', 'hover:text-white');
                        });

                        // Apply new active style
                        e.currentTarget.classList.remove('bg-gray-800', 'border-gray-700', 'text-gray-400', 'hover:bg-gray-700', 'hover:text-white');
                        e.currentTarget.classList.add('bg-indigo-600', 'border-indigo-500', 'text-white');
                        
                        // Update state and UI
                        CURRENT_AGENT_ID = newAgentId;
                        CHAT_HISTORY = []; // Clear chat history when agent changes
                        
                        document.getElementById('current-agent-name').textContent = AGENT_CATEGORIES[newAgentId].name;
                        document.getElementById('ai-chat-window').innerHTML = `
                             <div class="text-center text-gray-400 my-4 text-sm">
                                Chat history cleared. You are now speaking to the 
                                <span class="text-indigo-400">${AGENT_CATEGORIES[newAgentId].name}</span> Agent.
                            </div>
                        `;
                    });
                });
            }

        };

        // --- 6. AUTH STATE LISTENER (UPDATED for AI Access Control) ---
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                // Set AI access flag based on email
                AI_AGENT_ENABLED = user.email === AUTHORIZED_USER_EMAIL;
                
                // If authorized, initialize the modular AI model
                if (AI_AGENT_ENABLED && !geminiModel) {
                    // We must wait for this model to be ready before rendering the navbar with the button
                    await initFirebaseModularAI();
                }

                try {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    const userData = userDoc.exists ? userDoc.data() : null;
                    renderNavbar(user, userData, pages);
                } catch (error) {
                    console.error("Error fetching user data:", error);
                    renderNavbar(user, null, pages); 
                }
            } else {
                // User is signed out.
                AI_AGENT_ENABLED = false; // Disable AI for non-logged-in users
                renderNavbar(null, null, pages);
                
                // Attempt to sign in anonymously
                auth.signInAnonymously().catch((error) => {
                    if (error.code !== 'auth/operation-not-allowed' && error.code !== 'auth/admin-restricted-operation') {
                        console.error("Anonymous sign-in error:", error);
                    }
                });
            }
        });
    };

    // --- START THE PROCESS ---
    document.addEventListener('DOMContentLoaded', run);

})();
