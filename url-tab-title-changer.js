/**
 * url-changer.js
 * This script manages the dynamic changing of the website's title and favicon
 * based on user-selected presets, including live and custom options.
 * The user's choice is saved to localStorage to persist across sessions.
 */

const urlChanger = {
    // --- Configuration ---
    presets: [
        { id: 'none', name: 'None', title: '', favicon: '', category: 'default' },
        { id: 'google-classroom', name: 'Google Classroom', title: 'Classes', favicon: '../favicons/google-classroom.png', category: 'websites' },
        { id: 'google-docs', name: 'Google Docs', title: 'Google Docs', favicon: '../favicons/google-docs.png', category: 'websites' },
        { id: 'google-drive', name: 'Google Drive', title: 'My Drive - Google Drive', favicon: '../favicons/google-drive.png', category: 'websites' },
        { id: 'wikipedia', name: 'Wikipedia', title: 'Wikipedia', favicon: '../favicons/wikipedia.png', category: 'websites' },
        { id: 'hac', name: 'HAC', title: 'Home Access Center', favicon: '../favicons/hac.png', category: 'websites' },
        { id: 'clever', name: 'Clever', title: 'Clever | Portal', favicon: '../favicons/clever.png', category: 'websites' },
    ],

    // --- Internal Properties ---
    originalTitle: '',
    originalFavicon: '../favicon.ico',
    liveInterval: null, // Keep liveInterval for potential future live presets

    /**
     * Initializes the script. Captures original page state and applies any saved preset.
     */
    init: function() {
        this.originalTitle = document.title;
        const faviconElement = document.querySelector("link[rel*='icon']");
        this.originalFavicon = faviconElement ? faviconElement.href : '';
        
        // Load and apply initial settings
        this.loadAndApplySettings();

        // Listen for messages from settings page to update tab disguiser
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'UPDATE_TAB_DISGUISER') {
                this.applyTabDisguiserSettings(event.data.settings);
            }
        });
    },

    /**
     * Loads tab disguiser settings from localStorage and applies them.
     */
    loadAndApplySettings: function() {
        const savedSettingsJSON = localStorage.getItem('tab-disguiser-settings');
        let settings = { enabled: false, preset: 'none', customTitle: '', customFavicon: '' };
        if (savedSettingsJSON) {
            try { settings = JSON.parse(savedSettingsJSON); } catch (e) { console.error("Failed to parse saved tab disguiser settings, reverting to default.", e); }
        }
        this.applyTabDisguiserSettings(settings);
    },

    /**
     * Applies tab disguiser settings.
     * @param {object} settings - The settings object from localStorage.
     */
    applyTabDisguiserSettings: function(settings) {
        if (this.liveInterval) {
            clearInterval(this.liveInterval);
            this.liveInterval = null;
        }

        if (!settings.enabled) {
            document.title = this.originalTitle;
            this.applyCustomFavicon(this.originalFavicon);
            return;
        }

        let titleToSet = this.originalTitle;
        let iconToSet = this.originalFavicon;

        if (settings.preset === 'custom') {
            titleToSet = settings.customTitle || this.originalTitle;
            iconToSet = settings.customFavicon || this.originalFavicon;
        } else {
            const preset = this.presets.find(p => p.id === settings.preset);
            if (preset) {
                titleToSet = preset.title;
                iconToSet = preset.favicon;
            }
        }

        document.title = titleToSet;
        this.applyCustomFavicon(iconToSet);
    },

    /**
     * Updates the page title with the current time.
     * @private
     */
    _updateLiveTime: function() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        document.title = timeString;
    },

    /**
     * Applies a given preset by changing the document title and favicon.
     * @param {object} settings - The settings object to apply.
     */
    applyPreset: function(settings) {
        // This function is now deprecated and replaced by applyTabDisguiserSettings
        // but kept for compatibility if needed elsewhere.
        console.warn("applyPreset is deprecated. Use applyTabDisguiserSettings instead.");
        this.applyTabDisguiserSettings(settings);
    },

    /**
     * Sets the favicon. It intelligently chooses between directly linking to external URLs
     * (to avoid CORS issues) and using a canvas for local URLs (to handle scaling).
     * @param {string} iconUrl - The URL of the icon to apply.
     */
    applyCustomFavicon: function(iconUrl) {
        const targetIconUrl = iconUrl || this.originalFavicon;
        if (!targetIconUrl) return;

        let favicon = document.querySelector("link[rel*='icon']");
        if (!favicon) {
            favicon = document.createElement('link');
            favicon.rel = 'icon';
            document.head.appendChild(favicon);
        }

        // ** NEW LOGIC TO PREVENT CORS ERRORS **
        // If the URL is external (from a fetcher), link it directly.
        if (targetIconUrl.startsWith('http')) {
            favicon.href = targetIconUrl;
        } else {
            // Otherwise, use the canvas method for local files to ensure proper scaling.
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const size = 32;
                canvas.width = size; canvas.height = size;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                ctx.clearRect(0, 0, size, size);
                ctx.drawImage(img, 0, 0, size, size);
                favicon.href = canvas.toDataURL('image/png');
            };
            img.onerror = () => {
                console.error(`URL Changer: Failed to load local favicon from "${targetIconUrl}".`);
                favicon.href = this.originalFavicon;
            };
            img.src = targetIconUrl;
        }
    },

document.addEventListener('DOMContentLoaded', () => {
    urlChanger.init();
});

