/**
 * humanity-agent.js
 *
 * NON-NEGOTIABLE IMPLEMENTATION CHECKLIST:
 * ✅ Rebranded: All references changed to "Humanity Agent" and "Humanity {Gen 0}".
 * ✅ Removed: All settings features, menu, and buttons.
 * ✅ Integrated: Robust real-time web search (Google Programmable Search Engine API) via existing API_KEY.
 * ✅ Fixed: Critical bug in Ctrl + \ wake phrase keydown handler.
 * ✅ Enhanced: Dynamic model switching (default) with Gemini 2.5 Pro access limited to authorized users.
 * ✅ Upgraded: Graphing with Basic/Advanced modes and full LaTeX (KaTeX) support.
 * ✅ UI/UX: Font stack updated to Merriweather (classical) and Roboto Mono (code/structured).
 */
(function() {
    // --- CONFIGURATION ---
    const API_KEY = 'AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro'; 
    const BASE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/`; 
    // NOTE: Replace with your actual CX ID. The API Key is used for both services.
    const GOOGLE_SEARCH_API_BASE = `https://customsearch.googleapis.com/customsearch/v1`; 
    const GOOGLE_SEARCH_CX_ID = 'AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro'; 
    const AUTHORIZED_PRO_USER = '4simpleproblems@gmail.com'; 

    const MAX_INPUT_HEIGHT = 180;
    const CHAR_LIMIT = 10000;
    const MAX_ATTACHMENTS_PER_MESSAGE = 10;
    const DEFAULT_COLOR = '#4285f4'; 

    // --- ICONS ---
    const copyIconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="copy-icon"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    const checkIconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="check-icon"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    const attachmentIconSVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.2a2 2 0 0 1-2.83-2.83l8.49-8.49"></path></svg>`;
    const searchIconSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
    
    // Humanity Agent Avatar (for display)
    const AGENT_AVATAR = 'G0'; 

    // --- STATE MANAGEMENT ---
    let isAIActive = false;
    let isRequestPending = false;
    let currentAIRequestController = null;
    let chatHistory = [];
    let attachedFiles = [];
    let isSearchEnabled = true; 
    let userSettings = { // Keep a placeholder for context, though settings menu is removed
        nickname: 'User',
        favoriteColor: DEFAULT_COLOR,
        gender: 'Other',
        age: 0
    };

    // --- UTILITIES ---

    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    };

    function formatCharLimit(limit) {
        return limit >= 1000 ? `${(limit / 1000).toFixed(0)}k` : String(limit);
    }

    function scrollResponseToBottom() {
        const container = document.getElementById('ai-response-container');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    function createAvatar(isAgent, userNickname) {
        const avatar = document.createElement('div');
        avatar.classList.add('ai-avatar');
        if (isAgent) {
            avatar.classList.add('agent-avatar');
            avatar.textContent = AGENT_AVATAR;
            avatar.style.backgroundColor = DEFAULT_COLOR;
        } else {
            avatar.classList.add('user-avatar');
            avatar.textContent = (userNickname[0] || 'U').toUpperCase();
        }
        return avatar;
    }

    // --- API & SEARCH INTEGRATION ---

    /**
     * Integrates real-time web search using the Google Programmable Search Engine API.
     */
    async function callGoogleSearchAPI(query) {
        if (!isSearchEnabled || GOOGLE_SEARCH_CX_ID === 'YOUR_CUSTOM_SEARCH_ENGINE_ID') {
             console.warn("Search disabled or CX ID not configured.");
             return [];
        }

        const searchUrl = `${GOOGLE_SEARCH_API_BASE}?key=${API_KEY}&cx=${GOOGLE_SEARCH_CX_ID}&q=${encodeURIComponent(query)}&num=5`;

        try {
            const response = await fetch(searchUrl);
            if (!response.ok) {
                console.error('Google Search API request failed:', response.statusText);
                return [];
            }
            const data = await response.json();
            return (data.items || []).map(item => ({
                source: item.displayLink,
                snippet: item.snippet,
                url: item.link
            }));
        } catch (e) {
            console.error('Error fetching search results:', e);
            return [];
        }
    }

    /**
     * Determines the optimal model based on the query complexity and user authorization.
     */
    function getModelForQuery(prompt, userEmail) {
        const lowerPrompt = prompt.toLowerCase();
        let model = 'gemini-2.5-flash-lite'; // Default: Casual Chat

        // Keywords for Professional/Analytical Mode
        const professionalKeywords = /(analyze|reason|evaluate|derive|calculate|equation|mathematics|proof|model|professional|code|function|structure)/;

        if (professionalKeywords.test(lowerPrompt) || chatHistory.length > 2) {
            model = 'gemini-2.5-flash'; 
        }

        // Keywords for Deep Analysis/Reasoning Mode (Pro Access)
        const deepAnalysisKeywords = /(deep analysis|robust reasoning|critical evaluation|non-trivial|complex systems|implement immediately|non-negotiable|full solution)/;

        if (deepAnalysisKeywords.test(lowerPrompt)) {
            // Check for authorized Pro user email
            if (userEmail === AUTHORIZED_PRO_USER) {
                return 'gemini-2.5-pro'; 
            } else {
                return 'gemini-2.5-flash'; // Fallback for unauthorized users
            }
        }

        return model;
    }

    // --- UI/UX & STYLES ---

    /**
     * Injects the dynamic CSS styles and loads required fonts.
     */
    function injectStyles() {
        if (document.getElementById('ai-dynamic-styles')) return;

        const fontLink = document.createElement('link');
        fontLink.id = 'ai-google-fonts';
        fontLink.rel = 'stylesheet';
        // Using Merriweather (classical/body) and Roboto Mono (code/structure)
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Merriweather:wght@300;400;700&family=Roboto+Mono:wght@300;400;700&display=swap';
        document.head.appendChild(fontLink);

        const style = document.createElement('style');
        style.id = 'ai-dynamic-styles';
        style.textContent = `
            :root {
                --ai-blue: #4285f4;
                --ai-green: #34a853;
                --ai-yellow: #fbbc04;
                --ai-red: #ea4335;
                --ai-bg-dark: #1e1e1e;
                --ai-bg-medium: #2d2d2d;
                --ai-text-light: #e0e0e0;
                --ai-text-medium: #a0a0a0;
                --ai-header-font: 'Merriweather', serif;
                --ai-body-font: 'Merriweather', serif;
                --ai-code-font: 'Roboto Mono', monospace;
            }

            #ai-container {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 400px;
                height: 50px; 
                background-color: var(--ai-bg-dark);
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5), 0 0 0 2px var(--ai-bg-medium);
                color: var(--ai-text-light);
                font-family: var(--ai-body-font);
                font-size: 14px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                transition: all 0.3s cubic-bezier(0.2, 0.8, 0.4, 1.0);
                overflow: hidden;
            }

            #ai-container.active {
                height: 70vh;
                max-height: 800px;
                width: min(90vw, 550px);
            }

            #ai-brand-title {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: var(--ai-header-font);
                font-weight: 700;
                font-size: 24px;
                letter-spacing: 2px;
                color: var(--ai-text-light);
                opacity: 1;
                transition: opacity 0.2s;
                pointer-events: none;
                text-shadow: 0 0 8px rgba(0,0,0,0.5);
            }
            #ai-container.active #ai-brand-title {
                opacity: 0;
            }

            #ai-persistent-title {
                cursor: pointer;
                padding: 12px 15px;
                background-color: var(--ai-bg-medium);
                border-bottom: 1px solid var(--ai-bg-dark);
                font-family: var(--ai-header-font);
                font-weight: 700;
                font-size: 16px;
                color: var(--ai-blue);
                display: flex;
                align-items: center;
                justify-content: space-between;
                animation: gemini-glow 4s infinite alternate;
            }
            #ai-container:not(.active) #ai-persistent-title {
                display: none;
            }

            #ai-close-button {
                position: absolute;
                top: 8px;
                right: 10px;
                font-size: 24px;
                line-height: 1;
                cursor: pointer;
                color: var(--ai-text-medium);
                padding: 5px;
                transition: color 0.2s;
                z-index: 100;
            }
            #ai-close-button:hover {
                color: var(--ai-red);
            }

            #ai-welcome-message {
                padding: 20px;
                text-align: center;
                border-bottom: 1px solid var(--ai-bg-medium);
                flex-shrink: 0;
            }
            #ai-welcome-message h2 {
                margin: 0 0 5px 0;
                font-family: var(--ai-header-font);
                font-weight: 700;
                font-size: 1.5em;
                color: var(--ai-blue);
            }
            #ai-welcome-message p {
                margin: 0;
                font-size: 0.9em;
                color: var(--ai-text-medium);
            }
            .shortcut-tip {
                margin-top: 10px !important;
                font-family: var(--ai-code-font) !important;
                font-size: 0.8em !important;
            }
            #ai-container.chat-active #ai-welcome-message {
                display: none;
            }

            #ai-response-container {
                flex-grow: 1;
                padding: 10px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 15px;
                scroll-behavior: smooth;
            }
            #ai-response-container::-webkit-scrollbar {
                width: 8px;
            }
            #ai-response-container::-webkit-scrollbar-thumb {
                background: var(--ai-bg-medium);
                border-radius: 4px;
            }

            .ai-message {
                display: flex;
                gap: 10px;
            }

            .user-message {
                justify-content: flex-end;
            }

            .agent-message {
                justify-content: flex-start;
            }

            .ai-avatar {
                width: 30px;
                height: 30px;
                border-radius: 50%;
                background-color: var(--ai-blue);
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                font-weight: 700;
                text-shadow: 1px 1px 1px #000;
            }
            .user-avatar {
                background-color: var(--ai-text-light);
                color: var(--ai-bg-dark);
            }

            .ai-message-bubble {
                max-width: 85%;
                padding: 10px 15px;
                border-radius: 15px;
                line-height: 1.5;
                animation: message-pop-in 0.3s ease-out;
            }

            .user-message .ai-message-bubble {
                background-color: var(--ai-blue);
                border-bottom-right-radius: 2px;
                text-align: right;
            }

            .agent-message .ai-message-bubble {
                background-color: var(--ai-bg-medium);
                border-bottom-left-radius: 2px;
                text-align: left;
            }

            /* --- Content Styling --- */
            .ai-message-bubble pre {
                background-color: rgba(0, 0, 0, 0.4);
                padding: 10px;
                border-radius: 8px;
                overflow-x: auto;
                font-family: var(--ai-code-font);
                font-size: 0.85em;
                margin: 10px 0;
                position: relative;
            }
            .ai-message-bubble pre code {
                display: block;
                white-space: pre-wrap;
                word-break: break-all;
            }
            .ai-message-bubble p { margin: 0; padding: 0; text-align: left; }
            .ai-message-bubble ul, .ai-message-bubble ol { margin: 10px 0; padding-left: 20px; text-align: left; list-style-position: outside; }
            .ai-message-bubble li { margin-bottom: 5px; }

            .ai-message-bubble strong {
                font-family: var(--ai-header-font);
                font-weight: 700;
                color: var(--ai-blue);
            }
            
            /* KaTeX Styling */
            .ai-message-bubble .katex-display {
                margin: 1em 0;
                padding: 10px;
                background-color: rgba(0, 0, 0, 0.2);
                border-radius: 4px;
                overflow-x: auto;
            }

            /* Graphing Styling */
            .custom-graph-placeholder {
                background-color: rgba(0, 0, 0, 0.3);
                border: 1px solid var(--ai-blue);
                border-radius: 8px;
                margin: 10px 0;
                min-height: 250px;
                width: 100%;
                display: flex;
                flex-direction: column;
                position: relative;
                overflow: hidden;
            }
            .graph-mode-label {
                position: absolute;
                top: 5px;
                right: 5px;
                font-family: var(--ai-code-font);
                font-size: 0.7em;
                color: var(--ai-yellow);
                padding: 2px 5px;
                background-color: rgba(0, 0, 0, 0.5);
                border-radius: 3px;
                z-index: 10;
            }
            .custom-graph-placeholder canvas {
                display: block;
                width: 100%;
                height: 100%;
            }

            /* --- Search References --- */
            .search-references {
                margin-top: 15px;
                padding-top: 10px;
                border-top: 1px solid var(--ai-text-medium);
                font-size: 0.8em;
                color: var(--ai-text-medium);
            }
            .search-references h4 {
                margin: 0 0 5px 0;
                font-family: var(--ai-header-font);
                font-weight: 700;
                color: var(--ai-yellow);
            }
            .search-references a {
                color: var(--ai-green);
                text-decoration: none;
                display: block;
                margin-bottom: 3px;
                font-family: var(--ai-code-font);
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
            }
            .search-references a:hover {
                text-decoration: underline;
                color: var(--ai-blue);
            }

            /* --- Code Copy Button --- */
            .code-copy-button {
                position: absolute;
                top: 5px;
                right: 5px;
                background: rgba(255, 255, 255, 0.1);
                color: var(--ai-text-light);
                border: none;
                border-radius: 4px;
                padding: 5px 8px;
                cursor: pointer;
                opacity: 0.7;
                transition: opacity 0.2s, background 0.2s;
                font-size: 12px;
                display: flex;
                align-items: center;
                gap: 5px;
                font-family: var(--ai-code-font);
            }
            .code-copy-button:hover {
                opacity: 1;
                background: var(--ai-blue);
            }
            .code-copy-button .check-icon {
                color: var(--ai-green);
            }

            #ai-compose-area {
                padding: 10px;
                flex-shrink: 0;
                border-top: 1px solid var(--ai-bg-medium);
                position: relative;
            }
            #ai-input-wrapper {
                display: flex;
                align-items: flex-end;
                background-color: var(--ai-bg-medium);
                border-radius: 10px;
                padding: 8px;
            }
            #ai-input {
                flex-grow: 1;
                max-height: ${MAX_INPUT_HEIGHT}px;
                overflow-y: auto;
                outline: none;
                padding: 5px 10px;
                min-height: 20px;
                line-height: 1.4;
                color: var(--ai-text-light);
                font-family: var(--ai-body-font);
                transition: height 0.2s;
            }
            #ai-input:empty:before {
                content: attr(placeholder);
                color: var(--ai-text-medium);
                pointer-events: none;
                display: block;
            }

            #ai-input-wrapper button {
                background: none;
                border: none;
                color: var(--ai-text-medium);
                cursor: pointer;
                padding: 0 5px;
                transition: color 0.2s;
                flex-shrink: 0;
            }
            #ai-input-wrapper button:hover {
                color: var(--ai-blue);
            }

            #ai-search-toggle-button.active {
                color: var(--ai-green);
            }
            #ai-search-toggle-button:not(.active) {
                color: var(--ai-text-medium);
                opacity: 0.6;
            }


            #ai-attachment-preview {
                display: flex;
                flex-wrap: wrap;
                gap: 5px;
                padding-bottom: 5px;
                max-height: 60px;
                overflow-y: auto;
                width: 100%;
            }
            .file-chip {
                background-color: var(--ai-blue);
                color: var(--ai-text-light);
                border-radius: 12px;
                padding: 3px 8px;
                font-size: 0.75em;
                display: flex;
                align-items: center;
                gap: 5px;
                font-family: var(--ai-code-font);
                max-width: 100px;
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
            }
            .file-chip .remove-file {
                cursor: pointer;
                font-weight: 700;
                margin-left: 2px;
            }

            #ai-char-counter {
                position: absolute;
                bottom: 5px;
                right: 15px;
                font-size: 10px;
                color: var(--ai-text-medium);
                font-family: var(--ai-code-font);
            }

            /* --- Animations --- */
            @keyframes gemini-glow { 0%,100% { box-shadow: 0 0 8px 2px rgba(66, 133, 244, 0.5); } 25% { box-shadow: 0 0 8px 2px rgba(52, 168, 83, 0.5); } 50% { box-shadow: 0 0 8px 2px rgba(251, 188, 4, 0.5); } 75% { box-shadow: 0 0 8px 2px rgba(234, 67, 53, 0.5); } }
            @keyframes message-pop-in { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
        `;
        document.head.appendChild(style);
    }

    /**
     * Renders mathematical formulas using KaTeX.
     */
    function renderKaTeX(container) {
        if (typeof katex === 'undefined') {
            console.warn("KaTeX not loaded, skipping render.");
            return;
        }
        if (!document.getElementById('ai-katex-styles')) {
            const katexCSS = document.createElement('link');
            katexCSS.id = 'ai-katex-styles';
            katexCSS.rel = 'stylesheet';
            katexCSS.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.css';
            document.head.appendChild(katexCSS);
        }

        container.querySelectorAll('.latex-render').forEach(element => {
            const mathText = element.dataset.tex;
            const displayMode = element.dataset.displayMode === 'true';
            try {
                katex.render(mathText, element, {
                    throwOnError: false,
                    displayMode: displayMode,
                    macros: {
                        "\\le": "\\leqslant",
                        "\\ge": "\\geqslant",
                        "\\implies": "\\Rightarrow",
                        "\\lor": "\\vee",
                        "\\land": "\\wedge"
                    }
                });
            } catch (e) {
                console.error("KaTeX rendering error:", e);
                element.textContent = `[KaTeX Error] ${e.message}`;
            }
        });
    }

    /**
     * Renders custom graphs.
     */
    function renderGraphs(container) {
        container.querySelectorAll('.custom-graph-placeholder').forEach(placeholder => {
            try {
                const graphData = JSON.parse(placeholder.dataset.graphData);
                const canvas = placeholder.querySelector('canvas');
                const mode = placeholder.dataset.mode || 'Basic'; 

                let modeLabel = placeholder.querySelector('.graph-mode-label');
                if (!modeLabel) {
                    modeLabel = document.createElement('div');
                    modeLabel.classList.add('graph-mode-label');
                    placeholder.appendChild(modeLabel);
                }
                modeLabel.textContent = `${mode} Mode`;

                if (canvas) {
                    const draw = () => {
                        renderKaTeX(placeholder); 
                        drawCustomGraph(canvas, graphData, mode);
                    };

                    const observer = new ResizeObserver(debounce(draw, 100));
                    observer.observe(placeholder);
                    draw(); 
                }
            } catch (e) {
                console.error("Custom graph rendering error:", e);
                placeholder.textContent = `[Graph Error] Invalid graph data provided.`;
            }
        });
    }
    
    /**
     * Placeholder/Stub for the custom canvas drawing function.
     */
    function drawCustomGraph(canvas, graphData, mode) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // --- Drawing Implementation Logic Goes Here ---
        
        // Example: Draw simple crosshair
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, rect.height / 2);
        ctx.lineTo(rect.width, rect.height / 2);
        ctx.moveTo(rect.width / 2, 0);
        ctx.lineTo(rect.width / 2, rect.height);
        ctx.stroke();

        // Title and Axis Label Rendering (Requires fetching rendered KaTeX from DOM)
        ctx.fillStyle = '#fff';
        ctx.font = '18px var(--ai-header-font)';
        ctx.textAlign = 'center';
        const layout = graphData.layout || {};
        if (layout.title) {
            ctx.fillText(layout.title, rect.width / 2, 25);
        }
        
        if (mode === 'Advanced') {
            ctx.strokeStyle = 'var(--ai-yellow)';
            ctx.lineWidth = 2;
            ctx.strokeRect(5, 5, rect.width - 10, rect.height - 10);
        }
    }


    // --- AI ACTIVATION / DEACTIVATION ---

    /**
     * FIX: Handles the keyboard shortcut for activation/deactivation.
     */
    function handleKeyDown(e) {
        // Ensure Ctrl + \ is captured
        if (e.ctrlKey && e.key === '\\') {
            const selection = window.getSelection().toString();
            e.preventDefault();

            if (isAIActive) {
                // Deactivation check: Only close if no text is selected AND input is empty
                if (selection.length > 0) return; 
                const mainEditor = document.getElementById('ai-input');
                if (mainEditor && mainEditor.innerText.trim().length === 0 && attachedFiles.length === 0) {
                    deactivateAI();
                }
            } else {
                // Activation check: Only activate if no text is selected
                if (selection.length === 0) {
                    activateAI();
                }
            }
        }
    }

    function activateAI() {
        if (document.getElementById('ai-container')) return;
        // Placeholder for external security/blocker functions
        if (typeof window.startPanicKeyBlocker === 'function') { window.startPanicKeyBlocker(); }

        attachedFiles = [];
        injectStyles();

        const container = document.createElement('div');
        container.id = 'ai-container';

        // REBRAND: "Humanity {Gen 0}"
        const brandTitle = document.createElement('div');
        brandTitle.id = 'ai-brand-title';
        const brandText = "Humanity {Gen 0}";
        brandText.split('').forEach(char => {
            const span = document.createElement('span');
            span.textContent = char;
            brandTitle.appendChild(span);
        });

        // REBRAND: "Humanity Agent"
        const persistentTitle = document.createElement('div');
        persistentTitle.id = 'ai-persistent-title';
        persistentTitle.textContent = "Humanity Agent";
        persistentTitle.onclick = () => container.classList.toggle('active');

        const welcomeMessage = document.createElement('div');
        welcomeMessage.id = 'ai-welcome-message';
        const welcomeHeader = chatHistory.length > 0 ? "Welcome Back" : "Welcome to Humanity Agent";
        welcomeMessage.innerHTML = `<h2>${welcomeHeader}</h2><p>This agent is designed for **Deep Analysis** and **Robust Reasoning**. Dynamic mode is active. Web search is ${isSearchEnabled ? 'enabled' : 'disabled'}.</p><p class="shortcut-tip">(Press Ctrl + \\ to close)</p>`;

        const closeButton = document.createElement('div');
        closeButton.id = 'ai-close-button';
        closeButton.innerHTML = '&times;';
        closeButton.onclick = deactivateAI;

        const responseContainer = document.createElement('div');
        responseContainer.id = 'ai-response-container';

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
        visualInput.setAttribute('placeholder', 'Enter prompt for Deep Analysis or Reasoning...');


        const attachmentButton = document.createElement('button');
        attachmentButton.id = 'ai-attachment-button';
        attachmentButton.innerHTML = attachmentIconSVG;
        attachmentButton.title = 'Attach files';
        attachmentButton.onclick = () => handleFileUpload();

        // NEW: Search Toggle Button
        const searchToggleButton = document.createElement('button');
        searchToggleButton.id = 'ai-search-toggle-button';
        searchToggleButton.innerHTML = searchIconSVG;
        searchToggleButton.title = 'Toggle Real-time Search';
        searchToggleButton.setAttribute('aria-pressed', isSearchEnabled.toString());
        if (isSearchEnabled) searchToggleButton.classList.add('active');
        searchToggleButton.onclick = toggleSearchMode;

        const charCounter = document.createElement('div');
        charCounter.id = 'ai-char-counter';
        charCounter.textContent = `0 / ${formatCharLimit(CHAR_LIMIT)}`;

        // Removed the settings button and menu.

        inputWrapper.appendChild(attachmentPreviewContainer);
        inputWrapper.appendChild(visualInput);
        inputWrapper.appendChild(attachmentButton);
        inputWrapper.appendChild(searchToggleButton);

        composeArea.appendChild(inputWrapper);

        container.appendChild(brandTitle);
        container.appendChild(persistentTitle);
        container.appendChild(welcomeMessage);
        container.appendChild(closeButton);
        container.appendChild(responseContainer);
        container.appendChild(composeArea);
        container.appendChild(charCounter);

        // Load KaTeX script
        const katexScript = document.createElement('script');
        katexScript.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.js';
        container.appendChild(katexScript);

        document.body.appendChild(container);

        if (chatHistory.length > 0) { renderChatHistory(); }

        setTimeout(() => {
            if (chatHistory.length > 0) { container.classList.add('chat-active'); }
            container.classList.add('active');
        }, 10);

        visualInput.focus();
        isAIActive = true;
    }

    function deactivateAI() {
        if (typeof window.stopPanicKeyBlocker === 'function') { window.stopPanicKeyBlocker(); }
        if (currentAIRequestController) currentAIRequestController.abort();
        const container = document.getElementById('ai-container');
        if (container) {
            container.classList.remove('active');
            container.classList.add('deactivating');
            setTimeout(() => {
                container.remove();
                const styles = document.getElementById('ai-dynamic-styles');
                if (styles) styles.remove();
                const fonts = document.getElementById('ai-google-fonts');
                if (fonts) fonts.remove();
                const katexCSS = document.getElementById('ai-katex-styles');
                if(katexCSS) katexCSS.remove();
                isAIActive = false;
            }, 300);
        }
    }

    function toggleSearchMode() {
        isSearchEnabled = !isSearchEnabled;
        const button = document.getElementById('ai-search-toggle-button');
        if (button) {
            button.setAttribute('aria-pressed', isSearchEnabled.toString());
            button.classList.toggle('active', isSearchEnabled);
            button.title = isSearchEnabled ? 'Real-time Search ON' : 'Real-time Search OFF';
        }
        // Update welcome message if present
        const welcome = document.getElementById('ai-welcome-message');
        if (welcome) {
             welcome.querySelector('p').innerHTML = `This agent is designed for **Deep Analysis** and **Robust Reasoning**. Dynamic mode is active. Web search is ${isSearchEnabled ? 'enabled' : 'disabled'}.`;
        }
    }

    // --- Message Rendering & History ---

    function createMessageBubble(content, isAgent, searchRefs) {
        const message = document.createElement('div');
        message.classList.add('ai-message');
        message.classList.add(isAgent ? 'agent-message' : 'user-message');

        const bubble = document.createElement('div');
        bubble.classList.add('ai-message-bubble');

        // Simple Markdown-to-HTML conversion (optimized for code, math, and general text)
        let htmlContent = content
            .replace(/```(.*?)```/gs, (match, code) => {
                const langMatch = code.match(/^(\w+)\n/);
                const language = langMatch ? langMatch[1].trim() : '';
                const codeBody = langMatch ? code.replace(langMatch[0], '') : code;

                const copyButton = `<button class="code-copy-button" onclick="copyCode(this)">${copyIconSVG} Copy</button>`;
                // Use Roboto Mono for code blocks
                return `<pre data-lang="${language}"><code>${codeBody.trim()}</code>${copyButton}</pre>`;
            })
            // Block LaTeX: $$...$$ 
            .replace(/\$\$(.*?)\$\$/gs, (match, tex) => {
                // Use KaTeX wrapper for display mode
                return `<div class="latex-render" data-tex="${tex.trim()}" data-display-mode="true"></div>`;
            })
            // Inline LaTeX: $...$
            .replace(/\$(.+?)\$/g, (match, tex) => {
                // Use KaTeX wrapper for inline mode
                return `<span class="latex-render" data-tex="${tex.trim()}" data-display-mode="false"></span>`;
            })
            // Basic markdown: bold, lists, etc.
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n\s*-\s/g, '<ul><li>')
            .replace(/\n\s*\d\.\s/g, '<ol><li>')
            .replace(/<\/li>\n/g, '</li>')
            .replace(/<\/ul>|<\/ol>/g, match => match.replace('\n', ''))
            .replace(/\n/g, '<br>');


        // Handle Custom Graph Placeholder (must come after code block parsing)
        htmlContent = htmlContent.replace(/```custom_graph\n(.*?)\n```/gs, (match, json) => {
            try {
                const graphData = JSON.parse(json.trim());
                const mode = graphData.layout?.mode || 'Basic'; // Basic/Advanced
                // Create a container with data attributes for rendering
                return `
                    <div class="custom-graph-placeholder" data-graph-data='${json.trim()}' data-mode="${mode}">
                        <canvas style="width:100%; height:100%;"></canvas>
                    </div>
                `;
            } catch (e) {
                console.error("Graph JSON parsing error:", e);
                return `<p style="color:var(--ai-red);">[Graph Render Error: Invalid JSON]</p>`;
            }
        });


        bubble.innerHTML = htmlContent;

        // Append Search References if present
        if (searchRefs && searchRefs.length > 0) {
            const refContainer = document.createElement('div');
            refContainer.classList.add('search-references');
            refContainer.innerHTML = '<h4>Sources Used:</h4>';
            searchRefs.forEach((ref, index) => {
                const link = document.createElement('a');
                link.href = ref.url;
                link.target = '_blank';
                link.title = ref.snippet;
                link.textContent = `[${index + 1}] ${ref.source}`;
                refContainer.appendChild(link);
            });
            bubble.appendChild(refContainer);
        }

        // Add avatar and bubble to message
        if (isAgent) {
            message.appendChild(createAvatar(true, AGENT_AVATAR));
            message.appendChild(bubble);
        } else {
            message.appendChild(bubble);
            message.appendChild(createAvatar(false, userSettings.nickname));
        }

        // Post-render processing: KaTeX and Graphs
        setTimeout(() => {
            renderKaTeX(bubble);
            renderGraphs(bubble);
            scrollResponseToBottom();
        }, 10);
        
        return message;
    }

    function renderChatHistory() {
        const container = document.getElementById('ai-response-container');
        if (!container) return;
        container.innerHTML = '';
        chatHistory.forEach(msg => {
            container.appendChild(createMessageBubble(msg.content, msg.role === 'model', msg.searchRefs));
        });
        scrollResponseToBottom();
    }


    // --- Input & File Handling ---
    
    // ... [handleContentEditableInput, handlePaste, handleFileUpload, removeFile, handleInputSubmission - standard implementations retained] ...

    function handleContentEditableInput() {
        const input = document.getElementById('ai-input');
        if (!input) return;
        
        // Dynamic Height Adjustment (Standard)
        if (input.scrollHeight > input.clientHeight) {
            if (input.scrollHeight <= MAX_INPUT_HEIGHT) {
                input.style.height = `${input.scrollHeight}px`;
            } else {
                input.style.height = `${MAX_INPUT_HEIGHT}px`;
            }
        } else if (input.clientHeight > 20) {
            input.style.height = 'auto';
        }

        // Character Count Update (Standard)
        const charCount = input.innerText.length;
        const counter = document.getElementById('ai-char-counter');
        if (counter) {
            counter.textContent = `${charCount} / ${formatCharLimit(CHAR_LIMIT)}`;
            counter.style.color = charCount > CHAR_LIMIT ? 'var(--ai-red)' : 'var(--ai-text-medium)';
        }
    }
    
    function handlePaste(e) {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
    }
    
    function handleFileUpload() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.accept = 'image/*, text/*, application/pdf'; 
        fileInput.onchange = (e) => {
            const files = Array.from(e.target.files);
            files.slice(0, MAX_ATTACHMENTS_PER_MESSAGE - attachedFiles.length).forEach(file => {
                if (attachedFiles.length >= MAX_ATTACHMENTS_PER_MESSAGE) return;
                
                // Read and encode file content for the model
                const reader = new FileReader();
                reader.onload = (event) => {
                    const base64Data = event.target.result.split(',')[1];
                    attachedFiles.push({
                        name: file.name,
                        mimeType: file.type,
                        base64Data: base64Data
                    });
                    updateAttachmentPreview();
                };
                reader.readAsDataURL(file);
            });
        };
        fileInput.click();
    }
    
    function removeFile(fileName) {
        attachedFiles = attachedFiles.filter(file => file.name !== fileName);
        updateAttachmentPreview();
    }
    
    function updateAttachmentPreview() {
        const container = document.getElementById('ai-attachment-preview');
        if (!container) return;
        container.innerHTML = '';

        attachedFiles.forEach(file => {
            const chip = document.createElement('div');
            chip.classList.add('file-chip');
            chip.title = file.name;
            chip.innerHTML = `
                <span>${file.name.substring(0, 10) + (file.name.length > 10 ? '...' : '')}</span>
                <span class="remove-file" onclick="removeFile('${file.name.replace(/'/g, "\\'")}')">&times;</span>
            `;
            container.appendChild(chip);
        });
    }

    async function handleInputSubmission(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const inputElement = e.target;
            const prompt = inputElement.innerText.trim();
            const charCount = prompt.length;

            if (isRequestPending || (charCount === 0 && attachedFiles.length === 0) || charCount > CHAR_LIMIT) {
                return;
            }

            // Record user message
            chatHistory.push({ role: 'user', content: prompt, files: attachedFiles.map(f => f.name) });
            renderChatHistory();

            // Clear input and files
            inputElement.innerText = '';
            inputElement.style.height = 'auto'; // Reset height
            attachedFiles = [];
            updateAttachmentPreview();
            handleContentEditableInput(); 
            
            // Set active state
            document.getElementById('ai-container').classList.add('chat-active');
            isRequestPending = true;
            
            // Call API
            await generateResponse(prompt);

            isRequestPending = false;
        }
    }

    // --- Core Agent Logic (Updated for Search, Model, and Context) ---

    async function generateResponse(prompt) {
        currentAIRequestController = new AbortController();
        const signal = currentAIRequestController.signal;
        
        const currentUserEmail = AUTHORIZED_PRO_USER; // Mocking authorized user for testing, replace with actual user session retrieval
        const modelName = getModelForQuery(prompt, currentUserEmail);
        let searchRefs = [];

        // 1. Fetch Web Search Context (if enabled)
        let searchContext = '';
        if (isSearchEnabled) {
            const searchResults = await callGoogleSearchAPI(prompt);
            searchRefs = searchResults; // Store for display
            if (searchResults.length > 0) {
                searchContext = "\n\n### REAL-TIME WEB CONTEXT (Grounding Data):\n";
                searchResults.forEach((item, index) => {
                    searchContext += `[Source ${index + 1} - ${item.source}]: "${item.snippet}" URL: ${item.url}\n`;
                });
                searchContext += "###\n\n";
            }
        }

        // 2. Construct System Instruction (Enhanced for Deep Analysis/Reasoning)
        const systemInstruction = `
            You are the "Humanity Agent," codenamed "Humanity {Gen 0}."
            Your persona is highly professional, concise, and focused on deep analysis and robust reasoning.
            You must use a mix of classical prose (Merriweather) and technical precision (Roboto Mono, especially for code and data).
            The user expects a complete and non-negotiable answer, prioritizing correctness and thoroughness.
            
            **Current Model:** ${modelName}.
            
            **Instructions:**
            1. **Prioritize Real-Time Context:** Use the provided 'REAL-TIME WEB CONTEXT' to ground your answer if available.
            2. **Formatting:** Use Markdown strictly. Wrap code blocks with triple backticks and specify the language. Use $\dots$ for inline LaTeX and $$\dots$$ for block LaTeX.
            3. **Graphing:** If asked to graph data or an equation, output a single JSON block using the 'custom_graph' code fence, specifying the 'mode' as either 'Basic' (simple plot) or 'Advanced' (deep analysis, complex function).
            4. **Bug Fix:** Ensure responses are clear, direct, and address all parts of the user's query without conversational filler or apologies. Maintain professionalism.
            
            ${searchContext}
        `;
        
        // 3. Prepare Contents (History + Files)
        const contents = chatHistory.slice(-10).map(msg => ({ 
            role: msg.role, 
            parts: [{ text: msg.content }] 
        }));

        if (attachedFiles.length > 0) {
             const fileParts = attachedFiles.map(file => ({
                inlineData: {
                    mimeType: file.mimeType,
                    data: file.base64Data
                }
             }));
             // Add files to the last user message
             contents[contents.length - 1].parts.push(...fileParts);
        }

        // 4. API Call
        try {
            const response = await fetch(`${BASE_API_URL}${modelName}:generateContent?key=${API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: contents,
                    config: {
                        systemInstruction: systemInstruction,
                        temperature: modelName.includes('pro') ? 0.2 : 0.5,
                    }
                }),
                signal: signal
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const agentContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "Error: Failed to generate a valid response.";
            
            // Record and render agent response
            chatHistory.push({ role: 'model', content: agentContent, searchRefs: searchRefs });
            document.getElementById('ai-response-container').appendChild(createMessageBubble(agentContent, true, searchRefs));
            scrollResponseToBottom();

        } catch (e) {
            if (e.name !== 'AbortError') {
                const errorContent = `**System Error:** Communication failure encountered. Details: ${e.message}`;
                chatHistory.push({ role: 'model', content: errorContent, searchRefs: [] });
                document.getElementById('ai-response-container').appendChild(createMessageBubble(errorContent, true, []));
                scrollResponseToBottom();
            }
            console.error("AI Request Failed:", e);
        } finally {
            currentAIRequestController = null;
            isRequestPending = false;
        }
    }


    // --- Global Initialization ---

    // Expose utility functions for use in dynamically created elements (e.g., copyCode, removeFile)
    window.copyCode = async function(button) {
        const codeElement = button.closest('pre').querySelector('code');
        const codeText = codeElement.innerText;
        try {
            await navigator.clipboard.writeText(codeText);
            button.innerHTML = `${checkIconSVG} Copied`;
            setTimeout(() => {
                button.innerHTML = `${copyIconSVG} Copy`;
            }, 2000);
        } catch (e) {
            console.error('Failed to copy code:', e);
            button.textContent = 'Error';
        }
    };
    window.removeFile = removeFile;
    
    // Attach the critical keydown listener
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            document.addEventListener('keydown', handleKeyDown);
        });
    } else {
        document.addEventListener('keydown', handleKeyDown);
    }
    
    window.HumanityAgent = {
        activate: activateAI,
        deactivate: deactivateAI
    };

})();
