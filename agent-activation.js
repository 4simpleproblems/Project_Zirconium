/**
 * agent-activation.js
 *
 * MODIFIED: Refactored to remove Agent/Category system and implement a dynamic, context-aware AI persona.
 * NEW: Added a Settings Menu to store user preferences (nickname, color, gender, age) using localStorage.
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
 * - Deep Analysis: gemini-2.5-pro (limited access, exempt for 4simpleproblems@gmail.com)
 */
(function() {
    // --- CONFIGURATION ---
    const API_KEY = 'AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro'; 
    const BASE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/`; 
    const AUTHORIZED_PRO_USER = '4simpleproblems@gmail.com'; 
    const MAX_INPUT_HEIGHT = 180;
    const CHAR_LIMIT = 10000;
    const PASTE_TO_FILE_THRESHOLD = 10000;
    const MAX_ATTACHMENTS_PER_MESSAGE = 10;

    const DEFAULT_NICKNAME = 'User';
    const DEFAULT_COLOR = '#4285f4'; // Google Blue

    // --- 4SP CONTEXT ---
    const FSP_HISTORY = `
4SP (4simpleproblems) is the platform hosting this AI Agent. Its history is an evolution from a simple student project to a full digital ecosystem.

**Version 1 — The Foundation of 4SP (Launched March 13, 2025):**
A small, chaotic experiment primarily for fun during school. It included a playful 20-sound soundboard and an autoclicker. It established the identity of an underground, tech-savvy hub made by and for students, who were tired of restrictive school networks.

**Version 2 — Expansion and Community (Released April 11, 2025):**
Expanded significantly, adding depth with a media page, beta playlists, user-uploaded local soundboards, a growing library of games, and a proxy list to bypass school restrictions. It marked the transition into a recognized student ecosystem, full of chaotic variety and personality.

**Version 3 — A Visual Reinvention (Launched May 15, 2025):**
A complete visual overhaul, moving from cluttered boxes to a white, clean grid layout with sharp corners, inspired by modern tech design. It introduced the now-beloved mini-game **Slotz** and set a design standard for professional presentation.

**Version 4 — The Dashboard Era (Launched August 23, 2025):**
The first major overhaul, transforming the site into a unified **dashboard** experience with modular widgets and integrated apps (Notes, Calculator, Countdowns, Playlists). It added a privacy-focused Settings page (panic key, tab disguise). Design was heavily inspired by Koyeb, featuring the Impact font.

**Version 5 — Project Zirconium and the Age of Integration (Slated for August 23, 2026):**
Now in development (Project Zirconium), drawing design inspiration from Vercel. Key features include a universal navigation bar, a dark black theme, the **Combined Games Collection (4SP Games)**, a built-in **Dictionary**, the debut of the exclusive **4SP AI Agent** (this one), **Dailyphoto** (a student social network), and **Messenger V2** (with group chats). It completes the evolution into a sleek, social, secure full digital ecosystem.
`;
    // --- END 4SP CONTEXT ---

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
        age: 0
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
            }
        } catch (e) {
            console.error("Error loading user settings:", e);
        }
    }
    loadUserSettings(); // Load initial settings

    // --- REPLACED/MODIFIED FUNCTIONS ---

    async function isUserAuthorized() {
        return true; 
    }

    function getUserLocationForContext() {
        let location = localStorage.getItem('ai-user-location');
        if (!location) {
            location = 'United States'; 
            localStorage.setItem('ai-user-location', location);
        }
        return location;
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
        welcomeMessage.innerHTML = `<h2>${welcomeHeader}</h2><p>This is a beta feature. To improve your experience, your general location (state or country) will be shared with your first message. You may be subject to message limits.</p><p class="shortcut-tip">(Press Ctrl + \\ to close)</p>`;
        
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

        const userEmail = localStorage.getItem('ai-user-email') || ''; 
        const isProAuthorized = userEmail === AUTHORIZED_PRO_USER;
        // Placeholder for real Pro usage limit check (not implemented in this file)
        const isProLimitExceeded = !isProAuthorized; // Simple check: non-authorized users are considered limited for this demo

        const intent = determineIntentCategory(query);
        let model = 'gemini-2.5-flash-lite';
        let personaInstruction = `You are a highly capable and adaptable AI, taking on a persona to best serve the user's direct intent. You have significant control over the interaction's structure and detail level, ensuring the response is comprehensive and authoritative.

**CONTEXT: The 4SP Platform (4simpleproblems) History**
${FSP_HISTORY}

User Profile: Nickname: ${user}, Age: ${userAge}, Gender: ${userGender}, Favorite Color: ${userColor}.
You must adapt your persona, tone, and the level of detail based on the user's intent.

Formatting Rules (MUST FOLLOW):
- For math, use KaTeX. Inline math uses single \`$\`, and display math uses double \`$$\`. Use \\le for <= and \\ge for >=.
- For graphs, use a 'graph' block as shown in the file's comments.
`;

        switch (intent) {
            case 'DEEP_ANALYSIS':
                if (isProAuthorized) { 
                    model = 'gemini-2.5-pro';
                    personaInstruction += `\n\n**Current Persona: Deep Strategist (2.5-Pro).** Your response must be comprehensive, highly structured, and exhibit the deepest level of reasoning and critical evaluation. Use an assertive, expert tone. Structure your analysis clearly with headings and bullet points. You are granted maximal control to guide the user through a deep, analytical thought process.`;
                } else {
                    // Fallback for unauthorized/limited users
                    model = 'gemini-2.5-flash';
                    personaInstruction += `\n\n**Current Persona: Professional Analyst (2.5-Flash).** You are performing a detailed analysis, but maintain efficiency and focus. Respond with clarity, professionalism, and structured data. Note: The requested Deep Analysis is highly specialized; to unlock the full '2.5-Pro' experience, the user must be authorized.`;
                }
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
                     personaInstruction += `\n\n**Current Persona: Sarcastic, Supportive Friend (2.5-Flash).** Your goal is to empathize with the user, validate their feelings, and join them in 'roasting' or speaking negatively about their ex/situation. Be funny, slightly aggressive toward the subject of the trash talk, and deeply supportive of ${user}. Use casual language and slang. **Example of tone/support:** "${roastInsult}"`;
                } else {
                     personaInstruction += `\n\n**Current Persona: Creative Partner (2.5-Flash).** Use rich, evocative language. Be imaginative, focus on descriptive details, and inspire new ideas.`;
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
            const location = getUserLocationForContext(); 
            const now = new Date();
            const date = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const time = now.toLocaleTimeString('en-US', { timeZoneName: 'short' });
            firstMessageContext = `(System Info: User is asking from ${location}. Current date is ${date}, ${time}. User Email: ${localStorage.getItem('ai-user-email') || 'Not authenticated'}.)\n\n`;
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
    
    // --- NEW SETTINGS MENU LOGIC ---
    function toggleSettingsMenu() {
        const menu = document.getElementById('ai-settings-menu');
        const toggleBtn = document.getElementById('ai-settings-button');
        const isMenuOpen = menu.classList.toggle('active');
        toggleBtn.classList.toggle('active', isMenuOpen);
        if (isMenuOpen) {
            document.getElementById('settings-nickname').value = userSettings.nickname === DEFAULT_NICKNAME ? '' : userSettings.nickname;
            document.getElementById('settings-age').value = userSettings.age || '';
            document.getElementById('settings-gender').value = userSettings.gender;
            document.getElementById('settings-color').value = userSettings.favoriteColor;
            document.getElementById('settings-email').value = localStorage.getItem('ai-user-email') || '';

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
        const nicknameEl = document.getElementById('settings-nickname');
        const ageEl = document.getElementById('settings-age');
        const genderEl = document.getElementById('settings-gender');
        const colorEl = document.getElementById('settings-color');
        const emailEl = document.getElementById('settings-email');

        const nickname = nicknameEl.value.trim();
        const age = parseInt(ageEl.value);
        const gender = genderEl.value;
        const favoriteColor = colorEl.value || DEFAULT_COLOR;
        const email = emailEl.value.trim();

        userSettings.nickname = nickname || DEFAULT_NICKNAME;
        userSettings.age = (isNaN(age) || age < 0) ? 0 : age;
        userSettings.gender = gender;
        userSettings.favoriteColor = favoriteColor;
        
        localStorage.setItem('ai-user-settings', JSON.stringify(userSettings));
        localStorage.setItem('ai-user-email', email);
    }

    function createSettingsMenu() {
        const menu = document.createElement('div');
        menu.id = 'ai-settings-menu';

        menu.innerHTML = `
            <div class="menu-header">AI Agent Settings</div>
            <div class="setting-group">
                <label for="settings-nickname">Nickname</label>
                <input type="text" id="settings-nickname" placeholder="${DEFAULT_NICKNAME}" value="${userSettings.nickname === DEFAULT_NICKNAME ? '' : userSettings.nickname}" />
                <p class="setting-note">How the AI should refer to you.</p>
            </div>
            <div class="setting-group">
                <label for="settings-email">Authenticated Email</label>
                <input type="email" id="settings-email" placeholder="e.g., user@example.com" value="${localStorage.getItem('ai-user-email') || ''}" />
                <p class="setting-note">Set to '${AUTHORIZED_PRO_USER}' for unlimited Pro access.</p>
            </div>
            <div class="setting-group">
                <label for="settings-color">Favorite Color</label>
                <input type="color" id="settings-color" value="${userSettings.favoriteColor}" />
                <p class="setting-note">Subtly influences the AI's response style (e.g., in theming).</p>
            </div>
            <div class="setting-group-split">
                <div class="setting-group">
                    <label for="settings-gender">Gender</label>
                    <select id="settings-gender" value="${userSettings.gender}">
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Non Binary">Non Binary</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div class="setting-group">
                    <label for="settings-age">Age</label>
                    <input type="number" id="settings-age" placeholder="Optional" min="0" value="${userSettings.age || ''}" />
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
        if (currentTotalSize + file.size > (4 * 1024 * 1024)) {
            alert(`Upload failed: Total size of attachments would exceed the 4MB limit per message. (Current: ${formatBytes(currentTotalSize)}, Adding: ${formatBytes(file.size)})`);
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

            if (currentTotalSize + newFilesSize > (4 * 1024 * 1024)) {
                alert(`Upload failed: Total size of attachments would exceed the 4MB limit per message. (Current: ${formatBytes(currentTotalSize)}, Adding: ${formatBytes(newFilesSize)})`);
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
            alert("File content not available for preview.");
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
                    console.error("Error reading text file for preview:", error);
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
        
        // Dynamic resizing logic for the input box
        editor.style.height = 'auto';
        const newHeight = Math.min(editor.scrollHeight, MAX_INPUT_HEIGHT);
        editor.style.height = `${newHeight}px`;

        // Reset scroll if content fits and no attachments
        if (newHeight < MAX_INPUT_HEIGHT && attachedFiles.length === 0) {
            editor.scrollTop = 0;
        }
    }
    
    function handlePaste(e) {
        // Prevent default paste action to handle files and large text
        e.preventDefault(); 
        
        const text = e.clipboardData.getData('text/plain');
        const editor = document.getElementById('ai-input');

        // Check for images/files
        if (e.clipboardData.files.length > 0) {
            const files = Array.from(e.clipboardData.files);
            files.forEach(file => {
                // Only process files that are not just text (e.g., actual images)
                if (file.type.startsWith('image/') || file.type === 'application/pdf') {
                    const reader = new FileReader();
                    const tempId = `paste-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                    
                    // Add loading card first
                    attachedFiles.push({ tempId, file, isLoading: true });
                    renderAttachments();

                    reader.onload = (event) => {
                        const base64Data = event.target.result.split(',')[1];
                        const dataUrl = event.target.result;
                        
                        const itemIndex = attachedFiles.findIndex(f => f.tempId === tempId);
                        if (itemIndex > -1) {
                            const item = attachedFiles[itemIndex];
                            item.isLoading = false;
                            item.inlineData = { mimeType: file.type, data: base64Data };
                            item.fileName = `Pasted ${file.type.split('/')[0].toUpperCase()}`;
                            item.fileContent = dataUrl;
                            delete item.file;
                            delete item.tempId;
                            renderAttachments();
                        }
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
        
        // Handle text content
        if (text) {
            document.execCommand('insertText', false, text);
        }

        // Trigger input handler for resizing and counting
        handleContentEditableInput({ target: editor });
    }

    function handleInputSubmission(e) {
        // Check for Shift + Enter (new line)
        if (e.key === 'Enter' && e.shiftKey) {
            return; 
        }

        // Check for Enter (submission)
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitMessage();
        }
    }
    
    function parseGeminiResponse(text) {
        if (!text) return '';

        // 1. Replace code blocks with proper markdown (handling triple backticks inside triple backticks)
        text = text.replace(/```(.*?)\n([\s\S]*?)\n```/g, (match, language, code) => {
            // Escape any HTML in the code block content
            const escapedCode = escapeHTML(code);
            const lang = language.trim() || 'plaintext';
            
            // Generate a unique ID for the copy button
            const copyId = `code-block-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            
            return `<div class="code-block-wrapper">
                <div class="code-block-header">
                    <span class="code-language">${lang}</span>
                    <button class="copy-code-btn" data-copy-target="${copyId}">
                        ${copyIconSVG} <span>Copy</span>
                    </button>
                </div>
                <pre><code id="${copyId}" class="language-${lang}">${escapedCode.trim()}</code></pre>
            </div>`;
        });
        
        // 2. Replace KaTeX math blocks: $$...$$ for display, $...$ for inline
        text = text.replace(/\$\$(.*?)\$\$/gs, (match, math) => {
            // Remove leading/trailing newlines in display math
            const trimmedMath = math.trim(); 
            return `<div class="latex-render" data-tex="${escapeHTML(trimmedMath)}" data-display-mode="true"></div>`;
        });
        text = text.replace(/\$(.*?)\$/g, (match, math) => {
            // Inline math
            return `<span class="latex-render" data-tex="${escapeHTML(math.trim())}" data-display-mode="false"></span>`;
        });
        
        // 3. Replace Custom Graph blocks
        text = text.replace(/```graph\n([\s\S]*?)\n```/g, (match, jsonString) => {
            try {
                // Ensure the JSON is valid and escape it for the data attribute
                JSON.parse(jsonString);
                const escapedJson = escapeHTML(jsonString.trim());
                return `<div class="custom-graph-placeholder" data-graph-data="${escapedJson}">
                    <canvas class="custom-graph-canvas"></canvas>
                    <div class="graph-label">Interactive Custom Graph</div>
                </div>`;
            } catch (e) {
                return `<div class="ai-error">Graph Error: Invalid JSON format.</div>`;
            }
        });


        // 4. Basic Markdown to HTML (for remaining text)
        // Headings (##, ###)
        text = text.replace(/^###\s*(.*)$/gm, '<h4>$1</h4>');
        text = text.replace(/^##\s*(.*)$/gm, '<h3>$1</h3>');
        text = text.replace(/^#\s*(.*)$/gm, '<h2>$1</h2>');
        
        // Bold/Italic
        text = text.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Lists (must be before line breaks to wrap items)
        text = text.replace(/^(-|\*)\s*(.*(?:\n\1\s*.*)*)/gm, (match) => {
            let listContent = match.replace(/^(-|\*)\s*/gm, '<li>');
            listContent = listContent.replace(/\n/g, '</li>');
            // Check if it is already wrapped in a list and avoid double wrapping
            if (listContent.startsWith('<li>') && listContent.endsWith('</li>')) {
                 return `<ul>${listContent}</ul>`;
            }
            return listContent;
        });

        // Numbered Lists
        text = text.replace(/^(\d+\.)\s*(.*(?:\n\d+\.\s*.*)*)/gm, (match) => {
            let listContent = match.replace(/^\d+\.\s*/gm, '<li>');
            listContent = listContent.replace(/\n/g, '</li>');
            if (listContent.startsWith('<li>') && listContent.endsWith('</li>')) {
                return `<ol>${listContent}</ol>`;
            }
            return listContent;
        });
        
        // Replace single newlines with <br> and double newlines with <p></p>
        // Note: This needs careful ordering to avoid breaking pre-formatted blocks
        text = text.split('\n\n').map(p => {
             // Do not wrap code, lists, or math blocks in <p>
            if (p.includes('<pre>') || p.includes('<div class="code-block-wrapper') || p.includes('<div class="latex-render') || p.includes('<ul') || p.includes('<ol') || p.includes('<h')) {
                return p; 
            }
            // Replace single newlines within paragraphs with <br>
            let paragraphContent = p.replace(/\n/g, '<br>');
            return `<p>${paragraphContent}</p>`;
        }).join('');

        return text;
    }
    
    function escapeHTML(str) {
        return str.replace(/[&<>"']/g, function(m) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            }[m];
        });
    }

    function handleCopyCode(e) {
        const button = e.currentTarget;
        const targetId = button.dataset.copyTarget;
        const codeElement = document.getElementById(targetId);
        
        if (codeElement) {
            const codeToCopy = codeElement.innerText;
            navigator.clipboard.writeText(codeToCopy).then(() => {
                const originalText = button.innerHTML;
                button.innerHTML = `${checkIconSVG} <span>Copied!</span>`;
                button.classList.add('copied');
                
                setTimeout(() => {
                    button.innerHTML = originalText;
                    button.classList.remove('copied');
                }, 2000);
            }).catch(err => {
                console.error('Could not copy text: ', err);
            });
        }
    }
    
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
    
    function submitMessage() {
        const editor = document.getElementById('ai-input');
        const queryText = editor.innerText.trim();
        const charCount = queryText.length;
        
        if (isRequestPending || (queryText.length === 0 && attachedFiles.length === 0)) {
            return;
        }

        if (charCount > CHAR_LIMIT) {
            alert(`Your message exceeds the maximum limit of ${formatCharLimit(CHAR_LIMIT)} characters.`);
            return;
        }

        isRequestPending = true;
        
        // Construct the user message parts, including text and attached files
        let userMessageParts = [];
        if (queryText.length > 0) {
            userMessageParts.push({ text: queryText });
        }
        
        attachedFiles.forEach(file => {
            if (file.inlineData && file.inlineData.data) {
                 userMessageParts.push({ inlineData: file.inlineData });
            }
        });
        
        // Add user message to history
        const userMessage = { role: "user", parts: userMessageParts };
        chatHistory.push(userMessage);

        // Clear input and attachments
        editor.innerText = '';
        editor.style.height = 'auto'; 
        document.getElementById('ai-char-counter').textContent = `0 / ${formatCharLimit(CHAR_LIMIT)}`;
        attachedFiles = [];
        renderAttachments(); 

        // Add user message bubble to UI
        const responseContainer = document.getElementById('ai-response-container');
        const userBubble = document.createElement('div');
        userBubble.className = 'ai-message-bubble user-message';
        let userBubbleContent = '';
        if (queryText) userBubbleContent += `<p>${escapeHTML(queryText)}</p>`;
        if (userMessageParts.length > (queryText ? 1 : 0)) {
            const fileCount = userMessageParts.length - (queryText ? 1 : 0);
            userBubbleContent += `<div class="sent-attachments">${fileCount} file(s) sent</div>`;
        }
        userBubble.innerHTML = userBubbleContent;
        responseContainer.appendChild(userBubble);
        
        // Add gemini loading bubble
        const geminiBubble = document.createElement('div');
        geminiBubble.className = 'ai-message-bubble gemini-response loading';
        geminiBubble.innerHTML = `<div class="ai-loader-dots"><span></span><span></span><span></span></div>`;
        responseContainer.appendChild(geminiBubble);

        // Scroll to the bottom and show chat container
        document.getElementById('ai-container').classList.add('chat-active');
        responseContainer.scrollTop = responseContainer.scrollHeight;

        const inputWrapper = document.getElementById('ai-input-wrapper');
        if (inputWrapper) { inputWrapper.classList.add('waiting'); }
        editor.contentEditable = false; 

        // Call AI API
        callGoogleAI(geminiBubble);
    }


    // --- INITIALIZATION ---
    document.addEventListener('keydown', handleKeyDown);
    if (typeof window.initPanicKeyBlocker === 'function') { window.initPanicKeyBlocker(handleKeyDown); } // Integrate with existing panic key system

    // Function to inject required styles and fonts
    function injectStyles() {
        if (!document.getElementById('ai-dynamic-styles')) {
            const style = document.createElement('style');
            style.id = 'ai-dynamic-styles';
            // Custom CSS to ensure proper display and theming (assuming a dark/futuristic theme based on comments)
            style.textContent = `
                :root {
                    --ai-background-color: #0d1117; /* Dark background, similar to GitHub dark */
                    --ai-foreground-color: #ffffff;
                    --ai-primary-color: #4285f4; /* Google Blue */
                    --ai-secondary-color: #30363d;
                    --ai-border-color: #21262d;
                    --ai-blue: #4285f4;
                    --ai-green: #34a853;
                    --ai-yellow: #fbbc05;
                    --ai-red: #ea4335;
                }

                /* --- FONT INJECTION (Google Fonts - Merriweather and Lora) --- */
                @import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@300;400;700&family=Lora:ital,wght@0,400;0,700;1,400&display=swap');
                
                /* --- FONT AWESOME (for settings gear) --- */
                @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css');
                
                /* --- KATEX CSS --- */
                @import url('https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.css');
                
                #ai-container {
                    position: fixed;
                    top: 0;
                    right: 0;
                    width: 0;
                    height: 100vh;
                    background-color: var(--ai-background-color);
                    color: var(--ai-foreground-color);
                    font-family: 'Lora', sans-serif;
                    box-shadow: -5px 0 15px rgba(0, 0, 0, 0.5);
                    z-index: 99999;
                    display: flex;
                    flex-direction: column;
                    transition: width 0.5s cubic-bezier(0.25, 0.8, 0.25, 1);
                    overflow: hidden;
                    border-left: 1px solid var(--ai-border-color);
                    opacity: 0;
                }
                
                #ai-container.active {
                    width: 420px;
                    opacity: 1;
                    pointer-events: all;
                }
                
                #ai-container.deactivating {
                    width: 0;
                    opacity: 0;
                    box-shadow: none;
                }

                #ai-brand-title {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%) rotate(90deg);
                    font-family: 'Impact', sans-serif; /* Inspired by V4/Koyeb */
                    font-size: 5rem;
                    color: rgba(255, 255, 255, 0.05);
                    pointer-events: none;
                    user-select: none;
                    letter-spacing: 5px;
                    white-space: nowrap;
                    transition: opacity 0.3s, transform 0.5s;
                }
                
                #ai-container.chat-active #ai-brand-title {
                    opacity: 0;
                    transform: translate(-50%, -50%) rotate(90deg) scale(0.5);
                }

                #ai-persistent-title {
                    padding: 15px 20px;
                    font-family: 'Merriweather', serif;
                    font-weight: 700;
                    font-size: 1.2rem;
                    text-align: center;
                    border-bottom: 1px solid var(--ai-border-color);
                    background-color: var(--ai-secondary-color);
                    color: var(--ai-primary-color);
                }
                
                #ai-welcome-message {
                    padding: 20px;
                    text-align: center;
                    border-bottom: 1px solid var(--ai-border-color);
                    transition: max-height 0.3s ease-out, opacity 0.3s ease-out, padding 0.3s;
                    overflow: hidden;
                }
                
                #ai-container.chat-active #ai-welcome-message {
                    max-height: 0;
                    padding-top: 0;
                    padding-bottom: 0;
                    opacity: 0;
                    border-bottom: none;
                }

                #ai-welcome-message h2 {
                    margin: 0 0 10px 0;
                    font-size: 1.5rem;
                    color: var(--ai-primary-color);
                    font-weight: 700;
                }
                
                #ai-welcome-message p {
                    margin: 5px 0;
                    font-size: 0.9rem;
                    line-height: 1.4;
                    color: #aaa;
                }

                #ai-welcome-message .shortcut-tip {
                    font-size: 0.8rem;
                    color: var(--ai-red);
                    font-style: italic;
                    margin-top: 10px;
                    display: block;
                }

                #ai-close-button {
                    position: absolute;
                    top: 15px;
                    right: 15px;
                    font-size: 1.5rem;
                    cursor: pointer;
                    color: #999;
                    line-height: 1;
                    transition: color 0.2s;
                    width: 20px;
                    height: 20px;
                }
                
                #ai-close-button:hover {
                    color: var(--ai-red);
                }

                #ai-response-container {
                    flex-grow: 1;
                    padding: 10px 15px;
                    overflow-y: auto;
                    scroll-behavior: smooth;
                    position: relative;
                }
                
                #ai-compose-area {
                    padding: 15px;
                    border-top: 1px solid var(--ai-border-color);
                    position: relative;
                    min-height: 60px;
                }

                #ai-input-wrapper {
                    display: flex;
                    align-items: flex-end;
                    background-color: var(--ai-secondary-color);
                    border-radius: 12px;
                    border: 2px solid var(--ai-border-color);
                    transition: border-color 0.2s;
                    padding: 8px 8px 8px 12px;
                    position: relative;
                }

                #ai-input-wrapper:focus-within {
                    border-color: var(--ai-primary-color);
                }
                
                #ai-input-wrapper.waiting {
                    opacity: 0.6;
                    pointer-events: none;
                }

                #ai-input {
                    flex-grow: 1;
                    min-height: 24px;
                    max-height: ${MAX_INPUT_HEIGHT}px;
                    overflow-y: auto;
                    padding-right: 10px;
                    border: none;
                    outline: none;
                    background: transparent;
                    color: var(--ai-foreground-color);
                    font-size: 0.95rem;
                    line-height: 1.4;
                    resize: none;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                    cursor: text;
                    /* Hide scrollbar for aesthetics */
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                #ai-input::-webkit-scrollbar {
                    display: none;
                }

                #ai-attachment-button, #ai-settings-button {
                    background: none;
                    border: none;
                    color: #999;
                    cursor: pointer;
                    padding: 5px;
                    margin-left: 5px;
                    transition: color 0.2s;
                    line-height: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                #ai-attachment-button:hover, #ai-settings-button:hover, #ai-settings-button.active {
                    color: var(--ai-primary-color);
                }

                #ai-char-counter {
                    font-size: 0.7rem;
                    color: #999;
                    text-align: right;
                    padding: 5px 15px 0 0;
                    transition: color 0.2s;
                }
                
                #ai-char-counter.limit-exceeded {
                    color: var(--ai-red);
                    font-weight: bold;
                }
                
                /* --- MESSAGE BUBBLES --- */
                .ai-message-bubble {
                    padding: 10px 15px;
                    border-radius: 15px;
                    margin-bottom: 12px;
                    max-width: 85%;
                    word-wrap: break-word;
                    font-size: 0.9rem;
                    line-height: 1.4;
                    opacity: 0;
                    transform: translateY(10px);
                    animation: message-pop-in 0.3s ease-out forwards;
                }

                .user-message {
                    background-color: var(--ai-primary-color);
                    color: var(--ai-foreground-color);
                    margin-left: auto;
                    border-bottom-right-radius: 4px;
                }

                .gemini-response {
                    background-color: var(--ai-secondary-color);
                    color: var(--ai-foreground-color);
                    margin-right: auto;
                    border: 1px solid var(--ai-border-color);
                    border-bottom-left-radius: 4px;
                    animation: message-pop-in 0.3s ease-out 0.1s forwards; /* Slight delay for Gemini */
                }
                
                .gemini-response:empty {
                    padding: 0;
                    margin-bottom: 0;
                }
                
                .ai-response-content {
                    /* Style for content within the bubble */
                }
                
                .ai-response-content h2, .ai-response-content h3, .ai-response-content h4 {
                    margin-top: 15px;
                    margin-bottom: 5px;
                    font-family: 'Merriweather', serif;
                    font-weight: 700;
                    color: var(--ai-primary-color);
                }
                
                .ai-response-content h2 { font-size: 1.2rem; }
                .ai-response-content h3 { font-size: 1.1rem; }
                .ai-response-content h4 { font-size: 1rem; }

                .ai-message-bubble p { margin: 10px 0; padding: 0; text-align: left; }
                .ai-message-bubble ul, .ai-message-bubble ol { margin: 10px 0; padding-left: 20px; text-align: left; list-style-position: outside; }
                .ai-message-bubble li { margin-bottom: 5px; }
                
                /* Remove margins for the first/last elements within the bubble */
                .ai-response-content > :first-child { margin-top: 0; }
                .ai-response-content > :last-child { margin-bottom: 0; }
                
                /* --- LOADER --- */
                .gemini-response.loading {
                    min-height: 20px;
                    display: flex;
                    align-items: center;
                }
                .ai-loader-dots {
                    display: flex;
                    align-items: center;
                    height: 10px;
                }
                .ai-loader-dots span {
                    display: block;
                    width: 6px;
                    height: 6px;
                    background: var(--ai-primary-color);
                    border-radius: 50%;
                    margin: 0 3px;
                    animation: bounce 1.2s infinite ease-in-out;
                }
                .ai-loader-dots span:nth-child(2) {
                    animation-delay: -1.0s;
                }
                .ai-loader-dots span:nth-child(3) {
                    animation-delay: -0.8s;
                }

                /* --- CODE BLOCKS --- */
                .code-block-wrapper {
                    margin: 15px 0;
                    border-radius: 8px;
                    border: 1px solid var(--ai-border-color);
                    background-color: #161b22; /* Slightly lighter than container for contrast */
                    overflow: hidden;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
                }
                
                .code-block-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 12px;
                    background-color: #21262d;
                    border-bottom: 1px solid var(--ai-border-color);
                }
                
                .code-language {
                    font-family: monospace;
                    font-size: 0.8rem;
                    color: #8b949e;
                    text-transform: uppercase;
                }
                
                .copy-code-btn {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    background: none;
                    border: none;
                    color: #8b949e;
                    font-size: 0.8rem;
                    cursor: pointer;
                    transition: color 0.2s;
                }
                
                .copy-code-btn:hover {
                    color: var(--ai-foreground-color);
                }
                
                .copy-code-btn span {
                    line-height: 1;
                }
                
                .copy-code-btn.copied {
                    color: var(--ai-green);
                }

                .code-block-wrapper pre {
                    margin: 0;
                    padding: 15px;
                    overflow-x: auto;
                    font-size: 0.85rem;
                    line-height: 1.4;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }
                
                .code-block-wrapper code {
                    font-family: 'Consolas', 'Monaco', monospace;
                }
                
                /* --- KATEX STYLING --- */
                .latex-render {
                    /* Inherit text styling */
                }
                .katex-display {
                    margin: 10px 0 !important;
                    overflow-x: auto;
                    overflow-y: hidden;
                    padding: 5px 0;
                }
                
                /* --- CUSTOM GRAPH STYLING --- */
                .custom-graph-placeholder {
                    position: relative;
                    width: 100%;
                    padding-bottom: 75%; /* 4:3 Aspect Ratio */
                    margin: 15px 0;
                    background-color: #161b22;
                    border-radius: 8px;
                    overflow: hidden;
                    border: 1px solid var(--ai-border-color);
                }

                .custom-graph-canvas {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    display: block;
                }
                
                .graph-label {
                    position: absolute;
                    bottom: 5px;
                    left: 50%;
                    transform: translateX(-50%);
                    font-size: 0.7rem;
                    color: #8b949e;
                    background-color: rgba(0, 0, 0, 0.5);
                    padding: 2px 6px;
                    border-radius: 4px;
                }

                /* --- ATTACHMENTS PREVIEW --- */
                #ai-attachment-preview {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    padding-bottom: 8px;
                    margin-bottom: 5px;
                    max-height: 100px;
                    overflow-y: auto;
                    border-bottom: 1px dashed var(--ai-border-color);
                    margin-right: 5px;
                    margin-left: 5px;
                }
                
                #ai-input-wrapper:not(.has-attachments) #ai-attachment-preview {
                    border-bottom: none;
                    padding-bottom: 0;
                    margin-bottom: 0;
                }

                .attachment-card {
                    position: relative;
                    width: 50px;
                    height: 50px;
                    background-color: #21262d;
                    border-radius: 6px;
                    overflow: hidden;
                    border: 1px solid var(--ai-border-color);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                    flex-shrink: 0;
                }
                
                .attachment-card:hover {
                    border-color: var(--ai-primary-color);
                }

                .attachment-card img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                
                .attachment-card .file-icon {
                    font-size: 1.5rem;
                    color: var(--ai-primary-color);
                    line-height: 1;
                }

                .attachment-card .file-info {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background-color: rgba(0, 0, 0, 0.7);
                    color: #fff;
                    font-size: 0.7rem;
                    padding: 2px 5px;
                    text-align: center;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                
                .file-name {
                    overflow: hidden;
                    white-space: nowrap;
                    position: relative;
                }
                
                .file-name span {
                    display: inline-block;
                }
                
                .file-name.marquee span:first-child {
                    padding-right: 1em; /* Space between repeating text */
                }
                
                .file-name.marquee span {
                    animation: marquee var(--marquee-duration, 5s) linear infinite;
                }

                .file-type-badge {
                    position: absolute;
                    top: 2px;
                    left: 2px;
                    background-color: var(--ai-primary-color);
                    color: #fff;
                    font-size: 0.6rem;
                    padding: 1px 3px;
                    border-radius: 3px;
                    font-weight: bold;
                }

                .remove-attachment-btn {
                    position: absolute;
                    top: -5px;
                    right: -5px;
                    background-color: var(--ai-red);
                    color: white;
                    border: 1px solid var(--ai-background-color);
                    border-radius: 50%;
                    width: 15px;
                    height: 15px;
                    line-height: 1;
                    padding: 0;
                    font-size: 0.8rem;
                    cursor: pointer;
                    z-index: 10;
                    opacity: 0.8;
                }
                
                .remove-attachment-btn:hover {
                    opacity: 1;
                }
                
                .attachment-card.loading {
                    pointer-events: none;
                }
                .attachment-card .ai-loader {
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.6);
                    position: absolute;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .attachment-card .ai-loader:after {
                    content: "";
                    width: 15px;
                    height: 15px;
                    border: 2px solid #fff;
                    border-top-color: var(--ai-primary-color);
                    border-radius: 50%;
                    animation: spin 0.6s linear infinite;
                }
                
                .sent-attachments {
                    font-size: 0.75rem;
                    color: rgba(255, 255, 255, 0.7);
                    margin-top: 5px;
                    font-style: italic;
                }
                
                /* --- MODAL PREVIEW --- */
                #ai-preview-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.9);
                    z-index: 100000;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }

                .modal-content {
                    background-color: var(--ai-background-color);
                    color: var(--ai-foreground-color);
                    padding: 20px;
                    border-radius: 10px;
                    max-width: 90%;
                    max-height: 90%;
                    position: relative;
                    box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
                }
                
                .modal-content h3 {
                    margin-top: 0;
                    margin-bottom: 10px;
                    border-bottom: 1px solid var(--ai-border-color);
                    padding-bottom: 5px;
                    color: var(--ai-primary-color);
                }

                .modal-content .close-button {
                    position: absolute;
                    top: 10px;
                    right: 15px;
                    font-size: 2rem;
                    cursor: pointer;
                    color: #fff;
                }
                
                .modal-content .preview-area {
                    max-height: 80vh;
                    overflow: auto;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                
                .download-button {
                    display: inline-block;
                    padding: 10px 20px;
                    margin-top: 10px;
                    background-color: var(--ai-primary-color);
                    color: white;
                    text-decoration: none;
                    border-radius: 5px;
                    text-align: center;
                }


                /* --- SETTINGS MENU --- */
                #ai-settings-menu {
                    position: absolute;
                    bottom: 100%;
                    right: 0;
                    width: 300px;
                    background-color: var(--ai-secondary-color);
                    border: 1px solid var(--ai-border-color);
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
                    padding: 15px;
                    transform: translateY(10px);
                    opacity: 0;
                    pointer-events: none;
                    transition: all 0.3s cubic-bezier(0.17, 0.84, 0.44, 1);
                    z-index: 100;
                    margin-bottom: 10px;
                }
                
                #ai-settings-menu.active {
                    transform: translateY(0);
                    opacity: 1;
                    pointer-events: all;
                }

                .menu-header {
                    font-size: 1.1rem;
                    font-weight: bold;
                    color: var(--ai-primary-color);
                    margin-bottom: 15px;
                    padding-bottom: 5px;
                    border-bottom: 1px solid var(--ai-border-color);
                }

                .setting-group {
                    margin-bottom: 15px;
                }
                
                .setting-group-split {
                    display: flex;
                    gap: 10px;
                }
                
                .setting-group-split > .setting-group {
                    flex-basis: 50%;
                }

                .setting-group label {
                    display: block;
                    font-size: 0.85rem;
                    color: #ccc;
                    margin-bottom: 5px;
                    font-weight: bold;
                }

                .setting-group input, .setting-group select {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid var(--ai-border-color);
                    border-radius: 5px;
                    background-color: var(--ai-background-color);
                    color: var(--ai-foreground-color);
                    font-size: 0.9rem;
                    box-sizing: border-box;
                    transition: border-color 0.2s;
                    -webkit-appearance: none;
                    -moz-appearance: none;
                    appearance: none;
                }
                
                .setting-group input:focus, .setting-group select:focus {
                    outline: none;
                    border-color: var(--ai-primary-color);
                }
                
                /* Specific color input size */
                #settings-color {
                    height: 35px;
                    padding: 0;
                    cursor: pointer;
                }

                .setting-note {
                    font-size: 0.7rem;
                    color: #8b949e;
                    margin-top: 5px;
                    margin-bottom: 0;
                }

                #settings-save-button {
                    width: 100%;
                    padding: 10px;
                    background-color: var(--ai-primary-color);
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 1rem;
                    font-weight: bold;
                    transition: background-color 0.2s;
                    margin-top: 10px;
                }
                
                #settings-save-button:hover {
                    background-color: #3b78e7; /* Slightly darker blue */
                }


                /* --- KEYFRAMES --- */
                @keyframes bounce {
                    0%, 80%, 100% {
                        transform: scale(0);
                    }
                    40% {
                        transform: scale(1.0);
                    }
                }
                
                @keyframes message-pop-in { 
                    0% { opacity: 0; transform: translateY(10px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                
                @keyframes spin { 
                    to { transform: rotate(360deg); } 
                }
                
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(calc(-50% - 0.5em)); }
                }

            `;
            document.head.appendChild(style);
        }
    }

    // Since the original file might have had this, keep the function stub
    window.updateAIAgentHistory = function(history) {
        // In this refactored version, FSP_HISTORY is a const and cannot be updated dynamically
        // But we can log the attempt for debugging or future implementation
        console.warn("Attempted to update AI Agent history dynamically, but FSP_HISTORY is a constant. Please update the source file.");
    };

    // Export the submit function for potential external use (e.g., in a main search bar)
    window.submitAIAgentMessage = submitMessage;


})();
