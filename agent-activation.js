/**
 * agent-activation.js
 *
 * MODIFIED FOR HUMANITY GEN 0:
 * 1. REBRANDED: Agent name changed to "Humanity Gen 0".
 * 2. SETTINGS REMOVED: All settings UI (button, modal, preference logic) and localStorage persistence are removed.
 * 3. AESTHETICS: All orange and glowing CSS animations have been removed.
 * 4. WEB SEARCH ADDED: Implemented a toggle for Google Search Grounding via the Gemini API.
 * 5. SOURCES ADDED: Displays clickable citation sources (grounding metadata) when web search is used.
 *
 * Dependencies:
 * - KaTeX (for math rendering)
 * - Lucide Icons (for UI elements)
 * - Tailwind CSS (via CDN)
 */
(function() {
    // --- CONFIGURATION ---
    // NOTE: API_KEY is intentionally left empty. The environment will provide the necessary token/key.
    const API_KEY = '';
    const BASE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/`;
    // Use the model required for Google Search Grounding
    const MODEL_NAME = 'gemini-2.5-flash-preview-09-2025';
    
    // --- STATE ---
    let chatHistory = [];
    let isProcessing = false;
    let isActivated = false;
    let isWebSearchEnabled = false; // New state for web search toggle

    // --- AI PERSONA ---
    const AI_TITLE = 'Humanity Gen 0';
    const AI_PERSONA = 'You are Humanity Gen 0, a helpful and respectful large language model designed to assist users. Provide concise, clear, and well-structured responses. Use Markdown formatting and ensure all mathematical equations are enclosed in KaTeX syntax (`$` for inline, `$$` for display). Do not mention that you are an AI model or your purpose unless asked directly.';

    // --- DOM ELEMENT REFERENCES (pre-declaration) ---
    let aiContainer;
    let chatHistoryContainer;
    let userInput;
    let sendButton;
    let searchToggle;

    // --- UTILITIES ---

    // 1. Exponential Backoff for API Retries
    async function fetchWithRetry(url, options, maxRetries = 5) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                const response = await fetch(url, options);
                if (response.status === 429 && i < maxRetries - 1) {
                    const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue; // Retry the request
                }
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response;
            } catch (error) {
                if (i === maxRetries - 1) {
                    throw error;
                }
                const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    // 2. Autoresize textarea
    function autoResize(el) {
        el.style.height = 'auto';
        el.style.height = (el.scrollHeight) + 'px';
    }

    // 3. Simple Loading Spinner Management
    function toggleLoading(show) {
        if (show) {
            sendButton.innerHTML = `<div class="loading-spinner w-5 h-5 border-2 border-white border-t-blue-500"></div>`;
            sendButton.disabled = true;
            userInput.disabled = true;
            userInput.placeholder = 'Thinking...';
        } else {
            sendButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
            sendButton.disabled = false;
            userInput.disabled = false;
            userInput.placeholder = 'Ask me anything...';
        }
    }

    // 4. Scroll to bottom
    function scrollToBottom() {
        chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;
    }

    // --- CHAT RENDERING ---

    function createSourcesHtml(sources) {
        let listItems = sources.map((s, index) =>
            `<a href="${s.uri}" target="_blank" class="text-xs text-blue-300 hover:text-blue-100 block truncate transition duration-200" title="${s.title || s.uri}">
                <span class="font-semibold">${index + 1}.</span> ${s.title || 'Source Link'}
            </a>`
        ).join('');

        // Collapsible button for sources
        return `
            <div class="mt-3 pt-2 border-t border-gray-600">
                <button onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('svg').classList.toggle('rotate-180');"
                        class="flex items-center text-sm font-medium text-gray-300 hover:text-gray-100 focus:outline-none transition duration-200 p-1 -m-1 rounded-md">
                    <span class="mr-1">Sources Used (${sources.length})</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="transition-transform duration-200">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </button>
                <div class="mt-1 space-y-1 hidden">
                    ${listItems}
                </div>
            </div>
        `;
    }

    function renderMessage(role, text, sources = []) {
        const messageWrapper = document.createElement('div');
        messageWrapper.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'}`;

        const messageBubble = document.createElement('div');
        messageBubble.className = `message-bubble max-w-4/5 p-3 rounded-xl shadow-md ${role === 'user' ? 'bg-blue-600 text-white ml-auto rounded-br-sm' : 'bg-gray-700 text-gray-100 mr-auto rounded-bl-sm'}`;

        // Create content area
        const contentDiv = document.createElement('div');
        contentDiv.className = 'ai-message-bubble';
        contentDiv.innerHTML = text; // Content is pre-rendered Markdown/KaTeX

        messageBubble.appendChild(contentDiv);

        // Add Sources if available and it's an AI message
        if (role !== 'user' && sources && sources.length > 0) {
            const sourcesHtml = createSourcesHtml(sources);
            messageBubble.insertAdjacentHTML('beforeend', sourcesHtml);
        }

        messageWrapper.appendChild(messageBubble);
        chatHistoryContainer.appendChild(messageWrapper);
        scrollToBottom();
        
        // Render KaTeX after message is added to DOM
        if (role !== 'user') {
            try {
                 renderMathInElement(contentDiv, {
                    delimiters: [
                        {left: "$$", right: "$$", display: true},
                        {left: "$", right: "$", display: false}
                    ],
                    throwOnError: false
                });
            } catch (e) {
                console.error("KaTeX rendering error:", e);
            }
        }
    }

    // --- CHAT LOGIC ---

    async function sendChatMessage() {
        if (isProcessing) return;

        const userMessage = userInput.value.trim();
        if (!userMessage) return;

        // 1. Prepare UI
        toggleLoading(true);
        userInput.value = '';
        autoResize(userInput);

        // 2. Render User Message and add to history
        renderMessage('user', userMessage);
        chatHistory.push({ role: 'user', parts: [{ text: userMessage }] });

        let aiText = 'An unknown error occurred.';
        let sources = [];

        try {
            const apiUrl = `${BASE_API_URL}${MODEL_NAME}:generateContent?key=${API_KEY}`;
            
            // CONDITIONAL TOOL INCLUSION (Web Search Logic)
            const tools = isWebSearchEnabled ? [{ "google_search": {} }] : undefined;

            const payload = {
                contents: chatHistory,
                systemInstruction: { parts: [{ text: AI_PERSONA }] },
                // Only include tools if they are defined
                ...(tools && { tools: tools })
            };

            const response = await fetchWithRetry(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            const candidate = result.candidates?.[0];

            if (candidate && candidate.content?.parts?.[0]?.text) {
                aiText = candidate.content.parts[0].text;
                
                // Extract grounding sources
                const groundingMetadata = candidate.groundingMetadata;
                if (groundingMetadata && groundingMetadata.groundingAttributions) {
                    sources = groundingMetadata.groundingAttributions
                        .map(attribution => ({
                            uri: attribution.web?.uri,
                            title: attribution.web?.title,
                        }))
                        .filter(source => source.uri && source.title); // Ensure sources are valid
                }

            } else {
                aiText = 'The model returned an empty response.';
                console.error('API Response Error:', result);
            }

        } catch (error) {
            console.error('Fetch Error:', error);
            aiText = `Error: Could not connect to the AI model. Details: ${error.message}`;
        } finally {
            toggleLoading(false);
            
            // 3. Render AI Response and add to history
            renderMessage('model', aiText, sources);
            chatHistory.push({ role: 'model', parts: [{ text: aiText }] });
        }
    }

    // --- UI/DOM CREATION ---

    function createAndInjectUI() {
        // --- 1. CSS STYLES (Cleaned up, no glow, blue theme) ---
        const style = document.createElement('style');
        style.textContent = `
            :root {
                --humanity-blue: #0A66C2; /* Primary Action Blue */
                --bg-dark: #1F2937;
                --text-light: #F9FAFB;
            }

            /* Custom scrollbar */
            #chat-history-container::-webkit-scrollbar { width: 8px; }
            #chat-history-container::-webkit-scrollbar-thumb { background: #4B5563; border-radius: 4px; }
            #chat-history-container::-webkit-scrollbar-track { background: #374151; }

            /* Main Container */
            #ai-container {
                position: fixed;
                top: 50%;
                right: 20px;
                transform: translateY(-50%);
                width: 100%;
                max-width: 400px;
                height: 85vh;
                background-color: #374151; /* Darker slate */
                border-radius: 1rem;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                z-index: 50;
                transition: transform 0.3s ease-in-out, opacity 0.3s ease-in-out;
                opacity: 0;
                transform: translate(100%, -50%); /* Start off-screen */
                font-family: 'Inter', sans-serif;
            }

            #ai-container.active {
                opacity: 1;
                transform: translate(0, -50%); /* Slide in */
            }
            
            /* Header */
            #ai-header {
                padding: 1rem;
                background-color: #1F2937; /* Even darker slate */
                border-radius: 1rem 1rem 0 0;
                border-bottom: 1px solid #4B5563;
                display: flex;
                justify-content: space-between;
                align-items: center;
                color: var(--text-light);
            }

            /* Toggle Switch Style */
            .toggle-switch-container {
                display: flex;
                align-items: center;
                cursor: pointer;
            }
            .toggle-switch input[type="checkbox"] {
                opacity: 0;
                width: 0;
                height: 0;
            }
            .slider {
                position: relative;
                cursor: pointer;
                background-color: #ccc;
                transition: .4s;
                width: 38px;
                height: 20px;
                border-radius: 20px;
            }
            .slider:before {
                position: absolute;
                content: "";
                height: 14px;
                width: 14px;
                left: 3px;
                bottom: 3px;
                background-color: white;
                transition: .4s;
                border-radius: 50%;
            }
            input:checked + .slider {
                background-color: var(--humanity-blue);
            }
            input:checked + .slider:before {
                transform: translateX(18px);
            }

            /* Message Styling */
            .message-bubble {
                max-width: 85%;
                padding: 0.75rem 1rem;
                border-radius: 1rem;
                margin-bottom: 1rem;
                animation: message-pop-in 0.3s ease-out;
            }

            .ai-message-bubble * {
                max-width: 100%;
            }

            @keyframes message-pop-in {
                0% { opacity: 0; transform: translateY(10px); }
                100% { opacity: 1; transform: translateY(0); }
            }

            /* Loading Spinner */
            .loading-spinner {
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                to { transform: rotate(360deg); }
            }

            /* KaTeX specific overrides for dark theme */
            .katex-display {
                margin: 0.5em 0 !important;
                padding: 0.5em !important;
                background-color: #2D3748;
                border-radius: 0.5rem;
                overflow-x: auto;
            }
            .ai-message-bubble p { margin: 0; padding: 0; text-align: left; }
            .ai-message-bubble ul, .ai-message-bubble ol { margin: 10px 0; padding-left: 20px; text-align: left; list-style-position: outside; }
            .ai-message-bubble li { margin-bottom: 5px; }

            /* Fixes for markdown elements */
            .ai-message-bubble h1, .ai-message-bubble h2, .ai-message-bubble h3 { margin-top: 1rem; font-weight: bold; }
        `;
        document.head.appendChild(style);
        
        // --- 2. KA'TEX & LIBRARIES ---
        const linkKat = document.createElement('link');
        linkKat.rel = 'stylesheet';
        linkKat.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css';
        document.head.appendChild(linkKat);

        const scriptKat = document.createElement('script');
        scriptKat.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js';
        document.head.appendChild(scriptKat);

        const scriptAut = document.createElement('script');
        scriptAut.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js';
        document.head.appendChild(scriptAut);

        // --- 3. MAIN HTML STRUCTURE ---
        aiContainer = document.createElement('div');
        aiContainer.id = 'ai-container';
        aiContainer.className = 'hidden'; // Start hidden until activated

        aiContainer.innerHTML = `
            <header id="ai-header">
                <h2 class="text-xl font-bold">${AI_TITLE}</h2>
                <!-- Web Search Toggle -->
                <div class="toggle-switch-container">
                    <span class="text-sm font-medium mr-2">Web Search</span>
                    <label class="toggle-switch">
                        <input type="checkbox" id="web-search-toggle">
                        <span class="slider"></span>
                    </label>
                </div>
                <!-- Activation Button (now acts as a close button) -->
                <button id="activation-btn" class="text-gray-400 hover:text-white transition duration-200">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </header>

            <div id="chat-history-container" class="flex-grow p-4 overflow-y-auto bg-gray-800">
                <div class="flex justify-start">
                    <div class="message-bubble bg-gray-700 text-gray-100 mr-auto rounded-bl-sm">
                        Welcome! I am **Humanity Gen 0**. I'm here to assist you. Press <kbd>Ctrl</kbd> + <kbd>\\</kbd> to hide me.
                    </div>
                </div>
            </div>

            <div class="p-3 bg-gray-900 border-t border-gray-700">
                <div class="flex space-x-3 items-end">
                    <textarea id="user-input" rows="1" class="flex-grow p-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:ring-2 focus:ring-blue-500 resize-none overflow-hidden placeholder-gray-400" placeholder="Ask me anything..."></textarea>
                    <button id="send-button" class="flex-shrink-0 w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center transition duration-200">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(aiContainer);

        // --- 4. CACHE DOM REFERENCES ---
        chatHistoryContainer = document.getElementById('chat-history-container');
        userInput = document.getElementById('user-input');
        sendButton = document.getElementById('send-button');
        searchToggle = document.getElementById('web-search-toggle');
        const activationBtn = document.getElementById('activation-btn');

        // --- 5. INITIAL EVENT LISTENERS ---

        // Web Search Toggle Listener
        searchToggle.addEventListener('change', () => {
            isWebSearchEnabled = searchToggle.checked;
            console.log('Web Search Enabled:', isWebSearchEnabled);
        });

        // Send button listener
        sendButton.addEventListener('click', sendChatMessage);

        // Input field listeners
        userInput.addEventListener('input', () => autoResize(userInput));
        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });

        // Activation Button listener (to close the window)
        activationBtn.addEventListener('click', () => toggleActivation(false));

        // Global activation hotkey
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === '\\') {
                e.preventDefault();
                toggleActivation();
            }
        });
    }

    // --- ACTIVATION/DEACTIVATION ---

    function toggleActivation(force) {
        if (typeof force === 'boolean') {
            isActivated = force;
        } else {
            isActivated = !isActivated;
        }

        if (isActivated) {
            aiContainer.classList.remove('hidden');
            // Timeout allows the display block to take effect before the transition
            setTimeout(() => aiContainer.classList.add('active'), 10);
            userInput.focus();
        } else {
            aiContainer.classList.remove('active');
            // Timeout waits for the transition to finish before hiding
            setTimeout(() => aiContainer.classList.add('hidden'), 300);
        }
    }

    // --- INITIALIZATION ---

    // Wait for the entire page to load before injecting the AI UI
    window.addEventListener('load', () => {
        createAndInjectUI();
        console.log('Humanity Gen 0 Initialized. Use Ctrl + \\ to activate.');
    });

})();
