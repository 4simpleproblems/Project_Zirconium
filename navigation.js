/**
 * navigation.js
 * * This is a fully self-contained script to create a dynamic, authentication-aware
 * navigation bar for your website. It handles everything from Firebase initialization
 * to rendering user-specific information. It now includes a horizontally scrollable
 * tab menu loaded from page-identification.json.
 *
 * --- SPECIAL FEATURE ---
 * - An AI Chatbot is integrated, visible only to the user '4simpleproblems@gmail.com'.
 * - It features different 'Agents' (General, Math, Science, etc.) with custom personalities
 * and model configurations powered by Firebase Vertex AI.
 *
 * --- INSTRUCTIONS ---
 * 1. ACTION REQUIRED: Paste your own Firebase project configuration into the `FIREBASE_CONFIG` object below.
 * 2. Place this script in the root directory of your website.
 * 3. Add `<script src="/navigation.js" defer></script>` to the <head> of any HTML file where you want the navbar.
 * 4. Ensure your file paths for images and links are root-relative (e.g., "/images/logo.png", "/login.html").
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
const ADMIN_EMAIL = '4simpleproblems@gmail.com'; // The email that gets access to the AI chat

// Global Firebase services
let auth;
let db;
let vertex;
let model;

// --- Self-invoking function to encapsulate all logic ---
(function() {
    if (!FIREBASE_CONFIG || !FIREBASE_CONFIG.apiKey) {
        console.error("Firebase configuration is missing! Please paste your config into navigation.js.");
        return;
    }

    // --- 1. DYNAMICALLY LOAD EXTERNAL ASSETS ---
    const loadScript = (src) => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.type = 'module';
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            document.head.appendChild(script);
        });
    };

    const loadCSS = (href) => {
        return new Promise((resolve) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = resolve;
            link.onerror = resolve; // Don't block execution for CSS
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
        await loadCSS("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css");

        try {
            const response = await fetch(PAGE_CONFIG_URL);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            pages = await response.json();
        } catch (error) {
            console.error("Failed to load page identification config:", error);
        }

        try {
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js");
            // Load the new Firebase AI/Vertex SDK
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-vertexai-compat.js");

            initializeApp(pages);
        } catch (error) {
            console.error("Failed to load necessary Firebase SDKs:", error);
        }
    };

    // --- 2. INITIALIZE FIREBASE AND RENDER NAVBAR ---
    const initializeApp = (pages) => {
        const app = firebase.initializeApp(FIREBASE_CONFIG);
        auth = firebase.auth();
        db = firebase.firestore();
        // Initialize Vertex AI
        vertex = firebase.vertexAI();

        const injectStyles = () => {
            const style = document.createElement('style');
            style.textContent = `
                /* Base Styles & Navbar */
                body { padding-top: 4rem; }
                .auth-navbar { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; background: #000000; border-bottom: 1px solid rgb(31 41 55); height: 4rem; }
                .auth-navbar nav { max-width: 80rem; margin: auto; padding: 0 1rem; height: 100%; display: flex; align-items: center; justify-content: space-between; gap: 1rem; position: relative; }
                .initial-avatar { background: linear-gradient(135deg, #374151 0%, #111827 100%); font-family: 'Geist', sans-serif; text-transform: uppercase; display: flex; align-items: center; justify-content: center; color: white; }
                .auth-controls { display: flex; align-items: center; gap: 0.75rem; }

                /* Auth Dropdown Menu */
                .auth-menu-container { position: absolute; right: 0; top: 50px; width: 16rem; background: #000000; border: 1px solid rgb(55 65 81); border-radius: 0.75rem; padding: 0.5rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -2px rgba(0,0,0,0.2); transition: transform 0.2s ease-out, opacity 0.2s ease-out; transform-origin: top right; }
                .auth-menu-container.open { opacity: 1; transform: translateY(0) scale(1); }
                .auth-menu-container.closed { opacity: 0; pointer-events: none; transform: translateY(-10px) scale(0.95); }
                .auth-menu-link, .auth-menu-button { display: block; width: 100%; text-align: left; padding: 0.5rem 0.75rem; font-size: 0.875rem; color: #d1d5db; border-radius: 0.375rem; transition: background-color 0.2s, color 0.2s; }
                .auth-menu-link:hover, .auth-menu-button:hover { background-color: rgb(55 65 81); color: white; }

                /* Scrollable Tabs */
                .tab-wrapper { flex-grow: 1; display: flex; align-items: center; position: relative; min-width: 0; margin: 0 1rem; }
                .tab-scroll-container { flex-grow: 1; display: flex; align-items: center; overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none; scroll-behavior: smooth; }
                .tab-scroll-container::-webkit-scrollbar { display: none; }
                .scroll-glide-button { position: absolute; top: 0; height: 100%; width: 2rem; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.2rem; cursor: pointer; opacity: 0.8; transition: opacity 0.3s, background 0.3s; z-index: 10; pointer-events: auto; }
                .scroll-glide-button:hover { opacity: 1; }
                #glide-left { left: 0; background: linear-gradient(to right, #000000 50%, transparent); }
                #glide-right { right: 0; background: linear-gradient(to left, #000000 50%, transparent); }
                .scroll-glide-button.hidden { opacity: 0 !important; pointer-events: none !important; }
                .nav-tab { flex-shrink: 0; padding: 0.5rem 1rem; color: #9ca3af; font-size: 0.875rem; font-weight: 500; border-radius: 0.5rem; transition: all 0.2s; text-decoration: none; display: flex; align-items: center; margin-right: 0.5rem; border: 1px solid transparent; }
                .nav-tab:hover { color: white; background-color: rgb(55 65 81); }
                .nav-tab.active { color: #4f46e5; border-color: #4f46e5; background-color: rgba(79, 70, 229, 0.1); }
                .nav-tab.active:hover { color: #6366f1; border-color: #6366f1; background-color: rgba(79, 70, 229, 0.15); }
                
                /* --- AI CHAT STYLES (NEW) --- */
                .ai-chat-button { background-color: #27272a; border: 1px solid #3f3f46; color: #a1a1aa; width: 2rem; height: 2rem; border-radius: 9999px; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease-in-out; }
                .ai-chat-button:hover { background-color: #3f3f46; color: white; transform: scale(1.1); }
                
                .ai-chat-overlay { position: fixed; inset: 0; z-index: 2000; background-color: rgba(0,0,0,0.5); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); opacity: 0; transition: opacity 0.3s ease-in-out; pointer-events: none; }
                .ai-chat-overlay.visible { opacity: 1; pointer-events: auto; }

                .ai-chat-container { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 90vw; max-width: 800px; height: 80vh; background-color: #111827; border: 1px solid #374151; border-radius: 0.75rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); display: flex; flex-direction: column; overflow: hidden; }
                
                .ai-chat-header { padding: 1rem; border-bottom: 1px solid #374151; display: flex; justify-content: space-between; align-items: center; }
                .ai-chat-header h2 { font-size: 1.125rem; font-weight: 600; color: white; }
                .ai-chat-header h2 .agent-name { color: #818cf8; }
                .ai-chat-close { background: none; border: none; color: #9ca3af; font-size: 1.5rem; cursor: pointer; transition: color 0.2s; }
                .ai-chat-close:hover { color: white; }

                .ai-chat-main { display: flex; flex-grow: 1; min-height: 0; }
                .ai-chat-sidebar { width: 200px; background-color: #1f2937; border-right: 1px solid #374151; padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
                .ai-chat-sidebar h3 { font-weight: 600; color: #e5e7eb; margin-bottom: 0.5rem; }
                .agent-button { width: 100%; padding: 0.5rem; background-color: #374151; border: 1px solid #4b5563; color: #d1d5db; border-radius: 0.375rem; text-align: left; cursor: pointer; transition: all 0.2s; }
                .agent-button:hover { background-color: #4b5563; color: white; }
                .agent-button.selected { background-color: #4f46e5; color: white; border-color: #6366f1; }

                .ai-chat-conversation { flex-grow: 1; display: flex; flex-direction: column; }
                .ai-chat-messages { flex-grow: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 1rem; }
                
                /* Scrollbar Styling (NEW) */
                .ai-chat-messages::-webkit-scrollbar { width: 8px; }
                .ai-chat-messages::-webkit-scrollbar-track { background: #1f2937; }
                .ai-chat-messages::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 4px; }
                .ai-chat-messages::-webkit-scrollbar-thumb:hover { background: #6b7280; }

                .message { max-width: 80%; padding: 0.75rem 1rem; border-radius: 0.75rem; line-height: 1.5; }
                .message.user { background-color: #3730a3; color: white; align-self: flex-end; }
                .message.model { background-color: #374151; color: #e5e7eb; align-self: flex-start; }
                .message.model.loading { display: flex; align-items: center; gap: 0.5rem; }
                .message.model.loading::before { content: ''; display: block; width: 10px; height: 10px; border-radius: 50%; background-color: #818cf8; animation: pulse 1.5s infinite; }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

                .ai-chat-input-form { display: flex; padding: 1rem; border-top: 1px solid #374151; gap: 0.5rem; }
                #ai-chat-input { flex-grow: 1; background-color: #1f2937; border: 1px solid #4b5563; border-radius: 0.375rem; padding: 0.5rem 0.75rem; color: white; outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
                #ai-chat-input:focus { border-color: #4f46e5; box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.5); }
                #ai-chat-submit { background-color: #4f46e5; color: white; border: none; border-radius: 0.375rem; padding: 0.5rem 1rem; cursor: pointer; transition: background-color 0.2s; display: flex; align-items: center; gap: 0.5rem; }
                #ai-chat-submit:hover { background-color: #6366f1; }
                #ai-chat-submit:disabled { background-color: #374151; cursor: not-allowed; }
            `;
            document.head.appendChild(style);
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
                const activeClass = isActive ? 'active' : '';
                const iconClasses = getIconClass(page.icon);
                return `<a href="${page.url}" class="nav-tab ${activeClass}"><i class="${iconClasses} mr-2"></i>${page.name}</a>`;
            }).join('');

            const loggedOutView = `
                <div class="auth-controls">
                    <div class="relative flex-shrink-0">
                        <button id="auth-toggle" class="w-8 h-8 rounded-full border border-gray-700 flex items-center justify-center bg-gray-800 hover:bg-gray-700 transition">
                            <svg class="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                        </button>
                        <div id="auth-menu-container" class="auth-menu-container closed">
                            <a href="/login.html" class="auth-menu-link">Login</a>
                            <a href="/signup.html" class="auth-menu-link">Sign Up</a>
                        </div>
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
                
                // --- AI Chat Button (Conditional) ---
                const aiChatButtonHtml = user && user.email === ADMIN_EMAIL ? `
                    <button id="ai-chat-toggle" class="ai-chat-button" title="Open 4SP AI Assistant">
                        <i class="fa-solid fa-wand-magic-sparkles"></i>
                    </button>
                ` : '';

                return `
                    <div class="auth-controls">
                        ${aiChatButtonHtml}
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
                    </div>
                `;
            };

            const aiChatUIHtml = `
                <div id="ai-chat-overlay" class="ai-chat-overlay">
                    <div id="ai-chat-container" class="ai-chat-container">
                        <div class="ai-chat-header">
                            <h2>4SP AI Mode: <span id="agent-name-display" class="agent-name">General</span></h2>
                            <button id="ai-chat-close" class="ai-chat-close">&times;</button>
                        </div>
                        <div class="ai-chat-main">
                            <div class="ai-chat-sidebar">
                                <h3>Agents</h3>
                                <button class="agent-button selected" data-agent="General">General</button>
                                <button class="agent-button" data-agent="Math">Math</button>
                                <button class="agent-button" data-agent="Science">Science</button>
                                <button class="agent-button" data-agent="Language Arts">Language Arts</button>
                                <button class="agent-button" data-agent="History">History</button>
                                <button class="agent-button" data-agent="STEM">STEM</button>
                                <button class="agent-button" data-agent="Coding">Coding</button>
                            </div>
                            <div class="ai-chat-conversation">
                                <div id="ai-chat-messages" class="ai-chat-messages">
                                    <!-- Messages will be injected here -->
                                </div>
                                <form id="ai-chat-input-form" class="ai-chat-input-form">
                                    <input type="text" id="ai-chat-input" placeholder="Ask anything..." autocomplete="off">
                                    <button type="submit" id="ai-chat-submit" disabled>
                                        <i class="fa-solid fa-paper-plane"></i>
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            container.innerHTML = `
                <header class="auth-navbar">
                    <nav>
                        <a href="/" class="flex items-center space-x-2 flex-shrink-0">
                            <img src="${logoPath}" alt="4SP Logo" class="h-8 w-auto">
                        </a>
                        <div class="tab-wrapper">
                            <button id="glide-left" class="scroll-glide-button hidden"><i class="fa-solid fa-chevron-left"></i></button>
                            <div class="tab-scroll-container">${tabsHtml}</div>
                            <button id="glide-right" class="scroll-glide-button hidden"><i class="fa-solid fa-chevron-right"></i></button>
                        </div>
                        ${user ? loggedInView(user, userData) : loggedOutView}
                    </nav>
                </header>
                ${(user && user.email === ADMIN_EMAIL) ? aiChatUIHtml : ''}
            `;
            
            setupEventListeners(user);
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
            const tabContainer = document.querySelector('.tab-scroll-container');
            const leftButton = document.getElementById('glide-left');
            const rightButton = document.getElementById('glide-right');
            const debouncedUpdateGilders = debounce(updateScrollGilders, 50);

            if (tabContainer) {
                const scrollAmount = tabContainer.offsetWidth * 0.8; 
                tabContainer.addEventListener('scroll', debouncedUpdateGilders);
                window.addEventListener('resize', debouncedUpdateGilders);
                if (leftButton) leftButton.addEventListener('click', () => tabContainer.scrollBy({ left: -scrollAmount, behavior: 'smooth' }));
                if (rightButton) rightButton.addEventListener('click', () => tabContainer.scrollBy({ left: scrollAmount, behavior: 'smooth' }));
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
                if (logoutButton) logoutButton.addEventListener('click', () => auth.signOut().catch(err => console.error("Logout failed:", err)));

                // --- AI CHAT EVENT LISTENERS (NEW) ---
                if (user.email === ADMIN_EMAIL) {
                    setupAiChatListeners();
                }
            }
        };

        // --- AI CHAT LOGIC (NEW) ---
        const setupAiChatListeners = () => {
            const chatToggleButton = document.getElementById('ai-chat-toggle');
            const chatOverlay = document.getElementById('ai-chat-overlay');
            const chatCloseButton = document.getElementById('ai-chat-close');
            const agentButtons = document.querySelectorAll('.agent-button');
            const agentNameDisplay = document.getElementById('agent-name-display');
            const chatForm = document.getElementById('ai-chat-input-form');
            const chatInput = document.getElementById('ai-chat-input');
            const chatSubmit = document.getElementById('ai-chat-submit');
            const messagesContainer = document.getElementById('ai-chat-messages');

            let currentAgent = 'General';
            let chat; // This will hold the chat session instance

            const AGENT_CONFIGS = {
                'General': { temp: 0.7, personality: 'You are 4SP AI Mode, a helpful, friendly, and knowledgeable general-purpose assistant.' },
                'Math': { temp: 0.2, personality: 'You are 4SP AI Mode, a precise and logical mathematics expert. Explain steps clearly and use LaTeX for formulas.' },
                'Science': { temp: 0.4, personality: 'You are 4SP AI Mode, a science educator who explains complex scientific concepts with clarity and enthusiasm.' },
                'Language Arts': { temp: 0.8, personality: 'You are 4SP AI Mode, a creative and insightful literary analyst and writing coach.' },
                'History': { temp: 0.6, personality: 'You are 4SP AI Mode, a historian who tells compelling stories about the past with factual accuracy.' },
                'STEM': { temp: 0.3, personality: 'You are 4SP AI Mode, an expert in Science, Technology, Engineering, and Math. You provide practical and innovative solutions.' },
                'Coding': { temp: 0.1, personality: 'You are 4SP AI Mode, an expert programmer. Provide clean, efficient code with clear explanations. Use markdown for code blocks.' }
            };

            const initializeChatSession = (agent) => {
                const config = AGENT_CONFIGS[agent];
                // Use gemini-pro for chat
                model = vertex.getGenerativeModel({ 
                    model: "gemini-pro",
                    systemInstruction: config.personality,
                    generationConfig: {
                        temperature: config.temp,
                    }
                });
                chat = model.startChat({ history: [] });
            };
            
            initializeChatSession(currentAgent);

            const toggleChat = (visible) => {
                chatOverlay.classList.toggle('visible', visible);
            };

            chatToggleButton.addEventListener('click', () => toggleChat(true));
            chatCloseButton.addEventListener('click', () => toggleChat(false));
            chatOverlay.addEventListener('click', (e) => {
                if (e.target === chatOverlay) {
                    toggleChat(false);
                }
            });

            agentButtons.forEach(button => {
                button.addEventListener('click', () => {
                    currentAgent = button.dataset.agent;
                    agentButtons.forEach(btn => btn.classList.remove('selected'));
                    button.classList.add('selected');
                    agentNameDisplay.textContent = currentAgent;
                    messagesContainer.innerHTML = ''; // Clear chat history
                    initializeChatSession(currentAgent);
                });
            });

            chatInput.addEventListener('input', () => {
                chatSubmit.disabled = chatInput.value.trim() === '';
            });

            chatForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const userInput = chatInput.value.trim();
                if (!userInput) return;

                chatInput.value = '';
                chatSubmit.disabled = true;

                addMessage(userInput, 'user');
                
                const modelLoadingDiv = addMessage('...', 'model', true);

                try {
                    const result = await chat.sendMessageStream(userInput);
                    let fullResponse = "";
                    for await (const item of result.stream) {
                         const text = item.candidates[0].content.parts[0].text;
                         fullResponse += text;
                         modelLoadingDiv.innerHTML = fullResponse; // Use innerHTML to render markdown correctly if library is added
                         messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                    modelLoadingDiv.classList.remove('loading');

                } catch (error) {
                    console.error("AI Chat Error:", error);
                    modelLoadingDiv.innerText = "Sorry, something went wrong. Please try again.";
                    modelLoadingDiv.style.color = '#f87171';
                }
            });

            const addMessage = (text, sender, isLoading = false) => {
                const messageDiv = document.createElement('div');
                messageDiv.classList.add('message', sender);
                if (isLoading) {
                    messageDiv.classList.add('loading');
                }
                messageDiv.innerText = text;
                messagesContainer.appendChild(messageDiv);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                return messageDiv;
            };
        };

        // --- AUTH STATE LISTENER ---
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
                        console.warn("Anonymous sign-in is disabled in Firebase Console.");
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

    document.addEventListener('DOMContentLoaded', run);

})();
