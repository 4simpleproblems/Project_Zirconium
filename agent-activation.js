// Humanity Agent UI/UX - Inject & Activate by pressing Ctrl+Shift+H
(function() {
    // --- CONFIGURATION ---
    const API_KEY = 'AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro'; // Use your actual API key
    const SEARCH_ENGINE_ID = 'd0d0c075d757140ef'; // Humanity Web Search Engine ID
    const BLUR_CLASS = "humanity-blur";
    const UI_ID = "humanity-agent-ui";
    const ACTIVATION_SHORTCUT = { ctrl: true, shift: true, key: "h" };

    // --- PAGE BLUR ---
    function blurPage() {
        document.body.classList.add(BLUR_CLASS);
        injectBlurCss();
    }
    function unblurPage() {
        document.body.classList.remove(BLUR_CLASS);
    }
    function injectBlurCss() {
        if (!document.getElementById("humanity-blur-css")) {
            const style = document.createElement("style");
            style.id = "humanity-blur-css";
            style.textContent = `body.${BLUR_CLASS} > *:not(#${UI_ID}) {
                filter: blur(6px) grayscale(20%);
                transition: filter 0.4s;
            }`;
            document.head.appendChild(style);
        }
    }

    // --- UI CREATION ---
    function createUI() {
        if (document.getElementById(UI_ID)) return;
        const ui = document.createElement("div");
        ui.id = UI_ID;
        ui.tabIndex = 0;
        ui.style.cssText = `
            position: fixed; left: 0; top: 0; width: 100vw; height: 100vh;
            z-index: 100000; background: rgba(30,36,54,0.85); box-shadow: 0 2px 16px #21306d70;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            opacity: 0; pointer-events: all; transition: opacity 0.5s ease;
        `;
        setTimeout(() => ui.style.opacity = 1, 120);

        // Branding
        const title = document.createElement("h2");
        title.textContent = "Humanity Agent";
        title.style.cssText = "letter-spacing:2px;font-size:2.5em;margin-bottom:8px;color:#F5F5F5;";
        ui.appendChild(title);

        // Box
        const box = document.createElement("div");
        box.style.cssText = `
            background: #232841; border-radius: 18px; box-shadow: 0 1px 22px #0005;
            padding:26px 15px;width:420px;max-width:90vw;text-align:left;
            display:flex;flex-direction:column;gap:12px;align-items:center;`;

        // Search area
        const input = document.createElement("textarea");
        input.id = "humanity-agent-input";
        input.maxLength = 5000;
        input.rows = 2;
        input.placeholder = "Ask me anything…";
        input.style.cssText = "width:97%;height:44px;font-size:1.15em;padding:10px;border-radius:9px;border:1px solid #3a4152;resize:none;background:#232a41;color:#f5f5f5;outline:none;";
        box.appendChild(input);

        // Submit
        const submit = document.createElement("button");
        submit.textContent = "Ask Humanity";
        submit.style.cssText = "margin:4px 0 0 0;background:#247cff;color:#fff;border:none;border-radius:7px;padding:12px;font-size:1.05em;cursor:pointer;align-self:flex-end;box-shadow:0 3px 10px #1a206b56;";
        submit.onclick = doSearch;
        box.appendChild(submit);

        // Results
        const resultContainer = document.createElement("div");
        resultContainer.id = "humanity-agent-result";
        resultContainer.style.cssText = "width:98%;min-height:80px;margin-top:16px;font-size:1em;color:#d1e8fd;";
        box.appendChild(resultContainer);

        // Sources
        const sourceContainer = document.createElement("div");
        sourceContainer.id = "humanity-agent-sources";
        sourceContainer.style.cssText = "width:98%;margin-top:8px;font-size:0.93em;color:#9de1ff;";
        box.appendChild(sourceContainer);

        // Close
        const closeBtn = document.createElement("button");
        closeBtn.textContent = "×";
        closeBtn.title = "Close Humanity";
        closeBtn.style.cssText = "position:absolute;top:16px;right:29px;background:transparent;color:#e9eaef;border:none;font-size:2.6em;cursor:pointer;";
        closeBtn.onclick = deactivate;
        ui.appendChild(closeBtn);

        ui.appendChild(box);
        document.body.appendChild(ui);

        input.focus();

        function doSearch() {
            const query = input.value.trim();
            resultContainer.textContent = "";
            sourceContainer.textContent = "";
            if (!query) {
                resultContainer.textContent = "Please enter a question.";
                return;
            }
            resultContainer.textContent = "Searching…";
            searchWeb(query)
                .then(res => {
                    renderResponse(res, resultContainer, sourceContainer);
                })
                .catch(err => {
                    resultContainer.textContent = "Search failed: " + err;
                    sourceContainer.textContent = "";
                });
        }
    }

    // --- WEB SEARCH LOGIC (Google Custom Search JSON API) ---
    async function searchWeb(query) {
        const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&cx=${SEARCH_ENGINE_ID}&key=${API_KEY}&safe=active`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error("Network error");
        const data = await resp.json();
        if (!data.items || !data.items.length) return { answer: "No relevant results found.", sources: [] };
        // For now, simply summarize the top results
        const sources = [];
        let summary = "";
        for (const item of data.items) {
            sources.push({ title: item.title, url: item.link });
            summary += `• ${item.title}: ${item.snippet}\n`;
        }
        return { answer: summary.trim(), sources };
    }

    // --- RESPONSE RENDERING ---
    function renderResponse(res, resultContainer, sourceContainer) {
        resultContainer.textContent = res.answer;
        if (res.sources && res.sources.length) {
            sourceContainer.innerHTML = "Sources:<br>" +
                res.sources.map(s => `<a href="${s.url}" style="color:#78c3ff;" target="_blank">${s.title}</a>`).join("<br>");
        }
    }

    // --- DEACTIVATE UI ---
    function deactivate() {
        const ui = document.getElementById(UI_ID);
        if (ui) ui.style.opacity = 0;
        setTimeout(() => {
            if (ui) ui.remove();
        }, 430);
        unblurPage();
    }

    // --- ACTIVATE VIA HOTKEY ---
    document.addEventListener("keydown", function(e){
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === ACTIVATION_SHORTCUT.key) {
            // Only activate if not already present
            if (!document.getElementById(UI_ID)) {
                blurPage();
                createUI();
            }
        }
        // Allow Escape to close instantly
        if (e.key === "Escape") deactivate();
    });

    // --- CLEANUP ON NAVIGATION ---
    window.addEventListener("beforeunload", deactivate);

    // --- DARK THEME CSS ---
    injectBlurCss();
})();
