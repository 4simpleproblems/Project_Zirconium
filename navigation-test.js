/**
 * ai-activation.js
 *
 * A feature-rich, self-contained script with a unified attachment/subject menu,
 * enhanced animations, intelligent chat history (token saving),
 * and advanced file previews. This version includes a character limit,
 * smart paste handling, and refined animations.
 *
 * LATEST UPDATES:
 * - Font Awesome CDN updated to v6.5.2 (highly stable version to fix intermittent loading errors).
 * - All custom UI logic (Model selection, attachment button, stop button) is maintained.
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

    // --- ICONS (for event handlers) - Using Font Awesome 6.5.2 classes ---
    const copyIconHTML = '<i class="fa-solid fa-copy"></i>';
    const checkIconHTML = '<i class="fa-solid fa-check"></i>';
    const stopIconHTML = '<i class="fa-solid fa-stop"></i>'; // New stop icon

    // --- MODEL CONFIGURATION ---
    const MODELS = [
        // Using Advanced (Flash) as the default for better multi-modal capability
        { name: 'Standard (Lite)', model: 'gemini-2.5-flash-lite-preview-09-2025', apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-09-2025:generateContent?key=', icon: 'fa-solid fa-star', description: 'Fast, basic text and chat.' },
        { name: 'Advanced (Flash)', model: 'gemini-2.5-flash-preview-05-20', apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=', icon: 'fa-solid fa-bolt', description: 'Faster, multi-modal, better reasoning.' },
        { name: 'Pro (Ultra)', model: 'gemini-2.5-pro-preview-05-20', apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-preview-05-20:generateContent?key=', icon: 'fa-solid fa-rocket', description: 'Highest capability for complex tasks. (Subject to usage limits)' }
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
        
        // Button 1: Attachment Button (uses fa-link as requested)
        const attachmentButton = document.createElement('button');
        attachmentButton.id = 'ai-attachment-button';
        attachmentButton.innerHTML = '<i class="fa-solid fa-link"></i>';
        attachmentButton.onclick = (e) => { e.stopPropagation(); handleFileUpload(); };

        // Button 2: Model Selector Button (replaces action toggle for menu/stop)
        const modelSelectorButton = document.createElement('button');
        modelSelectorButton.id = 'ai-model-selector-button';
        // Initial icon based on default model
        modelSelectorButton.innerHTML = `<span class="icon-model"><i class="${currentModel.icon}"></i></span><span class="icon-stop">${stopIconHTML}</span>`;
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
             selectorButton.innerHTML = `<span class="icon-model"><i class="${currentModel.icon}"></i></span><span class="icon-stop">${stopIconHTML}</span>`;
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
                // Font Awesome generic file icon
                previewHTML = `<div class="ai-loader"></div><span class="file-icon"><i class="fa-solid fa-file"></i></span>`;
            } else {
                fileName = file.fileName;
                fileExt = fileName.split('.').pop().toUpperCase();
                if (file.inlineData.mimeType.startsWith('image/')) {
                    previewHTML = `<img src="data:${file.inlineData.mimeType};base64,${file.inlineData.data}" alt="${fileName}" />`;
                } else {
                    // Font Awesome icons for common file types
                    let iconClass = 'fa-file';
                    if (fileExt === 'PDF') iconClass = 'fa-file-pdf';
                    else if (['TXT', 'CSV', 'JSON', 'XML'].includes(fileExt)) iconClass = 'fa-file-lines';
                    else if (fileExt === 'ZIP') iconClass = 'fa-file-zipper';
                    
                    previewHTML = `<span class="file-icon"><i class="fa-solid ${iconClass}"></i></span>`;
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

            fileCard.innerHTML = `${previewHTML}<div class="file-info"></div>${fileTypeBadge}<button class="remove-attachment-btn" data-index="${index}"><i class="fa-solid fa-xmark"></i></button>`;
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
            
            button.innerHTML = `
                <span class="icon"><i class="${modelConfig.icon}"></i></span> 
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
                btn.innerHTML = checkIconHTML; // Use Font Awesome check icon
                btn.disabled = true;
                setTimeout(() => {
                    btn.innerHTML = copyIconHTML; // Use Font Awesome copy icon
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
     * All markdown (bold, lists, headings) is removed to show raw text.
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

            codeBlocks.push(`
                <div class="code-block-wrapper">
                    <div class="code-block-header">
                        <span class="code-metadata">${lines} lines &middot; ${words} words</span>
                        <button class="copy-code-btn" title="Copy code">${copyIconHTML}</button>
                    </div>
                    <pre><code class="${langClass}">${escapedCode}</code></pre>
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
        
        // --- Font Awesome v6.5.2 CDN link (UPDATED FOR STABILITY) ---
        if (!document.querySelector('link[href*="font-awesome"]')) {
            const faLink = document.createElement('link');
            faLink.rel = 'stylesheet';
            // Switched to v6.5.2 for improved loading stability in sandboxed environments
            faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css'; 
            document.head.appendChild(faLink);
        }

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
            #ai-attachment-button i { font-size: 18px; color: #4f46e5; transition: color 0.2s; }
            #ai-attachment-button:hover i { color: #fff; }

            #ai-model-selector-button .icon-model, #ai-model-selector-button .icon-stop { transition: opacity 0.3s, transform 0.3s; position: absolute; }
            #ai-model-selector-button .icon-stop { opacity: 0; transform: scale(0.5); } 
            #ai-model-selector-button .icon-model i { font-size: 18px; color: #4f46e5; transition: color 0.2s; }

            /* NEW GENERATING/STOP STYLE */
            #ai-model-selector-button.generating { 
                background-color: rgba(255, 0, 0, 0.2); 
                border: 1px solid rgba(255, 0, 0, 0.5); 
                border-radius: 8px; 
            }
            #ai-model-selector-button.generating .icon-model { opacity: 0; transform: scale(0.5); }
            #ai-model-selector-button.generating .icon-stop { opacity: 1; transform: scale(1); }
            #ai-model-selector-button.generating .icon-stop i { color: #ff0000; } 
            
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
            
            #ai-model-menu button .icon i {
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
            .code-block-header { display: flex; justify-content: flex-end; align-items: center; padding: 6px 12px; background-color: rgba(0,0,0,0.2); }
            .copy-code-btn { 
                background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); 
                border: 1px solid rgba(255, 255, 255, 0.2); color: #fff; border-radius: 6px; width: 32px; height: 32px; 
                cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background-color 0.2s; 
            }
            .copy-code-btn:hover { background: rgba(79, 70, 229, 0.2); border-color: #4f46e5; }
            .copy-code-btn:disabled { cursor: default; background: rgba(25, 103, 55, 0.5); }
            .copy-code-btn i { font-size: 16px; color: #e0e0e0; transition: color 0.2s; }
            .copy-code-btn:hover i { color: #fff; }
            .copy-code-btn:disabled i { color: #fff; }
            
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
            .file-icon i { font-size: 30px; color: #fff; opacity: 0.8; }
            .file-info { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.6); overflow: hidden; }
            .file-name { display: block; color: #fff; font-size: 0.75em; padding: 4px; text-align: center; white-space: nowrap; }
            .file-name.marquee > span { display: inline-block; padding-left: 100%; animation: marquee linear infinite; }
            .file-type-badge { position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.6); color: #fff; font-size: 0.7em; padding: 2px 5px; border-radius: 4px; font-family: 'Geist', sans-serif; font-weight: bold; }
            .remove-attachment-btn { position: absolute; top: 5px; left: 5px; background: rgba(0,0,0,0.5); color: #fff; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; z-index: 3; }
            .remove-attachment-btn i { font-size: 10px; }
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
