/**
 * navigation.js
 * Renders the full-featured top navigation bar, including the scrolling page menu
 * and the user account menu with pinning functionality.
 * Assumes core dependencies (Tailwind, Font Awesome) are loaded in the host HTML file.
 * NOTE: This script is now initialized via the global function `initFullNavigation(auth)` 
 * called from the main <script type="module"> block.
 */

// --- CONFIGURATION ---
const PIN_STORAGE_KEY = '4sp-pinned-pages';
const MAX_PINS = 3;
let ALL_PAGES = {}; // Will store page data from JSON

// 1. INJECT TOPBAR-SPECIFIC STYLES
function injectTopbarCSS() {
    const head = document.head;
    
    // Custom Styles (ONLY Topbar/Menu animation)
    const style = document.createElement('style');
    style.textContent = `
        /* --- AUTH MENU & PINNING STYLES --- */
        /* Dropdown Menu Transition */
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
        /* Horizontal Scroll Menu Styling */
        .page-menu-scroller::-webkit-scrollbar {
            display: none; /* Hide scrollbar for Chrome, Safari and Opera */
        }
        .page-menu-scroller {
            -ms-overflow-style: none;  /* IE and Edge */
            scrollbar-width: none;  /* Firefox */
        }
        /* Pin Button Hover Effect */
        .pin-button-slot {
            transition: background-color 0.2s, border-color 0.2s;
        }
        .pin-button-slot:hover {
            border-color: #ffffff; /* White border on hover to signify pin/unpin action */
            background-color: rgba(255, 255, 255, 0.1);
        }
    `;
    head.appendChild(style);
}

// 2. DATA LOADING
async function loadPageData() {
    try {
        // Corrected path to assume navigation is in a subdirectory (e.g., /js/)
        const response = await fetch('../page-identification.json'); 
        if (!response.ok) throw new Error('Failed to load page-identification.json');
        ALL_PAGES = await response.json();
    } catch (error) {
        console.error("Error loading page data:", error);
        // Fallback to minimal data if loading fails
        ALL_PAGES = { "default": { "name": "Error", "icon": "fa-exclamation-triangle", "url": "#" } };
    }
}

// 3. PINNING LOGIC (CRUD)
function getPinnedPages() {
    try {
        const pinned = JSON.parse(localStorage.getItem(PIN_STORAGE_KEY) || '[]');
        return pinned.slice(0, MAX_PINS);
    } catch {
        return []; // Return empty array on error
    }
}

function savePinnedPages(pins) {
    localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(pins.slice(0, MAX_PINS)));
}

function togglePin(pageId) {
    const pins = getPinnedPages();
    const pageData = ALL_PAGES[pageId];
    if (!pageData) return pins;

    const existingIndex = pins.findIndex(p => p.id === pageId);

    if (existingIndex > -1) {
        // Unpin
        pins.splice(existingIndex, 1);
    } else if (pins.length < MAX_PINS) {
        // Pin (only if not already at max)
        pins.push({
            id: pageId,
            name: pageData.name,
            icon: pageData.icon,
            url: pageData.url
        });
    }
    
    savePinnedPages(pins);
    return pins;
}


// 4. RENDERING FUNCTIONS

// Finds the current page ID based on the URL and the page data map
function getCurrentPageId() {
    const path = window.location.pathname;
    // Handle the special case for the root index.html
    if (path.endsWith('index.html')) return 'index'; 
    
    for (const id in ALL_PAGES) {
        // Check if the current path matches the page's URL suffix
        if (path.endsWith(ALL_PAGES[id].url.split('/').pop())) {
            return id;
        }
    }
    return null; 
}

function renderPageMenu(currentPageId) {
    const menuItems = Object.keys(ALL_PAGES).map(id => {
        const page = ALL_PAGES[id];
        const isActive = id === currentPageId;
        
        // Corrected URL logic for internal pages, assuming standard structure
        let url = page.url;
        if (currentPageId && currentPageId !== 'index' && !url.startsWith('.')) {
             // If we are on a page like /logged-in/dashboard.html, adjust link to other internal sections
             url = '../' + url;
        }

        const activeClass = isActive 
            ? 'bg-gray-800 text-white border-blue-500' 
            : 'text-gray-400 hover:bg-gray-900 border-gray-900';

        return `
            <a href="${url}" 
               class="flex-shrink-0 px-4 py-2 mr-2 rounded-lg text-sm font-medium border-b-2 transition-colors ${activeClass}">
                <i class="fas ${page.icon} mr-1"></i> ${page.name}
            </a>
        `;
    }).join('');

    return `
        <div class="page-menu-scroller flex overflow-x-auto whitespace-nowrap py-3 px-4 border-t border-gray-900">
            ${menuItems}
        </div>
    `;
}

// Renders the three pin slots in the account menu
function renderPinButtons(currentPageId) {
    const pins = getPinnedPages();
    const pinButtons = [];
    const currentIsPinned = pins.some(p => p.id === currentPageId);

    for (let i = 0; i < MAX_PINS; i++) {
        const pin = pins[i];
        let buttonContent, buttonClasses, buttonAction, buttonTitle;

        if (pin) {
            // Pinned button content
            buttonContent = `<i class="fas ${pin.icon} text-white"></i>`;
            buttonClasses = 'bg-gray-700/50 border-gray-600';
            buttonAction = `data-pin-action="unpin" data-page-id="${pin.id}"`;
            buttonTitle = `Click to UNPIN '${pin.name}'`;
        } else {
            // Empty slot or Pin current page
            if (currentPageId && !currentIsPinned) {
                 // Empty slot, but can pin the current page
                const currentPage = ALL_PAGES[currentPageId];
                buttonContent = `<i class="fas ${currentPage.icon} text-blue-400"></i>`;
                buttonClasses = 'bg-gray-900/50 border-gray-700 cursor-pointer';
                buttonAction = `data-pin-action="pin" data-page-id="${currentPageId}"`;
                buttonTitle = `Click to PIN this page (${currentPage.name})`;
            } else {
                 // Truly empty slot or current page is already pinned
                buttonContent = `<i class="fas fa-thumbtack text-gray-600"></i>`;
                buttonClasses = 'bg-gray-900/50 border-gray-800 cursor-default';
                buttonAction = '';
                buttonTitle = `Pinned: ${pins.length}/${MAX_PINS}`;
            }
        }

        pinButtons.push(`
            <button 
                class="pin-button-slot w-8 h-8 rounded-full border flex items-center justify-center ${buttonClasses}"
                ${buttonAction}
                title="${buttonTitle}"
            >
                ${buttonContent}
            </button>
        `);
    }

    return pinButtons.join('');
}


function renderLoggedInNavbar(user) {
    const username = user.displayName || user.email.split('@')[0];
    const email = user.email;
    const currentPageId = getCurrentPageId();

    // Determine the profile picture content for the button
    let profileContent;
    if (user.photoURL) {
        profileContent = `<img src="${user.photoURL}" alt="${username} Profile" class="w-full h-full object-cover rounded-full" />`;
    } else {
        profileContent = `<i class="fas fa-circle-user text-white text-base"></i>`;
    }

    const pinButtonsHtml = renderPinButtons(currentPageId);

    return `
        <div class="flex items-center space-x-3">
            ${pinButtonsHtml}
            
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

                    <a href="../logged-in/settings.html" class="block px-3 py-2 text-sm font-normal text-white hover:bg-gray-800 rounded-lg transition-colors">
                        <i class="fas fa-cog mr-2"></i> Settings
                    </a>
                    
                    <button id="logout-button" class="w-full text-left px-3 py-2 text-sm font-normal text-red-400 hover:bg-red-900/30 rounded-lg transition-colors mt-1">
                        <i class="fas fa-sign-out-alt mr-2"></i> Log Out
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderLoggedOutNavbar() {
    // Standard Logged Out State
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

// 5. MAIN INJECTION & EVENT SETUP
function setupPinningEvents(auth) {
    const navbarContainer = document.getElementById('navbar-container');
    if (!navbarContainer) return;

    navbarContainer.addEventListener('click', (e) => {
        const button = e.target.closest('[data-pin-action]');
        if (button) {
            const action = button.dataset.pinAction;
            const pageId = button.dataset.pageId;

            if (action === 'pin' || action === 'unpin') {
                togglePin(pageId);
                // Re-render the navbar to update the pin buttons immediately
                injectAuthNavbar(auth, true); 
            }
        }
    });
}

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

// Function that is called multiple times (for updates)
function injectAuthNavbar(auth, isUpdate = false) {
    const navbarContainer = document.getElementById('navbar-container');
    if (!navbarContainer) return;

    // The first time, inject the entire structure
    if (!isUpdate) {
        navbarContainer.innerHTML = `
            <header id="full-header" class="sticky top-0 z-50 backdrop-blur-md bg-black/80 border-b border-gray-900">
                <nav class="h-16 flex items-center justify-between px-4">
                    <a href="../index.html" class="flex items-center space-x-2">
                        <picture>
                            <source srcset="../images/logo.png" media="(prefers-color-scheme: dark)">
                            <img src="../images/logo.png" alt="4simpleproblems Logo" class="h-8 w-auto">
                        </picture>
                    </a>
                    <div id="auth-controls-container"></div>
                </nav>
                <div id="page-menu-container"></div>
            </header>
        `;
    }
    
    // Get containers for content update
    const authControlsContainer = document.getElementById('auth-controls-container');
    const pageMenuContainer = document.getElementById('page-menu-container');
    const currentPageId = getCurrentPageId();


    // Wait for Firebase Auth and ALL_PAGES data to be ready
    auth.onAuthStateChanged((user) => {
        if (!authControlsContainer || !pageMenuContainer) return;
        
        // 1. Render Auth/Account Controls
        if (user) {
            authControlsContainer.innerHTML = renderLoggedInNavbar(user);
        } else {
            // For logged-out users, we only show the main controls, not pins
            authControlsContainer.innerHTML = renderLoggedOutNavbar();
        }

        // 2. Render Page Menu (always visible)
        pageMenuContainer.innerHTML = renderPageMenu(currentPageId);
        
        // 3. Setup interactivity (must be done after innerHTML updates)
        setupAuthMenuLogic();

        // 4. Setup Logout Listener
        if (user) {
            const logoutButton = document.getElementById('logout-button');
            if (logoutButton) {
                logoutButton.addEventListener('click', async () => {
                    try {
                        // FIX: Use the method on the passed auth object
                        await auth.signOut(); 
                        // Redirect to the login page after logout
                        window.location.href = 'login.html'; 
                    } catch (error) {
                        console.error("Logout failed:", error);
                    }
                });
            }
        }
    });
}

// 6. INITIALIZATION: The function to be called from the main script
window.initFullNavigation = async (auth) => {
    // Only proceed after DOM content is ready
    document.addEventListener('DOMContentLoaded', async () => {
        injectTopbarCSS();
        await loadPageData();
        injectAuthNavbar(auth); // Pass auth object
        setupPinningEvents(auth); // Pass auth object
    });
};
