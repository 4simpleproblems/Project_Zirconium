/**
 * mode-activation.js
 *
 * This script has been completely redesigned into a fullscreen AI chatbot experience.
 *
 * Features:
 * - Activation via Ctrl + \ keyboard shortcut.
 * - Professional, compact, Claude-inspired UI with a blurred background.
 * - Model Switching: Dropdown to select different Gemini models.
 * - Agent Categories: Choose from presets like Creative, Analyst, etc.
 * - Persistent Memory System: Remembers user's name and facts.
 * - Advanced Shortcut & Extension Support:
 * - Full LaTeX & Greek letter shortcuts (e.g., \alpha -> α).
 * - Gemini-style extensions (e.g., @weather(location)).
 * - Automatic URL previews for links like YouTube.
 * - Utilizes Merriweather and Geist fonts for a clean, modern look.
 */
(function() {
    // --- CONFIGURATION ---
    const API_KEY = 'AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro'; // Replace with your actual Gemini API key

    const CONFIG = {
        models: [
            { id: 'flash', name: 'Gemini 1.5 Flash', url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-latest:generateContent?key=${API_KEY}` },
            { id: 'pro', name: 'Gemini 1.5 Pro', url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-latest:generateContent?key=${API_KEY}` },
        ],
        agents: [
            { id: 'standard', name: 'Standard', systemPrompt: 'You are a helpful and friendly AI assistant. Be concise but informative.' },
            { id: 'quick', name: 'Quick', systemPrompt: 'You are an AI assistant designed for speed. Provide very short, direct answers. Use bullet points where possible.' },
            { id: 'analysis', name: 'Analysis', systemPrompt: 'You are a highly analytical AI. Break down complex topics, identify key components, and provide structured, in-depth explanations. Prioritize logic and evidence.' },
            { id: 'descriptive', name: 'Descriptive', systemPrompt: 'You are a descriptive AI assistant. Use rich, evocative language to paint a picture for the user. Focus on sensory details and vivid descriptions.' },
            { id: 'creative', name: 'Creative', systemPrompt: 'You are a creative AI partner. Brainstorm ideas, write stories, and think outside the box. Use a whimsical and imaginative tone.' },
        ],
        latexSymbolMap: {
            '\\alpha':'α','\\beta':'β','\\gamma':'γ','\\delta':'δ','\\epsilon':'ε','\\zeta':'ζ','\\eta':'η','\\theta':'θ','\\iota':'ι','\\kappa':'κ','\\lambda':'λ','\\mu':'μ','\\nu':'ν','\\xi':'ξ','\\omicron':'ο','\\pi':'π','\\rho':'ρ','\\sigma':'σ','\\tau':'τ','\\upsilon':'υ','\\phi':'φ','\\chi':'χ','\\psi':'ψ','\\omega':'ω','\\Gamma':'Γ','\\Delta':'Δ','\\Theta':'Θ','\\Lambda':'Λ','\\Xi':'Ξ','\\Pi':'Π','\\Sigma':'Σ','\\Upsilon':'Υ','\\Phi':'Φ','\\Psi':'Ψ','\\Omega':'Ω','\\pm':'±','\\times':'×','\\div':'÷','\\cdot':'·','\\ast':'∗','\\cup':'∪','\\cap':'∩','\\in':'∈','\\notin':'∉','\\subset':'⊂','\\supset':'⊃','\\subseteq':'⊆','\\supseteq':'⊇','\\le':'≤','\\ge':'≥','\\ne':'≠','\\approx':'≈','\\equiv':'≡','\\leftarrow':'←','\\rightarrow':'→','\\uparrow':'↑','\\downarrow':'↓','\\leftrightarrow':'↔','\\Leftarrow':'⇐','\\Rightarrow':'⇒','\\Leftrightarrow':'⇔','\\forall':'∀','\\exists':'∃','\\nabla':'∇','\\partial':'∂','\\emptyset':'∅','\\infty':'∞','\\degree':'°','\\angle':'∠','\\hbar':'ħ','\\ell':'ℓ','\\therefore':'∴','\\because':'∵'
        }
    };

    // --- STATE MANAGEMENT ---
    let isAIActive = false;
    let isRequestPending = false;
    let currentAIRequestController = null;
    let chatHistory = [];
    let userName = '';
    let currentModelId = CONFIG.models[0].id;
    let currentAgentId = CONFIG.agents[0].id;

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

    function handleKeyDown(e) {
        if (e.ctrlKey && e.key === '\\') { e.preventDefault(); if (!isAIActive) activateAI(); }
        if (e.key === 'Escape' && isAIActive) { e.preventDefault(); deactivateAI(); }
    }

    function activateAI() {
        if (document.getElementById('ai-container')) return;

        userName = memory.getUserName();
        injectStyles();

        const container = document.createElement('div');
        container.id = 'ai-container';
        container.onclick = (e) => { if (e.target === container) deactivateAI(); };

        const chatWindow = document.createElement('div');
        chatWindow.id = 'ai-chat-window';
        chatWindow.onclick = e => e.stopPropagation();

        const header = document.createElement('div');
        header.id = 'ai-header';
        
        const modelDropdown = createDropdown('model-switcher', 'Model', CONFIG.models, currentModelId, (id) => { currentModelId = id; });
        const agentDropdown = createDropdown('agent-switcher', 'Agent', CONFIG.agents, currentAgentId, (id) => { currentAgentId = id; });
        
        header.appendChild(modelDropdown);
        header.appendChild(agentDropdown);

        const responseContainer = document.createElement('div');
        responseContainer.id = 'ai-response-container';
        
        const welcomeMessage = document.createElement('div');
        welcomeMessage.id = 'ai-welcome-message';
        const welcomeText = userName ? `Welcome back, ${userName}` : 'Hello';
        welcomeMessage.innerHTML = `<h2>${welcomeText}</h2><p>How can I help you today?</p>`;
        responseContainer.appendChild(welcomeMessage);

        const inputWrapper = document.createElement('div');
        inputWrapper.id = 'ai-input-wrapper';

        const visualInput = document.createElement('div');
        visualInput.id = 'ai-input';
        visualInput.contentEditable = true;
        visualInput.setAttribute('placeholder', 'Message Gemini...');
        visualInput.onkeydown = handleInputSubmission;
        visualInput.oninput = () => {
             const welcome = document.getElementById('ai-welcome-message');
             if(welcome) welcome.classList.add('hidden');
        };

        const sendButton = document.createElement('button');
        sendButton.id = 'ai-send-button';
        sendButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
        sendButton.onclick = () => handleInputSubmission({ key: 'Enter', preventDefault: () => {} });

        inputWrapper.appendChild(visualInput);
        inputWrapper.appendChild(sendButton);
        
        chatWindow.appendChild(header);
        chatWindow.appendChild(responseContainer);
        chatWindow.appendChild(inputWrapper);
        container.appendChild(chatWindow);

        document.body.appendChild(container);
        document.body.style.overflow = 'hidden';

        setTimeout(() => {
            container.classList.add('active');
            visualInput.focus();
        }, 10);
        isAIActive = true;
    }
    
    function createDropdown(id, label, options, initialId, onSelect) {
        const wrapper = document.createElement('div');
        wrapper.className = 'custom-dropdown';
        wrapper.id = id;

        const display = document.createElement('button');
        display.className = 'dropdown-display';
        display.innerHTML = `<span>${options.find(opt => opt.id === initialId).name}</span> <svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"></path></svg>`;
        
        const dropdownMenu = document.createElement('div');
        dropdownMenu.className = 'dropdown-menu';
        
        options.forEach(option => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            if (option.id === initialId) item.classList.add('selected');
            item.dataset.id = option.id;
            item.textContent = option.name;
            item.onclick = () => {
                onSelect(option.id);
                display.querySelector('span').textContent = option.name;
                dropdownMenu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                wrapper.classList.remove('open');
            };
            dropdownMenu.appendChild(item);
        });

        wrapper.appendChild(display);
        wrapper.appendChild(dropdownMenu);
        
        display.onclick = (e) => {
            e.stopPropagation();
            const isOpen = wrapper.classList.toggle('open');
             if (isOpen) {
                 document.addEventListener('click', () => wrapper.classList.remove('open'), { once: true });
             }
        };

        return wrapper;
    }


    function deactivateAI() {
        if (currentAIRequestController) currentAIRequestController.abort();
        const container = document.getElementById('ai-container');
        if (container) {
            container.classList.remove('active');
            setTimeout(() => {
                container.remove();
                const styles = document.getElementById('ai-dynamic-styles');
                if (styles) styles.remove();
                document.body.style.overflow = '';
            }, 500);
        }
        isAIActive = false;
        isRequestPending = false;
        chatHistory = [];
    }
    
    function handleInputSubmission(e) {
        const editor = document.getElementById('ai-input');
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const query = editor.innerText.trim();
            if (!query || isRequestPending) return;

            document.getElementById('ai-welcome-message')?.classList.add('hidden');
            
            const lowerQuery = query.toLowerCase();
            if (lowerQuery.startsWith("my name is")) {
                const name = query.substring(11).trim().split(" ")[0].replace(/[^a-zA-Z]/g, '');
                if (name) {
                    userName = name.charAt(0).toUpperCase() + name.slice(1);
                    memory.setUserName(userName);
                    appendMessage(`Okay, I'll remember your name is ${userName}.`, 'gemini');
                    editor.innerText = ''; return;
                }
            }
            if (lowerQuery.startsWith("remember")) {
                const fact = query.substring(8).trim();
                if (fact) {
                    memory.saveMemory(fact);
                    appendMessage(`Got it. I'll remember that.`, 'gemini');
                    editor.innerText = ''; return;
                }
            }

            isRequestPending = true;
            const processedQuery = processShortcutsAndPreviews(query);
            chatHistory.push({ role: "user", parts: [{ text: processedQuery }] });
            editor.innerText = '';

            const responseBubble = appendMessage('', 'gemini', true);
            callGoogleAI(responseBubble);
        }
    }
    
    function processShortcutsAndPreviews(text) {
        let content = text;
        
        // LaTeX shortcuts
        content = content.replace(/\\([a-zA-Z]+)/g, (match, command) => CONFIG.latexSymbolMap[match] || match);
        
        // Gemini-style extensions
        content = content.replace(/@weather\((.*?)\)/g, '(Query about weather in: $1)');

        // URL previews
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = text.match(urlRegex);
        let previewHtml = '';
        if (urls) {
            urls.forEach(url => {
                if (url.includes('youtube.com/watch?v=') || url.includes('youtu.be/')) {
                    const videoId = url.includes('youtu.be/') ? url.split('/').pop().split('?')[0] : new URL(url).searchParams.get('v');
                    if (videoId) {
                        previewHtml += `<div class="url-preview youtube-preview"><iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
                    }
                }
            });
        }
        
        appendMessage(parseResponse(text) + previewHtml, 'user');
        return text; // Return original text to AI for context
    }

    function appendMessage(content, role, isLoading = false) {
        const responseContainer = document.getElementById('ai-response-container');
        const bubble = document.createElement('div');
        bubble.className = `ai-message-bubble ${role}-message`;
        if (isLoading) {
            bubble.classList.add('loading');
            bubble.innerHTML = '<div class="ai-loader"></div>';
        } else {
            bubble.innerHTML = content;
        }
        responseContainer.appendChild(bubble);
        responseContainer.scrollTop = responseContainer.scrollHeight;
        return bubble;
    }

    async function callGoogleAI(responseBubble) {
        const model = CONFIG.models.find(m => m.id === currentModelId);
        if (!API_KEY || API_KEY === 'YOUR_API_KEY_HERE') {
            responseBubble.innerHTML = `<div class="ai-error">API Key is missing. Please add your key to the script.</div>`;
            responseBubble.classList.remove('loading');
            isRequestPending = false;
            return;
        }
        currentAIRequestController = new AbortController();
        
        const agent = CONFIG.agents.find(a => a.id === currentAgentId);
        const savedMemories = memory.getMemories();
        let systemPrompt = `${agent.systemPrompt}
        Current date is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;
        if (userName) systemPrompt += `\nThe user's name is ${userName}.`;
        if (savedMemories.length > 0) {
            systemPrompt += "\n\nUser's saved memories (use for context):\n" + savedMemories.map(f => `- ${f}`).join('\n');
        }

        const payload = { contents: chatHistory, systemInstruction: { parts: [{ text: systemPrompt }] } };

        try {
            const response = await fetch(model.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: currentAIRequestController.signal
            });
            if (!response.ok) { const err = await response.json(); throw new Error(err.error.message); }
            const data = await response.json();
            if (!data.candidates) throw new Error("Invalid API response.");
            const text = data.candidates[0].content.parts[0].text;
            chatHistory.push({ role: "model", parts: [{ text }] });
            responseBubble.innerHTML = parseResponse(text);
        } catch (error) {
            responseBubble.innerHTML = `<div class="ai-error">${error.name === 'AbortError' ? 'Request stopped.' : `Error: ${error.message}`}</div>`;
        } finally {
            isRequestPending = false;
            currentAIRequestController = null;
            responseBubble.classList.remove('loading');
            document.getElementById('ai-response-container').scrollTop = document.getElementById('ai-response-container').scrollHeight;
        }
    }

    function parseResponse(text) {
        let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                   .replace(/\*(.*?)\*/g, '<em>$1</em>')
                   .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
                   .replace(/`(.*?)`/g, '<code>$1</code>')
                   .replace(/\n/g, '<br>');
        return html;
    }

    function injectStyles() {
        if (document.getElementById('ai-dynamic-styles')) return;
        const style = document.createElement("style");
        style.id = "ai-dynamic-styles";
        style.innerHTML = `
            @import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&family=Geist+Sans:wght@400;500;700&display=swap');
            :root { --font-sans: 'Geist Sans', sans-serif; --font-serif: 'Merriweather', serif; --accent-color: #4361ee; }
            #ai-container { position: fixed; inset: 0; background-color: rgba(10, 10, 15, 0.5); backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); z-index: 2147483647; opacity: 0; transition: all 0.4s ease; display: flex; align-items: center; justify-content: center; }
            #ai-container.active { opacity: 1; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); }
            #ai-chat-window { width: 90%; height: 90%; max-width: 800px; max-height: 900px; background: rgba(25, 25, 30, 0.8); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); display: flex; flex-direction: column; overflow: hidden; transform: scale(0.95); transition: transform 0.4s ease; }
            #ai-container.active #ai-chat-window { transform: scale(1); }
            #ai-header { padding: 12px 20px; display: flex; gap: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(30,30,35,0.8); }
            #ai-response-container { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 1rem; }
            #ai-welcome-message { text-align: center; margin: auto; color: #fff; transition: opacity 0.3s; }
            #ai-welcome-message.hidden { opacity: 0; height: 0; overflow: hidden; }
            #ai-welcome-message h2 { font-family: var(--font-serif); font-size: 2.5em; margin: 0; font-weight: 700; }
            #ai-welcome-message p { font-size: 1.1em; color: rgba(255,255,255,0.6); margin-top: 10px; }
            .ai-message-bubble { padding: 12px 18px; border-radius: 18px; max-width: 85%; line-height: 1.6; font-size: 16px; animation: msg-pop .3s ease forwards; overflow-wrap: break-word; }
            .user-message { align-self: flex-end; background: var(--accent-color); color: white; border-bottom-right-radius: 4px; }
            .gemini-message { align-self: flex-start; background: #333742; color: #e0e0e0; border-bottom-left-radius: 4px; }
            .gemini-message.loading { display:flex; justify-content:center; align-items:center; min-height:50px; max-width:80px; }
            #ai-input-wrapper { padding: 15px 20px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; gap: 10px; }
            #ai-input { flex-grow: 1; min-height: 48px; max-height: 200px; overflow-y: auto; color: #fff; font-size: 16px; padding: 12px 18px; outline: none; background: #151518; border: 1px solid #444; border-radius: 14px; transition: border-color .2s; }
            #ai-input:focus { border-color: var(--accent-color); }
            #ai-input:empty::before { content: attr(placeholder); color: #777; }
            #ai-send-button { background: var(--accent-color); border: none; border-radius: 12px; color: white; cursor: pointer; width: 48px; height: 48px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; transition: background-color 0.2s; }
            #ai-send-button:hover { background: #5c7aff; }
            .custom-dropdown { position: relative; }
            .dropdown-display { display:flex; align-items:center; gap: 5px; background: #333742; border: 1px solid #555; color: #eee; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: 14px; }
            .dropdown-display svg { fill: #999; width: 20px; height: 20px; transition: transform .2s; }
            .custom-dropdown.open .dropdown-display svg { transform: rotate(180deg); }
            .dropdown-menu { position: absolute; top: calc(100% + 5px); left: 0; background: #2a2d35; border: 1px solid #555; border-radius: 8px; z-index: 10; overflow: hidden; opacity: 0; transform: translateY(-10px); pointer-events: none; transition: all .2s ease; }
            .custom-dropdown.open .dropdown-menu { opacity: 1; transform: translateY(0); pointer-events: auto; }
            .dropdown-item { padding: 10px 15px; cursor: pointer; white-space: nowrap; }
            .dropdown-item:hover { background: #3a3d45; }
            .dropdown-item.selected { background: var(--accent-color); color: white; }
            .ai-loader { width:25px; height:25px; border-radius:50%; animation:spin 1s linear infinite; border:3px solid #555; border-top-color:#fff; }
            .ai-error { color: #ff8a80; }
            .url-preview { margin-top: 10px; }
            .youtube-preview iframe { width: 100%; aspect-ratio: 16/9; border-radius: 12px; border: 1px solid #444; }
            pre{background:rgba(0,0,0,0.3);padding:15px;border-radius:8px;overflow-x:auto;}
            code{font-family:monospace;background:rgba(0,0,0,0.2);padding:2px 5px;border-radius:4px;}
            pre > code {background:none;padding:0;}
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes msg-pop { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
        `;
        document.head.appendChild(style);
    }

    document.addEventListener('keydown', handleKeyDown);
})();

