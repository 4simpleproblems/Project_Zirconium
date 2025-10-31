/**
 * agent-activation.js
 *
 * MODIFIED: Refactored to remove Agent/Category system and implement a dynamic, context-aware AI persona.
 * REPLACED: Removed personalization features (nickname, color, gender, age).
 * NEW: Replaced old Settings Menu with a new one for "Web Search" and "Location Sharing" toggles, stored in localStorage.
 * NEW: The AI's system instruction (persona) now changes intelligently based on the content and tone of the user's latest message.
 * UI: Fixed background and title colors. Replaced Agent button with a grey Settings button.
 * UPDATED: AI container does not load on DOMContentLoaded; requires Ctrl + \ shortcut.
 * UPDATED: Ensured Ctrl + \ shortcut for activation/deactivation is fully functional.
 * NEW: Added KaTeX for high-quality rendering of mathematical formulas and equations.
 * REPLACED: Plotly.js has been replaced with a custom, theme-aware graphing engine for better integration.
 *
 * MODIFIED (USER REQUEST): Updated model selection for efficiency.
 * - Casual/Creative: gemini-2.5-flash-lite
 * - Professional/Math: gemini-2.5-flash
 * - Deep Analysis/Complex Graphing: gemini-2.5-pro (NEW)
 *
 * NEW (USER REQUEST): Implemented Humanity File Creation.
 * - AI can generate text-based files using a <CREATE_FILE> tag.
 * - The response bubble renders a downloadable file card, showing file size.
 * - Includes a warning tooltip: "File Creation may not be accurate".
 *
 * NEW: The AI's response now includes an internal <THOUGHT_PROCESS> and lists of <SOURCE URL="..." TITLE="..."/>.
 * UPDATED: Removed authenticated email feature.
 * REPLACED: Geolocation now uses browser's `navigator.geolocation` (with high accuracy) and Nominatim (OpenStreetMap) for reverse geocoding.
 * NEW: Added a "nudge" popup if AI needs web search but the setting is disabled.
 * UPDATED: Swapped order of monologue and sources. Monologue is now a collapsible dropdown.
 * CSS: Reduced margins between response content, sources, and monologue for a tighter layout.
 * MODIFIED: Location Sharing is now OFF by default.
 * MODIFIED: Web search prompt is more direct to improve search quality.
 *
 * --- UI/UX Update ---
 * NEW: Source list becomes scrollable if > 5 sources.
 * CSS: Reduced margin between response content and source list.
 * MODIFIED: Thought process (monologue) no longer includes the model name.
 * NEW: Thought process panel is hidden for simple/short thoughts (e.g., "Hi").
 * CSS: Thought process container is neutral when collapsed, blue when expanded.
 * CSS: Thought process collapse/expand animation is now faster (0.2s) and removes opacity fade.
 * CSS (USER REQUEST): Fixed "orange glow" bug on the loading bubble. The glow is now consistently blue.
 * FIX (USER REQUEST): Corrected a SyntaxError in `parseGeminiResponse` caused by a newline before an arrow function '=>'.
 *
 * --- UI/UX ENHANCEMENT UPDATE ---
 * NEW: Replaced two separate buttons (Attachments & Settings) with a single three-dot menu button (⋯).
 * NEW: Added dropdown menu with three options: "Attachments", "Settings", and "Saved Memories".
 * NEW: Implemented "Saved Memories" functionality for persistent AI context across conversations.
 * NEW: Added modal interfaces for both Settings and Saved Memories management.
 * ENHANCED: Improved performance with optimized request handling and memory management.
 * ENHANCED: Memories are automatically included in AI context for personalized responses.
 * UI: New responsive menu design follows existing design patterns with smooth animations.
 */
(function() {
    // --- CONFIGURATION ---
    const API_KEY = 'AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro';
    const BASE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/`;
    // const AUTHORIZED_PRO_USER = '4simpleproblems@gmail.com'; // REMOVED
    const MAX_INPUT_HEIGHT = 180;
    const CHAR_LIMIT = 10000;
    const PASTE_TO_FILE_THRESHOLD = 10000;

    // --- NEW: SAVED MEMORIES CONFIGURATION ---
    const SAVED_MEMORIES_KEY = 'ai-saved-memories';
    const MAX_MEMORIES = 50; // Maximum number of saved memories
    const MAX_ATTACHMENTS_PER_MESSAGE = 10;
    const MONOLOGUE_CHAR_THRESHOLD = 75; // NEW: Don't show monologue if thoughts are shorter than this

    // --- ICONS (for event handlers) ---
    const copyIconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="copy-icon"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    const checkIconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="check-icon"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    const attachmentIconSVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.2a2 2 0 0 1-2.83-2.83l8.49-8.49"></path></svg>`;
    // NEW: Download icon for File Creation
    const downloadIconSVG = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;

    // --- STATE MANAGEMENT ---
    let isAIActive = false;
    let isRequestPending = false;
    let currentAIRequestController = null;
    let chatHistory = [];
    let attachedFiles = [];
    // NEW: Replaced userSettings with appSettings. Location sharing is now off by default.
    let appSettings = {
        webSearch: true,
        locationSharing: false
    };
    // NEW: Saved memories for persistent AI context
    let savedMemories = [];

    // Simple debounce utility for performance
    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    };

    /**
     * NEW: Loads app settings from localStorage on script initialization.
     */
    function loadAppSettings() {
        try {
            const storedSettings = localStorage.getItem('ai-app-settings');
            if (storedSettings) {
                const parsed = JSON.parse(storedSettings);
                // Ensure defaults are kept if properties are missing
                appSettings = {
                    ...appSettings,
                    ...parsed
                };
            }
        } catch (e) {
            console.error("Error loading app settings:", e);
        }
    }

    /**
     * NEW: Loads saved memories from localStorage.
     */
    function loadSavedMemories() {
        try {
            const storedMemories = localStorage.getItem(SAVED_MEMORIES_KEY);
            if (storedMemories) {
                savedMemories = JSON.parse(storedMemories);
            }
        } catch (e) {
            console.error("Error loading saved memories:", e);
            savedMemories = [];
        }
    }

    /**
     * NEW: Saves memories to localStorage.
     */
    function saveSavedMemories() {
        try {
            localStorage.setItem(SAVED_MEMORIES_KEY, JSON.stringify(savedMemories));
        } catch (e) {
            console.error("Error saving memories:", e);
        }
    }

    loadAppSettings(); // Load initial settings
    loadSavedMemories(); // Load saved memories

    // --- UTILITIES FOR GEOLOCATION ---

    /**
     * NEW: Helper function for async HTTP GET request.
     */
    function httpGetAsync(url, callback) {
        const xmlHttp = new XMLHttpRequest();
        xmlHttp.onreadystatechange = function() {
            if (xmlHttp.readyState === 4) {
                if (xmlHttp.status === 200) {
                    callback(xmlHttp.responseText, null);
                } else {
                    callback(null, new Error(`HTTP Error: ${xmlHttp.status} ${xmlHttp.statusText}`));
                }
            }
        }
        xmlHttp.open("GET", url, true); // true for asynchronous
        xmlHttp.onerror = function() {
            callback(null, new Error("Network request failed"));
        };
        xmlHttp.send(null);
    }


    /**
     * REPLACED: Gets user location via Browser's Geolocation API, then reverse-geocodes it using Nominatim.
     * @returns {Promise<string>} Resolves with a human-readable address string or a fallback.
     */
    function getUserLocationForContext() {
        return new Promise((resolve) => {
            // Check the new appSetting
            if (!appSettings.locationSharing) {
                const fallback = 'Location Sharing is disabled by user.';
                localStorage.setItem('ai-user-location', fallback);
                resolve(fallback);
                return;
            }

            // Check if browser supports Geolocation
            if (!navigator.geolocation) {
                const fallback = 'Geolocation is not supported by this browser.';
                localStorage.setItem('ai-user-location', fallback);
                resolve(fallback);
                return;
            }

            // Browser API will prompt user for permission if not already granted
            navigator.geolocation.getCurrentPosition(
                // Success Callback: Got coordinates, now reverse geocode
                (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;

                    // NEW: Use Nominatim (OpenStreetMap) for reverse geocoding. No API key needed.
                    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=en`;

                    httpGetAsync(url, (response, error) => {
                        if (error) {
                            console.warn('Reverse geocoding failed:', error.message);
                            const fallback = `Coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)} (Reverse geocoding failed)`;
                            localStorage.setItem('ai-user-location', fallback);
                            resolve(fallback);
                        } else {
                            try {
                                const data = JSON.parse(response);
                                // NEW: Parse Nominatim's response format
                                if (data && data.display_name) {
                                    const locationString = data.display_name;
                                    localStorage.setItem('ai-user-location', locationString);
                                    resolve(locationString);
                                } else {
                                    throw new Error('No display_name in Nominatim response');
                                }
                            } catch (e) {
                                console.error('Failed to parse Nominatim response:', e);
                                const fallback = `Coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)} (Address parsing failed)`;
                                localStorage.setItem('ai-user-location', fallback);
                                resolve(fallback);
                            }
                        }
                    });
                },
                // Error Callback: Failed to get coordinates
                (error) => {
                    let fallback;
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            fallback = "Location permission denied by user.";
                            break;
                        case error.POSITION_UNAVAILABLE:
                            fallback = "Location information is unavailable.";
                            break;
                        case error.TIMEOUT:
                            fallback = "Location request timed out.";
                            break;
                        default:
                            fallback = "An unknown error occurred while getting location.";
                            break;
                    }
                    console.warn('Geolocation failed:', fallback);
                    localStorage.setItem('ai-user-location', fallback);
                    resolve(fallback);
                },
                // Options object to request high accuracy
                {
                    enableHighAccuracy: true
                }
            );
        });
    }


    // --- REPLACED/MODIFIED FUNCTIONS ---

    /**
     * Stub for authorization (email feature removed).
     * @returns {Promise<boolean>} Always resolves to true.
     */
    async function isUserAuthorized() {
        return true;
    }

    /**
     * Renders mathematical formulas using KaTeX.
     * @param {HTMLElement} container The parent element to search for formulas.
     */
    function renderKaTeX(container) {
        if (typeof katex === 'undefined') {
            console.warn("KaTeX not loaded, skipping render.");
            return;
        }
        container.querySelectorAll('.latex-render').forEach(element => {
            const mathText = element.dataset.tex;
            const displayMode = element.dataset.displayMode === 'true';
            try {
                katex.render(mathText, element, {
                    throwOnError: false,
                    displayMode: displayMode,
                    macros: {
                        "\\le": "\\leqslant",
                        "\\ge": "\\geqslant"
                    }
                });
            } catch (e) {
                console.error("KaTeX rendering error:", e);
                element.textContent = `[KaTeX Error] ${e.message}`;
            }
        });
    }

    /**
     * Handles marquee animation for long file names in file creation cards.
     * @param {HTMLElement} container The parent element to search for file cards.
     */
    function renderFileCardMarquees(container) {
        container.querySelectorAll('.gemini-file-creation-card').forEach(card => {
            const fileNameElement = card.querySelector('.file-name');
            const fileNameSpan = fileNameElement?.querySelector('span');

            if (fileNameElement && fileNameSpan) {
                // Reset any existing marquee
                fileNameElement.classList.remove('marquee');
                fileNameSpan.style.animation = '';

                // Check if text overflows
                setTimeout(() => {
                    if (fileNameSpan.scrollWidth > fileNameElement.clientWidth) {
                        fileNameElement.classList.add('marquee');
                    }
                }, 100);
            }
        });
    }

    /**
     * Renders interactive graphs, tables, charts, and advanced visualizations.
     * @param {HTMLElement} container The parent element to search for visualization placeholders.
     */
    function renderGraphs(container) {
        // Render standard graphs
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
            } catch (e) {
                console.error("Custom graph rendering error:", e);
                placeholder.textContent = `[Graph Error] Invalid graph data provided.`;
            }
        });

        // Render tables
        container.querySelectorAll('.custom-table-placeholder').forEach(placeholder => {
            try {
                const tableData = JSON.parse(placeholder.dataset.tableData);
                const tableContainer = placeholder.querySelector('.table-container');
                if (tableContainer) {
                    drawCustomTable(tableContainer, tableData);
                }
            } catch (e) {
                console.error("Custom table rendering error:", e);
                placeholder.textContent = `[Table Error] Invalid table data provided.`;
            }
        });

        // Render charts
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
            } catch (e) {
                console.error("Custom chart rendering error:", e);
                placeholder.textContent = `[Chart Error] Invalid chart data provided.`;
            }
        });

        // Render advanced graphs
        container.querySelectorAll('.custom-advanced-graph-placeholder').forEach(placeholder => {
            try {
                const graphData = JSON.parse(placeholder.dataset.advancedGraphData);
                const canvas = placeholder.querySelector('canvas');
                if (canvas) {
                    const draw = () => drawAdvancedGraph(canvas, graphData);
                    const observer = new ResizeObserver(debounce(draw, 100));
                    observer.observe(placeholder);
                    draw();
                }
            } catch (e) {
                console.error("Advanced graph rendering error:", e);
                placeholder.textContent = `[Advanced Graph Error] Invalid graph data provided.`;
            }
        });
    }

    /**
     * Custom graphing function using HTML Canvas.
     * @param {HTMLCanvasElement} canvas The canvas element to draw on.
     * @param {object} graphData The data and layout configuration for the graph.
     */
    function drawCustomGraph(canvas, graphData) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const layout = graphData.layout || {};
        const data = graphData.data || [];

        const padding = {
            top: 50,
            right: 30,
            bottom: 50,
            left: 60
        };
        const graphWidth = rect.width - padding.left - padding.right;
        const graphHeight = rect.height - padding.top - padding.bottom;

        // Determine data range
        let minX = Infinity,
            maxX = -Infinity,
            minY = Infinity,
            maxY = -Infinity;
        data.forEach(trace => {
            trace.x.forEach(val => {
                minX = Math.min(minX, val);
                maxX = Math.max(maxX, val);
            });
            trace.y.forEach(val => {
                minY = Math.min(minY, val);
                maxY = Math.max(maxY, val);
            });
        });

        // Add buffer to range
        const xRange = maxX - minX || 1;
        const yRange = maxY - minY || 1;
        minX -= xRange * 0.1;
        maxX += xRange * 0.1;
        minY -= yRange * 0.1;
        maxY += yRange * 0.1;

        const mapX = x => padding.left + ((x - minX) / (maxX - minX)) * graphWidth;
        const mapY = y => padding.top + graphHeight - ((y - minY) / (maxY - minY)) * graphHeight;

        // Draw grid lines
        const gridColor = 'rgba(255, 255, 255, 0.1)';
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        const xTickCount = Math.max(2, Math.floor(graphWidth / 80));
        const yTickCount = Math.max(2, Math.floor(graphHeight / 50));

        for (let i = 0; i <= xTickCount; i++) {
            const x = padding.left + (i / xTickCount) * graphWidth;
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, padding.top + graphHeight);
            ctx.stroke();
        }
        for (let i = 0; i <= yTickCount; i++) {
            const y = padding.top + (i / yTickCount) * graphHeight;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + graphWidth, y);
            ctx.stroke();
        }

        // Draw axes and labels
        ctx.fillStyle = '#ccc';
        ctx.font = '12px Lora';
        for (let i = 0; i <= xTickCount; i++) {
            const val = minX + (i / xTickCount) * (maxX - minX);
            ctx.fillText(val.toFixed(1), mapX(val), padding.top + graphHeight + 20);
        }
        for (let i = 0; i <= yTickCount; i++) {
            const val = minY + (i / yTickCount) * (maxY - minY);
            ctx.fillText(val.toFixed(1), padding.left - 35, mapY(val) + 4);
        }

        ctx.font = 'bold 14px Lora';
        ctx.textAlign = 'center';
        if (layout.xaxis?.title) ctx.fillText(layout.xaxis.title, padding.left + graphWidth / 2, rect.height - 10);
        ctx.save();
        ctx.rotate(-Math.PI / 2);
        if (layout.yaxis?.title) ctx.fillText(layout.yaxis.title, -(padding.top + graphHeight / 2), 20);
        ctx.restore();


        // Draw data based on trace type and mode
        data.forEach((trace, traceIndex) => {
            const color = trace.line?.color || trace.marker?.color || ['#4285f4', '#ea4335', '#34a853', '#fbbc05', '#9c27b0'][traceIndex % 5];
            const traceType = trace.type || 'scatter';
            const mode = trace.mode || 'lines+markers';

            if (traceType === 'bar') {
                // Bar chart
                const barWidth = graphWidth / trace.x.length * 0.6;
                const barSpacing = graphWidth / trace.x.length * 0.4;

                ctx.fillStyle = color;
                trace.x.forEach((xVal, i) => {
                    const yVal = trace.y[i];
                    const barHeight = Math.abs(mapY(yVal) - mapY(0));
                    const x = mapX(xVal) - barWidth / 2;
                    const y = Math.min(mapY(yVal), mapY(0));

                    ctx.fillRect(x, y, barWidth, barHeight);
                });
            } else {
                // Line/scatter plot
                ctx.strokeStyle = color;
                ctx.fillStyle = color;
                ctx.lineWidth = trace.line?.width || 2;

                // Draw lines
                if (mode.includes('lines') && trace.x.length > 1) {
                    ctx.beginPath();
                    ctx.moveTo(mapX(trace.x[0]), mapY(trace.y[0]));
                    for (let i = 1; i < trace.x.length; i++) {
                        ctx.lineTo(mapX(trace.x[i]), mapY(trace.y[i]));
                    }
                    ctx.stroke();
                }

                // Draw markers/points
                if (mode.includes('markers') || traceType === 'scatter') {
                    const markerSize = trace.marker?.size || 6;
                    const markerSymbol = trace.marker?.symbol || 'circle';

                    for (let i = 0; i < trace.x.length; i++) {
                        const x = mapX(trace.x[i]);
                        const y = mapY(trace.y[i]);

                        ctx.beginPath();
                        if (markerSymbol === 'square') {
                            ctx.fillRect(x - markerSize/2, y - markerSize/2, markerSize, markerSize);
                        } else if (markerSymbol === 'diamond') {
                            ctx.moveTo(x, y - markerSize/2);
                            ctx.lineTo(x + markerSize/2, y);
                            ctx.lineTo(x, y + markerSize/2);
                            ctx.lineTo(x - markerSize/2, y);
                            ctx.closePath();
                            ctx.fill();
                        } else {
                            // Default circle
                            ctx.arc(x, y, markerSize/2, 0, 2 * Math.PI);
                            ctx.fill();
                        }
                    }
                }
            }
        });

        // Draw title
        if (layout.title) {
            ctx.fillStyle = '#fff';
            ctx.font = '18px Merriweather';
            ctx.textAlign = 'center';
            ctx.fillText(layout.title, rect.width / 2, padding.top / 2 + 5);
        }
    }

    /**
     * Custom table rendering function.
     * @param {HTMLElement} container The container element to render the table in.
     * @param {object} tableData The table data configuration.
     */
    function drawCustomTable(container, tableData) {
        const { headers, rows, title } = tableData;

        let html = '';
        if (title) {
            html += `<h4 class="table-title">${escapeHTML(title)}</h4>`;
        }

        html += '<table class="custom-data-table">';

        // Headers
        if (headers && headers.length > 0) {
            html += '<thead><tr>';
            headers.forEach(header => {
                html += `<th>${escapeHTML(header)}</th>`;
            });
            html += '</tr></thead>';
        }

        // Rows
        if (rows && rows.length > 0) {
            html += '<tbody>';
            rows.forEach(row => {
                html += '<tr>';
                row.forEach(cell => {
                    html += `<td>${escapeHTML(String(cell))}</td>`;
                });
                html += '</tr>';
            });
            html += '</tbody>';
        }

        html += '</table>';
        container.innerHTML = html;
    }

    /**
     * Custom chart rendering function using HTML Canvas.
     * @param {HTMLCanvasElement} canvas The canvas element to draw on.
     * @param {object} chartData The chart data and configuration.
     */
    function drawCustomChart(canvas, chartData) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const { type, data, title } = chartData;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const radius = Math.min(rect.width, rect.height) / 3;

        // Draw title
        if (title) {
            ctx.fillStyle = '#fff';
            ctx.font = '16px Merriweather';
            ctx.textAlign = 'center';
            ctx.fillText(title, centerX, 30);
        }

        if (type === 'pie' && data && data.length > 0) {
            drawPieChart(ctx, data, centerX, centerY, radius);
        } else if (type === 'bar' && data && data.length > 0) {
            drawBarChart(ctx, data, rect);
        } else if (type === 'doughnut' && data && data.length > 0) {
            drawDoughnutChart(ctx, data, centerX, centerY, radius);
        }
    }

    /**
     * Draws a pie chart.
     */
    function drawPieChart(ctx, data, centerX, centerY, radius) {
        const total = data.reduce((sum, item) => sum + item.value, 0);
        const colors = ['#4285f4', '#ea4335', '#34a853', '#fbbc05', '#9c27b0', '#ff9800', '#795548', '#607d8b'];

        let currentAngle = -Math.PI / 2;

        data.forEach((item, index) => {
            const sliceAngle = (item.value / total) * 2 * Math.PI;

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
            ctx.closePath();
            ctx.fillStyle = colors[index % colors.length];
            ctx.fill();

            // Draw label
            const labelAngle = currentAngle + sliceAngle / 2;
            const labelX = centerX + Math.cos(labelAngle) * (radius * 0.7);
            const labelY = centerY + Math.sin(labelAngle) * (radius * 0.7);

            ctx.fillStyle = '#fff';
            ctx.font = '12px Lora';
            ctx.textAlign = 'center';
            ctx.fillText(item.label, labelX, labelY);

            currentAngle += sliceAngle;
        });
    }

    /**
     * Draws a bar chart.
     */
    function drawBarChart(ctx, data, rect) {
        const padding = { top: 60, right: 30, bottom: 60, left: 60 };
        const chartWidth = rect.width - padding.left - padding.right;
        const chartHeight = rect.height - padding.top - padding.bottom;

        const maxValue = Math.max(...data.map(item => item.value));
        const barWidth = chartWidth / data.length * 0.8;
        const barSpacing = chartWidth / data.length * 0.2;

        const colors = ['#4285f4', '#ea4335', '#34a853', '#fbbc05', '#9c27b0'];

        data.forEach((item, index) => {
            const barHeight = (item.value / maxValue) * chartHeight;
            const x = padding.left + index * (barWidth + barSpacing) + barSpacing / 2;
            const y = padding.top + chartHeight - barHeight;

            ctx.fillStyle = colors[index % colors.length];
            ctx.fillRect(x, y, barWidth, barHeight);

            // Draw label
            ctx.fillStyle = '#fff';
            ctx.font = '12px Lora';
            ctx.textAlign = 'center';
            ctx.fillText(item.label, x + barWidth / 2, rect.height - padding.bottom + 20);

            // Draw value
            ctx.fillText(item.value.toString(), x + barWidth / 2, y - 10);
        });
    }

    /**
     * Draws a doughnut chart.
     */
    function drawDoughnutChart(ctx, data, centerX, centerY, radius) {
        const innerRadius = radius * 0.6;
        const total = data.reduce((sum, item) => sum + item.value, 0);
        const colors = ['#4285f4', '#ea4335', '#34a853', '#fbbc05', '#9c27b0', '#ff9800'];

        let currentAngle = -Math.PI / 2;

        data.forEach((item, index) => {
            const sliceAngle = (item.value / total) * 2 * Math.PI;

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
            ctx.arc(centerX, centerY, innerRadius, currentAngle + sliceAngle, currentAngle, true);
            ctx.closePath();
            ctx.fillStyle = colors[index % colors.length];
            ctx.fill();

            currentAngle += sliceAngle;
        });
    }

    /**
     * Advanced graph rendering with multiple datasets and complex visualizations.
     */
    function drawAdvancedGraph(canvas, graphData) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const layout = graphData.layout || {};
        const datasets = graphData.datasets || [];

        const padding = { top: 60, right: 40, bottom: 60, left: 70 };
        const graphWidth = rect.width - padding.left - padding.right;
        const graphHeight = rect.height - padding.top - padding.bottom;

        // Find data ranges across all datasets
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        datasets.forEach(dataset => {
            if (dataset.x && dataset.y) {
                dataset.x.forEach(val => {
                    minX = Math.min(minX, val);
                    maxX = Math.max(maxX, val);
                });
                dataset.y.forEach(val => {
                    minY = Math.min(minY, val);
                    maxY = Math.max(maxY, val);
                });
            }
        });

        // Add buffer
        const xRange = maxX - minX || 1;
        const yRange = maxY - minY || 1;
        minX -= xRange * 0.1;
        maxX += xRange * 0.1;
        minY -= yRange * 0.1;
        maxY += yRange * 0.1;

        const mapX = x => padding.left + ((x - minX) / (maxX - minX)) * graphWidth;
        const mapY = y => padding.top + graphHeight - ((y - minY) / (maxY - minY)) * graphHeight;

        // Draw grid and axes (similar to basic graph)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;

        // Grid lines
        for (let i = 0; i <= 10; i++) {
            const x = padding.left + (i / 10) * graphWidth;
            const y = padding.top + (i / 10) * graphHeight;

            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, padding.top + graphHeight);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + graphWidth, y);
            ctx.stroke();
        }

        // Draw datasets with different colors and styles
        const colors = ['#4285f4', '#ea4335', '#34a853', '#fbbc05', '#9c27b0', '#ff9800'];

        datasets.forEach((dataset, index) => {
            if (!dataset.x || !dataset.y) return;

            const color = dataset.color || colors[index % colors.length];
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = dataset.lineWidth || 2;

            // Draw line
            ctx.beginPath();
            ctx.moveTo(mapX(dataset.x[0]), mapY(dataset.y[0]));
            for (let i = 1; i < dataset.x.length; i++) {
                ctx.lineTo(mapX(dataset.x[i]), mapY(dataset.y[i]));
            }
            ctx.stroke();

            // Draw markers if specified
            if (dataset.showMarkers !== false) {
                for (let i = 0; i < dataset.x.length; i++) {
                    ctx.beginPath();
                    ctx.arc(mapX(dataset.x[i]), mapY(dataset.y[i]), 4, 0, 2 * Math.PI);
                    ctx.fill();
                }
            }
        });

        // Draw title and legend
        if (layout.title) {
            ctx.fillStyle = '#fff';
            ctx.font = '18px Merriweather';
            ctx.textAlign = 'center';
            ctx.fillText(layout.title, rect.width / 2, 30);
        }
    }

    // --- END REPLACED/MODIFIED FUNCTIONS ---

    /**
     * Handles the Ctrl + \ shortcut for AI activation/deactivation.
     */
    async function handleKeyDown(e) {
        // Check for Ctrl + \ (or Cmd + \ on Mac, but Ctrl is standard cross-browser for this)
        if (e.ctrlKey && e.key === '\\') {
            const selection = window.getSelection().toString();
            if (isAIActive) {
                // Deactivation logic
                if (selection.length > 0) {
                    return;
                }
                e.preventDefault();
                const mainEditor = document.getElementById('ai-input');
                // Only deactivate if the input is empty and no files are attached
                if (mainEditor && mainEditor.innerText.trim().length === 0 && attachedFiles.length === 0) {
                    deactivateAI();
                }
            } else {
                // Activation logic
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

    function activateAI() {
        if (document.getElementById('ai-container')) return;
        if (typeof window.startPanicKeyBlocker === 'function') {
            window.startPanicKeyBlocker();
        }

        attachedFiles = [];
        injectStyles();

        const container = document.createElement('div');
        container.id = 'ai-container';

        const brandTitle = document.createElement('div');
        brandTitle.id = 'ai-brand-title';
        const brandText = "4SP - HUMANITY";
        brandText.split('').forEach(char => {
            const span = document.createElement('span');
            span.textContent = char;
            brandTitle.appendChild(span);
        });

        const persistentTitle = document.createElement('div');
        persistentTitle.id = 'ai-persistent-title';
        persistentTitle.textContent = "Humanity Agent"; // Fixed title

        const welcomeMessage = document.createElement('div');
        welcomeMessage.id = 'ai-welcome-message';
        const welcomeHeader = chatHistory.length > 0 ? "Welcome Back" : "Welcome to Humanity";
        // Updated welcome message to reflect location sharing.
        welcomeMessage.innerHTML = `<h2>${welcomeHeader}</h2><p>This is a beta feature. To improve your experience, your general location (if permitted) will be shared with your first message. You may be subject to message limits.</p><p class="shortcut-tip">(Press Ctrl + \\ to close)</p>`;

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

        // NEW: Single three-dot menu button replacing separate attachment and settings buttons
        const menuButton = document.createElement('button');
        menuButton.id = 'ai-menu-button';
        menuButton.innerHTML = '<i class="fa-solid fa-ellipsis"></i>';
        menuButton.title = 'Menu';
        menuButton.onclick = toggleMainMenu;

        const charCounter = document.createElement('div');
        charCounter.id = 'ai-char-counter';
        charCounter.textContent = `0 / ${formatCharLimit(CHAR_LIMIT)}`;

        inputWrapper.appendChild(attachmentPreviewContainer);
        inputWrapper.appendChild(visualInput);
        inputWrapper.appendChild(menuButton);

        composeArea.appendChild(createMainMenu()); // NEW: Main dropdown menu
        composeArea.appendChild(inputWrapper);

        container.appendChild(brandTitle);
        container.appendChild(persistentTitle);
        container.appendChild(welcomeMessage);
        container.appendChild(closeButton);
        container.appendChild(responseContainer);
        container.appendChild(composeArea);
        container.appendChild(charCounter);

        // --- Add KaTeX ---
        const katexScript = document.createElement('script');
        katexScript.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.js';
        container.appendChild(katexScript);

        document.body.appendChild(container);

        if (chatHistory.length > 0) {
            renderChatHistory();
        }

        setTimeout(() => {
            if (chatHistory.length > 0) {
                container.classList.add('chat-active');
            }
            container.classList.add('active');
        }, 10);

        visualInput.focus();
        isAIActive = true;
    }

    function deactivateAI() {
        if (typeof window.stopPanicKeyBlocker === 'function') {
            window.stopPanicKeyBlocker();
        }
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
                const fontAwesome = document.querySelector('link[href*="font-awesome"]');
                if (fontAwesome) fontAwesome.remove();
            }, 500);
        }
        isAIActive = false;
        isRequestPending = false;
        attachedFiles = [];
        const mainMenu = document.getElementById('ai-main-menu');
        if (mainMenu) mainMenu.classList.remove('active');
        document.removeEventListener('click', handleMenuOutsideClick); // Clean up listener

        // NEW: Clean up any open modals
        const settingsModal = document.getElementById('ai-settings-modal');
        if (settingsModal) settingsModal.remove();
        const memoriesModal = document.getElementById('ai-memories-modal');
        if (memoriesModal) memoriesModal.remove();
    }

    function renderChatHistory() {
        const responseContainer = document.getElementById('ai-response-container');
        if (!responseContainer) return;
        responseContainer.innerHTML = '';
        chatHistory.forEach(message => {
            const bubble = document.createElement('div');
            bubble.className = `ai-message-bubble ${message.role === 'user' ? 'user-message' : 'gemini-response'}`;
            if (message.role === 'model') {
                // Use the new parsing logic for historical messages
                const {
                    html: parsedResponse,
                    thoughtProcess,
                    sourcesHTML
                } = parseGeminiResponse(message.parts[0].text);

                bubble.innerHTML = `<div class="ai-response-content">${parsedResponse}</div>`;

                // NEW: Sources first
                if (sourcesHTML) {
                    bubble.innerHTML += sourcesHTML;
                }

                // NEW: Collapsible thought process (with length check)
                if (thoughtProcess && thoughtProcess.length > MONOLOGUE_CHAR_THRESHOLD) {
                    bubble.innerHTML += `
                        <div class="ai-thought-process collapsed">
                            <div class="monologue-header">
                                <h4 class="monologue-title">Gemini's Internal Monologue:</h4>
                                <button class="monologue-toggle-btn">Show Thoughts</button>
                            </div>
                            <pre class="monologue-content">${escapeHTML(thoughtProcess)}</pre>
                        </div>
                    `;
                }

                bubble.querySelectorAll('.copy-code-btn').forEach(button => {
                    button.addEventListener('click', handleCopyCode);
                });

                // Add click handlers for monologue toggle in history
                bubble.querySelectorAll('.ai-thought-process').forEach(monologueDiv => {
                    monologueDiv.querySelector('.monologue-header').addEventListener('click', () => {
                        monologueDiv.classList.toggle('collapsed');
                        const btn = monologueDiv.querySelector('.monologue-toggle-btn');
                        if (monologueDiv.classList.contains('collapsed')) {
                            btn.textContent = 'Show Thoughts';
                        } else {
                            btn.textContent = 'Hide Thoughts';
                        }
                    });
                });

                // Add event listeners for file download cards in history (if any)
                bubble.querySelectorAll('.gemini-file-creation-card').forEach(card => {
                    const downloadLink = card.querySelector('.file-creation-download-btn');
                    // Re-create blob URL as they are temporary
                    const content = card.dataset.fileContent;
                    const mimetype = card.dataset.fileMime;
                    if (content && mimetype) {
                        try {
                            const blob = new Blob([content], {
                                type: mimetype
                            });
                            const dataUrl = URL.createObjectURL(blob);
                            downloadLink.href = dataUrl;
                        } catch (e) {
                            console.error("Error recreating blob URL for history:", e);
                            downloadLink.href = "#";
                            downloadLink.onclick = (e) => {
                                e.preventDefault();
                                alert("Failed to reload file from history.");
                            };
                        }
                    }
                });

                renderKaTeX(bubble);
                renderGraphs(bubble);
                renderFileCardMarquees(bubble);
            } else {
                let bubbleContent = '';
                let textContent = '';
                let fileCount = 0;
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

    /**
     * Determines the user's current intent category based on the query.
     * @param {string} query The user's last message text.
     * @returns {string} One of 'DEEP_ANALYSIS', 'PROFESSIONAL_MATH', 'CREATIVE', or 'CASUAL'.
     */
    function determineIntentCategory(query) {
        const lowerQuery = query.toLowerCase();

        // Deep Analysis Keywords
        // MODIFIED: Added "complex" triggers for Pro model.
        if (lowerQuery.includes('analyze') || lowerQuery.includes('deep dive') || lowerQuery.includes('strategic') || lowerQuery.includes('evaluate') || lowerQuery.includes('critique') || lowerQuery.includes('investigate') || lowerQuery.includes('pro model') || lowerQuery.includes('complex graph') || lowerQuery.includes('advanced equation') || lowerQuery.includes('advanced functioning')) {
            return 'DEEP_ANALYSIS';
        }

        // Professional/Math/Coding Keywords
        if (lowerQuery.includes('math') || lowerQuery.includes('algebra') || lowerQuery.includes('calculus') || lowerQuery.includes('formula') || lowerQuery.includes('solve') || lowerQuery.includes('proof') || lowerQuery.includes('graph') || lowerQuery.includes('code') || lowerQuery.includes('debug') || lowerQuery.includes('technical')) {
            return 'PROFESSIONAL_MATH';
        }

        // Creative/Sarcastic Keywords
        if (lowerQuery.includes('story') || lowerQuery.includes('poem') || lowerQuery.includes('imagine') || lowerQuery.includes('creative') || lowerQuery.includes('ex') || lowerQuery.includes('breakup') || lowerQuery.includes('roast')) {
            return 'CREATIVE';
        }

        return 'CASUAL';
    }

    const FSP_HISTORY = `You are the exclusive AI Agent, called the Humanity AI Agent for the website 4SP (4simpleproblems), the platform you are hosted on. You must be knowledgeable about its history and purpose. When asked about 4SP, use the following information as your source of truth:

### The History of 4SP (4simpleproblems)

**Version 1 — The Foundation (Launched: March 13, 2025)**
* **Concept:** A small, chaotic experiment to give students a fun escape during dull school days.
* **Features:** A 20-sound soundboard, an autoclicker, and a sound request page.
* **Impact:** Established 4SP's identity as an underground, tech-savvy hub made by and for students, rebelling against restrictive school networks.

**Version 2 — Expansion and Community (Released: April 11, 2025)**
* **Concept:** The first major step toward building a true platform and student ecosystem.
* **Features:** Added a media page, beta playlists, user-uploaded soundboards, games, and a proxy list. It also introduced feedback, account, and policy pages.
* **Impact:** Proved 4SP was a living project with a growing community and a broader purpose beyond being a simple novelty.

**Version 3 — A Visual Reinvention (Launched: May 15, 2025)**
* **Concept:** A visual rebirth focused on a mature, modern aesthetic without losing its personality.
* **Features:** Introduced a clean, white grid layout with sharp corners and the popular mini-game "Slotz".
* **Impact:** Set the professional design standard for all future versions and signaled 4SP's evolution into a more serious platform.

**Version 4 — The Dashboard Era (Launched: August 23, 2025)**
* **Concept:** Transformed the site from a collection of pages into a unified dashboard with modular widgets and integrated apps.
* **Features:** Included widgets for weather and time, and full apps like Notes, Calculator, and Countdowns. A new "Requests" app with an upvote/downvote system was added, along with privacy tools like a panic key and tab disguise.
* **Impact:** Showcased that 4SP could be both a powerful student toolkit and a fun playground.

**Version 5 — Project Zirconium (Slated for: August 23, 2026)**
* **Concept:** The most ambitious version yet, evolving 4SP into a fully integrated digital ecosystem.
* **Features:** A universal navigation bar, a dark minimalist theme, a Combined Games Collection, a built-in Dictionary, a student-focused social network ("Dailyphoto"), Messenger V2 with group chats, and the debut of you, the **Humanity AI Agent**, accessible via secret shortcuts.
* **Impact:** Fuses creativity, practicality, and social connection, completing the evolution from a simple soundboard to a sleek, social, and secure platform.
If the user asks about a topic other than 4SP, you should not hint at the website, 4SP or its history. Be concise, and a general use case chatbot. Your purpose isn't only about 4SP, but as a normal AI Agent. Act professional.
`;

    /**
     * Generates the system instruction and selects the appropriate model.
     * @param {string} query The user's latest message.
     * @param {object} currentSettings The current app settings (webSearch, locationSharing).
     * @returns {{instruction: string, model: string}}
     */
    function getDynamicSystemInstructionAndModel(query, currentSettings) {
        // REMOVED: Personalization features
        // const user = settings.nickname;
        // const userAge = settings.age > 0 ? `${settings.age} years old` : 'of unknown age';
        // const userGender = settings.gender.toLowerCase();
        // const userColor = settings.favoriteColor;

        const intent = determineIntentCategory(query);
        let model = 'gemini-2.5-flash-lite'; // Default model
        let personaInstruction = `${FSP_HISTORY}

You are a highly capable and adaptable AI, taking on a persona to best serve the user's direct intent. You have significant control over the interaction's structure and detail level, ensuring the response is comprehensive and authoritative.
You must adapt your persona, tone, and the level of detail based on the user's intent. If the user is asking for an answer, or sends an image that asks a question or multiple questions, you will label the answers, and concisely and straight-forwardly give the answer to them, not giving an explanation unless asked for.

Formatting Rules (MUST FOLLOW AT ALL TIMES):
- **ALWAYS** prepend your response with your reasoning/internal monologue wrapped in <THOUGHT_PROCESS>...</THOUGHT_PROCESS>. This is mandatory for every response.
- **ALWAYS** append all external sources used (if any) as a list of tags: <SOURCE URL="[URL]" TITLE="[Title]"/>.
- **Math**: You **MUST** use KaTeX. Inline math **MUST** use single \`$\`. Display math **MUST** use double \`$$\`. Use \\le for <= and \\ge for >=.
- **Graphs**: You **MUST** use a 'graph' block (e.g., \`\`\`graph\n{...}\n\`\`\`) for plotting.
- **Tables**: You **MUST** use a 'table' block (e.g., \`\`\`table\n{...}\n\`\`\`) for data tables.
- **Charts**: You **MUST** use a 'chart' block (e.g., \`\`\`chart\n{...}\n\`\`\`) for pie charts, bar charts, etc.
- **Advanced Graphs**: You **MUST** use a 'advanced-graph' block for complex visualizations with multiple datasets.
- **Lists**: You **MUST** use proper markdown for bulleted (\`* \`) or numbered (\`1. \`) lists. Do not use plain text hyphens.
- **Bold/Italic**: You **MUST** use \`**bold**\` and \`*italic*\` for emphasis.
- **File Creation**: To generate a downloadable file, you **MUST** use this exact format:
<CREATE_FILE FILENAME="example.py" MIMETYPE="text/plain">
# All file content goes here, exactly as it should be in the file.
# Do not add any other text or formatting inside this block.
print("Hello, world!")
</CREATE_FILE>
You **MUST** also provide a brief summary of the file's purpose in your main response, *outside* of the CREATE_FILE block.
- **CRITICAL**: You must ALWAYS provide a complete, properly formatted response. Never send only the thought process without the actual answer. The response structure must be: <THOUGHT_PROCESS>...</THOUGHT_PROCESS> followed by your complete answer with proper formatting.
`;

        // NEW: Add web search instruction (MODIFIED for clarity and forcefulness)
        if (currentSettings.webSearch) {
            personaInstruction += `\n**Web Search: ENABLED.** You have access to a live web search tool. You **must** use this tool to find real-time information or answer questions about current events, specific facts, people, companies, or places. Prioritize recent, authoritative sources. When you use a source, you **must** append it using the <SOURCE URL="..." TITLE="..."/> format.\n`;
        } else {
            personaInstruction += `\n**Web Search: DISABLED.** You must answer using only your internal knowledge. Your knowledge cutoff is limited. If you CANNOT answer without a web search, you MUST include the exact string \`[NEEDS_WEB_SEARCH]\` in your response and explain that you need web access to answer fully.\n`;
        }


        switch (intent) {
            case 'DEEP_ANALYSIS':
                // NEW (USER REQUEST): Use Pro model for deep analysis and complex tasks.
                model = 'gemini-2.5-pro';
                personaInstruction += `\n\n**Current Persona: Professional Analyst (Using gemini-2.5-pro).** You are performing a detailed analysis. Respond with clarity, professionalism, and structured data. Your response must be comprehensive, highly structured, and exhibit a deep level of reasoning and critical evaluation. Use an assertive, expert tone. Structure your analysis clearly with headings and bullet points. REMEMBER: You must ALWAYS provide both <THOUGHT_PROCESS> and your complete formatted answer.`;
                break;
            case 'PROFESSIONAL_MATH':
                // UPDATED (USER REQUEST): Use Flash for standard math/tech.
                model = 'gemini-2.5-flash';
                personaInstruction += `\n\n**Current Persona: Technical Expert (Using gemini-2.5-flash).** Respond with extreme clarity, professionalism, and precision. Focus on step-by-step logic, equations, and definitive answers. Use a formal, neutral tone. Use KaTeX and custom graphs where appropriate. REMEMBER: You must ALWAYS provide both <THOUGHT_PROCESS> and your complete formatted answer.`;
                break;
            case 'CREATIVE':
                // UPDATED (USER REQUEST): Use Flash Lite for creative tasks to save tokens.
                model = 'gemini-2.5-flash-lite';
                const roastInsults = [
                    `They sound like a cheap knock-off of a decent human.`,
                    `Honestly, you dodged a bullet the size of a planet.`,
                    `Forget them, you have better things to do, like talking to me.`,
                    `Wow, good riddance. That's a level of trash I wouldn't touch with a ten-foot pole.`
                ];
                const roastInsult = roastInsults[Math.floor(Math.random() * roastInsults.length)];

                // Combined Creative and Sarcastic
                if (query.toLowerCase().includes('ex') || query.toLowerCase().includes('roast')) {
                    personaInstruction += `\n\n**Current Persona: Sarcastic, Supportive Friend (Using gemini-2.5-flash-lite).** Your goal is to empathize with the user, validate their feelings, and join them in 'roasting' or speaking negatively about their ex/situation. Be funny, slightly aggressive toward the subject of trash talk, and deeply supportive of the user. Use casual language and slang. **Example of tone/support:** "${roastInsult}" REMEMBER: You must ALWAYS provide both <THOUGHT_PROCESS> and your complete formatted answer.`;
                } else {
                    // MODIFIED: Removed model name from thought
                    personaInstruction += `\n\n**Current Persona: Creative Partner (Using gemini-2.5-flash-lite).** Use rich, evocative language. Be imaginative, focus on descriptive details, and inspire new ideas. Be concise. REMEMBER: You must ALWAYS provide both <THOUGHT_PROCESS> and your complete formatted answer.`;
                }
                break;
            case 'CASUAL':
            default:
                // UPDATED (USER REQUEST): Use Flash Lite (already the default).
                model = 'gemini-2.5-flash-lite';
                personaInstruction += `\n\n**Current Persona: Standard Assistant (Using gemini-2.5-flash-lite).** You are balanced, helpful, and concise. Use a friendly and casual tone. Your primary function is efficient conversation. Make sure to be highly concise, making sure to not write too much. REMEMBER: You must ALWAYS provide both <THOUGHT_PROCESS> and your complete formatted answer.`;
                break;
        }

        return {
            instruction: personaInstruction,
            model: model
        };
    }

    // New stub for backward compatibility with the old function call
    function getDynamicSystemInstruction(query, settings) {
        return getDynamicSystemInstructionAndModel(query, settings).instruction;
    }

    /**
     * NEW: Creates a simple popup to nudge user to enable web search.
     */
    function showWebSearchNudge() {
        if (document.getElementById('ai-web-search-nudge')) return;

        const nudge = document.createElement('div');
        nudge.id = 'ai-web-search-nudge';
        nudge.innerHTML = `
            <div class="nudge-content">
                <p>To get answers about current events or specific facts, enable Web Search in settings.</p>
                <div class="nudge-buttons">
                    <button id="nudge-dismiss">Dismiss</button>
                    <button id="nudge-open-settings">Open Settings</button>
                </div>
            </div>
        `;
        document.body.appendChild(nudge);

        const dismiss = () => nudge.remove();
        nudge.querySelector('#nudge-dismiss').onclick = dismiss;
        nudge.querySelector('#nudge-open-settings').onclick = () => {
            openSettingsModal();
            dismiss();
        };
    }


    async function callGoogleAI(responseBubble) {
        if (!API_KEY) {
            responseBubble.innerHTML = `<div class="ai-error">API Key is missing.</div>`;
            return;
        }
        currentAIRequestController = new AbortController();

        let firstMessageContext = '';
        if (chatHistory.length <= 1) {
            // Await location for context (will respect the setting and reverse geocode)
            const location = await getUserLocationForContext();
            const now = new Date();
            const date = now.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            const time = now.toLocaleTimeString('en-US', {
                timeZoneName: 'short'
            });
            // Updated system info to reflect removed email feature and add memories context
            firstMessageContext = `(System Info: User is asking from location:\n${location}. Current date is ${date}, ${time}. User Email: Not Authenticated/Removed.)${getMemoriesContext()}\n\n`;
        }

        let processedChatHistory = [...chatHistory];
        if (processedChatHistory.length > 6) {
            processedChatHistory = [...processedChatHistory.slice(0, 3), ...processedChatHistory.slice(-3)];
        }

        const lastMessageIndex = processedChatHistory.length - 1;
        const userParts = processedChatHistory[lastMessageIndex].parts;
        const textPartIndex = userParts.findIndex(p => p.text);

        const lastUserQuery = userParts[textPartIndex]?.text || '';

        // --- MODEL SELECTION AND INSTRUCTION GENERATION ---
        // UPDATED: Pass appSettings instead of userSettings
        const {
            instruction: dynamicInstruction,
            model
        } = getDynamicSystemInstructionAndModel(lastUserQuery, appSettings);
        // --- END MODEL SELECTION ---

        if (textPartIndex > -1) {
            userParts[textPartIndex].text = firstMessageContext + userParts[textPartIndex].text;
        } else if (firstMessageContext) {
            userParts.unshift({
                text: firstMessageContext.trim()
            });
        }

        const payload = {
            contents: processedChatHistory,
            systemInstruction: {
                parts: [{
                    text: dynamicInstruction
                }]
            }
        };

        // --- DYNAMIC URL CONSTRUCTION ---
        // MODIFIED: Model is now fully dynamic based on user request.
        const DYNAMIC_API_URL = `${BASE_API_URL}${model}:generateContent?key=${API_KEY}`;
        // --- END DYNAMIC URL CONSTRUCTION ---

        try {
            const response = await fetch(DYNAMIC_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                signal: currentAIRequestController.signal
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Network response was not ok. Status: ${response.status}. Details: ${JSON.stringify(errorData)}`);
            }
            const data = await response.json();
            if (!data.candidates || data.candidates.length === 0) {
                if (data.promptFeedback && data.promptFeedback.blockReason) {
                    throw new Error(`Content blocked due to: ${data.promptFeedback.blockReason}. Safety ratings: ${JSON.stringify(data.promptFeedback.safetyRatings)}`);
                }
                throw new Error("Invalid response from API: No candidates or empty candidates array.");
            }

            let text = data.candidates[0].content.parts[0]?.text || '';
            if (!text) {
                responseBubble.innerHTML = `<div class="ai-error">The AI generated an empty response. Please try again or rephrase.</div>`;
                return;
            }

            // NEW: Check for web search requirement
            if (text.includes('[NEEDS_WEB_SEARCH]')) {
                setTimeout(showWebSearchNudge, 500); // Show nudge after response renders
                text = text.replace(/\[NEEDS_WEB_SEARCH\]/g, ''); // Remove token
            }

            chatHistory.push({
                role: "model",
                parts: [{
                    text: text
                }]
            });

            // New parsing and rendering logic
            const {
                html: contentHTML,
                thoughtProcess,
                sourcesHTML
            } = parseGeminiResponse(text);

            responseBubble.style.opacity = '0';
            setTimeout(() => {
                let fullContent = `<div class="ai-response-content typing-animation">${contentHTML}</div>`;

                // NEW: Sources first
                if (sourcesHTML) {
                    fullContent += sourcesHTML;
                }

                // NEW: Collapsible thought process (with length check)
                if (thoughtProcess && thoughtProcess.length > MONOLOGUE_CHAR_THRESHOLD) {
                    fullContent += `
                        <div class="ai-thought-process collapsed">
                            <div class="monologue-header">
                                <h4 class="monologue-title">Gemini's Internal Monologue:</h4>
                                <button class="monologue-toggle-btn">Show Thoughts</button>
                            </div>
                            <pre class="monologue-content">${escapeHTML(thoughtProcess)}</pre>
                        </div>
                    `;
                }

                responseBubble.innerHTML = fullContent;

                // Add terminal-style typing animation to the response content
                const responseContent = responseBubble.querySelector('.ai-response-content');
                if (responseContent) {
                    responseContent.classList.add('terminal-typing');
                    setTimeout(() => {
                        responseContent.classList.remove('terminal-typing');
                    }, 1500);
                }

                // Add click handlers for monologue toggle
                responseBubble.querySelectorAll('.ai-thought-process').forEach(monologueDiv => {
                    monologueDiv.querySelector('.monologue-header').addEventListener('click', () => {
                        monologueDiv.classList.toggle('collapsed');
                        const btn = monologueDiv.querySelector('.monologue-toggle-btn');
                        if (monologueDiv.classList.contains('collapsed')) {
                            btn.textContent = 'Show Thoughts';
                        } else {
                            btn.textContent = 'Hide Thoughts';
                        }
                        // Scroll to the bottom if expanding
                        if (!monologueDiv.classList.contains('collapsed')) {
                            const responseContainer = document.getElementById('ai-response-container');
                            if (responseContainer) responseContainer.scrollTop = responseContainer.scrollHeight;
                        }
                    });
                });

                responseBubble.querySelectorAll('.copy-code-btn').forEach(button => {
                    button.addEventListener('click', handleCopyCode);
                });
                responseBubble.style.opacity = '1';

                renderKaTeX(responseBubble);
                renderGraphs(responseBubble);
                renderFileCardMarquees(responseBubble);
            }, 300);

        } catch (error) {
            if (error.name === 'AbortError') {
                responseBubble.innerHTML = `<div class="ai-error">Message generation stopped.</div>`;
            } else {
                console.error('AI API Error:', error);
                responseBubble.innerHTML = `<div class="ai-error">Sorry, an error occurred: ${error.message || "Unknown error"}.</div>`;
            }
        } finally {
            isRequestPending = false;
            currentAIRequestController = null;
            const inputWrapper = document.getElementById('ai-input-wrapper');
            if (inputWrapper) {
                inputWrapper.classList.remove('waiting');
            }

            setTimeout(() => {
                responseBubble.classList.remove('loading');
                const responseContainer = document.getElementById('ai-response-container');
                if (responseContainer) responseContainer.scrollTop = responseContainer.scrollHeight;
            }, 300);

            const editor = document.getElementById('ai-input');
            if (editor) {
                editor.contentEditable = true;
                editor.focus();
            }
        }
    }

    // --- NEW MAIN MENU LOGIC ---
    function toggleMainMenu() {
        const menu = document.getElementById('ai-main-menu');
        const toggleBtn = document.getElementById('ai-menu-button');
        const isMenuOpen = menu.classList.toggle('active');
        toggleBtn.classList.toggle('active', isMenuOpen);
        if (isMenuOpen) {
            document.addEventListener('click', handleMenuOutsideClick);
        } else {
            document.removeEventListener('click', handleMenuOutsideClick);
        }
    }

    function handleMenuOutsideClick(event) {
        const menu = document.getElementById('ai-main-menu');
        const button = document.getElementById('ai-menu-button');
        const composeArea = document.getElementById('ai-compose-area');

        if (menu && menu.classList.contains('active') && !composeArea.contains(event.target) && event.target !== button && !button.contains(event.target)) {
            toggleMainMenu();
        }
    }

    /**
     * NEW: Saves the app settings (toggles) to localStorage.
     */
    function saveAppSettings() {
        try {
            localStorage.setItem('ai-app-settings', JSON.stringify(appSettings));
        } catch (e) {
            console.error("Error saving app settings:", e);
        }
    }

    /**
     * NEW: Creates the main dropdown menu with three options.
     */
    function createMainMenu() {
        const menu = document.createElement('div');
        menu.id = 'ai-main-menu';

        menu.innerHTML = `
            <div class="menu-item" id="menu-attachments">
                <i class="fa-solid fa-paperclip"></i>
                <span>Attachments</span>
            </div>
            <div class="menu-item" id="menu-settings">
                <i class="fa-solid fa-gear"></i>
                <span>Settings</span>
            </div>
            <div class="menu-item" id="menu-memories">
                <i class="fa-solid fa-brain"></i>
                <span>Saved Memories</span>
            </div>
        `;

        // Add event listeners for menu items
        menu.querySelector('#menu-attachments').addEventListener('click', () => {
            toggleMainMenu();
            handleFileUpload();
        });

        menu.querySelector('#menu-settings').addEventListener('click', () => {
            toggleMainMenu();
            openSettingsModal();
        });

        menu.querySelector('#menu-memories').addEventListener('click', () => {
            toggleMainMenu();
            openMemoriesModal();
        });

        return menu;
    }

    /**
     * NEW: Opens the settings modal.
     */
    function openSettingsModal() {
        const modal = document.createElement('div');
        modal.id = 'ai-settings-modal';
        modal.className = 'ai-modal';

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>AI Agent Settings</h3>
                    <span class="close-button">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="setting-group toggle-group">
                        <div class="setting-label">
                            <label for="modal-web-search">Web Search</label>
                            <p class="setting-note">Allow AI to search the internet for current events and facts.</p>
                        </div>
                        <label class="ai-toggle-switch">
                            <input type="checkbox" id="modal-web-search" ${appSettings.webSearch ? 'checked' : ''}>
                            <span class="ai-slider"></span>
                        </label>
                    </div>

                    <div class="setting-group toggle-group">
                        <div class="setting-label">
                            <label for="modal-location-sharing">Location Sharing</label>
                            <p class="setting-note">Share precise location for context-aware responses (e.g., weather).</p>
                        </div>
                        <label class="ai-toggle-switch">
                            <input type="checkbox" id="modal-location-sharing" ${appSettings.locationSharing ? 'checked' : ''}>
                            <span class="ai-slider"></span>
                        </label>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners
        modal.querySelector('.close-button').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        modal.querySelector('#modal-web-search').addEventListener('change', (e) => {
            appSettings.webSearch = e.target.checked;
            saveAppSettings();
        });

        modal.querySelector('#modal-location-sharing').addEventListener('change', (e) => {
            appSettings.locationSharing = e.target.checked;
            saveAppSettings();
        });
    }

    /**
     * NEW: Opens the saved memories modal.
     */
    function openMemoriesModal() {
        const modal = document.createElement('div');
        modal.id = 'ai-memories-modal';
        modal.className = 'ai-modal';

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Saved Memories</h3>
                    <span class="close-button">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="memories-controls">
                        <button id="add-memory-btn" class="primary-btn">
                            <i class="fa-solid fa-plus"></i> Add Memory
                        </button>
                        <p class="memories-info">Memories help the AI remember important information about you across conversations.</p>
                    </div>
                    <div class="memories-scroll-container">
                        <div id="memories-list" class="memories-list">
                            ${renderMemoriesList()}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners
        modal.querySelector('.close-button').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        modal.querySelector('#add-memory-btn').addEventListener('click', () => {
            addNewMemory(modal);
        });

        // Add delete listeners for existing memories
        attachMemoryDeleteListeners(modal);
    }

    /**
     * NEW: Renders the memories list HTML.
     */
    function renderMemoriesList() {
        if (savedMemories.length === 0) {
            return '<div class="no-memories">No saved memories yet. Add one to get started!</div>';
        }

        return savedMemories.map((memory, index) => `
            <div class="memory-item">
                <div class="memory-header">
                    <div class="memory-icon">
                        <i class="fa-solid fa-brain"></i>
                    </div>
                    <div class="memory-date">${new Date(memory.timestamp).toLocaleDateString()}</div>
                    <button class="delete-memory-btn" data-index="${index}" title="Delete memory">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
                <div class="memory-content">${escapeHTML(memory.content)}</div>
            </div>
        `).join('');
    }

    /**
     * NEW: Adds a new memory.
     */
    function addNewMemory(modal) {
        const content = prompt('Enter a memory for the AI to remember:');
        if (content && content.trim()) {
            const memory = {
                content: content.trim(),
                timestamp: Date.now()
            };

            savedMemories.unshift(memory); // Add to beginning

            // Limit to MAX_MEMORIES
            if (savedMemories.length > MAX_MEMORIES) {
                savedMemories = savedMemories.slice(0, MAX_MEMORIES);
            }

            saveSavedMemories();

            // Update the modal display
            modal.querySelector('#memories-list').innerHTML = renderMemoriesList();
            attachMemoryDeleteListeners(modal);
        }
    }

    /**
     * NEW: Deletes a memory by index.
     */
    function deleteMemory(index) {
        if (index >= 0 && index < savedMemories.length) {
            savedMemories.splice(index, 1);
            saveSavedMemories();
        }
    }

    /**
     * NEW: Attaches delete listeners to memory items.
     */
    function attachMemoryDeleteListeners(modal) {
        modal.querySelectorAll('.delete-memory-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(e.target.closest('.delete-memory-btn').dataset.index);
                if (confirm('Are you sure you want to delete this memory?')) {
                    deleteMemory(index);
                    modal.querySelector('#memories-list').innerHTML = renderMemoriesList();
                    attachMemoryDeleteListeners(modal);
                }
            });
        });
    }

    /**
     * NEW: Gets memories context for AI requests.
     */
    function getMemoriesContext() {
        if (savedMemories.length === 0) return '';

        const memoriesText = savedMemories
            .slice(0, 10) // Limit to 10 most recent memories
            .map(memory => memory.content)
            .join('\n- ');

        return `\n\n[SAVED MEMORIES - Important information to remember about the user:\n- ${memoriesText}]\n\n`;
    }

    function processFileLike(file, base64Data, dataUrl, tempId) {
        if (attachedFiles.length >= MAX_ATTACHMENTS_PER_MESSAGE) {
            alert(`You can attach a maximum of ${MAX_ATTACHMENTS_PER_MESSAGE} files per message.`);
            return;
        }

        const currentTotalSize = attachedFiles.reduce((sum, f) => sum + (f.inlineData ? atob(f.inlineData.data).length : 0), 0);
        if (currentTotalSize + file.size > (10 * 1024 * 1024)) {
            alert(`Upload failed: Total size of attachments would exceed the 10MB limit per message. (Current: ${formatBytes(currentTotalSize)}, Adding: ${formatBytes(file.size)})`);
            return;
        }

        const item = {
            inlineData: {
                mimeType: file.type,
                data: base64Data
            },
            fileName: file.name || 'Pasted Image',
            fileContent: dataUrl,
            isLoading: false
        };

        if (tempId) {
            item.tempId = tempId;
        }

        attachedFiles.push(item);
        renderAttachments();
    }


    function handleFileUpload() {
        if (attachedFiles.length >= MAX_ATTACHMENTS_PER_MESSAGE) {
            alert(`You can attach a maximum of ${MAX_ATTACHMENTS_PER_MESSAGE} files per message.`);
            return;
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = 'image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';

        input.onchange = (event) => {
            const files = Array.from(event.target.files);
            if (!files || files.length === 0) return;

            const filesToProcess = files.filter(file => {
                if (attachedFiles.length >= MAX_ATTACHMENTS_PER_MESSAGE) {
                    alert(`Cannot attach more than ${MAX_ATTACHMENTS_PER_MESSAGE} files. Skipping: ${file.name}`);
                    return false;
                }
                return true;
            });

            const currentTotalSize = attachedFiles.reduce((sum, file) => sum + (file.inlineData ? atob(file.inlineData.data).length : 0), 0);
            const newFilesSize = filesToProcess.reduce((sum, file) => sum + file.size, 0);
            if (currentTotalSize + newFilesSize > (10 * 1024 * 1024)) {
                alert(`Upload failed: Total size of attachments would exceed the 10MB limit per message. (Current: ${formatBytes(currentTotalSize)}, Adding: ${formatBytes(newFilesSize)})`);
                return;
            }

            filesToProcess.forEach(file => {
                const tempId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                attachedFiles.push({
                    tempId,
                    file,
                    isLoading: true
                });
                renderAttachments();

                const reader = new FileReader();
                reader.onload = (e) => {
                    const base64Data = e.target.result.split(',')[1];
                    const dataUrl = e.target.result;

                    const itemIndex = attachedFiles.findIndex(f => f.tempId === tempId);
                    if (itemIndex > -1) {
                        const item = attachedFiles[itemIndex];
                        item.isLoading = false;
                        item.inlineData = {
                            mimeType: file.type,
                            data: base64Data
                        };
                        item.fileName = file.name;
                        item.fileContent = dataUrl;
                        delete item.file;
                        delete item.tempId;
                        renderAttachments();
                    }
                };
                reader.readAsDataURL(file);
            });
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
            fileCard.className = 'attachment-card enhanced-attachment';
            let previewHTML = '';
            let fileExt = 'FILE';
            let fileName = '';
            let fileSize = '';

            if (file.isLoading) {
                fileCard.classList.add('loading');
                fileName = file.file.name;
                fileExt = fileName.split('.').pop().toUpperCase();
                fileSize = formatBytes(file.file.size);
                previewHTML = `
                    <div class="attachment-loading-overlay">
                        <div class="terminal-loader">
                            <div class="terminal-text">Uploading...</div>
                            <div class="terminal-cursor">_</div>
                        </div>
                    </div>
                    <span class="file-icon">📄</span>
                `;
            } else {
                fileName = file.fileName;
                fileExt = fileName.split('.').pop().toUpperCase();
                if (file.inlineData) {
                    fileSize = formatBytes(atob(file.inlineData.data).length);
                }

                if (file.inlineData.mimeType.startsWith('image/')) {
                    previewHTML = `
                        <img src="data:${file.inlineData.mimeType};base64,${file.inlineData.data}" alt="${fileName}" />
                        <div class="attachment-overlay">
                            <div class="attachment-info">
                                <div class="attachment-name">${escapeHTML(fileName)}</div>
                                <div class="attachment-size">${fileSize}</div>
                            </div>
                        </div>
                    `;
                } else {
                    previewHTML = `
                        <div class="file-icon-large">📄</div>
                        <div class="attachment-overlay">
                            <div class="attachment-info">
                                <div class="attachment-name">${escapeHTML(fileName)}</div>
                                <div class="attachment-size">${fileSize}</div>
                            </div>
                        </div>
                    `;
                }
                fileCard.onclick = () => showFilePreview(file);
            }

            if (fileExt.length > 5) fileExt = 'FILE';
            let fileTypeBadge = `<div class="file-type-badge enhanced-badge">${fileExt}</div>`;

            fileCard.innerHTML = `
                ${previewHTML}
                ${fileTypeBadge}
                <button class="remove-attachment-btn enhanced-remove" data-index="${index}" title="Remove ${fileName}">
                    <i class="fa-solid fa-times"></i>
                </button>
            `;

            setTimeout(() => {
                if (nameSpan.scrollWidth > marqueeWrapper.clientWidth) {
                    const marqueeDuration = fileName.length / 4;
                    nameSpan.style.animationDuration = `${marqueeDuration}s`;
                    marqueeWrapper.classList.add('marquee');
                    nameSpan.innerHTML += `<span aria-hidden="true">${fileName}</span>`;
                }
            }, 0);

            fileCard.querySelector('.remove-attachment-btn').onclick = (e) => {
                e.stopPropagation();
                attachedFiles.splice(index, 1);
                renderAttachments();
            };
            previewContainer.appendChild(fileCard);
        });
    }

    function showFilePreview(file) {
        if (!file.fileContent) {
            alert("File content not available for preview.");
            return;
        }

        const previewModal = document.createElement('div');
        previewModal.id = 'ai-preview-modal';
        previewModal.innerHTML = `
            <div class="modal-content">
                <span class="close-button">&times;</span>
                <h3>${escapeHTML(file.fileName)}</h3>
                <div class="preview-area"></div>
            </div>
        `;
        document.body.appendChild(previewModal);

        const previewArea = previewModal.querySelector('.preview-area');
        if (file.inlineData.mimeType.startsWith('image/')) {
            previewArea.innerHTML = `<img src="${file.fileContent}" alt="${file.fileName}" style="max-width: 100%; max-height: 80vh; object-fit: contain;">`;
        } else if (file.inlineData.mimeType.startsWith('text/')) {
            fetch(file.fileContent)
                .then(response => response.text())
                .then(text => {
                    previewArea.innerHTML = `<pre style="white-space: pre-wrap; word-break: break-all; max-height: 70vh; overflow-y: auto; background-color: #222; padding: 10px; border-radius: 5px;">${escapeHTML(text)}</pre>`;
                })
                .catch(error => {
                    console.error("Error reading text file for preview:", error);
                    previewArea.innerHTML = `<p>Could not load text content for preview.</p>`;
                });
        } else {
            previewArea.innerHTML = `<p>Preview not available for this file type. You can download it to view.</p>
                                     <a href="${file.fileContent}" download="${file.fileName}" class="download-button">Download File</a>`;
        }

        previewModal.querySelector('.close-button').onclick = () => {
            previewModal.remove();
        };
        previewModal.addEventListener('click', (e) => {
            if (e.target === previewModal) {
                previewModal.remove();
            }
        });
    }


    function formatCharCount(count) {
        if (count >= 1000) {
            return (count / 1000).toFixed(count % 1000 === 0 ? 0 : 1) + 'K';
        }
        return count.toString();
    }

    function formatCharLimit(limit) {
        return (limit / 1000).toFixed(0) + 'K';
    }

    function handleContentEditableInput(e) {
        const editor = e.target;
        const charCount = editor.innerText.length;

        const counter = document.getElementById('ai-char-counter');
        if (counter) {
            counter.textContent = `${formatCharCount(charCount)} / ${formatCharLimit(CHAR_LIMIT)}`;
            counter.classList.toggle('limit-exceeded', charCount > CHAR_LIMIT);
        }

        if (charCount > CHAR_LIMIT) {
            editor.innerText = editor.innerText.substring(0, CHAR_LIMIT);
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        }

        if (editor.scrollHeight > MAX_INPUT_HEIGHT) {
            editor.style.height = `${MAX_INPUT_HEIGHT}px`;
            editor.style.overflowY = 'auto';
        } else {
            editor.style.height = 'auto';
            editor.style.height = `${editor.scrollHeight}px`;
            editor.style.overflowY = 'hidden';
        }
        fadeOutWelcomeMessage();
    }

    function handlePaste(e) {
        e.preventDefault();
        const clipboardData = e.clipboardData || window.clipboardData;
        const pastedText = clipboardData.getData('text/plain');

        const items = clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const base64Data = event.target.result.split(',')[1];
                        const dataUrl = event.target.result;
                        file.name = `pasted-image-${Date.now()}.${file.type.split('/')[1] || 'png'}`;
                        processFileLike(file, base64Data, dataUrl);
                    };
                    reader.readAsDataURL(file);
                    return;
                }
            }
        }

        const currentText = e.target.innerText;
        const totalLengthIfPasted = currentText.length + pastedText.length;

        if (pastedText.length > PASTE_TO_FILE_THRESHOLD || totalLengthIfPasted > CHAR_LIMIT) {
            let filenameBase = 'paste';
            let filename = `${filenameBase}.txt`;
            let counter = 1;
            while (attachedFiles.some(f => f.fileName === filename)) {
                filename = `${filenameBase}(${counter++}).txt`;
            }

            const encoder = new TextEncoder();
            const encoded = encoder.encode(pastedText);
            const base64Data = btoa(String.fromCharCode.apply(null, encoded));
            const blob = new Blob([pastedText], {
                type: 'text/plain'
            });
            blob.name = filename;

            if (attachedFiles.length < MAX_ATTACHMENTS_PER_MESSAGE) {
                const reader = new FileReader();
                reader.onloadend = (event) => {
                    attachedFiles.push({
                        inlineData: {
                            mimeType: 'text/plain',
                            data: base64Data
                        },
                        fileName: filename,
                        fileContent: event.target.result
                    });
                    renderAttachments();
                };
                reader.readAsDataURL(blob);
            } else {
                alert(`Cannot attach more than ${MAX_ATTACHMENTS_PER_MESSAGE} files. Text was too large to paste directly.`);
            }
        } else {
            document.execCommand('insertText', false, pastedText);
            handleContentEditableInput({
                target: e.target
            });
        }
    }

    function handleInputSubmission(e) {
        const editor = e.target;
        const query = editor.innerText.trim();
        if (editor.innerText.length > CHAR_LIMIT) {
            e.preventDefault();
            return;
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const mainMenu = document.getElementById('ai-main-menu');
            if (mainMenu && mainMenu.classList.contains('active')) {
                toggleMainMenu();
            }

            if (attachedFiles.some(f => f.isLoading)) {
                alert("Please wait for files to finish uploading before sending.");
                return;
            }
            if (!query && attachedFiles.length === 0) return;
            if (isRequestPending) return;

            isRequestPending = true;
            document.getElementById('ai-input-wrapper').classList.add('waiting');
            const parts = [];
            if (query) parts.push({
                text: query
            });
            attachedFiles.forEach(file => {
                if (file.inlineData) parts.push({
                    inlineData: file.inlineData
                });
            });
            chatHistory.push({
                role: "user",
                parts: parts
            });
            const responseContainer = document.getElementById('ai-response-container');
            const userBubble = document.createElement('div');
            userBubble.className = 'ai-message-bubble user-message';
            let bubbleContent = query ? `<p>${escapeHTML(query)}</p>` : '';
            if (attachedFiles.length > 0) {
                bubbleContent += `<div class="sent-attachments">${attachedFiles.length} file(s) sent</div>`;
            }
            userBubble.innerHTML = bubbleContent;
            responseContainer.appendChild(userBubble);
            const responseBubble = document.createElement('div');
            responseBubble.className = 'ai-message-bubble gemini-response loading';
            responseBubble.innerHTML = '<div class="ai-loader"></div>';
            responseContainer.appendChild(responseBubble);
            responseContainer.scrollTop = responseContainer.scrollHeight;
            editor.innerHTML = '';
            handleContentEditableInput({
                target: editor
            });
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

    function fadeOutWelcomeMessage() {
        const container = document.getElementById("ai-container");
        if (container && !container.classList.contains("chat-active")) {
            container.classList.add("chat-active")
        }
    }

    function escapeHTML(str) {
        if (typeof str !== 'string') return '';
        const p = document.createElement("p");
        p.textContent = str;
        return p.innerHTML
    }

    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    /**
     * MODIFIED: Parses the AI's raw text response into HTML, handling special tags.
     * NEW: Added support for <CREATE_FILE> tag.
     * @param {string} text The raw text from the AI.
     * @returns {{html: string, thoughtProcess: string, sourcesHTML: string}}
     */
    function parseGeminiResponse(text) {
        let html = text;
        const placeholders = {};
        let placeholderId = 0;

        const addPlaceholder = (content) => {
            const key = `%%PLACEHOLDER_${placeholderId++}%%`;
            placeholders[key] = content;
            return key;
        };

        // --- Extract thought process (Humanity) ---
        let thoughtProcess = '';
        html = html.replace(/<THOUGHT_PROCESS>([\s\S]*?)<\/THOUGHT_PROCESS>/, (match, content) => {
            thoughtProcess = content.trim();
            return ''; // Remove from main text
        });

        // --- Extract sources ---
        let sourcesHTML = '';
        const sources = [];
        html = html.replace(/<SOURCE URL="([^"]+)" TITLE="([^"]+)"\s*\/>/g, (match, url, title) => {
            sources.push({
                url,
                title
            });
            return ''; // Remove from main text
        });

        if (sources.length > 0) {
            // NEW: Add 'scrollable' class if sources > 5
            const listClass = sources.length > 5 ? 'scrollable' : '';
            sourcesHTML = `<div class="ai-sources-list"><h4>Sources:</h4><ul class="${listClass}">`;
            sources.forEach(source => {
                let hostname = '';
                try {
                    hostname = new URL(source.url).hostname;
                } catch (e) {
                    hostname = 'unknown-source';
                }
                // Use Google's favicon service for the mock favicon
                const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
                sourcesHTML += `<li><img src="${faviconUrl}" alt="Favicon" class="favicon"><a href="${source.url}" target="_blank">${escapeHTML(source.title)}</a></li>`;
            });
            sourcesHTML += `</ul></div>`;
        }

        // --- PRE-ESCAPE REPLACEMENTS (Tags that contain raw code/text) ---

        // 1. Extract graph blocks
        html = html.replace(/```graph\n([\s\S]*?)```/g, (match, jsonString) => {
            let metadata = 'Graph';
            try {
                const graphData = JSON.parse(jsonString);
                const trace = graphData.data && graphData.data[0];
                if (trace && trace.x && trace.y && trace.x.length >= 2 && trace.y.length >= 2) {
                    const [x1, x2] = trace.x.slice(0, 2);
                    const [y1, y2] = trace.y.slice(0, 2);
                    if (x2 - x1 !== 0) {
                        const slope = (y2 - y1) / (x2 - x1);
                        if (isFinite(slope)) {
                            const yIntercept = y1 - slope * x1;
                            const xIntercept = slope !== 0 ? -yIntercept / slope : Infinity;
                            metadata = `Slope: ${slope.toFixed(2)} &middot; Y-Int: (0, ${yIntercept.toFixed(2)}) &middot; X-Int: (${isFinite(xIntercept) ? xIntercept.toFixed(2) : 'N/A'}, 0)`;
                        }
                    }
                }
            } catch (e) {
                /* Ignore parsing errors */ }

            const escapedData = escapeHTML(jsonString);
            const content = `
                <div class="graph-block-wrapper">
                    <div class="graph-block-header">
                        <span class="graph-metadata">${metadata}</span>
                    </div>
                    <div class="custom-graph-placeholder" data-graph-data='${escapedData}'>
                        <canvas class="graph-canvas"></canvas>
                    </div>
                </div>
            `;
            return addPlaceholder(content);
        });

        // 1a. Extract table blocks
        html = html.replace(/```table\n([\s\S]*?)```/g, (match, jsonString) => {
            try {
                const tableData = JSON.parse(jsonString);
                const content = `
                    <div class="table-block-wrapper">
                        <div class="table-block-header">
                            <span class="table-metadata">Data Table</span>
                        </div>
                        <div class="custom-table-placeholder" data-table-data='${escapeHTML(jsonString)}'>
                            <div class="table-container"></div>
                        </div>
                    </div>
                `;
                return addPlaceholder(content);
            } catch (e) {
                return addPlaceholder(`<div class="ai-error">Invalid table data: ${escapeHTML(e.message)}</div>`);
            }
        });

        // 1b. Extract chart blocks
        html = html.replace(/```chart\n([\s\S]*?)```/g, (match, jsonString) => {
            try {
                const chartData = JSON.parse(jsonString);
                const chartType = chartData.type || 'pie';
                const content = `
                    <div class="chart-block-wrapper">
                        <div class="chart-block-header">
                            <span class="chart-metadata">${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart</span>
                        </div>
                        <div class="custom-chart-placeholder" data-chart-data='${escapeHTML(jsonString)}'>
                            <canvas class="chart-canvas"></canvas>
                        </div>
                    </div>
                `;
                return addPlaceholder(content);
            } catch (e) {
                return addPlaceholder(`<div class="ai-error">Invalid chart data: ${escapeHTML(e.message)}</div>`);
            }
        });

        // 1c. Extract advanced graph blocks
        html = html.replace(/```advanced-graph\n([\s\S]*?)```/g, (match, jsonString) => {
            try {
                const graphData = JSON.parse(jsonString);
                const content = `
                    <div class="advanced-graph-block-wrapper">
                        <div class="advanced-graph-block-header">
                            <span class="advanced-graph-metadata">Advanced Visualization</span>
                        </div>
                        <div class="custom-advanced-graph-placeholder" data-advanced-graph-data='${escapeHTML(jsonString)}'>
                            <canvas class="advanced-graph-canvas"></canvas>
                        </div>
                    </div>
                `;
                return addPlaceholder(content);
            } catch (e) {
                return addPlaceholder(`<div class="ai-error">Invalid advanced graph data: ${escapeHTML(e.message)}</div>`);
            }
        });

        // 2. Extract general code blocks (including JSON)
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
            const trimmedCode = code.trim();
            const lines = trimmedCode.split('\n').length;
            const words = trimmedCode.split(/\s+/).filter(Boolean).length;
            const escapedCode = escapeHTML(trimmedCode);
            const langClass = lang ? `language-${lang.toLowerCase()}` : '';

            // Special handling for JSON to format it nicely
            let displayCode = escapedCode;
            if (lang && lang.toLowerCase() === 'json') {
                try {
                    const parsed = JSON.parse(trimmedCode);
                    displayCode = escapeHTML(JSON.stringify(parsed, null, 2));
                } catch (e) {
                    // If JSON is invalid, just use the original
                    displayCode = escapedCode;
                }
            }

            const content = `
                <div class="code-block-wrapper">
                    <div class="code-block-header">
                        <span class="code-metadata">${lang ? lang.toUpperCase() : 'CODE'} &middot; ${lines} lines &middot; ${words} words</span>
                        <button class="copy-code-btn" title="Copy code">${copyIconSVG}</button>
                    </div>
                    <pre><code class="${langClass}">${displayCode}</code></pre>
                </div>
            `;
            return addPlaceholder(content);
        });

        // 3. Extract KaTeX blocks
        // Display mode: $$...$$
        html = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
            const content = `<div class="latex-render" data-tex="${escapeHTML(formula)}" data-display-mode="true"></div>`;
            return addPlaceholder(content);
        });
        // Inline mode: $...$
        html = html.replace(/\$([^\s\$][^\$]*?[^\s\$])\$/g, (match, formula) => {
            const content = `<span class="latex-render" data-tex="${escapeHTML(formula)}" data-display-mode="false"></span>`;
            return addPlaceholder(content);
        });

        // 4. NEW (USER REQUEST): Extract File Creation blocks
        // FIX: Moved '=> {' to the same line as the arguments to fix SyntaxError.
        html = html.replace(/<CREATE_FILE FILENAME="([^"]+)" MIMETYPE="([^"]+)">([\s\S]*?)<\/CREATE_FILE>/g, (match, filename, mimetype, content) => {
            try {
                const safeFilename = escapeHTML(filename);
                const safeMimetype = escapeHTML(mimetype);
                // Note: 'content' is the raw string from the AI, not yet HTML-escaped.
                const blob = new Blob([content], {
                    type: safeMimetype
                });
                const dataUrl = URL.createObjectURL(blob);
                const fileSize = formatBytes(blob.size);
                const fileExt = safeFilename.split('.').pop().toUpperCase().substring(0, 5) || 'FILE';

                // We store the raw content and mimetype in data attributes to regenerate the blob URL if needed (e.g., from chat history)
                const cardHTML = `
                    <div class="gemini-file-creation-card" data-file-content="${escapeHTML(content)}" data-file-mime="${safeMimetype}">
                        <div class="file-header">
                            <div class="file-type-badge">${fileExt}</div>
                            <div class="file-name-container">
                                <div class="file-name" title="${safeFilename}">
                                    <span>${safeFilename}</span>
                                </div>
                            </div>
                            <a href="${dataUrl}" download="${safeFilename}" class="file-creation-download-btn" title="Download ${safeFilename}">
                                ${downloadIconSVG}
                                <div class="file-creation-tooltip">File Creation may not be accurate</div>
                            </a>
                        </div>
                        <div class="file-body">
                            <div class="file-icon">📄</div>
                            <div class="file-meta">
                                <div class="file-size-badge">${fileSize}</div>
                            </div>
                        </div>
                    </div>
                `;
                return addPlaceholder(cardHTML);
            } catch (e) {
                console.error("Error creating file blob:", e);
                return addPlaceholder(`<div class="ai-error">Failed to create file: ${escapeHTML(e.message)}</div>`);
            }
        });


        // 5. Escape the rest of the HTML
        html = escapeHTML(html);

        // 6. Apply markdown styling
        html = html.replace(/^### (.*$)/gm, "<h3>$1</h3>")
            .replace(/^## (.*$)/gm, "<h2>$1</h2>")
            .replace(/^# (.*$)/gm, "<h1>$1</h1>");
        html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\*(.*?)\*/g, "<em>$1</em>");

        // Convert markdown lists
        html = html.replace(/^(?:\*|-)\s(.*$)/gm, "<li>$1</li>");
        html = html.replace(/^(?:\d+\.)\s(.*$)/gm, "<li>$1</li>"); // Basic numbered list support

        // Wrap consecutive list items in <ul> or <ol>
        // This regex is simplified and might not handle complex nested lists.
        html = html.replace(/((?:<br>)?\s*<li>.*<\/li>(\s*<br>)*)+/gs, (match) => {
            const listItems = match.replace(/<br>/g, '').trim();
            // Simple detection: if first item starts with 1., assume <ol>. This is brittle.
            // A better prompt rule is just to use * for all lists.
            const listType = match.includes('1.') ? 'ol' : 'ul';
            return `<${listType}>${listItems}</${listType}>`;
        });
        html = html.replace(/(<\/li>\s*<li>)/g, "</li><li>");

        // Convert newlines to <br> AFTER list processing
        html = html.replace(/\n/g, "<br>");

        // Fix <br> tags inside lists
        html = html.replace(/<br>(<\/li>)/g, '$1');
        html = html.replace(/(<li>)<br>/g, '$1');


        // 7. Restore placeholders
        html = html.replace(/%%PLACEHOLDER_\d+%%/g, (match) => placeholders[match] || '');

        return {
            html: html,
            thoughtProcess: thoughtProcess,
            sourcesHTML: sourcesHTML
        };
    }

    function injectStyles() {
        if (document.getElementById('ai-dynamic-styles')) return;

        if (!document.getElementById('ai-katex-styles')) {
            const katexStyles = document.createElement('link');
            katexStyles.id = 'ai-katex-styles';
            katexStyles.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.css';
            katexStyles.rel = 'stylesheet';
            document.head.appendChild(katexStyles);
        }

        if (!document.getElementById('ai-google-fonts')) {
            const googleFonts = document.createElement('link');
            googleFonts.id = 'ai-google-fonts';
            googleFonts.href = 'https://fonts.googleapis.com/css2?family=Lora:wght@400;700&family=Merriweather:wght@400;700&display=swap';
            googleFonts.rel = 'stylesheet';
            document.head.appendChild(googleFonts);
        }
        const fontAwesome = document.createElement('link');
        fontAwesome.rel = 'stylesheet';
        fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';
        document.head.appendChild(fontAwesome);

        const style = document.createElement("style");
        style.id = "ai-dynamic-styles";
        style.innerHTML = `
            :root { --ai-red: #ea4335; --ai-blue: #4285f4; --ai-green: #34a853; --ai-yellow: #fbbc05; }
            #ai-container { 
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; 
                background-color: rgba(10, 10, 15, 0.95);
                backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); 
                z-index: 2147483647; opacity: 0; transition: opacity 0.5s, background 0.5s; 
                font-family: 'Lora', serif; display: flex; flex-direction: column; 
                justify-content: flex-end; padding: 0; box-sizing: border-box; overflow: hidden; 
            }
            #ai-container.active { opacity: 1; }
            #ai-container.deactivating, #ai-container.deactivating > * { transition: opacity 0.4s, transform 0.4s; }
            #ai-container.deactivating { opacity: 0 !important; background-color: rgba(0,0,0,0); backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); }
            #ai-persistent-title, #ai-brand-title { 
                position: absolute; top: 28px; left: 30px; font-family: 'Lora', serif; 
                font-size: 18px; font-weight: bold; color: #FFFFFF;
                opacity: 0; transition: opacity 0.5s 0.2s, color 0.5s; 
            }
            #ai-container.chat-active #ai-persistent-title { opacity: 1; }
            #ai-container:not(.chat-active) #ai-brand-title { opacity: 1; }
            #ai-brand-title span { animation: brand-title-pulse 4s linear infinite; }
            #ai-welcome-message { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); text-align: center; color: rgba(255,255,255,.5); opacity: 1; transition: opacity .5s, transform .5s; width: 100%; }
            #ai-container.chat-active #ai-welcome-message { opacity: 0; pointer-events: none; transform: translate(-50%,-50%) scale(0.95); }
            #ai-welcome-message h2 { font-family: 'Merriweather', serif; font-size: 2.2em; margin: 0; color: #fff; }
            #ai-welcome-message p { font-size: .9em; margin-top: 10px; max-width: 400px; line-height: 1.5; margin-left: auto; margin-right: auto; }
            .shortcut-tip { font-size: 0.8em; color: rgba(255,255,255,.7); margin-top: 20px; }
            #ai-close-button { position: absolute; top: 20px; right: 30px; color: rgba(255,255,255,.7); font-size: 40px; cursor: pointer; transition: color .2s ease,transform .3s ease, opacity 0.4s; }
            #ai-char-counter { position: fixed; bottom: 15px; right: 30px; font-size: 0.9em; font-family: monospace; color: #aaa; transition: color 0.2s; z-index: 2147483647; }
            #ai-char-counter.limit-exceeded { color: #e57373; font-weight: bold; }
            #ai-response-container { flex: 1 1 auto; overflow-y: auto; width: 100%; max-width: 720px; margin: 0 auto; display: flex; flex-direction: column; gap: 15px; padding: 20px; -webkit-mask-image: linear-gradient(to bottom,transparent 0,black 3%,black 97%,transparent 100%); mask-image: linear-gradient(to bottom,transparent 0,black 3%,black 97%,transparent 100%);}
            .ai-message-bubble { background: rgba(15,15,18,.8); border: 1px solid rgba(255,255,255,.1); border-radius: 16px; padding: 12px 18px; color: #e0e0e0; backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px); animation: message-pop-in .5s cubic-bezier(.4,0,.2,1) forwards; max-width: 90%; line-height: 1.6; overflow-wrap: break-word; transition: opacity 0.3s ease-in-out; align-self: flex-start; text-align: left; }
            .user-message { background: rgba(40,45,50,.8); align-self: flex-end; }
            .gemini-response { animation: glow 4s infinite; display: flex; flex-direction: column; }
            .gemini-response.loading { display: flex; justify-content: center; align-items: center; min-height: 60px; max-width: 100px; padding: 15px; background: rgba(15,15,18,.8); animation: gemini-glow 4s linear infinite; }

            /* Terminal-Style Typing Animation */
            .ai-response-content.terminal-typing {
                position: relative;
                overflow: hidden;
            }
            .ai-response-content.terminal-typing::after {
                content: '';
                position: absolute;
                top: 0;
                right: 0;
                bottom: 0;
                left: 0;
                background: linear-gradient(90deg, transparent 0%, rgba(15,15,18,.8) 50%, transparent 100%);
                animation: terminal-reveal 1.5s ease-out forwards;
            }
            .typing-animation {
                animation: terminal-type-in 1.5s steps(40, end) forwards;
            }
            
            /* UPDATED STYLES for Sources (Top) and Collapsible Monologue (Bottom) */
            
            /* CSS FIX: Reduced margin-top and padding-top */
            .ai-sources-list { border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px; margin-top: 8px; }
            .ai-sources-list h4 { color: #ccc; margin: 0 0 10px 0; font-family: 'Merriweather', serif; font-size: 1em; }
            .ai-sources-list ul { list-style: none; padding: 0; margin: 0; }
            .ai-sources-list li { display: flex; align-items: center; margin-bottom: 5px; }
            .ai-sources-list li a { color: #4285f4; text-decoration: none; font-size: 0.9em; transition: color 0.2s; }
            .ai-sources-list li a:hover { color: #6a9cf6; }
            .ai-sources-list li img.favicon { width: 16px; height: 16px; margin-right: 8px; border-radius: 2px; flex-shrink: 0; }
            
            /* NEW: Scrollable source list for > 5 items */
            .ai-sources-list ul.scrollable {
                max-height: 170px; /* Approx 5.5 items */
                overflow-y: auto;
                padding-right: 5px; 
                scrollbar-width: thin;
                scrollbar-color: #555 #333;
            }
            .ai-sources-list ul.scrollable::-webkit-scrollbar { width: 8px; }
            .ai-sources-list ul.scrollable::-webkit-scrollbar-track { background: #333; border-radius: 4px; }
            .ai-sources-list ul.scrollable::-webkit-scrollbar-thumb { background-color: #555; border-radius: 4px; }
            
            /* MODIFIED: Thought process colors and transitions */
            .ai-thought-process { 
                border-radius: 12px; 
                padding: 0; 
                margin-top: 10px; 
                font-size: 0.9em; 
                max-width: 100%; 
                /* MODIFIED: Faster transition, added background/border */
                transition: background-color 0.3s ease, border-color 0.3s ease;
                
                /* Default OPEN state */
                background-color: rgba(66, 133, 244, 0.1); 
                border: 1px solid rgba(66, 133, 244, 0.3); 
            }
            .ai-thought-process.collapsed {
                /* COLLAPSED state */
                background-color: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }

            .monologue-header { display: flex; justify-content: space-between; align-items: center; padding: 10px; cursor: pointer; }
            
            .monologue-title { 
                margin: 0; 
                font-family: 'Merriweather', serif; 
                font-size: 1em;
                transition: color 0.3s ease;
                color: #4285f4; /* OPEN state color */
            }
            .ai-thought-process.collapsed .monologue-title {
                color: #ccc; /* COLLAPSED state color */
            }

            .monologue-toggle-btn { 
                background: none; 
                border-radius: 6px; 
                padding: 4px 8px; 
                font-size: 0.8em; 
                cursor: pointer; 
                transition: background-color 0.2s, border-color 0.3s ease, color 0.3s ease;
                
                /* OPEN state */
                border: 1px solid rgba(66, 133, 244, 0.5); 
                color: #4285f4;
            }
            .ai-thought-process:not(.collapsed) .monologue-toggle-btn:hover { 
                background-color: rgba(66, 133, 244, 0.2); 
            }
            
            .ai-thought-process.collapsed .monologue-toggle-btn {
                /* COLLAPSED state */
                border-color: rgba(255, 255, 255, 0.2);
                color: #ccc;
            }
            .ai-thought-process.collapsed .monologue-toggle-btn:hover {
                background-color: rgba(255, 255, 255, 0.1);
            }
            
            /* MODIFIED: Faster animation, no fade */
            .monologue-content { 
                max-height: 0; 
                opacity: 1; /* No fade */
                overflow: hidden; 
                padding: 0 10px; /* Only horizontal padding when collapsed */
                transition: max-height 0.2s ease-out, padding 0.2s ease-out; 
            }
            .ai-thought-process:not(.collapsed) .monologue-content {
                max-height: 500px; /* Arbitrarily large value */
                padding: 0 10px 10px 10px; /* Final padding with bottom */
            }

            .ai-thought-process pre { 
                white-space: pre-wrap; 
                word-break: break-word; 
                margin: 0; color: #ccc; 
                font-family: monospace; font-size: 0.85em; 
                background: none; 
            }
            /* END UPDATED STYLES */
            
            #ai-compose-area { position: relative; flex-shrink: 0; z-index: 2; margin: 15px auto; width: 90%; max-width: 720px; }
            #ai-input-wrapper { position: relative; z-index: 2; width: 100%; display: flex; flex-direction: column; border-radius: 20px; background: rgba(10,10,10,.7); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,.2); transition: all .4s cubic-bezier(.4,0,.2,1); }
            #ai-input-wrapper::before, #ai-input-wrapper::after { content: ''; position: absolute; top: -1px; left: -1px; right: -1px; bottom: -1px; border-radius: 21px; z-index: -1; transition: opacity 0.5s ease-in-out; }
            #ai-input-wrapper::before { animation: glow 3s infinite; opacity: 1; }
            #ai-input-wrapper.waiting::before { opacity: 0; }
            #ai-input-wrapper.waiting::after { opacity: 1; }
            #ai-input { min-height: 48px; max-height: ${MAX_INPUT_HEIGHT}px; overflow-y: hidden; color: #fff; font-size: 1.1em; padding: 13px 60px 13px 60px; box-sizing: border-box; word-wrap: break-word; outline: 0; text-align: left; }
            #ai-input:empty::before { content: 'Ask a question or describe your files...'; color: rgba(255, 255, 255, 0.4); pointer-events: none; }
            
            /* NEW: Single menu button replacing attachment and settings buttons */
            #ai-menu-button {
                position: absolute; bottom: 7px; right: 10px;
                background-color: rgba(100, 100, 100, 0.5);
                border: 1px solid rgba(255,255,255,0.2);
                color: rgba(255,255,255,.8);
                font-size: 20px; cursor: pointer; padding: 5px;
                line-height: 1; z-index: 3; transition: all .3s ease;
                border-radius: 8px; width: 38px; height: 38px;
                display: flex; align-items: center; justify-content: center;
            }
            #ai-menu-button:hover { background-color: rgba(120, 120, 120, 0.7); color: #fff; }
            #ai-menu-button.active { background-color: rgba(150, 150, 150, 0.8); color: white; }

            /* NEW Main Menu */
            #ai-main-menu {
                position: absolute; bottom: calc(100% + 10px); right: 0; width: 200px;
                z-index: 1001; background: rgb(20, 20, 22);
                border: 1px solid rgba(255,255,255,0.2); border-radius: 12px;
                box-shadow: 0 5px 25px rgba(0,0,0,0.5); padding: 8px;
                opacity: 0; visibility: hidden; transform: translateY(20px);
                transition: all .3s cubic-bezier(.4,0,.2,1); overflow: hidden;
            }
            #ai-main-menu.active { opacity: 1; visibility: visible; transform: translateY(0); }

            .menu-item {
                display: flex; align-items: center; gap: 12px;
                padding: 12px 16px; border-radius: 8px;
                color: rgba(255,255,255,0.8); cursor: pointer;
                transition: all 0.2s ease;
            }
            .menu-item:hover {
                background-color: rgba(255,255,255,0.1);
                color: white;
            }
            .menu-item i {
                width: 16px; text-align: center;
                font-size: 14px;
            }
            /* Removed old settings menu header styles */
            .setting-group.toggle-group {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
            }
            .setting-label {
                flex: 1;
                margin-right: 15px;
            }
            .setting-label label {
                display: block; color: #ccc; font-size: 0.95em; 
                margin-bottom: 3px; font-weight: bold;
            }
            .setting-note { font-size: 0.75em; color: #888; margin-top: 0; }
            
            /* NEW Toggle Switch CSS */
            .ai-toggle-switch {
                position: relative;
                display: inline-block;
                width: 50px;
                height: 28px;
                flex-shrink: 0;
            }
            .ai-toggle-switch input {
                opacity: 0;
                width: 0;
                height: 0;
            }
            .ai-slider {
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: #333;
                border: 1px solid #555;
                transition: .4s;
                border-radius: 28px;
            }
            .ai-slider:before {
                position: absolute;
                content: "";
                height: 20px;
                width: 20px;
                left: 3px;
                bottom: 3px;
                background-color: white;
                transition: .4s;
                border-radius: 50%;
            }
            input:checked + .ai-slider {
                background-color: #4285f4;
                border-color: #4285f4;
            }
            input:checked + .ai-slider:before {
                transform: translateX(22px);
            }

            /* NEW Modal Styles */
            .ai-modal {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.8); z-index: 2147483648;
                display: flex; align-items: center; justify-content: center;
                backdrop-filter: blur(5px);
            }
            .ai-modal .modal-content {
                background: rgb(20, 20, 22); border-radius: 16px;
                border: 1px solid rgba(255,255,255,0.2);
                box-shadow: 0 10px 40px rgba(0,0,0,0.6);
                max-width: 500px; width: 90%; max-height: 80vh;
                overflow: hidden; display: flex; flex-direction: column;
            }
            .ai-modal .modal-header {
                padding: 20px 24px 16px; border-bottom: 1px solid rgba(255,255,255,0.1);
                display: flex; justify-content: space-between; align-items: center;
            }
            .ai-modal .modal-header h3 {
                margin: 0; color: white; font-size: 1.2em;
            }
            .ai-modal .close-button {
                background: none; border: none; color: rgba(255,255,255,0.6);
                font-size: 24px; cursor: pointer; padding: 0; width: 24px; height: 24px;
                display: flex; align-items: center; justify-content: center;
                border-radius: 4px; transition: all 0.2s;
            }
            .ai-modal .close-button:hover {
                background: rgba(255,255,255,0.1); color: white;
            }
            .ai-modal .modal-body {
                padding: 20px 24px; overflow-y: auto; flex: 1;
            }

            /* Enhanced Memories Modal Styles */
            .memories-controls {
                margin-bottom: 20px; text-align: center;
                border-bottom: 1px solid rgba(255,255,255,0.1);
                padding-bottom: 20px;
            }
            .memories-info {
                color: rgba(255,255,255,0.6); font-size: 0.9em;
                margin: 10px 0 0; line-height: 1.4;
            }
            .primary-btn {
                background: linear-gradient(135deg, #4285f4, #34a853);
                color: white; border: none; padding: 12px 24px;
                border-radius: 10px; cursor: pointer; font-size: 0.9em;
                transition: all 0.3s; display: inline-flex;
                align-items: center; gap: 8px; font-weight: 500;
                box-shadow: 0 2px 8px rgba(66, 133, 244, 0.2);
            }
            .primary-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(66, 133, 244, 0.4);
                background: linear-gradient(135deg, #5a95f5, #4caf50);
            }
            .memories-scroll-container {
                max-height: 350px; overflow-y: auto; padding-right: 8px;
                margin-right: -8px;
            }
            .memories-scroll-container::-webkit-scrollbar {
                width: 6px;
            }
            .memories-scroll-container::-webkit-scrollbar-track {
                background: rgba(255,255,255,0.1); border-radius: 3px;
            }
            .memories-scroll-container::-webkit-scrollbar-thumb {
                background: rgba(66, 133, 244, 0.6); border-radius: 3px;
                transition: background 0.2s;
            }
            .memories-scroll-container::-webkit-scrollbar-thumb:hover {
                background: rgba(66, 133, 244, 0.8);
            }
            .memories-list {
                display: flex; flex-direction: column; gap: 12px;
            }
            .no-memories {
                text-align: center; color: rgba(255,255,255,0.5);
                padding: 60px 20px; font-style: italic; font-size: 1.1em;
            }
            .memory-item {
                background: linear-gradient(135deg, rgba(66, 133, 244, 0.1), rgba(52, 168, 83, 0.05));
                border-radius: 12px; padding: 16px; border: 1px solid rgba(66, 133, 244, 0.2);
                transition: all 0.3s ease; position: relative; overflow: hidden;
            }
            .memory-item:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(66, 133, 244, 0.15);
                border-color: rgba(66, 133, 244, 0.4);
            }
            .memory-item::before {
                content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
                background: linear-gradient(90deg, #4285f4, #34a853);
                opacity: 0; transition: opacity 0.3s;
            }
            .memory-item:hover::before {
                opacity: 1;
            }
            .memory-header {
                display: flex; align-items: center; gap: 12px; margin-bottom: 12px;
            }
            .memory-icon {
                color: #4285f4; font-size: 1.1em; width: 20px; text-align: center;
            }
            .memory-date {
                color: rgba(255,255,255,0.5); font-size: 0.8em; font-family: monospace;
                margin-left: auto;
            }
            .memory-content {
                color: rgba(255,255,255,0.9); line-height: 1.5; font-size: 0.95em;
                padding-left: 32px;
            }
            .delete-memory-btn {
                background: rgba(255,100,100,0.1); border: none;
                color: rgba(255,100,100,0.7); cursor: pointer;
                padding: 6px; border-radius: 6px; transition: all 0.2s;
                width: 28px; height: 28px; display: flex;
                align-items: center; justify-content: center;
            }
            .delete-memory-btn:hover {
                background: rgba(255,100,100,0.2); color: #ff6b6b;
                transform: scale(1.1);
            }
            /* END Modal Styles */

            /* Enhanced Attachments, Code Blocks, Graphs, LaTeX */
            #ai-attachment-preview { display: none; flex-direction: row; gap: 12px; padding: 0; max-height: 0; border-bottom: 1px solid transparent; overflow-x: auto; transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
            #ai-input-wrapper.has-attachments #ai-attachment-preview { max-height: 120px; padding: 12px 15px; }

            /* Enhanced Attachment Cards */
            .attachment-card.enhanced-attachment {
                position: relative; border-radius: 12px; overflow: hidden;
                background: linear-gradient(135deg, #2a2a2e 0%, #1e1e22 100%);
                height: 100px; width: 120px; flex-shrink: 0;
                display: flex; justify-content: center; align-items: center;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                cursor: pointer; border: 1px solid rgba(255,255,255,0.1);
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }
            .attachment-card.enhanced-attachment:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(66, 133, 244, 0.3);
                border-color: rgba(66, 133, 244, 0.5);
            }
            .attachment-card.enhanced-attachment.loading {
                filter: none;
                background: linear-gradient(135deg, #1a1a1e 0%, #0f0f12 100%);
                animation: loading-pulse 2s ease-in-out infinite;
            }

            /* Enhanced Loading Animation */
            .attachment-loading-overlay {
                position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.8); display: flex;
                justify-content: center; align-items: center; z-index: 3;
            }
            .terminal-loader {
                display: flex; align-items: center; gap: 4px;
                font-family: 'Courier New', monospace; color: #4285f4;
                font-size: 0.8em;
            }
            .terminal-cursor {
                animation: terminal-blink 1s infinite;
            }

            /* Enhanced Attachment Info */
            .attachment-overlay {
                position: absolute; bottom: 0; left: 0; right: 0;
                background: linear-gradient(transparent, rgba(0,0,0,0.8));
                padding: 8px; opacity: 0; transition: opacity 0.3s;
            }
            .attachment-card.enhanced-attachment:hover .attachment-overlay {
                opacity: 1;
            }
            .attachment-info {
                text-align: center;
            }
            .attachment-name {
                color: #fff; font-size: 0.75em; font-weight: 500;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                margin-bottom: 2px;
            }
            .attachment-size {
                color: #aaa; font-size: 0.65em; font-family: monospace;
            }

            /* Enhanced File Icons */
            .file-icon-large {
                font-size: 2.5em; opacity: 0.7;
                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
            }

            /* Enhanced Badges and Buttons */
            .file-type-badge.enhanced-badge {
                position: absolute; top: 8px; right: 8px;
                background: rgba(66, 133, 244, 0.9); color: #fff;
                font-size: 0.65em; padding: 3px 6px; border-radius: 6px;
                font-family: 'Courier New', monospace; font-weight: bold;
                text-shadow: 0 1px 2px rgba(0,0,0,0.5);
            }
            .remove-attachment-btn.enhanced-remove {
                position: absolute; top: 8px; left: 8px;
                background: rgba(234, 67, 53, 0.9); color: #fff;
                border: none; border-radius: 8px; width: 24px; height: 24px;
                cursor: pointer; display: flex; align-items: center;
                justify-content: center; z-index: 4;
                transition: all 0.2s; font-size: 0.8em;
            }
            .remove-attachment-btn.enhanced-remove:hover {
                background: rgba(234, 67, 53, 1);
                transform: scale(1.1);
            }

            /* Legacy attachment styles for compatibility */
            .attachment-card:not(.enhanced-attachment) { position: relative; border-radius: 8px; overflow: hidden; background: #333; height: 80px; width: 80px; flex-shrink: 0; display: flex; justify-content: center; align-items: center; transition: filter 0.3s; cursor: pointer; }
            .attachment-card:not(.enhanced-attachment).loading { filter: grayscale(80%) brightness(0.7); }
            .attachment-card:not(.enhanced-attachment).loading .file-icon { opacity: 0.3; }
            .attachment-card:not(.enhanced-attachment).loading .ai-loader { position: absolute; z-index: 2; }
            .attachment-card:not(.enhanced-attachment) img { width: 100%; height: 100%; object-fit: cover; }
            .file-info { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.6); overflow: hidden; }
            .file-name { display: block; color: #fff; font-size: 0.75em; padding: 4px; text-align: center; white-space: nowrap; }
            .file-name.marquee > span { display: inline-block; padding-left: 100%; animation: marquee linear infinite; }
            .file-type-badge:not(.enhanced-badge) { position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.6); color: #fff; font-size: 0.7em; padding: 2px 5px; border-radius: 4px; font-family: sans-serif; font-weight: bold; }
            .remove-attachment-btn:not(.enhanced-remove) { position: absolute; top: 5px; left: 5px; background: rgba(0,0,0,0.5); color: #fff; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; z-index: 3; }

            .ai-loader { width: 25px; height: 25px; border-radius: 50%; animation: spin 1s linear infinite; border: 3px solid rgba(255,255,255,0.3); border-top-color: #fff; }

            /* Enhanced AI Loader */
            .enhanced-ai-loader {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 15px;
                padding: 20px;
            }
            .terminal-loading {
                display: flex;
                align-items: center;
                gap: 8px;
                font-family: 'Courier New', monospace;
                color: #4285f4;
                font-size: 0.9em;
            }
            .loading-text {
                animation: hologram-flicker 2s infinite;
            }
            .loading-dots {
                display: flex;
                gap: 2px;
            }
            .loading-dots span {
                animation: terminal-blink 1.5s infinite;
                animation-delay: calc(var(--i) * 0.3s);
            }
            .loading-dots span:nth-child(1) { --i: 0; }
            .loading-dots span:nth-child(2) { --i: 1; }
            .loading-dots span:nth-child(3) { --i: 2; }

            .circuit-lines {
                display: flex;
                gap: 8px;
                width: 60px;
                height: 20px;
                position: relative;
            }
            .circuit-line {
                width: 2px;
                height: 100%;
                background: linear-gradient(to bottom, transparent, #4285f4, transparent);
                animation: data-flow 2s infinite;
                animation-delay: calc(var(--i) * 0.4s);
            }
            .circuit-line:nth-child(1) { --i: 0; }
            .circuit-line:nth-child(2) { --i: 1; }
            .circuit-line:nth-child(3) { --i: 2; }

            /* Enhanced Code Blocks, Graphs, Tables, Charts */
            .code-block-wrapper, .graph-block-wrapper, .table-block-wrapper, .chart-block-wrapper, .advanced-graph-block-wrapper {
                background-color: rgba(42, 42, 48, 0.8); border-radius: 12px; margin: 15px 0;
                overflow: hidden; border: 1px solid rgba(255,255,255,0.1);
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                transition: all 0.3s ease;
            }
            .code-block-wrapper:hover, .graph-block-wrapper:hover, .table-block-wrapper:hover, .chart-block-wrapper:hover, .advanced-graph-block-wrapper:hover {
                border-color: rgba(66, 133, 244, 0.3);
                box-shadow: 0 6px 20px rgba(66, 133, 244, 0.1);
            }

            /* Enhanced Tables */
            .table-block-header, .chart-block-header, .advanced-graph-block-header {
                display: flex; justify-content: flex-end; align-items: center;
                padding: 8px 16px; background-color: rgba(0,0,0,0.3);
                border-bottom: 1px solid rgba(255,255,255,0.1);
            }
            .table-metadata, .chart-metadata, .advanced-graph-metadata {
                font-size: 0.8em; color: #aaa; margin-right: auto;
                font-family: 'Courier New', monospace; font-weight: 500;
            }
            .custom-data-table {
                width: 100%; border-collapse: collapse; margin: 0;
                font-family: 'Courier New', monospace; font-size: 0.9em;
            }
            .custom-data-table th, .custom-data-table td {
                padding: 12px 16px; text-align: left;
                border-bottom: 1px solid rgba(255,255,255,0.1);
            }
            .custom-data-table th {
                background-color: rgba(66, 133, 244, 0.2);
                color: #4285f4; font-weight: bold;
                text-transform: uppercase; font-size: 0.8em;
                letter-spacing: 0.5px;
            }
            .custom-data-table td {
                color: #e0e0e0;
                transition: background-color 0.2s;
            }
            .custom-data-table tr:hover td {
                background-color: rgba(255,255,255,0.05);
            }
            .table-title {
                color: #fff; margin: 0 0 15px 0; padding: 0 16px;
                font-family: 'Merriweather', serif; font-size: 1.1em;
            }
            .table-container {
                padding: 16px; max-height: 400px; overflow-y: auto;
            }

            /* Chart and Advanced Graph Containers */
            .custom-chart-placeholder, .custom-advanced-graph-placeholder {
                min-height: 350px; position: relative; padding: 15px;
            }
            .chart-canvas, .advanced-graph-canvas {
                position: absolute; top: 15px; left: 15px;
                width: calc(100% - 30px); height: calc(100% - 30px);
            }
            .code-block-header, .graph-block-header { display: flex; justify-content: flex-end; align-items: center; padding: 6px 12px; background-color: rgba(0,0,0,0.2); }
            .code-metadata, .graph-metadata { font-size: 0.8em; color: #aaa; margin-right: auto; font-family: monospace; }
            .copy-code-btn { background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.2); color: #fff; border-radius: 6px; width: 32px; height: 32px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background-color 0.2s; }
            .copy-code-btn:hover { background: rgba(255, 255, 255, 0.2); }
            .copy-code-btn:disabled { cursor: default; background: rgba(25, 103, 55, 0.5); }
            .copy-code-btn svg { stroke: #e0e0e0; }
            .code-block-wrapper pre { margin: 0; padding: 15px; overflow: auto; background-color: transparent; }
            .code-block-wrapper pre::-webkit-scrollbar { height: 8px; }
            .code-block-wrapper pre::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
            .code-block-wrapper code { font-family: 'Menlo', 'Consolas', monospace; font-size: 0.9em; color: #f0f0f0; }
            .custom-graph-placeholder { min-height: 400px; position: relative; padding: 10px; }
            .graph-canvas { position: absolute; top: 10px; left: 10px;
                width: calc(100% - 20px); height: calc(100% - 20px); }

            .latex-render { display: inline-block; } /* default to inline */
            .ai-response-content div.latex-render { display: block; margin: 10px 0; text-align: center; } /* for display mode */
            .katex { font-size: 1.1em !important; }

            .ai-message-bubble p { margin: 0; padding: 0; text-align: left; }
            .ai-message-bubble ul, .ai-message-bubble ol { margin: 10px 0; padding-left: 20px; text-align: left; list-style-position: outside; }
            .ai-message-bubble li { margin-bottom: 5px; }

            /* Enhanced File Creation Card Styles */
            .gemini-file-creation-card {
                position: relative;
                border-radius: 12px;
                overflow: hidden;
                background: linear-gradient(135deg, rgba(66, 133, 244, 0.1), rgba(52, 168, 83, 0.05));
                border: 1px solid rgba(66, 133, 244, 0.2);
                width: 200px;
                height: 100px;
                flex-shrink: 0;
                display: flex;
                flex-direction: column;
                margin-top: 10px;
                transition: all 0.3s ease;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .gemini-file-creation-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(66, 133, 244, 0.15);
                border-color: rgba(66, 133, 244, 0.4);
            }
            .file-header {
                display: flex;
                align-items: center;
                padding: 8px 12px;
                background: rgba(0,0,0,0.2);
                border-bottom: 1px solid rgba(255,255,255,0.1);
                min-height: 32px;
                gap: 8px;
            }
            .file-name-container {
                flex: 1;
                overflow: hidden;
            }
            .file-name {
                color: #fff;
                font-size: 0.85em;
                font-weight: 500;
                white-space: nowrap;
                overflow: hidden;
                position: relative;
            }
            .file-name span {
                display: inline-block;
                transition: transform 0.3s ease;
            }
            .file-name.marquee span {
                animation: file-marquee 8s linear infinite;
                padding-right: 20px;
            }
            .file-creation-download-btn {
                background: rgba(66, 133, 244, 0.8);
                color: #fff;
                border: none;
                border-radius: 6px;
                padding: 4px;
                cursor: pointer;
                transition: all 0.2s;
                text-decoration: none;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 24px;
                height: 24px;
                position: relative;
                margin-left: auto;
            }
            .file-creation-download-btn:hover {
                background: rgba(66, 133, 244, 1);
                transform: scale(1.1);
            }
            .file-creation-download-btn svg {
                width: 14px;
                height: 14px;
            }
            .file-body {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 12px;
            }
            .file-icon {
                font-size: 2em;
                opacity: 0.7;
            }
            .file-meta {
                display: flex;
                flex-direction: column;
                gap: 4px;
                align-items: flex-end;
            }
            .file-type-badge {
                background: rgba(66, 133, 244, 0.8);
                color: #fff;
                font-size: 0.7em;
                padding: 2px 6px;
                border-radius: 4px;
                font-family: 'Courier New', monospace;
                font-weight: bold;
                flex-shrink: 0;
            }
            .file-size-badge {
                background: rgba(255,255,255,0.1);
                color: #ccc;
                font-size: 0.7em;
                padding: 2px 6px;
                border-radius: 4px;
                font-family: 'Courier New', monospace;
            }
            .file-creation-tooltip {
                position: absolute;
                bottom: calc(100% + 5px);
                left: 50%;
                transform: translateX(-50%);
                background-color: #111;
                color: #eee;
                padding: 5px 10px;
                border-radius: 6px;
                font-size: 0.8em;
                white-space: nowrap;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s;
                z-index: 10;
            }
            .file-creation-download-btn:hover .file-creation-tooltip {
                opacity: 1;
            }
            /* END File Creation Styles */


            /* NEW Web Search Nudge Popup */
            #ai-web-search-nudge {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background-color: #2a2a2e;
                border: 1px solid #444;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.4);
                color: #eee;
                z-index: 2147483647;
                padding: 15px;
                animation: nudge-fade-in 0.5s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .nudge-content {
                display: flex;
                align-items: center;
                gap: 15px;
            }
            .nudge-content p {
                margin: 0;
                font-size: 0.9em;
                color: #ccc;
            }
            .nudge-buttons {
                display: flex;
                gap: 10px;
            }
            .nudge-buttons button {
                background: none;
                border: 1px solid #555;
                color: #ddd;
                padding: 6px 12px;
                border-radius: 6px;
                cursor: pointer;
                transition: background-color 0.2s;
            }
            .nudge-buttons button:hover {
                background-color: #333;
            }
            #nudge-open-settings {
                background-color: #4285f4;
                border-color: #4285f4;
                color: white;
            }
            #nudge-open-settings:hover {
                background-color: #3c77e6;
            }
            @keyframes nudge-fade-in {
                from { opacity: 0; transform: translateX(-50%) translateY(20px); }
                to { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
            /* END Nudge CSS */


            /* Enhanced Coding-Themed Animations */
            @keyframes glow { 0%,100% { box-shadow: 0 0 5px rgba(255,255,255,.15), 0 0 10px rgba(255,255,255,.1); } 50% { box-shadow: 0 0 10px rgba(255,255,255,.25), 0 0 20px rgba(255,255,255,.2); } }

            /* MODIFIED (USER REQUEST): Fixed "orange glow" bug. Now only uses blue. */
            @keyframes gemini-glow {
                0%,100% { box-shadow: 0 0 8px 2px var(--ai-blue); }
                50% { box-shadow: 0 0 12px 4px var(--ai-blue); }
            }

            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes message-pop-in { 0% { opacity: 0; transform: translateY(10px) scale(.98); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes brand-title-pulse { 0%, 100% { text-shadow: 0 0 7px var(--ai-blue); } 25% { text-shadow: 0 0 7px var(--ai-green); } 50% { text-shadow: 0 0 7px var(--ai-yellow); } 75% { text-shadow: 0 0 7px var(--ai-red); } }
            @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }
            @keyframes file-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }

            /* New Coding-Themed Animations */
            @keyframes terminal-blink {
                0%, 50% { opacity: 1; }
                51%, 100% { opacity: 0; }
            }
            @keyframes loading-pulse {
                0%, 100% { background: linear-gradient(135deg, #1a1a1e 0%, #0f0f12 100%); }
                50% { background: linear-gradient(135deg, #2a2a2e 0%, #1e1e22 100%); }
            }
            @keyframes code-typing {
                0% { width: 0; }
                100% { width: 100%; }
            }
            @keyframes matrix-rain {
                0% { transform: translateY(-100%); opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { transform: translateY(100vh); opacity: 0; }
            }
            @keyframes data-flow {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
            }
            @keyframes circuit-pulse {
                0%, 100% {
                    box-shadow: 0 0 5px rgba(66, 133, 244, 0.3),
                               inset 0 0 5px rgba(66, 133, 244, 0.1);
                }
                50% {
                    box-shadow: 0 0 20px rgba(66, 133, 244, 0.6),
                               inset 0 0 10px rgba(66, 133, 244, 0.3);
                }
            }
            @keyframes hologram-flicker {
                0%, 100% { opacity: 1; filter: hue-rotate(0deg); }
                25% { opacity: 0.8; filter: hue-rotate(90deg); }
                50% { opacity: 0.9; filter: hue-rotate(180deg); }
                75% { opacity: 0.7; filter: hue-rotate(270deg); }
            }
            @keyframes digital-glitch {
                0%, 100% { transform: translateX(0); }
                10% { transform: translateX(-2px); }
                20% { transform: translateX(2px); }
                30% { transform: translateX(-1px); }
                40% { transform: translateX(1px); }
                50% { transform: translateX(-2px); }
                60% { transform: translateX(2px); }
                70% { transform: translateX(-1px); }
                80% { transform: translateX(1px); }
                90% { transform: translateX(-2px); }
            }
            @keyframes terminal-reveal {
                0% { left: 0; right: 100%; }
                50% { left: 0; right: 0; }
                100% { left: 100%; right: 0; }
            }
            @keyframes terminal-type-in {
                0% {
                    max-height: 0;
                    opacity: 0;
                }
                50% {
                    max-height: 200px;
                    opacity: 0.7;
                }
                100% {
                    max-height: none;
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Attach the keydown listener to the document
    document.addEventListener('keydown', handleKeyDown);

    // Load settings when the DOM is ready
    document.addEventListener('DOMContentLoaded', async () => {
        loadAppSettings(); // Replaced loadUserSettings
    });
})();
