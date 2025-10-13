/**
 * mode-activation.js
 *
 * This script has been completely redesigned into a fullscreen AI chatbot experience.
 *
 * Features:
 * - Activation via Ctrl + \ keyboard shortcut.
 * - Fullscreen interface with a blurred background effect.
 * - Personalized greetings by remembering the user's name in local storage.
 * - A persistent memory system: tell the AI to "remember..." something,
 * and it will recall it in future conversations.
 * - System context awareness (time and location) for more relevant answers.
 * - Utilizes Merriweather and Geist fonts for a clean, modern look.
 */
(function() {
    // --- CONFIGURATION ---
    // NOTE: This is a public-facing key. For production, secure this on a backend.
    const API_KEY = 'AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro'; // Replace with your actual Gemini API key
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${API_KEY}`;

    // --- STATE MANAGEMENT ---
    let isAIActive = false;
    let isRequestPending = false;
    let currentAIRequestController = null;
    let chatHistory = [];
    let userName = '';

    // --- LOCAL STORAGE HELPERS ---
    const memory = {
        getUserName: () => localStorage.getItem('ai_user_name'),
        setUserName: (name) => localStorage.setItem('ai_user_name', name),
        getMemories: () => JSON.parse(localStorage.getItem('ai_saved_memories')) || [],
        saveMemory: (fact) => {
            const memories = memory.getMemories();
            memories.push(fact);
            localStorage.setItem('ai_saved_memories', JSON.stringify(memories));
        }
    };

    /**
     * Main keyboard listener to activate or deactivate the AI chat.
     * @param {KeyboardEvent} e - The keyboard event.
     */
    function handleKeyDown(e) {
        // Activate with Ctrl + \
        if (e.ctrlKey && e.key === '\\') {
            e.preventDefault();
            if (!isAIActive) {
                activateAI();
            }
        }
        // Deactivate with Escape key
        if (e.key === 'Escape' && isAIActive) {
            e.preventDefault();
            deactivateAI();
        }
    }

    /**
     * Injects the necessary HTML and CSS into the page and shows the AI interface.
     */
    function activateAI() {
        if (document.getElementById('ai-container')) return;

        userName = memory.getUserName();
        injectStyles();

        const container = document.createElement('div');
        container.id = 'ai-container';

        const welcomeMessage = document.createElement('div');
        welcomeMessage.id = 'ai-welcome-message';
        const welcomeText = userName ? `Welcome back, ${userName}` : 'Welcome back';
        welcomeMessage.innerHTML = `<h2>${welcomeText}</h2><p>Ask me anything, or tell me your name.</p>`;

        const closeHint = document.createElement('div');
        closeHint.id = 'ai-close-hint';
        closeHint.textContent = 'Press Esc to close';

        const responseContainer = document.createElement('div');
        responseContainer.id = 'ai-response-container';

        const inputWrapper = document.createElement('div');
        inputWrapper.id = 'ai-input-wrapper';

        const visualInput = document.createElement('div');
        visualInput.id = 'ai-input';
        visualInput.contentEditable = true;
        visualInput.setAttribute('placeholder', 'Message Gemini...');
        visualInput.onkeydown = handleInputSubmission;

        const sendButton = document.createElement('button');
        sendButton.id = 'ai-send-button';
        sendButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="m22 2-11 11"/></svg>`;
        sendButton.onclick = () => {
             const mockEvent = { key: 'Enter', preventDefault: () => {} };
             handleInputSubmission(mockEvent);
        };

        inputWrapper.appendChild(visualInput);
        inputWrapper.appendChild(sendButton);

        container.appendChild(welcomeMessage);
        container.appendChild(closeHint);
        container.appendChild(responseContainer);
        container.appendChild(inputWrapper);

        document.body.appendChild(container);
        document.body.style.overflow = 'hidden'; // Prevent background scrolling

        setTimeout(() => {
            container.classList.add('active');
            visualInput.focus();
        }, 10);

        isAIActive = true;
    }

    /**
     * Removes the AI interface and cleans up styles and event listeners.
     */
    function deactivateAI() {
        if (currentAIRequestController) {
            currentAIRequestController.abort();
        }

        const container = document.getElementById('ai-container');
        if (container) {
            container.classList.remove('active');
            setTimeout(() => {
                container.remove();
                const styles = document.getElementById('ai-dynamic-styles');
                if (styles) styles.remove();
                document.body.style.overflow = ''; // Restore scrolling
            }, 500);
        }

        isAIActive = false;
        isRequestPending = false;
        chatHistory = []; // Clear history on close
    }
    
    /**
     * Handles the user submitting a message via Enter key or send button.
     * @param {KeyboardEvent} e - The keyboard event from the input field.
     */
    function handleInputSubmission(e) {
        const editor = document.getElementById('ai-input');
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const query = editor.innerText.trim();
            if (!query || isRequestPending) return;

            // Fade out welcome message on first interaction
            const welcomeMessage = document.getElementById('ai-welcome-message');
            if (welcomeMessage) {
                welcomeMessage.style.opacity = '0';
                welcomeMessage.style.pointerEvents = 'none';
            }

            // --- Local Command Handling ---
            const lowerQuery = query.toLowerCase();
            if (lowerQuery.startsWith("my name is")) {
                const potentialName = query.substring(11).trim().split(" ")[0];
                if (potentialName) {
                    const name = potentialName.charAt(0).toUpperCase() + potentialName.slice(1).replace(/[^a-zA-Z]/g, '');
                    userName = name;
                    memory.setUserName(name);
                    appendMessage(`Okay, I'll remember your name is ${name}.`, 'gemini');
                    editor.innerText = '';
                    return;
                }
            }
            
            if (lowerQuery.startsWith("remember")) {
                const fact = query.substring(8).trim();
                if (fact) {
                    memory.saveMemory(fact);
                    appendMessage(`Got it. I'll remember that.`, 'gemini');
                    editor.innerText = '';
                    return;
                }
            }

            // --- Regular API Call ---
            isRequestPending = true;
            appendMessage(query, 'user');
            chatHistory.push({ role: "user", parts: [{ text: query }] });
            editor.innerText = '';

            const responseBubble = appendMessage('', 'gemini', true); // Add loading bubble
            callGoogleAI(responseBubble);
        }
    }
    
    /**
     * Appends a message to the chat container.
     * @param {string} content - The HTML or text content of the message.
     * @param {('user'|'gemini')} role - The role of the message sender.
     * @param {boolean} [isLoading=false] - If true, displays a loading indicator.
     * @returns {HTMLElement} The created message bubble element.
     */
    function appendMessage(content, role, isLoading = false) {
        const responseContainer = document.getElementById('ai-response-container');
        const bubble = document.createElement('div');
        bubble.className = `ai-message-bubble ${role}-message`;

        if (isLoading) {
            bubble.classList.add('loading');
            bubble.innerHTML = '<div class="ai-loader"></div>';
        } else {
            bubble.innerHTML = parseResponse(content);
        }
        
        responseContainer.appendChild(bubble);
        responseContainer.scrollTop = responseContainer.scrollHeight;
        return bubble;
    }


    /**
     * Constructs the prompt and calls the Gemini API.
     * @param {HTMLElement} responseBubble - The chat bubble to populate with the response.
     */
    async function callGoogleAI(responseBubble) {
        if (!API_KEY || API_KEY === 'YOUR_API_KEY_HERE') {
            responseBubble.innerHTML = `<div class="ai-error">API Key is missing. Please add your key to the script.</div>`;
            responseBubble.classList.remove('loading');
            isRequestPending = false;
            return;
        }

        currentAIRequestController = new AbortController();
        
        // --- System Information and Memory Injection ---
        const location = "user's approximate location (e.g., city/country)"; // Could be fetched via a geo API
        const now = new Date();
        const date = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const time = now.toLocaleTimeString('en-US', { timeZoneName: 'short' });
        const savedMemories = memory.getMemories();
        
        let systemPrompt = `You are a helpful and friendly AI assistant.
        Current date and time: ${date}, ${time}.
        User's location: ${location}.`;

        if (userName) {
            systemPrompt += `\nThe user's name is ${userName}. Address them by their name when appropriate.`;
        }

        if (savedMemories.length > 0) {
            systemPrompt += "\n\nHere are some things the user has asked you to remember. Use them to provide more personalized and accurate answers:\n";
            savedMemories.forEach(fact => {
                systemPrompt += `- ${fact}\n`;
            });
        }

        const payload = {
            contents: chatHistory,
            systemInstruction: { parts: [{ text: systemPrompt }] }
        };

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: currentAIRequestController.signal
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error.message || `Network response was not ok. Status: ${response.status}`);
            }

            const data = await response.json();
            if (!data.candidates || data.candidates.length === 0) {
                throw new Error("Invalid response from API.");
            }
            const text = data.candidates[0].content.parts[0].text;
            chatHistory.push({ role: "model", parts: [{ text }] });
            
            responseBubble.innerHTML = parseResponse(text);

        } catch (error) {
            if (error.name === 'AbortError') {
                responseBubble.innerHTML = `<div class="ai-error">Request stopped.</div>`;
            } else {
                console.error('AI API Error:', error);
                responseBubble.innerHTML = `<div class="ai-error">Sorry, an error occurred: ${error.message}</div>`;
            }
        } finally {
            isRequestPending = false;
            currentAIRequestController = null;
            responseBubble.classList.remove('loading');
            const responseContainer = document.getElementById('ai-response-container');
            if (responseContainer) responseContainer.scrollTop = responseContainer.scrollHeight;
        }
    }

    /**
     * Simple parser to convert markdown-like syntax to HTML.
     * @param {string} text - The raw text from the AI.
     * @returns {string} HTML-formatted string.
     */
    function parseResponse(text) {
        let html = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

        // Bold, Italic, and Code blocks
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                   .replace(/\*(.*?)\*/g, '<em>$1</em>')
                   .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
                   .replace(/`(.*?)`/g, '<code>$1</code>');
        
        // Convert newlines to <br> tags
        html = html.replace(/\n/g, '<br>');
        
        return html;
    }

    /**
     * Injects all necessary CSS for the AI interface into the document head.
     */
    function injectStyles() {
        if (document.getElementById('ai-dynamic-styles')) return;

        const style = document.createElement("style");
        style.id = "ai-dynamic-styles";
        style.innerHTML = `
            @import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&family=Geist+Sans:wght@400;500;700&display=swap');
            
            :root {
                --font-sans: 'Geist Sans', sans-serif;
                --font-serif: 'Merriweather', serif;
            }

            #ai-container {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background-color: rgba(10, 10, 15, 0.5);
                backdrop-filter: blur(0px);
                -webkit-backdrop-filter: blur(0px);
                z-index: 2147483647;
                opacity: 0;
                transition: opacity 0.5s, backdrop-filter 0.5s, -webkit-backdrop-filter 0.5s;
                font-family: var(--font-sans);
                display: flex;
                flex-direction: column;
                justify-content: flex-end;
                box-sizing: border-box;
                overflow: hidden;
            }
            #ai-container.active {
                opacity: 1;
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
            }
            #ai-welcome-message {
                position: absolute;
                top: 45%;
                left: 50%;
                transform: translate(-50%,-50%);
                text-align: center;
                color: rgba(255,255,255,.6);
                opacity: 1;
                transition: opacity .5s, transform .5s;
                width: 100%;
                pointer-events: all;
            }
            #ai-welcome-message h2 {
                font-family: var(--font-serif);
                font-size: 3em;
                margin: 0;
                color: #fff;
                font-weight: 700;
            }
            #ai-welcome-message p {
                font-size: 1.1em;
                margin-top: 10px;
                max-width: 400px;
                margin-left: auto;
                margin-right: auto;
                line-height: 1.5;
            }
            #ai-close-hint {
                position: absolute;
                top: 20px;
                right: 30px;
                color: rgba(255,255,255,.7);
                font-size: 14px;
                background: rgba(0,0,0,0.3);
                padding: 5px 10px;
                border-radius: 15px;
            }
            #ai-response-container {
                flex: 1 1 auto;
                overflow-y: auto;
                width: 100%;
                max-width: 800px;
                margin: 0 auto;
                display: flex;
                flex-direction: column;
                gap: 15px;
                padding: 70px 20px 20px 20px;
            }
            .ai-message-bubble {
                background: rgba(30, 30, 35, 0.6);
                border: 1px solid rgba(255,255,255,.1);
                border-radius: 18px;
                padding: 15px 20px;
                color: #e0e0e0;
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                max-width: 85%;
                line-height: 1.6;
                overflow-wrap: break-word;
                font-size: 16px;
                animation: message-pop-in .4s cubic-bezier(.4,0,.2,1) forwards;
            }
            .user-message {
                align-self: flex-end;
                background: rgba(67, 97, 238, 0.7);
                border-color: rgba(107, 137, 255, 0.5);
                color: white;
            }
            .gemini-message {
                align-self: flex-start;
            }
            .gemini-message.loading {
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 50px;
                max-width: 80px;
            }
            #ai-input-wrapper {
                flex-shrink: 0;
                position: relative;
                margin: 20px auto 30px;
                width: 90%;
                max-width: 800px;
                border-radius: 20px;
                background: rgba(10,10,10,.5);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255,255,255,.2);
                display: flex;
                align-items: center;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            }
            #ai-input {
                flex-grow: 1;
                min-height: 54px;
                max-height: 200px;
                overflow-y: auto;
                color: #fff;
                font-size: 16px;
                padding: 16px 20px;
                box-sizing: border-box;
                word-wrap: break-word;
                outline: none;
                border: none;
                background: transparent;
            }
            #ai-input:empty::before {
                content: attr(placeholder);
                color: rgba(255, 255, 255, 0.4);
                pointer-events: none;
            }
            #ai-send-button {
                background: #4361ee;
                border: none;
                border-radius: 15px;
                color: white;
                cursor: pointer;
                width: 40px;
                height: 40px;
                margin-right: 8px;
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background-color 0.2s;
            }
            #ai-send-button:hover {
                background: #5c7aff;
            }
            .ai-loader {
                width: 25px;
                height: 25px;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                border: 3px solid rgba(255,255,255,0.3);
                border-top-color: #fff;
            }
            .ai-error { color: #ff8a80; }
            pre { background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; overflow-x: auto; font-family: 'Courier New', Courier, monospace;}
            code { font-family: 'Courier New', Courier, monospace; background: rgba(0,0,0,0.2); padding: 2px 5px; border-radius: 4px;}
            pre > code { background: none; padding: 0; }
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes message-pop-in {
                0% { opacity: 0; transform: translateY(10px) scale(.98); }
                100% { opacity: 1; transform: translateY(0) scale(1); }
            }
        `;
        document.head.appendChild(style);
    }

    // --- INITIALIZATION ---
    document.addEventListener('keydown', handleKeyDown);

})();
