/**
 * navigation-mini.js
 * Renders the full head/header of the document dynamically based on authentication state.
 * Assumes Firebase Auth is initialized and available globally.
 */

// 1. INJECT REQUIRED STYLES AND LINKS INTO THE HEAD
function injectHeadContent() {
    const head = document.head;

    // Tailwind CSS
    const tailwindScript = document.createElement('script');
    tailwindScript.src = "https://cdn.tailwindcss.com";
    head.appendChild(tailwindScript);

    // Font Awesome (Icons)
    const faLink = document.createElement('link');
    faLink.rel = "stylesheet";
    faLink.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css";
    head.appendChild(faLink);

    // Geist Font
    const geistLink = document.createElement('link');
    geistLink.rel = "stylesheet";
    geistLink.href = "https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap";
    head.appendChild(geistLink);

    // Custom Styles (Dark theme, Navbar, and Form styling)
    const style = document.createElement('style');
    style.textContent = `
        /* Custom CSS to mimic a modern, dark theme and use the Geist font */
        :root {
            --geist-foreground: 255, 255, 255;
            --geist-background: 0, 0, 0;
            --geist-accent-7: 156, 163, 175; /* gray-400 */
        }
        
        .dark {
            color-scheme: dark;
        }

        body {
            /* Applying Geist font */
            font-family: 'Geist', sans-serif;
        }
        
        /* Input Styling */
        input[type="email"], input[type="password"], input[type="text"] {
            background-color: #1a1a1a; /* Darker background */
            border: 1px solid #374151; /* gray-700 */
            color: #ffffff;
        }
        /* Strict Grey Focus: Removed the pink/blue focus tint */
        input[type="email"]:focus, input[type="password"]:focus, input[type="text"]:focus {
            border-color: #4b5563; /* gray-600 */
            outline: none;
            box-shadow: 0 0 0 1px #4b5563; 
        }

        /* Pure Grey Button Style */
        .pure-grey-button {
            background-color: rgba(255, 255, 255, 0.1); /* white/10 */
            border: 1px solid rgba(255, 255, 255, 0.2); /* white/20 */
            transition: all 0.2s ease;
        }
        .pure-grey-button:hover {
            background-color: rgba(255, 255, 255, 0.2); /* white/20 */
        }
        .pure-grey-button:focus {
            box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
        }

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


// 2. AUTH MENU DROPDOWN LOGIC
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
    // Default username if displayName is null, using the part of the email before @
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

// 4. MAIN INJECTION FUNCTION
function injectAuthNavbar() {
    const navbarContainer = document.getElementById('navbar-container');
    if (!navbarContainer) return;

    // Wait for Firebase Auth to be ready
    firebase.auth().onAuthStateChanged((user) => {
        let authContent;
        if (user) {
            authContent = renderLoggedInNavbar(user);
        } else {
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

        // Setup interactivity
        setupAuthMenuLogic();

        // Setup logout button listener if user is logged in
        if (user) {
            const logoutButton = document.getElementById('logout-button');
            if (logoutButton) {
                logoutButton.addEventListener('click', async () => {
                    try {
                        await firebase.auth().signOut();
                        // Reload the page to transition back to the Logged Out state
                        window.location.reload(); 
                    } catch (error) {
                        console.error("Logout failed:", error);
                        // Optional: Show error message on the screen
                    }
                });
            }
        }
    });
}

// Execute the injection functions when the script is loaded
injectHeadContent();
document.addEventListener('DOMContentLoaded', injectAuthNavbar);
