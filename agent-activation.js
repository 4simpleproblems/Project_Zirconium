/**
 * Humanity Gen 0 AI Model (agent-activation.js)
 *
 * MODIFIED: Refactored to Humanity Gen 0 branding.
 * REMOVED: All settings features (settings button, panel, and localStorage usage) are gone.
 * NEW: Implemented Google Search Grounding for real-time web access via a toggle switch.
 * NEW: Responses that utilize web search now display the grounded source citations.
 * UPDATED: Simplified CSS, removed glowing animations, and focused on a neutral, professional theme.
 *
 * NOTE: This implementation uses the integrated Google Search grounding tool, not a separate
 * Custom Search Engine CX ID, as this is the standard, modern approach for the Gemini API.
 */
(function() {
    // --- CONFIGURATION ---
    // The API key is left empty as the canvas environment will inject it at runtime.
    const API_KEY = 'AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro';
    // We use the recommended model for search grounding and general chat.
    const MODEL_NAME = 'gemini-2.5-flash';
    const BASE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
    
    const APP_TITLE = "Humanity Gen 0";
    const DEFAULT_SYSTEM_PROMPT = `You are the **Humanity Gen 0** AI Model. Your goal is to be a friendly, highly concise, and accurate assistant. Use markdown formatting extensively. When you use web search (Google Search Grounding) for factual information, make sure your response is directly supported by the sources provided. Be conversational and helpful.`;

    // --- STATE & INITIALIZATION ---
    let aiContainer;
    let chatHistory = [];
    let isInitialized = false;
    let isVisible = false;
    let isLoading = false;
    let currentSystemPrompt = DEFAULT_SYSTEM_PROMPT;
    let isWebSearchEnabled = true; // NEW: State for web searching

    // Helper functions for base64 to ArrayBuffer (for audio) - currently unused but kept for completeness
    function base64ToArrayBuffer(base64) {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }

    // NEW: Toggles the state of the web search
    function toggleWebSearch() {
        isWebSearchEnabled = !isWebSearchEnabled;
        const toggleButton = document.getElementById('web-search-toggle');
        const icon = document.getElementById('web-search-icon');
        
        if (isWebSearchEnabled) {
            toggleButton.classList.remove('bg-gray-700');
            toggleButton.classList.add('bg-blue-600');
            icon.classList.remove('text-gray-400');
            icon.classList.add('text-white');
            toggleButton.setAttribute('aria-checked', 'true');
        } else {
            toggleButton.classList.remove('bg-blue-600');
            toggleButton.classList.add('bg-gray-700');
            icon.classList.remove('text-white');
            icon.classList.add('text-gray-400');
            toggleButton.setAttribute('aria-checked', 'false');
        }
        console.log(`Web Search Enabled: ${isWebSearchEnabled}`);
    }

    // --- API & RESPONSE HANDLING ---

    // NEW: Handles the API call with conditional search grounding and source extraction.
    async function fetchResponse(prompt, history) {
        isLoading = true;
        const chatbox = document.getElementById('ai-chatbox');
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        if (chatbox) chatbox.scrollTop = chatbox.scrollHeight;

        // Use the full chat history for context
        const contents = history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        }));

        const payload = {
            contents: contents,
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2048,
            },
            systemInstruction: {
                parts: [{ text: currentSystemPrompt }]
            },
        };

        // Conditionally add the Google Search grounding tool
        if (isWebSearchEnabled) {
            payload.tools = [{ "google_search": {} }];
        }

        const maxRetries = 5;
        let attempt = 0;
        
        while (attempt < maxRetries) {
            try {
                const response = await fetch(BASE_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();
                const candidate = result.candidates?.[0];

                if (!candidate || !candidate.content?.parts?.[0]?.text) {
                    throw new Error("Invalid response structure from API.");
                }

                // 1. Extract the generated text
                const text = candidate.content.parts[0].text;

                // 2. Extract grounding sources
                let sources = [];
                const groundingMetadata = candidate.groundingMetadata;
                if (groundingMetadata && groundingMetadata.groundingAttributions) {
                    sources = groundingMetadata.groundingAttributions
                        .map(attribution => ({
                            uri: attribution.web?.uri,
                            title: attribution.web?.title,
                        }))
                        .filter(source => source.uri && source.title); // Ensure sources are valid
                }
                
                return { text, sources };

            } catch (error) {
                console.error(`Attempt ${attempt + 1} failed:`, error);
                attempt++;
                if (attempt < maxRetries) {
                    const delay = Math.pow(2, attempt) * 1000; // Exponential backoff (1s, 2s, 4s, 8s, ...)
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    return { text: "I'm sorry, I'm having trouble connecting to the network right now. Please try again later.", sources: [] };
                }
            }
        }
    }


    // --- UI RENDERING & INTERACTION ---

    function appendMessage(role, text, sources = []) {
        const chatbox = document.getElementById('ai-chatbox');
        if (!chatbox) return;

        const messageContainer = document.createElement('div');
        messageContainer.className = `flex mb-3 ${role === 'user' ? 'justify-end' : 'justify-start'}`;

        const messageBubble = document.createElement('div');
        messageBubble.className = `max-w-3/4 px-4 py-2 rounded-xl text-white shadow-md transition-all duration-300 transform message-pop-in ${
            role === 'user'
                ? 'bg-blue-600 rounded-br-none'
                : 'bg-gray-700 rounded-tl-none ai-message-bubble'
        }`;
        
        // Render text (and process markdown/katex)
        const content = document.createElement('div');
        content.innerHTML = renderContent(text); // Assume renderContent handles markdown

        messageBubble.appendChild(content);

        // NEW: Render sources if they exist (only for AI messages)
        if (role !== 'user' && sources.length > 0) {
            const sourcesContainer = document.createElement('div');
            sourcesContainer.className = 'mt-2 pt-2 border-t border-gray-600 text-xs text-gray-400';
            
            const sourcesTitle = document.createElement('span');
            sourcesTitle.className = 'font-semibold block mb-1 text-gray-300';
            sourcesTitle.textContent = 'Sources:';
            sourcesContainer.appendChild(sourcesTitle);

            const sourcesList = document.createElement('ul');
            sourcesList.className = 'list-none p-0 space-y-1';
            
            sources.slice(0, 3).forEach((source, index) => { // Limit to 3 sources for clean UI
                const listItem = document.createElement('li');
                const link = document.createElement('a');
                link.href = source.uri;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.className = 'hover:text-blue-400 transition-colors duration-150 block truncate';
                link.textContent = `${index + 1}. ${source.title}`;
                listItem.appendChild(link);
                sourcesList.appendChild(listItem);
            });

            sourcesContainer.appendChild(sourcesList);
            messageBubble.appendChild(sourcesContainer);
        }

        messageContainer.appendChild(messageBubble);
        chatbox.appendChild(messageContainer);
        chatbox.scrollTop = chatbox.scrollHeight;

        // Apply KaTeX rendering after the element is in the DOM
        content.querySelectorAll('.math-display, .math-inline').forEach(element => {
            try {
                if (element.classList.contains('math-display')) {
                    katex.render(element.textContent, element, { displayMode: true, throwOnError: false });
                } else {
                    katex.render(element.textContent, element, { displayMode: false, throwOnError: false });
                }
            } catch (e) {
                console.error("KaTeX rendering failed:", e);
                element.textContent = element.textContent; // Fallback to raw text
            }
        });
    }

    function renderContent(markdown) {
        // Simple markdown to HTML conversion for chat bubbles
        let html = markdown
            // Replace **bold** with <strong>
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Replace *italic* with <em>
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Handle code blocks (simple version)
            .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="p-2 my-2 bg-gray-800 rounded-lg overflow-x-auto"><code>$2</code></pre>')
            // Handle inline code `code`
            .replace(/`(.*?)`/g, '<code class="bg-gray-600 px-1 py-0.5 rounded text-sm">$1</code>')
            // Handle headers (h4 max to fit bubble)
            .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            // Handle bullet points
            .replace(/^\* (.*$)/gim, '<li>$1</li>')
            .replace(/(^|\n)<li>/g, '\n<ul><li>')
            .replace(/<\/li>\n/g, '</li>\n')
            .replace(/<\/li>\n(?!<li>)/g, '</li></ul>\n')

        // Handle paragraphs (ensure double newline for paragraph break)
        html = html.split('\n\n').map(p => {
            // Only wrap if it doesn't already look like an HTML element
            if (!p.trim().startsWith('<') && p.trim().length > 0) {
                return `<p>${p.trim()}</p>`;
            }
            return p;
        }).join('');

        // 3. KaTeX and Math Handling (converts to span for KaTeX later)
        // Display math: $$...$$
        html = html.replace(/\$\$([\s\S]*?)\$\$/g, '<span class="math-display">$$1</span>');
        // Inline math: $...$
        html = html.replace(/\$([^\s$][^$]*[^\s$])\$/g, '<span class="math-inline">$1</span>');

        return html;
    }

    async function handleUserPrompt(event) {
        if (event.key === 'Enter' && !event.shiftKey && !isLoading) {
            event.preventDefault();
            const input = event.target;
            const prompt = input.value.trim();

            if (!prompt) return;

            // 1. Append user message and clear input
            appendMessage('user', prompt);
            chatHistory.push({ role: 'user', text: prompt });
            input.value = '';
            
            // 2. Add loading indicator
            const loadingIndicator = document.getElementById('loading-indicator');
            loadingIndicator.style.display = 'flex';
            
            // 3. Fetch response
            const { text: aiResponse, sources } = await fetchResponse(prompt, chatHistory);
            
            // 4. Update history and UI
            isLoading = false;
            loadingIndicator.style.display = 'none';
            
            appendMessage('ai', aiResponse, sources);
            chatHistory.push({ role: 'ai', text: aiResponse });

            // 5. Update system prompt based on user's last message for the NEXT turn (dynamic persona)
            // Removed complex persona logic to meet the requirements of a fixed 'Humanity Gen 0' persona.
        }
    }

    // --- UI SETUP ---

    function createAIContainer() {
        const container = document.createElement('div');
        container.id = 'ai-assistant-container';
        container.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-gray-900/80 transition-opacity duration-300 opacity-0 pointer-events-none font-sans';
        container.style.fontFamily = 'Inter, sans-serif';

        container.innerHTML = `
            <div id="ai-chat-window" class="flex flex-col w-full max-w-lg h-full max-h-[85vh] bg-gray-800 rounded-xl shadow-2xl transition-all duration-300 transform scale-95 opacity-0 border border-gray-700">
                
                <!-- Chat Header (No Settings Button) -->
                <div id="ai-chat-title" class="flex items-center justify-between p-3 bg-gray-900 text-white rounded-t-xl shadow-lg border-b border-gray-700">
                    <h3 class="text-lg font-semibold tracking-wide">${APP_TITLE}</h3>
                    <div id="controls-container" class="flex items-center space-x-4">
                        
                        <!-- NEW: Web Search Toggle -->
                        <div class="flex items-center space-x-2">
                            <span class="text-sm text-gray-400">Web Search</span>
                            <button id="web-search-toggle" role="switch" aria-checked="true" class="relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 bg-blue-600">
                                <span class="sr-only">Toggle web search</span>
                                <span id="web-search-icon" aria-hidden="true" class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 translate-x-5 flex items-center justify-center text-white">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-globe"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                                </span>
                            </button>
                        </div>
                        
                        <!-- Close Button -->
                        <button id="close-ai-button" class="p-1 rounded-full text-gray-400 hover:text-red-400 transition duration-150 transform hover:scale-105" aria-label="Close Chat">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </button>
                    </div>
                </div>

                <!-- Chat Messages -->
                <div id="ai-chatbox" class="flex-grow p-4 overflow-y-auto space-y-4 bg-gray-850">
                    <div class="flex mb-3 justify-start">
                        <div class="max-w-3/4 px-4 py-2 rounded-xl text-white shadow-md bg-gray-700 rounded-tl-none ai-message-bubble">
                            <p>Hello! I am **${APP_TITLE}**. I'm here to help you. What can I assist you with today?</p>
                            <p class="mt-1 text-sm text-gray-400">Web Search is currently <span class="font-bold text-blue-400">enabled</span>. I will ground my answers with real-time information when necessary.</p>
                        </div>
                    </div>
                    <!-- Loading Indicator -->
                    <div id="loading-indicator" class="flex items-center justify-start mb-3" style="display: none;">
                        <div class="bg-gray-700 rounded-full w-4 h-4 mr-2 animate-pulse"></div>
                        <div class="bg-gray-700 rounded-full w-4 h-4 mr-2 animate-pulse" style="animation-delay: 0.2s;"></div>
                        <div class="bg-gray-700 rounded-full w-4 h-4 animate-pulse" style="animation-delay: 0.4s;"></div>
                    </div>
                </div>

                <!-- Chat Input -->
                <div class="p-3 bg-gray-900 rounded-b-xl border-t border-gray-700">
                    <textarea id="ai-input" class="w-full p-3 bg-gray-700 text-white rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-none outline-none placeholder-gray-400 shadow-inner" placeholder="Ask me anything... (Press Enter to send)" rows="2"></textarea>
                </div>
            </div>
        `;
        document.body.appendChild(container);

        // Initial setup for the web search toggle's visual state
        const toggleButton = document.getElementById('web-search-toggle');
        const icon = document.getElementById('web-search-icon');
        toggleButton.classList.add('bg-blue-600');
        icon.classList.add('text-white');
    }

    // --- MAIN INITIALIZATION ---

    function initialize() {
        if (isInitialized) return;

        // 1. Setup CSS styles (integrated Tailwind and custom styles)
        const style = document.createElement('style');
        style.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
            
            .font-sans { font-family: 'Inter', sans-serif; }
            
            /* Custom Scrollbar for Chatbox */
            #ai-chatbox::-webkit-scrollbar { width: 8px; }
            #ai-chatbox::-webkit-scrollbar-thumb { background-color: #4b5563; border-radius: 4px; }
            #ai-chatbox::-webkit-scrollbar-thumb:hover { background-color: #6b7280; }

            /* Chat Bubble Styling */
            .ai-message-bubble h1, .ai-message-bubble h2, .ai-message-bubble h3, .ai-message-bubble h4 { margin-top: 10px; margin-bottom: 5px; font-weight: 700; text-align: left; }
            .ai-message-bubble p { margin: 0; padding: 0; text-align: left; }
            .ai-message-bubble ul, .ai-message-bubble ol { margin: 10px 0; padding-left: 20px; text-align: left; list-style-position: outside; }
            .ai-message-bubble li { margin-bottom: 5px; }
            
            /* REMOVED: All glow animations, including orange ones. */

            @keyframes message-pop-in { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
            .message-pop-in { animation: message-pop-in 0.3s ease-out; }
        `;
        document.head.appendChild(style);

        // 2. Load necessary libraries (KaTeX for math rendering)
        const katexCSS = document.createElement('link');
        katexCSS.rel = 'stylesheet';
        katexCSS.href = 'https://cdn.jsdelivr.net/npm/katex@0.13.18/dist/katex.min.css';
        document.head.appendChild(katexCSS);

        const katexJS = document.createElement('script');
        katexJS.src = 'https://cdn.jsdelivr.net/npm/katex@0.13.18/dist/katex.min.js';
        document.head.appendChild(katexJS);

        // 3. Create UI elements
        createAIContainer();
        aiContainer = document.getElementById('ai-assistant-container');

        // 4. Attach event listeners
        document.getElementById('ai-input').addEventListener('keydown', handleUserPrompt);
        document.getElementById('close-ai-button').addEventListener('click', toggleVisibility);
        document.getElementById('web-search-toggle').addEventListener('click', toggleWebSearch); // NEW Listener

        isInitialized = true;
    }

    function toggleVisibility() {
        if (!isInitialized) initialize();

        isVisible = !isVisible;
        const chatWindow = document.getElementById('ai-chat-window');

        if (isVisible) {
            aiContainer.classList.remove('opacity-0', 'pointer-events-none');
            chatWindow.classList.remove('scale-95', 'opacity-0');
            document.getElementById('ai-input').focus();
        } else {
            aiContainer.classList.add('opacity-0', 'pointer-events-none');
            chatWindow.classList.add('scale-95', 'opacity-0');
        }
    }

    // --- ACTIVATION SHORTCUT (Ctrl + \) ---
    document.addEventListener('keydown', (event) => {
        // Toggle visibility with Ctrl + \ (or Cmd + \ on Mac)
        if (event.key === '\\' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            toggleVisibility();
        }
    });

    // Initial check to ensure Tailwind is available and initialized.
    document.addEventListener('DOMContentLoaded', () => {
        // We only initialize the chat panel when the keyboard shortcut is used,
        // but ensure the key listeners are ready on DOM load.
        // We call initialize() here to ensure all event listeners are attached,
        // but the container remains hidden until the shortcut is pressed.
        initialize();
    });

    // Load Tailwind CSS (required for styling)
    const tailwindScript = document.createElement('script');
    tailwindScript.src = 'https://cdn.tailwindcss.com';
    document.head.appendChild(tailwindScript);

    // Initial state setup for the web search
    window.onload = () => {
        // This ensures the visual state matches the initial JS variable state (true)
        toggleWebSearch(); // Call once to set initial visual state to 'on'
        toggleWebSearch(); // Call again to reverse the state back to 'on' after the first call set it to 'off'
    };

})();
