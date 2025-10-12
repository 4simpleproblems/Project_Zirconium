/**
 * navigation.js (with AI Agent Integration)
 * * This is a fully self-contained script to create a dynamic, authentication-aware
 * navigation bar for your website with integrated Vertex AI chat capabilities.
 * It handles everything from Firebase initialization to rendering user-specific
 * information and AI agent interactions.
 *
 * --- NEW FEATURES ---
 * - Firebase Vertex AI integration for intelligent chat
 * - AI Agent modal with 8 specialized categories
 * - Admin-only AI button (visible only to 4simpleproblems@gmail.com)
 * - Chat interface with typing indicators and message history
 *
 * --- PREVIOUS FIXES / UPDATES ---
 * 1. USER REQUEST: Replaced Login/Signup links with a single "Authenticate" link pointing to /authentication.html.
 * 2. USER REQUEST: Updated logged-out button background to #010101 and icon color to #DADADA, using 'fa-solid fa-user'.
 * 3. Dashboard Icon Updated: Changed Dashboard icon from 'fa-chart-line' to 'fa-house-user'.
 * 4. Glide Button Style: Removed border-radius and adjusted gradients for full opacity at the edge.
 *
 * --- INSTRUCTIONS ---
 * 1. ACTION REQUIRED: Paste your own Firebase project configuration into the `FIREBASE_CONFIG` object below.
 * 2. Place this script in the root directory of your website.
 * 3. Add `<script src="/navigation.js" defer></script>` to the <head> of any HTML file where you want the navbar.
 * 4. Ensure your file paths for images and links are root-relative (e.g., "/images/logo.png", "/login.html").
 * 5. Enable Vertex AI in Firebase Console for AI features to work.
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
let auth;
let db;
let aiLogic; // For Vertex AI in Firebase

// AI Agent Configuration
const ADMIN_EMAIL = '4simpleproblems@gmail.com';
const AI_CATEGORIES = [
    { id: 'quick', name: 'Quick', description: 'Fast responses for simple queries' },
    { id: 'standard', name: 'Standard', description: 'Balanced speed and depth' },
    { id: 'deep', name: 'Deep Thinking', description: 'Thorough analysis and reasoning' },
    { id: 'creative', name: 'Creative', description: 'Imaginative and artistic responses' },
    { id: 'technical', name: 'Technical', description: 'Detailed technical explanations' },
    { id: 'analytical', name: 'Analytical', description: 'Data-driven insights' },
    { id: 'conversational', name: 'Conversational', description: 'Natural dialogue style' },
    { id: 'expert', name: 'Expert', description: 'Professional expertise level' }
];

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
     * Ensures both the style prefix (e.g., 'fa-solid') and the icon name prefix (e.g., 'fa-house-user') are present.
     * @param {string} iconName The icon class name from page-identification.json (e.g., 'fa-house-user' or just 'house-user').
     * @returns {string} The complete, correctly prefixed Font Awesome class string (e.g., 'fa-solid fa-house-user').
     */
    const getIconClass = (iconName) => {
        if (!iconName) return '';

        const nameParts = iconName.trim().split(/\s+/).filter(p => p.length > 0);
        let stylePrefix = 'fa-solid'; // Default style
        let baseName = '';
        const stylePrefixes = ['fa-solid', 'fa-regular', 'fa-light', 'fa-thin', 'fa-brands'];

        // 1. Identify and extract the style prefix (if present)
        const existingPrefix = nameParts.find(p => stylePrefixes.includes(p));
        if (existingPrefix) {
            stylePrefix = existingPrefix;
        }

        // 2. Identify and sanitize the icon name
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
            // Sequentially load Firebase modules (compat versions for simplicity).
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js");
            
            // Load Vertex AI in Firebase SDK
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-vertexai-preview.js");

            // Now that scripts are loaded, we can use the `firebase` global object
            initializeApp(pages);
        } catch (error) {
            console.error("Failed to load necessary SDKs:", error);
        }
    };

    // --- 2. INITIALIZE FIREBASE AND RENDER NAVBAR ---
    const initializeApp = (pages) => {
        // Initialize Firebase with the compat libraries
        const app = firebase.initializeApp(FIREBASE_CONFIG);
        auth = firebase.auth();
        db = firebase.firestore();
        
        // Initialize Vertex AI
        try {
            aiLogic = firebase.vertexAI();
            console.log("Vertex AI initialized successfully");
        } catch (error) {
            console.error("Failed to initialize Vertex AI:", error);
        }

        // --- 3. INJECT CSS STYLES ---
        const injectStyles = () => {
            const style = document.createElement('style');
            style.textContent = `
                /* Base Styles */
                body { padding-top: 4rem; }
                .auth-navbar { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; background: #000000; border-bottom: 1px solid rgb(31 41 55); height: 4rem; }
                .auth-navbar nav { max-width: 80rem; margin: auto; padding: 0 1rem; height: 100%; display: flex; align-items: center; justify-content: space-between; gap: 1rem; position: relative; }
                .initial-avatar { background: linear-gradient(135deg, #374151 0%, #111827 100%); font-family: 'Geist', sans-serif; text-transform: uppercase; display: flex; align-items: center; justify-content: center; color: white; }
                
                /* Auth Dropdown Menu Styles */
                .auth-menu-container { 
                    position: absolute; right: 0; top: 50px; width: 16rem; 
                    background: #000000;
                    border: 1px solid rgb(55 65 81); border-radius: 0.75rem; padding: 0.5rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -2px rgba(0,0,0,0.2); 
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
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                    padding-bottom: 5px;
                    margin-bottom: -5px;
                    scroll-behavior: smooth; 
                }
                .tab-scroll-container::-webkit-scrollbar { display: none; }

                /* Scroll Glide Buttons */
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

                /* Tab Base Styles */
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

                /* AI Agent Styles */
                #ai-agent-button {
                    position: fixed;
                    bottom: 2rem;
                    right: 2rem;
                    width: 3.5rem;
                    height: 3.5rem;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
                    border: 2px solid #6366f1;
                    color: white;
                    font-size: 1.5rem;
                    cursor: pointer;
                    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
                    transition: all 0.3s;
                    z-index: 999;
                    display: none;
                }
                #ai-agent-button:hover {
                    transform: scale(1.1);
                    box-shadow: 0 6px 16px rgba(79, 70, 229, 0.6);
                }

                /* AI Modal Overlay */
                .ai-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.8);
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                    z-index: 1001;
                    display: none;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    transition: opacity 0.3s;
                }
                .ai-modal-overlay.active {
                    display: flex;
                    opacity: 1;
                }

                /* AI Modal Container */
                .ai-modal {
                    background: #000000;
                    border: 1px solid #374151;
                    border-radius: 1rem;
                    width: 90%;
                    max-width: 50rem;
                    height: 80vh;
                    max-height: 50rem;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
                    transform: scale(0.9);
                    transition: transform 0.3s;
                }
                .ai-modal-overlay.active .ai-modal {
                    transform: scale(1);
                }

                /* AI Modal Header */
                .ai-modal-header {
                    padding: 1.5rem;
                    border-bottom: 1px solid #374151;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .ai-modal-title {
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: white;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }
                .ai-modal-close {
                    width: 2rem;
                    height: 2rem;
                    border-radius: 0.5rem;
                    border: none;
                    background: #1f2937;
                    color: #9ca3af;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .ai-modal-close:hover {
                    background: #374151;
                    color: white;
                }

                /* AI Category Selector */
                .ai-category-section {
                    padding: 1rem 1.5rem;
                    border-bottom: 1px solid #374151;
                    background: #0a0a0a;
                }
                .ai-category-label {
                    font-size: 0.875rem;
                    color: #9ca3af;
                    margin-bottom: 0.5rem;
                    display: block;
                }
                .ai-category-select {
                    width: 100%;
                    padding: 0.625rem 1rem;
                    background: #1f2937;
                    border: 1px solid #374151;
                    border-radius: 0.5rem;
                    color: white;
                    font-size: 0.875rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .ai-category-select:hover, .ai-category-select:focus {
                    border-color: #4f46e5;
                    outline: none;
                }

                /* AI Chat Container */
                .ai-chat-container {
                    flex: 1;
                    overflow-y: auto;
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                .ai-chat-container::-webkit-scrollbar {
                    width: 0.5rem;
                }
                .ai-chat-container::-webkit-scrollbar-track {
                    background: #0a0a0a;
                }
                .ai-chat-container::-webkit-scrollbar-thumb {
                    background: #374151;
                    border-radius: 0.25rem;
                }
                .ai-chat-container::-webkit-scrollbar-thumb:hover {
                    background: #4b5563;
                }

                /* Chat Messages */
                .ai-message {
                    display: flex;
                    gap: 0.75rem;
                    animation: slideIn 0.3s ease-out;
                }
                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .ai-message-avatar {
                    width: 2rem;
                    height: 2rem;
                    border-radius: 50%;
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.875rem;
                }
                .ai-message.user .ai-message-avatar {
                    background: linear-gradient(135deg, #374151 0%, #111827 100%);
                    color: white;
                }
                .ai-message.agent .ai-message-avatar {
                    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
                    color: white;
                }
                .ai-message-content {
                    flex: 1;
                    padding: 0.75rem 1rem;
                    border-radius: 0.75rem;
                    font-size: 0.875rem;
                    line-height: 1.6;
                }
                .ai-message.user .ai-message-content {
                    background: #1f2937;
                    color: white;
                }
                .ai-message.agent .ai-message-content {
                    background: #0f172a;
                    color: #e5e7eb;
                    border: 1px solid #374151;
                }
                .ai-message.agent.loading .ai-message-content {
                    display: flex;
                    gap: 0.25rem;
                    padding: 1rem;
                }
                .ai-typing-dot {
                    width: 0.5rem;
                    height: 0.5rem;
                    border-radius: 50%;
                    background: #6366f1;
                    animation: typing 1.4s infinite;
                }
                .ai-typing-dot:nth-child(2) {
                    animation-delay: 0.2s;
                }
                .ai-typing-dot:nth-child(3) {
                    animation-delay: 0.4s;
                }
                @keyframes typing {
                    0%, 60%, 100% {
                        transform: translateY(0);
                        opacity: 0.7;
                    }
                    30% {
                        transform: translateY(-10px);
                        opacity: 1;
                    }
                }

                /* AI Input Section */
                .ai-input-section {
                    padding: 1.5rem;
                    border-top: 1px solid #374151;
                    background: #0a0a0a;
                }
                .ai-input-wrapper {
                    display: flex;
                    gap: 0.75rem;
                }
                .ai-input {
                    flex: 1;
                    padding: 0.75rem 1rem;
                    background: #1f2937;
                    border: 1px solid #374151;
                    border-radius: 0.75rem;
                    color: white;
                    font-size: 0.875rem;
                    resize: none;
                    max-height: 8rem;
                    transition: all 0.2s;
                }
                .ai-input:focus {
                    outline: none;
                    border-color: #4f46e5;
                }
                .ai-send-button {
                    width: 2.5rem;
                    height: 2.5rem;
                    border-radius: 0.75rem;
                    border: none;
                    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
                    color: white;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .ai-send-button:hover:not(:disabled) {
                    transform: scale(1.05);
                    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
                }
                .ai-send-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `;
            document.head.appendChild(style);
        };

        // --- Function to robustly determine active tab ---
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
        
        // --- Function to control visibility of scroll glide buttons ---
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
        const renderNavbar = (user, userData, pages) => {
            const container = document.getElementById('navbar-container');
            if (!container) return;

            const logoPath = "/images/logo.png";
            
            // Check if user is admin for AI button visibility
            const isAdmin = user && user.email === ADMIN_EMAIL;

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
            
            // Add AI Agent Button if admin
            if (isAdmin) {
                let aiButton = document.getElementById('ai-agent-button');
                if (!aiButton) {
                    aiButton = document.createElement('button');
                    aiButton.id = 'ai-agent-button';
                    aiButton.innerHTML = '<i class="fa-solid fa-robot"></i>';
                    aiButton.title = '4SP AI Agent';
                    document.body.appendChild(aiButton);
                }
                aiButton.style.display = 'flex';
            } else {
                const existingButton = document.getElementById('ai-agent-button');
                if (existingButton) existingButton.style.display = 'none';
            }
            
            // Add AI Modal if admin
            if (isAdmin && !document.getElementById('ai-modal-overlay')) {
                renderAIModal();
            }

            // --- 5. SETUP EVENT LISTENERS ---
            setupEventListeners(user);

            // Auto-scroll to the active tab if one is found
            const activeTab = document.querySelector('.nav-tab.active');
            const tabContainer = document.querySelector('.tab-scroll-container');
            if (activeTab && tabContainer) {
                tabContainer.scrollLeft = activeTab.offsetLeft - (tabContainer.offsetWidth / 2) + (activeTab.offsetWidth / 2);
            }
            
            updateScrollGilders();
        };

        // --- NEW: Render AI Agent Modal ---
        const renderAIModal = () => {
            const modalHTML = `
                <div id="ai-modal-overlay" class="ai-modal-overlay">
                    <div class="ai-modal">
                        <div class="ai-modal-header">
                            <div class="ai-modal-title">
                                <i class="fa-solid fa-robot"></i>
                                <span>4SP Agent</span>
                            </div>
                            <button id="ai-modal-close" class="ai-modal-close">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        
                        <div class="ai-category-section">
                            <label class="ai-category-label">Agent Category</label>
                            <select id="ai-category-select" class="ai-category-select">
                                ${AI_CATEGORIES.map(cat => `
                                    <option value="${cat.id}">${cat.name} - ${cat.description}</option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <div id="ai-chat-container" class="ai-chat-container">
                            <div class="ai-message agent">
                                <div class="ai-message-avatar">
                                    <i class="fa-solid fa-robot"></i>
                                </div>
                                <div class="ai-message-content">
                                    Hello! I'm the 4SP Agent. How can I assist you today?
                                </div>
                            </div>
                        </div>
                        
                        <div class="ai-input-section">
                            <div class="ai-input-wrapper">
                                <textarea 
                                    id="ai-input" 
                                    class="ai-input" 
                                    placeholder="Type your message..."
                                    rows="1"
                                ></textarea>
                                <button id="ai-send-button" class="ai-send-button">
                                    <i class="fa-solid fa-paper-plane"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            setupAIModalListeners();
        };

        // --- NEW: Setup AI Modal Event Listeners ---
        const setupAIModalListeners = () => {
            const aiButton = document.getElementById('ai-agent-button');
            const modal = document.getElementById('ai-modal-overlay');
            const closeButton = document.getElementById('ai-modal-close');
            const sendButton = document.getElementById('ai-send-button');
            const input = document.getElementById('ai-input');

            if (aiButton && modal) {
                aiButton.addEventListener('click', () => {
                    modal.classList.add('active');
                    input.focus();
                });
            }

            if (closeButton && modal) {
                closeButton.addEventListener('click', () => {
                    modal.classList.remove('active');
                });
            }

            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        modal.classList.remove('active');
                    }
                });
            }

            if (input) {
                input.addEventListener('input', () => {
                    input.style.height = 'auto';
                    input.style.height = input.scrollHeight + 'px';
                });

                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                    }
                });
            }

            if (sendButton) {
                sendButton.addEventListener('click', sendMessage);
            }
        };

        // --- NEW: Send Message to AI ---
        const sendMessage = async () => {
            const input = document.getElementById('ai-input');
            const sendButton = document.getElementById('ai-send-button');
            const chatContainer = document.getElementById('ai-chat-container');
            const categorySelect = document.getElementById('ai-category-select');

            if (!input || !chatContainer) return;

            const message = input.value.trim();
            if (!message) return;

            const selectedCategory = AI_CATEGORIES.find(cat => cat.id === categorySelect.value);

            addMessage('user', message);
            
            input.value = '';
            input.style.height = 'auto';
            
            sendButton.disabled = true;

            const loadingId = addLoadingMessage();

            try {
                const model = aiLogic.getGenerativeModel({ 
                    model: "gemini-1.5-flash",
                    systemInstruction: `You are the 4SP Agent, an AI assistant specialized in ${selectedCategory.name} mode. ${selectedCategory.description}. Provide helpful, accurate, and contextually appropriate responses.`
                });

                const result = await model.generateContent(message);
                const response = await result.response;
                const text = response.text();

                removeLoadingMessage(loadingId);
                addMessage('agent', text);
            } catch (error) {
                console.error("AI Error:", error);
                removeLoadingMessage(loadingId);
                addMessage('agent', 'Sorry, I encountered an error processing your request. Please try again.');
            } finally {
                sendButton.disabled = false;
                input.focus();
            }
        };

        // --- NEW: Add Message to Chat ---
        const addMessage = (type, content) => {
            const chatContainer = document.getElementById('ai-chat-container');
            if (!chatContainer) return;

            const messageDiv = document.createElement('div');
            messageDiv.className = `ai-message ${type}`;
            
            const avatar = type === 'user' 
                ? '<div class="ai-message-avatar initial-avatar">U</div>'
                : '<div class="ai-message-avatar"><i class="fa-solid fa-robot"></i></div>';
            
            messageDiv.innerHTML = `
                ${avatar}
                <div class="ai-message-content">${escapeHtml(content)}</div>
            `;
            
            chatContainer.appendChild(messageDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        };

        // --- NEW: Add Loading Message ---
        const addLoadingMessage = () => {
            const chatContainer = document.getElementById('ai-chat-container');
            if (!chatContainer) return null;

            const loadingId = 'loading-' + Date.now();
            const loadingDiv = document.createElement('div');
            loadingDiv.id = loadingId;
            loadingDiv.className = 'ai-message agent loading';
            loadingDiv.innerHTML = `
                <div class="ai-message-avatar">
                    <i class="fa-solid fa-robot"></i>
                </div>
                <div class="ai-message-content">
                    <div class="ai-typing-dot"></div>
                    <div class="ai-typing-dot"></div>
                    <div class="ai-typing-dot"></div>
                </div>
            `;
            
            chatContainer.appendChild(loadingDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
            
            return loadingId;
        };

        // --- NEW: Remove Loading Message ---
        const removeLoadingMessage = (loadingId) => {
            const loadingMsg = document.getElementById(loadingId);
            if (loadingMsg) {
                loadingMsg.remove();
            }
        };

        // --- NEW: Escape HTML to prevent XSS ---
        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
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
            }).join('');

            // --- Auth Views ---
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
