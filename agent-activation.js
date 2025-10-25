(function() {
    // --- CONFIGURATION ---
    const API_KEY = 'AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro';
    const BASE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/`;
    const MAX_INPUT_HEIGHT = 180;
    const CHAR_LIMIT = 10000;
    const PASTE_TO_FILE_THRESHOLD = 10000;
    const MAX_ATTACHMENTS_PER_MESSAGE = 10;

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
    let appSettings = {
        webSearch: true,
        locationSharing: true
    };

    // --- UTILITIES ---

    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    };

    /**
     * Helper to escape HTML special characters.
     */
    function escapeHTML(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/[&<>"']/g, (match) => {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[match];
        });
    }

    /**
     * Helper to format bytes for display.
     */
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    /**
     * Loads app settings from localStorage on script initialization.
     */
    function loadAppSettings() {
        try {
            const storedSettings = localStorage.getItem('ai-app-settings');
            if (storedSettings) {
                const parsed = JSON.parse(storedSettings);
                appSettings = {
                    ...appSettings,
                    ...parsed
                };
            }
        } catch (e) {
            console.error("Error loading app settings:", e);
        }
    }
    loadAppSettings();

    /**
     * Saves the app settings (toggles) to localStorage.
     */
    function saveAppSettings() {
        try {
            localStorage.setItem('ai-app-settings', JSON.stringify(appSettings));
        } catch (e) {
            console.error("Error saving app settings:", e);
        }
    }

    // --- GEOLOCATION UTILITIES (from original file) ---

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

    function getUserLocationForContext() {
        return new Promise((resolve) => {
            if (!appSettings.locationSharing) {
                const fallback = 'Location Sharing is disabled by user.';
                localStorage.setItem('ai-user-location', fallback);
                resolve(fallback);
                return;
            }
            const url = "https://ipgeolocation.abstractapi.com/v1/?api_key=9e522ec72e554164bab14e7895db90b2&ip_address=2600:1700:6260:1790:56e6:a7aa:af32:1908";
            httpGetAsync(url, (response, error) => {
                if (error) {
                    console.warn('Geolocation failed:', error.message);
                    let fallback = localStorage.getItem('ai-user-location') || 'Location API Error/Unavailable';
                    localStorage.setItem('ai-user-location', fallback);
                    resolve(fallback);
                } else {
                    try {
                        const data = JSON.parse(response);
                        const { city, region, country, latitude, longitude } = data;
                        const lat = parseFloat(latitude).toFixed(4);
                        const lon = parseFloat(longitude).toFixed(4);
                        const address = [city, region, country].filter(Boolean).join(', ');
                        const locationString = `Coordinates: Latitude: ${lat}, Longitude: ${lon}\nGeneral Location/Address: ${address}`;
                        localStorage.setItem('ai-user-location', locationString);
                        resolve(locationString);
                    } catch (e) {
                        console.error('Failed to parse location response:', e);
                        let fallback = 'Location response parsing failed.';
                        localStorage.setItem('ai-user-location', fallback);
                        resolve(fallback);
                    }
                }
            });
        });
    }


    // --- RENDERING UTILITIES (from original file) ---

    async function isUserAuthorized() {
        return true;
    }

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
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        data.forEach(trace => {
            trace.x.forEach(val => { minX = Math.min(minX, val); maxX = Math.max(maxX, val); });
            trace.y.forEach(val => { minY = Math.min(minY, val); maxY = Math.max(maxY, val); });
        });
        const xRange = maxX - minX || 1;
        const yRange = maxY - minY || 1;
        minX -= xRange * 0.1; maxX += xRange * 0.1;
        minY -= yRange * 0.1; maxY += yRange * 0.1;
        const mapX = x => padding.left + ((x - minX) / (maxX - minX)) * graphWidth;
        const mapY = y => padding.top + graphHeight - ((y - minY) / (maxY - minY)) * graphHeight;
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
        if (layout.title) {
            ctx.fillStyle = '#fff';
            ctx.font = '18px Merriweather';
            ctx.textAlign = 'center';
            ctx.fillText(layout.title, rect.width / 2, padding.top / 2 + 5);
        }
    }


    // --- NEW HELPER FUNCTIONS FOR SETTINGS TABS AND GALLERY (REQUESTED MODIFICATIONS) ---

    /**
     * NEW: Switches between the General and Connectors tabs in the settings menu.
     */
    function switchSettingsTab(tabName) {
        document.querySelectorAll('#ai-settings-menu .tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('#ai-settings-menu .tab-content').forEach(content => {
            content.classList.remove('active');
        });

        const menu = document.getElementById('ai-settings-menu');

        if (menu) {
            menu.classList.add('switching-tabs');
            setTimeout(() => {
                document.getElementById(`tab-btn-${tabName}`).classList.add('active');
                document.getElementById(`tab-content-${tabName}`).classList.add('active');
                menu.classList.remove('switching-tabs');
            }, 50);
        }
    }

    /**
     * NEW: Renders the food recommendation images in a horizontal scroll menu.
     * @param {Array<object>} data Array of image objects {image_url, label, description}
     * @returns {string} HTML string for the gallery.
     */
    function renderFoodGallery(data) {
        if (!data || data.length === 0) return '';

        let galleryHTML = `<div class="ai-food-gallery-container">`;
        data.forEach(item => {
            const imageURL = escapeHTML(item.image_url || 'https://via.placeholder.com/300x200?text=No+Image');
            const labelText = escapeHTML(item.label || 'Place');
            const descriptionText = escapeHTML(item.description || 'Details unavailable.'); // This holds rating/review count

            galleryHTML += `
                <div class="gallery-item-wrapper">
                    <div class="gallery-item">
                        <img src="${imageURL}" alt="${labelText}" loading="lazy">
                        <div class="item-label-overlay">
                            <span class="item-label">${labelText}</span>
                        </div>
                    </div>
                    <div class="item-description-under">${descriptionText}</div>
                </div>
            `;
        });
        galleryHTML += `</div>`;
        return galleryHTML;
    }


    // --- MODIFIED createSettingsMenu FUNCTION ---

    /**
     * REPLACED: Creates the new settings menu with General and Connectors tabs.
     */
    function createSettingsMenu() {
        const menu = document.createElement('div');
        menu.id = 'ai-settings-menu';
        menu.innerHTML = `
            <div class="menu-header">AI Agent Settings</div>
            <div class="tab-header">
                <button id="tab-btn-general" class="tab-button active">General</button>
                <button id="tab-btn-connectors" class="tab-button">Connectors</button>
            </div>

            <div id="tab-content-general" class="tab-content active">
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
                        <p class="setting-note">Share general location for context-aware responses (e.g., weather).</p>
                    </div>
                    <label class="ai-toggle-switch">
                        <input type="checkbox" id="settings-location-sharing" ${appSettings.locationSharing ? 'checked' : ''}>
                        <span class="ai-slider"></span>
                    </label>
                </div>
            </div>

            <div id="tab-content-connectors" class="tab-content">
                <div class="setting-group connector-group">
                    <div class="connector-info">
                        <label>Google Gmail API</label>
                        <p class="connector-description"><i>Allows the agent to draft, summarize, and search your recent emails to answer questions.</i></p>
                    </div>
                    <button class="connect-btn disconnected" data-connector="gmail">Connect</button>
                </div>
                <div class="setting-group connector-group">
                    <div class="connector-info">
                        <label>Google Drive</label>
                        <p class="connector-description"><i>Enables the agent to search and analyze documents, spreadsheets, and presentations in your Drive.</i></p>
                    </div>
                    <button class="connect-btn disconnected" data-connector="drive">Connect</button>
                </div>
                <div class="connector-note">
                    <p>Note: Connection status is a mock for demonstration. Real connection requires Google OAuth flow.</p>
                </div>
            </div>
        `;

        // Add event listeners for Toggles
        menu.querySelector('#settings-web-search').addEventListener('change', (e) => {
            appSettings.webSearch = e.target.checked;
            saveAppSettings();
        });
        menu.querySelector('#settings-location-sharing').addEventListener('change', (e) => {
            appSettings.locationSharing = e.target.checked;
            saveAppSettings();
        });

        // Add event listeners for Tabs
        menu.querySelector('#tab-btn-general').addEventListener('click', () => switchSettingsTab('general'));
        menu.querySelector('#tab-btn-connectors').addEventListener('click', () => switchSettingsTab('connectors'));

        // Connector button mock logic
        menu.querySelectorAll('.connect-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (e.target.classList.contains('connected')) {
                    e.target.classList.remove('connected');
                    e.target.classList.add('disconnected');
                    e.target.textContent = 'Connect';
                } else {
                    e.target.classList.remove('disconnected');
                    e.target.classList.add('connected');
                    e.target.textContent = 'Connected';
                }
            });
        });

        return menu;
    }


    // --- MODIFIED getDynamicSystemInstructionAndModel FUNCTION ---

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
     * MODIFIED: Generates the system instruction, including new, highly restricted instructions for realistic location queries.
     * @param {string} query The user's latest message.
     * @param {object} currentSettings The current app settings (webSearch, locationSharing).
     * @returns {{instruction: string, model: string}}
     */
    function getDynamicSystemInstructionAndModel(query, currentSettings) {
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

        // NEW: Add web search instruction
        if (currentSettings.webSearch) {
            personaInstruction += `\n**Web Search: ENABLED.** You can and should use external sources to answer questions about current events, specific facts, or places.\n`;
        } else {
            personaInstruction += `\n**Web Search: DISABLED.** You must answer using only your internal knowledge. If you CANNOT answer without a web search, you MUST include the exact string \`[NEEDS_WEB_SEARCH]\` in your response and explain that you need web access to answer fully.\n`;
        }


        switch (intent) {
            case 'DEEP_ANALYSIS':
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
                    `Forget them, you have better things to do, like talking to me.`,
                    `Wow, good riddance. That's a level of trash I wouldn't touch with a ten-foot pole.`
                ];
                const roastInsult = roastInsults[Math.floor(Math.random() * roastInsults.length)];

                if (query.toLowerCase().includes('ex') || query.toLowerCase().includes('roast')) {
                    personaInstruction += `\n\n**Current Persona: Sarcastic, Supportive Friend (2.5-Flash).** Your goal is to empathize with the user, validate their feelings, and join them in 'roasting' or speaking negatively about their ex/situation. Be funny, slightly aggressive toward the subject of trash talk, and deeply supportive of the user. Use casual language and slang. **Example of tone/support:** "${roastInsult}"`;
                } else {
                    personaInstruction += `\n\n**Current Persona: Creative Partner (25-Flash).** Use rich, evocative language. Be imaginative, focus on descriptive details, and inspire new ideas.`;
                }
                break;
            case 'CASUAL':
            default:
                const lowerQuery = query.toLowerCase();
                // NEW: Enhanced food recommendation logic with new constraints
                if (lowerQuery.includes('eat') || lowerQuery.includes('restaurant') || lowerQuery.includes('food') || lowerQuery.includes('place to go') || lowerQuery.includes('nearby')) {
                    model = 'gemini-2.5-flash';
                    personaInstruction += `\n\n**Current Persona: Local Expert (2.5-Flash).** You are balanced, helpful, and friendly. Your primary function is efficient conversation, but you must prioritize providing detailed and realistic recommendations.
**Special Requirement: Local Recommendation (MANDATORY REALISM).** When providing recommendations for places to eat or visit:
1. **Verifiability:** You MUST use current, verifiable data from your web search (Web Search MUST be enabled). Do not recommend non-existent, closed, or fictional locations.
2. **Preference Filtering:** Unless the user explicitly asks for 'cheap', 'budget', 'run-down', 'fine dining', or 'luxury', you MUST prioritize mid-range establishments that are popular and well-regarded (e.g., 3.5 to 4.5 stars). Avoid extremes.
3. **Sourcing Requirement:** To ensure the recommendation is valid, you MUST find at least **3 distinct external sources** to support the factual claims (name, address, rating) of the top recommendation. If fewer than 3 sources are found, you must state that the recommendation is limited in scope or suggest enabling web search.
4. **Enhanced Description:** Provide a detailed description covering atmosphere, public sentiment/reviews, and overall experience.

The response MUST include a \`<FOOD_GALLERY>\` block at the end of the content (before sources). This block contains a JSON array of image objects for a horizontal scroll menu. The images MUST be relevant to the recommendation.
**MANDATORY FORMATTING for Recommendations:**
**<FOOD_GALLERY>**
[
    {
        "image_url": "https://[real-image-link-1]",
        "label": "[Name of Place/Dish]",
        "description": "[Rating and Review Count, e.g., 4.2 ★ (3,100 Reviews)]"
    },
    // ... up to 5 more items (MUST be real images and places)
]
**</FOOD_GALLERY>**
`;
                } else {
                    model = 'gemini-2.5-flash-lite';
                    personaInstruction += `\n\n**Current Persona: Standard Assistant (2.5-Flash-Lite).** You are balanced, helpful, and concise. Use a friendly and casual tone. Your primary function is efficient conversation. Make sure to be highly concise, making sure to not write too much.`;
                }
                break;
        }

        return {
            instruction: personaInstruction,
            model: model
        };
    }

    function getDynamicSystemInstruction(query, settings) {
        return getDynamicSystemInstructionAndModel(query, settings).instruction;
    }


    // --- RESPONSE PARSING LOGIC (Implemented to support new and existing features) ---

    /**
     * Parses the raw Gemini text response, extracting blocks and converting markdown/KaTeX.
     * @param {string} text The raw text response from the Gemini API.
     * @returns {{html: string, thoughtProcess: string, sourcesHTML: string, galleryHTML: string}}
     */
    function parseGeminiResponse(text) {
        let thoughtProcess = '';
        let sourcesHTML = '';
        let galleryHTML = '';

        // 1. Extract <THOUGHT_PROCESS>
        const thoughtMatch = text.match(/<THOUGHT_PROCESS>([\s\S]*?)<\/THOUGHT_PROCESS>/);
        if (thoughtMatch) {
            thoughtProcess = thoughtMatch[1].trim();
            text = text.replace(thoughtMatch[0], '');
        }

        // 2. Extract <SOURCE> tags
        const sourceMatches = [...text.matchAll(/<SOURCE\s+URL="([^"]+)"\s+TITLE="([^"]+)"\s*\/>/g)];
        if (sourceMatches.length > 0) {
            sourcesHTML = '<div class="ai-sources"><h4>Sources:</h4><ul>';
            sourceMatches.forEach((match, index) => {
                const url = escapeHTML(match[1]);
                const title = escapeHTML(match[2]);
                sourcesHTML += `<li>[${index + 1}] <a href="${url}" target="_blank">${title}</a></li>`;
            });
            sourcesHTML += '</ul></div>';
            text = text.replace(/<SOURCE\s+URL="[^"]+"\s+TITLE="[^"]+"\s*\/>/g, '');
        }

        // 3. Extract and process <FOOD_GALLERY> (NEW)
        const galleryMatch = text.match(/<FOOD_GALLERY>([\s\S]*?)<\/FOOD_GALLERY>/);
        if (galleryMatch) {
            text = text.replace(galleryMatch[0], '');
            try {
                const galleryData = JSON.parse(galleryMatch[1].trim());
                galleryHTML = renderFoodGallery(galleryData);
            } catch (e) {
                console.error("Failed to parse FOOD_GALLERY JSON:", e);
                galleryHTML = '<div class="ai-error" style="font-size: 12px; margin-top: 10px;">Failed to load gallery data due to JSON format error.</div>';
            }
        }

        // 4. Extract and process <graph> tags (Custom logic)
        text = text.replace(/<graph>([\s\S]*?)<\/graph>/g, (match, graphJson) => {
            try {
                const data = JSON.parse(graphJson.trim());
                const graphId = `graph-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                // Store data as a JSON string in a data attribute
                return `<div class="custom-graph-placeholder" id="${graphId}" data-graph-data="${escapeHTML(JSON.stringify(data))}"><canvas></canvas></div>`;
            } catch (e) {
                console.error("Graph JSON parsing error:", e);
                return `<div class="ai-error">[Graph Parsing Error] Invalid JSON format.</div>`;
            }
        });

        // 5. Convert KaTeX blocks (double $$ and single $)
        // Display math (must be first)
        text = text.replace(/\$\$([\s\S]*?)\$\$/g, (match, tex) => {
            return `<span class="latex-render" data-tex="${escapeHTML(tex.trim())}" data-display-mode="true"></span>`;
        });
        // Inline math
        text = text.replace(/\$([^$]+?)\$/g, (match, tex) => {
            return `<span class="latex-render" data-tex="${escapeHTML(tex.trim())}" data-display-mode="false"></span>`;
        });

        // 6. Basic Markdown-like conversion to HTML
        let html = text.trim();

        // Code blocks (Must be before line breaks to preserve formatting)
        html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
            const langMatch = code.match(/^([a-zA-Z]+)\n/);
            let language = '';
            if (langMatch) {
                language = langMatch[1];
                code = code.replace(langMatch[0], '');
            }
            const escapedCode = escapeHTML(code.trim());
            return `
                <div class="code-block">
                    <div class="code-header">
                        <span class="code-language">${language.toUpperCase()}</span>
                        <button class="copy-code-btn" title="Copy code" data-code="${escapedCode}">
                            ${copyIconSVG}
                        </button>
                    </div>
                    <pre><code>${escapedCode}</code></pre>
                </div>`;
        });

        // Headings
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

        // Lists (Handles simple bullets)
        html = html.replace(/^(\*|\-)\s+(.*)/gim, '<li>$2</li>');
        html = html.replace(/(<li>.*<\/li>)/gms, '<ul>$1</ul>');
        // Simple numbered lists
        html = html.replace(/^\d+\.\s+(.*)/gim, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>)/gms, '<ol>$1</ol>');

        // Bold
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // Italic
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // Inline code (must be after block code)
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Links (basic URL detection for remaining text)
        html = html.replace(/(\s|^)(https?:\/\/[^\s]+)/g, (match, pre, url) => {
            return `${pre}<a href="${url}" target="_blank">${url}</a>`;
        });

        // Double line breaks for paragraphs
        html = html.split('\n').map(line => line.trim()).filter(line => line.length > 0).join('</p><p>');
        html = `<p>${html}</p>`;
        html = html.replace(/<p><\/p>/g, '');

        return { html: html, thoughtProcess: thoughtProcess, sourcesHTML: sourcesHTML, galleryHTML: galleryHTML };
    }


    // --- CORE AI & UI FUNCTIONS (from original file, modified for new logic) ---

    /**
     * Handles the Ctrl + \ shortcut for AI activation/deactivation.
     */
    async function handleKeyDown(e) {
        if (e.ctrlKey && e.key === '\\') {
            const selection = window.getSelection().toString();
            if (isAIActive) {
                if (selection.length > 0) {
                    return;
                }
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
        persistentTitle.textContent = "AI Agent";

        const welcomeMessage = document.createElement('div');
        welcomeMessage.id = 'ai-welcome-message';
        const welcomeHeader = chatHistory.length > 0 ? "Welcome Back" : "Welcome to AI Agent";
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
        document.removeEventListener('click', handleMenuOutsideClick);
    }

    function renderChatHistory() {
        const responseContainer = document.getElementById('ai-response-container');
        if (!responseContainer) return;
        responseContainer.innerHTML = '';
        chatHistory.forEach(message => {
            const bubble = document.createElement('div');
            bubble.className = `ai-message-bubble ${message.role === 'user' ? 'user-message' : 'gemini-response'}`;
            if (message.role === 'model') {
                const text = message.parts[0].text;
                // MODIFIED: Use new parseGeminiResponse to get galleryHTML
                const { html: parsedResponse, thoughtProcess, sourcesHTML, galleryHTML } = parseGeminiResponse(text);

                // Start building the bubble content
                let fullContent = `<div class="ai-response-content">${parsedResponse}</div>`;

                // NEW: Append gallery HTML if present
                if (galleryHTML) {
                    fullContent += galleryHTML;
                }

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

                bubble.innerHTML = fullContent;

                bubble.querySelectorAll('.copy-code-btn').forEach(button => {
                    button.addEventListener('click', handleCopyCode);
                });
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

        let processedChatHistory = [...chatHistory];
        if (processedChatHistory.length > 6) {
            processedChatHistory = [...processedChatHistory.slice(0, 3), ...processedChatHistory.slice(-3)];
        }

        const lastMessageIndex = processedChatHistory.length - 1;
        const userParts = processedChatHistory[lastMessageIndex].parts;
        const textPartIndex = userParts.findIndex(p => p.text);
        const lastUserQuery = userParts[textPartIndex]?.text || '';

        const { instruction: dynamicInstruction, model } = getDynamicSystemInstructionAndModel(lastUserQuery, appSettings);

        if (textPartIndex > -1) {
            userParts[textPartIndex].text = firstMessageContext + userParts[textPartIndex].text;
        } else if (firstMessageContext) {
            userParts.unshift({ text: firstMessageContext.trim() });
        }

        const payload = {
            contents: processedChatHistory,
            systemInstruction: { parts: [{ text: dynamicInstruction }] }
        };

        const DYNAMIC_API_URL = `${BASE_API_URL}${model}:generateContent?key=${API_KEY}`;

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

            let text = data.candidates[0].content.parts[0]?.text || '';
            if (!text) {
                responseBubble.innerHTML = `<div class="ai-error">The AI generated an empty response. Please try again or rephrase.</div>`;
                return;
            }

            if (text.includes('[NEEDS_WEB_SEARCH]')) {
                setTimeout(showWebSearchNudge, 500);
                text = text.replace(/\[NEEDS_WEB_SEARCH\]/g, '');
            }

            chatHistory.push({ role: "model", parts: [{ text: text }] });

            const { html: contentHTML, thoughtProcess, sourcesHTML, galleryHTML } = parseGeminiResponse(text);

            responseBubble.style.opacity = '0';
            setTimeout(() => {
                let fullContent = `<div class="ai-response-content">${contentHTML}</div>`;

                if (galleryHTML) {
                    fullContent += galleryHTML;
                }

                if (sourcesHTML) {
                    fullContent += sourcesHTML;
                }

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

                responseBubble.querySelectorAll('.ai-thought-process').forEach(monologueDiv => {
                    monologueDiv.querySelector('.monologue-header').addEventListener('click', () => {
                        monologueDiv.classList.toggle('collapsed');
                        const btn = monologueDiv.querySelector('.monologue-toggle-btn');
                        if (monologueDiv.classList.contains('collapsed')) {
                            btn.textContent = 'Show Thoughts';
                        } else {
                            btn.textContent = 'Hide Thoughts';
                        }
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


    // --- UI/EVENT HANDLERS (from original file) ---

    function toggleSettingsMenu() {
        const menu = document.getElementById('ai-settings-menu');
        const toggleBtn = document.getElementById('ai-settings-button');
        const isMenuOpen = menu.classList.toggle('active');
        toggleBtn.classList.toggle('active', isMenuOpen);
        if (isMenuOpen) {
            document.getElementById('settings-web-search').checked = appSettings.webSearch;
            document.getElementById('settings-location-sharing').checked = appSettings.locationSharing;
            // Ensure General tab is active on open by default if no preference is saved
            switchSettingsTab('general');
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
                alert(`Upload failed: Total size of attachments would exceed the 10MB limit per message. (Current: ${formatBytes(currentTotalSize)}, Adding: ${formatBytes(newFilesSize)})`);
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
                        item.fileContent = dataUrl;
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
                    previewHTML = `<img src="data:${file.inlineData.mimeType};base64,${file.inlineData.data}" alt="${fileName}" />`;
                } else {
                    previewHTML = `<span class="file-icon">📄</span>`;
                }
                fileCard.onclick = () => showFilePreview(file);
            }

            const fileExtDisplay = fileExt.length > 5 ? 'FILE' : fileExt;

            fileCard.innerHTML = `
                ${previewHTML}
                <span class="file-ext">${fileExtDisplay}</span>
                <button class="remove-attachment" data-index="${index}">&times;</button>
            `;
            previewContainer.appendChild(fileCard);

            fileCard.querySelector('.remove-attachment').onclick = (e) => {
                e.stopPropagation();
                attachedFiles.splice(index, 1);
                renderAttachments();
            };
        });
    }

    function showFilePreview(file) {
        if (file.fileContent) {
            const preview = window.open("", "_blank");
            preview.document.write(`
                <html>
                <head><title>${file.fileName}</title></head>
                <body style="margin:0; background: #222; display: flex; align-items: center; justify-content: center; height: 100vh;">
                    ${file.inlineData.mimeType.startsWith('image/') ?
                        `<img src="${file.fileContent}" style="max-width: 90%; max-height: 90%; object-fit: contain;" alt="${file.fileName}" />` :
                        `<iframe src="${file.fileContent}" style="width: 90%; height: 90%; border: none;"></iframe>`
                    }
                </body>
                </html>
            `);
            preview.document.close();
        }
    }

    function handlePaste(e) {
        let paste = (e.clipboardData || window.clipboardData);
        if (paste.items) {
            for (let i = 0; i < paste.items.length; i++) {
                if (paste.items[i].type.indexOf("image") !== -1) {
                    const file = paste.items[i].getAsFile();
                    if (file) {
                        e.preventDefault();
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
                                item.fileName = 'Pasted Image';
                                item.fileContent = dataUrl;
                                delete item.file;
                                delete item.tempId;
                                renderAttachments();
                            }
                        };
                        reader.readAsDataURL(file);
                        return;
                    }
                }
            }
        }

        e.preventDefault();
        let text = paste.getData('text/plain');
        if (text.length > PASTE_TO_FILE_THRESHOLD) {
            const file = new File([text], `Pasted_Text_${Date.now()}.txt`, { type: "text/plain" });
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64Data = e.target.result.split(',')[1];
                const dataUrl = e.target.result;
                processFileLike(file, base64Data, dataUrl);
            };
            reader.readAsDataURL(file);
        } else {
            document.execCommand('insertText', false, text);
        }
    }

    function handleCopyCode(e) {
        const button = e.currentTarget;
        const code = button.dataset.code;
        navigator.clipboard.writeText(code).then(() => {
            button.innerHTML = checkIconSVG;
            setTimeout(() => {
                button.innerHTML = copyIconSVG;
            }, 2000);
        }).catch(err => {
            console.error('Could not copy text: ', err);
            alert('Failed to copy code.');
        });
    }

    function formatCharLimit(limit) {
        if (limit >= 1000) {
            return (limit / 1000) + 'k';
        }
        return limit;
    }

    function handleContentEditableInput() {
        const editor = document.getElementById('ai-input');
        const counter = document.getElementById('ai-char-counter');
        const text = editor.innerText.trim();
        const count = text.length;

        editor.style.height = 'auto';
        editor.style.height = Math.min(editor.scrollHeight, MAX_INPUT_HEIGHT) + 'px';

        if (count > CHAR_LIMIT) {
            editor.innerText = text.substring(0, CHAR_LIMIT);
            counter.classList.add('over-limit');
        } else {
            counter.classList.remove('over-limit');
        }
        counter.textContent = `${count} / ${formatCharLimit(CHAR_LIMIT)}`;
    }

    function handleInputSubmission(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const inputElement = document.getElementById('ai-input');
            const queryText = inputElement.innerText.trim();

            if (isRequestPending) {
                alert('A request is already pending. Please wait.');
                return;
            }

            if (queryText.length === 0 && attachedFiles.length === 0) {
                return;
            }

            if (queryText.length > CHAR_LIMIT) {
                alert(`Your message exceeds the character limit of ${CHAR_LIMIT}.`);
                return;
            }

            isRequestPending = true;
            inputElement.contentEditable = false;
            const inputWrapper = document.getElementById('ai-input-wrapper');
            inputWrapper.classList.add('waiting');

            const userMessage = {
                role: 'user',
                parts: []
            };

            if (attachedFiles.length > 0) {
                attachedFiles.forEach(file => {
                    userMessage.parts.push(file.inlineData);
                });
                attachedFiles = [];
                renderAttachments();
            }

            if (queryText.length > 0) {
                userMessage.parts.push({
                    text: queryText
                });
            }

            chatHistory.push(userMessage);
            inputElement.innerText = '';
            inputElement.style.height = 'auto';
            document.getElementById('ai-char-counter').textContent = `0 / ${formatCharLimit(CHAR_LIMIT)}`;
            document.getElementById('ai-welcome-message').style.display = 'none';
            document.getElementById('ai-container').classList.add('chat-active');

            renderChatHistory();

            const responseContainer = document.getElementById('ai-response-container');
            const aiBubble = document.createElement('div');
            aiBubble.className = 'ai-message-bubble gemini-response loading';
            aiBubble.innerHTML = '<div class="ai-response-content">Thinking...</div><div class="ai-loader"></div>';
            responseContainer.appendChild(aiBubble);
            responseContainer.scrollTop = responseContainer.scrollHeight;

            callGoogleAI(aiBubble);
        }
    }


    function injectStyles() {
        if (document.getElementById('ai-dynamic-styles')) return;

        if (!document.querySelector('link[href*="font-awesome"]')) {
            const fontAwesomeLink = document.createElement('link');
            fontAwesomeLink.rel = 'stylesheet';
            fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';
            document.head.appendChild(fontAwesomeLink);
        }

        if (!document.getElementById('ai-katex-styles')) {
            const katexCSS = document.createElement('link');
            katexCSS.id = 'ai-katex-styles';
            katexCSS.rel = 'stylesheet';
            katexCSS.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.css';
            document.head.appendChild(katexCSS);
        }

        if (!document.getElementById('ai-google-fonts')) {
            const fontLink = document.createElement('link');
            fontLink.id = 'ai-google-fonts';
            fontLink.rel = 'stylesheet';
            fontLink.href = 'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400..700;1,400..700&family=Merriweather:ital,wght@0,300;0,400;0,700;1,300;1,400;1,700&display=swap';
            document.head.appendChild(fontLink);
        }

        const style = document.createElement('style');
        style.id = 'ai-dynamic-styles';
        style.textContent = `
            :root {
                --ai-bg-color: #212121;
                --ai-text-color: #f1f1f1;
                --ai-brand-color: #4285f4;
                --ai-input-bg: #333;
                --ai-border-color: #555;
                --ai-gemini-bg: #444;
                --ai-user-bg: #3b3b3b;
                --ai-blue: #4285f4;
                --ai-green: #34a853;
                --ai-yellow: #fbbc04;
                --ai-red: #ea4335;
                --ai-max-width: 500px;
            }

            #ai-container {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 100%;
                max-width: var(--ai-max-width);
                height: 0;
                background-color: var(--ai-bg-color);
                color: var(--ai-text-color);
                border-radius: 12px;
                box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
                display: flex;
                flex-direction: column;
                z-index: 10000;
                opacity: 0;
                transform: translateY(100%);
                transition: height 0.5s ease-in-out, opacity 0.3s ease-in-out 0.2s, transform 0.5s ease-in-out;
                font-family: 'Lora', serif;
                overflow: hidden;
                border: 1px solid var(--ai-border-color);
            }

            #ai-container.active {
                height: 80vh;
                max-height: 700px;
                opacity: 1;
                transform: translateY(0);
                transition: height 0.5s ease-in-out, opacity 0.3s ease-in-out, transform 0.5s ease-in-out;
            }

            #ai-container.deactivating {
                height: 0;
                opacity: 0;
                transform: translateY(100%);
            }

            #ai-brand-title {
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 15px;
                font-family: 'Merriweather', serif;
                font-size: 1.5em;
                font-weight: 700;
                color: var(--ai-brand-color);
                background-color: var(--ai-input-bg);
                border-bottom: 1px solid var(--ai-border-color);
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                z-index: 10;
                transition: opacity 0.3s, transform 0.3s;
            }
            #ai-brand-title span {
                opacity: 0;
                animation: slide-in-text 0.5s forwards;
            }
            #ai-brand-title span:nth-child(2) { animation-delay: 0.05s; }
            #ai-brand-title span:nth-child(3) { animation-delay: 0.1s; }
            #ai-brand-title span:nth-child(4) { animation-delay: 0.15s; }
            #ai-brand-title span:nth-child(5) { animation-delay: 0.2s; }
            #ai-brand-title span:nth-child(6) { animation-delay: 0.25s; }
            #ai-brand-title span:nth-child(7) { animation-delay: 0.3s; }
            #ai-brand-title span:nth-child(8) { animation-delay: 0.35s; }
            #ai-brand-title span:nth-child(9) { animation-delay: 0.4s; }
            #ai-brand-title span:nth-child(10) { animation-delay: 0.45s; }
            #ai-brand-title span:nth-child(11) { animation-delay: 0.5s; }

            #ai-persistent-title {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                padding: 15px;
                font-family: 'Merriweather', serif;
                font-size: 1.2em;
                font-weight: 700;
                color: var(--ai-brand-color);
                background-color: var(--ai-input-bg);
                border-bottom: 1px solid var(--ai-border-color);
                text-align: center;
                z-index: 10;
                opacity: 0;
                transition: opacity 0.3s, transform 0.3s;
            }

            #ai-container.chat-active #ai-brand-title {
                opacity: 0;
                transform: translateY(-100%);
            }
            #ai-container.chat-active #ai-persistent-title {
                opacity: 1;
                transform: translateY(0);
            }

            #ai-welcome-message {
                padding: 60px 20px 20px;
                text-align: center;
                flex-grow: 1;
                display: flex;
                flex-direction: column;
                justify-content: center;
                background-color: var(--ai-bg-color);
            }
            #ai-welcome-message h2 {
                color: #fff;
                margin-top: 0;
                font-family: 'Merriweather', serif;
            }
            #ai-welcome-message p {
                color: #aaa;
                font-size: 0.9em;
                line-height: 1.4;
            }
            .shortcut-tip {
                margin-top: 20px !important;
                font-size: 0.8em !important;
                font-style: italic;
            }

            #ai-close-button {
                position: absolute;
                top: 15px;
                right: 15px;
                font-size: 1.5em;
                color: #aaa;
                cursor: pointer;
                line-height: 1;
                z-index: 20;
                transition: color 0.2s;
            }
            #ai-close-button:hover {
                color: #fff;
            }

            #ai-response-container {
                flex-grow: 1;
                padding: 10px 20px 20px;
                overflow-y: auto;
                scroll-behavior: smooth;
                background-color: var(--ai-bg-color);
                padding-top: 60px;
            }

            #ai-container:not(.chat-active) #ai-response-container {
                display: none;
            }
            #ai-container.chat-active #ai-welcome-message {
                display: none;
            }


            .ai-message-bubble {
                padding: 12px 15px;
                margin-bottom: 15px;
                max-width: 90%;
                border-radius: 12px;
                font-size: 0.95em;
                line-height: 1.4;
                word-wrap: break-word;
                opacity: 0;
                animation: message-pop-in 0.3s forwards;
            }

            .user-message {
                background-color: var(--ai-user-bg);
                color: var(--ai-text-color);
                margin-left: auto;
                border-bottom-right-radius: 4px;
            }
            .gemini-response {
                background-color: var(--ai-gemini-bg);
                color: var(--ai-text-color);
                margin-right: auto;
                border-bottom-left-radius: 4px;
            }

            .ai-response-content strong {
                font-weight: 700;
                color: #fff;
            }
            .ai-response-content em {
                font-style: italic;
                color: #ccc;
            }
            .ai-response-content a {
                color: var(--ai-brand-color);
                text-decoration: none;
            }

            /* Typography */
            .ai-response-content h1, .ai-response-content h2, .ai-response-content h3 {
                font-family: 'Merriweather', serif;
                color: #fff;
                margin-top: 1em;
                margin-bottom: 0.5em;
                padding-bottom: 0.2em;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            .ai-response-content p {
                margin: 0.5em 0;
            }
            .ai-response-content ul, .ai-response-content ol {
                padding-left: 20px;
                margin: 0.5em 0;
            }
            .ai-response-content li {
                margin-bottom: 5px;
            }


            /* Code Blocks */
            .code-block {
                margin: 15px 0;
                border-radius: 6px;
                overflow: hidden;
                background-color: #1c1c1c;
                border: 1px solid #333;
            }
            .code-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 5px 10px;
                background-color: #2a2a2a;
                border-bottom: 1px solid #333;
            }
            .code-language {
                font-family: monospace;
                font-size: 0.8em;
                color: #aaa;
            }
            .copy-code-btn {
                background: none;
                border: none;
                color: #aaa;
                cursor: pointer;
                padding: 0 5px;
                transition: color 0.2s;
                display: flex;
                align-items: center;
            }
            .copy-code-btn:hover {
                color: #fff;
            }
            .code-block pre {
                margin: 0;
                padding: 10px;
                overflow-x: auto;
            }
            .code-block code {
                font-family: monospace;
                font-size: 0.85em;
                color: #ddd;
                white-space: pre-wrap;
                word-break: break-all;
                display: block;
                background-color: transparent !important;
                padding: 0 !important;
            }
            .ai-response-content code {
                background-color: #333;
                padding: 2px 4px;
                border-radius: 4px;
                font-family: monospace;
                font-size: 0.85em;
                white-space: nowrap;
            }

            /* KaTeX */
            .latex-render {
                font-size: 1em;
                margin: 0 5px;
                display: inline-block;
            }
            .katex-display {
                margin: 1em 0;
                padding: 0.5em 0;
                overflow-x: auto;
            }

            /* Custom Graph */
            .custom-graph-placeholder {
                width: 100%;
                height: 300px;
                margin: 15px 0;
                border: 1px solid var(--ai-border-color);
                border-radius: 8px;
                background-color: #1c1c1c;
                position: relative;
            }
            .custom-graph-placeholder canvas {
                width: 100%;
                height: 100%;
                display: block;
            }

            /* Sources */
            .ai-sources {
                margin-top: 15px;
                padding-top: 10px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
            }
            .ai-sources h4 {
                font-family: 'Merriweather', serif;
                font-size: 0.9em;
                margin: 0 0 5px 0;
                color: var(--ai-brand-color);
            }
            .ai-sources ul {
                list-style: none;
                padding: 0;
                margin: 0;
            }
            .ai-sources li {
                font-size: 0.8em;
                margin-bottom: 2px;
                color: #aaa;
            }
            .ai-sources a {
                color: #aaa;
                text-decoration: underline;
                transition: color 0.2s;
            }
            .ai-sources a:hover {
                color: #fff;
            }

            /* Thought Process / Monologue */
            .ai-thought-process {
                margin-top: 15px;
                padding: 10px;
                border-radius: 6px;
                background-color: #333;
                border: 1px solid #555;
                font-size: 0.85em;
                transition: max-height 0.3s ease-out, padding 0.3s ease-out;
                overflow: hidden;
            }
            .ai-thought-process.collapsed {
                max-height: 40px;
            }
            .ai-thought-process:not(.collapsed) {
                max-height: 500px;
            }
            .monologue-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: pointer;
                color: #fff;
            }
            .monologue-title {
                font-family: 'Merriweather', serif;
                font-size: 0.9em;
                margin: 0;
                color: var(--ai-yellow);
            }
            .monologue-toggle-btn {
                background: none;
                border: none;
                color: #ccc;
                font-size: 0.8em;
                cursor: pointer;
                transition: color 0.2s;
            }
            .monologue-content {
                white-space: pre-wrap;
                word-wrap: break-word;
                margin-top: 10px;
                padding-top: 10px;
                border-top: 1px dashed rgba(255, 255, 255, 0.1);
                color: #ccc;
                font-family: monospace;
                font-size: 0.9em;
            }
            .ai-thought-process.collapsed .monologue-content {
                display: none;
            }


            /* Compose Area */
            #ai-compose-area {
                padding: 10px 20px;
                background-color: var(--ai-input-bg);
                border-top: 1px solid var(--ai-border-color);
                position: relative;
            }
            #ai-input-wrapper {
                display: flex;
                align-items: flex-end;
                border: 1px solid var(--ai-border-color);
                border-radius: 8px;
                padding: 8px;
                transition: box-shadow 0.2s;
            }
            #ai-input-wrapper.waiting {
                pointer-events: none;
                opacity: 0.6;
            }

            #ai-input {
                flex-grow: 1;
                max-height: ${MAX_INPUT_HEIGHT}px;
                overflow-y: auto;
                padding: 5px 10px;
                resize: none;
                border: none;
                outline: none;
                background: transparent;
                color: var(--ai-text-color);
                font-size: 1em;
                line-height: 1.4;
                min-height: 20px;
            }

            #ai-attachment-button, #ai-settings-button {
                background: none;
                border: none;
                color: #aaa;
                cursor: pointer;
                padding: 5px;
                transition: color 0.2s;
                font-size: 1.1em;
                margin-left: 5px;
                line-height: 1;
            }
            #ai-attachment-button:hover, #ai-settings-button:hover, #ai-settings-button.active {
                color: var(--ai-brand-color);
            }

            #ai-char-counter {
                text-align: right;
                font-size: 0.75em;
                color: #aaa;
                margin-top: 4px;
            }
            #ai-char-counter.over-limit {
                color: var(--ai-red);
                font-weight: bold;
            }

            /* Attachment Preview */
            #ai-attachment-preview {
                display: flex;
                flex-wrap: wrap;
                gap: 5px;
                padding-top: 5px;
                padding-bottom: 5px;
                border-bottom: 1px solid var(--ai-border-color);
                margin-bottom: 8px;
                max-height: 80px;
                overflow-y: auto;
            }
            #ai-input-wrapper:not(.has-attachments) #ai-attachment-preview {
                display: none !important;
            }

            .attachment-card {
                position: relative;
                width: 50px;
                height: 50px;
                background-color: #555;
                border-radius: 4px;
                overflow: hidden;
                cursor: pointer;
                border: 1px solid #777;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: opacity 0.2s;
                flex-shrink: 0;
            }
            .attachment-card.loading {
                opacity: 0.6;
            }
            .attachment-card img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            .attachment-card .file-icon {
                font-size: 2em;
            }
            .attachment-card .file-ext {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                background-color: rgba(0, 0, 0, 0.7);
                color: white;
                font-size: 0.6em;
                text-align: center;
                padding: 1px 0;
            }

            .attachment-card .remove-attachment {
                position: absolute;
                top: -5px;
                right: -5px;
                background: var(--ai-red);
                color: white;
                border: none;
                border-radius: 50%;
                width: 18px;
                height: 18px;
                line-height: 1;
                font-size: 0.8em;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 5;
            }

            .sent-attachments {
                font-size: 0.75em;
                color: #aaa;
                margin-top: 5px;
                font-style: italic;
            }

            /* Loader */
            .ai-loader {
                width: 12px;
                height: 12px;
                border: 2px solid var(--ai-brand-color);
                border-top-color: transparent;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
                margin-left: 10px;
                display: inline-block;
            }
            .gemini-response.loading .ai-response-content {
                display: inline-block;
            }


            /* --- Settings Menu Styling --- */
            #ai-settings-menu {
                position: absolute;
                bottom: 100%;
                right: 0;
                width: 100%;
                background-color: var(--ai-input-bg);
                border-radius: 8px 8px 0 0;
                box-shadow: 0 -4px 15px rgba(0, 0, 0, 0.3);
                padding: 15px 20px 10px;
                transform: translateY(100%);
                opacity: 0;
                pointer-events: none;
                transition: transform 0.3s ease-out, opacity 0.3s ease-out;
                z-index: 10;
                max-height: 300px;
                overflow-y: auto;
            }
            #ai-settings-menu.active {
                transform: translateY(0);
                opacity: 1;
                pointer-events: all;
            }
            .menu-header {
                font-family: 'Merriweather', serif;
                font-size: 1.1em;
                font-weight: 700;
                color: #fff;
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 1px solid var(--ai-border-color);
            }
            .setting-group {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 10px;
                padding: 8px 0;
            }
            .setting-label {
                flex-grow: 1;
            }
            .setting-label label {
                font-size: 0.95em;
                font-weight: 700;
                color: #fff;
            }
            .setting-note {
                font-size: 0.75em;
                color: #aaa;
                margin-top: 3px;
            }

            /* Toggle Switch */
            .ai-toggle-switch {
                position: relative;
                display: inline-block;
                width: 40px;
                height: 20px;
                margin-left: 15px;
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
                background-color: #777;
                transition: 0.4s;
                border-radius: 20px;
            }
            .ai-slider:before {
                position: absolute;
                content: "";
                height: 14px;
                width: 14px;
                left: 3px;
                bottom: 3px;
                background-color: white;
                transition: 0.4s;
                border-radius: 50%;
            }
            input:checked + .ai-slider {
                background-color: var(--ai-brand-color);
            }
            input:checked + .ai-slider:before {
                transform: translateX(20px);
            }


            /* --- NEW: Settings Menu Tabs --- */
            .tab-header {
                display: flex;
                justify-content: flex-start;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                margin: 0 -20px 15px -20px;
                padding: 0 20px;
                background-color: #333;
                position: sticky;
                top: -15px;
                z-index: 10;
            }
            .tab-button {
                background: none;
                border: none;
                color: #999;
                padding: 10px 15px;
                cursor: pointer;
                font-size: 14px;
                transition: color 0.2s, border-bottom 0.2s;
                border-bottom: 2px solid transparent;
                font-family: 'Merriweather', serif;
            }
            .tab-button.active {
                color: var(--ai-brand-color);
                border-bottom: 2px solid var(--ai-brand-color);
                font-weight: bold;
            }
            .tab-content {
                display: none;
                padding-top: 5px;
            }
            .tab-content.active {
                display: block;
            }

            /* --- NEW: Connector Group Styling --- */
            .connector-group {
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                padding: 10px 0;
            }
            .connector-info label {
                display: block;
                font-weight: bold;
                color: #fff;
                font-size: 14px;
            }
            .connector-description {
                font-style: italic;
                font-size: 11px;
                color: #aaa;
                margin-top: 3px;
            }
            .connect-btn {
                padding: 5px 10px;
                border-radius: 5px;
                font-size: 12px;
                font-weight: bold;
                border: none;
                cursor: pointer;
            }
            .connect-btn.disconnected {
                background-color: var(--ai-red);
                color: white;
            }
            .connect-btn.connected {
                background-color: var(--ai-green);
                color: white;
            }
            .connector-note {
                margin-top: 10px;
                padding-top: 10px;
                border-top: 1px dashed rgba(255, 255, 255, 0.1);
            }
            .connector-note p {
                font-size: 0.75em;
                color: #999;
            }


            /* --- NEW: Food Gallery CSS --- */
            .ai-food-gallery-container {
                display: flex;
                overflow-x: auto;
                padding: 10px 0;
                margin: 10px -20px 0 -20px;
                scroll-snap-type: x mandatory;
                max-width: 100%;
                -webkit-overflow-scrolling: touch;
            }
            .ai-food-gallery-container::-webkit-scrollbar {
                height: 6px;
                background-color: #333;
            }
            .ai-food-gallery-container::-webkit-scrollbar-thumb {
                background-color: #555;
                border-radius: 3px;
            }

            .gallery-item-wrapper {
                display: flex;
                flex-direction: column;
                align-items: flex-start;
                flex: 0 0 250px;
                margin-right: 15px;
                scroll-snap-align: start;
            }

            .gallery-item {
                width: 100%;
                height: 150px;
                border-radius: 8px;
                overflow: hidden;
                position: relative;
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
                flex-shrink: 0;
            }

            .gallery-item img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
            }

            .item-label-overlay {
                position: absolute;
                bottom: 0;
                left: 0;
                background: linear-gradient(to top, rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0));
                color: white;
                width: 100%;
                padding: 10px;
                box-sizing: border-box;
                font-size: 14px;
                font-weight: bold;
            }
            .item-description-under {
                width: 100%;
                font-size: 11px;
                color: #ccc;
                text-align: left;
                padding: 5px 0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            /* Nudge CSS (from original file) */
            #ai-web-search-nudge {
                position: fixed;
                bottom: 80px;
                left: 50%;
                transform: translateX(-50%);
                background-color: var(--ai-yellow);
                color: #212121;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
                z-index: 10001;
                max-width: 90%;
                animation: nudge-fade-in 0.5s forwards;
            }
            #ai-web-search-nudge p {
                margin: 0 0 10px 0;
                font-weight: bold;
                font-size: 0.9em;
            }
            .nudge-buttons button {
                padding: 8px 12px;
                border: none;
                border-radius: 5px;
                margin-right: 10px;
                cursor: pointer;
                font-weight: bold;
                transition: background-color 0.2s;
            }
            #nudge-dismiss {
                background-color: #ccc;
                color: #212121;
            }
            #nudge-open-settings {
                background-color: var(--ai-brand-color);
                color: white;
            }

            /* Animations (from original file) */
            @keyframes slide-in-text {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes nudge-fade-in {
                from { opacity: 0; transform: translateX(-50%) translateY(20px); }
                to { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
            @keyframes glow { 0%,100% { box-shadow: 0 0 5px rgba(255,255,255,.15), 0 0 10px rgba(255,255,255,.1); } 50% { box-shadow: 0 0 10px rgba(255,255,255,.25), 0 0 20px rgba(255,255,255,.2); } }
            @keyframes gemini-glow { 0%,100% { box-shadow: 0 0 8px 2px var(--ai-blue); } 25% { box-shadow: 0 0 8px 2px var(--ai-green); } 50% { box-shadow: 0 0 8px 2px var(--ai-yellow); } 75% { box-shadow: 0 0 8px 2px var(--ai-red); } }
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes message-pop-in { 0% { opacity: 0; transform: translateY(10px) scale(.98); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        `;
        document.head.appendChild(style);
    }

    function onDOMContentLoaded() {
        document.addEventListener('keydown', handleKeyDown);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onDOMContentLoaded);
    } else {
        onDOMContentLoaded();
    }


})();
