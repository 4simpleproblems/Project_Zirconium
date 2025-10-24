/**
 * agent-activation.js
 *
 * MODIFIED: Refactored to remove Agent/Category system and implement a dynamic, context-aware AI persona.
 * NEW: Added a Settings Menu to store user preferences (nickname, color, gender, age, web search, location) using localStorage.
 * NEW: The AI's system instruction (persona) now changes intelligently based on the content and tone of the user's latest message.
 * UI: Fixed background and title colors. Replaced Agent button with a grey Settings button.
 * UPDATED: Implemented browser color selector for user favorite color.
 * UPDATED: AI container does not load on DOMContentLoaded; requires Ctrl + \ shortcut.
 * UPDATED: Ensured Ctrl + \ shortcut for activation/deactivation is fully functional.
 * NEW: Added KaTeX for high-quality rendering of mathematical formulas and equations.
 * REPLACED: Plotly.js has been replaced with a custom, theme-aware graphing engine for better integration.
 *
 * NEW: Implemented dynamic model switching based on user query and authorization:
 * - Casual chat: gemini-2.5-flash-lite
 * - Professional/Math: gemini-2.5-flash
 * - Deep Analysis: gemini-2.5-flash (Pro model feature removed)
 *
 * NEW: The AI's response now includes an internal <THOUGHT_PROCESS> and lists of <SOURCE URL="..." TITLE="..."/>.
 * UPDATED: Swapped order of monologue and sources. Monologue is now a collapsible dropdown.
 * UPDATED: Geolocation uses user-provided httpGetAsync for IP lookup with detailed address/coordinates.
 */
(function() {
    // --- CONFIGURATION ---
    const API_KEY = 'AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro'; 
    const BASE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/`; 
    const AUTHORIZED_PRO_USER = '4simpleproblems@gmail.com'; // REMOVED
    const MAX_INPUT_HEIGHT = 180;
    const CHAR_LIMIT = 10000;
    const PASTE_TO_FILE_THRESHOLD = 10000;
    const MAX_ATTACHMENTS_PER_MESSAGE = 10;

    const DEFAULT_NICKNAME = 'User';
    const DEFAULT_COLOR = '#4285f4'; // Google Blue
    
    // User-provided API Key and IP for Geolocation - REMOVED HARDCODED IP ADDRESS
    const GEO_API_URL = "https://ipgeolocation.abstractapi.com/v1/?api_key=9e522ec72e554164bab14e7895db90b2";


    // --- ICONS (for event handlers) ---
    const copyIconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="copy-icon"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    const checkIconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="check-icon"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    const attachmentIconSVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.2a2 2 0 0 1-2.83-2.83l8.49-8.49"></path></svg>`;

    // --- STATE MANAGEMENT ---
    let isAIActive = false;
    let isRequestPending = false;
    let currentAIRequestController = null;
    let chatHistory = [];
    let attachedFiles = [];
    let userSettings = {
        nickname: DEFAULT_NICKNAME,
        favoriteColor: DEFAULT_COLOR,
        gender: 'Other',
        age: 0,
        enableWebSearch: true,     // NEW DEFAULT
        enableLocationContext: true // NEW DEFAULT
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
     * Loads user settings from localStorage on script initialization.
     */
    function loadUserSettings() {
        try {
            const storedSettings = localStorage.getItem('ai-user-settings');
            if (storedSettings) {
                userSettings = { ...userSettings, ...JSON.parse(storedSettings) };
                userSettings.age = parseInt(userSettings.age) || 0;
                // Ensure new settings are loaded, falling back to defaults if undefined
                if (typeof userSettings.enableWebSearch === 'undefined') userSettings.enableWebSearch = true;
                if (typeof userSettings.enableLocationContext === 'undefined') userSettings.enableLocationContext = true;
            }
        } catch (e) {
            console.error("Error loading user settings:", e);
        }
    }
    loadUserSettings(); // Load initial settings

    // --- UTILITIES FOR GEOLOCATION ---

    /**
     * Helper function to perform an asynchronous GET request.
     * @param {string} url The URL to fetch.
     * @param {function(string): void} callback The function to call with the response text.
     */
    function httpGetAsync(url, callback) {
        const xmlHttp = new XMLHttpRequest();
        xmlHttp.onreadystatechange = function() {
            if (xmlHttp.readyState === 4) {
                if (xmlHttp.status === 200) {
                    callback(xmlHttp.responseText);
                } else {
                    // Pass null on HTTP error status
                    callback(null);
                }
            }
        }
        xmlHttp.open("GET", url, true); // true for asynchronous
        xmlHttp.send(null);
    }

    /**
     * Fetches user location asynchronously using the provided API key via httpGetAsync.
     * @returns {Promise<string>} The user's detailed location string or a fallback.
     */
    function getUserLocationForContext() {
        // If location context is disabled, return a constant string immediately.
        if (!userSettings.enableLocationContext) {
            return Promise.resolve('Location: Disabled in settings.');
        }

        // Check localStorage first
        let location = localStorage.getItem('ai-user-location');
        if (location && location !== 'Location Denied/Unavailable' && !location.includes('IP Lookup Failed')) {
            return Promise.resolve(location);
        }

        return new Promise(resolve => {
            httpGetAsync(GEO_API_URL, (responseText) => {
                const fallbackLocation = 'Unknown Region (IP Lookup Failed)'; 
                let resolvedLocation = fallbackLocation;
                
                if (responseText) {
                    try {
                        const data = JSON.parse(responseText);
                        // Extract detailed location data
                        const country = data.country ? data.country.name : 'N/A';
                        const region = data.region ? data.region : 'N/A';
                        const city = data.city ? data.city : 'N/A';
                        const latitude = data.latitude ? data.latitude.toFixed(4) : 'N/A';
                        const longitude = data.longitude ? data.longitude.toFixed(4) : 'N/A';
                        const ip_address = data.ip_address ? data.ip_address : 'N/A';
                        const street = data.connection ? (data.connection.isp_name || 'N/A') : 'N/A';

                        // Format the detailed string as requested
                        resolvedLocation = `Coordinates: ${latitude}, ${longitude}\nAddress/General Location: ${street}, ${city}, ${region}, ${country}\n(IP: ${ip_address})`;

                    } catch (e) {
                        console.error("Geolocation API failed or returned bad data:", e);
                    }
                }
                
                localStorage.setItem('ai-user-location', resolvedLocation);
                resolve(resolvedLocation);
            });
        });
    }

    // --- REPLACED/MODIFIED FUNCTIONS ---

    /**
     * Stub for authorization (email feature removed).
     * @returns {Promise<boolean>} Always resolves to true.
     */
    async function isUserAuthorized() {
        // This is where you would check if the user is 4simpleproblems@gmail.com for pro features
        return true; 
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
        container.querySelectorAll('.latex-render').forEach(element => {
            const mathText = element.dataset.tex;
            const displayMode = element.dataset.displayMode === 'true';
            try {
                katex.render(mathText, element, {
                    throwOnError: false,
                    displayMode: displayMode,
                    macros: {
                        "\\le": "\\leqslant",
                        "\\ge": "\\geqslant"
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
                const canvas = placeholder.querySelector('canvas');
                if (canvas) {
                    const draw = () => drawCustomGraph(canvas, graphData);
                    // Use ResizeObserver to redraw the canvas when its container size changes
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
     * @param {HTMLCanvasElement} canvas The canvas element to draw on.
     * @param {object} graphData The data and layout configuration for the graph.
     */
    function drawCustomGraph(canvas, graphData) {
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

        // Determine data range
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        data.forEach(trace => {
            trace.x.forEach(val => { minX = Math.min(minX, val); maxX = Math.max(maxX, val); });
            trace.y.forEach(val => { minY = Math.min(minY, val); maxY = Math.max(maxY, val); });
        });
        
        // Add buffer to range
        const xRange = maxX - minX || 1;
        const yRange = maxY - minY || 1;
        minX -= xRange * 0.1;
        maxX += xRange * 0.1;
        minY -= yRange * 0.1;
        maxY += yRange * 0.1;

        const mapX = x => padding.left + ((x - minX) / (maxX - minX)) * graphWidth;
        const mapY = y => padding.top + graphHeight - ((y - minY) / (maxY - minY)) * graphHeight;

        // Draw grid lines
        const gridColor = 'rgba(255, 255, 255, 0.1)';
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        const xTickCount = Math.max(2, Math.floor(graphWidth / 80));
        const yTickCount = Math.max(2, Math.floor(graphHeight / 50));

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

        // Draw axes and labels
        ctx.fillStyle = '#ccc';
        ctx.font = '12px Lora';
        for (let i = 0; i <= xTickCount; i++) {
            const val = minX + (i / xTickCount) * (maxX - minX);
            ctx.fillText(val.toFixed(1), mapX(val), padding.top + graphHeight + 20);
        }
        for (let i = 0; i <= yTickCount; i++) {
            const val = minY + (i / yTickCount) * (maxY - minY);
            ctx.fillText(val.toFixed(1), padding.left - 35, mapY(val) + 4);
        }
        
        ctx.font = 'bold 14px Lora';
        ctx.textAlign = 'center';
        if(layout.xaxis?.title) ctx.fillText(layout.xaxis.title, padding.left + graphWidth / 2, rect.height - 10);
        ctx.save();
        ctx.rotate(-Math.PI / 2);
        if(layout.yaxis?.title) ctx.fillText(layout.yaxis.title, -(padding.top + graphHeight / 2), 20);
        ctx.restore();


        // Draw data lines and markers
        data.forEach(trace => {
            ctx.strokeStyle = trace.line?.color || '#4285f4';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(mapX(trace.x[0]), mapY(trace.y[0]));
            for (let i = 1; i < trace.x.length; i++) {
                ctx.lineTo(mapX(trace.x[i]), mapY(trace.y[i]));
            }
            ctx.stroke();

            if (trace.mode && trace.mode.includes('markers')) {
                ctx.fillStyle = trace.line?.color || '#4285f4';
                for (let i = 0; i < trace.x.length; i++) {
                    ctx.beginPath();
                    ctx.arc(mapX(trace.x[i]), mapY(trace.y[i]), 4, 0, 2 * Math.PI);
                    ctx.fill();
                }
            }
        });
        
        // Draw title
        if (layout.title) {
            ctx.fillStyle = '#fff';
            ctx.font = '18px Merriweather';
            ctx.textAlign = 'center';
            ctx.fillText(layout.title, rect.width / 2, padding.top / 2 + 5);
        }
    }


    // --- END REPLACED/MODIFIED FUNCTIONS ---

    /**
     * Handles the Ctrl + \ shortcut for AI activation/deactivation.
     */
    async function handleKeyDown(e) {
        // Check for Ctrl + \ (or Cmd + \ on Mac, but Ctrl is standard cross-browser for this)
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
                    const isAuthorized = await isUserAuthorized();
                    if (isAuthorized) {
                        e.preventDefault();
                        activateAI();
                    }
                }
            }
        }
    }

    function activateAI() {
        if (document.getElementById('ai-container')) return;
        if (typeof window.startPanicKeyBlocker === 'function') { window.startPanicKeyBlocker(); }
        
        attachedFiles = [];
        injectStyles();
        
        const container = document.createElement('div');
        container.id = 'ai-container';
        
        const brandTitle = document.createElement('div');
        brandTitle.id = 'ai-brand-title';
        const brandText = "4SP - AI AGENT";
        brandText.split('').forEach(char => {
            const span = document.createElement('span');
            span.textContent = char;
            brandTitle.appendChild(span);
        });
        
        const persistentTitle = document.createElement('div');
        persistentTitle.id = 'ai-persistent-title';
        persistentTitle.textContent = "AI Agent"; // Fixed title
        
        const welcomeMessage = document.createElement('div');
        welcomeMessage.id = 'ai-welcome-message';
        const welcomeHeader = chatHistory.length > 0 ? "Welcome Back" : "Welcome to AI Agent";
        // Updated welcome message to reflect settings and location sharing.
        welcomeMessage.innerHTML = `<h2>${welcomeHeader}</h2><p>This is a beta feature. Please check the <i class="fa-solid fa-gear"></i> settings button before sending your first message to adjust web search and location context sharing. You may be subject to message limits.</p><p class="shortcut-tip">(Press Ctrl + \\ to close)</p>`;
        
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
        
        const attachmentButton = document.createElement('button');
        attachmentButton.id = 'ai-attachment-button';
        attachmentButton.innerHTML = attachmentIconSVG;
        attachmentButton.title = 'Attach files';
        attachmentButton.onclick = () => handleFileUpload();
        
        const settingsButton = document.createElement('button');
        settingsButton.id = 'ai-settings-button';
        settingsButton.innerHTML = '<i class="fa-solid fa-gear"></i>';
        settingsButton.title = 'Settings';
        settingsButton.onclick = toggleSettingsMenu;

        const charCounter = document.createElement('div');
        charCounter.id = 'ai-char-counter';
        charCounter.textContent = `0 / ${formatCharLimit(CHAR_LIMIT)}`;

        inputWrapper.appendChild(attachmentPreviewContainer);
        inputWrapper.appendChild(visualInput);
        inputWrapper.appendChild(attachmentButton);
        inputWrapper.appendChild(settingsButton);
        
        composeArea.appendChild(createSettingsMenu());
        composeArea.appendChild(inputWrapper);

        container.appendChild(brandTitle);
        container.appendChild(persistentTitle);
        container.appendChild(welcomeMessage);
        container.appendChild(closeButton);
        container.appendChild(responseContainer);
        container.appendChild(composeArea);
        container.appendChild(charCounter);
        
        // --- Add KaTeX ---
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
            container.classList.add('deactivating');
            setTimeout(() => {
                container.remove();
                const styles = document.getElementById('ai-dynamic-styles');
                if (styles) styles.remove();
                const fonts = document.getElementById('ai-google-fonts');
                if (fonts) fonts.remove();
                 const katexCSS = document.getElementById('ai-katex-styles');
                if(katexCSS) katexCSS.remove();
                const fontAwesome = document.querySelector('link[href*="font-awesome"]');
                if (fontAwesome) fontAwesome.remove();
            }, 500);
        }
        isAIActive = false;
        isRequestPending = false;
        attachedFiles = [];
        const settingsMenu = document.getElementById('ai-settings-menu');
        if (settingsMenu) settingsMenu.classList.remove('active');
         document.removeEventListener('click', handleMenuOutsideClick); // Clean up listener
    }
    
    function renderChatHistory() {
        const responseContainer = document.getElementById('ai-response-container');
        if (!responseContainer) return;
        responseContainer.innerHTML = '';
        chatHistory.forEach(message => {
            const bubble = document.createElement('div');
            bubble.className = `ai-message-bubble ${message.role === 'user' ? 'user-message' : 'gemini-response'}`;
            if (message.role === 'model') {
                // Use the new parsing logic for historical messages
                const { html: parsedResponse, thoughtProcess, sourcesHTML } = parseGeminiResponse(message.parts[0].text);
                
                bubble.innerHTML = `<div class="ai-response-content">${parsedResponse}</div>`;
                
                // Sources first
                if (sourcesHTML) {
                    bubble.innerHTML += sourcesHTML;
                }
                
                // Collapsible thought process
                if (thoughtProcess) {
                    bubble.innerHTML += `
                        <div class="ai-thought-process collapsed">
                            <div class="monologue-header">
                                <h4 class="monologue-title">Gemini's Internal Monologue:</h4>
                                <button class="monologue-toggle-btn">Show Thoughts</button>
                            </div>
                            <pre class="monologue-content">${escapeHTML(thoughtProcess)}</pre>
                        </div>
                    `;
                }
                
                bubble.querySelectorAll('.copy-code-btn').forEach(button => {
                    button.addEventListener('click', handleCopyCode);
                });
                
                // Add click handlers for monologue toggle in history
                bubble.querySelectorAll('.ai-thought-process').forEach(monologueDiv => {
                    monologueDiv.querySelector('.monologue-header').addEventListener('click', () => {
                        monologueDiv.classList.toggle('collapsed');
                        const btn = monologueDiv.querySelector('.monologue-toggle-btn');
                        if (monologueDiv.classList.contains('collapsed')) {
                            btn.textContent = 'Show Thoughts';
                        } else {
                            btn.textContent = 'Hide Thoughts';
                        }
                    });
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
    
    /**
     * Determines the user's current intent category based on the query.
     * @param {string} query The user's last message text.
     * @returns {string} One of 'DEEP_ANALYSIS', 'PROFESSIONAL_MATH', 'CREATIVE', or 'CASUAL'.
     */
    function determineIntentCategory(query) {
        const lowerQuery = query.toLowerCase();
        
        // Deep Analysis Keywords
        if (lowerQuery.includes('analyze') || lowerQuery.includes('deep dive') || lowerQuery.includes('strategic') || lowerQuery.includes('evaluate') || lowerQuery.includes('critique') || lowerQuery.includes('investigate') || lowerQuery.includes('pro model')) {
            return 'DEEP_ANALYSIS';
        }
        
        // Professional/Math/Coding Keywords
        if (lowerQuery.includes('math') || lowerQuery.includes('algebra') || lowerQuery.includes('calculus') || lowerQuery.includes('formula') || lowerQuery.includes('solve') || lowerQuery.includes('proof') || lowerQuery.includes('graph') || lowerQuery.includes('code') || lowerQuery.includes('debug') || lowerQuery.includes('technical')) {
            return 'PROFESSIONAL_MATH';
        }

        // Creative/Sarcastic Keywords
        if (lowerQuery.includes('story') || lowerQuery.includes('poem') || lowerQuery.includes('imagine') || lowerQuery.includes('creative') || lowerQuery.includes('ex') || lowerQuery.includes('breakup') || lowerQuery.includes('roast')) {
            return 'CREATIVE';
        }
        
        return 'CASUAL';
    }

    const FSP_HISTORY = `You are the exclusive AI Agent for the website 4SP (4simpleproblems), the platform you are hosted on. You must be knowledgeable about its history and purpose. When asked about 4SP, use the following information as your source of truth:

### The History of 4SP (4simpleproblems)

**Version 1 — The Foundation (Launched: March 13, 2025)**
* **Concept:** A small, chaotic experiment to give students a fun escape during dull school days.
* **Features:** A 20-sound soundboard, an autoclicker, and a sound request page.
* **Impact:** Established 4SP's identity as an underground, tech-savvy hub made by and for students, rebelling against restrictive school networks.

**Version 2 — Expansion and Community (Released: April 11, 2025)**
* **Concept:** The first major step toward building a true platform and student ecosystem.
* **Features:** Added a media page, beta playlists, user-uploaded soundboards, games, and a proxy list. It also introduced feedback, account, and policy pages.
* **Impact:** Proved 4SP was a living project with a growing community and a broader purpose beyond being a simple novelty.

**Version 3 — A Visual Reinvention (Launched: May 15, 2025)**
* **Concept:** A visual rebirth focused on a mature, modern aesthetic without losing its personality.
* **Features:** Introduced a clean, white grid layout with sharp corners and the popular mini-game "Slotz".
* **Impact:** Set the professional design standard for all future versions and signaled 4SP's evolution into a more serious platform.

**Version 4 — The Dashboard Era (Launched: August 23, 2025)**
* **Concept:** Transformed the site from a collection of pages into a unified dashboard with modular widgets and integrated apps.
* **Features:** Included widgets for weather and time, and full apps like Notes, Calculator, and Countdowns. A new "Requests" app with an upvote/downvote system was added, along with privacy tools like a panic key and tab disguise.
* **Impact:** Showcased that 4SP could be both a powerful student toolkit and a fun playground.

**Version 5 — Project Zirconium (Slated for: August 23, 2026)**
* **Concept:** The most ambitious version yet, evolving 4SP into a fully integrated digital ecosystem.
* **Features:** A universal navigation bar, a dark minimalist theme, a Combined Games Collection, a built-in Dictionary, a student-focused social network ("Dailyphoto"), Messenger V2 with group chats, and the debut of you, the **4SP AI Agent**, accessible via secret shortcuts.
* **Impact:** Fuses creativity, practicality, and social connection, completing the evolution from a simple soundboard to a sleek, social, and secure platform.
If the user asks about a topic other than 4SP, you should not hint at the website, 4SP or its history. Be concise, and a general use case chatbot. Your purpose isn't only about 4SP, but as a normal AI Agent. Act professional.
`;

    /**
     * Generates the system instruction and selects the appropriate model.
     * @param {string} query The user's latest message.
     * @param {object} settings The user settings.
     * @returns {{instruction: string, model: string}}
     */
    function getDynamicSystemInstructionAndModel(query, settings) {
        const user = settings.nickname;
        const userAge = settings.age > 0 ? `${settings.age} years old` : 'of unknown age';
        const userGender = settings.gender.toLowerCase();
        const userColor = settings.favoriteColor;
        const enableWebSearch = settings.enableWebSearch; // NEW

        const intent = determineIntentCategory(query);
        let model = 'gemini-2.5-flash-lite';
        let personaInstruction = `${FSP_HISTORY}

You are a highly capable and adaptable AI, taking on a persona to best serve the user's direct intent. You have significant control over the interaction's structure and detail level, ensuring the response is comprehensive and authoritative.
User Profile: Nickname: ${user}, Age: ${userAge}, Gender: ${userGender}, Favorite Color: ${userColor}.
Web Search Status: ${enableWebSearch ? 'ENABLED' : 'DISABLED'}. You MUST rely solely on your internal knowledge if Web Search is DISABLED.

Formatting Rules (MUST FOLLOW):
- For math, use KaTeX. Inline math uses single \`$\`, and display math uses double \`$$\`. Use \\le for <= and \\ge for >=.
- For graphs, use a 'graph' block as shown in the file's comments.
- **PREPEND your response with your reasoning/internal monologue wrapped in <THOUGHT_PROCESS>...</THOUGHT_PROCESS>**. This is mandatory for every response.
- **APPEND all external sources used (if any) as a list of tags**: <SOURCE URL="[URL]" TITLE="[Title]"/>. You may use placeholder URLs if no real search was performed, but the format must be followed.

`;

        switch (intent) {
            case 'DEEP_ANALYSIS':
                // Pro model access is removed, fallback to high-end Flash model.
                model = 'gemini-2.5-flash';
                personaInstruction += `\n\n**Current Persona: Professional Analyst (2.5-Flash).** You are performing a detailed analysis, but maintain efficiency and focus. Respond with clarity, professionalism, and structured data. Your response must be comprehensive, highly structured, and exhibit a deep level of reasoning and critical evaluation. Use an assertive, expert tone. Structure your analysis clearly with headings and bullet points.`;
                break;
            case 'PROFESSIONAL_MATH':
                model = 'gemini-2.5-flash';
                personaInstruction += `\n\n**Current Persona: Technical Expert (2.5-Flash).** Respond with extreme clarity, professionalism, and precision. Focus on step-by-step logic, equations, and definitive answers. Use a formal, neutral tone. Use KaTeX and custom graphs where appropriate.`;
                break;
            case 'CREATIVE':
                model = 'gemini-2.5-flash';
                const roastInsults = [
                    `They sound like a cheap knock-off of a decent human.`, 
                    `Honestly, you dodged a bullet the size of a planet.`, 
                    `Forget them, ${user}, you have better things to do, like talking to me.`,
                    `Wow, good riddance. That's a level of trash I wouldn't touch with a ten-foot pole.`
                ];
                const roastInsult = roastInsults[Math.floor(Math.random() * roastInsults.length)];

                // Combined Creative and Sarcastic
                if (query.toLowerCase().includes('ex') || query.toLowerCase().includes('roast')) {
                     personaInstruction += `\n\n**Current Persona: Sarcastic, Supportive Friend (2.5-Flash).** Your goal is to empathize with the user, validate their feelings, and join them in 'roasting' or speaking negatively about their ex/situation. Be funny, slightly aggressive toward the subject of trash talk, and deeply supportive of ${user}. Use casual language and slang. **Example of tone/support:** "${roastInsult}"`;
                } else {
                     personaInstruction += `\n\n**Current Persona: Creative Partner (25-Flash).** Use rich, evocative language. Be imaginative, focus on descriptive details, and inspire new ideas.`;
                }
                break;
            case 'CASUAL':
            default:
                model = 'gemini-2.5-flash-lite';
                personaInstruction += `\n\n**Current Persona: Standard Assistant (2.5-Flash-Lite).** You are balanced, helpful, and concise. Use a friendly and casual tone. Your primary function is efficient conversation. Make sure to be highly concise, making sure to not write too much.`;
                break;
        }

        return { instruction: personaInstruction, model: model };
    }

    // New stub for backward compatibility with the old function call
    function getDynamicSystemInstruction(query, settings) {
        return getDynamicSystemInstructionAndModel(query, settings).instruction;
    }


    async function callGoogleAI(responseBubble) {
        if (!API_KEY) { responseBubble.innerHTML = `<div class="ai-error">API Key is missing.</div>`; return; }
        currentAIRequestController = new AbortController();
        
        let firstMessageContext = '';
        if (chatHistory.length <= 1) {
            
            // Only fetch location if enabled, otherwise use a placeholder string
            const location = await getUserLocationForContext(); 
            
            const now = new Date();
            const date = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const time = now.toLocaleTimeString('en-US', { timeZoneName: 'short' });
            
            // Updated context to use the fetched location/status
            firstMessageContext = `(System Info: User is asking from location:\n${location}. Current date is ${date}, ${time}. User Email: Not Authenticated/Removed.)\n\n`;
        }
        
        let processedChatHistory = [...chatHistory];
        if (processedChatHistory.length > 6) {
             processedChatHistory = [ ...processedChatHistory.slice(0, 3), ...processedChatHistory.slice(-3) ];
        }

        const lastMessageIndex = processedChatHistory.length - 1;
        const userParts = processedChatHistory[lastMessageIndex].parts;
        const textPartIndex = userParts.findIndex(p => p.text);
        
        const lastUserQuery = userParts[textPartIndex]?.text || '';
        
        // --- MODEL SELECTION AND INSTRUCTION GENERATION ---
        const { instruction: dynamicInstruction, model } = getDynamicSystemInstructionAndModel(lastUserQuery, userSettings); 
        // --- END MODEL SELECTION ---

        if (textPartIndex > -1) {
             userParts[textPartIndex].text = firstMessageContext + userParts[textPartIndex].text;
        } else if (firstMessageContext) {
             userParts.unshift({ text: firstMessageContext.trim() });
        }
        
        const payload = { 
            contents: processedChatHistory, 
            systemInstruction: { parts: [{ text: dynamicInstruction }] } 
        };
        
        // --- DYNAMIC URL CONSTRUCTION ---
        const DYNAMIC_API_URL = `${BASE_API_URL}${model}:generateContent?key=${API_KEY}`; 
        // --- END DYNAMIC URL CONSTRUCTION ---
        
        try {
            const response = await fetch(DYNAMIC_API_URL, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(payload), 
                signal: currentAIRequestController.signal 
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Network response was not ok. Status: ${response.status}. Details: ${JSON.stringify(errorData)}`);
            }
            const data = await response.json();
            if (!data.candidates || data.candidates.length === 0) {
                if (data.promptFeedback && data.promptFeedback.blockReason) {
                    throw new Error(`Content blocked due to: ${data.promptFeedback.blockReason}. Safety ratings: ${JSON.stringify(data.promptFeedback.safetyRatings)}`);
                }
                throw new Error("Invalid response from API: No candidates or empty candidates array.");
            }
            
            const text = data.candidates[0].content.parts[0]?.text || '';
            if (!text) {
                responseBubble.innerHTML = `<div class="ai-error">The AI generated an empty response. Please try again or rephrase.</div>`;
                return;
            }

            chatHistory.push({ role: "model", parts: [{ text: text }] });
            
            // New parsing and rendering logic
            const { html: contentHTML, thoughtProcess, sourcesHTML } = parseGeminiResponse(text);
            
            responseBubble.style.opacity = '0';
            setTimeout(() => {
                let fullContent = `<div class="ai-response-content">${contentHTML}</div>`;
                
                // Sources first
                if (sourcesHTML) {
                    fullContent += sourcesHTML;
                }
                
                // Collapsible thought process
                if (thoughtProcess) {
                    fullContent += `
                        <div class="ai-thought-process collapsed">
                            <div class="monologue-header">
                                <h4 class="monologue-title">Gemini's Internal Monologue:</h4>
                                <button class="monologue-toggle-btn">Show Thoughts</button>
                            </div>
                            <pre class="monologue-content">${escapeHTML(thoughtProcess)}</pre>
                        </div>
                    `;
                }

                responseBubble.innerHTML = fullContent;

                // Add click handlers for monologue toggle
                responseBubble.querySelectorAll('.ai-thought-process').forEach(monologueDiv => {
                    monologueDiv.querySelector('.monologue-header').addEventListener('click', () => {
                        monologueDiv.classList.toggle('collapsed');
                        const btn = monologueDiv.querySelector('.monologue-toggle-btn');
                        if (monologueDiv.classList.contains('collapsed')) {
                            btn.textContent = 'Show Thoughts';
                        } else {
                            btn.textContent = 'Hide Thoughts';
                        }
                        // Scroll to the bottom if expanding
                        if (!monologueDiv.classList.contains('collapsed')) {
                            const responseContainer = document.getElementById('ai-response-container');
                            if(responseContainer) responseContainer.scrollTop = responseContainer.scrollHeight;
                        }
                    });
                });
                
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
                responseBubble.innerHTML = `<div class="ai-error">Sorry, an error occurred: ${error.message || "Unknown error"}.</div>`; 
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
    
    // --- STYLES INJECTION (Including new styles and modifications) ---
    function injectStyles() {
        // Load Font Awesome and KaTeX CSS (kept from original logic)
        if (!document.querySelector('link[href*="font-awesome"]')) {
            const faLink = document.createElement('link');
            faLink.rel = 'stylesheet';
            faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
            document.head.appendChild(faLink);
        }
        if (!document.getElementById('ai-katex-styles')) {
            const katexLink = document.createElement('link');
            katexLink.id = 'ai-katex-styles';
            katexLink.rel = 'stylesheet';
            katexLink.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.css';
            document.head.appendChild(katexLink);
        }

        let style = document.getElementById('ai-dynamic-styles');
        if (!style) {
            style = document.createElement('style');
            style.id = 'ai-dynamic-styles';
            document.head.appendChild(style);
        }

        // Variable for user color (kept from original logic)
        const userColor = userSettings.favoriteColor || DEFAULT_COLOR;
        
        // --- START NEW STYLES / MODIFICATIONS ---
        style.textContent = `
            :root {
                --user-color: ${userColor};
                --ai-monologue-bg: #1c1c1c; /* NEAR BLACK / DARK */
            }

            /* --- Base Container & Monologue Speed/Color --- */
            /* Ensure fast animation by setting transition time low */
            .ai-thought-process {
                background-color: var(--ai-monologue-bg); 
                transition: height 0.1s ease-in-out, background-color 0.1s; /* FAST ANIMATION */
                border: 1px solid #333;
                border-radius: 8px;
                overflow: hidden;
                margin-top: 10px;
            }
            .ai-thought-process.collapsed .monologue-content {
                height: 0;
                padding-top: 0;
                padding-bottom: 0;
            }
            .monologue-content {
                transition: height 0.1s ease-in-out, padding 0.1s; /* Ensure content also transitions fast */
            }
            .ai-thought-process pre {
                color: #ccc;
            }

            /* --- Settings Menu Styling (Modified) --- */
            #ai-settings-menu {
                display: flex;
                flex-direction: column;
                padding: 15px;
            }
            .menu-header {
                font-weight: bold;
                font-size: 1.2em;
                margin-bottom: 10px;
                color: #fff;
            }
            .setting-note-top {
                font-size: 0.8em;
                color: #aaa;
                margin-bottom: 15px;
            }
            .setting-group-toggles {
                margin-bottom: 15px;
                border-bottom: 1px solid #333;
                padding-bottom: 15px;
            }
            .setting-toggle {
                display: flex;
                flex-direction: column;
                margin-bottom: 10px;
            }
            .toggle-control-area {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 2px;
            }
            .toggle-title {
                font-weight: 500;
                font-size: 0.9em;
                color: #ccc;
            }
            .setting-description {
                font-size: 0.75em;
                color: #888;
                margin-left: 0; /* Align description */
            }

            /* --- Custom Checkbox Styles --- */
            .custom-checkbox-wrapper {
                position: relative;
                display: inline-block;
                cursor: pointer;
                width: 34px; /* Standard switch width */
                height: 20px; /* Standard switch height */
            }
            .custom-checkbox-hidden {
                opacity: 0;
                width: 0;
                height: 0;
            }
            .custom-checkbox-label {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: #555; /* Off state color */
                border-radius: 20px;
                transition: background-color 0.2s;
            }
            .custom-checkbox-label::before {
                content: "";
                position: absolute;
                left: 2px;
                bottom: 2px;
                width: 16px;
                height: 16px;
                background-color: white;
                border-radius: 50%;
                transition: transform 0.2s;
            }
            .custom-checkbox-hidden:checked + .custom-checkbox-label {
                background-color: var(--user-color); /* On state color */
            }
            .custom-checkbox-hidden:checked + .custom-checkbox-label::before {
                transform: translateX(14px);
            }

            /* --- Nearby Places Scroll Menu --- */
            .setting-group-scroll {
                margin-bottom: 10px;
                padding-bottom: 10px;
            }
            .scroll-header {
                font-weight: bold;
                font-size: 0.9em;
                margin-bottom: 5px;
                color: #ccc;
            }
            .nearby-places-scroll {
                display: flex;
                overflow-x: scroll;
                padding-bottom: 10px;
                gap: 10px;
                -webkit-overflow-scrolling: touch;
                /* Hide scrollbar */
                scrollbar-width: none; /* Firefox */
            }
            .nearby-places-scroll::-webkit-scrollbar {
                display: none; /* Chrome, Safari, Opera */
            }
            .place-card {
                flex: 0 0 auto; /* Prevent stretching/shrinking */
                width: 150px;
                background-color: #222;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5);
                border: 1px solid #333;
            }
            .place-image {
                width: 100%;
                height: 80px;
                object-fit: cover;
                display: block;
            }
            .place-info {
                padding: 8px;
            }
            .place-title {
                font-size: 0.85em;
                font-weight: bold;
                color: #fff;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .place-description {
                font-size: 0.7em;
                color: #999;
                height: 2.2em; /* 2 lines of text */
                overflow: hidden;
                text-overflow: ellipsis;
                margin-top: 2px;
            }
            
            #settings-save-button {
                margin-top: 15px;
            }
        `;
        // --- END NEW STYLES / MODIFICATIONS ---
    }
    // --- END STYLES INJECTION ---


    // --- NEW SETTINGS MENU LOGIC ---
    function toggleSettingsMenu() {
        const menu = document.getElementById('ai-settings-menu');
        const toggleBtn = document.getElementById('ai-settings-button');
        const isMenuOpen = menu.classList.toggle('active');
        toggleBtn.classList.toggle('active', isMenuOpen);
        if (isMenuOpen) {
            // Only set values for the two remaining toggles
            document.getElementById('settings-web-search').checked = userSettings.enableWebSearch;
            document.getElementById('settings-location-context').checked = userSettings.enableLocationContext;

            document.addEventListener('click', handleMenuOutsideClick);
        } else {
             document.removeEventListener('click', handleMenuOutsideClick);
        }
    }
    
    function handleMenuOutsideClick(event) {
        const menu = document.getElementById('ai-settings-menu');
        const button = document.getElementById('ai-settings-button');
        const composeArea = document.getElementById('ai-compose-area');

        if (menu.classList.contains('active') && !composeArea.contains(event.target) && event.target !== button && !button.contains(event.target)) {
            saveSettings();
            toggleSettingsMenu();
        }
    }

    function saveSettings() {
        // Removed personalization elements
        const webSearchEl = document.getElementById('settings-web-search');
        const locationContextEl = document.getElementById('settings-location-context');
        
        // Only saving the two feature flags
        userSettings.enableWebSearch = webSearchEl.checked;
        userSettings.enableLocationContext = locationContextEl.checked;
        localStorage.setItem('ai-user-settings', JSON.stringify(userSettings));
    }

    // UPDATED: Only contains Web Search, Location Context, and a scroll menu example.
    function createSettingsMenu() {
        const menu = document.createElement('div');
        menu.id = 'ai-settings-menu';
        menu.innerHTML = `
            <div class="menu-header">AI Agent Settings</div>
            <p class="setting-note-top">This menu now only contains features that directly affect the AI's response generation.</p>
            
            <div class="setting-group-toggles">
                <div class="setting-toggle">
                    <div class="toggle-control-area">
                        <label for="settings-web-search" class="toggle-title">Enable Web Search</label>
                        <div class="custom-checkbox-wrapper">
                            <input type="checkbox" id="settings-web-search" class="custom-checkbox-hidden" ${userSettings.enableWebSearch ? 'checked' : ''} />
                            <label for="settings-web-search" class="custom-checkbox-label"></label>
                        </div>
                    </div>
                    <p class="setting-description">Allows the AI to search the web for real-time information to answer your query.</p>
                </div>
                
                <div class="setting-toggle">
                    <div class="toggle-control-area">
                        <label for="settings-location-context" class="toggle-title">Share Location Context</label>
                        <div class="custom-checkbox-wrapper">
                            <input type="checkbox" id="settings-location-context" class="custom-checkbox-hidden" ${userSettings.enableLocationContext ? 'checked' : ''} />
                            <label for="settings-location-context" class="custom-checkbox-label"></label>
                        </div>
                    </div>
                    <p class="setting-description">Sends your approximate region and coordinates to the AI to provide relevant local answers.</p>
                </div>
            </div>
            
            <div class="setting-group-scroll">
                <div class="scroll-header">Nearby Places (Example)</div>
                <div class="nearby-places-scroll">
                    <div class="place-card">
                        <img src="https://via.placeholder.com/150/4285f4/FFFFFF?text=Coffee" alt="A coffee shop" class="place-image">
                        <div class="place-info">
                            <div class="place-title">The Daily Grind Cafe</div>
                            <div class="place-description">Popular spot for lattes and quick breakfast sandwiches.</div>
                        </div>
                    </div>
                    <div class="place-card">
                        <img src="https://via.placeholder.com/150/fbbc05/FFFFFF?text=Pizza" alt="A pizza restaurant" class="place-image">
                        <div class="place-info">
                            <div class="place-title">Mama Mia's Pizzeria</div>
                            <div class="place-description">Authentic Neapolitan pizza and local craft beers.</div>
                        </div>
                    </div>
                    <div class="place-card">
                        <img src="https://via.placeholder.com/150/34a853/FFFFFF?text=Park" alt="A public park" class="place-image">
                        <div class="place-info">
                            <div class="place-title">Central City Park</div>
                            <div class="place-description">Large green space with trails and picnic areas.</div>
                        </div>
                    </div>
                </div>
            </div>

            <button id="settings-save-button">Save</button>
        `; 
        
        const saveButton = menu.querySelector('#settings-save-button');
        const inputs = menu.querySelectorAll('input, select');
        const debouncedSave = debounce(saveSettings, 500);
        inputs.forEach(input => {
            input.addEventListener('input', debouncedSave);
            input.addEventListener('change', debouncedSave);
        });
        saveButton.onclick = () => {
            saveSettings();
            toggleSettingsMenu();
        };
        
        return menu;
    }

    function processFileLike(file, base64Data, dataUrl, tempId) {
        if (attachedFiles.length >= MAX_ATTACHMENTS_PER_MESSAGE) {
            alert(`You can attach a maximum of ${MAX_ATTACHMENTS_PER_MESSAGE} files per message.`);
            return;
        }
        const currentTotalSize = attachedFiles.reduce((sum, f) => sum + (f.inlineData ? atob(f.inlineData.data).length : 0), 0);
        if (currentTotalSize + file.size > (10 * 1024 * 1024)) {
            alert(`Upload failed: Total size of attachments would exceed the 10MB limit per message. (Current: ${formatBytes(currentTotalSize)}, Adding: ${formatBytes(file.size)})`);
            return;
        }
        const item = { inlineData: { mimeType: file.type, data: base64Data }, fileName: file.name || 'Pasted Image', fileContent: dataUrl, isLoading: false };
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
        input.accept = 'image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';
        input.onchange = (event) => {
            const files = Array.from(event.target.files);
            if (!files || files.length === 0) return;
            const filesToProcess = files.filter(file => {
                if (attachedFiles.length >= MAX_ATTACHMENTS_PER_MESSAGE) {
                    alert(`Cannot attach more than ${MAX_ATTACHMENTS_PER_MESSAGE} files. Skipping: ${file.name}`);
                    return false;
                }
                return true;
            });
            const currentTotalSize = attachedFiles.reduce((sum, file) => sum + (file.inlineData ? atob(file.inlineData.data).length : 0), 0);
            const newFilesSize = filesToProcess.reduce((sum, file) => sum + file.size, 0);
            if (currentTotalSize + newFilesSize > (10 * 1024 * 1024)) {
                alert(`Upload failed: Total size of attachments would exceed the 10MB limit per message. (Current: ${formatBytes(currentTotalSize)}, Adding: ${formatBytes(newFilesSize)})`);
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
                        delete item.file;
                        delete item.tempId;
                        renderAttachments();
                    }
                };
                reader.onerror = () => {
                    const itemIndex = attachedFiles.findIndex(f => f.tempId === tempId);
                    if (itemIndex > -1) {
                        attachedFiles.splice(itemIndex, 1);
                        renderAttachments();
                        alert(`Failed to read file: ${file.name}`);
                    }
                };
                reader.readAsDataURL(file);
            });
        };
        input.click();
    }
}())
