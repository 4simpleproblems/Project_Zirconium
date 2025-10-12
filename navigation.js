/**
 * navigation.js
 * * This is a fully self-contained script to create a dynamic, authentication-aware
 * navigation bar for your website. It handles everything from Firebase initialization
 * to rendering user-specific information. It now includes a horizontally scrollable
 * tab menu loaded from page-identification.json.
 *
 * --- INSTRUCTIONS ---
 * 1. ACTION REQUIRED: Paste your own Firebase project configuration into the `FIREBASE_CONFIG` object below.
 * 2. Place this script in the root directory of your website.
 * 3. Add `<script src="/navigation.js" defer></script>` to the <head> of any HTML file where you want the navbar.
 * 4. Ensure your file paths for images and links are root-relative (e.g., "/images/logo.png", "/login.html").
 * * --- HOW IT WORKS ---
 * - It runs automatically once the HTML document is loaded.
 * - It injects its own CSS for styling the navbar, dropdown menu, and the new tab bar.
 * - It fetches the page configuration JSON to build the scrollable navigation tabs.
 * - It creates a placeholder div and then renders the navbar inside it.
 * - It initializes Firebase, listens for auth state, and fetches user data.
 *
 * --- FIXES / UPDATES ---
 * - **USER REQUEST:** Replaced Login/Signup links with a single "Authenticate" link pointing to /authentication.html.
 * - **USER REQUEST:** Updated logged-out button background to #010101 and icon color to #DADADA, using 'fa-solid fa-user'.
 * - **Glide Button Style:** Removed border-radius and adjusted gradients for full opacity at the edge.
 * - **Mini-Menu Icons:** Added icons to the Dashboard, Settings, and Logout links in the authenticated user's dropdown menu.
 * - **Dashboard Icon Updated:** Changed Dashboard icon from 'fa-chart-line' to 'fa-house-chimney-user'.
 */

// =========================================================================
// >> ACTION REQUIRED: PASTE YOUR FIREBASE CONFIGURATION OBJECT HERE <<
// =========================================================================
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro",
    authDomain: "project-zirconium.firebaseapp.com",
    projectId: "project-zirconium",
    storageBucket: "project-zirconium.firebasestorage.app",
    messagingSenderId: "1096564243475",
    appId: "1:1096564243475:web:6d0956a70125eeea1ad3e6",
    measurementId: "G-1D4F692C1Q"
};
// =========================================================================


// --- Self-invoking function to encapsulate all logic ---
(function() {
    // Global references for Firebase objects
    let auth, db;
    let pages = [];

    // Stop execution if Firebase config is not provided
    if (!FIREBASE_CONFIG || !FIREBASE_CONFIG.apiKey) {
        console.error("Firebase configuration is missing! Please paste your config into navigation.js.");
        return;
    }

    // --- 1. DYNAMICALLY LOAD EXTERNAL ASSETS AND DATA ---
    // Helper to load external JS files
    const loadScript = (src) => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    };

    // Helper to load external CSS files
    const loadCSS = (href) => {
        return new Promise((resolve) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            // Resolve immediately after adding to head, as CSS loads asynchronously
            link.onload = resolve; 
            link.onerror = resolve; 
            document.head.appendChild(link);
        });
    };
    
    // Helper to fetch page data (assuming it's relative to the root)
    const fetchPageData = async () => {
        try {
            const response = await fetch('/page-identification.json');
            if (!response.ok) {
                console.warn("Could not fetch page-identification.json. Using default pages.");
                return [
                    { path: "/", title: "Home", icon: "fa-solid fa-house" },
                    { path: "/tools.html", title: "Tools", icon: "fa-solid fa-screwdriver-wrench" },
                    { path: "/resources.html", title: "Resources", icon: "fa-solid fa-book-open" }
                ];
            }
            return await response.json();
        } catch (error) {
            console.error("Error fetching or parsing page-identification.json:", error);
            return [];
        }
    };


    const run = async () => {
        try {
            // Load Font Awesome 6.5.2 CSS
            await loadCSS("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"); 
            
            // Load Firebase modules (using compat versions)
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js");
            
            // Fetch page data before initializing and rendering
            pages = await fetchPageData();

            // Now that scripts are loaded, we can use the `firebase` global object
            initializeApp();
            
            // Setup container and styles
            injectStyles();
            setupContainer(); 
            
        } catch (error) {
            console.error("Failed to load necessary SDKs or Font Awesome:", error);
        }
    };

    // Helper to create the navbar container
    const setupContainer = () => {
        if (!document.getElementById('navbar-container')) {
            const navbarDiv = document.createElement('div');
            navbarDiv.id = 'navbar-container';
            document.body.prepend(navbarDiv);
        }
    }


    // --- 2. INITIALIZE FIREBASE AND RENDER NAVBAR ---
    const initializeApp = () => {
        // Initialize Firebase with the compat libraries
        const app = firebase.initializeApp(FIREBASE_CONFIG);
        auth = firebase.auth(); // Assign to global reference
        db = firebase.firestore(); // Assign to global reference

        // Start the Auth listener immediately after initialization
        setupAuthListener(pages);
    };

    // --- 3. INJECT CSS STYLES (Includes new logged-out button styles) ---
    const injectStyles = () => {
        const style = document.createElement('style');
        style.textContent = `
            body { padding-top: 8rem; /* 128px: 4rem for main nav + 4rem for tab bar */ }
            /* Main Navbar (Top 4rem) */
            .auth-navbar { 
                position: fixed; top: 0; left: 0; right: 0; z-index: 1000; 
                background: #000000; /* Pure Black */
                border-bottom: 1px solid rgb(31 41 55); height: 4rem; 
            }
            .auth-navbar nav { max-width: 80rem; margin: auto; padding: 0 1rem; height: 100%; display: flex; align-items: center; justify-content: space-between; }
            
            /* Tab Bar (Second 4rem) */
            .tab-bar {
                position: fixed; top: 4rem; left: 0; right: 0; z-index: 999;
                height: 4rem;
                background: #000000; /* Pure Black */
                border-bottom: 1px solid rgb(31 41 55);
                display: flex;
                align-items: center;
                overflow: hidden; /* Hide the scrollbar for aesthetic glide effect */
            }
            .tab-bar-content {
                display: flex;
                flex-wrap: nowrap;
                overflow-x: auto;
                -webkit-overflow-scrolling: touch;
                scrollbar-width: none; /* Firefox */
                height: 100%;
                max-width: 80rem;
                margin: auto;
                padding: 0 1rem;
            }
            .tab-bar-content::-webkit-scrollbar { display: none; /* Chrome, Safari, Opera */ }
            
            .tab-link {
                display: flex;
                align-items: center;
                white-space: nowrap;
                padding: 0 1.5rem; /* Wider padding for better touch targets */
                color: #9ca3af;
                text-decoration: none;
                font-weight: 500;
                transition: color 0.2s, background-color 0.2s;
                height: 100%;
            }
            .tab-link i { margin-right: 0.5rem; }

            .tab-link:hover { color: white; background-color: rgb(24 24 27); }
            .tab-link.active { color: white; border-bottom: 3px solid #3b82f6; }

            /* Glide Buttons (Gradient to hide content edges) */
            .glide-button {
                position: absolute;
                top: 0;
                bottom: 0;
                width: 3rem;
                z-index: 10;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #d1d5db;
                opacity: 0.9;
                transition: opacity 0.3s;
            }
            .glide-button:hover { opacity: 1; }
            .glide-left {
                left: 0;
                background: linear-gradient(to right, rgba(0,0,0,1) 50%, rgba(0,0,0,0));
            }
            .glide-right {
                right: 0;
                background: linear-gradient(to left, rgba(0,0,0,1) 50%, rgba(0,0,0,0));
            }

            /* Dropdown Menu */
            .auth-menu-container { 
                position: absolute; right: 0; top: 50px; width: 16rem; 
                background: #000000; /* Pure Black */
                backdrop-filter: none;
                -webkit-backdrop-filter: none;
                border: 1px solid rgb(55 65 81); border-radius: 0.75rem; padding: 0.5rem; 
                box-shadow: 0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -2px rgba(0,0,0,0.2); 
                transition: transform 0.2s ease-out, opacity 0.2s ease-out; transform-origin: top right; 
            }
            .auth-menu-container.open { opacity: 1; transform: translateY(0) scale(1); }
            .auth-menu-container.closed { opacity: 0; pointer-events: none; transform: translateY(-10px) scale(0.95); }
            .initial-avatar { background: linear-gradient(135deg, #374151 0%, #111827 100%); font-family: 'Geist', sans-serif; text-transform: uppercase; display: flex; align-items: center; justify-content: center; color: white; }
            
            /* Icon/Text Styling for Links */
            .auth-menu-link, .auth-menu-button { 
                display: flex; 
                align-items: center; 
                width: 100%; text-align: left; padding: 0.5rem 0.75rem; font-size: 0.875rem; 
                color: #d1d5db; border-radius: 0.375rem; transition: background-color 0.2s, color 0.2s; 
                border: none;
                cursor: pointer;
            }
            .auth-menu-link:hover, .auth-menu-button:hover { background-color: rgb(55 65 81); color: white; }
            .auth-menu-link i, .auth-menu-button i { margin-right: 0.5rem; }

            /* New custom style for the logged out button's icon and background - UPDATED FOR USER REQUEST */
            .logged-out-auth-toggle {
                background: #010101; /* Requested dark background */
                border: 1px solid #374151; /* Keep a subtle border */
            }
            .logged-out-auth-toggle i {
                color: #DADADA; /* Requested icon color */
            }
        `;
        document.head.appendChild(style);
    };

    // --- 4. RENDER THE NAVBAR HTML (Includes Tab Bar and UPDATED Auth section) ---
    const renderNavbar = (user, userData, pages) => {
        const container = document.getElementById('navbar-container');
        if (!container) return; 

        const logoPath = "/images/logo.png"; 
        const currentPath = window.location.pathname;

        // Tab Bar HTML
        const tabBar = `
            <div class="tab-bar">
                <div id="glide-left" class="glide-button glide-left"><i class="fa-solid fa-chevron-left fa-xl"></i></div>
                <div id="tab-bar-content" class="tab-bar-content">
                    ${pages.map(page => `
                        <a href="${page.path}" class="tab-link ${currentPath === page.path || (currentPath === '/' && page.path === '/') ? 'active' : ''}">
                            <i class="${page.icon}"></i>${page.title}
                        </a>
                    `).join('')}
                </div>
                <div id="glide-right" class="glide-button glide-right"><i class="fa-solid fa-chevron-right fa-xl"></i></div>
            </div>
        `;

        // UPDATED: Use fa-user icon, #010101 background via class, and single "Authenticate" link
        const loggedOutView = `
            <div class="relative">
                <button id="auth-toggle" class="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-gray-700 transition logged-out-auth-toggle">
                    <i class="fa-solid fa-user"></i>
                </button>
                <div id="auth-menu-container" class="auth-menu-container closed">
                    <a href="/authentication.html" class="auth-menu-link"><i class="fa-solid fa-lock"></i>Authenticate</a>
                </div>
            </div>
        `;

        const loggedInView = (user, userData) => {
            const photoURL = user.photoURL || userData?.photoURL;
            const username = userData?.username || user.displayName || 'User';
            const email = user.email || 'No email';
            const initial = username.charAt(0).toUpperCase();

            const avatar = photoURL ?
                `<img src="${photoURL}" class="w-full h-full object-cover rounded-full" alt="Profile">` :
                `<div class="initial-avatar w-full h-8 rounded-full text-sm font-semibold">${initial}</div>`; 

            return `
                <div class="relative">
                    <button id="auth-toggle" class="w-8 h-8 rounded-full border border-gray-600 overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500">
                        ${avatar}
                    </button>
                    <div id="auth-menu-container" class="auth-menu-container closed">
                        <div class="px-3 py-2 border-b border-gray-700 mb-2">
                            <p class="text-sm font-semibold text-white truncate">${username}</p>
                            <p class="text-xs text-gray-400 truncate">${email}</p>
                        </div>
                        <a href="/logged-in/dashboard.html" class="auth-menu-link"><i class="fa-solid fa-house-chimney-user"></i>Dashboard</a>
                        <a href="/logged-in/settings.html" class="auth-menu-link"><i class="fa-solid fa-gear"></i>Settings</a>
                        <button id="logout-button" class="auth-menu-button text-red-400 hover:bg-red-900/50 hover:text-red-300"><i class="fa-solid fa-right-from-bracket"></i>Log Out</button>
                    </div>
                </div>
            `;
        };

        container.innerHTML = `
            <header class="auth-navbar">
                <nav>
                    <a href="/" class="flex items-center space-x-2">
                        <img src="${logoPath}" alt="4SP Logo" class="h-8 w-auto">
                    </a>
                    ${user ? loggedInView(user, userData) : loggedOutView}
                </nav>
            </header>
            ${tabBar}
        `;

        // --- 5. SETUP EVENT LISTENERS ---
        setupEventListeners(user);
        setupTabBarGlide();
    };

    const setupEventListeners = (user) => {
        const toggleButton = document.getElementById('auth-toggle');
        const menu = document.getElementById('auth-menu-container');

        if (toggleButton && menu) {
            toggleButton.addEventListener('click', (e) => {
                e.stopPropagation();
                menu.classList.toggle('closed');
                menu.classList.toggle('open');
            });
        }

        document.addEventListener('click', (e) => {
            if (menu && menu.classList.contains('open') && !menu.contains(e.target) && e.target !== toggleButton) {
                menu.classList.add('closed');
                menu.classList.remove('open');
            }
        });

        if (user) {
            const logoutButton = document.getElementById('logout-button');
            if (logoutButton) {
                // Use the globally available 'auth' reference
                logoutButton.addEventListener('click', () => {
                    auth.signOut().catch(err => console.error("Logout failed:", err));
                });
            }
        }
    };
    
    // --- 6. TAB BAR SCROLL GLIDE LOGIC ---
    const setupTabBarGlide = () => {
        const tabBarContent = document.getElementById('tab-bar-content');
        const glideLeft = document.getElementById('glide-left');
        const glideRight = document.getElementById('glide-right');
        
        if (!tabBarContent || !glideLeft || !glideRight) return;

        const updateGlideVisibility = () => {
            const { scrollLeft, scrollWidth, clientWidth } = tabBarContent;
            
            // Show/hide left glide
            glideLeft.style.display = scrollLeft > 0 ? 'flex' : 'none';
            
            // Show/hide right glide
            // Allow a small tolerance (e.g., 2 pixels) for floating point issues
            const isScrolledToRight = scrollLeft + clientWidth >= scrollWidth - 2;
            glideRight.style.display = isScrolledToRight ? 'none' : 'flex';
        };

        const scrollBy = (amount) => {
            tabBarContent.scrollBy({
                left: amount,
                behavior: 'smooth'
            });
        };

        glideLeft.addEventListener('click', () => scrollBy(-200));
        glideRight.addEventListener('click', () => scrollBy(200));
        
        tabBarContent.addEventListener('scroll', updateGlideVisibility);
        window.addEventListener('resize', updateGlideVisibility);

        // Initial check
        updateGlideVisibility();
    };

    // --- 7. AUTH STATE LISTENER ---
    const setupAuthListener = (pages) => {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                // User is signed in. Fetch their data from Firestore.
                try {
                    // Use the globally available 'db' reference
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    const userData = userDoc.exists ? userDoc.data() : null;
                    renderNavbar(user, userData, pages);
                } catch (error) {
                    console.error("Error fetching user data:", error);
                    renderNavbar(user, null, pages); // Render even if Firestore fails
                }
            } else {
                // User is signed out.
                renderNavbar(null, null, pages);
                // Attempt to sign in anonymously for a seamless guest experience.
                auth.signInAnonymously().catch((error) => {
                    if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/admin-restricted-operation') {
                        console.warn(
                            "Anonymous sign-in is disabled. Enable it in the Firebase Console (Authentication > Sign-in method) for guest features."
                        );
                    } else {
                        console.error("Anonymous sign-in error:", error);
                    }
                });
            }
        });
    }

    // --- START THE PROCESS ---
    // Wait for the DOM to be ready, then start loading scripts.
    document.addEventListener('DOMContentLoaded', run);

})();
