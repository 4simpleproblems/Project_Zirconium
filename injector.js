/**
 * @file script-injector.js
 * @description Injects a predefined list of JavaScript files into the document head.
 * This allows for centralized script management across multiple HTML files.
 * To use, simply include this file in your HTML: <script src="path/to/script-injector.js"></script>
 */

// Using a self-invoking anonymous function to avoid polluting the global scope.
(() => {
    // --- SCRIPT CONFIGURATION ---
    // Add or remove scripts from this array to manage them across all pages.
    // The 'path' property defines the base directory for your local scripts.
    // The 'files' array lists the scripts to be loaded.
    const config = {
        path: '../', // Relative path from your HTML files to the root directory where script folders are.
        files: [
            // --- Firebase CDN Scripts (Order can be important) ---
            { src: 'https://www.gstatic.com/firebasejs/9.6.10/firebase-app-compat.js' },
            { src: 'https://www.gstatic.com/firebasejs/9.6.10/firebase-auth-compat.js' },
            { src: 'https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore-compat.js' },

            // --- Local Project Scripts ---
            // These paths will be prefixed with the 'path' value above.
            { src: 'firebase-config.js' },
            { src: 'ban-enforcer.js' },
            { src: 'panic-key.js' },
            { src: 'url-tab-title-changer.js' },
            { src: 'navigation.js' }
      
            ]
    };

    /**
     * Injects a script into the document's <head>.
     * @param {string} src The source URL or path of the script.
     */
    function injectScript(src) {
        const scriptElement = document.createElement('script');
        scriptElement.src = src;
        document.head.appendChild(scriptElement);
    }

    // --- EXECUTION ---
    // Iterate over the configuration and inject each script.
    config.files.forEach(file => {
        // Check if it's a full URL (like a CDN) or a local file path.
        const isExternal = file.src.startsWith('http://') || file.src.startsWith('https://');
        const scriptSrc = isExternal ? file.src : config.path + file.src;
        injectScript(scriptSrc);
    });

    // Optional: Log to the console for debugging to confirm the injection.
    console.log(`Script Injector: Successfully queued ${config.files.length} scripts for loading.`);

})();
