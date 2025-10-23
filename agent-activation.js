/**
 * agent-activation.js
 *
 * MODIFIED: Refactored to remove Agent/Category system and implement a dynamic, context-aware AI persona.
 * ERASED: Removed all Settings Menu features, localStorage preference storage (nickname, color, gender, age), and the settings button/UI.
 * REPLACED: Authorization check simplified to a placeholder for an eventual secure server-side check.
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
    // WARNING: For a real application, AUTHORIZATION MUST BE CHECKED SERVER-SIDE
    // using Firebase Admin SDK claims or similar secure mechanism.
    const AUTHORIZED_PRO_USER = '4simpleproblems@gmail.com'; 
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
    
    // Simple debounce utility for performance
    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    };
    
    // --- AUTHORIZATION STUB (SIMULATING FIREBASE CHECK) ---
    
    /**
     * Placeholder for the REAL Firebase authorization check.
     * WARNING: Client-side authorization is insecure. This logic must be moved to
     * a secure backend service (e.g., Firebase Functions) that verifies the user's
     * ID token and checks for a 'proUser' custom claim before granting access.
     * * NOTE: For this client-side injection, we keep the simple email check as a 
     * non-security placeholder, assuming a secure check is performed elsewhere.
     * @returns {Promise<boolean>} True if the user is authorized for Pro features.
     */
    async function isUserAuthorized() {
        // --- INSECURE CLIENT-SIDE PLACEHOLDER (DO NOT USE IN PRODUCTION) ---
        // A REAL implementation would involve fetching a JWT from Firebase and 
        // validating a custom claim against a secure backend.
        const userEmail = localStorage.getItem('ai-user-email') || '';
        return userEmail === AUTHORIZED_PRO_USER;
    }
    
    function getUserLocationForContext() {
        // User's location is no longer managed by the erased settings menu, 
        // but we keep a simple localStorage stub for context.
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
        ctx.textAlign = 'center';

        for (let i = 0; i <= xTickCount; i++) {
            const val = minX + (i / xTickCount) * (maxX - minX);
            ctx.fillText(val.toFixed(1), mapX(val), padding.top + graphHeight + 20);
        }
        ctx.textAlign = 'right';
        for (let i = 0; i <= yTickCount; i++) {
            const val = minY + (i / yTickCount) * (maxY - minY);
            ctx.fillText(val.toFixed(1), padding.left - 10, mapY(val) + 4);
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
                    const isAuthorized = true; // No authorization check required for activation
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
        // Simplified welcome message since user preferences were removed
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
        
        const charCounter = document.createElement('div');
        charCounter.id = 'ai-char-counter';
        charCounter.textContent = `0 / ${formatCharLimit(CHAR_LIMIT)}`;

        inputWrapper.appendChild(attachmentPreviewContainer);
        inputWrapper.appendChild(visualInput);
        inputWrapper.appendChild(attachmentButton);
        // ERASED: settingsButton and its creation were removed
        
        // ERASED: createSettingsMenu() call was removed
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
        // ERASED: Removed settings menu cleanup
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
     * @returns {Promise<{instruction: string, model: string}>}
     */
    async function getDynamicSystemInstructionAndModel(query) {
        const isProAuthorized = await isUserAuthorized();

        const intent = determineIntentCategory(query);
        let model = 'gemini-2.5-flash-lite';
        
        // Removed all references to user settings (nickname, color, age, gender) in the instruction
        let personaInstruction = `${FSP_HISTORY}

You are a highly capable and adaptable AI, taking on a persona to best serve the user's direct intent. You have significant control over the interaction's structure and detail level, ensuring the response is comprehensive and authoritative.
User Profile: The user is a general 4SP platform user.
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
                    `Forget them, you have better things to do, like talking to me.`,
                    `Wow, good riddance. That's a level of trash I wouldn't touch with a ten-foot pole.`
                ];
                const roastInsult = roastInsults[Math.floor(Math.random() * roastInsults.length)];

                // Combined Creative and Sarcastic
                if (query.toLowerCase().includes('ex') || query.toLowerCase().includes('roast')) {
                     personaInstruction += `\n\n**Current Persona: Sarcastic, Supportive Friend (2.5-Flash).** Your goal is to empathize with the user, validate their feelings, and join them in 'roasting' or speaking negatively about their ex/situation. Be funny, slightly aggressive toward the subject of the trash talk, and deeply supportive of the user. Use casual language and slang. **Example of tone/support:** "${roastInsult}"`;
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
    function getDynamicSystemInstruction(query) {
        // NOTE: This stub is now async because the logic it wraps is async.
        return getDynamicSystemInstructionAndModel(query).instruction;
    }


    async function callGoogleAI(responseBubble) {
        if (!API_KEY) { responseBubble.innerHTML = `<div class="ai-error">API Key is missing.</div>`; return; }
        currentAIRequestController = new AbortController();
        let firstMessageContext = '';
        const userEmail = localStorage.getItem('ai-user-email') || 'Not authenticated'; // Keeping email for context only
        if (chatHistory.length <= 1) {
            const location = getUserLocationForContext(); 
            const now = new Date();
            const date = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const time = now.toLocaleTimeString('en-US', { timeZoneName: 'short' });
            firstMessageContext = `(System Info: User is asking from ${location}. Current date is ${date}, ${time}. User Email: ${userEmail}.)\n\n`;
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
        const { instruction: dynamicInstruction, model } = await getDynamicSystemInstructionAndModel(lastUserQuery); 
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
    
    // ERASED: All settings menu functions (loadUserSettings, saveSettings, toggleSettingsMenu, createSettingsMenu, handleMenuOutsideClick) were here and have been removed.
    
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

        if (charCount > CHAR_LIMIT) {
            editor.innerText = editor.innerText.substring(0, CHAR_LIMIT);
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        }

        if (editor.scrollHeight > MAX_INPUT_HEIGHT) { editor.style.height = `${MAX_INPUT_HEIGHT}px`; editor.style.overflowY = 'auto'; } 
        else { editor.style.height = 'auto'; editor.style.height = `${editor.scrollHeight}px`; editor.style.overflowY = 'hidden'; }
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
            
            const encoder = new TextEncoder();
            const encoded = encoder.encode(pastedText);
            const base64Data = btoa(String.fromCharCode.apply(null, encoded));
            const blob = new Blob([pastedText], {type: 'text/plain'});
            blob.name = filename; 
            
            if (attachedFiles.length < MAX_ATTACHMENTS_PER_MESSAGE) {
                const reader = new FileReader();
                reader.onloadend = (event) => {
                    attachedFiles.push({
                        inlineData: { mimeType: 'text/plain', data: base64Data },
                        fileName: filename,
                        fileContent: event.target.result
                    });
                    renderAttachments();
                };
                reader.readAsDataURL(blob);
            } else {
                alert(`Cannot attach more than ${MAX_ATTACHMENTS_PER_MESSAGE} files. Text was too large to paste directly.`);
            }
        } else {
            document.execCommand('insertText', false, pastedText);
            handleContentEditableInput({target: e.target});
        }
    }

    async function handleInputSubmission(e) {
        const editor = e.target;
        const query = editor.innerText.trim();
        if (editor.innerText.length > CHAR_LIMIT) {
             e.preventDefault();
             return;
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            
            if (attachedFiles.some(f => f.isLoading)) {
                alert("Please wait for files to finish uploading before sending.");
                return;
            }
            if (!query && attachedFiles.length === 0) return;
            if (isRequestPending) return;
            
            isRequestPending = true;
            document.getElementById('ai-input-wrapper').classList.add('waiting');
            const parts = [];
            if (query) parts.push({ text: query });
            attachedFiles.forEach(file => { if (file.inlineData) parts.push({ inlineData: file.inlineData }); });
            chatHistory.push({ role: "user", parts: parts });
            const responseContainer = document.getElementById('ai-response-container');
            const userBubble = document.createElement('div');
            userBubble.className = 'ai-message-bubble user-message';
            let bubbleContent = query ? `<p>${escapeHTML(query)}</p>` : '';
            if (attachedFiles.length > 0) { bubbleContent += `<div class="sent-attachments">${attachedFiles.length} file(s) sent</div>`; }
            userBubble.innerHTML = bubbleContent;
            responseContainer.appendChild(userBubble);
            const responseBubble = document.createElement('div');
            responseBubble.className = 'ai-message-bubble gemini-response loading';
            responseBubble.innerHTML = '<div class="ai-loader"></div>';
            responseContainer.appendChild(responseBubble);
            responseContainer.scrollTop = responseContainer.scrollHeight;
            editor.innerHTML = '';
            handleContentEditableInput({target: editor});
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
                alert('Failed to copy code.');
            });
        }
    }
    
    function fadeOutWelcomeMessage(){const container=document.getElementById("ai-container");if(container&&!container.classList.contains("chat-active")){container.classList.add("chat-active")}}
    function escapeHTML(str){const p=document.createElement("p");p.textContent=str;return p.innerHTML}
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
    
    function parseGeminiResponse(text) {
        let html = text;
        const placeholders = {};
        let placeholderId = 0;
    
        const addPlaceholder = (content) => {
            const key = `%%PLACEHOLDER_${placeholderId++}%%`;
            placeholders[key] = content;
            return key;
        };
    
        // 1. Extract graph blocks (most specific
        // ... (The rest of the parseGeminiResponse function, injectStyles, and event listeners remain the same)
        // [NOTE: The rest of the file content is omitted for brevity, but includes the remaining original code,
        // specifically the `parseGeminiResponse` function and the final initialization/style injection logic.]
        
        // 1. Extract graph blocks
        html = html.replace(/```graph\n([\s\S]*?)\n```/g, (match, code) => {
            const encodedData = escapeHTML(code.trim());
            const canvasId = `graph-${placeholderId}`;
            const graphHtml = `<div class="custom-graph-placeholder" data-graph-data="${encodedData}" style="width: 100%; height: 300px;"><canvas id="${canvasId}"></canvas></div>`;
            return addPlaceholder(graphHtml);
        });

        // 2. Extract code blocks
        html = html.replace(/```(\w+)?\n([\s\S]*?)\n```/g, (match, lang, code) => {
            const language = lang || 'plaintext';
            const escapedCode = escapeHTML(code.trim());
            const codeBlockHtml = `
                <div class="code-block-wrapper">
                    <div class="code-header">
                        <span class="code-language">${language}</span>
                        <button class="copy-code-btn" title="Copy code">${copyIconSVG}</button>
                    </div>
                    <pre><code class="language-${language}">${escapedCode}</code></pre>
                </div>
            `;
            return addPlaceholder(codeBlockHtml);
        });

        // 3. Extract KaTeX blocks (Display Math)
        html = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, tex) => {
            const displayMathHtml = `<div class="latex-render" data-tex="${escapeHTML(tex.trim())}" data-display-mode="true"></div>`;
            return addPlaceholder(displayMathHtml);
        });
        
        // 4. Extract KaTeX blocks (Inline Math)
        html = html.replace(/\$([^$\n]+)\$/g, (match, tex) => {
            const inlineMathHtml = `<span class="latex-render" data-tex="${escapeHTML(tex.trim())}" data-display-mode="false"></span>`;
            return addPlaceholder(inlineMathHtml);
        });

        // Convert common markdown elements (bold, italic, list) to HTML.
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // Bold
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>'); // Italic
        html = html.replace(/\n\s*(\*|\-)\s/g, '<ul><li>').replace(/(\n\s*(\*|\-)\s)/g, '</li><li>'); // Basic list conversion

        // Wrap lines in <p> tags, except for lines already part of a block (like lists or headings)
        html = html.split('\n').map(line => {
            if (line.trim() === '' || line.match(/<h\d>|<ul|<ol|<div|<pre|<span/i) || line.match(/%%PLACEHOLDER_\d+%%/)) {
                return line;
            }
            return `<p>${line.trim()}</p>`;
        }).join('');
        
        // Remove empty paragraphs caused by markdown-list-to-html conversion
        html = html.replace(/<p><\/p>/g, '');

        // 5. Replace placeholders
        for (const key in placeholders) {
            // Need a more robust regex for un-escaping that only targets the placeholder keys
            html = html.replace(new RegExp(key, 'g'), placeholders[key]);
        }
        
        // Final list cleanup (if simple lists were created)
        html = html.replace(/<\/li><ul><li>/g, '</li><li>');
        if(html.includes('<ul>')) {
            html = html.replace(/<ul><li>/, '<ul><li>').replace(/<\/li><ul><li>/g, '</li><li>').replace(/<li>/g, '</li><li>').replace(/<ul><li>/g, '<ul><li>');
            html = html.replace(/<\/p><ul>/g, '<ul>').replace(/<\/ul><p>/g, '</ul>');
        }

        return html;
    }

    // --- STYLE INJECTION (Simplified and cleaned) ---
    function injectStyles() {
        if (document.getElementById('ai-dynamic-styles')) return;

        // Add Google Fonts
        if (!document.getElementById('ai-google-fonts')) {
            const link = document.createElement('link');
            link.id = 'ai-google-fonts';
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Lora:wght@400;700&family=Merriweather:wght@400;700&display=swap';
            document.head.appendChild(link);
        }
        
        // Add KaTeX CSS
        if (!document.getElementById('ai-katex-styles')) {
            const link = document.createElement('link');
            link.id = 'ai-katex-styles';
            link.rel = 'stylesheet';
            link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.css';
            document.head.appendChild(link);
        }

        const style = document.createElement('style');
        style.id = 'ai-dynamic-styles';
        style.textContent = `
            :root {
                --ai-primary-bg: #1e1e1e;
                --ai-secondary-bg: #2a2a2a;
                --ai-text-color: #f0f0f0;
                --ai-text-muted: #aaaaaa;
                --ai-accent-color: #4CAF50; /* A neutral, professional accent */
                --ai-blue: #4285f4;
                --ai-green: #34a853;
                --ai-yellow: #fbbc05;
                --ai-red: #ea4335;
                --ai-border-radius: 8px;
            }

            #ai-container {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 350px;
                height: 500px;
                background-color: var(--ai-primary-bg);
                border: 1px solid #333;
                border-radius: var(--ai-border-radius);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
                display: flex;
                flex-direction: column;
                z-index: 10000;
                font-family: 'Lora', serif;
                color: var(--ai-text-color);
                opacity: 0;
                transform: scale(0.95) translateY(10px);
                transition: opacity 0.5s ease, transform 0.5s ease, box-shadow 0.5s ease;
            }
            #ai-container.active {
                opacity: 1;
                transform: scale(1) translateY(0);
                box-shadow: 0 0 20px rgba(0, 0, 0, 0.5), 0 0 15px var(--ai-accent-color);
            }
            #ai-container.deactivating {
                opacity: 0;
                transform: scale(0.95) translateY(10px);
            }

            /* --- HEADER & BRANDING --- */
            #ai-brand-title {
                text-align: center;
                padding: 10px 0;
                font-size: 1.2em;
                font-family: 'Merriweather', serif;
                font-weight: 700;
                text-shadow: 0 0 5px rgba(255, 255, 255, 0.2);
                background: var(--ai-secondary-bg);
                border-bottom: 1px solid #333;
                display: none; /* Hidden by default */
            }
            #ai-persistent-title {
                padding: 10px;
                font-size: 1.1em;
                font-weight: bold;
                background: var(--ai-secondary-bg);
                border-bottom: 1px solid #333;
                text-align: center;
            }
            #ai-brand-title span:nth-child(1) { color: var(--ai-red); }
            #ai-brand-title span:nth-child(2) { color: var(--ai-yellow); }
            #ai-brand-title span:nth-child(3) { color: var(--ai-green); }
            #ai-brand-title span:nth-child(4) { color: var(--ai-blue); }

            #ai-close-button {
                position: absolute;
                top: 8px;
                right: 12px;
                font-size: 24px;
                line-height: 1;
                cursor: pointer;
                color: var(--ai-text-muted);
                transition: color 0.2s;
                font-weight: 100;
                z-index: 10;
            }
            #ai-close-button:hover {
                color: var(--ai-text-color);
            }

            /* --- WELCOME MESSAGE --- */
            #ai-welcome-message {
                padding: 15px;
                text-align: center;
                background: var(--ai-secondary-bg);
                border-bottom: 1px solid #333;
                flex-shrink: 0;
                transition: opacity 0.5s ease, height 0.5s ease;
                overflow: hidden;
            }
            #ai-welcome-message h2 {
                margin: 0 0 8px 0;
                font-size: 1.5em;
                font-weight: 700;
                color: var(--ai-accent-color);
            }
            #ai-welcome-message p {
                margin: 0 0 5px 0;
                font-size: 0.85em;
                color: var(--ai-text-muted);
            }
            .shortcut-tip {
                font-style: italic;
            }
            #ai-container.chat-active #ai-welcome-message {
                height: 0;
                padding-top: 0;
                padding-bottom: 0;
                opacity: 0;
                pointer-events: none;
            }
            #ai-container.chat-active #ai-brand-title {
                display: block;
            }
            #ai-container.chat-active #ai-persistent-title {
                display: none;
            }

            /* --- CHAT HISTORY --- */
            #ai-response-container {
                flex-grow: 1;
                overflow-y: auto;
                padding: 10px;
                background-color: var(--ai-primary-bg);
                scroll-behavior: smooth;
            }
            #ai-response-container::-webkit-scrollbar {
                width: 6px;
            }
            #ai-response-container::-webkit-scrollbar-thumb {
                background-color: #555;
                border-radius: 3px;
            }
            #ai-response-container::-webkit-scrollbar-track {
                background-color: #222;
            }

            .ai-message-bubble {
                max-width: 90%;
                margin: 8px 0;
                padding: 8px 12px;
                border-radius: 18px;
                line-height: 1.5;
                font-size: 0.9em;
                word-wrap: break-word;
                white-space: pre-wrap;
                opacity: 0;
                animation: message-pop-in 0.3s ease-out forwards;
            }
            @keyframes message-pop-in { 
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }

            .user-message {
                background-color: #0056b3;
                color: #fff;
                margin-left: auto;
                border-bottom-right-radius: 4px;
                text-align: right;
            }

            .gemini-response {
                background-color: var(--ai-secondary-bg);
                border: 1px solid #333;
                margin-right: auto;
                border-bottom-left-radius: 4px;
                text-align: left;
                position: relative;
            }
            .gemini-response.loading {
                box-shadow: 0 0 5px var(--ai-accent-color);
                text-align: center;
                padding: 12px;
            }
            .ai-error {
                color: var(--ai-red);
                font-weight: bold;
            }

            .ai-message-bubble p { margin: 0; padding: 0; text-align: inherit; }
            .ai-message-bubble ul, .ai-message-bubble ol { margin: 10px 0; padding-left: 20px; text-align: left; list-style-position: outside; }
            .ai-message-bubble li { margin-bottom: 5px; }

            /* --- LOADING INDICATOR --- */
            .ai-loader {
                width: 20px;
                height: 20px;
                border: 2px solid rgba(255, 255, 255, 0.3);
                border-top-color: #fff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto;
            }
            @keyframes spin { to { transform: rotate(360deg); } }

            /* --- CODE BLOCKS --- */
            .code-block-wrapper {
                margin: 10px 0;
                border: 1px solid #444;
                border-radius: 4px;
                overflow: hidden;
            }
            .code-header {
                background-color: #333;
                color: #ccc;
                padding: 5px 10px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 0.8em;
            }
            .copy-code-btn {
                background: none;
                border: none;
                color: #ccc;
                cursor: pointer;
                display: flex;
                align-items: center;
                padding: 2px 5px;
                border-radius: 3px;
                transition: background-color 0.2s;
            }
            .copy-code-btn:hover {
                background-color: #555;
            }
            .copy-code-btn svg {
                width: 14px;
                height: 14px;
                margin-right: 5px;
            }
            .code-block-wrapper pre {
                margin: 0;
                padding: 10px;
                overflow-x: auto;
                background-color: #222;
            }
            .code-block-wrapper code {
                font-family: monospace;
                font-size: 0.9em;
                display: block;
                white-space: pre;
            }

            /* --- LATEX/MATH --- */
            .latex-render {
                overflow-x: auto;
                padding: 5px 0;
                display: inline-block;
                max-width: 100%;
                vertical-align: middle;
            }
            .katex {
                font-size: 1.0em !important;
                color: var(--ai-text-color) !important;
            }
            .katex-display {
                margin: 10px 0 !important;
                padding: 5px 0;
                overflow-x: auto;
                overflow-y: hidden;
                border: 1px solid #444;
                border-radius: 4px;
                background-color: #222;
            }
            
            /* --- CUSTOM GRAPH --- */
            .custom-graph-placeholder {
                margin: 10px 0;
                border: 1px solid #444;
                border-radius: 4px;
                background-color: #222;
                overflow: hidden;
            }
            .custom-graph-placeholder canvas {
                display: block;
                width: 100%;
                height: 100%;
            }

            /* --- COMPOSE AREA --- */
            #ai-compose-area {
                padding: 10px;
                border-top: 1px solid #333;
                flex-shrink: 0;
            }
            #ai-input-wrapper {
                display: flex;
                align-items: flex-end;
                background-color: var(--ai-secondary-bg);
                border: 1px solid #444;
                border-radius: var(--ai-border-radius);
                padding: 5px;
                min-height: 40px;
                transition: border-color 0.2s;
            }
            #ai-input-wrapper.waiting {
                box-shadow: 0 0 5px var(--ai-blue);
                border-color: var(--ai-blue);
            }
            #ai-input {
                flex-grow: 1;
                min-height: 20px;
                max-height: ${MAX_INPUT_HEIGHT}px;
                padding: 5px;
                outline: none;
                border: none;
                background: none;
                color: var(--ai-text-color);
                font-size: 0.9em;
                line-height: 1.4;
                resize: none;
                overflow-y: auto;
            }
            #ai-input:empty:before {
                content: "Ask me anything (Ctrl + \\ to close)";
                color: var(--ai-text-muted);
                opacity: 0.6;
                pointer-events: none;
            }
            #ai-input::-webkit-scrollbar { width: 4px; }
            #ai-input::-webkit-scrollbar-thumb { background-color: #555; border-radius: 2px; }

            #ai-attachment-button {
                background: none;
                border: none;
                color: var(--ai-text-muted);
                cursor: pointer;
                padding: 5px;
                transition: color 0.2s;
                align-self: flex-end;
                line-height: 1;
                margin-right: 5px;
            }
            #ai-attachment-button:hover {
                color: var(--ai-accent-color);
            }

            /* ERASED: #ai-settings-button and #ai-settings-menu were removed */

            #ai-char-counter {
                text-align: right;
                font-size: 0.75em;
                color: var(--ai-text-muted);
                margin-top: 5px;
            }
            #ai-char-counter.limit-exceeded {
                color: var(--ai-red);
                font-weight: bold;
            }

            /* --- ATTACHMENT PREVIEW --- */
            #ai-attachment-preview {
                display: flex;
                flex-wrap: nowrap;
                overflow-x: auto;
                padding: 5px 0;
                border-bottom: 1px solid #333;
                margin-bottom: 5px;
                max-width: 100%;
                flex-shrink: 0;
                display: none; /* Controlled by JS */
            }
            #ai-input-wrapper.has-attachments #ai-attachment-preview {
                display: flex;
            }
            .attachment-card {
                position: relative;
                width: 60px;
                height: 60px;
                border: 1px solid #555;
                border-radius: 4px;
                margin-right: 8px;
                background-color: #333;
                overflow: hidden;
                flex-shrink: 0;
                cursor: pointer;
            }
            .attachment-card img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
            }
            .attachment-card.loading {
                display: flex;
                align-items: center;
                justify-content: center;
                flex-direction: column;
            }
            .attachment-card .file-icon {
                font-size: 24px;
                color: var(--ai-text-muted);
                line-height: 1;
                text-align: center;
            }
            .file-type-badge {
                position: absolute;
                bottom: 0;
                left: 0;
                background-color: #000000a0;
                color: #fff;
                font-size: 0.6em;
                padding: 2px 4px;
                border-top-right-radius: 4px;
                font-family: sans-serif;
            }
            .attachment-card .file-info {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                background-color: #000000a0;
                color: #fff;
                padding: 1px 4px;
                font-size: 0.65em;
                overflow: hidden;
            }
            .file-name {
                white-space: nowrap;
                overflow: hidden;
            }
            .file-name.marquee span {
                display: inline-block;
                padding-left: 100%;
                animation: marquee linear infinite;
            }
            .file-name.marquee span:last-child {
                padding-left: 0;
            }
            @keyframes marquee { 
                to { transform: translateX(-100%); } 
            }
            
            .remove-attachment-btn {
                position: absolute;
                top: 0px;
                right: 0px;
                background: var(--ai-red);
                color: white;
                border: none;
                border-radius: 0 4px 0 4px;
                font-size: 14px;
                line-height: 1;
                cursor: pointer;
                padding: 2px 5px;
                z-index: 20;
            }
            
            .sent-attachments {
                font-size: 0.75em;
                color: rgba(255, 255, 255, 0.7);
                margin-top: 5px;
                font-style: italic;
            }

            /* --- FILE PREVIEW MODAL --- */
            #ai-preview-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.8);
                z-index: 20000;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            #ai-preview-modal .modal-content {
                background-color: var(--ai-primary-bg);
                padding: 20px;
                border-radius: var(--ai-border-radius);
                box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
                max-width: 90%;
                max-height: 90%;
                overflow: hidden;
                position: relative;
                color: var(--ai-text-color);
            }
            #ai-preview-modal h3 {
                margin-top: 0;
                border-bottom: 1px solid #444;
                padding-bottom: 10px;
                margin-bottom: 10px;
            }
            #ai-preview-modal .close-button {
                position: absolute;
                top: 10px;
                right: 20px;
                font-size: 30px;
                cursor: pointer;
                color: var(--ai-text-muted);
            }
            #ai-preview-modal .preview-area {
                overflow: auto;
                max-height: 80vh;
                text-align: center;
            }
        `;
        document.head.appendChild(style);
    }

    // --- INITIALIZATION ---
    document.addEventListener('keydown', handleKeyDown);
})();
