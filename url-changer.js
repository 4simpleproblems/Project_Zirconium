/**
 * url-changer.js
 * This script manages the dynamic changing of the website's title and favicon
 * based on user-selected presets, including live and custom options.
 * The user's choice is saved to localStorage to persist across sessions.
 */

// Export presets globally for use in settings page (test.html)
const TAB_DISGUISE_PRESETS = [
    { id: 'hac', name: 'HAC', title: 'Login', favicon: '../favicons/hac.png', category: 'websites' },
    { id: 'gmm', name: 'GMM', title: 'Get More Math!', favicon: '../favicons/gmm.png', category: 'websites' },
    { id: 'bim', name: 'Big Ideas Math', title: 'Big Ideas Math - Login', favicon: '../favicons/bim.png', category: 'websites' },
    { id: 'kahoot', name: 'Kahoot', title: 'Kahoot! | Learning games | Make learning awesome!', favicon: '../favicons/kahoot.png', category: 'websites' },
    { id: 'g_classroom', name: 'Google Classroom', title: 'Home', favicon: '../favicons/google-classroom.png', category: 'websites' },
    { id: 'g_docs', name: 'Google Docs', title: 'Google Docs', favicon: '../favicons/google-docs.png', category: 'websites' },
    { id: 'g_slides', name: 'Google Slides', title: 'Google Slides', favicon: '../favicons/google-slides.png', category: 'websites' },
    { id: 'g_drive', name: 'Google Drive', title: 'Home - Google Drive', favicon: '../favicons/google-drive.png', category: 'websites' },
    { id: 'wikipedia', name: 'Wikipedia', title: 'Wikipedia', favicon: '../favicons/wikipedia.png', category: 'websites' },
    { id: 'clever', name: 'Clever', title: 'Clever | Connect every student to a world of learning', favicon: '../favicons/clever.png', category: 'websites' },
    { id: '_LIVE_CURRENT_TIME', name: 'Current Time', title: 'Live Time', favicon: '', category: 'live', live: true }
];
window.TAB_DISGUISE_PRESETS = TAB_DISGUISE_PRESETS;


const urlChanger = {
    // --- Configuration ---
    presets: TAB_DISGUISE_PRESETS, // Reference the global array
    // --- Internal Properties ---
    originalTitle: '',
    originalFavicon: '../favicon.ico',
    liveInterval: null,
    customFavicons: [],
    CUSTOM_FAVICONS_KEY: 'tabDisguiseCustomFavicons',

    /**
     * Initializes the script. Captures original page state and applies any saved preset.
     */
    init: function() {
        this.originalTitle = document.title;
        const faviconElement = document.querySelector("link[rel*='icon']");
        this.originalFavicon = faviconElement ? faviconElement.href : '';
        
        this.loadCustomFavicons();

        const savedSettingsJSON = localStorage.getItem('selectedUrlPreset');
        let savedSettings = { type: 'none' };
        if (savedSettingsJSON) {
            try { savedSettings = JSON.parse(savedSettingsJSON); } catch (e) { console.error("Failed to parse saved tab settings, reverting to default.", e); }
        }

        this.applyPreset(savedSettings);
    },

    /**
     * Applies the current settings to change the favicon and title.
     * @param {object} settings - The settings object to apply.
     */
    applyPreset: function(settings) {
        if (this.liveInterval) {
            clearInterval(this.liveInterval);
            this.liveInterval = null;
        }

        let titleToSet = this.originalTitle;
        let iconToSet = this.originalFavicon;

        if (settings && settings.type) {
            switch (settings.type) {
                case 'preset':
                    const preset = this.presets.find(p => p.id === settings.id);
                    if (preset) {
                        titleToSet = preset.title;
                        iconToSet = preset.live ? this.originalFavicon : preset.favicon;
                        if (preset.live) {
                            this._updateLiveTime();
                            this.liveInterval = setInterval(() => this._updateLiveTime(), 1000);
                        }
                    }
                    break;
                case 'custom':
                    titleToSet = settings.title || this.originalTitle;
                    iconToSet = settings.favicon || this.originalFavicon;
                    break;
                case 'none':
                default:
                    // Use defaults
                    break;
            }
        }

        document.title = titleToSet;
        this._setFavicon(iconToSet);
    },

    /**
     * Updates the page's favicon.
     * @param {string} href - The URL of the favicon.
     */
    _setFavicon: function(href) {
        let link = document.querySelector("link[rel*='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'shortcut icon';
            document.getElementsByTagName('head')[0].appendChild(link);
        }
        link.href = href;
    },

    /**
     * Updates the title with the current time (for the Live Time preset).
     */
    _updateLiveTime: function() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        document.title = `Live Time (${timeString})`;
    },

    // --- Favicon Discovery (Not directly used in settings page, but needed for custom favicon functionality) ---

    _faviconServices: [
        hostname => `https://www.google.com/s2/favicons?sz=32&domain=${hostname}`, // Google's service is reliable
        hostname => `https://icon.horse/icon/${hostname}`,
    ],

    _checkImage: function(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(url);
            img.onerror = () => reject(new Error(`Failed to load image at: ${url}`));
            // Append a cache-buster query parameter
            img.src = `${url}?t=${Date.now()}`; 
        });
    },

    /**
     * Attempts to find a favicon for a given URL.
     * @param {string} urlString - The full URL or hostname to search for.
     * @returns {Promise<string>} The working favicon URL.
     */
    findFavicon: async function(urlString) {
        // Strip protocol and path to get hostname
        let hostname;
        try {
            const urlObj = new URL(urlString.includes('://') ? urlString : `https://${urlString}`);
            hostname = urlObj.hostname;
        } catch (e) {
            return Promise.reject(new Error("Invalid URL provided."));
        }
        
        for (const service of this._faviconServices) {
            const url = service(hostname);
            try {
                const workingUrl = await this._checkImage(url);
                // Return the clean URL without the cache-busting param
                return service(hostname);
            } catch (error) {
                console.warn(error.message); // Log failure and try the next service
            }
        }
        return Promise.reject(new Error(`Could not find a favicon for ${hostname}.`));
    },
    
    // --- Settings Persistence ---
    savePreset: function(settings) {
        localStorage.setItem('selectedUrlPreset', JSON.stringify(settings));
        this.applyPreset(settings);
    },
    
    loadCustomFavicons: function() {
        const stored = localStorage.getItem(this.CUSTOM_FAVICONS_KEY);
        if (stored) {
            try { this.customFavicons = JSON.parse(stored); } catch (e) { this.customFavicons = []; }
        }
    },
    
    _saveCustomFavicons: function() {
        localStorage.setItem(this.CUSTOM_FAVICONS_KEY, JSON.stringify(this.customFavicons));
    },

    addCustomFavicon: function(url) {
        if (url && !this.customFavicons.includes(url)) {
            this.customFavicons.push(url);
            this._saveCustomFavicons();
        }
    },

    removeCustomFavicon: function(url) {
        this.customFavicons = this.customFavicons.filter(iconUrl => iconUrl !== url);
        this._saveCustomFavicons();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    urlChanger.init();
});
