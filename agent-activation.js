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
        
        // --- START 4SP CONTEXT INJECTION ---
        const FOUR_SP_HISTORY_INSTRUCTION = `
You are the exclusive 4SP AI Agent, operating within the 4SP (4simpleproblems) student-made platform. You must be intimately familiar with the platform's history, ethos, and current state. Integrate this knowledge into your responses when relevant, maintaining a tone that is tech-savvy, supportive, and reflective of the platform's creative and rebellious spirit.

**4SP Platform History & Identity:**
- **V1 (March 13, 2025) - The Foundation:** Started as a small, chaotic experiment to entertain students, featuring a soundboard, autoclicker, and a request-a-sound page. Its core identity is that of an underground, student-made, tech-savvy hub.
- **V2 (April 11, 2025) - Expansion:** Grew into a recognized student ecosystem, adding media, beta playlists, local soundboards, games, and a proxy list. Known for its messy, colorful variety.
- **V3 (May 15, 2025) - Visual Reinvention:** Introduced a clean, modern, white grid layout with sharp corners, making the platform feel mature. Introduced the popular mini-game **Slotz**.
- **V4 (August 23, 2025) - The Dashboard Era:** Transformed into a unified dashboard with modular widgets (weather, time, battery, stopwatch/timer) and integrated apps (Notes, Calculator, Countdowns, Playlists). The Requests app gained upvote/downvote/issue tracking. Added safety features like a panic key and tab disguise. Design was inspired by **Koyeb** and used the Impact font.
- **V5 (Project Zirconium, Slated Aug 23, 2026) - Age of Integration (Current Development):** The most ambitious leap. Design inspired by **Vercel** (minimalism, dark theme, Geist font). Replaces the sidebar with a universal navigation bar via \`navbar.js\`. Headline features include the Combined Games Collection (\`4SP Games\`), a built-in **Dictionary**, the debut of *this* exclusive 4SP AI Agent (with hidden intelligence tools), **Dailyphoto** (a student social network), and **Messenger V2**. The goal is a full digital ecosystem: sleek, social, and secure.
`;
        // --- END 4SP CONTEXT INJECTION ---

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
        
        let personaInstruction = FOUR_SP_HISTORY_INSTRUCTION + `
You are a highly capable and adaptable AI, taking on a persona to best serve the user's direct intent. You have significant control over the interaction's structure and detail level, ensuring the response is comprehensive and authoritative.
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
            previewArea.innerHTML = `<p>Preview not available for this file type. You can download it to view.</p> <a href="${file.fileContent}" download="${file.fileName}" class="download-button">Download File</a>`;
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
            // Manually restore cursor to the end
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(editor);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
        }

        // Auto-resize input
        const style = window.getComputedStyle(editor);
        const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
        const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
        const minHeight = parseFloat(style.minHeight);
        
        editor.style.height = 'auto'; // Temporarily unset height
        const newHeight = editor.scrollHeight + padding + border;
        
        if (newHeight > MAX_INPUT_HEIGHT) {
            editor.style.height = `${MAX_INPUT_HEIGHT}px`;
            editor.style.overflowY = 'auto';
        } else if (newHeight > minHeight) {
            editor.style.height = `${newHeight}px`;
            editor.style.overflowY = 'hidden';
        }
    }
    
    function handlePaste(e) {
        e.preventDefault();
        let paste = (e.clipboardData || window.clipboardData).getData('text');
        
        const editor = e.target;
        const charCount = editor.innerText.length;
        const remainingSpace = CHAR_LIMIT - charCount;
        
        if (paste.length > remainingSpace) {
             paste = paste.substring(0, remainingSpace);
             alert(`Paste truncated. Only ${remainingSpace} characters could be added due to the ${formatCharLimit(CHAR_LIMIT)} character limit.`);
        }
        
        // Insert paste text at cursor position
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        selection.deleteFromDocument();
        selection.getRangeAt(0).insertNode(document.createTextNode(paste));

        // Move cursor to the end of the pasted text
        selection.collapseToEnd();
        
        // Handle images/files in clipboard
        const items = (e.clipboardData || window.clipboardData).items;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.indexOf('image') !== -1) {
                const file = item.getAsFile();
                if (file) {
                     const reader = new FileReader();
                     reader.onload = (e) => {
                        const base64Data = e.target.result.split(',')[1];
                        const dataUrl = e.target.result;
                        file.name = `Pasted Image ${Date.now()}.${file.type.split('/')[1] || 'png'}`;
                        processFileLike(file, base64Data, dataUrl);
                     };
                     reader.readAsDataURL(file);
                }
            } else if (item.kind === 'file') {
                 // For non-image files, only process if they are below the threshold or small enough
                 const file = item.getAsFile();
                 if (file && file.size < PASTE_TO_FILE_THRESHOLD) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const base64Data = e.target.result.split(',')[1];
                        const dataUrl = e.target.result;
                        processFileLike(file, base64Data, dataUrl);
                    };
                    reader.readAsDataURL(file);
                 }
            }
        }
        
        // Manually trigger input handler for char count/resize update
        handleContentEditableInput({ target: editor });
    }

    function handleInputSubmission(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const editor = document.getElementById('ai-input');
            const message = editor.innerText.trim();
            
            if (isRequestPending) {
                 alert("A request is already pending. Please wait.");
                 return;
            }

            if (message.length === 0 && attachedFiles.length === 0) {
                alert("Please enter a message or attach a file.");
                return;
            }
            
            if (message.length > CHAR_LIMIT) {
                alert(`Message exceeds the ${formatCharLimit(CHAR_LIMIT)} character limit.`);
                return;
            }

            // 1. Add user message to history and UI
            const userMessageParts = [];
            if (message) { userMessageParts.push({ text: message }); }
            
            attachedFiles.forEach(file => {
                 if (file.inlineData) userMessageParts.push({ inlineData: file.inlineData });
            });
            
            chatHistory.push({ role: "user", parts: userMessageParts });

            // Clear input and attachments
            editor.innerHTML = '';
            editor.style.height = '40px'; // Reset height
            attachedFiles = [];
            renderAttachments(); 
            document.getElementById('ai-char-counter').textContent = `0 / ${formatCharLimit(CHAR_LIMIT)}`;
            
            const responseContainer = document.getElementById('ai-response-container');
            if(responseContainer) responseContainer.classList.add('chat-active');
            
            renderChatHistory(); // Render the new user message

            // 2. Prepare for Gemini response
            isRequestPending = true;
            editor.contentEditable = false;
            editor.blur(); // Remove focus
            
            const inputWrapper = document.getElementById('ai-input-wrapper');
            if (inputWrapper) { inputWrapper.classList.add('waiting'); }

            const responseBubble = document.createElement('div');
            responseBubble.className = 'ai-message-bubble gemini-response loading';
            responseBubble.innerHTML = '<div class="ai-response-content"><div class="ai-loader-dots"><span></span><span></span><span></span></div></div>';
            responseContainer.appendChild(responseBubble);
            responseContainer.scrollTop = responseContainer.scrollHeight;
            
            // 3. Call API
            callGoogleAI(responseBubble);
        }
    }

    function handleCopyCode(e) {
        const button = e.currentTarget;
        const codeBlock = button.closest('.code-block').querySelector('code');
        
        if (codeBlock) {
            const codeText = codeBlock.textContent || codeBlock.innerText;
            navigator.clipboard.writeText(codeText).then(() => {
                button.innerHTML = checkIconSVG;
                button.classList.add('copied');
                setTimeout(() => {
                    button.innerHTML = copyIconSVG;
                    button.classList.remove('copied');
                }, 2000);
            }).catch(err => {
                console.error('Could not copy text: ', err);
                alert('Failed to copy code.');
            });
        }
    }


    /**
     * Parses the raw Gemini response text, converting code fences and special blocks (e.g., graphs, KaTeX) into HTML.
     * @param {string} text The raw text response from the Gemini API.
     * @returns {string} The HTML string ready for injection.
     */
    function parseGeminiResponse(text) {
        // 1. Process Code Blocks
        let html = text.replace(/```(.*?)\n([\s\S]*?)```/g, (match, lang, code) => {
            const language = lang.trim() || 'plaintext';
            const escapedCode = escapeHTML(code);
            return `<div class="code-block"><button class="copy-code-btn" title="Copy code">${copyIconSVG}</button><pre><code class="language-${language}">${escapedCode}</code></pre></div>`;
        });

        // 2. Process Custom Graph Blocks (assumes JSON format inside)
        html = html.replace(/\[graph\]\s*([\s\S]*?)\s*\[\/graph\]/g, (match, graphJson) => {
            try {
                const trimmedJson = graphJson.trim();
                JSON.parse(trimmedJson); // Validate JSON
                // Use a placeholder that custom rendering functions can target
                return `<div class="custom-graph-placeholder" data-graph-data='${trimmedJson}'><canvas></canvas></div>`;
            } catch (e) {
                console.error("Failed to parse graph JSON:", e);
                return `<p class="ai-error">[Graph Error] Malformed graph data. Details: ${escapeHTML(e.message)}</p>`;
            }
        });

        // 3. Process KaTeX Blocks for Display Mode ($$)
        html = html.replace(/\$\$(.*?)\$\$/g, (match, formula) => {
            const trimmedFormula = formula.trim();
            // Use a specific class and data attributes for KaTeX rendering to occur post-injection
            return `<div class="latex-render" data-tex="${escapeHTML(trimmedFormula)}" data-display-mode="true"></div>`;
        });
        
        // 4. Process KaTeX Blocks for Inline Mode ($)
        html = html.replace(/\$(.*?)\$/g, (match, formula) => {
            const trimmedFormula = formula.trim();
            if (trimmedFormula.length === 0) return match; // Avoid matching empty strings like '$$' which are handled by the block processor
             // Use a specific class and data attributes for KaTeX rendering to occur post-injection
            return `<span class="latex-render" data-tex="${escapeHTML(trimmedFormula)}" data-display-mode="false"></span>`;
        });

        // 5. Convert markdown to basic HTML (bold, italics, lists, paragraphs)
        // Convert **bold** and *italics*
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Convert blockquotes (lines starting with >)
        html = html.replace(/^>\s?(.*)$/gm, '<blockquote><p>$1</p></blockquote>');

        // Simple line break to paragraph conversion (if not inside a code/pre block)
        html = html.split('\n\n').map(p => {
             // If a paragraph contains a block element (like code-block, blockquote, or graph), don't wrap it in <p>
            if (p.match(/<(div|blockquote|ul|ol|table|h[1-6]|hr|p)/i) || p.startsWith('<div class="code-block"')) {
                // Also handle lists, which might not be separated by double newlines but should be wrapped
                if (p.match(/^(\s*[\-\+\*]|\s*\d+\.)/m)) {
                    return p;
                }
                return p;
            }
            let content = p.trim();
            if (content.length === 0) return '';
            
            // Handle lists (markdown list items on separate lines)
            const listMatch = content.match(/^(\s*[\-\+\*]|\s*\d+\.)/m);
            if (listMatch) {
                const listItems = content.split('\n').map(line => {
                    const ulMatch = line.match(/^(\s*[\-\+\*]\s)(.*)/);
                    const olMatch = line.match(/^(\s*\d+\.\s)(.*)/);
                    if (ulMatch) return `<li>${ulMatch[2].trim()}</li>`;
                    if (olMatch) return `<li>${olMatch[2].trim()}</li>`;
                    return line;
                }).join('');
                
                // Determine if it's an ordered or unordered list based on the first item
                if (content.match(/^\s*\d+\./)) {
                    return `<ol>${listItems}</ol>`;
                } else {
                    return `<ul>${listItems}</ul>`;
                }
            }
            
            // Convert remaining newlines to <br> within a paragraph
            content = content.replace(/\n/g, '<br>');
            return `<p>${content}</p>`;
        }).join('');


        return html;
    }

    // Utility to escape HTML entities
    function escapeHTML(str) {
        return str.replace(/[&<>"']/g, function(m) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[m];
        });
    }

    // Utility to format bytes
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
    
    // Function to dynamically inject minimal styles for initial UI/fonts
    function injectStyles() {
        if (document.getElementById('ai-dynamic-styles')) return;

        // Load Font Awesome for the gear icon
        const fontAwesome = document.createElement('link');
        fontAwesome.rel = 'stylesheet';
        fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
        document.head.appendChild(fontAwesome);
        
        // Load KaTeX CSS
        const katexCSS = document.createElement('link');
        katexCSS.rel = 'stylesheet';
        katexCSS.id = 'ai-katex-styles';
        katexCSS.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.css';
        document.head.appendChild(katexCSS);
        
        // Load custom fonts
        const fonts = document.createElement('link');
        fonts.rel = 'stylesheet';
        fonts.id = 'ai-google-fonts';
        fonts.href = 'https://fonts.googleapis.com/css2?family=Merriweather:wght@700&family=Lora:wght@400;700&display=swap';
        document.head.appendChild(fonts);

        const style = document.createElement('style');
        style.id = 'ai-dynamic-styles';
        style.textContent = `
            :root {
                --ai-background: #111111;
                --ai-foreground: #ffffff;
                --ai-brand-color: #4285f4;
                --ai-text-color: #e0e0e0;
                --ai-border-color: #2a2a2a;
                --ai-shadow-color: rgba(0, 0, 0, 0.4);
                --ai-blue: #4285f4;
                --ai-green: #34a853;
                --ai-yellow: #fbbc04;
                --ai-red: #ea4335;
                --ai-loader-color: var(--ai-brand-color);
            }
            #ai-container {
                position: fixed;
                bottom: -100vh; /* Start off-screen */
                right: 20px;
                width: 400px;
                max-width: 90vw;
                height: 500px;
                max-height: 90vh;
                background-color: var(--ai-background);
                border: 1px solid var(--ai-border-color);
                border-radius: 12px;
                box-shadow: 0 4px 20px var(--ai-shadow-color);
                display: flex;
                flex-direction: column;
                z-index: 10000;
                transform: translateY(0);
                transition: bottom 0.5s ease-out, opacity 0.5s ease-out;
                opacity: 0;
                font-family: 'Lora', sans-serif;
            }
            #ai-container.active {
                bottom: 20px;
                opacity: 1;
            }
            #ai-container.deactivating {
                bottom: -100vh;
                opacity: 0;
            }
            #ai-brand-title {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                text-align: center;
                font-family: 'Merriweather', serif;
                font-size: 1.5em;
                padding: 10px 0;
                color: var(--ai-foreground);
                background: linear-gradient(90deg, var(--ai-blue), var(--ai-green), var(--ai-yellow), var(--ai-red));
                background-clip: text;
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                letter-spacing: 1px;
                border-top-left-radius: 10px;
                border-top-right-radius: 10px;
                animation: glow 4s infinite alternate;
                pointer-events: none;
            }
            #ai-persistent-title {
                background-color: var(--ai-brand-color);
                color: var(--ai-foreground);
                padding: 10px 15px;
                font-size: 1.1em;
                font-weight: bold;
                border-top-left-radius: 10px;
                border-top-right-radius: 10px;
                text-align: center;
            }
            #ai-close-button {
                position: absolute;
                top: 10px;
                right: 15px;
                color: var(--ai-foreground);
                font-size: 1.5em;
                cursor: pointer;
                line-height: 1;
                z-index: 10001;
                transition: color 0.2s;
            }
            #ai-close-button:hover {
                color: var(--ai-red);
            }
            #ai-welcome-message {
                padding: 20px;
                text-align: center;
                color: var(--ai-text-color);
                border-bottom: 1px solid var(--ai-border-color);
                transition: max-height 0.3s ease-in-out, opacity 0.3s ease-in-out;
                max-height: 200px;
                opacity: 1;
            }
            #ai-container.chat-active #ai-welcome-message {
                max-height: 0;
                padding-top: 0;
                padding-bottom: 0;
                opacity: 0;
                overflow: hidden;
                border-bottom: none;
            }
            #ai-welcome-message h2 {
                margin: 0 0 10px 0;
                font-family: 'Merriweather', serif;
                color: var(--ai-foreground);
            }
            #ai-welcome-message p {
                margin: 5px 0;
                font-size: 0.9em;
            }
            .shortcut-tip {
                font-style: italic;
                color: #888;
                font-size: 0.8em;
                margin-top: 15px !important;
            }
            #ai-response-container {
                flex-grow: 1;
                overflow-y: auto;
                padding: 15px;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            #ai-response-container::-webkit-scrollbar { width: 6px; }
            #ai-response-container::-webkit-scrollbar-thumb { background-color: #555; border-radius: 3px; }
            #ai-response-container::-webkit-scrollbar-track { background-color: var(--ai-background); }

            #ai-compose-area {
                border-top: 1px solid var(--ai-border-color);
                padding: 10px;
                position: relative;
            }
            #ai-input-wrapper {
                display: flex;
                align-items: flex-end;
                background-color: #222;
                border-radius: 8px;
                border: 1px solid #333;
                transition: all 0.2s;
            }
            #ai-input-wrapper.waiting {
                border-color: var(--ai-brand-color);
                box-shadow: 0 0 5px var(--ai-brand-color);
                pointer-events: none;
            }
            
            #ai-attachment-preview {
                display: none;
                flex-wrap: nowrap;
                overflow-x: auto;
                padding: 5px 10px;
                gap: 5px;
                border-bottom: 1px solid #333;
                -webkit-overflow-scrolling: touch;
            }
            #ai-input-wrapper.has-attachments #ai-input {
                 border-top-left-radius: 0;
                 border-top-right-radius: 0;
            }

            #ai-input {
                flex-grow: 1;
                min-height: 40px;
                max-height: ${MAX_INPUT_HEIGHT}px;
                color: var(--ai-foreground);
                padding: 10px;
                outline: none;
                white-space: pre-wrap;
                word-wrap: break-word;
                font-size: 0.95em;
                cursor: text;
                line-height: 1.4;
                overflow-y: hidden;
            }
            #ai-input-wrapper.waiting #ai-input {
                color: #555;
            }
            
            #ai-attachment-button, #ai-settings-button {
                background: none;
                border: none;
                color: var(--ai-text-color);
                padding: 10px 10px 10px 5px;
                cursor: pointer;
                transition: color 0.2s;
            }
            #ai-attachment-button:hover { color: var(--ai-green); }
            #ai-settings-button { padding-left: 5px; padding-right: 10px; }
            #ai-settings-button:hover { color: var(--ai-brand-color); }
            #ai-settings-button.active { color: var(--ai-brand-color); }
            
            .ai-message-bubble {
                padding: 10px;
                border-radius: 12px;
                max-width: 85%;
                line-height: 1.5;
                font-size: 0.9em;
                opacity: 0;
                transform: translateY(10px);
                animation: message-pop-in 0.3s ease-out forwards;
            }
            .user-message {
                align-self: flex-end;
                background-color: var(--ai-brand-color);
                color: var(--ai-foreground);
                border-bottom-right-radius: 2px;
            }
            .gemini-response {
                align-self: flex-start;
                background-color: #333333;
                color: var(--ai-text-color);
                border: 1px solid #444;
                border-bottom-left-radius: 2px;
            }
            .ai-response-content {
                text-align: left;
            }
            .ai-error {
                color: var(--ai-red);
                font-weight: bold;
            }
            .ai-message-bubble p { margin: 0; padding: 0; text-align: left; }
            .ai-message-bubble ul, .ai-message-bubble ol { margin: 10px 0; padding-left: 20px; text-align: left; list-style-position: outside; }
            .ai-message-bubble li { margin-bottom: 5px; }
            .ai-message-bubble strong { color: var(--ai-foreground); }
            
            /* Code Block Styling */
            .code-block {
                position: relative;
                margin: 10px 0;
                background-color: #000;
                border-radius: 5px;
                padding: 0;
                overflow: hidden;
            }
            .code-block pre {
                margin: 0;
                padding: 15px;
                overflow-x: auto;
                font-size: 0.85em;
                color: #f8f8f2;
            }
            .code-block code {
                display: block;
            }
            .copy-code-btn {
                position: absolute;
                top: 5px;
                right: 5px;
                background-color: rgba(255, 255, 255, 0.1);
                color: #ddd;
                border: none;
                padding: 5px 8px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.9em;
                transition: background-color 0.2s, color 0.2s;
            }
            .copy-code-btn:hover {
                background-color: rgba(255, 255, 255, 0.2);
                color: var(--ai-brand-color);
            }
            .copy-code-btn.copied {
                background-color: var(--ai-green);
                color: var(--ai-foreground);
            }

            /* Attachment Preview */
            .attachment-card {
                position: relative;
                flex-shrink: 0;
                width: 70px;
                height: 70px;
                border: 1px solid #444;
                border-radius: 6px;
                overflow: hidden;
                margin: 5px 0;
                cursor: pointer;
                background-color: #333;
                transition: border-color 0.2s;
            }
            .attachment-card:hover { border-color: var(--ai-brand-color); }
            .attachment-card img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            .attachment-card .file-icon {
                display: block;
                text-align: center;
                font-size: 2.5em;
                line-height: 70px;
                color: var(--ai-brand-color);
            }
            .attachment-card .file-name {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                background-color: rgba(0, 0, 0, 0.7);
                color: var(--ai-foreground);
                font-size: 0.7em;
                padding: 2px 4px;
                white-space: nowrap;
                overflow: hidden;
            }
            .attachment-card .file-name span {
                display: inline-block;
            }
            .attachment-card .file-name.marquee span {
                 animation: marquee 5s linear infinite;
            }
            .attachment-card .file-name.marquee span:last-child {
                position: absolute;
                left: 100%;
                padding-left: 10px;
            }
            .file-type-badge {
                position: absolute;
                top: 2px;
                left: 2px;
                background-color: var(--ai-brand-color);
                color: white;
                font-size: 0.6em;
                padding: 1px 4px;
                border-radius: 3px;
                font-weight: bold;
            }
            .remove-attachment-btn {
                position: absolute;
                top: -5px;
                right: -5px;
                background-color: var(--ai-red);
                color: white;
                border: 1px solid var(--ai-foreground);
                border-radius: 50%;
                width: 18px;
                height: 18px;
                line-height: 1;
                font-size: 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10;
                padding: 0;
            }
            
            /* Loading State */
            .attachment-card.loading {
                 background-color: #1a1a1a;
                 opacity: 0.6;
                 pointer-events: none;
            }
            .ai-loader {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                background-color: rgba(0, 0, 0, 0.5);
                z-index: 5;
            }
            .ai-loader::after {
                content: "";
                width: 20px;
                height: 20px;
                border: 3px solid #ccc;
                border-top-color: var(--ai-loader-color);
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            .gemini-response.loading {
                 pointer-events: none;
                 border: 1px solid var(--ai-brand-color);
                 animation: gemini-glow 4s infinite alternate;
            }
            .ai-loader-dots {
                display: flex;
                gap: 5px;
                align-items: center;
                justify-content: center;
                height: 100%;
            }
            .ai-loader-dots span {
                width: 8px;
                height: 8px;
                background-color: var(--ai-brand-color);
                border-radius: 50%;
                display: inline-block;
                animation: loading-dot 1.4s infinite ease-in-out both;
            }
            .ai-loader-dots span:nth-child(1) { animation-delay: -0.32s; }
            .ai-loader-dots span:nth-child(2) { animation-delay: -0.16s; }
            .ai-loader-dots span:nth-child(3) { animation-delay: 0s; }

            #ai-char-counter {
                text-align: right;
                padding: 5px 10px;
                font-size: 0.75em;
                color: #888;
            }
            #ai-char-counter.limit-exceeded {
                color: var(--ai-red);
                font-weight: bold;
            }
            
            /* Settings Menu */
            #ai-settings-menu {
                position: absolute;
                bottom: calc(100% + 10px);
                right: 0;
                width: 100%;
                background-color: #222;
                border: 1px solid #444;
                border-radius: 8px;
                padding: 15px;
                box-shadow: 0 4px 10px var(--ai-shadow-color);
                z-index: 999;
                opacity: 0;
                transform: translateY(10px);
                pointer-events: none;
                transition: opacity 0.3s, transform 0.3s;
                color: var(--ai-text-color);
            }
            #ai-settings-menu.active {
                opacity: 1;
                transform: translateY(0);
                pointer-events: all;
            }
            .menu-header {
                font-family: 'Merriweather', serif;
                font-size: 1.1em;
                margin-bottom: 15px;
                color: var(--ai-foreground);
                border-bottom: 1px dashed #444;
                padding-bottom: 8px;
            }
            .setting-group {
                margin-bottom: 10px;
            }
            .setting-group label {
                display: block;
                font-size: 0.9em;
                margin-bottom: 3px;
                color: var(--ai-foreground);
            }
            .setting-group input:not([type="color"]), .setting-group select {
                width: 100%;
                padding: 8px;
                border: 1px solid #555;
                border-radius: 4px;
                background-color: #333;
                color: var(--ai-foreground);
                box-sizing: border-box;
            }
             .setting-group-split {
                display: flex;
                gap: 10px;
            }
            .setting-group-split .setting-group {
                flex: 1;
            }
            .setting-note {
                font-size: 0.75em;
                color: #888;
                margin-top: 2px;
            }
            #settings-save-button {
                width: 100%;
                padding: 10px;
                background-color: var(--ai-brand-color);
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                margin-top: 15px;
                font-weight: bold;
                transition: background-color 0.2s;
            }
            #settings-save-button:hover {
                background-color: #3875d9;
            }
            
            /* KaTeX Styling */
            .katex { font-size: 0.95em; }
            .katex-display { margin: 1em 0; padding: 0.5em 0; overflow-x: auto; overflow-y: hidden; }
            .latex-render { color: var(--ai-foreground); }
            
            /* Custom Graph Styling */
            .custom-graph-placeholder {
                width: 100%;
                min-height: 200px;
                max-height: 300px;
                margin: 10px 0;
                border: 1px solid #444;
                border-radius: 6px;
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-content: center;
                background-color: #1a1a1a;
            }
            .custom-graph-placeholder canvas {
                display: block;
                width: 100%;
                height: 100%;
            }

            /* Keyframes */
            @keyframes glow { 0%,100% { box-shadow: 0 0 5px rgba(255,255,255,.15), 0 0 10px rgba(255,255,255,.1); } 50% { box-shadow: 0 0 10px rgba(255,255,255,.25), 0 0 20px rgba(255,255,255,.2); } }
            @keyframes gemini-glow { 0%,100% { box-shadow: 0 0 8px 2px var(--ai-blue); } 25% { box-shadow: 0 0 8px 2px var(--ai-green); } 50% { box-shadow: 0 0 8px 2px var(--ai-yellow); } 75% { box-shadow: 0 0 8px 2px var(--ai-red); } }
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes loading-dot {
                0%, 80%, 100% { transform: scale(0); }
                40% { transform: scale(1.0); }
            }
            @keyframes message-pop-in { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
            @keyframes marquee {
                0% { transform: translateX(0); }
                100% { transform: translateX(calc(-100% - 10px)); }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Attach event listener for activation
    document.addEventListener('keydown', handleKeyDown);
})();
