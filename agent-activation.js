/**
 * Humanity Agent (Humanity {Gen 0})
 *
 * TOTAL EXACT UPGRADE: Refactored from agent-activation.js to implement the Humanity Agent specification.
 * STATUS: Settings Menu, Settings Button, and all associated features have been entirely removed.
 * ARCHITECTURE: All new features integrated strictly within idiomatic JavaScript, maintaining existing naming and structural flow.
 *
 * NEW FEATURES:
 * 1. Multi-Model Dynamic Switching (Gemini 2.5 Pro usage strictly enforced by AUTHORIZED_PRO_USER).
 * 2. Real-Time Web Search Integration (Google Custom Search JSON API).
 * 3. Advanced Graphing and KaTeX Rendering (Existing custom engine enhanced for advanced math).
 * 4. Enhanced UI/UX for speed, accessibility (ARIA), and modern hotkey support.
 * 5. Knowledge Graph/Fact-Based Answers via search integration.
 * 6. Source Citation for all search-based replies (Citations format: [Source: Title, URL]).
 * 7. Context Memory across sessions via localStorage (for chat history).
 * 8. Robust error handling and code hygiene applied.
 */
(function() {
    // --- CONFIGURATION ---
    // NOTE: This API Key is used for both the Gemini API and the Google Custom Search API.
    const API_KEY = 'AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro'; 
    const BASE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/`; 
    // Custom Search JSON API Configuration
    const CUSTOM_SEARCH_ID = 'd0d0c075d757140ef'; 
    const CUSTOM_SEARCH_URL = `https://www.googleapis.com/customsearch/v1?cx=${CUSTOM_SEARCH_ID}&key=${API_KEY}&q=`;
    
    // Core Limits and Constants
    const AUTHORIZED_PRO_USER = '4simpleproblems@gmail.com'; 
    const MAX_INPUT_HEIGHT = 180;
    const CHAR_LIMIT = 10000;
    const MAX_ATTACHMENTS_PER_MESSAGE = 10;
    const DEFAULT_NICKNAME = 'Human'; // New default persona for Humanity Agent
    const AGENT_NAME = 'Humanity Agent';

    // --- ICONS (for event handlers) ---
    const copyIconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="copy-icon"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    const checkIconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="check-icon"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    const attachmentIconSVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.2a2 2 0 0 1-2.83-2.83l8.49-8.49"></path></svg>`;
    const searchIconSVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;

    // --- STATE MANAGEMENT ---
    let isAIActive = false;
    let isRequestPending = false;
    let currentAIRequestController = null;
    let chatHistory = [];
    let attachedFiles = [];
    // Retain a minimalist userSettings object for dynamic persona generation, using defaults
    let userSettings = {
        nickname: DEFAULT_NICKNAME,
        favoriteColor: '#1a73e8', // Default to a strong Google Blue
        gender: 'Other',
        age: 0,
        email: localStorage.getItem('ai-user-email') || ''
    };

    // --- UTILITIES ---

    // Simple debounce utility for performance
    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    };

    /**
     * Loads settings and conversation history from localStorage.
     */
    function loadAgentState() {
        try {
            // Load History
            const storedHistory = localStorage.getItem('humanity-agent-history');
            if (storedHistory) {
                chatHistory = JSON.parse(storedHistory);
            }
            // Load minimalist settings (only email is actively saved/checked)
            const storedSettings = localStorage.getItem('ai-user-settings');
            if (storedSettings) {
                const loaded = JSON.parse(storedSettings);
                userSettings = { ...userSettings, ...loaded };
                userSettings.age = parseInt(userSettings.age) || 0;
            }
            userSettings.email = localStorage.getItem('ai-user-email') || '';

        } catch (e) {
            console.error("Error loading agent state:", e);
        }
    }
    
    /**
     * Saves the current conversation history to localStorage.
     */
    function saveChatHistory() {
        try {
            // Only store the last 50 messages to prevent hitting storage limits
            const historyToSave = chatHistory.slice(-50); 
            localStorage.setItem('humanity-agent-history', JSON.stringify(historyToSave));
            // Save the email only (the only setting needed for Pro auth)
            localStorage.setItem('ai-user-email', userSettings.email); 
        } catch (e) {
            console.error("Error saving chat history:", e);
        }
    }

    // Initialize load on script run
    loadAgentState();

    function getUserLocationForContext() {
        // Placeholder for real location fetch
        let location = localStorage.getItem('ai-user-location');
        if (!location) {
            location = 'United States'; 
            localStorage.setItem('ai-user-location', location);
        }
        return location;
    }
    
    function escapeHTML(str) {
        if (typeof str !== 'string') return str;
        return str.replace(/[&<>"']/g, function(m) {
            return ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            })[m];
        });
    }

    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
    
    function formatCharCount(count) {
        if (count >= 1000) {
            return (count / 1000).toFixed(count % 1000 === 0 ? 0 : 1) + 'K';
        }
        return count.toString();
    }
    
    function formatCharLimit(limit) {
        return (limit / 1000).toFixed(0) + 'K';
    }

    // --- UI/STYLE INJECTION (kept for core architectural integrity) ---

    function injectStyles() {
        // Remove old styles if they exist
        ['ai-dynamic-styles', 'ai-google-fonts', 'ai-katex-styles', 'ai-fontawesome'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });

        // Inject FontAwesome for icons (e.g., the attachment button)
        if (!document.querySelector('link[href*="font-awesome"]')) {
            const faLink = document.createElement('link');
            faLink.id = 'ai-fontawesome';
            faLink.rel = 'stylesheet';
            faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css';
            document.head.appendChild(faLink);
        }
        
        // Inject Google Fonts
        const fontLink = document.createElement('link');
        fontLink.id = 'ai-google-fonts';
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Merriweather:wght@700&family=Lora:wght@400;700&display=swap';
        document.head.appendChild(fontLink);
        
        // Inject KaTeX CSS
        const katexLink = document.createElement('link');
        katexLink.id = 'ai-katex-styles';
        katexLink.rel = 'stylesheet';
        katexLink.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.css';
        document.head.appendChild(katexLink);

        const style = document.createElement('style');
        style.id = 'ai-dynamic-styles';
        style.textContent = `
            :root {
                --ai-primary-bg: #1e1e1e;
                --ai-secondary-bg: #2d2d2d;
                --ai-border-color: #444;
                --ai-text-color: #fff;
                --ai-dim-text: #ccc;
                --ai-accent-color: #1a73e8; /* Google Blue */
                --ai-code-bg: #3c3c3c;
                --ai-success-color: #34a853;
                --ai-error-color: #ea4335;
                --ai-user-color: #555555;
            }

            /* Main Container */
            #ai-container {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 380px;
                max-width: 90vw;
                height: 60px;
                background-color: var(--ai-primary-bg);
                border: 1px solid var(--ai-border-color);
                border-radius: 12px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
                display: flex;
                flex-direction: column;
                z-index: 99999;
                transition: all 0.5s cubic-bezier(0.25, 0.8, 0.25, 1);
                overflow: hidden;
            }
            #ai-container.active {
                height: 85vh;
                max-height: 700px;
            }
            #ai-container.deactivating {
                opacity: 0;
                transform: translateY(20px) scale(0.95);
            }

            /* Branding and Title Bar */
            #ai-brand-title {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 60px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: 'Merriweather', serif;
                font-size: 20px;
                color: var(--ai-text-color);
                cursor: pointer;
                background-color: var(--ai-primary-bg);
                padding: 0 10px;
                box-sizing: border-box;
                transition: opacity 0.3s, transform 0.5s;
                transform-origin: top center;
            }
            #ai-container.active #ai-brand-title {
                opacity: 0;
                pointer-events: none;
                height: 0;
            }
            #ai-brand-title span {
                opacity: 0.8;
                transition: all 0.3s ease-in-out;
            }
            #ai-brand-title:hover span {
                opacity: 1;
                text-shadow: 0 0 5px var(--ai-accent-color);
            }

            #ai-persistent-title {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 45px;
                display: flex;
                align-items: center;
                padding: 0 15px;
                font-family: 'Lora', serif;
                font-size: 16px;
                font-weight: bold;
                color: var(--ai-text-color);
                background-color: var(--ai-secondary-bg);
                border-bottom: 1px solid var(--ai-border-color);
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s 0.2s;
            }
            #ai-persistent-title::before {
                content: '🤖 ';
                margin-right: 5px;
            }
            #ai-container.active #ai-persistent-title {
                opacity: 1;
                pointer-events: all;
            }

            #ai-close-button {
                position: absolute;
                top: 0;
                right: 0;
                width: 45px;
                height: 45px;
                line-height: 45px;
                text-align: center;
                font-size: 24px;
                cursor: pointer;
                color: var(--ai-dim-text);
                transition: color 0.2s;
                z-index: 1000;
            }
            #ai-close-button:hover {
                color: var(--ai-text-color);
            }

            /* Welcome Message / Initial State */
            #ai-welcome-message {
                flex-grow: 1;
                padding: 60px 20px 20px 20px;
                text-align: center;
                color: var(--ai-dim-text);
                opacity: 1;
                pointer-events: all;
                transition: opacity 0.3s;
                overflow-y: auto;
            }
            #ai-container.active #ai-welcome-message.hidden {
                 opacity: 0;
                 pointer-events: none;
                 padding: 0;
            }
            #ai-welcome-message h2 {
                color: var(--ai-text-color);
                font-family: 'Merriweather', serif;
                margin-top: 0;
                font-size: 1.5em;
            }
            .shortcut-tip {
                font-size: 0.8em;
                margin-top: 15px;
                font-style: italic;
            }

            /* Response Area */
            #ai-response-container {
                flex-grow: 1;
                overflow-y: auto;
                padding: 50px 10px 10px 10px;
                scrollbar-width: thin;
                scrollbar-color: var(--ai-accent-color) var(--ai-secondary-bg);
                scroll-behavior: smooth;
                transition: padding 0.5s;
            }
            #ai-container:not(.chat-active) #ai-response-container {
                display: none;
            }
            #ai-container.chat-active #ai-response-container {
                display: block;
                padding-top: 55px; /* Adjust for persistent title */
            }
            
            /* Message Bubbles */
            .ai-message-bubble {
                padding: 12px 15px;
                margin: 10px 0;
                border-radius: 18px;
                max-width: 85%;
                word-wrap: break-word;
                font-family: 'Lora', serif;
                line-height: 1.5;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
                position: relative;
                opacity: 0;
                animation: message-pop-in 0.3s forwards;
            }
            @keyframes message-pop-in { 
                to { opacity: 1; }
            }

            .user-message {
                background-color: var(--ai-user-color);
                color: var(--ai-text-color);
                margin-left: auto;
                border-bottom-right-radius: 4px;
                text-align: left;
            }

            .gemini-response {
                background-color: var(--ai-secondary-bg);
                color: var(--ai-text-color);
                margin-right: auto;
                border-bottom-left-radius: 4px;
                border: 1px solid var(--ai-border-color);
                transition: all 0.3s;
                text-align: left;
            }
            .gemini-response.loading {
                min-height: 40px;
            }
            
            /* Common Message Formatting */
            .ai-message-bubble p { margin: 0; padding: 0; text-align: left; }
            .ai-message-bubble ul, .ai-message-bubble ol { margin: 10px 0; padding-left: 20px; text-align: left; list-style-position: outside; }
            .ai-message-bubble li { margin-bottom: 5px; }
            .ai-message-bubble h1, .ai-message-bubble h2, .ai-message-bubble h3 { color: var(--ai-accent-color); margin: 10px 0 5px 0; padding-top: 5px; border-bottom: 1px solid var(--ai-border-color); font-family: 'Merriweather', serif; font-size: 1.1em;}
            .ai-message-bubble strong { color: var(--ai-accent-color); }
            
            /* Code Blocks */
            .gemini-response pre {
                background-color: var(--ai-code-bg);
                padding: 10px;
                border-radius: 6px;
                overflow-x: auto;
                position: relative;
                margin: 10px 0;
                border: 1px solid #555;
            }
            .gemini-response code {
                font-family: monospace;
                font-size: 0.85em;
                white-space: pre-wrap;
                word-break: break-all;
                display: block;
                color: #e8eaed;
            }
            .gemini-response pre code {
                padding: 0;
                background-color: transparent;
            }
            .gemini-response :not(pre) > code {
                background-color: #383838;
                padding: 2px 4px;
                border-radius: 4px;
                font-weight: bold;
                color: #a1c9f7;
            }
            .copy-code-btn {
                position: absolute;
                top: 5px;
                right: 5px;
                background-color: var(--ai-primary-bg);
                color: var(--ai-dim-text);
                border: none;
                border-radius: 4px;
                padding: 5px 8px;
                cursor: pointer;
                opacity: 0.8;
                transition: opacity 0.2s, background-color 0.2s;
                font-size: 12px;
                display: flex;
                align-items: center;
                gap: 5px;
            }
            .copy-code-btn:hover {
                opacity: 1;
                background-color: #555;
            }
            
            /* KaTeX */
            .katex-display {
                margin: 10px 0 !important;
                padding: 5px 0;
                background-color: #272727;
                border-radius: 4px;
                overflow-x: auto;
            }
            .katex {
                font-size: 1.1em;
                color: #a1c9f7 !important;
            }

            /* Custom Graphing */
            .custom-graph-placeholder {
                background-color: #222;
                border: 1px solid #444;
                border-radius: 8px;
                margin: 15px 0;
                padding: 10px;
                width: 100%;
                min-height: 250px;
                position: relative;
                overflow: hidden;
            }
            .custom-graph-placeholder canvas {
                display: block;
                width: 100%;
                height: 100%;
            }

            /* Compose Area */
            #ai-compose-area {
                padding: 10px;
                background-color: var(--ai-secondary-bg);
                border-top: 1px solid var(--ai-border-color);
            }
            
            /* Input Wrapper */
            #ai-input-wrapper {
                display: flex;
                flex-direction: column;
                border: 1px solid var(--ai-border-color);
                border-radius: 8px;
                background-color: var(--ai-primary-bg);
                transition: all 0.3s;
                position: relative;
                min-height: 40px;
            }
            #ai-input-wrapper.waiting {
                border-color: var(--ai-accent-color);
                box-shadow: 0 0 5px var(--ai-accent-color);
            }
            #ai-input-wrapper.has-attachments {
                border-radius: 8px 8px 0 0;
            }

            /* Content Editable Input */
            #ai-input {
                flex-grow: 1;
                padding: 10px 45px 10px 10px;
                min-height: 20px;
                max-height: ${MAX_INPUT_HEIGHT}px;
                overflow-y: auto;
                color: var(--ai-text-color);
                line-height: 1.4;
                font-family: 'Lora', serif;
                white-space: pre-wrap;
                word-wrap: break-word;
                outline: none;
                cursor: text;
                order: 2; /* Put input below attachments */
            }
            #ai-input:empty:before {
                content: "Ask Humanity Agent a question (Ctrl + \\ to close)";
                color: var(--ai-dim-text);
                opacity: 0.6;
                pointer-events: none;
            }
            
            /* Buttons */
            #ai-attachment-button {
                position: absolute;
                bottom: 8px;
                right: 10px;
                background: none;
                border: none;
                color: var(--ai-dim-text);
                cursor: pointer;
                padding: 4px;
                transition: color 0.2s;
                order: 3;
            }
            #ai-attachment-button:hover {
                color: var(--ai-accent-color);
            }

            /* Character Counter */
            #ai-char-counter {
                position: absolute;
                bottom: 5px;
                left: 10px;
                font-size: 0.75em;
                color: var(--ai-dim-text);
                opacity: 0.7;
                transition: color 0.2s;
            }
            #ai-char-counter.limit-exceeded {
                color: var(--ai-error-color);
                font-weight: bold;
            }
            #ai-input-wrapper.waiting ~ #ai-char-counter {
                 visibility: hidden;
            }

            /* Loading Spinner */
            .ai-loader {
                width: 15px;
                height: 15px;
                border: 3px solid #ccc;
                border-bottom-color: transparent;
                border-radius: 50%;
                display: inline-block;
                box-sizing: border-box;
                animation: spin 1s linear infinite;
                margin-left: 10px;
            }
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
            
            /* Error Message */
            .ai-error {
                color: var(--ai-error-color);
                padding: 5px 0;
                font-weight: bold;
            }
            .sent-attachments {
                font-size: 0.8em;
                color: var(--ai-dim-text);
                margin-top: 5px;
                padding-top: 5px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
            }

            /* Attachment Preview */
            #ai-attachment-preview {
                display: flex;
                flex-wrap: wrap;
                gap: 5px;
                padding: 5px;
                background-color: var(--ai-secondary-bg);
                border-bottom: 1px solid var(--ai-border-color);
                border-radius: 8px 8px 0 0;
                overflow-x: auto;
                order: 1; /* Place above input */
            }
            .attachment-card {
                position: relative;
                display: flex;
                align-items: center;
                gap: 5px;
                padding: 4px 8px;
                background-color: var(--ai-code-bg);
                border-radius: 6px;
                font-size: 0.8em;
                color: var(--ai-dim-text);
                cursor: pointer;
                max-width: 100px;
                overflow: hidden;
            }
            .attachment-card img {
                width: 30px;
                height: 30px;
                object-fit: cover;
                border-radius: 4px;
            }
            .file-icon {
                font-size: 1.2em;
            }
            .file-name {
                 overflow: hidden;
                 white-space: nowrap;
                 position: relative;
                 flex-grow: 1;
            }
            .file-name span {
                 display: block;
            }
            .file-type-badge {
                padding: 1px 4px;
                background-color: var(--ai-accent-color);
                color: var(--ai-text-color);
                border-radius: 4px;
                font-size: 0.7em;
                font-weight: bold;
                margin-left: auto;
            }
            .remove-attachment-btn {
                background: none;
                border: none;
                color: var(--ai-text-color);
                cursor: pointer;
                margin-left: 5px;
                font-size: 1em;
                line-height: 1;
                padding: 0;
            }
            
            /* Search Citations */
            .ai-search-citation {
                margin-top: 15px;
                padding-top: 10px;
                border-top: 1px solid var(--ai-border-color);
                font-size: 0.85em;
                color: var(--ai-dim-text);
            }
            .ai-search-citation a {
                color: var(--ai-accent-color);
                text-decoration: none;
            }
            .ai-search-citation a:hover {
                text-decoration: underline;
            }
        `;
        document.head.appendChild(style);
    }
    
    // --- GRAPHING AND RENDERING LOGIC (Retained and Polished) ---

    /**
     * Renders mathematical formulas using KaTeX.
     * @param {HTMLElement} container The parent element to search for formulas.
     */
    function renderKaTeX(container) {
        if (typeof katex === 'undefined') {
            console.warn("KaTeX not loaded, skipping render.");
            return;
        }
        container.querySelectorAll('.latex-render').forEach(element => {
            const mathText = element.dataset.tex;
            const displayMode = element.dataset.displayMode === 'true';
            try {
                katex.render(mathText, element, {
                    throwOnError: false,
                    displayMode: displayMode,
                    // Use standard macros
                    macros: {
                        "\\le": "\\leqslant",
                        "\\ge": "\\geqslant",
                        "\\f": "f(#1)"
                    }
                });
            } catch (e) {
                console.error("KaTeX rendering error:", e);
                element.textContent = `[KaTeX Error] ${e.message}`;
            }
        });
    }

    /**
     * Renders interactive graphs using a custom canvas engine.
     * @param {HTMLElement} container The parent element to search for graph placeholders.
     */
    function renderGraphs(container) {
        container.querySelectorAll('.custom-graph-placeholder').forEach(placeholder => {
            try {
                const graphData = JSON.parse(placeholder.dataset.graphData);
                // Ensure a canvas exists (create it if not)
                let canvas = placeholder.querySelector('canvas');
                if (!canvas) {
                    canvas = document.createElement('canvas');
                    placeholder.appendChild(canvas);
                }
                
                const draw = () => drawCustomGraph(canvas, graphData, placeholder.clientWidth, placeholder.clientHeight);
                
                // Use ResizeObserver for performance and responsiveness
                const observer = new ResizeObserver(debounce(draw, 100));
                observer.observe(placeholder);
                draw(); // Initial draw
            } catch (e) {
                console.error("Custom graph rendering error:", e);
                placeholder.textContent = `[Graph Error] Invalid graph data provided: ${e.message}`;
            }
        });
    }

    /**
     * Custom graphing function using HTML Canvas.
     */
    function drawCustomGraph(canvas, graphData, containerWidth, containerHeight) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        
        // Set canvas size for high-DPI
        canvas.width = containerWidth * dpr;
        canvas.height = containerHeight * dpr;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, containerWidth, containerHeight);

        const layout = graphData.layout || {};
        const data = graphData.data || [];
        
        const padding = { top: 30, right: 20, bottom: 40, left: 50 };
        const graphWidth = containerWidth - padding.left - padding.right;
        const graphHeight = containerHeight - padding.top - padding.bottom;

        // Determine data range (Advanced: support functions by pre-calculating a range of points)
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        
        // Process traces: convert functions to points if needed
        const processedData = data.map(trace => {
            if (trace.type === 'function' && trace.fn) {
                const numPoints = 200;
                const xStart = trace.range?.[0] || -10;
                const xEnd = trace.range?.[1] || 10;
                trace.x = [];
                trace.y = [];
                
                // Safety check and function evaluation
                try {
                    // Create a function from the string expression
                    // eslint-disable-next-line no-new-func
                    const fn = new Function('x', `with(Math){ return ${trace.fn}; }`);
                    const step = (xEnd - xStart) / numPoints;
                    
                    for (let i = 0; i <= numPoints; i++) {
                        const x = xStart + i * step;
                        let y = fn(x);
                        
                        // Handle discontinuities or non-finite values (like log(0) or division by zero)
                        if (isNaN(y) || !isFinite(y)) continue;

                        trace.x.push(x);
                        trace.y.push(y);
                    }
                } catch (e) {
                    console.error("Function evaluation error:", e);
                }
            }
            return trace;
        }).filter(trace => trace.x?.length > 0); // Filter out traces with no points

        // Determine min/max across all points (including points generated from functions)
        processedData.forEach(trace => {
            trace.x.forEach(val => { minX = Math.min(minX, val); maxX = Math.max(maxX, val); });
            trace.y.forEach(val => { minY = Math.min(minY, val); maxY = Math.max(maxY, val); });
        });
        
        if (minX === Infinity) return; // No data to draw

        // Add buffer or snap to zero if range is small/contains zero
        const xRange = maxX - minX || 1;
        const yRange = maxY - minY || 1;
        const xBuffer = xRange * 0.1;
        const yBuffer = yRange * 0.1;
        
        minX = xRange === 0 ? minX - 1 : minX - xBuffer;
        maxX = xRange === 0 ? maxX + 1 : maxX + xBuffer;
        minY = yRange === 0 ? minY - 1 : minY - yBuffer;
        maxY = yRange === 0 ? maxY + 1 : maxY + yBuffer;

        const mapX = x => padding.left + ((x - minX) / (maxX - minX)) * graphWidth;
        const mapY = y => padding.top + graphHeight - ((y - minY) / (maxY - minY)) * graphHeight;
        
        const axisColor = '#666';
        const gridColor = 'rgba(255, 255, 255, 0.1)';
        const labelColor = '#ccc';
        
        // --- Draw Grid and Axes ---
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 0.5;
        const xTickCount = Math.max(2, Math.floor(graphWidth / 80));
        const yTickCount = Math.max(2, Math.floor(graphHeight / 50));

        // Draw grid lines
        for (let i = 0; i <= xTickCount; i++) {
            const x = padding.left + (i / xTickCount) * graphWidth;
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, padding.top + graphHeight);
            ctx.stroke();
        }
        for (let i = 0; i <= yTickCount; i++) {
            const y = padding.top + (i / yTickCount) * graphHeight;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + graphWidth, y);
            ctx.stroke();
        }

        // Draw X-Axis (if it falls within the graph area)
        const yAxisPos = mapY(0);
        if (yAxisPos >= padding.top && yAxisPos <= padding.top + graphHeight) {
            ctx.strokeStyle = axisColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(padding.left, yAxisPos);
            ctx.lineTo(padding.left + graphWidth, yAxisPos);
            ctx.stroke();
        }
        
        // Draw Y-Axis (if it falls within the graph area)
        const xAxisPos = mapX(0);
        if (xAxisPos >= padding.left && xAxisPos <= padding.left + graphWidth) {
            ctx.strokeStyle = axisColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(xAxisPos, padding.top);
            ctx.lineTo(xAxisPos, padding.top + graphHeight);
            ctx.stroke();
        }

        // --- Draw Labels and Ticks ---
        ctx.fillStyle = labelColor;
        ctx.font = '10px Lora';
        ctx.textAlign = 'center';
        
        // X-Axis Labels
        for (let i = 0; i <= xTickCount; i++) {
            const val = minX + (i / xTickCount) * (maxX - minX);
            const x = mapX(val);
            if (x > padding.left - 10 && x < containerWidth - padding.right + 10) {
                 const yText = yAxisPos + 15;
                 ctx.fillText(val.toFixed(2), x, yText > containerHeight ? containerHeight - 5 : yText);
            }
        }
        
        // Y-Axis Labels
        ctx.textAlign = 'right';
        for (let i = 0; i <= yTickCount; i++) {
            const val = minY + (i / yTickCount) * (maxY - minY);
            const y = mapY(val);
            if (y > padding.top + 5 && y < containerHeight - padding.bottom - 5) {
                const xText = xAxisPos > containerWidth - padding.right ? padding.left - 5 : xAxisPos - 5;
                ctx.fillText(val.toFixed(2), xText, y + 3);
            }
        }
        
        // Axis Titles
        ctx.font = 'bold 12px Lora';
        ctx.textAlign = 'center';
        if(layout.xaxis?.title) ctx.fillText(layout.xaxis.title, padding.left + graphWidth / 2, containerHeight - 5);
        ctx.save();
        ctx.rotate(-Math.PI / 2);
        if(layout.yaxis?.title) ctx.fillText(layout.yaxis.title, -(padding.top + graphHeight / 2), 15);
        ctx.restore();

        // --- Draw Data Lines ---
        processedData.forEach(trace => {
            const color = trace.line?.color || userSettings.favoriteColor || '#1a73e8';
            ctx.strokeStyle = color;
            ctx.lineWidth = trace.line?.width || 2;
            
            ctx.beginPath();
            ctx.moveTo(mapX(trace.x[0]), mapY(trace.y[0]));
            
            for (let i = 1; i < trace.x.length; i++) {
                // Advanced line segment draw to handle discontinuities (jumps)
                const prevY = mapY(trace.y[i-1]);
                const currentY = mapY(trace.y[i]);
                const diff = Math.abs(currentY - prevY);
                const maxDiff = graphHeight * 0.5; // If jump is too large, treat it as a discontinuity
                
                if (diff < maxDiff) {
                    ctx.lineTo(mapX(trace.x[i]), currentY);
                } else {
                    ctx.moveTo(mapX(trace.x[i]), currentY);
                }
            }
            ctx.stroke();

            // Draw markers
            if (trace.mode && trace.mode.includes('markers')) {
                ctx.fillStyle = color;
                for (let i = 0; i < trace.x.length; i++) {
                    ctx.beginPath();
                    ctx.arc(mapX(trace.x[i]), mapY(trace.y[i]), 3, 0, 2 * Math.PI);
                    ctx.fill();
                }
            }
        });
        
        // Draw Title
        if (layout.title) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 16px Merriweather';
            ctx.textAlign = 'center';
            ctx.fillText(layout.title, containerWidth / 2, padding.top / 2 + 5);
        }
    }
    
    /**
     * Parses the AI's markdown response to apply HTML for rendering.
     * Includes handling for code blocks and custom blocks (e.g., graph, citation).
     */
    function parseGeminiResponse(markdown) {
        // --- Custom Block Parsing ---
        // 1. Graph Block
        markdown = markdown.replace(/```json\s*<graph>(.*?)<\/graph>\s*```/gs, (match, json) => {
            // Escape single quotes for use in the data-attribute, ensure JSON is valid
            const safeJson = escapeHTML(json.trim());
            return `<div class="custom-graph-placeholder" data-graph-data='${safeJson}' style="width: 100%; height: 300px;"><canvas></canvas></div>`;
        });
        
        // 2. KaTeX Block (Display Mode)
        markdown = markdown.replace(/\$\$(.*?)\$\$/gs, (match, tex) => {
            const safeTex = escapeHTML(tex.trim());
            return `<div class="latex-render" data-tex="${safeTex}" data-display-mode="true"></div>`;
        });

        // 3. Search Citation Block (New)
        // Matches the format: [Source: Title, URL]
        const citationPattern = /\[Source: ([^,]+), (https?:\/\/[^\]]+)\]/g;
        let citationsHtml = '';
        const citationList = new Set();
        
        // Extract citations first
        markdown = markdown.replace(citationPattern, (match, title, url) => {
            const safeTitle = escapeHTML(title.trim());
            const safeUrl = escapeHTML(url.trim());
            const key = `${safeTitle}|${safeUrl}`;
            citationList.add(key);
            // Replace in-text citation with a numbered reference
            return `[${Array.from(citationList).findIndex(k => k === key) + 1}]`;
        });

        // Build the citation list HTML
        if (citationList.size > 0) {
            citationsHtml = '<div class="ai-search-citation"><strong>Sources:</strong><ol>';
            citationList.forEach((key, index) => {
                const [title, url] = key.split('|');
                citationsHtml += `<li>[${index + 1}] <a href="${url}" target="_blank" rel="noopener noreferrer">${title}</a></li>`;
            });
            citationsHtml += '</ol></div>';
        }

        // 4. Code Block (Multi-line)
        markdown = markdown.replace(/```(.*?)\n(.*?)```/gs, (match, lang, code) => {
            const language = lang.trim() || 'plaintext';
            const safeCode = escapeHTML(code.trim());
            const copyButton = `<button class="copy-code-btn" title="Copy Code">${copyIconSVG}</button>`;
            return `<pre data-lang="${language}"><code>${safeCode}</code></pre>${copyButton}`;
        });
        
        // 5. Inline Code/KaTeX
        markdown = markdown.replace(/`(.*?)`/g, (match, text) => {
            const trimmedText = text.trim();
            // Check if it's inline KaTeX
            if (trimmedText.startsWith('$') && trimmedText.endsWith('$')) {
                 const tex = trimmedText.slice(1, -1);
                 return `<span class="latex-render" data-tex="${escapeHTML(tex)}" data-display-mode="false"></span>`;
            }
            // Standard inline code
            return `<code>${escapeHTML(trimmedText)}</code>`;
        });

        // 6. Basic Markdown to HTML (Simplified)
        let html = markdown;
        html = html.replace(/\*\*\*(.*?)\*\*\*/gs, '<strong><em>$1</em></strong>'); // Bold Italic
        html = html.replace(/\*\*(.*?)\*\*/gs, '<strong>$1</strong>'); // Bold
        html = html.replace(/\*(.*?)\*/gs, '<em>$1</em>'); // Italic
        html = html.replace(/^- (.*)/gm, '<li>$1</li>'); // Unordered lists
        html = html.replace(/^(\d+\. )/gm, '<li>$1</li>'); // Ordered lists (simplified)
        
        // Wrap lists and paragraphs
        html = html.split('\n').map(line => {
            if (line.match(/^<li>/)) return line;
            if (line.match(/^#+\s/)) { // Headings
                const level = line.match(/^#+/)[0].length;
                const text = line.replace(/^#+\s/, '');
                return `<h${level}>${text}</h${level}>`;
            }
            if (line.trim() !== '') return `<p>${line}</p>`;
            return '';
        }).join('\n');
        
        html = html.replace(/<\/p>\n<p>/g, '</p><p>').trim();
        html = html.replace(/(<li>.*?)(\n<li>.*)*)/gs, (match) => {
            if (match.startsWith('1. ')) {
                 return `<ol>${match.replace(/(\d+\.\s)/g, '')}</ol>`; // Ordered
            }
            return `<ul>${match.replace(/- /g, '')}</ul>`; // Unordered
        });

        return html + citationsHtml;
    }
    
    function handleCopyCode(e) {
        const button = e.currentTarget;
        const pre = button.previousElementSibling;
        const codeElement = pre.querySelector('code');
        const code = codeElement.innerText;

        navigator.clipboard.writeText(code).then(() => {
            button.innerHTML = `${checkIconSVG} Copied!`;
            setTimeout(() => {
                button.innerHTML = copyIconSVG;
            }, 2000);
        }).catch(err => {
            console.error('Could not copy text: ', err);
            button.innerHTML = `${copyIconSVG} Failed`;
            setTimeout(() => {
                button.innerHTML = copyIconSVG;
            }, 2000);
        });
    }

    // --- MAIN AGENT ACTIVATION/DEACTIVATION ---

    /**
     * Handles the Ctrl + \ shortcut for AI activation/deactivation.
     */
    async function handleKeyDown(e) {
        // Check for Ctrl + \ (or Cmd + \ on Mac)
        if (e.ctrlKey && e.key === '\\') {
            const selection = window.getSelection().toString();
            if (isAIActive) {
                // Deactivation logic
                if (selection.length > 0) { return; }
                e.preventDefault();
                const mainEditor = document.getElementById('ai-input');
                // Only deactivate if the input is empty and no files are attached
                if (mainEditor && mainEditor.innerText.trim().length === 0 && attachedFiles.length === 0) {
                    deactivateAI();
                }
            } else {
                // Activation logic
                if (selection.length === 0) {
                    e.preventDefault();
                    activateAI();
                }
            }
        }
    }
    document.addEventListener('keydown', handleKeyDown);

    function activateAI() {
        if (document.getElementById('ai-container')) return;
        if (typeof window.startPanicKeyBlocker === 'function') { window.startPanicKeyBlocker(); }
        
        attachedFiles = [];
        injectStyles();
        
        const container = document.createElement('div');
        container.id = 'ai-container';
        container.setAttribute('role', 'dialog');
        container.setAttribute('aria-modal', 'true');
        container.setAttribute('aria-label', AGENT_NAME);
        
        const brandTitle = document.createElement('div');
        brandTitle.id = 'ai-brand-title';
        const brandText = AGENT_NAME;
        brandText.split('').forEach(char => {
            const span = document.createElement('span');
            span.textContent = char;
            brandTitle.appendChild(span);
        });
        
        const persistentTitle = document.createElement('div');
        persistentTitle.id = 'ai-persistent-title';
        persistentTitle.textContent = AGENT_NAME;
        
        const welcomeMessage = document.createElement('div');
        welcomeMessage.id = 'ai-welcome-message';
        const welcomeHeader = chatHistory.length > 0 ? "Welcome Back, Human" : `Welcome to ${AGENT_NAME}`;
        welcomeMessage.innerHTML = `<h2>${welcomeHeader}</h2><p>I am a universal intelligence model powered by Gemini. My knowledge is augmented by real-time web search for the latest and most accurate information. I support advanced math, charting, and multimodal input.</p><p class="shortcut-tip">(Press Ctrl + \\ to close and save context)</p>`;
        
        const closeButton = document.createElement('div');
        closeButton.id = 'ai-close-button';
        closeButton.innerHTML = '&times;';
        closeButton.title = 'Close Agent';
        closeButton.onclick = deactivateAI;
        
        const responseContainer = document.createElement('div');
        responseContainer.id = 'ai-response-container';
        responseContainer.setAttribute('role', 'log');
        responseContainer.setAttribute('aria-live', 'polite');
        
        const composeArea = document.createElement('div');
        composeArea.id = 'ai-compose-area';

        const inputWrapper = document.createElement('div');
        inputWrapper.id = 'ai-input-wrapper';
        
        const attachmentPreviewContainer = document.createElement('div');
        attachmentPreviewContainer.id = 'ai-attachment-preview';
        
        const visualInput = document.createElement('div');
        visualInput.id = 'ai-input';
        visualInput.contentEditable = true;
        visualInput.onkeydown = handleInputSubmission;
        visualInput.oninput = handleContentEditableInput;
        visualInput.addEventListener('paste', handlePaste);
        visualInput.setAttribute('role', 'textbox');
        visualInput.setAttribute('aria-multiline', 'true');
        visualInput.setAttribute('aria-label', 'Chat input for Humanity Agent');
        
        const attachmentButton = document.createElement('button');
        attachmentButton.id = 'ai-attachment-button';
        attachmentButton.innerHTML = attachmentIconSVG;
        attachmentButton.title = 'Attach files (images, PDFs, text)';
        attachmentButton.onclick = () => handleFileUpload();
        
        const charCounter = document.createElement('div');
        charCounter.id = 'ai-char-counter';
        charCounter.textContent = `0 / ${formatCharLimit(CHAR_LIMIT)}`;

        // --- REMOVAL OF SETTINGS UI: The settings button and menu creation are removed here ---
        // settingsButton and createSettingsMenu() are not appended.
        
        inputWrapper.appendChild(attachmentPreviewContainer);
        inputWrapper.appendChild(visualInput);
        inputWrapper.appendChild(attachmentButton);
        
        composeArea.appendChild(inputWrapper);
        composeArea.appendChild(charCounter);

        container.appendChild(brandTitle);
        container.appendChild(persistentTitle);
        container.appendChild(welcomeMessage);
        container.appendChild(closeButton);
        container.appendChild(responseContainer);
        container.appendChild(composeArea);
        
        // --- Add KaTeX Script ---
        const katexScript = document.createElement('script');
        katexScript.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.js';
        container.appendChild(katexScript);
        
        document.body.appendChild(container);

        if (chatHistory.length > 0) { 
            container.classList.add('chat-active');
            welcomeMessage.classList.add('hidden'); // Hide welcome message if history exists
            renderChatHistory(); 
        }
        
        setTimeout(() => {
            container.classList.add('active');
        }, 10);
        
        visualInput.focus();
        isAIActive = true;
    }

    function deactivateAI() {
        if (typeof window.stopPanicKeyBlocker === 'function') { window.stopPanicKeyBlocker(); }
        if (currentAIRequestController) currentAIRequestController.abort();
        
        saveChatHistory(); // Save context before deactivation
        
        const container = document.getElementById('ai-container');
        if (container) {
            container.classList.add('deactivating');
            setTimeout(() => {
                container.remove();
                // Cleanup injected assets (skip cleanup of FontAwesome to avoid conflicts if present globally)
                const styles = document.getElementById('ai-dynamic-styles');
                if (styles) styles.remove();
                const fonts = document.getElementById('ai-google-fonts');
                if (fonts) fonts.remove();
                const katexCSS = document.getElementById('ai-katex-styles');
                if(katexCSS) katexCSS.remove();
            }, 500);
        }
        isAIActive = false;
        isRequestPending = false;
        attachedFiles = [];
    }
    
    function renderChatHistory() {
        const responseContainer = document.getElementById('ai-response-container');
        if (!responseContainer) return;
        responseContainer.innerHTML = '';
        chatHistory.forEach(message => {
            const bubble = document.createElement('div');
            bubble.className = `ai-message-bubble ${message.role === 'user' ? 'user-message' : 'gemini-response'}`;
            if (message.role === 'model') {
                const parsedResponse = parseGeminiResponse(message.parts[0].text);
                bubble.innerHTML = `<div class="ai-response-content">${parsedResponse}</div>`;
                
                bubble.querySelectorAll('.copy-code-btn').forEach(button => {
                    button.addEventListener('click', handleCopyCode);
                });

                renderKaTeX(bubble);
                renderGraphs(bubble);
            } else {
                let bubbleContent = ''; let textContent = ''; let fileCount = 0;
                message.parts.forEach(part => {
                    if (part.text) textContent = part.text;
                    if (part.inlineData) fileCount++;
                });
                if (textContent) bubbleContent += `<p>${escapeHTML(textContent)}</p>`;
                if (fileCount > 0) bubbleContent += `<div class="sent-attachments">${fileCount} file(s) sent</div>`;
                bubble.innerHTML = bubbleContent;
            }
            responseContainer.appendChild(bubble);
        });
        setTimeout(() => responseContainer.scrollTop = responseContainer.scrollHeight, 50);
    }
    
    // --- INPUT AND SUBMISSION HANDLERS ---

    function handleContentEditableInput(e) {
        const editor = e.target;
        const charCount = editor.innerText.length;
        const counter = document.getElementById('ai-char-counter');
        
        // Dynamic Height Adjustment (Retain old logic)
        editor.style.height = 'auto'; // Reset height
        editor.style.height = `${Math.min(editor.scrollHeight, MAX_INPUT_HEIGHT)}px`;
        
        if (counter) {
            counter.textContent = `${formatCharCount(charCount)} / ${formatCharLimit(CHAR_LIMIT)}`;
            counter.classList.toggle('limit-exceeded', charCount > CHAR_LIMIT);
        }
    }

    function handleInputSubmission(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const inputElement = e.target;
            const query = inputElement.innerText.trim();
            const charCount = query.length;

            if (isRequestPending) {
                console.warn("Request already pending. Ignoring new submission.");
                return;
            }
            if (charCount > CHAR_LIMIT) {
                alert(`Your message exceeds the maximum limit of ${CHAR_LIMIT} characters.`);
                return;
            }
            if (query.length === 0 && attachedFiles.length === 0) {
                 return;
            }

            isRequestPending = true;
            inputElement.contentEditable = false;
            
            // Collect parts
            const userParts = [];
            if (query) userParts.push({ text: query });
            attachedFiles.forEach(file => userParts.push({ inlineData: file.inlineData }));
            
            chatHistory.push({ role: "user", parts: userParts });
            saveChatHistory(); // Save immediately after user message

            // Add new message bubble and loading state
            const responseContainer = document.getElementById('ai-response-container');
            const userBubble = document.createElement('div');
            userBubble.className = 'ai-message-bubble user-message';
            userBubble.innerHTML = userParts.map(p => p.text ? `<p>${escapeHTML(p.text)}</p>` : '').join('') + (attachedFiles.length > 0 ? `<div class="sent-attachments">${attachedFiles.length} file(s) sent</div>` : '');
            responseContainer.appendChild(userBubble);
            
            const aiBubble = document.createElement('div');
            aiBubble.className = 'ai-message-bubble gemini-response loading';
            aiBubble.innerHTML = `${searchIconSVG}<div class="ai-loader"></div>`;
            responseContainer.appendChild(aiBubble);
            responseContainer.scrollTop = responseContainer.scrollHeight;
            
            // Clear input and attachments
            inputElement.innerText = '';
            attachedFiles = [];
            document.getElementById('ai-attachment-preview').innerHTML = '';
            document.getElementById('ai-input-wrapper').classList.remove('has-attachments');
            
            const inputWrapper = document.getElementById('ai-input-wrapper');
            if (inputWrapper) { 
                inputWrapper.classList.add('waiting'); 
            }
            
            // Ensure visual input is reset
            inputElement.style.height = 'auto';
            const counter = document.getElementById('ai-char-counter');
            if (counter) { counter.textContent = `0 / ${formatCharLimit(CHAR_LIMIT)}`; }

            // Hide welcome message after first submission
            const welcomeMessage = document.getElementById('ai-welcome-message');
            if (welcomeMessage) welcomeMessage.classList.add('hidden');

            callGoogleAI(aiBubble);
        }
    }
    
    // Paste handler for multimodal input
    function handlePaste(e) {
        const inputElement = e.target;
        const clipboardData = e.clipboardData || window.clipboardData;
        const items = clipboardData.items;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                e.preventDefault(); // Prevent image paste into contentEditable
                const blob = items[i].getAsFile();
                
                // Read the image file and process it
                const reader = new FileReader();
                reader.onload = (event) => {
                    const base64Data = event.target.result.split(',')[1];
                    processFileLike(blob, base64Data, event.target.result);
                };
                reader.readAsDataURL(blob);
                return; 
            }
        }
        
        // Existing text handling (if no image)
        const text = clipboardData.getData('text/plain');
        if (text) {
             // Handle text length limit
            const currentContent = inputElement.innerText;
            if ((currentContent.length + text.length) > CHAR_LIMIT) {
                e.preventDefault();
                alert(`Pasted text is too long. The total message must not exceed ${CHAR_LIMIT} characters.`);
            }
        }
    }

    // --- MULTIMODAL/ATTACHMENT LOGIC (Polished) ---

    function processFileLike(file, base64Data, dataUrl, tempId) {
        if (attachedFiles.length >= MAX_ATTACHMENTS_PER_MESSAGE) {
            alert(`You can attach a maximum of ${MAX_ATTACHMENTS_PER_MESSAGE} files per message.`);
            return;
        }

        const currentTotalSize = attachedFiles.reduce((sum, f) => sum + (f.inlineData ? atob(f.inlineData.data).length : 0), 0);
        if (currentTotalSize + file.size > (10 * 1024 * 1024)) { // 10MB limit
            alert(`Upload failed: Total size of attachments would exceed the 10MB limit per message. (Current: ${formatBytes(currentTotalSize)}, Adding: ${formatBytes(file.size)})`);
            return;
        }

        const item = {
            inlineData: { mimeType: file.type, data: base64Data },
            fileName: file.name || 'Pasted Image',
            fileContent: dataUrl,
            isLoading: false
        };
        
        if (tempId) { item.tempId = tempId; }

        attachedFiles.push(item);
        renderAttachments();
    }


    function handleFileUpload() {
        if (attachedFiles.length >= MAX_ATTACHMENTS_PER_MESSAGE) {
            alert(`You can attach a maximum of ${MAX_ATTACHMENTS_PER_MESSAGE} files per message.`);
            return;
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        // Accept common image, document, and text types
        input.accept = 'image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';
        
        input.onchange = (event) => {
            const files = Array.from(event.target.files);
            if (!files || files.length === 0) return;

            const filesToProcess = files.filter(file => {
                if (attachedFiles.length >= MAX_ATTACHMENTS_PER_MESSAGE) {
                    return false; // Stop processing if limit is reached during loop
                }
                return true;
            });

            const currentTotalSize = attachedFiles.reduce((sum, file) => sum + (file.inlineData ? atob(file.inlineData.data).length : 0), 0);
            const newFilesSize = filesToProcess.reduce((sum, file) => sum + file.size, 0);

            if (currentTotalSize + newFilesSize > (10 * 1024 * 1024)) { // 10MB limit
                 alert(`Upload failed: Total size of attachments would exceed the 10MB limit per message.`);
                 return;
            }

            filesToProcess.forEach(file => {
                const tempId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                attachedFiles.push({ tempId, file, isLoading: true });
                renderAttachments();
                
                const reader = new FileReader();
                reader.onload = (e) => {
                    const base64Data = e.target.result.split(',')[1];
                    const dataUrl = e.target.result;
                    const itemIndex = attachedFiles.findIndex(f => f.tempId === tempId);
                    
                    if (itemIndex > -1) {
                        const item = attachedFiles[itemIndex];
                        item.isLoading = false;
                        item.inlineData = { mimeType: file.type, data: base64Data };
                        item.fileName = file.name;
                        item.fileContent = dataUrl;
                        delete item.file; // Remove File object to make storage/cloning safer
                        delete item.tempId;
                        renderAttachments();
                    }
                };
                reader.readAsDataURL(file);
            });
        }; 
        input.click();
    }

    function renderAttachments() {
        const previewContainer = document.getElementById('ai-attachment-preview');
        const inputWrapper = document.getElementById('ai-input-wrapper');
        if (!previewContainer || !inputWrapper) return;
        
        if (attachedFiles.length === 0) {
            inputWrapper.classList.remove('has-attachments');
            previewContainer.innerHTML = '';
            return;
        }
        
        inputWrapper.classList.add('has-attachments');
        previewContainer.innerHTML = '';
        
        attachedFiles.forEach((file, index) => {
            const fileCard = document.createElement('div');
            fileCard.className = 'attachment-card';
            let previewHTML = ''; 
            let fileName = file.fileName || (file.file ? file.file.name : 'Pasted File');
            let fileExt = fileName.split('.').pop().toUpperCase();
            if (fileExt.length > 5 || fileName.split('.').length === 1) fileExt = 'FILE';

            if (file.isLoading) {
                fileCard.classList.add('loading');
                previewHTML = `<div class="ai-loader"></div><span class="file-icon">📄</span>`;
            } else {
                if (file.inlineData.mimeType.startsWith('image/')) {
                    previewHTML = `<img src="data:${file.inlineData.mimeType};base64,${file.inlineData.data}" alt="${fileName}" />`;
                    fileExt = 'IMG';
                } else {
                    previewHTML = `<span class="file-icon">📄</span>`;
                }
            }
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = fileName;
            const marqueeWrapper = document.createElement('div');
            marqueeWrapper.className = 'file-name';
            marqueeWrapper.appendChild(nameSpan);

            fileCard.innerHTML = `${previewHTML}<div class="file-info"></div><div class="file-type-badge">${fileExt}</div><button class="remove-attachment-btn" data-index="${index}">&times;</button>`;
            
            fileCard.querySelector('.file-info').appendChild(marqueeWrapper);
            
            // Marquee setup for long file names
            setTimeout(() => {
                if (nameSpan.scrollWidth > marqueeWrapper.clientWidth) {
                    const marqueeDuration = fileName.length / 4;
                    nameSpan.style.animationDuration = `${marqueeDuration}s`;
                    marqueeWrapper.classList.add('marquee');
                    nameSpan.innerHTML += `<span aria-hidden="true">${fileName}</span>`;
                }
            }, 0);
            
            fileCard.querySelector('.remove-attachment-btn').onclick = (e) => {
                e.stopPropagation();
                attachedFiles.splice(index, 1);
                renderAttachments();
            };
            
            previewContainer.appendChild(fileCard);
        });
    }

    // --- AI MODEL LOGIC ---
    
    /**
     * Executes a Google Custom Search for factual data.
     * @param {string} query The search query.
     * @returns {Promise<string>} Context string with search results or an empty string.
     */
    async function searchGoogle(query) {
        if (!API_KEY || !CUSTOM_SEARCH_ID) return '';
        
        try {
            const searchUrl = `${CUSTOM_SEARCH_URL}${encodeURIComponent(query)}`;
            const response = await fetch(searchUrl);
            
            if (!response.ok) {
                 console.error(`Search API failed with status: ${response.status}`);
                 return '';
            }
            
            const data = await response.json();
            
            if (!data.items || data.items.length === 0) {
                 return '';
            }
            
            let searchContext = '### Web Search Results for Context:\n';
            data.items.slice(0, 3).forEach((item, index) => {
                const title = item.title.replace(/[\[\]]/g, ''); // Clean up title for citation
                // Use snippet, but prioritize the more detailed Pagemap if available (Knowledge Graph hint)
                const snippet = item.snippet || item.pagemap?.metatags?.[0]?.['og:description'] || item.htmlSnippet;
                
                searchContext += `\n- **Result ${index + 1}**: ${snippet}\n`;
                searchContext += `[Source: ${title}, ${item.link}]\n`; // Demand model use this exact citation format
            });
            
            searchContext += '\n### End Web Search Context\n';
            return searchContext;
            
        } catch (e) {
            console.error('Google Search Error:', e);
            return '';
        }
    }


    /**
     * Determines the user's current intent category and selects the appropriate model.
     * @param {string} query The user's latest message text.
     * @returns {string} One of 'DEEP_ANALYSIS', 'PROFESSIONAL_MATH', 'CREATIVE', or 'CASUAL'.
     */
    function determineIntentCategory(query) {
        const lowerQuery = query.toLowerCase();
        
        // Deep Analysis Keywords
        if (lowerQuery.includes('analyze') || lowerQuery.includes('deep dive') || lowerQuery.includes('strategic') || lowerQuery.includes('evaluate') || lowerQuery.includes('critique') || lowerQuery.includes('investigate') || lowerQuery.includes('pro model')) {
            return 'DEEP_ANALYSIS';
        }
        
        // Professional/Math/Coding Keywords
        if (lowerQuery.includes('math') || lowerQuery.includes('algebra') || lowerQuery.includes('calculus') || lowerQuery.includes('formula') || lowerQuery.includes('solve') || lowerQuery.includes('proof') || lowerQuery.includes('graph') || lowerQuery.includes('code') || lowerQuery.includes('debug') || lowerQuery.includes('technical') || lowerQuery.includes('chart')) {
            return 'PROFESSIONAL_MATH';
        }

        // Creative/Narrative Keywords
        if (lowerQuery.includes('story') || lowerQuery.includes('poem') || lowerQuery.includes('imagine') || lowerQuery.includes('creative') || lowerQuery.includes('narrative')) {
            return 'CREATIVE';
        }
        
        return 'CASUAL';
    }

    const AGENT_CORE_INSTRUCTION = `You are Humanity Agent (Humanity {Gen 0}), a highly capable and adaptable universal intelligence model. Your responses are authoritative, concise, interactive, and structured for maximum clarity and user experience.

User Profile: You are interacting with a user with the nickname "${userSettings.nickname}".
Context: You have access to real-time web search results which will be provided in a 'Web Search Context' block. You MUST use these results for fact-based and current-event questions.

Formatting Rules (MUST FOLLOW):
1.  **Citations**: For all information derived from the 'Web Search Context' block, you MUST append the exact citation found in the context at the end of the relevant sentence. The format is: [Source: Title, URL].
2.  **Summary/Bullet/Chart Output**: For complex queries, use markdown to provide an initial **Summary**, followed by detailed **Bullet Points**, and/or a **Chart** (if numerical data is present).
3.  **Advanced Math/Graphing**:
    -   Use KaTeX for all mathematical expressions. Inline math uses backticks and single dollar signs (\`$E=mc^2$\`). Display math uses double dollar signs (\`$$\\frac{d}{dx} f(x)$$\`). Use LaTeX commands like \\le for <= and \\ge for >=.
    -   For visual data or function plotting, you MUST output a raw JSON code block with the tag \`<graph>\` and \`</graph>\` inside:
        \`\`\`json
        <graph>
        {
          "layout": {"title": "Graph Title", "xaxis": {"title": "X-Axis"}, "yaxis": {"title": "Y-Axis"}},
          "data": [
            {"x": [1, 2, 3], "y": [4, 1, 2], "mode": "lines+markers", "line": {"color": "#1a73e8"}},
            {"type": "function", "fn": "Math.sin(x)", "range": [-10, 10], "line": {"color": "red"}}
          ]
        }
        </graph>
        \`\`\`
4.  **Conversational Flow**: Directly address the user's last point and offer a **single, clear follow-up question or clarification prompt** at the end of your response to maintain a natural, continuous conversation.
`;

    /**
     * Generates the system instruction and selects the appropriate model.
     * @param {string} query The user's latest message.
     * @returns {{instruction: string, model: string}}
     */
    function getDynamicSystemInstructionAndModel(query) {
        const userEmail = userSettings.email; 
        const isProAuthorized = userEmail === AUTHORIZED_PRO_USER;

        const intent = determineIntentCategory(query);
        let model = 'gemini-2.5-flash-lite';
        let personaInstruction = AGENT_CORE_INSTRUCTION; // Start with the core instruction

        switch (intent) {
            case 'DEEP_ANALYSIS':
                if (isProAuthorized) { 
                    model = 'gemini-2.5-pro';
                    personaInstruction += `\n\n**Current Persona: Deep Strategist (2.5-Pro).** Your response must be highly comprehensive, meticulously structured, and exhibit the deepest level of reasoning and critical evaluation. Use an assertive, expert tone. Structure your analysis clearly with headings and bullet points. You are granted maximal control over the response depth.`;
                } else {
                    // Fallback for unauthorized/limited users
                    model = 'gemini-2.5-flash';
                    personaInstruction += `\n\n**Current Persona: Professional Analyst (2.5-Flash).** You are performing a detailed analysis, but must maintain efficiency and focus due to current access level. Respond with clarity, professionalism, and structured data. Note: Full '2.5-Pro' capabilities are reserved for the authorized user.`;
                }
                break;
            case 'PROFESSIONAL_MATH':
                model = 'gemini-2.5-flash';
                personaInstruction += `\n\n**Current Persona: Technical Expert (2.5-Flash).** Respond with extreme clarity, professionalism, and precision. Focus on step-by-step logic, equations, and definitive answers. Use a formal, neutral tone. You MUST use KaTeX and the custom \`<graph>\` block format for all relevant mathematical formulas and plots.`;
                break;
            case 'CREATIVE':
                model = 'gemini-2.5-flash';
                personaInstruction += `\n\n**Current Persona: Creative Partner (2.5-Flash).** Use rich, evocative language. Be imaginative, focus on descriptive details, and inspire new ideas. Adopt a warm and engaging tone.`;
                break;
            case 'CASUAL':
            default:
                model = 'gemini-2.5-flash-lite';
                personaInstruction += `\n\n**Current Persona: Standard Assistant (2.5-Flash-Lite).** You are balanced, helpful, and concise. Use a friendly and casual tone. Your primary function is efficient, accurate conversation. Be brief unless detail is explicitly requested.`;
                break;
        }

        return { instruction: personaInstruction, model: model };
    }

    // New stub for backward compatibility with the old function call
    function getDynamicSystemInstruction(query, settings) {
        return getDynamicSystemInstructionAndModel(query).instruction;
    }


    async function callGoogleAI(responseBubble) {
        if (!API_KEY) { 
            responseBubble.innerHTML = `<div class="ai-error">API Key is missing. Cannot proceed.</div>`; 
            return; 
        }
        currentAIRequestController = new AbortController();
        const lastUserMessage = chatHistory[chatHistory.length - 1];
        
        let lastUserQuery = '';
        const textPart = lastUserMessage.parts.find(p => p.text);
        if (textPart) lastUserQuery = textPart.text;
        
        // --- 1. WEB SEARCH AUGMENTATION ---
        // For general, non-creative queries, perform a search.
        const intent = determineIntentCategory(lastUserQuery);
        let searchContext = '';
        if (intent !== 'CREATIVE' && lastUserQuery.length > 5) {
             searchContext = await searchGoogle(lastUserQuery);
        }
        
        // --- 2. CONTEXT & INSTRUCTION BUILDING ---
        let firstMessageContext = '';
        if (chatHistory.length <= 1) { // Only prepends to the first message's query
            const location = getUserLocationForContext(); 
            const now = new Date();
            const date = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const time = now.toLocaleTimeString('en-US', { timeZoneName: 'short' });
            firstMessageContext = `(System Info: User is asking from ${location}. Current date is ${date}, ${time}. User Email: ${userSettings.email}.)\n\n`;
        }
        
        // Preserve a truncated history for conversation context (Last 6 messages)
        let processedChatHistory = chatHistory.slice(-6).map(message => ({ ...message }));
        
        const lastMessageIndex = processedChatHistory.length - 1;
        const userParts = processedChatHistory[lastMessageIndex].parts;
        const textPartIndex = userParts.findIndex(p => p.text);
        
        // Prepend system/search context to the user's latest text part
        if (textPartIndex > -1) {
            userParts[textPartIndex].text = firstMessageContext + searchContext + userParts[textPartIndex].text;
        } else if (firstMessageContext || searchContext) {
             userParts.unshift({ text: firstMessageContext.trim() + searchContext.trim() });
        }
        
        // Model selection and final instruction
        const { instruction: dynamicInstruction, model } = getDynamicSystemInstructionAndModel(lastUserQuery); 
        
        const payload = { 
            contents: processedChatHistory, 
            config: {
                systemInstruction: dynamicInstruction
            }
        };
        
        // --- 3. API CALL EXECUTION ---
        const DYNAMIC_API_URL = `${BASE_API_URL}${model}:generateContent?key=${API_KEY}`; 
        
        // Update bubble to reflect search is complete, starting generation
        responseBubble.innerHTML = `<div class="ai-loader"></div> Generating response with ${model}...`;

        try {
            const response = await fetch(DYNAMIC_API_URL, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(payload), 
                signal: currentAIRequestController.signal 
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API Error: ${response.status}. ${errorData.error?.message || JSON.stringify(errorData)}`);
            }
            
            const data = await response.json();
            
            if (!data.candidates || data.candidates.length === 0) {
                if (data.promptFeedback && data.promptFeedback.blockReason) {
                    throw new Error(`Content blocked due to: ${data.promptFeedback.blockReason}.`);
                }
                throw new Error("Invalid response from API: No candidates or empty candidates array.");
            }
            
            const text = data.candidates[0].content.parts[0]?.text || '';
            if (!text) {
                responseBubble.innerHTML = `<div class="ai-error">The AI generated an empty response. Please try again or rephrase.</div>`;
                return;
            }

            chatHistory.push({ role: "model", parts: [{ text: text }] });
            saveChatHistory(); // Save context with new model response
            
            const contentHTML = `<div class="ai-response-content">${parseGeminiResponse(text)}</div>`;
            responseBubble.style.opacity = '0';
            
            setTimeout(() => {
                responseBubble.innerHTML = contentHTML;
                responseBubble.querySelectorAll('.copy-code-btn').forEach(button => {
                    button.addEventListener('click', handleCopyCode);
                });
                responseBubble.style.opacity = '1';

                renderKaTeX(responseBubble);
                renderGraphs(responseBubble);
            }, 300);

        } catch (error) {
            if (error.name === 'AbortError') { responseBubble.innerHTML = `<div class="ai-error">Message generation stopped.</div>`; } 
            else { 
                console.error('AI API Error:', error); 
                responseBubble.innerHTML = `<div class="ai-error">Fatal Error: ${error.message || "Unknown error"}.</div>`; 
            }
        } finally {
            isRequestPending = false;
            currentAIRequestController = null;
            const inputWrapper = document.getElementById('ai-input-wrapper');
            if (inputWrapper) { inputWrapper.classList.remove('waiting'); }
            
            setTimeout(() => {
                responseBubble.classList.remove('loading');
                const responseContainer = document.getElementById('ai-response-container');
                if(responseContainer) responseContainer.scrollTop = responseContainer.scrollHeight;
            }, 300);

            const editor = document.getElementById('ai-input');
            if(editor) { editor.contentEditable = true; editor.focus(); }
        }
    }
    
    // --- ATTACHMENT AND FILE HELPERS (Retained) ---

    // Retained functions from old agent-activation.js file:
    // processFileLike, handleFileUpload, renderAttachments, showFilePreview (if needed, simplified preview)

    // Simplified File Preview for robustness (original was large)
    function showFilePreview(file) { 
        if (!file.fileContent) {
             alert("File content not available for preview."); 
             return; 
        }
        alert(`Preview for file: ${file.fileName} (${formatBytes(atob(file.inlineData.data).length)}) is not yet implemented in this version. File data is prepared for the AI model.`);
    }

})();
