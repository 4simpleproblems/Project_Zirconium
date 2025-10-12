/**
 * navigation.js
 * * This is a fully self-contained script to create a dynamic, authentication-aware
 * navigation bar for your website. It handles everything from Firebase initialization
 * to rendering user-specific information, and now includes an exclusive AI Chatbot feature
 * for the official site administrator (4simpleproblems@gmail.com).
 *
 * --- INSTRUCTIONS ---
 * 1. ACTION REQUIRED: Paste your own Firebase project configuration into the `FIREBASE_CONFIG` object below.
 * 2. Place this script in the root directory of your website.
 * 3. Add `<script src="/navigation.js" defer></script>` to the <head> of any HTML file where you want the navbar.
 * 4. Ensure your file paths for images and links are root-relative (e.g., "/images/logo.png", "/login.html").
 *
 * --- NEW FEATURES ---
 * - **Exclusive AI Chat:** A floating button appears for the official admin email (4simpleproblems@gmail.com).
 * - **AI Agents:** Chat uses 7 specialized agents (General, Math, Science, etc.) with tailored Gemini API settings.
 * - **Firestore Persistence:** Conversation history is saved per-agent in Firestore.
 * - **UI Polish:** Scroll-glide buttons are always subtly visible when needed for better user experience.
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

// --- AI Chat Configuration ---
const ADMIN_EMAIL = '4simpleproblems@gmail.com';
const GEMINI_API_KEY = ""; // Placeholder for Canvas environment. Leave as-is.
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent";

const AI_AGENTS = {
    General: {
        systemPrompt: "You are 4SP AI Mode, a highly helpful, friendly, and creative general-purpose assistant. Keep your answers concise and engaging.",
        temperature: 0.8,
        icon: 'fa-robot'
    },
    Math: {
        systemPrompt: "You are 4SP AI Mode, a specialized Math tutor. Provide clear, step-by-step explanations and focus on the conceptual understanding of mathematical problems. Use LaTeX for equations.",
        temperature: 0.3,
        icon: 'fa-calculator'
    },
    Science: {
        systemPrompt: "You are 4SP AI Mode, a knowledgeable Science expert. Explain complex scientific concepts clearly, focusing on biology, chemistry, and physics. Provide real-world examples.",
        temperature: 0.4,
        icon: 'fa-flask'
    },
    'Language Arts': {
        systemPrompt: "You are 4SP AI Mode, a sophisticated Language Arts coach. Focus on grammar, writing style, literary analysis, and vocabulary. Use encouraging and constructive feedback.",
        temperature: 0.7,
        icon: 'fa-book-open'
    },
    History: {
        systemPrompt: "You are 4SP AI Mode, an expert Historian. Provide context-rich, chronological, and balanced summaries of historical events and figures. Use accurate dates and terminology.",
        temperature: 0.2,
        icon: 'fa-landmark'
    },
    STEM: {
        systemPrompt: "You are 4SP AI Mode, a forward-thinking STEM mentor. Your focus is on integrating Science, Technology, Engineering, and Math. Encourage inquiry-based learning and problem-solving.",
        temperature: 0.5,
        icon: 'fa-atom'
    },
    Coding: {
        systemPrompt: "You are 4SP AI Mode, a precise and knowledgeable Coding Assistant. Provide working code snippets in the requested language, explain the logic clearly, and follow best practices. Use markdown code blocks for all code.",
        temperature: 0.1,
        icon: 'fa-code'
    }
};

// Variables to hold Firebase objects, which must be globally accessible after loading scripts
let auth;
let db;
let currentUserId = 'guest';
let currentAgent = 'General';
let conversationHistory = {}; // Stores history loaded from Firestore for all agents

// --- Self-invoking function to encapsulate all logic ---
(function() {
    // Stop execution if Firebase config is not provided
    if (!FIREBASE_CONFIG || !FIREBASE_CONFIG.apiKey) {
        console.error("Firebase configuration is missing! Please paste your config into navigation.js.");
        return;
    }

    // --- UTILITY FUNCTIONS ---

    // Helper to load external JS files
    const loadScript = (src) => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.type = 'module';
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

    // Bulletproof Fix for Font Awesome 7.x icon loading
    const getIconClass = (iconName) => {
        if (!iconName) return '';
        const nameParts = iconName.trim().split(/\s+/).filter(p => p.length > 0);
        let stylePrefix = 'fa-solid';
        let baseName = '';
        const stylePrefixes = ['fa-solid', 'fa-regular', 'fa-light', 'fa-thin', 'fa-brands'];
        const existingPrefix = nameParts.find(p => stylePrefixes.includes(p));
        if (existingPrefix) stylePrefix = existingPrefix;
        const nameCandidate = nameParts.find(p => p.startsWith('fa-') && !stylePrefixes.includes(p));
        if (nameCandidate) {
            baseName = nameCandidate;
        } else {
            baseName = nameParts.find(p => !stylePrefixes.includes(p));
            if (baseName && !baseName.startsWith('fa-')) {
                 baseName = `fa-${baseName}`;
            }
        }
        if (baseName) return `${stylePrefix} ${baseName}`;
        return '';
    };

    // Robustly determine active tab (GitHub Pages fix)
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
        if (currentCanonical === tabCanonical) return true;
        const tabPathSuffix = tabPathname.startsWith('/') ? tabPathname.substring(1) : tabPathname;
        if (currentPathname.endsWith(tabPathSuffix)) return true;
        return false;
    };

    // Update visibility of scroll glide buttons
    const updateScrollGilders = () => {
        const container = document.querySelector('.tab-scroll-container');
        const leftButton = document.getElementById('glide-left');
        const rightButton = document.getElementById('glide-right');
        if (!container || !leftButton || !rightButton) return;
        const isScrolledToLeft = container.scrollLeft < 5; 
        const isScrolledToRight = container.scrollLeft + container.offsetWidth >= container.scrollWidth - 5; 
        const hasHorizontalOverflow = container.scrollWidth > container.offsetWidth;

        if (hasHorizontalOverflow) {
            leftButton.style.display = 'flex';
            rightButton.style.display = 'flex';
            leftButton.classList.toggle('hidden', isScrolledToLeft);
            rightButton.classList.toggle('hidden', isScrolledToRight);
        } else {
            leftButton.style.display = 'none';
            rightButton.style.display = 'none';
        }
    };
    
    // --- FIRESTORE LOGIC ---

    const getFirestorePath = () => {
        // Use a placeholder appId and the current user's ID
        const appId = 'default-app-id';
        const userId = currentUserId || 'anonymous-user'; 
        return {
            docRef: firebase.firestore().doc(db, `/artifacts/${appId}/users/${userId}/ai_chat_history/conversation`),
            userId: userId
        };
    };

    const loadHistory = async () => {
        if (!db) return;
        try {
            const { docRef } = getFirestorePath();
            const docSnapshot = await docRef.get();
            if (docSnapshot.exists) {
                conversationHistory = docSnapshot.data();
            } else {
                conversationHistory = {};
            }
        } catch (error) {
            console.error("Error loading chat history:", error);
            // Default to empty history
            conversationHistory = {};
        }
        renderChatHistory();
    };

    const saveHistory = async (history) => {
        if (!db) return;
        try {
            const { docRef } = getFirestorePath();
            // Update only the current agent's history field
            await docRef.set({ [currentAgent]: history }, { merge: true });
        } catch (error) {
            console.error("Error saving chat history:", error);
        }
    };


    // --- AI CHAT LOGIC ---

    const renderChatHistory = () => {
        const historyContainer = document.getElementById('chat-history');
        if (!historyContainer) return;

        // Get history for the current agent, defaulting to an empty array
        const history = conversationHistory[currentAgent] || [];
        
        historyContainer.innerHTML = history.map(message => {
            // Apply markdown for code and use LaTeX for math/science agents
            const isModel = message.role === 'model';
            let content = message.text || '';
            
            // Basic Markdown to HTML conversion for code blocks
            content = content.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
                return `<pre class="chat-code-block"><code>${code.trim()}</code></pre>`;
            });

            // Convert to a simple paragraph structure
            content = `<p class="whitespace-pre-wrap">${content}</p>`;

            return `
                <div class="chat-message ${isModel ? 'model' : 'user'}">
                    <div class="chat-bubble">
                        <span class="chat-sender">${isModel ? '4SP AI Mode' : 'You'}</span>
                        ${content}
                    </div>
                </div>
            `;
        }).join('');

        // Scroll to the bottom
        historyContainer.scrollTop = historyContainer.scrollHeight;
    };

    const sendMessage = async (userMessage) => {
        const inputField = document.getElementById('chat-input');
        const sendButton = document.getElementById('chat-send-button');
        const historyContainer = document.getElementById('chat-history');

        if (!userMessage.trim()) return;

        // Disable input and button
        inputField.disabled = true;
        sendButton.disabled = true;
        inputField.value = '';

        // Update local history with user message
        let history = conversationHistory[currentAgent] || [];
        history.push({ role: 'user', text: userMessage });
        conversationHistory[currentAgent] = history;

        // Add a temporary loading message for the model response
        const loadingHtml = `
            <div class="chat-message model loading" id="loading-message">
                <div class="chat-bubble">
                    <span class="chat-sender">4SP AI Mode</span>
                    <p class="animate-pulse">Thinking...</p>
                </div>
            </div>
        `;
        historyContainer.innerHTML += `
            <div class="chat-message user">
                <div class="chat-bubble">
                    <span class="chat-sender">You</span>
                    <p class="whitespace-pre-wrap">${userMessage}</p>
                </div>
            </div>
            ${loadingHtml}
        `;
        historyContainer.scrollTop = historyContainer.scrollHeight;


        // Prepare payload for Gemini API
        const agentConfig = AI_AGENTS[currentAgent];
        const chatContents = history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        }));
        
        const payload = {
            contents: chatContents,
            generationConfig: {
                temperature: agentConfig.temperature || 0.7,
            },
            systemInstruction: {
                parts: [{ text: agentConfig.systemPrompt }]
            },
        };

        const maxRetries = 3;
        let responseText = "Sorry, I couldn't get a response from the AI. Please try again later.";
        
        for (let i = 0; i < maxRetries; i++) {
            try {
                const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const result = await response.json();
                const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

                if (text) {
                    responseText = text;
                    break; // Success! Exit retry loop.
                } else {
                    throw new Error("Invalid response structure from API.");
                }

            } catch (error) {
                console.error(`Attempt ${i + 1} failed:`, error);
                if (i < maxRetries - 1) {
                    const delay = Math.pow(2, i) * 1000; // Exponential backoff: 1s, 2s, 4s
                    await new Promise(res => setTimeout(res, delay));
                }
            }
        }
        
        // Remove loading message
        const loadingMessage = document.getElementById('loading-message');
        if (loadingMessage) loadingMessage.remove();

        // Add model response to history
        history.push({ role: 'model', text: responseText });
        conversationHistory[currentAgent] = history;
        
        // Save history to Firestore
        await saveHistory(history);
        
        // Re-render history and re-enable inputs
        renderChatHistory();
        inputField.disabled = false;
        sendButton.disabled = false;
        inputField.focus();
    };

    const setupChatLogic = () => {
        const modal = document.getElementById('chat-modal');
        if (!modal) return;

        const closeButton = document.getElementById('chat-close-button');
        closeButton.onclick = closeChatModal;

        const agentSelector = document.getElementById('agent-selector');
        const sendButton = document.getElementById('chat-send-button');
        const inputField = document.getElementById('chat-input');

        // Populate agent selector
        Object.keys(AI_AGENTS).forEach(agentName => {
            const agentConfig = AI_AGENTS[agentName];
            const option = document.createElement('option');
            option.value = agentName;
            option.textContent = `(${agentName}) - 4SP AI Mode`;
            option.setAttribute('data-icon', agentConfig.icon);
            agentSelector.appendChild(option);
        });

        // Set initial agent
        agentSelector.value = currentAgent;
        document.getElementById('agent-title').textContent = `${currentAgent} Agent`;
        
        // Agent change handler
        agentSelector.addEventListener('change', (e) => {
            currentAgent = e.target.value;
            document.getElementById('agent-title').textContent = `${currentAgent} Agent`;
            document.getElementById('chat-history').innerHTML = ''; // Clear display
            loadHistory(); // Load and display new agent's history
        });

        // Send message handler
        const handleSend = () => {
            const message = inputField.value;
            if (message.trim()) {
                sendMessage(message);
            }
        };

        sendButton.addEventListener('click', handleSend);
        inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });

        // Initial load of history
        loadHistory();
    };

    const openChatModal = () => {
        const modal = document.getElementById('chat-modal');
        if (modal) {
            modal.classList.add('open');
            // Ensure logic is set up and history is loaded when opening
            setupChatLogic();
        }
    };

    const closeChatModal = () => {
        const modal = document.getElementById('chat-modal');
        if (modal) {
            modal.classList.remove('open');
        }
    };


    // --- 2. INITIALIZE FIREBASE AND RENDER NAVBAR ---
    const initializeApp = (pages) => {
        // Initialize Firebase with the compat libraries
        const app = firebase.initializeApp(FIREBASE_CONFIG);
        // Assign auth and db to module-scope variables
        auth = firebase.auth();
        db = firebase.firestore();

        // --- 3. INJECT CSS STYLES (UPDATED for AI Chat) ---
        const injectStyles = () => {
            const style = document.createElement('style');
            style.textContent = `
                /* Base Styles */
                body { padding-top: 4rem; /* 64px, equal to navbar height */ }
                .auth-navbar { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; background: #000000; border-bottom: 1px solid rgb(31 41 55); height: 4rem; }
                .auth-navbar nav { max-width: 80rem; margin: auto; padding: 0 1rem; height: 100%; display: flex; align-items: center; justify-content: space-between; gap: 1rem; position: relative; }
                .initial-avatar { background: linear-gradient(135deg, #374151 0%, #111827 100%); font-family: sans-serif; text-transform: uppercase; display: flex; align-items: center; justify-content: center; color: white; }
                
                /* Auth Dropdown Menu Styles */
                .auth-menu-container { 
                    position: absolute; right: 0; top: 50px; width: 16rem; 
                    background: #000000; 
                    border: 1px solid rgb(55 65 81); border-radius: 0.75rem; padding: 0.5rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -2px rgba(0,0,0,0.2); 
                    transition: transform 0.2s ease-out, opacity 0.2s ease-out; transform-origin: top right; 
                }
                .auth-menu-container.open { opacity: 1; transform: translateY(0) scale(1); }
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

                /* Horizontal Scrollable Tabs Styles */
                .tab-scroll-container {
                    flex-grow: 1; 
                    display: flex;
                    align-items: center;
                    overflow-x: auto; 
                    -webkit-overflow-scrolling: touch; 
                    padding-bottom: 5px; 
                    margin-bottom: -5px; 
                    scroll-behavior: smooth; 
                    /* Custom scrollbar to always show track/thumb (where supported) */
                    scrollbar-color: #4f46e5 #1f2937; /* thumb and track for Firefox */
                    scrollbar-width: thin; /* thin scrollbar for Firefox */
                }
                /* Custom Webkit Scrollbar (Chrome, Safari) */
                .tab-scroll-container::-webkit-scrollbar {
                    height: 8px;
                    background-color: #1f2937; /* Track color */
                }
                .tab-scroll-container::-webkit-scrollbar-thumb {
                    background-color: #4f46e5; /* Thumb color */
                    border-radius: 4px;
                }
                .tab-scroll-container::-webkit-scrollbar-thumb:hover {
                    background-color: #6366f1;
                }

                /* Scroll Glide Buttons */
                .scroll-glide-button {
                    position: absolute;
                    top: 0;
                    height: 100%;
                    width: 2rem; 
                    display: flex; /* Initially hidden/shown by JS */
                    align-items: center;
                    justify-content: center;
                    background: #000000;
                    color: white;
                    font-size: 1.2rem;
                    cursor: pointer;
                    opacity: 0.8; /* Always visible slightly when not hidden */
                    transition: opacity 0.3s, background 0.3s;
                    z-index: 10;
                    pointer-events: auto;
                }
                .scroll-glide-button.hidden {
                    opacity: 0 !important;
                    pointer-events: none !important;
                }
                #glide-left { left: 0; background: linear-gradient(to right, #000000 50%, transparent); border-top-right-radius: 0.5rem; border-bottom-right-radius: 0.5rem; }
                #glide-right { right: 0; background: linear-gradient(to left, #000000 50%, transparent); border-top-left-radius: 0.5rem; border-bottom-left-radius: 0.5rem; }
                
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
                .nav-tab.active { color: #4f46e5; border-color: #4f46e5; background-color: rgba(79, 70, 229, 0.1); }
                .nav-tab.active:hover { color: #6366f1; border-color: #6366f1; background-color: rgba(79, 70, 229, 0.15); }

                /* --- AI Chat Modal Styles --- */
                .chat-overlay {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background-color: rgba(0, 0, 0, 0.9); /* Dark, fading background */
                    z-index: 2000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    pointer-events: none;
                    transition: opacity 0.3s ease-in-out;
                }
                .chat-overlay.open {
                    opacity: 1;
                    pointer-events: auto;
                }

                .chat-modal {
                    background: #111827; /* Dark background for modal */
                    border-radius: 1.5rem;
                    width: 90%;
                    max-width: 700px;
                    height: 90%;
                    max-height: 800px;
                    display: flex;
                    flex-direction: column;
                    border: 1px solid #374151;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.1);
                    transform: scale(0.95);
                    transition: transform 0.3s ease-in-out;
                }
                .chat-overlay.open .chat-modal {
                    transform: scale(1);
                }

                .chat-header {
                    padding: 1rem;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    border-bottom: 1px solid #374151;
                    color: white;
                }

                .chat-history {
                    flex-grow: 1;
                    overflow-y: auto;
                    padding: 1rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                .chat-history::-webkit-scrollbar { width: 8px; }
                .chat-history::-webkit-scrollbar-thumb { background-color: #4f46e5; border-radius: 4px; }

                .chat-message {
                    display: flex;
                    max-width: 80%;
                }
                .chat-message.user {
                    align-self: flex-end;
                    justify-content: flex-end;
                }
                .chat-message.model {
                    align-self: flex-start;
                    justify-content: flex-start;
                }

                .chat-bubble {
                    padding: 0.75rem 1rem;
                    border-radius: 1rem;
                    font-size: 0.9rem;
                    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
                }
                .chat-sender {
                    font-size: 0.75rem;
                    font-weight: 600;
                    opacity: 0.8;
                    display: block;
                    margin-bottom: 0.25rem;
                }
                .chat-message.user .chat-bubble {
                    background-color: #4f46e5; /* Indigo */
                    color: white;
                    border-bottom-right-radius: 0.25rem;
                }
                .chat-message.model .chat-bubble {
                    background-color: #374151; /* Gray-700 */
                    color: #d1d5db;
                    border-bottom-left-radius: 0.25rem;
                }
                .chat-code-block {
                    background: #1f2937;
                    padding: 0.5rem;
                    border-radius: 0.5rem;
                    margin-top: 0.5rem;
                    font-size: 0.8rem;
                    overflow-x: auto;
                    color: #e5e7eb;
                }
                .chat-input-area {
                    padding: 1rem;
                    border-top: 1px solid #374151;
                    display: flex;
                    gap: 0.5rem;
                }
                .chat-input-area textarea {
                    flex-grow: 1;
                    min-height: 2.5rem;
                    max-height: 6rem;
                    padding: 0.5rem;
                    border-radius: 0.5rem;
                    border: 1px solid #4f46e5;
                    background-color: #1f2937;
                    color: white;
                    resize: none;
                    transition: border-color 0.2s;
                    line-height: 1.5;
                }
                .chat-input-area textarea:focus {
                    border-color: #6366f1;
                    outline: none;
                }
                .chat-input-area button {
                    padding: 0.5rem 1rem;
                    border-radius: 0.5rem;
                    background-color: #4f46e5;
                    color: white;
                    transition: background-color 0.2s;
                }
                .chat-input-area button:hover:not(:disabled) {
                    background-color: #6366f1;
                }
                .chat-input-area button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                
            `;
            document.head.appendChild(style);
        };

        const renderChatModal = () => {
            const modalHtml = `
                <div id="chat-modal" class="chat-overlay">
                    <div class="chat-modal">
                        <div class="chat-header">
                            <div class="flex items-center space-x-3">
                                <i class="fa-solid fa-wand-magic-sparkles text-xl text-indigo-400"></i>
                                <h2 class="text-xl font-bold">4SP AI Mode</h2>
                            </div>
                            <div class="flex items-center space-x-3">
                                <span id="agent-title" class="text-sm font-medium text-indigo-400 mr-2">General Agent</span>
                                <select id="agent-selector" class="bg-gray-800 text-sm text-white border border-gray-600 rounded-lg p-1">
                                    <!-- Options populated by JS -->
                                </select>
                                <button id="chat-close-button" class="w-8 h-8 rounded-full text-white hover:bg-gray-800 transition">
                                    <i class="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                        </div>
                        <div id="chat-history" class="chat-history">
                            <!-- Chat messages will go here -->
                            <div class="chat-message model">
                                <div class="chat-bubble">
                                    <span class="chat-sender">4SP AI Mode</span>
                                    <p>Hello! I am your exclusive AI Assistant. Please select an Agent to begin our specialized conversation. How can I help you today?</p>
                                </div>
                            </div>
                        </div>
                        <div class="chat-input-area">
                            <textarea id="chat-input" placeholder="Message the AI agent... (Shift+Enter for new line)" rows="1"></textarea>
                            <button id="chat-send-button" title="Send Message">
                                <i class="fa-solid fa-paper-plane"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            // Append modal to body once
            if (!document.getElementById('chat-modal')) {
                document.body.insertAdjacentHTML('beforeend', modalHtml);
            }
        };


        // --- 4. RENDER THE NAVBAR HTML ---
        const renderNavbar = (user, userData, pages) => {
            const container = document.getElementById('navbar-container');
            if (!container) return;

            const logoPath = "/images/logo.png";
            const isOfficialAdmin = user && user.email === ADMIN_EMAIL;
            
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

            // --- Auth Views ---
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

                        <!-- AI Chat Button (Exclusive) -->
                        ${isOfficialAdmin ? `
                            <button id="ai-chat-button" title="4SP AI Mode Chat" class="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 text-white hover:bg-indigo-500 transition duration-150 shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 mr-2">
                                <i class="fa-solid fa-wand-magic-sparkles"></i>
                            </button>
                        ` : ''}

                        ${user ? loggedInView(user, userData) : loggedOutView}
                    </nav>
                </header>
            `;

            // Render AI Modal if admin is present
            if (isOfficialAdmin) {
                renderChatModal();
            }

            // --- 5. SETUP EVENT LISTENERS (Including auto-scroll and glide buttons) ---
            setupEventListeners(user, isOfficialAdmin);

            // Auto-scroll to the active tab if one is found
            const activeTab = document.querySelector('.nav-tab.active');
            const tabContainer = document.querySelector('.tab-scroll-container');
            if (activeTab && tabContainer) {
                tabContainer.scrollLeft = activeTab.offsetLeft - (tabContainer.offsetWidth / 2) + (activeTab.offsetWidth / 2);
            }
            
            // INITIAL CHECK: After rendering and auto-scrolling, update glide button visibility
            updateScrollGilders();
        };

        const setupEventListeners = (user, isOfficialAdmin) => {
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
            
            // AI Chat Button Listener (Exclusive)
            if (isOfficialAdmin) {
                const aiButton = document.getElementById('ai-chat-button');
                if (aiButton) {
                    aiButton.addEventListener('click', openChatModal);
                    // Setup chat logic only for the admin
                    setupChatLogic(); 
                }
            }
        };

        // --- 6. AUTH STATE LISTENER ---
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                currentUserId = user.uid; // Set global user ID
                // User is signed in. Fetch their data from Firestore.
                try {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    const userData = userDoc.exists ? userDoc.data() : null;
                    renderNavbar(user, userData, pages);
                } catch (error) {
                    console.error("Error fetching user data:", error);
                    renderNavbar(user, null, pages);
                }
            } else {
                currentUserId = 'guest'; // Set global ID for anonymous
                // User is signed out.
                renderNavbar(null, null, pages);
                // Attempt to sign in anonymously
                auth.signInAnonymously().catch((error) => {
                    if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/admin-restricted-operation') {
                        console.warn("Anonymous sign-in is disabled. Enable it in the Firebase Console.");
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

    // --- START THE PROCESS ---
    document.addEventListener('DOMContentLoaded', run);

})();
