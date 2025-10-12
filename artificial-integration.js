/**
 * ai-integration.js
 * Claude-styled AI Chat Integration for 4SP Agent
 * Only accessible to users signed in with 4simpleproblems@gmail.com
 * Activated via Ctrl+Alt+C keyboard shortcut
 */

(function() {
    // Wait for Firebase auth to be available
    const waitForAuth = () => {
        return new Promise((resolve) => {
            const checkAuth = setInterval(() => {
                if (window.auth) {
                    clearInterval(checkAuth);
                    resolve();
                }
            }, 100);
        });
    };

    // Agent categories configuration
    const AGENT_CATEGORIES = [
        { id: 'general', name: 'General', icon: 'fa-comments' },
        { id: 'mathematics', name: 'Mathematics', icon: 'fa-calculator' },
        { id: 'science', name: 'Science', icon: 'fa-flask' },
        { id: 'english', name: 'English', icon: 'fa-book' },
        { id: 'history', name: 'History', icon: 'fa-landmark' },
        { id: 'programming', name: 'Programming', icon: 'fa-code' },
        { id: 'foreign-language', name: 'Foreign Language', icon: 'fa-language' },
        { id: 'art', name: 'Art & Design', icon: 'fa-palette' }
    ];

    const CHARACTER_LIMIT = 5000;
    let currentUser = null;
    let currentCategory = 'general';
    let uploadedFiles = [];
    let conversationHistory = [];

    // Inject styles
    const injectStyles = () => {
        const style = document.createElement('style');
        style.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=Tiempos+Headline:wght@400;500;600&display=swap');
            
            /* AI Modal Overlay */
            .ai-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.85);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                z-index: 9999;
                display: none;
                align-items: center;
                justify-content: center;
                animation: fadeIn 0.3s ease-out;
            }

            .ai-modal-overlay.active {
                display: flex;
            }

            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            @keyframes slideUp {
                from { 
                    opacity: 0;
                    transform: translateY(30px);
                }
                to { 
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            /* Main AI Container */
            .ai-chat-container {
                width: 90%;
                max-width: 900px;
                height: 85vh;
                max-height: 800px;
                background: #1a1a1a;
                border-radius: 16px;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }

            /* Header */
            .ai-chat-header {
                background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
                padding: 1.5rem 2rem;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .ai-header-content h2 {
                font-family: 'Tiempos Headline', 'Geist', serif;
                font-size: 1.75rem;
                font-weight: 500;
                color: #e8e8e8;
                margin: 0 0 0.25rem 0;
                letter-spacing: -0.02em;
            }

            .ai-header-subtitle {
                font-family: 'Geist', -apple-system, sans-serif;
                font-size: 0.875rem;
                color: #9ca3af;
                margin: 0;
            }

            .ai-close-btn {
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                color: #d1d5db;
                width: 36px;
                height: 36px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.2s;
                font-size: 1.25rem;
            }

            .ai-close-btn:hover {
                background: rgba(255, 255, 255, 0.1);
                color: white;
            }

            /* Category Tabs */
            .ai-category-tabs {
                display: flex;
                gap: 0.5rem;
                padding: 1rem 2rem;
                background: #0f0f0f;
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                overflow-x: auto;
                scrollbar-width: thin;
                scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
            }

            .ai-category-tabs::-webkit-scrollbar {
                height: 6px;
            }

            .ai-category-tabs::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.2);
                border-radius: 3px;
            }

            .ai-category-tab {
                padding: 0.5rem 1rem;
                border-radius: 8px;
                font-family: 'Geist', sans-serif;
                font-size: 0.875rem;
                color: #9ca3af;
                background: transparent;
                border: 1px solid transparent;
                cursor: pointer;
                transition: all 0.2s;
                white-space: nowrap;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }

            .ai-category-tab:hover {
                color: #e5e7eb;
                background: rgba(255, 255, 255, 0.05);
            }

            .ai-category-tab.active {
                color: #a78bfa;
                background: rgba(167, 139, 250, 0.1);
                border-color: rgba(167, 139, 250, 0.3);
            }

            .ai-category-tab i {
                font-size: 0.875rem;
            }

            /* Chat Area */
            .ai-chat-messages {
                flex: 1;
                overflow-y: auto;
                padding: 2rem;
                display: flex;
                flex-direction: column;
                gap: 1.5rem;
                font-family: 'Geist', -apple-system, sans-serif;
            }

            .ai-chat-messages::-webkit-scrollbar {
                width: 8px;
            }

            .ai-chat-messages::-webkit-scrollbar-track {
                background: transparent;
            }

            .ai-chat-messages::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.2);
                border-radius: 4px;
            }

            /* Welcome Message */
            .ai-welcome-message {
                text-align: center;
                padding: 3rem 2rem;
                animation: fadeIn 0.6s ease-out;
            }

            .ai-welcome-message h3 {
                font-family: 'Tiempos Headline', 'Geist', serif;
                font-size: 2rem;
                font-weight: 500;
                color: #e8e8e8;
                margin: 0 0 1rem 0;
                letter-spacing: -0.03em;
            }

            .ai-welcome-message p {
                font-size: 1.125rem;
                color: #9ca3af;
                margin: 0;
            }

            /* Message Bubbles */
            .ai-message {
                display: flex;
                gap: 1rem;
                animation: slideUp 0.3s ease-out;
            }

            .ai-message-avatar {
                width: 36px;
                height: 36px;
                border-radius: 8px;
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.125rem;
            }

            .ai-message.user .ai-message-avatar {
                background: linear-gradient(135deg, #374151 0%, #111827 100%);
                color: white;
            }

            .ai-message.agent .ai-message-avatar {
                background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%);
                color: white;
            }

            .ai-message-content {
                flex: 1;
                min-width: 0;
            }

            .ai-message-header {
                display: flex;
                align-items: baseline;
                gap: 0.75rem;
                margin-bottom: 0.5rem;
            }

            .ai-message-name {
                font-weight: 600;
                font-size: 0.9375rem;
                color: #e5e7eb;
            }

            .ai-message-time {
                font-size: 0.8125rem;
                color: #6b7280;
            }

            .ai-message-text {
                color: #d1d5db;
                line-height: 1.6;
                font-size: 0.9375rem;
            }

            /* File Attachments */
            .ai-file-attachments {
                display: flex;
                flex-wrap: wrap;
                gap: 0.75rem;
                margin-top: 0.75rem;
            }

            .ai-file-chip {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.5rem 0.75rem;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                font-size: 0.8125rem;
                color: #d1d5db;
            }

            .ai-file-chip i {
                color: #a78bfa;
            }

            /* Input Area */
            .ai-input-container {
                padding: 1.5rem 2rem 2rem;
                background: #0f0f0f;
                border-top: 1px solid rgba(255, 255, 255, 0.08);
            }

            .ai-upload-area {
                display: flex;
                gap: 0.75rem;
                margin-bottom: 1rem;
                flex-wrap: wrap;
            }

            .ai-upload-btn {
                padding: 0.5rem 1rem;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                color: #d1d5db;
                font-family: 'Geist', sans-serif;
                font-size: 0.875rem;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }

            .ai-upload-btn:hover {
                background: rgba(255, 255, 255, 0.1);
                border-color: rgba(255, 255, 255, 0.2);
            }

            .ai-uploaded-file {
                padding: 0.5rem 1rem;
                background: rgba(167, 139, 250, 0.1);
                border: 1px solid rgba(167, 139, 250, 0.3);
                border-radius: 8px;
                color: #a78bfa;
                font-size: 0.875rem;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }

            .ai-uploaded-file button {
                background: none;
                border: none;
                color: #a78bfa;
                cursor: pointer;
                padding: 0;
                display: flex;
                align-items: center;
            }

            .ai-input-wrapper {
                position: relative;
                display: flex;
                gap: 0.75rem;
            }

            .ai-textarea {
                flex: 1;
                min-height: 52px;
                max-height: 200px;
                padding: 0.875rem 1rem;
                background: #1a1a1a;
                border: 1.5px solid rgba(255, 255, 255, 0.15);
                border-radius: 12px;
                color: #e5e7eb;
                font-family: 'Geist', sans-serif;
                font-size: 0.9375rem;
                resize: none;
                outline: none;
                transition: all 0.2s;
            }

            .ai-textarea:focus {
                border-color: #a78bfa;
                box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.1);
            }

            .ai-textarea::placeholder {
                color: #6b7280;
            }

            .ai-char-counter {
                position: absolute;
                bottom: 0.75rem;
                right: 1rem;
                font-size: 0.75rem;
                color: #6b7280;
                pointer-events: none;
            }

            .ai-char-counter.warning {
                color: #fbbf24;
            }

            .ai-char-counter.error {
                color: #ef4444;
            }

            .ai-send-btn {
                width: 52px;
                height: 52px;
                background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%);
                border: none;
                border-radius: 12px;
                color: white;
                font-size: 1.25rem;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }

            .ai-send-btn:hover:not(:disabled) {
                transform: translateY(-2px);
                box-shadow: 0 10px 20px -5px rgba(124, 58, 237, 0.4);
            }

            .ai-send-btn:disabled {
                opacity: 0.4;
                cursor: not-allowed;
            }

            /* Typing Indicator */
            .ai-typing-indicator {
                display: flex;
                gap: 1rem;
                padding: 1rem 0;
            }

            .ai-typing-dots {
                display: flex;
                gap: 0.375rem;
                align-items: center;
                padding: 0.75rem 1rem;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 12px;
            }

            .ai-typing-dot {
                width: 8px;
                height: 8px;
                background: #9ca3af;
                border-radius: 50%;
                animation: typingBounce 1.4s infinite;
            }

            .ai-typing-dot:nth-child(2) {
                animation-delay: 0.2s;
            }

            .ai-typing-dot:nth-child(3) {
                animation-delay: 0.4s;
            }

            @keyframes typingBounce {
                0%, 60%, 100% { transform: translateY(0); }
                30% { transform: translateY(-10px); }
            }

            /* Hidden file input */
            .ai-file-input {
                display: none;
            }

            /* Responsive */
            @media (max-width: 768px) {
                .ai-chat-container {
                    width: 95%;
                    height: 95vh;
                }

                .ai-chat-header {
                    padding: 1rem 1.5rem;
                }

                .ai-category-tabs {
                    padding: 0.75rem 1.5rem;
                }

                .ai-chat-messages {
                    padding: 1.5rem;
                }

                .ai-input-container {
                    padding: 1rem 1.5rem 1.5rem;
                }
            }
        `;
        document.head.appendChild(style);
    };

    // Create modal HTML
    const createModal = (username) => {
        const greetings = [
            `Welcome, ${username}`,
            `${username} returns!`,
            `Good to see you, ${username}`,
            `Hello again, ${username}`
        ];
        const greeting = greetings[Math.floor(Math.random() * greetings.length)];

        const modal = document.createElement('div');
        modal.className = 'ai-modal-overlay';
        modal.id = 'ai-modal';
        
        const categoriesHTML = AGENT_CATEGORIES.map(cat => `
            <button class="ai-category-tab ${cat.id === 'general' ? 'active' : ''}" data-category="${cat.id}">
                <i class="fa-solid ${cat.icon}"></i>
                ${cat.name}
            </button>
        `).join('');

        modal.innerHTML = `
            <div class="ai-chat-container">
                <div class="ai-chat-header">
                    <div class="ai-header-content">
                        <h2>4SP Agent</h2>
                        <p class="ai-header-subtitle">AI-Powered Assistant</p>
                    </div>
                    <button class="ai-close-btn" id="ai-close">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="ai-category-tabs" id="ai-categories">
                    ${categoriesHTML}
                </div>

                <div class="ai-chat-messages" id="ai-messages">
                    <div class="ai-welcome-message">
                        <h3>${greeting}</h3>
                        <p>How can 4SP Agent assist you today?</p>
                    </div>
                </div>

                <div class="ai-input-container">
                    <div class="ai-upload-area" id="ai-upload-area">
                        <button class="ai-upload-btn" id="upload-text-btn">
                            <i class="fa-solid fa-file-lines"></i>
                            Upload Text File
                        </button>
                        <button class="ai-upload-btn" id="upload-image-btn">
                            <i class="fa-solid fa-image"></i>
                            Upload Image
                        </button>
                        <input type="file" class="ai-file-input" id="text-file-input" accept=".txt,.md,.json,.js,.css,.html">
                        <input type="file" class="ai-file-input" id="image-file-input" accept="image/*">
                    </div>

                    <div class="ai-input-wrapper">
                        <textarea 
                            class="ai-textarea" 
                            id="ai-input" 
                            placeholder="Message 4SP Agent..."
                            rows="1"
                            maxlength="${CHARACTER_LIMIT}"
                        ></textarea>
                        <span class="ai-char-counter" id="char-counter">0/${CHARACTER_LIMIT}</span>
                        <button class="ai-send-btn" id="ai-send" disabled>
                            <i class="fa-solid fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        return modal;
    };

    // Get current timestamp
    const getTimestamp = () => {
        const now = new Date();
        return now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    // Add message to chat
    const addMessage = (type, content, files = []) => {
        const messagesContainer = document.getElementById('ai-messages');
        const welcomeMsg = messagesContainer.querySelector('.ai-welcome-message');
        if (welcomeMsg) welcomeMsg.remove();

        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-message ${type}`;

        const initial = type === 'user' 
            ? (currentUser.displayName || currentUser.email).charAt(0).toUpperCase()
            : '4';

        const name = type === 'user' 
            ? (currentUser.displayName || currentUser.email.split('@')[0])
            : '4SP Agent';

        let filesHTML = '';
        if (files.length > 0) {
            filesHTML = `
                <div class="ai-file-attachments">
                    ${files.map(f => `
                        <div class="ai-file-chip">
                            <i class="fa-solid ${f.type.startsWith('image/') ? 'fa-image' : 'fa-file-lines'}"></i>
                            ${f.name}
                        </div>
                    `).join('')}
                </div>
            `;
        }

        messageDiv.innerHTML = `
            <div class="ai-message-avatar">${initial}</div>
            <div class="ai-message-content">
                <div class="ai-message-header">
                    <span class="ai-message-name">${name}</span>
                    <span class="ai-message-time">${getTimestamp()}</span>
                </div>
                <div class="ai-message-text">${content}</div>
                ${filesHTML}
            </div>
        `;

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    // Show typing indicator
    const showTypingIndicator = () => {
        const messagesContainer = document.getElementById('ai-messages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'ai-typing-indicator';
        typingDiv.id = 'typing-indicator';
        typingDiv.innerHTML = `
            <div class="ai-message-avatar" style="background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%);">4</div>
            <div class="ai-typing-dots">
                <div class="ai-typing-dot"></div>
                <div class="ai-typing-dot"></div>
                <div class="ai-typing-dot"></div>
            </div>
        `;
        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    // Remove typing indicator
    const removeTypingIndicator = () => {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) indicator.remove();
    };

    // Send message to Firebase AI
    const sendToFirebaseAI = async (message, files) => {
        try {
            showTypingIndicator();

            // Prepare the request payload
            const payload = {
                message: message,
                category: currentCategory,
                userId: currentUser.uid,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                files: files.map(f => ({
                    name: f.name,
                    type: f.type,
                    size: f.size,
                    data: f.data // Base64 encoded
                }))
            };

            // Call Firebase Cloud Function for AI processing
            const aiFunction = firebase.functions().httpsCallable('processAIRequest');
            const result = await aiFunction(payload);

            removeTypingIndicator();
            
            if (result.data && result.data.response) {
                addMessage('agent', result.data.response);
                conversationHistory.push({
                    role: 'assistant',
                    content: result.data.response,
                    timestamp: new Date()
                });
            } else {
                throw new Error('Invalid response from AI');
            }
        } catch (error) {
            console.error('AI Error:', error);
            removeTypingIndicator();
            addMessage('agent', 'I apologize, but I encountered an error processing your request. Please try again.');
        }
    };

    // Handle file upload
    const handleFileUpload = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                resolve({
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    data: e.target.result
                });
            };
            reader.onerror = reject;
            
            if (file.type.startsWith('image/')) {
                reader.readAsDataURL(file);
            } else {
                reader.readAsText(file);
            }
        });
    };

    // Setup event listeners
    const setupEventListeners = (modal) => {
        // Close button
        document.getElementById('ai-close').addEventListener('click', () => {
            modal.classList.remove('active');
        });

        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                modal.classList.remove('active');
            }
        });

        // Category tabs
        document.getElementById('ai-categories').addEventListener('click', (e) => {
            const tab = e.target.closest('.ai-category-tab');
            if (tab) {
                document.querySelectorAll('.ai-category-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentCategory = tab.dataset.category;
            }
        });

        // File upload buttons
        document.getElementById('upload-text-btn').addEventListener('click', () => {
            document.getElementById('text-file-input').click();
        });

        document.getElementById('upload-image-btn').addEventListener('click', () => {
            document.getElementById('image-file-input').click();
        });

        // File inputs
        document.getElementById('text-file-input').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                const fileData = await handleFileUpload(file);
                uploadedFiles.push(fileData);
                displayUploadedFile(fileData);
            }
            e.target.value = '';
        });

        document.getElementById('image-file-input').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                const fileData = await handleFileUpload(file);
                uploadedFiles.push(fileData);
                displayUploadedFile(fileData);
            }
            e.target.value = '';
        });

        // Display uploaded file
        const displayUploadedFile = (fileData) => {
            const uploadArea = document.getElementById('ai-upload-area');
            const fileChip = document.createElement('div');
            fileChip.className = 'ai-uploaded-file';
            fileChip.innerHTML = `
                <i class="fa-solid ${fileData.type.startsWith('image/') ? 'fa-image' : 'fa-file-lines'}"></i>
                ${fileData.name}
                <button onclick="this.parentElement.remove(); uploadedFiles = uploadedFiles.filter(f => f.name !== '${fileData.name}');">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            `;
            uploadArea.appendChild(fileChip);
        };

        // Text input
        const textarea = document.getElementById('ai-input');
        const sendBtn = document.getElementById('ai-send');
        const charCounter = document.getElementById('char-counter');

        textarea.addEventListener('input', () => {
            const length = textarea.value.length;
            charCounter.textContent = `${length}/${CHARACTER_LIMIT}`;
            
            if (length > CHARACTER_LIMIT * 0.9) {
                charCounter.classList.add('warning');
            } else {
                charCounter.classList.remove('warning');
            }

            if (length === CHARACTER_LIMIT) {
                charCounter.classList.add('error');
            } else {
                charCounter.classList.remove('error');
            }

            sendBtn.disabled = length === 0;

            // Auto-resize textarea
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
        });

        // Send button
        sendBtn.addEventListener('click', sendMessage);

        // Enter to send (Shift+Enter for new line)
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!sendBtn.disabled) {
                    sendMessage();
                }
            }
        });

        const sendMessage = () => {
            const message = textarea.value.trim();
            if (message) {
                addMessage('user', message, uploadedFiles);
                conversationHistory.push({
                    role: 'user',
                    content: message,
                    files: uploadedFiles,
                    timestamp: new Date()
                });

                sendToFirebaseAI(message, uploadedFiles);

                textarea.value = '';
                textarea.style.height = 'auto';
                charCounter.textContent = `0/${CHARACTER_LIMIT}`;
                sendBtn.disabled = true;
                uploadedFiles = [];
                
                // Clear uploaded file chips
                document.querySelectorAll('.ai-uploaded-file').forEach(chip => chip.remove());
            }
        };
    };

    // Initialize
    const init = async () => {
        await waitForAuth();

        // Listen for auth state
        window.auth.onAuthStateChanged((user) => {
            currentUser = user;

            // Check if user is authorized
            if (user && user.email === '4simpleproblems@gmail.com') {
                // Setup keyboard shortcut
                document.addEventListener('keydown', (e) => {
                    if (e.ctrlKey && e.altKey && e.key === 'c') {
                        e.preventDefault();
                        const modal = document.getElementById('ai-modal');
                        if (modal) {
                            modal.classList.toggle('active');
                            if (modal.classList.contains('active')) {
                                // Focus on textarea when opened
                                setTimeout(() => {
                                    document.getElementById('ai-input').focus();
                                }, 100);
                            }
                        }
                    }
                });

                // Inject styles if not already done
                if (!document.querySelector('style[data-ai-integration]')) {
                    const style = document.querySelector('style');
                    if (style) {
                        style.setAttribute('data-ai-integration', 'true');
                    }
                    injectStyles();
                }

                // Create modal if not exists
                if (!document.getElementById('ai-modal')) {
                    const username = user.displayName || user.email.split('@')[0];
                    const modal = createModal(username);
                    setupEventListeners(modal);
                }
            }
        });
    };

    // Start initialization when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose uploadedFiles to global scope for the remove button
    window.uploadedFiles = uploadedFiles;

})();
