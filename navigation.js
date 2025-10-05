/**
 * navigation-mini.js
 * * This script creates a dynamic, authentication-aware navigation bar with a horizontal,
 * scrollable tab menu for seamless page navigation.
 * * --- Key Updates ---
 * - Loads page data from '../page-identification.json'.
 * - Creates a horizontal, scrollable tab menu (Scrolls on overflow, doesn't wrap).
 * - Highlights the current page based on the URL.
 * - Retains Firebase authentication logic for displaying user info.
 */

(function () {
    'use strict';

    // =========================================================================
    // >> ACTION REQUIRED: PASTE YOUR FIREBASE CONFIGURATION OBJECT HERE <<
    // NOTE: This configuration must be valid for the Firebase Authentication 
    // and Firestore logic to work. This script is self-contained.
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

    // --- Firebase Imports ---
    let firebase, auth, db, getAuth, getFirestore, getDoc, onAuthStateChanged, signInAnonymously, signOut;

    try {
        // Dynamic imports for Firebase V9/V10+ modular SDK
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js')
            .then(module => { firebase = module; return import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'); })
            .then(module => { 
                getAuth = module.getAuth; 
                onAuthStateChanged = module.onAuthStateChanged; 
                signInAnonymously = module.signInAnonymously; 
                signOut = module.signOut;
                auth = getAuth(firebase.initializeApp(FIREBASE_CONFIG));
                return import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'); 
            })
            .then(module => { 
                getFirestore = module.getFirestore; 
                getDoc = module.getDoc; 
                db = getFirestore(firebase.getApp());
                // After imports and auth init, start the main logic
                onAuthStateReady();
            })
            .catch(error => {
                console.error("Failed to load Firebase SDKs. Navigation bar features requiring authentication will not work.", error);
                // Still run the navigation logic even if Firebase fails
                onAuthStateReady(); 
            });
    } catch (e) {
        console.error("Firebase SDK structure failed initialization.", e);
        onAuthStateReady();
    }

    const getUserProfileDocRef = (userId) => {
        // Path: artifacts/{appId}/users/{userId}/metadata/user_profile
        const appId = FIREBASE_CONFIG.appId || 'default-app';
        // Note: getUserProfileDocRef only returns a reference, getDoc call happens later
        return db ? doc(db, 'artifacts', appId, 'users', userId, 'metadata', 'user_profile') : null;
    };

    /**
     * Injects custom CSS for the horizontal scroll menu and the active tab highlighting.
     */
    const injectStyles = () => {
        const style = document.createElement('style');
        // NOTE: This CSS uses Tailwind color variables defined in login.html (e.g., #070707, #111111)
        style.textContent = `
            /* Container for the scrollable tab menu */
            .nav-tab-menu {
                white-space: nowrap;
                overflow-x: auto;
                -webkit-overflow-scrolling: touch; /* iOS smooth scrolling */
                padding-bottom: 8px; /* Space for the scroll bar */
            }
            .nav-tab-menu::-webkit-scrollbar {
                height: 4px;
            }
            .nav-tab-menu::-webkit-scrollbar-thumb {
                background-color: #383838; 
                border-radius: 2px;
            }
            .nav-tab-menu::-webkit-scrollbar-track {
                background: #111111; 
            }
            
            /* Individual tab link styling */
            .nav-tab-link {
                display: inline-flex;
                align-items: center;
                padding: 8px 16px;
                border-radius: 8px;
                color: #808080; /* custom-lighter-gray */
                transition: all 0.2s ease;
                margin-right: 8px;
                font-size: 14px;
                font-weight: 500;
                border: 1px solid transparent;
            }
            .nav-tab-link:hover {
                background-color: #111111; /* custom-dark-gray */
                color: #c0c0c0; /* custom-white-gray */
            }
            
            /* Active tab highlighting */
            .nav-tab-link.active {
                background-color: #252525; /* custom-medium-gray */
                color: #ffffff; /* pure white for strong highlight */
                border-color: #505050; /* custom-light-gray */
            }
            .nav-tab-link.active .fas {
                color: #4ade80; /* A nice highlight color */
            }

            /* General navbar container styling */
            .main-navbar {
                background-color: #070707; /* custom-darkest-gray */
                border-bottom: 1px solid #252525; /* custom-medium-gray */
                padding-top: 1rem; 
                padding-bottom: 0; 
            }
            .user-dropdown-btn {
                background-color: #111111;
            }
            .user-dropdown-btn:hover {
                background-color: #252525;
            }
            .dropdown-item:hover {
                background-color: #252525;
            }
        `;
        document.head.appendChild(style);
    };

    /**
     * Renders the main navigation bar HTML structure.
     * @param {Object} user - Firebase User object or null.
     * @param {Object} userData - User profile data from Firestore or null.
     * @param {Object} pages - The loaded page identification data.
     */
    const renderNavbar = (user, userData, pages) => {
        const container = document.getElementById('navbar-container');
        if (!container) return;

        const isAuthenticated = !!user && !user.isAnonymous;
        const username = userData?.username || (isAuthenticated ? 'Student' : 'Guest');
        // Get the current path, ensuring it matches the format of the JSON URLs
        const currentPath = window.location.pathname.replace(/\/$/, '').toLowerCase(); 

        // --- 1. Generate Tab Menu HTML ---
        let tabsHtml = '';
        if (isAuthenticated && pages) {
            const pageKeys = Object.keys(pages);
            
            // Generate link for each tab
            tabsHtml = pageKeys.map(key => {
                const page = pages[key];
                // Normalize page URL to match current path logic (remove leading '../')
                const pageUrl = page.url.replace(/^\.\.\//, '/').toLowerCase(); 
                
                // Determine active status: true if the path ends with the pageUrl
                const isActive = currentPath.endsWith(pageUrl);

                return `
                    <a href="${page.url}" class="nav-tab-link ${isActive ? 'active' : ''}">
                        <i class="fas ${page.icon} mr-2"></i> ${page.name}
                    </a>
                `;
            }).join('');
            
            // Wrap the tabs in the scrollable container
            tabsHtml = `
                <div class="nav-tab-menu flex pb-2 px-8 max-w-full">
                    ${tabsHtml}
                </div>
            `;
        } else {
            // For signed out/guest state, show the login link or a simple message
            tabsHtml = `
                <div class="px-8 pt-2 pb-4 text-sm text-custom-lighter-gray">
                    Sign in to access the full navigation menu.
                </div>
            `;
        }


        // --- 2. Generate Full Navbar HTML (Header + Tabs) ---
        const navbarHtml = `
            <nav class="main-navbar fixed top-0 left-0 w-full z-50">
                <div class="flex justify-between items-center px-8 py-3 max-w-7xl mx-auto">
                    <!-- Logo / Home Link -->
                    <a href="index.html" class="text-xl font-extrabold text-custom-white-gray tracking-tighter hover:text-white transition">4SP <span class="text-green-400">Toolkit</span></a>

                    <!-- User / Action Buttons -->
                    <div class="relative flex items-center space-x-3">
                        ${isAuthenticated ? `
                            <!-- User Dropdown Button -->
                            <button id="userDropdownBtn" class="user-dropdown-btn flex items-center p-2 rounded-full text-sm font-medium text-custom-white-gray transition hover:bg-custom-medium-gray focus:outline-none">
                                <i class="fas fa-user-circle mr-2 text-lg"></i>
                                <span>${username}</span>
                                <i class="fas fa-chevron-down ml-2 text-xs"></i>
                            </button>

                            <!-- Dropdown Menu -->
                            <div id="userDropdownMenu" class="absolute right-0 mt-2 top-full w-48 bg-custom-darkest-gray rounded-lg shadow-xl border border-custom-medium-gray hidden" style="z-index: 1000;">
                                <a href="logged-in/settings.html" class="dropdown-item block px-4 py-2 text-sm text-custom-white-gray hover:bg-custom-medium-gray rounded-t-lg">Settings</a>
                                <a href="logged-in/profile.html" class="dropdown-item block px-4 py-2 text-sm text-custom-white-gray hover:bg-custom-medium-gray">Profile</a>
                                <div class="border-t border-custom-medium-gray my-1"></div>
                                <button id="logoutBtn" class="dropdown-item w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-custom-medium-gray rounded-b-lg">Logout</button>
                            </div>
                        ` : `
                            <!-- Login Button for Guest/Signed Out -->
                            <a href="login.html" class="p-2 px-4 rounded-lg text-sm font-semibold bg-custom-medium-gray text-custom-white-gray hover:bg-custom-light-gray transition">Login</a>
                        `}
                    </div>
                </div>
                
                <!-- Horizontal Tab Menu Section -->
                ${tabsHtml}
            </nav>
            <div style="height: 100px;"></div> <!-- Spacer to prevent content from being hidden by fixed nav -->
        `;

        container.innerHTML = navbarHtml;

        // --- 3. Attach Event Listeners ---
        const dropdownBtn = document.getElementById('userDropdownBtn');
        const dropdownMenu = document.getElementById('userDropdownMenu');
        const logoutBtn = document.getElementById('logoutBtn');

        if (dropdownBtn && dropdownMenu) {
            dropdownBtn.addEventListener('click', () => {
                dropdownMenu.classList.toggle('hidden');
            });
            document.addEventListener('click', (event) => {
                if (!dropdownBtn.contains(event.target) && !dropdownMenu.contains(event.target)) {
                    dropdownMenu.classList.add('hidden');
                }
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                if (auth && signOut) {
                    try {
                        await signOut(auth);
                        window.location.href = 'index.html'; // Redirect after sign out
                    } catch (error) {
                        console.error("Logout failed:", error);
                    }
                } else {
                    // Fallback if Firebase is not loaded
                    window.location.href = 'index.html'; 
                }
            });
        }
    };

    /**
     * Fetches the page identification JSON and then starts the auth listener.
     */
    const fetchPagesAndStartAuthListener = async () => {
        let pages = null;
        try {
            // Fetch the JSON file containing all page links
            const response = await fetch('../page-identification.json');
            if (response.ok) {
                pages = await response.json();
            } else {
                console.warn(`Could not load page identification from ../page-identification.json. Status: ${response.status}`);
            }
        } catch (error) {
            console.error("Error fetching page-identification.json:", error);
        }

        // Render initial view with pages data
        renderNavbar(null, null, pages);

        if (auth && onAuthStateChanged) {
            // Start the Firebase authentication listener
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    // User is signed in. Fetch profile data.
                    const userDocRef = getUserProfileDocRef(user.uid);
                    try {
                        const docSnap = userDocRef ? await getDoc(userDocRef) : null;
                        const userData = docSnap?.exists() ? docSnap.data() : null;
                        renderNavbar(user, userData, pages);
                    } catch (error) {
                        console.error("Error fetching user data:", error);
                        renderNavbar(user, null, pages); // Render even if Firestore fails
                    }
                } else {
                    // User is signed out.
                    renderNavbar(null, null, pages);
                    
                    // Attempt to sign in anonymously for a seamless guest experience.
                    if (signInAnonymously) {
                        signInAnonymously(auth).catch((error) => {
                            if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/admin-restricted-operation') {
                                console.warn(
                                    "Anonymous sign-in is disabled. Enable it in the Firebase Console (Authentication > Sign-in method) for guest features."
                                );
                            } else {
                                console.error("Anonymous sign-in error:", error);
                            }
                        });
                    }
                }
            });
        } else {
            // Fallback render if Firebase failed to initialize
            renderNavbar(null, null, pages);
        }
    };

    /**
     * Entry point after Firebase imports are attempted.
     */
    const onAuthStateReady = () => {
        injectStyles();
        // Ensure the container exists
        if (!document.getElementById('navbar-container')) {
            const navbarDiv = document.createElement('div');
            navbarDiv.id = 'navbar-container';
            document.body.prepend(navbarDiv);
        }
        
        fetchPagesAndStartAuthListener();
    };

    // --- START THE PROCESS ---
    document.addEventListener('DOMContentLoaded', () => {
        // The main logic is initiated asynchronously via the Firebase import chain
    });
    
})();
