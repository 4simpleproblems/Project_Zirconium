/**
 * agent-activation.js
 *
 * MODIFIED: Refactored to remove Agent/Category system and implement a dynamic, context-aware AI persona.
 * REPLACED: Removed personalization features (nickname, color, gender, age).
 * NEW: Replaced old Settings Menu with a new one for "Web Search" and "Location Sharing" toggles, stored in localStorage.
 * NEW: The AI's system instruction (persona) now changes intelligently based on the content and tone of the user's latest message.
 * UI: Fixed background and title colors. Replaced Agent button with a grey Settings button.
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
 * UPDATED: Removed authenticated email feature.
 * REPLACED: Geolocation now uses browser's `navigator.geolocation` (with high accuracy) and Nominatim (OpenStreetMap) for reverse geocoding.
 * NEW: Added a "nudge" popup if AI needs web search but the setting is disabled.
 * UPDATED: Swapped order of monologue and sources. Monologue is now a collapsible dropdown.
 * CSS: Reduced margins between response content, sources, and monologue for a tighter layout.
 * MODIFIED: Location Sharing is now OFF by default.
 * MODIFIED: Web search prompt is more direct to improve search quality.
 *
 * --- UI/UX Update ---
 * NEW: Source list becomes scrollable if > 5 sources.
 * CSS: Reduced margin between response content and source list.
 * MODIFIED: Thought process (monologue) no longer includes the model name.
 * NEW: Thought process panel is hidden for simple/short thoughts (e.g., "Hi").
 * CSS: Thought process container is neutral when collapsed, blue when expanded.
 * CSS: Thought process collapse/expand animation is now faster (0.2s) and removes opacity fade.
 *
 * --- USER REQUESTS IMPLEMENTED ---
 * BRANDING: Agent name changed to "HUMANITY" and persistent title changed to "Humanity Agent".
 * GLOW: Rainbow glow keyframe replaced with "humanity-glow" (Cyan Blue: #00BCD4).
 * ACCURACY: Geolocation options updated to request high accuracy and a fresh location fix.
 * ---
 */
(function() {
    // --- CONFIGURATION ---
    const API_KEY = 'AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro';
    const BASE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/`;
    // const AUTHORIZED_PRO_USER = '4simpleproblems@gmail.com'; // REMOVED
    const MAX_INPUT_HEIGHT = 180;
    const CHAR_LIMIT = 10000;
    const PASTE_TO_FILE_THRESHOLD = 10000;
    const MAX_ATTACHMENTS_PER_MESSAGE = 10;
    const MONOLOGUE_CHAR_THRESHOLD = 75; // NEW: Don't show monologue if thoughts are shorter than this

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
    // NEW: Replaced userSettings with appSettings. Location sharing is now off by default.
    let appSettings = {
        webSearch: true,
        locationSharing: false
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
     * NEW: Loads app settings from localStorage on script initialization.
     */
    function loadAppSettings() {
        try {
            const storedSettings = localStorage.getItem('ai-app-settings');
            if (storedSettings) {
                const parsed = JSON.parse(storedSettings);
                // Ensure defaults are kept if properties are missing
                appSettings = {
                    ...appSettings,
                    ...parsed
                };
            }
        } catch (e) {
            console.error("Error loading app settings:", e);
        }
    }
    loadAppSettings(); // Load initial settings

    // --- UTILITIES FOR GEOLOCATION ---

    /**
     * NEW: Helper function for async HTTP GET request.
     */
    function httpGetAsync(url, callback) {
        const xmlHttp = new XMLHttpRequest();
        xmlHttp.onreadystatechange = function() {
            if (xmlHttp.readyState === 4) {
                if (xmlHttp.status === 200) {
                    callback(xmlHttp.responseText, null);
                } else {
                    callback(null, new Error(`HTTP Error: ${xmlHttp.status} ${xmlHttp.statusText}`));
                }
            }
        }
        xmlHttp.open("GET", url, true); // true for asynchronous
        xmlHttp.onerror = function() {
            callback(null, new Error("Network request failed"));
        };
        xmlHttp.send(null);
    }


    /**
     * REPLACED: Gets user location via Browser's Geolocation API, then reverse-geocodes it using Nominatim.
     * @returns {Promise<string>} Resolves with a human-readable address string or a fallback.
     */
    function getUserLocationForContext() {
        return new Promise((resolve) => {
            // Check the new appSetting
            if (!appSettings.locationSharing) {
                const fallback = 'Location Sharing is disabled by user.';
                localStorage.setItem('ai-user-location', fallback);
                resolve(fallback);
                return;
            }

            // Check if browser supports Geolocation
            if (!navigator.geolocation) {
                const fallback = 'Geolocation is not supported by this browser.';
                localStorage.setItem('ai-user-location', fallback);
                resolve(fallback);
                return;
            }

            // Browser API will prompt user for permission if not already granted
            navigator.geolocation.getCurrentPosition(
                // Success Callback: Got coordinates, now reverse geocode
                (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;

                    // NEW: Use Nominatim (OpenStreetMap) for reverse geocoding. No API key needed.
                    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=en`;

                    httpGetAsync(url, (response, error) => {
                        if (error) {
                            console.warn('Reverse geocoding failed:', error.message);
                            const fallback = `Coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)} (Reverse geocoding failed)`;
                            localStorage.setItem('ai-user-location', fallback);
                            resolve(fallback);
                        } else {
                            try {
                                const data = JSON.parse(response);
                                // NEW: Parse Nominatim's response format
                                if (data && data.display_name) {
                                    const locationString = data.display_name;
                                    localStorage.setItem('ai-user-location', locationString);
                                    resolve(locationString);
                                } else {
                                    throw new Error('No display_name in Nominatim response');
                                }
                            } catch (e) {
                                console.error('Failed to parse Nominatim response:', e);
                                const fallback = `Coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)} (Address parsing failed)`;
                                localStorage.setItem('ai-user-location', fallback);
                                resolve(fallback);
                            }
                        }
                    });
                },
                // Error Callback: Failed to get coordinates
                (error) => {
                    let fallback;
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            fallback = "Location permission denied by user.";
                            break;
                        case error.POSITION_UNAVAILABLE:
                            fallback = "Location information is unavailable.";
                            break;
                        case error.TIMEOUT:
                            fallback = "Location request timed out.";
                            break;
                        default:
                            fallback = "An unknown error occurred while getting location.";
                            break;
                    }
                    console.warn('Geolocation failed:', fallback);
                    localStorage.setItem('ai-user-location', fallback);
                    resolve(fallback);
                },
                // Options object to request high accuracy, a fresh fix (maximumAge: 0), and a 5-second timeout.
                // UPDATED: High Accuracy settings implemented per user request for map direction accuracy.
                {
                    enableHighAccuracy: true,
                    maximumAge: 0,
                    timeout: 5000
                }
            );
        });
    }


    // --- REPLACED/MODIFIED FUNCTIONS ---

    /**
     * Stub for authorization (email feature removed).
     * @returns {Promise<boolean>} Always resolves to true.
     */
    async function isUserAuthorized() {
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

        const padding = {
            top: 50,
            right: 30,
            bottom: 50,
            left: 60
        };
        const graphWidth = rect.width - padding.left - padding.right;
        const graphHeight = rect.height - padding.top - padding.bottom;

        // Determine data range
        let minX = Infinity,
            maxX = -Infinity,
            minY = Infinity,
            maxY = -Infinity;
        data.forEach(trace => {
            trace.x.forEach(val => {
                minX = Math.min(minX, val);
                maxX = Math.max(maxX, val);
            });
            trace.y.forEach(val => {
                minY = Math.min(minY, val);
                maxY = Math.max(maxY, val);
            });
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
        if (layout.xaxis?.title) ctx.fillText(layout.xaxis.title, padding.left + graphWidth / 2, rect.height - 10);
        ctx.save();
        ctx.rotate(-Math.PI / 2);
        if (layout.yaxis?.title) ctx.fillText(layout.yaxis.title, -(padding.top + graphHeight / 2), 20);
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
                if (selection.length > 0) {
                    return;
                }
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
        if (typeof window.startPanicKeyBlocker === 'function') {
            window.startPanicKeyBlocker();
        }

        attachedFiles = [];
        injectStyles();

        const container = document.createElement('div');
        container.id = 'ai-container';

        // USER REQUEST: Branding change (HUMANITY)
        const brandTitle = document.createElement('div');
        brandTitle.id = 'ai-brand-title';
        const brandText = "HUMANITY";
        brandText.split('').forEach(char => {
            const span = document.createElement('span');
            span.textContent = char;
            brandTitle.appendChild(span);
        });

        // USER REQUEST: Persistent title change ("Humanity Agent")
        const persistentTitle = document.createElement('div');
        persistentTitle.id = 'ai-persistent-title';
        persistentTitle.textContent = "Humanity Agent"; // Fixed title

        const welcomeMessage = document.createElement('div');
        welcomeMessage.id = 'ai-welcome-message';
        const welcomeHeader = chatHistory.length > 0 ? "Welcome Back" : "Welcome to Humanity Agent";
        // Updated welcome message to reflect location sharing.
        welcomeMessage.innerHTML = `<h2>${welcomeHeader}</h2><p>This is a beta feature. To improve your experience, your general location (if permitted) will be shared with your first message. You may be subject to message limits.</p><p class="shortcut-tip">(Press Ctrl + \\ to close)</p>`;

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

        composeArea.appendChild(createSettingsMenu()); // NEW: App settings menu
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

        if (chatHistory.length > 0) {
            renderChatHistory();
        }

        setTimeout(() => {
            if (chatHistory.length > 0) {
                container.classList.add('chat-active');
            }
            container.classList.add('active');
        }, 10);

        visualInput.focus();
        isAIActive = true;
    }

    function deactivateAI() {
        if (typeof window.stopPanicKeyBlocker === 'function') {
            window.stopPanicKeyBlocker();
        }
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
                if (katexCSS) katexCSS.remove();
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
                const {
                    html: parsedResponse,
                    thoughtProcess,
                    sourcesHTML
                } = parseGeminiResponse(message.parts[0].text);

                bubble.innerHTML = `<div class="ai-response-content">${parsedResponse}</div>`;

                // NEW: Sources first
                if (sourcesHTML) {
                    bubble.innerHTML += sourcesHTML;
                }

                // NEW: Collapsible thought process (with length check)
                if (thoughtProcess && thoughtProcess.length > MONOLOGUE_CHAR_THRESHOLD) {
                    bubble.innerHTML += `
                        <div class="ai-thought-process collapsed">
                            <div class="monologue-header">
                                <h4 class="monologue-title">Humanity's Internal Monologue:</h4>
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
                let bubbleContent = '';
                let textContent = '';
                let fileCount = 0;
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
        // Note: The gemini-2.5-pro model is no longer available via authorization in this code.
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
     * @param {object} currentSettings The current app settings (webSearch, locationSharing).
     * @returns {{instruction: string, model: string}}
     */
    function getDynamicSystemInstructionAndModel(query, currentSettings) {
        // REMOVED: Personalization features
        // const user = settings.nickname;
        // const userAge = settings.age > 0 ? `${settings.age} years old` : 'of unknown age';
        // const userGender = settings.gender.toLowerCase();
        // const userColor = settings.favoriteColor;

        const intent = determineIntentCategory(query);
        let model = 'gemini-2.5-flash-lite';
        let personaInstruction = `${FSP_HISTORY}

You are a highly capable and adaptable AI, taking on a persona to best serve the user's direct intent. You have significant control over the interaction's structure and detail level, ensuring the response is comprehensive and authoritative.
REMOVED: User Profile.
You must adapt your persona, tone, and the level of detail based on the user's intent.

Formatting Rules (MUST FOLLOW):
- For math, use KaTeX. Inline math uses single \`$\`, and display math uses double \`$$\`. Use \\le for <= and \\ge for >=.
- For graphs, use a 'graph' block as shown in the file's comments.
- **PREPEND your response with your reasoning/internal monologue wrapped in <THOUGHT_PROCESS>...</THOUGHT_PROCESS>**. This is mandatory for every response.
- **APPEND all external sources used (if any) as a list of tags**: <SOURCE URL="[URL]" TITLE="[Title]"/>. You may use placeholder URLs if no real search was performed, but the format must be followed.
`;

        // NEW: Add web search instruction (MODIFIED for clarity and forcefulness)
        if (currentSettings.webSearch) {
            personaInstruction += `\n**Web Search: ENABLED.** You have access to a live web search tool. You **must** use this tool to find real-time information or answer questions about current events, specific facts, people, companies, or places. Prioritize recent, authoritative sources. When you use a source, you **must** append it using the <SOURCE URL="..." TITLE="..."/> format.\n`;
        } else {
            personaInstruction += `\n**Web Search: DISABLED.** You must answer using only your internal knowledge. Your knowledge cutoff is limited. If you CANNOT answer without a web search, you MUST include the exact string \`[NEEDS_WEB_SEARCH]\` in your response and explain that you need web access to answer fully.\n`;
        }


        switch (intent) {
            case 'DEEP_ANALYSIS':
                // Pro model access is removed, fallback to high-end Flash model.
                model = 'gemini-2.5-flash';
                // MODIFIED: Removed model name from thought
                personaInstruction += `\n\n**Current Persona: Professional Analyst.** You are performing a detailed analysis, but maintain efficiency and focus. Respond with clarity, professionalism, and structured data. Your response must be comprehensive, highly structured, and exhibit a deep level of reasoning and critical evaluation. Use an assertive, expert tone. Structure your analysis clearly with headings and bullet points.`;
                break;
            case 'PROFESSIONAL_MATH':
                model = 'gemini-2.5-flash';
                // MODIFIED: Removed model name from thought
                personaInstruction += `\n\n**Current Persona: Technical Expert.** Respond with extreme clarity, professionalism, and precision. Focus on step-by-step logic, equations, and definitive answers. Use a formal, neutral tone. Use KaTeX and custom graphs where appropriate.`;
                break;
            case 'CREATIVE':
                model = 'gemini-2.5-flash';
                const roastInsults = [
                    `They sound like a cheap knock-off of a decent human.`,
                    `Honestly, you dodged a bullet the size of a planet.`,
                    `Forget them, you have better things to do, like talking to me.`,
                    `Wow, good riddance. That's a level of trash I wouldn't touch with a ten-foot pole.`
                ];
                const roastInsult = roastInsults[Math.floor(Math.random() * roastInsults.length)];

                // Combined Creative and Sarcastic
                if (query.toLowerCase().includes('ex') || query.toLowerCase().includes('roast')) {
                    // MODIFIED: Removed model name from thought
                    personaInstruction += `\n\n**Current Persona: Sarcastic, Supportive Friend.** Your goal is to empathize with the user, validate their feelings, and join them in 'roasting' or speaking negatively about their ex/situation. Be funny, slightly aggressive toward the subject of trash talk, and deeply supportive of the user. Use casual language and slang. **Example of tone/support:** "${roastInsult}"`;
                } else {
                    // MODIFIED: Removed model name from thought
                    personaInstruction += `\n\n**Current Persona: Creative Partner.** Use rich, evocative language. Be imaginative, focus on descriptive details, and inspire new ideas.`;
                }
                break;
            case 'CASUAL':
            default:
                model = 'gemini-2.5-flash-lite';
                // MODIFIED: Removed model name from thought
                personaInstruction += `\n\n**Current Persona: Standard Assistant.** You are balanced, helpful, and concise. Use a friendly and casual tone. Your primary function is efficient conversation. Make sure to be highly concise, making sure to not write too much.`;
                break;
        }

        return {
            instruction: personaInstruction,
            model: model
        };
    }

    // New stub for backward compatibility with the old function call
    function getDynamicSystemInstruction(query, settings) {
        return getDynamicSystemInstructionAndModel(query, settings).instruction;
    }

    /**
     * NEW: Creates a simple popup to nudge user to enable web search.
     */
    function showWebSearchNudge() {
        if (document.getElementById('ai-web-search-nudge')) return;

        const nudge = document.createElement('div');
        nudge.id = 'ai-web-search-nudge';
        nudge.innerHTML = `
            <div class="nudge-content">
                <p>To get answers about current events or specific facts, enable Web Search in settings.</p>
                <div class="nudge-buttons">
                    <button id="nudge-dismiss">Dismiss</button>
                    <button id="nudge-open-settings">Open Settings</button>
                </div>
            </div>
        `;
        document.body.appendChild(nudge);

        const dismiss = () => nudge.remove();
        nudge.querySelector('#nudge-dismiss').onclick = dismiss;
        nudge.querySelector('#nudge-open-settings').onclick = () => {
            const menu = document.getElementById('ai-settings-menu');
            const toggleBtn = document.getElementById('ai-settings-button');
            if (menu && !menu.classList.contains('active')) {
                toggleSettingsMenu();
            }
            dismiss();
        };
    }


    async function callGoogleAI(responseBubble) {
        if (!API_KEY) {
            responseBubble.innerHTML = `<div class="ai-error">API Key is missing.</div>`;
            return;
        }
        currentAIRequestController = new AbortController();

        let firstMessageContext = '';
        if (chatHistory.length <= 1) {
            // Await location for context (will respect the setting and reverse geocode)
            const location = await getUserLocationForContext();
            const now = new Date();
            const date = now.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            const time = now.toLocaleTimeString('en-US', {
                timeZoneName: 'short'
            });
            // Updated system info to reflect removed email feature
            firstMessageContext = `(System Info: User is asking from location:\n${location}. Current date is ${date}, ${time}. User Email: Not Authenticated/Removed.)\n\n`;
        }

        let processedChatHistory = [...chatHistory];
        if (processedChatHistory.length > 6) {
            processedChatHistory = [...processedChatHistory.slice(0, 3), ...processedChatHistory.slice(-3)];
        }

        const lastMessageIndex = processedChatHistory.length - 1;
        const userParts = processedChatHistory[lastMessageIndex].parts;
        const textPartIndex = userParts.findIndex(p => p.text);

        const lastUserQuery = userParts[textPartIndex]?.text || '';

        // --- MODEL SELECTION AND INSTRUCTION GENERATION ---
        // UPDATED: Pass appSettings instead of userSettings
        const {
            instruction: dynamicInstruction,
            model
        } = getDynamicSystemInstructionAndModel(lastUserQuery, appSettings);
        // --- END MODEL SELECTION ---

        if (textPartIndex > -1) {
            userParts[textPartIndex].text = firstMessageContext + userParts[textPartIndex].text;
        } else if (firstMessageContext) {
            userParts.unshift({
                text: firstMessageContext.trim()
            });
        }

        const payload = {
            contents: processedChatHistory,
            systemInstruction: {
                parts: [{
                    text: dynamicInstruction
                }]
            }
        };

        // --- DYNAMIC URL CONSTRUCTION ---
        const DYNAMIC_API_URL = `${BASE_API_URL}${model}:generateContent?key=${API_KEY}`;
        // --- END DYNAMIC URL CONSTRUCTION ---

        try {
            const response = await fetch(DYNAMIC_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
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

            let text = data.candidates[0].content.parts[0]?.text || '';
            if (!text) {
                responseBubble.innerHTML = `<div class="ai-error">The AI generated an empty response. Please try again or rephrase.</div>`;
                return;
            }

            // NEW: Check for web search requirement
            if (text.includes('[NEEDS_WEB_SEARCH]')) {
                setTimeout(showWebSearchNudge, 500); // Show nudge after response renders
                text = text.replace(/\[NEEDS_WEB_SEARCH\]/g, ''); // Remove token
            }

            chatHistory.push({
                role: "model",
                parts: [{
                    text: text
                }]
            });

            // New parsing and rendering logic
            const {
                html: contentHTML,
                thoughtProcess,
                sourcesHTML
            } = parseGeminiResponse(text);

            responseBubble.style.opacity = '0';
            setTimeout(() => {
                let fullContent = `<div class="ai-response-content">${contentHTML}</div>`;

                // NEW: Sources first
                if (sourcesHTML) {
                    fullContent += sourcesHTML;
                }

                // NEW: Collapsible thought process (with length check)
                if (thoughtProcess && thoughtProcess.length > MONOLOGUE_CHAR_THRESHOLD) {
                    fullContent += `
                        <div class="ai-thought-process collapsed">
                            <div class="monologue-header">
                                <h4 class="monologue-title">Humanity's Internal Monologue:</h4>
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
                            if (responseContainer) responseContainer.scrollTop = responseContainer.scrollHeight;
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
            if (error.name === 'AbortError') {
                responseBubble.innerHTML = `<div class="ai-error">Message generation stopped.</div>`;
            } else {
                console.error('AI API Error:', error);
                responseBubble.innerHTML = `<div class="ai-error">Sorry, an error occurred: ${error.message || "Unknown error"}.</div>`;
            }
        } finally {
            isRequestPending = false;
            currentAIRequestController = null;
            const inputWrapper = document.getElementById('ai-input-wrapper');
            if (inputWrapper) {
                inputWrapper.classList.remove('waiting');
            }
            setTimeout(() => {
                responseBubble.classList.remove('loading');
                const responseContainer = document.getElementById('ai-response-container');
                if (responseContainer) responseContainer.scrollTop = responseContainer.scrollHeight;
            }, 300);
            const editor = document.getElementById('ai-input');
            if (editor) {
                editor.contentEditable = true;
                editor.focus();
            }
        }
    }
    // --- NEW SETTINGS MENU LOGIC ---
    function toggleSettingsMenu() {
        const menu = document.getElementById('ai-settings-menu');
        const toggleBtn = document.getElementById('ai-settings-button');
        const isMenuOpen = menu.classList.toggle('active');
        toggleBtn.classList.toggle('active', isMenuOpen);

        if (isMenuOpen) {
            // Load current settings into toggles
            document.getElementById('settings-web-search').checked = appSettings.webSearch;
            document.getElementById('settings-location-sharing').checked = appSettings.locationSharing;
            document.addEventListener('click', handleMenuOutsideClick);
        } else {
            document.removeEventListener('click', handleMenuOutsideClick);
        }
    }

    function handleMenuOutsideClick(event) {
        const menu = document.getElementById('ai-settings-menu');
        const button = document.getElementById('ai-settings-button');
        const composeArea = document.getElementById('ai-compose-area');
        if (menu && menu.classList.contains('active') && !composeArea.contains(event.target) && event.target !== button && !button.contains(event.target)) {
            // No explicit save button, settings are saved on change, so just close.
            toggleSettingsMenu();
        }
    }

    /**
     * NEW: Saves the app settings (toggles) to localStorage.
     */
    function saveAppSettings() {
        try {
            localStorage.setItem('ai-app-settings', JSON.stringify(appSettings));
        } catch (e) {
            console.error("Error saving app settings:", e);
        }
    }

    /**
     * REPLACED: Creates the new settings menu with two toggles.
     */
    function createSettingsMenu() {
        const menu = document.createElement('div');
        menu.id = 'ai-settings-menu';
        menu.innerHTML = `
            <div class="menu-header">AI Agent Settings</div>
            <div class="setting-group toggle-group">
                <div class="setting-label">
                    <label for="settings-web-search">Web Search</label>
                    <p class="setting-note">Allow AI to search the internet for current events and facts.</p>
                </div>
                <label class="ai-toggle-switch">
                    <input type="checkbox" id="settings-web-search" ${appSettings.webSearch ? 'checked' : ''}>
                    <span class="ai-slider"></span>
                </label>
            </div>
            <div class="setting-group toggle-group">
                <div class="setting-label">
                    <label for="settings-location-sharing">Location Sharing</label>
                    <p class="setting-note">Share precise location for context-aware responses (e.g., weather).</p>
                </div>
                <label class="ai-toggle-switch">
                    <input type="checkbox" id="settings-location-sharing" ${appSettings.locationSharing ? 'checked' : ''}>
                    <span class="ai-slider"></span>
                </label>
            </div>
        `;

        // Add event listeners to toggles
        menu.querySelector('#settings-web-search').addEventListener('change', (e) => {
            appSettings.webSearch = e.target.checked;
            saveAppSettings();
        });

        menu.querySelector('#settings-location-sharing').addEventListener('change', (e) => {
            appSettings.locationSharing = e.target.checked;
            saveAppSettings();
            // Note: We don't need to request permission here.
            // The permission will be requested by the browser when getUserLocationForContext is called.
        });

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

        const item = {
            inlineData: {
                mimeType: file.type,
                data: base64Data
            },
            fileName: file.name || 'Pasted Image',
            fileContent: dataUrl,
            isLoading: false
        };
        if (tempId) {
            item.tempId = tempId;
        }
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
                alert(`Upload failed: Total size of attachments would exceed the 10MB limit per message. (Current: ${formatBytes(currentTotalSize)}, New: ${formatBytes(newFilesSize)})`);
                return;
            }

            filesToProcess.forEach(file => {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const dataUrl = e.target.result;
                    const base64Data = dataUrl.split(',')[1];
                    processFileLike(file, base64Data, dataUrl);
                };
                reader.onerror = function() {
                    alert(`Failed to read file: ${file.name}`);
                };
                reader.readAsDataURL(file);
            });
        };
        input.click();
    }

    function handlePaste(event) {
        let handled = false;
        if (event.clipboardData && event.clipboardData.files.length > 0) {
            const files = Array.from(event.clipboardData.files);
            files.forEach(file => {
                // Heuristically check if it's an image or something we want to process
                if (file.type.startsWith('image/') || file.type === 'application/pdf') {
                    event.preventDefault(); // Prevent default text input
                    handled = true;
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        const dataUrl = e.target.result;
                        const base64Data = dataUrl.split(',')[1];
                        // Use a temporary ID for immediate rendering and placeholder
                        const tempId = `paste-${Date.now()}`;
                        processFileLike(file, base64Data, dataUrl, tempId);
                        // Remove the temp ID later if needed, but for now, it's just a regular attachment.
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        const text = event.clipboardData.getData('text/plain');
        if (!handled && text.length > PASTE_TO_FILE_THRESHOLD && document.getElementById('ai-input').innerText.length === 0) {
            event.preventDefault(); // Prevent default text input
            handled = true;
            // Treat large paste as a document attachment
            const file = new Blob([text], {
                type: 'text/plain'
            });
            file.name = `Pasted_Document_${Date.now()}.txt`;
            file.lastModifiedDate = new Date();

            const reader = new FileReader();
            reader.onload = function(e) {
                const dataUrl = e.target.result;
                const base64Data = dataUrl.split(',')[1];
                processFileLike(file, base64Data, dataUrl);
            };
            reader.readAsDataURL(file);
        }

        // Allow text paste if not handled as a file or large document
    }


    function removeAttachment(index) {
        attachedFiles.splice(index, 1);
        renderAttachments();
    }

    function renderAttachments() {
        const previewContainer = document.getElementById('ai-attachment-preview');
        if (!previewContainer) return;
        previewContainer.innerHTML = '';

        attachedFiles.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'attachment-item';
            item.title = file.fileName;

            let icon = '';
            if (file.inlineData.mimeType.startsWith('image/')) {
                icon = `<img src="${file.fileContent}" alt="${file.fileName}" onerror="this.src='data:image/svg+xml,...'" />`;
            } else if (file.inlineData.mimeType.includes('pdf')) {
                icon = `<i class="fa-solid fa-file-pdf"></i>`;
            } else if (file.inlineData.mimeType.includes('word')) {
                icon = `<i class="fa-solid fa-file-word"></i>`;
            } else if (file.inlineData.mimeType.includes('text')) {
                icon = `<i class="fa-solid fa-file-lines"></i>`;
            } else {
                icon = `<i class="fa-solid fa-file"></i>`;
            }

            item.innerHTML = `
                <div class="attachment-icon">${icon}</div>
                <div class="attachment-details">
                    <span class="attachment-filename">${file.fileName}</span>
                </div>
                <button class="remove-attachment" onclick="window.removeAIAttachment(${index})">&times;</button>
            `;
            previewContainer.appendChild(item);
        });

        // Expose a global function for the dynamic button click (since this is not a module)
        window.removeAIAttachment = removeAttachment;

        // Toggle attachment button visibility
        const attachButton = document.getElementById('ai-attachment-button');
        if (attachButton) {
            attachButton.style.opacity = attachedFiles.length >= MAX_ATTACHMENTS_PER_MESSAGE ? '0.5' : '1';
            attachButton.style.cursor = attachedFiles.length >= MAX_ATTACHMENTS_PER_MESSAGE ? 'not-allowed' : 'pointer';
        }

        const inputWrapper = document.getElementById('ai-input-wrapper');
        if (inputWrapper) {
            inputWrapper.classList.toggle('has-attachments', attachedFiles.length > 0);
        }
    }

    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    function formatCharLimit(limit) {
        if (limit >= 1000) {
            return (limit / 1000) + 'k';
        }
        return limit;
    }

    function handleContentEditableInput(event) {
        const input = event.target;
        const textLength = input.innerText.length;
        const charCounter = document.getElementById('ai-char-counter');
        const inputWrapper = document.getElementById('ai-input-wrapper');
        const submitButton = document.getElementById('ai-submit-button');

        // Update character counter
        if (charCounter) {
            charCounter.textContent = `${textLength} / ${formatCharLimit(CHAR_LIMIT)}`;
            charCounter.classList.toggle('over-limit', textLength > CHAR_LIMIT);
        }

        // Adjust height
        input.style.height = 'auto'; // Reset height
        let newHeight = input.scrollHeight;

        if (newHeight > MAX_INPUT_HEIGHT) {
            input.style.overflowY = 'auto';
            newHeight = MAX_INPUT_HEIGHT;
        } else {
            input.style.overflowY = 'hidden';
        }
        input.style.height = `${newHeight}px`;

        // Style change for send button (removed, but good practice to keep the logic)
        const hasContent = textLength > 0 || attachedFiles.length > 0;
        if (inputWrapper) {
            inputWrapper.classList.toggle('has-content', hasContent);
        }
    }

    function handleInputSubmission(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }

    function sendMessage() {
        if (isRequestPending) return;

        const input = document.getElementById('ai-input');
        const query = input.innerText.trim();
        const textLength = query.length;

        if (textLength > CHAR_LIMIT) {
            alert(`Your message is too long. Please reduce it to under ${CHAR_LIMIT} characters.`);
            return;
        }

        if (textLength === 0 && attachedFiles.length === 0) {
            input.innerText = '';
            handleContentEditableInput({
                target: input
            }); // Reset height
            return;
        }

        const responseContainer = document.getElementById('ai-response-container');
        const welcomeMessage = document.getElementById('ai-welcome-message');
        const inputWrapper = document.getElementById('ai-input-wrapper');

        // Hide welcome message after first send
        if (welcomeMessage) {
            welcomeMessage.style.display = 'none';
        }
        if (responseContainer) {
            responseContainer.classList.add('chat-active');
            document.getElementById('ai-container').classList.add('chat-active');
        }

        // 1. Create user message
        const userMessage = {
            role: "user",
            parts: []
        };
        if (query) {
            userMessage.parts.push({
                text: query
            });
        }
        attachedFiles.forEach(file => {
            userMessage.parts.push({
                inlineData: file.inlineData
            });
        });
        chatHistory.push(userMessage);

        // 2. Clear input and attachments
        input.innerText = '';
        input.focus();
        attachedFiles = [];
        renderAttachments();
        handleContentEditableInput({
            target: input
        });

        // 3. Render user message bubble
        renderChatHistory(); // Rerender history to show latest user message

        // 4. Create model response placeholder (loading state)
        const responseBubble = document.createElement('div');
        responseBubble.className = 'ai-message-bubble gemini-response loading';
        responseBubble.innerHTML = `<div class="ai-loading-spinner"></div><p>Thinking...</p>`;
        responseContainer.appendChild(responseBubble);
        responseContainer.scrollTop = responseContainer.scrollHeight;

        // 5. Start API call
        isRequestPending = true;
        if (inputWrapper) {
            inputWrapper.classList.add('waiting');
        }
        input.contentEditable = false; // Disable input while waiting

        callGoogleAI(responseBubble);
    }

    /**
     * Parses the raw Gemini response text, separating out the thought process,
     * main content, and source tags.
     * @param {string} rawText The raw response text from the model.
     * @returns {{html: string, thoughtProcess: string, sourcesHTML: string}}
     */
    function parseGeminiResponse(rawText) {
        let thoughtProcess = '';
        let content = rawText;
        const sources = [];

        // 1. Extract Thought Process (must be at the start)
        const thoughtMatch = content.match(/<THOUGHT_PROCESS>([\s\S]*?)<\/THOUGHT_PROCESS>/);
        if (thoughtMatch) {
            thoughtProcess = thoughtMatch[1].trim();
            content = content.replace(thoughtMatch[0], '').trim();
        }

        // 2. Extract Sources (must be at the end)
        const sourceRegex = /<SOURCE\s+URL="([^"]+)"\s+TITLE="([^"]+)"\s*\/>/g;
        let sourceMatch;
        const contentWithoutSources = content.replace(sourceRegex, (match, url, title) => {
            sources.push({
                url: url,
                title: title
            });
            return ''; // Remove from content
        }).trim();

        content = contentWithoutSources; // Update content after removing sources

        // 3. Process the remaining content (Markdown, KaTeX, Code Blocks, Graphs)
        let html = convertMarkdownToHTML(content);

        // 4. Format Sources HTML
        let sourcesHTML = '';
        if (sources.length > 0) {
            const listItems = sources.map(s => `<li><a href="${s.url}" target="_blank" rel="noopener noreferrer">${escapeHTML(s.title || s.url)}</a></li>`).join('');
            sourcesHTML = `
                <div class="ai-sources-container ${sources.length > 5 ? 'scrollable' : ''}">
                    <h4>External Sources (${sources.length})</h4>
                    <ul>${listItems}</ul>
                </div>
            `;
        }

        return {
            html: html,
            thoughtProcess: thoughtProcess,
            sourcesHTML: sourcesHTML
        };
    }

    // Utility function to safely escape HTML content
    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }


    /**
     * Converts a subset of Markdown (headers, lists, bold, italics, code, quotes)
     * and custom blocks (KaTeX, Graph) to HTML.
     * @param {string} markdown The raw markdown content.
     * @returns {string} The HTML string.
     */
    function convertMarkdownToHTML(markdown) {
        // Ensure the string is trimmed and has some content
        if (!markdown || typeof markdown !== 'string') return '';

        let html = escapeHTML(markdown); // Start by escaping the whole string

        // 1. Custom Block Detection: Graph (must be done first to protect internal content)
        // Detects the custom ```graph ... ``` block
        html = html.replace(/```graph\s*([\s\S]*?)\s*```/g, (match, graphData) => {
            const placeholderId = `graph-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            return `<div class="custom-graph-placeholder" data-graph-data="${encodeURIComponent(graphData)}"><canvas id="${placeholderId}"></canvas></div>`;
        });

        // 2. Custom Block Detection: KaTeX (must be done early)
        // Detects $$ display math $$
        html = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, tex) => {
            // Unescape inner content for KaTeX processing
            tex = unescapeHTML(tex);
            return `<div class="latex-render display-math" data-tex="${escapeHTML(tex)}" data-display-mode="true"></div>`;
        });

        // 3. Code Block Detection (``` code ```)
        // Detects ```language ... ```
        html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            lang = lang ? lang.trim() : 'plaintext';
            // Unescape the inner code content
            const unescapedCode = unescapeHTML(code);
            // Re-escape to safely put into the <pre> block
            const escapedCode = escapeHTML(unescapedCode);
            return `
                <div class="code-block">
                    <div class="code-header">
                        <span class="code-language">${lang}</span>
                        <button class="copy-code-btn" data-code="${escapeHTML(unescapedCode)}">${copyIconSVG} Copy Code</button>
                    </div>
                    <pre><code class="language-${lang}">${escapedCode}</code></pre>
                </div>
            `;
        });


        // Re-Unescape the entire content (except the protected custom blocks and code)
        // This is complex. A better approach is to process in blocks.
        // For simplicity, let's process the rest of the text line-by-line and unescape later.
        html = unescapeHTML(html); // Unescape the entire thing before general markdown processing.

        // 4. Inline Code (`code`)
        html = html.replace(/`([^`]+)`/g, (match, code) => {
            return `<code class="inline-code">${code}</code>`;
        });

        // 5. Inline KaTeX ($ math $)
        html = html.replace(/\$([^$]+?)\$/g, (match, tex) => {
            return `<span class="latex-render" data-tex="${escapeHTML(tex.trim())}" data-display-mode="false"></span>`;
        });

        // 6. Basic Formatting (Bold, Italics, Blockquotes, Headers)
        // Blockquote
        html = html.replace(/^> (.*)$/gm, (match, p1) => `<blockquote>${p1}</blockquote>`);

        // Headers
        html = html.replace(/^### (.*)$/gm, (match, p1) => `<h3>${p1}</h3>`);
        html = html.replace(/^## (.*)$/gm, (match, p1) => `<h2>${p1}</h2>`);
        html = html.replace(/^# (.*)$/gm, (match, p1) => `<h1>${p1}</h1>`);

        // Unordered Lists
        html = html.replace(/^(\s*)[*-] (.*)$/gm, (match, p1, p2) => `${p1}<li>${p2}</li>`);
        // Ordered Lists (1., 2., etc.)
        html = html.replace(/^(\s*)\d+\. (.*)$/gm, (match, p1, p2) => `${p1}<li>${p2}</li>`);

        // Wrap list items in <ul> and <ol>
        html = html.replace(/(^|\n)((\s*<li>.*<\/li>\s*)+)/g, (match, p1, p2) => {
            // Check if the list items are indented. Simple implementation: assume no indentation means <ul>
            if (p2.startsWith(' ')) {
                // If it starts with space, it's a nested list, leave it alone for this simple parser
                return match;
            }
            // Simple check to see if we can assume it's an ordered list (starts with 1.)
            const isOrdered = p2.match(/<li[^>]*>\s*\d+\.\s/);
            const tag = isOrdered ? 'ol' : 'ul';
            // Clean up list numbering in simple parser by only taking the content of the list item.
            p2 = p2.replace(/<li[^>]*>\s*\d+\.\s*/g, '<li>');
            return `${p1}<${tag}>${p2}</${tag}>`;
        });


        // Bold and Italic (Must be done after headers and lists)
        html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>'); // Bold & Italic
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // Bold
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>'); // Italic

        // Line breaks (convert newlines not within blocks to <br>)
        html = html.split('\n').map(line => {
            // Don't wrap lines that are already block-level elements
            if (line.match(/^(<h|<ul|<ol|<blockquote|<div class="code-block"|<div class="latex-render"|<div class="custom-graph-placeholder")/i) || line.trim() === '') {
                return line;
            }
            return `<p>${line}</p>`;
        }).join('\n');

        // Cleanup: remove multiple empty lines
        html = html.replace(/\n\s*\n/g, '\n');

        return html.trim();
    }

    // Helper to reverse the basic escaping (needed for inner content of blocks)
    function unescapeHTML(str) {
        if (!str) return '';
        return str.replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'")
            .replace(/&amp;/g, '&');
    }

    /**
     * Handles copying code from a code block button.
     * @param {Event} e The click event.
     */
    function handleCopyCode(e) {
        const button = e.currentTarget;
        const codeText = button.dataset.code;

        navigator.clipboard.writeText(codeText).then(() => {
            const originalHTML = button.innerHTML;
            button.innerHTML = `${checkIconSVG} Copied!`;
            setTimeout(() => {
                button.innerHTML = originalHTML;
            }, 2000);
        }).catch(err => {
            console.error('Could not copy text: ', err);
            alert('Failed to copy code to clipboard.');
        });
    }


    /**
     * Injects the necessary CSS styles into the document head.
     */
    function injectStyles() {
        if (document.getElementById('ai-dynamic-styles')) return;

        // Add Font Awesome for icons (if not present)
        if (!document.querySelector('link[href*="font-awesome"]')) {
            const faLink = document.createElement('link');
            faLink.rel = 'stylesheet';
            faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
            faLink.id = 'ai-font-awesome-styles';
            document.head.appendChild(faLink);
        }

        // Add KaTeX CSS
        const katexLink = document.createElement('link');
        katexLink.rel = 'stylesheet';
        katexLink.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.css';
        katexLink.id = 'ai-katex-styles';
        document.head.appendChild(katexLink);

        // Add Google Fonts
        const fontLink = document.createElement('link');
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400..700;1,400..700&family=Merriweather:wght@300;400;700&display=swap';
        fontLink.id = 'ai-google-fonts';
        document.head.appendChild(fontLink);


        const style = document.createElement('style');
        style.id = 'ai-dynamic-styles';
        style.textContent = `
            :root {
                /* REPLACED: Updated branding colors */
                --ai-primary-color: #00BCD4; /* Cyan Blue */
                --ai-background-dark: #1f1f1f;
                --ai-text-light: #f0f0f0;
                --ai-text-mid: #cccccc;
                --ai-text-dark: #888888;
                --ai-input-bg: #2b2b2b;
                --ai-border-color: #3a3a3a;
                --ai-link-color: #4CAF50; /* Green highlight for links/sources */
                --ai-error-color: #f44336;
            }

            #ai-container {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: min(90vw, 500px);
                max-height: min(90vh, 750px);
                background-color: var(--ai-background-dark);
                color: var(--ai-text-light);
                border: 1px solid var(--ai-border-color);
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
                display: flex;
                flex-direction: column;
                z-index: 10000;
                font-family: 'Lora', Georgia, serif;
                transform: scale(0.95);
                opacity: 0;
                transition: transform 0.3s ease-out, opacity 0.3s ease-out;
                overflow: hidden;
            }

            #ai-container.active {
                transform: scale(1);
                opacity: 1;
            }

            #ai-container.deactivating {
                transform: scale(0.95);
                opacity: 0;
            }

            /* --- HEADER/TITLE/BRANDING --- */
            #ai-brand-title {
                position: absolute;
                top: 0;
                left: 0;
                padding: 15px 20px;
                font-family: 'Merriweather', serif;
                font-size: 1.2em;
                font-weight: 700;
                color: var(--ai-text-light);
                opacity: 0.1;
                pointer-events: none;
                z-index: 10;
            }
            #ai-brand-title span {
                opacity: 0; /* Hidden by default */
                animation: humanity-glow-text 3s infinite alternate ease-in-out; /* Custom glow */
            }
            #ai-brand-title span:nth-child(1) { animation-delay: 0s; }
            #ai-brand-title span:nth-child(2) { animation-delay: 0.1s; }
            #ai-brand-title span:nth-child(3) { animation-delay: 0.2s; }
            #ai-brand-title span:nth-child(4) { animation-delay: 0.3s; }
            #ai-brand-title span:nth-child(5) { animation-delay: 0.4s; }
            #ai-brand-title span:nth-child(6) { animation-delay: 0.5s; }
            #ai-brand-title span:nth-child(7) { animation-delay: 0.6s; }
            #ai-brand-title span:nth-child(8) { animation-delay: 0.7s; }

            @keyframes humanity-glow-text {
                0%, 100% { color: #00BCD4; text-shadow: 0 0 5px #00BCD4; opacity: 0.15; }
                50% { color: #84FFFF; text-shadow: 0 0 10px #84FFFF, 0 0 20px #00BCD4; opacity: 0.4; }
            }

            #ai-persistent-title {
                text-align: left;
                padding: 15px 20px;
                font-family: 'Merriweather', serif;
                font-size: 1.1em;
                font-weight: 700;
                color: var(--ai-text-light);
                border-bottom: 1px solid var(--ai-border-color);
                z-index: 20;
                background-color: var(--ai-background-dark);
            }

            #ai-close-button {
                position: absolute;
                top: 15px;
                right: 20px;
                font-size: 1.5em;
                cursor: pointer;
                color: var(--ai-text-dark);
                transition: color 0.2s;
                z-index: 30;
            }
            #ai-close-button:hover {
                color: var(--ai-text-light);
            }

            /* --- WELCOME MESSAGE --- */
            #ai-welcome-message {
                padding: 20px;
                text-align: left;
                border-bottom: 1px solid var(--ai-border-color);
                flex-shrink: 0;
                z-index: 10;
            }
            #ai-welcome-message h2 {
                margin: 0 0 10px 0;
                font-size: 1.4em;
                color: var(--ai-primary-color);
                font-family: 'Merriweather', serif;
            }
            #ai-welcome-message p {
                margin: 0 0 5px 0;
                font-size: 0.9em;
                line-height: 1.4;
                color: var(--ai-text-mid);
            }
            .shortcut-tip {
                font-style: italic;
                color: var(--ai-text-dark);
                font-size: 0.8em !important;
                margin-top: 10px !important;
            }

            /* --- RESPONSE CONTAINER (Chat History) --- */
            #ai-response-container {
                flex-grow: 1;
                overflow-y: auto;
                padding: 10px 20px;
                display: flex;
                flex-direction: column;
                gap: 15px;
                scroll-behavior: smooth;
            }
            #ai-response-container:not(.chat-active) {
                display: none; /* Hide if no chat is active */
            }
            #ai-container.chat-active #ai-response-container {
                display: flex;
            }
            #ai-container.chat-active #ai-welcome-message {
                display: none;
            }

            /* --- MESSAGE BUBBLES --- */
            .ai-message-bubble {
                padding: 12px;
                border-radius: 10px;
                max-width: 90%;
                line-height: 1.5;
                font-size: 0.95em;
                word-wrap: break-word;
                white-space: pre-wrap;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
                animation: message-pop-in 0.3s ease-out forwards;
                opacity: 0;
            }
            .user-message {
                background-color: var(--ai-primary-color);
                color: var(--ai-background-dark);
                align-self: flex-end;
                border-bottom-right-radius: 2px;
                font-family: 'Merriweather', serif;
                font-weight: 700;
            }
            .gemini-response {
                background-color: var(--ai-input-bg);
                color: var(--ai-text-light);
                align-self: flex-start;
                border: 1px solid var(--ai-border-color);
                border-bottom-left-radius: 2px;
            }
            .gemini-response p:first-child {
                margin-top: 0;
            }
            .gemini-response p:last-child {
                margin-bottom: 0;
            }

            /* --- RESPONSE CONTENT STYLING --- */
            .ai-response-content {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .ai-response-content a {
                color: var(--ai-link-color);
                text-decoration: none;
            }
            .ai-response-content a:hover {
                text-decoration: underline;
            }

            .ai-response-content h1, .ai-response-content h2, .ai-response-content h3 {
                color: var(--ai-primary-color);
                font-family: 'Merriweather', serif;
                font-weight: 700;
                margin: 15px 0 5px 0;
            }
            .ai-response-content h1 { font-size: 1.5em; }
            .ai-response-content h2 { font-size: 1.3em; }
            .ai-response-content h3 { font-size: 1.1em; }

            .ai-response-content ul, .ai-response-content ol {
                margin: 5px 0 5px 20px;
                padding: 0;
            }
            .ai-response-content li {
                margin-bottom: 5px;
            }
            .ai-response-content strong {
                font-weight: 700;
            }

            /* --- BLOCKQUOTE --- */
            .ai-response-content blockquote {
                border-left: 4px solid var(--ai-link-color);
                padding-left: 10px;
                margin: 10px 0;
                color: var(--ai-text-mid);
                font-style: italic;
            }

            /* --- INLINE CODE --- */
            .inline-code {
                background-color: rgba(255, 255, 255, 0.1);
                padding: 2px 4px;
                border-radius: 4px;
                font-family: monospace;
                color: #FFEB3B; /* Yellow for code */
                font-size: 0.9em;
            }

            /* --- CODE BLOCK --- */
            .code-block {
                margin: 10px 0;
                border: 1px solid #444;
                border-radius: 6px;
                overflow: hidden;
            }
            .code-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                background-color: #2b2b2b;
                padding: 5px 10px;
                border-bottom: 1px solid #444;
            }
            .code-language {
                font-size: 0.8em;
                color: var(--ai-text-mid);
                text-transform: uppercase;
                font-weight: bold;
            }
            .copy-code-btn {
                background: none;
                border: none;
                color: var(--ai-text-mid);
                cursor: pointer;
                font-size: 0.8em;
                padding: 4px 8px;
                border-radius: 4px;
                transition: background-color 0.2s;
                display: flex;
                align-items: center;
                gap: 5px;
            }
            .copy-code-btn:hover {
                background-color: #3a3a3a;
            }
            .code-block pre {
                background-color: #1e1e1e;
                color: #cccccc;
                padding: 10px;
                margin: 0;
                overflow-x: auto;
                font-family: 'Fira Code', monospace;
                font-size: 0.9em;
            }
            .code-block pre code {
                white-space: pre;
            }

            /* --- LOADING STATE --- */
            .ai-loading-spinner {
                border: 3px solid rgba(255, 255, 255, 0.3);
                border-top: 3px solid var(--ai-primary-color);
                border-radius: 50%;
                width: 14px;
                height: 14px;
                animation: spin 1s linear infinite;
                display: inline-block;
                margin-right: 8px;
            }
            .gemini-response.loading {
                display: flex;
                align-items: center;
                color: var(--ai-text-mid);
                font-style: italic;
            }

            /* --- ERROR STATE --- */
            .ai-error {
                color: var(--ai-error-color);
                border: 1px solid var(--ai-error-color);
                background-color: rgba(244, 67, 54, 0.1);
                padding: 10px;
                border-radius: 8px;
            }

            /* --- SOURCES CONTAINER --- */
            .ai-sources-container {
                margin-top: 10px;
                padding-top: 10px;
                border-top: 1px solid var(--ai-border-color);
                font-size: 0.85em;
                color: var(--ai-text-mid);
            }
            .ai-sources-container h4 {
                margin: 0 0 5px 0;
                font-size: 1em;
                color: var(--ai-link-color);
                font-family: 'Merriweather', serif;
            }
            .ai-sources-container ul {
                list-style-type: none;
                padding: 0;
                margin: 0;
            }
            .ai-sources-container li {
                margin-bottom: 3px;
                text-overflow: ellipsis;
                overflow: hidden;
                white-space: nowrap;
            }
            .ai-sources-container a {
                color: var(--ai-link-color);
                text-decoration: none;
            }
            .ai-sources-container.scrollable {
                max-height: 150px;
                overflow-y: auto;
                padding-right: 10px; /* Space for scrollbar */
            }

            /* --- THOUGHT PROCESS (Monologue) --- */
            .ai-thought-process {
                margin-top: 8px;
                border: 1px solid var(--ai-border-color);
                border-radius: 6px;
                overflow: hidden;
                transition: all 0.3s ease-out;
            }
            .monologue-header {
                padding: 8px 10px;
                background-color: var(--ai-background-dark);
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid var(--ai-border-color);
                transition: background-color 0.2s;
            }
            .ai-thought-process:not(.collapsed) .monologue-header {
                background-color: var(--ai-primary-color);
                border-bottom: none;
            }
            .monologue-title {
                margin: 0;
                font-size: 0.9em;
                color: var(--ai-text-mid);
                font-weight: 400;
                font-family: 'Merriweather', serif;
                transition: color 0.2s;
            }
            .ai-thought-process:not(.collapsed) .monologue-title {
                color: var(--ai-background-dark);
            }
            .monologue-toggle-btn {
                background: none;
                border: none;
                color: var(--ai-text-mid);
                font-size: 0.8em;
                cursor: pointer;
                transition: color 0.2s;
            }
            .ai-thought-process:not(.collapsed) .monologue-toggle-btn {
                color: var(--ai-background-dark);
                font-weight: bold;
            }
            .monologue-content {
                margin: 0;
                padding: 10px;
                font-size: 0.8em;
                background-color: #2b2b2b;
                color: var(--ai-text-mid);
                white-space: pre-wrap;
                max-height: 0;
                opacity: 0;
                overflow: hidden;
                transition: max-height 0.2s ease-in-out, opacity 0.2s ease-in-out, padding 0.2s ease-in-out;
            }
            .ai-thought-process:not(.collapsed) .monologue-content {
                max-height: 300px; /* Sufficient height for expansion */
                opacity: 1;
                padding: 10px;
            }


            /* --- COMPOSE AREA --- */
            #ai-compose-area {
                padding: 10px 20px;
                border-top: 1px solid var(--ai-border-color);
                display: flex;
                flex-direction: column;
                gap: 5px;
                flex-shrink: 0;
                position: relative;
            }

            /* --- INPUT WRAPPER --- */
            #ai-input-wrapper {
                display: flex;
                align-items: flex-end;
                background-color: var(--ai-input-bg);
                border: 2px solid var(--ai-input-bg);
                border-radius: 20px;
                padding: 8px 15px;
                transition: border-color 0.3s, box-shadow 0.3s;
                min-height: 40px;
            }
            #ai-input-wrapper:focus-within {
                border-color: var(--ai-primary-color);
                animation: humanity-glow 1.5s infinite alternate; /* Custom glow */
            }
            #ai-input-wrapper.waiting {
                pointer-events: none;
                opacity: 0.7;
            }

            /* --- INPUT (Content Editable) --- */
            #ai-input {
                flex-grow: 1;
                min-height: 24px;
                max-height: 180px;
                overflow-y: hidden;
                padding: 0;
                margin: 0;
                color: var(--ai-text-light);
                font-size: 1em;
                outline: none;
                caret-color: var(--ai-primary-color);
                white-space: pre-wrap;
                word-break: break-word;
                padding-right: 5px; /* Space from buttons */
            }
            #ai-input:empty:before {
                content: attr(placeholder);
                color: var(--ai-text-dark);
                cursor: text;
                pointer-events: none;
            }
            #ai-input[contenteditable]:empty:before {
                content: "Ask me anything...";
            }

            /* --- BUTTONS (Attachment & Settings) --- */
            #ai-attachment-button, #ai-settings-button {
                background: none;
                border: none;
                color: var(--ai-text-dark);
                cursor: pointer;
                padding: 0;
                margin-left: 5px;
                height: 24px;
                width: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: color 0.2s, transform 0.2s;
            }
            #ai-attachment-button:hover, #ai-settings-button:hover {
                color: var(--ai-text-light);
            }
            #ai-settings-button.active {
                color: var(--ai-primary-color);
                transform: rotate(45deg);
            }
            #ai-settings-button {
                margin-right: 0;
            }
            #ai-settings-button i {
                font-size: 1.1em;
            }

            /* --- CHARACTER COUNTER --- */
            #ai-char-counter {
                position: absolute;
                bottom: -2px;
                right: 20px;
                font-size: 0.75em;
                color: var(--ai-text-dark);
                transition: color 0.2s;
            }
            #ai-char-counter.over-limit {
                color: var(--ai-error-color);
                font-weight: bold;
            }

            /* --- ATTACHMENT PREVIEW --- */
            #ai-attachment-preview {
                display: flex;
                gap: 8px;
                padding: 5px 0;
                flex-wrap: nowrap;
                overflow-x: auto;
                margin-right: 5px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                margin-top: 5px;
                max-width: 100%;
            }
            #ai-attachment-preview:empty {
                border-top: none;
                padding: 0;
            }
            #ai-input-wrapper.has-attachments {
                flex-direction: column;
                align-items: flex-start;
                padding-bottom: 0;
            }
            .attachment-item {
                display: flex;
                align-items: center;
                background-color: #3a3a3a;
                border-radius: 4px;
                padding: 2px 5px;
                font-size: 0.8em;
                color: var(--ai-text-light);
                flex-shrink: 0;
            }
            .attachment-icon {
                margin-right: 5px;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 16px;
                height: 16px;
            }
            .attachment-icon img {
                max-width: 100%;
                max-height: 100%;
                border-radius: 2px;
            }
            .attachment-icon i {
                color: var(--ai-primary-color);
            }
            .attachment-filename {
                max-width: 80px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .remove-attachment {
                background: none;
                border: none;
                color: var(--ai-text-dark);
                margin-left: 5px;
                cursor: pointer;
                font-size: 1em;
                padding: 0;
                line-height: 1;
                transition: color 0.2s;
            }
            .remove-attachment:hover {
                color: var(--ai-error-color);
            }

            /* --- LATEX RENDERING --- */
            .latex-render {
                overflow-x: auto;
                padding: 2px 0;
                margin: 0 0 5px 0;
            }
            .display-math {
                padding: 10px 0;
                border-top: 1px dashed rgba(255, 255, 255, 0.1);
                border-bottom: 1px dashed rgba(255, 255, 255, 0.1);
                margin: 10px 0;
                text-align: center;
            }

            /* --- CUSTOM GRAPH RENDERING --- */
            .custom-graph-placeholder {
                width: 100%;
                height: 250px;
                background-color: #1e1e1e;
                border: 1px solid #444;
                border-radius: 6px;
                margin: 10px 0;
                overflow: hidden;
            }
            .custom-graph-placeholder canvas {
                display: block;
                width: 100%;
                height: 100%;
            }

            /* --- SETTINGS MENU --- */
            #ai-settings-menu {
                position: absolute;
                bottom: 100%;
                right: 0;
                width: 300px;
                background-color: var(--ai-background-dark);
                border: 1px solid var(--ai-primary-color);
                border-radius: 8px;
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5);
                padding: 15px;
                margin-bottom: 10px;
                opacity: 0;
                transform: translateY(10px);
                pointer-events: none;
                transition: opacity 0.2s, transform 0.2s;
                z-index: 10001;
                text-align: left;
            }
            #ai-settings-menu.active {
                opacity: 1;
                transform: translateY(0);
                pointer-events: auto;
            }
            .menu-header {
                font-size: 1.2em;
                font-weight: 700;
                color: var(--ai-primary-color);
                margin-bottom: 15px;
                padding-bottom: 8px;
                border-bottom: 1px solid var(--ai-border-color);
                font-family: 'Merriweather', serif;
            }
            .setting-group {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 0;
                border-bottom: 1px dashed var(--ai-border-color);
            }
            .setting-group:last-child {
                border-bottom: none;
                padding-bottom: 0;
            }
            .setting-label {
                flex-grow: 1;
                padding-right: 10px;
            }
            .setting-label label {
                font-weight: 700;
                font-size: 0.95em;
                display: block;
            }
            .setting-label p {
                font-size: 0.75em;
                color: var(--ai-text-dark);
                margin: 3px 0 0 0;
            }

            /* --- TOGGLE SWITCH --- */
            .ai-toggle-switch {
                position: relative;
                display: inline-block;
                width: 40px;
                height: 24px;
                flex-shrink: 0;
            }
            .ai-toggle-switch input {
                opacity: 0;
                width: 0;
                height: 0;
            }
            .ai-slider {
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: #ccc;
                transition: .4s;
                border-radius: 24px;
            }
            .ai-slider:before {
                position: absolute;
                content: "";
                height: 16px;
                width: 16px;
                left: 4px;
                bottom: 4px;
                background-color: white;
                transition: .4s;
                border-radius: 50%;
            }
            .ai-toggle-switch input:checked + .ai-slider {
                background-color: var(--ai-primary-color);
            }
            .ai-toggle-switch input:focus + .ai-slider {
                box-shadow: 0 0 1px var(--ai-primary-color);
            }
            .ai-toggle-switch input:checked + .ai-slider:before {
                transform: translateX(16px);
            }

            /* --- WEB SEARCH NUDGE POPUP --- */
            #ai-web-search-nudge {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background-color: #3a3a3a;
                color: var(--ai-text-light);
                border: 1px solid var(--ai-link-color);
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
                padding: 15px;
                z-index: 10002;
                max-width: 300px;
                text-align: center;
                animation: nudge-fade-in 0.3s ease-out forwards;
            }
            #ai-web-search-nudge p {
                margin: 0 0 10px 0;
                font-size: 0.9em;
            }
            .nudge-buttons button {
                background-color: var(--ai-primary-color);
                color: var(--ai-background-dark);
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.85em;
                margin: 0 5px;
                transition: background-color 0.2s;
            }
            #nudge-dismiss {
                background-color: var(--ai-text-dark);
                color: var(--ai-text-light);
            }
            #nudge-dismiss:hover {
                background-color: #555;
            }
            #nudge-open-settings:hover {
                background-color: #00897b;
            }

            @keyframes nudge-fade-in {
                from { opacity: 0; transform: translateX(-50%) translateY(20px); }
                to { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
            /* END Nudge CSS */


            @keyframes glow { 0%,100% { box-shadow: 0 0 5px rgba(255,255,255,.15), 0 0 10px rgba(255,255,255,.1); } 50% { box-shadow: 0 0 10px rgba(255,255,255,.25), 0 0 20px rgba(255,255,255,.2); } }
            /* CHANGED: Replaced gemini-glow (rainbow) with humanity-glow (cyan blue) */
            @keyframes humanity-glow { 0%,100% { box-shadow: 0 0 8px 2px #00BCD4, 0 0 15px 5px rgba(0, 188, 212, 0.5); } 50% { box-shadow: 0 0 15px 5px #00BCD4, 0 0 25px 8px rgba(0, 188, 212, 0.7); } }
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes message-pop-in { 0% { opacity: 0; transform: translateY(10px) scale(.98); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        `;
        document.head.appendChild(style);
    }

    // --- INITIALIZATION ---
    document.addEventListener('keydown', handleKeyDown);
    // Expose for external calls if needed (e.g. from the website's main script)
    window.activateAI = activateAI;
    window.deactivateAI = deactivateAI;
})();
