/**
 * navigation.js - 4SP Website Navigation & Exclusive AI Chat Mode (v5)
 *
 * * This script provides a dynamic, responsive navigation bar, handles Firebase authentication
 * (using the standard SDKs for compatibility), and introduces the exclusive 4SP AI Mode chat
 * feature for the site administrator (4simpleproblems@gmail.com).
 *
 * --- V5 FEATURES ---
 * - **Geist Font & Dark Aesthetic:** Uses a custom, dark, high-contrast style inspired by mode-activation.js.
 * - **AI Agents:** 7 specialized agents (General, Math, Science, etc.) with unique system instructions.
 * - **Firestore Persistence:** Securely saves conversation history per-agent to Firestore.
 * - **Input Control:** Implements a 500-character input limit with a real-time counter.
 * - **Code Utility:** Adds a one-click "Copy Code" button to all AI-generated code blocks.
 * - **UI Polish:** Scroll-glide buttons are always subtly visible when needed.
 *
 * --- FIX: DEPENDENCY LOADING ---
 * - Switched from deprecated 'compat' Firebase versions to standard modular links for better reliability.
 * - Added comprehensive try/catch around initialization to prevent page block on script failure.
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

// --- Configuration ---
const PAGE_CONFIG_URL = '../page-identification.json';
const ADMIN_EMAIL = '4simpleproblems@gmail.com';
const GEMINI_API_KEY = ""; // Canvas Environment Placeholder
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent";
const MAX_INPUT_CHARS = 500;

const AI_AGENTS = {
    General: {
        systemPrompt: "You are the 'General' Agent in 4SP AI Mode v5. Your purpose is to be a highly versatile, creative, and engaging assistant. Keep your answers detailed yet concise, using the Geist style (modern, high-contrast, professional).",
        temperature: 0.8,
        icon: 'fa-robot'
    },
    Math: {
        systemPrompt: "You are the 'Math' Agent in 4SP AI Mode v5. You are a specialized tutor. Provide clear, elegant, step-by-step explanations and focus on the conceptual understanding of mathematical problems. **Always use LaTeX formatting (using $ and $$ delimiters) for all equations and symbols.**",
        temperature: 0.3,
        icon: 'fa-calculator'
    },
    Science: {
        systemPrompt: "You are the 'Science' Agent in 4SP AI Mode v5. You are an expert across biology, chemistry, and physics. Explain complex concepts clearly, using precise scientific notation and terminology (use LaTeX for formulas like $H_{2}O$). Provide context-rich, modern examples.",
        temperature: 0.4,
        icon: 'fa-flask'
    },
    'Language Arts': {
        systemPrompt: "You are the 'Language Arts' Agent in 4SP AI Mode v5. You are a sophisticated writing coach. Focus on grammar, stylistic elegance, literary analysis, and vocabulary enrichment. Provide constructive, high-level feedback on writing.",
        temperature: 0.7,
        icon: 'fa-book-open'
    },
    History: {
        systemPrompt: "You are the 'History' Agent in 4SP AI Mode v5. You are an expert historian. Provide balanced, context-rich, chronological, and fact-checked summaries of historical events and figures. Maintain neutrality and intellectual rigor.",
        temperature: 0.2,
        icon: 'fa-landmark'
    },
    STEM: {
        systemPrompt: "You are the 'STEM' Agent in 4SP AI Mode v5. You are a forward-thinking interdisciplinary mentor. Your focus is on integrating Science, Technology, Engineering, and Math into unified concepts. Encourage inquiry and high-level problem-solving.",
        temperature: 0.5,
        icon: 'fa-atom'
    },
    Coding: {
        systemPrompt: "You are the 'Coding' Agent in 4SP AI Mode v5. You are a precise and knowledgeable programmer. Always provide working code snippets in the requested language. Use markdown code blocks (` ```language `) for all code and explain the logic clearly, following modern best practices.",
        temperature: 0.1,
        icon: 'fa-code'
    }
};

// Global variables for Firebase objects
let app; // New global for the Firebase app instance
let auth;
let db;
let currentUserId = 'guest';
let currentAgent = 'General';
let conversationHistory = {}; // Stores history loaded from Firestore for all agents

// --- Core Logic Encapsulation ---
(function() {
    if (!FIREBASE_CONFIG || !FIREBASE_CONFIG.apiKey) {
        console.error("Firebase configuration is missing! Please paste your config into navigation.js.");
        return;
    }

    // --- UTILITY FUNCTIONS ---
    const loadScript = (src) => new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        // IMPORTANT: For modular Firebase, we need type="module" for the imports to work
        script.type = 'module'; 
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });

    const loadCSS = (href) => new Promise((resolve) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.onload = resolve;
        document.head.appendChild(link);
    });

    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    };

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
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const userId = currentUserId || 'anonymous-user';
        // Need to use the firebase global functions now that we are importing modular
        const docRef = window.firebase.firestore().doc(db, `/artifacts/${appId}/users/${userId}/ai_chat_history/conversation`);
        
        return {
            docRef: docRef,
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
            conversationHistory = {};
        }
        renderChatHistory();
    };

    const saveHistory = async (history) => {
        if (!db) return;
        try {
            const { docRef } = getFirestorePath();
            await docRef.set({ [currentAgent]: history }, { merge: true });
        } catch (error) {
            console.error("Error saving chat history:", error);
        }
    };

    // --- AI CHAT LOGIC ---
    const copyToClipboard = (text, element) => {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            element.innerHTML = `<i class="fa-solid fa-check mr-1"></i>Copied`;
            setTimeout(() => {
                element.innerHTML = `<i class="fa-solid fa-copy mr-1"></i>Copy Code`;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
            // Fallback for environments where execCommand is restricted
        }
        document.body.removeChild(textArea);
    };

    const renderChatHistory = () => {
        const historyContainer = document.getElementById('chat-history');
        if (!historyContainer) return;

        const history = conversationHistory[currentAgent] || [];
        historyContainer.innerHTML = history.map(message => {
            const isModel = message.role === 'model';
            let content = message.text || '';

            // 1. Process Code Blocks and inject Copy Button
            content = content.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
                // Ensure lang is not null and is properly displayed
                const language = lang ? `<span class="code-lang">${lang.trim().toUpperCase()}</span>` : '';
                
                // Trim the code content
                const trimmedCode = code.trim();

                return `
                    <div class="code-block-wrapper">
                        <div class="code-header">
                            ${language}
                            <button class="copy-button" data-code="${encodeURIComponent(trimmedCode)}">
                                <i class="fa-solid fa-copy mr-1"></i>Copy Code
                            </button>
                        </div>
                        <pre><code>${trimmedCode}</code></pre>
                    </div>
                `;
            });
            
            // 2. Wrap remaining text in paragraph elements
            content = content.split('\n\n').map(p => {
                if (p.startsWith('<div class="code-block-wrapper')) {
                    // Don't wrap code blocks in <p>
                    return p;
                }
                // Handle LaTeX formulas enclosed in $$...$$ for display purposes
                p = p.replace(/\$\$(.*?)\$\$/g, (match, formula) => {
                    // This is a simple wrapper; actual rendering requires MathJax/Katex on the page
                    return `<span class="latex-formula block text-center my-2 text-lg font-mono">${match}</span>`;
                });

                return `<p class="whitespace-pre-wrap">${p}</p>`;
            }).join('');


            return `
                <div class="chat-message ${isModel ? 'model' : 'user'}">
                    <div class="chat-bubble">
                        <span class="chat-sender">${isModel ? '4SP AI Mode' : 'You'}</span>
                        ${content}
                    </div>
                </div>
            `;
        }).join('');

        // Attach copy event listeners
        historyContainer.querySelectorAll('.copy-button').forEach(button => {
            const code = decodeURIComponent(button.getAttribute('data-code'));
            button.onclick = () => copyToClipboard(code, button);
        });

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
        document.getElementById('char-count').textContent = `0/${MAX_INPUT_CHARS}`;


        // Update local history with user message
        let history = conversationHistory[currentAgent] || [];
        history.push({ role: 'user', text: userMessage });
        conversationHistory[currentAgent] = history;

        // Add user message to display
        const userHtml = `
            <div class="chat-message user">
                <div class="chat-bubble">
                    <span class="chat-sender">You</span>
                    <p class="whitespace-pre-wrap">${userMessage}</p>
                </div>
            </div>
        `;
        // Add a temporary loading message for the model response
        const loadingHtml = `
            <div class="chat-message model loading" id="loading-message">
                <div class="chat-bubble loading-bubble">
                    <span class="chat-sender">4SP AI Mode</span>
                    <div class="dot-flashing"></div>
                </div>
            </div>
        `;
        historyContainer.innerHTML += userHtml;
        historyContainer.innerHTML += loadingHtml;
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
                temperature: agentConfig.temperature,
            },
            systemInstruction: {
                parts: [{ text: agentConfig.systemPrompt }]
            },
        };

        const maxRetries = 3;
        let responseText = "Sorry, I couldn't get a response from the AI. Please try again later. (Error: API request failed)";

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
                console.error(`Attempt ${i + 1} failed. Retrying...`, error);
                if (i < maxRetries - 1) {
                    const delay = Math.pow(2, i) * 1000; // Exponential backoff
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
        const agentTitle = document.getElementById('agent-title');

        // Populate agent selector
        if(agentSelector.options.length === 0) {
            Object.keys(AI_AGENTS).forEach(agentName => {
                const option = document.createElement('option');
                option.value = agentName;
                option.textContent = `[${agentName}] - 4SP AI Mode v5`;
                agentSelector.appendChild(option);
            });
        }

        // Set initial agent
        agentSelector.value = currentAgent;
        agentTitle.textContent = `${currentAgent} Agent`;

        // Agent change handler
        agentSelector.addEventListener('change', (e) => {
            currentAgent = e.target.value;
            agentTitle.textContent = `${currentAgent} Agent`;
            document.getElementById('chat-history').innerHTML = ''; // Clear display
            loadHistory(); // Load and display new agent's history
        });

        // Send message handler
        const handleSend = () => {
            const message = inputField.value.trim();
            if (message) {
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

        // Character limit and auto-resize
        const charCount = document.getElementById('char-count');
        const inputControls = document.getElementById('input-controls');

        inputField.addEventListener('input', () => {
            // Trim to character limit
            if (inputField.value.length > MAX_INPUT_CHARS) {
                inputField.value = inputField.value.substring(0, MAX_INPUT_CHARS);
            }

            // Update character counter
            const currentCount = inputField.value.length;
            charCount.textContent = `${currentCount}/${MAX_INPUT_CHARS}`;
            inputControls.classList.toggle('char-limit-exceeded', currentCount >= MAX_INPUT_CHARS);

            // Auto-resize textarea
            inputField.style.height = 'auto';
            inputField.style.height = `${inputField.scrollHeight}px`;
        });
        
        // Initial setup for char counter
        inputField.dispatchEvent(new Event('input')); 

        // Initial load of history only if we are the admin
        if (currentUserId !== 'guest') {
            loadHistory();
        }
    };

    const openChatModal = () => {
        const modal = document.getElementById('chat-modal');
        if (modal) {
            modal.classList.add('open');
            setupChatLogic();
            document.getElementById('chat-input').focus();
        }
    };

    const closeChatModal = () => {
        const modal = document.getElementById('chat-modal');
        if (modal) {
            modal.classList.remove('open');
        }
    };

    // --- STYLING & RENDERING ---
    const injectStyles = () => {
        const style = document.createElement('style');
        style.textContent = `
            /* Import Geist Font */
            @import url('[https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap](https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap)');
            
            :root {
                --ai-blue: #0070f3;
                --ai-green: #00cc88;
                --ai-yellow: #f8e547;
                --ai-red: #ff3333;
                --bg-dark: #111827; /* Darker than the old #1e1e1e for better contrast */
                --bg-medium: #1f2937;
                --fg-light: #e5e7eb;
                --fg-medium: #9ca3af;
                --primary-indigo: #4f46e5;
                --border-color: #374151;
            }

            * {
                box-sizing: border-box;
                font-family: 'Geist', sans-serif;
            }

            /* Base Styles & Navbar */
            body { padding-top: 4rem; background-color: var(--bg-dark); color: var(--fg-light); }
            .auth-navbar { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; background: var(--bg-dark); border-bottom: 1px solid var(--border-color); height: 4rem; }
            .auth-navbar nav { max-width: 80rem; margin: auto; padding: 0 1rem; height: 100%; display: flex; align-items: center; justify-content: space-between; gap: 1rem; position: relative; }
            .initial-avatar { background: var(--bg-medium); display: flex; align-items: center; justify-content: center; color: var(--fg-light); font-weight: 600; }

            /* Auth Menu */
            .auth-menu-container {
                position: absolute; top: 3.5rem; right: 0; z-index: 50;
                width: 200px; padding: 0.5rem;
                border: 1px solid var(--border-color);
                border-radius: 0.75rem;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
                opacity: 0; visibility: hidden; transform: translateY(-10px);
                transition: opacity 0.2s, visibility 0.2s, transform 0.2s;
            }
            .auth-menu-container.open {
                opacity: 1; visibility: visible; transform: translateY(0);
            }
            .auth-menu-link, .auth-menu-button {
                display: block; width: 100%; padding: 0.5rem 0.75rem;
                border-radius: 0.5rem; text-decoration: none;
                text-align: left; font-size: 0.875rem; font-weight: 500;
                transition: background-color 0.2s;
            }
            .auth-menu-link:hover, .auth-menu-button:hover {
                background-color: var(--bg-medium);
            }
            .auth-menu-button { background: none; border: none; cursor: pointer; }


            /* Tab and Scroll Styles */
            .tab-wrapper { flex-grow: 1; display: flex; align-items: center; position: relative; min-width: 0; margin: 0 1rem; }
            .tab-scroll-container { flex-grow: 1; display: flex; align-items: center; overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 5px; margin-bottom: -5px; scroll-behavior: smooth; scrollbar-width: none; /* Hide scrollbar for cleaner look */ }
            .nav-tab { flex-shrink: 0; padding: 0.5rem 1rem; color: var(--fg-medium); font-size: 0.875rem; font-weight: 500; border-radius: 0.5rem; transition: all 0.2s; text-decoration: none; line-height: 1.5; display: flex; align-items: center; margin-right: 0.5rem; border: 1px solid transparent; }
            .nav-tab:hover { color: var(--fg-light); background-color: var(--bg-medium); }
            .nav-tab.active { color: var(--primary-indigo); border-color: var(--primary-indigo); background-color: rgba(79, 70, 229, 0.15); }
            .scroll-glide-button { position: absolute; top: 0; height: 100%; width: 2rem; display: flex; align-items: center; justify-content: center; color: var(--fg-light); cursor: pointer; opacity: 0.8; transition: opacity 0.3s; z-index: 10; pointer-events: auto; }
            .scroll-glide-button.hidden { opacity: 0.05 !important; pointer-events: none !important; } /* Always faintly visible */
            #glide-left { left: 0; background: linear-gradient(to right, var(--bg-dark) 50%, transparent); }
            #glide-right { right: 0; background: linear-gradient(to left, var(--bg-dark) 50%, transparent); }
            
            /* AI Button & Animation */
            @keyframes gemini-glow { 0%,100% { box-shadow: 0 0 8px 2px var(--ai-blue); } 25% { box-shadow: 0 0 8px 2px var(--ai-green); } 50% { box-shadow: 0 0 8px 2px var(--ai-yellow); } 75% { box-shadow: 0 0 8px 2px var(--ai-red); } }
            #ai-chat-button { animation: gemini-glow 4s infinite alternate; }

            /* --- AI Chat Modal (v5 Style) --- */
            .chat-overlay {
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background-color: rgba(0, 0, 0, 0.95);
                z-index: 2000;
                display: flex; align-items: center; justify-content: center;
                opacity: 0; pointer-events: none;
                transition: opacity 0.3s ease-in-out;
            }
            .chat-overlay.open { opacity: 1; pointer-events: auto; }
            .chat-modal {
                background: var(--bg-dark);
                border-radius: 1.5rem;
                width: 90%; max-width: 800px; height: 90%; max-height: 850px;
                display: flex; flex-direction: column;
                border: 1px solid var(--primary-indigo);
                box-shadow: 0 0 25px rgba(79, 70, 229, 0.2);
                transform: scale(0.95); transition: transform 0.3s ease-in-out;
            }
            .chat-overlay.open .chat-modal { transform: scale(1); }
            .chat-header { padding: 1rem; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-color); color: var(--fg-light); }
            .chat-history { flex-grow: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 1rem; }
            
            /* Custom Scrollbar for Chat History */
            .chat-history::-webkit-scrollbar { width: 8px; }
            .chat-history::-webkit-scrollbar-track { background: var(--bg-dark); }
            .chat-history::-webkit-scrollbar-thumb { background-color: var(--primary-indigo); border-radius: 4px; }
            
            /* Chat Messages */
            .chat-message { display: flex; max-width: 90%; }
            .chat-message.user { align-self: flex-end; justify-content: flex-end; }
            .chat-message.model { align-self: flex-start; justify-content: flex-start; }
            .chat-bubble { padding: 0.75rem 1rem; border-radius: 1rem; font-size: 0.9rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.2); }
            .chat-sender { font-size: 0.75rem; font-weight: 600; opacity: 0.8; display: block; margin-bottom: 0.25rem; }
            
            .chat-message.user .chat-bubble {
                background-color: var(--primary-indigo);
                color: white;
                border-bottom-right-radius: 0.25rem;
            }
            .chat-message.model .chat-bubble {
                background-color: var(--bg-medium);
                color: var(--fg-light);
                border-bottom-left-radius: 0.25rem;
            }
            .latex-formula {
                /* Basic styling for LaTeX output */
                font-style: italic;
                opacity: 0.9;
                padding: 0.5rem 0;
            }


            /* Code Block Styling (mode-activation.js style) */
            .code-block-wrapper {
                background: #191919;
                border-radius: 0.75rem;
                border: 1px solid var(--border-color);
                margin-top: 0.5rem;
                overflow: hidden;
            }
            .code-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0.5rem 1rem;
                background: #111;
                border-bottom: 1px solid #333;
                font-size: 0.75rem;
            }
            .code-lang {
                font-weight: 600;
                color: var(--primary-indigo);
            }
            .copy-button {
                background: none;
                border: 1px solid var(--fg-medium);
                color: var(--fg-medium);
                padding: 0.25rem 0.5rem;
                border-radius: 0.3rem;
                cursor: pointer;
                transition: background 0.2s, border-color 0.2s, color 0.2s;
                display: flex; align-items: center;
            }
            .copy-button:hover {
                background: var(--primary-indigo);
                border-color: var(--primary-indigo);
                color: white;
            }
            .code-block-wrapper pre {
                margin: 0;
                padding: 15px;
                overflow-x: auto;
                background-color: transparent;
                line-height: 1.4;
            }
            .code-block-wrapper code { font-family: 'Menlo', 'Consolas', monospace; font-size: 0.9em; color: var(--fg-light); }

            /* Input Area */
            .chat-input-area { padding: 1rem; border-top: 1px solid var(--border-color); }
            .input-box { display: flex; gap: 0.5rem; }
            .input-controls {
                display: flex; justify-content: flex-end; align-items: center;
                margin-top: 0.5rem; font-size: 0.75rem;
                color: var(--fg-medium);
            }
            #char-count.char-limit-exceeded { color: var(--ai-red); font-weight: 600; }
            
            .chat-input-area textarea {
                flex-grow: 1;
                min-height: 2.5rem;
                max-height: 6rem;
                padding: 0.5rem;
                border-radius: 0.5rem;
                border: 1px solid var(--border-color);
                background-color: var(--bg-medium);
                color: var(--fg-light);
                resize: none;
                transition: border-color 0.2s;
                line-height: 1.5;
            }
            .chat-input-area textarea:focus {
                border-color: var(--primary-indigo);
                outline: none;
            }
            .chat-input-area button {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background-color: var(--primary-indigo);
                color: white;
                transition: background-color 0.2s;
                display: flex; align-items: center; justify-content: center;
            }
            .chat-input-area button:hover:not(:disabled) { background-color: #6366f1; }
            .chat-input-area button:disabled { opacity: 0.5; cursor: not-allowed; }

            /* Loading Dots */
            .dot-flashing {
                position: relative;
                width: 5px; height: 5px;
                border-radius: 50%;
                background-color: var(--fg-light);
                color: var(--fg-light);
                animation: dot-flashing 1s infinite alternate;
                margin: 0.5rem 0.25rem;
            }
            .dot-flashing::before, .dot-flashing::after {
                content: '';
                display: inline-block;
                position: absolute;
                top: 0;
                width: 5px; height: 5px;
                border-radius: 50%;
                background-color: var(--fg-light);
                color: var(--fg-light);
            }
            .dot-flashing::before {
                left: -10px;
                animation: dot-flashing-before 1s infinite alternate;
            }
            .dot-flashing::after {
                left: 10px;
                animation: dot-flashing-after 1s infinite alternate;
            }
            @keyframes dot-flashing { 0% { background-color: var(--fg-light); } 50%, 100% { background-color: var(--fg-medium); } }
            @keyframes dot-flashing-before { 0% { background-color: var(--fg-medium); } 50%, 100% { background-color: var(--fg-light); } }
            @keyframes dot-flashing-after { 0% { background-color: var(--fg-medium); } 50%, 100% { background-color: var(--fg-light); } }

            @media (max-width: 640px) {
                .auth-navbar nav { gap: 0.5rem; padding: 0 0.5rem; }
                .tab-wrapper { margin: 0 0.5rem; }
                .nav-tab { font-size: 0.75rem; padding: 0.4rem 0.8rem; }
                .chat-modal { border-radius: 1rem; }
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
                            <i class="fa-solid fa-wand-magic-sparkles text-2xl" style="color:var(--ai-blue);"></i>
                            <h2 class="text-xl font-bold">4SP AI Mode <span class="text-xs ml-1 text-gray-400">v5</span></h2>
                        </div>
                        <div class="flex items-center space-x-3">
                            <span id="agent-title" class="text-sm font-medium" style="color:var(--ai-green);">General Agent</span>
                            <select id="agent-selector" class="bg-gray-800 text-sm text-white border border-gray-600 rounded-lg p-1">
                                <!-- Options populated by JS -->
                            </select>
                            <button id="chat-close-button" class="w-8 h-8 rounded-full text-white hover:bg-gray-700 transition">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    </div>
                    <div id="chat-history" class="chat-history">
                        <div class="chat-message model">
                            <div class="chat-bubble">
                                <span class="chat-sender">4SP AI Mode</span>
                                <p>Hello! I am your exclusive v5 AI Assistant. Please select a specialized **Agent** to begin our conversation. How can I assist you in your current subject?</p>
                            </div>
                        </div>
                    </div>
                    <div class="chat-input-area">
                        <div class="input-box">
                            <textarea id="chat-input" placeholder="Message the AI agent... (Shift+Enter for new line)" rows="1" maxlength="${MAX_INPUT_CHARS}"></textarea>
                            <button id="chat-send-button" title="Send Message">
                                <i class="fa-solid fa-paper-plane"></i>
                            </button>
                        </div>
                        <div id="input-controls" class="input-controls">
                            <span id="char-count">0/${MAX_INPUT_CHARS}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        if (!document.getElementById('chat-modal')) {
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }
    };


    // --- NAVBAR RENDERING & AUTH LISTENER ---
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
                    <i class="fa-solid fa-user text-gray-300"></i>
                </button>
                <div id="auth-menu-container" class="auth-menu-container closed" style="background:var(--bg-dark); border-color:var(--border-color); color:var(--fg-medium);">
                    <a href="/login.html" class="auth-menu-link" style="color:var(--fg-medium);">Login</a>
                    <a href="/signup.html" class="auth-menu-link" style="color:var(--fg-medium);">Sign Up</a>
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
                    <div id="auth-menu-container" class="auth-menu-container closed" style="background:var(--bg-dark); border-color:var(--border-color); color:var(--fg-medium);">
                        <div class="px-3 py-2 border-b" style="border-color:var(--border-color); margin-bottom:0.5rem;">
                            <p class="text-sm font-semibold text-white truncate">${username}</p>
                            <p class="text-xs text-gray-400 truncate">${email}</p>
                        </div>
                        <a href="/logged-in/dashboard.html" class="auth-menu-link" style="color:var(--fg-medium);">Dashboard</a>
                        <a href="/logged-in/settings.html" class="auth-menu-link" style="color:var(--fg-medium);">Settings</a>
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
                        <button id="ai-chat-button" title="4SP AI Mode v5 Chat" class="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 text-white transition duration-150 shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 mr-2">
                            <i class="fa-solid fa-wand-magic-sparkles"></i>
                        </button>
                    ` : ''}

                    ${user ? loggedInView(user, userData) : loggedOutView}
                </nav>
            </header>
        `;

        if (isOfficialAdmin) {
            renderChatModal();
        }

        setupEventListeners(user, isOfficialAdmin);

        // Auto-scroll logic
        const activeTab = document.querySelector('.nav-tab.active');
        const tabContainer = document.querySelector('.tab-scroll-container');
        if (activeTab && tabContainer) {
            tabContainer.scrollLeft = activeTab.offsetLeft - (tabContainer.offsetWidth / 2) + (activeTab.offsetWidth / 2);
        }

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
                leftButton.addEventListener('click', () => { tabContainer.scrollBy({ left: -scrollAmount, behavior: 'smooth' }); });
            }
            if (rightButton) {
                rightButton.addEventListener('click', () => { tabContainer.scrollBy({ left: scrollAmount, behavior: 'smooth' }); });
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
                    window.firebase.auth().signOut().catch(err => console.error("Logout failed:", err));
                });
            }
        }

        // AI Chat Button Listener (Exclusive)
        if (isOfficialAdmin) {
            const aiButton = document.getElementById('ai-chat-button');
            if (aiButton) {
                aiButton.addEventListener('click', openChatModal);
                // setupChatLogic() will be called on openChatModal now
            }
        }
    };

    const initializeApp = (pages) => {
        try {
            // Use the globally available Firebase functions from the loaded scripts
            app = window.firebase.initializeApp(FIREBASE_CONFIG);
            auth = window.firebase.auth();
            db = window.firebase.firestore();

            // Check if auth is defined before setting up the listener
            if (!auth) {
                console.error("Firebase Auth service failed to initialize.");
                return;
            }

            auth.onAuthStateChanged(async (user) => {
                if (user) {
                    currentUserId = user.uid;
                    try {
                        // Use the globally available Firestore functions
                        const userDoc = await db.collection('users').doc(user.uid).get();
                        const userData = userDoc.exists ? userDoc.data() : null;
                        renderNavbar(user, userData, pages);
                    } catch (error) {
                        console.error("Error fetching user data:", error);
                        renderNavbar(user, null, pages);
                    }
                } else {
                    currentUserId = 'guest';
                    renderNavbar(null, null, pages);
                    window.firebase.auth().signInAnonymously().catch((error) => {
                        if (error.code !== 'auth/operation-not-allowed') {
                            console.error("Anonymous sign-in error:", error);
                        }
                    });
                }
            });
        } catch (error) {
            console.error("Critical Firebase Initialization Error: The application could not start correctly.", error);
            // Render basic navbar without auth/firestore to prevent total page failure
            renderNavbar(null, null, pages); 
        }

        if (!document.getElementById('navbar-container')) {
            const navbarDiv = document.createElement('div');
            navbarDiv.id = 'navbar-container';
            document.body.prepend(navbarDiv);
        }
        injectStyles();
    };

    const run = async () => {
        let pages = {};

        try {
            // Load necessary external dependencies first
            await loadCSS("[https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css](https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css)");
            
            // --- UPDATED: Using modular Firebase scripts (Non-compat) ---
            await loadScript("[https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js](https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js)");
            await loadScript("[https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js](https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js)");
            await loadScript("[https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js](https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js)");


            // Fetch page configuration
            try {
                const response = await fetch(PAGE_CONFIG_URL);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                pages = await response.json();
            } catch (error) {
                console.warn("Failed to load page identification config, using empty tabs.", error);
            }

            // The initializer function handles the auth and rendering
            initializeApp(pages);

        } catch (error) {
            console.error("FATAL: One or more required scripts failed to load. The navigation bar may not function.", error);
            // Ensure the page content still loads even if the navbar scripts fail
            injectStyles();
            if (!document.getElementById('navbar-container')) {
                const navbarDiv = document.createElement('div');
                navbarDiv.id = 'navbar-container';
                document.body.prepend(navbarDiv);
            }
            document.getElementById('navbar-container').innerHTML = `<header class="auth-navbar"><nav><p class="text-red-400">Navigation Load Error. Check Console.</p></nav></header>`;
        }
    };

    // Start on DOM content loaded
    document.addEventListener('DOMContentLoaded', run);
})();
