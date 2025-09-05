// navbar-loading.js
document.addEventListener('DOMContentLoaded', function () {
    let loggedIn = false;
    let currentTheme = 'dark'; // Default theme is now dark
    const navbarHeight = '65px';
    const logoBaseUrl = 'https://raw.githubusercontent.com/4simpleproblems/Proj-Vanadium/main/images/';

    // --- Nav Scroller State ---
    let currentTranslateX = 0;
    const scrollAmount = 200; // How many pixels to scroll

    /**
     * Sets the application theme.
     * @param {string} theme - The theme to set ('light' or 'dark').
     */
    function setTheme(theme) {
        currentTheme = theme;
        document.body.className = theme + '-mode';
        updateNavbarContent(); // Re-render navbar to update logo and button states
    }

    /**
     * Creates the initial navbar element and injects it into the DOM.
     */
    function createNavbar() {
        const navbar = document.createElement('nav');
        navbar.id = 'navbar';
        navbar.className = 'fixed top-0 left-0 right-0 z-50';
        navbar.style.height = navbarHeight;
        navbar.style.opacity = '0';
        document.body.prepend(navbar);
        setTheme(currentTheme); // Set initial theme

        document.body.style.marginTop = navbarHeight;

        setTimeout(() => {
            navbar.style.opacity = '1';
        }, 10);

        document.addEventListener('click', function(event) {
            const menu = document.getElementById('account-menu');
            const button = document.getElementById('account-button');
            if (menu && button && !menu.contains(event.target) && !button.contains(event.target)) {
                menu.classList.remove('menu-visible');
                menu.classList.add('menu-hidden');
            }
        });
    }

    /**
     * Attaches necessary event listeners after the navbar content is updated.
     */
    function attachEventListeners() {
        if (loggedIn) {
            const accountButton = document.getElementById('account-button');
            if (accountButton) {
                accountButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const menu = document.getElementById('account-menu');
                    menu.classList.toggle('menu-hidden');
                    menu.classList.toggle('menu-visible');
                });
            }
            
            document.getElementById('logout-btn')?.addEventListener('click', toggleLoginState);
            document.getElementById('theme-light-btn')?.addEventListener('click', () => setTheme('light'));
            document.getElementById('theme-dark-btn')?.addEventListener('click', () => setTheme('dark'));

        } else {
            document.getElementById('login-btn')?.addEventListener('click', toggleLoginState);
        }
        setupNavScroll(); // Setup listeners for the new scrollable menu
    }

    /**
     * Manages the visibility of the left/right scroll arrows for the nav menu.
     */
    function checkNavArrows() {
        const wrapper = document.getElementById('nav-tabs-wrapper');
        const container = document.getElementById('nav-tabs-container');
        if (!wrapper || !container) return;

        const rightArrow = document.getElementById('nav-arrow-right');
        const leftArrow = document.getElementById('nav-arrow-left');
        
        const maxScroll = wrapper.scrollWidth - container.clientWidth;

        // Show/hide right arrow
        if (currentTranslateX <= -maxScroll) {
            rightArrow.classList.remove('visible');
        } else {
            rightArrow.classList.add('visible');
        }

        // Show/hide left arrow
        if (currentTranslateX >= 0) {
            leftArrow.classList.remove('visible');
        } else {
            leftArrow.classList.add('visible');
        }
    }

    /**
     * Sets up event listeners for the nav menu scroll arrows.
     */
    function setupNavScroll() {
        const wrapper = document.getElementById('nav-tabs-wrapper');
        const container = document.getElementById('nav-tabs-container');
        const rightArrow = document.getElementById('nav-arrow-right');
        const leftArrow = document.getElementById('nav-arrow-left');

        if (!wrapper || !container || !rightArrow || !leftArrow) return;
        
        // Initial check for arrow visibility
        checkNavArrows();

        rightArrow.addEventListener('click', () => {
            const maxScroll = wrapper.scrollWidth - container.clientWidth;
            currentTranslateX -= scrollAmount;
            if (currentTranslateX < -maxScroll) {
                currentTranslateX = -maxScroll;
            }
            wrapper.style.transform = `translateX(${currentTranslateX}px)`;
            checkNavArrows();
        });

        leftArrow.addEventListener('click', () => {
            currentTranslateX += scrollAmount;
            if (currentTranslateX > 0) {
                currentTranslateX = 0;
            }
            wrapper.style.transform = `translateX(${currentTranslateX}px)`;
            checkNavArrows();
        });
    }


    /**
     * Updates the navbar's inner HTML based on the current login and theme state.
     */
    function updateNavbarContent() {
        const navbar = document.getElementById('navbar');
        if (!navbar) return;

        // Reset scroll position on content update
        currentTranslateX = 0; 
        
        const logoUrl = currentTheme === 'light' ? `${logoBaseUrl}logo-dark.png` : `${logoBaseUrl}logo.png`;
        const navTabs = `
            <div id="nav-tabs-container" class="nav-tabs-container">
                <div id="nav-arrow-left" class="nav-arrow">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                </div>
                <div id="nav-tabs-wrapper" class="nav-tabs-wrapper">
                    <div class="flex items-center space-x-2 text-sm secondary-font">
                        <a href="#" class="nav-link">Dashboard</a>
                        <a href="#" class="nav-link">Soundboard</a>
                        <a href="#" class="nav-link">Games</a>
                        <a href="#" class="nav-link">Scheduler</a>
                        <a href="#" class="nav-link">Calculator</a>
                        <a href="#" class="nav-link">Timer</a>
                        <a href="#" class="nav-link">Notes</a>
                        <a href="#" class="nav-link">Others</a>
                    </div>
                </div>
                 <div id="nav-arrow-right" class="nav-arrow">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </div>
            </div>
        `;

        if (loggedIn) {
            navbar.innerHTML = `
                <div class="navbar-container h-full flex items-center justify-between px-4 sm:px-8">
                    <div class="flex items-center space-x-4 sm:space-x-8">
                        <div class="flex items-center space-x-3">
                            <img src="${logoUrl}" alt="4SP Logo" class="h-8 w-8 object-contain" loading="eager" decoding="async">
                            <div class="flex flex-col">
                                <span class="text-lg leading-tight primary-font">4SP V5</span>
                                <span class="text-xs leading-tight secondary-font">Student Multi-Tool Platform</span>
                            </div>
                        </div>
                        <div class="hidden md:flex">${navTabs}</div>
                    </div>
                    <div class="relative">
                        <button id="account-button" class="w-9 h-9 bg-gray-700 rounded-full flex items-center justify-center font-bold text-gray-300 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-white transition-colors">S</button>
                        <div id="account-menu" class="account-menu menu-hidden absolute right-0 mt-2 w-64 shadow-lg p-2 z-50">
                            <div class="px-2 py-2 border-b border-[var(--border-dark)]">
                                <p class="text-sm font-semibold truncate primary-font">student@school.edu</p>
                                <p class="text-xs secondary-font text-[var(--text-secondary-dark)]">StudentUsername</p>
                            </div>
                            <div class="mt-2">
                                <a href="#" class="menu-item text-sm">Dashboard</a>
                                <a href="#" class="menu-item text-sm">Settings</a>
                            </div>
                            <div class="border-t border-[var(--border-dark)] mt-2 pt-2">
                                <div class="px-2 py-1 text-xs secondary-font text-[var(--text-secondary-dark)]">Theme</div>
                                <div class="px-2 flex justify-around theme-switcher bg-[var(--bg-primary-dark)] p-1 rounded-md">
                                    <button id="theme-light-btn" class="text-sm py-1 w-full rounded-md ${currentTheme === 'light' ? 'active bg-[var(--bg-secondary-dark)]' : ''}">Light</button>
                                    <button id="theme-dark-btn" class="text-sm py-1 w-full rounded-md ${currentTheme === 'dark' ? 'active bg-[var(--bg-secondary-dark)]' : ''}">Dark</button>
                                </div>
                            </div>
                            <div class="border-t border-[var(--border-dark)] mt-2 pt-2">
                                <button id="logout-btn" class="menu-item text-sm text-red-400">Logout</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            navbar.innerHTML = `
                <div class="navbar-container h-full flex items-center justify-between px-4 sm:px-8">
                     <div class="flex items-center space-x-4 sm:space-x-8">
                        <div class="flex items-center space-x-3">
                            <img src="${logoUrl}" alt="4SP Logo" class="h-8 w-8 object-contain" loading="eager" decoding="async">
                             <div class="flex flex-col">
                                <span class="text-lg leading-tight primary-font">4SP V5</span>
                                <span class="text-xs secondary-font">Student Multi-Tool Platform</span>
                            </div>
                        </div>
                        <div class="hidden md:flex">${navTabs}</div>
                    </div>
                    <div class="flex items-center space-x-4">
                        <button id="login-btn" class="btn-primary text-sm">Login</button>
                    </div>
                </div>
            `;
        }
        attachEventListeners();
    }

    function toggleLoginState() {
        loggedIn = !loggedIn;
        updateNavbarContent();
    }

    document.addEventListener('keydown', function (e) {
        if (e.shiftKey && e.key === 'L') {
            e.preventDefault();
            toggleLoginState();
        }
    });

    createNavbar();
});
