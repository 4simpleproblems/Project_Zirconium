/**
 * panic-key.js
 * This script provides a user-configurable panic key functionality for a website using IndexedDB.
 * When activated, it redirects the user to a pre-configured destination.
 * The user can configure up to 3 separate panic keys.
 * The destination can be an external URL (e.g., https://google.com) or an internal page path (e.g., /dashboard/games.html).
 * The key press must be a single key without any modifiers (Shift, Ctrl, Alt, etc.).
 *
 * This version uses IndexedDB for local storage, ensuring privacy and instantaneous redirection.
 */

// This message helps confirm that the script file itself is being loaded by the browser.
console.log("Debug: panic-key.js script has started.");

let currentPanicKeyListener = null; // To store the current keydown listener function

/**
 * Attaches the 'keydown' event listener to the document with the user's specific settings.
 * @param {object} settings - The panic key settings object from localStorage.
 */
function attachPanicKeyListener(settings) {
    // Remove any previously attached listener to prevent duplicates
    if (currentPanicKeyListener) {
        document.removeEventListener('keydown', currentPanicKeyListener);
        console.log("Debug: Removed previous panic keydown listener.");
    }

    if (!settings.enabled) {
        console.log("Debug: Panic key feature is disabled.");
        return;
    }

    console.log("Debug: Attaching keydown listener to the document with these settings:", settings);

    currentPanicKeyListener = (event) => {
        const activeElement = document.activeElement;

        // Prevent panic key from firing while typing in form fields or AI chat box.
        if (activeElement) {
            if (activeElement.id === 'ai-input') {
                return;
            }
            const tagName = activeElement.tagName.toLowerCase();
            if (['input', 'select', 'textarea'].includes(tagName)) {
                return;
            }
        }

        for (let i = 1; i <= 3; i++) {
            const combo = settings[`key${i}Combo`];
            const target = settings[`key${i}Target`];

            if (combo && target && combo !== 'none') {
                const parts = combo.split('+');
                const key = parts[parts.length - 1];
                const ctrl = parts.includes('ctrl');
                const shift = parts.includes('shift');
                const alt = parts.includes('alt');

                if (event.key.toLowerCase() === key &&
                    event.ctrlKey === ctrl &&
                    event.shiftKey === shift &&
                    event.altKey === alt) {
                    
                    // Prevent default browser action for the key combination
                    event.preventDefault();
                    event.stopPropagation();

                    // Check if target is the current URL
                    const currentUrl = window.location.href;
                    let redirectUrl = target;

                    if (settings.mode === 'page') {
                        // For 'page' mode, assume it's a relative path within the app
                        // and construct a full URL.
                        // This assumes the app is hosted at the root or a known base path.
                        const baseUrl = window.location.origin;
                        redirectUrl = `${baseUrl}/${target.startsWith('/') ? target.substring(1) : target}`;
                    }

                    if (redirectUrl === currentUrl) {
                        console.warn("Panic key target is the current URL. Preventing redirection.");
                        return;
                    }

                    console.log("SUCCESS: Panic key detected! Redirecting to:", redirectUrl);
                    window.location.href = redirectUrl;
                    return; // Only trigger one panic key
                }
            }
        }
    };

    document.addEventListener('keydown', currentPanicKeyListener);
}

// --- Main Execution Logic ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Debug: DOMContentLoaded event fired. The page is ready.");

    // Load initial settings and attach listener
    loadAndAttachPanicKeyListener();

    // Listen for messages from settings page to update panic key settings
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'UPDATE_PANIC_KEY') {
            console.log("Debug: Received UPDATE_PANIC_KEY message. Re-attaching listener.");
            attachPanicKeyListener(event.data.settings);
        }
    });
});

/**
 * Loads panic key settings from localStorage and attaches the listener.
 */
function loadAndAttachPanicKeyListener() {
    const savedSettingsJSON = localStorage.getItem('panic-key-settings');
    let settings = {
        enabled: false,
        mode: 'url',
        key1Combo: 'none', key1Target: '',
        key2Combo: 'none', key2Target: '',
        key3Combo: 'none', key3Target: ''
    };
    if (savedSettingsJSON) {
        try { settings = JSON.parse(savedSettingsJSON); } catch (e) { console.error("Failed to parse saved panic key settings, reverting to default.", e); }
    }
    attachPanicKeyListener(settings);
}
