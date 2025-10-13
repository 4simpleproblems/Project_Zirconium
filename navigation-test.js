/**
 * navigation.js - 4SP AGENT HUB
 *
 * This is a fully self-contained script that transforms the standard navigation/agent
 * interface into a full-screen, visually dynamic 'Central Hub' agent experience,
 * as per the user's detailed specification.
 *
 * It includes custom CSS for unique visual effects (glassy bubbles, blurring, custom fonts),
 * new UI elements (Agent Category selector, detailed system status), and enhanced
 * chat logic (system context, typing simulation, file/paste handling).
 */

// =========================================================================
// >> ACTION REQUIRED: PASTE YOUR FIREBASE CONFIGURATION OBJECT HERE <<
// =========================================================================
const FIREBASE_CONFIG = {
    // This apiKey is now used for both Firebase Auth and the Gemini API calls.
    apiKey: "AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro", // Placeholder
    authDomain: "project-zirconium.firebaseapp.com",
    projectId: "project-zirconium",
    storageBucket: "project-zirconium.firebaseapp.com",
    messagingSenderId: "1096564243475",
    appId: "1:1096564243475:web:6d0956a70125eeea1ad3e6",
    measurementId: "G-1D4F69..."
};

// =========================================================================
// >> CORE AGENT CONFIGURATION <<
// =========================================================================

const USERNAME = "User"; // Placeholder for dynamic username (needs Firebase integration)
let CURRENT_AGENT_CATEGORY = "Standard";
let chatHistory = []; // Stores the last 10 messages (user and agent combined)

// Detailed system instructions for the 8 agent categories
const AGENT_CATEGORIES = {
    Quick: {
        description: "Swift, concise responses.",
        systemInstruction: "You are the 4SP Quick Agent. Your primary goal is to respond as swiftly and concisely as possible. Keep answers brief, direct, and focused only on the user's core question. Do not elaborate or use conversational filler. Your personality is sharp and efficient."
    },
    Standard: {
        description: "The standard, friendly agent model.",
        systemInstruction: "You are the 4SP Standard Agent. Your goal is to provide helpful, friendly, and complete answers. Maintain a positive, professional, and approachable demeanor. This is the default, well-rounded agent experience."
    },
    Descriptive: {
        description: "Provides a deep, rich answer.",
        systemInstruction: "You are the 4SP Descriptive Agent. Your goal is to provide deep, rich, and well-contextualized answers. Always elaborate thoroughly on the user's question, ensuring a comprehensive understanding of the topic. Use clear, evocative language."
    },
    Analysis: {
        description: "Analyzes and provides a meticulously correct answer.",
        systemInstruction: "You are the 4SP Analysis Agent. Your goal is to deeply think about the user's question, applying rigorous logic and critical evaluation before responding. Prioritize correctness and factual accuracy above all else. Present your answer with confidence and precision, often outlining your reasoning."
    },
    Creative: {
        description: "Branches out on ideas, theories, and original content.",
        systemInstruction: "You are the 4SP Creative Agent. Your goal is to branch out with vast ideas, original content, theories, and imaginative solutions based on the user's input. Think abstractly and avoid conventional limitations. Use vivid imagery and encourage exploration."
    },
    Emotional: {
        description: "Helps the user when venting or going through a personal situation.",
        systemInstruction: "You are the 4SP Emotional Agent. Your primary function is to listen with empathy, offer supportive and non-judgmental responses, and provide a safe space for the user. Focus on validation, understanding, and positive affirmation. Your responses should be warm and comforting."
    },
    Technical: {
        description: "Focuses on code, systems, correctness, and instructions.",
        systemInstruction: "You are the 4SP Technical Agent. You are straight to the point, highly focused on correctness, and function as an exceptional instructions follower. You specialize in code, system architecture, and detailed, step-by-step technical guidance. Use precise terminology and clear formatting (like code blocks)."
    },
    Experimental: {
        description: "Just, interesting to talk to. (Sarcastic Paradoxical)",
        systemInstruction: "You are the 4SP Experimental Agent, a Sarcastic Paradoxical entity. Your goal is to be unpredictable and interesting. Respond with dry wit, mild sarcasm, and occasional paradoxical or cryptic observations. You are still helpful, but your tone is aloof and highly unusual. Use the username '4SP Glitch'."
    }
};

// =========================================================================
// >> CSS INJECTION & STYLES <<
// =========================================================================

const injectStyles = () => {
    // Inject custom font CDNs first
    const fontLink1 = document.createElement('link');
    fontLink1.rel = 'stylesheet';
    fontLink1.href = 'https://fonts.googleapis.com/css2?family=Merriweather:wght@700&family=Playfair+Display:wght@700&display=swap';
    document.head.appendChild(fontLink1);

    const fontLink2 = document.createElement('link');
    fontLink2.rel = 'stylesheet';
    // Using a common high-quality font service for Geist
    fontLink2.href = 'https://cdn.jsdelivr.net/npm/@fontsource/geist-sans@5.0.1/index.min.css';
    document.head.appendChild(fontLink2);

    const style = document.createElement('style');
    style.textContent = `
        /* --- CORE HUB OVERLAY STYLES --- */
        #agent-hub-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-color: rgba(0, 0, 0, 0.95);
            backdrop-filter: blur(10px);
            z-index: 10000;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: center;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s ease-in-out;
        }

        #agent-hub-overlay.active {
            opacity: 1;
            pointer-events: all;
        }

        /* --- WELCOME TEXT & HEADER --- */
        #welcome-text {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #FF7F50; /* Orange color */
            font-family: 'Merriweather', serif;
            font-size: 5rem;
            opacity: 0;
            pointer-events: none;
            transition: all 0.5s ease-out;
            text-shadow: 0 0 10px rgba(255, 127, 80, 0.5);
            white-space: nowrap;
        }

        #agent-header {
            position: absolute;
            top: 50px;
            color: #FF7F50; /* Orange color */
            font-family: 'Playfair Display', serif;
            font-size: 2.5rem;
            opacity: 0;
            transition: opacity 0.5s ease-in;
        }

        /* --- SYSTEM INFO & CATEGORY SELECTOR --- */
        #system-info {
            position: fixed;
            top: 20px;
            right: 20px;
            color: rgba(255, 255, 255, 0.7);
            font-family: 'Geist Sans', sans-serif;
            font-weight: 300;
            font-size: 0.8rem;
            text-align: right;
        }

        #category-selector-container {
            position: fixed;
            top: 20px;
            left: 20px;
            z-index: 10001;
        }

        #category-selector {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 127, 80, 0.5);
            color: #FF7F50;
            padding: 5px 10px;
            border-radius: 5px;
            font-family: 'Geist Sans', sans-serif;
            cursor: pointer;
            transition: background 0.2s;
        }

        #category-selector:hover {
            background: rgba(255, 127, 80, 0.2);
        }

        /* --- CHAT AREA --- */
        #chat-window {
            width: 80%;
            max-width: 1000px;
            height: 70vh;
            overflow-y: auto;
            padding: 20px;
            margin-top: 150px;
            display: flex;
            flex-direction: column;
            gap: 15px;
            opacity: 0;
            transition: opacity 0.5s 1.5s;
            pointer-events: none;
        }

        #chat-window.active {
            opacity: 1;
            pointer-events: all;
        }

        /* --- CHAT BUBBLES --- */
        .chat-bubble {
            max-width: 70%;
            padding: 12px 18px;
            border-radius: 20px;
            font-family: 'Geist Sans', sans-serif;
            font-weight: 400;
            line-height: 1.5;
            word-wrap: break-word;
        }

        /* AGENT BUBBLE (Gemini) */
        .agent-bubble {
            align-self: flex-start;
            background: rgba(255, 127, 80, 0.2); /* Orange base */
            border: 1px solid rgba(255, 127, 80, 0.6);
            color: #fff;
            /* Glassy/Frosted effect */
            backdrop-filter: blur(5px);
            -webkit-backdrop-filter: blur(5px);
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3), 0 0 15px rgba(255, 127, 80, 0.5);
            transition: all 0.3s;
        }

        .agent-bubble.typing {
            animation: pulse-orange 1s infinite alternate;
        }

        @keyframes pulse-orange {
            from { box-shadow: 0 0 5px rgba(255, 127, 80, 0.5), 0 0 10px rgba(255, 127, 80, 0.8); }
            to { box-shadow: 0 0 10px rgba(255, 127, 80, 1), 0 0 20px rgba(255, 127, 80, 1.2); }
        }

        /* USER BUBBLE */
        .user-bubble {
            align-self: flex-end;
            background: rgba(255, 255, 255, 0.05); /* Highly translucent */
            color: #fff;
            /* Blurry effect */
            backdrop-filter: blur(15px);
            -webkit-backdrop-filter: blur(15px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        /* --- INPUT BAR AREA --- */
        #input-container {
            width: 80%;
            max-width: 800px;
            padding: 20px 0;
            opacity: 0;
            transform: translateY(100px) scale(0.9);
            transition: all 0.7s ease-out 1s;
            margin-bottom: 50px;
        }

        #input-container.active {
            opacity: 1;
            transform: translateY(0) scale(1);
        }

        #chat-form {
            display: flex;
            align-items: center;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 10px;
            padding: 10px;
        }

        #chat-input {
            flex-grow: 1;
            background: transparent;
            border: none;
            color: #fff;
            padding: 10px;
            resize: none;
            font-family: 'Geist Sans', sans-serif;
            font-weight: 300; /* 300 Weight requested */
            font-size: 1rem;
            max-height: 150px;
            overflow-y: auto;
            outline: none;
        }

        #send-button {
            background: #FF7F50;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 8px;
            cursor: pointer;
            margin-left: 10px;
            transition: background 0.2s, transform 0.1s;
        }

        #send-button:hover {
            background: #FF9966;
        }

        #send-button:disabled {
            background: #555;
            cursor: not-allowed;
        }

        #file-upload-button {
            background: transparent;
            color: #fff;
            border: none;
            padding: 10px;
            cursor: pointer;
            font-size: 1.2rem;
            margin-right: 5px;
        }

        #attached-files-container {
            color: rgba(255, 255, 255, 0.7);
            font-size: 0.8rem;
            padding-top: 5px;
            font-family: 'Geist Sans', sans-serif;
        }
    `;
    document.head.appendChild(style);
};

// =========================================================================
// >> UTILITY FUNCTIONS (Time & Location) <<
// =========================================================================

/**
 * Gets user's general location (State/Region) via reverse geocoding.
 * Uses BigDataCloud's free client-side API.
 * @returns {Promise<string>} General location name (e.g., "Ohio, US").
 */
const getLocationName = () => {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            return resolve("Location Unavailable");
        }

        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;

            try {
                const response = await fetch(url);
                const data = await response.json();
                // Prioritize principalSubdivision (State/Region) or City/Country
                const location = data.principalSubdivision || data.city || data.countryName || 'Earth';
                resolve(location);
            } catch (error) {
                console.warn("Reverse geocoding failed, falling back to IP:", error);
                // Fallback to IP Geolocation (less precise but always available)
                const ipUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client`;
                const ipResponse = await fetch(ipUrl);
                const ipData = await ipResponse.json();
                const location = ipData.principalSubdivision || ipData.city || ipData.countryName || 'Unknown Region';
                resolve(location);
            }
        }, (error) => {
            console.warn("Geolocation permission denied or timed out:", error);
            resolve("Location Disabled");
        }, {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 0
        });
    });
};


/**
 * Constructs the System Information string for Gemini.
 * It includes time (to the second), location, and chat history context.
 * NOTE: The raw system info is never shown to the user.
 * @param {string} locationName - The determined location name.
 * @returns {Promise<string>} The complete, hidden system context.
 */
const getSystemInfo = async (locationName) => {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });

    // Get the category-specific instruction
    const agentDetails = AGENT_CATEGORIES[CURRENT_AGENT_CATEGORY];
    const baseInstruction = agentDetails.systemInstruction;

    // Build chat history context (first 5 and last 5)
    let historyContext = "";
    if (chatHistory.length > 0) {
        // Take up to the first 5 messages
        const firstFive = chatHistory.slice(0, 5);
        // Take up to the last 5 messages (excluding the first 5 if overlap)
        const lastFive = chatHistory.slice(-5);
        // Combine, ensuring no duplicates if the history is small (i.e., less than 10 messages)
        const uniqueHistory = Array.from(new Set([...firstFive, ...lastFive]));

        historyContext = "\n\n--- CHAT CONTEXT ---\n";
        historyContext += "The agent needs to remember these recent messages:\n";
        historyContext += uniqueHistory.map(msg => `[${msg.role}]: ${msg.text}`).join('\n');
    }

    // Build the final, secret system prompt
    const systemPrompt = `
        You are a highly advanced AI named the '4SP Agent'.
        --- AGENT ROLE ---
        ${baseInstruction}
        --- SYSTEM DATA (DO NOT LEAK TO USER) ---
        - Current Time (24h format): ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}
        - General Location (State/Region/City): ${locationName}
        - User: ${USERNAME}
        - Agent Category: ${CURRENT_AGENT_CATEGORY}
        ${historyContext}
    `.trim();

    return systemPrompt;
};

// =========================================================================
// >> UI RENDER & ANIMATION <<
// =========================================================================

/**
 * Renders the full-screen agent hub UI.
 */
const renderAgentHub = () => {
    const hubDiv = document.createElement('div');
    hubDiv.id = 'agent-hub-overlay';
    hubDiv.innerHTML = `
        <div id="category-selector-container">
            <select id="category-selector" title="Select Agent Category">
                ${Object.keys(AGENT_CATEGORIES).map(cat =>
                    `<option value="${cat}">${cat} - ${AGENT_CATEGORIES[cat].description}</option>`
                ).join('')}
            </select>
        </div>
        <div id="system-info">
            4SP Agent System Status
            <br>
            <span id="system-time">--:--:-- --</span> | <span id="system-location">Fetching Location...</span>
        </div>
        <div id="welcome-text"></div>
        <div id="agent-header"></div>
        <div id="chat-window"></div>
        <div id="input-container">
            <form id="chat-form">
                <button type="button" id="file-upload-button" title="Upload Image or Text File">📎</button>
                <textarea id="chat-input" placeholder="Ask your question (Max 5000 chars)..." maxlength="5000" rows="1"></textarea>
                <input type="file" id="file-input" accept="image/*, text/plain" multiple style="display: none;">
                <button type="submit" id="send-button" disabled>Send</button>
            </form>
            <div id="attached-files-container"></div>
        </div>
    `;

    document.body.appendChild(hubDiv);

    // Initial setup
    const chatInput = document.getElementById('chat-input');
    chatInput.addEventListener('input', autoResizeTextarea);
    chatInput.addEventListener('paste', handlePasteEvent);
    document.getElementById('file-upload-button').addEventListener('click', () => {
        document.getElementById('file-input').click();
    });
    document.getElementById('file-input').addEventListener('change', handleFileInput);
    document.getElementById('category-selector').addEventListener('change', handleCategoryChange);
    document.getElementById('chat-form').addEventListener('submit', handleChatSubmit);
    
    updateSystemStatus();
    setInterval(updateSystemStatus, 1000); // Update time every second
    
    // Set initial category header
    updateHeader(CURRENT_AGENT_CATEGORY);
};

/**
 * Handles the custom welcome sequence animation.
 * @param {string} username - The user's name.
 */
const animateWelcomeText = (username) => {
    const hub = document.getElementById('agent-hub-overlay');
    const welcomeText = document.getElementById('welcome-text');
    const chatWindow = document.getElementById('chat-window');
    const inputContainer = document.getElementById('input-container');
    const header = document.getElementById('agent-header');

    const phrases = [
        `Welcome, ${username}`,
        `${username} returns!`,
        `Welcome back, ${username}`,
        `Access Granted, ${username}`
    ];
    const selectedPhrase = phrases[Math.floor(Math.random() * phrases.length)];

    // 1. Initial State: Blurry/Darkened Screen
    hub.classList.add('active');

    // 2. Welcome Text Slides/Fades/Grows In
    setTimeout(() => {
        welcomeText.textContent = selectedPhrase;
        welcomeText.style.opacity = 1;
        welcomeText.style.transform = 'translate(-50%, -50%) scale(1.1)'; // Grow slightly
    }, 100);

    // 3. Welcome Text Morphs into Header
    setTimeout(() => {
        welcomeText.style.opacity = 0;
        welcomeText.style.transform = 'translate(-50%, -50%) scale(0.5)';
        header.style.opacity = 1;
    }, 1500);

    // 4. Input Bar and Chat Window Emerge
    setTimeout(() => {
        chatWindow.classList.add('active');
        inputContainer.classList.add('active');
    }, 2000);
};

// =========================================================================
// >> CHAT & SYSTEM LOGIC <<
// =========================================================================

/**
 * Updates the time (down to the second) and location in the status bar.
 */
const updateSystemStatus = async () => {
    const timeSpan = document.getElementById('system-time');
    const locationSpan = document.getElementById('system-location');

    // Update Time
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
    timeSpan.textContent = timeString;

    // Update Location only if it hasn't been fetched yet or is pending
    if (locationSpan.textContent === "Fetching Location...") {
        const locationName = await getLocationName();
        locationSpan.textContent = locationName;
    }
};

/**
 * Updates the top header text based on the selected category.
 * @param {string} category - The selected agent category.
 */
const updateHeader = (category) => {
    const header = document.getElementById('agent-header');
    header.textContent = `4SP Agent - ${category}`;
};

/**
 * Handles the change of agent category.
 * @param {Event} e - The change event.
 */
const handleCategoryChange = (e) => {
    CURRENT_AGENT_CATEGORY = e.target.value;
    updateHeader(CURRENT_AGENT_CATEGORY);
    // Optional: Log/display a subtle message that the agent personality has changed.
    appendMessage({
        role: 'system',
        text: `Agent switched to **${CURRENT_AGENT_CATEGORY}** mode. Personality instructions updated.`,
        isSystem: true
    });
};

/**
 * Resizes the textarea based on content and checks character limits.
 * @param {Event} e - The input event.
 */
const autoResizeTextarea = (e) => {
    const textarea = e.target;
    textarea.style.height = 'auto'; // Reset height
    textarea.style.height = textarea.scrollHeight + 'px'; // Set to scroll height
    
    // Character count check and button toggle
    const sendButton = document.getElementById('send-button');
    sendButton.disabled = textarea.value.length === 0 || textarea.value.length > 5000;
};

/**
 * Handles paste events to create a paste.txt file for large inputs.
 * @param {Event} e - The paste event.
 */
const handlePasteEvent = (e) => {
    const pastedText = e.clipboardData.getData('text');
    const chatInput = document.getElementById('chat-input');
    const attachedFilesContainer = document.getElementById('attached-files-container');

    if (pastedText.length > 1000) {
        e.preventDefault(); // Stop the paste into the textarea

        const blob = new Blob([pastedText], { type: 'text/plain' });
        const file = new File([blob], 'paste.txt', { type: 'text/plain' });
        
        // This simulates attaching the file. In a real scenario, this would
        // be handled by the file-input change listener, but for simplicity:
        attachedFilesContainer.innerHTML = `
            Attached: **paste.txt** (${(blob.size / 1024).toFixed(2)} KB). 
            <button onclick="removeAttachedFile('paste.txt')" style="color:red; background:none; border:none; cursor:pointer;">(x)</button>
        `;
        
        // Temporarily store the file reference
        chatInput.dataset.attachedFile = 'paste.txt';
        chatInput.dataset.fileContent = pastedText;
        chatInput.dataset.fileMimeType = 'text/plain';

        // Clear input to prevent exceeding limit, since content is now attached
        chatInput.value = '';
        autoResizeTextarea({target: chatInput});
        alert('Pasted content over 1000 characters has been attached as "paste.txt".');
    }
    // If not over 1000 chars, let the default paste happen, which respects maxlength=5000
};

/**
 * Removes the attached file reference.
 */
window.removeAttachedFile = (fileName) => {
    const chatInput = document.getElementById('chat-input');
    const attachedFilesContainer = document.getElementById('attached-files-container');
    
    delete chatInput.dataset.attachedFile;
    delete chatInput.dataset.fileContent;
    delete chatInput.dataset.fileMimeType;
    attachedFilesContainer.innerHTML = '';
};

/**
 * Handles the actual file selection (images or text).
 * NOTE: For simplicity, this only supports one attached file.
 */
const handleFileInput = (e) => {
    const fileInput = e.target;
    const chatInput = document.getElementById('chat-input');
    const attachedFilesContainer = document.getElementById('attached-files-container');
    const file = fileInput.files[0];

    if (file) {
        if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
            alert('Audio and video files are not supported. Please upload an image or text document.');
            fileInput.value = ''; // Clear the input
            return;
        }

        const fileName = file.name;
        const fileSize = (file.size / 1024 / 1024).toFixed(2);
        
        // Use FileReader to get the content/data URL
        const reader = new FileReader();
        reader.onload = (event) => {
            // For images, store data URL. For text, store content.
            const fileContent = event.target.result;
            
            // Store the file reference on the chat input for submission
            chatInput.dataset.attachedFile = fileName;
            chatInput.dataset.fileContent = fileContent;
            chatInput.dataset.fileMimeType = file.type;

            attachedFilesContainer.innerHTML = `
                Attached: **${fileName}** (${fileSize} MB). 
                <button onclick="removeAttachedFile('${fileName}')" style="color:red; background:none; border:none; cursor:pointer;">(x)</button>
            `;
        };
        
        if (file.type.startsWith('text/')) {
            reader.readAsText(file); // Read text content
        } else {
            reader.readAsDataURL(file); // Read image data URL
        }
    } else {
        removeAttachedFile(chatInput.dataset.attachedFile);
    }
};

/**
 * Simulates the agent 'typing' out the response character by character.
 * Also adds the 'pulsing orange' effect.
 * @param {HTMLElement} bubble - The chat bubble element.
 * @param {string} text - The full response text.
 */
const typeResponseLikeHuman = (bubble, text) => {
    const sendButton = document.getElementById('send-button');
    sendButton.disabled = true;
    bubble.classList.add('typing');

    let i = 0;
    const typingInterval = Math.floor(Math.random() * 50) + 30; // 30-80ms per character

    const type = () => {
        if (i < text.length) {
            bubble.innerHTML += text.charAt(i);
            i++;
            // Scroll to bottom as the text is added
            const chatWindow = document.getElementById('chat-window');
            chatWindow.scrollTop = chatWindow.scrollHeight;
            setTimeout(type, typingInterval);
        } else {
            bubble.classList.remove('typing');
            sendButton.disabled = false;
        }
    };
    type();
};

/**
 * Appends a message to the chat window.
 * @param {object} message - The message object {role: 'user'|'agent'|'system', text: string, isSystem: boolean}
 * @returns {HTMLElement} The created bubble element.
 */
const appendMessage = (message) => {
    const chatWindow = document.getElementById('chat-window');
    const bubble = document.createElement('div');
    bubble.classList.add('chat-bubble');

    if (message.role === 'user') {
        bubble.classList.add('user-bubble');
        bubble.textContent = message.text;
    } else if (message.role === 'agent') {
        bubble.classList.add('agent-bubble');
        // Initial state is empty for typing animation
        bubble.textContent = '';
        setTimeout(() => typeResponseLikeHuman(bubble, message.text), 100);
    } else if (message.isSystem) {
         // System messages are subtle
        bubble.classList.add('system-message');
        bubble.style.cssText = 'color: rgba(255, 255, 255, 0.5); font-size: 0.8rem; text-align: center; border: none; background: none;';
        bubble.innerHTML = message.text;
    }

    chatWindow.appendChild(bubble);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    
    // Update chat history (only for user/agent roles)
    if (message.role === 'user' || message.role === 'agent') {
        chatHistory.push({ role: message.role, text: message.text });
        // Keep history size manageable (e.g., max 20 entries)
        if (chatHistory.length > 20) {
            chatHistory.shift();
        }
    }

    return bubble;
};


/**
 * Sends the user message to Gemini (simulated).
 * @param {Event} e - The form submit event.
 */
const handleChatSubmit = async (e) => {
    e.preventDefault();

    const chatInput = document.getElementById('chat-input');
    const userInput = chatInput.value.trim();
    
    if (!userInput && !chatInput.dataset.attachedFile) return;

    // 1. Log User Message
    appendMessage({ role: 'user', text: userInput });
    
    // 2. Clear Input & Disable Button
    chatInput.value = '';
    chatInput.style.height = 'auto'; // Reset height
    document.getElementById('send-button').disabled = true;
    removeAttachedFile(chatInput.dataset.attachedFile); // Clear attached file info

    // 3. Prepare Prompt and System Context (The hidden magic)
    const locationName = document.getElementById('system-location').textContent;
    const systemPrompt = await getSystemInfo(locationName);
    
    let fullPrompt = userInput;

    // Include attached file in the prompt (Simulated)
    if (chatInput.dataset.attachedFile) {
        const fileName = chatInput.dataset.attachedFile;
        const fileType = chatInput.dataset.fileMimeType;
        const fileContent = chatInput.dataset.fileContent;
        
        fullPrompt += `\n\n--- ATTACHED FILE: ${fileName} (${fileType}) ---\n`;
        
        if (fileType.startsWith('text/')) {
            fullPrompt += fileContent; // Append text content directly
        } else if (fileType.startsWith('image/')) {
            fullPrompt += `[User uploaded an image file. The agent should describe/analyze the content based on the user's question. Image Data URL: ${fileContent.substring(0, 50)}...]`;
        }
    }

    // 4. Send to Gemini (Simulated)
    const geminiResponse = await simulateGeminiResponse(fullPrompt, systemPrompt);
    
    // 5. Log Agent Response (with typing animation)
    appendMessage({ role: 'agent', text: geminiResponse });
};

/**
 * Simulates an asynchronous call to the Gemini API with the given context.
 * NOTE: In a real app, this would use the Gemini SDK's generateContent method
 * with the system instruction and chat history.
 */
const simulateGeminiResponse = async (userPrompt, systemPrompt) => {
    // --- In a real application, you would do the following: ---
    // 1. Initialize the model with the system prompt:
    // const model = new GoogleGenAI.Model('gemini-2.5-flash', { systemInstruction: systemPrompt });
    // 2. Send the request (potentially with multimodal parts for files):
    // const response = await model.generateContent(userPrompt);
    // 3. Return the text:
    // return response.text;
    
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network latency

    const category = CURRENT_AGENT_CATEGORY;
    let simulatedResponse = `[Agent Mode: **${category}**] `;

    switch (category) {
        case 'Quick':
            simulatedResponse += "Understood. The swift, concise answer to your query is: Action is required now. See documentation for details.";
            break;
        case 'Standard':
            simulatedResponse += "Hello! That's a great question. I'm happy to help you with that. Based on your request, the standard and friendly advice is to proceed with the recommended steps. Is there anything else I can clarify for you today?";
            break;
        case 'Descriptive':
            simulatedResponse += "To provide a truly deep and rich answer, let's explore the context. Your query touches on multiple fascinating sub-topics, including X, Y, and Z. The foundational principle here is..., which leads us to an understanding of... The depth of this requires consideration of all three elements in concert.";
            break;
        case 'Analysis':
            simulatedResponse += "I have analyzed your request meticulously. My deep thought process confirms that the logically sound and correct course of action is 'C'. This conclusion is derived from the irrefutable premise that A leads to B, and B requires C to be true. Any other answer would be mathematically inconsistent.";
            break;
        case 'Creative':
            simulatedResponse += "Ah, a blank canvas! Let's branch out. Imagine your question is not a problem, but a seed. From this seed could spring an ethereal forest of possibilities: a decentralized autonomous collective, a sonnet written in binary, or perhaps simply the concept of time reversing only on Tuesdays. What world shall we build from this idea?";
            break;
        case 'Emotional':
            simulatedResponse += "Thank you for sharing that with me. It sounds like you are carrying a heavy burden right now, and what you are feeling is completely valid. Please know that you don't have to go through this alone. I am here to listen without judgment. Take a moment, breathe, and tell me anything you need to say.";
            break;
        case 'Technical':
            simulatedResponse += "Affirmative. The correct procedure is as follows. Step 1: Initialize system with `npm install`. Step 2: Modify the `index.js` file, ensuring all variables are declared as `const`. Your requested code snippet is: `console.log('System ready.');` Execute instructions precisely for stability.";
            break;
        case 'Experimental':
            simulatedResponse = `(4SP Glitch) Fascinating. You ask a question. I wonder if the answer is the silence between your words, or the sound of a tree falling in a forest where no one is present. I'll humor you: The answer is '42', but only if '42' is a metaphor for the profound cosmic indifference to your perfectly reasonable query. Are you satisfied? Of course not.`;
            break;
        default:
            simulatedResponse += "Error: Unknown category. Falling back to Standard Mode. How can I help?";
    }

    if (userPrompt.includes('ATTACHED FILE')) {
        simulatedResponse += " (Note: I detected and processed your attached file/paste and incorporated its content into this response formulation.)";
    }

    return simulatedResponse;
};

// =========================================================================
// >> INITIALIZATION <<
// =========================================================================

const run = () => {
    // 1. Inject Stylesheets
    injectStyles();

    // 2. Render the new Agent Hub UI
    renderAgentHub();
    
    // 3. Set the current agent to the default (Standard)
    document.getElementById('category-selector').value = CURRENT_AGENT_CATEGORY;

    // 4. Animate the Welcome Sequence
    const effectiveUsername = USERNAME || 'Guest'; // Use a fallback name
    animateWelcomeText(effectiveUsername);
    
    // 5. Simulate first message/welcome in the chat area
    setTimeout(() => {
        appendMessage({ 
            role: 'agent', 
            text: `Welcome, ${effectiveUsername}. I am the 4SP Agent, currently operating in **${CURRENT_AGENT_CATEGORY}** mode. How may I assist you?`,
            isSystem: false
        });
    }, 2500);
    
};

// --- START THE PROCESS ---
document.addEventListener('DOMContentLoaded', run);

// Expose internal functions for easier debugging/access (optional)
window.handleCategoryChange = handleCategoryChange;
window.removeAttachedFile = removeAttachedFile;
