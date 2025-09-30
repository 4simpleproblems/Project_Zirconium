document.addEventListener('DOMContentLoaded', async () => {
    const G_ELEMENTS = {
        greeting: document.getElementById('greeting-text'),
        weatherSection: document.getElementById('weather-greeting-section'),
        location: document.getElementById('weather-location'),
        temp: document.getElementById('weather-temp'),
        condition: document.getElementById('weather-condition'),
        eventDate: document.getElementById('event-date'),
        eventText: document.getElementById('event-text'),
        quoteText: document.getElementById('quote-text'),
        quoteAuthor: document.getElementById('quote-author'),
        quickActionsGrid: document.getElementById('quick-actions-grid'),
        lastUpdated: document.getElementById('last-updated'),
        refreshBtn: document.getElementById('refresh-dashboard-btn'),
        weatherModal: {
            self: document.getElementById('weather-settings-modal'),
            openBtn: document.getElementById('weather-settings-btn'),
            closeBtn: document.getElementById('close-weather-modal-btn'),
            input: document.getElementById('location-input'),
            saveBtn: document.getElementById('save-location-btn'),
            currentBtn: document.getElementById('use-current-location-btn'),
            error: document.getElementById('modal-error')
        },
        actionsModal: {
            self: document.getElementById('actions-settings-modal'),
            openBtn: document.getElementById('actions-settings-btn'),
            closeBtn: document.getElementById('close-actions-modal-btn'),
            checklist: document.getElementById('actions-checklist')
        }
    };

    let allPages = [];

    // --- DATA FETCHING & RENDERING ---
    async function fetchPages() {
        try {
            const response = await fetch('./Pages.json');
            if (!response.ok) throw new Error('Network response was not ok');
            allPages = await response.json();
        } catch (error) {
            console.error('Failed to fetch Pages.json:', error);
            G_ELEMENTS.quickActionsGrid.innerHTML = `<p class="text-red-400 col-span-4">Could not load quick actions.</p>`;
        }
    }

    function renderQuickActions() {
        const savedActions = JSON.parse(localStorage.getItem('quickActions')) || ['dashboard', 'soundboard', 'playlists', 'games'];
        const actionsToRender = allPages.filter(p => savedActions.includes(p.id));
        G_ELEMENTS.quickActionsGrid.innerHTML = actionsToRender.map(page => `
            <a href="${page.path}" class="flex flex-col items-center justify-center p-4 bg-gray-700/50 hover:bg-gray-700 rounded-xl transition-colors text-center">
                <i class="${page.icon} fa-2x mb-2"></i>
                <span>${page.name}</span>
            </a>
        `).join('');
    }

    // --- MODAL & SETTINGS LOGIC ---
    function populateActionsSettings() {
        const savedActions = JSON.parse(localStorage.getItem('quickActions')) || ['dashboard', 'soundboard', 'playlists', 'games'];
        G_ELEMENTS.actionsModal.checklist.innerHTML = allPages.map(page => `
            <label class="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-700 cursor-pointer">
                <input type="checkbox" data-page-id="${page.id}" class="h-5 w-5 rounded bg-gray-600 border-gray-500 text-blue-500 focus:ring-blue-500" ${savedActions.includes(page.id) ? 'checked' : ''}>
                <span class="text-white">${page.name}</span>
            </label>
        `).join('');
        const checkboxes = G_ELEMENTS.actionsModal.checklist.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => checkbox.addEventListener('change', handleActionSelection));
    }

    function handleActionSelection(e) {
        const checkboxes = G_ELEMENTS.actionsModal.checklist.querySelectorAll('input[type="checkbox"]');
        let selected = Array.from(checkboxes).filter(c => c.checked).map(c => c.dataset.pageId);
        
        if (selected.length > 4) {
            e.target.checked = false; 
            return;
        }
        localStorage.setItem('quickActions', JSON.stringify(selected));
        renderQuickActions();
    }

    function openModal(modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
    function closeModal(modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }

    // --- DYNAMIC CONTENT WIDGETS ---
    const updateGreeting = () => { const hour = new Date().getHours(); G_ELEMENTS.greeting.textContent = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening'; };
    
    async function fetchWeather(lat, lon, city) { /* ... same as before ... */ }
    async function geocodeAndFetchWeather(city) { /* ... same as before ... */ }
    const getUserLocation = () => { /* ... same as before ... */ };
    const initializeWeather = () => { /* ... same as before ... */ };
    
    async function fetchOnThisDay() {
        G_ELEMENTS.eventText.innerHTML = `<span class="skeleton h-4 w-full block mt-1"></span><span class="skeleton h-4 w-3/4 block mt-1"></span>`;
        const today = new Date();
        const month = String(today.getMonth() + 1);
        const day = String(today.getDate());
        G_ELEMENTS.eventDate.textContent = today.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
        try {
            const response = await fetch(`https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/${month}/${day}`);
            const data = await response.json();
            if (data.events && data.events.length > 0) {
                const randomEvent = data.events[Math.floor(Math.random() * data.events.length)];
                G_ELEMENTS.eventText.innerHTML = `${randomEvent.text} <span class="text-gray-400">(${randomEvent.year})</span>`;
            } else { G_ELEMENTS.eventText.textContent = 'No significant events found for today.'; }
        } catch (error) { console.error('On This Day fetch error:', error); G_ELEMENTS.eventText.textContent = 'Could not load historical event.'; }
    }

    async function fetchQuote() {
        G_ELEMENTS.quoteText.innerHTML = `<span class="skeleton h-5 w-full block"></span><span class="skeleton h-5 w-1/2 block mt-1"></span>`;
        G_ELEMENTS.quoteAuthor.innerHTML = `<span class="skeleton h-4 w-32 ml-auto block"></span>`;
        try {
            const response = await fetch('https://api.quotable.io/random');
            const data = await response.json();
            G_ELEMENTS.quoteText.textContent = `"${data.content}"`;
            G_ELEMENTS.quoteAuthor.textContent = `- ${data.author}`;
        } catch (error) {
            console.error("Quote fetch error:", error);
            G_ELEMENTS.quoteText.textContent = '"The best way to predict the future is to create it."';
            G_ELEMENTS.quoteAuthor.textContent = '- Peter Drucker';
        }
    }

    function updateTimestamp() {
        G_ELEMENTS.lastUpdated.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    }

    async function refreshDashboard() {
        const refreshButtonIcon = G_ELEMENTS.refreshBtn.querySelector('i');
        refreshButtonIcon.classList.add('animate-spin');
        await Promise.all([
            initializeWeather(),
            fetchOnThisDay(),
            fetchQuote()
        ]);
        updateTimestamp();
        refreshButtonIcon.classList.remove('animate-spin');
    }

    // --- EVENT LISTENERS ---
    G_ELEMENTS.refreshBtn.addEventListener('click', refreshDashboard);
    G_ELEMENTS.weatherModal.openBtn.addEventListener('click', () => openModal(G_ELEMENTS.weatherModal.self));
    G_ELEMENTS.weatherModal.closeBtn.addEventListener('click', () => closeModal(G_ELEMENTS.weatherModal.self));
    G_ELEMENTS.actionsModal.openBtn.addEventListener('click', () => openModal(G_ELEMENTS.actionsModal.self));
    G_ELEMENTS.actionsModal.closeBtn.addEventListener('click', () => closeModal(G_ELEMENTS.actionsModal.self));
    // ... other modal listeners ...

    // --- INITIALIZATION ---
    async function main() {
        updateGreeting();
        await fetchPages();
        renderQuickActions();
        populateActionsSettings();
        await refreshDashboard();
    }

    main();
});
