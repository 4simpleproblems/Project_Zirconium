/**
 * navigation-mini.js
 * Renders the full header dynamically based on authentication state.
 * Contains ONLY the CSS required for the dynamic topbar functionality.
 * NOTE: This script is now initialized via the global function `window.initMiniNavigation(auth, db, doc, getDoc)` 
 * called from the main <script type="module"> block.
 */

// 1. INJECT ONLY TOPBAR-SPECIFIC STYLES INTO THE HEAD
function injectTopbarCSS() {
    const head = document.head;
    
    // Inject Poppins font for the profile initial (as requested)
    if (!document.querySelector('link[href*="Poppins"]')) {
        const poppinsLink = document.createElement('link');
        poppinsLink.rel = 'stylesheet';
        poppinsLink.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@600&display=swap';
        head.appendChild(poppinsLink);
    }
    
    const style = document.createElement('style');
    style.textContent = `
        /* --- AUTH MENU STYLES (Required for dropdown) --- */
        .auth-menu-container {
            transition: transform 0.3s ease-out, opacity 0.3s ease-out;
            transform-origin: top right;
            /* Make the blur effect more pronounced and definite */
            backdrop-filter: blur(16px); 
            -webkit-backdrop-filter: blur(16px);
        }
        
        .auth-menu-container.open {
            opacity: 1;
            transform: translateY(0) scale(1);
        }

        .auth-menu-container.closed {
            opacity: 0;
            pointer-events: none;
            transform: translateY(-10px) scale(0.95);
        }
        
        /* New: Gradient profile avatar style */
        .initial-avatar {
            /* Black to Gray Gradient Background for the circle */
            background: linear-gradient(135deg, #1f1f1f 0%, #444444 100%); 
            font-family: 'Poppins', sans-serif; 
            text-transform: uppercase;
        }

        /* Ensure smooth animation and proper positioning for the avatar */
        #auth-toggle {
            position: relative;
            z-index: 10;
        }
        /* --- END AUTH MENU STYLES --- */
    `;
    head.appendChild(style);
}


// 2. AUTH MENU DROPDOWN LOGIC (remains the same)
function setupAuthMenuLogic() {
    const toggleButton = document.getElementById('auth-toggle');
    const menuContainer = document.getElementById('auth-menu-container');

    if (toggleButton && menuContainer) {
        const toggleMenu = () => {
            const isExpanded = toggleButton.getAttribute('aria-expanded') === 'true';
            toggleButton.setAttribute('aria-expanded', String(!isExpanded));
            
            if (isExpanded) {
                menuContainer.classList.remove('open');
                menuContainer.classList.add('closed');
            } else {
                menuContainer.classList.remove('closed');
                menuContainer.classList.add('open');
            }
        };

        toggleButton.addEventListener('click', toggleMenu);

        document.addEventListener('click', (event) => {
            if (!menuContainer.contains(event.target) && !toggleButton.contains(event.target)) {
                if (toggleButton.getAttribute('aria-expanded') === 'true') {
                    toggleMenu();
                }
            }
        });
    }
}

// 3. NAVBAR RENDERING FUNCTIONS
function renderLoggedOutNavbar() {
    // Kept existing blurred background for consistency with the logged-in menu
    return `
        <div class="relative">
            <button 
                id="auth-toggle"
                aria-expanded="false"
                aria-controls="auth-menu-container"
                class="w-8 h-8 rounded-full border border-white flex items-center justify-center bg-black/50 hover:bg-gray-900/50 transition-colors duration-200 focus:outline-none focus:ring-1 focus:ring-white"
            >
                <i class="fas fa-user text-white text-base"></i>
            </button>
            
            <div 
                id="auth-menu-container" 
                class="auth-menu-container closed absolute right-0 top-10 w-40 p-2 rounded-xl bg-black/70 backdrop-blur-xl border border-gray-800 shadow-xl"
            >
                <a href="login.html" class="block px-3 py-2 text-sm font-normal text-white hover:bg-gray-800 rounded-lg transition-colors">
                    Login
                </a>
                <a href="signup.html" class="block px-3 py-2 text-sm font-normal text-white hover:bg-gray-800 rounded-lg transition-colors mt-1">
                    Sign Up
                </a>
            </div>
        </div>
    `;
}

function renderLoggedInNavbar(user) {
    // Use data fetched from Firestore, or fallback to Auth data
    const username = user.username;
    const email = user.email;
    
    // Get the first letter of the username (or email) for the initial, capitalized
    const initial = username 
        ? username.charAt(0).toUpperCase() 
        : (email ? email.charAt(0).toUpperCase() : '?');

    let profileContent;
    
    // Check for photoURL. If not available, use the new initial avatar.
    if (user.photoURL) {
        profileContent = `<img src="${user.photoURL}" alt="${username} Profile" class="w-full h-full object-cover rounded-full" />`;
    } else {
        // New gradient initial avatar
        profileContent = `
            <div class="initial-avatar w-full h-full flex items-center justify-center text-white text-sm font-semibold">
                ${initial}
            </div>
        `;
    }

    return `
        <div class="relative">
            <button 
                id="auth-toggle"
                aria-expanded="false"
                aria-controls="auth-menu-container"
                class="w-8 h-8 rounded-full border border-white flex items-center justify-center bg-black/50 hover:bg-gray-900/50 transition-colors duration-200 focus:outline-none focus:ring-1 focus:ring-white overflow-hidden"
            >
                ${profileContent}
            </button>
            
            <div 
                id="auth-menu-container" 
                class="auth-menu-container closed absolute right-0 top-10 w-64 p-3 rounded-xl bg-black/70 backdrop-blur-xl border border-gray-800 shadow-xl"
            >
                <div class="px-3 py-1 mb-2 border-b border-gray-700">
                    <p class="text-sm font-semibold text-white truncate">${username}</p>
                    <p class="text-xs text-gray-400 truncate">${email}</p>
                </div>

                <a href="../logged-in/dashboard.html" class="block px-3 py-2 text-sm font-normal text-white hover:bg-gray-800 rounded-lg transition-colors">
                    <i class="fas fa-house-user mr-2"></i> Dashboard
                </a>
                
                <a href="../logged-in/settings.html" class="block px-3 py-2 text-sm font-normal text-white hover:bg-gray-800 rounded-lg transition-colors">
                    <i class="fas fa-cog mr-2"></i> Settings
                </a>
                
                <button id="logout-button" class="w-full text-left px-3 py-2 text-sm font-normal text-red-400 hover:bg-red-900/30 rounded-lg transition-colors mt-1">
                    <i class="fas fa-sign-out-alt mr-2"></i> Log Out
                </button>
            </div>
        </div>
    `;
}

// 4. MAIN INJECTION FUNCTION
// MODIFIED: Accepts the auth, db, doc, and getDoc functions for safe module usage
async function injectAuthNavbar(auth, db, docFn, getDocFn) {
    const navbarContainer = document.getElementById('navbar-container');
    if (!navbarContainer) return;

    // The Firestore functions (docFn, getDocFn) are now passed directly.
    
    auth.onAuthStateChanged(async (user) => {
        let authContent;
        
        if (user) {
            let userData = null;

            // Fetch user data from Firestore if `db` and required functions are available
            if (db && docFn && getDocFn && user.uid) { 
                try {
                    const userDocRef = docFn(db, 'users', user.uid);
                    const userDocSnap = await getDocFn(userDocRef);
                    if (userDocSnap.exists()) {
                        userData = userDocSnap.data();
                    } else {
                        console.warn("Firestore user document not found. Falling back to Auth object data.");
                    }
                } catch (e) {
                    console.error("Error fetching user data from Firestore:", e);
                }
            } else if (user && db) {
                 // Warning updated to reflect the new calling pattern
                 console.warn("Could not fetch user data. Check if Firestore functions (doc, getDoc) were passed to initMiniNavigation.");
            }

            // Combine Firebase Auth and Firestore data
            const combinedUser = {
                ...user,
                // Prioritize Firestore data, then Auth display name, then Auth email prefix
                username: userData?.username || user.displayName || user.email.split('@')[0],
                email: userData?.email || user.email
            };

            authContent = renderLoggedInNavbar(combinedUser);
        } else {
            authContent = renderLoggedOutNavbar();
        }

        navbarContainer.innerHTML = `
            <header class="sticky top-0 z-50 backdrop-blur-md bg-black/80 border-b border-gray-900">
                <nav class="h-16 flex items-center justify-between px-4">
                    <a href="../index.html" class="flex items-center space-x-2">
                        <picture>
                            <source srcset="../images/logo.png" media="(prefers-color-scheme: dark)">
                            <img src="../images/logo.png" alt="4simpleproblems Logo" class="h-8 w-auto">
                        </picture>
                    </a>
                    ${authContent}
                </nav>
            </header>
        `;

        setupAuthMenuLogic();

        if (user) {
            const logoutButton = document.getElementById('logout-button');
            if (logoutButton) {
                logoutButton.addEventListener('click', async () => {
                    try {
                        await auth.signOut();
                        window.location.href = 'login.html'; 
                    } catch (error) {
                        console.error("Logout failed:", error);
                    }
                });
            }
        }
    });
}

// Execute the injection functions when the script is loaded
// MODIFIED: Accepts the auth, db, and required Firestore utility functions
window.initMiniNavigation = (auth, db, docFn, getDocFn) => {
    injectTopbarCSS();
    // Only proceed after DOM content is ready
    document.addEventListener('DOMContentLoaded', () => injectAuthNavbar(auth, db, docFn, getDocFn));
};
