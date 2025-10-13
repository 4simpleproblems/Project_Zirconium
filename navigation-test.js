/**
 * ai-activation.js
 *
 * A feature-rich, self-contained script with a unified attachment/subject menu,
 * enhanced animations, intelligent chat history (token saving),
 * and advanced file previews. This version includes a character limit,
 * smart paste handling, and refined animations.
 *
 * --- UPDATES ---
 * 1. API Key Integration: Now uses the 'apiKey' from the FIREBASE_CONFIG object.
 * 2. Typography: All fonts converted to 'Merriweather' (serif, for body) and 'Inter'
 * (sans-serif, for UI/code—used as a high-quality replacement for 'Geist').
 */
(function() {
    // =========================================================================
    // >> FIREBASE CONFIGURATION <<
    // This configuration object is used to securely access the Gemini API Key.
    // =========================================================================
    const FIREBASE_CONFIG = {
        // This apiKey is now used for both Firebase Auth and the Gemini API calls.
        apiKey: "AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro",
        authDomain: "project-zirconium.firebaseapp.com",
        projectId: "project-zirconium",
        storageBucket: "project-zirconium.firebaseapp.com",
        messagingSenderId: "1096564243475",
        appId: "1:1096564243475:web:6d0956a70125eeea1ad3e6",
        measurementId: "G-1D4F69"
    };

    // --- CONFIGURATION ---
    // Use the API key from the Firebase config
    const API_KEY = FIREBASE_CONFIG.apiKey; 
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-09-2025:generateContent?key=${API_KEY}`;
    const MAX_INPUT_HEIGHT = 200;
    const CHAR_LIMIT = 500;
    const MAX_RETRIES = 3;
    const INITIAL_BACKOFF_MS = 1000;


    // --- ICONS (for event handlers) ---
    const copyIconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="copy-icon"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    const checkIconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="check-icon"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    const closeIconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="close-icon"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    const geminiLogoSVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-15c-1.89 0-3.7.83-4.95 2.27L12 9.42l2.95-3.15c-1.25-1.44-3.06-2.27-4.95-2.27zm-5.05 4.73l-1.93 2.06c.64 1.77 1.83 3.32 3.36 4.35l2.05-2.17L6.95 7.73zM12 17.58l-2.95-3.15L12 11.27l2.95 3.15-2.95 3.16zm5.05-9.85l-1.93 2.06 2.05 2.17c1.53-1.03 2.72-2.58 3.36-4.35l-1.48-1.58-1.95 1.69z" fill="currentColor"/></svg>`;
    const paperclipSVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 7l-6 6M11 11l-6 6M17 5l-1.45 1.45A6 6 0 0 0 9 12.01V15a3 3 0 0 1-3 3H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4M19 19h-1a2 2 0 0 1-2-2v-3.5a6 6 0 0 0-1.45-3.55L19 5"></path></svg>`;


    // --- STATE MANAGEMENT ---
    let chatHistory = [];
    let isAIAssistantActive = false;
    let isGenerating = false;
    let currentFile = null; // Stores { fileName: string, mimeType: string, base64Data: string }
    let hasSystemInstruction = false;

    // --- DOM ELEMENTS ---
    let container = null;
    let mainButton = null;
    let chatWindow = null;
    let inputArea = null;
    let charCountDisplay = null;
    let sendButton = null;
    let closeButton = null;
    let filePreviewContainer = null;
    let fileInput = null;
    let subjectMenuButton = null;
    let subjectMenu = null;
    let historyContainer = null;
    let systemInstructionInput = null;

    // --- UTILITIES ---

    /** Converts a Base64 string to a Uint8Array */
    function base64ToUint8Array(base64) {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }

    /** Converts a base64 encoded audio chunk to a WAV Blob (16-bit PCM). */
    function pcmToWav(pcm16, sampleRate = 24000) {
        const numChannels = 1;
        const bitDepth = 16;
        const byteRate = (sampleRate * numChannels * bitDepth) / 8;
        const blockAlign = (numChannels * bitDepth) / 8;

        const buffer = new ArrayBuffer(44 + pcm16.length * 2);
        const view = new DataView(buffer);
        let offset = 0;

        // RIFF header
        view.setUint32(offset, 0x52494646, false); offset += 4; // "RIFF"
        view.setUint32(offset, 36 + pcm16.length * 2, true); offset += 4; // file size - 8
        view.setUint32(offset, 0x57415645, false); offset += 4; // "WAVE"

        // fmt sub-chunk
        view.setUint32(offset, 0x666d7420, false); offset += 4; // "fmt "
        view.setUint32(offset, 16, true); offset += 4; // sub-chunk size (16 for PCM)
        view.setUint16(offset, 1, true); offset += 2; // audio format (1 = PCM)
        view.setUint16(offset, numChannels, true); offset += 2; // number of channels
        view.setUint32(offset, sampleRate, true); offset += 4; // sample rate
        view.setUint32(offset, byteRate, true); offset += 4; // byte rate
        view.setUint16(offset, blockAlign, true); offset += 2; // block align
        view.setUint16(offset, bitDepth, true); offset += 2; // bits per sample

        // data sub-chunk
        view.setUint32(offset, 0x64617461, false); offset += 4; // "data"
        view.setUint32(offset, pcm16.length * 2, true); offset += 4; // data size

        // PCM data
        for (let i = 0; i < pcm16.length; i++, offset += 2) {
            view.setInt16(offset, pcm16[i], true);
        }

        return new Blob([view], { type: 'audio/wav' });
    }

    /**
     * Attempts an API call with exponential backoff for resilience.
     */
    async function fetchWithRetry(url, options, retries = MAX_RETRIES, delay = INITIAL_BACKOFF_MS) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                // Throw an error to trigger the catch block and retry logic
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response;
        } catch (error) {
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, delay));
                const nextDelay = delay * 2;
                return fetchWithRetry(url, options, retries - 1, nextDelay);
            }
            throw new Error(`API call failed after ${MAX_RETRIES} attempts: ${error.message}`);
        }
    }


    // --- RENDERING & UI FUNCTIONS ---

    /**
     * Injects the necessary CSS styles into the document head.
     */
    function injectStyles() {
        const style = document.createElement('style');
        style.type = 'text/css';
        // Applying Merriweather for body text and Inter for UI elements and code
        const css = `
            /* Load Merriweather from Google Fonts */
            @import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@300;400;700&display=swap');
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

            :root {
                --ai-blue: #4285f4;
                --ai-green: #34a853;
                --ai-yellow: #fbbc04;
                --ai-red: #ea4335;
                --bg-dark: #1e1e1e;
                --bg-light: #252526;
                --text-light: #f0f0f0;
                --border-color: #3e3e3e;
                --shadow-color: rgba(0, 0, 0, 0.4);
            }

            /* Base font set to Merriweather for a more academic/readable feel */
            #ai-activation-container, #ai-activation-container * {
                box-sizing: border-box;
                font-family: 'Merriweather', serif;
            }

            #ai-activation-container {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                align-items: flex-end;
            }

            .ai-main-button {
                width: 60px;
                height: 60px;
                border-radius: 50%;
                background: linear-gradient(135deg, var(--ai-blue), var(--ai-green), var(--ai-yellow), var(--ai-red));
                border: none;
                color: var(--text-light);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                box-shadow: 0 4px 12px var(--shadow-color);
                animation: gemini-glow 4s infinite alternate;
            }

            .ai-main-button.active {
                transform: scale(0.85);
                box-shadow: 0 0 0 0;
            }

            .chat-window {
                position: absolute;
                bottom: 80px;
                right: 0;
                width: min(100vw - 40px, 400px);
                height: 500px;
                background-color: var(--bg-dark);
                border-radius: 16px;
                box-shadow: 0 8px 30px var(--shadow-color);
                display: flex;
                flex-direction: column;
                transform: translateY(10px) scale(0.95);
                opacity: 0;
                pointer-events: none;
                transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            }

            .chat-window.active {
                transform: translateY(0) scale(1);
                opacity: 1;
                pointer-events: all;
            }

            .chat-header {
                padding: 12px 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid var(--border-color);
                color: var(--text-light);
                font-weight: 500;
                /* UI elements use Inter */
                font-family: 'Inter', system-ui, sans-serif;
            }

            .chat-header button {
                background: none;
                border: none;
                color: var(--text-light);
                cursor: pointer;
                opacity: 0.7;
                transition: opacity 0.2s;
            }

            .chat-header button:hover {
                opacity: 1;
            }

            .chat-history {
                flex-grow: 1;
                padding: 15px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 15px;
                /* Using Inter as a clean, readable font for chat messages */
                font-family: 'Inter', system-ui, sans-serif;
                font-size: 0.95rem;
                line-height: 1.4;
            }

            .chat-history::-webkit-scrollbar {
                width: 6px;
            }

            .chat-history::-webkit-scrollbar-thumb {
                background-color: rgba(255, 255, 255, 0.2);
                border-radius: 3px;
            }

            .message {
                max-width: 90%;
                padding: 10px 15px;
                border-radius: 12px;
                position: relative;
                word-wrap: break-word;
            }
            .message a {
                color: var(--ai-blue);
                text-decoration: underline;
            }

            .user-message {
                align-self: flex-end;
                background-color: var(--ai-blue);
                color: white;
                border-bottom-right-radius: 4px;
            }

            .ai-message {
                align-self: flex-start;
                background-color: var(--bg-light);
                color: var(--text-light);
                border-bottom-left-radius: 4px;
            }

            .message-actions {
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: 5px;
                margin-top: 5px;
                opacity: 0.6;
            }

            .message-actions button {
                background: none;
                border: none;
                color: var(--text-light);
                cursor: pointer;
                padding: 2px;
                line-height: 1;
                transition: opacity 0.2s;
            }

            .message-actions button:hover {
                opacity: 1;
            }
            .message-actions .check-icon { color: var(--ai-green); }


            /* Loading Indicator */
            .loading-dots {
                display: inline-flex;
                gap: 4px;
                align-items: center;
                height: 10px;
                margin-top: 5px;
            }
            .loading-dots div {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background-color: var(--text-light);
                animation: pulse 1.4s infinite ease-in-out both;
            }
            .loading-dots div:nth-child(1) { animation-delay: -0.32s; }
            .loading-dots div:nth-child(2) { animation-delay: -0.16s; }
            @keyframes pulse {
                0%, 80%, 100% { transform: scale(0); }
                40% { transform: scale(1.0); }
            }

            /* INPUT AREA */
            .chat-input-area {
                padding: 10px;
                border-top: 1px solid var(--border-color);
                background-color: var(--bg-dark);
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .input-box {
                display: flex;
                align-items: flex-end;
                border: 1px solid var(--border-color);
                border-radius: 12px;
                background-color: var(--bg-light);
                padding: 8px;
                transition: border-color 0.2s, box-shadow 0.2s;
            }
            .input-box:focus-within {
                border-color: var(--ai-blue);
                box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.2);
            }

            .input-area {
                flex-grow: 1;
                max-height: ${MAX_INPUT_HEIGHT}px;
                overflow-y: auto;
                outline: none;
                border: none;
                background: none;
                color: var(--text-light);
                resize: none;
                font-size: 0.95rem;
                /* UI elements use Inter */
                font-family: 'Inter', system-ui, sans-serif;
                padding: 4px;
                min-height: 20px;
                line-height: 1.4;
            }
            .input-area:empty:before {
                content: attr(placeholder);
                color: #888;
                pointer-events: none;
            }

            .send-button {
                background: var(--ai-blue);
                border: none;
                color: white;
                width: 30px;
                height: 30px;
                border-radius: 8px;
                cursor: pointer;
                margin-left: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                transition: background 0.2s, opacity 0.2s;
            }
            .send-button:disabled {
                background: #888;
                cursor: not-allowed;
                opacity: 0.7;
            }
            .send-button:hover:not(:disabled) {
                background: #5b92f7;
            }

            .send-button svg {
                width: 16px;
                height: 16px;
                fill: white;
            }

            /* CHAR COUNT & SYSTEM INSTRUCTION */
            .bottom-controls {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 0.75rem;
                color: #888;
                padding: 0 4px;
                /* UI elements use Inter */
                font-family: 'Inter', system-ui, sans-serif;
            }

            .char-count.limit-reached {
                color: var(--ai-red);
                font-weight: 600;
            }

            .system-instruction-input {
                width: 100%;
                padding: 8px;
                border: 1px dashed #555;
                border-radius: 8px;
                background-color: rgba(255, 255, 255, 0.05);
                color: var(--text-light);
                font-size: 0.8rem;
                min-height: 30px;
                resize: none;
                outline: none;
                transition: border-color 0.2s;
                /* UI elements use Inter */
                font-family: 'Inter', system-ui, sans-serif;
                margin-bottom: 8px;
            }
            .system-instruction-input:focus {
                border-color: var(--ai-yellow);
            }
            .system-instruction-input:empty:before {
                content: 'Optional: Enter system instruction (e.g., "Act as a pirate")';
                color: #888;
            }
            .system-instruction-input.active {
                border-style: solid;
                border-color: var(--ai-green);
            }


            /* FILE AND SUBJECT MENU */
            .subject-menu-button {
                background: none;
                border: none;
                color: var(--text-light);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 4px;
                flex-shrink: 0;
                opacity: 0.7;
                transition: opacity 0.2s;
            }
            .subject-menu-button:hover {
                opacity: 1;
            }
            .subject-menu-button svg {
                width: 20px;
                height: 20px;
            }

            .subject-menu {
                position: absolute;
                top: 50px;
                right: 5px;
                background-color: var(--bg-light);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                box-shadow: 0 4px 12px var(--shadow-color);
                padding: 8px;
                width: 200px;
                display: none;
                flex-direction: column;
                gap: 4px;
                z-index: 10001;
            }
            .subject-menu.active {
                display: flex;
            }
            .subject-menu label {
                padding: 6px 8px;
                font-size: 0.85rem;
                color: var(--text-light);
                /* UI elements use Inter */
                font-family: 'Inter', system-ui, sans-serif;
                font-weight: 500;
            }
            .subject-menu-item {
                background: none;
                border: none;
                padding: 8px;
                border-radius: 6px;
                text-align: left;
                color: var(--text-light);
                cursor: pointer;
                font-size: 0.9rem;
                /* UI elements use Inter */
                font-family: 'Inter', system-ui, sans-serif;
                transition: background 0.2s;
            }
            .subject-menu-item:hover {
                background-color: var(--border-color);
            }

            /* FILE PREVIEW */
            .file-preview {
                display: flex;
                justify-content: space-between;
                align-items: center;
                background-color: rgba(66, 133, 244, 0.1);
                border: 1px solid var(--ai-blue);
                padding: 6px 10px;
                border-radius: 8px;
                color: var(--text-light);
                font-size: 0.8rem;
                /* UI elements use Inter */
                font-family: 'Inter', system-ui, sans-serif;
                margin-bottom: 8px;
                transition: opacity 0.3s;
            }
            .file-preview.hidden {
                opacity: 0;
                height: 0;
                padding-top: 0;
                padding-bottom: 0;
                border-width: 0;
                overflow: hidden;
            }
            .file-info {
                max-width: calc(100% - 30px);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .remove-file-button {
                background: none;
                border: none;
                color: var(--ai-red);
                cursor: pointer;
                margin-left: 10px;
                line-height: 1;
            }


            /* CODE BLOCK STYLING */
            .code-block-wrapper {
                margin: 15px 0;
                border-radius: 8px;
                overflow: hidden;
                border: 1px solid var(--border-color);
                background-color: var(--bg-light);
                position: relative;
                animation: glow 1.5s infinite alternate;
            }
            .code-block-wrapper pre {
                margin: 0;
                padding: 15px;
                overflow: auto;
                background-color: transparent;
            }
            .code-block-wrapper pre::-webkit-scrollbar {
                height: 8px;
            }
            .code-block-wrapper pre::-webkit-scrollbar-thumb {
                background: rgba(255,255,255,0.2);
                border-radius: 4px;
            }
            .code-block-wrapper code {
                /* Code elements use Inter and a monospace fallback */
                font-family: 'Inter', monospace;
                font-size: 0.9em;
                color: #f0f0f0;
            }
            .code-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 15px;
                background-color: #333;
                color: var(--text-light);
                font-size: 0.85rem;
                border-bottom: 1px solid #444;
                /* UI elements use Inter */
                font-family: 'Inter', system-ui, sans-serif;
            }

            /* ANIMATIONS */
            @keyframes glow { 
                0%,100% { box-shadow: 0 0 5px rgba(255,255,255,.15), 0 0 10px rgba(255,255,255,.1); } 
                50% { box-shadow: 0 0 10px rgba(255,255,255,.25), 0 0 20px rgba(255,255,255,.2); } 
            }
            @keyframes gemini-glow { 
                0%,100% { box-shadow: 0 0 8px 2px var(--ai-blue); } 
                25% { box-shadow: 0 0 8px 2px var(--ai-green); } 
                50% { box-shadow: 0 0 8px 2px var(--ai-yellow); } 
                75% { box-shadow: 0 0 8px 2px var(--ai-red); } 
            }

            /* Responsive Adjustments */
            @media (max-width: 600px) {
                .chat-window {
                    width: 100vw;
                    height: 100vh;
                    bottom: 0;
                    right: 0;
                    border-radius: 0;
                }
                #ai-activation-container {
                    bottom: 0;
                    right: 0;
                    padding: 10px;
                }
                .ai-main-button {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                }
            }
        `;
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);
    }

    /**
     * Initializes the UI elements and structure.
     */
    function initUI() {
        container = document.createElement('div');
        container.id = 'ai-activation-container';

        mainButton = document.createElement('button');
        mainButton.className = 'ai-main-button';
        mainButton.innerHTML = geminiLogoSVG;

        chatWindow = document.createElement('div');
        chatWindow.className = 'chat-window';
        
        chatWindow.innerHTML = `
            <div class="chat-header">
                <span>Gemini Assistant</span>
                <div>
                    <button class="subject-menu-button">
                        ${paperclipSVG}
                    </button>
                    <button class="close-button">
                        ${closeIconSVG}
                    </button>
                </div>
            </div>
            <div class="chat-history">
                <div class="ai-message message" style="align-self: flex-start; border-bottom-left-radius: 12px;">
                    Hello! I'm your AI assistant. How can I help you today?
                </div>
            </div>
            <div class="chat-input-area">
                <textarea class="system-instruction-input" placeholder="Optional: Enter a system instruction or role..."></textarea>
                <div class="file-preview hidden">
                    <span class="file-info"></span>
                    <button class="remove-file-button">${closeIconSVG}</button>
                </div>
                <div class="input-box">
                    <div class="input-area" contenteditable="true" placeholder="Ask me anything..."></div>
                    <button class="send-button" disabled>
                        <svg width="24" height="24" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                    </button>
                </div>
                <div class="bottom-controls">
                    <span class="char-count">0/${CHAR_LIMIT}</span>
                </div>
            </div>
            <input type="file" style="display:none;" accept="image/*, text/*" class="file-input">
            
            <div class="subject-menu">
                <label>FILE & ROLE</label>
                <button class="subject-menu-item" data-action="file-upload">Attach File (Image/Text)</button>
                <button class="subject-menu-item" data-action="system-instruction">Set AI Role / Persona</button>
            </div>
        `;

        container.appendChild(chatWindow);
        container.appendChild(mainButton);
        document.body.appendChild(container);

        // Assign DOM elements to variables
        inputArea = chatWindow.querySelector('.input-area');
        charCountDisplay = chatWindow.querySelector('.char-count');
        sendButton = chatWindow.querySelector('.send-button');
        closeButton = chatWindow.querySelector('.close-button');
        filePreviewContainer = chatWindow.querySelector('.file-preview');
        fileInput = chatWindow.querySelector('.file-input');
        subjectMenuButton = chatWindow.querySelector('.subject-menu-button');
        subjectMenu = chatWindow.querySelector('.subject-menu');
        historyContainer = chatWindow.querySelector('.chat-history');
        systemInstructionInput = chatWindow.querySelector('.system-instruction-input');
    }

    /**
     * Toggles the chat window visibility and animation.
     */
    function toggleAssistant() {
        isAIAssistantActive = !isAIAssistantActive;
        mainButton.classList.toggle('active', isAIAssistantActive);
        chatWindow.classList.toggle('active', isAIAssistantActive);
        
        if (isAIAssistantActive) {
            inputArea.focus();
        }
    }
    
    /**
     * Displays a temporary message box instead of alert.
     */
    function showMessageBox(message) {
        const msgBox = document.createElement('div');
        msgBox.style.cssText = `
            position: fixed; top: 10px; right: 10px; background-color: #333; 
            color: white; padding: 10px 15px; border-radius: 8px; z-index: 10002;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3); font-size: 0.9rem;
            opacity: 0; transition: opacity 0.5s ease-in-out;
            font-family: 'Inter', system-ui, sans-serif;
        `;
        msgBox.textContent = message;
        document.body.appendChild(msgBox);

        // Fade in
        setTimeout(() => msgBox.style.opacity = '1', 10);
        // Fade out and remove
        setTimeout(() => {
            msgBox.style.opacity = '0';
            setTimeout(() => msgBox.remove(), 500);
        }, 3000);
    }

    /**
     * Updates the chat history with a new message.
     */
    function appendMessage(text, role, isStreaming = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message`;
        messageDiv.innerHTML = text;
        historyContainer.appendChild(messageDiv);
        historyContainer.scrollTop = historyContainer.scrollHeight;
        
        if (role === 'ai') {
            // Add copy functionality to AI messages
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'message-actions';
            
            const copyButton = document.createElement('button');
            copyButton.innerHTML = copyIconSVG;
            copyButton.title = 'Copy code';
            copyButton.onclick = (e) => copyCodeToClipboard(messageDiv, copyButton);
            actionsDiv.appendChild(copyButton);

            messageDiv.appendChild(actionsDiv);
        }
        
        return messageDiv;
    }

    /**
     * Handles the complex task of copying content (including code blocks) to the clipboard.
     */
    function copyCodeToClipboard(messageElement, button) {
        const codeBlocks = messageElement.querySelectorAll('.code-block-wrapper code');
        let textToCopy = '';

        if (codeBlocks.length > 0) {
            // If there are code blocks, join their content
            codeBlocks.forEach(code => {
                textToCopy += code.textContent + '\n\n';
            });
            textToCopy = textToCopy.trim();
        } else {
            // Otherwise, copy the whole message text, excluding action buttons
            const clone = messageElement.cloneNode(true);
            clone.querySelectorAll('.message-actions').forEach(el => el.remove());
            textToCopy = clone.textContent.trim();
        }

        try {
            // Use execCommand for broader iFrame compatibility
            const tempInput = document.createElement('textarea');
            tempInput.value = textToCopy;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);

            // Visual feedback
            button.innerHTML = checkIconSVG;
            button.title = 'Copied!';
            setTimeout(() => {
                button.innerHTML = copyIconSVG;
                button.title = 'Copy code';
            }, 2000);
            
            showMessageBox('Content copied to clipboard!');
        } catch (err) {
            console.error('Could not copy text: ', err);
            showMessageBox('Failed to copy content. Please copy manually.');
        }
    }


    /**
     * Converts raw text (potentially markdown) into HTML, handling code blocks.
     */
    function processMarkdown(text) {
        // 1. Convert code blocks to HTML structure with header and copy button
        const codeBlockRegex = /```(\w+)?\s*([\s\S]*?)```/g;
        text = text.replace(codeBlockRegex, (match, lang = 'text', code) => {
            const escapedCode = code.trim()
                                    .replace(/&/g, '&amp;')
                                    .replace(/</g, '&lt;')
                                    .replace(/>/g, '&gt;');
            const languageLabel = lang.charAt(0).toUpperCase() + lang.slice(1);
            
            // Note: The copy button logic for code blocks is handled in copyCodeToClipboard
            // This structure is for display only
            return `
                <div class="code-block-wrapper">
                    <div class="code-header">
                        <span>${languageLabel}</span>
                    </div>
                    <pre><code>${escapedCode}</code></pre>
                </div>
            `;
        });

        // 2. Convert basic markdown elements (strong, italics, lists, links)
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // **bold**
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>'); // *italics*
        text = text.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank">$1</a>'); // [link](url)
        text = text.replace(/\n\s*(\-|\*)\s*(.*)/g, (match, bullet, item) => `<li>${item}</li>`); // Simple list items

        // 3. Convert paragraphs
        text = text.split('\n\n').map(p => {
            if (p.trim().length > 0 && !p.includes('code-block-wrapper')) {
                // If it's a list item, don't wrap it in a <p>
                if (p.startsWith('<li>')) {
                    return `<ul>${p}</ul>`;
                }
                return `<p>${p.trim()}</p>`;
            }
            return p;
        }).join('');

        return text.trim();
    }
    
    /**
     * Calls the Gemini API to generate content.
     */
    async function generateContent() {
        if (isGenerating || inputArea.textContent.trim().length === 0) return;

        isGenerating = true;
        sendButton.disabled = true;

        const userText = inputArea.textContent.trim();
        const systemInstruction = systemInstructionInput.textContent.trim();
        
        // Add user message to history
        appendMessage(userText, 'user');
        
        // Clear input area and file/system instruction for next use
        inputArea.textContent = '';
        updateCharCount();
        clearFileAttachment();

        // Add the current user prompt to the chat history array
        const userParts = [{ text: userText }];
        if (currentFile) {
            userParts.push({
                inlineData: {
                    mimeType: currentFile.mimeType,
                    data: currentFile.base64Data
                }
            });
            // Clear the file from the state after preparing the payload
            currentFile = null; 
        }

        // Construct the history payload: The new user prompt + full history
        const contents = [...chatHistory, { role: "user", parts: userParts }];
        
        const payload = {
            contents: contents,
        };

        // Add system instruction if present
        if (systemInstruction) {
            payload.systemInstruction = {
                parts: [{ text: systemInstruction }]
            };
            // Only clear the system instruction after it's successfully used
            systemInstructionInput.textContent = '';
            systemInstructionInput.classList.remove('active');
            hasSystemInstruction = false;
        }

        const options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        };

        // Create a streaming AI message container
        const aiMessageDiv = appendMessage(`<div class="loading-dots"><div></div><div></div><div></div></div>`, 'ai', true);
        
        try {
            const response = await fetchWithRetry(API_URL, options);
            const result = await response.json();
            const candidate = result.candidates?.[0];

            if (candidate && candidate.content?.parts?.[0]?.text) {
                const rawText = candidate.content.parts[0].text;
                const htmlText = processMarkdown(rawText);

                // Update the message in the DOM
                aiMessageDiv.innerHTML = htmlText;

                // Add to persistent chat history
                chatHistory.push(
                    { role: "user", parts: userParts },
                    { role: "model", parts: [{ text: rawText }] }
                );
                
            } else {
                aiMessageDiv.textContent = "Sorry, I received an empty or invalid response from the AI.";
                console.error("AI response error:", result);
            }
        } catch (error) {
            aiMessageDiv.textContent = `An error occurred: ${error.message}. Please try again.`;
            console.error("Gemini API call error:", error);
        } finally {
            isGenerating = false;
            sendButton.disabled = inputArea.textContent.trim().length === 0;
            // Scroll to the latest message
            historyContainer.scrollTop = historyContainer.scrollHeight;
        }
    }

    // --- EVENT HANDLERS ---
    
    /**
     * Updates the character count display and send button state.
     */
    function updateCharCount() {
        const text = inputArea.textContent.trim();
        const length = text.length;
        charCountDisplay.textContent = `${length}/${CHAR_LIMIT}`;

        if (length > CHAR_LIMIT) {
            charCountDisplay.classList.add('limit-reached');
            sendButton.disabled = true;
        } else {
            charCountDisplay.classList.remove('limit-reached');
            sendButton.disabled = length === 0;
        }
    }

    /**
     * Prevents paste of rich content, ensuring plain text and handling limit.
     */
    function handlePaste(e) {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        
        // Calculate remaining space
        const currentLength = inputArea.textContent.length;
        const availableSpace = CHAR_LIMIT - currentLength;
        const pasteText = text.substring(0, availableSpace);

        document.execCommand('insertText', false, pasteText);
        updateCharCount();

        if (availableSpace < text.length) {
            showMessageBox(`Text truncated. Only ${availableSpace} characters could be pasted.`);
        }
    }

    /**
     * Handles file selection and conversion to base64.
     */
    function handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            showMessageBox('File size exceeds 10MB limit.');
            fileInput.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64Data = e.target.result.split(',')[1];
            currentFile = {
                fileName: file.name,
                mimeType: file.type,
                base64Data: base64Data
            };
            
            // Update UI
            filePreviewContainer.classList.remove('hidden');
            filePreviewContainer.querySelector('.file-info').textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
        };
        reader.readAsDataURL(file);

        // Close the subject menu after selection
        subjectMenu.classList.remove('active');
        fileInput.value = ''; // Clear input for next time
    }

    /**
     * Clears the attached file state and UI.
     */
    function clearFileAttachment() {
        currentFile = null;
        filePreviewContainer.classList.add('hidden');
        filePreviewContainer.querySelector('.file-info').textContent = '';
    }

    /**
     * Handles all top-level click events for the subject menu.
     */
    function handleSubjectMenuClick(e) {
        const button = e.target.closest('.subject-menu-item');
        if (!button) return;

        const action = button.getAttribute('data-action');

        if (action === 'file-upload') {
            fileInput.click();
        } else if (action === 'system-instruction') {
            // Toggle visibility of the system instruction textarea
            const isHidden = !systemInstructionInput.offsetHeight;
            systemInstructionInput.style.display = isHidden ? 'block' : 'none';
            systemInstructionInput.focus();
            
            // Check if it should be active (if instruction is set)
            if (!isHidden && systemInstructionInput.textContent.trim().length > 0) {
                systemInstructionInput.classList.add('active');
                hasSystemInstruction = true;
            } else {
                systemInstructionInput.classList.remove('active');
                hasSystemInstruction = false;
            }
            
            // Close the main menu
            subjectMenu.classList.remove('active');
        }
    }

    /**
     * Attach all necessary event listeners.
     */
    function attachListeners() {
        mainButton.addEventListener('click', toggleAssistant);
        closeButton.addEventListener('click', toggleAssistant);
        sendButton.addEventListener('click', generateContent);
        
        inputArea.addEventListener('input', updateCharCount);
        inputArea.addEventListener('paste', handlePaste);
        inputArea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!sendButton.disabled && !isGenerating) {
                    generateContent();
                }
            }
        });
        
        fileInput.addEventListener('change', handleFileSelect);
        
        // Remove file button
        chatWindow.querySelector('.remove-file-button').addEventListener('click', clearFileAttachment);

        // Subject Menu Toggling
        subjectMenuButton.addEventListener('click', (e) => {
            e.stopPropagation();
            subjectMenu.classList.toggle('active');
        });
        subjectMenu.addEventListener('click', handleSubjectMenuClick);
        
        // System instruction input tracking
        systemInstructionInput.addEventListener('input', () => {
            hasSystemInstruction = systemInstructionInput.textContent.trim().length > 0;
            systemInstructionInput.classList.toggle('active', hasSystemInstruction);
        });
        
        // Global click listener to close subject menu
        document.addEventListener('click', (e) => {
            if (!subjectMenu.contains(e.target) && e.target !== subjectMenuButton) {
                subjectMenu.classList.remove('active');
            }
        });
        
        // Adjust input area height
        inputArea.addEventListener('input', (e) => {
            inputArea.style.height = 'auto'; // Temporarily reset height
            const scrollHeight = inputArea.scrollHeight;
            if (scrollHeight > MAX_INPUT_HEIGHT) {
                inputArea.style.overflowY = 'auto';
                inputArea.style.height = `${MAX_INPUT_HEIGHT}px`;
            } else {
                inputArea.style.overflowY = 'hidden';
                inputArea.style.height = `${scrollHeight}px`;
            }
        });
    }


    /**
     * Main function to run the setup.
     */
    function run() {
        injectStyles();
        initUI();
        attachListeners();
    }

    // --- START THE PROCESS ---
    // Ensure the DOM is fully loaded before trying to append elements
    document.addEventListener('DOMContentLoaded', run);

})();
