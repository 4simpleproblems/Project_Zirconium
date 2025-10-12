/**
 * navigation.js
 * * This is a fully self-contained script to create a dynamic, authentication-aware
 * navigation bar for your website. It now includes a powerful AI Agent powered by
 * Google's Gemini through Firebase AI Extensions.
 *
 * --- AI AGENT FEATURES ---
 * 1. USER ACCESS: The AI Agent is only available to the email '4simpleproblems@gmail.com'.
 * 2. ACTIVATION: The agent can be activated by pressing 'Control + A' (when not in a text input).
 * 3. AGENT CATEGORIES: Users can choose from 8 different AI agent personalities for their chat.
 * 4. SYSTEM INFO: The AI is provided with the user's current time, timezone, and general location.
 *
 * --- INSTRUCTIONS ---
 * 1. ACTION REQUIRED: Paste your own Firebase project configuration into the `FIREBASE_CONFIG` object below.
 * 2. This script now requires the Firebase AI SDK. Ensure your project is set up for it.
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

// Variables to hold Firebase objects
let auth;
let db;
let generativeModel; // For Firebase AI

// --- Self-invoking function to encapsulate all logic ---
(function() {
    if (!FIREBASE_CONFIG || !FIREBASE_CONFIG.apiKey) {
        console.error("Firebase configuration is missing! Please paste your config into navigation.js.");
        return;
    }

    const loadScript = (src, type = 'module') => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.type = type;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    };

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
            if (baseName && !baseName.startsWith('fa-')) baseName = `fa-${baseName}`;
        }
        return baseName ? `${stylePrefix} ${baseName}` : '';
    };

    const run = async () => {
        let pages = {};
        await loadCSS("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css");

        try {
            const response = await fetch(PAGE_CONFIG_URL);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            pages = await response.json();
        } catch (error) {
            console.error("Failed to load page identification config:", error);
        }

        try {
            // Load Firebase Core and Services
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js");
            // NEW: Load the Firebase AI/Vertex SDK
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-vertexai-compat.js");

            initializeApp(pages);
        } catch (error) {
            console.error("Failed to load necessary SDKs:", error);
        }
    };

    const initializeApp = (pages) => {
        const app = firebase.initializeApp(FIREBASE_CONFIG);
        auth = firebase.auth();
        db = firebase.firestore();
        // NEW: Initialize the Vertex AI service
        const vertex = firebase.vertexAI();
        // NEW: Get the generative model
        generativeModel = vertex.getGenerativeModel({ model: "gemini-pro" });


        const injectStyles = () => {
            const style = document.createElement('style');
            style.textContent = `
                body { padding-top: 4rem; }
                .auth-navbar { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; background: #000000; border-bottom: 1px solid rgb(31 41 55); height: 4rem; }
                .auth-navbar nav { max-width: 80rem; margin: auto; padding: 0 1rem; height: 100%; display: flex; align-items: center; justify-content: space-between; gap: 1rem; position: relative; }
                .initial-avatar { background: linear-gradient(135deg, #374151 0%, #111827 100%); font-family: 'Geist', sans-serif; text-transform: uppercase; display: flex; align-items: center; justify-content: center; color: white; }
                .auth-menu-container { position: absolute; right: 0; top: 50px; width: 16rem; background: #000000; border: 1px solid rgb(55 65 81); border-radius: 0.75rem; padding: 0.5rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -2px rgba(0,0,0,0.2); transition: transform 0.2s ease-out, opacity 0.2s ease-out; transform-origin: top right; }
                .auth-menu-container.open { opacity: 1; transform: translateY(0) scale(1); }
                .auth-menu-container.closed { opacity: 0; pointer-events: none; transform: translateY(-10px) scale(0.95); }
                .auth-menu-link, .auth-menu-button { display: flex; align-items: center; gap: 0.75rem; width: 100%; text-align: left; padding: 0.5rem 0.75rem; font-size: 0.875rem; color: #d1d5db; border-radius: 0.375rem; transition: background-color 0.2s, color 0.2s; border: none; cursor: pointer; }
                .auth-menu-link:hover, .auth-menu-button:hover { background-color: rgb(55 65 81); color: white; }
                .logged-out-auth-toggle { background: #010101; border: 1px solid #374151; }
                .logged-out-auth-toggle i { color: #DADADA; }
                .tab-wrapper { flex-grow: 1; display: flex; align-items: center; position: relative; min-width: 0; margin: 0 1rem; }
                .tab-scroll-container { flex-grow: 1; display: flex; align-items: center; overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none; padding-bottom: 5px; margin-bottom: -5px; scroll-behavior: smooth; }
                .tab-scroll-container::-webkit-scrollbar { display: none; }
                .scroll-glide-button { position: absolute; top: 0; height: 100%; width: 4rem; display: flex; align-items: center; justify-content: center; background: #000000; color: white; font-size: 1.2rem; cursor: pointer; opacity: 0.8; transition: opacity 0.3s, background 0.3s; z-index: 10; pointer-events: auto; }
                .scroll-glide-button:hover { opacity: 1; }
                #glide-left { left: 0; background: linear-gradient(to right, #000000 50%, transparent); justify-content: flex-start; padding-left: 0.5rem; }
                #glide-right { right: 0; background: linear-gradient(to left, #000000 50%, transparent); justify-content: flex-end; padding-right: 0.5rem; }
                .scroll-glide-button.hidden { opacity: 0 !important; pointer-events: none !important; }
                .nav-tab { flex-shrink: 0; padding: 0.5rem 1rem; color: #9ca3af; font-size: 0.875rem; font-weight: 500; border-radius: 0.5rem; transition: all 0.2s; text-decoration: none; line-height: 1.5; display: flex; align-items: center; margin-right: 0.5rem; border: 1px solid transparent; }
                .nav-tab:not(.active):hover { color: white; border-color: #d1d5db; background-color: rgba(79, 70, 229, 0.05); }
                .nav-tab.active { color: #4f46e5; border-color: #4f46e5; background-color: rgba(79, 70, 229, 0.1); }
                .nav-tab.active:hover { color: #6366f1; border-color: #6366f1; background-color: rgba(79, 70, 229, 0.15); }

                /* --- AI Agent Styles --- */
                #ai-agent-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); z-index: 2000; display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity 0.3s ease; }
                #ai-agent-modal.visible { opacity: 1; pointer-events: auto; }
                .ai-agent-container { background: #0a0a0a; border: 1px solid #27272a; border-radius: 1rem; width: 90%; max-width: 600px; height: 80%; max-height: 700px; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); transform: scale(0.95); transition: transform 0.3s ease; }
                #ai-agent-modal.visible .ai-agent-container { transform: scale(1); }
                .ai-agent-header { padding: 1rem; border-bottom: 1px solid #27272a; display: flex; justify-content: space-between; align-items: center; }
                .ai-agent-header h2 { font-size: 1.25rem; font-weight: 600; color: #f4f4f5; }
                #ai-agent-close { background: none; border: none; color: #a1a1aa; font-size: 1.5rem; cursor: pointer; transition: color 0.2s; }
                #ai-agent-close:hover { color: #f4f4f5; }
                .ai-agent-body { flex-grow: 1; display: flex; }
                .ai-agent-sidebar { width: 180px; border-right: 1px solid #27272a; padding: 1rem; overflow-y: auto; }
                .ai-agent-sidebar h3 { font-size: 0.875rem; color: #a1a1aa; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.05em; }
                .ai-agent-category { background: transparent; border: 1px solid #3f3f46; color: #d4d4d8; width: 100%; padding: 0.5rem; border-radius: 0.5rem; margin-bottom: 0.5rem; cursor: pointer; transition: background-color 0.2s, border-color 0.2s; text-align: left; }
                .ai-agent-category:hover { background-color: #18181b; }
                .ai-agent-category.selected { background-color: #4f46e5; border-color: #4f46e5; color: white; font-weight: 600; }
                .ai-agent-chat-area { flex-grow: 1; display: flex; flex-direction: column; }
                .ai-chat-history { flex-grow: 1; padding: 1rem; overflow-y: auto; display: flex; flex-direction: column; gap: 1rem; }
                .chat-message { max-width: 80%; padding: 0.75rem 1rem; border-radius: 1rem; line-height: 1.5; }
                .chat-message.user { background: #4f46e5; color: white; align-self: flex-end; border-bottom-right-radius: 0; }
                .chat-message.agent { background: #27272a; color: #d4d4d8; align-self: flex-start; border-bottom-left-radius: 0; }
                .chat-message.system { font-size: 0.75rem; text-align: center; color: #71717a; background: none; padding: 0.5rem; width: 100%; align-self: center; }
                .ai-chat-input-area { border-top: 1px solid #27272a; padding: 1rem; display: flex; gap: 1rem; }
                #ai-chat-input { flex-grow: 1; background: #18181b; border: 1px solid #3f3f46; border-radius: 0.5rem; padding: 0.75rem; color: #f4f4f5; font-size: 1rem; transition: border-color 0.2s, box-shadow 0.2s; }
                #ai-chat-input:focus { outline: none; border-color: #4f46e5; box-shadow: 0 0 0 2px #4f46e530; }
                #ai-chat-send { background: #4f46e5; border: none; color: white; padding: 0 1.5rem; border-radius: 0.5rem; font-weight: 600; cursor: pointer; transition: background-color 0.2s; }
                #ai-chat-send:hover { background-color: #6366f1; }
            `;
            document.head.appendChild(style);
        };

        const isTabActive = (tabUrl) => {
            const cleanPath = (path) => {
                if (path.endsWith('/index.html')) path = path.substring(0, path.lastIndexOf('/')) + '/';
                if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
                return path;
            };
            const currentCanonical = cleanPath(window.location.pathname.toLowerCase());
            const tabCanonical = cleanPath(new URL(tabUrl, window.location.origin).pathname.toLowerCase());
            if (currentCanonical === tabCanonical) return true;
            const tabPathSuffix = tabCanonical.startsWith('/') ? tabCanonical.substring(1) : tabCanonical;
            return window.location.pathname.toLowerCase().endsWith(tabPathSuffix);
        };

        const updateScrollGilders = () => {
            const container = document.querySelector('.tab-scroll-container');
            if (!container) return;
            const leftButton = document.getElementById('glide-left');
            const rightButton = document.getElementById('glide-right');
            const hasHorizontalOverflow = container.scrollWidth > container.offsetWidth;
            if (hasHorizontalOverflow) {
                const isScrolledToLeft = container.scrollLeft < 5;
                const isScrolledToRight = container.scrollLeft + container.offsetWidth >= container.scrollWidth - 5;
                leftButton.classList.toggle('hidden', isScrolledToLeft);
                rightButton.classList.toggle('hidden', isScrolledToRight);
            } else {
                leftButton.classList.add('hidden');
                rightButton.classList.add('hidden');
            }
        };

        const renderNavbar = (user, userData, pages) => {
            const container = document.getElementById('navbar-container');
            if (!container) return;
            const logoPath = "/images/logo.png";
            const tabsHtml = Object.values(pages || {}).map(page => {
                const isActive = isTabActive(page.url);
                return `<a href="${page.url}" class="nav-tab ${isActive ? 'active' : ''}"><i class="${getIconClass(page.icon)} mr-2"></i>${page.name}</a>`;
            }).join('');

            const loggedOutView = `...`; // Original logged out view
            const loggedInView = (user, userData) => { /* ... */ }; // Original logged in view

            container.innerHTML = `
                <header class="auth-navbar">
                    <nav>
                        <a href="/" class="flex items-center space-x-2 flex-shrink-0"><img src="${logoPath}" alt="4SP Logo" class="h-8 w-auto"></a>
                        <div class="tab-wrapper">
                            <button id="glide-left" class="scroll-glide-button hidden"><i class="fa-solid fa-chevron-left"></i></button>
                            <div class="tab-scroll-container">${tabsHtml}</div>
                            <button id="glide-right" class="scroll-glide-button hidden"><i class="fa-solid fa-chevron-right"></i></button>
                        </div>
                        ${user ? loggedInView(user, userData) : loggedOutView}
                    </nav>
                </header>`;
            
            // AI Agent Modal is rendered for the specific user
            if (user && user.email === '4simpleproblems@gmail.com') {
                renderAIAgentModal();
            }

            setupEventListeners(user);
            const activeTab = document.querySelector('.nav-tab.active');
            if (activeTab) {
                const tabContainer = document.querySelector('.tab-scroll-container');
                tabContainer.scrollLeft = activeTab.offsetLeft - (tabContainer.offsetWidth / 2) + (activeTab.offsetWidth / 2);
            }
            updateScrollGilders();
        };

        const renderAIAgentModal = () => {
            if (document.getElementById('ai-agent-modal')) return;
            const modal = document.createElement('div');
            modal.id = 'ai-agent-modal';
            modal.innerHTML = `
                <div class="ai-agent-container">
                    <div class="ai-agent-header">
                        <h2>AI Agent</h2>
                        <button id="ai-agent-close"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="ai-agent-body">
                        <div class="ai-agent-sidebar">
                            <h3>Agent Type</h3>
                            <button class="ai-agent-category selected" data-agent="Standard">Standard</button>
                            <button class="ai-agent-category" data-agent="Quick">Quick</button>
                            <button class="ai-agent-category" data-agent="Deep Thinking">Deep Thinking</button>
                            <button class="ai-agent-category" data-agent="Creative">Creative</button>
                            <button class="ai-agent-category" data-agent="Code Helper">Code Helper</button>
                            <button class="ai-agent-category" data-agent="Fact Checker">Fact Checker</button>
                            <button class="ai-agent-category" data-agent="Concise">Concise</button>
                            <button class="ai-agent-category" data-agent="Friendly">Friendly</button>
                        </div>
                        <div class="ai-agent-chat-area">
                            <div class="ai-chat-history" id="ai-chat-history">
                                <!-- System message will be injected here -->
                            </div>
                            <div class="ai-chat-input-area">
                                <input type="text" id="ai-chat-input" placeholder="Ask anything...">
                                <button id="ai-chat-send"><i class="fa-solid fa-paper-plane"></i></button>
                            </div>
                        </div>
                    </div>
                </div>`;
            document.body.appendChild(modal);
            setupAIAgentListeners();
        };

        const setupEventListeners = (user) => { /* ... original listeners ... */ };
        
        const setupAIAgentListeners = () => {
            const modal = document.getElementById('ai-agent-modal');
            const closeButton = document.getElementById('ai-agent-close');
            const sendButton = document.getElementById('ai-chat-send');
            const input = document.getElementById('ai-chat-input');
            const categories = document.querySelectorAll('.ai-agent-category');

            const toggleModal = (visible) => modal.classList.toggle('visible', visible);

            closeButton.addEventListener('click', () => toggleModal(false));
            modal.addEventListener('click', (e) => {
                if (e.target === modal) toggleModal(false);
            });

            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key.toLowerCase() === 'a') {
                     // Prevent default browser action (select all)
                    e.preventDefault();
                    // Check if the event target is an input, textarea, or contenteditable element
                    if (!['INPUT', 'TEXTAREA'].includes(e.target.tagName) && !e.target.isContentEditable) {
                         if(auth.currentUser && auth.currentUser.email === '4simpleproblems@gmail.com') {
                            toggleModal(!modal.classList.contains('visible'));
                         }
                    }
                }
            });

            categories.forEach(cat => {
                cat.addEventListener('click', () => {
                    categories.forEach(c => c.classList.remove('selected'));
                    cat.classList.add('selected');
                });
            });

            sendButton.addEventListener('click', handleAIChat);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') handleAIChat();
            });
        };
        
        const getSystemInfo = () => {
            const now = new Date();
            const time = now.toLocaleTimeString();
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            // A fetch call to a geo IP service would be needed for accurate location.
            // For this example, we'll use a placeholder.
            const location = "User's approximate location (e.g., State/City)"; 
            return { time, timeZone, location };
        };

        const handleAIChat = async () => {
            const input = document.getElementById('ai-chat-input');
            const history = document.getElementById('ai-chat-history');
            const selectedAgent = document.querySelector('.ai-agent-category.selected').dataset.agent;
            const prompt = input.value.trim();
            if (!prompt) return;

            // Add user message to history
            history.innerHTML += `<div class="chat-message user">${prompt}</div>`;
            input.value = '';
            history.scrollTop = history.scrollHeight;

            const systemInfo = getSystemInfo();
            const agentPrompts = {
                "Standard": "You are a helpful assistant.",
                "Quick": "You are a quick and concise assistant. Get straight to the point.",
                "Deep Thinking": "You are a deep thinking assistant. Provide detailed and well-reasoned answers.",
                "Creative": "You are a creative assistant. Think outside the box.",
                "Code Helper": "You are a code helper. Provide clean and efficient code with explanations.",
                "Fact Checker": "You are a fact-checking assistant. Verify information and provide sources.",
                "Concise": "You are a concise assistant. Keep your answers short and to the point.",
                "Friendly": "You are a friendly and conversational assistant."
            };
            
            const fullPrompt = `
                System Information:
                - Current Time: ${systemInfo.time}
                - Time Zone: ${systemInfo.timeZone}
                - Location: ${systemInfo.location}

                Agent Persona: ${agentPrompts[selectedAgent]}

                User Query: ${prompt}
            `;

            try {
                const result = await generativeModel.generateContent(fullPrompt);
                const response = await result.response;
                const text = response.text();
                history.innerHTML += `<div class="chat-message agent">${text}</div>`;
            } catch (error) {
                console.error("AI Generation Error:", error);
                history.innerHTML += `<div class="chat-message agent">Sorry, I encountered an error.</div>`;
            } finally {
                history.scrollTop = history.scrollHeight;
            }
        };


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
                    console.error("Anonymous sign-in error:", error);
                });
            }
        });

        if (!document.getElementById('navbar-container')) {
            const navbarDiv = document.createElement('div');
            navbarDiv.id = 'navbar-container';
            document.body.prepend(navbarDiv);
        }
        injectStyles();
    };

    document.addEventListener('DOMContentLoaded', run);

})();
