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

        const attachmentButton = document.createElement('button');
        attachmentButton.id = 'ai-attachment-button';
        attachmentButton.innerHTML = attachmentIconSVG;
        attachmentButton.title = 'Attach files';
        attachmentButton.onclick = () => handleFileUpload();

        // NEW: Memory Button
        const memoryButton = document.createElement('button');
        memoryButton.id = 'ai-memory-button';
        memoryButton.innerHTML = '<i class="fa-solid fa-brain"></i>';
        memoryButton.title = 'Saved Memories';
        memoryButton.onclick = showMemoryModal;

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
        inputWrapper.appendChild(memoryButton); // NEW
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
                previewContent = `<span class="file-icon">📄</span>`;
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
        const toggleBtn = document.getElementById('ai-settings-button');
        const isMenuOpen = menu.classList.toggle('active');
        toggleBtn.classList.toggle('active', isMenuOpen);
        if (isMenuOpen) {
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
            toggleSettingsMenu();
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
        menu.querySelector('#settings-web-search').addEventListener('change', (e) => {
            appSettings.webSearch = e.target.checked;
            saveAppSettings();
        });
        menu.querySelector('#settings-location-sharing').addEventListener('change', (e) => {
            appSettings.locationSharing = e.target.checked;
            saveAppSettings();
        });
        return menu;
    }

    // --- NEW: MEMORY MODAL UI FUNCTIONS ---

    /**
     * Creates and displays the "Saved Memories" modal.
     */
    async function showMemoryModal() {
        if (document.getElementById('ai-memory-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'ai-memory-modal';
        modal.innerHTML = `
            <div class="memory-modal-content">
                <span class="close-button">&times;</span>
                <h3>Saved Memories</h3>
                <div id="memory-storage-bar-container">
                    <div class="storage-label">
                        <span>Storage Usage</span>
                        <span id="storage-usage-text">Loading...</span>
                    </div>
                    <div class="storage-bar">
                        <div id="storage-bar-used"></div>
                    </div>
                </div>
                <div id="memory-list-container">
                    <div class="ai-loader"></div> <!-- Loading... -->
                </div>
                <div class="memory-new-input">
                    <textarea id="memory-new-content" placeholder="Type a new memory..."></textarea>
                    <button id="memory-add-btn">Add Memory</button>
                </div>
                <button id="memory-delete-all-btn">Delete All Memories</button>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('.close-button').onclick = () => modal.remove();
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        modal.querySelector('#memory-add-btn').onclick = async () => {
            const textarea = document.getElementById('memory-new-content');
            const content = textarea.value.trim();
            if (content) {
                try {
                    await addMemory(content);
                    textarea.value = '';
                    await renderMemoryList();
                    await updateStorageUsage();
                } catch (e) {
                    alert("Error adding memory: " + e.message);
                }
            }
        };

        modal.querySelector('#memory-delete-all-btn').onclick = async () => {
            // Use custom confirmation
            showCustomConfirm("Are you sure you want to delete ALL saved memories? This cannot be undone.", async () => {
                try {
                    await deleteAllMemories();
                    await renderMemoryList();
                    await updateStorageUsage();
                } catch (e) {
                    alert("Error deleting memories: " + e.message);
                }
            });
        };

        try {
            await initMemoryDB();
            await renderMemoryList();
            await updateStorageUsage();
        } catch (e) {
            const container = document.getElementById('memory-list-container');
            if (container) container.innerHTML = "<p class='no-memories'>Error loading memories. IndexedDB may be disabled.</p>";
            console.error("Failed to init memory modal:", e);
        }
    }

    /**
     * Renders the list of memories in the modal.
     */
    async function renderMemoryList() {
        const container = document.getElementById('memory-list-container');
        if (!container) return;
        container.innerHTML = '';
        let memories = [];
        try {
            memories = await getMemories();
        } catch (e) {
            container.innerHTML = `<p class="no-memories">Error fetching memories: ${e.message}</p>`;
            return;
        }

        memories.sort((a, b) => b.timestamp - a.timestamp); // Show newest first

        if (memories.length === 0) {
            container.innerHTML = '<p class="no-memories">No memories saved yet.</p>';
            return;
        }

        memories.forEach(memory => {
            const item = document.createElement('div');
            item.className = 'memory-item';
            item.dataset.id = memory.id;
            item.innerHTML = `
                <textarea class="memory-content">${escapeHTML(memory.content)}</textarea>
                <div class="memory-actions">
                    <span class="memory-timestamp">${new Date(memory.timestamp).toLocaleString()}</span>
                    <div>
                        <button class="memory-save-btn">Save</button>
                        <button class="memory-delete-btn">Delete</button>
                    </div>
                </div>
            `;

            item.querySelector('.memory-save-btn').onclick = async () => {
                const newContent = item.querySelector('.memory-content').value;
                await updateMemory(memory.id, newContent);
                await renderMemoryList(); // Re-render to sort by new timestamp
                await updateStorageUsage();
            };

            item.querySelector('.memory-delete-btn').onclick = async () => {
                await deleteMemory(memory.id);
                item.remove();
                if (container.childElementCount === 0) {
                    container.innerHTML = '<p class="no-memories">No memories saved yet.</p>';
                }
                await updateStorageUsage();
            };

            container.appendChild(item);
        });
    }

    /**
     * Updates the storage usage bar in the memory modal.
     */
    async function updateStorageUsage() {
        const usage = await getStorageUsage();
        const usageText = document.getElementById('storage-usage-text');
        const usageBar = document.getElementById('storage-bar-used');

        if (usage && usageText && usageBar) {
            usageText.textContent = `${usage.used} / ${usage.total}`;
            usageBar.style.width = `${usage.percentage}%`;
        } else if (usageText) {
            usageText.textContent = 'Usage not available';
        }
    }

    /**
     * NEW: Custom confirmation dialog to replace `confirm()`.
     */
    function showCustomConfirm(message, onConfirm) {
        if (document.getElementById('ai-custom-confirm')) return;

        const modal = document.createElement('div');
        modal.id = 'ai-custom-confirm';
        modal.innerHTML = `
            <div class="confirm-content">
                <p>${escapeHTML(message)}</p>
                <div class="confirm-buttons">
                    <button id="confirm-btn-cancel">Cancel</button>
                    <button id="confirm-btn-ok">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const close = () => modal.remove();
        modal.querySelector('#confirm-btn-cancel').onclick = close;
        modal.querySelector('#confirm-btn-ok').onclick = () => {
            onConfirm();
            close();
        };
    }
    // --- END MEMORY MODAL UI ---


    function processFileLike(file, base64Data, dataUrl, tempId) {
        if (attachedFiles.length >= MAX_ATTACHMENTS_PER_MESSAGE) {
            showCustomAlert(`You can attach a maximum of ${MAX_ATTACHMENTS_PER_MESSAGE} files per message.`);
            return;
        }

        const currentTotalSize = attachedFiles.reduce((sum, f) => sum + (f.inlineData ? atob(f.inlineData.data).length : 0), 0);
        if (currentTotalSize + file.size > (10 * 1024 * 1024)) {
            showCustomAlert(`Upload failed: Total size of attachments would exceed the 10MB limit per message. (Current: ${formatBytes(currentTotalSize)}, Adding: ${formatBytes(file.size)})`);
            return;
        }

        const item = {
            inlineData: {
                mimeType: file.type,
                data: base64Data
            },
            fileName: file.name || 'Pasted Image',
            fileContent: dataUrl, // This is the Data URL for previews
            isLoading: false
        };
        if (tempId) item.tempId = tempId;

        attachedFiles.push(item);
        renderAttachments();
    }


    function handleFileUpload() {
        if (attachedFiles.length >= MAX_ATTACHMENTS_PER_MESSAGE) {
            showCustomAlert(`You can attach a maximum of ${MAX_ATTACHMENTS_PER_MESSAGE} files per message.`);
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
                    showCustomAlert(`Cannot attach more than ${MAX_ATTACHMENTS_PER_MESSAGE} files. Skipping: ${file.name}`);
                    return false;
                }
                return true;
            });

            const currentTotalSize = attachedFiles.reduce((sum, file) => sum + (file.inlineData ? atob(file.inlineData.data).length : 0), 0);
            const newFilesSize = filesToProcess.reduce((sum, file) => sum + file.size, 0);
            if (currentTotalSize + newFilesSize > (10 * 1024 * 1024)) {
                showCustomAlert(`Upload failed: Total size of attachments would exceed the 10MB limit per message. (Current: ${formatBytes(currentTotalSize)}, Adding: ${formatBytes(newFilesSize)})`);
                return;
            }

            filesToProcess.forEach(file => {
                const tempId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                attachedFiles.push({
                    tempId,
                    file,
                    isLoading: true
                });
                renderAttachments();

                const reader = new FileReader();
                reader.onload = (e) => {
                    const base64Data = e.target.result.split(',')[1];
                    const dataUrl = e.target.result;

                    const itemIndex = attachedFiles.findIndex(f => f.tempId === tempId);
                    if (itemIndex > -1) {
                        const item = attachedFiles[itemIndex];
                        item.isLoading = false;
                        item.inlineData = {
                            mimeType: file.type,
                            data: base64Data
                        };
                        item.fileName = file.name;
                        item.fileContent = dataUrl; // Store the Data URL
                        delete item.file;
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

        if (attachedFiles.length === 0) {
            inputWrapper.classList.remove('has-attachments');
            previewContainer.innerHTML = '';
            return;
        }

        previewContainer.style.display = 'flex';
        inputWrapper.classList.add('has-attachments');
        previewContainer.innerHTML = '';

        attachedFiles.forEach((file, index) => {
            const fileCard = document.createElement('div');
            fileCard.className = 'attachment-card';
            let previewHTML = '';
            let fileExt = 'FILE';
            let fileName = '';

            if (file.isLoading) {
                fileCard.classList.add('loading');
                fileName = file.file.name;
                fileExt = fileName.split('.').pop().toUpperCase();
                previewHTML = `<div class="ai-loader"></div><span class="file-icon">📄</span>`;
            } else {
                fileName = file.fileName;
                fileExt = fileName.split('.').pop().toUpperCase();
                if (file.inlineData.mimeType.startsWith('image/')) {
                    previewHTML = `<img src="${file.fileContent}" alt="${fileName}" />`; // Use fileContent (Data URL)
                } else {
                    previewHTML = `<span class="file-icon">📄</span>`;
                }
                fileCard.onclick = () => showFilePreview(file);
            }

            if (fileExt.length > 5) fileExt = 'FILE';
            let fileTypeBadge = `<div class="file-type-badge">${fileExt}</div>`;
            if (file.inlineData && file.inlineData.mimeType.startsWith('image/')) {
                fileTypeBadge = '';
            }

            const nameSpan = document.createElement('span');
            nameSpan.textContent = fileName;
            const marqueeWrapper = document.createElement('div');
            marqueeWrapper.className = 'file-name';
            marqueeWrapper.appendChild(nameSpan);

            fileCard.innerHTML = `${previewHTML}<div class="file-info"></div>${fileTypeBadge}<button class="remove-attachment-btn" data-index="${index}">&times;</button>`;
            fileCard.querySelector('.file-info').appendChild(marqueeWrapper);

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

    function showFilePreview(file) {
        if (!file.fileContent) {
            showCustomAlert("File content not available for preview.");
            return;
        }

        const previewModal = document.createElement('div');
        previewModal.id = 'ai-preview-modal';
        previewModal.innerHTML = `
            <div class="modal-content">
                <span class="close-button">&times;</span>
                <h3>${escapeHTML(file.fileName)}</h3>
                <div class="preview-area"></div>
            </div>
        `;
        document.body.appendChild(previewModal);

        const previewArea = previewModal.querySelector('.preview-area');
        if (file.inlineData.mimeType.startsWith('image/')) {
            previewArea.innerHTML = `<img src="${file.fileContent}" alt="${file.fileName}" style="max-width: 100%; max-height: 80vh; object-fit: contain;">`;
        } else if (file.inlineData.mimeType.startsWith('text/')) {
            fetch(file.fileContent)
                .then(response => response.text())
                .then(text => {
                    previewArea.innerHTML = `<pre style="white-space: pre-wrap; word-break: break-all; max-height: 70vh; overflow-y: auto; background-color: #222; padding: 10px; border-radius: 5px;">${escapeHTML(text)}</pre>`;
                })
                .catch(error => {
                    previewArea.innerHTML = `<p>Could not load text content for preview.</p>`;
                });
        } else {
            previewArea.innerHTML = `<p>Preview not available for this file type. You can download it to view.</p>
                                     <a href="${file.fileContent}" download="${file.fileName}" class="download-button">Download File</a>`;
        }

        previewModal.querySelector('.close-button').onclick = () => {
            previewModal.remove();
        };
        previewModal.addEventListener('click', (e) => {
            if (e.target === previewModal) {
                previewModal.remove();
            }
        });
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

    function handleContentEditableInput(e) {
        const editor = e.target;
        const charCount = editor.innerText.length;

        const counter = document.getElementById('ai-char-counter');
        if (counter) {
            counter.textContent = `${formatCharCount(charCount)} / ${formatCharLimit(CHAR_LIMIT)}`;
            counter.classList.toggle('limit-exceeded', charCount > CHAR_LIMIT);
        }

        if (charCount > CHAR_LIMIT) {
            editor.innerText = editor.innerText.substring(0, CHAR_LIMIT);
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        }

        if (editor.scrollHeight > MAX_INPUT_HEIGHT) {
            editor.style.height = `${MAX_INPUT_HEIGHT}px`;
            editor.style.overflowY = 'auto';
        } else {
            editor.style.height = 'auto';
            editor.style.height = `${editor.scrollHeight}px`;
            editor.style.overflowY = 'hidden';
        }
        fadeOutWelcomeMessage();
    }

    function handlePaste(e) {
        e.preventDefault();
        const clipboardData = e.clipboardData || window.clipboardData;
        const pastedText = clipboardData.getData('text/plain');

        const items = clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const base64Data = event.target.result.split(',')[1];
                        const dataUrl = event.target.result;
                        file.name = `pasted-image-${Date.now()}.${file.type.split('/')[1] || 'png'}`;
                        processFileLike(file, base64Data, dataUrl);
                    };
                    reader.readAsDataURL(file);
                    return;
                }
            }
        }

        const currentText = e.target.innerText;
        const totalLengthIfPasted = currentText.length + pastedText.length;

        if (pastedText.length > PASTE_TO_FILE_THRESHOLD || totalLengthIfPasted > CHAR_LIMIT) {
            let filenameBase = 'paste';
            let filename = `${filenameBase}.txt`;
            let counter = 1;
            while (attachedFiles.some(f => f.fileName === filename)) {
                filename = `${filenameBase}(${counter++}).txt`;
            }
            const blob = new Blob([pastedText], {
                type: 'text/plain'
            });
            blob.name = filename; // For processFileLike

            if (attachedFiles.length < MAX_ATTACHMENTS_PER_MESSAGE) {
                const reader = new FileReader();
                reader.onloadend = (event) => {
                    const base64Data = event.target.result.split(',')[1];
                    const dataUrl = event.target.result;
                    processFileLike(blob, base64Data, dataUrl); // Use processFileLike
                };
                reader.readAsDataURL(blob);
            } else {
                showCustomAlert(`Cannot attach more than ${MAX_ATTACHMENTS_PER_MESSAGE} files. Text was too large to paste directly.`);
            }
        } else {
            document.execCommand('insertText', false, pastedText);
            handleContentEditableInput({
                target: e.target
            });
        }
    }

    /**
     * UPDATED: Stores attachment previews in chat history.
     */
    function handleInputSubmission(e) {
        const editor = e.target;
        const query = editor.innerText.trim();
        if (editor.innerText.length > CHAR_LIMIT) {
            e.preventDefault();
            return;
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const settingsMenu = document.getElementById('ai-settings-menu');
            if (settingsMenu && settingsMenu.classList.contains('active')) {
                toggleSettingsMenu();
            }

            if (attachedFiles.some(f => f.isLoading)) {
                showCustomAlert("Please wait for files to finish uploading before sending.");
                return;
            }
            if (!query && attachedFiles.length === 0) return;
            if (isRequestPending) return;

            isRequestPending = true;
            document.getElementById('ai-input-wrapper').classList.add('waiting');

            const parts = [];
            if (query) parts.push({
                text: query
            });

            // NEW: Store preview-able data
            const attachmentPreviews = [];
            attachedFiles.forEach(file => {
                if (file.inlineData) {
                    parts.push({
                        inlineData: file.inlineData
                    });
                    // Store info needed for rendering the bubble
                    attachmentPreviews.push({
                        fileName: file.fileName,
                        mimeType: file.inlineData.mimeType,
                        dataUrl: file.fileContent // The Data URL
                    });
                }
            });

            chatHistory.push({
                role: "user",
                parts: parts,
                attachmentPreviews: attachmentPreviews // NEW: Store previews
            });

            const responseContainer = document.getElementById('ai-response-container');
            const userBubble = document.createElement('div');
            userBubble.className = 'ai-message-bubble user-message';

            let bubbleContent = query ? `<p>${escapeHTML(query)}</p>` : '';
            // NEW: Render the new preview container
            if (attachmentPreviews.length > 0) {
                bubbleContent += createAttachmentPreviewHTML(attachmentPreviews);
            }
            userBubble.innerHTML = bubbleContent;

            responseContainer.appendChild(userBubble);
            const responseBubble = document.createElement('div');
            responseBubble.className = 'ai-message-bubble gemini-response loading';
            responseBubble.innerHTML = '<div class="ai-loader"></div>';
            responseContainer.appendChild(responseBubble);
            responseContainer.scrollTop = responseContainer.scrollHeight;
            editor.innerHTML = '';
            handleContentEditableInput({
                target: editor
            });
            attachedFiles = [];
            renderAttachments();

            callGoogleAI(responseBubble);
        }
    }

    function handleCopyCode(event) {
        const btn = event.currentTarget;
        const wrapper = btn.closest('.code-block-wrapper');
        const code = wrapper.querySelector('pre > code');
        if (code) {
            navigator.clipboard.writeText(code.innerText).then(() => {
                btn.innerHTML = checkIconSVG;
                btn.disabled = true;
                setTimeout(() => {
                    btn.innerHTML = copyIconSVG;
                    btn.disabled = false;
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy code: ', err);
                showCustomAlert('Failed to copy code.');
            });
        }
    }

    /**
     * NEW: Handles click on a generated download button.
     */
    function handleFileDownload(event) {
        const btn = event.currentTarget;
        const base64data = btn.dataset.base64;
        const mimetype = btn.dataset.mimetype;
        const filename = btn.dataset.filename;

        try {
            const byteCharacters = atob(base64data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], {
                type: mimetype
            });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (e) {
            console.error("File download error:", e);
            showCustomAlert("Failed to initiate download. The file data might be corrupted.");
        }
    }

    function fadeOutWelcomeMessage() {
        const container = document.getElementById("ai-container");
        if (container && !container.classList.contains("chat-active")) {
            container.classList.add("chat-active")
        }
    }

    function escapeHTML(str) {
        if (typeof str !== 'string') return '';
        const p = document.createElement("p");
        p.textContent = str;
        return p.innerHTML
    }

    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    /**
     * NEW: Custom alert to replace window.alert()
     */
    function showCustomAlert(message) {
        if (document.getElementById('ai-custom-alert')) return;

        const modal = document.createElement('div');
        modal.id = 'ai-custom-alert';
        modal.innerHTML = `
            <div class="alert-content">
                <p>${escapeHTML(message)}</p>
                <div class="alert-buttons">
                    <button id="alert-btn-ok">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const close = () => modal.remove();
        modal.querySelector('#alert-btn-ok').onclick = close;
    }

    /**
     * UPDATED:
     * - Parses new <DOWNLOAD> tags.
     * - Accepts `groundingSources` array instead of regex parsing.
     */
    function parseGeminiResponse(text, groundingSources = []) {
        let html = text;
        const placeholders = {};
        let placeholderId = 0;

        const addPlaceholder = (content) => {
            const key = `%%PLACEHOLDER_${placeholderId++}%%`;
            placeholders[key] = content;
            return key;
        };

        // --- Extract thought process (Humanity) ---
        html = html.replace(/<THOUGHT_PROCESS>([\s\S]*?)<\/THOUGHT_PROCESS>/, (match, content) => {
            thoughtProcess = content.trim();
            return ''; // Remove from main text
        });

        // --- NEW: Extract downloadable files ---
        html = html.replace(/<DOWNLOAD FILENAME="([^"]+)" MIMETYPE="([^"]+)" ENCODING="base64">([\s\S]*?)<\/DOWNLOAD>/g, (match, filename, mimetype, base64data) => {
            const safeFilename = escapeHTML(filename);
            const safeMimetype = escapeHTML(mimetype);
            // Don't escape base64data, just put it in the dataset
            const content = `
                <div class="ai-download-widget">
                    <div class="file-icon-large">📄</div>
                    <div class="file-info">
                        <span class="file-name-large">${safeFilename}</span>
                        <span class="file-type-large">${safeMimetype}</span>
                    </div>
                    <button class="download-file-btn" data-filename="${safeFilename}" data-mimetype="${safeMimetype}" data-base64="${base64data.trim()}">
                        ${downloadIconSVG}
                        Download
                    </button>
                </div>
            `;
            return addPlaceholder(content); // Use the placeholder system
        });


        // --- UPDATED: Process sources from grounding array ---
        let sourcesHTML = '';
        const sources = [...groundingSources]; // Use the passed-in sources

        if (sources.length > 0) {
            const listClass = sources.length > 5 ? 'scrollable' : '';
            sourcesHTML = `<div class="ai-sources-list"><h4>Sources:</h4><ul class="${listClass}">`;
            sources.forEach(source => {
                let hostname = '';
                try {
                    hostname = new URL(source.url).hostname;
                } catch (e) {
                    hostname = 'unknown-source';
                }
                const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
                sourcesHTML += `<li><img src="${faviconUrl}" alt="Favicon" class="favicon"><a href="${source.url}" target="_blank">${escapeHTML(source.title)}</a></li>`;
            });
            sourcesHTML += `</ul></div>`;
        }

        // 1. Extract graph blocks
        html = html.replace(/```graph\n([\s\S]*?)```/g, (match, jsonString) => {
            let metadata = 'Graph';
            try {
                const graphData = JSON.parse(jsonString);
                const trace = graphData.data && graphData.data[0];
                if (trace && trace.x && trace.y && trace.x.length >= 2 && trace.y.length >= 2) {
                    const [x1, x2] = trace.x.slice(0, 2);
                    const [y1, y2] = trace.y.slice(0, 2);
                    if (x2 - x1 !== 0) {
                        const slope = (y2 - y1) / (x2 - x1);
                        if (isFinite(slope)) {
                            const yIntercept = y1 - slope * x1;
                            const xIntercept = slope !== 0 ? -yIntercept / slope : Infinity;
                            metadata = `Slope: ${slope.toFixed(2)} &middot; Y-Int: (0, ${yIntercept.toFixed(2)}) &middot; X-Int: (${isFinite(xIntercept) ? xIntercept.toFixed(2) : 'N/A'}, 0)`;
                        }
                    }
                }
            } catch (e) { /* Ignore parsing errors */ }
            const escapedData = escapeHTML(jsonString);
            const content = `
                <div class="graph-block-wrapper">
                    <div class="graph-block-header"><span class="graph-metadata">${metadata}</span></div>
                    <div class="custom-graph-placeholder" data-graph-data='${escapedData}'>
                        <canvas class="graph-canvas"></canvas>
                    </div>
                </div>`;
            return addPlaceholder(content);
        });

        // 2. Extract general code blocks
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
            const trimmedCode = code.trim();
            const lines = trimmedCode.split('\n').length;
            const words = trimmedCode.split(/\s+/).filter(Boolean).length;
            const escapedCode = escapeHTML(trimmedCode);
            const langClass = lang ? `language-${lang.toLowerCase()}` : '';
            const content = `
                <div class="code-block-wrapper">
                    <div class="code-block-header">
                        <span class="code-metadata">${lines} lines &middot; ${words} words</span>
                        <button class="copy-code-btn" title="Copy code">${copyIconSVG}</button>
                    </div>
                    <pre><code class="${langClass}">${escapedCode}</code></pre>
                </div>`;
            return addPlaceholder(content);
        });

        // 3. Extract KaTeX blocks
        html = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
            const content = `<div class="latex-render" data-tex="${escapeHTML(formula)}" data-display-mode="true"></div>`;
            return addPlaceholder(content);
        });
        html = html.replace(/\$([^\s\$][^\$]*?[^\s\$])\$/g, (match, formula) => {
            const content = `<span class="latex-render" data-tex="${escapeHTML(formula)}" data-display-mode="false"></span>`;
            return addPlaceholder(content);
        });

        // 4. Escape the rest of the HTML
        html = escapeHTML(html);

        // 5. Apply markdown styling
        html = html.replace(/^### (.*$)/gm, "<h3>$1</h3>")
            .replace(/^## (.*$)/gm, "<h2>$1</h2>")
            .replace(/^# (.*$)/gm, "<h1>$1</h1>");
        html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\*(.*?)\*/g, "<em>$1</em>");
        html = html.replace(/^(?:\*|-)\s(.*$)/gm, "<li>$1</li>");
        html = html.replace(/((?:<br>)?\s*<li>.*<\/li>(\s*<br>)*)+/gs, (match) => {
            const listItems = match.replace(/<br>/g, '').trim();
            return `<ul>${listItems}</ul>`;
        });
        html = html.replace(/(<\/li>\s*<li>)/g, "</li><li>");
        html = html.replace(/\n/g, "<br>");

        // 6. Restore placeholders
        html = html.replace(/%%PLACEHOLDER_\d+%%/g, (match) => placeholders[match] || '');

        return {
            html: html,
            thoughtProcess: thoughtProcess,
            sourcesHTML: sourcesHTML
        };
    }

    function injectStyles() {
        if (document.getElementById('ai-dynamic-styles')) return;
        if (!document.getElementById('ai-katex-styles')) {
            const katexStyles = document.createElement('link');
            katexStyles.id = 'ai-katex-styles';
            katexStyles.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.css';
            katexStyles.rel = 'stylesheet';
            document.head.appendChild(katexStyles);
        }
        if (!document.getElementById('ai-google-fonts')) {
            const googleFonts = document.createElement('link');
            googleFonts.id = 'ai-google-fonts';
            googleFonts.href = 'https://fonts.googleapis.com/css2?family=Lora:wght@400;700&family=Merriweather:wght@400;700&display=swap';
            googleFonts.rel = 'stylesheet';
            document.head.appendChild(googleFonts);
        }
        const fontAwesome = document.createElement('link');
        fontAwesome.rel = 'stylesheet';
        fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';
        document.head.appendChild(fontAwesome);

        const style = document.createElement("style");
        style.id = "ai-dynamic-styles";
        style.innerHTML = `
            :root { --ai-red: #ea4335; --ai-blue: #4285f4; --ai-green: #34a853; --ai-yellow: #fbbc05; }
            #ai-container { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: rgba(10, 10, 15, 0.95); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); z-index: 2147483646; opacity: 0; transition: opacity 0.5s, background 0.5s; font-family: 'Lora', serif; display: flex; flex-direction: column; justify-content: flex-end; padding: 0; box-sizing: border-box; overflow: hidden; }
            #ai-container.active { opacity: 1; }
            #ai-container.deactivating, #ai-container.deactivating > * { transition: opacity 0.4s, transform 0.4s; }
            #ai-container.deactivating { opacity: 0 !important; background-color: rgba(0,0,0,0); backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); }
            #ai-persistent-title, #ai-brand-title { position: absolute; top: 28px; left: 30px; font-family: 'Lora', serif; font-size: 18px; font-weight: bold; color: #FFFFFF; opacity: 0; transition: opacity 0.5s 0.2s, color 0.5s; }
            #ai-container.chat-active #ai-persistent-title { opacity: 1; }
            #ai-container:not(.chat-active) #ai-brand-title { opacity: 1; }
            #ai-brand-title span { animation: brand-title-pulse 4s linear infinite; }
            #ai-welcome-message { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); text-align: center; color: rgba(255,255,255,.5); opacity: 1; transition: opacity .5s, transform .5s; width: 100%; }
            #ai-container.chat-active #ai-welcome-message { opacity: 0; pointer-events: none; transform: translate(-50%,-50%) scale(0.95); }
            #ai-welcome-message h2 { font-family: 'Merriweather', serif; font-size: 2.2em; margin: 0; color: #fff; }
            #ai-welcome-message p { font-size: .9em; margin-top: 10px; max-width: 400px; line-height: 1.5; margin-left: auto; margin-right: auto; }
            .shortcut-tip { font-size: 0.8em; color: rgba(255,255,255,.7); margin-top: 20px; }
            #ai-close-button { position: absolute; top: 20px; right: 30px; color: rgba(255,255,255,.7); font-size: 40px; cursor: pointer; transition: color .2s ease,transform .3s ease, opacity 0.4s; }
            #ai-char-counter { position: fixed; bottom: 15px; right: 30px; font-size: 0.9em; font-family: monospace; color: #aaa; transition: color 0.2s; z-index: 2147483647; }
            #ai-char-counter.limit-exceeded { color: #e57373; font-weight: bold; }
            #ai-response-container { flex: 1 1 auto; overflow-y: auto; width: 100%; max-width: 720px; margin: 0 auto; display: flex; flex-direction: column; gap: 15px; padding: 60px 20px 20px 20px; -webkit-mask-image: linear-gradient(to bottom,transparent 0,black 3%,black 97%,transparent 100%); mask-image: linear-gradient(to bottom,transparent 0,black 3%,black 97%,transparent 100%);}
            .ai-message-bubble { background: rgba(15,15,18,.8); border: 1px solid rgba(255,255,255,.1); border-radius: 16px; padding: 12px 18px; color: #e0e0e0; backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px); animation: message-pop-in .5s cubic-bezier(.4,0,.2,1) forwards; max-width: 90%; line-height: 1.6; overflow-wrap: break-word; transition: opacity 0.3s ease-in-out; align-self: flex-start; text-align: left; }
            .user-message { background: rgba(40,45,50,.8); align-self: flex-end; }
            .gemini-response { animation: glow 4s infinite; display: flex; flex-direction: column; }
            .gemini-response.loading { display: flex; justify-content: center; align-items: center; min-height: 60px; max-width: 100px; padding: 15px; background: rgba(15,15,18,.8); animation: gemini-glow 4s linear infinite; }
            
            .ai-sources-list { border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px; margin-top: 8px; }
            .ai-sources-list h4 { color: #ccc; margin: 0 0 10px 0; font-family: 'Merriweather', serif; font-size: 1em; }
            .ai-sources-list ul { list-style: none; padding: 0; margin: 0; }
            .ai-sources-list li { display: flex; align-items: center; margin-bottom: 5px; }
            .ai-sources-list li a { color: #4285f4; text-decoration: none; font-size: 0.9em; transition: color 0.2s; }
            .ai-sources-list li a:hover { color: #6a9cf6; }
            .ai-sources-list li img.favicon { width: 16px; height: 16px; margin-right: 8px; border-radius: 2px; flex-shrink: 0; }
            .ai-sources-list ul.scrollable { max-height: 170px; overflow-y: auto; padding-right: 5px; scrollbar-width: thin; scrollbar-color: #555 #333; }
            .ai-sources-list ul.scrollable::-webkit-scrollbar { width: 8px; }
            .ai-sources-list ul.scrollable::-webkit-scrollbar-track { background: #333; border-radius: 4px; }
            .ai-sources-list ul.scrollable::-webkit-scrollbar-thumb { background-color: #555; border-radius: 4px; }
            
            .ai-thought-process { border-radius: 12px; padding: 0; margin-top: 10px; font-size: 0.9em; max-width: 100%; transition: background-color 0.3s ease, border-color 0.3s ease; background-color: rgba(66, 133, 244, 0.1); border: 1px solid rgba(66, 133, 244, 0.3); }
            .ai-thought-process.collapsed { background-color: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); }
            .monologue-header { display: flex; justify-content: space-between; align-items: center; padding: 10px; cursor: pointer; }
            .monologue-title { margin: 0; font-family: 'Merriweather', serif; font-size: 1em; transition: color 0.3s ease; color: #4285f4; }
            .ai-thought-process.collapsed .monologue-title { color: #ccc; }
            .monologue-toggle-btn { background: none; border-radius: 6px; padding: 4px 8px; font-size: 0.8em; cursor: pointer; transition: background-color 0.2s, border-color 0.3s ease, color 0.3s ease; border: 1px solid rgba(66, 133, 244, 0.5); color: #4285f4; }
            .ai-thought-process:not(.collapsed) .monologue-toggle-btn:hover { background-color: rgba(66, 133, 244, 0.2); }
            .ai-thought-process.collapsed .monologue-toggle-btn { border-color: rgba(255, 255, 255, 0.2); color: #ccc; }
            .ai-thought-process.collapsed .monologue-toggle-btn:hover { background-color: rgba(255, 255, 255, 0.1); }
            .monologue-content { max-height: 0; opacity: 1; overflow: hidden; padding: 0 10px; transition: max-height 0.2s ease-out, padding 0.2s ease-out; }
            .ai-thought-process:not(.collapsed) .monologue-content { max-height: 500px; padding: 0 10px 10px 10px; }
            .ai-thought-process pre { white-space: pre-wrap; word-break: break-word; margin: 0; color: #ccc; font-family: monospace; font-size: 0.85em; background: none; }
            
            #ai-compose-area { position: relative; flex-shrink: 0; z-index: 2; margin: 15px auto; width: 90%; max-width: 720px; }
            #ai-input-wrapper { position: relative; z-index: 2; width: 100%; display: flex; flex-direction: column; border-radius: 20px; background: rgba(10,10,10,.7); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,.2); transition: all .4s cubic-bezier(.4,0,.2,1); }
            #ai-input-wrapper::before, #ai-input-wrapper::after { content: ''; position: absolute; top: -1px; left: -1px; right: -1px; bottom: -1px; border-radius: 21px; z-index: -1; transition: opacity 0.5s ease-in-out; }
            #ai-input-wrapper::before { animation: glow 3s infinite; opacity: 1; }
            #ai-input-wrapper.waiting::before { opacity: 0; }
            #ai-input-wrapper.waiting::after { opacity: 1; }
            
            /* UPDATED: Increased left padding for new memory button */
            #ai-input { min-height: 48px; max-height: ${MAX_INPUT_HEIGHT}px; overflow-y: hidden; color: #fff; font-size: 1.1em; padding: 13px 60px 13px 110px; box-sizing: border-box; word-wrap: break-word; outline: 0; text-align: left; }
            #ai-input:empty::before { content: 'Ask a question or describe your files...'; color: rgba(255, 255, 255, 0.4); pointer-events: none; }
            
            /* UPDATED: Added #ai-memory-button styles */
            #ai-attachment-button, #ai-settings-button, #ai-memory-button { position: absolute; bottom: 7px; background-color: rgba(100, 100, 100, 0.5); border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,.8); font-size: 18px; cursor: pointer; padding: 5px; line-height: 1; z-index: 3; transition: all .3s ease; border-radius: 8px; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; }
            #ai-attachment-button { left: 10px; }
            #ai-memory-button { left: 58px; font-size: 20px; } /* NEW */
            #ai-settings-button { right: 10px; font-size: 20px; color: #ccc; }
            #ai-attachment-button:hover, #ai-settings-button:hover, #ai-memory-button:hover { background-color: rgba(120, 120, 120, 0.7); color: #fff; }
            #ai-settings-button.active { background-color: rgba(150, 150, 150, 0.8); color: white; }

            #ai-settings-menu { position: absolute; bottom: calc(100% + 10px); right: 0; width: 350px; z-index: 1; background: rgb(20, 20, 22); border: 1px solid rgba(255,255,255,0.2); border-radius: 16px; box-shadow: 0 5px 25px rgba(0,0,0,0.5); padding: 15px; opacity: 0; visibility: hidden; transform: translateY(20px); transition: all .3s cubic-bezier(.4,0,.2,1); overflow: hidden; }
            #ai-settings-menu.active { opacity: 1; visibility: visible; transform: translateY(0); }
            #ai-settings-menu .menu-header { font-size: 1.1em; color: #fff; text-transform: uppercase; margin-bottom: 20px; text-align: center; font-family: 'Merriweather', serif; }
            .setting-group.toggle-group { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
            .setting-label { flex: 1; margin-right: 15px; }
            .setting-label label { display: block; color: #ccc; font-size: 0.95em; margin-bottom: 3px; font-weight: bold; }
            .setting-note { font-size: 0.75em; color: #888; margin-top: 0; }
            
            .ai-toggle-switch { position: relative; display: inline-block; width: 50px; height: 28px; flex-shrink: 0; }
            .ai-toggle-switch input { opacity: 0; width: 0; height: 0; }
            .ai-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #333; border: 1px solid #555; transition: .4s; border-radius: 28px; }
            .ai-slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
            input:checked + .ai-slider { background-color: #4285f4; border-color: #4285f4; }
            input:checked + .ai-slider:before { transform: translateX(22px); }

            /* Attachments, Code Blocks, Graphs, LaTeX */
            #ai-attachment-preview { display: none; flex-direction: row; gap: 10px; padding: 0; max-height: 0; border-bottom: 1px solid transparent; overflow-x: auto; transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
            #ai-input-wrapper.has-attachments #ai-attachment-preview { max-height: 100px; padding: 10px 15px; }
            .attachment-card { position: relative; border-radius: 8px; overflow: hidden; background: #333; height: 80px; width: 80px; flex-shrink: 0; display: flex; justify-content: center; align-items: center; transition: filter 0.3s; cursor: pointer; }
            .attachment-card.loading { filter: grayscale(80%) brightness(0.7); }
            .attachment-card.loading .file-icon { opacity: 0.3; }
            .attachment-card.loading .ai-loader { position: absolute; z-index: 2; }
            .attachment-card img { width: 100%; height: 100%; object-fit: cover; }
            .attachment-card .file-icon { font-size: 2em; color: #ccc; }
            .file-info { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.6); overflow: hidden; }
            .file-name { display: block; color: #fff; font-size: 0.75em; padding: 4px; text-align: center; white-space: nowrap; }
            .file-name.marquee > span { display: inline-block; padding-left: 100%; animation: marquee linear infinite; }
            .file-type-badge { position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.6); color: #fff; font-size: 0.7em; padding: 2px 5px; border-radius: 4px; font-family: sans-serif; font-weight: bold; }
            .remove-attachment-btn { position: absolute; top: 5px; left: 5px; background: rgba(0,0,0,0.5); color: #fff; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; z-index: 3; }

            /* NEW: Sent Attachment Previews */
            .sent-attachment-container { display: flex; flex-direction: row; gap: 10px; overflow-x: auto; padding: 10px 0 5px 0; margin-top: 10px; scrollbar-width: thin; scrollbar-color: #555 #333; }
            .sent-attachment-container::-webkit-scrollbar { height: 8px; }
            .sent-attachment-container::-webkit-scrollbar-track { background: #333; border-radius: 4px; }
            .sent-attachment-container::-webkit-scrollbar-thumb { background-color: #555; border-radius: 4px; }
            .sent-attachment-card { position: relative; border-radius: 8px; overflow: hidden; background: #333; height: 80px; width: 80px; flex-shrink: 0; display: flex; justify-content: center; align-items: center; }
            .sent-attachment-card img { width: 100%; height: 100%; object-fit: cover; }
            .sent-attachment-card .file-icon { font-size: 2em; color: #ccc; }
            .sent-file-info { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.6); padding: 4px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .sent-file-info span { color: #fff; font-size: 0.75em; }

            .ai-loader { width: 25px; height: 25px; border-radius: 50%; animation: spin 1s linear infinite; border: 3px solid rgba(255,255,255,0.3); border-top-color: #fff; }
            
            .code-block-wrapper, .graph-block-wrapper { background-color: rgba(42, 42, 48, 0.8); border-radius: 8px; margin: 10px 0; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); }
            .code-block-header, .graph-block-header { display: flex; justify-content: flex-end; align-items: center; padding: 6px 12px; background-color: rgba(0,0,0,0.2); }
            .code-metadata, .graph-metadata { font-size: 0.8em; color: #aaa; margin-right: auto; font-family: monospace; }
            .copy-code-btn { background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.2); color: #fff; border-radius: 6px; width: 32px; height: 32px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background-color 0.2s; }
            .copy-code-btn:hover { background: rgba(255, 255, 255, 0.2); }
            .copy-code-btn:disabled { cursor: default; background: rgba(25, 103, 55, 0.5); }
            .copy-code-btn svg { stroke: #e0e0e0; }
            .code-block-wrapper pre { margin: 0; padding: 15px; overflow: auto; background-color: transparent; }
            .code-block-wrapper pre::-webkit-scrollbar { height: 8px; }
            .code-block-wrapper pre::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
            .code-block-wrapper code { font-family: 'Menlo', 'Consolas', monospace; font-size: 0.9em; color: #f0f0f0; }
            .custom-graph-placeholder { min-height: 400px; position: relative; padding: 10px; }
            .graph-canvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }

            /* NEW: Download Widget */
            .ai-download-widget { background-color: rgba(30, 30, 35, 0.8); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 15px; display: flex; align-items: center; gap: 15px; margin: 10px 0; font-family: 'Lora', serif; }
            .ai-download-widget .file-icon-large { font-size: 2.5em; color: #ccc; }
            .ai-download-widget .file-info { flex: 1; display: flex; flex-direction: column; }
            .ai-download-widget .file-name-large { font-size: 1.1em; color: #fff; font-weight: bold; }
            .ai-download-widget .file-type-large { font-size: 0.9em; color: #aaa; font-family: monospace; }
            .ai-download-widget .download-file-btn { background-color: #4285f4; color: white; border: none; border-radius: 8px; padding: 10px 15px; font-size: 0.9em; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background-color 0.2s; }
            .ai-download-widget .download-file-btn:hover { background-color: #3c77e6; }
            .ai-download-widget .download-file-btn svg { stroke: white; }

            .latex-render { display: inline-block; }
            .ai-response-content div.latex-render { display: block; margin: 10px 0; text-align: center; }
            .katex { font-size: 1.1em !important; }

            .ai-message-bubble p { margin: 0; padding: 0; text-align: left; }
            .ai-message-bubble ul, .ai-message-bubble ol { margin: 10px 0; padding-left: 20px; text-align: left; list-style-position: outside; }
            .ai-message-bubble li { margin-bottom: 5px; }

            #ai-web-search-nudge { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background-color: #2a2a2e; border: 1px solid #444; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.4); color: #eee; z-index: 2147483647; padding: 15px; animation: nudge-fade-in 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
            .nudge-content { display: flex; align-items: center; gap: 15px; }
            .nudge-content p { margin: 0; font-size: 0.9em; color: #ccc; }
            .nudge-buttons { display: flex; gap: 10px; }
            .nudge-buttons button { background: none; border: 1px solid #555; color: #ddd; padding: 6px 12px; border-radius: 6px; cursor: pointer; transition: background-color 0.2s; }
            .nudge-buttons button:hover { background-color: #333; }
            #nudge-open-settings { background-color: #4285f4; border-color: #4285f4; color: white; }
            #nudge-open-settings:hover { background-color: #3c77e6; }
            
            /* NEW: Memory Modal CSS */
            #ai-memory-modal, #ai-custom-confirm, #ai-custom-alert { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); z-index: 2147483648; display: flex; justify-content: center; align-items: center; animation: nudge-fade-in 0.3s; }
            .memory-modal-content, .confirm-content, .alert-content { background: #1c1c1e; border: 1px solid #333; border-radius: 16px; width: 90%; max-width: 600px; padding: 20px; box-shadow: 0 5px 30px rgba(0,0,0,0.5); display: flex; flex-direction: column; color: #eee; }
            .memory-modal-content { height: 80vh; }
            .memory-modal-content h3 { font-family: 'Merriweather', serif; text-align: center; margin-top: 0; font-size: 1.5em; }
            .memory-modal-content .close-button { position: absolute; top: 15px; right: 20px; font-size: 2em; color: #888; cursor: pointer; }
            #memory-storage-bar-container { margin-bottom: 15px; }
            .storage-label { display: flex; justify-content: space-between; font-size: 0.8em; color: #aaa; margin-bottom: 5px; }
            .storage-bar { width: 100%; height: 10px; background: #333; border-radius: 5px; overflow: hidden; }
            #storage-bar-used { height: 100%; background: #4285f4; width: 0%; transition: width 0.5s; }
            #memory-list-container { flex: 1; overflow-y: auto; background: #111; border-radius: 8px; padding: 10px; border: 1px solid #222; }
            .no-memories { text-align: center; color: #777; margin-top: 20px; }
            .memory-item { background: #2a2a2e; border-radius: 8px; padding: 10px; margin-bottom: 10px; border: 1px solid #333; }
            .memory-content { width: 100%; min-height: 60px; background: none; border: 1px dashed #444; border-radius: 4px; color: #eee; font-family: 'Lora', serif; font-size: 1em; padding: 5px; resize: vertical; }
            .memory-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
            .memory-timestamp { font-size: 0.75em; color: #888; }
            .memory-actions button { background: #444; color: #eee; border: none; border-radius: 5px; padding: 5px 10px; font-size: 0.8em; cursor: pointer; }
            .memory-actions div { display: flex; gap: 5px; }
            .memory-actions .memory-save-btn { background: #4285f4; color: white; }
            .memory-actions .memory-delete-btn { background: #ea4335; color: white; }
            .memory-new-input { display: flex; gap: 10px; margin-top: 15px; }
            #memory-new-content { flex: 1; height: 50px; background: #222; border: 1px solid #333; color: #eee; border-radius: 8px; padding: 10px; resize: none; }
            #memory-add-btn { background: #34a853; color: white; border: none; border-radius: 8px; padding: 0 20px; font-weight: bold; cursor: pointer; }
            #memory-delete-all-btn { background: #ea4335; color: white; border: none; border-radius: 8px; padding: 10px; margin-top: 15px; cursor: pointer; font-weight: bold; }
            
            /* NEW: Custom Confirm/Alert */
            .confirm-content, .alert-content { max-width: 400px; }
            .confirm-content p, .alert-content p { font-size: 1.1em; margin-top: 0; line-height: 1.5; }
            .confirm-buttons, .alert-buttons { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
            .confirm-buttons button, .alert-buttons button { padding: 8px 15px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
            #confirm-btn-cancel, #alert-btn-ok { background: #555; color: white; }
            #confirm-btn-ok { background: #ea4335; color: white; }


            @keyframes nudge-fade-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
            @keyframes glow { 0%,100% { box-shadow: 0 0 5px rgba(255,255,255,.15), 0 0 10px rgba(255,255,255,.1); } 50% { box-shadow: 0 0 10px rgba(255,255,255,.25), 0 0 20px rgba(255,255,255,.2); } }
            @keyframes gemini-glow { 0%,100% { box-shadow: 0 0 8px 2px var(--ai-blue); } 25% { box-shadow: 0 0 8px 2px var(--ai-green); } 50% { box-shadow: 0 0 8px 2px var(--ai-yellow); } 75% { box-shadow: 0 0 8px 2px var(--ai-red); } }
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes message-pop-in { 0% { opacity: 0; transform: translateY(10px) scale(.98); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes brand-title-pulse { 0%, 100% { text-shadow: 0 0 7px var(--ai-blue); } 25% { text-shadow: 0 0 7px var(--ai-green); } 50% { text-shadow: 0 0 7px var(--ai-yellow); } 75% { text-shadow: 0 0 7px var(--ai-red); } }
            @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }
        `;
        document.head.appendChild(style);
    }

    document.addEventListener('keydown', handleKeyDown);

    document.addEventListener('DOMContentLoaded', async () => {
        loadAppSettings();
        // Pre-warm the database connection
        initMemoryDB().catch(e => console.error("Failed to init DB on load:", e));
    });
})();
