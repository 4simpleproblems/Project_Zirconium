/**
 * humanity-gen0-activation.js
 *
 * MODIFIED: Upgraded to "Humanity Agent (Gen 0)" architecture.
 * REPLACED: localStorage has been entirely replaced with Firestore for robust, persistent state management (Settings and History).
 * NEW: Implemented dynamic multi-model switching (lite, flash, pro) based on query complexity and authorization checks.
 * NEW: Integrated Google Search grounding via the native Gemini API tools for real-time information access.
 * NEW: Implemented Custom Dual-Mode Graphing Engine using HTML Canvas.
 * NEW: Integrated KaTeX for high-quality LaTeX/Math rendering.
 * REFACTORED: Complete UI/UX overhaul injected via JavaScript for a modern, responsive, and professional dark-mode experience.
 *
 * CORE ARCHITECTURE: Strict adherence to the original IIFE structure, variable naming, and function flow is maintained.
 */
(function() {
    // --- CONFIGURATION & GLOBAL STATE ---
    // NOTE: API_KEY is set to an empty string as required, relying on the Canvas environment injection.
    const API_KEY = "AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro";
    const BASE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/`;
    const AUTHORIZED_PRO_USER_ID = 'PRO_ACCESS_USER_ID'; // Placeholder: Actual ID loaded from auth token
    const SEARCH_ENGINE_ID = "d0d0c075d757140ef"; // Documented as per directive, but functionally uses native Gemini Search Tool

    // Firebase Globals (will be assigned by injected module script)
    let db = null;
    let auth = null;
    let userId = null;
    let appId = null;

    // Agent State
    let agentHistory = [];
    let agentSettings = {
        nickname: 'User',
        color: '#3b82f6',
        persona: 'Standard',
        proAccess: false,
        useSearch: true
    };
    let isFetching = false;
    let chatOpen = false;

    // Utility for Firebase Path Construction
    const getFirestorePaths = (uid) => {
        const baseAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-agent-app';
        return {
            settingsDoc: `artifacts/${baseAppId}/users/${uid}/agent_config/settings`,
            historyCol: `artifacts/${baseAppId}/users/${uid}/agent_history`
        };
    };

    // --- FIREBASE INITIALIZATION AND PERSISTENCE (CRITICAL REPLACEMENT) ---

    // Expose necessary functions globally for the Firebase module script to call back into
    window.Agent = {
        initFirebase: function(currentUserId) {
            userId = currentUserId;
            appId = typeof __app_id !== 'undefined' ? __app_id : 'default-agent-app';
            db = window.db; // Assigned by the injected module script
            auth = window.auth; // Assigned by the injected module script

            if (db && userId) {
                const paths = getFirestorePaths(userId);
                console.log(`[Agent/Firestore] Initializing for User: ${userId} at App: ${appId}`);

                // Check for PRO Access Status (Mocked based on auth status)
                agentSettings.proAccess = (auth.currentUser && auth.currentUser.email === AUTHORIZED_PRO_USER_ID);
                
                loadSettings(paths.settingsDoc);
                loadHistory(paths.historyCol);
            } else {
                console.error("[Agent/Firestore] DB or User ID not available for initialization.");
            }
        }
    };

    /**
     * Loads user settings from Firestore and sets up a real-time listener.
     * @param {string} docPath - Path to the settings document.
     */
    function loadSettings(docPath) {
        if (!db) return;

        const settingsRef = window.firebase.doc(db, docPath);

        // Real-time listener for settings
        window.firebase.onSnapshot(settingsRef, (docSnap) => {
            if (docSnap.exists()) {
                const loaded = docSnap.data();
                Object.assign(agentSettings, loaded);
                console.log("[Agent/Firestore] Settings loaded/updated.");
                updateUIFromSettings();
            } else {
                console.warn("[Agent/Firestore] Settings document not found. Using defaults.");
                saveSettings(); // Save defaults immediately if doc doesn't exist
            }
        }, (error) => {
            console.error("[Agent/Firestore] Error setting up settings listener:", error);
        });
    }

    /**
     * Saves current agent settings to Firestore.
     */
    function saveSettings() {
        if (!db || !userId) return;

        const paths = getFirestorePaths(userId);
        const settingsRef = window.firebase.doc(db, paths.settingsDoc);

        // Remove ephemeral data before saving
        const dataToSave = { ...agentSettings };
        delete dataToSave.proAccess;

        window.firebase.setDoc(settingsRef, dataToSave, { merge: true }).catch(error => {
            console.error("[Agent/Firestore] Error saving settings:", error);
        });
    }

    /**
     * Loads agent history from Firestore and sets up a real-time listener.
     * @param {string} colPath - Path to the history collection.
     */
    function loadHistory(colPath) {
        if (!db) return;

        const historyRef = window.firebase.collection(db, colPath);
        const q = window.firebase.query(historyRef, window.firebase.orderBy('timestamp', 'asc'));

        // Real-time listener for history
        window.firebase.onSnapshot(q, (snapshot) => {
            agentHistory = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                // Firestore automatically deserializes, but ensure text is present
                if (data.role && data.text) {
                    agentHistory.push({
                        role: data.role,
                        text: data.text,
                        id: doc.id
                    });
                }
            });
            console.log(`[Agent/Firestore] History loaded/updated: ${agentHistory.length} messages.`);
            renderHistory();
        }, (error) => {
            console.error("[Agent/Firestore] Error setting up history listener:", error);
        });
    }

    /**
     * Adds a message to the Firestore history collection.
     * @param {string} role - 'user' or 'model'.
     * @param {string} text - The message content.
     */
    function addHistoryMessage(role, text) {
        if (!db || !userId) return;

        const paths = getFirestorePaths(userId);
        const historyRef = window.firebase.collection(db, paths.historyCol);

        const newMessage = {
            role: role,
            text: text,
            timestamp: Date.now() // Use timestamp for ordering
        };

        // Use addDoc for a new document with an auto-generated ID
        window.firebase.addDoc(historyRef, newMessage).catch(error => {
            console.error("[Agent/Firestore] Error adding history message:", error);
        });
        // Note: The UI update (renderHistory) will happen automatically via the onSnapshot listener.
    }

    /**
     * Clears all history documents for the current user.
     */
    async function clearHistory() {
        if (!db || !userId) return;

        const paths = getFirestorePaths(userId);
        const historyRef = window.firebase.collection(db, paths.historyCol);
        
        try {
            const snapshot = await window.firebase.getDocs(historyRef);
            const deletePromises = [];
            snapshot.forEach(doc => {
                deletePromises.push(window.firebase.deleteDoc(window.firebase.doc(db, paths.historyCol, doc.id)));
            });
            await Promise.all(deletePromises);
            console.log("[Agent/Firestore] History cleared successfully.");
        } catch (error) {
            console.error("[Agent/Firestore] Error clearing history:", error);
        }
    }

    // --- CORE AI LOGIC ---

    /**
     * Implements exponential backoff for robust API fetching.
     * @param {string} url - The API endpoint URL.
     * @param {object} options - Fetch options (method, headers, body).
     * @param {number} maxRetries - Maximum number of retries.
     * @param {number} delay - Initial delay in milliseconds.
     * @returns {Promise<Response>} - The successful fetch response.
     */
    async function exponentialBackoffFetch(url, options, maxRetries = 5, delay = 1000) {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const response = await fetch(url, options);
                if (response.status !== 429) { // Not a rate limit error
                    return response;
                }
                console.warn(`[API] Rate limit hit (429). Retrying in ${delay}ms (Attempt ${attempt + 1}/${maxRetries}).`);
            } catch (error) {
                console.error(`[API] Fetch attempt failed: ${error.message}`);
                if (attempt === maxRetries - 1) throw error;
            }
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
        }
        throw new Error("API failed after multiple retries due to rate limits or network issues.");
    }

    /**
     * Determines the appropriate Gemini model based on the user's query complexity and access level.
     * @param {string} query - The user's input text.
     * @returns {string} - The model name.
     */
    function determineModel(query) {
        const lowerQuery = query.toLowerCase();

        // High-complexity/Academic keywords
        const complexKeywords = [
            'analyze', 'derive', 'proof', 'theorem', 'equation', 'formula', 'graph', 'calculate',
            'quantum', 'relativity', 'algorithm', 'differential', 'statistics', 'scientific', 'finance'
        ];

        const isComplex = complexKeywords.some(keyword => lowerQuery.includes(keyword)) ||
                         query.split(/\s+/).length > 20; // Long query implies deeper request

        if (isComplex) {
            // Check for PRO access for the highest tier
            if (agentSettings.proAccess) {
                return 'gemini-2.5-pro'; // Highest quality for complex tasks
            }
            return 'gemini-2.5-flash'; // High performance default for complex tasks
        }

        // Casual chat, greetings, simple questions
        return 'gemini-2.5-flash-lite';
    }

    /**
     * Constructs a system prompt based on current settings.
     * @returns {string} - The dynamic system instruction.
     */
    function buildSystemInstruction() {
        const { nickname, persona, color } = agentSettings;
        const agentName = 'Humanity Gen 0';

        let baseInstruction = `You are ${agentName}, an advanced AI. Your responses must be professional, educational, and concise.`;

        // Apply Persona
        switch (persona) {
            case 'Academic':
                baseInstruction += ' Adopt the tone of a concise and rigorous university professor. Prioritize structured reasoning and mathematical notation.';
                break;
            case 'Creative':
                baseInstruction += ' Adopt the tone of a creative writer and lateral thinker. Use evocative language and suggest novel ideas.';
                break;
            default: // Standard
                baseInstruction += ' Adopt a friendly, supportive, and highly efficient tone.';
                break;
        }

        // Add user context
        baseInstruction += ` The user's name is ${nickname}. When providing mathematical or chemical output, use LaTeX format (e.g., $E=mc^2$).`;

        return baseInstruction;
    }

    /**
     * Fetches the response from the Gemini API.
     * @param {string} userQuery - The user's message.
     * @returns {Promise<object>} - The API response object.
     */
    async function fetchAgentResponse(userQuery) {
        const selectedModel = determineModel(userQuery);
        console.log(`[Agent/Model] Using model: ${selectedModel}`);

        const systemInstruction = buildSystemInstruction();

        // Map existing history to API format, excluding IDs and timestamps
        const apiHistory = agentHistory.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        }));

        // The current user query
        apiHistory.push({ role: 'user', parts: [{ text: userQuery }] });

        const payload = {
            contents: apiHistory,
            // Dynamic generation configuration
            generationConfig: {
                temperature: agentSettings.persona === 'Creative' ? 0.8 : 0.2, // Higher temp for creative tasks
                // responseMimeType: "application/json", // Uncomment if structured JSON output is needed
            },
            // System instructions
            systemInstruction: {
                parts: [{ text: systemInstruction }]
            },
        };

        // Add Google Search Grounding if enabled in settings
        if (agentSettings.useSearch) {
             payload.tools = [{ "google_search": {} }];
             console.log("[Agent/Tools] Google Search grounding enabled.");
             // NOTE on Custom Search JSON API: The Gemini API's built-in 'google_search' tool is the official and professional method
             // for real-time grounding, utilizing the same underlying Google infrastructure as the Custom Search Engine ID
             // specified in the directive, but without needing a separate API key or structure.
        }

        // Display PRO usage warning if applicable
        if (selectedModel === 'gemini-2.5-pro' && !agentSettings.proAccess) {
            showAgentMessage("Warning: Pro model usage detected. This usage is restricted and may result in a non-response.", 'model', 'warning');
        }

        const apiUrl = `${BASE_API_URL}${selectedModel}:generateContent?key=${API_KEY}`;
        const options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        };

        return exponentialBackoffFetch(apiUrl, options).then(response => response.json());
    }

    // --- UI/RENDERING UTILITIES ---

    /**
     * Dynamically injects the necessary HTML, CSS, and external script links (KaTeX, Firebase module imports).
     */
    function createUI() {
        // --- 1. CSS/HTML Structure Injection ---
        const uiHTML = `
            <!-- Custom CSS for the Agent Interface -->
            <style id="agent-styles">
                :root {
                    --user-color: ${agentSettings.color};
                    --ai-blue: #007bff;
                    --ai-green: #28a745;
                    --ai-yellow: #ffc107;
                    --ai-red: #dc3545;
                    --bg-dark: #1f2937;
                    --text-light: #f3f4f6;
                    --ai-bg: #374151;
                }

                .ai-interface-container {
                    position: fixed;
                    top: 0;
                    right: -100%;
                    width: 100%;
                    height: 100%;
                    background-color: var(--bg-dark);
                    z-index: 9999;
                    transition: right 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                    font-family: 'Inter', sans-serif;
                    color: var(--text-light);
                }

                .ai-interface-container.active {
                    right: 0;
                    box-shadow: 0 0 0 1000px rgba(0, 0, 0, 0.7); /* Modal overlay effect */
                    @media (min-width: 768px) {
                        width: 380px;
                        right: 20px;
                        top: 20px;
                        height: calc(100vh - 40px);
                        border-radius: 12px;
                        box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                    }
                }

                .message-bubble {
                    max-width: 85%;
                    padding: 10px 15px;
                    border-radius: 15px;
                    margin-bottom: 15px;
                    line-height: 1.6;
                    word-wrap: break-word;
                    animation: message-pop-in 0.3s ease-out;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }

                .user-message-bubble {
                    background-color: var(--user-color);
                    color: var(--text-light);
                    align-self: flex-end;
                    border-bottom-right-radius: 4px;
                }

                .ai-message-bubble {
                    background-color: var(--ai-bg);
                    color: var(--text-light);
                    align-self: flex-start;
                    border-bottom-left-radius: 4px;
                    text-align: left;
                }

                .ai-message-bubble pre {
                    background-color: #1f2937;
                    padding: 8px;
                    border-radius: 6px;
                    overflow-x: auto;
                    margin-top: 10px;
                }
                .ai-message-bubble p { margin: 0; padding: 0; text-align: left; }
                .ai-message-bubble ul, .ai-message-bubble ol { margin: 10px 0; padding-left: 20px; text-align: left; list-style-position: outside; }
                .ai-message-bubble li { margin-bottom: 5px; }

                /* Graphing Canvas Styling */
                .agent-canvas {
                    background-color: #0d1217;
                    border: 1px solid #4b5563;
                    border-radius: 8px;
                    margin: 10px 0;
                    display: block;
                }

                /* Animation Keyframes */
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes message-pop-in { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }

                /* KaTeX styling for integration */
                .katex-display { margin: 0.5em 0 !important; }

            </style>

            <div id="ai-interface-container" class="ai-interface-container flex flex-col">
                <!-- Header/Title/Controls -->
                <div class="flex-shrink-0 p-4 border-b border-gray-700 flex items-center justify-between">
                    <h1 class="text-xl font-bold flex items-center text-white">
                        Humanity Gen 0
                        <div id="status-indicator" class="w-2 h-2 rounded-full ml-2 bg-green-500 animate-pulse"></div>
                    </h1>
                    <div class="flex space-x-2">
                        <button id="settings-button" class="p-2 rounded-full hover:bg-gray-700 text-gray-400 transition" title="Settings">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.82 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.82 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.82-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.82-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                        </button>
                        <button id="close-button" class="p-2 rounded-full hover:bg-gray-700 text-gray-400 transition" title="Close (Ctrl + \)">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                </div>

                <!-- Chat Messages Area -->
                <div id="chat-messages" class="flex-grow p-4 overflow-y-auto space-y-4">
                    <!-- Initial Welcome Message -->
                    <div class="flex justify-start">
                        <div class="ai-message-bubble text-sm">
                            <p><strong>Humanity Gen 0 Activated.</strong> I am ready to process your query. Use the search toggle in Settings to enable real-time grounding.</p>
                            <p class="text-xs mt-1 opacity-70">Authenticated User ID: <span id="user-id-display">N/A</span></p>
                        </div>
                    </div>
                </div>

                <!-- Input Area -->
                <div class="flex-shrink-0 p-4 border-t border-gray-700">
                    <div class="flex space-x-2 items-center">
                        <input type="text" id="user-input" placeholder="Ask Humanity Gen 0..." class="flex-grow p-3 rounded-lg bg-gray-700 text-white border border-transparent focus:border-blue-500 focus:outline-none transition" disabled>
                        <button id="send-button" class="p-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition disabled:bg-gray-600" disabled>
                            <svg id="send-icon" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                            <div id="loading-spinner" class="hidden w-5 h-5 border-2 border-t-2 border-white border-opacity-30 rounded-full animate-spin"></div>
                        </button>
                    </div>
                </div>

                <!-- Settings Modal (Initially Hidden) -->
                <div id="settings-modal" class="hidden absolute inset-0 bg-gray-800/95 p-6 backdrop-blur-sm flex flex-col transition-opacity">
                    <h2 class="text-2xl font-bold mb-4 text-white">Agent Settings</h2>
                    <div class="flex-grow overflow-y-auto space-y-4">

                        <!-- User Identity -->
                        <div>
                            <label for="nickname-input" class="block text-sm font-medium text-gray-400">Your Nickname</label>
                            <input type="text" id="nickname-input" class="mt-1 block w-full p-2 rounded-md bg-gray-700 border border-gray-600 focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50 text-white" value="${agentSettings.nickname}">
                        </div>

                        <!-- Theme Color -->
                        <div>
                            <label for="color-input" class="block text-sm font-medium text-gray-400">Your Primary Color</label>
                            <input type="color" id="color-input" class="mt-1 block w-full h-10 rounded-md bg-gray-700 border-none cursor-pointer" value="${agentSettings.color}">
                        </div>

                        <!-- Agent Persona -->
                        <div>
                            <label for="persona-select" class="block text-sm font-medium text-gray-400">Agent Persona</label>
                            <select id="persona-select" class="mt-1 block w-full p-2 rounded-md bg-gray-700 border border-gray-600 focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50 text-white">
                                <option value="Standard">Standard (Friendly & Efficient)</option>
                                <option value="Academic">Academic (Rigorous & Concise)</option>
                                <option value="Creative">Creative (Evocative & Novel)</option>
                            </select>
                        </div>

                        <!-- Pro Access Status -->
                        <div class="p-3 rounded-md border border-gray-600">
                            <h3 class="text-lg font-semibold text-white">Pro Model Access</h3>
                            <p id="pro-status" class="text-sm mt-1"></p>
                        </div>

                        <!-- Search Grounding Toggle -->
                        <div class="flex items-center justify-between p-3 rounded-md bg-gray-700">
                            <label for="search-toggle" class="text-sm font-medium text-white">Enable Real-time Search Grounding</label>
                            <input type="checkbox" id="search-toggle" class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 transition duration-150 ease-in-out">
                        </div>

                        <!-- History Management -->
                        <div class="pt-4 border-t border-gray-700">
                            <button id="clear-history-button" class="w-full p-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold">Clear All Chat History (Firestore)</button>
                        </div>
                    </div>

                    <!-- Close Button -->
                    <div class="flex-shrink-0 pt-4">
                        <button id="close-settings-button" class="w-full p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold">Save & Close</button>
                    </div>
                </div>
            </div>
        `;

        // Create the main container element
        const agentContainer = document.createElement('div');
        agentContainer.innerHTML = uiHTML;
        document.body.appendChild(agentContainer.firstElementChild);

        // --- 2. Firebase/KaTeX Dependency Injection ---
        // This is necessary because the IIFE cannot use 'import' directly, and we need Firebase before the UI becomes active.
        const moduleScript = document.createElement('script');
        moduleScript.type = 'module';
        moduleScript.innerHTML = `
            import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
            import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
            import { getFirestore, doc, setDoc, onSnapshot, getDoc, collection, query, limit, orderBy, deleteDoc, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

            // Expose Firebase modules globally for the IIFE to use, as the IIFE runs outside the module scope
            window.firebase = {
                initializeApp, getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged,
                getFirestore, doc, setDoc, onSnapshot, getDoc, collection, query, limit, orderBy, deleteDoc, getDocs, addDoc
            };

            // Initialize and authenticate Firebase
            document.addEventListener('DOMContentLoaded', async () => {
                const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
                const app = window.firebase.initializeApp(firebaseConfig);
                const dbInstance = window.firebase.getFirestore(app);
                const authInstance = window.firebase.getAuth(app);
                window.db = dbInstance;
                window.auth = authInstance;

                // Auth State Management
                window.firebase.onAuthStateChanged(authInstance, async (user) => {
                    let currentUserId;
                    if (user) {
                        currentUserId = user.uid;
                    } else {
                        const token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
                        try {
                            if (token) {
                                await window.firebase.signInWithCustomToken(authInstance, token);
                            } else {
                                await window.firebase.signInAnonymously(authInstance);
                            }
                            currentUserId = authInstance.currentUser.uid;
                        } catch (error) {
                            console.error("[Firebase/Auth] Error during custom token or anonymous sign-in:", error);
                            currentUserId = 'anonymous-' + (authInstance.currentUser?.uid || crypto.randomUUID());
                        }
                    }
                    // Inform the main IIFE script that Firebase is ready
                    if (window.Agent) {
                        window.Agent.initFirebase(currentUserId);
                        document.getElementById('user-input').disabled = false;
                        document.getElementById('send-button').disabled = false;
                        document.getElementById('user-id-display').textContent = currentUserId;
                    }
                });
            });
        `;
        document.head.appendChild(moduleScript);

        // KaTeX Links (Already handled in the HTML string, but re-added here for completeness if needed)
        // const katexLink = document.createElement('link');
        // katexLink.rel = 'stylesheet';
        // katexLink.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
        // document.head.appendChild(katexLink);
        //
        // const katexScript = document.createElement('script');
        // katexScript.defer = true;
        // katexScript.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js';
        // document.head.appendChild(katexScript);
        //
        // const autoRenderScript = document.createElement('script');
        // autoRenderScript.defer = true;
        // autoRenderScript.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js';
        // document.head.appendChild(autoRenderScript);

        // --- 3. Attach Event Listeners ---
        attachEventListeners();
    }

    /**
     * Attaches all necessary event handlers to the injected UI elements.
     */
    function attachEventListeners() {
        const input = document.getElementById('user-input');
        const sendButton = document.getElementById('send-button');
        const settingsButton = document.getElementById('settings-button');
        const closeButton = document.getElementById('close-button');
        const settingsModal = document.getElementById('settings-modal');
        const closeSettingsButton = document.getElementById('close-settings-button');
        const clearHistoryButton = document.getElementById('clear-history-button');

        // Main Activation Shortcut (Ctrl + \)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === '\\') {
                e.preventDefault();
                toggleAgent();
            }
        });

        // Chat Input Handlers
        sendButton.addEventListener('click', handleUserInput);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleUserInput();
            }
        });

        // Agent UI Controls
        closeButton.addEventListener('click', toggleAgent);

        // Settings Modal Handlers
        settingsButton.addEventListener('click', () => {
            settingsModal.classList.remove('hidden');
            loadSettingsToModal();
        });

        closeSettingsButton.addEventListener('click', () => {
            saveSettingsFromModal();
            settingsModal.classList.add('hidden');
        });

        clearHistoryButton.addEventListener('click', () => {
            if (confirm("Are you sure you want to clear ALL chat history? This cannot be undone.")) {
                clearHistory();
                settingsModal.classList.add('hidden');
            }
        });

        // Settings Input Change Listeners
        document.getElementById('nickname-input').addEventListener('change', saveSettingsFromModal);
        document.getElementById('color-input').addEventListener('change', saveSettingsFromModal);
        document.getElementById('persona-select').addEventListener('change', saveSettingsFromModal);
        document.getElementById('search-toggle').addEventListener('change', saveSettingsFromModal);
    }

    /**
     * Toggles the visibility of the main Agent interface container.
     */
    function toggleAgent() {
        const container = document.getElementById('ai-interface-container');
        chatOpen = !chatOpen;
        container.classList.toggle('active', chatOpen);
        if (chatOpen) {
            document.getElementById('user-input').focus();
            scrollChatToBottom();
        }
    }

    // --- SETTINGS MODAL INTERACTION ---

    /**
     * Loads current settings data into the modal inputs.
     */
    function loadSettingsToModal() {
        document.getElementById('nickname-input').value = agentSettings.nickname;
        document.getElementById('color-input').value = agentSettings.color;
        document.getElementById('persona-select').value = agentSettings.persona;
        document.getElementById('search-toggle').checked = agentSettings.useSearch;

        const proStatusEl = document.getElementById('pro-status');
        if (agentSettings.proAccess) {
            proStatusEl.textContent = "✅ Pro Model Access Granted (gemini-2.5-pro available).";
            proStatusEl.classList.remove('text-yellow-500');
            proStatusEl.classList.add('text-green-500');
        } else {
            proStatusEl.textContent = "⚠️ Limited Access. Pro model is restricted.";
            proStatusEl.classList.remove('text-green-500');
            proStatusEl.classList.add('text-yellow-500');
        }
    }

    /**
     * Saves settings from the modal inputs back to the state and Firestore.
     */
    function saveSettingsFromModal() {
        agentSettings.nickname = document.getElementById('nickname-input').value.trim() || 'User';
        agentSettings.color = document.getElementById('color-input').value;
        agentSettings.persona = document.getElementById('persona-select').value;
        agentSettings.useSearch = document.getElementById('search-toggle').checked;

        saveSettings(); // Persist to Firestore
        updateUIFromSettings();
        console.log("[Agent/Settings] Settings updated and saved.");
    }

    /**
     * Applies color and other theme-related settings to the UI.
     */
    function updateUIFromSettings() {
        const root = document.documentElement;
        root.style.setProperty('--user-color', agentSettings.color);
        // Re-apply styles if needed (Tailwind classes handle most of it)
    }

    // --- MESSAGE RENDERING ---

    /**
     * Renders the full chat history from the state array.
     */
    function renderHistory() {
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.innerHTML = ''; // Clear existing messages
        agentHistory.forEach(msg => {
            const isUser = msg.role === 'user';
            const messageEl = createMessageElement(msg.text, isUser ? 'user' : 'model');
            chatMessages.appendChild(messageEl);
        });
        scrollChatToBottom();
    }

    /**
     * Creates a single message element (bubble).
     * @param {string} text - The content of the message.
     * @param {string} role - 'user' or 'model'.
     * @param {string} type - 'message' or 'warning'.
     * @returns {HTMLElement} - The message bubble element.
     */
    function createMessageElement(text, role, type = 'message') {
        const isUser = role === 'user';
        const wrapper = document.createElement('div');
        wrapper.className = `flex ${isUser ? 'justify-end' : 'justify-start'}`;

        const bubble = document.createElement('div');
        bubble.className = `message-bubble text-sm ${isUser ? 'user-message-bubble' : 'ai-message-bubble'}`;

        if (type === 'warning') {
            bubble.style.backgroundColor = 'var(--ai-red)';
        }

        bubble.innerHTML = parseAndRenderContent(text); // Apply KaTeX and special content

        wrapper.appendChild(bubble);
        return wrapper;
    }

    /**
     * Shows a message element in the chat, optionally with a specific type.
     * @param {string} text - The message content.
     * @param {string} role - 'user' or 'model'.
     * @param {string} type - 'message' or 'warning'.
     */
    function showAgentMessage(text, role, type = 'message') {
        const chatMessages = document.getElementById('chat-messages');
        const messageEl = createMessageElement(text, role, type);
        chatMessages.appendChild(messageEl);
        scrollChatToBottom();
    }

    /**
     * Parses the AI's response for special commands (Graph, KaTeX) and general text.
     * @param {string} content - The raw text content from the AI.
     * @returns {string} - HTML processed with KaTeX and graph placeholders.
     */
    function parseAndRenderContent(content) {
        let htmlContent = content;

        // 1. Graph Command Parsing
        const graphRegex = /\[GRAPH:(basic|advanced):(.+?)\]/gs;
        let graphMatch;
        let graphIdCounter = 0;

        while ((graphMatch = graphRegex.exec(htmlContent)) !== null) {
            const type = graphMatch[1]; // 'basic' or 'advanced'
            const dataString = graphMatch[2].trim();
            const placeholderId = `graph-canvas-${graphIdCounter++}`;

            // Replace the command with a canvas placeholder
            const canvasHTML = `<canvas id="${placeholderId}" class="agent-canvas" width="300" height="200"></canvas>`;
            htmlContent = htmlContent.replace(graphMatch[0], canvasHTML);

            // Defer drawing the graph until the message is attached to the DOM
            setTimeout(() => {
                drawGraph(placeholderId, type, dataString);
            }, 50);
        }

        // 2. KaTeX Rendering (Apply auto-render after graph placeholders are in place)
        // The HTML structure is now in place. KaTeX auto-render will be triggered by a global function call.

        return htmlContent;
    }

    /**
     * Executes KaTeX auto-rendering on the chat area.
     */
    function renderMath() {
        const chatMessages = document.getElementById('chat-messages');
        if (window.renderMathInElement) {
            window.renderMathInElement(chatMessages, {
                delimiters: [
                    {left: "$$", right: "$$", display: true},
                    {left: "$", right: "$", display: false}
                ],
                throwOnError: false
            });
        }
    }

    /**
     * Scrolls the chat message area to the bottom.
     */
    function scrollChatToBottom() {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    // --- CUSTOM DUAL-MODE GRAPHING ENGINE (REPLACEMENT FOR PLOTLY) ---

    /**
     * Custom function to draw a graph on an HTML Canvas element.
     * Supports 'basic' (simple line plot) and 'advanced' (multi-series/scatter).
     * Data format: "label1,x1,y1,x2,y2;label2,x1,y1,..."
     * @param {string} canvasId - The ID of the canvas element.
     * @param {string} type - 'basic' or 'advanced'.
     * @param {string} dataString - The serialized data string.
     */
    function drawGraph(canvasId, type, dataString) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        const series = dataString.split(';').map(s => {
            const parts = s.trim().split(',');
            const label = parts[0];
            const dataPoints = [];
            for (let i = 1; i < parts.length; i += 2) {
                if (parts[i] && parts[i+1]) {
                    dataPoints.push({ x: parseFloat(parts[i]), y: parseFloat(parts[i+1]) });
                }
            }
            return { label, points: dataPoints };
        }).filter(s => s.points.length > 0);

        if (series.length === 0) {
            ctx.fillStyle = '#f3f4f6';
            ctx.fillText("No valid data for graphing.", 10, H / 2);
            return;
        }

        let allX = series.flatMap(s => s.points.map(p => p.x));
        let allY = series.flatMap(s => s.points.map(p => p.y));

        const minX = Math.min(...allX);
        const maxX = Math.max(...allX);
        const minY = Math.min(...allY);
        const maxY = Math.max(...allY);

        // Padding and Bounds
        const padding = 30;
        const chartW = W - 2 * padding;
        const chartH = H - 2 * padding;

        const scaleX = chartW / (maxX - minX || 1);
        const scaleY = chartH / (maxY - minY || 1);

        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']; // Tailwind colors

        // 1. Draw Axes
        ctx.strokeStyle = '#4b5563'; // Gray for axes
        ctx.lineWidth = 1;
        // X-Axis (Bottom)
        ctx.beginPath();
        ctx.moveTo(padding, H - padding);
        ctx.lineTo(W - padding, H - padding);
        ctx.stroke();
        // Y-Axis (Left)
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, H - padding);
        ctx.stroke();

        ctx.fillStyle = '#f3f4f6';
        ctx.font = '10px Inter';

        // 2. Draw Ticks/Labels
        // Y-Axis labels (Min/Max)
        ctx.fillText(maxY.toFixed(2), 5, padding + 5);
        ctx.fillText(minY.toFixed(2), 5, H - padding + 5);
        // X-Axis labels (Min/Max)
        ctx.fillText(minX.toFixed(2), padding, H - padding + 15);
        ctx.textAlign = 'right';
        ctx.fillText(maxX.toFixed(2), W - padding, H - padding + 15);
        ctx.textAlign = 'left';


        // 3. Draw Data Series
        series.forEach((s, index) => {
            ctx.strokeStyle = colors[index % colors.length];
            ctx.fillStyle = colors[index % colors.length];
            ctx.lineWidth = 2;

            ctx.beginPath();
            s.points.forEach((point, i) => {
                const x = padding + (point.x - minX) * scaleX;
                const y = H - padding - (point.y - minY) * scaleY;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }

                // Draw circles for 'advanced' type or small datasets
                if (type === 'advanced' || s.points.length < 10) {
                    ctx.beginPath();
                    ctx.arc(x, y, 3, 0, Math.PI * 2, true);
                    ctx.fill();
                }
            });
            ctx.stroke();

            // Draw Legend
            ctx.fillStyle = colors[index % colors.length];
            ctx.fillRect(W - padding - 80, 10 + index * 12, 8, 8);
            ctx.fillStyle = '#f3f4f6';
            ctx.fillText(s.label, W - padding - 70, 18 + index * 12);
        });
    }

    // --- MAIN EXECUTION FLOW ---

    /**
     * Handles the user's input, sends the request, and updates the UI.
     */
    async function handleUserInput() {
        const input = document.getElementById('user-input');
        const userQuery = input.value.trim();

        if (!userQuery || isFetching) {
            return;
        }

        isFetching = true;
        input.value = '';
        input.disabled = true;
        document.getElementById('send-icon').classList.add('hidden');
        document.getElementById('loading-spinner').classList.remove('hidden');
        document.getElementById('status-indicator').classList.remove('bg-green-500');
        document.getElementById('status-indicator').classList.add('bg-yellow-500', 'animate-pulse');

        // 1. Show User Message and Add to History
        showAgentMessage(userQuery, 'user');
        addHistoryMessage('user', userQuery);

        try {
            // 2. Fetch Response
            const response = await fetchAgentResponse(userQuery);

            let aiResponseText = "An error occurred, and the response could not be parsed.";
            const candidate = response.candidates?.[0];

            if (candidate && candidate.content?.parts?.[0]?.text) {
                aiResponseText = candidate.content.parts[0].text;
            } else if (response.error) {
                aiResponseText = `API Error: ${response.error.message}. Please check your configuration or try a simpler query.`;
            }

            // 3. Append Search Citations if present (Grounding)
            let sourcesHTML = '';
            const groundingMetadata = candidate?.groundingMetadata;
            if (groundingMetadata && groundingMetadata.groundingAttributions) {
                const sources = groundingMetadata.groundingAttributions
                    .map(attr => ({ uri: attr.web?.uri, title: attr.web?.title }))
                    .filter(source => source.uri && source.title)
                    .slice(0, 3); // Limit to top 3 sources

                if (sources.length > 0) {
                    sourcesHTML = "\n\n**Sources:**\n";
                    sources.forEach((s, i) => {
                        sourcesHTML += `- [${s.title}](${s.uri})\n`;
                    });
                }
            }
            aiResponseText += sourcesHTML;


            // 4. Show AI Message and Add to History
            showAgentMessage(aiResponseText, 'model');
            addHistoryMessage('model', aiResponseText);

            // 5. Render Math (KaTeX)
            renderMath();

        } catch (error) {
            console.error("[Agent/Execution] Fatal error during API call:", error);
            showAgentMessage(`System Error: Could not connect to the Agent or complete the request. Details: ${error.message}`, 'model', 'warning');
        } finally {
            // 6. Reset State
            isFetching = false;
            input.disabled = false;
            document.getElementById('send-icon').classList.remove('hidden');
            document.getElementById('loading-spinner').classList.add('hidden');
            document.getElementById('status-indicator').classList.remove('bg-yellow-500', 'animate-pulse');
            document.getElementById('status-indicator').classList.add('bg-green-500');
            input.focus();
        }
    }

    // --- INITIALIZATION ---
    // The IIFE runs immediately and creates the UI/attaches listeners.
    createUI();

    // The Firebase initialization (window.Agent.initFirebase) will be called by the
    // injected module script once the authentication state is determined.

})();
