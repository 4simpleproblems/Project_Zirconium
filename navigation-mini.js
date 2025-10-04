/**
 * authNavbar.js
 * Renders the top navigation bar dynamically based on authentication state.
 * Assumes Firebase Auth is initialized and available globally.
 */

// Function to handle the authentication dropdown menu logic
function setupAuthMenuLogic() {
    const toggleButton = document.getElementById('auth-toggle');
    const menuContainer = document.getElementById('auth-menu-container');

    if (toggleButton && menuContainer) {
        // Toggle function
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

        // Close menu when clicking outside
        document.addEventListener('click', (event) => {
            if (!menuContainer.contains(event.target) && !toggleButton.contains(event.target)) {
                if (toggleButton.getAttribute('aria-expanded') === 'true') {
                    toggleMenu(); // Use toggle to set state correctly
                }
            }
        });
    }
}

/**
 * Renders the Logged-Out Navbar Content (Profile Icon with Login/Sign Up dropdown).
 */
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

/**
 * Renders the Logged-In Navbar Content (User Info with Settings/Logout dropdown).
 * @param {firebase.User} user - The current authenticated user object.
 */
function renderLoggedInNavbar(user) {
    const username = user.displayName || user.email.split('@')[0];
    const email = user.email;

    return `
        <div class="relative">
            <button 
                id="auth-toggle"
                aria-expanded="false"
                aria-controls="auth-menu-container"
                class="w-8 h-8 rounded-full border border-white flex items-center justify-center bg-black/50 hover:bg-gray-900/50 transition-colors duration-200 focus:outline-none focus:ring-1 focus:ring-white"
            >
                <i class="fas fa-circle-user text-white text-base"></i>
            </button>
            
            <div 
                id="auth-menu-container" 
                class="auth-menu-container closed absolute right-0 top-10 w-64 p-3 rounded-xl bg-black/70 backdrop-blur-lg border border-gray-800 shadow-xl"
            >
                <div class="px-3 py-1 mb-2 border-b border-gray-700">
                    <p class="text-sm font-semibold text-white truncate">${username}</p>
                    <p class="text-xs text-gray-400 truncate">${email}</p>
                </div>

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

/**
 * Main function to build and inject the navbar.
 */
function injectAuthNavbar() {
    const navbarContainer = document.getElementById('navbar-container');
    if (!navbarContainer) return;

    // Check Firebase Auth state
    firebase.auth().onAuthStateChanged((user) => {
        let authContent;
        if (user) {
            // Logged In State
            authContent = renderLoggedInNavbar(user);
        } else {
            // Logged Out State
            authContent = renderLoggedOutNavbar();
        }

        navbarContainer.innerHTML = `
            <header class="sticky top-0 z-50 backdrop-blur-md bg-black/80 border-b border-gray-900">
                <nav class="h-16 flex items-center justify-between px-4">
                    <a href="index.html" class="flex items-center space-x-2">
                        <picture>
                            <source srcset="../images/logo.png" media="(prefers-color-scheme: dark)">
                            <img src="../images/logo.png" alt="4simpleproblems Logo" class="h-8 w-auto">
                        </picture>
                    </a>
                    ${authContent}
                </nav>
            </header>
        `;

        // Setup the dropdown menu functionality
        setupAuthMenuLogic();

        // Setup logout button listener if user is logged in
        if (user) {
            const logoutButton = document.getElementById('logout-button');
            if (logoutButton) {
                logoutButton.addEventListener('click', async () => {
                    try {
                        await firebase.auth().signOut();
                        // Redirect to home or login page after successful logout
                        window.location.href = 'index.html'; 
                    } catch (error) {
                        console.error("Logout failed:", error);
                        alert("Logout failed. Please try again.");
                    }
                });
            }
        }
    });
}

// Attach the main function to the document load event
document.addEventListener('DOMContentLoaded', injectAuthNavbar);
