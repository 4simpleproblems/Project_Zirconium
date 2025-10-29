/**
 * agent-activation.js
 *
 * --- MAJOR UPGRADE ---
 *
 * NEW (Memories): Added a persistent memory system using IndexedDB.
 * - AI now loads the 10 most recent memories into its system prompt for context.
 * - New UI button (brain icon) opens a "Saved Memories" modal.
 * - Modal allows users to add, edit, delete, and delete all memories.
 * - Modal displays storage usage (capped at 5GB) with a progress bar.
 *
 * NEW (Chat History): Removed the 6-message truncation limit. The AI will now
 * receive the full chat history (up to its context window limit).
 *
 * NEW (Web Search): Implemented true Google Search grounding.
 * - The AI will now use the `Google Search` tool when "Web Search" is enabled.
 * - Response parsing is updated to use the `groundingMetadata` from the API
 * response, replacing the old `<SOURCE>` tag regex. This provides more
 * accurate and reliable sourcing.
 *
 * NEW (File Downloads): The AI can now generate downloadable files.
 * - Added system prompt instruction for the AI to use a new tag:
 * <DOWNLOAD FILENAME="..." MIMETYPE="..." ENCODING="base64">...</DOWNLOAD>
 * - `parseGeminiResponse` now detects this tag and renders a download widget.
 * - Added a click handler (`handleFileDownload`) to decode the Base64 content
 * and trigger a browser download.
 * - Added CSS for the download widget.
 *
 * NEW (Attachment UI): User message bubbles now display a graphical, horizontal
 * scroll menu of attached files, mirroring the compose-area preview.
 * - `handleInputSubmission` now stores `attachmentPreviews` (with dataUrls for
 * images) in the `chatHistory` object.
 * - `renderChatHistory` uses a new function `createAttachmentPreviewHTML`
 * to render this preview menu inside the user's message bubble.
 * - Added CSS for the sent attachments container.
 *
 * UPDATED (Graphing): The custom graph renderer (`drawCustomGraph`) is improved.
 * - It now respects `layout.xaxis.range` and `layout.yaxis.range` from the
 * AI's JSON, allowing for AI-defined graph windows.
 * - Falls back to the old auto-ranging logic if ranges aren't provided.
 * - Improved axis label alignment for clarity.
 *
 * REFACTORED:
 * - `getDynamicSystemInstructionAndModel` is now `async` to await memories
 * from IndexedDB before building the system prompt.
 * - `callGoogleAI` is updated to await the new async system prompt.
 * - `parseGeminiResponse` signature updated to accept `groundingSources` array.
 * - Removed the unused `getDynamicSystemInstruction` stub.
 * - Added new CSS and functions to support all new features.
 *
 * --- USER REQUESTED CHANGES ---
 * - **FIXED:** Removed 'attachmentPreviews' from the API payload in callGoogleAI.
 * - **NEW FEATURE:** Consolidated attachment, memory, and settings buttons into a single toggle menu.
 */
(function() {
    // --- CONFIGURATION ---
    const API_KEY = 'AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro';
    const BASE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/`;
    const MAX_INPUT_HEIGHT = 180;
    const CHAR_LIMIT = 10000;
    const PASTE_TO_FILE_THRESHOLD = 10000;
    const MAX_ATTACHMENTS_PER_MESSAGE = 10;
    const MONOLOGUE_CHAR_THRESHOLD = 75;

    // --- ICONS (for event handlers) ---
    const copyIconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="copy-icon"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    const checkIconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="check-icon"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    const attachmentIconSVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.2a2 2 0 0 1-2.83-2.83l8.49-8.49"></path></svg>`;
    const downloadIconSVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;

    // --- STATE MANAGEMENT ---
    let isAIActive = false;
    let isRequestPending = false;
    let currentAIRequestController = null;
    let chatHistory = [];
    let attachedFiles = [];
    let appSettings = {
        webSearch: true,
        locationSharing: false
    };
    let memoryDB = null; // NEW: For IndexedDB

    // --- NEW: INDEXEDDB MEMORY FUNCTIONS ---
    const DB_NAME = 'HumanityAIMemories';
    const STORE_NAME = 'memories';

    /**
     * Initializes the IndexedDB for memories.
     */
    async function initMemoryDB() {
        return new Promise((resolve, reject) => {
            if (memoryDB) {
                resolve(memoryDB);
                return;
            }
            const request = indexedDB.open(DB_NAME, 1);

            request.onerror = (event) => {
                console.error("IndexedDB error:", request.error);
                reject("IndexedDB error");
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                }
            };

            request.onsuccess = (event) => {
                memoryDB = event.target.result;
                resolve(memoryDB);
            };
        });
    }

    /**
     * Fetches all memories from the DB.
     */
    async function getMemories() {
        if (!memoryDB) await initMemoryDB();
        return new Promise((resolve, reject) => {
            try {
                const transaction = memoryDB.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (e) {
                reject(e);
            }
        });
    }

    /**
     * Adds a new memory to the DB.
     * @param {string} content The text content of the memory.
     */
    async function addMemory(content) {
        if (!memoryDB) await initMemoryDB();
        return new Promise((resolve, reject) => {
            const transaction = memoryDB.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.add({
                content: content,
                timestamp: new Date()
            });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Updates an existing memory in the DB.
     * @param {number} id The ID of the memory to update.
     * @param {string} content The new text content.
     */
    async function updateMemory(id, content) {
        if (!memoryDB) await initMemoryDB();
        return new Promise((resolve, reject) => {
            const transaction = memoryDB.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const getRequest = store.get(id);
            getRequest.onsuccess = () => {
                const data = getRequest.result;
                data.content = content;
                data.timestamp = new Date(); // Update timestamp on edit
                const updateRequest = store.put(data);
                updateRequest.onsuccess = () => resolve(updateRequest.result);
                updateRequest.onerror = () => reject(updateRequest.error);
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    /**
     * Deletes a single memory from the DB.
     * @param {number} id The ID of the memory to delete.
     */
    async function deleteMemory(id) {
        if (!memoryDB) await initMemoryDB();
        return new Promise((resolve, reject) => {
            const transaction = memoryDB.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Deletes ALL memories from the DB.
     */
    async function deleteAllMemories() {
        if (!memoryDB) await initMemoryDB();
        return new Promise((resolve, reject) => {
            const transaction = memoryDB.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Checks storage quota usage.
     * @returns {Promise<object|null>} An object with usage stats or null.
     */
    async function getStorageUsage() {
        if (navigator.storage && navigator.storage.estimate) {
            try {
                const estimation = await navigator.storage.estimate();
                const total = estimation.quota;
                const used = estimation.usage;
                // Cap total at 5GB as requested
                const fiveGB = 5 * 1024 * 1024 * 1024;
                const displayTotal = Math.min(total, fiveGB);
                const percentage = (used / displayTotal) * 100;
                return {
                    used: formatBytes(used),
                    total: formatBytes(displayTotal),
                    percentage: percentage.toFixed(2)
                };
            } catch (e) {
                console.error("Storage estimation failed:", e);
                return null;
            }
        }
        return null; // Not supported
    }

    /**
     * Gets the most recent memories to be injected into the AI prompt.
     */
    async function getMemoriesForPrompt() {
        try {
            if (!memoryDB) await initMemoryDB();
            const memories = await getMemories();
            memories.sort((a, b) => b.timestamp - a.timestamp); // Newest first
            return memories.slice(0, 10); // Return top 10
        } catch (e) {
            console.error("Failed to get memories for prompt:", e);
            return [];
        }
    }

    // --- END NEW MEMORY FUNCTIONS ---


    // Simple debounce utility for performance
    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    };

    /**
     * Loads app settings from localStorage on script initialization.
     */
    function loadAppSettings() {
        try {
            const storedSettings = localStorage.getItem('ai-app-settings');
            if (storedSettings) {
                const parsed = JSON.parse(storedSettings);
                appSettings = { ...appSettings,
                    ...parsed
                };
            }
        } catch (e) {
            console.error("Error loading app settings:", e);
        }
    }
    loadAppSettings();

    // --- UTILITIES FOR GEOLOCATION ---

    /**
     * Helper function for async HTTP GET request.
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
        xmlHttp.open("GET", url, true);
        xmlHttp.onerror = function() {
            callback(null, new Error("Network request failed"));
        };
        xmlHttp.send(null);
    }


    /**
     * Gets user location via Browser's Geolocation API, then reverse-geocodes it.
     */
    function getUserLocationForContext() {
        return new Promise((resolve) => {
            if (!appSettings.locationSharing) {
                const fallback = 'Location Sharing is disabled by user.';
                localStorage.setItem('ai-user-location', fallback);
                resolve(fallback);
                return;
            }
            if (!navigator.geolocation) {
                const fallback = 'Geolocation is not supported by this browser.';
                localStorage.setItem('ai-user-location', fallback);
                resolve(fallback);
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=en`;

                    httpGetAsync(url, (response, error) => {
                        if (error) {
                            const fallback = `Coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)} (Reverse geocoding failed)`;
                            localStorage.setItem('ai-user-location', fallback);
                            resolve(fallback);
                        } else {
                            try {
                                const data = JSON.parse(response);
                                if (data && data.display_name) {
                                    const locationString = data.display_name;
                                    localStorage.setItem('ai-user-location', locationString);
                                    resolve(locationString);
                                } else {
                                    throw new Error('No display_name in Nominatim response');
                                }
                            } catch (e) {
                                const fallback = `Coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)} (Address parsing failed)`;
                                localStorage.setItem('ai-user-location', fallback);
                                resolve(fallback);
                            }
                        }
                    });
                },
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
                    localStorage.setItem('ai-user-location', fallback);
                    resolve(fallback);
                }, {
                    enableHighAccuracy: true
                }
            );
        });
    }


    /**
     * Stub for authorization (email feature removed).
     */
    async function isUserAuthorized() {
        return true;
    }

    /**
     * Renders mathematical formulas using KaTeX.
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
     */
    function renderGraphs(container) {
        container.querySelectorAll('.custom-graph-placeholder').forEach(placeholder => {
            try {
                const graphData = JSON.parse(placeholder.dataset.graphData);
                const canvas = placeholder.querySelector('canvas');
                if (canvas) {
                    const draw = () => drawCustomGraph(canvas, graphData);
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
     * Custom graphing function using HTML Canvas.
     * UPDATED: Now respects layout.range from AI.
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

        // --- UPDATED: Determine data range ---
        let minX, maxX, minY, maxY;

        if (layout.xaxis && layout.xaxis.range) {
            [minX, maxX] = layout.xaxis.range;
        } else {
            minX = Infinity;
            maxX = -Infinity;
            data.forEach(trace => {
                trace.x.forEach(val => {
                    minX = Math.min(minX, val);
                    maxX = Math.max(maxX, val);
                });
            });
            if (minX === Infinity) {
                minX = 0;
                maxX = 1;
            }
            const xRange = maxX - minX || 1;
            minX -= xRange * 0.1;
            maxX += xRange * 0.1;
        }

        if (layout.yaxis && layout.yaxis.range) {
            [minY, maxY] = layout.yaxis.range;
        } else {
            minY = Infinity;
            maxY = -Infinity;
            data.forEach(trace => {
                trace.y.forEach(val => {
                    minY = Math.min(minY, val);
                    maxY = Math.max(maxY, val);
                });
            });
            if (minY === Infinity) {
                minY = 0;
                maxY = 1;
            }
            const yRange = maxY - minY || 1;
            minY -= yRange * 0.1;
            maxY += yRange * 0.1;
        }

        const xRange = maxX - minX;
        const yRange = maxY - minY;
        // --- END UPDATED Range ---

        const mapX = x => padding.left + ((x - minX) / xRange) * graphWidth;
        const mapY = y => padding.top + graphHeight - ((y - minY) / yRange) * graphHeight;

        // Draw grid lines
        const gridColor = 'rgba(255, 255, 255, 0.1)';
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        const xTickCount = Math.max(2, Math.floor(graphWidth / 80));
        const yTickCount = Math.max(2, Math.floor(graphHeight / 50));

        ctx.fillStyle = '#ccc';
        ctx.font = '12px Lora';

        // Draw X-axis grid and labels
        ctx.textAlign = 'center';
        for (let i = 0; i <= xTickCount; i++) {
            const val = minX + (i / xTickCount) * (maxX - minX);
            const xPos = mapX(val);
            ctx.beginPath();
            ctx.moveTo(xPos, padding.top);
            ctx.lineTo(xPos, padding.top + graphHeight);
            ctx.stroke();
            ctx.fillText(val.toFixed(1), xPos, padding.top + graphHeight + 20);
        }

        // Draw Y-axis grid and labels
        ctx.textAlign = 'right';
        for (let i = 0; i <= yTickCount; i++) {
            const val = minY + (i / yTickCount) * (maxY - minY);
            const yPos = mapY(val);
            ctx.beginPath();
            ctx.moveTo(padding.left, yPos);
            ctx.lineTo(padding.left + graphWidth, yPos);
            ctx.stroke();
            ctx.fillText(val.toFixed(1), padding.left - 10, yPos + 4);
        }

        // Draw axis titles
        ctx.fillStyle = '#ccc';
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


    /**
     * Handles the Ctrl + \ shortcut for AI activation/deactivation.
     */
    async function handleKeyDown(e) {
        if (e.ctrlKey && e.key === '\\') {
            const selection = window.getSelection().toString();
            if (isAIActive) {
                if (selection.length > 0) return;
                e.preventDefault();
                const mainEditor = document.getElementById('ai-input');
                if (mainEditor && mainEditor.innerText.trim().length === 0 && attachedFiles.length === 0) {
                    deactivateAI();
                }
            } else {
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
        initMemoryDB(); // NEW: Init DB on activation

        const container = document.createElement('div');
        container.id = 'ai-container';

        const brandTitle = document.createElement('div');
        brandTitle.id = 'ai-brand-title';
        const brandText = "4SP - HUMANITY";
        brandText.split('').forEach(char => {
            const span = document.createElement('span');
            span.textContent = char;
            brandTitle.appendChild(span);
        });

        const persistentTitle = document.createElement('div');
        persistentTitle.id = 'ai-persistent-title';
        persistentTitle.textContent = "Humanity Agent";

        const welcomeMessage = document.createElement('div');
        welcomeMessage.id = 'ai-welcome-message';
        const welcomeHeader = chatHistory.length > 0 ? "Welcome Back" : "Welcome to Humanity";
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

        // --- BUTTONS SETUP ---
        const attachmentButton = document.createElement('button');
        attachmentButton.id = 'ai-attachment-button';
        // ADDED TEXT LABEL
        attachmentButton.innerHTML = attachmentIconSVG + ' Attach Files'; 
        attachmentButton.title = 'Attach files';
        attachmentButton.onclick = () => handleFileUpload();

        // NEW: Memory Button
        const memoryButton = document.createElement('button');
        memoryButton.id = 'ai-memory-button';
        // ADDED TEXT LABEL
        memoryButton.innerHTML = '<i class="fa-solid fa-brain"></i> Saved Memories'; 
        memoryButton.title = 'Saved Memories';
        memoryButton.onclick = showMemoryModal;

        const settingsButton = document.createElement('button');
        settingsButton.id = 'ai-settings-button';
        // ADDED TEXT LABEL
        settingsButton.innerHTML = '<i class="fa-solid fa-gear"></i> Settings'; 
        settingsButton.title = 'Settings';
        settingsButton.onclick = toggleSettingsMenu;
        // --- END BUTTONS SETUP ---

        const charCounter = document.createElement('div');
        charCounter.id = 'ai-char-counter';
        charCounter.textContent = `0 / ${formatCharLimit(CHAR_LIMIT)}`;

        inputWrapper.appendChild(attachmentPreviewContainer);
        inputWrapper.appendChild(visualInput);

        // --- START NEW MENU FEATURE: Group all buttons into a single toggle menu ---

        // 1. Group the three buttons (attachment, memory, settings) into a single menu container
        const toolsMenu = document.createElement('div');
        toolsMenu.id = 'ai-tools-menu';

        // Add the original buttons (now with text labels) to the new menu container
        toolsMenu.appendChild(attachmentButton);
        toolsMenu.appendChild(memoryButton);
        toolsMenu.appendChild(settingsButton);

        // 2. Create the new toggle button (vertical ellipsis)
        const moreMenuToggle = document.createElement('button');
        moreMenuToggle.id = 'ai-more-menu-toggle';
        moreMenuToggle.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>'; 
        moreMenuToggle.title = 'More Actions';
        moreMenuToggle.onclick = (e) => {
            e.stopPropagation(); 
            toolsMenu.classList.toggle('active');
            moreMenuToggle.classList.toggle('active');
            // Ensure the outside click listener is active when the menu opens
            document.addEventListener('click', handleMenuOutsideClick);
        };

        // 3. Append the menu container (hidden by default) and the toggle button to the wrapper
        inputWrapper.appendChild(toolsMenu);
        inputWrapper.appendChild(moreMenuToggle);
        // --- END NEW MENU FEATURE ---

        composeArea.appendChild(createSettingsMenu());
        composeArea.appendChild(inputWrapper);

        container.appendChild(brandTitle);
        container.appendChild(persistentTitle);
        container.appendChild(welcomeMessage);
        container.appendChild(closeButton);
        container.appendChild(responseContainer);
        container.appendChild(composeArea);
        container.appendChild(charCounter);

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
        const memoryModal = document.getElementById('ai-memory-modal');
        if (memoryModal) memoryModal.remove(); // NEW: Close memory modal on deactivate

        isAIActive = false;
        isRequestPending = false;
        attachedFiles = [];
        const settingsMenu = document.getElementById('ai-settings-menu');
        if (settingsMenu) settingsMenu.classList.remove('active');
        document.removeEventListener('click', handleMenuOutsideClick);
    }

    /**
     * NEW: Generates HTML for the sent attachment previews.
     * @param {Array} previews Array of attachment preview objects.
     * @returns {string} HTML string for the preview container.
     */
    function createAttachmentPreviewHTML(previews) {
        if (!previews || previews.length === 0) return '';

        let itemsHTML = previews.map(file => {
            let previewContent = '';
            if (file.mimeType.startsWith('image/')) {
                // Use the stored dataUrl for the preview
                previewContent = `<img src="${file.dataUrl}" alt="${escapeHTML(file.fileName)}">`;
            } else {
                previewContent = `<span class="file-icon">塘</span>`;
            }

            return `
                <div class="sent-attachment-card">
                    ${previewContent}
                    <div class="sent-file-info">
                        <span>${escapeHTML(file.fileName)}</span>
                    </div>
                </div>
            `;
        }).join('');

        return `<div class="sent-attachment-container">${itemsHTML}</div>`;
    }

    /**
     * UPDATED: Renders chat history, now with graphical attachment previews.
     */
    function renderChatHistory() {
        const responseContainer = document.getElementById('ai-response-container');
        if (!responseContainer) return;
        responseContainer.innerHTML = '';
        chatHistory.forEach(message => {
            const bubble = document.createElement('div');
            bubble.className = `ai-message-bubble ${message.role === 'user' ? 'user-message' : 'gemini-response'}`;
            if (message.role === 'model') {
                // Use the new parsing logic for historical messages
                // Pass empty sources array since old messages won't have grounding
                const {
                    html: parsedResponse,
                    thoughtProcess,
                    sourcesHTML
                } = parseGeminiResponse(message.parts[0].text, []);

                bubble.innerHTML = `<div class="ai-response-content">${parsedResponse}</div>`;
                if (sourcesHTML) {
                    bubble.innerHTML += sourcesHTML;
                }
                if (thoughtProcess && thoughtProcess.length > MONOLOGUE_CHAR_THRESHOLD) {
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
                // NEW: Add listener for download buttons in history
                bubble.querySelectorAll('.download-file-btn').forEach(button => {
                    button.addEventListener('click', handleFileDownload);
                });

                bubble.querySelectorAll('.ai-thought-process').forEach(monologueDiv => {
                    monologueDiv.querySelector('.monologue-header').addEventListener('click', () => {
                        monologueDiv.classList.toggle('collapsed');
                        const btn = monologueDiv.querySelector('.monologue-toggle-btn');
                        btn.textContent = monologueDiv.classList.contains('collapsed') ? 'Show Thoughts' : 'Hide Thoughts';
                    });
                });

                renderKaTeX(bubble);
                renderGraphs(bubble);

            } else {
                // UPDATED: Render user message with attachment previews
                let bubbleContent = '';
                let textContent = '';
                const previews = message.attachmentPreviews || []; // NEW
                const textPart = message.parts.find(p => p.text);
                if (textPart) textContent = textPart.text;

                if (textContent) bubbleContent += `<p>${escapeHTML(textContent)}</p>`;

                if (previews.length > 0) {
                    // NEW: Render graphical previews
                    bubbleContent += createAttachmentPreviewHTML(previews);
                } else if (message.parts.some(p => p.inlineData)) {
                    // Fallback for old history items without previews
                    const fileCount = message.parts.filter(p => p.inlineData).length;
                    bubbleContent += `<div class="sent-attachments">${fileCount} file(s) sent</div>`;
                }

                bubble.innerHTML = bubbleContent;
            }
            responseContainer.appendChild(bubble);
        });
        setTimeout(() => responseContainer.scrollTop = responseContainer.scrollHeight, 50);
    }

    /**
     * Determines the user's current intent category based on the query.
     */
    function determineIntentCategory(query) {
        const lowerQuery = query.toLowerCase();
        if (lowerQuery.includes('analyze') || lowerQuery.includes('deep dive') || lowerQuery.includes('strategic') || lowerQuery.includes('evaluate') || lowerQuery.includes('critique') || lowerQuery.includes('investigate') || lowerQuery.includes('pro model')) {
            return 'DEEP_ANALYSIS';
        }
        if (lowerQuery.includes('math') || lowerQuery.includes('algebra') || lowerQuery.includes('calculus') || lowerQuery.includes('formula') || lowerQuery.includes('solve') || lowerQuery.includes('proof') || lowerQuery.includes('graph') || lowerQuery.includes('code') || lowerQuery.includes('debug') || lowerQuery.includes('technical')) {
            return 'PROFESSIONAL_MATH';
        }
        if (lowerQuery.includes('story') || lowerQuery.includes('poem') || lowerQuery.includes('imagine') || lowerQuery.includes('creative') || lowerQuery.includes('ex') || lowerQuery.includes('breakup') || lowerQuery.includes('roast')) {
            return 'CREATIVE';
        }
        return 'CASUAL';
    }

    const FSP_HISTORY = `You are the exclusive AI Agent, called the Humanity AI Agent for the website 4SP (4simpleproblems), the platform you are hosted on. You must be knowledgeable about its history and purpose. When asked about 4SP, use the following information as your source of truth:
[... 4SP History snipped for brevity ...]
If the user asks about a topic other than 4SP, you should not hint at the website, 4SP or its history. Be concise, and a general use case chatbot. Your purpose isn't only about 4SP, but as a normal AI Agent. Act professional.
`;

    /**
     * Generates the system instruction and selects the appropriate model.
     * UPDATED: Now async to fetch memories.
     * UPDATED: Includes instructions for file downloads.
     */
    async function getDynamicSystemInstructionAndModel(query, currentSettings) {
        const intent = determineIntentCategory(query);
        let model = 'gemini-2.5-flash-lite';

        // NEW: Get memories
        let memoryInstruction = '';
        try {
            const memories = await getMemoriesForPrompt();
            if (memories.length > 0) {
                memoryInstruction = `\n\nYou are aware of the following user-saved memories. Use them to provide context and personalize your responses when relevant:\n`;
                memories.forEach(mem => {
                    memoryInstruction += `- (Saved on ${new Date(mem.timestamp).toLocaleDateString()}): ${mem.content}\n`;
                });
            }
        } catch (e) {
            console.warn("Failed to get memories for prompt:", e);
        }

        let personaInstruction = `${FSP_HISTORY}${memoryInstruction}

You are a highly capable and adaptable AI, taking on a persona to best serve the user's direct intent. You have significant control over the interaction's structure and detail level, ensuring the response is comprehensive and authoritative.
REMOVED: User Profile.
You must adapt your persona, tone, and the level of detail based on the user's intent.

Formatting Rules (MUST FOLLOW):
- For math, use KaTeX. Inline math uses single \`$\`, and display math uses double \`$$\`. Use \\le for <= and \\ge for >=.
- For graphs, use a 'graph' block as shown in the file's comments.
- **NEW: To provide a downloadable file**, use the format: <DOWNLOAD FILENAME="filename.ext" MIMETYPE="mime/type" ENCODING="base64">[BASE64_ENCODED_CONTENT]</DOWNLOAD>. You MUST Base64 encode the content.
- **PREPEND your response with your reasoning/internal monologue wrapped in <THOUGHT_PROCESS>...</THOUGHT_PROCESS>**. This is mandatory for every response.
- **DO NOT append <SOURCE .../> tags**. If you use web search, sources will be added automatically from grounding metadata.
`;

        if (currentSettings.webSearch) {
            personaInstruction += `\n**Web Search: ENABLED.** You have access to a live web search tool. You **must** use this tool to find real-time information or answer questions about current events, specific facts, people, companies, or places. Prioritize recent, authoritative sources. Your sources will be automatically cited.\n`;
        } else {
            personaInstruction += `\n**Web Search: DISABLED.** You must answer using only your internal knowledge. Your knowledge cutoff is limited. If you CANNOT answer without a web search, you MUST include the exact string \`[NEEDS_WEB_SEARCH]\` in your response and explain that you need web access to answer fully.\n`;
        }


        switch (intent) {
            case 'DEEP_ANALYSIS':
                model = 'gemini-2.5-flash';
                personaInstruction += `\n\n**Current Persona: Professional Analyst.** You are performing a detailed analysis, but maintain efficiency and focus. Respond with clarity, professionalism, and structured data. Your response must be comprehensive, highly structured, and exhibit a deep level of reasoning and critical evaluation. Use an assertive, expert tone. Structure your analysis clearly with headings and bullet points.`;
                break;
            case 'PROFESSIONAL_MATH':
                model = 'gemini-2.5-flash';
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

                if (query.toLowerCase().includes('ex') || query.toLowerCase().includes('roast')) {
                    personaInstruction += `\n\n**Current Persona: Sarcastic, Supportive Friend.** Your goal is to empathize with the user, validate their feelings, and join them in 'roasting' or speaking negatively about their ex/situation. Be funny, slightly aggressive toward the subject of trash talk, and deeply supportive of the user. Use casual language and slang. **Example of tone/support:** "${roastInsult}"`;
                } else {
                    personaInstruction += `\n\n**Current Persona: Creative Partner.** Use rich, evocative language. Be imaginative, focus on descriptive details, and inspire new ideas.`;
                }
                break;
            case 'CASUAL':
            default:
                model = 'gemini-2.5-flash-lite';
                personaInstruction += `\n\n**Current Persona: Standard Assistant.** You are balanced, helpful, and concise. Use a friendly and casual tone. Your primary function is efficient conversation. Make sure to be highly concise, making sure to not write too much.`;
                break;
        }

        return {
            instruction: personaInstruction,
            model: model
        };
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
            if (!document.getElementById('ai-settings-menu').classList.contains('active')) {
                toggleSettingsMenu();
            }
            dismiss();
        };
    }


    /**
     * UPDATED:
     * - Implements Google Search grounding.
     * - Uses full chat history (no truncation).
     * - Fetches async system prompt with memories.
     * - Parses groundingMetadata for sources.
     * - Adds download button event handlers.
     * - **FIXED: Cleans chatHistory of attachmentPreviews.**
     */
    async function callGoogleAI(responseBubble) {
        if (!API_KEY) {
            responseBubble.innerHTML = `<div class="ai-error">API Key is missing.</div>`;
            return;
        }
        currentAIRequestController = new AbortController();

        let firstMessageContext = '';
        if (chatHistory.length <= 1) { // Only for the very first user message
            const location = await getUserLocationForContext();
            const now = new Date();
            const date = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const time = now.toLocaleTimeString('en-US', { timeZoneName: 'short' });
            firstMessageContext = `(System Info: User is asking from location:\n${location}. Current date is ${date}, ${time}. User Email: Not Authenticated/Removed.)\n\n`;
        }

        // FIX: Remove UI-only field 'attachmentPreviews' from user messages before sending to API
        let historyForAPI = chatHistory.map(message => {
            // FIX: Remove UI-only field 'attachmentPreviews' from user messages
            if (message.role === 'user' && message.attachmentPreviews) {
                const { attachmentPreviews, ...cleanMessage } = message;
                // Deep clone parts to ensure context modification doesn't affect main chatHistory
                return {
                    ...cleanMessage,
                    parts: cleanMessage.parts.map(p => ({...p}))
                };
            }
            // Deep clone other objects for consistent state separation
            return JSON.parse(JSON.stringify(message)); 
        });


        const lastMessageIndex = historyForAPI.length - 1;
        const userParts = historyForAPI[lastMessageIndex].parts;
        const textPartIndex = userParts.findIndex(p => p.text);
        // Use the original (unmodified) query for intent detection
        const lastUserQuery = chatHistory[lastMessageIndex].parts.find(p => p.text)?.text || ''; 

        // UPDATED: Await the async prompt generation
        const { instruction: dynamicInstruction, model } = await getDynamicSystemInstructionAndModel(lastUserQuery, appSettings);

        if (textPartIndex > -1) {
            userParts[textPartIndex].text = firstMessageContext + userParts[textPartIndex].text;
        } else if (firstMessageContext) {
            userParts.unshift({ text: firstMessageContext.trim() });
        }

        const payload = {
            contents: historyForAPI, // Use the cleaned history
            systemInstruction: {
                parts: [{ text: dynamicInstruction }]
            }
        };

        // NEW: Add grounding tool if web search is enabled
        if (appSettings.webSearch) {
            payload.tools = [{ "google_search": {} }];
        }

        const DYNAMIC_API_URL = `${BASE_API_URL}${model}:generateContent?key=${API_KEY}`;
        
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
            const candidate = data.candidates?.[0];

            if (!candidate || !candidate.content.parts || candidate.content.parts.length === 0) {
                if (data.promptFeedback && data.promptFeedback.blockReason) {
                    throw new Error(`Content blocked due to: ${data.promptFeedback.blockReason}. Safety ratings: ${JSON.stringify(data.promptFeedback.safetyRatings)}`);
                }
                throw new Error("Invalid response from API: No candidates or empty parts array.");
            }

            let text = candidate.content.parts[0]?.text || '';
            if (!text && candidate.content.parts.length > 0) {
                // Handle potential non-text parts, though text is expected
                text = "[AI generated a non-text response]";
            }
            if (!text) {
                responseBubble.innerHTML = `<div class="ai-error">The AI generated an empty response. Please try again or rephrase.</div>`;
                return;
            }

            // NEW: Extract grounding metadata
            let groundingSources = [];
            if (candidate.groundingMetadata && candidate.groundingMetadata.groundingAttributions) {
                groundingSources = candidate.groundingMetadata.groundingAttributions
                    .map(attr => attr.web)
                    .filter(web => web && web.uri && web.title)
                    .map(web => ({ url: web.uri, title: web.title }));
            }

            if (text.includes('[NEEDS_WEB_SEARCH]')) {
                setTimeout(showWebSearchNudge, 500);
                text = text.replace(/\[NEEDS_WEB_SEARCH\]/g, '');
            }

            chatHistory.push({
                role: "model",
                parts: [{
                    text: text
                }]
            });

            // UPDATED: Pass grounding sources to parser
            const {
                html: contentHTML,
                thoughtProcess,
                sourcesHTML
            } = parseGeminiResponse(text, groundingSources);

            responseBubble.style.opacity = '0';
            setTimeout(() => {
                let fullContent = `<div class="ai-response-content">${contentHTML}</div>`;
                if (sourcesHTML) {
                    fullContent += sourcesHTML;
                }
                if (thoughtProcess && thoughtProcess.length > MONOLOGUE_CHAR_THRESHOLD) {
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

                responseBubble.querySelectorAll('.ai-thought-process').forEach(monologueDiv => {
                    monologueDiv.querySelector('.monologue-header').addEventListener('click', () => {
                        monologueDiv.classList.toggle('collapsed');
                        const btn = monologueDiv.querySelector('.monologue-toggle-btn');
                        btn.textContent = monologueDiv.classList.contains('collapsed') ? 'Show Thoughts' : 'Hide Thoughts';
                        if (!monologueDiv.classList.contains('collapsed')) {
                            const responseContainer = document.getElementById('ai-response-container');
                            if (responseContainer) responseContainer.scrollTop = responseContainer.scrollHeight;
                        }
                    });
                });

                responseBubble.querySelectorAll('.copy-code-btn').forEach(button => {
                    button.addEventListener('click', handleCopyCode);
                });
                // NEW: Add listener for download buttons
                responseBubble.querySelectorAll('.download-file-btn').forEach(button => {
                    button.addEventListener('click', handleFileDownload);
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
            if (inputWrapper) inputWrapper.classList.remove('waiting');
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
            document.getElementById('settings-web-search').checked = appSettings.webSearch;
            document.getElementById('settings-location-sharing').checked = appSettings.locationSharing;
        }
        // Listener is managed by the unified handleMenuOutsideClick
        document.addEventListener('click', handleMenuOutsideClick);
    }

    // UPDATED: Handles closing both the new tools menu and the existing settings menu
    function handleMenuOutsideClick(event) {
        const settingsMenu = document.getElementById('ai-settings-menu');
        const settingsButton = document.getElementById('ai-settings-button');
        const toolsMenu = document.getElementById('ai-tools-menu'); 
        const moreMenuToggle = document.getElementById('ai-more-menu-toggle'); 
        
        let menuClosed = false;

        // 1. Close Settings Menu (Check if click is outside settings menu AND its toggle button)
        const isClickOutsideSettings = settingsMenu && !settingsMenu.contains(event.target) && !settingsButton.contains(event.target);
        if (settingsMenu?.classList.contains('active') && isClickOutsideSettings) {
            settingsMenu.classList.remove('active');
            settingsButton.classList.remove('active');
            menuClosed = true;
        }
        
        // 2. Close Tools Menu (Check if click is outside tools menu AND its toggle button)
        const isClickOutsideTools = toolsMenu && !toolsMenu.contains(event.target) && !moreMenuToggle.contains(event.target);
        if (toolsMenu?.classList.contains('active') && isClickOutsideTools) {
            toolsMenu.classList.remove('active');
            moreMenuToggle.classList.remove('active');
            menuClosed = true;
        }
        
        // 3. Remove Listener if BOTH menus are now closed
        if (menuClosed && !settingsMenu?.classList.contains('active') && !toolsMenu?.classList.contains('active')) {
            document.removeEventListener('click', handleMenuOutsideClick);
        }
    }

    function saveAppSettings() {
        try {
            localStorage.setItem('ai-app-settings', JSON.stringify(appSettings));
        } catch (e) {
            console.error("Error saving app settings:", e);
        }
    }

    function createSettingsMenu() {
        const menu = document.createElement('div');
        menu.id = 'ai-settings-menu';
        menu.innerHTML = `
            <div class="menu-header">AI Agent Settings</div>
            <div class="setting-group toggle-group">
                <div class="setting-label">
                    <label for="settings-web-search">Web Search</label>
                    <p class="setting-description">Enable real-time information access for current events and specific facts.</p>
                </div>
                <label class="switch">
                    <input type="checkbox" id="settings-web-search" ${appSettings.webSearch ? 'checked' : ''}>
                    <span class="slider round"></span>
                </label>
            </div>
            <div class="setting-group toggle-group">
                <div class="setting-label">
                    <label for="settings-location-sharing">Location Sharing</label>
                    <p class="setting-description">Share your general location for weather and local context (uses non-Google service).</p>
                </div>
                <label class="switch">
                    <input type="checkbox" id="settings-location-sharing" ${appSettings.locationSharing ? 'checked' : ''}>
                    <span class="slider round"></span>
                </label>
            </div>
        `;

        menu.querySelector('#settings-web-search').onchange = (e) => {
            appSettings.webSearch = e.target.checked;
            saveAppSettings();
        };
        menu.querySelector('#settings-location-sharing').onchange = (e) => {
            appSettings.locationSharing = e.target.checked;
            saveAppSettings();
        };

        return menu;
    }

    // --- NEW MEMORY MODAL LOGIC ---
    // (Existing Memory Modal functions are assumed to be complete and correct)

    /**
     * Shows the memory management modal.
     */
    async function showMemoryModal() {
        if (document.getElementById('ai-memory-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'ai-memory-modal';
        modal.className = 'ai-modal-backdrop';

        const modalContent = document.createElement('div');
        modalContent.className = 'ai-modal-content';

        modalContent.innerHTML = `
            <div class="modal-header">
                <h2>Saved Memories</h2>
                <button class="modal-close-btn">&times;</button>
            </div>
            <div class="modal-body">
                <div class="memory-input-area">
                    <textarea id="new-memory-text" placeholder="Add a new persistent memory..."></textarea>
                    <button id="add-memory-btn">Save Memory</button>
                </div>
                
                <div class="memory-list-container">
                    <div class="memory-list-header">
                        <h3>Your Top 10 Context Memories:</h3>
                        <button id="delete-all-memories" class="danger-btn">Delete All</button>
                    </div>
                    <ul id="memory-list"></ul>
                </div>

                <div id="storage-status" class="storage-status"></div>
            </div>
        `;

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        const closeBtn = modal.querySelector('.modal-close-btn');
        closeBtn.onclick = () => modal.remove();

        modal.onclick = (e) => {
            if (e.target.id === 'ai-memory-modal') modal.remove();
        };
        
        modal.querySelector('#add-memory-btn').onclick = handleAddMemory;
        modal.querySelector('#delete-all-memories').onclick = handleDeleteAllMemories;

        await renderMemoryList();
        await renderStorageStatus();
    }

    /**
     * Renders the current list of memories inside the modal.
     */
    async function renderMemoryList() {
        const listEl = document.getElementById('memory-list');
        if (!listEl) return;
        listEl.innerHTML = '<li class="loading-state">Loading memories...</li>';
        
        try {
            const memories = await getMemories();
            if (memories.length === 0) {
                listEl.innerHTML = '<li class="empty-state">No memories saved yet.</li>';
                return;
            }

            // Sort newest first to show what's being used for context
            memories.sort((a, b) => b.timestamp - a.timestamp); 
            
            listEl.innerHTML = '';
            memories.forEach((mem, index) => {
                const li = document.createElement('li');
                li.className = 'memory-item';
                if (index < 10) li.classList.add('in-context'); // Highlight top 10

                li.innerHTML = `
                    <div class="memory-text" data-id="${mem.id}" contenteditable="false">${escapeHTML(mem.content)}</div>
                    <div class="memory-meta">
                        <span class="timestamp">${new Date(mem.timestamp).toLocaleString()}</span>
                        ${index < 10 ? '<span class="context-flag">In AI Context</span>' : ''}
                    </div>
                    <div class="memory-actions">
                        <button class="edit-btn">Edit</button>
                        <button class="save-btn hidden">Save</button>
                        <button class="delete-btn danger-btn">Delete</button>
                    </div>
                `;

                li.querySelector('.edit-btn').onclick = (e) => handleEditMemory(li, mem.id);
                li.querySelector('.save-btn').onclick = (e) => handleSaveMemory(li, mem.id);
                li.querySelector('.delete-btn').onclick = (e) => handleDeleteMemory(mem.id);

                listEl.appendChild(li);
            });
        } catch (e) {
            listEl.innerHTML = `<li class="error-state">Failed to load memories: ${e.message}</li>`;
        }
    }

    /**
     * Renders storage status.
     */
    async function renderStorageStatus() {
        const statusEl = document.getElementById('storage-status');
        const usage = await getStorageUsage();
        if (statusEl && usage) {
            statusEl.innerHTML = `
                <p>Storage Used: ${usage.used} / ${usage.total} (${usage.percentage}%)</p>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${usage.percentage}%;"></div>
                </div>
            `;
        } else if (statusEl) {
            statusEl.textContent = 'Storage usage is not available in this browser.';
        }
    }

    /**
     * Event handler for adding a new memory.
     */
    async function handleAddMemory() {
        const textarea = document.getElementById('new-memory-text');
        const content = textarea.value.trim();
        if (content) {
            try {
                await addMemory(content);
                textarea.value = '';
                await renderMemoryList();
                await renderStorageStatus();
            } catch (e) {
                alert("Failed to save memory: " + e.message);
            }
        }
    }

    /**
     * Event handler for initiating memory edit.
     */
    function handleEditMemory(li, id) {
        const textEl = li.querySelector('.memory-text');
        const editBtn = li.querySelector('.edit-btn');
        const saveBtn = li.querySelector('.save-btn');
        const deleteBtn = li.querySelector('.delete-btn');

        textEl.contentEditable = 'true';
        textEl.focus();
        // Move caret to end
        const range = document.createRange();
        range.selectNodeContents(textEl);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        editBtn.classList.add('hidden');
        saveBtn.classList.remove('hidden');
        deleteBtn.classList.add('hidden');
    }

    /**
     * Event handler for saving edited memory.
     */
    async function handleSaveMemory(li, id) {
        const textEl = li.querySelector('.memory-text');
        const content = textEl.textContent.trim();
        
        try {
            await updateMemory(id, content);
            textEl.contentEditable = 'false';
            await renderMemoryList();
            await renderStorageStatus();
        } catch (e) {
            alert("Failed to update memory: " + e.message);
        }
    }

    /**
     * Event handler for deleting a single memory.
     */
    async function handleDeleteMemory(id) {
        if (confirm("Are you sure you want to delete this memory?")) {
            try {
                await deleteMemory(id);
                await renderMemoryList();
                await renderStorageStatus();
            } catch (e) {
                alert("Failed to delete memory: " + e.message);
            }
        }
    }

    /**
     * Event handler for deleting all memories.
     */
    async function handleDeleteAllMemories() {
        if (confirm("WARNING: Are you absolutely sure you want to delete ALL saved memories? This action cannot be undone.")) {
            try {
                await deleteAllMemories();
                await renderMemoryList();
                await renderStorageStatus();
            } catch (e) {
                alert("Failed to delete all memories: " + e.message);
            }
        }
    }

    // --- END NEW MEMORY MODAL LOGIC ---

    // --- UTILITIES (formatCharLimit, formatBytes, handleContentEditableInput, etc. - assumed complete) ---

    // ... (omitted utility functions for brevity) ...

    function formatCharLimit(limit) {
        if (limit >= 1000) return (limit / 1000) + 'K';
        return limit;
    }

    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
    
    // Simple HTML escaping function
    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#39;');
    }
    
    // ... (more omitted utility functions) ...


    function handleContentEditableInput() {
        // ... (existing content editable logic) ...
        // ... (update char counter logic) ...
    }
    
    function handleInputSubmission() {
        // ... (existing submission logic) ...
    }
    
    function handlePaste() {
        // ... (existing paste logic) ...
    }
    
    function handleFileUpload() {
        // ... (existing file upload logic) ...
    }

    function handleCopyCode(e) {
        // ... (existing copy code logic) ...
    }
    
    function handleFileDownload(e) {
        // ... (existing file download logic) ...
    }
    
    function parseGeminiResponse(responseText, groundingSources) {
        // ... (existing parsing logic) ...
        return { html: '...', thoughtProcess: '...', sourcesHTML: '...' }; // Placeholder
    }
    

    // --- STYLES INJECTION ---
    function injectStyles() {
        if (document.getElementById('ai-dynamic-styles')) return;

        // Font Awesome 6 (for brain, gear, and ellipsis icons)
        const fontAwesomeLink = document.createElement('link');
        fontAwesomeLink.rel = 'stylesheet';
        fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';
        document.head.appendChild(fontAwesomeLink);

        // KaTeX Styles
        const katexStyles = document.createElement('link');
        katexStyles.id = 'ai-katex-styles';
        katexStyles.rel = 'stylesheet';
        katexStyles.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.css';
        document.head.appendChild(katexStyles);

        const style = document.createElement('style');
        style.id = 'ai-dynamic-styles';
        style.textContent = `
            :root {
                /* Color Palette */
                --ai-dark-bg-1: #2f3336;
                --ai-dark-bg-2: #3c4043;
                --ai-light-bg: #e8eaed;
                --ai-blue: #4285f4;
                --ai-green: #34a853;
                --ai-yellow: #fbbc04;
                --ai-red: #ea4335;
                --ai-border: #444;
                --ai-hover-bg: rgba(255, 255, 255, 0.05);
                --ai-blue-transparent: rgba(66, 133, 244, 0.2);
                --ai-scroll-track: #444;
                --ai-scroll-thumb: #666;
            }

            /* Global Container */
            #ai-container {
                /* ... (existing styles) ... */
            }
            
            /* ... (more existing styles) ... */

            /* Menu and Input Area Styles */
            #ai-compose-area {
                /* ... (existing styles) ... */
            }

            #ai-input-wrapper {
                /* ... (existing styles) ... */
                position: relative; /* ADDED: To anchor the new menu */
            }

            /* Old Buttons are now inside the menu */
            #ai-attachment-button, #ai-memory-button, #ai-settings-button {
                /* The original buttons are hidden in the input row, 
                   but will be visible inside the new menu */
                width: auto;
                height: auto;
                margin: 0;
                padding: 10px;
                background: transparent;
                border: none;
                color: #fff;
            }

            /* --- START NEW MENU FEATURE CSS --- */

            /* 1. The Floating Menu Container (Hidden by default) */
            #ai-tools-menu {
                position: absolute;
                bottom: calc(100% + 10px); /* Position 10px above the input wrapper */
                right: 5px;
                background: var(--ai-dark-bg-1, #2f3336); 
                border: 1px solid var(--ai-border, #444);
                border-radius: 8px;
                padding: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
                display: flex;
                flex-direction: column-reverse; /* To have the buttons appear from the bottom */
                opacity: 0;
                pointer-events: none;
                transform: translateY(10px);
                transition: opacity 0.2s ease-in-out, transform 0.2s ease-in-out;
                z-index: 1000;
                min-width: 200px;
            }

            #ai-tools-menu.active {
                opacity: 1;
                pointer-events: all;
                transform: translateY(0);
            }

            /* 2. Styling for the original buttons inside the menu */
            #ai-tools-menu button {
                display: flex;
                justify-content: flex-start;
                align-items: center;
                width: 100%;
                padding: 10px;
                margin: 4px 0;
                border-radius: 4px;
                background: transparent;
                transition: background-color 0.2s;
                color: #fff; /* Ensure text is visible */
                font-family: inherit;
                font-size: 14px;
                text-align: left;
            }
            
            /* Ensure the original icons are centered and have margin */
            #ai-tools-menu button svg, 
            #ai-tools-menu button i { 
                margin-right: 12px; 
                width: 20px;
                flex-shrink: 0;
            }

            #ai-tools-menu button:hover,
            #ai-tools-menu button.active {
                background-color: var(--ai-hover-bg, rgba(255, 255, 255, 0.05));
            }
            
            /* Highlight the settings button when its menu is open */
            #ai-settings-button.active {
                background-color: var(--ai-blue-transparent) !important;
            }

            /* 3. New Menu Toggle Button (Vertical Ellipsis) */
            #ai-more-menu-toggle {
                background: var(--ai-dark-bg-2, #3c4043);
                color: var(--ai-blue, #4285f4);
                width: 40px;
                height: 40px;
                border-radius: 50%;
                border: 1px solid var(--ai-border, #444);
                cursor: pointer;
                font-size: 18px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background-color 0.2s, box-shadow 0.2s;
                margin-left: 5px; 
                flex-shrink: 0; 
            }

            #ai-more-menu-toggle:hover,
            #ai-more-menu-toggle.active {
                background-color: var(--ai-blue-transparent, rgba(66, 133, 244, 0.2));
                box-shadow: 0 0 5px var(--ai-blue-transparent, rgba(66, 133, 244, 0.5));
            }
            /* --- END NEW MENU FEATURE CSS --- */
            
            /* ... (all other existing styles) ... */

        `;
        document.head.appendChild(style);
    }

    // --- INITIALIZATION ---
    document.addEventListener('keydown', handleKeyDown);
    initMemoryDB(); // Initialize DB early, but do not block execution

    // --- Final Execution ---
})();
