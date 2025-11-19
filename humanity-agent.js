/**
 * humanity-agent.js
 * * FULL VERSION: 3.1
 * THEME: 4SP Integrated (Indigo #4f46e5 / Dark #070707)
 * * UPDATES:
 * - Models: gemini-3-pro-preview & gemini-flash-latest
 * - UI: Added Exit Button, Widened Input Bar
 */
(function() {
    // ==========================================================================
    // --- 1. CONFIGURATION & CONSTANTS ---
    // ==========================================================================
    const API_KEY = 'AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro';
    const BASE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/`;
    const MAX_INPUT_HEIGHT = 180;
    const SAVED_MEMORIES_KEY = 'ai-saved-memories';
    const APP_SETTINGS_KEY = 'ai-app-settings';
    const MAX_MEMORIES = 50;
    const MAX_ATTACHMENTS_PER_MESSAGE = 10;
    const MONOLOGUE_CHAR_THRESHOLD = 75;

    // --- ICONS ---
    const ICONS = {
        copy: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
        check: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
        download: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
        trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
        close: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
    };

    // ==========================================================================
    // --- 2. STATE MANAGEMENT ---
    // ==========================================================================
    let isAIActive = false;
    let isRequestPending = false;
    let currentAIRequestController = null;
    let chatHistory = [];
    let attachedFiles = [];
    
    let appSettings = {
        webSearch: true,
        locationSharing: false,
        creativity: 1.0,       
        thinkingLevel: "HIGH"  
    };
    
    let savedMemories = [];

    // ==========================================================================
    // --- 3. HELPER FUNCTIONS ---
    // ==========================================================================
    
    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    };

    function escapeHTML(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/[&<>'"]/g, tag => ({'&': '&amp;','<': '&lt;','>': '&gt;',"'": '&#39;','"': '&quot;'}[tag]));
    }

    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

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

    // ==========================================================================
    // --- 4. DATA STORAGE ---
    // ==========================================================================

    function loadAppSettings() {
        try {
            const stored = localStorage.getItem(APP_SETTINGS_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                appSettings = { ...appSettings, ...parsed };
                if (typeof appSettings.creativity !== 'number') appSettings.creativity = 1.0;
                if (appSettings.thinkingLevel !== "LOW" && appSettings.thinkingLevel !== "HIGH") appSettings.thinkingLevel = "HIGH";
            }
        } catch (e) { console.error("Error loading settings:", e); }
    }

    function saveAppSettings() {
        try { localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(appSettings)); } catch (e) {}
    }

    function loadSavedMemories() {
        try {
            const stored = localStorage.getItem(SAVED_MEMORIES_KEY);
            if (stored) savedMemories = JSON.parse(stored);
        } catch (e) { savedMemories = []; }
    }

    function saveSavedMemories() {
        try { localStorage.setItem(SAVED_MEMORIES_KEY, JSON.stringify(savedMemories)); } catch (e) {}
    }

    loadAppSettings();
    loadSavedMemories();

    // ==========================================================================
    // --- 5. CONTEXT & LOGIC ---
    // ==========================================================================

    function getUserLocationForContext() {
        return new Promise((resolve) => {
            if (!appSettings.locationSharing) { resolve('Location Sharing is disabled.'); return; }
            if (!navigator.geolocation) { resolve('Geolocation not supported.'); return; }
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
                () => resolve("Location unavailable."),
                { enableHighAccuracy: true }
            );
        });
    }

    function determineIntentCategory(query) {
        const lower = query.toLowerCase();
        if (lower.includes('analyze') || lower.includes('deep dive') || lower.includes('complex') || 
            lower.includes('why') || lower.includes('reasoning') || lower.includes('strategy')) {
            return 'DEEP_ANALYSIS';
        }
        if (lower.includes('math') || lower.includes('code') || lower.includes('solve') || 
            lower.includes('formula') || lower.includes('script') || lower.includes('debug')) {
            return 'PROFESSIONAL_MATH';
        }
        if (lower.includes('story') || lower.includes('creative') || lower.includes('roast') || 
            lower.includes('poem') || lower.includes('imagine')) {
            return 'CREATIVE';
        }
        return 'CASUAL';
    }

    const FSP_HISTORY = `You are the exclusive AI Agent for 4SP (4simpleproblems).`;

    function getDynamicSystemInstructionAndModel(query, settings) {
        const intent = determineIntentCategory(query);
        let model = 'gemini-flash-latest'; // Default
        
        let instruction = `${FSP_HISTORY}
        You are Gemini 3.0, integrated into 4SP.
        MANDATORY RULES:
        1. <THOUGHT_PROCESS>...reasoning...</THOUGHT_PROCESS> at start.
        2. <SOURCE URL="..." TITLE="..."/> for sources.
        3. Use KaTeX ($...$) for math.
        4. <CREATE_FILE FILENAME="..." MIMETYPE="...">...content...</CREATE_FILE> for files.
        `;

        if (settings.webSearch) instruction += `\n**Web Search: ENABLED.** Use for real-time info.\n`;
        else instruction += `\n**Web Search: DISABLED.** Output [NEEDS_WEB_SEARCH] if needed.\n`;

        switch (intent) {
            case 'DEEP_ANALYSIS':
                model = 'gemini-3-pro-preview';
                instruction += `\n\n**MODE: DEEP ANALYSIS (Gemini 3 Pro - Thinking: ${settings.thinkingLevel}).** Detailed, critical analysis.`;
                break;
            case 'PROFESSIONAL_MATH':
                model = 'gemini-3-pro-preview'; // Using Pro for complex math/code
                instruction += `\n\n**MODE: TECHNICAL.** Precision, logic, syntax accuracy.`;
                break;
            case 'CREATIVE':
                model = 'gemini-flash-latest';
                if (query.toLowerCase().includes('roast')) instruction += `\n\n**MODE: ROAST.** Sarcastic, witty.`;
                else instruction += `\n\n**MODE: CREATIVE.** Evocative, imaginative.`;
                break;
            case 'CASUAL':
            default:
                model = 'gemini-flash-latest';
                instruction += `\n\n**MODE: CASUAL.** Concise, helpful.`;
                break;
        }
        return { instruction, model };
    }

    function getMemoriesContext() {
        if (savedMemories.length === 0) return '';
        const list = savedMemories.map(m => `- ${m.content}`).join('\n');
        return `\n\n[USER MEMORY BANK]:\n${list}\n\n`;
    }

    // ==========================================================================
    // --- 6. API INTERACTION ---
    // ==========================================================================

    async function callGoogleAI(responseBubble) {
        if (!API_KEY) { responseBubble.innerHTML = `<div class="ai-error">API Key missing.</div>`; return; }
        currentAIRequestController = new AbortController();

        let firstMessageContext = '';
        if (chatHistory.length <= 1) {
            const location = await getUserLocationForContext();
            firstMessageContext = `(System: Location: ${location}. Time: ${new Date().toLocaleString()}.)${getMemoriesContext()}`;
        }

        let processedChatHistory = [...chatHistory];
        if (processedChatHistory.length > 10) {
            processedChatHistory = [processedChatHistory[0], ...processedChatHistory.slice(-8)];
        }

        const lastIdx = processedChatHistory.length - 1;
        const userParts = processedChatHistory[lastIdx].parts;
        const textPart = userParts.find(p => p.text);
        const userQuery = textPart ? textPart.text : '';
        
        if (firstMessageContext && textPart) {
            textPart.text = firstMessageContext + "\n\n" + textPart.text;
        }

        const { instruction, model } = getDynamicSystemInstructionAndModel(userQuery, appSettings);

        const payload = {
            contents: processedChatHistory,
            systemInstruction: { parts: [{ text: instruction }] },
            generationConfig: { temperature: appSettings.creativity }
        };

        if (model.includes('3-pro')) {
            payload.generationConfig.thinking_level = appSettings.thinkingLevel;
            payload.generationConfig.include_thoughts = true;
        }

        const DYNAMIC_URL = `${BASE_API_URL}${model}:generateContent?key=${API_KEY}`;

        try {
            const response = await fetch(DYNAMIC_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: currentAIRequestController.signal
            });

            if (!response.ok) throw new Error(`API Error ${response.status}`);
            const data = await response.json();
            let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) throw new Error("Empty response.");

            if (text.includes('[NEEDS_WEB_SEARCH]')) {
                setTimeout(showWebSearchNudge, 500);
                text = text.replace(/\[NEEDS_WEB_SEARCH\]/g, '');
            }

            chatHistory.push({ role: "model", parts: [{ text: text }] });
            const parsed = parseGeminiResponse(text);

            responseBubble.style.opacity = '0';
            setTimeout(() => {
                let fullHTML = `<div class="typing-animation">${parsed.html}</div>`;
                if (parsed.sourcesHTML) fullHTML += parsed.sourcesHTML;
                if (parsed.thoughtProcess && parsed.thoughtProcess.length > MONOLOGUE_CHAR_THRESHOLD) {
                    fullHTML += `
                        <div class="ai-thought-process collapsed">
                            <div class="monologue-header">
                                <div class="monologue-title"><i class="fa-solid fa-brain-circuit" style="margin-right:8px;"></i>Thinking</div>
                                <button class="monologue-toggle-btn">Show Thoughts</button>
                            </div>
                            <pre class="monologue-content">${escapeHTML(parsed.thoughtProcess)}</pre>
                        </div>`;
                }

                responseBubble.innerHTML = fullHTML;
                responseBubble.querySelector('.typing-animation').classList.add('terminal-typing');

                responseBubble.querySelectorAll('.monologue-header').forEach(h => {
                    h.addEventListener('click', () => {
                        const p = h.parentElement;
                        const b = h.querySelector('button');
                        p.classList.toggle('collapsed');
                        b.textContent = p.classList.contains('collapsed') ? 'Show Thoughts' : 'Hide Thoughts';
                    });
                });

                responseBubble.querySelectorAll('.copy-code-btn').forEach(b => b.addEventListener('click', handleCopyCode));
                renderKaTeX(responseBubble);
                renderFileCardMarquees(responseBubble);
                renderGraphs(responseBubble);
                responseBubble.style.opacity = '1';
            }, 300);

        } catch (error) {
            if (error.name !== 'AbortError') responseBubble.innerHTML = `<div class="ai-error">Error: ${error.message}</div>`;
        } finally {
            isRequestPending = false;
            currentAIRequestController = null;
            document.getElementById('ai-input-wrapper').classList.remove('waiting');
            responseBubble.classList.remove('loading');
            const c = document.getElementById('ai-response-container');
            if(c) setTimeout(() => c.scrollTop = c.scrollHeight, 100);
        }
    }

    // ==========================================================================
    // --- 7. RESPONSE PARSING ---
    // ==========================================================================

    function parseGeminiResponse(text) {
        let html = text;
        let thoughtProcess = '';
        let sourcesHTML = '';
        const placeholders = {};
        let pId = 0;
        const addP = (c) => { const k = `%%P${pId++}%%`; placeholders[k] = c; return k; };

        html = html.replace(/<THOUGHT_PROCESS>([\s\S]*?)<\/THOUGHT_PROCESS>/, (m, c) => { thoughtProcess = c.trim(); return ''; });

        const sources = [];
        html = html.replace(/<SOURCE URL="([^"]+)" TITLE="([^"]+)"\s*\/>/g, (m, url, title) => { sources.push({ url, title }); return ''; });
        if (sources.length > 0) {
            sourcesHTML = `<div class="ai-sources-list"><h4>Sources:</h4><ul>`;
            sources.forEach(s => {
                let d = ''; try { d = new URL(s.url).hostname; } catch(e){ d='link'; }
                let f = `https://www.google.com/s2/favicons?domain=${d}&sz=32`;
                sourcesHTML += `<li><img src="${f}" class="favicon"><a href="${s.url}" target="_blank">${escapeHTML(s.title)}</a></li>`;
            });
            sourcesHTML += `</ul></div>`;
        }

        html = html.replace(/```graph\n([\s\S]*?)```/g, (m, json) => addP(`<div class="graph-block-wrapper"><div class="custom-graph-placeholder" data-graph-data='${escapeHTML(json)}'><canvas></canvas></div></div>`));

        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (m, lang, code) => addP(`
            <div class="code-block-wrapper">
                <div class="code-block-header"><span>${lang||'CODE'}</span><button class="copy-code-btn">${ICONS.copy}</button></div>
                <pre><code class="language-${lang}">${escapeHTML(code)}</code></pre>
            </div>`));

        html = html.replace(/\$\$([\s\S]*?)\$\$/g, (m, t) => addP(`<div class="latex-render" data-tex="${escapeHTML(t)}" data-display-mode="true"></div>`));
        html = html.replace(/\$([^\s][^$]*?[^\s])\$/g, (m, t) => addP(`<span class="latex-render" data-tex="${escapeHTML(t)}" data-display-mode="false"></span>`));

        html = html.replace(/<CREATE_FILE FILENAME="([^"]+)" MIMETYPE="([^"]+)">([\s\S]*?)<\/CREATE_FILE>/g, (m, f, mime, c) => {
            try {
                const blob = new Blob([c], { type: mime });
                const url = URL.createObjectURL(blob);
                const size = formatBytes(blob.size);
                const ext = f.split('.').pop().toUpperCase();
                return addP(`<div class="gemini-file-creation-card"><div class="file-header"><div class="file-name"><span>${escapeHTML(f)}</span></div><a href="${url}" download="${escapeHTML(f)}" class="file-dl-btn">${ICONS.download}</a><div class="file-badge">${ext}</div></div><div class="file-body"><div class="file-size">${size}</div></div></div>`);
            } catch(e) { return addP('[File Error]'); }
        });

        html = escapeHTML(html).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>").replace(/^### (.*$)/gm, "<h3>$1</h3>").replace(/^## (.*$)/gm, "<h2>$1</h2>").replace(/\n/g, "<br>");
        html = html.replace(/%%P\d+%%/g, k => placeholders[k]);
        return { html, thoughtProcess, sourcesHTML };
    }

    // ==========================================================================
    // --- 8. RENDERING ---
    // ==========================================================================

    function renderKaTeX(container) {
        if (typeof katex === 'undefined') return;
        container.querySelectorAll('.latex-render').forEach(el => {
            try { katex.render(el.dataset.tex, el, { throwOnError: false, displayMode: el.dataset.displayMode === 'true' }); } catch (e) { el.textContent = `[Math Error]`; }
        });
    }

    function renderFileCardMarquees(container) {
        container.querySelectorAll('.gemini-file-creation-card').forEach(card => {
            const el = card.querySelector('.file-name');
            const span = el?.querySelector('span');
            if (el && span && span.scrollWidth > el.clientWidth) el.classList.add('marquee');
        });
    }

    function renderGraphs(container) {
        container.querySelectorAll('.custom-graph-placeholder').forEach(el => {
            try {
                const data = JSON.parse(el.dataset.graphData);
                const canvas = el.querySelector('canvas');
                if(canvas) drawSimpleGraph(canvas, data);
            } catch(e) {}
        });
    }

    function drawSimpleGraph(canvas, data) {
        const ctx = canvas.getContext('2d');
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width; canvas.height = 300;
        ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0,0,canvas.width, canvas.height);
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, canvas.height/2); ctx.lineTo(canvas.width, canvas.height/2); ctx.stroke();
        if(data.data && data.data[0]) {
            const trace = data.data[0];
            ctx.strokeStyle = '#4f46e5'; ctx.lineWidth = 2; ctx.beginPath();
            for(let i=0; i<trace.x.length; i++) {
                const x = (trace.x[i] + 10) * (canvas.width/20);
                const y = canvas.height - ((trace.y[i] + 10) * (canvas.height/20));
                if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
            }
            ctx.stroke();
        }
    }

    function handleCopyCode(e) {
        const btn = e.currentTarget;
        const code = btn.closest('.code-block-wrapper').querySelector('code').innerText;
        navigator.clipboard.writeText(code).then(() => {
            btn.innerHTML = ICONS.check;
            setTimeout(() => btn.innerHTML = ICONS.copy, 2000);
        });
    }

    // ==========================================================================
    // --- 9. UI COMPONENTS (MODAL, MENU) ---
    // ==========================================================================

    function toggleMainMenu() {
        const menu = document.getElementById('ai-main-menu');
        const btn = document.getElementById('ai-menu-button');
        const active = menu.classList.toggle('active');
        btn.classList.toggle('active', active);
        if (active) document.addEventListener('click', handleOutsideMenuClick);
        else document.removeEventListener('click', handleOutsideMenuClick);
    }

    function handleOutsideMenuClick(e) {
        const menu = document.getElementById('ai-main-menu');
        const btn = document.getElementById('ai-menu-button');
        if (menu && !menu.contains(e.target) && !btn.contains(e.target)) toggleMainMenu();
    }

    function createMainMenu() {
        const menu = document.createElement('div');
        menu.id = 'ai-main-menu';
        menu.innerHTML = `
            <div class="menu-item" id="menu-attach"><i class="fa-solid fa-paperclip"></i> Attachments</div>
            <div class="menu-item" id="menu-settings"><i class="fa-solid fa-sliders"></i> System Control</div>
            <div class="menu-item" id="menu-memory"><i class="fa-solid fa-brain"></i> Memory Bank</div>`;
        menu.querySelector('#menu-attach').onclick = () => { toggleMainMenu(); handleFileUpload(); };
        menu.querySelector('#menu-settings').onclick = () => { toggleMainMenu(); openSettingsModal(); };
        menu.querySelector('#menu-memory').onclick = () => { toggleMainMenu(); openMemoriesModal(); };
        return menu;
    }
    
    function showWebSearchNudge() {
        if(document.getElementById('ai-web-nudge')) return;
        const div = document.createElement('div'); div.id = 'ai-web-nudge';
        div.innerHTML = `<div class="nudge-text">Enable Web Search?</div><div class="nudge-actions"><button id="nudge-no" class="btn-toolbar-style">No</button><button id="nudge-yes" class="btn-toolbar-style btn-primary-override">Settings</button></div>`;
        document.body.appendChild(div);
        div.querySelector('#nudge-no').onclick = () => div.remove();
        div.querySelector('#nudge-yes').onclick = () => { div.remove(); openSettingsModal(); };
    }

    function openSettingsModal() {
        if (document.getElementById('ai-settings-modal')) return;
        const modal = document.createElement('div'); modal.id = 'ai-settings-modal'; modal.className = 'ai-modal';
        modal.innerHTML = `
            <div class="modal-content"><div class="modal-header"><h3>System Control</h3><button class="close-button">${ICONS.close}</button></div>
            <div class="modal-body">
                <div class="settings-box"><div class="control-label"><span>Creativity</span><span class="value-display text-emphasis" id="val-creativity">${appSettings.creativity.toFixed(1)}</span></div>
                <div class="slider-container"><input type="range" id="input-creativity" min="0" max="2" step="0.1" value="${appSettings.creativity}" class="custom-range"></div>
                <div class="slider-labels"><span>Precise</span><span>Balanced</span><span>Creative</span></div></div>
                <div class="settings-box"><div class="control-label"><span>Thinking Level</span><span class="value-display text-emphasis" id="val-thinking">${appSettings.thinkingLevel}</span></div>
                <div class="segment-control"><div class="segment-item ${appSettings.thinkingLevel==='LOW'?'active':''}" data-val="LOW">Low</div><div class="segment-item ${appSettings.thinkingLevel==='HIGH'?'active':''}" data-val="HIGH">High</div></div></div>
                <div class="settings-box flex-row"><div class="box-text"><label>Web Search</label><p>Real-time access.</p></div><label class="toggle-switch"><input type="checkbox" id="input-web" ${appSettings.webSearch?'checked':''}><span class="slider"></span></label></div>
                <div class="settings-box flex-row"><div class="box-text"><label>Location</label><p>Context aware.</p></div><label class="toggle-switch"><input type="checkbox" id="input-loc" ${appSettings.locationSharing?'checked':''}><span class="slider"></span></label></div>
            </div></div>`;
        document.body.appendChild(modal);
        const close = () => modal.remove();
        modal.querySelector('.close-button').onclick = close;
        modal.onclick = (e) => { if(e.target===modal) close(); };
        const s = modal.querySelector('#input-creativity');
        s.oninput = (e) => { appSettings.creativity = parseFloat(e.target.value); modal.querySelector('#val-creativity').textContent = appSettings.creativity.toFixed(1); saveAppSettings(); };
        modal.querySelectorAll('.segment-item').forEach(i => i.onclick = () => { modal.querySelectorAll('.segment-item').forEach(el=>el.classList.remove('active')); i.classList.add('active'); appSettings.thinkingLevel = i.dataset.val; modal.querySelector('#val-thinking').textContent = i.dataset.val; saveAppSettings(); });
        modal.querySelector('#input-web').onchange = (e) => { appSettings.webSearch = e.target.checked; saveAppSettings(); };
        modal.querySelector('#input-loc').onchange = (e) => { appSettings.locationSharing = e.target.checked; saveAppSettings(); };
    }

    function openMemoriesModal() {
        if(document.getElementById('ai-memories-modal')) return;
        const modal = document.createElement('div'); modal.id = 'ai-memories-modal'; modal.className = 'ai-modal';
        modal.innerHTML = `<div class="modal-content"><div class="modal-header"><h3>Memory Bank</h3><button class="close-button">${ICONS.close}</button></div>
        <div class="modal-body"><button id="btn-add-mem" class="btn-toolbar-style btn-primary-override w-full mb-4"><i class="fa-solid fa-plus"></i> Add New Memory</button><div id="memory-list-container">${renderMemoryItems()}</div></div></div>`;
        document.body.appendChild(modal);
        modal.querySelector('.close-button').onclick = () => modal.remove();
        modal.querySelector('#btn-add-mem').onclick = () => { const t=prompt("Enter memory:"); if(t) { savedMemories.unshift({content:t, timestamp:Date.now()}); saveSavedMemories(); document.getElementById('memory-list-container').innerHTML = renderMemoryItems(); attachMemoryListeners(); }};
        attachMemoryListeners();
    }

    function renderMemoryItems() {
        if(!savedMemories.length) return '<div class="settings-box p-4 text-center text-muted">No memories.</div>';
        return savedMemories.map((m, i) => `<div class="settings-box flex-row p-3 mb-2"><div class="text-sm">${escapeHTML(m.content)}</div><button class="btn-icon text-danger hover-danger mem-delete" data-idx="${i}">${ICONS.trash}</button></div>`).join('');
    }

    function attachMemoryListeners() {
        document.querySelectorAll('.mem-delete').forEach(b => b.onclick = (e) => { savedMemories.splice(parseInt(e.currentTarget.dataset.idx), 1); saveSavedMemories(); document.getElementById('memory-list-container').innerHTML = renderMemoryItems(); attachMemoryListeners(); });
    }

    // ==========================================================================
    // --- 10. CORE INPUT & ACTIVATION ---
    // ==========================================================================

    function handleFileUpload() {
        const i = document.createElement('input'); i.type = 'file'; i.multiple = true;
        i.onchange = (e) => { Array.from(e.target.files).forEach(f => { if(attachedFiles.length>=MAX_ATTACHMENTS_PER_MESSAGE) return; const r=new FileReader(); r.onload=(evt)=>{ attachedFiles.push({file:f,data:evt.target.result.split(',')[1],mime:f.type}); renderAttachments(); }; r.readAsDataURL(f); }); }; i.click();
    }

    function renderAttachments() {
        const c = document.getElementById('ai-attachment-preview');
        if(attachedFiles.length===0) { c.innerHTML=''; c.style.display='none'; return; }
        c.style.display='flex'; c.innerHTML = attachedFiles.map((f,i) => `<div class="attachment-chip"><i class="fa-solid fa-file"></i><span>${f.file.name}</span><button onclick="window.removeAttachment(${i})">&times;</button></div>`).join('');
    }
    window.removeAttachment = (i) => { attachedFiles.splice(i,1); renderAttachments(); };

    function handleInput(e) { const el = e.target; if(el.scrollHeight > MAX_INPUT_HEIGHT) el.style.height = MAX_INPUT_HEIGHT+'px'; else el.style.height = 'auto'; }
    function handlePaste(e) { e.preventDefault(); const t = (e.clipboardData||window.clipboardData).getData('text'); document.execCommand('insertText', false, t); }

    function handleSubmit(e) {
        if(e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); const t = e.target.innerText.trim(); if(!t && !attachedFiles.length) return;
            const c = document.getElementById('ai-response-container'); document.getElementById('ai-container').classList.add('chat-active');
            c.innerHTML += `<div class="ai-message-bubble user-message">${escapeHTML(t)}</div>`;
            const lb = document.createElement('div'); lb.className = 'ai-message-bubble gemini-response loading'; lb.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; c.appendChild(lb);
            let mt = t; if(attachedFiles.length) mt += `\n[${attachedFiles.length} Files]`;
            chatHistory.push({role:'user', parts:[{text:mt}]});
            e.target.innerText = ''; attachedFiles = []; renderAttachments(); c.scrollTop = c.scrollHeight;
            callGoogleAI(lb);
        }
    }

    function activateAI() {
        if (document.getElementById('ai-container')) return;
        injectStyles();
        const div = document.createElement('div'); div.id = 'ai-container';
        // Added Close Button here
        div.innerHTML = `<div id="ai-close-button">${ICONS.close}</div><div id="ai-brand-title"><span>4</span><span>S</span><span>P</span></div><div id="ai-persistent-title">Gemini 3.0 Agent</div><div id="ai-response-container"></div><div id="ai-web-nudge" style="display:none;"></div><div id="ai-compose-area"><div id="ai-input-wrapper"><div id="ai-attachment-preview" style="display:none;"></div><div id="ai-input" contenteditable="true"></div><button id="ai-menu-button"><i class="fa-solid fa-ellipsis"></i></button></div></div>`;
        document.body.appendChild(div);
        document.getElementById('ai-compose-area').appendChild(createMainMenu());
        
        const inp = document.getElementById('ai-input');
        inp.addEventListener('keydown', handleSubmit); inp.addEventListener('input', handleInput); inp.addEventListener('paste', handlePaste);
        document.getElementById('ai-menu-button').addEventListener('click', toggleMainMenu);
        // Attach Close Button Event
        document.getElementById('ai-close-button').addEventListener('click', deactivateAI);

        setTimeout(() => { div.classList.add('active'); if(chatHistory.length) { const r=document.getElementById('ai-response-container'); chatHistory.forEach(m => r.innerHTML+=`<div class="ai-message-bubble ${m.role==='user'?'user-message':'gemini-response'}">${escapeHTML(m.parts[0].text.substring(0,300))+(m.parts[0].text.length>300?'...':'')}</div>`); div.classList.add('chat-active'); r.scrollTop=r.scrollHeight; } }, 10);
        inp.focus(); isAIActive = true;
    }

    function deactivateAI() {
        const c = document.getElementById('ai-container'); if(c) { c.classList.remove('active'); setTimeout(()=>c.remove(), 300); } isAIActive = false;
    }

    async function handleKeyDown(e) {
        if (e.ctrlKey && e.key === '\\') {
            if (isAIActive) { if(document.getElementById('ai-input')?.innerText.trim()==='') deactivateAI(); } else activateAI();
        }
    }

    // ==========================================================================
    // --- 11. CSS INJECTION ---
    // ==========================================================================

    function injectStyles() {
        if (document.getElementById('ai-dynamic-styles')) return;
        const f1=document.createElement('link');f1.rel='stylesheet';f1.href='https://kit-pro.fontawesome.com/releases/v7.0.1/css/pro.min.css';
        const f2=document.createElement('link');f2.rel='stylesheet';f2.href='https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500&display=swap';
        const f3=document.createElement('link');f3.rel='stylesheet';f3.href='https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.css';
        document.head.append(f1,f2,f3);

        const s = document.createElement("style"); s.id = "ai-dynamic-styles";
        s.innerHTML = `
            :root { --ai-bg: #070707; --ai-panel: #0d0d0d; --ai-border: #333; --ai-border-light: #1a1a1a; --ai-accent: #4f46e5; --ai-accent-hover: #6366f1; --ai-accent-bg: rgba(79, 70, 229, 0.1); --ai-text: #c0c0c0; --ai-text-head: #fff; --ai-radius: 1rem; --ai-btn-radius: 0.75rem; }
            #ai-container { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(7, 7, 7, 0.9); backdrop-filter: blur(15px); z-index: 99999; font-family: 'Geist', sans-serif; font-weight: 300; display: flex; flex-direction: column; color: var(--ai-text); opacity: 0; transition: opacity 0.3s ease; }
            #ai-container.active { opacity: 1; }
            #ai-brand-title, #ai-persistent-title { position: absolute; top: 25px; left: 30px; font-size: 18px; font-weight: 400; color: #fff; transition: opacity 0.3s; }
            #ai-brand-title span { font-weight: 600; }
            #ai-close-button { position: absolute; top: 25px; right: 30px; width: 32px; height: 32px; cursor: pointer; color: #888; transition: 0.2s; z-index: 1000; }
            #ai-close-button:hover { color: #fff; }
            #ai-container.chat-active #ai-persistent-title { opacity: 1; } #ai-container:not(.chat-active) #ai-persistent-title { opacity: 0; } #ai-container.chat-active #ai-brand-title { opacity: 0; }
            #ai-response-container { flex: 1; overflow-y: auto; width: 100%; max-width: 800px; margin: 0 auto; padding: 80px 20px 20px; display: flex; flex-direction: column; gap: 15px; mask-image: linear-gradient(to bottom, transparent 0, black 50px); -webkit-mask-image: linear-gradient(to bottom, transparent 0, black 50px); }
            .ai-message-bubble { padding: 12px 18px; border-radius: 12px; line-height: 1.6; max-width: 85%; font-size: 0.95rem; }
            .user-message { align-self: flex-end; background: var(--ai-border-light); border: 1px solid var(--ai-border); color: #fff; }
            .gemini-response { align-self: flex-start; background: transparent; } .gemini-response.loading { color: var(--ai-accent); font-size: 1.2rem; }
            
            /* WIDENED INPUT BAR */
            #ai-compose-area { width: 95%; max-width: 900px; margin: 0 auto 30px; padding: 0 20px; position: relative; z-index: 100; }
            #ai-input-wrapper { background: #111; border: 1px solid #252525; border-radius: var(--ai-btn-radius); display: flex; flex-direction: column; transition: border 0.2s; box-shadow: 0 4px 20px rgba(0,0,0,0.3); position: relative; }
            #ai-input-wrapper:focus-within { border-color: #505050; }
            #ai-input { min-height: 52px; max-height: 200px; overflow-y: auto; padding: 14px 50px 14px 16px; outline: none; color: #fff; font-size: 1rem; }
            #ai-input:empty::before { content: 'Ask Gemini 3.0...'; color: #666; pointer-events: none; }
            #ai-menu-button { position: absolute; bottom: 8px; right: 8px; width: 36px; height: 36px; background: transparent; border: 1px solid transparent; color: #888; border-radius: 0.5rem; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; }
            #ai-menu-button:hover, #ai-menu-button.active { background: var(--ai-accent-bg); color: var(--ai-accent); border-color: var(--ai-accent); }

            #ai-attachment-preview { padding: 10px 10px 0; display: flex; flex-wrap: wrap; gap: 8px; }
            .attachment-chip { background: #222; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; display: flex; align-items: center; gap: 6px; border: 1px solid #333; }
            .attachment-chip button { background: none; border: none; color: #aaa; cursor: pointer; font-size: 1.1em; } .attachment-chip button:hover { color: #fff; }

            #ai-main-menu { position: absolute; bottom: 110%; right: 0; width: 200px; background: #000; border: 1px solid #333; border-radius: var(--ai-radius); padding: 6px; opacity: 0; visibility: hidden; transform: translateY(10px); transition: 0.2s; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
            #ai-main-menu.active { opacity: 1; visibility: visible; transform: translateY(0); }
            .menu-item { padding: 10px 12px; border-radius: 6px; color: #ccc; cursor: pointer; font-size: 0.9rem; display: flex; align-items: center; gap: 10px; }
            .menu-item:hover { background: #1a1a1a; color: #fff; } .menu-item i { width: 20px; text-align: center; }

            #ai-web-nudge { position: absolute; bottom: 100px; left: 50%; transform: translateX(-50%); background: #1a1a1a; border: 1px solid #333; padding: 12px 20px; border-radius: 50px; display: flex; align-items: center; gap: 15px; box-shadow: 0 5px 20px rgba(0,0,0,0.4); animation: fadeUp 0.3s ease; }
            .nudge-text { font-size: 0.9rem; color: #ddd; } .nudge-actions { display: flex; gap: 8px; } @keyframes fadeUp { from{opacity:0;transform:translate(-50%,10px);} to{opacity:1;transform:translate(-50%,0);} }

            .ai-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); backdrop-filter: blur(5px); display: flex; justify-content: center; align-items: center; z-index: 100000; }
            .modal-content { background: var(--ai-panel); border: 1px solid var(--ai-border-light); border-radius: var(--ai-radius); width: 90%; max-width: 450px; box-shadow: 0 20px 50px rgba(0,0,0,0.6); overflow: hidden; display: flex; flex-direction: column; max-height: 80vh; }
            .modal-header { padding: 16px 20px; border-bottom: 1px solid var(--ai-border-light); display: flex; justify-content: space-between; align-items: center; }
            .modal-header h3 { margin: 0; font-size: 1.1rem; color: #fff; font-weight: 400; }
            .close-button { background: none; border: none; color: #666; font-size: 1.2rem; cursor: pointer; } .close-button:hover { color: #fff; }
            .modal-body { padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }

            .settings-box { border: 1px solid #333; border-radius: 1rem; background: transparent; padding: 1rem; display: flex; flex-direction: column; gap: 10px; }
            .settings-box.flex-row { flex-direction: row; justify-content: space-between; align-items: center; }
            .control-label { display: flex; justify-content: space-between; color: #999; font-size: 0.9rem; }
            .text-emphasis { color: var(--ai-accent); font-weight: 500; font-family: monospace; }
            .box-text label { display: block; color: #fff; font-size: 0.95rem; margin-bottom: 2px; } .box-text p { margin: 0; font-size: 0.8rem; color: #666; }

            .btn-toolbar-style { background: transparent; border: 1px solid #333; border-radius: 0.75rem; color: #ccc; padding: 8px 16px; font-size: 0.9rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s; }
            .btn-toolbar-style:hover { background: #000; border-color: #fff; color: #fff; }
            .btn-primary-override { background: var(--ai-accent-bg); border-color: var(--ai-accent); color: var(--ai-accent); }
            .btn-primary-override:hover { background: rgba(79, 70, 229, 0.2); border-color: var(--ai-accent-hover); color: var(--ai-accent-hover); }
            .btn-icon { background: none; border: none; cursor: pointer; color: #666; padding: 5px; transition: 0.2s; } .text-danger { color: #ef4444; } .hover-danger:hover { color: #ff6b6b; transform: scale(1.1); }
            .w-full { width: 100%; } .mb-4 { margin-bottom: 1rem; } .mb-2 { margin-bottom: 0.5rem; }

            .slider-container { width: 100%; padding: 5px 0; }
            .custom-range { -webkit-appearance: none; width: 100%; height: 4px; background: #333; border-radius: 2px; outline: none; }
            .custom-range::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: var(--ai-accent); cursor: pointer; box-shadow: 0 0 10px var(--ai-accent); margin-top: -6px; }
            .custom-range::-webkit-slider-runnable-track { width: 100%; height: 4px; cursor: pointer; background: #333; border-radius: 2px; }
            .slider-labels { display: flex; justify-content: space-between; font-size: 0.75rem; color: #666; margin-top: 5px; }

            .segment-control { background: #000; border: 1px solid #333; border-radius: 0.5rem; display: flex; padding: 3px; }
            .segment-item { flex: 1; text-align: center; padding: 6px; font-size: 0.85rem; border-radius: 4px; cursor: pointer; color: #666; transition: 0.2s; }
            .segment-item.active { background: var(--ai-accent); color: #fff; font-weight: 500; }

            .toggle-switch { position: relative; width: 50px; height: 26px; display: inline-block; }
            .toggle-switch input { opacity: 0; width: 0; height: 0; }
            .slider { position: absolute; top: 0; left: 0; right: 0; bottom: 0; cursor: pointer; background-color: #222; border: 1px solid #444; transition: .4s; border-radius: 34px; }
            .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: #888; transition: .4s; border-radius: 50%; }
            input:checked + .slider { background-color: var(--ai-accent-bg); border-color: var(--ai-accent); } input:checked + .slider:before { transform: translateX(24px); background-color: var(--ai-accent); }

            .ai-thought-process { margin-top: 10px; background: rgba(79, 70, 229, 0.05); border: 1px dashed rgba(79, 70, 229, 0.3); border-radius: 8px; overflow: hidden; }
            .monologue-header { padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
            .monologue-title { color: var(--ai-accent-hover); font-size: 0.85rem; display: flex; align-items: center; }
            .monologue-toggle-btn { background: transparent; border: 1px solid #333; color: #888; font-size: 0.7rem; padding: 2px 8px; border-radius: 4px; }
            .monologue-content { padding: 10px 12px; color: #aaa; font-family: monospace; font-size: 0.85rem; white-space: pre-wrap; border-top: 1px dashed #333; }
            .ai-thought-process.collapsed .monologue-content { display: none; }

            .gemini-file-creation-card { background: #111; border: 1px solid #333; border-radius: 8px; width: 220px; overflow: hidden; margin-top: 10px; }
            .file-header { padding: 8px 12px; background: #1a1a1a; border-bottom: 1px solid #252525; display: flex; align-items: center; gap: 8px; }
            .file-name { flex: 1; overflow: hidden; white-space: nowrap; color: #fff; font-size: 0.85rem; }
            .file-badge { font-size: 0.7rem; background: #333; padding: 2px 4px; border-radius: 3px; }
            .file-dl-btn { color: var(--ai-accent); cursor: pointer; } .file-body { padding: 8px 12px; font-size: 0.75rem; color: #666; }
            
            .code-block-wrapper { background: #0d0d0d; border: 1px solid #252525; border-radius: 8px; margin: 10px 0; overflow: hidden; }
            .code-block-header { background: #1a1a1a; padding: 6px 12px; display: flex; justify-content: space-between; font-size: 0.8rem; color: #888; border-bottom: 1px solid #252525; }
            .copy-code-btn { background: none; border: 1px solid #333; border-radius: 4px; color: #aaa; cursor: pointer; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; }
            pre { margin: 0; padding: 12px; overflow-x: auto; } code { font-family: 'Menlo', monospace; font-size: 0.9rem; color: #e0e0e0; }

            .ai-sources-list { border-top: 1px solid #222; margin-top: 10px; padding-top: 10px; }
            .ai-sources-list h4 { font-size: 0.85rem; color: #888; margin: 0 0 5px; }
            .ai-sources-list ul { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 8px; }
            .ai-sources-list li { background: #1a1a1a; padding: 4px 8px; border-radius: 4px; border: 1px solid #252525; font-size: 0.8rem; display: flex; align-items: center; gap: 6px; }
            .ai-sources-list a { color: var(--ai-accent); text-decoration: none; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .favicon { width: 14px; height: 14px; border-radius: 2px; }

            .typing-animation.terminal-typing::after { content: '▋'; display: inline-block; animation: blink 1s infinite; color: var(--ai-accent); } @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
            .gemini-response h3 { color: #fff; font-size: 1.1rem; margin: 15px 0 8px; } .gemini-response ul, .gemini-response ol { margin: 8px 0; padding-left: 20px; color: #ccc; } .gemini-response li { margin-bottom: 4px; } .gemini-response strong { color: #fff; font-weight: 500; }
        `;
        document.head.appendChild(s);
    }

    document.addEventListener('keydown', handleKeyDown);
})();
