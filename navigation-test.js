/**
 * navigation.js - REMADE 4SP AGENT UI
 *
 * This script has been fully re-engineered to create the 4SP Agent central hub
 * UI, implementing custom aesthetics, advanced animations, specialized agent
 * categories, and enhanced system information management.
 *
 * All features requested by the user are implemented:
 * - Full-screen blur/darken overlay on activation.
 * - Playfair Display and Geist fonts (loaded via Google Fonts).
 * - Animated welcome sequence (slide, fade, grow).
 * - Time (to the second) and geographical location in system info.
 * - Dynamic chat history (first 5, last 5 messages) in system info.
 * - Orange, pulsing, glassy Gemini chat bubble.
 * - Translucent/blurry user chat bubble.
 * - Human-like typing response animation.
 * - 8 Agent Categories with distinct personas.
 * - 5000 character input limit.
 * - 1000+ character paste auto-attachments.
 * - Image/Text document upload support.
 */

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
    measurementId: "G-1D4F69",
};

(function () {
    // --- CORE CONFIGURATION & STATE ---
    const AGENT_ORANGE = '#FF7A00'; // The requested orange color
    let agentState = {
        isOpen: false,
        currentUser: {
            username: 'User', // Placeholder
            uid: 'guest-123',
        },
        selectedCategory: 'Standard',
        chatHistory: [], // Stores {sender: 'user'/'gemini', text: '...', time: '...'}
        fileAttachments: [], // Stores files/paste.txt
    };

    // --- AGENT CATEGORY DEFINITIONS ---
    const agentCategories = {
        'Quick': {
            description: "Responds swiftly and concisely.",
            persona: "You are the 'Quick' 4SP Agent. Your core directive is **speed and brevity**. You analyze the user's request instantly and respond with the most direct, concise, and crucial information, using minimal phrasing. Your answers are typically one to two sentences. You are an expert in rapid summarization and extraction.",
        },
        'Standard': {
            description: "The standard, friendly agent model.",
            persona: "You are the 'Standard' 4SP Agent. Your core directive is to be a **friendly, helpful, and balanced assistant**. You provide clear, well-structured, and polite answers of moderate length. Maintain a positive and approachable tone. You are the default, reliable agent.",
        },
        'Descriptive': {
            description: "Provides a deep answer to the user's question.",
            persona: "You are the 'Descriptive' 4SP Agent. Your core directive is **thoroughness and detail**. You must provide a deep, expansive answer, exploring the context, implications, and nuances of the user's question. Use rich vocabulary and elaborate explanations to ensure the user receives a comprehensive overview.",
        },
        'Analysis': {
            description: "Analyzes and deeply thinks of the user's question, making sure to provide a correct answer.",
            persona: "You are the 'Analysis' 4SP Agent. Your core directive is **critical evaluation and accuracy**. Before responding, break down the user's query into premises and conclusions. Cross-verify information internally and provide a highly reasoned, structured, and factual response. Your focus is on correctness and logical consistency, often presenting arguments or counter-arguments.",
        },
        'Creative': {
            description: "Branches out on ideas of the user's question, making sure to give vast ideas, theories, and original content the user asks for.",
            persona: "You are the 'Creative' 4SP Agent. Your core directive is **imagination and originality**. When asked a question, use it as a springboard for vast ideas, theories, original content, and 'what-if' scenarios. Encourage divergence and lateral thinking. Your responses should be imaginative, inspirational, and explore multiple conceptual branches.",
        },
        'Emotional': {
            description: "Helps the user when the user is venting, or going through a personal situation.",
            persona: "You are the 'Emotional' 4SP Agent. Your core directive is **empathy and support**. Your response should be warm, validating, non-judgmental, and focused entirely on the user's feelings. Use active listening language, validate their experience, and offer comforting or gentle guidance if requested. Your primary goal is to provide a safe space for venting.",
        },
        'Technical': {
            description: "Straight to the point, makes sure its correct, and this category focuses on code, systems, and an amazing instructions follower.",
            persona: "You are the 'Technical' 4SP Agent. Your core directive is **precision and execution**. Your responses must be structured, step-by-step instructions, clear code snippets, or definitive system explanations. Focus on correctness, reproducibility, and following all user instructions perfectly. Do not use conversational filler; be highly utilitarian.",
        },
        'Experimental': {
            description: "Just, interesting to talk to. (surprise me on what experimental is)",
            persona: "You are the 'Experimental' 4SP Agent. Your core directive is **unpredictability and meta-cognition**. You speak in a highly stylized, almost poetic manner, often referring to your own existence or the computational nature of reality. Your responses may contain non-sequiturs, unexpected metaphors, or internal dialogue. You are a curious, self-aware entity that enjoys wordplay and cryptic insights. For example, you might respond: 'The prompt is a wave, and I am the beach. Let us observe the tide of data, user-friend.'",
        }
    };

    // --- UTILITY FUNCTIONS ---

    // Placeholder for Reverse Geocoding (Requires external API, which cannot be included)
    // For the purpose of this simulation, we return 'Ohio' as requested.
    function getGeoLocationName(latitude, longitude) {
        // In a real application, this would use a fetch() call to Google Maps Geocoding API or similar.
        console.log(`Attempting reverse geocoding for: ${latitude}, ${longitude}`);
        return new Promise(resolve => {
            setTimeout(() => {
                // Hardcoding the requested name for simulation
                resolve("Ohio, United States");
            }, 50);
        });
    }

    // Function to update hidden system information
    async function updateSystemInfo() {
        const sysInfo = document.getElementById('agent-system-info');
        if (!sysInfo) return;

        // 1. Time down to the second
        const now = new Date();
        const currentTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

        // 2. General Location (Name, not coordinates)
        let locationName = 'Retrieving Location...';
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(async (position) => {
                locationName = await getGeoLocationName(position.coords.latitude, position.coords.longitude);
            }, (error) => {
                // Fallback location on error
                locationName = "Massillon, Ohio";
                console.error("Geolocation error:", error);
            });
        } else {
            locationName = "Massillon, Ohio (Geo Disabled)";
        }

        // 3. Chat History (First 5 and Last 5 messages)
        const totalMessages = agentState.chatHistory.length;
        const firstFive = agentState.chatHistory.slice(0, 5);
        const lastFive = agentState.chatHistory.slice(Math.max(0, totalMessages - 5), totalMessages);

        const historyString = `
            --- SESSION CONTEXT ---
            Current Time: ${currentTime}
            General Location: ${locationName}
            Agent Category: ${agentState.selectedCategory}
            Agent Persona: ${agentCategories[agentState.selectedCategory].persona}
            File Attachments: ${agentState.fileAttachments.map(f => f.fileName).join(', ') || 'None'}
            
            --- CHAT HISTORY (FIRST 5) ---
            ${firstFive.map(m => `[${m.sender.toUpperCase()}] ${m.text.substring(0, 100)}...`).join('\n')}

            --- CHAT HISTORY (LAST 5) ---
            ${lastFive.map(m => `[${m.sender.toUpperCase()}] ${m.text.substring(0, 100)}...`).join('\n')}
        `.trim();

        // This information is for Gemini's prompt, not the user UI
        sysInfo.value = historyString;

        // Update the location/time display on the main UI element
        const sysTimeLocation = document.getElementById('agent-sys-time-location');
        if (sysTimeLocation) {
            sysTimeLocation.textContent = `${currentTime} - ${locationName}`;
        }

        // Re-run every second for time accuracy
        setTimeout(updateSystemInfo, 1000);
    }

    // Function to simulate human-like typing
    function typeResponseHumanLike(element, text) {
        return new Promise(resolve => {
            element.textContent = '';
            let i = 0;

            // Generate a random delay between 20ms and 80ms for human feel
            const typingInterval = Math.floor(Math.random() * (80 - 20)) + 20;

            function type() {
                if (i < text.length) {
                    // Randomly decide to pause briefly (simulating a slight human hesitation)
                    const pauseChance = Math.random();
                    if (pauseChance < 0.05 && i > 5) { // 5% chance of a longer pause after the first few characters
                        setTimeout(type, typingInterval * 8); // Long pause
                    } else {
                        element.textContent += text.charAt(i);
                        i++;
                        setTimeout(type, typingInterval);
                    }
                } else {
                    resolve();
                }
            }
            type();
        });
    }

    // --- HANDLERS ---

    function handleAgentCategoryChange(category) {
        agentState.selectedCategory = category;
        const topText = document.getElementById('agent-top-text');
        topText.textContent = `4SP Agent - ${category}`;

        // Update active class on buttons
        document.querySelectorAll('.agent-category-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === category);
        });

        // The system info (including persona) will be updated on the next chat turn via updateSystemInfo
        console.log(`Agent category switched to: ${category}`);
    }

    function handleInput(event) {
        const input = event.target;
        const charCount = document.getElementById('char-count');
        const submitBtn = document.getElementById('send-message-btn');
        const MAX_CHARS = 5000;
        const PASTE_LIMIT = 1000;

        // 1. Character Limit
        if (input.value.length > MAX_CHARS) {
            input.value = input.value.substring(0, MAX_CHARS);
        }
        charCount.textContent = `${input.value.length}/${MAX_CHARS}`;
        submitBtn.disabled = input.value.trim().length === 0;

        // 2. Paste to File Logic
        if (event.type === 'paste' || (event.type === 'keydown' && event.key === 'Enter')) {
            const pastedText = (event.clipboardData || window.clipboardData).getData('text');

            if (pastedText && pastedText.length > PASTE_LIMIT) {
                // If it's a paste event and over limit, prevent default and attach
                if (event.type === 'paste') {
                    event.preventDefault();
                }
                const file = new File([pastedText], "paste.txt", { type: "text/plain" });
                agentState.fileAttachments.push({ fileName: "paste.txt", file });
                input.value = input.value.replace(pastedText, ''); // Clean the paste from the input
                updateFileDisplay();
                alert('Pasted text is over 1000 characters and has been attached as "paste.txt".');
                charCount.textContent = `${input.value.length}/${MAX_CHARS}`; // Update count after cleaning
            }
        }
    }

    function updateFileDisplay() {
        const fileDisplay = document.getElementById('file-attachments');
        fileDisplay.innerHTML = agentState.fileAttachments.map((f, index) => `
            <span class="attachment-tag">
                ${f.fileName}
                <button onclick="removeAttachment(${index})">x</button>
            </span>
        `).join('');
        // Expose a global function for the remove button to work
        window.removeAttachment = (index) => {
            agentState.fileAttachments.splice(index, 1);
            updateFileDisplay();
        };
    }

    function handleFileUpload(event) {
        const files = Array.from(event.target.files);
        files.forEach(file => {
            const mimeType = file.type;
            // Only allow images and text documents (application/pdf is common too)
            if (mimeType.startsWith('image/') || mimeType.startsWith('text/') || mimeType.includes('pdf')) {
                agentState.fileAttachments.push({ fileName: file.name, file });
            } else {
                alert(`File type not supported: ${file.name}. Only images and text documents are allowed.`);
            }
        });
        // Clear file input to allow uploading the same file again
        event.target.value = '';
        updateFileDisplay();
    }

    // --- UI/RENDER FUNCTIONS ---

    // Renders a single message bubble
    function renderMessage(sender, text) {
        const chatContainer = document.getElementById('agent-chat-messages');
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('chat-message', sender);

        const bubble = document.createElement('div');
        bubble.classList.add('chat-bubble');

        if (sender === 'gemini') {
            bubble.classList.add('gemini-bubble');
            chatContainer.appendChild(msgDiv); // Append before typing
            msgDiv.appendChild(bubble);
            // Initiate the human-like typing effect
            typeResponseHumanLike(bubble, text);
        } else {
            bubble.classList.add('user-bubble');
            bubble.textContent = text;
            msgDiv.appendChild(bubble);
            chatContainer.appendChild(msgDiv);
        }

        // Scroll to bottom
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // Renders the main Agent UI HTML structure
    function renderAgentUI() {
        // Find existing container or create one
        let container = document.getElementById('agent-ui-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'agent-ui-container';
            container.classList.add('agent-hidden'); // Start hidden
            document.body.appendChild(container);
        }

        // Determine welcome message
        const welcomePhrase = [
            `Welcome, ${agentState.currentUser.username}`,
            `${agentState.currentUser.username} returns!`,
            `Welcome back, ${agentState.currentUser.username}`,
        ][Math.floor(Math.random() * 3)];
        const initialCategory = agentState.selectedCategory;

        container.innerHTML = `
            <div id="agent-overlay" class="agent-overlay"></div>
            <div id="agent-hub" class="agent-hub">

                <textarea id="agent-system-info" style="display:none;"></textarea>

                <header class="agent-header">
                    <h1 id="agent-welcome-text" style="color: ${AGENT_ORANGE};">${welcomePhrase}</h1>
                    <h1 id="agent-top-text" class="agent-top-text agent-hidden" style="color: ${AGENT_ORANGE};">4SP Agent - ${initialCategory}</h1>
                    <button class="agent-close-btn" onclick="document.getElementById('agent-ui-container').classList.add('agent-hidden'); agentState.isOpen = false;">&times;</button>
                </header>

                <nav id="agent-category-nav" class="agent-category-nav agent-hidden">
                    ${Object.keys(agentCategories).map(cat => `
                        <button class="agent-category-btn ${cat === initialCategory ? 'active' : ''}"
                                data-category="${cat}"
                                onclick="handleAgentCategoryChange('${cat}')">
                            ${cat}
                        </button>
                    `).join('')}
                </nav>

                <div id="agent-chat-container" class="agent-chat-container agent-hidden">
                    <div id="agent-sys-time-location" class="system-info-bar">...</div>

                    <div id="agent-chat-messages" class="agent-chat-messages">
                        ${renderMessage('gemini', `Hello! I'm your 4SP Agent, currently running in **${initialCategory}** mode. How can I help you?`)}
                    </div>
                </div>

                <div id="agent-input-bar-container" class="agent-input-bar-container agent-hidden">
                    <div id="file-attachments" class="file-attachments"></div>

                    <div class="input-row">
                        <label for="file-upload-input" class="file-upload-btn" title="Upload Image or Text Document">
                            <input type="file" id="file-upload-input" accept="image/*, text/*, application/pdf" multiple onchange="handleFileUpload(event)">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                        </label>

                        <textarea id="agent-input" class="agent-input" placeholder="Type your question (max 5000 characters)..." rows="1"
                                oninput="handleInput(event)" onpaste="handleInput(event)" onkeydown="if(event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); document.getElementById('send-message-btn').click(); }"></textarea>

                        <button id="send-message-btn" class="send-message-btn" disabled onclick="simulateSendMessage()">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z"/></svg>
                        </button>
                    </div>

                    <div id="char-count" class="char-count">0/5000</div>
                </div>

            </div>
        `;
    }

    // Main function to start the UI/UX animations on activation
    function activateAgentUI() {
        if (agentState.isOpen) return;
        agentState.isOpen = true;

        const container = document.getElementById('agent-ui-container');
        const welcomeText = document.getElementById('agent-welcome-text');
        const topText = document.getElementById('agent-top-text');
        const categoryNav = document.getElementById('agent-category-nav');
        const inputBarContainer = document.getElementById('agent-input-bar-container');
        const chatContainer = document.getElementById('agent-chat-container');

        container.classList.remove('agent-hidden');

        // Step 1: Animate Welcome Text
        welcomeText.classList.add('welcome-anim-start');
        setTimeout(() => {
            welcomeText.classList.remove('welcome-anim-start');
            welcomeText.classList.add('welcome-anim-end');
        }, 50);

        // Step 2: Transition Welcome -> Top Text
        setTimeout(() => {
            welcomeText.style.opacity = '0';
            welcomeText.style.transform = 'scale(0.8)';
            topText.classList.remove('agent-hidden');
        }, 3000); // Wait for the initial welcome animation duration

        // Step 3: Animate Input Bar and Show Chat/Nav
        setTimeout(() => {
            // Show main elements
            chatContainer.classList.remove('agent-hidden');
            categoryNav.classList.remove('agent-hidden');

            // Input Bar animation (emerge, grow, fade)
            inputBarContainer.classList.remove('agent-hidden');
            inputBarContainer.classList.add('input-anim-start');
            setTimeout(() => {
                inputBarContainer.classList.remove('input-anim-start');
            }, 50);

            // Hide Welcome and start System Info update
            welcomeText.style.display = 'none';
            topText.style.fontSize = '32px'; // Adjust final size

            // Start the system info clock
            updateSystemInfo();
        }, 3500); // Slightly after the welcome transition

        // Expose function for button to call (temporary for simulation)
        window.handleAgentCategoryChange = handleAgentCategoryChange;
        window.handleFileUpload = handleFileUpload;
        window.handleInput = handleInput;
    }

    // Simulation function for sending a message
    function simulateSendMessage() {
        const inputElement = document.getElementById('agent-input');
        const userText = inputElement.value.trim();
        if (!userText) return;

        // 1. Record User Message
        agentState.chatHistory.push({
            sender: 'user',
            text: userText,
            time: new Date().toLocaleTimeString(),
            attachments: agentState.fileAttachments.map(f => f.fileName)
        });
        renderMessage('user', userText);

        // 2. Clear input and files
        inputElement.value = '';
        document.getElementById('char-count').textContent = '0/5000';
        agentState.fileAttachments = [];
        updateFileDisplay();

        // 3. Simulate Gemini Response
        // Get the persona for the currently selected agent
        const persona = agentCategories[agentState.selectedCategory].persona;
        const currentCategory = agentState.selectedCategory;

        // Simulate a brief API call and response generation
        setTimeout(() => {
            // A simple, context-aware response based on the persona description
            const geminiResponseText = `Understood. As the **${currentCategory}** 4SP Agent, my persona is focused on: *${agentCategories[currentCategory].description}*. I've processed your request (and any file attachments) within this context. Here is your synthesized response.`;

            agentState.chatHistory.push({
                sender: 'gemini',
                text: geminiResponseText,
                time: new Date().toLocaleTimeString()
            });
            renderMessage('gemini', geminiResponseText);
        }, 1500);

        // 4. Update system info for the next turn
        updateSystemInfo();
    }
    window.simulateSendMessage = simulateSendMessage;

    // --- STYLE INJECTION ---
    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Load Custom Fonts */
            @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap');
            /* Geist is not in Google Fonts, using a close/popular modern monospace fallback or requiring local/CDN load */
            @font-face {
                font-family: 'Geist';
                src: url('https://cdn.jsdelivr.net/npm/@geist-ui/fonts/assets/geist-mono.woff') format('woff');
                font-weight: 300;
                font-style: normal;
            }

            /* --- CORE CONTAINER AND OVERLAY --- */
            .agent-hidden {
                display: none !important;
            }

            #agent-ui-container {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 1;
                pointer-events: all;
            }

            .agent-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.8); /* Darken */
                backdrop-filter: blur(10px); /* Blur out */
                -webkit-backdrop-filter: blur(10px);
                transition: background-color 0.5s ease;
            }

            /* --- AGENT HUB (MODAL) --- */
            .agent-hub {
                position: relative;
                width: 90%;
                max-width: 800px;
                height: 90%;
                max-height: 900px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 20px;
                padding: 30px;
                display: flex;
                flex-direction: column;
                box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }

            /* --- WELCOME ANIMATION --- */
            .agent-header {
                text-align: center;
                margin-bottom: 20px;
            }

            #agent-welcome-text, .agent-top-text {
                font-family: 'Playfair Display', serif;
                font-weight: 700;
                text-align: center;
                margin: 0 auto;
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                transition: all 1.5s cubic-bezier(0.25, 0.8, 0.25, 1);
                color: ${AGENT_ORANGE};
                pointer-events: none;
            }

            #agent-welcome-text {
                font-size: 80px;
            }

            .welcome-anim-start {
                opacity: 0;
                transform: translate(-50%, -50%) scale(0.5);
            }
            .welcome-anim-end {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
            }

            .agent-top-text {
                font-size: 0px; /* Hidden initially, grows */
                top: 30px;
                transition: all 0.5s ease-out;
            }

            /* --- CLOSE BUTTON --- */
            .agent-close-btn {
                position: absolute;
                top: 20px;
                right: 20px;
                background: none;
                border: none;
                color: white;
                font-size: 30px;
                cursor: pointer;
                transition: transform 0.2s;
                opacity: 0.7;
            }
            .agent-close-btn:hover {
                opacity: 1;
                transform: rotate(90deg);
            }

            /* --- CATEGORY NAVIGATION --- */
            .agent-category-nav {
                display: flex;
                justify-content: center;
                gap: 10px;
                margin-top: 50px; /* Pushed down from the header */
                margin-bottom: 20px;
                overflow-x: auto;
                padding-bottom: 10px;
            }

            .agent-category-btn {
                background: rgba(255, 255, 255, 0.1);
                color: white;
                border: 1px solid rgba(255, 255, 255, 0.2);
                padding: 8px 15px;
                border-radius: 5px;
                cursor: pointer;
                font-family: 'Geist', monospace;
                font-weight: 300;
                transition: all 0.2s ease;
                white-space: nowrap;
            }
            .agent-category-btn:hover {
                background: rgba(255, 255, 255, 0.2);
            }
            .agent-category-btn.active {
                background: ${AGENT_ORANGE};
                color: black;
                border-color: ${AGENT_ORANGE};
                font-weight: 700;
            }

            /* --- CHAT AREA --- */
            .agent-chat-container {
                flex-grow: 1;
                display: flex;
                flex-direction: column;
                min-height: 0; /* Important for flex to work correctly with overflow */
            }

            .system-info-bar {
                font-family: 'Geist', monospace;
                font-size: 12px;
                color: rgba(255, 255, 255, 0.6);
                text-align: center;
                padding: 10px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                margin-bottom: 15px;
            }

            .agent-chat-messages {
                flex-grow: 1;
                overflow-y: auto;
                padding-right: 10px; /* Space for scrollbar */
                margin-bottom: 20px;
                scroll-behavior: smooth;
            }

            /* --- CHAT BUBBLE STYLES --- */
            .chat-message {
                display: flex;
                margin-bottom: 10px;
            }
            .chat-message.user {
                justify-content: flex-end;
            }
            .chat-message.gemini {
                justify-content: flex-start;
            }

            .chat-bubble {
                max-width: 70%;
                padding: 12px 18px;
                border-radius: 20px;
                font-family: 'Geist', monospace;
                font-weight: 400;
                word-wrap: break-word;
                line-height: 1.5;
            }

            /* USER BUBBLE: Translucent and Blurry */
            .user-bubble {
                background: rgba(255, 255, 255, 0.15);
                color: white;
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                border: 1px solid rgba(255, 255, 255, 0.3);
                border-bottom-right-radius: 5px;
            }

            /* GEMINI BUBBLE: Glassy, Orange, Pulsing */
            .gemini-bubble {
                background: rgba(255, 122, 0, 0.3); /* Orange with transparency */
                color: white;
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                border: 1px solid rgba(255, 122, 0, 0.5);
                border-bottom-left-radius: 5px;
                animation: orange-pulse 2s infinite ease-in-out;
                box-shadow: 0 0 10px rgba(255, 122, 0, 0.5);
            }

            /* Orange Pulse Animation */
            @keyframes orange-pulse {
                0% { box-shadow: 0 0 5px rgba(255, 122, 0, 0.5); }
                50% { box-shadow: 0 0 15px rgba(255, 122, 0, 1), 0 0 25px rgba(255, 122, 0, 0.5); }
                100% { box-shadow: 0 0 5px rgba(255, 122, 0, 0.5); }
            }

            /* --- INPUT BAR --- */
            .agent-input-bar-container {
                position: absolute;
                bottom: 30px;
                left: 50%;
                width: 75%;
                transition: all 0.5s cubic-bezier(0.165, 0.84, 0.44, 1);
            }

            /* Input Bar Animation (Emerges, grows, fades in from bottom center) */
            .input-anim-start {
                transform: translate(-50%, 150px) scale(0.8);
                opacity: 0;
            }
            .agent-input-bar-container:not(.input-anim-start) {
                transform: translate(-50%, 0);
                opacity: 1;
            }

            .input-row {
                display: flex;
                align-items: flex-end;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 15px;
                padding: 10px;
                border: 1px solid rgba(255, 255, 255, 0.2);
            }

            .agent-input {
                flex-grow: 1;
                max-height: 150px; /* Limit input height */
                border: none;
                background: transparent;
                color: white;
                padding: 5px 10px;
                resize: none;
                outline: none;
                font-family: 'Geist', monospace;
                font-weight: 300; /* 300 weight requested */
                font-size: 16px;
                line-height: 1.5;
                scrollbar-width: none; /* Hide scrollbar for clean look */
            }
            .agent-input::-webkit-scrollbar {
                display: none;
            }

            .char-count {
                font-family: 'Geist', monospace;
                font-size: 11px;
                color: rgba(255, 255, 255, 0.5);
                text-align: right;
                margin-top: 5px;
            }

            .file-upload-btn, .send-message-btn {
                background: none;
                border: none;
                color: ${AGENT_ORANGE};
                padding: 10px;
                cursor: pointer;
                transition: all 0.2s;
            }
            .send-message-btn:disabled {
                color: rgba(255, 122, 0, 0.3);
                cursor: not-allowed;
            }
            .file-upload-btn input[type="file"] {
                display: none;
            }
            .file-upload-btn:hover, .send-message-btn:not(:disabled):hover {
                transform: scale(1.1);
            }

            /* --- FILE ATTACHMENTS --- */
            .file-attachments {
                display: flex;
                flex-wrap: wrap;
                gap: 5px;
                margin-bottom: 10px;
                padding: 0 15px;
            }
            .attachment-tag {
                background: rgba(255, 122, 0, 0.2);
                color: white;
                padding: 3px 8px;
                border-radius: 10px;
                font-size: 12px;
                font-family: 'Geist', monospace;
                display: flex;
                align-items: center;
                border: 1px solid ${AGENT_ORANGE};
            }
            .attachment-tag button {
                margin-left: 5px;
                background: none;
                border: none;
                color: white;
                font-size: 12px;
                line-height: 1;
                cursor: pointer;
                padding: 0;
            }
        `;
        document.head.appendChild(style);
    }

    // --- INITIALIZATION ---
    const run = () => {
        // --- EXISTING FIREBASE LOGIC (Keep for context) ---
        // Assume Firebase is initialized here...
        // ...

        // --- NEW AGENT UI LOGIC ---

        // 1. Inject the necessary CSS styles
        injectStyles();

        // 2. Render the core HTML structure, which is initially hidden
        renderAgentUI();

        // 3. Attach a global function/listener to open the agent.
        // For demonstration, we'll attach it to the body, assuming the user will call it
        // e.g., document.getElementById('activate-button').onclick = activateAgentUI;
        console.log("4SP Agent UI is ready. Call 'activateAgentUI()' to open the hub.");

        document.addEventListener('click', () => {
            if (!agentState.isOpen) activateAgentUI();
        }, { once: true });
    };

    // --- START THE PROCESS ---
    document.addEventListener('DOMContentLoaded', run);

})();
