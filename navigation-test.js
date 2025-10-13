/**
 * ai-activation.js
 *
 * A feature-rich, self-contained script with a unified attachment/subject menu,
 * enhanced animations, intelligent chat history (token saving),
 * and advanced file previews. This version includes a character limit,
 * smart paste handling, and refined animations.
 *
 * LATEST UPDATES:
 * - Font Awesome dependency removed; all icons converted to inline SVGs.
 * - 'Pro (Ultra)' model name corrected to 'gemini-2.5-pro' to fix response error.
 * - Code block metadata and copy button moved to the bottom of the code block.
 */
(function() {
    // =========================================================================
    // >> ACTION REQUIRED: PASTE YOUR FIREBASE CONFIGURATION OBJECT HERE <<
    // =========================================================================
    const FIREBASE_CONFIG = {
        // This apiKey is now used for both Firebase Auth and the Gemini API calls.
        apiKey: "AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro",
        authDomain: "project-zirconium.firebaseapp.com",
        projectId: "project-zirconium",
        storageBucket: "project-zirconium.firebaseapp.com",
        messagingSenderId: "1096564243475",
        appId: "1:1096564243475:web:6d0956a70125eeea1ad3e6",
        measurementId: "G-1D4F692C1Q"
    };
    // =========================================================================

    // --- CONFIGURATION ---
    const MAX_INPUT_HEIGHT = 200;
    const CHAR_LIMIT = 500;
    
    // --- SVG ICONS (Replaces Font Awesome) ---
    const ICON_SIZE = '1em'; // Standard size for inline SVGs
    
    // Core Action Icons
    const copySVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="${ICON_SIZE}" height="${ICON_SIZE}"><path fill="currentColor" d="M384 336H192c-8.8 0-16-7.2-16-16V160c0-8.8 7.2-16 16-16h192c8.8 0 16 7.2 16 16v160c0 8.8-7.2 16-16 16zM192 376c-30.9 0-56-25.1-56-56V112c0-30.9 25.1-56 56-56h224c30.9 0 56 25.1 56 56v208c0 30.9-25.1 56-56 56H192zM0 312c0 30.9 25.1 56 56 56h80c8.8 0 16-7.2 16-16V144c0-8.8-7.2-16-16-16H56c-30.9 0-56 25.1-56 56v128z"/></svg>`;
    const checkSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="${ICON_SIZE}" height="${ICON_SIZE}"><path fill="currentColor" d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/></svg>`;
    const stopSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="${ICON_SIZE}" height="${ICON_SIZE}"><path fill="currentColor" d="M0 480c0 17.7 14.3 32 32 32h320c17.7 0 32-14.3 32-32V32c0-17.7-14.3-32-32-32H32C14.3 0 0 14.3 0 32v448z"/></svg>`;
    
    // UI Icons
    const linkSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${ICON_SIZE}" height="${ICON_SIZE}"><path fill="currentColor" d="M175 190.5c-33.1 0-60 26.9-60 60s26.9 60 60 60h74.2c3.4 0 6.6-1.5 8.7-4l22.4-48c9.9-21.1 36.4-25.7 58.6-11.7l163.7 109.1c15.2 10.1 34.6 10.1 49.8 0l22.4-14.9c15.2-10.1 24.3-27.5 24.3-46.7V174.5c0-19.2-9.1-36.6-24.3-46.7L434.4 67.2c-15.2-10.1-34.6-10.1-49.8 0l-14.9 9.9c-14.2 9.4-31.9 9.4-46 0L208.7 82.2c-2.1-1.4-4.7-2.2-7.3-2.2H175c-33.1 0-60 26.9-60 60s26.9 60 60 60zm161.7 11.2l-33.6-22.4c-21.2-14.1-48.9-10.5-62.8 9.9L175 391.2c-33.1 0-60 26.9-60 60s26.9 60 60 60h161.7c33.1 0 60-26.9 60-60s-26.9-60-60-60z"/></svg>`;
    const xMarkSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="${ICON_SIZE}" height="${ICON_SIZE}"><path fill="currentColor" d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 87.7 106.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 42.4 357.3c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 296.3 405.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/></svg>`;
    
    // File Type Icons
    const fileSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="${ICON_SIZE}" height="${ICON_SIZE}"><path fill="currentColor" d="M0 64C0 28.7 28.7 0 64 0h256c35.3 0 64 28.7 64 64v384c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V64zm96 32v64c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32V96c0-17.7-14.3-32-32-32H128c-17.7 0-32 14.3-32 32zm0 256v64c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32v-64c0-17.7-14.3-32-32-32H128c-17.7 0-32 14.3-32 32z"/></svg>`;
    const filePdfSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="${ICON_SIZE}" height="${ICON_SIZE}"><path fill="currentColor" d="M184 96V51.4c0-17.8 21.5-26.7 34.1-14.1l152.1 152.1c12.6 12.6 3.7 34.1-14.1 34.1H296c-13.3 0-24 10.7-24 24v240c0 17.7-14.3 32-32 32H136c-13.3 0-24-10.7-24-24V32c0-17.7 14.3-32 32-32h88c13.3 0 24 10.7 24 24V96h-64zM32 352c-17.7 0-32 14.3-32 32v96c0 17.7 14.3 32 32 32h80c17.7 0 32-14.3 32-32V384c0-17.7-14.3-32-32-32H32z"/></svg>`;
    const fileLinesSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="${ICON_SIZE}" height="${ICON_SIZE}"><path fill="currentColor" d="M64 0C28.7 0 0 28.7 0 64V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V160c0-17.7-7.1-34.9-19.1-47.5L274.5 19.1C262.9 7.1 245.7 0 228.3 0H64zm72 176H320c8.8 0 16 7.2 16 16s-7.2 16-16 16H136c-8.8 0-16-7.2-16-16s7.2-16 16-16zm-16 80c0-8.8 7.2-16 16-16H320c8.8 0 16 7.2 16 16s-7.2 16-16 16H136c-8.8 0-16-7.2-16-16zm16 144H320c8.8 0 16 7.2 16 16s-7.2 16-16 16H136c-8.8 0-16-7.2-16-16s7.2-16 16-16zm-16-160c0-8.8 7.2-16 16-16H320c8.8 0 16 7.2 16 16s-7.2 16-16 16H136c-8.8 0-16-7.2-16-16z"/></svg>`;
    const fileZipperSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="${ICON_SIZE}" height="${ICON_SIZE}"><path fill="currentColor" d="M16 48c0-8.8 7.2-16 16-16h80c8.8 0 16 7.2 16 16v16H16V48zM368 48H144v16H368c8.8 0 16-7.2 16-16s-7.2-16-16-16zM0 64c0-35.3 28.7-64 64-64h256c35.3 0 64 28.7 64 64V448c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V64zm184 32v96H24c-13.3 0-24-10.7-24-24V128c0-13.3 10.7-24 24-24h160zm0 176v96H24c-13.3 0-24-10.7-24-24V256c0-13.3 10.7-24 24-24h160zm-160 96c-13.3 0-24 10.7-24 24v64c0 13.3 10.7 24 24 24h160V368H24zM24 192c-13.3 0-24 10.7-24 24v64c0 13.3 10.7 24 24 24h160V192H24zM200 448v32h160c13.3 0 24-10.7 24-24V416c0-13.3-10.7-24-24-24H200v64zM200 192v160h160c13.3 0 24-10.7 24-24V216c0-13.3-10.7-24-24-24H200z"/></svg>`;
    
    // Model Icons
    const starSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" width="${ICON_SIZE}" height="${ICON_SIZE}"><path fill="currentColor" d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-11.4 1.7-20.1 11.5-19.1 23.1s10.5 20.9 22.3 22.2L180.8 332.9 141.6 478.9c-2.6 9.4 1.8 19 10.1 24.3s18.9 4.6 26.6-2.6l126-105.7 126 105.7c7.7 7.2 18.2 8 26.6 2.6s12.7-14.9 10.1-24.3L395.2 332.9 524.3 216.9c11.8-1.3 21.2-10.2 22.3-22.2s-7.7-21.4-19.1-23.1L381.2 150.3 316.9 18z"/></svg>`;
    const boltSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="${ICON_SIZE}" height="${ICON_SIZE}"><path fill="currentColor" d="M184 0H216C243.6 0 266 22.4 266 50V384h118.6C409.5 384 425.2 411.4 411.7 428.1L248 512H216c-27.6 0-50-22.4-50-50V128H3.4C-10.5 128-26.2 100.6-12.7 83.9L148 0H184z"/></svg>`;
    const rocketSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${ICON_SIZE}" height="${ICON_SIZE}"><path fill="currentColor" d="M495.2 403.4c-7.9-10.3-20.7-15.6-33.5-15.6H368.5c-4.4 0-8.8 1.4-12.7 4.1L243.2 460.8c-11.6 7.8-26.7 8.3-38.8 1.2L116.7 416c-3.1-1.9-6.3-3-9.5-3c-15.7 0-30.8 7.3-40.1 19.8l-5.7 7.6c-13.6 18.2-7 43.8 13.9 53.9l121.2 60.6c13.7 6.9 29.8 4.7 41.5-6.2l99.3-99.3c10.9-10.9 13.1-26.9 6.2-40.6l-60.6-121.2c-10.1-20.9-35.7-27.5-53.9-13.9l-7.6 5.7c-12.5 9.3-19.8 24.4-19.8 40.1c0 3.2 1.1 6.4 3 9.5l44.8 100.3c2.7 3.9 4.1 8.3 4.1 12.7v93.2c0 12.8-5.3 25.6-15.6 33.5L8.8 495.2c-10.3 7.9-25.7 7.9-36 0L1.7 488.7c-7.9-10.3-7.9-25.7 0-36L448 8.8c10.3-7.9 25.7-7.9 36 0l1.7 1.3c7.9 10.3 7.9 25.7 0 36L495.2 403.4zM100.2 121.2l-30.9 30.9c-14.1 14.1-14.1 37.1 0 51.2l61.8 61.8c14.1 14.1 37.1 14.1 51.2 0l30.9-30.9c14.1-14.1 14.1-37.1 0-51.2L151.4 121.2c-14.1-14.1-37.1-14.1-51.2 0z"/></svg>`;


    // --- ICONS (for event handlers) ---
    const copyIconHTML = copySVG;
    const checkIconHTML = checkSVG;
    const stopIconHTML = stopSVG; // New stop icon

    // --- MODEL CONFIGURATION ---
    const MODELS = [
        // Using Advanced (Flash) as the default for better multi-modal capability
        { name: 'Standard (Lite)', model: 'gemini-2.5-flash-lite-preview-09-2025', apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-09-2025:generateContent?key=', iconSVG: starSVG, description: 'Fast, basic text and chat.' },
        { name: 'Advanced (Flash)', model: 'gemini-2.5-flash-preview-05-20', apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=', iconSVG: boltSVG, description: 'Faster, multi-modal, better reasoning.' },
        // FIX: Updated model identifier from preview tag to stable 'gemini-2.5-pro' to fix the non-responding issue.
        { name: 'Pro (Ultra)', model: 'gemini-2.5-pro', apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=', iconSVG: rocketSVG, description: 'Highest capability for complex tasks. (Subject to usage limits)' }
    ];
    let currentModel = MODELS[1]; // Set Advanced (Flash) as default

    // --- STATE MANAGEMENT ---
    let isAIActive = false;
    let isRequestPending = false;
    let isModelMenuOpen = false; // Renamed from isActionMenuOpen
    let currentAIRequestController = null;
    let chatHistory = [];
    let attachedFiles = [];

    // --- AGENT INSTRUCTION (Generic since categories were removed) ---
    const SYSTEM_INSTRUCTION = 'You are a helpful, comprehensive, and detail-oriented AI assistant.';


    async function isUserAuthorized() {
        const user = firebase.auth().currentUser;
        if (typeof firebase === 'undefined' || !user) return false;
        const adminEmails = ['4simpleproblems@gmail.com', 'belkwy30@minerva.sparcc.org'];
        if (adminEmails.includes(user.email)) return true;
        try {
            const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
            return userDoc.exists && userDoc.data().aiEnrolled === true;
        } catch (error) { console.error("AI Auth Check Error:", error); return false; }
    }

    async function handleKeyDown(e) {
        // The new shortcut: Ctrl + \
        if (e.ctrlKey && e.key === '\\') {
            const selection = window.getSelection().toString();
            if (isAIActive) {
                // If text is selected, allow default behavior (like copy or other system shortcuts)
                if (selection.length > 0) {
                    return; 
                }
                e.preventDefault();
                const mainEditor = document.getElementById('ai-input');
                // Deactivate only if input is empty (clean exit)
                if (mainEditor && mainEditor.innerText.trim().length === 0 && attachedFiles.length === 0) {
                    deactivateAI();
                }
            } else {
                // Activate if inactive and no text is currently selected on the page
                if (selection.length === 0) {
                    const isAuthorized = await isUserAuthorized();
                    if (isAuthorized) {
                        e.preventDefault();
                        activateAI();
                    }
                }
            }
        }
        
        // Retain the complex Ctrl + C logic for copying text while active.
        else if (e.ctrlKey && e.key.toLowerCase() === 'c') {
            const selection = window.getSelection().toString();
            if (isAIActive && selection.length === 0) {
                e.preventDefault();
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
        // Subject categories removed, setting a default data-attribute for base styling
        container.dataset.subject = 'Advanced'; 
        
        const brandTitle = document.createElement('div');
        brandTitle.id = 'ai-brand-title';
        const brandText = "4SP - AI AGENT";
        brandText.split('').forEach(char => {
            const span = document.createElement('span');
            span.textContent = char;
            span.style.animationDelay = `${Math.random() * 2}s`;
            brandTitle.appendChild(span);
        });
        
        const persistentTitle = document.createElement('div');
        persistentTitle.id = 'ai-persistent-title';
        persistentTitle.textContent = `4SP AI Agent - ${currentModel.name}`;
        
        const welcomeMessage = document.createElement('div');
        welcomeMessage.id = 'ai-welcome-message';
        welcomeMessage.innerHTML = `<h2>Welcome to 4SP AI Agent</h2><p>This is a beta feature. To improve your experience, your general location (state or country) will be shared with your first message. You may be subject to message limits.</p>`; 
        
        const closeButton = document.createElement('div');
        closeButton.id = 'ai-close-button';
        closeButton.innerHTML = '&times;';
        closeButton.onclick = deactivateAI;
        
        const responseContainer = document.createElement('div');
        responseContainer.id = 'ai-response-container';
        
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
        
        // NEW: Controls Container for the two buttons
        const controlsContainer = document.createElement('div');
        controlsContainer.id = 'ai-controls-container';
        
        // Button 1: Attachment Button (uses SVG)
        const attachmentButton = document.createElement('button');
        attachmentButton.id = 'ai-attachment-button';
        attachmentButton.innerHTML = linkSVG; // Use SVG
        attachmentButton.onclick = (e) => { e.stopPropagation(); handleFileUpload(); };

        // Button 2: Model Selector Button (uses SVG)
        const modelSelectorButton = document.createElement('button');
        modelSelectorButton.id = 'ai-model-selector-button';
        // Initial icon based on default model (using iconSVG)
        modelSelectorButton.innerHTML = `<span class="icon-model">${currentModel.iconSVG}</span><span class="icon-stop">${stopIconHTML}</span>`;
        modelSelectorButton.onclick = (e) => { e.stopPropagation(); if (isRequestPending) { stopGeneration(); } else { toggleModelMenu(); } };

        controlsContainer.appendChild(attachmentButton);
        controlsContainer.appendChild(modelSelectorButton);

        const charCounter = document.createElement('div');
        charCounter.id = 'ai-char-counter';
        charCounter.textContent = `0 / ${CHAR_LIMIT}`;

        inputWrapper.appendChild(attachmentPreviewContainer);
        inputWrapper.appendChild(visualInput);
        inputWrapper.appendChild(controlsContainer);
        
        container.appendChild(brandTitle);
        container.appendChild(persistentTitle);
        container.appendChild(welcomeMessage);
        container.appendChild(closeButton);
        container.appendChild(responseContainer);
        container.appendChild(inputWrapper);
        container.appendChild(createModelSelectionMenu());
        container.appendChild(charCounter);
        
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
            }, 500);
        }
        isAIActive = false;
        isModelMenuOpen = false;
        isRequestPending = false;
        attachedFiles = [];
    }
    
    function renderChatHistory() {
        const responseContainer = document.getElementById('ai-response-container');
        if (!responseContainer) return;
        responseContainer.innerHTML = '';
        chatHistory.forEach(message => {
            const bubble = document.createElement('div');
            bubble.className = `ai-message-bubble ${message.role === 'user' ? 'user-message' : 'gemini-response'}`;
            if (message.role === 'model') {
                bubble.innerHTML = `<div class="ai-response-content">${parseGeminiResponse(message.parts[0].text)}</div>`;
                bubble.querySelectorAll('.copy-code-btn').forEach(button => {
                    button.addEventListener('click', handleCopyCode);
                });
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

    async function callGoogleAI(responseBubble) {
        if (!FIREBASE_CONFIG.apiKey) { responseBubble.innerHTML = `<div class="ai-error">API Key is missing.</div>`; return; }
        currentAIRequestController = new AbortController();
        
        // Use the selected model's API URL
        const apiUrl = currentModel.apiUrl + FIREBASE_CONFIG.apiKey;

        let firstMessageContext = '';
        if (chatHistory.length <= 1) {
            const location = localStorage.getItem('ai-user-location') || 'an unknown location';
            const now = new Date();
            const date = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const time = now.toLocaleTimeString('en-US', { timeZoneName: 'short' });
            firstMessageContext = `(System Info: User is asking from ${location}. Current date is ${date}, ${time}.)\n\n`;
        }
        
        let processedChatHistory = [...chatHistory];
        // Simplified token-saving logic: keeps first 3 and last 3 messages.
        if (processedChatHistory.length > 6) {
             processedChatHistory = [ ...processedChatHistory.slice(0, 3), ...processedChatHistory.slice(-3) ];
        }

        const lastMessageIndex = processedChatHistory.length - 1;
        const userParts = processedChatHistory[lastMessageIndex].parts;
        const textPart = userParts.find(p => p.text);
        if (textPart) {
             textPart.text = firstMessageContext + textPart.text;
        } else if (firstMessageContext) {
             userParts.unshift({ text: firstMessageContext.trim() });
        }
        
        const payload = { contents: processedChatHistory, systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] } };
        
        try {
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: currentAIRequestController.signal });
            if (!response.ok) throw new Error(`Network response was not ok. Status: ${response.status}`);
            const data = await response.json();
            if (!data.candidates || data.candidates.length === 0) throw new Error("Invalid response from API.");
            const text = data.candidates[0].content.parts[0].text;
            chatHistory.push({ role: "model", parts: [{ text: text }] });
            
            const contentHTML = `<div class="ai-response-content">${parseGeminiResponse(text)}</div>`;
            responseBubble.style.opacity = '0';
            setTimeout(() => {
                responseBubble.innerHTML = contentHTML;
                responseBubble.querySelectorAll('.copy-code-btn').forEach(button => {
                    button.addEventListener('click', handleCopyCode);
                });
                responseBubble.style.opacity = '1';
            }, 300);

        } catch (error) {
            if (error.name === 'AbortError') { responseBubble.innerHTML = `<div class="ai-error">Message generation stopped.</div>`; } 
            else { console.error('AI API Error:', error); responseBubble.innerHTML = `<div class="ai-error">Sorry, an error occurred.</div>`; }
        } finally {
            isRequestPending = false;
            currentAIRequestController = null;
            
            const selectorButton = document.getElementById('ai-model-selector-button');
            if (selectorButton) { selectorButton.classList.remove('generating'); }
            
            setTimeout(() => {
                responseBubble.classList.remove('loading');
                const responseContainer = document.getElementById('ai-response-container');
                if(responseContainer) responseContainer.scrollTop = responseContainer.scrollHeight;
            }, 300);

            document.getElementById('ai-input-wrapper').classList.remove('waiting');
            const editor = document.getElementById('ai-input');
            if(editor) { editor.contentEditable = true; editor.focus(); }
        }
    }

    function stopGeneration(){
        if(currentAIRequestController) currentAIRequestController.abort();
    }
    
    function toggleModelMenu(){
        isModelMenuOpen = !isModelMenuOpen;
        const menu = document.getElementById('ai-model-menu');
        const toggleBtn = document.getElementById('ai-model-selector-button');
        
        if (isModelMenuOpen) {
            const btnRect = toggleBtn.getBoundingClientRect();
            // Position the menu near the button
            menu.style.bottom = `${window.innerHeight - btnRect.top}px`;
            menu.style.right = `${window.innerWidth - btnRect.right}px`;
        }
        menu.classList.toggle('active', isModelMenuOpen);
    }
    
    function selectModel(modelName) {
        const newModel = MODELS.find(m => m.model === modelName);
        if (!newModel) return;
        currentModel = newModel;
        chatHistory = []; // Reset history when changing models
        
        // Update UI
        const selectorButton = document.getElementById('ai-model-selector-button');
        if (selectorButton) {
             // Use iconSVG
             selectorButton.innerHTML = `<span class="icon-model">${currentModel.iconSVG}</span><span class="icon-stop">${stopIconHTML}</span>`;
        }
        
        const persistentTitle = document.getElementById('ai-persistent-title');
        if (persistentTitle) { persistentTitle.textContent = `4SP AI Agent - ${currentModel.name}`; }

        const menu = document.getElementById('ai-model-menu');
        if (menu) {
            menu.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            menu.querySelector(`button[data-model="${modelName}"]`).classList.add('active');
        }
        // Always close menu after selection
        toggleModelMenu();
    }
    
    function handleFileUpload() {
        const input = document.createElement('input');
        input.type = 'file';
        // Only accept common file types and images (no audio/video)
        input.accept = 'image/*,application/pdf,text/plain,.zip,.csv,.json,.xml'; 
        input.multiple = true;
        input.onchange = (event) => {
            const files = Array.from(event.target.files);
            if (!files || files.length === 0) return;
            
            const currentTotalSize = attachedFiles.reduce((sum, file) => sum + (file.inlineData ? atob(file.inlineData.data).length : 0), 0);
            const newFilesSize = files.reduce((sum, file) => sum + file.size, 0);
            
            // Retain the 4MB total size limit per message
            if (currentTotalSize + newFilesSize > (4 * 1024 * 1024)) { 
                alert(`Upload failed: Total size of attachments would exceed the 4MB limit per message.`);
                return;
            }
            
            files.forEach(file => {
                const tempId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                attachedFiles.push({ tempId, file, isLoading: true });
                renderAttachments();
                
                const reader = new FileReader();
                reader.onload = (e) => {
                    const base64Data = e.target.result.split(',')[1];
                    const itemIndex = attachedFiles.findIndex(f => f.tempId === tempId);
                    if (itemIndex > -1) {
                        const item = attachedFiles[itemIndex];
                        item.isLoading = false;
                        item.inlineData = { mimeType: file.type, data: base64Data };
                        item.fileName = file.name;
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
                // Use generic file SVG
                previewHTML = `<div class="ai-loader"></div><span class="file-icon">${fileSVG}</span>`;
            } else {
                fileName = file.fileName;
                fileExt = fileName.split('.').pop().toUpperCase();
                if (file.inlineData.mimeType.startsWith('image/')) {
                    previewHTML = `<img src="data:${file.inlineData.mimeType};base64,${file.inlineData.data}" alt="${fileName}" />`;
                } else {
                    // Use file type SVGs
                    let iconSVG = fileSVG;
                    if (fileExt === 'PDF') iconSVG = filePdfSVG;
                    else if (['TXT', 'CSV', 'JSON', 'XML'].includes(fileExt)) iconSVG = fileLinesSVG;
                    else if (fileExt === 'ZIP') iconSVG = fileZipperSVG;
                    
                    previewHTML = `<span class="file-icon">${iconSVG}</span>`;
                }
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

            // Use xMarkSVG for remove button
            fileCard.innerHTML = `${previewHTML}<div class="file-info"></div>${fileTypeBadge}<button class="remove-attachment-btn" data-index="${index}">${xMarkSVG}</button>`;
            fileCard.querySelector('.file-info').appendChild(marqueeWrapper);

            setTimeout(() => {
                if (nameSpan.scrollWidth > marqueeWrapper.clientWidth) {
                    const marqueeDuration = fileName.length / 4;
                    nameSpan.style.animationDuration = `${marqueeDuration}s`;
                    marqueeWrapper.classList.add('marquee');
                    nameSpan.innerHTML += `<span aria-hidden="true">${fileName}</span>`;
                }
            }, 0);

            fileCard.querySelector('.remove-attachment-btn').onclick = () => {
                attachedFiles.splice(index, 1);
                renderAttachments();
            };
            previewContainer.appendChild(fileCard);
        });
    }

    function createModelSelectionMenu() {
        const menu = document.createElement('div');
        menu.id = 'ai-model-menu';
        menu.className = 'ai-action-menu'; 
        
        const header = document.createElement('div');
        header.className = 'menu-header';
        header.textContent = 'Select AI Model';
        menu.appendChild(header);

        MODELS.forEach(modelConfig => {
            const button = document.createElement('button');
            button.dataset.model = modelConfig.model;
            button.classList.toggle('active', modelConfig.model === currentModel.model);

            const limitText = modelConfig.name.includes('(Ultra)') 
                ? '<span class="limit-warning">Usage Limits Apply</span>' 
                : '';
            
            // Use iconSVG
            button.innerHTML = `
                <span class="icon">${modelConfig.iconSVG}</span> 
                <span>${modelConfig.name}</span>
                <div class="model-description">${modelConfig.description} ${limitText}</div>
            `;
            
            button.onclick = () => selectModel(modelConfig.model);
            menu.appendChild(button);
        });
        
        return menu;
    }

    function handleContentEditableInput(e) {
        const editor = e.target;
        const charCount = editor.innerText.length;
        
        const counter = document.getElementById('ai-char-counter');
        if (counter) {
            counter.textContent = `${charCount} / ${CHAR_LIMIT}`;
            counter.classList.toggle('limit-exceeded', charCount > CHAR_LIMIT);
        }

        if (charCount > CHAR_LIMIT) {
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false); // Go to the end
            selection.removeAllRanges();
            selection.addRange(range);
        }

        if (editor.scrollHeight > MAX_INPUT_HEIGHT) { editor.style.height = `${MAX_INPUT_HEIGHT}px`; editor.style.overflowY = 'auto'; } 
        else { editor.style.height = 'auto'; editor.style.height = `${editor.scrollHeight}px`; editor.style.overflowY = 'hidden'; }
        fadeOutWelcomeMessage();
    }
    
    function handlePaste(e) {
        e.preventDefault();
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        const currentText = e.target.innerText;

        if (currentText.length + pastedText.length > CHAR_LIMIT) {
            let filename = 'paste.txt';
            let counter = 2;
            while (attachedFiles.some(f => f.fileName === filename)) {
                filename = `paste${counter++}.txt`;
            }
            // Use encodeURIComponent to handle special characters before btoa
            const base64Data = btoa(unescape(encodeURIComponent(pastedText)));
            attachedFiles.push({
                inlineData: { mimeType: 'text/plain', data: base64Data },
                fileName: filename
            });
            renderAttachments();
        } else {
            document.execCommand('insertText', false, pastedText);
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
            if (isModelMenuOpen) { toggleModelMenu(); }
            
            if (attachedFiles.some(f => f.isLoading)) {
                alert("Please wait for files to finish uploading before sending.");
                return;
            }
            if (!query && attachedFiles.length === 0) return;
            if (isRequestPending) return;
            
            isRequestPending = true;
            document.getElementById('ai-model-selector-button').classList.add('generating');
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
            handleContentEditableInput({target: editor}); // Reset counter
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
                btn.innerHTML = checkIconHTML; // Use checkSVG
                btn.disabled = true;
                setTimeout(() => {
                    btn.innerHTML = copyIconHTML; // Use copySVG
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

    /**
     * Parses the Gemini response. It only handles code block extraction,
     * HTML escapes the remaining text, and replaces newlines with <br>.
     */
    function parseGeminiResponse(text) {
        let html = text;
        const codeBlocks = [];

        // 1. Extract code blocks and replace with placeholders
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
            const trimmedCode = code.trim();
            const lines = trimmedCode.split('\n').length;
            const words = trimmedCode.split(/\s+/).filter(Boolean).length;
            const escapedCode = escapeHTML(trimmedCode);
            const langClass = lang ? `language-${lang.toLowerCase()}` : '';

            // FIX: Code block header moved to footer/bottom
            const codeFooter = `
                <div class="code-block-footer">
                    <span class="code-metadata">${lines} lines &middot; ${words} words</span>
                    <button class="copy-code-btn" title="Copy code">${copyIconHTML}</button>
                </div>
            `;

            codeBlocks.push(`
                <div class="code-block-wrapper">
                    <pre><code class="${langClass}">${escapedCode}</code></pre>
                    ${codeFooter}
                </div>
            `);
            return "%%CODE_BLOCK%%";
        });

        // 2. Escape the remaining text (to prevent XSS and render raw markdown characters)
        html = escapeHTML(html);

        // 3. Convert newlines to breaks (Keep basic formatting)
        html = html.replace(/\n/g, "<br>");

        // 4. Replace code block placeholders
        html = html.replace(/%%CODE_BLOCK%%/g, () => codeBlocks.shift());
        
        return html;
    }

    function injectStyles() {
        if (document.getElementById('ai-dynamic-styles')) return;
        
        // Font Awesome CDN removed, using inline SVGs instead.

        // Add Geist Font
        if (!document.querySelector('style[data-font="geist"]')) {
            const fontStyle = document.createElement("style");
            fontStyle.setAttribute("data-font","geist");
            fontStyle.textContent = `@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;700&family=Merriweather:wght@400;700&display=swap');`;
            document.head.appendChild(fontStyle);
        }
        
        const style = document.createElement("style");
        style.id = "ai-dynamic-styles";
        style.innerHTML = `
            /* NEW PRIMARY GLOW COLOR: Deep Indigo from dailyphoto.html */
            :root { --ai-primary-glow: #4f46e5; }
            #ai-container { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: rgba(0,0,0,0); backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); z-index: 2147483647; opacity: 0; transition: opacity 0.5s, background 0.5s, backdrop-filter 0.5s; font-family: 'Geist', sans-serif; display: flex; flex-direction: column; justify-content: flex-end; padding: 0; box-sizing: border-box; overflow: hidden; }
            #ai-container.active { opacity: 1; background-color: rgba(0, 0, 0, 0.8); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
            /* Simplified background: always dark theme */
            #ai-container[data-subject] { background: rgba(10, 10, 15, 0.9); } 
            
            #ai-container.deactivating, #ai-container.deactivating > * { transition: opacity 0.4s, transform 0.4s; }
            #ai-container.deactivating { opacity: 0 !important; background-color: rgba(0,0,0,0); backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); }
            #ai-persistent-title, #ai-brand-title { position: absolute; top: 28px; left: 30px; font-family: 'Merriweather', serif; font-size: 18px; font-weight: bold; color: white; opacity: 0; transition: opacity 0.5s 0.2s; animation: title-pulse 4s linear infinite; }
            #ai-container.chat-active #ai-persistent-title { opacity: 1; }
            #ai-container:not(.chat-active) #ai-brand-title { opacity: 1; }
            #ai-welcome-message { position: absolute; top: 45%; left: 50%; transform: translate(-50%,-50%); text-align: center; color: rgba(255,255,255,.5); opacity: 1; transition: opacity .5s, transform .5s; width: 100%; }
            #ai-container.chat-active #ai-welcome-message { opacity: 0; pointer-events: none; transform: translate(-50%,-50%) scale(0.95); }
            #ai-welcome-message h2 { font-family: 'Merriweather', serif; font-size: 2.5em; margin: 0; color: #fff; }
            #ai-welcome-message p { font-size: .9em; margin-top: 10px; max-width: 400px; margin-left: auto; margin-right: auto; line-height: 1.5; }
            #ai-close-button { position: absolute; top: 20px; right: 30px; color: rgba(255,255,255,.7); font-size: 40px; cursor: pointer; transition: color .2s ease,transform .3s ease, opacity 0.4s; }
            #ai-char-counter { position: fixed; bottom: 15px; right: 30px; font-size: 0.9em; font-family: 'Geist', sans-serif; color: #aaa; transition: color 0.2s; z-index: 2147483647; }
            #ai-char-counter.limit-exceeded { color: #e57373; font-weight: bold; }
            #ai-response-container { flex: 1 1 auto; overflow-y: auto; width: 100%; max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; gap: 15px; padding: 70px 20px 20px 20px; -webkit-mask-image: linear-gradient(to bottom,transparent 0,black 3%,black 97%,transparent 100%); mask-image: linear-gradient(to bottom,transparent 0,black 3%,black 97%,transparent 100%);}
            
            /* Message Bubble Styling */
            .ai-message-bubble { 
                background: rgba(15,15,18,.8); 
                border: 1px solid rgba(255,255,255,.1); 
                border-radius: 20px; 
                padding: 15px 20px; 
                color: #e0e0e0; 
                backdrop-filter: blur(15px); 
                -webkit-backdrop-filter: blur(15px); 
                animation: message-pop-in .5s cubic-bezier(.4,0,.2,1) forwards; 
                line-height: 1.6; 
                overflow-wrap: break-word; 
                transition: opacity 0.3s ease-in-out;
                text-align: left;
                display: inline-block; 
                max-width: 650px; 
            }
            .user-message { 
                align-self: flex-end; 
                background: rgba(40,45,50,.8); 
                margin-left: auto; 
            }
            .gemini-response { 
                margin-right: auto; 
            }

            .gemini-response.loading { 
                display: flex; justify-content: center; align-items: center; min-height: 60px; max-width: 100px; padding: 15px; background: rgba(15,15,18,.8); 
                animation: unified-glow 4s linear infinite; 
            } 

            /* Input Wrapper and Controls */
            #ai-input-wrapper { display: flex; flex-direction: column; flex-shrink: 0; position: relative; z-index: 2; transition: all .4s cubic-bezier(.4,0,.2,1); margin: 15px auto; width: 90%; max-width: 800px; border-radius: 25px; background: rgba(10,10,10,.7); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,.2); }
            #ai-input-wrapper::before, #ai-input-wrapper::after { content: ''; position: absolute; top: -1px; left: -1px; right: -1px; bottom: -1px; border-radius: 26px; z-index: -1; transition: opacity 0.5s ease-in-out; }
            #ai-input-wrapper::before { animation: glow 3s infinite; opacity: 1; }
            #ai-input-wrapper::after { animation: unified-glow 4s linear infinite; opacity: 0; } 
            #ai-input-wrapper.waiting::before { opacity: 0; }
            #ai-input-wrapper.waiting::after { opacity: 1; }
            #ai-input { min-height: 52px; max-height: ${MAX_INPUT_HEIGHT}px; overflow-y: hidden; color: #fff; font-size: 1.1em; padding: 15px 120px 15px 20px; box-sizing: border-box; word-wrap: break-word; outline: 0; }
            #ai-input:empty::before { content: 'Ask a question or describe your files...'; color: rgba(255, 255, 255, 0.4); pointer-events: none; }
            
            #ai-controls-container {
                position: absolute; right: 10px; bottom: 12px; height: 34px; display: flex; gap: 8px; z-index: 3;
            }

            #ai-attachment-button, #ai-model-selector-button { 
                background: 0 0; border: none; color: rgba(255,255,255,.5); 
                cursor: pointer; padding: 5px; line-height: 1; transition: all .3s ease; border-radius: 50%; width: 34px; height: 34px; 
                display: flex; align-items: center; justify-content: center; overflow: hidden;
            }
            #ai-attachment-button svg { font-size: 18px; color: #4f46e5; transition: color 0.2s; }
            #ai-attachment-button:hover svg { color: #fff; }

            #ai-model-selector-button .icon-model, #ai-model-selector-button .icon-stop { transition: opacity 0.3s, transform 0.3s; position: absolute; }
            #ai-model-selector-button .icon-stop { opacity: 0; transform: scale(0.5); } 
            #ai-model-selector-button .icon-model svg { font-size: 18px; color: #4f46e5; transition: color 0.2s; }

            /* NEW GENERATING/STOP STYLE */
            #ai-model-selector-button.generating { 
                background-color: rgba(255, 0, 0, 0.2); 
                border: 1px solid rgba(255, 0, 0, 0.5); 
                border-radius: 8px; 
            }
            #ai-model-selector-button.generating .icon-model { opacity: 0; transform: scale(0.5); }
            #ai-model-selector-button.generating .icon-stop { opacity: 1; transform: scale(1); }
            #ai-model-selector-button.generating .icon-stop svg { color: #ff0000; } 
            
            /* Model Selection Menu */
            #ai-model-menu { 
                position: fixed; background: rgba(20, 20, 22, 0.7); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); 
                border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; box-shadow: 0 5px 25px rgba(0,0,0,0.5); 
                display: flex; flex-direction: column; gap: 5px; padding: 8px; z-index: 2147483647; opacity: 0; visibility: hidden; 
                transform: translateY(10px) scale(.95); transition: all .25s cubic-bezier(.4,0,.2,1); transform-origin: bottom right; 
                min-width: 300px; 
            }
            #ai-model-menu.active { opacity: 1; visibility: visible; transform: translateY(-5px); }
            #ai-model-menu button { 
                background: rgba(255,255,255,0.05); border: none; color: #ddd; font-family: 'Geist', sans-serif; 
                font-size: 1em; padding: 10px 15px; border-radius: 8px; cursor: pointer; display: grid; grid-template-columns: 20px 1fr; 
                gap: 12px; text-align: left; transition: background-color 0.2s, box-shadow 0.2s; 
                align-items: center; 
            }
            
            #ai-model-menu button .icon svg {
                font-size: 1.1em;
                color: #4f46e5; 
            }
            #ai-model-menu button span:first-of-type { font-weight: bold; }
            #ai-model-menu button:hover { background-color: rgba(79, 70, 229, 0.1); }
            #ai-model-menu button.active { background-color: rgba(79, 70, 229, 0.2); box-shadow: inset 0 0 0 2px #4f46e5; }
            #ai-model-menu .model-description { font-size: 0.85em; color: #aaa; grid-column: 2; margin-top: -5px; line-height: 1.4; }
            #ai-model-menu .menu-header { font-size: 0.8em; color: #888; text-transform: uppercase; padding: 10px 15px 5px; cursor: default; }
            .limit-warning { color: #e57373; font-weight: 500; margin-left: 5px; }

            /* Code Block & Copy Button */
            .code-block-wrapper { background-color: rgba(42, 42, 48, 0.8); border-radius: 8px; margin: 10px 0; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); }
            
            /* FIX: Code bar moved to bottom and renamed to footer */
            .code-block-footer { 
                display: flex; justify-content: space-between; align-items: center; 
                padding: 6px 12px; 
                background-color: rgba(0,0,0,0.2); 
                border-top: 1px solid rgba(255,255,255,0.1); /* Separator line for footer */
            }

            .copy-code-btn { 
                background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); 
                border: 1px solid rgba(255, 255, 255, 0.2); color: #fff; border-radius: 6px; width: 32px; height: 32px; 
                cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background-color 0.2s; 
            }
            .copy-code-btn:hover { background: rgba(79, 70, 229, 0.2); border-color: #4f46e5; }
            .copy-code-btn:disabled { cursor: default; background: rgba(25, 103, 55, 0.5); }
            .copy-code-btn svg { width: 16px; height: 16px; color: #e0e0e0; transition: color 0.2s; }
            .copy-code-btn:hover svg { color: #fff; }
            .copy-code-btn:disabled svg { color: #fff; }
            
            /* Keyframes matching dailyphoto.html style */
            @keyframes glow { 0%,100% { box-shadow: 0 0 5px rgba(255,255,255,.15), 0 0 10px rgba(255,255,255,.1); } 50% { box-shadow: 0 0 10px rgba(255,255,255,.25), 0 0 20px rgba(255,255,255,.2); } }
            @keyframes unified-glow { 0%,100% { box-shadow: 0 0 8px 2px var(--ai-primary-glow); } 50% { box-shadow: 0 0 12px 3px var(--ai-primary-glow); } }
            @keyframes title-pulse { 0%, 100% { text-shadow: 0 0 7px var(--ai-primary-glow); } 50% { text-shadow: 0 0 10px var(--ai-primary-glow); } } 

            /* Attachment Preview */
            #ai-attachment-preview { display: none; flex-direction: row; gap: 10px; padding: 0; max-height: 0; border-bottom: 1px solid rgba(255,255,255,0.1); overflow-x: auto; transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
            #ai-input-wrapper.has-attachments #ai-attachment-preview { max-height: 100px; padding: 10px 15px; }
            .attachment-card { position: relative; border-radius: 8px; overflow: hidden; background: #333; height: 80px; width: 80px; flex-shrink: 0; display: flex; justify-content: center; align-items: center; transition: filter 0.3s; }
            .attachment-card.loading { filter: grayscale(80%) brightness(0.7); }
            .attachment-card.loading .file-icon { opacity: 0.3; }
            .attachment-card.loading .ai-loader { position: absolute; z-index: 2; }
            .attachment-card img { width: 100%; height: 100%; object-fit: cover; }
            .file-icon svg { font-size: 30px; color: #fff; opacity: 0.8; }
            .file-info { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.6); overflow: hidden; }
            .file-name { display: block; color: #fff; font-size: 0.75em; padding: 4px; text-align: center; white-space: nowrap; }
            .file-name.marquee > span { display: inline-block; padding-left: 100%; animation: marquee linear infinite; }
            .file-type-badge { position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.6); color: #fff; font-size: 0.7em; padding: 2px 5px; border-radius: 4px; font-family: 'Geist', sans-serif; font-weight: bold; }
            .remove-attachment-btn { position: absolute; top: 5px; left: 5px; background: rgba(0,0,0,0.5); color: #fff; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; z-index: 3; }
            .remove-attachment-btn svg { width: 10px; height: 10px; }
            .ai-loader { width: 25px; height: 25px; border-radius: 50%; animation: spin 1s linear infinite; border: 3px solid rgba(255,255,255,0.3); border-top-color: #fff; }
            .code-metadata { font-size: 0.8em; color: #aaa; margin-right: auto; font-family: 'Geist', sans-serif; }
            .code-block-wrapper pre { margin: 0; padding: 15px; overflow: auto; background-color: transparent; }
            .code-block-wrapper pre::-webkit-scrollbar { height: 8px; }
            .code-block-wrapper pre::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
            .code-block-wrapper code { font-family: 'Geist', monospace; font-size: 0.9em; color: #f0f0f0; }
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes message-pop-in { 0% { opacity: 0; transform: translateY(10px) scale(.98); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }
        `;
    document.head.appendChild(style);}
    document.addEventListener('keydown', handleKeyDown);

})();
