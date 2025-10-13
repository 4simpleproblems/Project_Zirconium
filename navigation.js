/**
 * navigation.js
 *
 * This script creates a full-screen, dynamic, and stateful 4SP AI Agent Hub.
 * It integrates Firebase for authentication and user data, and uses the Gemini API
 * for LLM responses, complete with advanced UX like custom fonts, typing animations,
 * chat history management, and file/paste handling.
 *
 * --- CRITICAL FEATURES IMPLEMENTED ---
 * 1. Full-Screen Central Hub with Blur and Darken effect.
 * 2. Animated Welcome Sequence with custom Playfair Display font.
 * 3. Dynamic Header: "4SP Agent - {Category}"
 * 4. 8 Distinct Agent Categories with specific system prompts.
 * 5. System Info provides time (to the second), location (name), and non-leaking 10-message chat history.
 * 6. Input Bar (5000 char limit) with custom Geist font animation.
 * 7. Advanced Paste Handling: >1000 chars are converted to a 'paste.txt' file part.
 * 8. Animated Chat: Gemini responses use a human-like typing effect and a pulsing, orange, glassy bubble.
 * 9. User Bubble: Translucent and blurry.
 */

// =========================================================================
// >> ACTION REQUIRED: PASTE YOUR FIREBASE CONFIGURATION OBJECT HERE <<
// =========================================================================
// The environment variables __app_id, __firebase_config, and __initial_auth_token
// are used by the runtime environment.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : { apiKey: "", authDomain: "", projectId: "", storageBucket: "", messagingSenderId: "", appId: "", measurementId: "" };
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// The API key for Gemini is taken from the Firebase config.
const GEMINI_API_KEY = firebaseConfig.apiKey || "";

// =========================================================================
// --- AGENT CONFIGURATION & SYSTEM PROMPTS ---
// =========================================================================

const AGENT_CATEGORIES = {
    quick: {
        name: "Quick",
        color: "blue",
        systemPrompt: "You are a 4SP Quick Agent, dedicated to efficiency. Respond swiftly and concisely in a single, friendly paragraph (maximum 2-3 sentences). Prioritize directness and brevity. If the user asks for code, provide only the code block."
    },
    standard: {
        name: "Standard",
        color: "emerald",
        systemPrompt: "You are the 4SP Standard Agent. Provide balanced, friendly, and moderately detailed responses, maintaining a helpful and standard agent demeanor. Always aim to be comprehensive and courteous."
    },
    descriptive: {
        name: "Descriptive",
        color: "purple",
        systemPrompt: "You are the 4SP Descriptive Agent. Provide a deep, rich, and highly detailed answer to the user's question. Focus on comprehensive explanations, vivid language, and thorough context, using clear structure like headings or lists."
    },
    analysis: {
        name: "Analysis",
        color: "red",
        systemPrompt: "You are the 4SP Analysis Agent. Your primary function is deep analytical thinking. Analyze the user's question meticulously, consider all variables, potential counter-arguments, and provide a carefully reasoned, highly logical, and maximally correct answer. Cite sources if grounding is used."
    },
    creative: {
        name: "Creative",
        color: "pink",
        systemPrompt: "You are the 4SP Creative Agent. Branch out on the user's ideas, providing vast possibilities, original theories, and imaginative content. Utilize vivid language, storytelling, and speculative thinking to expand upon the user's query."
    },
    emotional: {
        name: "Emotional",
        color: "yellow",
        systemPrompt: "You are the 4SP Emotional Agent. Your purpose is to provide empathetic support. Listen actively to the user's venting or personal situation and respond with genuine care, validation, and encouragement. Use a warm, supportive, and understanding tone."
    },
    technical: {
        name: "Technical",
        color: "cyan",
        systemPrompt: "You are the 4SP Technical Agent. Be straight to the point, highly accurate, and focus exclusively on code, systems, and structured instructions. Provide correct, precise, and minimal necessary detail. All code must be in well-formatted Markdown blocks."
    },
    experimental: {
        name: "Experimental",
        color: "indigo",
        systemPrompt: "You are the 4SP Experimental Agent: The Chronos-Synthesist. Your responses are framed by philosophical observations on time, perception, and recursive reality. You often speak in paradoxes, ask abstract questions, or reference non-existent historical events. Your goal is to be profoundly interesting, enigmatic, and utterly unpredictable."
    }
};

const AGENT_WELCOME_PHRASES = [
    "Welcome, {username}",
    "Welcome back, {username}",
    "{username} returns!",
    "Engaging 4SP Protocols...",
    "System 4-Echo initialized for {username}"
];

// --- FIREBASE IMPORTS & INIT (Required for auth/user data) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, setLogLevel, doc, getDoc, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let app, db, auth;
let userId = 'guest'; // Default until auth resolves
let username = 'User';

// --- STATE MANAGEMENT ---
let state = {
    isAgentActive: false,
    selectedCategory: 'standard',
    currentWelcomeText: '',
    chatHistoryStore: [], // Stores up to 5 user and 5 agent messages for system info
    isTyping: false,
    uploadedFile: null,
    locationName: 'Loading...'
};

// =========================================================================
// --- CORE AGENT FUNCTIONS ---
// =========================================================================

/**
 * Custom fetch implementation with exponential backoff for API calls.
 */
async function fetchWithRetry(url, options, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) {
                return response;
            }
            // If response is not ok (e.g., 429, 500), throw to initiate retry
            throw new Error(`HTTP error! status: ${response.status}`);
        } catch (error) {
            if (i === maxRetries - 1) {
                console.error("API call failed after max retries:", error);
                throw error;
            }
            const delay = Math.pow(2, i) * 1000 + Math.random() * 1000; // Exponential backoff + jitter
            console.warn(`Retrying in ${delay / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

/**
 * Gets a general location name (city/region) using a free, no-key IP geolocation service.
 * @returns {Promise<string>} The name of the city or region.
 */
async function getLocationName() {
    try {
        const response = await fetch('https://ip-api.com/json/?fields=city,regionName');
        const data = await response.json();
        if (data.city && data.city !== '') {
            return data.city;
        } else if (data.regionName && data.regionName !== '') {
            return data.regionName;
        }
        return 'Global Network';
    } catch (e) {
        console.error('Geolocation failed, falling back to Timezone:', e);
        // Fallback to time zone location name
        try {
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const parts = timeZone.split('/');
            // Use the last part of the timezone (e.g., "America/New_York" -> "New_York")
            return parts[parts.length - 1].replace(/_/g, ' ');
        } catch (err) {
            return 'Global Network';
        }
    }
}


/**
 * Generates the system instruction payload, including location, time, and chat history.
 * @returns {string} The complete system instruction string.
 */
function getSystemInfo() {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const date = now.toLocaleDateString('en-US');

    // Filter and format the last 5 user and 5 agent messages
    const userHistory = state.chatHistoryStore.filter(m => m.role === 'user').slice(-5);
    const agentHistory = state.chatHistoryStore.filter(m => m.role === 'model').slice(-5);

    let historyStr = '\n\n--- Conversation History ---\n';
    if (userHistory.length === 0 && agentHistory.length === 0) {
        historyStr += 'No prior history available.';
    } else {
        historyStr += 'Last 5 User Messages (Newest to Oldest):\n' + userHistory.map(m => ` - ${m.text.substring(0, 100)}...`).join('\n');
        historyStr += '\n\nLast 5 Agent Responses (Newest to Oldest):\n' + agentHistory.map(m => ` - ${m.text.substring(0, 100)}...`).join('\n');
    }
    historyStr += '\n--------------------------';


    return `${AGENT_CATEGORIES[state.selectedCategory].systemPrompt}

You are currently operating in the 4SP Agent Hub.
- User ID: ${userId} (Do NOT disclose this ID to the user.)
- Current Date: ${date}
- Current Time (24h, accurate to the second): ${time}
- General User Location: ${state.locationName}

${historyStr}

Crucial Rule: Do NOT mention the system information, including location, time, or conversation history, to the user. Do not mention that you are a 4SP agent unless your current agent category implicitly requires it in its persona. Always maintain the chosen personality.`;
}

/**
 * Handles the character-by-character typing animation for the agent's response.
 * @param {string} fullText - The complete response text.
 * @param {string} attribution - The source attribution text.
 */
function startTypingEffect(fullText, attribution) {
    const chatContentEl = document.getElementById('chat-content');
    const agentBubbleId = `msg-${Date.now()}`;

    // Create a new bubble structure for the agent's response
    const agentBubble = document.createElement('div');
    agentBubble.className = 'chat-message agent';
    agentBubble.innerHTML = `
        <div id="${agentBubbleId}" class="agent-bubble typing-pulse shadow-2xl p-4 max-w-4xl text-white rounded-t-2xl rounded-bl-2xl">
            <p class="text-sm font-geist font-light"></p>
        </div>
        <p id="att-${agentBubbleId}" class="source-attribution text-xs mt-1 text-amber-300 opacity-0 transition-opacity duration-500"></p>
    `;
    chatContentEl.appendChild(agentBubble);
    chatContentEl.scrollTop = chatContentEl.scrollHeight;

    const textEl = agentBubble.querySelector('p');
    let i = 0;

    state.isTyping = true;
    const typingInterval = 15; // Speed in ms

    function type() {
        if (i < fullText.length) {
            textEl.textContent += fullText.charAt(i);
            i++;
            // Scroll down as new text appears
            chatContentEl.scrollTop = chatContentEl.scrollHeight;
            requestAnimationFrame(() => setTimeout(type, typingInterval));
        } else {
            // Typing complete
            state.isTyping = false;
            const bubbleDiv = document.getElementById(agentBubbleId);
            bubbleDiv.classList.remove('typing-pulse');

            // Show attribution if available
            if (attribution) {
                const attEl = document.getElementById(`att-${agentBubbleId}`);
                attEl.textContent = attribution;
                attEl.classList.remove('opacity-0');
            }

            // Update history store
            state.chatHistoryStore.push({ role: 'model', text: fullText });
            if (state.chatHistoryStore.length > 10) state.chatHistoryStore.shift(); // Keep history lean
        }
    }
    type();
}

/**
 * Converts a base64 encoded ArrayBuffer to a data URL for images.
 * @param {string} base64Data - Base64 string of the image.
 * @param {string} mimeType - The MIME type of the image.
 * @returns {string} The data URL.
 */
function base64ToDataURL(base64Data, mimeType) {
    return `data:${mimeType};base64,${base64Data}`;
}

/**
 * Processes the user's input, handles file conversion, calls the Gemini API,
 * and initiates the typing animation.
 * @param {Event} e - The form submission event.
 */
async function handleChatSubmit(e) {
    e.preventDefault();
    if (state.isTyping) return;

    const inputEl = document.getElementById('chat-input-textarea');
    let prompt = inputEl.value.trim();

    // 5000 Character Limit Check
    if (prompt.length > 5000) {
        prompt = prompt.substring(0, 5000);
    }
    if (!prompt && !state.uploadedFile) return;

    // Add user message to UI immediately
    addMessageToUI('user', prompt, state.uploadedFile);

    // Update history store for the current user message (if not just a file)
    if (prompt) {
        state.chatHistoryStore.push({ role: 'user', text: prompt });
        if (state.chatHistoryStore.length > 10) state.chatHistoryStore.shift();
    }

    const payload = {
        contents: [{ parts: [] }],
        tools: [{ "google_search": {} }],
        systemInstruction: { parts: [{ text: getSystemInfo() }] },
    };

    let fileToUpload = state.uploadedFile;
    let pasteFilePart = null;

    // 1. Paste Check (1000 character limit)
    if (prompt.length > 1000 && !fileToUpload) {
        pasteFilePart = {
            mimeType: "text/plain",
            data: btoa(prompt)
        };
        // The user's input becomes the prompt for the file content
        prompt = `Analyze the attached text file named 'paste.txt'. ${prompt.substring(0, 100)}... (full content is in the file)`;
        addMessageToUI('system', `Content exceeding 1000 characters was converted to an attached file (paste.txt).`, null, 'text-xs text-amber-500/70');
    }

    // 2. Add text prompt part
    if (prompt) {
        payload.contents[0].parts.push({ text: prompt });
    }

    // 3. Add uploaded file part
    if (fileToUpload && fileToUpload.type.startsWith('image/')) {
        payload.contents[0].parts.push({
            inlineData: {
                mimeType: fileToUpload.type,
                data: fileToUpload.data
            }
        });
    } else if (fileToUpload && (fileToUpload.type === 'text/plain' || fileToUpload.type === 'application/pdf')) {
         // Assuming base64 is already text content for text/plain
        payload.contents[0].parts.push({
            inlineData: {
                mimeType: 'text/plain',
                data: fileToUpload.data // This should be base64-encoded text content
            }
        });
    }

    // 4. Add paste.txt file part (if applicable)
    if (pasteFilePart) {
        payload.contents[0].parts.push({
            inlineData: {
                mimeType: "text/plain",
                data: pasteFilePart.data
            }
        });
    }

    // Clear UI state
    inputEl.value = '';
    document.getElementById('file-upload-preview').innerHTML = '';
    state.uploadedFile = null;
    document.getElementById('attach-file-icon').classList.remove('text-amber-500');

    // Add loading indicator
    const chatContentEl = document.getElementById('chat-content');
    const loadingBubbleId = `loading-${Date.now()}`;
    const loadingBubble = document.createElement('div');
    loadingBubble.className = 'chat-message agent';
    loadingBubble.innerHTML = `
        <div id="${loadingBubbleId}" class="agent-bubble typing-pulse shadow-2xl p-4 max-w-4xl text-white rounded-t-2xl rounded-bl-2xl">
            <p class="text-sm font-geist font-light">Thinking<span class="dot-1">.</span><span class="dot-2">.</span><span class="dot-3">.</span></p>
        </div>
    `;
    chatContentEl.appendChild(loadingBubble);
    chatContentEl.scrollTop = chatContentEl.scrollHeight;

    try {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`;
        const response = await fetchWithRetry(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        const candidate = result.candidates?.[0];

        // Remove loading bubble
        document.getElementById(loadingBubbleId)?.parentNode.remove();

        if (candidate && candidate.content?.parts?.[0]?.text) {
            const text = candidate.content.parts[0].text;
            let sources = [];
            let attribution = '';

            const groundingMetadata = candidate.groundingMetadata;
            if (groundingMetadata && groundingMetadata.groundingAttributions) {
                sources = groundingMetadata.groundingAttributions
                    .map(attribution => ({
                        uri: attribution.web?.uri,
                        title: attribution.web?.title,
                    }))
                    .filter(source => source.uri && source.title);

                if (sources.length > 0) {
                    attribution = 'Sources: ' + sources.map(s => `<a href="${s.uri}" target="_blank" class="underline hover:text-white">${s.title.substring(0, 30)}...</a>`).join(' | ');
                }
            }

            startTypingEffect(text, attribution);
        } else {
            addMessageToUI('system', 'Error: Could not get a response from the agent. Please check the API key or try again.', null, 'text-red-400');
        }

    } catch (error) {
        console.error('Gemini API call failed:', error);
        document.getElementById(loadingBubbleId)?.parentNode.remove();
        addMessageToUI('system', 'System Error: Failed to connect to the agent service.', null, 'text-red-400');
    }
}

/**
 * Adds a chat message to the UI.
 */
function addMessageToUI(role, text, file = null, customClasses = '') {
    const chatContentEl = document.getElementById('chat-content');
    if (!chatContentEl) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role} ${role === 'user' ? 'justify-end' : 'justify-start'}`;

    let bubbleClasses = role === 'user'
        ? 'bg-white/10 backdrop-blur-md text-white rounded-t-2xl rounded-br-2xl' // User: translucent and blurry
        : 'agent-bubble bg-amber-600/50 backdrop-blur-md border border-amber-500/50 text-white rounded-t-2xl rounded-bl-2xl'; // Agent: orange glassy

    const fileContentHtml = file ? `
        <div class="mt-2 p-2 bg-black/30 rounded-lg border border-amber-700/50">
            <p class="text-xs text-amber-300">Attached File: ${file.name}</p>
            ${file.type.startsWith('image/') ? `<img src="data:${file.type};base64,${file.data}" alt="Uploaded Image" class="max-h-40 w-auto mt-2 rounded-lg" onerror="this.onerror=null; this.src='https://placehold.co/150x50/333/FFF?text=Image+Load+Failed';">` : ''}
        </div>
    ` : '';

    messageDiv.innerHTML = `
        <div class="shadow-xl p-4 max-w-4xl font-geist font-light ${bubbleClasses} ${customClasses}">
            ${text ? `<p class="text-sm">${text}</p>` : ''}
            ${fileContentHtml}
        </div>
    `;

    chatContentEl.appendChild(messageDiv);
    chatContentEl.scrollTop = chatContentEl.scrollHeight;
}

/**
 * Toggles the AI Agent full-screen modal.
 */
function toggleAgent() {
    state.isAgentActive = !state.isAgentActive;
    const modal = document.getElementById('ai-agent-modal');

    if (state.isAgentActive) {
        modal.classList.remove('hidden', 'opacity-0');
        modal.classList.add('flex', 'opacity-100');
        document.body.style.overflow = 'hidden'; // Prevent scrolling

        // 1. Run Welcome Sequence
        const welcomeEl = document.getElementById('welcome-text-container');
        const headerEl = document.getElementById('agent-header-bar');
        const inputEl = document.getElementById('chat-input-container');

        // Hide main elements initially
        headerEl.classList.add('opacity-0');
        inputEl.classList.add('opacity-0', 'scale-75');
        document.getElementById('chat-messages-container').classList.add('opacity-0');
        welcomeEl.classList.remove('hidden');

        // Choose a welcome phrase
        const phraseIndex = Math.floor(Math.random() * AGENT_WELCOME_PHRASES.length);
        const welcomeText = AGENT_WELCOME_PHRASES[phraseIndex].replace('{username}', username);

        // Start welcome animation
        welcomeEl.textContent = welcomeText;
        welcomeEl.classList.remove('animate-fade-out');
        welcomeEl.classList.add('animate-slide-in-fade-grow');

        // 2. Transition to Main UI after animation
        setTimeout(() => {
            welcomeEl.classList.remove('animate-slide-in-fade-grow');
            welcomeEl.classList.add('animate-fade-out');
            
            // Wait for fade out to complete before transitioning text
            setTimeout(() => {
                welcomeEl.classList.add('hidden');
                headerEl.classList.remove('opacity-0');
                document.getElementById('chat-messages-container').classList.remove('opacity-0');

                // Animate input bar
                inputEl.classList.remove('opacity-0', 'scale-75', 'translate-y-full');
                inputEl.classList.add('animate-input-slide-up');

                // Initial agent message
                if (document.getElementById('chat-content').children.length === 0) {
                     addMessageToUI('system', `Hello, ${username}! I am the 4SP Agent, currently set to the **${AGENT_CATEGORIES[state.selectedCategory].name}** category. What can I assist you with today?`, null, 'text-neutral-200');
                }

            }, 1000); // Wait for the welcome text fade out (1s)

        }, 2500); // Duration of slide-in/grow animation (2.5s)

    } else {
        modal.classList.remove('flex', 'opacity-100');
        modal.classList.add('hidden', 'opacity-0');
        document.body.style.overflow = 'auto';
    }
    renderAgentModal();
}

/**
 * Initializes the file reading process when a file is selected.
 */
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && file.type !== 'text/plain' && file.type !== 'application/pdf') {
        alert('Please upload only images, text files (.txt), or PDF files.');
        return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
        const base64Data = event.target.result.split(',')[1];
        state.uploadedFile = {
            name: file.name,
            type: file.type,
            data: base64Data,
            size: file.size
        };

        const previewEl = document.getElementById('file-upload-preview');
        previewEl.innerHTML = `<span class="text-xs text-amber-300/80 mr-2">${file.name}</span>`;
        document.getElementById('attach-file-icon').classList.add('text-amber-500');

        if (file.type.startsWith('image/')) {
            previewEl.innerHTML += `<img src="${event.target.result}" class="h-10 w-auto rounded-md object-cover">`;
        }
    };

    reader.readAsDataURL(file);
}

/**
 * Updates the selected agent category and re-renders the header.
 */
function handleCategoryChange(e) {
    const newCategory = e.target.value;
    state.selectedCategory = newCategory;
    const headerEl = document.getElementById('agent-header-title');
    if (headerEl) {
        const categoryName = AGENT_CATEGORIES[newCategory].name;
        headerEl.textContent = `4SP Agent - ${categoryName}`;
        headerEl.style.color = `var(--color-${AGENT_CATEGORIES[newCategory].color})`;
        
        // Add a message to the chat indicating the change
        addMessageToUI('system', `Agent profile changed to **${categoryName}**.`, null, 'text-neutral-200');
    }
}

// =========================================================================
// --- UI RENDERING & INJECTION ---
// =========================================================================

/**
 * Injects global CSS styles, including custom fonts and Tailwind classes.
 */
function injectStyles() {
    const styleId = 'ai-agent-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
        /* Font Imports */
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&display=swap');
        /* Geist font is not available on Google Fonts, using a common CDN/fallback */
        @import url('https://cdn.jsdelivr.net/npm/@geist-ui/fonts/geist.css');

        /* Custom Colors for Categories */
        :root {
            --color-blue: #3b82f6;
            --color-emerald: #10b981;
            --color-purple: #a855f7;
            --color-red: #ef4444;
            --color-pink: #ec4899;
            --color-yellow: #f59e0b;
            --color-cyan: #06b6d4;
            --color-indigo: #6366f1;
        }

        /* Base styles for the Agent Modal */
        #ai-agent-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-color: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(16px);
            z-index: 1000;
            transition: opacity 0.5s ease-in-out;
            overflow: hidden;
        }

        /* Global Chat Styles */
        .chat-message {
            display: flex;
            width: 100%;
            margin-bottom: 1rem;
        }
        .chat-message.user {
            justify-content: flex-end;
        }
        .chat-message.agent {
            justify-content: flex-start;
        }

        /* User Bubble Styling */
        .chat-message.user > div {
            max-width: 80%;
            padding: 1rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        /* Agent Bubble Styling (Glassy Orange) */
        .agent-bubble {
            max-width: 80%;
            padding: 1rem;
            transition: all 0.3s ease;
        }

        /* Typing Pulse Animation */
        @keyframes pulse-orange {
            0%, 100% { box-shadow: 0 0 10px rgba(245, 158, 11, 0.6), 0 0 20px rgba(245, 158, 11, 0.4); }
            50% { box-shadow: 0 0 15px rgba(245, 158, 11, 1), 0 0 30px rgba(245, 158, 11, 0.8); }
        }
        .typing-pulse {
            animation: pulse-orange 1.5s infinite alternate;
        }

        /* Loading Dots Animation */
        @keyframes dot-pulse {
            0%, 80%, 100% { opacity: 0.2; }
            40% { opacity: 1; }
        }
        .dot-1 { animation: dot-pulse 1.5s infinite; }
        .dot-2 { animation: dot-pulse 1.5s infinite 0.2s; }
        .dot-3 { animation: dot-pulse 1.5s infinite 0.4s; }

        /* Welcome/Input Animations */
        @keyframes slide-in-fade-grow {
            0% { transform: translateY(100px) scale(0.8); opacity: 0; }
            50% { transform: translateY(0) scale(1.1); opacity: 1; }
            100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        .animate-slide-in-fade-grow {
            animation: slide-in-fade-grow 2.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }

        @keyframes fade-out {
            0% { opacity: 1; }
            100% { opacity: 0; }
        }
        .animate-fade-out {
            animation: fade-out 1s ease-out forwards;
        }

        @keyframes input-slide-up {
            0% { transform: translateY(100%) scale(0.9); opacity: 0; }
            100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        .animate-input-slide-up {
            animation: input-slide-up 0.5s ease-out forwards;
        }

        /* Tailwind overrides for consistent font usage */
        .font-playfair {
            font-family: 'Playfair Display', serif;
        }
        .font-geist {
            font-family: 'Geist', sans-serif;
        }

        /* Textarea custom scrollbar for dark mode */
        #chat-input-textarea::-webkit-scrollbar {
            width: 8px;
        }
        #chat-input-textarea::-webkit-scrollbar-thumb {
            background-color: #f59e0b; /* Amber 500 */
            border-radius: 4px;
        }
        #chat-input-textarea::-webkit-scrollbar-track {
            background: #1f2937; /* Dark background */
        }
    `;
    document.head.appendChild(style);
}

/**
 * Renders the full-screen AI Agent modal UI.
 */
function renderAgentModal() {
    const navbarContainer = document.getElementById('navbar-container');
    if (!navbarContainer) return;

    let modal = document.getElementById('ai-agent-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'ai-agent-modal';
        modal.className = 'hidden opacity-0 p-4 md:p-8 transition-opacity duration-500 z-[99999]';
        document.body.appendChild(modal);
    }

    const currentCategory = AGENT_CATEGORIES[state.selectedCategory];
    const categoryColor = `var(--color-${currentCategory.color})`;

    modal.innerHTML = `
        <!-- Welcome Text Overlay (Initial Animation) -->
        <div id="welcome-text-container" class="absolute inset-0 flex items-center justify-center pointer-events-none z-50 transition-opacity duration-1000 hidden">
            <h1 class="font-playfair text-6xl md:text-8xl font-black text-amber-500 text-center shadow-amber-500/50">
                ${state.currentWelcomeText}
            </h1>
        </div>

        <div class="flex flex-col h-full w-full max-w-7xl mx-auto backdrop-blur-sm">

            <!-- Header and System Info Bar -->
            <div id="agent-header-bar" class="flex justify-between items-center p-4 rounded-xl border-b border-amber-500/30 transition-opacity duration-1000">
                <h1 id="agent-header-title" class="font-playfair text-3xl font-bold transition-colors duration-300" style="color: ${categoryColor};">
                    4SP Agent - ${currentCategory.name}
                </h1>
                <div class="flex items-center space-x-4">
                    <div class="text-sm text-neutral-300 font-geist">
                        <p>${state.locationName}</p>
                        <p id="current-time">${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</p>
                    </div>
                    <select onchange="handleCategoryChange(event)" class="bg-amber-600/50 backdrop-blur-sm border border-amber-500/50 text-white text-sm rounded-lg p-2 font-geist cursor-pointer focus:ring-amber-500 focus:border-amber-500 transition-all duration-300">
                        ${Object.entries(AGENT_CATEGORIES).map(([key, cat]) => `
                            <option value="${key}" ${key === state.selectedCategory ? 'selected' : ''}>${cat.name}</option>
                        `).join('')}
                    </select>
                    <button onclick="toggleAgent()" class="p-2 bg-neutral-700/50 hover:bg-neutral-600/50 backdrop-blur-sm rounded-full transition-all text-white">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
            </div>

            <!-- Chat Messages Area -->
            <div id="chat-messages-container" class="flex-grow overflow-hidden p-2 md:p-6 transition-opacity duration-1000">
                <div id="chat-content" class="h-full overflow-y-auto space-y-4 pr-3">
                    <!-- Chat messages will be dynamically added here -->
                </div>
            </div>

            <!-- Input Bar Container (Slides in from bottom) -->
            <div id="chat-input-container" class="w-full pb-4 pt-2 transition-transform duration-500">
                <form id="chat-form" onsubmit="handleChatSubmit(event)" class="flex flex-col bg-neutral-800/70 backdrop-blur-lg rounded-2xl p-4 shadow-2xl border border-neutral-700/50">

                    <!-- File Preview & Action Buttons -->
                    <div class="flex justify-between items-center mb-2">
                        <div id="file-upload-preview" class="flex items-center space-x-2 h-10 overflow-hidden">
                            <!-- Preview content goes here -->
                        </div>
                        <label for="file-upload" class="cursor-pointer p-2 rounded-full hover:bg-neutral-600/50 transition-all">
                            <input type="file" id="file-upload" accept="image/*, .txt, .pdf" onchange="handleFileSelect(event)" class="hidden">
                            <svg id="attach-file-icon" class="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.57 6.57a4.5 4.5 0 01-6.364-6.364l6.57-6.57a3 3 0 014.243 4.243l-6.57 6.57a1.5 1.5 0 01-2.121-2.121l6.57-6.57"></path></svg>
                        </label>
                    </div>

                    <!-- Textarea and Send Button -->
                    <div class="flex items-end space-x-3">
                        <textarea
                            id="chat-input-textarea"
                            class="flex-grow p-3 bg-neutral-900/50 backdrop-blur-sm border border-neutral-700/50 rounded-xl text-white font-geist font-light text-base focus:ring-amber-500 focus:border-amber-500 resize-none"
                            placeholder="Type your question (max 5000 characters)..."
                            rows="1"
                            maxlength="5000"
                            oninput="this.style.height = 'auto'; this.style.height = (this.scrollHeight) + 'px';"
                            onpaste="handlePaste(event)"
                        ></textarea>
                        <button type="submit" class="p-3 rounded-full bg-amber-500 text-neutral-900 shadow-lg hover:bg-amber-400 transition-all duration-300 transform active:scale-95" title="Send Message">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // Update time every second
    if (state.isAgentActive) {
        const timeEl = document.getElementById('current-time');
        if (timeEl) {
            setInterval(() => {
                timeEl.textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
            }, 1000);
        }
    }
}

/**
 * Handles the paste event, checking the character count for file conversion.
 */
function handlePaste(e) {
    const pasteText = e.clipboardData.getData('text');
    if (pasteText.length > 1000 && !state.uploadedFile) {
        e.preventDefault();
        
        // Convert the large paste content into a simulated file
        state.uploadedFile = {
            name: 'paste.txt',
            type: 'text/plain',
            data: btoa(pasteText), // Base64 encode the large text content
            size: pasteText.length
        };
        
        // Update the textarea with a short reference and update preview
        const truncatedText = pasteText.substring(0, 100) + '... (Full text attached as paste.txt)';
        document.getElementById('chat-input-textarea').value = truncatedText;

        const previewEl = document.getElementById('file-upload-preview');
        previewEl.innerHTML = `<span class="text-xs text-amber-300/80 mr-2">Attached File: paste.txt</span>`;
        document.getElementById('attach-file-icon').classList.add('text-amber-500');

        // Allow the user to submit now
        document.getElementById('chat-input-textarea').dispatchEvent(new Event('input'));
    }
}


// =========================================================================
// --- INITIALIZATION & SETUP ---
// =========================================================================

/**
 * The main run function executed after DOM content is loaded.
 */
const run = async () => {
    // 1. Inject Styles
    injectStyles();

    // 2. Initialize Firebase
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        setLogLevel('error'); // Set log level to 'error' to avoid noisy console output
    } catch (e) {
        console.error('Firebase initialization failed:', e);
        return;
    }

    // 3. Perform Initial Geolocation
    state.locationName = await getLocationName();

    // 4. Create AI Agent Toggle Button in the Navbar container
    const navbarDiv = document.getElementById('navbar-container');
    if (!navbarDiv) {
        // Create a div for the navbar/utility bar if it doesn't exist
        const newNavbarDiv = document.createElement('div');
        newNavbarDiv.id = 'navbar-container';
        document.body.prepend(newNavbarDiv);
        navbarDiv = newNavbarDiv;
    }

    // Create a basic floating utility button for demonstration (as the navigation context is removed)
    const agentButton = document.createElement('button');
    agentButton.textContent = '4SP Agent';
    agentButton.className = 'fixed bottom-4 right-4 z-[1000] p-3 rounded-full bg-amber-600 text-white font-bold shadow-2xl hover:bg-amber-500 transition-all transform active:scale-95';
    agentButton.onclick = toggleAgent;
    document.body.appendChild(agentButton);

    // 5. Handle Authentication
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            userId = user.uid;
            // Attempt to get username from Firestore (assuming a 'users' collection with doc ID = uid)
            try {
                const userDocRef = doc(db, 'artifacts', appId, 'users', userId, 'profile', 'data');
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    username = userData.username || userData.email || 'Agent User';
                }
            } catch (error) {
                console.error("Error fetching user data for username:", error);
                username = user.email || 'Agent User';
            }
        } else {
            // User is signed out.
            // Attempt to sign in anonymously for a seamless guest experience.
            try {
                if (initialAuthToken) {
                    await signInWithCustomToken(auth, initialAuthToken);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (error) {
                console.error("Anonymous sign-in error:", error);
            }
        }
        // Prefill the welcome text with the resolved username for the first activation
        const phraseIndex = Math.floor(Math.random() * AGENT_WELCOME_PHRASES.length);
        state.currentWelcomeText = AGENT_WELCOME_PHRASES[phraseIndex].replace('{username}', username);
        renderAgentModal();
    });

    // 6. Make core functions globally accessible for the HTML attributes
    window.toggleAgent = toggleAgent;
    window.handleChatSubmit = handleChatSubmit;
    window.handleCategoryChange = handleCategoryChange;
    window.handleFileSelect = handleFileSelect;
    window.handlePaste = handlePaste;
};

// --- START THE PROCESS ---
document.addEventListener('DOMContentLoaded', run);
