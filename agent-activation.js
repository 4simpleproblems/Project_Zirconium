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
4SP (4simpleproblems) is the website hosting this AI Agent. Below is the detailed history of the platform's evolution:

**Version 1 — The Foundation of 4SP**
The first version of 4SP, launched on March 13, 2025, was a small, chaotic experiment that set the tone for everything that followed. Its purpose was simple yet rebellious: to give students something fun to do during long, dull school days. The site consisted of just two pages—a playful **20-sound soundboard** and an **autoclicker**—plus a request-a-sound page that allowed users to shape what came next. Though humble, V1 embodied the creative spirit of the entire project. It was coded quickly, without the polish or structure of later versions, but its charm lay in that raw energy. 4SP immediately stood out to classmates who were tired of restrictive school networks and wanted a space that felt student-made, not corporate. That identity—an underground, tech-savvy hub made by and for students—was born here and would remain central to every update that followed.

**Version 2 — Expansion and Community**
If V1 was an experiment, Version 2 was the first real step toward building a platform. Released April 11th, 2025, V2 added a surprising amount of depth: a media page, **playlists (beta)**, user-uploaded local soundboards, a growing library of games, and a **proxy list** that helped students slip past school restrictions. There were also new sections for links, sound requests, feedback, account settings, and legal/policy documents—marking the moment when 4SP stopped being a random hobby and became a fully recognized student ecosystem. This version is remembered for its chaotic variety: it was messy, colorful, and full of personality. Users could do everything from testing custom sounds to sharing ideas for new tools, and each page carried the unmistakable feeling of being built by someone who actually understood what students wanted. V2’s success proved that 4SP wasn’t just a novelty—it was a living project with a growing community and purpose.

**Version 3 — A Visual Reinvention**
V3, launched May 15, 2025, was the visual rebirth of 4SP. It didn’t add as many new pages as its predecessor, but it completely changed how the site looked and felt. Gone were the cluttered boxes and unrefined color schemes; in their place came a **white, clean grid layout with sharp corners**, inspired by modern tech design standards. This version focused on making 4SP feel mature and modern without losing its personality. It also introduced the now-beloved mini-game **Slotz**, which became a small sensation among users. V3’s visual overhaul was a statement: 4SP wasn’t just a fun side project anymore—it was a platform worthy of professional presentation. The update struck a balance between aesthetic discipline and youthful creativity, setting the design standard for every later version and inspiring the transition to an even more powerful dashboard system in V4.

**Version 4 — The Dashboard Era**
The launch of 4SP V4 on August 23, 2025 marked the project’s first major overhaul. The site transformed from a loose collection of pages into a unified **dashboard** experience complete with modular widgets and integrated apps. Students could check weather, time, and battery, run a stopwatch or timer, or use quick shortcuts—all within one sleek, modern layout. Entire apps like **Notes**, **Calculator**, **Countdowns**, and **Playlists** became part of the ecosystem. The new **Requests** app merged sound and feedback submissions, introducing a full upvote/downvote system and issue tracking for user ideas. V4 also added a **Settings** page with privacy-oriented tools like a **panic key** and **tab disguise mode**, showing how seriously the project took user safety in restricted environments. The design was heavily inspired by Koyeb, featuring the **Impact font** and a futuristic interface. V4 proved 4SP could be both functional and fun—a serious student toolkit with the heart of a playground.

**Version 5 — Project Zirconium and the Age of Integration (Slated for August 23, 2026)**
Now in development, 4SP V5 (Project Zirconium) represents the most ambitious leap yet. It draws design inspiration from Vercel, blending minimalism with power. The traditional sidebar layout is replaced with a **universal navigation bar** loaded dynamically via navbar.js, making the entire experience feel app-like and cohesive. The **dark, simplified black theme** and **Geist font** give the platform a professional, unified identity. Among its headline features are the **Combined Games Collection (4SP Games)**—where titles like StrongdogXP and GN – Math can be sorted by category—and a built-in **Dictionary** for quick lookups during study sessions. The exclusive **4SP AI Agent** debuts here, offering hidden intelligence tools accessible through secret shortcuts. V5 also introduces **Dailyphoto**, a student-friendly social network with post limits, friends, comments, and hearts, plus **Messenger V2**, featuring group chats, read/unread indicators, and smooth message management. With these tools—and possible future additions like a proxy—V5 fuses creativity, practicality, and connection. It completes the evolution from a soundboard for bored students into a full digital ecosystem: sleek, social, secure, and unmistakably 4SP.
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

        // Handle text content (after files, to ensure cursor is positioned correctly)
        if (text) {
            // If text is very long, treat it as a file/paste-to-file, otherwise paste inline
            if (text.length > PASTE_TO_FILE_THRESHOLD) {
                // Create a file-like object for large text
                const blob = new Blob([text], { type: 'text/plain' });
                const file = new File([blob], `Pasted_Text_${Date.now()}.txt`, { type: 'text/plain' });
                const reader = new FileReader();
                reader.onload = (event) => {
                    const base64Data = event.target.result.split(',')[1];
                    const dataUrl = event.target.result;
                    // Note: file.name is the generated name above
                    processFileLike(file, base64Data, dataUrl);
                };
                reader.readAsDataURL(file);

                // Insert a placeholder to show text was captured
                document.execCommand('insertText', false, `[${formatCharCount(text.length)} characters pasted as file]`);

            } else {
                document.execCommand('insertText', false, text);
            }
        }

        handleContentEditableInput({ target: editor });
    }

    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
    
    function handleInputSubmission(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitMessage();
        }
    }

    function extractCodeBlocks(text) {
        const parts = text.split(/```(\w+)?\n([\s\S]*?)```/g);
        let result = '';
        for (let i = 0; i < parts.length; i++) {
            if (i % 3 === 0) { // Text part
                result += parts[i];
            } else if (i % 3 === 2) { // Code part
                const language = parts[i - 1] || 'plaintext';
                const code = parts[i].trim();
                const escapedCode = escapeHTML(code);
                result += `
<div class="code-block-container">
    <div class="code-header">
        <span class="code-language">${language}</span>
        <button class="copy-code-btn" data-code="${btoa(code)}">${copyIconSVG}Copy</button>
    </div>
    <pre><code class="language-${language}">${escapedCode}</code></pre>
</div>
                `;
            }
        }
        return result;
    }

    function extractMathBlocks(text) {
        // Find display math blocks: $$...$$
        const displayReplaced = text.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
            const trimmedMath = math.trim();
            return `
<div class="latex-render display-math" data-tex="${escapeHTML(trimmedMath)}" data-display-mode="true">
    <div class="placeholder-math-text">$$${escapeHTML(trimmedMath)}$$</div>
</div>
`;
        });

        // Find inline math blocks: $...$ (ignoring escaped \$)
        const inlineReplaced = displayReplaced.replace(/(?<!\\)\$([^$\n]+?)(?<!\\)\$/g, (match, math) => {
            const trimmedMath = math.trim();
            return `<span class="latex-render inline-math" data-tex="${escapeHTML(trimmedMath)}" data-display-mode="false">
            <span class="placeholder-math-text-inline">$${escapeHTML(trimmedMath)}$</span>
            </span>`;
        });

        // Remove backslash escapes from remaining dollar signs
        return inlineReplaced.replace(/\\$/g, '$');
    }

    function extractGraphBlocks(text) {
        return text.replace(/```graph\n([\s\S]*?)```/g, (match, jsonString) => {
            try {
                const graphData = JSON.parse(jsonString.trim());
                const title = graphData.layout?.title || 'Generated Graph';
                const escapedJson = escapeHTML(jsonString.trim());
                
                // Canvas size is set by CSS
                return `
<div class="custom-graph-placeholder" data-graph-data='${escapedJson}'>
    <div class="graph-title">${escapeHTML(title)}</div>
    <canvas></canvas>
</div>
`;
            } catch (e) {
                console.error("Failed to parse graph JSON:", e);
                return `<div class="ai-error-inline">Graph Error: Invalid JSON data.</div>`;
            }
        });
    }

    function parseGeminiResponse(text) {
        // 1. Convert markdown to basic HTML (bold, italics, lists, headers)
        let html = text;

        // Escape HTML entities before processing markdown and code blocks
        html = html.replace(/&/g, '&amp;')
                   .replace(/</g, '&lt;')
                   .replace(/>/g, '&gt;')
                   .replace(/"/g, '&quot;')
                   .replace(/'/g, '&#39;');

        // 2. Extract and format code blocks first to protect their contents
        html = extractCodeBlocks(html);

        // 3. Extract and format graph blocks
        html = extractGraphBlocks(html);

        // 4. Extract and format math blocks
        html = extractMathBlocks(html);
        
        // 5. Basic Markdown to HTML conversion (excluding code/math areas)
        // **bold**
        html = html.replace(/\*\*([^\*]+?)\*\*/g, '<strong>$1</strong>');
        // *italics*
        html = html.replace(/\*([^\*]+?)\*/g, '<em>$1</em>');
        // _italics_
        html = html.replace(/_([^_]+?)_/g, '<em>$1</em>');
        // Headers (#, ##, ###)
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
        // Convert newlines to <br> but avoid double-br for paragraphs
        html = html.replace(/\n\n/g, '</p><p>');
        html = html.replace(/\n/g, '<br>');

        // 6. Wrap in paragraph tags
        html = `<p>${html}</p>`;

        return html;
    }

    function escapeHTML(str) {
        return str.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#39;');
    }
    
    function handleCopyCode(e) {
        const button = e.currentTarget;
        const encodedCode = button.getAttribute('data-code');
        
        if (!encodedCode) return;
        
        const code = atob(encodedCode);
        
        navigator.clipboard.writeText(code).then(() => {
            const originalHTML = button.innerHTML;
            button.innerHTML = `${checkIconSVG}Copied!`;
            button.classList.add('copied');
            
            setTimeout(() => {
                button.innerHTML = originalHTML;
                button.classList.remove('copied');
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            alert('Failed to copy code to clipboard.');
        });
    }

    async function submitMessage() {
        if (isRequestPending) return;

        const inputEditor = document.getElementById('ai-input');
        const query = inputEditor.innerText.trim();
        const charCount = query.length;

        if (charCount > CHAR_LIMIT) {
            alert(`Your message exceeds the character limit of ${formatCharLimit(CHAR_LIMIT)}.`);
            return;
        }

        if (!query && attachedFiles.length === 0) return;
        
        // 1. Prepare chat history parts
        let userMessageParts = [];
        if (query) {
            userMessageParts.push({ text: query });
        }
        attachedFiles.forEach(file => {
            if (file.inlineData) {
                userMessageParts.push({ inlineData: file.inlineData });
            }
        });

        // 2. Clear input and state
        inputEditor.innerHTML = '';
        inputEditor.style.height = 'auto'; // Reset height
        attachedFiles = [];
        renderAttachments();
        handleContentEditableInput({ target: inputEditor });

        // 3. Add message to history
        chatHistory.push({ role: "user", parts: userMessageParts });

        // 4. Update UI
        const responseContainer = document.getElementById('ai-response-container');
        if (responseContainer) {
            const welcome = document.getElementById('ai-welcome-message');
            if (welcome) welcome.style.display = 'none';

            const container = document.getElementById('ai-container');
            if (container) container.classList.add('chat-active');
        }
        renderChatHistory(); // Render user message

        // 5. Create loading bubble and set state
        const loadingBubble = document.createElement('div');
        loadingBubble.className = 'ai-message-bubble gemini-response loading';
        loadingBubble.innerHTML = `<div class="ai-loader"></div>`;
        responseContainer.appendChild(loadingBubble);
        responseContainer.scrollTop = responseContainer.scrollHeight;

        isRequestPending = true;
        inputEditor.contentEditable = false;
        const inputWrapper = document.getElementById('ai-input-wrapper');
        if (inputWrapper) { inputWrapper.classList.add('waiting'); }

        // 6. Call API
        await callGoogleAI(loadingBubble);
        responseContainer.scrollTop = responseContainer.scrollHeight;
    }

    /**
     * Injects CSS styles dynamically.
     */
    function injectStyles() {
        if (!document.getElementById('ai-dynamic-styles')) {
            // Load Font Awesome for the gear icon
            const fontAwesomeLink = document.createElement('link');
            fontAwesomeLink.rel = 'stylesheet';
            fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
            document.head.appendChild(fontAwesomeLink);
            
            // Load KaTeX CSS
            const katexCSSLink = document.createElement('link');
            katexCSSLink.rel = 'stylesheet';
            katexCSSLink.id = 'ai-katex-styles';
            katexCSSLink.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.css';
            document.head.appendChild(katexCSSLink);

            // Load Google Fonts
            const googleFonts = document.createElement('link');
            googleFonts.id = 'ai-google-fonts';
            googleFonts.rel = 'stylesheet';
            googleFonts.href = 'https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&family=Lora:wght@400;700&display=swap';
            document.head.appendChild(googleFonts);
            
            const style = document.createElement('style');
            style.id = 'ai-dynamic-styles';
            style.textContent = `
                /* --- BASE CONTAINER --- */
                #ai-container {
                    position: fixed;
                    bottom: 0;
                    right: 0;
                    width: 100%;
                    max-width: 450px;
                    height: 100%;
                    max-height: 0;
                    background: #1e1e1e;
                    border: 1px solid #333;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
                    z-index: 10000;
                    display: flex;
                    flex-direction: column;
                    transition: max-height 0.5s ease-out, transform 0.5s ease-out;
                    transform: translateY(100%);
                    font-family: 'Lora', Georgia, serif;
                    color: #fff;
                    border-top-left-radius: 12px;
                    border-top-right-radius: 12px;
                }

                #ai-container.active {
                    max-height: 80%;
                    transform: translateY(0);
                }

                #ai-container.deactivating {
                    max-height: 0;
                    transform: translateY(100%);
                }

                /* --- BRANDING / HEADER --- */
                #ai-brand-title {
                    position: absolute;
                    top: 15px;
                    left: 20px;
                    font-family: 'Merriweather', serif;
                    font-size: 18px;
                    font-weight: 700;
                    color: #fff;
                    opacity: 0;
                    pointer-events: none;
                    transition: opacity 0.5s;
                }
                #ai-brand-title span:nth-child(1) { color: #4285f4; }
                #ai-brand-title span:nth-child(2) { color: #db4437; }
                #ai-brand-title span:nth-child(3) { color: #f4b400; }
                #ai-brand-title span:nth-child(4) { color: #0f9d58; }

                #ai-persistent-title {
                    padding: 15px 50px 15px 20px;
                    font-family: 'Merriweather', serif;
                    font-size: 18px;
                    font-weight: 700;
                    color: #fff;
                    background-color: #282828;
                    border-top-left-radius: 12px;
                    border-top-right-radius: 12px;
                    border-bottom: 1px solid #333;
                    transition: opacity 0.3s;
                }
                #ai-container.chat-active #ai-persistent-title {
                    opacity: 1;
                }

                #ai-welcome-message {
                    padding: 20px;
                    text-align: center;
                    color: #ccc;
                    flex-shrink: 0;
                    transition: max-height 0.3s ease-in-out, opacity 0.3s ease-in-out;
                }
                #ai-welcome-message h2 {
                    margin-top: 0;
                    color: #f4b400;
                    font-family: 'Merriweather', serif;
                    font-weight: 700;
                    font-size: 1.5em;
                }
                #ai-welcome-message p {
                    font-size: 0.9em;
                    margin-bottom: 5px;
                    line-height: 1.4;
                }
                .shortcut-tip {
                    color: #555;
                    font-size: 0.8em;
                    margin-top: 10px;
                }
                #ai-welcome-message.hidden {
                    max-height: 0;
                    opacity: 0;
                    padding: 0 20px;
                    overflow: hidden;
                }

                /* --- CLOSE BUTTON --- */
                #ai-close-button {
                    position: absolute;
                    top: 15px;
                    right: 15px;
                    font-size: 24px;
                    color: #ccc;
                    cursor: pointer;
                    line-height: 1;
                    padding: 0 5px;
                    transition: color 0.2s;
                    z-index: 10001;
                }
                #ai-close-button:hover {
                    color: #fff;
                }

                /* --- RESPONSE AREA --- */
                #ai-response-container {
                    flex-grow: 1;
                    padding: 15px;
                    overflow-y: auto;
                    scrollbar-width: thin;
                    scrollbar-color: #555 #1e1e1e;
                }
                #ai-response-container::-webkit-scrollbar {
                    width: 8px;
                }
                #ai-response-container::-webkit-scrollbar-thumb {
                    background-color: #555;
                    border-radius: 4px;
                }
                #ai-response-container::-webkit-scrollbar-track {
                    background-color: #1e1e1e;
                }

                .ai-message-bubble {
                    max-width: 90%;
                    padding: 10px 15px;
                    margin: 8px 0;
                    border-radius: 18px;
                    line-height: 1.5;
                    font-size: 0.95em;
                    word-wrap: break-word;
                    opacity: 0;
                    animation: message-pop-in 0.3s ease-out forwards;
                }
                .ai-message-bubble:nth-child(1) { animation-delay: 0.1s; }
                .ai-message-bubble:nth-child(2) { animation-delay: 0.2s; }
                .ai-message-bubble:nth-child(3) { animation-delay: 0.3s; }
                .ai-message-bubble:nth-child(4) { animation-delay: 0.4s; }
                .ai-message-bubble:nth-child(5) { animation-delay: 0.5s; }

                .user-message {
                    background-color: #4285f4;
                    color: #fff;
                    margin-left: auto;
                    border-bottom-right-radius: 4px;
                    font-weight: 500;
                    text-align: right;
                }

                .gemini-response {
                    background-color: #333;
                    color: #ccc;
                    margin-right: auto;
                    border-bottom-left-radius: 4px;
                    text-align: left;
                }

                /* Response content styling */
                .ai-response-content {
                    font-size: 1em;
                }
                .ai-response-content p {
                    margin: 0;
                    padding: 0;
                    text-align: left;
                }
                .ai-response-content p + p {
                    margin-top: 10px;
                }
                .ai-response-content h1, .ai-response-content h2, .ai-response-content h3 {
                    margin-top: 1em;
                    margin-bottom: 0.5em;
                    color: #fff;
                    font-family: 'Merriweather', serif;
                    font-weight: 700;
                }
                .ai-response-content h1 { font-size: 1.4em; }
                .ai-response-content h2 { font-size: 1.2em; }
                .ai-response-content h3 { font-size: 1.1em; }

                /* List Styling */
                .ai-response-content ul, .ai-response-content ol {
                    margin: 10px 0 10px 20px;
                    padding: 0;
                }
                .ai-response-content li {
                    margin-bottom: 5px;
                }

                /* Loader */
                .ai-loader {
                    display: flex;
                    align-items: center;
                    justify-content: flex-start;
                    height: 20px;
                }
                .ai-loader::before, .ai-loader::after, .ai-loader div {
                    content: '';
                    width: 8px;
                    height: 8px;
                    margin: 0 2px;
                    background-color: #fff;
                    border-radius: 50%;
                    display: inline-block;
                    animation: bounce 1.4s infinite ease-in-out both;
                }
                .ai-loader div {
                    animation-delay: -0.32s;
                }
                .ai-loader::after {
                    animation-delay: -0.16s;
                }

                .ai-error {
                    color: #db4437;
                    font-weight: 700;
                    background-color: #440000;
                    padding: 5px;
                    border-radius: 8px;
                    text-align: center;
                }
                .ai-error-inline {
                    color: #db4437;
                    font-weight: 700;
                }

                /* --- COMPOSE AREA --- */
                #ai-compose-area {
                    flex-shrink: 0;
                    padding: 10px;
                    background-color: #282828;
                    border-top: 1px solid #333;
                    position: relative;
                }

                #ai-input-wrapper {
                    display: flex;
                    align-items: flex-end;
                    background-color: #333;
                    border-radius: 20px;
                    padding: 8px 10px;
                    transition: box-shadow 0.2s, background-color 0.2s;
                }
                #ai-input-wrapper.waiting {
                    opacity: 0.7;
                    pointer-events: none;
                }

                #ai-input {
                    flex-grow: 1;
                    min-height: 20px;
                    max-height: ${MAX_INPUT_HEIGHT}px;
                    overflow-y: auto;
                    color: #fff;
                    caret-color: #4285f4;
                    outline: none;
                    padding: 5px 8px;
                    margin-right: 5px;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                    font-size: 0.95em;
                    line-height: 1.4;
                    scrollbar-width: none; /* Firefox */
                }
                #ai-input:empty:before {
                    content: "Ask me anything...";
                    color: #888;
                }
                #ai-input:focus {
                    outline: none;
                }
                #ai-input::-webkit-scrollbar {
                    display: none; /* Chrome, Safari, Opera */
                }

                #ai-attachment-button, #ai-settings-button {
                    background: none;
                    border: none;
                    color: #ccc;
                    cursor: pointer;
                    padding: 0 5px;
                    transition: color 0.2s, transform 0.2s;
                    line-height: 1;
                    height: 20px;
                    width: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                #ai-attachment-button:hover, #ai-settings-button:hover {
                    color: #fff;
                }
                #ai-settings-button.active i {
                    color: #f4b400;
                    transform: rotate(90deg);
                }

                /* --- ATTACHMENTS PREVIEW --- */
                #ai-attachment-preview {
                    display: flex;
                    gap: 5px;
                    overflow-x: auto;
                    padding-bottom: 5px;
                    margin-bottom: 5px;
                    align-items: center;
                    background-color: #282828;
                    padding: 8px;
                    border-radius: 12px;
                    margin-bottom: 5px;
                }
                .attachment-card {
                    position: relative;
                    min-width: 60px;
                    height: 60px;
                    border-radius: 8px;
                    overflow: hidden;
                    border: 2px solid #555;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background-color: #444;
                    flex-shrink: 0;
                    transition: border-color 0.2s;
                }
                .attachment-card:hover {
                    border-color: #4285f4;
                }
                .attachment-card img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .attachment-card .file-icon {
                    font-size: 24px;
                }
                .attachment-card .remove-attachment-btn {
                    position: absolute;
                    top: -5px;
                    right: -5px;
                    background: #db4437;
                    color: #fff;
                    border: none;
                    border-radius: 50%;
                    width: 18px;
                    height: 18px;
                    line-height: 1;
                    cursor: pointer;
                    font-size: 14px;
                    opacity: 0;
                    transition: opacity 0.2s;
                }
                .attachment-card:hover .remove-attachment-btn {
                    opacity: 1;
                }
                .attachment-card.loading {
                    border-color: #f4b400;
                    pointer-events: none;
                }
                .attachment-card .ai-loader {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                }
                .attachment-card .file-info {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: rgba(0, 0, 0, 0.7);
                    color: #fff;
                    font-size: 0.7em;
                    padding: 2px 5px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .attachment-card .file-type-badge {
                    position: absolute;
                    top: 2px;
                    left: 2px;
                    background: #4285f4;
                    color: #fff;
                    font-size: 0.6em;
                    padding: 1px 4px;
                    border-radius: 3px;
                    font-weight: bold;
                }
                .file-name {
                    overflow: hidden;
                    white-space: nowrap;
                }
                .file-name.marquee span {
                    display: inline-block;
                    padding-right: 0.5em; /* Space between duplicates */
                    animation: marquee linear infinite;
                }

                /* File Preview Modal */
                #ai-preview-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.9);
                    z-index: 10002;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .modal-content {
                    background: #1e1e1e;
                    padding: 20px;
                    border-radius: 10px;
                    max-width: 90%;
                    max-height: 90%;
                    overflow: auto;
                    position: relative;
                    color: #fff;
                }
                .modal-content h3 {
                    margin-top: 0;
                    color: #f4b400;
                }
                .modal-content .close-button {
                    position: absolute;
                    top: 10px;
                    right: 15px;
                    font-size: 30px;
                    cursor: pointer;
                    color: #ccc;
                }
                .download-button {
                    display: inline-block;
                    margin-top: 15px;
                    padding: 10px 20px;
                    background-color: #4285f4;
                    color: #fff;
                    text-decoration: none;
                    border-radius: 5px;
                }


                /* --- SETTINGS MENU --- */
                #ai-settings-menu {
                    position: absolute;
                    bottom: 100%;
                    right: 10px;
                    width: 300px;
                    background: #333;
                    border-radius: 8px;
                    padding: 15px;
                    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
                    transform: translateY(10px);
                    opacity: 0;
                    pointer-events: none;
                    transition: all 0.2s ease-out;
                    z-index: 9999;
                    border: 1px solid #444;
                }
                #ai-settings-menu.active {
                    transform: translateY(-5px);
                    opacity: 1;
                    pointer-events: all;
                }
                .menu-header {
                    font-family: 'Merriweather', serif;
                    font-size: 1.2em;
                    font-weight: 700;
                    color: #f4b400;
                    margin-bottom: 15px;
                    border-bottom: 1px solid #444;
                    padding-bottom: 8px;
                }
                .setting-group {
                    margin-bottom: 12px;
                }
                .setting-group-split {
                    display: flex;
                    gap: 10px;
                }
                .setting-group-split .setting-group {
                    flex: 1;
                }
                #ai-settings-menu label {
                    display: block;
                    font-size: 0.9em;
                    margin-bottom: 3px;
                    color: #ccc;
                }
                #ai-settings-menu input, #ai-settings-menu select {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid #555;
                    background-color: #444;
                    color: #fff;
                    border-radius: 4px;
                    box-sizing: border-box;
                }
                #ai-settings-menu input[type="color"] {
                    height: 34px;
                    padding: 0;
                }
                .setting-note {
                    font-size: 0.75em;
                    color: #888;
                    margin-top: 2px;
                    margin-bottom: 0;
                }
                #settings-save-button {
                    width: 100%;
                    padding: 10px;
                    background-color: #4285f4;
                    color: #fff;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    margin-top: 10px;
                    font-weight: 700;
                    transition: background-color 0.2s;
                }
                #settings-save-button:hover {
                    background-color: #3b78e7;
                }

                /* --- CODE BLOCK STYLING --- */
                .code-block-container {
                    background-color: #222;
                    border-radius: 8px;
                    margin: 15px 0;
                    overflow: hidden;
                    border: 1px solid #444;
                }
                .code-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 5px 10px;
                    background-color: #333;
                    border-bottom: 1px solid #444;
                    font-size: 0.8em;
                    color: #ccc;
                }
                .copy-code-btn {
                    background: none;
                    border: none;
                    color: #4285f4;
                    cursor: pointer;
                    font-size: 1em;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    transition: color 0.2s;
                    font-family: inherit;
                }
                .copy-code-btn:hover {
                    color: #fff;
                }
                .copy-code-btn.copied {
                    color: #0f9d58;
                }
                .copy-code-btn svg {
                    width: 14px;
                    height: 14px;
                }
                .code-block-container pre {
                    margin: 0;
                    padding: 10px;
                    overflow-x: auto;
                    color: #f8f8f2;
                    font-family: monospace;
                    font-size: 0.9em;
                }

                /* --- MATH BLOCK STYLING --- */
                .latex-render.display-math {
                    margin: 10px 0;
                    padding: 10px;
                    background-color: #222;
                    border: 1px solid #444;
                    border-radius: 6px;
                    overflow-x: auto;
                    text-align: center;
                }
                .latex-render.inline-math {
                    display: inline-block;
                    margin: 0 2px;
                    vertical-align: middle;
                }
                .placeholder-math-text, .placeholder-math-text-inline {
                    font-family: monospace;
                    font-size: 0.9em;
                    color: #f4b400;
                }

                /* --- GRAPH STYLING --- */
                .custom-graph-placeholder {
                    width: 100%;
                    height: 300px; 
                    background-color: #1e1e1e;
                    border: 1px solid #4285f4;
                    border-radius: 8px;
                    margin: 15px 0;
                    overflow: hidden;
                    position: relative;
                }
                .custom-graph-placeholder canvas {
                    width: 100%;
                    height: 100%;
                    display: block;
                }
                .graph-title {
                    position: absolute;
                    top: 10px;
                    width: 100%;
                    text-align: center;
                    font-family: 'Merriweather', serif;
                    font-size: 1.1em;
                    font-weight: 700;
                    color: #fff;
                }

                /* --- SENT ATTACHMENTS --- */
                .sent-attachments {
                    font-size: 0.8em;
                    color: #ccc;
                    margin-top: 5px;
                    padding-top: 5px;
                    border-top: 1px solid rgba(255, 255, 255, 0.2);
                    text-align: right;
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
