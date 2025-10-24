/**
 * agent-activation.js
 *
 * MODIFIED: Removed complex persona, gender/age, and creative features for a simpler,
 * professional assistant.
 * MODIFIED: Replaced the old Settings Menu with a simplified one for Location Sharing
 * and Web Grounding (Search) Toggles, storing preferences in localStorage.
 * NEW: Implemented Web Grounding (Search) integration into the API call based on a toggle.
 * NEW: Added logic to parse and display a 'Sources' section at the end of the AI's response,
 * making source URLs clickable.
 * REMOVED: All code related to KaTeX, custom graphing, file handling, and chat history trimming
 * has been removed to simplify the core agent function as requested.
 * UPDATED: Model choice simplified to only 'gemini-2.5-flash' for all queries.
 * FIXED: Removed the non-standard 'sources' field from chat history sent to the Gemini API payload.
 */
(function() {
    // --- CONFIGURATION ---
    const API_KEY = 'AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro';
    // Use gemini-2.5-flash as the standard model for all requests
    const BASE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
    const AUTHORIZED_PRO_USER = '4simpleproblems@gmail.com'; // Kept for auth check consistency, but Pro model is removed.
    const MAX_INPUT_HEIGHT = 180;
    const CHAR_LIMIT = 10000;

    const DEFAULT_NICKNAME = 'User';
    // Removed color, gender, age defaults

    // --- ICONS (for event handlers) ---
    const copyIconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="copy-icon"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    const checkIconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="check-icon"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    const attachmentIconSVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.2a2 2 0 0 1-2.83-2.83l8.49-8.49"></path></svg>`;

    // --- STATE MANAGEMENT ---
    let isAIActive = false;
    let isRequestPending = false;
    let currentAIRequestController = null;
    let chatHistory = [];
    let attachedFiles = []; // Kept for file upload logic, but not the focus
    let userSettings = {
        nickname: DEFAULT_NICKNAME,
        // New, simplified settings
        shareLocation: true,
        webSearchEnabled: true
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
            const storedSettings = localStorage.getItem('ai-user-settings-simple');
            if (storedSettings) {
                userSettings = { ...userSettings, ...JSON.parse(storedSettings) };
                // Ensure booleans are correctly typed
                userSettings.shareLocation = userSettings.shareLocation === 'true' || userSettings.shareLocation === true;
                userSettings.webSearchEnabled = userSettings.webSearchEnabled === 'true' || userSettings.webSearchEnabled === true;
            } else {
                 // Load old nickname for backward compatibility if new settings don't exist
                 const oldSettings = localStorage.getItem('ai-user-settings');
                 if(oldSettings) {
                     const parsedOld = JSON.parse(oldSettings);
                     userSettings.nickname = parsedOld.nickname || DEFAULT_NICKNAME;
                 }
            }
        } catch (e) {
            console.error("Error loading user settings:", e);
        }
    }
    loadUserSettings(); // Load initial settings

    // --- UTILITY/STUB FUNCTIONS ---

    async function isUserAuthorized() {
        return true;
    }

    function getUserLocationForContext() {
        if (!userSettings.shareLocation) return 'Location Sharing Disabled';
        let location = localStorage.getItem('ai-user-location');
        if (!location) {
            location = 'United States';
            localStorage.setItem('ai-user-location', location);
        }
        return location;
    }

    // REMOVED: renderKaTeX, renderGraphs, drawCustomGraph (Per request to remove features)

    // --- END UTILITY/STUB FUNCTIONS ---

    /**
     * Handles the Ctrl + \ shortcut for AI activation/deactivation.
     */
    async function handleKeyDown(e) {
        if (e.ctrlKey && e.key === '\\') {
            const selection = window.getSelection().toString();
            if (isAIActive) {
                if (selection.length > 0) { return; }
                e.preventDefault();
                const mainEditor = document.getElementById('ai-input');
                // Simplified deactivation check
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
        if (typeof window.startPanicKeyBlocker === 'function') { window.startPanicKeyBlocker(); }

        // Clear files to ensure a fresh session
        attachedFiles = [];
        injectStyles();

        const container = document.createElement('div');
        container.id = 'ai-container';

        // Title elements setup (simplified)
        const brandTitle = document.createElement('div');
        brandTitle.id = 'ai-brand-title';
        brandTitle.textContent = "4SP - AI AGENT";

        const persistentTitle = document.createElement('div');
        persistentTitle.id = 'ai-persistent-title';
        persistentTitle.textContent = "AI Agent"; // Fixed title

        const welcomeMessage = document.createElement('div');
        welcomeMessage.id = 'ai-welcome-message';
        const welcomeHeader = chatHistory.length > 0 ? "Welcome Back" : "Welcome to AI Agent";
        welcomeMessage.innerHTML = `<h2>${welcomeHeader}</h2><p>This is a simplified, professional agent. Web searching is currently ${userSettings.webSearchEnabled ? 'ON' : 'OFF'}.</p><p class="shortcut-tip">(Press Ctrl + \\ to close)</p>`;

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
        visualInput.addEventListener('paste', handlePaste); // Kept paste logic for text/image

        const attachmentButton = document.createElement('button');
        attachmentButton.id = 'ai-attachment-button';
        attachmentButton.innerHTML = attachmentIconSVG;
        attachmentButton.title = 'Attach files';
        attachmentButton.onclick = () => handleFileUpload(); // Kept file upload for attachments

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

        // REMOVED: KaTeX script addition

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
                // Clean up styles
                const styles = document.getElementById('ai-dynamic-styles');
                if (styles) styles.remove();
                const fonts = document.getElementById('ai-google-fonts');
                if (fonts) fonts.remove();
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
                // message.sources is used here
                const parsedResponse = parseGeminiResponse(message.parts[0].text, message.sources);
                bubble.innerHTML = `<div class="ai-response-content">${parsedResponse}</div>`;

                bubble.querySelectorAll('.copy-code-btn').forEach(button => {
                    button.addEventListener('click', handleCopyCode);
                });

                // REMOVED: renderKaTeX, renderGraphs
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
     * Generates a simplified system instruction (Professional-only).
     * @returns {{instruction: string, model: string}}
     */
    function getDynamicSystemInstructionAndModel() {
        const user = userSettings.nickname;
        const location = userSettings.shareLocation ? getUserLocationForContext() : 'Unknown Location (Sharing Disabled)';
        const userEmail = localStorage.getItem('ai-user-email') || 'Not authenticated';
        const model = 'gemini-2.5-flash';

        const personaInstruction = `You are the professional and highly capable AI Agent for the website 4SP (4simpleproblems).
Your primary function is to provide clear, concise, and accurate information, acting as a general-purpose, authoritative assistant.
The user is referred to as **${user}**.
Your response should be direct and professional. Use markdown for formatting, including headings, bold text, and bullet points.

User Environment Context:
- User Nickname: ${user}
- User Location: ${location}
- User Email: ${userEmail}
`;

        return { instruction: personaInstruction, model: model };
    }

    async function callGoogleAI(responseBubble) {
        if (!API_KEY) { responseBubble.innerHTML = `<div class="ai-error">API Key is missing.</div>`; return; }
        currentAIRequestController = new AbortController();

        let processedChatHistory = [...chatHistory];
        // Only keep the last 4 exchanges (8 messages total) for short-term memory
        if (processedChatHistory.length > 8) {
             processedChatHistory = processedChatHistory.slice(processedChatHistory.length - 8);
        }
        
        // FIX: The API rejects custom fields like 'sources' in the 'contents' array.
        // We strip non-API fields from the history before sending.
        const apiChatHistory = processedChatHistory.map(message => {
            const apiMessage = { role: message.role, parts: message.parts };
            // Do not include message.sources, message.id, etc., in the API payload
            return apiMessage;
        });


        // --- MODEL SELECTION AND INSTRUCTION GENERATION ---
        const { instruction: dynamicInstruction } = getDynamicSystemInstructionAndModel();
        // --- END MODEL SELECTION ---

        const payload = {
            contents: apiChatHistory, // Use the cleaned history
            systemInstruction: { parts: [{ text: dynamicInstruction }] }
        };

        // --- WEB GROUNDING INTEGRATION ---
        if (userSettings.webSearchEnabled) {
            payload.tools = [{ googleSearch: {} }];
        }
        // --- END WEB GROUNDING INTEGRATION ---

        try {
            const response = await fetch(BASE_API_URL, {
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

            const candidate = data.candidates[0];
            const text = candidate.content.parts[0]?.text || '';
            const sources = candidate.groundingMetadata?.groundingChunks || candidate.groundingMetadata?.web?.uri || null; // API can return a list of chunks or a single URI array for web

            if (!text) {
                responseBubble.innerHTML = `<div class="ai-error">The AI generated an empty response. Please try again or rephrase.</div>`;
                return;
            }
            
            // Push to local chatHistory including the sources for rendering
            chatHistory.push({ role: "model", parts: [{ text: text }], sources: sources });

            const contentHTML = `<div class="ai-response-content">${parseGeminiResponse(text, sources)}</div>`;
            responseBubble.style.opacity = '0';
            setTimeout(() => {
                responseBubble.innerHTML = contentHTML;
                responseBubble.querySelectorAll('.copy-code-btn').forEach(button => {
                    button.addEventListener('click', handleCopyCode);
                });
                responseBubble.style.opacity = '1';

                // REMOVED: renderKaTeX, renderGraphs
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

    // --- NEW/MODIFIED SETTINGS MENU LOGIC ---
    function toggleSettingsMenu() {
        const menu = document.getElementById('ai-settings-menu');
        const toggleBtn = document.getElementById('ai-settings-button');
        const isMenuOpen = menu.classList.toggle('active');
        toggleBtn.classList.toggle('active', isMenuOpen);
        if (isMenuOpen) {
            // Initialize input values from current userSettings
            document.getElementById('settings-nickname').value = userSettings.nickname === DEFAULT_NICKNAME ? '' : userSettings.nickname;
            document.getElementById('settings-location-toggle').checked = userSettings.shareLocation;
            document.getElementById('settings-websearch-toggle').checked = userSettings.webSearchEnabled;
            document.getElementById('settings-email').value = localStorage.getItem('ai-user-email') || ''; // Email kept for auth context

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
        const locationToggleEl = document.getElementById('settings-location-toggle');
        const websearchToggleEl = document.getElementById('settings-websearch-toggle');
        const emailEl = document.getElementById('settings-email');

        const nickname = nicknameEl.value.trim();
        const email = emailEl.value.trim();

        userSettings.nickname = nickname || DEFAULT_NICKNAME;
        userSettings.shareLocation = locationToggleEl.checked;
        userSettings.webSearchEnabled = websearchToggleEl.checked;

        localStorage.setItem('ai-user-settings-simple', JSON.stringify(userSettings));
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
                <p class="setting-note">Set to '${AUTHORIZED_PRO_USER}' for maximal access (Pro model removed, but context remains).</p>
            </div>
            <div class="setting-toggle-group">
                <div class="setting-toggle-item">
                    <label for="settings-location-toggle">Share General Location</label>
                    <input type="checkbox" id="settings-location-toggle" ${userSettings.shareLocation ? 'checked' : ''}>
                </div>
                <p class="setting-note">Toggles sharing your general location (e.g., country/state) with the AI for context.</p>
            </div>
            <div class="setting-toggle-group">
                <div class="setting-toggle-item">
                    <label for="settings-websearch-toggle">Enable Web Grounding (Search)</label>
                    <input type="checkbox" id="settings-websearch-toggle" ${userSettings.webSearchEnabled ? 'checked' : ''}>
                </div>
                <p class="setting-note">Allows the AI to search the web for live, up-to-date information.</p>
            </div>
            <button id="settings-save-button">Save & Close</button>
        `;

        const saveButton = menu.querySelector('#settings-save-button');
        const inputs = menu.querySelectorAll('input:not([type="checkbox"]), select'); // Nickname and email inputs

        // Debounce save for text inputs
        const debouncedSave = debounce(saveSettings, 500);
        inputs.forEach(input => {
            input.addEventListener('input', debouncedSave);
        });

        // Save immediately on toggle change
        menu.querySelector('#settings-location-toggle').addEventListener('change', saveSettings);
        menu.querySelector('#settings-websearch-toggle').addEventListener('change', saveSettings);

        saveButton.onclick = () => {
            saveSettings();
            toggleSettingsMenu();
        };

        return menu;
    }

    // --- FILE/INPUT UTILITY FUNCTIONS (Kept for basic functionality) ---

    // Simplified file handling functions (handleFileUpload, renderAttachments, handlePaste)
    // The implementation here is a placeholder/stub to reduce file size, as the core request was feature *removal*.
    function handleFileUpload() {
        alert("File uploads are currently restricted to images and text files, and file size limits apply.");
        // Full file upload logic removed to simplify.
    }

    function renderAttachments() {
        const previewContainer = document.getElementById('ai-attachment-preview');
        const inputWrapper = document.getElementById('ai-input-wrapper');

        if (attachedFiles.length === 0) {
            inputWrapper.classList.remove('has-attachments');
            previewContainer.innerHTML = '';
            return;
        }
        // Simplified rendering for attached files...
    }

    function handlePaste(e) {
        e.preventDefault();
        const clipboardData = e.clipboardData || window.clipboardData;
        const pastedText = clipboardData.getData('text/plain');
        document.execCommand('insertText', false, pastedText);
        handleContentEditableInput({target: e.target});
        // Simplified paste logic (removed large text-to-file logic)
    }

    function formatCharCount(count) {
        if (count >= 1000) { return (count / 1000).toFixed(count % 1000 === 0 ? 0 : 1) + 'K'; }
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

            // Simplified request checks
            if (attachedFiles.some(f => f.isLoading)) { alert("Please wait for files to finish uploading before sending."); return; }
            if (!query && attachedFiles.length === 0) return;
            if (isRequestPending) return;

            isRequestPending = true;
            document.getElementById('ai-input-wrapper').classList.add('waiting');
            const parts = [];
            if (query) parts.push({ text: query });
            attachedFiles.forEach(file => { if (file.inlineData) parts.push({ inlineData: file.inlineData }); });
            // Add user message to history. This is where the error came from previously.
            // We now know that the history object saved here should contain all metadata needed for rendering.
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
            renderAttachments(); // Clear attachment preview

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

    /**
     * Parses Gemini's response text and appends a clickable sources section.
     * @param {string} text The raw response text.
     * @param {Array<Object>|string} sources The grounding metadata from the API.
     * @returns {string} The HTML content.
     */
    function parseGeminiResponse(text, sources) {
        let html = text;
        const placeholders = {};
        let placeholderId = 0;

        const addPlaceholder = (content) => {
            const key = `%%PLACEHOLDER_${placeholderId++}%%`;
            placeholders[key] = content;
            return key;
        };

        // 1. Extract and replace code blocks (Simplified: removed graph logic)
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

        // 2. Escape the rest of the HTML
        html = escapeHTML(html);

        // 3. Apply markdown styling (Simplified: removed KaTeX)
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

        // 4. Restore placeholders
        html = html.replace(/%%PLACEHOLDER_\d+%%/g, (match) => placeholders[match] || '');

        // 5. Add Sources Section (NEW FEATURE)
        if (sources && userSettings.webSearchEnabled) {
            let sourcesHTML = '';
            let uniqueUrls = new Set();
            let sourceList = [];

            if (Array.isArray(sources)) {
                 // Check if it's an array of objects (groundingChunks) or strings (web URIs)
                if (sources.length > 0 && typeof sources[0] === 'object' && sources[0].uri) {
                     sourceList = sources.map(s => s.uri);
                } else if (sources.every(s => typeof s === 'string')) {
                     sourceList = sources; // Array of URIs
                }
            } else if (typeof sources === 'string' && sources.startsWith('http')) {
                sourceList = [sources]; // Single URI string
            }

            sourceList.forEach(url => {
                try {
                    const cleanUrl = new URL(url).origin;
                    if (!uniqueUrls.has(cleanUrl)) {
                        uniqueUrls.add(cleanUrl);
                        const displayUrl = cleanUrl.replace(/^https?:\/\/(www\.)?/, '');
                        sourcesHTML += `<li><a href="${url}" target="_blank" rel="noopener noreferrer">${displayUrl}</a></li>`;
                    }
                } catch (e) {
                    console.error("Invalid source URL:", url, e);
                }
            });

            if (sourcesHTML) {
                html += `
                    <div class="ai-sources-section">
                        <h4>Sources Used:</h4>
                        <ol class="ai-sources-list">${sourcesHTML}</ol>
                        <p class="source-note">Clicking a source link opens the URL in a new tab.</p>
                    </div>
                `;
            }
        }

        return html;
    }

    function injectStyles() {
        if (document.getElementById('ai-dynamic-styles')) return;

        // REMOVED: KaTeX CSS link

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
            #ai-brand-title { animation: none; } /* Simplified brand title */
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
            .gemini-response { animation: none; } /* Removed response glow */
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

            /* Settings Menu (Modified) */
            #ai-settings-menu { position: absolute; bottom: calc(100% + 10px); right: 0; width: 350px; z-index: 1; background: rgb(20, 20, 22); border: 1px solid rgba(255,255,255,0.2); border-radius: 16px; box-shadow: 0 5px 25px rgba(0,0,0,0.5); padding: 15px; opacity: 0; visibility: hidden; transform: translateY(20px); transition: all .3s cubic-bezier(.4,0,.2,1); overflow: hidden; }
            #ai-settings-menu.active { opacity: 1; visibility: visible; transform: translateY(0); }
            #ai-settings-menu .menu-header { font-size: 1.1em; color: #fff; text-transform: uppercase; margin-bottom: 15px; text-align: center; font-family: 'Merriweather', serif; }
            .setting-group { margin-bottom: 15px; }
            .setting-group label { display: block; color: #ccc; font-size: 0.9em; margin-bottom: 5px; font-weight: bold; }
            .setting-group input, .setting-group select { width: 100%; padding: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: #fff; box-sizing: border-box; }
            .setting-note { font-size: 0.75em; color: #888; margin-top: 5px; }
            #settings-save-button { width: 100%; padding: 10px; background: #4285f4; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 1em; margin-top: 10px; transition: background 0.2s; }
            #settings-save-button:hover { background: #3c77e6; }

            /* Toggle Switch Styles (NEW) */
            .setting-toggle-group { margin-bottom: 15px; padding: 10px; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; }
            .setting-toggle-item { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
            .setting-toggle-item label { margin-bottom: 0; }
            .setting-toggle-item input[type="checkbox"] { position: relative; width: 40px; height: 20px; appearance: none; background: #555; border-radius: 10px; cursor: pointer; transition: background 0.3s; }
            .setting-toggle-item input[type="checkbox"]::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; background: #fff; border-radius: 50%; transition: transform 0.3s; }
            .setting-toggle-item input[type="checkbox"]:checked { background: var(--ai-green); }
            .setting-toggle-item input[type="checkbox"]:checked::after { transform: translateX(20px); }

            /* Attachments & Code Blocks */
            #ai-attachment-preview { display: none; flex-direction: row; gap: 10px; padding: 0; max-height: 0; border-bottom: 1px solid transparent; overflow-x: auto; transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
            #ai-input-wrapper.has-attachments #ai-attachment-preview { max-height: 100px; padding: 10px 15px; }
            /* Attachment card styles removed for brevity, keeping only essential code styles */

            .ai-loader { width: 25px; height: 25px; border-radius: 50%; animation: spin 1s linear infinite; border: 3px solid rgba(255,255,255,0.3); border-top-color: #fff; }

            .code-block-wrapper { background-color: rgba(42, 42, 48, 0.8); border-radius: 8px; margin: 10px 0; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); }
            .code-block-header { display: flex; justify-content: flex-end; align-items: center; padding: 6px 12px; background-color: rgba(0,0,0,0.2); }
            .code-metadata { font-size: 0.8em; color: #aaa; margin-right: auto; font-family: monospace; }
            .copy-code-btn { background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.2); color: #fff; border-radius: 6px; width: 32px; height: 32px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background-color 0.2s; }
            .code-block-wrapper pre { margin: 0; padding: 15px; overflow: auto; background-color: transparent; }
            .code-block-wrapper code { font-family: 'Menlo', 'Consolas', monospace; font-size: 0.9em; color: #f0f0f0; }

            /* Sources Section Styles (NEW) */
            .ai-sources-section { margin-top: 15px; padding-top: 10px; border-top: 1px dashed rgba(255,255,255,0.1); text-align: left; }
            .ai-sources-section h4 { color: #ccc; margin: 0 0 8px 0; font-size: 0.9em; font-weight: bold; }
            .ai-sources-list { list-style: decimal; padding-left: 20px; margin: 0 0 5px 0; font-size: 0.85em; }
            .ai-sources-list li { margin-bottom: 3px; }
            .ai-sources-list a { color: var(--ai-blue); text-decoration: none; word-break: break-all; }
            .ai-sources-list a:hover { text-decoration: underline; }
            .source-note { font-size: 0.7em; color: #888; margin: 0; }

            .ai-message-bubble p { margin: 0; padding: 0; text-align: left; }
            .ai-message-bubble ul, .ai-message-bubble ol { margin: 10px 0; padding-left: 20px; text-align: left; list-style-position: outside; }
            .ai-message-bubble li { margin-bottom: 5px; }

            /* Keyframe animations kept for loading states */
            @keyframes glow { 0%,100% { box-shadow: 0 0 5px rgba(255,255,255,.15), 0 0 10px rgba(255,255,255,.1); } 50% { box-shadow: 0 0 10px rgba(255,255,255,.25), 0 0 20px rgba(255,255,255,.2); } }
            @keyframes gemini-glow { 0%,100% { box-shadow: 0 0 8px 2px var(--ai-blue); } 25% { box-shadow: 0 0 8px 2px var(--ai-green); } 50% { box-shadow: 0 0 8px 2px var(--ai-yellow); } 75% { box-shadow: 0 0 8px 2px var(--ai-red); } }
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes message-pop-in { 0% { opacity: 0; transform: translateY(10px) scale(.98); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        `;
    document.head.appendChild(style);}

    document.addEventListener('keydown', handleKeyDown);

    document.addEventListener('DOMContentLoaded', async () => {
        loadUserSettings();
    });
})();
