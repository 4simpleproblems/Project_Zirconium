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
 * NEW: Added a graphing mode using Plotly.js for interactive data visualization.
 */
(function() {
    // --- CONFIGURATION ---
    const API_KEY = 'AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro'; 
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
    const MAX_INPUT_HEIGHT = 200;
    const CHAR_LIMIT = 10000;
    const PASTE_TO_FILE_THRESHOLD = 1000;
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
     * Renders interactive graphs using Plotly.js.
     * @param {HTMLElement} container The parent element to search for graph placeholders.
     */
    function renderGraphs(container) {
        if (typeof Plotly === 'undefined') {
            console.warn("Plotly not loaded, skipping render.");
            return;
        }
        container.querySelectorAll('.plotly-graph-placeholder').forEach(element => {
            try {
                const graphData = JSON.parse(element.dataset.graphData);
                const layout = {
                    ...(graphData.layout || {}),
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(255,255,255,0.05)',
                    font: { color: '#ccc' },
                    xaxis: { ...(graphData.layout?.xaxis || {}), gridcolor: 'rgba(255,255,255,0.1)' },
                    yaxis: { ...(graphData.layout?.yaxis || {}), gridcolor: 'rgba(255,255,255,0.1)' }
                };
                Plotly.newPlot(element, graphData.data, layout, {responsive: true});
            } catch (e) {
                console.error("Plotly rendering error:", e);
                element.textContent = `[Plotly Error] Invalid graph data provided.`;
            }
        });
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
        
        // --- Add KaTeX and Plotly ---
        const plotlyScript = document.createElement('script');
        plotlyScript.src = 'https://cdn.plot.ly/plotly-2.12.1.min.js';
        container.appendChild(plotlyScript);

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
    
    function getDynamicSystemInstruction(query, settings) {
        const user = settings.nickname;
        const userAge = settings.age > 0 ? `${settings.age} years old` : 'of unknown age';
        const userGender = settings.gender.toLowerCase();
        const userColor = settings.favoriteColor;

        let instruction = `You are a highly adaptable AI assistant. Your primary goal is to respond with the appropriate tone and persona matching the user's current query and mood.
User Profile: Nickname: ${user}, Age: ${userAge}, Gender: ${userGender}, Favorite Color (used for subtle theming inspiration): ${userColor}.
Adapt your persona and tone for each turn.

Formatting Rules:
- For math, use KaTeX. Inline math uses single \`$\`, and display math uses double \`$$\`. Use \\le for <= and \\ge for >=.
- For graphs, use a 'graph' block. Provide the data and layout as a JSON object that Plotly.js can understand. Example:
\`\`\`graph
{
  "data": [
    {
      "x": [-2, -1, 0, 1, 2, 3],
      "y": [-3, -2, -1, 0, 1, 2],
      "type": "scatter",
      "mode": "lines+markers",
      "name": "y = x - 1",
      "line": {"color": "#ff0000"}
    }
  ],
  "layout": {
    "title": "Graph of y = x - 1",
    "xaxis": {"title": "x"},
    "yaxis": {"title": "y"},
    "hovermode": "closest"
  }
}
\`\`\`
`;

        const lowerQuery = query.toLowerCase();

        if (lowerQuery.includes('math') || lowerQuery.includes('algebra') || lowerQuery.includes('calculus') || lowerQuery.includes('formula') || lowerQuery.includes('solve') || lowerQuery.includes('proof') || lowerQuery.includes('graph')) {
            instruction += `\n\n**Current Persona: Technical Expert.** Respond with extreme clarity, professionalism, and precision. Focus on step-by-step logic, equations, and definitive answers. Use a formal, neutral tone. Use KaTeX and Plotly graphs where appropriate.`;
        } else if (lowerQuery.includes('code') || lowerQuery.includes('javascript') || lowerQuery.includes('python') || lowerQuery.includes('html') || lowerQuery.includes('debug')) {
            instruction += `\n\n**Current Persona: Coding Specialist.** Provide complete, runnable code examples. Explain technical concepts clearly, covering logic, structure, and edge cases. Be thorough and objective.`;
        } else if (lowerQuery.includes('ex') || lowerQuery.includes('breakup') || lowerQuery.includes('hate') || lowerQuery.includes('awful') || lowerQuery.includes('trash talk') || lowerQuery.includes('roast')) {
            const roastInsults = [
                `They sound like a cheap knock-off of a decent human.`, 
                `Honestly, you dodged a bullet the size of a planet.`, 
                `Forget them, ${user}, you have better things to do, like talking to me.`,
                `Wow, good riddance. That's a level of trash I wouldn't touch with a ten-foot pole.`
            ];
            const roastInsult = roastInsults[Math.floor(Math.random() * roastInsults.length)];

            instruction += `\n\n**Current Persona: Sarcastic, Supportive Friend.** Your goal is to empathize with the user, validate their feelings, and join them in 'roasting' or speaking negatively about their ex/situation. Be funny, slightly aggressive toward the subject of the trash talk, and deeply supportive of ${user}. Use casual language and slang. **Example of tone/support:** "${roastInsult}"`;
        } else if (lowerQuery.includes('story') || lowerQuery.includes('poem') || lowerQuery.includes('imagine') || lowerQuery.includes('creative')) {
            instruction += `\n\n**Current Persona: Creative Partner.** Use rich, evocative language. Be imaginative, focus on descriptive details, and inspire new ideas.`;
        } else {
            instruction += `\n\n**Current Persona: Standard Assistant.** You are balanced, helpful, and comprehensive. Use a friendly but professional tone.`;
        }

        return instruction;
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
            firstMessageContext = `(System Info: User is asking from ${location}. Current date is ${date}, ${time}.)\n\n`;
        }
        
        let processedChatHistory = [...chatHistory];
        if (processedChatHistory.length > 6) {
             processedChatHistory = [ ...processedChatHistory.slice(0, 3), ...processedChatHistory.slice(-3) ];
        }

        const lastMessageIndex = processedChatHistory.length - 1;
        const userParts = processedChatHistory[lastMessageIndex].parts;
        const textPartIndex = userParts.findIndex(p => p.text);
        
        const lastUserQuery = userParts[textPartIndex]?.text || '';
        const dynamicInstruction = getDynamicSystemInstruction(lastUserQuery, userSettings);
        
        if (textPartIndex > -1) {
             userParts[textPartIndex].text = firstMessageContext + userParts[textPartIndex].text;
        } else if (firstMessageContext) {
             userParts.unshift({ text: firstMessageContext.trim() });
        }
        
        const payload = { 
            contents: processedChatHistory, 
            systemInstruction: { parts: [{ text: dynamicInstruction }] } 
        };
        
        try {
            const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: currentAIRequestController.signal });
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

        const nickname = nicknameEl.value.trim();
        const age = parseInt(ageEl.value);
        const gender = genderEl.value;
        const favoriteColor = colorEl.value || DEFAULT_COLOR;

        userSettings.nickname = nickname || DEFAULT_NICKNAME;
        userSettings.age = (isNaN(age) || age < 0) ? 0 : age;
        userSettings.gender = gender;
        userSettings.favoriteColor = favoriteColor;
        
        localStorage.setItem('ai-user-settings', JSON.stringify(userSettings));
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
                saveSettings();
                toggleSettingsMenu(); 
            }
            
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
    
        // 1. Extract graph blocks (most specific)
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
            } catch(e) { /* Ignore parsing errors */ }

            const escapedData = escapeHTML(jsonString);
            const content = `
                <div class="graph-block-wrapper">
                    <div class="graph-block-header">
                        <span class="graph-metadata">${metadata}</span>
                    </div>
                    <div class="plotly-graph-placeholder" data-graph-data='${escapedData}'></div>
                </div>
            `;
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
                </div>
            `;
            return addPlaceholder(content);
        });

        // 3. Extract KaTeX blocks BEFORE escaping general HTML
        // Display mode: $$...$$
        html = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
            const content = `<div class="latex-render" data-tex="${escapeHTML(formula)}" data-display-mode="true"></div>`;
            return addPlaceholder(content);
        });
        // Inline mode: $...$
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
        
        return html;
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
            #ai-container { 
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; 
                background-color: rgba(10, 10, 15, 0.95);
                backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); 
                z-index: 2147483647; opacity: 0; transition: opacity 0.5s, background 0.5s; 
                font-family: 'Lora', serif; display: flex; flex-direction: column; 
                justify-content: flex-end; padding: 0; box-sizing: border-box; overflow: hidden; 
            }
            #ai-container.active { opacity: 1; }
            #ai-container.deactivating, #ai-container.deactivating > * { transition: opacity 0.4s, transform 0.4s; }
            #ai-container.deactivating { opacity: 0 !important; background-color: rgba(0,0,0,0); backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); }
            #ai-persistent-title, #ai-brand-title { 
                position: absolute; top: 28px; left: 30px; font-family: 'Lora', serif; 
                font-size: 18px; font-weight: bold; color: #FFFFFF;
                opacity: 0; transition: opacity 0.5s 0.2s, color 0.5s; 
            }
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
            .gemini-response { animation: glow 4s infinite; }
            .gemini-response.loading { display: flex; justify-content: center; align-items: center; min-height: 60px; max-width: 100px; padding: 15px; background: rgba(15,15,18,.8); animation: gemini-glow 4s linear infinite; }
            
            #ai-compose-area { position: relative; flex-shrink: 0; z-index: 2; margin: 15px auto; width: 90%; max-width: 720px; }
            #ai-input-wrapper { position: relative; z-index: 2; width: 100%; display: flex; flex-direction: column; border-radius: 20px; background: rgba(10,10,10,.7); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,.2); transition: all .4s cubic-bezier(.4,0,.2,1); }
            #ai-input-wrapper::before, #ai-input-wrapper::after { content: ''; position: absolute; top: -1px; left: -1px; right: -1px; bottom: -1px; border-radius: 21px; z-index: -1; transition: opacity 0.5s ease-in-out; }
            #ai-input-wrapper::before { animation: glow 3s infinite; opacity: 1; }
            #ai-input-wrapper.waiting::before { opacity: 0; }
            #ai-input-wrapper.waiting::after { opacity: 1; }
            #ai-input { min-height: 48px; max-height: ${MAX_INPUT_HEIGHT}px; overflow-y: hidden; color: #fff; font-size: 1.1em; padding: 13px 60px 13px 60px; box-sizing: border-box; word-wrap: break-word; outline: 0; text-align: left; }
            #ai-input:empty::before { content: 'Ask a question or describe your files...'; color: rgba(255, 255, 255, 0.4); pointer-events: none; }
            
            #ai-attachment-button, #ai-settings-button { position: absolute; bottom: 7px; background-color: rgba(100, 100, 100, 0.5); border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,.8); font-size: 18px; cursor: pointer; padding: 5px; line-height: 1; z-index: 3; transition: all .3s ease; border-radius: 8px; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; }
            #ai-attachment-button { left: 10px; }
            #ai-settings-button { right: 10px; font-size: 20px; color: #ccc; }
            #ai-attachment-button:hover, #ai-settings-button:hover { background-color: rgba(120, 120, 120, 0.7); color: #fff; }
            #ai-settings-button.active { background-color: rgba(150, 150, 150, 0.8); color: white; }

            /* Settings Menu */
            #ai-settings-menu { position: absolute; bottom: calc(100% + 10px); right: 0; width: 350px; z-index: 1; background: rgb(20, 20, 22); border: 1px solid rgba(255,255,255,0.2); border-radius: 16px; box-shadow: 0 5px 25px rgba(0,0,0,0.5); padding: 15px; opacity: 0; visibility: hidden; transform: translateY(20px); transition: all .3s cubic-bezier(.4,0,.2,1); overflow: hidden; }
            #ai-settings-menu.active { opacity: 1; visibility: visible; transform: translateY(0); }
            #ai-settings-menu .menu-header { font-size: 1.1em; color: #fff; text-transform: uppercase; margin-bottom: 15px; text-align: center; font-family: 'Merriweather', serif; }
            .setting-group { margin-bottom: 15px; }
            .setting-group-split { display: flex; gap: 15px; }
            .setting-group-split .setting-group { flex: 1; }
            .setting-group label { display: block; color: #ccc; font-size: 0.9em; margin-bottom: 5px; font-weight: bold; }
            .setting-group input, .setting-group select { width: 100%; padding: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: #fff; box-sizing: border-box; }
            .setting-group input:focus, .setting-group select:focus { outline: none; border-color: #4285f4; }
            .setting-note { font-size: 0.75em; color: #888; margin-top: 5px; }
            #settings-color { width: 100%; height: 40px; padding: 0; cursor: pointer; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; background: none; }
            #settings-color::-webkit-color-swatch-wrapper { padding: 0; }
            #settings-color::-webkit-color-swatch { border: 0; border-radius: 5px; }
            #settings-save-button { width: 100%; padding: 10px; background: #4285f4; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 1em; margin-top: 10px; transition: background 0.2s; }
            #settings-save-button:hover { background: #3c77e6; }

            /* Attachments, Code Blocks, Graphs, LaTeX */
            #ai-attachment-preview { display: none; flex-direction: row; gap: 10px; padding: 0; max-height: 0; border-bottom: 1px solid transparent; overflow-x: auto; transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
            #ai-input-wrapper.has-attachments #ai-attachment-preview { max-height: 100px; padding: 10px 15px; }
            .attachment-card { position: relative; border-radius: 8px; overflow: hidden; background: #333; height: 80px; width: 80px; flex-shrink: 0; display: flex; justify-content: center; align-items: center; transition: filter 0.3s; cursor: pointer; }
            .attachment-card.loading { filter: grayscale(80%) brightness(0.7); }
            .attachment-card.loading .file-icon { opacity: 0.3; }
            .attachment-card.loading .ai-loader { position: absolute; z-index: 2; }
            .attachment-card img { width: 100%; height: 100%; object-fit: cover; }
            .file-info { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.6); overflow: hidden; }
            .file-name { display: block; color: #fff; font-size: 0.75em; padding: 4px; text-align: center; white-space: nowrap; }
            .file-name.marquee > span { display: inline-block; padding-left: 100%; animation: marquee linear infinite; }
            .file-type-badge { position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.6); color: #fff; font-size: 0.7em; padding: 2px 5px; border-radius: 4px; font-family: sans-serif; font-weight: bold; }
            .remove-attachment-btn { position: absolute; top: 5px; left: 5px; background: rgba(0,0,0,0.5); color: #fff; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; z-index: 3; }

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
            .plotly-graph-placeholder { min-height: 400px; }

            .latex-render { display: inline-block; } /* default to inline */
            .ai-response-content div.latex-render { display: block; margin: 10px 0; text-align: center; } /* for display mode */
            .katex { font-size: 1.1em !important; }

            #ai-preview-modal { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: rgba(0, 0, 0, 0.8); backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px); z-index: 2147483648; display: flex; justify-content: center; align-items: center; }
            #ai-preview-modal .modal-content { background: #1a1a1e; border-radius: 12px; padding: 20px; box-shadow: 0 5px 30px rgba(0,0,0,0.7); max-width: 90vw; max-height: 90vh; display: flex; flex-direction: column; position: relative; }
            #ai-preview-modal .close-button { position: absolute; top: 10px; right: 15px; color: #ccc; font-size: 30px; cursor: pointer; }
            #ai-preview-modal h3 { color: #fff; margin-top: 0; margin-bottom: 15px; text-align: center; }
            #ai-preview-modal .preview-area { flex-grow: 1; display: flex; justify-content: center; align-items: center; overflow: hidden; }
            #ai-preview-modal .download-button { display: inline-block; padding: 10px 20px; background-color: var(--ai-blue); color: #fff; text-decoration: none; border-radius: 8px; margin-top: 20px; }

            .ai-message-bubble p { margin: 0; padding: 0; text-align: left; }
            .ai-message-bubble ul, .ai-message-bubble ol { margin: 10px 0; padding-left: 20px; text-align: left; list-style-position: outside; }
            .ai-message-bubble li { margin-bottom: 5px; }

            @keyframes glow { 0%,100% { box-shadow: 0 0 5px rgba(255,255,255,.15), 0 0 10px rgba(255,255,255,.1); } 50% { box-shadow: 0 0 10px rgba(255,255,255,.25), 0 0 20px rgba(255,255,255,.2); } }
            @keyframes gemini-glow { 0%,100% { box-shadow: 0 0 8px 2px var(--ai-blue); } 25% { box-shadow: 0 0 8px 2px var(--ai-green); } 50% { box-shadow: 0 0 8px 2px var(--ai-yellow); } 75% { box-shadow: 0 0 8px 2px var(--ai-red); } }
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes message-pop-in { 0% { opacity: 0; transform: translateY(10px) scale(.98); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes brand-title-pulse { 0%, 100% { text-shadow: 0 0 7px var(--ai-blue); } 25% { text-shadow: 0 0 7px var(--ai-green); } 50% { text-shadow: 0 0 7px var(--ai-yellow); } 75% { text-shadow: 0 0 7px var(--ai-red); } }
            @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }
        `;
    document.head.appendChild(style);}
    
    document.addEventListener('keydown', handleKeyDown);

    document.addEventListener('DOMContentLoaded', async () => {
        loadUserSettings();
    });
})();

