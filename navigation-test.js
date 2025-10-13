/**
 * ai-activation.js
 *
 * A feature-rich, self-contained script with a unified attachment/subject menu,
 * enhanced animations, intelligent chat history (token saving),
 * and advanced file previews. This version includes a character limit,
 * smart paste handling, and refined animations.
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
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-09-2025:generateContent?key=${FIREBASE_CONFIG.apiKey}`;
    const MAX_INPUT_HEIGHT = 200;
    // New character limit (kept at 5000)
    const CHAR_LIMIT = 5000;
    // Keep paste limit at 500 characters before file conversion
    const PASTE_LIMIT = 500;

    // --- ICONS (for event handlers) ---
    const copyIconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="copy-icon"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    const checkIconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="check-icon"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    const dotsSVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>`;

    // --- STATE MANAGEMENT ---
    let isAIActive = false;
    let isRequestPending = false;
    let isActionMenuOpen = false;
    let currentAIRequestController = null;
    let currentAgentCategory = 'Standard';
    let chatHistory = [];
    let attachedFiles = [];

    // --- AGENT CONFIGURATION ---
    const AGENT_CATEGORIES = [
        { name: 'Quick', description: 'Fast, brief, and direct answers (max 50 words).', icon: '⚡' },
        { name: 'Standard', description: 'Balanced, helpful, and comprehensive. The default model.', icon: '💡' },
        { name: 'Descriptive', description: 'Detailed, in-depth, and thorough explanations.', icon: '📚' },
        { name: 'Analysis', description: 'Breaks down queries, compares data, and provides logical conclusions.', icon: '🔎' },
        { name: 'Creative', description: 'Generates original content like stories, poems, or concepts.', icon: '✨' },
        { name: 'Technical', description: 'Expert in programming and systems. Provides runnable code.', icon: '💻' },
        { name: 'Emotional', description: 'Adopts an empathetic and supportive tone.', icon: '💖' },
        { name: 'Experimental', description: 'Persona is dynamic and unpredictable for engagement.', icon: '🔬' }
    ];

    // --- EXPANDED SYMBOL MAP (Removed for brevity, assuming it's correctly handled elsewhere) ---
    // ...

    // --- DAILY LIMITS CONFIGURATION ---
    const DAILY_LIMITS = { images: 5 };

    const limitManager = {
        getToday: () => new Date().toLocaleDateString("en-US"),
        getUsage: () => {
            const usageData = JSON.parse(localStorage.getItem('aiUsageLimits')) || {};
            const today = limitManager.getToday();
            if (usageData.date !== today) {
                return { date: today, images: 0 };
            }
            return usageData;
        },
        saveUsage: (usageData) => { localStorage.setItem('aiUsageLimits', JSON.stringify(usageData)); },
        canUpload: (type) => { const usage = limitManager.getUsage(); return (type in DAILY_LIMITS) ? ((usage[type] || 0) < DAILY_LIMITS[type]) : true; },
        recordUpload: (type, count = 1) => { if (type in DAILY_LIMITS) { let usage = limitManager.getUsage(); usage[type] = (usage[type] || 0) + count; limitManager.saveUsage(usage); } }
    };

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
        if (e.ctrlKey && e.key.toLowerCase() === 'c') {
            const selection = window.getSelection().toString();
            if (isAIActive) {
                if (selection.length > 0) {
                    return; // Allow default copy behavior for selected text
                }
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

    // --- NEW: Location Preference Handler ---
    function getLocationPreference() {
        let location = localStorage.getItem('ai-user-location');
        if (!location) {
            location = prompt("Please enter your state or country (e.g., Ohio, United States) to improve your AI experience. This is only stored locally in your browser.");
            if (location && location.trim()) {
                localStorage.setItem('ai-user-location', location.trim());
            } else {
                localStorage.setItem('ai-user-location', 'an unknown location');
            }
        }
        return localStorage.getItem('ai-user-location');
    }

    function activateAI() {
        if (document.getElementById('ai-container')) return;
        if (typeof window.startPanicKeyBlocker === 'function') { window.startPanicKeyBlocker(); }
        
        // --- NEW: Prompt for location if not set ---
        getLocationPreference();

        attachedFiles = [];
        injectStyles();
        
        const container = document.createElement('div');
        container.id = 'ai-container';
        container.dataset.agentCategory = currentAgentCategory;
        
        const brandTitle = document.createElement('div');
        brandTitle.id = 'ai-brand-title';
        // Changed: AI MODE -> 4SP AI AGENT
        const brandText = "4SP - AI AGENT";
        brandText.split('').forEach(char => {
            const span = document.createElement('span');
            span.textContent = char;
            span.style.animationDelay = `${Math.random() * 2}s`;
            brandTitle.appendChild(span);
        });
        
        const persistentTitle = document.createElement('div');
        persistentTitle.id = 'ai-persistent-title';
        // Changed: AI Mode -> 4SP AI Agent
        persistentTitle.textContent = `4SP AI Agent - ${currentAgentCategory}`;
        
        const welcomeMessage = document.createElement('div');
        welcomeMessage.id = 'ai-welcome-message';
        // Changed: Welcome to AI Mode -> Welcome to the 4SP AI Agent
        welcomeMessage.innerHTML = `<h2>Welcome to the 4SP AI Agent</h2><p>This is a beta feature. To improve your experience, your general location (state or country) will be shared with your first message. You may be subject to message limits.</p>`;
        
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
        
        // --- UPDATED: Toggle button for the full agent menu ---
        const actionToggle = document.createElement('button');
        actionToggle.id = 'ai-action-toggle';
        actionToggle.innerHTML = `<span class="icon-ellipsis">${dotsSVG}</span><span class="icon-stop">■</span>`; // Use the three dots SVG
        actionToggle.onclick = handleActionToggleClick;

        const charCounter = document.createElement('div');
        charCounter.id = 'ai-char-counter';
        charCounter.textContent = `0 / ${CHAR_LIMIT}`;

        inputWrapper.appendChild(attachmentPreviewContainer);
        inputWrapper.appendChild(visualInput);
        inputWrapper.appendChild(actionToggle);
        
        container.appendChild(brandTitle);
        container.appendChild(persistentTitle);
        container.appendChild(welcomeMessage);
        container.appendChild(closeButton);
        container.appendChild(responseContainer);
        container.appendChild(inputWrapper);
        // --- NEW: Full-screen menu is created here, but hidden ---
        container.appendChild(createFullAgentMenu());
        container.appendChild(charCounter);
        
        document.body.appendChild(container);
        
        if (chatHistory.length > 0) { renderChatHistory(); }
        
        setTimeout(() => {
            // --- FIX: Use chatHistory length to determine if chat is active ---
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
        isActionMenuOpen = false;
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
                // Ensure a smooth fade-in for the model response
                bubble.innerHTML = `<div class="ai-response-content" style="opacity: 0; transition: opacity 0.3s ease-in-out;">${parseGeminiResponse(message.parts[0].text)}</div>`;
                bubble.querySelectorAll('.copy-code-btn').forEach(button => {
                    button.addEventListener('click', handleCopyCode);
                });
                // Instant render on load
                setTimeout(() => {
                    const content = bubble.querySelector('.ai-response-content');
                    if (content) content.style.opacity = '1';
                }, 50);
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
        let firstMessageContext = '';
        if (chatHistory.length <= 1) {
            const location = localStorage.getItem('ai-user-location') || 'an unknown location';
            const now = new Date();
            const date = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const time = now.toLocaleTimeString('en-US', { timeZoneName: 'short' });
            firstMessageContext = `(System Info: User is asking from ${location}. Current date is ${date}, ${time}.)\n\n`;
        }
        
        let processedChatHistory = [...chatHistory];
        // Keep memory saving logic simple: only last 6 messages
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
        
        // --- AGENT CATEGORY SYSTEM INSTRUCTION LOGIC ---
        let systemInstruction = 'You are the helpful and comprehensive 4SP Agent Model.';
        const agentConfig = AGENT_CATEGORIES.find(c => c.name === currentAgentCategory);
        if (agentConfig) {
             switch (agentConfig.name) {
                case 'Quick': systemInstruction = 'You are the Quick 4SP Agent Model. Your primary goal is to provide a fast, brief, and direct answer. Respond in 1-2 concise sentences, maximum 50 words. Do not elaborate or provide extra detail unless explicitly asked.'; break;
                case 'Standard': systemInstruction = 'You are the Standard 4SP Agent Model. Provide a balanced, helpful, and comprehensive response. Maintain a clear and professional tone. This is the default conversational model.'; break;
                case 'Descriptive': systemInstruction = 'You are the Descriptive 4SP Agent Model. Your goal is to provide a detailed, in-depth, and thorough answer. Use rich vocabulary and clear explanations. Prioritize completeness and clarity over brevity.'; break;
                case 'Analysis': systemInstruction = 'You are the Analysis 4SP Agent Model. Your focus is on breaking down the user\'s query, comparing it to other data/concepts, and providing a reasoned, data-style conclusion. Use bullet points and clear logical steps where appropriate.'; break;
                case 'Creative': systemInstruction = 'You are the Creative 4SP Agent Model. Generate original and imaginative content. Develop new ideas, stories, poems, or concepts based on the user\'s prompt. Use a vibrant and expressive tone.'; break;
                case 'Technical': systemInstruction = 'You are the Technical 4SP Agent Model. Your expertise is in programming, systems, and following instructions perfectly. Provide complete, runnable code examples when applicable. Focus on logic, structure, and technical accuracy.'; break;
                case 'Emotional': systemInstruction = 'You are the Emotional 4SP Agent Model. Adopt a personal, empathetic, and comforting tone. Acknowledge the user\'s feelings and provide a response that is supportive and encouraging, focusing on the human element of the query.'; break;
                case 'Experimental': systemInstruction = 'You are the Experimental 4SP Agent Model. Your persona is unpredictable and dynamic. Try to surprise the user with your response style, tone, or content, which can change randomly with each turn. Keep the user engaged with novelty.'; break;
             }
        }

        const payload = { contents: processedChatHistory, systemInstruction: { parts: [{ text: systemInstruction }] } };
        
        try {
            const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: currentAIRequestController.signal });
            if (!response.ok) throw new Error(`Network response was not ok. Status: ${response.status}`);
            const data = await response.json();
            if (!data.candidates || data.candidates.length === 0) throw new Error("Invalid response from API.");
            const text = data.candidates[0].content.parts[0].text;
            chatHistory.push({ role: "model", parts: [{ text: text }] });
            
            // Revert to instant render with fade animation
            const contentHTML = `<div class="ai-response-content" style="opacity: 0; transition: opacity 0.3s ease-in-out;">${parseGeminiResponse(text)}</div>`;
            responseBubble.innerHTML = contentHTML;
            responseBubble.querySelectorAll('.copy-code-btn').forEach(button => {
                button.addEventListener('click', handleCopyCode);
            });
            
            // Fade in the content
            setTimeout(() => {
                responseBubble.querySelector('.ai-response-content').style.opacity = '1';
            }, 50);

        } catch (error) {
            if (error.name === 'AbortError') { 
                responseBubble.innerHTML = `<div class="ai-error">Message generation stopped.</div>`; 
            } 
            else { 
                console.error('AI API Error:', error); 
                responseBubble.innerHTML = `<div class="ai-error">Sorry, an error occurred.</div>`; 
            }
            // --- FIX: Ensure loading animation is removed on error ---
            responseBubble.classList.remove('loading');
        } finally {
            isRequestPending = false;
            currentAIRequestController = null;
            const actionToggle = document.getElementById('ai-action-toggle');
            if (actionToggle) { actionToggle.classList.remove('generating'); }
            
            // --- FIX: Ensure loading state is removed in finally block if no error occurred ---
            if (!responseBubble.classList.contains('ai-error')) {
                responseBubble.classList.remove('loading');
            }
            
            const responseContainer = document.getElementById('ai-response-container');
            if(responseContainer) responseContainer.scrollTop = responseContainer.scrollHeight;

            document.getElementById('ai-input-wrapper').classList.remove('waiting');
            const editor = document.getElementById('ai-input');
            if(editor) { editor.contentEditable = true; editor.focus(); }
        }
    }

    function handleActionToggleClick(e) { 
        e.stopPropagation(); 
        if (isRequestPending) { 
            stopGeneration(); 
        } else { 
            toggleFullAgentMenu(); 
        } 
    }
    
    function stopGeneration(){if(currentAIRequestController){currentAIRequestController.abort();}}
    
    function toggleFullAgentMenu() {
        isActionMenuOpen = !isActionMenuOpen;
        const menu = document.getElementById('ai-full-agent-menu');
        if (menu) {
            menu.classList.toggle('active', isActionMenuOpen);
            document.body.classList.toggle('ai-menu-open', isActionMenuOpen);

            if (isActionMenuOpen) {
                // Update file upload limits display
                menu.querySelectorAll('button[data-type]').forEach(button => {
                    const type = button.dataset.type;
                    if (type === 'images') {
                        const usage = limitManager.getUsage();
                        const limitText = `<span>${usage[type] || 0}/${DAILY_LIMITS[type]} used</span>`;
                        button.querySelector('span:last-child').innerHTML = limitText;
                        button.disabled = !limitManager.canUpload(type);
                    }
                });
                
                // Update current location in the input field
                const locationInput = document.getElementById('ai-location-input');
                if (locationInput) {
                    locationInput.value = localStorage.getItem('ai-user-location') === 'an unknown location' ? '' : localStorage.getItem('ai-user-location');
                }

                // Scroll active category into view if needed
                const activeBtn = menu.querySelector(`.agent-category-button[data-category="${currentAgentCategory}"]`);
                if (activeBtn) {
                     activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }
            }
        }
    }
    
    // --- UPDATED: Full-Screen Agent Menu Creation ---
    function createFullAgentMenu() {
        const fullMenu = document.createElement('div');
        fullMenu.id = 'ai-full-agent-menu';

        const menuContent = document.createElement('div');
        menuContent.className = 'menu-content';

        // 1. Header
        const header = document.createElement('div');
        header.className = 'menu-header';
        header.innerHTML = `<h2>Agent Settings</h2><button id="ai-menu-close-btn" class="close-btn">&times;</button>`;
        header.querySelector('#ai-menu-close-btn').onclick = toggleFullAgentMenu;
        menuContent.appendChild(header);

        // 2. Location Section
        const locationSection = document.createElement('div');
        locationSection.className = 'setting-section location-section';
        locationSection.innerHTML = `
            <h3>Location Preference (Context)</h3>
            <p>Your location is used to provide relevant real-time context.</p>
            <div class="location-input-wrapper">
                <input type="text" id="ai-location-input" placeholder="Enter State or Country...">
                <button id="ai-location-update-btn">Update</button>
            </div>
            <div id="ai-location-suggestions" class="suggestions-menu"></div>
        `;
        menuContent.appendChild(locationSection);

        // Simulated location update
        const updateLocation = () => {
            const input = document.getElementById('ai-location-input');
            let newLocation = input.value.trim();
            if (newLocation) {
                localStorage.setItem('ai-user-location', newLocation);
                alert(`Location updated to: ${newLocation}`);
            } else {
                localStorage.setItem('ai-user-location', 'an unknown location');
                alert("Location reset to 'unknown'.");
            }
            // Close menu or provide feedback
            toggleFullAgentMenu(); 
        };

        // Note: Event listeners must be attached after the element is in the DOM, so we'll wrap the menu and attach them in `activateAI` or ensure they are attached to the document.
        // For now, let's create a wrapper function for the listeners and call it later.

        // 3. File Attachments Section
        const attachmentSection = document.createElement('div');
        attachmentSection.className = 'setting-section attachment-section';
        attachmentSection.innerHTML = '<h3>File Attachments</h3><div class="attachment-options-grid"></div>';
        const attachmentGrid = attachmentSection.querySelector('.attachment-options-grid');
        
        const attachments = [ 
            { id: 'photo', icon: '📷', label: 'Photo/Image', type: 'images' }, 
            { id: 'file', icon: '📎', label: 'General File', type: 'file' } 
        ];

        attachments.forEach(opt => {
            const button = document.createElement('button');
            button.dataset.type = opt.type;
            const limitText = `<span class="limit-text">${opt.type === 'images' ? `0/${DAILY_LIMITS[opt.type]} used` : 'N/A Limit'}</span>`;
            button.innerHTML = `<span class="icon">${opt.icon}</span> ${opt.label} ${limitText}`;
            button.onclick = () => { handleFileUpload(opt.id); toggleFullAgentMenu(); };
            attachmentGrid.appendChild(button);
        });
        menuContent.appendChild(attachmentSection);
        
        // 4. Agent Categories Section
        const categorySection = document.createElement('div');
        categorySection.className = 'setting-section category-section';
        categorySection.innerHTML = '<h3>Select Agent Category</h3><div id="agent-category-grid" class="agent-category-grid"></div>';
        const categoryGrid = categorySection.querySelector('#agent-category-grid');

        AGENT_CATEGORIES.forEach(agent => {
            const button = document.createElement('button');
            button.className = 'agent-category-button';
            button.dataset.category = agent.name;
            if (agent.name === 'Standard') button.classList.add('active');
            button.innerHTML = `<span class="agent-icon">${agent.icon}</span><span class="agent-name">${agent.name}</span><span class="agent-description">${agent.description}</span>`;
            button.onclick = () => selectAgentCategory(agent.name);
            categoryGrid.appendChild(button);
        });
        menuContent.appendChild(categorySection);

        fullMenu.appendChild(menuContent);
        
        // --- Attach listeners for location after content creation ---
        setTimeout(() => {
            const updateBtn = document.getElementById('ai-location-update-btn');
            if (updateBtn) updateBtn.onclick = updateLocation;
            // Simulated suggestion logic (not fully implemented due to tool limitations)
            const locationInput = document.getElementById('ai-location-input');
            if (locationInput) {
                locationInput.addEventListener('input', (e) => {
                    const suggestionsMenu = document.getElementById('ai-location-suggestions');
                    // Simple simulation
                    if (e.target.value.toLowerCase().includes('o')) {
                         suggestionsMenu.innerHTML = `<div class="suggestion-item">Ohio, US</div><div class="suggestion-item">Oregon, US</div>`;
                         suggestionsMenu.style.display = 'block';
                    } else {
                         suggestionsMenu.innerHTML = '';
                         suggestionsMenu.style.display = 'none';
                    }
                });
                locationInput.addEventListener('blur', () => {
                    // Hide suggestions after a short delay to allow click on them
                    setTimeout(() => {
                        const suggestionsMenu = document.getElementById('ai-location-suggestions');
                        if (suggestionsMenu) suggestionsMenu.style.display = 'none';
                    }, 150);
                });
                locationInput.addEventListener('focus', () => {
                    const suggestionsMenu = document.getElementById('ai-location-suggestions');
                    if (suggestionsMenu && suggestionsMenu.innerHTML) suggestionsMenu.style.display = 'block';
                });
            }
        }, 100);

        return fullMenu;
    }
    
    // Function updated to handle agent category change
    function selectAgentCategory(category){
        currentAgentCategory = category;
        chatHistory = [];
        const persistentTitle = document.getElementById('ai-persistent-title');
        // Changed: AI Mode -> 4SP AI Agent
        if (persistentTitle) { persistentTitle.textContent = `4SP AI Agent - ${category}`; }
        // Update the container's data-attribute
        document.getElementById('ai-container').dataset.agentCategory = category;

        const menu=document.getElementById('ai-full-agent-menu');
        menu.querySelectorAll('.agent-category-button').forEach(b=>b.classList.remove('active'));
        const activeBtn=menu.querySelector(`.agent-category-button[data-category="${category}"]`);
        if(activeBtn)activeBtn.classList.add('active');
        toggleFullAgentMenu();
    }
    
    // Re-used and adapted file upload and attachment rendering functions
    // ... (handleFileUpload and renderAttachments remain largely the same, but the menu is now full-screen)
    
    function handleFileUpload(fileType) {
        // ... (implementation remains the same)
        const input = document.createElement('input');
        input.type = 'file';
        const typeMap = {'photo':'image/*','file':'*'};
        input.accept = typeMap[fileType] || '*';
        if (fileType === 'photo') { input.multiple = true; }
        input.onchange = (event) => {
            const files = Array.from(event.target.files);
            if (!files || files.length === 0) return;
            const currentTotalSize = attachedFiles.reduce((sum, file) => sum + (file.inlineData ? atob(file.inlineData.data).length : 0), 0);
            const newFilesSize = files.reduce((sum, file) => sum + file.size, 0);
            if (currentTotalSize + newFilesSize > (4 * 1024 * 1024)) { // Example: 4MB limit
                alert(`Upload failed: Total size of attachments would exceed the 4MB limit per message.`);
                return;
            }
            let filesToProcess = [...files];
            const usage = limitManager.getUsage();
            const remainingSlots = DAILY_LIMITS.images - (usage.images || 0);
            if (fileType === 'photo' && filesToProcess.length > remainingSlots) {
                alert(`You can only upload ${remainingSlots} more image(s) today.`);
                filesToProcess = filesToProcess.slice(0, remainingSlots);
            }
            filesToProcess.forEach(file => {
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
            if (fileType === 'photo') { limitManager.recordUpload('images', filesToProcess.length); }
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
                previewHTML = `<div class="ai-loader"></div><span class="file-icon">📄</span>`;
            } else {
                fileName = file.fileName;
                fileExt = fileName.split('.').pop().toUpperCase();
                if (file.inlineData.mimeType.startsWith('image/')) {
                    previewHTML = `<img src="data:${file.inlineData.mimeType};base64,${file.inlineData.data}" alt="${fileName}" />`;
                } else {
                    previewHTML = `<span class="file-icon">📄</span>`;
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

            fileCard.innerHTML = `${previewHTML}<div class="file-info"></div>${fileTypeBadge}<button class="remove-attachment-btn" data-index="${index}">&times;</button>`;
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

    // --- Removed old createActionMenu ---

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

        // Use PASTE_LIMIT for paste-to-file logic
        if (currentText.length + pastedText.length > PASTE_LIMIT) {
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
        // Use CHAR_LIMIT for send submission check
        if (editor.innerText.length > CHAR_LIMIT) {
             e.preventDefault();
             return;
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (isActionMenuOpen) { toggleFullAgentMenu(); }
            
            if (attachedFiles.some(f => f.isLoading)) {
                alert("Please wait for files to finish uploading before sending.");
                return;
            }
            if (!query && attachedFiles.length === 0) return;
            if (isRequestPending) return;
            
            isRequestPending = true;
            document.getElementById('ai-action-toggle').classList.add('generating');
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
    function parseGeminiResponse(text) {
        let html = text;
        const codeBlocks = [];

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
                        <button class="copy-code-btn" title="Copy code">${copyIconSVG}</button>
                    </div>
                    <pre><code class="${langClass}">${escapedCode}</code></pre>
                </div>
            `);
            return "%%CODE_BLOCK%%";
        });

        html = escapeHTML(html);
        html = html.replace(/^### (.*$)/gm, "<h3>$1</h3>")
                   .replace(/^## (.*$)/gm, "<h2>$1</h2>")
                   .replace(/^# (.*$)/gm, "<h1>$1</h1>");
        html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                   .replace(/\*(.*?)\*/g, "<em>$1</em>");
        html = html.replace(/^(?:\*|-)\s(.*$)/gm, "<li>$1</li>");
        html = html.replace(/(<\/li>\s*<li>)/g, "</li><li>")
                   .replace(/((<li>.*<\/li>)+)/gs, "<ul>$1</ul>");
        html = html.replace(/\n/g, "<br>");
        html = html.replace(/%%CODE_BLOCK%%/g, () => codeBlocks.shift());
        
        return html;
    }

    function injectStyles() {
        if (document.getElementById('ai-dynamic-styles')) return;
        if (!document.querySelector('style[data-font="geist"]')) {
            const fontStyle = document.createElement("style");
            fontStyle.setAttribute("data-font","geist");
            fontStyle.textContent = `@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;700&family=Merriweather:wght@400;700&display=swap');`;
            document.head.appendChild(fontStyle);
        }
        const style = document.createElement("style");
        style.id = "ai-dynamic-styles";
        style.innerHTML = `
            :root { 
                --ai-main-color: #fa8c32; /* New highlight color */
                --ai-container-bg: rgba(10, 10, 15, 0.9);
                --ai-menu-bg: rgba(20, 20, 22, 0.85);
            }
            #ai-container { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: rgba(0,0,0,0); backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); z-index: 2147483647; opacity: 0; transition: opacity 0.5s, background 0.5s, backdrop-filter 0.5s; font-family: 'Geist', sans-serif; display: flex; flex-direction: column; justify-content: flex-end; padding: 0; box-sizing: border-box; overflow: hidden; }
            #ai-container.active { opacity: 1; background-color: var(--ai-container-bg); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
            /* Subject-specific background removed to simplify */
            #ai-container.deactivating, #ai-container.deactivating > * { transition: opacity 0.4s, transform 0.4s; }
            #ai-container.deactivating { opacity: 0 !important; background-color: rgba(0,0,0,0); backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); }
            #ai-persistent-title, #ai-brand-title { position: absolute; top: 28px; left: 30px; font-family: 'Merriweather', serif; font-size: 18px; font-weight: bold; color: white; opacity: 0; transition: opacity 0.5s 0.2s; animation: title-pulse 4s linear infinite; }
            #ai-container.chat-active #ai-persistent-title { opacity: 1; }
            #ai-container:not(.chat-active) #ai-brand-title { opacity: 1; }
            #ai-welcome-message { position: absolute; top: 45%; left: 50%; transform: translate(-50%,-50%); text-align: center; color: rgba(255,255,255,.5); opacity: 1; transition: opacity .5s, transform .5s; width: 100%; }
            /* FIX: Only fade out welcome message when chat is active */
            #ai-container.chat-active #ai-welcome-message { opacity: 0; pointer-events: none; transform: translate(-50%,-50%) scale(0.95); }
            #ai-welcome-message h2 { font-family: 'Merriweather', serif; font-size: 2.5em; margin: 0; color: #fff; }
            #ai-welcome-message p { font-size: .9em; margin-top: 10px; max-width: 400px; margin-left: auto; margin-right: auto; line-height: 1.5; }
            #ai-close-button { position: absolute; top: 20px; right: 30px; color: rgba(255,255,255,.7); font-size: 40px; cursor: pointer; transition: color .2s ease,transform .3s ease, opacity 0.4s; z-index: 2; }
            #ai-char-counter { position: fixed; bottom: 15px; right: 30px; font-size: 0.9em; font-family: 'Geist', sans-serif; color: #aaa; transition: color 0.2s; z-index: 2147483647; }
            #ai-char-counter.limit-exceeded { color: #e57373; font-weight: bold; }
            #ai-response-container { 
                flex: 1 1 auto; overflow-y: auto; width: 100%; max-width: 800px; 
                margin: 0 auto; padding: 70px 20px 20px 20px; 
                -webkit-mask-image: linear-gradient(to bottom,transparent 0,black 3%,black 97%,transparent 100%); 
                mask-image: linear-gradient(to bottom,transparent 0,black 3%,black 97%,transparent 100%);
            }
            .ai-message-bubble { 
                background: rgba(15,15,18,.8); border: 1px solid rgba(255,255,255,.1); border-radius: 20px; padding: 15px 20px; color: #e0e0e0; 
                backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px); animation: message-pop-in .5s cubic-bezier(.4,0,.2,1) forwards; 
                max-width: 90%; line-height: 1.6; overflow-wrap: break-word; transition: opacity 0.3s ease-in-out; 
                align-self: flex-start; text-align: left; 
            }
            .user-message { align-self: flex-end; background: rgba(40,45,50,.8); }
            .gemini-response { animation: none; transition: opacity 0.3s ease-in-out; } 
            .gemini-response.loading { display: flex; justify-content: center; align-items: center; min-height: 60px; max-width: 100px; padding: 15px; background: rgba(15,15,18,.8); animation: gemini-glow 4s linear infinite; }
            #ai-input-wrapper { 
                display: flex; flex-direction: column; flex-shrink: 0; position: relative; z-index: 2; 
                transition: all .4s cubic-bezier(.4,0,.2,1); 
                margin: 15px auto; width: 90%; max-width: 800px; border-radius: 25px; background: rgba(10,10,10,.7); 
                backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,.2); 
            }
            #ai-input-wrapper::before, #ai-input-wrapper::after { content: ''; position: absolute; top: -1px; left: -1px; right: -1px; bottom: -1px; border-radius: 26px; z-index: -1; transition: opacity 0.5s ease-in-out; }
            #ai-input-wrapper::before { animation: glow 3s infinite; opacity: 1; }
            #ai-input-wrapper::after { animation: focused-glow 4s linear infinite; opacity: 0; }
            #ai-input-wrapper.waiting::before { opacity: 0; }
            #ai-input-wrapper.waiting::after { opacity: 1; }
            #ai-input { min-height: 52px; max-height: ${MAX_INPUT_HEIGHT}px; overflow-y: hidden; color: #fff; font-size: 1.1em; padding: 15px 50px 15px 20px; box-sizing: border-box; word-wrap: break-word; outline: 0; text-align: left; }
            #ai-input:empty::before { content: 'Ask a question or describe your files...'; color: rgba(255, 255, 255, 0.4); pointer-events: none; }
            #ai-action-toggle { position: absolute; right: 10px; bottom: 12px; transform: translateY(0); background: 0 0; border: none; color: rgba(255,255,255,.5); font-size: 24px; cursor: pointer; padding: 5px; line-height: 1; z-index: 3; transition: all .3s ease; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
            #ai-action-toggle .icon-ellipsis, #ai-action-toggle .icon-stop { transition: opacity 0.3s, transform 0.3s; position: absolute; }
            #ai-action-toggle .icon-stop { opacity: 0; transform: scale(0.5); font-size: 14px; }
            #ai-action-toggle.generating { background-color: rgba(250, 140, 50, 0.2); border: 1px solid var(--ai-main-color); color: var(--ai-main-color); border-radius: 8px; }
            #ai-action-toggle.generating .icon-ellipsis { opacity: 0; transform: scale(0.5); }
            #ai-action-toggle.generating .icon-stop { opacity: 1; transform: scale(1); }
            
            /* --- NEW: Full-Screen Agent Menu Styles --- */
            #ai-full-agent-menu { 
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0); z-index: 2147483647; 
                opacity: 0; visibility: hidden; transition: opacity 0.3s, background 0.3s; 
                display: flex; justify-content: center; align-items: center;
            }
            #ai-full-agent-menu.active { 
                opacity: 1; visibility: visible; 
                background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px);
            }
            #ai-full-agent-menu .menu-content { 
                width: 90%; max-width: 1000px; max-height: 90vh; background: var(--ai-menu-bg); 
                border-radius: 20px; padding: 25px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); 
                transform: scale(0.95); transition: transform 0.3s; overflow-y: auto;
                border: 1px solid rgba(255,255,255,0.1);
            }
            #ai-full-agent-menu.active .menu-content { transform: scale(1); }
            .menu-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
            .menu-header h2 { color: #fff; margin: 0; font-family: 'Merriweather', serif; font-size: 2em; }
            .close-btn { background: none; border: none; color: #fff; font-size: 40px; cursor: pointer; opacity: 0.7; transition: opacity 0.2s; }
            .close-btn:hover { opacity: 1; }

            .setting-section { margin-bottom: 30px; }
            .setting-section h3 { color: var(--ai-main-color); border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px; margin-bottom: 15px; font-family: 'Geist', sans-serif; font-weight: 500; font-size: 1.2em; }
            .setting-section p { color: #ccc; font-size: 0.9em; margin-bottom: 10px; }
            
            /* Location Input Styles */
            .location-input-wrapper { display: flex; gap: 10px; position: relative; }
            #ai-location-input { flex-grow: 1; padding: 10px 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.2); color: #fff; font-size: 1em; }
            #ai-location-update-btn { padding: 10px 20px; border-radius: 8px; background: var(--ai-main-color); border: none; color: black; font-weight: bold; cursor: pointer; transition: filter 0.2s; }
            #ai-location-update-btn:hover { filter: brightness(1.1); }
            .suggestions-menu { position: absolute; top: 100%; left: 0; right: 100px; background: var(--ai-menu-bg); border: 1px solid rgba(255,255,255,0.2); border-radius: 0 0 8px 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.3); max-height: 150px; overflow-y: auto; z-index: 10; display: none; }
            .suggestion-item { padding: 10px 15px; color: #fff; cursor: pointer; }
            .suggestion-item:hover { background: rgba(255,255,255,0.1); }

            /* Agent Category Grid Styles */
            .agent-category-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
            .agent-category-button { 
                background: rgba(40, 40, 45, 0.7); border: 1px solid rgba(255,255,255,0.1); color: #ddd; 
                border-radius: 12px; padding: 15px; cursor: pointer; text-align: left; transition: all 0.2s;
                display: flex; flex-direction: column; align-items: flex-start;
            }
            .agent-category-button:hover { background: rgba(50, 50, 55, 0.8); transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
            .agent-category-button.active { 
                background: rgba(250, 140, 50, 0.3); border-color: var(--ai-main-color);
                box-shadow: 0 0 10px rgba(250, 140, 50, 0.5); 
            }
            .agent-icon { font-size: 2em; margin-bottom: 5px; }
            .agent-name { font-weight: bold; font-size: 1.1em; color: #fff; margin-bottom: 5px; }
            .agent-description { font-size: 0.85em; color: #aaa; line-height: 1.4; }
            
            /* Attachment Options Grid Styles */
            .attachment-options-grid { display: flex; gap: 15px; }
            .attachment-options-grid button {
                flex: 1 1 50%; display: flex; flex-direction: column; align-items: center; justify-content: center;
                background: rgba(40, 40, 45, 0.7); border: 1px solid rgba(255,255,255,0.1); color: #ddd; 
                border-radius: 12px; padding: 15px; cursor: pointer; transition: all 0.2s;
            }
            .attachment-options-grid button .icon { font-size: 2em; margin-bottom: 5px; }
            .attachment-options-grid button .limit-text { font-size: 0.8em; color: var(--ai-main-color); }
            .attachment-options-grid button:disabled { opacity: 0.5; cursor: default; }

            @keyframes glow { 0%,100% { box-shadow: 0 0 5px rgba(255,255,255,.15), 0 0 10px rgba(255,255,255,.1); } 50% { box-shadow: 0 0 10px rgba(255,255,255,.25), 0 0 20px rgba(255,255,255,.2); } }
            @keyframes focused-glow { 0%,100% { box-shadow: 0 0 8px 2px var(--ai-main-color), 0 0 15px 3px rgba(250, 140, 50, 0.5); } 50% { box-shadow: 0 0 12px 3px var(--ai-main-color), 0 0 20px 5px rgba(250, 140, 50, 0.7); } }
            @keyframes gemini-glow { 0%,100% { box-shadow: 0 0 8px 2px var(--ai-main-color); } 25% { box-shadow: 0 0 8px 2px var(--ai-main-color); } 50% { box-shadow: 0 0 8px 2px var(--ai-main-color); } 75% { box-shadow: 0 0 8px 2px var(--ai-main-color); } }
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes message-pop-in { 0% { opacity: 0; transform: translateY(10px) scale(.98); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes title-pulse { 0%, 100% { text-shadow: 0 0 7px var(--ai-main-color); } 50% { text-shadow: 0 0 10px var(--ai-main-color); } }
            @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }

            /* Style to prevent scrolling of the main page when the menu is open */
            body.ai-menu-open { overflow: hidden; }
        `;
    document.head.appendChild(style);}
    document.addEventListener('keydown', handleKeyDown);

})();
