/**
 * ai-activation.js
 *
 * A feature-rich, self-contained script with a unified attachment/subject menu,
 * enhanced animations, intelligent chat history (token saving),
 * and advanced file previews. This version includes a character limit,
 * smart paste handling, and refined animations.
 *
 * --- UPDATE: ACTIVATION CHANGED TO KEYBOARD SHORTCUT (CTRL/CMD + C) ---
 */
(function() {
    // --- CONFIGURATION ---
    // The user requested that the API key be sourced from the Firebase configuration
    // similar to navigation.js.
    const FIREBASE_CONFIG = {
        // NOTE: The API key is sourced from the companion navigation.js file as requested by the user.
        apiKey: "AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro",
        authDomain: "project-zirconium.firebaseapp.com",
        projectId: "project-zirconium",
        storageBucket: "project-zirconium.firebaseapp.com",
        messagingSenderId: "1096564243475",
        appId: "1:1096564243475:web:6d0956a70125eeea1ad3e6",
        measurementId: "G-1D4F69"
    };

    const API_KEY = FIREBASE_CONFIG.apiKey; // Use the key from the config
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-09-2025:generateContent?key=${API_KEY}`;
    const MAX_INPUT_HEIGHT = 200;
    const CHAR_LIMIT = 500;

    // --- ICONS (for event handlers) ---
    const copyIconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="copy-icon"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    const checkIconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="check-icon"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    const geminiLogoSVG = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true" class="gemini-logo"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-2.34-.33-4.48-1.57-6-3.32-.4-.44-.35-1.14.1-1.56.45-.42 1.15-.35 1.56.1.72.8 1.63 1.4 2.62 1.83V14c0-.55.45-1 1-1s1 .45 1 1v5.93zM12 11H8c-.55 0-1-.45-1-1s.45-1 1-1h4c.55 0 1 .45 1 1s-.45 1-1 1zm4.78-4.14c.42.45.35 1.15-.1 1.56-1.55 1.75-3.69 2.99-6 3.32V8c0-.55-.45-1-1-1s-1 .45-1 1v3.93c-1-.43-1.91-1.03-2.62-1.83-.41-.45-1.11-.52-.1-1.56.45-.42-.52 1.12-.1 1.56 1.52 1.7 3.37 2.82 5.37 3.23.01.03.01.06.01.09s0 .06-.01.09c-2 .41-3.85 1.53-5.37 3.23-.42.45-.35 1.15.1 1.56.45-.42.52-1.12-.1-1.56-1.52-1.7-3.37-2.82-5.37-3.23.01-.03.01-.06.01-.09s0-.06-.01-.09c2-.41 3.85-1.53 5.37-3.23.42-.45.35-1.15-.1-1.56-.45-.42-1.15-.35-1.56.1z"/></svg>`;
    const attachIconSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 7h3a5 5 0 0 1 0 10h-3M9 17H6a5 5 0 0 1 0-10h3M8 12h8"></path></svg>`;
    const sendIconSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="send-icon"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
    const clearIconSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="clear-icon"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
    const moreIconSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>`;

    // --- STATE & UTILS ---
    let chatHistory = [];
    let isThinking = false;

    // Utility to convert Base64 to ArrayBuffer for audio handling (not used for this specific model, but kept for robustness)
    const base64ToArrayBuffer = (base64) => {
        const binaryString = window.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    };

    // Utility to convert an ArrayBuffer to a Base64 string
    const arrayBufferToBase64 = (buffer) => {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    };

    // Simple markdown to HTML conversion for output
    const markdownToHtml = (markdown) => {
        let html = markdown
            // Blockquotes
            .replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>')
            // Code blocks
            .replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
                const language = lang || 'plaintext';
                // Escape HTML characters for display inside code block
                const escapedCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                return `<div class="code-block-wrapper"><pre><code class="language-${language}">${escapedCode.trim()}</code></pre><button class="copy-btn" data-code="${btoa(code.trim())}">${copyIconSVG}</button></div>`;
            })
            // Inline code
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            // Bold
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/_([^_]+)_/g, '<em>$1</em>')
            // Lists (simple-minded approach, just wrapping lines for now)
            .replace(/^(\s*[\-\*] [^\n]+)/gm, '<li>$1</li>')
            // Newlines to br
            .replace(/\n/g, '<br/>');

        // Clean up list artifacts
        let inList = false;
        html = html.split('<br/>').map(line => {
            if (line.startsWith('<li>') && !inList) {
                inList = true;
                return '<ul>' + line;
            } else if (!line.startsWith('<li>') && inList) {
                inList = false;
                return '</ul>' + line;
            }
            return line;
        }).join('');

        if (inList) {
            html += '</ul>';
        }

        // Remove extra br/li artifacts
        html = html.replace(/<br\/><li>/g, '<li>').replace(/<\/li><br\/>/g, '</li>');

        return html;
    };

    // Utility for exponential backoff on API calls
    const fetchWithRetry = async (url, options, maxRetries = 5) => {
        for (let i = 0; i < maxRetries; i++) {
            try {
                const response = await fetch(url, options);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response;
            } catch (error) {
                if (i === maxRetries - 1) throw error; // Re-throw on last attempt
                const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    };


    // --- GEMINI API COMMUNICATION ---
    const generateContent = async (prompt, fileData) => {
        isThinking = true;
        const sendButton = document.getElementById('ai-send-btn');
        const input = document.getElementById('ai-input-textarea');
        if (sendButton) {
            sendButton.classList.add('thinking');
            sendButton.innerHTML = `<div class="dot-flashing"></div>`;
            sendButton.disabled = true;
        }
        if (input) input.disabled = true;

        const contents = [];

        // Add history for context
        if (chatHistory.length > 0) {
            contents.push(...chatHistory.map(msg => ({
                role: msg.role,
                parts: [{ text: msg.text }]
            })));
        }

        const userParts = [];
        userParts.push({ text: prompt });

        // Add file data if present
        if (fileData) {
            userParts.push({
                inlineData: {
                    mimeType: fileData.mimeType,
                    data: fileData.base64
                }
            });
        }

        contents.push({
            role: "user",
            parts: userParts
        });

        const payload = {
            contents: contents,
            // Configure model response
            config: {
                systemInstruction: "You are a helpful, expert programming assistant and academic tutor named Gemini. Respond to user queries in a concise and professional manner. When providing code, use markdown code blocks.",
                temperature: 0.2
            }
        };

        try {
            const response = await fetchWithRetry(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            // Error handling for API response
            if (result.error) {
                throw new Error(result.error.message || "API Error: Unknown error.");
            }

            const candidate = result.candidates?.[0];
            const generatedText = candidate?.content?.parts?.[0]?.text || "I apologize, I received an empty response.";

            // Update history only on successful response
            chatHistory.push({ role: "user", text: prompt });
            chatHistory.push({ role: "model", text: generatedText });

            // Prune history to save tokens (keep last 5 interactions + current one)
            if (chatHistory.length > 12) {
                chatHistory = chatHistory.slice(chatHistory.length - 12);
            }

            return generatedText;

        } catch (error) {
            console.error("Gemini API Error:", error);
            // Return a friendly error message
            return `An error occurred: ${error.message}. Please try again. (Check console for details.)`;
        } finally {
            isThinking = false;
            if (sendButton) {
                sendButton.classList.remove('thinking');
                sendButton.innerHTML = sendIconSVG;
                sendButton.disabled = false;
            }
            if (input) input.disabled = false;
        }
    };


    // --- UI RENDERERS ---

    const renderChatContainer = () => {
        if (document.getElementById('ai-chat-container')) return;

        const container = document.createElement('div');
        container.id = 'ai-chat-container';
        container.className = 'inactive'; // Start inactive
        document.body.appendChild(container);

        container.innerHTML = `
            <div id="ai-chat-header">
                <div class="header-content">
                    ${geminiLogoSVG}
                    <span>Gemini Assistant</span>
                </div>
                <button id="ai-clear-history-btn" title="Clear History">${clearIconSVG}</button>
            </div>
            <div id="ai-chat-history">
                <div class="message model initial">
                    ${geminiLogoSVG}
                    <div class="message-content">
                        Hello! I'm Gemini, your helpful programming and academic assistant.
                        Press **Ctrl + C** (or Cmd + C) to close me. How can I help you today?
                    </div>
                </div>
            </div>
            <div id="ai-input-area">
                <div id="ai-attachment-subject-menu" class="hidden">
                    <div class="menu-header">Attachment Menu</div>
                    <div id="file-preview-area"></div>
                    <input type="file" id="ai-file-input" accept="image/*,.txt,.md,.js,.py,.html,.css,.json,.java,.c,.cpp" style="display:none;">
                    <div id="attachment-buttons">
                        <button id="ai-attach-file-btn" class="menu-btn">${attachIconSVG} Attach File</button>
                        <button id="ai-remove-file-btn" class="menu-btn remove-btn hidden">Remove File</button>
                    </div>
                </div>
                <div id="ai-input-controls">
                    <button id="ai-attach-menu-btn" title="Attach File / Set Subject" class="menu-toggle-btn">${moreIconSVG}</button>
                    <textarea id="ai-input-textarea" placeholder="Ask Gemini..." rows="1" maxlength="${CHAR_LIMIT}"></textarea>
                    <div id="char-counter">${CHAR_LIMIT}</div>
                    <button id="ai-send-btn" title="Send Message" disabled>${sendIconSVG}</button>
                </div>
            </div>
        `;
    };

    const appendMessage = (role, text, fileUrl = null) => {
        const historyDiv = document.getElementById('ai-chat-history');
        if (!historyDiv) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;

        let iconHtml = '';
        if (role === 'model') {
            iconHtml = geminiLogoSVG;
        } else if (role === 'user') {
            iconHtml = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
        }

        let contentHtml = `<div class="message-content">${markdownToHtml(text)}</div>`;
        if (fileUrl) {
            contentHtml = `<img src="${fileUrl}" alt="Attached file" class="attached-image"/>` + contentHtml;
        }

        messageDiv.innerHTML = `${iconHtml}${contentHtml}`;
        historyDiv.appendChild(messageDiv);
        historyDiv.scrollTop = historyDiv.scrollHeight;

        // Add event listeners for copy buttons in the new message
        messageDiv.querySelectorAll('.copy-btn').forEach(button => {
            button.addEventListener('click', handleCopyCode);
        });
    };

    const handleCopyCode = (event) => {
        const button = event.currentTarget;
        const base64Code = button.getAttribute('data-code');
        const code = atob(base64Code);

        // Copy to clipboard
        const textarea = document.createElement('textarea');
        textarea.value = code;
        textarea.style.position = 'fixed'; // Ensure it's off-screen
        document.body.appendChild(textarea);
        textarea.select();

        try {
            document.execCommand('copy');
            // Change icon to checkmark temporarily
            button.innerHTML = checkIconSVG;
            setTimeout(() => {
                button.innerHTML = copyIconSVG;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
            // Optionally provide an alternative way to copy or an error message
        } finally {
            document.body.removeChild(textarea);
        }
    };


    // --- EVENT HANDLERS ---

    let uploadedFile = null;

    // Function to toggle the chat UI visibility
    const toggleChat = () => {
        const chatContainer = document.getElementById('ai-chat-container');
        const textarea = document.getElementById('ai-input-textarea');

        chatContainer.classList.toggle('inactive');
        chatContainer.classList.toggle('active');

        if (chatContainer.classList.contains('active')) {
            textarea.focus();
        } else {
            textarea.blur();
        }
    };


    const handleInput = (event) => {
        const textarea = event.target;
        const sendButton = document.getElementById('ai-send-btn');
        const charCounter = document.getElementById('char-counter');
        const text = textarea.value.trim();

        // Character limit logic
        if (textarea.value.length > CHAR_LIMIT) {
            textarea.value = textarea.value.substring(0, CHAR_LIMIT);
        }
        charCounter.textContent = CHAR_LIMIT - textarea.value.length;
        charCounter.classList.toggle('warning', textarea.value.length > CHAR_LIMIT - 50);

        // Auto-resize logic
        textarea.style.height = 'auto'; // Temporarily reset height
        const newHeight = Math.min(textarea.scrollHeight, MAX_INPUT_HEIGHT);
        textarea.style.height = `${newHeight}px`;

        // Enable/Disable send button
        if (sendButton) {
            sendButton.disabled = isThinking || text.length === 0;
        }
    };

    const handlePaste = (event) => {
        const paste = (event.clipboardData || window.clipboardData).getData('text');
        const textarea = event.target;
        const currentText = textarea.value;
        const newText = currentText.substring(0, textarea.selectionStart) + paste + currentText.substring(textarea.selectionEnd);

        if (newText.length > CHAR_LIMIT) {
            // Prevent paste if it exceeds the limit
            event.preventDefault();
            textarea.value = newText.substring(0, CHAR_LIMIT);
            handleInput({ target: textarea }); // Re-trigger input handling
            // Optionally notify user
        }
    };

    const handleSend = async (event) => {
        event.preventDefault();
        const textarea = document.getElementById('ai-input-textarea');
        const prompt = textarea.value.trim();

        if (prompt === '' || isThinking) return;

        // 1. Render user message
        appendMessage('user', prompt, uploadedFile ? uploadedFile.fileUrl : null);

        // 2. Clear input and file state
        textarea.value = '';
        textarea.style.height = 'auto';
        handleInput({ target: textarea });
        uploadedFile = null;
        document.getElementById('file-preview-area').innerHTML = '';
        document.getElementById('ai-remove-file-btn').classList.add('hidden');
        document.getElementById('ai-attachment-subject-menu').classList.remove('active');


        // 3. Call Gemini
        const fileDataForAPI = uploadedFile ? {
            base64: uploadedFile.base64,
            mimeType: uploadedFile.mimeType
        } : null;

        const responseText = await generateContent(prompt, fileDataForAPI);

        // 4. Render model response
        appendMessage('model', responseText);
    };

    const handleFileAttach = () => {
        document.getElementById('ai-file-input').click();
    };

    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result.split(',')[1];
            const mimeType = file.type || 'application/octet-stream';
            const fileUrl = e.target.result;

            uploadedFile = { base64, mimeType, fileName: file.name, fileUrl };

            // Update preview
            const previewArea = document.getElementById('file-preview-area');
            let previewHtml = '';

            if (mimeType.startsWith('image/')) {
                previewHtml = `<img src="${fileUrl}" alt="Preview" class="file-preview-image">`;
            } else {
                previewHtml = `<div class="file-preview-text">${file.name} (${(file.size / 1024).toFixed(1)} KB)</div>`;
            }
            previewArea.innerHTML = previewHtml;
            document.getElementById('ai-remove-file-btn').classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    };

    const handleFileRemove = () => {
        uploadedFile = null;
        document.getElementById('ai-file-input').value = null; // Clear input field
        document.getElementById('file-preview-area').innerHTML = '';
        document.getElementById('ai-remove-file-btn').classList.add('hidden');
    };

    const handleClearHistory = () => {
        if (isThinking) return;
        const historyDiv = document.getElementById('ai-chat-history');
        if (historyDiv) {
            historyDiv.innerHTML = `
                <div class="message model initial">
                    ${geminiLogoSVG}
                    <div class="message-content">
                        Chat history cleared. How can I assist you now?
                    </div>
                </div>
            `;
            chatHistory = [];
        }
    };

    const handleToggleMenu = () => {
        const menu = document.getElementById('ai-attachment-subject-menu');
        menu.classList.toggle('hidden');
    };

    /**
     * Handles keyboard events to activate the AI chat via Ctrl/Cmd + C
     */
    const handleKeyboardShortcut = (e) => {
        // Check for Ctrl key (Windows/Linux) or Command key (Mac)
        const isModifierPressed = e.ctrlKey || e.metaKey;

        // Check for 'C' key
        if (isModifierPressed && e.key === 'c') {
            e.preventDefault(); // Prevent the default copy action
            toggleChat();
        }
    };

    // --- CSS INJECTION ---

    /** Custom CSS and Fonts **/
    const injectStyles = () => {
        if (document.getElementById('ai-activation-styles')) return;
        const style = document.createElement('style');
        style.id = 'ai-activation-styles';
        style.textContent = `
            /*
            * FONT UPDATE: Converted fonts to Geist Sans and Merriweather as requested.
            */
            @import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&display=swap');

            :root {
                /* Colors */
                --bg-dark: #1e1e1e;
                --bg-light: #2c2c2c;
                --text-light: #f0f0f0;
                --text-muted: #aaaaaa;
                --accent-blue: #4a90e2;
                --accent-green: #7ed321;

                /* Gemini Colors (for glow effect) */
                --ai-blue: #4285F4;
                --ai-green: #34A853;
                --ai-yellow: #FBBC04;
                --ai-red: #EA4335;

                /* Fonts */
                /* Primary font set to Geist Sans (sans-serif) as requested, with system fallbacks */
                --font-primary: 'Geist Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                /* Secondary font set to Merriweather (serif) as requested */
                --font-secondary: 'Merriweather', serif;

                /* Dimensions */
                --chat-width: 320px;
                --chat-height: 480px;
            }

            /* Global styling for the chat container and its children */
            #ai-chat-container {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: var(--chat-width);
                height: var(--chat-height);
                background: var(--bg-dark);
                border-radius: 16px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
                display: flex;
                flex-direction: column;
                z-index: 10000;
                opacity: 0;
                transform: translateY(20px) scale(0.95);
                transition: opacity 0.3s ease, transform 0.3s ease;
                font-size: 14px;
                color: var(--text-light);
                max-width: 90vw; /* Responsive safety */
                max-height: 90vh;
            }

            #ai-chat-container.active {
                opacity: 1;
                transform: translateY(0) scale(1);
            }

            #ai-chat-container.inactive {
                display: none; /* Hide when not active to prevent interaction */
            }

            body, #ai-chat-container * {
                font-family: var(--font-primary) !important;
                transition: all 0.3s ease-in-out;
            }

            /* Responsive adjustments for smaller screens */
            @media (max-width: 600px) {
                #ai-chat-container {
                    bottom: 10px;
                    right: 10px;
                    width: 100vw;
                    height: 100vh;
                    border-radius: 0;
                    box-shadow: none;
                }
            }

            /* Header Styling */
            #ai-chat-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 15px;
                background-color: var(--bg-light);
                border-top-left-radius: 16px;
                border-top-right-radius: 16px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            }

            .header-content {
                display: flex;
                align-items: center;
                font-size: 1.1em;
                font-weight: 700;
                font-family: var(--font-secondary) !important; /* Use secondary font for title */
            }

            .gemini-logo {
                width: 20px;
                height: 20px;
                margin-right: 8px;
                color: var(--accent-blue);
                animation: gemini-glow 4s infinite ease-in-out;
            }

            #ai-clear-history-btn {
                background: none;
                border: none;
                color: var(--text-muted);
                cursor: pointer;
                padding: 5px;
                border-radius: 8px;
                transition: color 0.2s, background-color 0.2s;
            }

            #ai-clear-history-btn:hover {
                color: var(--text-light);
                background-color: rgba(255, 255, 255, 0.1);
            }

            /* History Styling */
            #ai-chat-history {
                flex-grow: 1;
                overflow-y: auto;
                padding: 10px 15px;
                scroll-behavior: smooth;
            }

            /* Custom Scrollbar for History */
            #ai-chat-history::-webkit-scrollbar { width: 8px; }
            #ai-chat-history::-webkit-scrollbar-track { background: var(--bg-dark); }
            #ai-chat-history::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 4px; }
            #ai-chat-history::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.3); }

            /* Message Styling */
            .message {
                display: flex;
                align-items: flex-start;
                margin-bottom: 15px;
                gap: 10px;
            }

            .message svg {
                min-width: 24px;
                min-height: 24px;
                color: var(--text-light);
                margin-top: 3px;
            }

            .message-content {
                max-width: 85%;
                padding: 10px 15px;
                border-radius: 12px;
                line-height: 1.5;
                white-space: pre-wrap;
                word-wrap: break-word;
            }

            .message.model .message-content {
                background-color: var(--bg-light);
                border-top-left-radius: 4px;
                font-family: var(--font-primary);
            }

            .message.user .message-content {
                background-color: var(--accent-blue);
                color: white;
                margin-left: auto;
                border-top-right-radius: 4px;
                font-family: var(--font-primary);
            }

            .message.user svg {
                color: var(--accent-blue);
            }
            .message.user {
                flex-direction: row-reverse;
            }

            /* Initial message styling */
            .message.model.initial {
                border: 1px solid rgba(255, 255, 255, 0.1);
                padding: 10px;
                margin-top: 5px;
                border-radius: 12px;
            }

            /* Code Block Styling */
            .code-block-wrapper {
                position: relative;
                margin: 10px 0;
                border-radius: 8px;
                background-color: rgba(0, 0, 0, 0.3);
            }

            .code-block-wrapper pre {
                margin: 0;
                padding: 15px;
                overflow: auto;
                background-color: transparent;
            }

            .code-block-wrapper pre::-webkit-scrollbar { height: 8px; }
            .code-block-wrapper pre::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }

            .code-block-wrapper code {
                font-family: 'Menlo', 'Consolas', monospace;
                font-size: 0.9em;
                color: #f0f0f0;
            }

            .copy-btn {
                position: absolute;
                top: 8px;
                right: 8px;
                background: rgba(255, 255, 255, 0.1);
                color: var(--text-light);
                border: none;
                padding: 6px;
                border-radius: 6px;
                cursor: pointer;
                transition: background 0.2s, transform 0.1s;
                display: flex;
                align-items: center;
                gap: 5px;
                font-size: 12px;
                font-family: var(--font-primary);
            }

            .copy-btn:hover {
                background: rgba(255, 255, 255, 0.2);
            }

            .copy-btn svg {
                margin-top: 0;
            }

            /* Input Area Styling */
            #ai-input-area {
                padding: 10px 15px;
                border-top: 1px solid rgba(255, 255, 255, 0.05);
                border-bottom-left-radius: 16px;
                border-bottom-right-radius: 16px;
            }

            #ai-attachment-subject-menu {
                padding: 10px 0;
                margin-bottom: 10px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 12px;
                display: flex;
                flex-direction: column;
                gap: 10px;
                transition: max-height 0.3s ease-out, opacity 0.3s ease-out, padding 0.3s ease-out;
                overflow: hidden;
                max-height: 0;
                opacity: 0;
                padding: 0 10px;
            }

            #ai-attachment-subject-menu.hidden {
                max-height: 0;
                padding: 0 10px;
                margin-bottom: 0;
                border: none;
            }

            #ai-attachment-subject-menu:not(.hidden) {
                max-height: 300px;
                opacity: 1;
                padding: 10px;
                margin-bottom: 10px;
            }

            .menu-header {
                font-family: var(--font-secondary);
                font-weight: 700;
                color: var(--accent-blue);
                margin-bottom: 5px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                padding-bottom: 5px;
            }

            #attachment-buttons {
                display: flex;
                gap: 10px;
                justify-content: flex-start;
            }

            .menu-btn {
                background-color: var(--accent-green);
                color: var(--bg-dark);
                border: none;
                padding: 8px 12px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 700;
                transition: background-color 0.2s, transform 0.1s;
                display: flex;
                align-items: center;
                gap: 5px;
            }

            .menu-btn:hover {
                background-color: #6fb51e;
            }

            .menu-btn.remove-btn {
                background-color: var(--ai-red);
                color: var(--text-light);
            }

            .menu-btn.remove-btn:hover {
                background-color: #b73229;
            }

            #file-preview-area {
                padding: 10px;
                border: 1px dashed rgba(255, 255, 255, 0.2);
                border-radius: 8px;
                min-height: 50px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--text-muted);
            }

            .file-preview-image {
                max-width: 100px;
                max-height: 100px;
                border-radius: 6px;
                object-fit: cover;
            }

            .file-preview-text {
                font-family: monospace;
                font-size: 0.9em;
                word-break: break-all;
            }

            #ai-input-controls {
                display: flex;
                align-items: flex-end;
                gap: 10px;
            }

            #ai-input-textarea {
                flex-grow: 1;
                background: var(--bg-light);
                border: 1px solid rgba(255, 255, 255, 0.1);
                color: var(--text-light);
                padding: 10px;
                border-radius: 12px;
                resize: none;
                min-height: 40px;
                max-height: 200px;
                overflow-y: auto;
                box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
            }

            #ai-input-textarea:focus {
                outline: none;
                border-color: var(--accent-blue);
                box-shadow: 0 0 0 1px var(--accent-blue);
            }

            #char-counter {
                font-size: 0.8em;
                color: var(--text-muted);
                position: absolute;
                bottom: 50px; /* Adjusted to sit above the textarea */
                right: 60px;
                background: var(--bg-dark);
                padding: 2px 4px;
                border-radius: 4px;
                pointer-events: none;
                transition: color 0.3s;
            }

            #char-counter.warning {
                color: var(--ai-red);
            }

            /* Send Button Styling */
            #ai-send-btn, #ai-attach-menu-btn {
                background: var(--accent-blue);
                border: none;
                color: white;
                padding: 8px;
                border-radius: 10px;
                cursor: pointer;
                transition: background-color 0.2s, transform 0.1s, opacity 0.3s;
                height: 40px;
                width: 40px;
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            #ai-send-btn:hover:not(:disabled) {
                background-color: #3a7fd0;
            }

            #ai-send-btn:disabled {
                background-color: rgba(74, 144, 226, 0.5);
                cursor: not-allowed;
                opacity: 0.6;
            }

            #ai-attach-menu-btn {
                background: var(--bg-light);
                color: var(--text-light);
            }

            #ai-attach-menu-btn:hover {
                background: rgba(255, 255, 255, 0.1);
            }

            /* Thinking (Loading) Animation */
            .dot-flashing {
                position: relative;
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background-color: white;
                color: white;
                animation: dotFlashing 1s infinite linear alternate;
                animation-delay: 0.5s;
            }

            .dot-flashing::before, .dot-flashing::after {
                content: '';
                display: inline-block;
                position: absolute;
                top: 0;
            }

            .dot-flashing::before {
                left: -10px;
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background-color: white;
                color: white;
                animation: dotFlashing 1s infinite alternate;
                animation-delay: 0s;
            }

            .dot-flashing::after {
                left: 10px;
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background-color: white;
                color: white;
                animation: dotFlashing 1s infinite alternate;
                animation-delay: 1s;
            }

            @keyframes dotFlashing {
                0% { background-color: white; opacity: 1; }
                50%, 100% { background-color: rgba(255, 255, 255, 0.3); opacity: 0.5; }
            }

            @keyframes glow {
                0%,100% { box-shadow: 0 0 5px rgba(255,255,255,.15), 0 0 10px rgba(255,255,255,.1); }
                50% { box-shadow: 0 0 10px rgba(255,255,255,.25), 0 0 20px rgba(255,255,255,.2); }
            }

            @keyframes gemini-glow {
                0%,100% { box-shadow: 0 0 8px 2px var(--ai-blue); }
                25% { box-shadow: 0 0 8px 2px var(--ai-green); }
                50% { box-shadow: 0 0 8px 2px var(--ai-yellow); }
                75% { box-shadow: 0 0 8px 2px var(--ai-red); }
            }
        `;
        document.head.appendChild(style);
    };

    // --- INITIALIZATION ---

    const init = () => {
        // 1. Inject Styles
        injectStyles();

        // 2. Render UI
        renderChatContainer();

        // 3. Attach Keyboard Shortcut Listener
        // This is the new logic for Ctrl/Cmd + C activation
        document.addEventListener('keydown', handleKeyboardShortcut);


        // 4. Attach Events to Input Elements
        const textarea = document.getElementById('ai-input-textarea');
        const sendButton = document.getElementById('ai-send-btn');
        const clearButton = document.getElementById('ai-clear-history-btn');
        const attachFileBtn = document.getElementById('ai-attach-file-btn');
        const removeFileBtn = document.getElementById('ai-remove-file-btn');
        const fileInput = document.getElementById('ai-file-input');
        const attachMenuBtn = document.getElementById('ai-attach-menu-btn');

        if (textarea) {
            textarea.addEventListener('input', handleInput);
            textarea.addEventListener('paste', handlePaste);
            textarea.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (textarea.value.trim() !== '' && !isThinking) {
                        handleSend(e);
                    }
                }
            });
        }

        if (sendButton) sendButton.addEventListener('click', handleSend);
        if (clearButton) clearButton.addEventListener('click', handleClearHistory);
        if (attachFileBtn) attachFileBtn.addEventListener('click', handleFileAttach);
        if (removeFileBtn) removeFileBtn.addEventListener('click', handleFileRemove);
        if (fileInput) fileInput.addEventListener('change', handleFileSelect);
        if (attachMenuBtn) attachMenuBtn.addEventListener('click', handleToggleMenu);

        // Add event listeners for initial message's copy buttons
        document.querySelectorAll('#ai-chat-history .copy-btn').forEach(button => {
            button.addEventListener('click', handleCopyCode);
        });

        // NOTE: The previous click listener for the #ai-mode-activation-btn has been removed
        // as activation is now purely keyboard-based.
    };

    // Run initialization on DOM content loaded
    document.addEventListener('DOMContentLoaded', init);

})();
