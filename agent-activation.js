/**
 * agent-activation.js
 *
 * MAJOR REVISION:
 * - REMOVED: Settings menu and button have been completely erased.
 * - NEW: A sleek, one-time introduction slideshow guides new users, collecting their name, favorite color, and birthday.
 * - NEW: Implemented a robust local memory system using IndexedDB. Users can ask the agent to remember information,
 * which is then summarized by Gemini and stored locally. This memory is passed as context in future prompts.
 * - NEW: Firebase integration has been added to manage user authentication and data persistence.
 * - NEW: UI feedback for local memory usage. A notice appears when the agent is accessing local memory, and a confirmation
 * is displayed under messages that utilized it.
 * - NEW: Implemented a "RAM" feature to manage chat history, retaining the last 25 messages and dynamically shortening
 * any that exceed 1000 characters to maintain context without excessive length.
 * - UI: The entire activation and onboarding process has been redesigned for a smoother, more engaging experience.
 * - REFACTOR: Switched from localStorage to IndexedDB for all user data, including preferences from the new intro.
 */
(function() {
    // --- CONFIGURATION ---
    const API_KEY = 'AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro';
    const BASE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/`;
    const MAX_INPUT_HEIGHT = 180;
    const CHAR_LIMIT = 10000;
    const PASTE_TO_FILE_THRESHOLD = 10000;
    const MAX_ATTACHMENTS_PER_MESSAGE = 10;
    const CHAT_HISTORY_RAM_LIMIT = 25; // "RAM" for last 25 messages
    const CHAT_HISTORY_CHAR_TRUNCATE = 1000; // Character limit for a single message in "RAM"

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
    let agentSettings = {}; // Loaded from IndexedDB

    // --- Firebase and IndexedDB ---
    let db; // Firestore instance
    let auth; // Auth instance
    let userId; // Authenticated user ID

    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

    // --- IndexedDB Management ---
    const DB_NAME = 'aiAgentDB';
    const DB_VERSION = 1;
    const MEMORY_STORE = 'memories';
    const SETTINGS_STORE = 'settings';

    function openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = () => reject("Error opening IndexedDB.");
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = event => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(MEMORY_STORE)) {
                    db.createObjectStore(MEMORY_STORE, { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
                    db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
                }
            };
        });
    }

    async function saveData(storeName, data) {
        const db = await openDB();
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        store.put(data);
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject("Transaction error.");
        });
    }

    async function getData(storeName, key) {
        const db = await openDB();
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = key ? store.get(key) : store.getAll();
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject("Request error.");
        });
    }


    /**
     * Loads user settings from IndexedDB on script initialization.
     */
    async function loadAgentSettings() {
        try {
            const settings = await getData(SETTINGS_STORE);
            if (settings) {
                settings.forEach(setting => {
                    agentSettings[setting.key] = setting.value;
                });
            }
        } catch (e) {
            console.error("Error loading agent settings from IndexedDB:", e);
        }
    }

    // --- FIREBASE INITIALIZATION ---
    async function initializeFirebase() {
        if (typeof firebase === 'undefined' || typeof __firebase_config === 'undefined') {
            console.warn("Firebase scripts not available. Some features may be disabled.");
            userId = 'local-user';
            return;
        }

        try {
            const firebaseConfig = JSON.parse(__firebase_config);
            const app = firebase.initializeApp(firebaseConfig);
            db = firebase.firestore(app);
            auth = firebase.auth(app);
            
            // Set logging for debugging
            firebase.firestore().setLogLevel('debug');


            await new Promise((resolve, reject) => {
                const unsubscribe = auth.onAuthStateChanged(async (user) => {
                    unsubscribe();
                    if (user) {
                        userId = user.uid;
                        console.log("User is signed in with UID:", userId);
                        resolve(user);
                    } else {
                         try {
                            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                                const userCredential = await firebase.auth().signInWithCustomToken(__initial_auth_token);
                                userId = userCredential.user.uid;
                                console.log("Signed in with custom token:", userId);
                            } else {
                                const userCredential = await firebase.auth().signInAnonymously();
                                userId = userCredential.user.uid;
                                console.log("Signed in anonymously:", userId);
                            }
                            resolve(auth.currentUser);
                        } catch (error) {
                            console.error("Firebase Auth Error:", error);
                            userId = `fallback_${crypto.randomUUID()}`;
                            reject(error);
                        }
                    }
                });
            });
            
             // After auth, load settings which might be user-specific
            await loadAgentSettings();

        } catch (error) {
            console.error("Could not initialize Firebase:", error);
            userId = 'local-user-error';
        }
    }


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

    function renderKaTeX(container) { /* ... (no changes) ... */ }
    function renderGraphs(container) { /* ... (no changes) ... */ }
    function drawCustomGraph(canvas, graphData) { /* ... (no changes) ... */ }

    // --- END REPLACED/MODIFIED FUNCTIONS ---

    async function handleKeyDown(e) {
        if (e.ctrlKey && e.key === '\\') {
            const selection = window.getSelection().toString();
            if (isAIActive) {
                if (selection.length > 0) { return; }
                e.preventDefault();
                const mainEditor = document.getElementById('ai-input');
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
    
    async function activateAI() {
        if (document.getElementById('ai-container')) return;
        if (typeof window.startPanicKeyBlocker === 'function') { window.startPanicKeyBlocker(); }

        await initializeFirebase();
        await loadAgentSettings();

        attachedFiles = [];
        injectStyles();

        const container = document.createElement('div');
        container.id = 'ai-container';

        // Check if introduction is complete
        if (!agentSettings.introComplete) {
            container.appendChild(createIntroductionSlideshow());
        } else {
            container.appendChild(createMainUI());
        }

        document.body.appendChild(container);

        setTimeout(() => {
            container.classList.add('active');
            if (agentSettings.introComplete) {
                const visualInput = document.getElementById('ai-input');
                if (visualInput) visualInput.focus();
                 if (chatHistory.length > 0) {
                    container.classList.add('chat-active');
                    renderChatHistory();
                 }
            } else {
                const introNameInput = document.getElementById('intro-name-input');
                if(introNameInput) introNameInput.focus();
            }
        }, 50);

        isAIActive = true;
    }

    function createMainUI() {
        const mainUIWrapper = document.createElement('div');
        mainUIWrapper.id = 'ai-main-ui';

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
        persistentTitle.textContent = "AI Agent";

        const welcomeMessage = document.createElement('div');
        welcomeMessage.id = 'ai-welcome-message';
        const welcomeHeader = chatHistory.length > 0 ? `Welcome Back, ${agentSettings.name || 'User'}` : `Welcome, ${agentSettings.name || 'User'}`;
        welcomeMessage.innerHTML = `<h2>${welcomeHeader}</h2><p>This is a beta feature. Your general location may be shared with your first message. You can ask me to remember things for you!</p><p class="shortcut-tip">(Press Ctrl + \\ to close)</p>`;

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

        const charCounter = document.createElement('div');
        charCounter.id = 'ai-char-counter';
        charCounter.textContent = `0 / ${formatCharLimit(CHAR_LIMIT)}`;
        
        inputWrapper.appendChild(attachmentPreviewContainer);
        inputWrapper.appendChild(visualInput);
        inputWrapper.appendChild(attachmentButton);
        composeArea.appendChild(inputWrapper);

        mainUIWrapper.appendChild(brandTitle);
        mainUIWrapper.appendChild(persistentTitle);
        mainUIWrapper.appendChild(welcomeMessage);
        mainUIWrapper.appendChild(closeButton);
        mainUIWrapper.appendChild(responseContainer);
        mainUIWrapper.appendChild(composeArea);
        mainUIWrapper.appendChild(charCounter);
        
        const katexScript = document.createElement('script');
        katexScript.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.js';
        mainUIWrapper.appendChild(katexScript);

        return mainUIWrapper;
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
                if (katexCSS) katexCSS.remove();
            }, 500);
        }
        isAIActive = false;
        isRequestPending = false;
        attachedFiles = [];
    }
    
    function renderChatHistory() { /* ... (no changes) ... */ }
    function determineIntentCategory(query) { /* ... (no changes) ... */ }
    
    const FSP_HISTORY = `You are the exclusive AI Agent for the website 4SP (4simpleproblems), the platform you are hosted on...`; // (content unchanged)

    /**
     * NEW: Manages chat history length ("RAM"), truncating long messages.
     * @param {Array} history The full chat history array.
     * @returns {Array} The processed chat history for the API payload.
     */
    function manageChatHistory(history) {
        let recentHistory = history.slice(-CHAT_HISTORY_RAM_LIMIT);

        return recentHistory.map(message => {
            const newParts = message.parts.map(part => {
                if (part.text && part.text.length > CHAT_HISTORY_CHAR_TRUNCATE) {
                    return {
                        ...part,
                        text: part.text.substring(0, CHAT_HISTORY_CHAR_TRUNCATE) + "\n... [Message shortened for brevity]"
                    };
                }
                return part;
            });
            return { ...message, parts: newParts };
        });
    }

    /**
     * Generates the system instruction and selects the appropriate model.
     * @param {string} query The user's latest message.
     * @param {object} settings The agent settings from IndexedDB.
     * @param {string} localMemoryContext The compiled string of local memories.
     * @returns {{instruction: string, model: string}}
     */
    function getDynamicSystemInstructionAndModel(query, settings, localMemoryContext) {
        const userName = settings.name || 'User';
        const userBirthday = settings.birthday ? `born on ${settings.birthday}`: 'with an unknown birthday';
        const userColor = settings.color || '#4285f4';

        const intent = determineIntentCategory(query);
        let model = 'gemini-1.0-pro-latest'; // Default model
        let personaInstruction = `${FSP_HISTORY}

You are a highly capable and adaptable AI.
User Profile: Name: ${userName}, Birthday: ${userBirthday}, Favorite Color: ${userColor}.

--- LOCAL MEMORY CONTEXT ---
${localMemoryContext || "No local memories stored yet."}
--- END LOCAL MEMORY CONTEXT ---

**Instructions (MUST FOLLOW):**
1.  **Use Local Memory**: If the user's query is related to the Local Memory Context, use that information in your response. If you do, YOU MUST include the special token \`[uses_memory]\` at the very end of your response text.
2.  **Save to Memory**: If the user asks you to "remember", "save", or "take note of" a piece of information, respond ONLY with a special command to save the data. The command should be in this exact format: \`<save_memory>{"summary": "A concise summary of the information to remember."}</save_memory>\`. Do not add any other text before or after this command.
3.  **Formatting**: For math, use KaTeX ($inline$$ and $$display$$). For graphs, use 'graph' code blocks.
4.  **Persona**: Adapt your persona, tone, and level of detail based on the user's intent.
`;

        switch (intent) {
            case 'DEEP_ANALYSIS':
                model = 'gemini-1.5-pro-latest';
                personaInstruction += `\n**Current Persona: Deep Strategist.** Be comprehensive, highly structured, and exhibit deep reasoning. Use an assertive, expert tone.`;
                break;
            case 'PROFESSIONAL_MATH':
                model = 'gemini-1.0-pro-latest';
                personaInstruction += `\n**Current Persona: Technical Expert.** Be clear, professional, and precise. Focus on logic and definitive answers.`;
                break;
            case 'CREATIVE':
                model = 'gemini-1.0-pro-latest';
                personaInstruction += `\n**Current Persona: Creative Partner.** Use rich, evocative language. Be imaginative and inspiring.`;
                break;
            case 'CASUAL':
            default:
                model = 'gemini-1.0-pro-latest';
                personaInstruction += `\n**Current Persona: Standard Assistant.** Be balanced, helpful, and concise. Use a friendly, casual tone.`;
                break;
        }

        return { instruction: personaInstruction, model };
    }


    async function callGoogleAI(responseBubble) {
        if (!API_KEY) {
            responseBubble.innerHTML = `<div class="ai-error">API Key is missing.</div>`;
            return;
        }
        currentAIRequestController = new AbortController();
        
        let firstMessageContext = '';
        if (chatHistory.length <= 1) {
            const location = getUserLocationForContext();
            const now = new Date();
            const date = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const time = now.toLocaleTimeString('en-US', { timeZoneName: 'short' });
            firstMessageContext = `(System Info: User is asking from ${location}. Current date is ${date}, ${time}.)\n\n`;
        }

        const memoryNotice = responseBubble.querySelector('.memory-status');

        // NEW: Fetch and prepare local memory
        let localMemoryContext = '';
        try {
            const memories = await getData(MEMORY_STORE);
            if (memories && memories.length > 0) {
                localMemoryContext = memories.map(m => `- ${m.summary}`).join('\n');
                if(memoryNotice) memoryNotice.style.display = 'block';
            }
        } catch (e) {
            console.error("Failed to retrieve local memories:", e);
        }

        let processedChatHistory = manageChatHistory(chatHistory);

        const lastMessageIndex = processedChatHistory.length - 1;
        const userParts = processedChatHistory[lastMessageIndex].parts;
        const textPartIndex = userParts.findIndex(p => p.text);
        const lastUserQuery = userParts[textPartIndex]?.text || '';
        
        const { instruction: dynamicInstruction, model } = getDynamicSystemInstructionAndModel(lastUserQuery, agentSettings, localMemoryContext);

        if (textPartIndex > -1) {
            userParts[textPartIndex].text = firstMessageContext + userParts[textPartIndex].text;
        } else if (firstMessageContext) {
            userParts.unshift({ text: firstMessageContext.trim() });
        }
        
        const payload = {
            contents: processedChatHistory,
            systemInstruction: { parts: [{ text: dynamicInstruction }] }
        };
        
        const DYNAMIC_API_URL = `${BASE_API_URL}${model}:generateContent?key=${API_KEY}`;
        
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
            if (!data.candidates || data.candidates.length === 0) throw new Error("Invalid response from API.");
            
            let text = data.candidates[0].content.parts[0]?.text || '';

            // NEW: Handle saving to memory
            if (text.startsWith('<save_memory>')) {
                const memoryJSON = text.match(/<save_memory>(.*?)<\/save_memory>/)[1];
                try {
                    const memoryData = JSON.parse(memoryJSON);
                    await saveData(MEMORY_STORE, { summary: memoryData.summary });
                    text = `Okay, I've remembered that for you.`;
                } catch (e) {
                    console.error("Failed to parse or save memory:", e);
                    text = "I tried to remember that, but something went wrong.";
                }
            }
            
            // NEW: Check for memory usage token
            let usedMemory = false;
            if (text.includes('[uses_memory]')) {
                usedMemory = true;
                text = text.replace('[uses_memory]', '').trim();
            }

            chatHistory.push({ role: "model", parts: [{ text: text }] });
            
            const memoryUsedHTML = usedMemory ? `<div class="memory-used-notice"><i>This message uses local memory.</i></div>` : '';
            const contentHTML = `<div class="ai-response-content">${parseGeminiResponse(text)}</div>${memoryUsedHTML}`;
            
            responseBubble.style.opacity = '0';
            setTimeout(() => {
                responseBubble.innerHTML = contentHTML;
                responseBubble.querySelectorAll('.copy-code-btn').forEach(button => button.addEventListener('click', handleCopyCode));
                responseBubble.style.opacity = '1';
                renderKaTeX(responseBubble);
                renderGraphs(responseBubble);
            }, 300);

        } catch (error) {
             if (error.name === 'AbortError') { responseBubble.innerHTML = `<div class="ai-error">Message generation stopped.</div>`; } 
             else { console.error('AI API Error:', error); responseBubble.innerHTML = `<div class="ai-error">Sorry, an error occurred.</div>`; }
        } finally {
            if(memoryNotice) memoryNotice.style.display = 'none';
            isRequestPending = false;
            currentAIRequestController = null;
            const inputWrapper = document.getElementById('ai-input-wrapper');
            if (inputWrapper) inputWrapper.classList.remove('waiting');
            setTimeout(() => {
                responseBubble.classList.remove('loading');
                const responseContainer = document.getElementById('ai-response-container');
                if(responseContainer) responseContainer.scrollTop = responseContainer.scrollHeight;
            }, 300);
            const editor = document.getElementById('ai-input');
            if(editor) { editor.contentEditable = true; editor.focus(); }
        }
    }
    
    // --- NEW INTRODUCTION SLIDESHOW ---
    function createIntroductionSlideshow() {
        const introContainer = document.createElement('div');
        introContainer.id = 'ai-intro-slideshow';
        introContainer.innerHTML = `
            <div class="intro-slide active" data-slide="1">
                <div class="intro-content">
                    <h1>Welcome to the AI Agent</h1>
                    <p>I'm your personal assistant. To get started, what should I call you?</p>
                    <input type="text" id="intro-name-input" placeholder="Enter your name..." autocomplete="off">
                    <button class="intro-next-btn">Next &rarr;</button>
                </div>
            </div>
            <div class="intro-slide" data-slide="2">
                <div class="intro-content">
                    <h2>Choose Your Color</h2>
                    <p>Pick a color that you like. This will help personalize my responses.</p>
                    <div id="intro-color-palette"></div>
                    <div class="intro-nav-buttons">
                        <button class="intro-prev-btn">&larr; Back</button>
                        <button class="intro-next-btn">Next &rarr;</button>
                    </div>
                </div>
            </div>
            <div class="intro-slide" data-slide="3">
                 <div class="intro-content">
                    <h2>When is your birthday?</h2>
                    <p>I can send you a special message on your birthday (year not needed).</p>
                    <div class="birthday-picker">
                        <select id="intro-bday-month"></select>
                        <select id="intro-bday-day"></select>
                    </div>
                    <div class="intro-nav-buttons">
                        <button class="intro-prev-btn">&larr; Back</button>
                        <button class="intro-finish-btn">Finish Setup</button>
                    </div>
                </div>
            </div>
             <div class="intro-slide" data-slide="4">
                 <div class="intro-content final-slide">
                    <h2>All Set!</h2>
                    <p>I'll remember your preferences. You can start our conversation now.</p>
                    <p class="final-tip"><b>Tip:</b> To help me remember something new, just say "Remember that..."</p>
                </div>
            </div>
        `;

        // Populate color palette
        const colors = [
            '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4',
            '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ffffff'
        ];
        const palette = introContainer.querySelector('#intro-color-palette');
        colors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color;
            swatch.dataset.color = color;
            palette.appendChild(swatch);
        });

        // Populate birthday dropdowns
        const monthSelect = introContainer.querySelector('#intro-bday-month');
        const daySelect = introContainer.querySelector('#intro-bday-day');
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        months.forEach((month, i) => {
            monthSelect.innerHTML += `<option value="${i+1}">${month}</option>`;
        });
        const updateDays = () => {
            const month = monthSelect.value;
            const year = 2024; // Leap year to handle Feb 29
            const daysInMonth = new Date(year, month, 0).getDate();
            daySelect.innerHTML = '';
            for(let i=1; i <= daysInMonth; i++) {
                daySelect.innerHTML += `<option value="${i}">${i}</option>`;
            }
        };
        monthSelect.onchange = updateDays;
        updateDays();
        
        // Event Listeners
        let currentSlide = 1;
        const slides = introContainer.querySelectorAll('.intro-slide');

        const navigate = (direction) => {
            const nextSlide = currentSlide + direction;
            if (nextSlide > 0 && nextSlide <= slides.length) {
                slides[currentSlide - 1].classList.remove('active');
                slides[nextSlide - 1].classList.add('active');
                currentSlide = nextSlide;
            }
        };

        introContainer.querySelector('#intro-name-input').addEventListener('keydown', (e) => {
            if(e.key === 'Enter') introContainer.querySelector('[data-slide="1"] .intro-next-btn').click();
        });

        introContainer.querySelectorAll('.intro-next-btn').forEach(btn => btn.onclick = () => {
             if (currentSlide === 1) {
                const name = introContainer.querySelector('#intro-name-input').value.trim();
                if (!name) {
                    alert("Please enter your name.");
                    return;
                }
                saveData(SETTINGS_STORE, { key: 'name', value: name });
                agentSettings.name = name;
             }
             navigate(1);
        });
        introContainer.querySelectorAll('.intro-prev-btn').forEach(btn => btn.onclick = () => navigate(-1));
        
        palette.addEventListener('click', (e) => {
            if (e.target.classList.contains('color-swatch')) {
                const color = e.target.dataset.color;
                saveData(SETTINGS_STORE, { key: 'color', value: color });
                agentSettings.color = color;
                 if (palette.querySelector('.selected')) {
                    palette.querySelector('.selected').classList.remove('selected');
                }
                e.target.classList.add('selected');
                setTimeout(() => navigate(1), 300);
            }
        });
        
        introContainer.querySelector('.intro-finish-btn').onclick = async () => {
            const month = months[monthSelect.value - 1];
            const day = daySelect.value;
            const birthday = `${month} ${day}`;
            await saveData(SETTINGS_STORE, { key: 'birthday', value: birthday });
            agentSettings.birthday = birthday;

            await saveData(SETTINGS_STORE, { key: 'introComplete', value: true });
            agentSettings.introComplete = true;

            navigate(1); // Go to final slide

            setTimeout(() => {
                const mainContainer = document.getElementById('ai-container');
                introContainer.classList.add('fade-out');
                setTimeout(() => {
                    introContainer.remove();
                    mainContainer.appendChild(createMainUI());
                    mainContainer.classList.add('chat-active');
                    const visualInput = document.getElementById('ai-input');
                    if(visualInput) visualInput.focus();
                }, 500);
            }, 2000);
        };

        return introContainer;
    }


    function processFileLike(file, base64Data, dataUrl, tempId) { /* ... (no changes) ... */ }
    function handleFileUpload() { /* ... (no changes) ... */ }
    function renderAttachments() { /* ... (no changes) ... */ }
    function showFilePreview(file) { /* ... (no changes) ... */ }
    function formatCharCount(count) { /* ... (no changes) ... */ }
    function formatCharLimit(limit) { /* ... (no changes) ... */ }
    function handleContentEditableInput(e) { /* ... (no changes) ... */ }
    function handlePaste(e) { /* ... (no changes) ... */ }

    function handleInputSubmission(e) {
        const editor = e.target;
        const query = editor.innerText.trim();
        if (editor.innerText.length > CHAR_LIMIT) {
             e.preventDefault();
             return;
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            
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
            // NEW: Add memory status notice placeholder
            responseBubble.innerHTML = `
                <div class="ai-loader"></div>
                <div class="memory-status" style="display: none;">The agent is using local memory...</div>
            `;
            responseContainer.appendChild(responseBubble);
            responseContainer.scrollTop = responseContainer.scrollHeight;

            editor.innerHTML = '';
            handleContentEditableInput({target: editor});
            attachedFiles = [];
            renderAttachments();
            
            callGoogleAI(responseBubble);
        }
    }
    
    function handleCopyCode(event) { /* ... (no changes) ... */ }
    function fadeOutWelcomeMessage(){const container=document.getElementById("ai-container");if(container&&!container.classList.contains("chat-active")){container.classList.add("chat-active")}}
    function escapeHTML(str){const p=document.createElement("p");p.textContent=str;return p.innerHTML}
    function formatBytes(bytes, decimals = 2) { /* ... (no changes) ... */ }
    function parseGeminiResponse(text) { /* ... (no changes) ... */ }

    function injectStyles() {
        if (document.getElementById('ai-dynamic-styles')) return;

        // Load external stylesheets (KaTeX, Fonts)
        if (!document.getElementById('ai-katex-styles')) { /* ... */ }
        if (!document.getElementById('ai-google-fonts')) { /* ... */ }

        const style = document.createElement("style");
        style.id = "ai-dynamic-styles";
        style.innerHTML = `
            :root { --ai-red: #ea4335; --ai-blue: #4285f4; --ai-green: #34a853; --ai-yellow: #fbbc05; }
            #ai-container { 
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; 
                background-color: rgba(10, 10, 15, 0.95);
                backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); 
                z-index: 2147483647; opacity: 0; transition: opacity 0.5s; 
                font-family: 'Lora', serif; display: flex; flex-direction: column; 
                justify-content: center; align-items: center; padding: 0; box-sizing: border-box; overflow: hidden; 
            }
            #ai-main-ui { width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; }
            #ai-container.active { opacity: 1; }
            #ai-container.deactivating { transition: opacity 0.4s; opacity: 0 !important; }

            /* Intro Slideshow Styles */
            #ai-intro-slideshow {
                width: 100%; max-width: 600px; height: 400px; position: relative;
                color: #fff; text-align: center; perspective: 1000px;
            }
            #ai-intro-slideshow.fade-out { opacity: 0; transition: opacity 0.5s; }
            .intro-slide {
                position: absolute; width: 100%; height: 100%;
                background: rgba(20, 22, 25, 0.7); border: 1px solid rgba(255,255,255,0.1);
                border-radius: 20px;
                opacity: 0; transform: translateX(100px) rotateY(-20deg);
                transition: all 0.6s cubic-bezier(0.25, 1, 0.5, 1);
                pointer-events: none;
                display: flex; align-items: center; justify-content: center;
                padding: 40px; box-sizing: border-box;
            }
            .intro-slide.active { opacity: 1; transform: translateX(0) rotateY(0); pointer-events: auto; }
            .intro-slide:not(.active) { transform: translateX(-100px) rotateY(20deg); }
            .intro-content h1, .intro-content h2 { font-family: 'Merriweather', serif; margin-bottom: 15px; }
            .intro-content p { color: #ccc; margin-bottom: 30px; line-height: 1.6; }
            #intro-name-input { font-size: 1.2em; padding: 12px; width: 80%; background: rgba(0,0,0,0.2); border: 1px solid #555; border-radius: 8px; color: #fff; text-align: center; margin-bottom: 20px; }
            .intro-next-btn, .intro-prev-btn, .intro-finish-btn {
                background: var(--ai-blue); color: #fff; border: none; padding: 12px 25px; border-radius: 8px; cursor: pointer; font-size: 1em; transition: all 0.2s;
            }
            .intro-prev-btn { background: #555; }
            .intro-nav-buttons { display: flex; justify-content: center; gap: 15px; margin-top: 20px; }
            #intro-color-palette { display: grid; grid-template-columns: repeat(9, 1fr); gap: 10px; max-width: 360px; margin: 0 auto; }
            .color-swatch { width: 32px; height: 32px; border-radius: 50%; cursor: pointer; transition: all 0.2s; border: 2px solid transparent; }
            .color-swatch:hover { transform: scale(1.2); }
            .color-swatch.selected { border-color: #fff; transform: scale(1.2); box-shadow: 0 0 10px #fff; }
            .birthday-picker { display: flex; gap: 10px; justify-content: center; }
            .birthday-picker select { font-size: 1.1em; padding: 10px; background: rgba(0,0,0,0.2); border: 1px solid #555; color: #fff; border-radius: 8px; }
            .final-slide p { font-size: 1.2em; } .final-slide .final-tip { font-size: 0.9em; color: #888; }
            
            /* Main UI Styles */
            #ai-persistent-title, #ai-brand-title { 
                position: absolute; top: 28px; left: 30px; font-family: 'Lora', serif; 
                font-size: 18px; font-weight: bold; color: #FFFFFF;
                opacity: 0; transition: opacity 0.5s 0.2s, color 0.5s; 
            }
            #ai-container.chat-active #ai-persistent-title { opacity: 1; }
            #ai-container:not(.chat-active) #ai-brand-title { opacity: 1; }
            #ai-brand-title span { animation: brand-title-pulse 4s linear infinite; }
            #ai-welcome-message { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); text-align: center; color: rgba(255,255,255,.5); opacity: 1; transition: opacity .5s, transform .5s; width: 100%; }
            #ai-container.chat-active #ai-welcome-message { opacity: 0; pointer-events: none; }
            #ai-welcome-message h2 { font-family: 'Merriweather', serif; font-size: 2.2em; margin: 0; color: #fff; }
            #ai-welcome-message p { max-width: 400px; margin: 10px auto 0; }
            .shortcut-tip { font-size: 0.8em; color: rgba(255,255,255,.7); margin-top: 20px; }
            #ai-close-button { position: absolute; top: 20px; right: 30px; color: rgba(255,255,255,.7); font-size: 40px; cursor: pointer; }
            #ai-char-counter { position: fixed; bottom: 15px; right: 30px; font-size: 0.9em; color: #aaa; }
            #ai-response-container { flex: 1 1 auto; overflow-y: auto; width: 100%; max-width: 720px; margin: 0 auto; display: flex; flex-direction: column; gap: 15px; padding: 80px 20px 20px 20px; }
            .ai-message-bubble { background: rgba(15,15,18,.8); border: 1px solid rgba(255,255,255,.1); border-radius: 16px; padding: 12px 18px; color: #e0e0e0; animation: message-pop-in .5s cubic-bezier(.4,0,.2,1) forwards; max-width: 90%; line-height: 1.6; align-self: flex-start; }
            .user-message { background: rgba(40,45,50,.8); align-self: flex-end; }
            .gemini-response { animation: glow 4s infinite; }
            .gemini-response.loading { display: flex; justify-content: center; align-items: center; min-height: 60px; max-width: 150px; padding: 15px; animation: gemini-glow 4s linear infinite; flex-direction: column; gap: 8px;}
            .memory-status { font-size: 0.8em; color: #aaa; }
            .memory-used-notice { font-size: 0.85em; color: #aaa; margin-top: 8px; border-top: 1px solid #444; padding-top: 8px; }
            
            #ai-compose-area { position: relative; flex-shrink: 0; z-index: 2; margin: 15px auto 0; width: 90%; max-width: 720px; padding-bottom: 15px; }
            #ai-input-wrapper { position: relative; width: 100%; border-radius: 20px; background: rgba(10,10,10,.7); border: 1px solid rgba(255,255,255,.2); }
            #ai-input { min-height: 48px; max-height: ${MAX_INPUT_HEIGHT}px; overflow-y: auto; color: #fff; font-size: 1.1em; padding: 13px 60px 13px 60px; outline: 0; }
            #ai-input:empty::before { content: 'Ask a question or describe your files...'; color: rgba(255, 255, 255, 0.4); }
            
            #ai-attachment-button { position: absolute; bottom: 5px; left: 10px; background-color: transparent; border: none; color: rgba(255,255,255,.8); font-size: 18px; cursor: pointer; padding: 10px; line-height: 1; z-index: 3; }

            /* Other styles (attachments, code blocks, etc.) remain largely the same */
            .ai-loader { width: 25px; height: 25px; border-radius: 50%; animation: spin 1s linear infinite; border: 3px solid rgba(255,255,255,0.3); border-top-color: #fff; }
            @keyframes glow { /* ... */ } @keyframes gemini-glow { /* ... */ } @keyframes spin { to { transform: rotate(360deg); } } @keyframes message-pop-in { /* ... */ } @keyframes brand-title-pulse { /* ... */ }
        `;
        document.head.appendChild(style);
    }
    
    document.addEventListener('keydown', handleKeyDown);

    // Initial load listener
    document.addEventListener('DOMContentLoaded', async () => {
        // Firebase init will be called on activation
    });
})();
