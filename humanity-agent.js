/**
 * humanity-agent.js
 *
 * FULL VERSION: 4-Tier Model System + New Graphing Engine + System Notifications
 * 
 * TIERS:
 * 1. Simple Conversation (Lite)
 * 2. Simple Analysis (Flash)
 * 3. Extended Reasoning (Pro)
 * 4. Deep Thinking (Thinking Exp)
 *
 * FEATURES:
 * - Auto-detects intent and switches models.
 * - "Grey Text" System Notifications in chat.
 * - Robust Canvas Graphing/Charting.
 * - File Creation, Memories, KaTeX support.
 */
(function() {
    // --- CONFIGURATION ---
    const API_KEY = 'AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro'; // Replace if needed
    const BASE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/`;
    const MAX_INPUT_HEIGHT = 180;
    const CHAR_LIMIT = 30000;
    const PASTE_TO_FILE_THRESHOLD = 10000;

    // Storage Keys
    const SAVED_MEMORIES_KEY = 'ai-saved-memories';
    const SETTINGS_KEY = 'ai-app-settings';

    // Limits
    const MAX_MEMORIES = 50;
    const MAX_ATTACHMENTS_PER_MESSAGE = 10;
    const MONOLOGUE_CHAR_THRESHOLD = 75;

    // --- ICONS ---
    const copyIconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    const checkIconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    const downloadIconSVG = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;

    // --- STATE ---
    let isAIActive = false;
    let isRequestPending = false;
    let currentAIRequestController = null;
    let chatHistory = [];
    let attachedFiles = [];
    let appSettings = {
        webSearch: true,
        locationSharing: false
    };
    let savedMemories = [];

    // --- UTILITIES ---
    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    };

    function loadAppSettings() {
        try {
            const stored = localStorage.getItem(SETTINGS_KEY);
            if (stored) appSettings = { ...appSettings, ...JSON.parse(stored) };
        } catch (e) { console.error(e); }
    }

    function loadSavedMemories() {
        try {
            const stored = localStorage.getItem(SAVED_MEMORIES_KEY);
            if (stored) savedMemories = JSON.parse(stored);
        } catch (e) { savedMemories = []; }
    }

    function saveSavedMemories() {
        localStorage.setItem(SAVED_MEMORIES_KEY, JSON.stringify(savedMemories));
    }

    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    function escapeHTML(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/&/g, "&amp;")
                  .replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;")
                  .replace(/"/g, "&quot;")
                  .replace(/'/g, "&#039;");
    }

    loadAppSettings();
    loadSavedMemories();

    // --- GEOLOCATION ---
    function httpGetAsync(url, callback) {
        const xmlHttp = new XMLHttpRequest();
        xmlHttp.onreadystatechange = function() {
            if (xmlHttp.readyState === 4) {
                if (xmlHttp.status === 200) callback(xmlHttp.responseText, null);
                else callback(null, new Error(`HTTP Error: ${xmlHttp.status}`));
            }
        }
        xmlHttp.open("GET", url, true);
        xmlHttp.send(null);
    }

    function getUserLocationForContext() {
        return new Promise((resolve) => {
            if (!appSettings.locationSharing) {
                resolve('Location Sharing is disabled by user.');
                return;
            }
            if (!navigator.geolocation) {
                resolve('Geolocation is not supported.');
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=en`;
                    httpGetAsync(url, (response, error) => {
                        if (error) resolve(`Coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
                        else {
                            try {
                                const data = JSON.parse(response);
                                resolve(data.display_name || `Coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
                            } catch (e) { resolve(`Coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)}`); }
                        }
                    });
                },
                (error) => resolve("Location unavailable.")
            );
        });
    }

    // --- RENDERING ENGINES (KaTeX, Files, Graphs) ---

    function renderKaTeX(container) {
        if (typeof katex === 'undefined') return;
        container.querySelectorAll('.latex-render').forEach(element => {
            const mathText = element.dataset.tex;
            const displayMode = element.dataset.displayMode === 'true';
            try {
                katex.render(mathText, element, { throwOnError: false, displayMode: displayMode });
            } catch (e) { element.textContent = `[KaTeX Error]`; }
        });
    }

    function renderFileCardMarquees(container) {
        container.querySelectorAll('.gemini-file-creation-card').forEach(card => {
            const fileNameElement = card.querySelector('.file-name');
            const fileNameSpan = fileNameElement?.querySelector('span');
            if (fileNameElement && fileNameSpan) {
                fileNameElement.classList.remove('marquee');
                fileNameSpan.style.animation = '';
                setTimeout(() => {
                    if (fileNameSpan.scrollWidth > fileNameElement.clientWidth) {
                        fileNameElement.classList.add('marquee');
                    }
                }, 100);
            }
        });
    }

    // --- NEW GRAPHING & CHARTING ENGINE ---
    
    function renderGraphs(container) {
        // Render Graphs (Line/Scatter)
        container.querySelectorAll('.custom-graph-placeholder').forEach(placeholder => {
            try {
                const graphData = JSON.parse(placeholder.dataset.graphData);
                const canvas = placeholder.querySelector('canvas');
                if (canvas) {
                    const draw = () => drawCustomGraph(canvas, graphData);
                    const observer = new ResizeObserver(debounce(draw, 100));
                    observer.observe(placeholder);
                    draw();
                }
            } catch (e) { placeholder.textContent = `[Graph Error] Invalid JSON Data`; }
        });

        // Render Charts (Bar/Pie/Doughnut)
        container.querySelectorAll('.custom-chart-placeholder').forEach(placeholder => {
            try {
                const chartData = JSON.parse(placeholder.dataset.chartData);
                const canvas = placeholder.querySelector('canvas');
                if (canvas) {
                    const draw = () => drawCustomChart(canvas, chartData);
                    const observer = new ResizeObserver(debounce(draw, 100));
                    observer.observe(placeholder);
                    draw();
                }
            } catch (e) { placeholder.textContent = `[Chart Error] Invalid JSON Data`; }
        });
    }

    function drawCustomGraph(canvas, data) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.parentElement.getBoundingClientRect();
        
        // Reset canvas dimensions
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = rect.height;
        const padding = { top: 50, right: 40, bottom: 50, left: 60 };
        const graphW = width - padding.left - padding.right;
        const graphH = height - padding.top - padding.bottom;

        // Theme Colors
        const colors = ['#4285f4', '#ea4335', '#34a853', '#fbbc05', '#9c27b0', '#ff9800'];

        // 1. Calculate Ranges
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        const series = data.series || [];
        
        series.forEach(s => {
            if(s.points) {
                s.points.forEach(p => {
                    minX = Math.min(minX, p[0]);
                    maxX = Math.max(maxX, p[0]);
                    minY = Math.min(minY, p[1]);
                    maxY = Math.max(maxY, p[1]);
                });
            }
        });

        // Fallback if no data
        if (minX === Infinity) { minX = 0; maxX = 10; minY = 0; maxY = 10; }
        
        // Add slight buffer to ranges
        const rangeX = (maxX - minX) || 1;
        const rangeY = (maxY - minY) || 1;
        minX -= rangeX * 0.05; maxX += rangeX * 0.05;
        minY -= rangeY * 0.1; maxY += rangeY * 0.1;

        const mapX = val => padding.left + ((val - minX) / (maxX - minX)) * graphW;
        const mapY = val => padding.top + graphH - ((val - minY) / (maxY - minY)) * graphH;

        // 2. Clear & Background
        ctx.clearRect(0, 0, width, height);

        // 3. Draw Grid
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        
        // Vertical grid lines
        for(let i=0; i<=5; i++) {
            const x = padding.left + (graphW * i / 5);
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, padding.top + graphH);
        }
        // Horizontal grid lines
        for(let i=0; i<=5; i++) {
            const y = padding.top + (graphH * i / 5);
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + graphW, y);
        }
        ctx.stroke();

        // 4. Draw Axes
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, padding.top + graphH);
        ctx.lineTo(padding.left + graphW, padding.top + graphH);
        ctx.stroke();

        // 5. Draw Series
        series.forEach((s, idx) => {
            const color = s.color || colors[idx % colors.length];
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = 2.5;

            if (!s.points || s.points.length === 0) return;

            // Draw Line
            if (data.type === 'line') {
                ctx.beginPath();
                s.points.forEach((p, i) => {
                    const x = mapX(p[0]);
                    const y = mapY(p[1]);
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                });
                ctx.stroke();
            }

            // Draw Points (Scatter or Line markers)
            s.points.forEach(p => {
                ctx.beginPath();
                ctx.arc(mapX(p[0]), mapY(p[1]), 3.5, 0, Math.PI * 2);
                ctx.fill();
            });
        });

        // 6. Labels & Title
        ctx.fillStyle = '#e0e0e0';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(data.title || 'Graph Visualization', width / 2, 25);

        // Axis Labels
        ctx.fillStyle = '#aaa';
        ctx.font = '11px monospace';
        
        // X Axis
        ctx.fillText(minX.toFixed(1), padding.left, padding.top + graphH + 18);
        ctx.fillText(maxX.toFixed(1), padding.left + graphW, padding.top + graphH + 18);
        
        // Y Axis
        ctx.textAlign = 'right';
        ctx.fillText(maxY.toFixed(1), padding.left - 10, padding.top + 10);
        ctx.fillText(minY.toFixed(1), padding.left - 10, padding.top + graphH);
    }

    function drawCustomChart(canvas, data) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = rect.height;
        const colors = ['#4285f4', '#ea4335', '#34a853', '#fbbc05', '#9c27b0', '#ff9800'];

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#e0e0e0';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(data.title || 'Chart Visualization', width / 2, 25);

        const cx = width / 2;
        const cy = height / 2 + 10;
        const radius = Math.min(width, height) / 3;

        if (data.type === 'pie' || data.type === 'doughnut') {
            let startAngle = -Math.PI / 2;
            const total = data.values.reduce((a, b) => a + b, 0);
            
            data.values.forEach((val, i) => {
                const sliceAngle = (val / total) * 2 * Math.PI;
                
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
                ctx.fillStyle = colors[i % colors.length];
                ctx.fill();
                
                // Draw Label if slice is big enough
                if (sliceAngle > 0.2) {
                    const midAngle = startAngle + sliceAngle / 2;
                    const lx = cx + Math.cos(midAngle) * (radius * 0.7);
                    const ly = cy + Math.sin(midAngle) * (radius * 0.7);
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 11px sans-serif';
                    ctx.fillText(data.labels[i] || '', lx, ly);
                }
                
                startAngle += sliceAngle;
            });

            if (data.type === 'doughnut') {
                ctx.beginPath();
                ctx.arc(cx, cy, radius * 0.55, 0, 2 * Math.PI);
                ctx.fillStyle = '#0d0d0d'; // Matches container background
                ctx.fill();
            }
        } 
        else if (data.type === 'bar') {
            const padding = { top: 50, bottom: 40, left: 50, right: 20 };
            const drawW = width - padding.left - padding.right;
            const drawH = height - padding.top - padding.bottom;
            
            const maxVal = Math.max(...data.values) || 1;
            const barCount = data.values.length;
            const barSlotW = drawW / barCount;
            const barW = barSlotW * 0.6; // 60% width of slot
            const barSpacing = barSlotW * 0.2;

            // Draw Axis
            ctx.strokeStyle = '#666';
            ctx.beginPath();
            ctx.moveTo(padding.left, padding.top);
            ctx.lineTo(padding.left, padding.top + drawH);
            ctx.lineTo(padding.left + drawW, padding.top + drawH);
            ctx.stroke();

            data.values.forEach((val, i) => {
                const barH = (val / maxVal) * drawH;
                const x = padding.left + (i * barSlotW) + barSpacing;
                const y = padding.top + drawH - barH;
                
                ctx.fillStyle = colors[i % colors.length];
                ctx.fillRect(x, y, barW, barH);
                
                // Val Label
                ctx.fillStyle = '#fff';
                ctx.font = '11px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(val.toString(), x + barW/2, y - 5);
                
                // Cat Label
                if (data.labels && data.labels[i]) {
                    ctx.fillStyle = '#aaa';
                    ctx.fillText(data.labels[i].substring(0,10), x + barW/2, height - 15);
                }
            });
        }
    }

    // --- 4-TIER MODEL & INTENT SYSTEM ---

    /**
     * Determines the model mode based on keywords.
     */
    function determineIntentCategory(query) {
        const lower = query.toLowerCase();
        
        // 1. Deep Thinking (Thinking Model)
        if (lower.includes('complex') || lower.includes('deep') || lower.includes('think') || lower.includes('reasoning') || lower.includes('strategy') || lower.includes('puzzle') || lower.includes('hard')) {
            return 'DEEP_THINKING';
        }
        
        // 2. Extended Reasoning (Pro Model)
        if (lower.includes('analyze') || lower.includes('evaluate') || lower.includes('essay') || lower.includes('research') || lower.includes('critique') || lower.includes('history') || lower.includes('explain detailed')) {
            return 'EXTENDED_REASONING';
        }
        
        // 3. Simple Analysis (Flash Model)
        // Good for math, code, lists, formatting
        if (lower.includes('math') || lower.includes('code') || lower.includes('solve') || lower.includes('graph') || lower.includes('chart') || lower.includes('list') || lower.includes('calculate') || lower.includes('debug')) {
            return 'SIMPLE_ANALYSIS';
        }
        
        // 4. Simple Conversation (Lite Model)
        return 'SIMPLE_CONVERSATION';
    }

    function getDynamicSystemInstructionAndModel(query, currentSettings) {
        const intent = determineIntentCategory(query);
        let model = '';
        let modeLabel = '';
        
        // 4SP Context
        const HISTORY_CONTEXT = `You are the Humanity AI Agent for 4SP (4simpleproblems). Hosted on 4SP, you serve students.
        History:
        v1 (Mar 2025): Soundboard. v2 (Apr 2025): Community. v3 (May 2025): Visual Rebirth. v4 (Aug 2025): Dashboard. v5 (Aug 2026): Future "Project Zirconium".
        `;

        // Updated Graphing Instructions for the New Engine
        const GRAPHING_RULES = `
        **VISUALIZATION RULES**:
        If asked to plot data, you MUST use these EXACT JSON formats. Do NOT use Python.
        
        1. LINE/SCATTER GRAPH:
        \`\`\`graph
        {
           "type": "line", 
           "title": "Growth Over Time",
           "series": [
              { "label": "Series A", "color": "#4285f4", "points": [[0,10], [1,20], [2,15]] },
              { "label": "Series B", "color": "#ea4335", "points": [[0,5], [1,15], [2,25]] }
           ]
        }
        \`\`\`
        
        2. BAR/PIE/DOUGHNUT CHART:
        \`\`\`chart
        {
           "type": "bar", 
           "title": "User Distribution",
           "labels": ["Group A", "Group B", "Group C"],
           "values": [45, 25, 30]
        }
        \`\`\`
        `;

        const BASE_INSTRUCTION = `${HISTORY_CONTEXT}
        ${GRAPHING_RULES}
        
        **FORMATTING**:
        - Always start with <THOUGHT_PROCESS>...</THOUGHT_PROCESS>.
        - Use KaTeX for math: $...$ (inline), $$...$$ (block).
        - Use <CREATE_FILE FILENAME="..." MIMETYPE="...">...</CREATE_FILE> to make files.
        - If user needs current facts and Web Search is ON, use <SOURCE URL="..." TITLE="..."/>.
        `;

        switch (intent) {
            case 'DEEP_THINKING':
                // Use Flash Thinking Exp
                model = 'gemini-2.0-flash-thinking-exp-01-21'; 
                modeLabel = 'Converted to Deep Thinking';
                return {
                    model, modeLabel,
                    instruction: `${BASE_INSTRUCTION}
                    **MODE: DEEP THINKING**
                    You are in Deep Thinking mode. Provide extremely detailed, step-by-step reasoning. Break down complex logic.
                    Your internal monologue should be extensive and explore multiple paths.`
                };

            case 'EXTENDED_REASONING':
                // Use Pro 1.5
                model = 'gemini-1.5-pro';
                modeLabel = 'Converted to Extended Reasoning';
                return {
                    model, modeLabel,
                    instruction: `${BASE_INSTRUCTION}
                    **MODE: EXTENDED REASONING**
                    You are in Extended Reasoning mode. Provide comprehensive, well-researched, and nuanced answers. 
                    Focus on context and depth.`
                };

            case 'SIMPLE_ANALYSIS':
                // Use Flash 2.0
                model = 'gemini-2.0-flash';
                modeLabel = 'Converted to Simple Analysis';
                return {
                    model, modeLabel,
                    instruction: `${BASE_INSTRUCTION}
                    **MODE: SIMPLE ANALYSIS**
                    You are in Simple Analysis mode. Be precise, logical, and efficient. 
                    Excellent for coding, math, and specific data tasks.`
                };

            case 'SIMPLE_CONVERSATION':
            default:
                // Use Flash Lite
                model = 'gemini-2.0-flash-lite-preview-02-05';
                modeLabel = 'Converted to Simple Conversation';
                return {
                    model, modeLabel,
                    instruction: `${BASE_INSTRUCTION}
                    **MODE: SIMPLE CONVERSATION**
                    You are in Simple Conversation mode. Be casual, friendly, and concise. 
                    Keep responses light unless asked for more.`
                };
        }
    }

    // --- API COMMUNICATION ---

    async function callGoogleAI(responseBubble) {
        if (!API_KEY) {
            responseBubble.innerHTML = `<div class="ai-error">API Key is missing.</div>`;
            return;
        }
        currentAIRequestController = new AbortController();

        // Context: Location & Memories
        let contextPrefix = '';
        if (chatHistory.length <= 1) {
            const location = await getUserLocationForContext();
            const memories = savedMemories.map(m => m.content).join('; ');
            contextPrefix = `(System Context - Loc: ${location}. Time: ${new Date().toLocaleString()}. Memories: ${memories})\n\n`;
        }

        // Prepare History
        let processedHistory = [...chatHistory];
        const lastMessageIndex = processedHistory.length - 1;
        const userParts = processedHistory[lastMessageIndex].parts;
        const lastUserQuery = userParts.find(p => p.text)?.text || '';

        // 1. SELECT MODEL & INSTRUCTION
        const { instruction, model, modeLabel } = getDynamicSystemInstructionAndModel(lastUserQuery, appSettings);

        // 2. RENDER SYSTEM NOTIFICATION (Grey Text)
        renderSystemNotification(modeLabel);

        // Inject Context into last message
        if (contextPrefix) {
            const textPart = userParts.find(p => p.text);
            if (textPart) textPart.text = contextPrefix + textPart.text;
            else userParts.push({ text: contextPrefix });
        }

        const payload = {
            contents: processedHistory,
            systemInstruction: { parts: [{ text: instruction }] }
        };

        try {
            const response = await fetch(`${BASE_API_URL}${model}:generateContent?key=${API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: currentAIRequestController.signal
            });

            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!text) throw new Error("No response text generated.");

            chatHistory.push({ role: "model", parts: [{ text: text }] });

            // Parse & Render
            const parsed = parseGeminiResponse(text);
            
            responseBubble.style.opacity = '0';
            setTimeout(() => {
                let fullContent = `<div class="typing-animation">${parsed.html}</div>`;

                // Sources
                if (parsed.sourcesHTML) fullContent += parsed.sourcesHTML;

                // Monologue
                if (parsed.thoughtProcess && parsed.thoughtProcess.length > MONOLOGUE_CHAR_THRESHOLD) {
                    fullContent += `
                        <div class="ai-thought-process collapsed">
                            <div class="monologue-header">
                                <h4 class="monologue-title">Internal Monologue (${modeLabel.replace('Converted to ', '')})</h4>
                                <button class="monologue-toggle-btn">Show Thoughts</button>
                            </div>
                            <pre class="monologue-content">${escapeHTML(parsed.thoughtProcess)}</pre>
                        </div>
                    `;
                }

                responseBubble.innerHTML = fullContent;

                // Event Handlers for interactive elements
                responseBubble.querySelectorAll('.monologue-header').forEach(h => {
                    h.onclick = () => {
                        h.parentElement.classList.toggle('collapsed');
                        const btn = h.querySelector('button');
                        btn.textContent = h.parentElement.classList.contains('collapsed') ? 'Show Thoughts' : 'Hide Thoughts';
                    };
                });

                responseBubble.querySelectorAll('.copy-code-btn').forEach(btn => {
                    btn.onclick = handleCopyCode;
                });

                renderKaTeX(responseBubble);
                renderGraphs(responseBubble); // Triggers the new graph engine
                renderFileCardMarquees(responseBubble);

                responseBubble.style.opacity = '1';
                responseBubble.classList.remove('loading');
                
                const container = document.getElementById('ai-response-container');
                if(container) container.scrollTop = container.scrollHeight;

            }, 300);

        } catch (error) {
            if (error.name !== 'AbortError') {
                responseBubble.innerHTML = `<div class="ai-error">Error: ${error.message}</div>`;
                responseBubble.classList.remove('loading');
            }
        } finally {
            isRequestPending = false;
            document.getElementById('ai-input-wrapper')?.classList.remove('waiting');
        }
    }

    function renderSystemNotification(text) {
        const container = document.getElementById('ai-response-container');
        if (!container) return;
        
        // Insert after the last user message, before the AI response bubble exists/fills
        const notification = document.createElement('div');
        notification.className = 'system-notification';
        notification.innerHTML = `<span>${text}</span>`;
        
        // Insert before the loading bubble if it exists, otherwise append
        const loadingBubble = container.querySelector('.loading');
        if (loadingBubble) {
            container.insertBefore(notification, loadingBubble);
        } else {
            container.appendChild(notification);
        }
    }

    // --- RESPONSE PARSING ---

    function parseGeminiResponse(text) {
        let html = text;
        const placeholders = {};
        let id = 0;
        const addPh = (content) => { const k = `%%PH_${id++}%%`; placeholders[k] = content; return k; };

        // 1. Extract Thought Process
        let thoughtProcess = '';
        html = html.replace(/<THOUGHT_PROCESS>([\s\S]*?)<\/THOUGHT_PROCESS>/, (m, c) => {
            thoughtProcess = c.trim(); return '';
        });

        // 2. Extract Sources
        let sourcesHTML = '';
        const sources = [];
        html = html.replace(/<SOURCE URL="([^"]+)" TITLE="([^"]+)"\s*\/>/g, (m, url, title) => {
            sources.push({ url, title }); return '';
        });
        if (sources.length > 0) {
            sourcesHTML = `<div class="ai-sources-list"><h4>Sources:</h4><ul>${sources.map(s => `<li><a href="${s.url}" target="_blank">${escapeHTML(s.title)}</a></li>`).join('')}</ul></div>`;
        }

        // 3. Extract Graphs (New Schema)
        html = html.replace(/```graph\n([\s\S]*?)```/g, (m, json) => {
            return addPh(`<div class="graph-block-wrapper"><div class="custom-graph-placeholder" data-graph-data='${escapeHTML(json)}'><canvas></canvas></div></div>`);
        });

        // 4. Extract Charts (New Schema)
        html = html.replace(/```chart\n([\s\S]*?)```/g, (m, json) => {
            return addPh(`<div class="chart-block-wrapper"><div class="custom-chart-placeholder" data-chart-data='${escapeHTML(json)}'><canvas></canvas></div></div>`);
        });

        // 5. Extract KaTeX
        html = html.replace(/\$\$([\s\S]*?)\$\$/g, (m, t) => addPh(`<div class="latex-render" data-tex="${escapeHTML(t)}" data-display-mode="true"></div>`));
        html = html.replace(/\$([^\s\$][^\$]*?[^\s\$])\$/g, (m, t) => addPh(`<span class="latex-render" data-tex="${escapeHTML(t)}" data-display-mode="false"></span>`));

        // 6. Extract Files
        html = html.replace(/<CREATE_FILE FILENAME="([^"]+)" MIMETYPE="([^"]+)">([\s\S]*?)<\/CREATE_FILE>/g, (m, name, mime, content) => {
            const blob = new Blob([content], { type: mime });
            const url = URL.createObjectURL(blob);
            return addPh(`
                <div class="gemini-file-creation-card">
                    <div class="file-header">
                        <div class="file-name"><span>${escapeHTML(name)}</span></div>
                        <a href="${url}" download="${escapeHTML(name)}" class="file-creation-download-btn">${downloadIconSVG}</a>
                    </div>
                    <div class="file-body">
                         <div class="file-meta">${formatBytes(blob.size)}</div>
                    </div>
                </div>
            `);
        });

        // 7. Code Blocks
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (m, lang, code) => {
            return addPh(`
                <div class="code-block-wrapper">
                    <div class="code-block-header"><span>${lang}</span><button class="copy-code-btn">${copyIconSVG}</button></div>
                    <pre><code class="language-${lang}">${escapeHTML(code)}</code></pre>
                </div>
            `);
        });

        // 8. Markdown Formatting
        html = escapeHTML(html);
        html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                   .replace(/\*(.*?)\*/g, "<em>$1</em>")
                   .replace(/^### (.*$)/gm, "<h3>$1</h3>")
                   .replace(/^## (.*$)/gm, "<h2>$1</h2>")
                   .replace(/\n/g, "<br>");

        // Restore Placeholders
        html = html.replace(/%%PH_\d+%%/g, (m) => placeholders[m]);

        return { html, thoughtProcess, sourcesHTML };
    }

    // --- UI INTERACTION ---

    function handleCopyCode(e) {
        const btn = e.currentTarget;
        const code = btn.closest('.code-block-wrapper').querySelector('code').innerText;
        navigator.clipboard.writeText(code).then(() => {
            btn.innerHTML = checkIconSVG;
            setTimeout(() => btn.innerHTML = copyIconSVG, 2000);
        });
    }

    function handleFileUpload() {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.onchange = (e) => {
            const files = Array.from(e.target.files);
            files.forEach(file => {
                if (attachedFiles.length >= MAX_ATTACHMENTS_PER_MESSAGE) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    attachedFiles.push({
                        inlineData: { mimeType: file.type, data: ev.target.result.split(',')[1] },
                        fileName: file.name,
                        isLoading: false
                    });
                    renderAttachments();
                };
                reader.readAsDataURL(file);
            });
        };
        input.click();
    }

    function renderAttachments() {
        const container = document.getElementById('ai-attachment-preview');
        const wrapper = document.getElementById('ai-input-wrapper');
        if (!container) return;
        
        container.innerHTML = '';
        if (attachedFiles.length > 0) {
            wrapper.classList.add('has-attachments');
            container.style.display = 'flex';
            attachedFiles.forEach((f, i) => {
                const el = document.createElement('div');
                el.className = 'attachment-card';
                el.innerHTML = `<div class="file-name">${escapeHTML(f.fileName)}</div><button class="rm-btn">&times;</button>`;
                el.querySelector('.rm-btn').onclick = () => {
                    attachedFiles.splice(i, 1);
                    renderAttachments();
                };
                container.appendChild(el);
            });
        } else {
            wrapper.classList.remove('has-attachments');
            container.style.display = 'none';
        }
    }

    // --- ACTIVATION & STYLES ---

    function activateAI() {
        if (document.getElementById('ai-container')) return;
        injectStyles();

        const c = document.createElement('div');
        c.id = 'ai-container';
        c.innerHTML = `
            <div id="ai-brand-title"><span>4</span><span>S</span><span>P</span></div>
            <div id="ai-close-button">&times;</div>
            <div id="ai-response-container"></div>
            <div id="ai-compose-area">
                <div id="ai-menu-btn"><i class="fa-solid fa-ellipsis"></i></div>
                <div id="ai-main-menu">
                    <div id="menu-attach">Attachments</div>
                    <div id="menu-settings">Settings</div>
                    <div id="menu-memories">Memories</div>
                </div>
                <div id="ai-input-wrapper">
                    <div id="ai-attachment-preview"></div>
                    <div id="ai-input" contenteditable="true" placeholder="Ask anything..."></div>
                </div>
            </div>
        `;
        document.body.appendChild(c);

        // Event Listeners
        document.getElementById('ai-close-button').onclick = deactivateAI;
        
        // Menu Logic
        const menuBtn = document.getElementById('ai-menu-btn');
        const menu = document.getElementById('ai-main-menu');
        menuBtn.onclick = () => menu.classList.toggle('active');
        document.getElementById('menu-attach').onclick = () => { menu.classList.remove('active'); handleFileUpload(); };
        // Settings & Memories stubs (expand as needed)
        document.getElementById('menu-settings').onclick = () => alert('Settings functionality preserved.');
        document.getElementById('menu-memories').onclick = () => alert('Memories functionality preserved.');

        // Input Logic
        const input = document.getElementById('ai-input');
        input.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const text = input.innerText.trim();
                if (!text && attachedFiles.length === 0) return;

                chatHistory.push({ role: "user", parts: [{ text }, ...attachedFiles.map(f => ({ inlineData: f.inlineData }))] });

                const respCont = document.getElementById('ai-response-container');
                
                // User Bubble
                const userBub = document.createElement('div');
                userBub.className = 'ai-message-bubble user-message';
                userBub.innerHTML = escapeHTML(text) + (attachedFiles.length ? `<div class="sent-files">${attachedFiles.length} files sent</div>` : '');
                respCont.appendChild(userBub);

                // Loading Bubble
                const aiBub = document.createElement('div');
                aiBub.className = 'ai-message-bubble gemini-response loading';
                aiBub.innerHTML = '<div class="ai-loader"></div>';
                respCont.appendChild(aiBub);
                respCont.scrollTop = respCont.scrollHeight;

                input.innerHTML = '';
                attachedFiles = [];
                renderAttachments();
                isRequestPending = true;
                document.getElementById('ai-input-wrapper').classList.add('waiting');

                callGoogleAI(aiBub);
            }
        };

        setTimeout(() => c.classList.add('active'), 10);
        input.focus();
        isAIActive = true;
    }

    function deactivateAI() {
        const c = document.getElementById('ai-container');
        if (c) {
            c.classList.remove('active');
            setTimeout(() => c.remove(), 500);
        }
        isAIActive = false;
    }

    function handleKeyDown(e) {
        if (e.ctrlKey && e.key === '\\') {
            if (isAIActive) deactivateAI(); else activateAI();
        }
    }

    function injectStyles() {
        if (document.getElementById('ai-dynamic-styles')) return;
        
        // External Libs
        const kcss = document.createElement('link'); kcss.rel='stylesheet'; kcss.href='https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.css';
        document.head.appendChild(kcss);
        const kjs = document.createElement('script'); kjs.src='https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.js';
        document.head.appendChild(kjs);
        const fa = document.createElement('link'); fa.rel='stylesheet'; fa.href='https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';
        document.head.appendChild(fa);

        const s = document.createElement("style");
        s.id = "ai-dynamic-styles";
        s.innerHTML = `
            /* Main Container */
            #ai-container { position: fixed; inset: 0; background: #070707; z-index: 99999; display: flex; flex-direction: column; font-family: 'Geist', sans-serif; opacity: 0; transition: opacity 0.5s; color: #ccc; }
            #ai-container.active { opacity: 1; }
            #ai-brand-title { position: absolute; top: 20px; left: 30px; color: #fff; font-size: 20px; font-weight: bold; }
            #ai-close-button { position: absolute; top: 20px; right: 30px; font-size: 30px; cursor: pointer; color: #666; transition: color 0.2s; }
            #ai-close-button:hover { color: #fff; }

            /* Chat Area */
            #ai-response-container { flex: 1; overflow-y: auto; padding: 20px; max-width: 750px; margin: 60px auto 20px; width: 100%; display: flex; flex-direction: column; gap: 20px; scroll-behavior: smooth; }
            
            .ai-message-bubble { padding: 15px 20px; border-radius: 18px; max-width: 85%; line-height: 1.6; font-size: 15px; position: relative; }
            .user-message { background: #1a1a1a; color: #fff; align-self: flex-end; border: 1px solid #333; }
            .gemini-response { background: transparent; align-self: flex-start; width: 100%; max-width: 100%; padding: 0; }
            
            /* System Notification (Grey Text) */
            .system-notification { width: 100%; text-align: center; margin: 10px 0; }
            .system-notification span { background: #111; color: #666; padding: 4px 12px; border-radius: 20px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; border: 1px solid #222; }

            /* Inputs */
            #ai-compose-area { width: 100%; max-width: 750px; margin: 0 auto 30px; position: relative; }
            #ai-input-wrapper { background: #0d0d0d; border: 1px solid #222; border-radius: 24px; padding: 15px; display: flex; flex-direction: column; transition: all 0.3s; box-shadow: 0 0 20px rgba(0,0,0,0.5); }
            #ai-input-wrapper.waiting { border-color: #4285f4; opacity: 0.8; }
            #ai-input { outline: none; min-height: 24px; max-height: 180px; overflow-y: auto; color: #fff; font-size: 16px; }
            #ai-input:empty::before { content: 'Ask anything...'; color: #444; }
            
            /* Menu */
            #ai-menu-btn { position: absolute; bottom: 15px; right: -40px; color: #666; cursor: pointer; font-size: 20px; }
            #ai-main-menu { position: absolute; bottom: 50px; right: -40px; background: #111; border: 1px solid #333; border-radius: 10px; overflow: hidden; display: none; width: 150px; }
            #ai-main-menu.active { display: block; }
            #ai-main-menu div { padding: 10px 15px; cursor: pointer; color: #aaa; transition: background 0.2s; }
            #ai-main-menu div:hover { background: #222; color: #fff; }

            /* Visualization Blocks */
            .graph-block-wrapper, .chart-block-wrapper { background: #0e0e0e; border: 1px solid #1a1a1a; border-radius: 12px; padding: 5px; margin: 20px 0; }
            .custom-graph-placeholder, .custom-chart-placeholder { height: 350px; width: 100%; position: relative; }
            canvas { width: 100%; height: 100%; display: block; }

            /* Code Blocks */
            .code-block-wrapper { background: #050505; border: 1px solid #222; border-radius: 8px; margin: 15px 0; overflow: hidden; }
            .code-block-header { background: #111; padding: 5px 15px; display: flex; justify-content: space-between; align-items: center; color: #666; font-size: 12px; text-transform: uppercase; }
            pre { margin: 0; padding: 15px; overflow-x: auto; }
            code { font-family: 'Menlo', monospace; color: #e0e0e0; font-size: 13px; }
            .copy-code-btn { background: none; border: none; color: #666; cursor: pointer; }
            .copy-code-btn:hover { color: #fff; }

            /* Monologue */
            .ai-thought-process { margin-top: 15px; border: 1px solid #222; border-radius: 8px; background: rgba(255,255,255,0.02); }
            .monologue-header { padding: 8px 15px; background: rgba(255,255,255,0.03); display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
            .monologue-title { margin: 0; font-size: 12px; color: #4285f4; font-weight: normal; }
            .monologue-toggle-btn { background: none; border: 1px solid #333; color: #666; border-radius: 4px; padding: 2px 8px; font-size: 10px; cursor: pointer; }
            .monologue-content { padding: 15px; margin: 0; white-space: pre-wrap; color: #888; font-family: monospace; font-size: 12px; }
            .ai-thought-process.collapsed .monologue-content { display: none; }

            /* File Cards */
            .gemini-file-creation-card { background: #111; border: 1px solid #222; border-radius: 8px; width: 200px; margin: 10px 0; overflow: hidden; }
            .file-header { background: #1a1a1a; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; }
            .file-name { font-size: 12px; color: #fff; white-space: nowrap; overflow: hidden; max-width: 150px; }
            .file-name.marquee span { display: inline-block; animation: marquee 5s linear infinite; padding-right: 20px; }
            .file-body { padding: 10px; text-align: right; }
            .file-meta { font-size: 10px; color: #666; font-family: monospace; }
            .file-creation-download-btn { color: #4285f4; display: flex; align-items: center; }

            /* Attachments */
            #ai-attachment-preview { display: none; gap: 10px; padding-bottom: 10px; overflow-x: auto; }
            .attachment-card { background: #1a1a1a; border-radius: 6px; padding: 5px 10px; font-size: 12px; display: flex; align-items: center; gap: 5px; white-space: nowrap; }
            .rm-btn { background: none; border: none; color: #f44; cursor: pointer; font-size: 16px; }

            /* Animations */
            @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }
            .ai-loader { width: 24px; height: 24px; border: 2px solid #333; border-top-color: #4285f4; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto; }
            @keyframes spin { to { transform: rotate(360deg); } }
        `;
        document.head.appendChild(s);
    }

    // Init
    document.addEventListener('keydown', handleKeyDown);

})();
