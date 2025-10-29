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
 * * FIX & UI CHANGE:
 * - FIXED: API error "Unknown name "attachmentPreviews"" by sanitizing chat history before sending.
 * - NEW: Combined attachment, memory, and settings buttons into a single 'More Options' menu.
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
    
    // ... httpGetAsync and getUserLocationForContext (unchanged) ...
    // [Snipped for brevity]
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

    // ... renderKaTeX, renderGraphs, drawCustomGraph (unchanged) ...
    // [Snipped for brevity]

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

    /**
     * NEW UI LOGIC: Toggles the three-button options menu.
     */
    function toggleOptionsMenu() {
        const menu = document.getElementById('ai-options-menu');
        const button = document.getElementById('ai-more-options-button');
        const isMenuOpen = menu.classList.toggle('active');
        button.classList.toggle('active', isMenuOpen);

        // Ensure the existing settings menu is closed when opening/closing the options menu
        const settingsMenu = document.getElementById('ai-settings-menu');
        if (settingsMenu) {
            settingsMenu.classList.remove('active');
        }

        if (isMenuOpen) {
            document.addEventListener('click', handleOptionsMenuOutsideClick);
        } else {
            document.removeEventListener('click', handleOptionsMenuOutsideClick);
        }
    }

    /**
     * NEW UI LOGIC: Handles closing the options menu when clicking outside of it.
     */
    function handleOptionsMenuOutsideClick(event) {
        const menu = document.getElementById('ai-options-menu');
        const optionsWrapper = document.getElementById('ai-more-options-wrapper');

        // Check if the click occurred outside the options wrapper (which contains the button and the menu)
        if (menu && menu.classList.contains('active') && optionsWrapper && !optionsWrapper.contains(event.target)) {
            toggleOptionsMenu();
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

        // Original Buttons - Now placed inside the new menu
        const attachmentButton = document.createElement('button');
        attachmentButton.id = 'ai-attachment-button';
        // ADDED LABEL for menu clarity
        attachmentButton.innerHTML = attachmentIconSVG + ' Attach File'; 
        attachmentButton.title = 'Attach files';
        attachmentButton.onclick = () => handleFileUpload();

        const memoryButton = document.createElement('button');
        memoryButton.id = 'ai-memory-button';
        // ADDED LABEL for menu clarity
        memoryButton.innerHTML = '<i class="fa-solid fa-brain"></i> Saved Memories';
        memoryButton.title = 'Saved Memories';
        memoryButton.onclick = showMemoryModal;

        const settingsButton = document.createElement('button');
        settingsButton.id = 'ai-settings-button';
        // ADDED LABEL for menu clarity
        settingsButton.innerHTML = '<i class="fa-solid fa-gear"></i> Settings';
        settingsButton.title = 'Settings';
        settingsButton.onclick = toggleSettingsMenu;
        
        // --- START NEW UI MODIFICATION (REPLACE 3 BUTTONS WITH 1 MENU) ---
        
        // 1. Create the pop-up menu container
        const optionsMenu = document.createElement('div');
        optionsMenu.id = 'ai-options-menu';
        
        // 2. Create the Main Menu Toggle Button (reusing the gear icon)
        const moreOptionsButton = document.createElement('button');
        moreOptionsButton.id = 'ai-more-options-button';
        moreOptionsButton.innerHTML = '<i class="fa-solid fa-gear"></i>'; 
        moreOptionsButton.title = 'More Options';
        moreOptionsButton.onclick = () => toggleOptionsMenu();

        // 3. Create the main wrapper (replaces the 3 individual buttons' space)
        const moreOptionsWrapper = document.createElement('div');
        moreOptionsWrapper.id = 'ai-more-options-wrapper'; 
        
        // Move the 3 existing buttons into the menu (order: settings, memory, attachment)
        optionsMenu.appendChild(settingsButton);
        optionsMenu.appendChild(memoryButton);
        optionsMenu.appendChild(attachmentButton);

        moreOptionsWrapper.appendChild(optionsMenu);
        moreOptionsWrapper.appendChild(moreOptionsButton);

        // --- END NEW UI MODIFICATION ---

        const charCounter = document.createElement('div');
        charCounter.id = 'ai-char-counter';
        charCounter.textContent = `0 / ${formatCharLimit(CHAR_LIMIT)}`;

        inputWrapper.appendChild(attachmentPreviewContainer);
        inputWrapper.appendChild(visualInput);
        
        // *** REPLACED THE 3 OLD APPENDS WITH THE NEW WRAPPER ***
        // inputWrapper.appendChild(attachmentButton); 
        // inputWrapper.appendChild(memoryButton); 
        // inputWrapper.appendChild(settingsButton); 
        inputWrapper.appendChild(moreOptionsWrapper);


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
        // Also remove listener for the new combined menu
        document.removeEventListener('click', handleOptionsMenuOutsideClick);
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

    // ... determineIntentCategory, FSP_HISTORY, getDynamicSystemInstructionAndModel, showWebSearchNudge (unchanged) ...
    // [Snipped for brevity]
    
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
     * - **FIXED**: Removes `attachmentPreviews` from chat history before API call.
     */
    async function callGoogleAI(responseBubble) {
        if (!API_KEY) {
            responseBubble.innerHTML = `<div class="ai-error">API Key is missing.</div>`;
            return;
        }

        currentAIRequestController = new AbortController();
        let firstMessageContext = '';
        if (chatHistory.length <= 1) {
            // Only for the very first user message
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
            firstMessageContext = `(System Info: User is asking from location:\n${location}. Current date is ${date}, ${time}. User Email: Not Authenticated/Removed.)\n\n`;
        }

        // UPDATED: Use full chat history
        let processedChatHistory = [...chatHistory];
        const lastMessageIndex = processedChatHistory.length - 1;
        const userParts = processedChatHistory[lastMessageIndex].parts;
        const textPartIndex = userParts.findIndex(p => p.text);
        const lastUserQuery = userParts[textPartIndex]?.text || '';

        // UPDATED: Await the async prompt generation
        const {
            instruction: dynamicInstruction,
            model
        } = await getDynamicSystemInstructionAndModel(lastUserQuery, appSettings);
        
        // **FIX: Remove 'attachmentPreviews' from messages before sending to API**
        const sanitizedChatHistory = processedChatHistory.map(message => {
            // Create a shallow copy of the message object
            const sanitizedMessage = { ...message };
            
            // Remove the custom UI field that is not recognized by the API
            if (sanitizedMessage.attachmentPreviews) {
                delete sanitizedMessage.attachmentPreviews;
            }

            // Return the sanitized copy
            return sanitizedMessage;
        });

        if (textPartIndex > -1) {
            userParts[textPartIndex].text = firstMessageContext + userParts[textPartIndex].text;
        } else if (firstMessageContext) {
            userParts.unshift({
                text: firstMessageContext.trim()
            });
        }

        const payload = {
            // Use the sanitized chat history for the API call
            contents: sanitizedChatHistory,
            systemInstruction: {
                parts: [{
                    text: dynamicInstruction
                }]
            }
        };

        // NEW: Add grounding tool if web search is enabled
        if (appSettings.webSearch) {
            payload.tools = [{
                "google_search": {}
            }];
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
                    .map(web => ({
                        url: web.uri,
                        title: web.title
                    }));
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
        // The original settings button is now inside the new menu, no need to toggle its class here
        const isMenuOpen = menu.classList.toggle('active');

        if (isMenuOpen) {
            document.getElementById('settings-web-search').checked = appSettings.webSearch;
            document.getElementById('settings-location-sharing').checked = appSettings.locationSharing;
            // Prevent the settings menu and the options menu from being open at the same time
            const optionsMenu = document.getElementById('ai-options-menu');
            if (optionsMenu && optionsMenu.classList.contains('active')) {
                toggleOptionsMenu();
            }
            document.addEventListener('click', handleMenuOutsideClick);
        } else {
            document.removeEventListener('click', handleMenuOutsideClick);
        }
    }

    function handleMenuOutsideClick(event) {
        const menu = document.getElementById('ai-settings-menu');
        const button = document.getElementById('ai-settings-button');
        const composeArea = document.getElementById('ai-compose-area');
        
        // This logic is retained for the *Settings Menu* itself.
        if (menu && menu.classList.contains('active') && !composeArea.contains(event.target) && event.target !== menu && !menu.contains(event.target)) {
            toggleSettingsMenu();
        } else if (menu && menu.classList.contains('active') && event.target !== button && !button.contains(event.target) && event.target !== menu && !menu.contains(event.target)) {
            toggleSettingsMenu();
        }
    }
    
    // ... rest of the file (handlePaste, saveAppSettings, etc.)
    // [Snipped for brevity]
    
    /**
     * Handles content paste events in the input field, converting large text pastes
     * or image pastes into attachments.
     */
    async function handlePaste(e) {
        e.preventDefault();
        const clipboardData = e.clipboardData || window.clipboardData;
        const items = clipboardData.items;
        let handled = false;

        // 1. Check for files (images)
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                if (attachedFiles.length >= MAX_ATTACHMENTS_PER_MESSAGE) {
                    alert(`Cannot attach more than ${MAX_ATTACHMENTS_PER_MESSAGE} files.`);
                    return;
                }
                const file = item.getAsFile();
                // Generate a unique name for pasted images
                file.name = `Pasted_Image_${new Date().getTime()}.${file.type.split('/')[1] || 'png'}`;
                await processAttachment(file);
                handled = true;
                break;
            }
        }

        if (handled) return;

        // 2. Check for text
        const text = clipboardData.getData('text/plain');
        if (text) {
            const visualInput = document.getElementById('ai-input');

            // Handle large text by turning it into a file (e.g., code block, document)
            if (text.length > PASTE_TO_FILE_THRESHOLD) {
                if (attachedFiles.length >= MAX_ATTACHMENTS_PER_MESSAGE) {
                    alert(`Cannot attach more than ${MAX_ATTACHMENTS_PER_MESSAGE} files.`);
                    return;
                }
                const blob = new Blob([text], {
                    type: 'text/plain'
                });
                const file = new File([blob], `Pasted_Code_${new Date().getTime()}.txt`, {
                    type: 'text/plain'
                });
                await processAttachment(file);
            } else {
                // Insert smaller text normally
                document.execCommand('insertText', false, text);
            }
        }
        handleContentEditableInput();
    }

    /**
     * Saves application settings to localStorage.
     */
    function saveAppSettings() {
        localStorage.setItem('ai-app-settings', JSON.stringify(appSettings));
    }

    /**
     * Creates the hidden settings menu element.
     */
    function createSettingsMenu() {
        const menu = document.createElement('div');
        menu.id = 'ai-settings-menu';
        menu.className = 'ai-menu';
        menu.innerHTML = `
            <h3>Agent Settings</h3>
            <div class="setting-group">
                <label for="settings-web-search" class="setting-label">
                    <i class="fa-solid fa-globe"></i>
                    Web Search (Google Grounding)
                </label>
                <input type="checkbox" id="settings-web-search" class="setting-toggle">
                <p class="setting-description">Allows the AI to search the web for real-time information and cite sources.</p>
            </div>
            <div class="setting-group">
                <label for="settings-location-sharing" class="setting-label">
                    <i class="fa-solid fa-location-dot"></i>
                    Share General Location
                </label>
                <input type="checkbox" id="settings-location-sharing" class="setting-toggle">
                <p class="setting-description">Allows the AI to fetch your current city/general area for relevant context (e.g., weather, local news).</p>
            </div>
        `;

        // Add event listeners after creation
        setTimeout(() => {
            const webSearchToggle = document.getElementById('settings-web-search');
            const locationToggle = document.getElementById('settings-location-sharing');

            webSearchToggle.checked = appSettings.webSearch;
            locationToggle.checked = appSettings.locationSharing;

            webSearchToggle.onchange = () => {
                appSettings.webSearch = webSearchToggle.checked;
                saveAppSettings();
            };
            locationToggle.onchange = () => {
                appSettings.locationSharing = locationToggle.checked;
                saveAppSettings();
            };
        }, 0);

        return menu;
    }

    /**
     * Handles input events on the content editable div, updating character count and resizing.
     */
    const handleContentEditableInput = debounce(() => {
        const visualInput = document.getElementById('ai-input');
        const charCounter = document.getElementById('ai-char-counter');
        if (!visualInput || !charCounter) return;

        const charCount = visualInput.innerText.length;
        updateCharCounter(charCount);

        // Auto-resize logic
        visualInput.style.height = 'auto'; // Reset height
        let newHeight = visualInput.scrollHeight;

        if (newHeight > MAX_INPUT_HEIGHT) {
            newHeight = MAX_INPUT_HEIGHT;
            visualInput.style.overflowY = 'auto';
        } else {
            visualInput.style.overflowY = 'hidden';
        }

        visualInput.style.height = `${newHeight}px`;
    }, 50);

    /**
     * Updates the character count display and highlights on overflow.
     */
    function updateCharCounter(count) {
        const charCounter = document.getElementById('ai-char-counter');
        if (!charCounter) return;

        charCounter.textContent = `${count} / ${formatCharLimit(CHAR_LIMIT)}`;
        if (count > CHAR_LIMIT) {
            charCounter.classList.add('over-limit');
        } else {
            charCounter.classList.remove('over-limit');
        }
    }

    /**
     * Formats a number with commas for display.
     */
    function formatCharLimit(limit) {
        return limit.toLocaleString();
    }

    /**
     * Handles form submission on Enter key press.
     */
    async function handleInputSubmission(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const visualInput = document.getElementById('ai-input');
            const userQuery = visualInput.innerText.trim();
            const charCount = userQuery.length;

            if (isRequestPending || (charCount === 0 && attachedFiles.length === 0)) {
                return;
            }

            if (charCount > CHAR_LIMIT) {
                alert(`The message exceeds the ${formatCharLimit(CHAR_LIMIT)} character limit.`);
                return;
            }

            // 1. Prepare chat message parts
            const userMessageParts = [];

            if (userQuery) {
                userMessageParts.push({
                    text: userQuery
                });
            }

            // Add files as inlineData
            const attachmentPreviews = [];
            for (const fileObj of attachedFiles) {
                // Text files go as simple text part if short enough
                if (fileObj.mimeType.startsWith('text/') && fileObj.textData && fileObj.textData.length < PASTE_TO_FILE_THRESHOLD) {
                    userMessageParts.push({
                        text: `\n--- START ATTACHED TEXT FILE: ${fileObj.fileName} ---\n${fileObj.textData}\n--- END ATTACHED TEXT FILE ---\n`
                    });
                } else {
                    userMessageParts.push({
                        inlineData: {
                            data: fileObj.data,
                            mimeType: fileObj.mimeType
                        }
                    });
                }
                
                // Store simplified preview data for rendering in chat history
                attachmentPreviews.push({
                    fileName: fileObj.fileName,
                    mimeType: fileObj.mimeType,
                    dataUrl: fileObj.dataUrl || null // Only images will have this
                });
            }

            // 2. Add to chat history
            const userMessage = {
                role: "user",
                parts: userMessageParts,
                attachmentPreviews: attachmentPreviews // NEW: Store for UI rendering
            };
            chatHistory.push(userMessage);

            // 3. Render and reset
            const responseContainer = document.getElementById('ai-response-container');
            const userBubble = document.createElement('div');
            userBubble.className = 'ai-message-bubble user-message';
            // UPDATED: Use the new rendering function for the submitted message
            let bubbleContent = '';
            if (userQuery) bubbleContent += `<p>${escapeHTML(userQuery)}</p>`;
            if (attachmentPreviews.length > 0) {
                bubbleContent += createAttachmentPreviewHTML(attachmentPreviews);
            }
            userBubble.innerHTML = bubbleContent;
            responseContainer.appendChild(userBubble);

            visualInput.innerText = '';
            visualInput.style.height = '40px';
            document.getElementById('ai-attachment-preview').innerHTML = '';
            attachedFiles = [];
            updateCharCounter(0);

            // 4. Show loading state
            const loadingBubble = document.createElement('div');
            loadingBubble.className = 'ai-message-bubble gemini-response loading';
            loadingBubble.innerHTML = `<div class="ai-loading-spinner"></div><div class="ai-loading-text">Gemini is thinking...</div>`;
            responseContainer.appendChild(loadingBubble);
            responseContainer.scrollTop = responseContainer.scrollHeight;

            const inputWrapper = document.getElementById('ai-input-wrapper');
            if (inputWrapper) inputWrapper.classList.add('waiting');

            isRequestPending = true;
            await callGoogleAI(loadingBubble);

            document.getElementById('ai-container').classList.add('chat-active');
        }
    }

    /**
     * Prompts the user to select files.
     */
    function handleFileUpload() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.accept = 'image/*, text/*, application/pdf, application/json, application/xml, .csv, .md, .js, .py, .html, .css';
        fileInput.onchange = handleFileSelection;
        fileInput.click();
    }

    /**
     * Processes selected files and adds them to the attachment list.
     */
    function handleFileSelection(event) {
        const files = Array.from(event.target.files);
        let count = 0;
        for (const file of files) {
            if (attachedFiles.length + count < MAX_ATTACHMENTS_PER_MESSAGE) {
                processAttachment(file);
                count++;
            } else {
                alert(`Maximum of ${MAX_ATTACHMENTS_PER_MESSAGE} files reached.`);
                break;
            }
        }
    }

    /**
     * Handles file drop events.
     */
    function handleFileDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        document.getElementById('ai-input-wrapper').classList.remove('drag-over');

        const files = Array.from(event.dataTransfer.files);
        let count = 0;
        for (const file of files) {
            if (attachedFiles.length + count < MAX_ATTACHMENTS_PER_MESSAGE) {
                processAttachment(file);
                count++;
            } else {
                alert(`Maximum of ${MAX_ATTACHMENTS_PER_MESSAGE} files reached.`);
                break;
            }
        }
    }

    /**
     * Processes a single file: reads it as a Data URL (for images) or text (for text files),
     * converts to Base64, and updates the UI.
     */
    async function processAttachment(file) {
        if (!file.type) {
            alert(`File type not recognized for ${file.name}.`);
            return;
        }

        const reader = new FileReader();
        const isImage = file.type.startsWith('image/');
        const isText = file.type.startsWith('text/') || file.type.endsWith('/json') || file.type.endsWith('/xml') || file.type.endsWith('/csv') || file.type.endsWith('/javascript') || file.type.endsWith('/python') || file.type.endsWith('/html') || file.type.endsWith('/css');

        let data = null;
        let dataUrl = null;
        let textData = null;

        await new Promise(resolve => {
            reader.onload = (e) => {
                if (isText) {
                    textData = e.target.result;
                    // For API, encode to base64 only if we need to send it as a part.
                    // For text files, we prefer to send it as a text part, so we skip base64 here.
                    data = null;
                } else {
                    dataUrl = e.target.result;
                    // Extract the Base64 data part
                    data = dataUrl.split(',')[1];
                }
                resolve();
            };

            reader.onerror = () => {
                console.error("Error reading file:", file.name);
                resolve();
            };

            if (isText) {
                reader.readAsText(file);
            } else {
                reader.readAsDataURL(file);
            }
        });

        if (data || isText) {
            attachedFiles.push({
                fileName: file.name,
                mimeType: file.type,
                data: data, // Base64 string for images/PDFs
                dataUrl: dataUrl, // DataURL for image previews
                textData: textData // Raw text content for text files
            });
            renderAttachmentPreview();
        }
    }

    /**
     * Renders the horizontal scrollable attachment preview list.
     */
    function renderAttachmentPreview() {
        const previewContainer = document.getElementById('ai-attachment-preview');
        if (!previewContainer) return;
        previewContainer.innerHTML = '';

        if (attachedFiles.length === 0) {
            previewContainer.style.display = 'none';
            return;
        }

        previewContainer.style.display = 'flex';

        attachedFiles.forEach((file, index) => {
            const card = document.createElement('div');
            card.className = 'attachment-card';
            card.dataset.index = index;

            let previewContent;
            if (file.mimeType.startsWith('image/') && file.dataUrl) {
                previewContent = `<img src="${file.dataUrl}" alt="${escapeHTML(file.fileName)}">`;
            } else {
                previewContent = `<span class="file-icon">📁</span>`; // Simple icon for non-image files
            }

            card.innerHTML = `
                ${previewContent}
                <div class="file-info">
                    <span>${escapeHTML(file.fileName)}</span>
                </div>
                <button class="remove-attachment-btn">&times;</button>
            `;

            card.querySelector('.remove-attachment-btn').onclick = () => removeAttachment(index);

            previewContainer.appendChild(card);
        });

        // Update the drag-over handling for the preview area
        const inputWrapper = document.getElementById('ai-input-wrapper');
        inputWrapper.ondragover = (e) => {
            e.preventDefault();
            inputWrapper.classList.add('drag-over');
        };
        inputWrapper.ondragleave = () => {
            inputWrapper.classList.remove('drag-over');
        };
        inputWrapper.ondrop = handleFileDrop;
    }

    /**
     * Removes an attachment by index.
     */
    function removeAttachment(index) {
        if (index >= 0 && index < attachedFiles.length) {
            attachedFiles.splice(index, 1);
            renderAttachmentPreview();
            handleContentEditableInput(); // Re-check sizing
        }
    }

    // --- NEW: MEMORY MODAL AND RENDER FUNCTIONS ---
    
    /**
     * Creates and attaches the memory management modal.
     */
    function createMemoryModal() {
        if (document.getElementById('ai-memory-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'ai-memory-modal';
        modal.className = 'ai-modal';
        modal.innerHTML = `
            <div class="ai-modal-content">
                <div class="ai-modal-header">
                    <h2><i class="fa-solid fa-brain"></i> Saved Memories</h2>
                    <span class="ai-close-modal">&times;</span>
                </div>
                <div class="ai-modal-body">
                    <div class="memory-input-section">
                        <textarea id="ai-memory-editor" placeholder="Enter a new memory (e.g., My dog's name is Rex. I prefer professional analyses.)"></textarea>
                        <div class="memory-actions">
                            <button id="ai-add-memory-btn" class="primary-btn"><i class="fa-solid fa-plus"></i> Add New Memory</button>
                            <button id="ai-clear-editor-btn" class="secondary-btn">Clear Editor</button>
                        </div>
                    </div>
                    <div class="memory-list-header">
                        <h3>Memory List (Top 10 used for context)</h3>
                        <button id="ai-delete-all-memories-btn" class="danger-btn"><i class="fa-solid fa-trash"></i> Delete All</button>
                    </div>
                    <div id="ai-memory-list">
                        <div class="ai-loading-spinner small"></div>
                    </div>
                </div>
                <div class="ai-modal-footer">
                    <div id="ai-storage-status">
                        </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Setup handlers
        modal.querySelector('.ai-close-modal').onclick = () => modal.remove();
        modal.querySelector('#ai-add-memory-btn').onclick = () => handleAddEditMemory(false);
        modal.querySelector('#ai-clear-editor-btn').onclick = () => document.getElementById('ai-memory-editor').value = '';
        modal.querySelector('#ai-delete-all-memories-btn').onclick = handleDeleteAllMemories;

        // Make modal draggable
        makeDraggable(modal.querySelector('.ai-modal-content'), modal.querySelector('.ai-modal-header'));
    }

    /**
     * Makes an element draggable using its header as the handle.
     * @param {HTMLElement} element The element to make draggable.
     * @param {HTMLElement} handle The element to use as the drag handle.
     */
    function makeDraggable(element, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

        handle.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            // get the mouse cursor position at startup:
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            // call a function whenever the cursor moves:
            document.onmousemove = elementDrag;
            element.style.cursor = 'grabbing';
            handle.style.cursor = 'grabbing';
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            // calculate the new cursor position:
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            // set the element's new position:
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        }

        function closeDragElement() {
            /* stop moving when mouse button is released:*/
            document.onmouseup = null;
            document.onmousemove = null;
            element.style.cursor = 'default';
            handle.style.cursor = 'grab';
        }
        element.style.position = 'absolute';
        handle.style.cursor = 'grab';
    }

    /**
     * Shows the memory modal and loads the list.
     */
    function showMemoryModal() {
        createMemoryModal();
        const modal = document.getElementById('ai-memory-modal');
        modal.style.display = 'flex';
        renderMemoryList();
    }

    /**
     * Renders the list of memories and storage status.
     */
    async function renderMemoryList() {
        const memoryListDiv = document.getElementById('ai-memory-list');
        const storageStatusDiv = document.getElementById('ai-storage-status');
        if (!memoryListDiv || !storageStatusDiv) return;

        memoryListDiv.innerHTML = '<div class="ai-loading-spinner small"></div>';
        
        try {
            const memories = await getMemories();
            memories.sort((a, b) => b.timestamp - a.timestamp); // Newest first

            if (memories.length === 0) {
                memoryListDiv.innerHTML = '<p class="no-memories-text">No saved memories yet.</p>';
            } else {
                memoryListDiv.innerHTML = memories.map((mem, index) => {
                    const formattedDate = new Date(mem.timestamp).toLocaleString();
                    const isTopTen = index < 10 ? 'top-ten' : '';
                    
                    return `
                        <div class="memory-item ${isTopTen}" data-id="${mem.id}" data-content="${escapeHTML(mem.content)}">
                            <span class="memory-content">${escapeHTML(mem.content)}</span>
                            <div class="memory-meta">
                                <span class="memory-date">${formattedDate}</span>
                                ${index < 10 ? '<span class="memory-rank">Context Slot ' + (index + 1) + '</span>' : ''}
                            </div>
                            <div class="memory-item-actions">
                                <button class="edit-memory-btn"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
                                <button class="delete-memory-btn danger-btn-small"><i class="fa-solid fa-trash"></i> Delete</button>
                            </div>
                        </div>
                    `;
                }).join('');

                // Add event listeners for edit/delete buttons
                memoryListDiv.querySelectorAll('.edit-memory-btn').forEach(btn => {
                    btn.onclick = (e) => {
                        const item = e.target.closest('.memory-item');
                        const id = parseInt(item.dataset.id);
                        const content = item.querySelector('.memory-content').textContent;
                        
                        document.getElementById('ai-memory-editor').value = content;
                        document.getElementById('ai-memory-editor').dataset.editId = id;
                        
                        const addButton = document.getElementById('ai-add-memory-btn');
                        addButton.textContent = 'Save Changes';
                        addButton.onclick = () => handleAddEditMemory(true, id);
                        
                        // Scroll to the editor
                        document.getElementById('ai-memory-editor').focus();
                    };
                });
                
                memoryListDiv.querySelectorAll('.delete-memory-btn').forEach(btn => {
                    btn.onclick = (e) => {
                        const id = parseInt(e.target.closest('.memory-item').dataset.id);
                        handleDeleteMemory(id);
                    };
                });
            }
        } catch (e) {
            memoryListDiv.innerHTML = `<p class="error-text">Failed to load memories: ${e.message}</p>`;
        }

        // Update Storage Status
        const usage = await getStorageUsage();
        if (usage) {
            const progress = Math.min(100, parseFloat(usage.percentage));
            storageStatusDiv.innerHTML = `
                Storage Used: ${usage.used} of ${usage.total}
                <div class="storage-progress-bar-container">
                    <div class="storage-progress-bar" style="width: ${progress}%;"></div>
                </div>
            `;
        } else {
            storageStatusDiv.innerHTML = '<p>Storage usage statistics not available.</p>';
        }
    }

    /**
     * Handles adding a new memory or saving an edited one.
     */
    async function handleAddEditMemory(isEdit, id) {
        const editor = document.getElementById('ai-memory-editor');
        const content = editor.value.trim();

        if (!content) {
            alert("Memory content cannot be empty.");
            return;
        }

        try {
            if (isEdit) {
                await updateMemory(id, content);
            } else {
                await addMemory(content);
            }
            editor.value = '';
            
            // Reset editor button state
            const addButton = document.getElementById('ai-add-memory-btn');
            addButton.textContent = 'Add New Memory';
            addButton.onclick = () => handleAddEditMemory(false);
            delete editor.dataset.editId; // Clean up edit ID

            renderMemoryList();
        } catch (e) {
            alert(`Failed to save memory: ${e.message}`);
        }
    }

    /**
     * Handles deleting a single memory.
     */
    async function handleDeleteMemory(id) {
        if (!confirm("Are you sure you want to delete this memory?")) return;
        try {
            await deleteMemory(id);
            renderMemoryList();
        } catch (e) {
            alert(`Failed to delete memory: ${e.message}`);
        }
    }

    /**
     * Handles deleting all memories.
     */
    async function handleDeleteAllMemories() {
        if (!confirm("Are you absolutely sure you want to delete ALL saved memories? This action cannot be undone.")) return;
        try {
            await deleteAllMemories();
            renderMemoryList();
        } catch (e) {
            alert(`Failed to delete all memories: ${e.message}`);
        }
    }

    // --- END MEMORY FUNCTIONS ---
    
    /**
     * Parses the Gemini response text, extracting thought process,
     * converting markdown to HTML (including code blocks and KaTeX),
     * and handling custom tags (graphs, downloads).
     * UPDATED: Now uses `groundingSources` array for citations.
     */
    function parseGeminiResponse(text, groundingSources) {
        let thoughtProcess = '';
        let sourcesHTML = '';

        // 1. Extract Thought Process (Internal Monologue)
        const thoughtRegex = /<THOUGHT_PROCESS>([\s\S]*?)<\/THOUGHT_PROCESS>/;
        const thoughtMatch = text.match(thoughtRegex);
        if (thoughtMatch) {
            thoughtProcess = thoughtMatch[1].trim();
            text = text.replace(thoughtRegex, '').trim();
        }

        // 2. Extract and Handle Custom Download Tag
        const downloadRegex = /<DOWNLOAD FILENAME="(.*?)" MIMETYPE="(.*?)" ENCODING="base64">([\s\S]*?)<\/DOWNLOAD>/g;
        text = text.replace(downloadRegex, (match, filename, mimetype, base64Content) => {
            const encodedFilename = encodeURIComponent(filename);
            const encodedMimeType = encodeURIComponent(mimetype);
            const truncatedName = filename.length > 30 ? filename.substring(0, 27) + '...' : filename;
            
            return `
                <div class="download-widget">
                    ${downloadIconSVG}
                    <div class="download-info">
                        <span class="download-filename" title="${escapeHTML(filename)}">${escapeHTML(truncatedName)}</span>
                        <span class="download-mimetype">(${escapeHTML(mimetype)})</span>
                    </div>
                    <button class="download-file-btn primary-btn" 
                            data-filename="${encodedFilename}" 
                            data-mimetype="${encodedMimeType}" 
                            data-base64="${base64Content.trim()}">
                        Download
                    </button>
                </div>
            `;
        });
        
        // 3. Extract and Handle Custom Graph Tag
        const graphRegex = /<GRAPH JSON="([\s\S]*?)" \/>/g;
        text = text.replace(graphRegex, (match, jsonString) => {
            const decodedJson = decodeURIComponent(jsonString).replace(/\n/g, ''); // Decode and strip newlines
            return `<div class="custom-graph-placeholder" data-graph-data="${escapeHTML(decodedJson)}"><canvas></canvas></div>`;
        });

        // 4. Convert KaTeX to placeholder tags
        // Block math: $$ ... $$
        const blockMathRegex = /\$\$([\s\S]*?)\$\$/g;
        text = text.replace(blockMathRegex, (match, tex) => {
            return `<div class="latex-render" data-tex="${escapeHTML(tex.trim())}" data-display-mode="true"></div>`;
        });
        // Inline math: $ ... $
        const inlineMathRegex = /(?<!\\)\$(?!\$)([\s\S]*?)(?<!\\)\$(?!\$)/g;
        text = text.replace(inlineMathRegex, (match, tex) => {
            // Only capture matches that aren't inside backticks (code)
            if (tex.match(/`/)) return match;
            return `<span class="latex-render" data-tex="${escapeHTML(tex.trim())}" data-display-mode="false"></span>`;
        });

        // 5. Convert Markdown code blocks to custom HTML with copy buttons
        const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
        text = text.replace(codeBlockRegex, (match, lang, code) => {
            const language = lang || 'plaintext';
            const escapedCode = escapeHTML(code.trim());

            return `
                <div class="code-block-container">
                    <div class="code-block-header">
                        <span class="code-language">${escapeHTML(language)}</span>
                        <button class="copy-code-btn">
                            ${copyIconSVG}
                            <span class="copy-text">Copy</span>
                        </button>
                    </div>
                    <pre><code class="language-${escapeHTML(language)}">${escapedCode}</code></pre>
                </div>
            `;
        });

        // 6. Basic Markdown processing (bold, italics, newlines to paragraphs)
        let html = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
            .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italics
            .replace(/^(- .*)/gm, '<p class="list-item-bullet">$1</p>') // Simple bullet list
            .replace(/(?:\r\n|\r|\n){2,}/g, '</p><p>') // Double newlines to paragraph
            .replace(/(?:\r\n|\r|\n)/g, '<br>'); // Single newlines to line break

        html = `<p>${html}</p>`; // Wrap in final paragraph

        // 7. Generate Sources HTML (Grounding)
        if (groundingSources.length > 0) {
            const listItems = groundingSources.map((source, index) => {
                // Ensure a valid URL
                const url = source.url.startsWith('http') ? source.url : `https://${source.url}`;
                return `
                    <li>
                        <a href="${url}" target="_blank" rel="noopener noreferrer">
                            ${escapeHTML(source.title || `Source ${index + 1}`)}
                        </a>
                    </li>
                `;
            }).join('');

            sourcesHTML = `
                <div class="ai-sources">
                    <h4>Sources Cited:</h4>
                    <ul class="sources-list">${listItems}</ul>
                </div>
            `;
        }

        return {
            html: html,
            thoughtProcess: thoughtProcess,
            sourcesHTML: sourcesHTML
        };
    }

    /**
     * Escapes HTML entities in a string.
     */
    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Handles copying code content from a code block.
     */
    function handleCopyCode(event) {
        const button = event.currentTarget;
        const container = button.closest('.code-block-container');
        const codeElement = container ? container.querySelector('code') : null;

        if (codeElement) {
            // Create a temporary textarea to hold the text to copy
            const tempTextArea = document.createElement('textarea');
            tempTextArea.value = codeElement.textContent;
            document.body.appendChild(tempTextArea);

            // Select and copy the text
            tempTextArea.select();
            document.execCommand('copy');

            // Clean up
            document.body.removeChild(tempTextArea);

            // Give feedback
            const copyText = button.querySelector('.copy-text');
            const originalText = copyText.textContent;
            const originalIcon = button.querySelector('svg').outerHTML;
            
            button.innerHTML = checkIconSVG + '<span class="copy-text success-copy">Copied!</span>';
            setTimeout(() => {
                button.innerHTML = originalIcon + `<span class="copy-text">${originalText}</span>`;
            }, 2000);
        }
    }

    /**
     * Converts a Base64 string to a Blob object.
     */
    function base64ToBlob(base64, mimeType) {
        const byteCharacters = atob(base64);
        const byteArrays = [];
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
            const slice = byteCharacters.slice(offset, offset + 512);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            byteArrays.push(byteArray);
        }
        return new Blob(byteArrays, {
            type: mimeType
        });
    }

    /**
     * Handles the click event for the custom file download button.
     */
    function handleFileDownload(event) {
        const button = event.currentTarget;
        const filename = decodeURIComponent(button.dataset.filename);
        const mimeType = decodeURIComponent(button.dataset.mimetype);
        const base64Content = button.dataset.base64;

        try {
            const blob = base64ToBlob(base64Content, mimeType);
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // Clean up the object URL after the download starts
            setTimeout(() => URL.revokeObjectURL(url), 100);
            
        } catch (error) {
            console.error("Download failed:", error);
            alert(`Error creating file: ${error.message}`);
        }
    }

    /**
     * Injects the necessary CSS styles into the document head.
     * UPDATED: Includes styles for the new combined options menu.
     */
    function injectStyles() {
        if (document.getElementById('ai-dynamic-styles')) return;

        const fontLink = document.createElement('link');
        fontLink.id = 'ai-google-fonts';
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&family=Lora:wght@400;700&display=swap';
        document.head.appendChild(fontLink);

        const fontAwesomeLink = document.createElement('link');
        fontAwesomeLink.rel = 'stylesheet';
        fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';
        document.head.appendChild(fontAwesomeLink);

        const katexCSSLink = document.createElement('link');
        katexCSSLink.id = 'ai-katex-styles';
        katexCSSLink.rel = 'stylesheet';
        katexCSSLink.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.css';
        document.head.appendChild(katexCSSLink);


        const style = document.createElement('style');
        style.id = 'ai-dynamic-styles';
        style.textContent = `
            /* --- VARIABLES --- */
            :root {
                --ai-main-bg: #1c1c1c;
                --ai-dark-bg: #111111;
                --ai-light-hover: rgba(255, 255, 255, 0.05);
                --ai-border-color: #333333;
                --ai-primary-color: #4285f4;
                --ai-accent-color: #db4437;
                --ai-white: #eeeeee;
                --ai-text-color: #cccccc;
                --ai-code-bg: #2a2a2a;
                --ai-code-color: #a9b7c6;
                --ai-user-color: #8ab4f8;
                --ai-gemini-color: #8c8c8c;
                --ai-blue: #4285f4;
                --ai-green: #0f9d58;
                --ai-yellow: #f4b400;
                --ai-red: #db4437;
            }

            /* --- GLOBAL CONTAINER --- */
            #ai-container {
                position: fixed;
                bottom: -100%; /* Start off-screen */
                right: 0;
                width: 100%;
                max-width: 550px;
                height: 100%;
                max-height: 800px;
                background-color: var(--ai-main-bg);
                color: var(--ai-text-color);
                font-family: 'Lora', Georgia, serif;
                border-top-left-radius: 20px;
                border-top-right-radius: 20px;
                box-shadow: 0 0 40px rgba(0, 0, 0, 0.5);
                z-index: 2147483647; /* Max z-index */
                display: flex;
                flex-direction: column;
                transition: bottom 0.5s ease-out, box-shadow 0.5s ease-out;
                overflow: hidden;
            }

            #ai-container.active {
                bottom: 0;
            }

            #ai-container.deactivating {
                bottom: -100%;
            }

            /* --- HEADER AND BRANDING --- */
            #ai-brand-title {
                position: absolute;
                top: 0;
                left: 50%;
                transform: translateX(-50%);
                font-family: 'Merriweather', serif;
                font-weight: 700;
                font-size: 1.2rem;
                color: var(--ai-text-color);
                padding: 15px;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s;
            }

            #ai-container.chat-active #ai-brand-title {
                opacity: 0;
            }

            #ai-persistent-title {
                position: absolute;
                top: 0;
                left: 50%;
                transform: translateX(-50%);
                font-family: 'Merriweather', serif;
                font-weight: 700;
                font-size: 1.2rem;
                color: var(--ai-primary-color);
                padding: 15px;
                opacity: 0;
                transition: opacity 0.3s;
            }

            #ai-container.chat-active #ai-persistent-title {
                opacity: 1;
            }

            #ai-brand-title span {
                opacity: 0;
                animation: brand-title-pulse 3s infinite alternate;
            }

            #ai-brand-title span:nth-child(even) {
                animation-delay: 0.2s;
            }
            #ai-brand-title span:nth-child(3n) {
                animation-delay: 0.4s;
            }


            #ai-close-button {
                position: absolute;
                top: 10px;
                right: 15px;
                font-size: 2rem;
                cursor: pointer;
                color: var(--ai-text-color);
                opacity: 0.6;
                transition: opacity 0.2s;
                z-index: 10;
            }

            #ai-close-button:hover {
                opacity: 1;
            }

            #ai-welcome-message {
                padding: 50px 30px 20px;
                text-align: center;
                background-color: var(--ai-dark-bg);
                border-bottom: 1px solid var(--ai-border-color);
                transition: height 0.3s ease-out, padding 0.3s ease-out, opacity 0.3s;
                flex-shrink: 0;
            }

            #ai-welcome-message h2 {
                font-family: 'Merriweather', serif;
                color: var(--ai-white);
                font-size: 1.8rem;
                margin-bottom: 10px;
            }

            #ai-welcome-message p {
                font-size: 0.9rem;
                color: var(--ai-gemini-color);
                margin: 5px 0;
            }

            #ai-welcome-message .shortcut-tip {
                font-style: italic;
                font-size: 0.8rem;
                margin-top: 15px;
            }

            #ai-container.chat-active #ai-welcome-message {
                height: 0;
                padding: 0 30px;
                opacity: 0;
                pointer-events: none;
            }

            /* --- RESPONSE AREA --- */
            #ai-response-container {
                flex-grow: 1;
                overflow-y: auto;
                padding: 20px 20px 0;
                display: flex;
                flex-direction: column;
                gap: 15px;
                scroll-behavior: smooth;
            }

            /* --- MESSAGE BUBBLES --- */
            .ai-message-bubble {
                padding: 15px;
                border-radius: 12px;
                line-height: 1.6;
                max-width: 90%;
                opacity: 0;
                animation: message-pop-in 0.3s ease-out forwards;
                transform-origin: bottom;
            }

            .user-message {
                align-self: flex-end;
                background-color: var(--ai-user-color);
                color: var(--ai-dark-bg);
                border-bottom-right-radius: 4px;
                font-size: 0.95rem;
            }
            .user-message p { margin: 0; }
            .user-message em { font-style: normal; }


            .gemini-response {
                align-self: flex-start;
                background-color: var(--ai-dark-bg);
                color: var(--ai-text-color);
                border: 1px solid var(--ai-border-color);
                border-bottom-left-radius: 4px;
                font-size: 0.9rem;
                white-space: pre-wrap;
            }
            .gemini-response p:first-child { margin-top: 0; }
            .gemini-response p:last-child { margin-bottom: 0; }
            .gemini-response p { margin: 10px 0; }

            /* --- ATTACHMENT PREVIEWS IN USER MESSAGE --- */
            .sent-attachment-container {
                display: flex;
                gap: 8px;
                overflow-x: auto;
                padding: 8px 0;
                margin-top: 10px;
                border-top: 1px solid rgba(0, 0, 0, 0.1);
            }
            .sent-attachment-card {
                flex-shrink: 0;
                display: flex;
                flex-direction: column;
                align-items: center;
                background-color: rgba(0, 0, 0, 0.1);
                border-radius: 6px;
                overflow: hidden;
                width: 80px;
                max-height: 100px;
            }
            .sent-attachment-card img {
                width: 100%;
                height: 60px;
                object-fit: cover;
                border-bottom: 1px solid rgba(0, 0, 0, 0.2);
            }
            .sent-attachment-card .sent-file-info {
                padding: 3px;
                font-size: 0.7rem;
                text-align: center;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                width: 100%;
            }
            .sent-attachment-card .file-icon {
                font-size: 2rem;
                padding: 10px;
                line-height: 1;
                color: var(--ai-dark-bg);
            }
            
            /* --- LOADING STATE --- */
            .ai-loading-spinner {
                border: 3px solid var(--ai-border-color);
                border-top: 3px solid var(--ai-primary-color);
                border-radius: 50%;
                width: 20px;
                height: 20px;
                animation: spin 1s linear infinite;
                margin-right: 10px;
                display: inline-block;
            }
            .ai-loading-spinner.small {
                width: 15px;
                height: 15px;
                border-width: 2px;
            }
            .loading {
                display: flex;
                align-items: center;
                animation: none;
            }
            .loading .ai-loading-text {
                font-style: italic;
                color: var(--ai-gemini-color);
            }

            /* --- INLINE MATH (KaTeX) --- */
            .latex-render {
                /* Inline KaTeX */
                padding: 0 2px;
            }
            .katex-display {
                /* Block KaTeX */
                margin: 10px 0;
                padding: 10px 0;
                overflow-x: auto; /* Allow horizontal scroll for wide equations */
                background-color: var(--ai-code-bg);
                border-radius: 6px;
            }
            .katex-html {
                font-size: 1.1em;
            }

            /* --- CODE BLOCKS --- */
            .code-block-container {
                position: relative;
                margin: 15px 0;
                border-radius: 8px;
                border: 1px solid var(--ai-border-color);
                overflow: hidden;
            }
            .code-block-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                background-color: var(--ai-border-color);
                padding: 8px 10px;
                font-size: 0.8rem;
                color: var(--ai-white);
            }
            .code-block-header .code-language {
                font-weight: bold;
            }
            .code-block-container pre {
                margin: 0;
                padding: 15px;
                background-color: var(--ai-code-bg);
                overflow-x: auto;
                font-family: monospace;
                font-size: 0.9rem;
            }
            .copy-code-btn {
                background: none;
                border: none;
                color: var(--ai-white);
                cursor: pointer;
                padding: 5px 10px;
                border-radius: 4px;
                transition: background-color 0.2s;
                display: flex;
                align-items: center;
            }
            .copy-code-btn:hover {
                background-color: var(--ai-light-hover);
            }
            .copy-code-btn svg {
                margin-right: 5px;
            }
            .success-copy {
                color: var(--ai-green);
            }

            /* --- SOURCES (GROUNDING) --- */
            .ai-sources {
                padding: 10px 0;
                margin-top: 15px;
                border-top: 1px dashed var(--ai-border-color);
            }
            .ai-sources h4 {
                font-size: 0.8rem;
                color: var(--ai-gemini-color);
                margin: 5px 0;
            }
            .ai-sources .sources-list {
                list-style: none;
                padding-left: 0;
                margin: 0;
            }
            .ai-sources .sources-list li {
                font-size: 0.85rem;
                margin-bottom: 5px;
            }
            .ai-sources .sources-list a {
                color: var(--ai-primary-color);
                text-decoration: none;
            }
            .ai-sources .sources-list a:hover {
                text-decoration: underline;
            }

            /* --- DOWNLOAD WIDGET --- */
            .download-widget {
                display: flex;
                align-items: center;
                background-color: var(--ai-code-bg);
                border: 1px solid var(--ai-border-color);
                border-radius: 8px;
                padding: 10px 15px;
                margin: 15px 0;
            }
            .download-widget svg {
                color: var(--ai-green);
                margin-right: 15px;
                flex-shrink: 0;
            }
            .download-info {
                flex-grow: 1;
                margin-right: 15px;
                min-width: 0;
            }
            .download-filename {
                display: block;
                font-weight: bold;
                font-size: 0.95rem;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                color: var(--ai-white);
            }
            .download-mimetype {
                display: block;
                font-size: 0.75rem;
                color: var(--ai-gemini-color);
            }
            .download-file-btn {
                padding: 8px 12px;
                font-size: 0.9rem;
                flex-shrink: 0;
            }


            /* --- THOUGHT PROCESS MONOLOGUE --- */
            .ai-thought-process {
                border-top: 1px dashed var(--ai-border-color);
                margin-top: 15px;
                padding-top: 5px;
            }
            .monologue-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: pointer;
                padding: 5px 0;
            }
            .monologue-title {
                font-size: 0.8rem;
                color: var(--ai-gemini-color);
                margin: 0;
            }
            .monologue-toggle-btn {
                background: none;
                border: none;
                color: var(--ai-primary-color);
                font-size: 0.8rem;
                cursor: pointer;
                padding: 5px 10px;
                border-radius: 4px;
                transition: background-color 0.2s;
            }
            .monologue-toggle-btn:hover {
                background-color: var(--ai-light-hover);
            }
            .ai-thought-process .monologue-content {
                background-color: var(--ai-code-bg);
                color: var(--ai-code-color);
                border-radius: 6px;
                padding: 10px;
                white-space: pre-wrap;
                max-height: 300px;
                overflow-y: auto;
                transition: max-height 0.3s ease-out, padding 0.3s ease-out;
                font-size: 0.8rem;
                line-height: 1.4;
            }

            .ai-thought-process.collapsed .monologue-content {
                max-height: 0;
                padding: 0 10px;
                opacity: 0;
                overflow-y: hidden;
            }

            /* --- CUSTOM GRAPH --- */
            .custom-graph-placeholder {
                margin: 15px 0;
                background-color: var(--ai-dark-bg);
                border: 1px solid var(--ai-border-color);
                border-radius: 8px;
                padding: 0;
                height: 300px;
                min-width: 100%;
                overflow: hidden;
            }
            .custom-graph-placeholder canvas {
                width: 100%;
                height: 100%;
            }

            /* --- INPUT AND COMPOSE AREA --- */
            #ai-compose-area {
                padding: 10px 20px;
                border-top: 1px solid var(--ai-border-color);
                flex-shrink: 0;
                position: relative;
            }

            #ai-input-wrapper {
                display: grid;
                grid-template-columns: 1fr max-content; /* Simplified layout */
                grid-template-areas: 
                    "preview preview options"
                    "input input options";
                align-items: flex-end;
                padding: 5px;
                background-color: var(--ai-dark-bg);
                border-radius: 15px;
                border: 1px solid var(--ai-border-color);
                transition: border-color 0.2s, background-color 0.2s;
            }
            
            #ai-input-wrapper.drag-over {
                border-color: var(--ai-primary-color);
                background-color: rgba(66, 133, 244, 0.1);
            }
            
            #ai-input-wrapper.waiting {
                border-color: var(--ai-primary-color);
                animation: gemini-glow 4s infinite;
                pointer-events: none;
            }


            #ai-input {
                grid-area: input;
                min-height: 30px;
                max-height: ${MAX_INPUT_HEIGHT}px;
                overflow-y: hidden;
                padding: 5px 10px;
                outline: none;
                line-height: 1.4;
                color: var(--ai-white);
                white-space: pre-wrap;
                word-wrap: break-word;
                transition: height 0.2s;
                font-size: 1rem;
            }
            
            #ai-attachment-preview {
                grid-area: preview;
                display: none; /* Controlled by JS */
                flex-wrap: nowrap;
                overflow-x: auto;
                gap: 8px;
                padding: 5px 5px 8px 5px;
                border-bottom: 1px dashed var(--ai-border-color);
                margin-bottom: 5px;
            }

            .attachment-card {
                flex-shrink: 0;
                display: flex;
                align-items: center;
                background-color: var(--ai-code-bg);
                border-radius: 6px;
                overflow: hidden;
                height: 35px;
                border: 1px solid var(--ai-border-color);
                position: relative;
            }
            .attachment-card .file-icon {
                font-size: 1.2rem;
                padding: 0 5px;
                color: var(--ai-yellow);
            }
            .attachment-card img {
                height: 100%;
                width: 35px;
                object-fit: cover;
            }
            .attachment-card .file-info {
                padding: 0 8px;
                font-size: 0.8rem;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 120px;
            }
            .remove-attachment-btn {
                background-color: var(--ai-accent-color);
                color: var(--ai-white);
                border: none;
                cursor: pointer;
                font-size: 0.9rem;
                padding: 0 6px;
                line-height: 1;
                height: 100%;
                transition: opacity 0.2s;
            }
            .remove-attachment-btn:hover {
                background-color: #c9302c;
            }

            /* --- NEW UI: MORE OPTIONS MENU STYLES --- */
            #ai-more-options-wrapper {
                grid-area: options;
                position: relative; 
                display: flex;
                align-items: flex-end; /* Align the button to the bottom */
                justify-content: flex-end;
                padding-right: 10px;
                padding-bottom: 5px;
                min-height: 40px; /* Ensure space for the button */
            }

            #ai-more-options-button {
                background: none;
                border: none;
                color: var(--ai-text-color);
                font-size: 1.3rem;
                cursor: pointer;
                transition: color 0.2s, transform 0.2s;
                height: 30px;
                width: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
            }
            
            #ai-more-options-button:hover,
            #ai-more-options-button.active {
                color: var(--ai-primary-color);
                background-color: var(--ai-light-hover);
            }
            
            #ai-options-menu {
                position: absolute;
                bottom: calc(100% + 10px); /* Position 10px above the wrapper */
                right: 0;
                width: max-content;
                background: var(--ai-dark-bg);
                border: 1px solid var(--ai-border-color);
                border-radius: 8px;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
                padding: 5px;
                display: flex;
                flex-direction: column;
                z-index: 1000;
                opacity: 0;
                visibility: hidden;
                transform: translateY(10px);
                transition: opacity 0.2s ease-out, transform 0.2s ease-out, visibility 0.2s;
            }

            #ai-options-menu.active {
                opacity: 1;
                visibility: visible;
                transform: translateY(0);
            }

            /* Style for the individual buttons inside the new menu */
            #ai-options-menu button {
                background: none;
                border: none;
                color: var(--ai-text-color);
                padding: 8px 12px;
                margin: 2px 0;
                text-align: left;
                display: flex;
                align-items: center;
                justify-content: flex-start;
                cursor: pointer;
                font-size: 0.95rem;
                white-space: nowrap;
                transition: background-color 0.15s;
                border-radius: 4px;
            }

            #ai-options-menu button:hover {
                background-color: var(--ai-light-hover);
                color: var(--ai-white);
            }

            #ai-options-menu button i,
            #ai-options-menu button svg {
                margin-right: 10px;
                font-size: 1.1em;
                width: 20px; /* Fix for SVG size consistency */
                height: 20px;
            }

            /* --- SETTINGS MENU (positioned relative to compose area, above) --- */
            #ai-settings-menu {
                position: absolute;
                bottom: 100%; /* Position above the compose area */
                right: 10px;
                width: 300px;
                background-color: var(--ai-dark-bg);
                border: 1px solid var(--ai-border-color);
                border-radius: 8px;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
                padding: 15px;
                opacity: 0;
                visibility: hidden;
                transform: translateY(10px);
                transition: opacity 0.2s ease-out, transform 0.2s ease-out, visibility 0.2s;
                z-index: 999;
            }

            #ai-settings-menu.active {
                opacity: 1;
                visibility: visible;
                transform: translateY(0);
            }

            #ai-settings-menu h3 {
                font-family: 'Merriweather', serif;
                font-size: 1.1rem;
                margin-top: 0;
                margin-bottom: 15px;
                color: var(--ai-white);
            }

            .setting-group {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                justify-content: space-between;
                padding: 10px 0;
                border-bottom: 1px dashed var(--ai-border-color);
            }
            .setting-group:last-child {
                border-bottom: none;
            }
            .setting-label {
                display: flex;
                align-items: center;
                font-weight: bold;
                font-size: 0.9rem;
                cursor: pointer;
                width: calc(100% - 40px);
            }
            .setting-label i {
                margin-right: 8px;
                color: var(--ai-primary-color);
            }
            .setting-toggle {
                cursor: pointer;
                width: 20px;
                height: 20px;
                margin: 0;
                flex-shrink: 0;
            }
            .setting-description {
                font-size: 0.75rem;
                color: var(--ai-gemini-color);
                margin-top: 5px;
                margin-bottom: 0;
                width: 100%;
            }

            /* --- CHARACTER COUNTER --- */
            #ai-char-counter {
                position: absolute;
                right: 20px;
                bottom: 5px;
                font-size: 0.75rem;
                color: var(--ai-gemini-color);
                transition: color 0.2s;
                z-index: 10;
            }

            #ai-char-counter.over-limit {
                color: var(--ai-accent-color);
                font-weight: bold;
                animation: glow 1.5s infinite alternate;
            }
            
            /* --- NUDGE POPUP (Web Search Nudge) --- */
            #ai-web-search-nudge {
                position: fixed;
                bottom: 20px;
                right: 580px; /* Position next to the main chat window */
                max-width: 280px;
                background-color: var(--ai-dark-bg);
                border: 1px solid var(--ai-border-color);
                border-radius: 8px;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
                padding: 15px;
                z-index: 2147483646; /* Just below main container */
                animation: nudge-fade-in 0.3s ease-out forwards;
            }
            .nudge-content p {
                font-size: 0.9rem;
                margin-top: 0;
            }
            .nudge-buttons {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                margin-top: 10px;
            }
            #nudge-dismiss, #nudge-open-settings {
                padding: 5px 10px;
                border-radius: 4px;
                font-size: 0.85rem;
                cursor: pointer;
            }
            #nudge-dismiss {
                background: none;
                border: 1px solid var(--ai-border-color);
                color: var(--ai-text-color);
            }
            #nudge-open-settings {
                background-color: var(--ai-primary-color);
                color: white;
                border: none;
            }
            #nudge-open-settings:hover {
                background-color: #357ae8;
            }
            
            /* --- GENERAL BUTTONS --- */
            .primary-btn {
                background-color: var(--ai-primary-color);
                color: white;
                border: none;
                border-radius: 5px;
                padding: 10px 15px;
                cursor: pointer;
                font-size: 0.9rem;
                transition: background-color 0.2s;
            }
            .primary-btn:hover {
                background-color: #357ae8;
            }
            .secondary-btn {
                background: none;
                border: 1px solid var(--ai-border-color);
                color: var(--ai-text-color);
                border-radius: 5px;
                padding: 10px 15px;
                cursor: pointer;
                font-size: 0.9rem;
                transition: background-color 0.2s;
            }
            .secondary-btn:hover {
                background-color: var(--ai-light-hover);
            }
            .danger-btn {
                background-color: var(--ai-accent-color);
                color: white;
                border: none;
                border-radius: 5px;
                padding: 10px 15px;
                cursor: pointer;
                font-size: 0.9rem;
                transition: background-color 0.2s;
            }
            .danger-btn:hover {
                background-color: #c9302c;
            }
            .danger-btn-small {
                padding: 5px 10px;
                font-size: 0.8rem;
                border-radius: 4px;
                background-color: var(--ai-accent-color);
                color: white;
                border: none;
                cursor: pointer;
                transition: background-color 0.2s;
            }
            .danger-btn-small:hover {
                background-color: #c9302c;
            }

            /* --- MEMORY MODAL --- */
            .ai-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.6);
                display: none; /* Hidden by default */
                justify-content: center;
                align-items: center;
                z-index: 2147483648; /* Above everything */
            }

            .ai-modal-content {
                background-color: var(--ai-main-bg);
                border-radius: 12px;
                width: 90%;
                max-width: 600px;
                box-shadow: 0 5px 20px rgba(0, 0, 0, 0.8);
                display: flex;
                flex-direction: column;
                max-height: 80%;
                transform: scale(0.9);
                animation: message-pop-in 0.3s ease-out forwards;
            }

            .ai-modal-header {
                padding: 15px 20px;
                border-bottom: 1px solid var(--ai-border-color);
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: grab;
            }

            .ai-modal-header h2 {
                margin: 0;
                font-family: 'Merriweather', serif;
                font-size: 1.3rem;
                color: var(--ai-white);
            }

            .ai-close-modal {
                font-size: 2rem;
                cursor: pointer;
                opacity: 0.7;
                transition: opacity 0.2s;
            }

            .ai-close-modal:hover {
                opacity: 1;
            }

            .ai-modal-body {
                padding: 20px;
                overflow-y: auto;
            }

            .memory-input-section {
                border: 1px solid var(--ai-border-color);
                border-radius: 8px;
                padding: 10px;
                margin-bottom: 20px;
                background-color: var(--ai-dark-bg);
            }
            #ai-memory-editor {
                width: 100%;
                min-height: 100px;
                padding: 10px;
                background: none;
                border: none;
                outline: none;
                color: var(--ai-text-color);
                resize: vertical;
                box-sizing: border-box;
                font-family: 'Lora', Georgia, serif;
                font-size: 0.95rem;
            }
            .memory-actions {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                margin-top: 10px;
            }
            .memory-actions button {
                padding: 8px 12px;
                font-size: 0.85rem;
            }

            .memory-list-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 1px solid var(--ai-border-color);
            }

            .memory-list-header h3 {
                margin: 0;
                font-size: 1rem;
                color: var(--ai-white);
            }

            .memory-item {
                display: flex;
                flex-wrap: wrap;
                justify-content: space-between;
                align-items: center;
                padding: 10px;
                margin-bottom: 8px;
                border-radius: 6px;
                background-color: var(--ai-dark-bg);
                border: 1px solid var(--ai-border-color);
                transition: border-color 0.2s;
            }
            .memory-item:hover {
                border-color: var(--ai-primary-color);
            }
            .memory-item.top-ten {
                border-left: 5px solid var(--ai-green);
                background-color: rgba(15, 157, 88, 0.05); /* Slight green tint */
            }

            .memory-content {
                flex-grow: 1;
                width: 100%;
                font-size: 0.9rem;
                line-height: 1.4;
                margin-bottom: 5px;
            }
            .memory-meta {
                display: flex;
                align-items: center;
                gap: 10px;
                width: 100%;
            }

            .memory-date {
                font-size: 0.7rem;
                color: var(--ai-gemini-color);
            }

            .memory-rank {
                font-size: 0.7rem;
                font-weight: bold;
                color: var(--ai-green);
            }

            .memory-item-actions {
                margin-top: 10px;
                width: 100%;
                display: flex;
                justify-content: flex-end;
                gap: 10px;
            }
            .memory-item-actions button {
                font-size: 0.8rem;
                padding: 5px 8px;
            }

            .no-memories-text {
                text-align: center;
                color: var(--ai-gemini-color);
                padding: 20px;
            }

            .ai-modal-footer {
                padding: 10px 20px;
                border-top: 1px solid var(--ai-border-color);
                font-size: 0.8rem;
                color: var(--ai-gemini-color);
            }
            #ai-storage-status {
                margin: 5px 0;
            }
            .storage-progress-bar-container {
                width: 100%;
                background-color: var(--ai-code-bg);
                border-radius: 5px;
                height: 8px;
                overflow: hidden;
                margin-top: 5px;
            }
            .storage-progress-bar {
                height: 100%;
                background-color: var(--ai-primary-color);
                transition: width 0.3s;
            }


            /* --- KEYFRAMES --- */
            @keyframes nudge-fade-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
            @keyframes glow { 0%,100% { box-shadow: 0 0 5px rgba(255,255,255,.15), 0 0 10px rgba(255,255,255,.1); } 50% { box-shadow: 0 0 10px rgba(255,255,255,.25), 0 0 20px rgba(255,255,255,.2); } }
            @keyframes gemini-glow { 0%,100% { box-shadow: 0 0 8px 2px var(--ai-blue); } 25% { box-shadow: 0 0 8px 2px var(--ai-green); } 50% { box-shadow: 0 0 8px 2px var(--ai-yellow); } 75% { box-shadow: 0 0 8px 2px var(--ai-red); } }
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes message-pop-in { 0% { opacity: 0; transform: translateY(10px) scale(.98); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes brand-title-pulse { 0% { opacity: 0.5; } 100% { opacity: 1; } }
        `;
        document.head.appendChild(style);
    }
})();
