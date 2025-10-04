/**
 * navigation-mini.js
 * Renders the full header dynamically based on authentication state.
 * Contains ONLY the CSS required for the dynamic topbar functionality.
 * NOTE: This script is now initialized via the global function `window.initMiniNavigation(auth)` 
 * called from the main <script type="module"> block.
 */

// 1. INJECT ONLY TOPBAR-SPECIFIC STYLES INTO THE HEAD
function injectTopbarCSS() {
    // ... (CSS injection code remains the same)
    const head = document.head;
    const style = document.createElement('style');
    style.textContent = `
        /* --- AUTH MENU STYLES (Required for dropdown) --- */
        .auth-menu-container {
            transition: transform 0.3s ease-out, opacity 0.3s ease-out;
            transform-origin: top right;
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

// 3. NAVBAR RENDERING FUNCTIONS (remains the same)
function renderLoggedOutNavbar() {
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
                class="auth-menu-container closed absolute right-0 top-10 w-40 p-2 rounded-xl bg-black/70 backdrop-blur-lg border border-gray-800 shadow-xl"
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
    const username = user.displayName || user.email.split('@')[0];
    const email = user.email;

    let profileContent;
    
    if (user.photoURL) {
        profileContent = `<img src="${user.photoURL}" alt="${username} Profile" class="w-full h-full object-cover rounded-full" />`;
    } else {
        profileContent = `<i class="fas fa-circle-user text-white text-base"></i>`;
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
                class="auth-menu-container closed absolute right-0 top-10 w-64 p-3 rounded-xl bg-black/70 backdrop-blur-lg border border-gray-800 shadow-xl"
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
// MODIFIED: Accepts the auth object
function injectAuthNavbar(auth) {
    const navbarContainer = document.getElementById('navbar-container');
    if (!navbarContainer) return;

    // MODIFIED: Use the passed auth object
    auth.onAuthStateChanged((user) => {
        let authContent;
        if (user) {
            authContent = renderLoggedInNavbar(user);
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
                        // MODIFIED: Use the passed auth object's signOut method
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
window.initMiniNavigation = (auth) => {
    injectTopbarCSS();
    // Only proceed after DOM content is ready
    document.addEventListener('DOMContentLoaded', () => injectAuthNavbar(auth));
};
