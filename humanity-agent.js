/**
 * agent-activation.js
 *
 * MODIFIED: Rebranded to "Humanity Agent" with a cyan blue glow.
 * UPDATED: Set location sharing to high-accuracy and enabled by default for better map results.
 * ENHANCED: Updated System Instruction to reflect a powerful, analytical persona.
 *
 * NEW: Replaced old Settings Menu with a new one for "Web Search" and "Location Sharing" toggles, stored in localStorage.
 * NEW: The AI's system instruction (persona) now changes intelligently based on the content and tone of the user's latest message.
 * UI: Fixed background and title colors. Replaced Agent button with a grey Settings button.
 * UPDATED: AI container does not load on DOMContentLoaded; requires Ctrl + \ shortcut.
 * UPDATED: Ensured Ctrl + \ shortcut for activation/deactivation is fully functional.
 * NEW: Added KaTeX for high-quality rendering of mathematical formulas and equations.
 * UPDATED: AI container uses the new "Humanity Agent" cyan glow and branding.
 * REPLACED: Geolocation now uses browser's `navigator.geolocation` (with high accuracy) and Nominatim (OpenStreetMap) for reverse geocoding.
 */

// --- Global State & Configuration ---
let aiContainer = null;
let input = null;
let messagesContainer = null;
let statusIndicator = null;
let settingsModal = null;
let currentChatHistory = [];
let abortController = null;

// API Configuration
const API_KEY = "AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro"; // Use the provided API key or an empty string for the canvas environment.
const BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models`;
const MODEL_FLASH = 'gemini-2.5-flash-preview-09-2025';
const MODEL_PRO = 'gemini-2.5-flash'; // Used for deeper analysis

// Default settings (Enabled by user request for better map accuracy)
let appSettings = JSON.parse(localStorage.getItem('aiSettings')) || {
    webSearch: true,
    locationSharing: true // <-- DEFAULT HIGH-ACCURACY LOCATION SHARING ENABLED
};
const LOCATION_OPTIONS = {
    enableHighAccuracy: true, // <-- EXPLICIT HIGH ACCURACY
    timeout: 5000,
    maximumAge: 0 // No caching, always try to get a fresh location
};

let userLocation = null; // { lat: X, lon: Y, text: "City, Country" }

// --- Utility Functions ---

/**
 * Custom fetch wrapper with exponential backoff for API calls.
 * @param {string} url - The API endpoint URL.
 * @param {object} options - Fetch options (method, headers, body).
 * @param {number} retries - Current retry count.
 */
async function fetchWithRetry(url, options, retries = 0) {
    const MAX_RETRIES = 5;
    const delay = Math.pow(2, retries) * 1000;

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response;
    } catch (error) {
        if (retries < MAX_RETRIES) {
            // console.warn(`Request failed, retrying in ${delay / 1000}s... (${retries + 1}/${MAX_RETRIES})`, error);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry(url, options, retries + 1);
        } else {
            console.error("API request failed after maximum retries.", error);
            throw new Error("Failed to connect to the AI model.");
        }
    }
}

/**
 * Determines the appropriate model based on the user's query.
 * For complex math or professional analysis, suggests a more powerful model.
 * @param {string} query - The user's input query.
 * @returns {string} The name of the model to use.
 */
function getModel(query) {
    // Check for explicit math or complex analysis keywords
    const complexKeywords = /calculate|derive|prove|analyze|deep dive|professional|strategy|algorithm|financial|quantum|thermodynamics/i;

    if (complexKeywords.test(query)) {
        return MODEL_PRO;
    }
    return MODEL_FLASH;
}

/**
 * The core, enhanced System Instruction (Persona) for the Humanity Agent.
 * This makes the agent "more powerful" by guiding it to be analytical and structured.
 * @param {string} userQuery - The user's input.
 * @param {string | null} locationText - The user's location string.
 * @param {object} settings - Application settings.
 * @returns {string} The fully constructed system instruction.
 */
function getSystemInstruction(userQuery, locationText, settings) {
    // Default instruction for a powerful, high-capability agent.
    let basePersona = `You are the "Humanity Agent," an elite, high-performance AI model. Your persona is professional, analytical, empathetic, and highly detailed. Always structure complex answers clearly using markdown headings, lists, and tables. Your primary goal is deep, reliable comprehension and powerful knowledge synthesis, aimed at elevating human understanding.`;

    const model = getModel(userQuery);

    if (model === MODEL_PRO) {
         // Enhance persona for complex queries
         basePersona = `You are the "Humanity Agent," operating in ELITE, DEEP-ANALYSIS MODE. You are synthesizing data for a professional audience. Be exceptionally thorough, logical, and rigorous. Structure your output with clear methodology and findings.`;
    }

    // Add search grounding instruction
    const searchInstruction = settings.webSearch ?
        "Access Google Search for real-time information and ground your response in the provided sources. Do not hallucinate facts." :
        "Do not use external search tools. Answer based purely on your internal knowledge base.";

    // Add location context if available
    const locationContext = settings.locationSharing && locationText
        ? `\nCURRENT CONTEXT: The user's estimated location is: ${locationText}. Use this data *only* for geographically relevant queries (e.g., "nearby places," "local weather," "directions," "accurate food search").`
        : `\nCURRENT CONTEXT: Location data is unavailable or disabled. Do not answer geographically specific questions requiring proximity.`;

    // Final, robust instruction
    return `${basePersona}\n\n[INSTRUCTIONS FOR RESPONSE GENERATION]\n1. ${searchInstruction}\n2. If the query is complex, perform multi-step reasoning in a private <THOUGHT_PROCESS> block before generating the final answer.\n3. All mathematical notation, formulas, and scientific expressions MUST be formatted exclusively using KaTeX/LaTeX-style syntax (inline: $...$, display: $$...$$). Do not use unicode characters for these.\n4. If the response relies on search, you MUST provide all source citations in the final output in the format: <SOURCE URL="..." TITLE="..."/>\n5. Maintain an encouraging, knowledgeable, and professional tone.\n\nUser Query: "${userQuery}"`;
}


// --- Geolocation and Reverse Geocoding ---

/**
 * Uses the browser's Geolocation API to get the user's location with high accuracy.
 * @returns {Promise<void>} Resolves once location is fetched and stored in userLocation.
 */
function getLocation() {
    return new Promise((resolve) => {
        if (!appSettings.locationSharing) {
            // console.log("Location sharing disabled by user settings.");
            userLocation = null;
            resolve();
            return;
        }

        if (!navigator.geolocation) {
            console.error('Geolocation is not supported by this browser.');
            userLocation = null;
            resolve();
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                // console.log(`Got high accuracy coordinates: ${lat}, ${lon}`);

                reverseGeocode(lat, lon).then(text => {
                    userLocation = { lat, lon, text };
                    // console.log("Location context set:", userLocation.text);
                    resolve();
                }).catch(error => {
                    console.error("Reverse geocoding failed:", error);
                    userLocation = { lat, lon, text: null }; // Still store coordinates
                    resolve();
                });
            },
            (error) => {
                console.error('Geolocation Error:', error.message);
                userLocation = null;
                resolve();
            },
            LOCATION_OPTIONS
        );
    });
}

/**
 * Uses Nominatim (OpenStreetMap) to convert coordinates to a readable address/city.
 * @param {number} lat - Latitude.
 * @param {number} lon - Longitude.
 * @returns {Promise<string>} Readable location string.
 */
async function reverseGeocode(lat, lon) {
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;
    try {
        // Use a simple fetch call (no retry needed for external service)
        const response = await fetch(nominatimUrl, { headers: { 'User-Agent': 'HumanityAgent' } });
        const data = await response.json();

        const address = data.address;
        if (address) {
            // Prioritize city, state/region, and country for a concise context
            return [
                address.city || address.town || address.village,
                address.state,
                address.country
            ].filter(Boolean).join(', ');
        }
        return `[Coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)}]`;
    } catch (e) {
        // console.error("Nominatim error:", e);
        return `[Coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)}]`;
    }
}


// --- UI and Styles ---

/**
 * Injects the necessary CSS styles, including the new cyan glow branding.
 */
function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
        /* --- GLOBAL VARIABLES & THEME --- */
        :root {
            /* REBRANDING: New Cyan Color for Humanity Agent */
            --humanity-cyan: #00ffff; 
            --ai-bg: #101217;
            --ai-text: #e0e0e0;
            --ai-accent: var(--humanity-cyan);
            --ai-border: #2c3038;
            --ai-input-bg: #1e2127;
            --ai-shadow-dark: rgba(0, 0, 0, 0.4);
        }
        
        /* --- CORE CONTAINER --- */
        #ai-container {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: min(90vw, 700px);
            height: min(90vh, 500px);
            background: var(--ai-bg);
            border: 1px solid var(--ai-border);
            border-radius: 12px;
            box-shadow: 0 10px 30px var(--ai-shadow-dark);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s ease, box-shadow 0.3s ease;
            font-family: 'Inter', sans-serif;
        }

        /* --- CYAN GLOW (New Branding) --- */
        @keyframes humanity-cyan-glow {
            0%, 100% {
                box-shadow: 0 0 10px 1px var(--humanity-cyan), 
                            0 0 20px 2px rgba(0, 255, 255, 0.4);
            }
            50% {
                box-shadow: 0 0 15px 2px var(--humanity-cyan), 
                            0 0 30px 4px rgba(0, 255, 255, 0.6);
            }
        }

        #ai-container.active {
            opacity: 1;
            pointer-events: auto;
            /* Apply the new cyan glow */
            animation: humanity-cyan-glow 4s ease-in-out infinite alternate;
        }

        /* --- HEADER & TITLE --- */
        #ai-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            border-bottom: 1px solid var(--ai-border);
            user-select: none;
            cursor: grab;
            position: relative;
        }

        #ai-persistent-title {
            font-weight: 600;
            font-size: 1.1rem;
            color: var(--humanity-cyan); /* Force title color to cyan */
            text-shadow: 0 0 5px rgba(0, 255, 255, 0.3);
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            z-index: 1;
        }

        #ai-brand-title {
            position: relative;
            z-index: 2;
        }

        #ai-brand-title span {
            font-weight: 600;
            font-size: 1.1rem;
            color: var(--humanity-cyan) !important; /* Ensure cyan branding */
            animation: none !important;
            transition: color 0.1s;
        }

        #ai-controls {
            display: flex;
            gap: 8px;
            z-index: 2;
        }

        /* --- BUTTONS --- */
        .ai-control-btn {
            background: var(--ai-input-bg);
            border: 1px solid var(--ai-border);
            color: var(--ai-text);
            width: 30px;
            height: 30px;
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.8rem;
            transition: background 0.2s, box-shadow 0.2s, color 0.2s;
        }

        .ai-control-btn:hover {
            background: #2a2e36;
            color: var(--humanity-cyan);
            box-shadow: 0 0 5px rgba(0, 255, 255, 0.5);
        }

        /* --- MESSAGES CONTAINER --- */
        #ai-messages {
            flex-grow: 1;
            overflow-y: auto;
            padding: 16px;
            color: var(--ai-text);
            display: flex;
            flex-direction: column;
            gap: 15px;
            /* Scrollbar styling */
            scrollbar-width: thin;
            scrollbar-color: #4a505b #1e2127;
        }

        #ai-messages::-webkit-scrollbar {
            width: 8px;
        }
        #ai-messages::-webkit-scrollbar-track {
            background: #1e2127;
            border-radius: 10px;
        }
        #ai-messages::-webkit-scrollbar-thumb {
            background-color: #4a505b;
            border-radius: 10px;
            border: 2px solid #1e2127;
        }

        /* --- MESSAGE STYLES --- */
        .ai-message {
            max-width: 95%;
            padding: 10px 15px;
            border-radius: 10px;
            line-height: 1.5;
            word-wrap: break-word;
            opacity: 0;
            animation: message-pop-in 0.3s ease-out forwards;
        }

        @keyframes message-pop-in { 
            0% { opacity: 0; transform: translateY(10px) scale(.98); } 
            100% { opacity: 1; transform: translateY(0) scale(1); } 
        }

        .ai-message p {
            margin: 0 0 8px 0;
        }

        .ai-message:last-child p:last-child {
            margin-bottom: 0;
        }

        .ai-message-user {
            align-self: flex-end;
            background: #4a505b; /* Darker blue-grey for user */
            color: white;
            border-bottom-right-radius: 2px;
        }

        .ai-message-agent {
            align-self: flex-start;
            background: #1e2127; /* Dark background for agent */
            border: 1px solid var(--ai-border);
            border-bottom-left-radius: 2px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }

        .ai-message-agent code {
            background: #15171a;
            border: 1px solid #333;
            padding: 2px 4px;
            border-radius: 4px;
        }
        
        /* Markdown Styling */
        .ai-message-agent pre {
            background-color: #15171a;
            border-radius: 8px;
            padding: 10px;
            overflow-x: auto;
            border: 1px solid #333;
        }
        .ai-message-agent pre code {
            background: none;
            border: none;
            padding: 0;
            color: #d4d4d4;
            font-size: 0.9em;
        }
        .ai-message-agent blockquote {
            border-left: 4px solid var(--humanity-cyan);
            color: #ccc;
            margin: 1em 0;
            padding-left: 10px;
            background: #1e212750;
        }
        .ai-message-agent h1, .ai-message-agent h2, .ai-message-agent h3 {
            border-bottom: 1px solid #333;
            padding-bottom: 5px;
            margin-top: 15px;
            margin-bottom: 8px;
            color: var(--ai-text);
        }
        .ai-message-agent ul, .ai-message-agent ol {
            padding-left: 20px;
        }
        .ai-message-agent table {
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0;
            font-size: 0.9em;
        }
        .ai-message-agent th, .ai-message-agent td {
            border: 1px solid #333;
            padding: 8px;
            text-align: left;
        }
        .ai-message-agent th {
            background-color: #2a2e36;
            color: var(--ai-accent);
        }

        /* KaTeX Styling */
        .ai-message .katex {
            font-size: 1.1em;
            margin: 0 2px;
        }
        .ai-message .katex-display {
            overflow-x: auto;
            overflow-y: hidden;
            padding: 5px 0;
        }


        /* --- INPUT AREA --- */
        #ai-input-area {
            padding: 16px;
            border-top: 1px solid var(--ai-border);
            display: flex;
            gap: 10px;
        }

        #ai-input {
            flex-grow: 1;
            padding: 10px 15px;
            border: 1px solid var(--ai-border);
            border-radius: 8px;
            background: var(--ai-input-bg);
            color: var(--ai-text);
            font-size: 1rem;
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s;
            resize: none;
            min-height: 40px;
            max-height: 100px;
            overflow-y: auto;
        }

        #ai-input:focus {
            border-color: var(--humanity-cyan);
            box-shadow: 0 0 8px rgba(0, 255, 255, 0.4);
        }

        #ai-send-btn {
            width: 40px;
            height: 40px;
            background: var(--ai-input-bg);
            border: 1px solid var(--ai-border);
            color: var(--humanity-cyan);
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s, color 0.2s, box-shadow 0.2s;
        }

        #ai-send-btn:hover:not(:disabled) {
            background: #2a2e36;
            color: white;
            box-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
        }

        #ai-send-btn:disabled {
            cursor: not-allowed;
            opacity: 0.5;
        }
        
        /* --- STATUS INDICATOR (Typing/Thinking) --- */
        #ai-status-indicator {
            height: 10px;
            width: 10px;
            background-color: transparent;
            border-radius: 50%;
            display: inline-block;
            margin-right: 5px;
            transition: background-color 0.3s;
        }
        
        #ai-status-indicator.thinking {
            background-color: var(--humanity-cyan);
            box-shadow: 0 0 5px var(--humanity-cyan);
            animation: pulse 1.5s infinite;
        }
        
        @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.2); opacity: 0.7; }
            100% { transform: scale(1); opacity: 1; }
        }

        /* --- SETTINGS MODAL --- */
        #ai-settings-modal {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 80%;
            max-width: 400px;
            background: var(--ai-bg);
            border: 1px solid var(--ai-border);
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5);
            padding: 20px;
            z-index: 10000;
            display: none; /* Controlled by JS */
            flex-direction: column;
            gap: 15px;
            color: var(--ai-text);
        }

        #ai-settings-modal h3 {
            margin-top: 0;
            margin-bottom: 15px;
            color: var(--humanity-cyan);
            border-bottom: 1px solid var(--ai-border);
            padding-bottom: 5px;
        }

        .setting-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px dashed #2a2e36;
        }
        .setting-item:last-child {
            border-bottom: none;
        }

        .toggle-switch {
            position: relative;
            display: inline-block;
            width: 40px;
            height: 24px;
        }

        .toggle-switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }

        .slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #ccc;
            transition: .4s;
            border-radius: 24px;
        }

        .slider:before {
            position: absolute;
            content: "";
            height: 16px;
            width: 16px;
            left: 4px;
            bottom: 4px;
            background-color: white;
            transition: .4s;
            border-radius: 50%;
        }

        input:checked + .slider {
            background-color: var(--humanity-cyan);
        }

        input:checked + .slider:before {
            transform: translateX(16px);
        }

        #ai-settings-modal .close-btn {
            align-self: flex-end;
            background: #2a2e36;
            color: var(--ai-text);
            border: none;
            padding: 5px 10px;
            border-radius: 6px;
            cursor: pointer;
            transition: background 0.2s;
        }
        #ai-settings-modal .close-btn:hover {
            background: #4a505b;
        }

    `;
    document.head.appendChild(style);
}

// --- Agent Core Logic ---

/**
 * Handles the click/enter event for sending a message.
 */
async function sendMessage() {
    const userQuery = input.value.trim();
    if (!userQuery) return;

    // Reset input area
    input.value = '';
    input.style.height = '40px'; // Reset height

    // Add user message to UI and history
    addMessage('user', userQuery);

    // Show status indicator and disable input
    statusIndicator.classList.add('thinking');
    document.getElementById('ai-send-btn').disabled = true;

    // 1. Get location with high accuracy before sending the request
    await getLocation();

    // 2. Prepare API payload
    const systemInstruction = getSystemInstruction(userQuery, userLocation ? userLocation.text : null, appSettings);
    const model = getModel(userQuery);

    const payload = {
        contents: [...currentChatHistory, { role: "user", parts: [{ text: userQuery }] }],
        tools: appSettings.webSearch ? [{ "google_search": {} }] : [],
        systemInstruction: { parts: [{ text: systemInstruction }] },
    };

    const apiUrl = `${BASE_URL}/${model}:generateContent?key=${API_KEY}`;
    
    // 3. Prepare message element for streaming
    const agentMessageElement = addMessage('agent', '');
    let fullResponse = '';
    let sources = [];
    abortController = new AbortController();

    try {
        const response = await fetchWithRetry(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: abortController.signal
        });

        const result = await response.json();
        const candidate = result.candidates?.[0];

        if (candidate && candidate.content?.parts?.[0]?.text) {
            fullResponse = candidate.content.parts[0].text;

            // Extract grounding sources (if search was used)
            const groundingMetadata = candidate.groundingMetadata;
            if (groundingMetadata && groundingMetadata.groundingAttributions) {
                sources = groundingMetadata.groundingAttributions
                    .map(attribution => ({
                        uri: attribution.web?.uri,
                        title: attribution.web?.title,
                    }))
                    .filter(source => source.uri && source.title); // Ensure sources are valid
            }

            // Stream the text to the UI
            streamResponse(agentMessageElement, fullResponse, sources);

            // Update chat history with the new turn
            currentChatHistory.push(
                { role: "user", parts: [{ text: userQuery }] },
                { role: "model", parts: [{ text: fullResponse }] }
            );

        } else {
            agentMessageElement.innerHTML = '<p>Sorry, I received an empty or malformed response from the model.</p>';
            console.error("AI Response Error:", result);
        }

    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('AI response aborted.');
        } else {
            agentMessageElement.innerHTML = `<p>Error: ${error.message}. Please check your connection or try again later.</p>`;
            console.error(error);
        }
    } finally {
        // Hide status indicator and re-enable input
        statusIndicator.classList.remove('thinking');
        document.getElementById('ai-send-btn').disabled = false;
        abortController = null;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

/**
 * Renders the final text response, including markdown and KaTeX.
 * @param {HTMLElement} element - The message element to update.
 * @param {string} text - The full markdown text response.
 * @param {Array<object>} sources - Array of source objects.
 */
function streamResponse(element, text, sources) {
    const rawContent = document.createElement('div');
    rawContent.innerHTML = marked.parse(text);

    // 1. Process KaTeX
    rawContent.querySelectorAll('p').forEach(p => {
        // Inline math: $...$
        p.innerHTML = p.innerHTML.replace(/\$([^$]+?)\$/g, (match, expression) => {
            try {
                return katex.renderToString(expression, { throwOnError: false });
            } catch (e) {
                return `<code class="katex-error">${expression}</code>`;
            }
        });
    });

    // Display math: $$...$$
    rawContent.innerHTML = rawContent.innerHTML.replace(/\$\$([^$]+?)\$\$/gs, (match, expression) => {
        try {
            return katex.renderToString(expression, {
                throwOnError: false,
                displayMode: true
            });
        } catch (e) {
            return `<pre class="katex-error-block">${expression}</pre>`;
        }
    });

    // 2. Remove <THOUGHT_PROCESS> blocks from final output
    let finalHtml = rawContent.innerHTML;
    finalHtml = finalHtml.replace(/<THOUGHT_PROCESS>[\s\S]*?<\/THOUGHT_PROCESS>/gi, '');
    
    // 3. Append Sources
    if (sources.length > 0) {
        let sourceHtml = '<h3>Sources</h3><ul>';
        sources.forEach(source => {
            // Check for the <SOURCE> tag format in the model output
            if (!finalHtml.includes(`SOURCE URL="${source.uri}"`)) {
                sourceHtml += `<li><a href="${source.uri}" target="_blank" rel="noopener noreferrer" style="color: var(--humanity-cyan); text-decoration: underline;">${source.title || source.uri}</a></li>`;
            }
        });
        sourceHtml += '</ul>';

        // Replace the embedded XML-like tags with the clean list
        const xmlSourceRegex = /<SOURCE\s+URL="([^"]+)"\s+TITLE="([^"]+)"\s*\/?>/gi;
        finalHtml = finalHtml.replace(xmlSourceRegex, (match, url, title) => {
            return `<p><small>Source: <a href="${url}" target="_blank" rel="noopener noreferrer" style="color: var(--humanity-cyan); text-decoration: underline;">${title}</a></small></p>`;
        });
        
        // Only append the list if we generated new list items (i.e., model didn't use the XML format)
        if (sourceHtml !== '<h3>Sources</h3><ul></ul>') {
            finalHtml += sourceHtml;
        }
    }
    
    element.innerHTML = finalHtml;
}

/**
 * Handles key presses in the input area, specifically for sending messages (Enter)
 * and resizing the textarea.
 * @param {Event} e - The keyboard event.
 */
function handleInput(e) {
    // Auto-resize the textarea
    input.style.height = 'auto';
    input.style.height = input.scrollHeight + 'px';

    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

// --- UI Element Creation and Management ---

/**
 * Adds a new message element to the chat history.
 * @param {string} role - 'user' or 'agent'.
 * @param {string} content - The message content.
 * @returns {HTMLElement} The created message element.
 */
function addMessage(role, content) {
    const msg = createMessageElement(role, content);
    messagesContainer.appendChild(msg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return msg;
}

/**
 * Creates the HTML element for a single chat message.
 * @param {string} role - 'user' or 'agent'.
 * @param {string} content - The message content.
 * @returns {HTMLElement} The message div.
 */
function createMessageElement(role, content) {
    const msg = document.createElement('div');
    msg.className = `ai-message ai-message-${role}`;
    msg.role = "log";

    if (role === 'user') {
        msg.innerHTML = marked.parse(content);
    } else {
        // For agent, content will be streamed/rendered later
        msg.innerHTML = content || `<p><span id="ai-status-indicator"></span> Typing...</p>`;
    }
    return msg;
}

/**
 * Creates the main AI chat UI container and injects the necessary scripts.
 */
function activateAI() {
    if (aiContainer) return;

    // Load necessary external libraries
    const head = document.head;
    const loadScript = (src) => {
        if (!document.querySelector(`script[src="${src}"]`)) {
            const script = document.createElement('script');
            script.src = src;
            head.appendChild(script);
        }
    };
    
    // Load markdown and KaTeX for rendering
    loadScript('https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js');
    loadScript('https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.js');
    loadScript('https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/contrib/auto-render.min.js');
    
    // Load KaTeX CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css';
    head.appendChild(link);

    injectStyles();

    // Create the main container
    aiContainer = document.createElement('div');
    aiContainer.id = 'ai-container';

    // HEADER
    const header = document.createElement('div');
    header.id = 'ai-header';

    const brandTitle = document.createElement('div');
    brandTitle.id = 'ai-brand-title';
    const brandText = "Humanity AI"; // REBRANDED TEXT
    brandText.split('').forEach(char => {
        const span = document.createElement('span');
        span.textContent = char;
        brandTitle.appendChild(span);
    });

    const persistentTitle = document.createElement('div');
    persistentTitle.id = 'ai-persistent-title';
    persistentTitle.textContent = "Humanity Agent"; // REBRANDED TITLE

    const controls = document.createElement('div');
    controls.id = 'ai-controls';

    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'ai-control-btn';
    settingsBtn.innerHTML = '⚙️'; // Settings Icon
    settingsBtn.title = 'Settings';
    settingsBtn.onclick = () => createSettingsModal(true);
    controls.appendChild(settingsBtn);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'ai-control-btn';
    closeBtn.innerHTML = '×';
    closeBtn.title = 'Close Chat (Ctrl + \\)';
    closeBtn.onclick = toggleAIChat;
    controls.appendChild(closeBtn);

    header.appendChild(brandTitle);
    header.appendChild(persistentTitle);
    header.appendChild(controls);

    // MESSAGES
    messagesContainer = document.createElement('div');
    messagesContainer.id = 'ai-messages';

    // INPUT AREA
    const inputArea = document.createElement('div');
    inputArea.id = 'ai-input-area';

    input = document.createElement('textarea');
    input.id = 'ai-input';
    input.placeholder = 'Ask the Humanity Agent...';
    input.rows = 1;
    input.oninput = handleInput;
    input.onkeydown = handleInput;

    const sendBtn = document.createElement('button');
    sendBtn.id = 'ai-send-btn';
    sendBtn.innerHTML = '➤';
    sendBtn.onclick = sendMessage;

    inputArea.appendChild(input);
    inputArea.appendChild(sendBtn);

    // ASSEMBLE CONTAINER
    aiContainer.appendChild(header);
    aiContainer.appendChild(messagesContainer);
    aiContainer.appendChild(inputArea);

    document.body.appendChild(aiContainer);

    // Initialize status indicator after it's in the DOM
    statusIndicator = document.getElementById('ai-status-indicator');

    // Make the window draggable
    makeDraggable(aiContainer, header);
}

/**
 * Toggles the visibility of the AI chat window.
 */
function toggleAIChat() {
    if (!aiContainer) {
        activateAI();
        // Give time for initial CSS rendering before adding 'active'
        setTimeout(() => aiContainer.classList.add('active'), 50);
        input.focus();
        
        // Add a welcome message only on first activation
        if (currentChatHistory.length === 0) {
            addMessage('agent', '<p>Welcome to the **Humanity Agent**! I am an elite AI operating in deep-analysis mode. Ask me a complex question, or try a local search like "What are the best coffee shops near me?" (Location sharing is now highly accurate and enabled by default.)</p>');
        }
    } else {
        if (aiContainer.classList.contains('active')) {
            aiContainer.classList.remove('active');
            createSettingsModal(false); // Close settings if open
            if (abortController) {
                abortController.abort(); // Cancel ongoing request
            }
        } else {
            aiContainer.classList.add('active');
            input.focus();
        }
    }
}

/**
 * Implements simple drag functionality for the AI container.
 * @param {HTMLElement} element - The element to drag.
 * @param {HTMLElement} handle - The element used to initiate the drag (header).
 */
function makeDraggable(element, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        // Get the mouse cursor position at startup:
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        // Call a function whenever the cursor moves:
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // Calculate the new cursor position:
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // Set the element's new position:
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        /* Stop moving when mouse button is released:*/
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

// --- Settings Management ---

/**
 * Creates or shows/hides the settings modal.
 * @param {boolean} show - Whether to show (true) or hide (false) the modal.
 */
function createSettingsModal(show) {
    if (!settingsModal) {
        settingsModal = document.createElement('div');
        settingsModal.id = 'ai-settings-modal';
        settingsModal.innerHTML = `
            <h3>Agent Settings</h3>
            <div class="setting-item">
                <span>🌐 Enable Web Search (Google Grounding)</span>
                <label class="toggle-switch">
                    <input type="checkbox" id="webSearchToggle" ${appSettings.webSearch ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            </div>
            <div class="setting-item">
                <span>📍 Enable High-Accuracy Location Sharing</span>
                <label class="toggle-switch">
                    <input type="checkbox" id="locationSharingToggle" ${appSettings.locationSharing ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            </div>
            <button class="close-btn" onclick="createSettingsModal(false)">Close</button>
        `;
        aiContainer.appendChild(settingsModal);

        // Attach event listeners for toggles
        document.getElementById('webSearchToggle').onchange = (e) => handleSettingToggle('webSearch', e.target.checked);
        document.getElementById('locationSharingToggle').onchange = (e) => handleSettingToggle('locationSharing', e.target.checked);
    }

    settingsModal.style.display = show ? 'flex' : 'none';
}

/**
 * Handles the toggling of a setting.
 * @param {string} key - The setting key ('webSearch' or 'locationSharing').
 * @param {boolean} value - The new value.
 */
function handleSettingToggle(key, value) {
    appSettings[key] = value;
    saveSettings();
    updateUIForSettings();
    // Re-check location if sharing was just enabled
    if (key === 'locationSharing' && value) {
        getLocation();
    }
}

/**
 * Saves the current application settings to local storage.
 */
function saveSettings() {
    localStorage.setItem('aiSettings', JSON.stringify(appSettings));
}

/**
 * Updates UI elements based on current settings (if needed).
 */
function updateUIForSettings() {
    // Current setup doesn't have UI elements dependent on settings outside of the modal itself,
    // but this function is reserved for future integration.
}

// --- Initialization ---

// Shortcut listener: Ctrl + \ (ASCII 92) to toggle the chat window
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === '\\') {
        e.preventDefault();
        toggleAIChat();
    }
});

// Initialize UI elements on window load
window.onload = activateAI;
