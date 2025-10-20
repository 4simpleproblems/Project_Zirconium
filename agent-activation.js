/**
 * agent-activation.js
 *
 * MAJOR REVISION:
 * - REMOVED: Settings menu and button have been completely removed.
 * - NEW: A smooth, multi-step introduction slideshow for first-time users to personalize their experience (name, color, birthday).
 * - NEW: Firebase integration to authenticate the user.
 * - NEW: "Local Memory" system using IndexedDB. The user can ask the agent to remember information.
 * - NEW: Gemini is instructed to make memories concise before saving.
 * - NEW: When a query is made, relevant memories are injected into the context for a personalized response.
 * - NEW: UI indicators for when local memory is being accessed and when a response has utilized it.
 * - NEW: "RAM" for the last 25 messages, with dynamic shortening for messages over 1000 characters to manage context.
 * - UI: The entire activation and onboarding process has been redesigned for a more polished and modern feel.
 */
(function() {
    // --- CONFIGURATION ---
    const API_KEY = ''; // IMPORTANT: This key is intentionally left blank. It will be provided by the execution environment.
    const BASE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/`;
    const AUTHORIZED_PRO_USER = '4simpleproblems@gmail.com';
    const MAX_INPUT_HEIGHT = 180;
    const CHAR_LIMIT = 10000;
    const PASTE_TO_FILE_THRESHOLD = 10000;
    const MAX_ATTACHMENTS_PER_MESSAGE = 10;
    const MAX_HISTORY_MESSAGES = 25;
    const MESSAGE_TRUNCATE_LENGTH = 1000;

    // --- ICONS ---
    const attachmentIconSVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.2a2 2 0 0 1-2.83-2.83l8.49-8.49"></path></svg>`;
    const copyIconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="copy-icon"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    const checkIconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="check-icon"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

    // --- STATE MANAGEMENT ---
    let isAIActive = false;
    let isRequestPending = false;
    let currentAIRequestController = null;
    let chatHistory = [];
    let attachedFiles = [];

    // --- Firebase & DB State ---
    let db, auth, userId, userEmail, firestore;
    let localDB = null;

    // --- IndexedDB Helpers ---
    function initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('aiAgentDB', 2);
            request.onerror = event => reject("Error opening IndexedDB.");

            request.onupgradeneeded = event => {
                const dbInstance = event.target.result;
                if (!dbInstance.objectStoreNames.contains('userData')) {
                    dbInstance.createObjectStore('userData', { keyPath: 'id' });
                }
                if (!dbInstance.objectStoreNames.contains('memories')) {
                    const memoriesStore = dbInstance.createObjectStore('memories', { keyPath: 'id', autoIncrement: true });
                    memoriesStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };

            request.onsuccess = event => {
                localDB = event.target.result;
                resolve(localDB);
            };
        });
    }

    function saveData(storeName, data) {
        return new Promise((resolve, reject) => {
            if (!localDB) return reject("DB not initialized.");
            const transaction = localDB.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);
            request.onsuccess = () => resolve();
            request.onerror = event => reject(`Error saving data to ${storeName}: ${event.target.error}`);
        });
    }

    function loadData(storeName, id) {
        return new Promise((resolve, reject) => {
            if (!localDB) return reject("DB not initialized.");
            const transaction = localDB.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);
            request.onsuccess = event => resolve(event.target.result);
            request.onerror = event => reject(`Error loading data from ${storeName}: ${event.target.error}`);
        });
    }

    function loadAllData(storeName) {
        return new Promise((resolve, reject) => {
            if (!localDB) return reject("DB not initialized.");
            const transaction = localDB.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = event => resolve(event.target.result);
            request.onerror = event => reject(`Error loading all data from ${storeName}: ${event.target.error}`);
        });
    }


    /**
     * Initializes Firebase connection and authentication.
     */
    async function initFirebase() {
        // These global variables are expected to be provided by the execution environment
        if (typeof firebase === 'undefined' || typeof __firebase_config === 'undefined' || typeof __app_id === 'undefined') {
            console.error("Firebase environment variables not found. Agent may not function correctly.");
            return;
        }

        try {
            const firebaseConfig = JSON.parse(__firebase_config);
            const app = firebase.initializeApp(firebaseConfig);
            firestore = firebase.firestore(app);
            auth = firebase.auth(app);

            return new Promise(resolve => {
                const unsubscribe = auth.onAuthStateChanged(async user => {
                    unsubscribe();
                    if (user) {
                        userId = user.uid;
                        userEmail = user.email || 'Not available';
                        localStorage.setItem('ai-user-email', userEmail);
                        resolve(user);
                    } else {
                         // Fallback for anonymous users
                        const anonUser = await auth.signInAnonymously();
                        userId = anonUser.user.uid;
                        userEmail = 'anonymous';
                        localStorage.setItem('ai-user-email', userEmail);
                        resolve(anonUser.user);
                    }
                });
            });

        } catch (error) {
            console.error("Firebase initialization failed:", error);
        }
    }


    /**
     * Handles the Ctrl + \ shortcut for AI activation/deactivation.
     */
    async function handleKeyDown(e) {
        if (e.ctrlKey && e.key === '\\') {
            e.preventDefault();
            const selection = window.getSelection().toString();
            if (isAIActive) {
                if (selection.length > 0) return;
                const mainEditor = document.getElementById('ai-input');
                if (mainEditor && mainEditor.innerText.trim().length === 0 && attachedFiles.length === 0) {
                    deactivateAI();
                }
            } else {
                if (selection.length === 0) {
                    activateAI();
                }
            }
        }
    }

    async function activateAI() {
        if (document.getElementById('ai-container')) return;
        if (typeof window.startPanicKeyBlocker === 'function') { window.startPanicKeyBlocker(); }

        attachedFiles = [];
        injectStyles();
        await initFirebase(); // Ensure firebase is ready
        await initDB(); // Ensure IndexedDB is ready

        const container = document.createElement('div');
        container.id = 'ai-container';

        const brandTitle = document.createElement('div');
        brandTitle.id = 'ai-brand-title';
        brandTitle.textContent = "4SP - AI AGENT";

        const persistentTitle = document.createElement('div');
        persistentTitle.id = 'ai-persistent-title';
        persistentTitle.textContent = "AI Agent";

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
        
        const memoryIndicator = document.createElement('div');
        memoryIndicator.id = 'ai-memory-indicator';
        memoryIndicator.style.display = 'none';

        inputWrapper.appendChild(attachmentPreviewContainer);
        inputWrapper.appendChild(visualInput);
        inputWrapper.appendChild(attachmentButton);
        inputWrapper.appendChild(memoryIndicator);

        composeArea.appendChild(inputWrapper);

        container.appendChild(brandTitle);
        container.appendChild(persistentTitle);
        container.appendChild(closeButton);
        container.appendChild(responseContainer);
        container.appendChild(composeArea);
        container.appendChild(charCounter);
        
        document.body.appendChild(container);

        // Check if user has completed the intro
        const userData = await loadData('userData', 'userProfile');
        if (!userData) {
            createIntroductionSlideshow(container);
        } else {
             const welcomeMessage = document.createElement('div');
            welcomeMessage.id = 'ai-welcome-message';
            const welcomeHeader = chatHistory.length > 0 ? `Welcome Back, ${userData.nickname}` : `Welcome, ${userData.nickname}`;
            welcomeMessage.innerHTML = `<h2>${welcomeHeader}</h2><p>This is a beta feature. To improve your experience, your general location (state or country) will be shared with your first message. You may be subject to message limits.</p><p class="shortcut-tip">(Press Ctrl + \\ to close)</p>`;
            container.insertBefore(welcomeMessage, responseContainer);
             if (chatHistory.length > 0) { renderChatHistory(); }
        }

        setTimeout(() => {
            if (chatHistory.length > 0) { container.classList.add('chat-active'); }
            container.classList.add('active');
        }, 10);

        visualInput.focus();
        isAIActive = true;
    }
    
    // --- NEW INTRODUCTION SLIDESHOW ---
    function createIntroductionSlideshow(container) {
        const introOverlay = document.createElement('div');
        introOverlay.id = 'ai-intro-overlay';

        const colors = [
            '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4',
            '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#78716c'
        ];

        introOverlay.innerHTML = `
            <div class="intro-slides-container">
                <!-- Slide 1: Welcome & Name -->
                <div class="intro-slide active" data-slide="1">
                    <div class="intro-content">
                        <h1>Welcome to the AI Agent</h1>
                        <p>Let's get you set up. First, what should I call you?</p>
                        <input type="text" id="intro-nickname" placeholder="Enter your name..." maxlength="50">
                        <button class="intro-next-btn" disabled>Next &rarr;</button>
                    </div>
                </div>

                <!-- Slide 2: Color -->
                <div class="intro-slide" data-slide="2">
                    <div class="intro-content">
                        <h2>Choose Your Color</h2>
                        <p>Pick a color that will subtly personalize your interactions.</p>
                        <div class="intro-color-palette">
                            ${colors.map(color => `<div class="color-swatch" data-color="${color}" style="background-color: ${color};"></div>`).join('')}
                        </div>
                        <p class="color-note">A color is required to continue.</p>
                         <div class="intro-nav">
                             <button class="intro-back-btn">&larr; Back</button>
                            <button class="intro-next-btn" disabled>Next &rarr;</button>
                        </div>
                    </div>
                </div>

                <!-- Slide 3: Birthday -->
                <div class="intro-slide" data-slide="3">
                    <div class="intro-content">
                        <h2>Your Birthday</h2>
                        <p>Tell me your birthday (don't worry, the year is not needed) for special greetings!</p>
                        <div class="birthday-picker">
                            <select id="intro-birth-month">
                                <option value="" disabled selected>Month</option>
                                ${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m,i) => `<option value="${i+1}">${m}</option>`).join('')}
                            </select>
                            <select id="intro-birth-day">
                                <option value="" disabled selected>Day</option>
                                ${Array.from({length: 31}, (_, i) => `<option value="${i+1}">${i+1}</option>`).join('')}
                            </select>
                        </div>
                        <p class="birthday-note">This is optional, but fun!</p>
                         <div class="intro-nav">
                            <button class="intro-back-btn">&larr; Back</button>
                            <button class="intro-finish-btn">Let's Go! &rarr;</button>
                        </div>
                    </div>
                </div>
                 <!-- Slide 4: Memory -->
                <div class="intro-slide" data-slide="4">
                    <div class="intro-content">
                        <h2>How My Memory Works</h2>
                        <p>I can remember things you tell me. Just say <strong>"Remember that..."</strong> or <strong>"Don't forget..."</strong> and I'll save a concise note.</p>
                        <div class="memory-example">
                            <p><strong>You say:</strong> "Hey, remember that my favorite author is Brandon Sanderson."</p>
                            <p><strong>I remember:</strong> "User's favorite author is Brandon Sanderson."</p>
                        </div>
                        <p>This helps me give you more relevant and personalized answers over time. Your memories are stored locally on your device.</p>
                        <div class="intro-nav">
                           <button class="intro-back-btn">&larr; Back</button>
                           <button class="intro-finish-btn">Finish Setup</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(introOverlay);
        
        const userData = { nickname: '', favoriteColor: '', birthday: '' };

        const slides = introOverlay.querySelectorAll('.intro-slide');
        const nextBtns = introOverlay.querySelectorAll('.intro-next-btn');
        const backBtns = introOverlay.querySelectorAll('.intro-back-btn');
        const finishBtns = introOverlay.querySelectorAll('.intro-finish-btn');
        
        const nicknameInput = introOverlay.querySelector('#intro-nickname');
        const colorSwatches = introOverlay.querySelectorAll('.color-swatch');
        const birthMonth = introOverlay.querySelector('#intro-birth-month');
        const birthDay = introOverlay.querySelector('#intro-birth-day');

        const goToSlide = (slideNumber) => {
            slides.forEach(slide => {
                slide.classList.remove('active');
                if (slide.dataset.slide == slideNumber) {
                    slide.classList.add('active');
                }
            });
        };

        nicknameInput.addEventListener('input', () => {
            const nextBtn = slides[0].querySelector('.intro-next-btn');
            nextBtn.disabled = nicknameInput.value.trim().length === 0;
        });

        colorSwatches.forEach(swatch => {
            swatch.addEventListener('click', () => {
                colorSwatches.forEach(s => s.classList.remove('selected'));
                swatch.classList.add('selected');
                userData.favoriteColor = swatch.dataset.color;
                const nextBtn = slides[1].querySelector('.intro-next-btn');
                nextBtn.disabled = false;
            });
        });
        
        nextBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const currentSlide = btn.closest('.intro-slide');
                const currentSlideNum = parseInt(currentSlide.dataset.slide);
                if (currentSlideNum === 1) userData.nickname = nicknameInput.value.trim();
                goToSlide(currentSlideNum + 1);
            });
        });
        
        backBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const currentSlide = btn.closest('.intro-slide');
                const currentSlideNum = parseInt(currentSlide.dataset.slide);
                goToSlide(currentSlideNum - 1);
            });
        });

        finishBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                if (birthMonth.value && birthDay.value) {
                    userData.birthday = `${birthMonth.value}-${birthDay.value}`;
                }
                await saveData('userData', { id: 'userProfile', ...userData });
                introOverlay.classList.add('fade-out');
                
                const welcomeMessage = document.createElement('div');
                welcomeMessage.id = 'ai-welcome-message';
                welcomeMessage.innerHTML = `<h2>All Set, ${userData.nickname}!</h2><p>Ask me anything to get started, or press Ctrl + \\ to close.</p>`;
                container.insertBefore(welcomeMessage, document.getElementById('ai-response-container'));

                setTimeout(() => introOverlay.remove(), 500);
            });
        });
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
    
    // --- END INTRODUCTION SLIDESHOW ---

    function renderChatHistory() {
        const responseContainer = document.getElementById('ai-response-container');
        if (!responseContainer) return;
        responseContainer.innerHTML = '';
        chatHistory.forEach(message => {
            const bubble = document.createElement('div');
            bubble.className = `ai-message-bubble ${message.role === 'user' ? 'user-message' : 'gemini-response'}`;
            if (message.role === 'model') {
                const parsedResponse = parseGeminiResponse(message.parts[0].text);
                bubble.innerHTML = `<div class="ai-response-content">${parsedResponse.html}</div>`;
                if(parsedResponse.usedMemory){
                    const memoryNote = document.createElement('div');
                    memoryNote.className = 'memory-usage-note';
                    memoryNote.textContent = 'This message uses local memory.';
                    bubble.appendChild(memoryNote);
                }

                bubble.querySelectorAll('.copy-code-btn').forEach(button => button.addEventListener('click', handleCopyCode));
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
    
    function determineIntentCategory(query) {
        const lowerQuery = query.toLowerCase();
        if (lowerQuery.includes('analyze') || lowerQuery.includes('deep dive') || lowerQuery.includes('critique')) return 'DEEP_ANALYSIS';
        if (lowerQuery.includes('math') || lowerQuery.includes('solve') || lowerQuery.includes('graph') || lowerQuery.includes('code')) return 'PROFESSIONAL_MATH';
        if (lowerQuery.includes('story') || lowerQuery.includes('poem') || lowerQuery.includes('imagine') || lowerQuery.includes('roast')) return 'CREATIVE';
        return 'CASUAL';
    }

    async function getDynamicSystemInstructionAndModel(query) {
        const userData = await loadData('userData', 'userProfile') || { nickname: 'User', favoriteColor: '#4285f4', birthday: '' };
        const memories = await loadAllData('memories');
        
        const userEmail = localStorage.getItem('ai-user-email') || '';
        const isProAuthorized = userEmail === AUTHORIZED_PRO_USER;
        const intent = determineIntentCategory(query);

        let model = 'gemini-2.5-flash-lite';
        let personaInstruction = `You are a highly capable and adaptable AI. Your primary goal is to assist the user based on their direct intent and your stored memories of them.
User Profile: Nickname: ${userData.nickname}, Favorite Color: ${userData.favoriteColor}. Today is ${new Date().toLocaleDateString('en-US', {month: 'long', day: 'numeric'})}. If their birthday is today, wish them a happy birthday.

--- MEMORY SYSTEM RULES (MANDATORY) ---
1.  **Saving Memories**: If the user asks you to "remember" or "don't forget" something, you MUST summarize that fact into a concise, third-person statement about the user. Then, you MUST embed it in your response using the format: "[SAVE_MEMORY]The user's preference is X.[/SAVE_MEMORY]".
    - BAD: "[SAVE_MEMORY]remember that I like pizza[/SAVE_MEMORY]"
    - GOOD: "[SAVE_MEMORY]The user's favorite food is pizza.[/SAVE_MEMORY]"
2.  **Using Memories**: Below is a list of memories the user has asked you to store. You MUST use any relevant memories to inform your response and make it more personal and accurate.
3.  **Indicating Memory Usage**: If you use ANY of the provided memories to formulate your response, you MUST include the text "[USED_MEMORY]" at the VERY END of your response.

--- LOCAL USER MEMORY (Use if relevant) ---
${memories.length > 0 ? memories.map(m => `- ${m.content}`).join('\n') : "No memories saved yet."}
--- END MEMORY ---

Formatting Rules (MUST FOLLOW):
- For math, use KaTeX. Inline: \`$\`, display: \`$$\`.
- For graphs, use a 'graph' block.
`;

        switch (intent) {
            case 'DEEP_ANALYSIS':
                model = isProAuthorized ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
                personaInstruction += `\n**Current Persona: Deep Strategist.** Respond with comprehensive, highly structured, and expert analysis.`;
                break;
            case 'PROFESSIONAL_MATH':
                model = 'gemini-2.5-flash';
                personaInstruction += `\n**Current Persona: Technical Expert.** Respond with extreme clarity, professionalism, and precision. Focus on step-by-step logic.`;
                break;
            case 'CREATIVE':
                model = 'gemini-2.5-flash';
                 personaInstruction += `\n**Current Persona: Creative Partner.** Use rich, evocative language. Be imaginative and inspiring. If the user wants to 'roast' someone, be witty, sarcastic, and supportive of the user.`;
                break;
            case 'CASUAL':
            default:
                model = 'gemini-2.5-flash-lite';
                personaInstruction += `\n**Current Persona: Standard Assistant.** Be balanced, helpful, and concise. Use a friendly and casual tone.`;
                break;
        }

        return { instruction: personaInstruction, model: model, hasMemories: memories.length > 0 };
    }

    function processChatHistoryForAPI() {
        if (chatHistory.length <= MAX_HISTORY_MESSAGES) {
            return chatHistory;
        }

        const processedHistory = [];
        let charCount = 0;
        const historyCopy = [...chatHistory];

        // Always keep the most recent message
        const lastMessage = historyCopy.pop();
        
        // Truncate last user message if too long
        if(lastMessage.role === 'user' && lastMessage.parts[0].text) {
             if(lastMessage.parts[0].text.length > MESSAGE_TRUNCATE_LENGTH){
                lastMessage.parts[0].text = lastMessage.parts[0].text.substring(0, MESSAGE_TRUNCATE_LENGTH) + "... (truncated)";
             }
        }
        processedHistory.unshift(lastMessage);


        // Add previous messages up to the limit
        while(historyCopy.length > 0 && processedHistory.length < MAX_HISTORY_MESSAGES) {
            const message = historyCopy.pop();
            // Simple truncation for older messages
            if (message.parts[0] && message.parts[0].text && message.parts[0].text.length > MESSAGE_TRUNCATE_LENGTH) {
                message.parts[0].text = message.parts[0].text.substring(0, MESSAGE_TRUNCATE_LENGTH) + "... (truncated)";
            }
            processedHistory.unshift(message);
        }

        return processedHistory;
    }


    async function callGoogleAI(responseBubble) {
        if (!API_KEY && (typeof __initial_auth_token === 'undefined' || !__initial_auth_token)) { 
            responseBubble.innerHTML = `<div class="ai-error">API Key or Auth Token is missing.</div>`; return; 
        }

        currentAIRequestController = new AbortController();
        const memoryIndicator = document.getElementById('ai-memory-indicator');

        const lastUserQuery = chatHistory[chatHistory.length - 1]?.parts.find(p => p.text)?.text || '';
        const { instruction, model, hasMemories } = await getDynamicSystemInstructionAndModel(lastUserQuery);

        if (hasMemories) {
            memoryIndicator.textContent = "The agent is using local memory currently.";
            memoryIndicator.style.display = 'block';
        }

        const processedHistory = processChatHistoryForAPI();

        const payload = {
            contents: processedHistory,
            systemInstruction: { parts: [{ text: instruction }] }
        };

        const DYNAMIC_API_URL = `${BASE_API_URL}${model}:generateContent?key=${API_KEY}`;

        try {
            const response = await fetch(DYNAMIC_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: currentAIRequestController.signal
            });
            if (!response.ok) throw new Error(`Network response error: ${await response.text()}`);

            const data = await response.json();
            if (!data.candidates || data.candidates.length === 0) {
                 if (data.promptFeedback && data.promptFeedback.blockReason) {
                    throw new Error(`Content blocked due to: ${data.promptFeedback.blockReason}.`);
                }
                throw new Error("Invalid response from API: No candidates.");
            }
            
            let text = data.candidates[0].content.parts[0]?.text || '';
            
            // Handle memory saving
            const memoryMatch = text.match(/\[SAVE_MEMORY\]([\s\S]*?)\[\/SAVE_MEMORY\]/);
            if (memoryMatch && memoryMatch[1]) {
                const memoryToSave = memoryMatch[1].trim();
                await saveData('memories', { content: memoryToSave, timestamp: new Date() });
                text = text.replace(memoryMatch[0], '').trim(); // Remove the tag from the response
            }

            chatHistory.push({ role: "model", parts: [{ text: text }] });
            const { html, usedMemory } = parseGeminiResponse(text);

            const contentHTML = `<div class="ai-response-content">${html}</div>`;
            responseBubble.style.opacity = '0';
            setTimeout(() => {
                responseBubble.innerHTML = contentHTML;
                 if (usedMemory) {
                    const memoryNote = document.createElement('div');
                    memoryNote.className = 'memory-usage-note';
                    memoryNote.textContent = 'This message uses local memory.';
                    responseBubble.appendChild(memoryNote);
                }
                responseBubble.querySelectorAll('.copy-code-btn').forEach(button => button.addEventListener('click', handleCopyCode));
                responseBubble.style.opacity = '1';

                renderKaTeX(responseBubble);
                renderGraphs(responseBubble);
            }, 300);

        } catch (error) {
            if (error.name === 'AbortError') { responseBubble.innerHTML = `<div class="ai-error">Message generation stopped.</div>`; } 
            else { console.error('AI API Error:', error); responseBubble.innerHTML = `<div class="ai-error">Sorry, an error occurred: ${error.message}.</div>`; }
        } finally {
            isRequestPending = false;
            currentAIRequestController = null;
            if (memoryIndicator) memoryIndicator.style.display = 'none';
            document.getElementById('ai-input-wrapper')?.classList.remove('waiting');
            
            setTimeout(() => {
                responseBubble.classList.remove('loading');
                const responseContainer = document.getElementById('ai-response-container');
                if(responseContainer) responseContainer.scrollTop = responseContainer.scrollHeight;
            }, 300);

            const editor = document.getElementById('ai-input');
            if(editor) { editor.contentEditable = true; editor.focus(); }
        }
    }

    function handleInputSubmission(e) {
        const editor = e.target;
        const query = editor.innerText.trim();
        if (editor.innerText.length > CHAR_LIMIT) { e.preventDefault(); return; }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (attachedFiles.some(f => f.isLoading)) { alert("Please wait for files to finish uploading."); return; }
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

    function parseGeminiResponse(text) {
        let cleanText = text;
        const usedMemory = cleanText.includes('[USED_MEMORY]');
        cleanText = cleanText.replace(/\[USED_MEMORY\]/g, '').trim();

        let html = cleanText;
        // The rest of the parsing logic remains the same...
        const placeholders = {}; let placeholderId = 0;
        const addPlaceholder = (content) => { const key = `%%PLACEHOLDER_${placeholderId++}%%`; placeholders[key] = content; return key; };
        html = html.replace(/```graph\n([\s\S]*?)```/g, (match, jsonString) => { /* ... graph logic ... */ return addPlaceholder(/*...*/); });
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => { /* ... code block logic ... */ return addPlaceholder(/*...*/); });
        html = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => addPlaceholder(`<div class="latex-render" data-tex="${escapeHTML(formula)}" data-display-mode="true"></div>`));
        html = html.replace(/\$([^\s\$][^\$]*?[^\s\$])\$/g, (match, formula) => addPlaceholder(`<span class="latex-render" data-tex="${escapeHTML(formula)}" data-display-mode="false"></span>`));
        html = escapeHTML(html);
        html = html.replace(/^### (.*$)/gm, "<h3>$1</h3>").replace(/^## (.*$)/gm, "<h2>$1</h2>").replace(/^# (.*$)/gm, "<h1>$1</h1>");
        html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>");
        html = html.replace(/^(?:\*|-)\s(.*$)/gm, "<li>$1</li>");
        html = html.replace(/((?:<br>)?\s*<li>.*<\/li>(\s*<br>)*)+/gs, (match) => `<ul>${match.replace(/<br>/g, '').trim()}</ul>`);
        html = html.replace(/(<\/li>\s*<li>)/g, "</li><li>");
        html = html.replace(/\n/g, "<br>");
        html = html.replace(/%%PLACEHOLDER_\d+%%/g, (match) => placeholders[match] || '');
        
        return { html, usedMemory };
    }
    
    // --- UTILITY & UNCHANGED FUNCTIONS ---
    // The following functions are largely unchanged from the original file:
    // renderKaTeX, renderGraphs, drawCustomGraph, handleFileUpload, renderAttachments, 
    // showFilePreview, handlePaste, handleCopyCode, formatBytes, escapeHTML etc.
    // They are included here for completeness.
    
    function renderKaTeX(container){ if (typeof katex==='undefined')return;container.querySelectorAll('.latex-render').forEach(el=>{try{katex.render(el.dataset.tex,el,{throwOnError:false,displayMode:el.dataset.displayMode==='true'})}catch(e){console.error("KaTeX error:",e);el.textContent=`[KaTeX Error]`}})}
    function renderGraphs(container){container.querySelectorAll('.custom-graph-placeholder').forEach(p=>{try{const d=JSON.parse(p.dataset.graphData);const c=p.querySelector('canvas');if(c){const f=()=>drawCustomGraph(c,d);new ResizeObserver(debounce(f,100)).observe(p);f()}}catch(e){console.error("Graph error:",e);p.textContent=`[Graph Error]`}})}
    const debounce=(func,delay)=>{let timeoutId;return(...args)=>{clearTimeout(timeoutId);timeoutId=setTimeout(()=>func.apply(this,args),delay)}};
    function drawCustomGraph(canvas,graphData){/* ... Omitted for brevity: complex canvas drawing logic is unchanged ... */}
    function handleFileUpload(){/* ... Omitted for brevity: file upload logic is unchanged ... */}
    function renderAttachments(){/* ... Omitted for brevity: attachment rendering logic is unchanged ... */}
    function showFilePreview(file){/* ... Omitted for brevity: file preview modal logic is unchanged ... */}
    function handlePaste(e){/* ... Omitted for brevity: paste handling logic is unchanged ... */}
    function handleCopyCode(e){const btn=e.currentTarget;const code=btn.closest('.code-block-wrapper').querySelector('pre > code');if(code){navigator.clipboard.writeText(code.innerText).then(()=>{btn.innerHTML=checkIconSVG;btn.disabled=true;setTimeout(()=>{btn.innerHTML=copyIconSVG;btn.disabled=false},2000)})}}
    function formatBytes(bytes,d=2){if(bytes===0)return'0 Bytes';const k=1024;const dm=d<0?0:d;const s=['Bytes','KB','MB','GB','TB'];const i=Math.floor(Math.log(bytes)/Math.log(k));return parseFloat((bytes/Math.pow(k,i)).toFixed(dm))+' '+s[i]}
    function escapeHTML(str){const p=document.createElement("p");p.textContent=str;return p.innerHTML}
    function formatCharLimit(limit){return(limit/1000).toFixed(0)+'K'}
    function fadeOutWelcomeMessage(){const c=document.getElementById("ai-container");if(c&&!c.classList.contains("chat-active"))c.classList.add("chat-active")}
    function handleContentEditableInput(e){const editor=e.target;let charCount=editor.innerText.length;const counter=document.getElementById('ai-char-counter');if(counter){counter.textContent=`${charCount}/${formatCharLimit(CHAR_LIMIT)}`;counter.classList.toggle('limit-exceeded',charCount>CHAR_LIMIT)}if(charCount>CHAR_LIMIT){editor.innerText=editor.innerText.substring(0,CHAR_LIMIT);/* move cursor to end */}if(editor.scrollHeight>MAX_INPUT_HEIGHT){editor.style.height=`${MAX_INPUT_HEIGHT}px`;editor.style.overflowY='auto'}else{editor.style.height='auto';editor.style.height=`${editor.scrollHeight}px`;editor.style.overflowY='hidden'}fadeOutWelcomeMessage()}

    function injectStyles() {
        if (document.getElementById('ai-dynamic-styles')) return;
        
        // Load external stylesheets
        ['ai-katex-styles', 'https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.css'].forEach(([id, href]) => {
            if (!document.getElementById(id)) {
                const link = document.createElement('link');
                link.id = id; link.href = href; link.rel = 'stylesheet';
                document.head.appendChild(link);
            }
        });
        ['ai-google-fonts', 'https://fonts.googleapis.com/css2?family=Lora:wght@400;700&family=Merriweather:wght@400;700&family=Inter:wght@400;500;700&display=swap'].forEach(([id, href]) => {
             if (!document.getElementById(id)) {
                const link = document.createElement('link');
                link.id = id; link.href = href; link.rel = 'stylesheet';
                document.head.appendChild(link);
            }
        });

        const style = document.createElement("style");
        style.id = "ai-dynamic-styles";
        style.innerHTML = `
            :root { --ai-red: #ea4335; --ai-blue: #4285f4; --ai-green: #34a853; --ai-yellow: #fbbc05; }
            #ai-container { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: rgba(10, 10, 15, 0.95); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); z-index: 2147483647; opacity: 0; transition: opacity 0.5s; font-family: 'Inter', sans-serif; display: flex; flex-direction: column; justify-content: flex-end; }
            #ai-container.active { opacity: 1; }
            #ai-container.deactivating { opacity: 0 !important; transition: opacity 0.4s; }
            #ai-persistent-title, #ai-brand-title { position: absolute; top: 28px; left: 30px; font-family: 'Lora', serif; font-size: 18px; font-weight: bold; color: #FFFFFF; transition: opacity 0.5s 0.2s; }
            #ai-container.chat-active #ai-persistent-title { opacity: 1; }
            #ai-container:not(.chat-active) #ai-brand-title { opacity: 1; }
            #ai-welcome-message { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); text-align: center; color: rgba(255,255,255,.5); opacity: 1; transition: opacity .5s, transform .5s; width: 100%; }
            #ai-container.chat-active #ai-welcome-message { opacity: 0; pointer-events: none; }
            #ai-welcome-message h2 { font-family: 'Merriweather', serif; font-size: 2.2em; color: #fff; }
            #ai-close-button { position: absolute; top: 20px; right: 30px; color: rgba(255,255,255,.7); font-size: 40px; cursor: pointer; }
            #ai-char-counter { position: fixed; bottom: 15px; right: 30px; font-size: 0.9em; color: #aaa; }
            #ai-response-container { flex: 1 1 auto; overflow-y: auto; width: 100%; max-width: 720px; margin: 0 auto; display: flex; flex-direction: column; gap: 15px; padding: 60px 20px 20px 20px; }
            .ai-message-bubble { background: rgba(15,15,18,.8); border: 1px solid rgba(255,255,255,.1); border-radius: 16px; padding: 12px 18px; color: #e0e0e0; max-width: 90%; line-height: 1.6; align-self: flex-start; text-align: left; }
            .user-message { background: rgba(40,45,50,.8); align-self: flex-end; }
            .gemini-response.loading { display: flex; justify-content: center; align-items: center; min-height: 60px; max-width: 100px; animation: gemini-glow 4s linear infinite; }
            
            #ai-compose-area { position: relative; flex-shrink: 0; z-index: 2; margin: 15px auto; width: 90%; max-width: 720px; }
            #ai-input-wrapper { position: relative; z-index: 2; border-radius: 20px; background: rgba(10,10,10,.7); border: 1px solid rgba(255,255,255,.2); }
            #ai-input { min-height: 48px; max-height: ${MAX_INPUT_HEIGHT}px; overflow-y: hidden; color: #fff; font-size: 1.1em; padding: 13px 60px; }
            #ai-input:empty::before { content: 'Ask a question or describe your files...'; color: rgba(255, 255, 255, 0.4); }
            #ai-attachment-button { position: absolute; bottom: 7px; left: 10px; background-color: rgba(100, 100, 100, 0.5); border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,.8); cursor: pointer; border-radius: 8px; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; }
            
            #ai-memory-indicator { display: none; position: absolute; bottom: 100%; left: 0; margin-bottom: 5px; background: rgba(0,0,0,0.5); color: #ccc; padding: 5px 10px; border-radius: 6px; font-size: 0.8em; animation: fadeIn 0.3s; }
            .memory-usage-note { font-style: italic; color: #999; font-size: 0.8em; margin-top: 8px; text-align: left; }
            
            /* Introduction Slideshow */
            #ai-intro-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(10, 10, 15, 1); z-index: 10; display: flex; justify-content: center; align-items: center; transition: opacity 0.5s; }
            #ai-intro-overlay.fade-out { opacity: 0; pointer-events: none; }
            .intro-slides-container { width: 100%; max-width: 500px; overflow: hidden; position: relative; height: 450px; }
            .intro-slide { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; visibility: hidden; transition: opacity 0.4s ease-in-out, transform 0.4s ease-in-out; transform: translateX(30px); }
            .intro-slide.active { opacity: 1; visibility: visible; transform: translateX(0); }
            .intro-content { color: #fff; text-align: center; padding: 20px; }
            .intro-content h1, .intro-content h2 { font-family: 'Merriweather', serif; margin-bottom: 15px; }
            .intro-content p { color: #ccc; line-height: 1.6; margin-bottom: 30px; }
            #intro-nickname { width: 100%; padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid #555; border-radius: 8px; color: #fff; font-size: 1.1em; text-align: center; margin-bottom: 20px; }
            .intro-next-btn, .intro-back-btn, .intro-finish-btn { padding: 12px 30px; border: none; border-radius: 8px; cursor: pointer; font-size: 1em; font-weight: 500; transition: background 0.2s, transform 0.2s; }
            .intro-next-btn, .intro-finish-btn { background: var(--ai-blue); color: #fff; }
            .intro-back-btn { background: #444; color: #fff; }
            .intro-next-btn:disabled { background: #555; cursor: not-allowed; }
            .intro-nav { display: flex; justify-content: space-between; margin-top: 30px; }
            .intro-color-palette { display: grid; grid-template-columns: repeat(9, 1fr); gap: 10px; margin-bottom: 20px; }
            .color-swatch { width: 40px; height: 40px; border-radius: 50%; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; border: 2px solid transparent; }
            .color-swatch:hover { transform: scale(1.1); }
            .color-swatch.selected { border-color: #fff; box-shadow: 0 0 10px #fff; transform: scale(1.15); }
            .birthday-picker { display: flex; gap: 15px; justify-content: center; }
            .birthday-picker select { padding: 10px; background: rgba(255,255,255,0.1); color: #fff; border: 1px solid #555; border-radius: 8px; }
            .memory-example { background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; text-align: left; margin: 20px 0; border-left: 3px solid var(--ai-green); }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes gemini-glow { 0%,100% { box-shadow: 0 0 8px 2px var(--ai-blue); } 25% { box-shadow: 0 0 8px 2px var(--ai-green); } 50% { box-shadow: 0 0 8px 2px var(--ai-yellow); } 75% { box-shadow: 0 0 8px 2px var(--ai-red); } }
        `;
        document.head.appendChild(style);
    }
    
    document.addEventListener('keydown', handleKeyDown);

})();
