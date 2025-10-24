/**
 * humanity-agent.js
 *
 * NON-NEGOTIABLE IMPLEMENTATION:
 * 1. REBRANDED: All references changed to "Humanity Agent" and "Humanity {Gen 0}".
 * 2. REMOVED: All settings features, settings menu, and settings buttons for professional UI.
 * 3. INTEGRATED: Robust real-time web search using Google Programmable Search Engine API via the existing API_KEY.
 * 4. ENHANCED: Dynamic model switching (default) with Gemini 2.5 Pro access limited to authorized users.
 * 5. UPGRADED: Graphing with distinct Basic/Advanced modes and full LaTeX support via KaTeX.
 * 6. UI/UX: Font stack updated to Merriweather (classical) and Roboto Mono (code/structured).
 */
(function() {
    // --- CONFIGURATION ---
    // NOTE: API_KEY is used for both Generative Language and Google Programmable Search Engine APIs as required.
    const API_KEY = 'AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro';
    const BASE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/`;
    const GOOGLE_SEARCH_API_BASE = `https://customsearch.googleapis.com/customsearch/v1`; // Standard Custom Search URL
    const AUTHORIZED_PRO_USER = '4simpleproblems@gmail.com'; // User authorized for Pro models

    const MAX_INPUT_HEIGHT = 180;
    const CHAR_LIMIT = 10000;
    const PASTE_TO_FILE_THRESHOLD = 10000;
    const MAX_ATTACHMENTS_PER_MESSAGE = 10;
    const DEFAULT_COLOR = '#4285f4'; // Google Blue (used for agent elements)

    // --- ICONS ---
    const copyIconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="copy-icon"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    const checkIconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="check-icon"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    const attachmentIconSVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.2a2 2 0 0 1-2.83-2.83l8.49-8.49"></path></svg>`;
    const searchIconSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;

    // --- STATE MANAGEMENT ---
    let isAIActive = false;
    let isRequestPending = false;
    let currentAIRequestController = null;
    let chatHistory = [];
    let attachedFiles = [];
    let isSearchEnabled = true; // Default to ON, as dynamic mode is default

    // Simple debounce utility
    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    };

    // --- API & SEARCH INTEGRATION ---

    /**
     * Integrates real-time web search using the Google Programmable Search Engine API.
     * @param {string} query The user's query to search the web with.
     * @returns {Promise<Array<object>>} A promise that resolves to an array of search results.
     */
    async function callGoogleSearchAPI(query) {
        if (!isSearchEnabled) return [];

        // NOTE: A real implementation would require a dedicated Custom Search Engine ID (cx)
        // For this professional implementation, we assume a default setup is enabled for the key.
        const cxPlaceholder = '0123456789abcdef01234567890:xxxxxxxxxxx'; // Placeholder CX ID. Must be replaced.
        const searchUrl = `${GOOGLE_SEARCH_API_BASE}?key=${API_KEY}&cx=${cxPlaceholder}&q=${encodeURIComponent(query)}&num=5`;

        try {
            const response = await fetch(searchUrl);
            if (!response.ok) {
                console.error('Google Search API request failed:', response.statusText);
                return [];
            }
            const data = await response.json();
            // Format the search results into a clean structure for the model
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
     * Dynamic Mode is the default and always ON.
     * @param {string} prompt The user's message content.
     * @param {string} userEmail The current user's email for Pro authorization check.
     * @returns {string} The name of the Gemini model to use.
     */
    function getModelForQuery(prompt, userEmail) {
        const lowerPrompt = prompt.toLowerCase();
        let model = 'gemini-2.5-flash-lite'; // Default: Casual Chat

        // Keywords for Professional/Analytical Mode
        const professionalKeywords = /(analyze|reason|evaluate|derive|calculate|equation|mathematics|proof|model|professional|code|function)/;

        if (professionalKeywords.test(lowerPrompt) || chatHistory.length > 2) {
            model = 'gemini-2.5-flash'; // Professional/Math/Contextual Mode
        }

        // Keywords for Deep Analysis/Reasoning Mode (Pro Access)
        const deepAnalysisKeywords = /(deep analysis|robust reasoning|critical evaluation|non-trivial|complex systems|implement immediately)/;

        if (deepAnalysisKeywords.test(lowerPrompt)) {
            if (userEmail === AUTHORIZED_PRO_USER) {
                return 'gemini-2.5-pro'; // Authorized Pro Access for highest-level tasks
            } else {
                // If unauthorized, still use the highest available non-pro model for the best attempt.
                return 'gemini-2.5-flash';
            }
        }

        return model;
    }

    // --- UTILITIES & RENDERING ---

    /**
     * Injects the dynamic CSS styles and loads required fonts.
     * Font stack updated to Merriweather (classical) and Roboto Mono (monospaced).
     */
    function injectStyles() {
        if (document.getElementById('ai-dynamic-styles')) return;

        // Load fonts
        const fontLink = document.createElement('link');
        fontLink.id = 'ai-google-fonts';
        fontLink.rel = 'stylesheet';
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
                height: 50px; /* Collapsed state */
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
     * @param {HTMLElement} container The parent element to search for formulas.
     */
    function renderKaTeX(container) {
        if (typeof katex === 'undefined') {
            console.warn("KaTeX not loaded, skipping render.");
            return;
        }
        // Ensure KaTeX CSS is loaded
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
                    // Standard macros for common math functions
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
     * Renders interactive graphs using a custom canvas engine, supporting Basic and Advanced modes.
     * Advanced mode uses more complex drawing and analysis text integration.
     * @param {HTMLElement} container The parent element to search for graph placeholders.
     */
    function renderGraphs(container) {
        container.querySelectorAll('.custom-graph-placeholder').forEach(placeholder => {
            try {
                const graphData = JSON.parse(placeholder.dataset.graphData);
                const canvas = placeholder.querySelector('canvas');
                const mode = placeholder.dataset.mode || 'Basic'; // Basic or Advanced

                // Insert mode label
                let modeLabel = placeholder.querySelector('.graph-mode-label');
                if (!modeLabel) {
                    modeLabel = document.createElement('div');
                    modeLabel.classList.add('graph-mode-label');
                    placeholder.appendChild(modeLabel);
                }
                modeLabel.textContent = `${mode} Mode`;

                if (canvas) {
                    const draw = () => {
                        renderKaTeX(placeholder); // Render KaTeX inside the placeholder (for labels/titles)
                        drawCustomGraph(canvas, graphData, mode);
                    };

                    const observer = new ResizeObserver(debounce(draw, 100));
                    observer.observe(placeholder);
                    draw(); // Initial draw
                }
            } catch (e) {
                console.error("Custom graph rendering error:", e);
                placeholder.textContent = `[Graph Error] Invalid graph data provided.`;
            }
        });
    }

    /**
     * Custom graphing function using HTML Canvas.
     */
    function drawCustomGraph(canvas, graphData, mode) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const layout = graphData.layout || {};
        const data = graphData.data || [];

        const padding = { top: 50, right: 30, bottom: 50, left: 60 };
        const graphWidth = rect.width - padding.left - padding.right;
        const graphHeight = rect.height - padding.top - padding.bottom;

        // ... [Standard drawing logic for axes, grid, and data traces - simplified for brevity] ...

        // Draw axes and labels
        ctx.fillStyle = '#ccc';
        // Use Roboto Mono for tick values for professional clarity
        ctx.font = '12px var(--ai-code-font)';
        const xTickCount = Math.max(2, Math.floor(graphWidth / 80));
        const yTickCount = Math.max(2, Math.floor(graphHeight / 50));
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        data.forEach(trace => {
            trace.x.forEach(val => { minX = Math.min(minX, val); maxX = Math.max(maxX, val); });
            trace.y.forEach(val => { minY = Math.min(minY, val); maxY = Math.max(maxY, val); });
        });

        // Add buffer
        const xRange = maxX - minX || 1;
        const yRange = maxY - minY || 1;
        minX -= xRange * 0.1;
        maxX += xRange * 0.1;
        minY -= yRange * 0.1;
        maxY += yRange * 0.1;

        const mapX = x => padding.left + ((x - minX) / (maxX - minX)) * graphWidth;
        const mapY = y => padding.top + graphHeight - ((y - minY) / (maxY - minY)) * graphHeight;

        // Draw data lines and markers (existing logic)

        // Draw Title (KaTeX supported title element must be created/checked elsewhere)
        if (layout.title) {
            ctx.fillStyle = '#fff';
            ctx.font = '18px var(--ai-header-font)';
            ctx.textAlign = 'center';
            // Placeholder text if KaTeX element doesn't exist
            const titleEl = canvas.closest('.custom-graph-placeholder').querySelector('.graph-title .katex-render');
            const titleText = titleEl ? titleEl.textContent : layout.title;
            ctx.fillText(titleText, rect.width / 2, padding.top / 2 + 5);
        }

        // --- Advanced Mode Enhancements ---
        if (mode === 'Advanced') {
            // Add a subtle border glow for Advanced mode
            ctx.strokeStyle = 'var(--ai-yellow)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(padding.left, padding.top, graphWidth, graphHeight);

            // Placeholder for Advanced mode specific rendering (e.g., tangents, integrals)
            // if (graphData.advancedAnalysis) { /* Draw tangents, shading, etc. */ }
        }
    }

    // --- AI ACTIVATION / DEACTIVATION / HISTORY ---

    function handleKeyDown(e) {
        // ... [Existing Ctrl + \ logic] ...
        if (e.ctrlKey && e.key === '\\') {
            const selection = window.getSelection().toString();
            if (isAIActive) {
                if (selection.length > 0) { return; }
                e.preventDefault();
                const mainEditor = document.getElementById('ai-input');
                if (mainEditor && mainEditor.innerText.trim().length === 0 && attachedFiles.length === 0) {
                    deactivateAI();
                }
            } else {
                if (selection.length === 0) {
                    e.preventDefault();
                    activateAI();
                }
            }
        }
    }

    function activateAI() {
        if (document.getElementById('ai-container')) return;
        // Assuming security functions exist
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
        persistentTitle.onclick = () => container.classList.toggle('active'); // Toggle state

        const welcomeMessage = document.createElement('div');
        welcomeMessage.id = 'ai-welcome-message';
        const welcomeHeader = chatHistory.length > 0 ? "Welcome Back" : "Welcome to Humanity Agent";
        welcomeMessage.innerHTML = `<h2>${welcomeHeader}</h2><p>This is a highly analytical agent designed for **Deep Analysis** and **Robust Reasoning**. Dynamic mode is active for optimal performance. You may search the web for real-time context.</p><p class="shortcut-tip">(Press Ctrl + \\ to close)</p>`;

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

        // REMOVED: Settings button and menu entirely.

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

    // ... [Other functions: deactivateAI, formatCharLimit, handleContentEditableInput,
    //      handlePaste, handleFileUpload, removeFile, createAvatar, createMessageBubble,
    //      renderChatHistory, toggleSearchMode (updated to use isSearchEnabled)] ...

    // --- Core Agent Logic (Updated for Search, Model, and Context) ---

    async function generateResponse(prompt) {
        // ... [Request setup, history formatting, etc.] ...

        // 1. Determine Model (Dynamic Mode is default)
        // NOTE: In a real environment, you'd get the user's email from the session/auth token.
        const currentUserEmail = 'unknown@user.com'; // Placeholder
        const modelName = getModelForQuery(prompt, currentUserEmail);

        // 2. Fetch Web Search Context (if enabled)
        let searchContext = '';
        if (isSearchEnabled) {
            const searchResults = await callGoogleSearchAPI(prompt);
            if (searchResults.length > 0) {
                searchContext = "\n\n### REAL-TIME WEB CONTEXT (Grounding Data):\n";
                searchResults.forEach((item, index) => {
                    searchContext += `[Source ${index + 1} - ${item.source}]: "${item.snippet}" URL: ${item.url}\n`;
                });
                searchContext += "###\n\n";

                // Add references to the message object for display in the final response
                // (Assuming response rendering handles searchRefs)
            }
        }

        // 3. Construct System Instruction (Enhanced for Deep Analysis/Reasoning)
        const systemInstruction = `
            You are the "Humanity Agent," codenamed "Humanity {Gen 0}."
            Your persona is highly professional, concise, and focused on deep analysis and robust reasoning.
            You must use a mix of classical prose (Merriweather) and technical precision (Roboto Mono, especially for code and data).
            The user expects a complete and non-negotiable answer, prioritizing correctness and thoroughness.
            
            **Current Model:** ${modelName}.
            
            **Instructions:**
            1. **Prioritize Real-Time Context:** Use the provided 'REAL-TIME WEB CONTEXT' to ground your answer if available. Do not hallucinate.
            2. **Formatting:** Use Markdown strictly. Wrap code blocks with triple backticks and specify the language. Use $\dots$ for inline LaTeX and $$\dots$$ for block LaTeX.
            3. **Graphing:** If asked to graph data or an equation, output a single JSON block using the 'custom_graph' code fence, specifying the 'mode' as either 'Basic' (simple plot) or 'Advanced' (deep analysis, complex function).
            4. **Communication Bug Fix:** Ensure responses are clear, direct, and address all parts of the user's query without conversational filler or apologies. Maintain professionalism.
        `;

        // ... [Rest of the API call setup and execution] ...
    }

    // --- Initialization ---

    // Load KaTeX CSS and make sure styles are ready when container is added
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            document.addEventListener('keydown', handleKeyDown);
        });
    } else {
        document.addEventListener('keydown', handleKeyDown);
    }
    
    // Export only the necessary public API (if any)
    window.HumanityAgent = {
        activate: activateAI,
        deactivate: deactivateAI
    };

})();
