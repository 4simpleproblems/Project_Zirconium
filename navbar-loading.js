/**
 * @file Manages the dynamic behavior of the site's navigation bar.
 * @description This script handles theme switching, user authentication state,
 * and a responsive, scrollable tab menu that activates when the
 * number of tabs exceeds a defined threshold.
 */
document.addEventListener('DOMContentLoaded', () => {

    /**
     * Encapsulates all functionality for the navigation bar to avoid polluting the global scope.
     */
    const NavbarManager = {
        // --- CONFIGURATION & STATE ---

        /**
         * Static configuration values for the navbar.
         * These can be adjusted easily from one place.
         */
        config: {
            navbarHeight: '65px',
            logoBaseUrl: 'https://raw.githubusercontent.com/4simpleproblems/Proj-Vanadium/main/images/',
            scrollThreshold: 8, // Activate scroll mode if tab count is greater than this.
            keyboardScrollAmount: 150, // Pixels to scroll with arrow keys.
            navLinks: [
                { href: "#", text: "Dashboard", active: true },
                { href: "#", text: "Soundboard" },
                { href: "#", text: "Playlists" },
                { href: "#", text: "Games" },
                { href: "#", text: "Notes" },
                { href: "#", text: "Requests" },
                { href: "#", text: "Scheduler" },
                { href: "#", text: "Calculator" },
                { href: "#", text: "Timer" },
                { href: "#", text: "Others" },
                { href: "#", text: "Settings" }
            ]
        },

        /**
         * Dynamic state of the navbar.
         * These values change during user interaction.
         */
        state: {
            isLoggedIn: true, // Assume logged in for demonstration.
            currentTheme: 'dark',
        },

        /**
         * Cached references to frequently accessed DOM elements.
         * This improves performance by avoiding repeated DOM queries.
         */
        dom: {
            navbar: null,
            scroller: null,
            leftArrow: null,
            rightArrow: null,
            accountMenu: null,
            accountButton: null,
        },

        // --- INITIALIZATION ---

        /**
         * Initializes the entire navbar module.
         * This is the main entry point.
         */
        init() {
            this._createNavbarContainer();
            this._attachGlobalEventListeners();
            this.render(); // Initial render based on default state.
        },

        /**
         * Creates the main <nav> element and prepends it to the body.
         */
        _createNavbarContainer() {
            const navbar = document.createElement('nav');
            navbar.id = 'navbar';
            navbar.className = 'fixed top-0 left-0 right-0 z-50';
            navbar.style.height = this.config.navbarHeight;
            navbar.style.opacity = '0'; // Start transparent for fade-in effect.
            document.body.prepend(navbar);
            this.dom.navbar = navbar;

            // Adjust body margin to prevent content from hiding behind the fixed navbar.
            document.body.style.marginTop = this.config.navbarHeight;
            
            // Fade the navbar in for a smooth appearance.
            setTimeout(() => {
                this.dom.navbar.style.opacity = '1';
            }, 10);
        },

        // --- RENDERING ---

        /**
         * Re-renders the entire inner content of the navbar based on the current state.
         * This function is called whenever state (like theme or login status) changes.
         */
        render() {
            if (!this.dom.navbar) return;

            const logoUrl = this.state.currentTheme === 'light' ?
                `${this.config.logoBaseUrl}logo-dark.png` :
                `${this.config.logoBaseUrl}logo.png`;

            const navTabsHTML = this._generateNavTabsHTML();
            const accountControlsHTML = this.state.isLoggedIn ?
                this._generateLoggedInControlsHTML() :
                this._generateLoggedOutControlsHTML();

            this.dom.navbar.innerHTML = `
                <div class="navbar-container h-full flex items-center justify-between px-4 sm:px-8">
                    <div class="flex items-center">
                        <img src="${logoUrl}" alt="4SP Logo" class="h-8 w-8 object-contain" loading="eager" decoding="async">
                    </div>
                    <div class="flex-grow flex justify-center min-w-0">
                        ${navTabsHTML}
                    </div>
                    ${accountControlsHTML}
                </div>
            `;
            
            // After rendering, cache new DOM elements and set up necessary event listeners.
            this._cacheDynamicDOMElements();
            this._applyThemeToBody();

            if (this.config.navLinks.length > this.config.scrollThreshold) {
                this._setupScrollMechanics();
            }
        },

        /**
         * Generates the HTML for the navigation tabs.
         * It dynamically adds the scrolling container and arrows if needed.
         * @returns {string} The HTML string for the navigation tabs section.
         */
        _generateNavTabsHTML() {
            const linkHTML = this.config.navLinks.map(link =>
                `<a href="${link.href}" class="nav-link ${link.active ? 'active' : ''}">${link.text}</a>`
            ).join('');

            const needsScrolling = this.config.navLinks.length > this.config.scrollThreshold;

            if (needsScrolling) {
                return `
                    <div class="nav-tabs-container scrolling">
                        <div class="nav-scroll-wrapper">
                            <button id="nav-arrow-left" class="nav-arrow">
                                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                            </button>
                            <div id="nav-tabs-scroller" class="nav-tabs-scroller">
                                <div class="flex items-center space-x-2 primary-font">
                                    ${linkHTML}
                                </div>
                            </div>
                            <button id="nav-arrow-right" class="nav-arrow">
                                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                            </button>
                        </div>
                    </div>`;
            } else {
                return `
                    <div class="nav-tabs-container">
                        <div class="flex items-center space-x-2 primary-font">
                            ${linkHTML}
                        </div>
                    </div>`;
            }
        },

        /**
         * Generates the HTML for the logged-in user controls (account button and menu).
         * @returns {string} The HTML string for the account controls.
         */
        _generateLoggedInControlsHTML() {
            // This extensive HTML block defines the structure of the user account dropdown menu.
            return `
                <div class="relative">
                    <button id="account-button" class="w-9 h-9 bg-gray-700 rounded-full flex items-center justify-center font-bold text-gray-300 hover:bg-gray-600 focus:outline-none primary-font">S</button>
                    <div id="account-menu" class="account-menu menu-hidden absolute right-0 mt-2 w-64 shadow-lg p-2 z-50">
                        <div class="px-2 py-2 border-b border-[var(--border-dark)] light:border-[var(--border-light)]">
                            <p class="text-sm truncate primary-font">student@school.edu</p>
                            <p class="text-xs secondary-font text-[var(--text-secondary-dark)] light:text-[var(--text-secondary-light)]">StudentUsername</p>
                        </div>
                        <div class="mt-2 flex flex-col space-y-1">
                            <a href="#" class="menu-item primary-font"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M4 13h6c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v8c0 .55.45 1 1 1zm0 8h6c.55 0 1-.45 1-1v-4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1zm10 0h6c.55 0 1-.45 1-1v-8c0-.55-.45-1-1-1h-6c-.55 0-1 .45-1 1v8c0 .55.45 1 1 1zM13 4v4c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1h-6c-.55 0-1 .45-1 1z"/></svg>Dashboard</a>
                            <a href="#" class="menu-item primary-font"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.44.17-.48.41l-.36 2.54c-.59-.24-1.13-.57-1.62-.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.34 8.85c-.11.2-.06.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12-.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.04.24.24.41.48.41h3.84c.24 0 .44-.17-.48.41l.36 2.54c.59-.24-1.13-.57-1.62-.94l2.39.96c.22.08.47 0 .59.22l1.92-3.32c.12-.22.06-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>Settings</a>
                        </div>
                        <div class="border-t border-[var(--border-dark)] light:border-[var(--border-light)] mt-2 pt-2">
                            <div class="px-2 py-1 text-xs secondary-font text-[var(--text-secondary-dark)] light:text-[var(--text-secondary-light)]">Theme</div>
                            <div class="theme-switcher p-1 rounded-md flex justify-around">
                                <button id="theme-light-btn" class="primary-font text-sm py-1 w-full rounded-md transition-colors ${this.state.currentTheme === 'light' ? 'active' : ''}">Light</button>
                                <button id="theme-dark-btn" class="primary-font text-sm py-1 w-full rounded-md transition-colors ${this.state.currentTheme === 'dark' ? 'active' : ''}">Dark</button>
                            </div>
                        </div>
                        <div class="border-t border-[var(--border-dark)] light:border-[var(--border-light)] mt-2 pt-2">
                            <button id="logout-btn" class="menu-item primary-font text-red-400"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>Logout</button>
                        </div>
                    </div>
                </div>
            `;
        },

        /**
         * Generates the HTML for the logged-out user controls (login button).
         * @returns {string} The HTML string for the login controls.
         */
        _generateLoggedOutControlsHTML() {
            return `
                <div class="flex items-center space-x-4">
                    <button id="login-btn" class="btn-primary primary-font text-sm">Login</button>
                </div>
            `;
        },

        // --- EVENT HANDLING ---

        /**
         * Attaches event listeners that persist throughout the component's lifecycle.
         * Uses event delegation on the navbar for efficiency.
         */
        _attachGlobalEventListeners() {
            // Delegated event listener for all clicks within the navbar
            this.dom.navbar.addEventListener('click', (e) => {
                const target = e.target;
                if (target.closest('#account-button')) { this._toggleAccountMenu(e); }
                else if (target.closest('#logout-btn')) { this._handleLogout(); } 
                else if (target.closest('#login-btn')) { this._handleLogin(); } 
                else if (target.closest('#theme-light-btn')) { this._setTheme('light'); } 
                else if (target.closest('#theme-dark-btn')) { this._setTheme('dark'); }
            });

            // Global listener to close the account menu when clicking outside of it.
            document.addEventListener('click', (e) => {
                if (this.dom.accountMenu && this.dom.accountButton &&
                    !this.dom.accountMenu.contains(e.target) &&
                    !this.dom.accountButton.contains(e.target)) {
                    this._closeAccountMenu();
                }
            });

            // Global listener for keyboard navigation of the tab scroller.
            document.addEventListener('keydown', (e) => {
                if (!this.dom.scroller) return;
                // Ignore key events if the user is typing in an input field.
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

                if (e.key === 'ArrowRight') {
                    e.preventDefault(); // Prevents the whole page from scrolling.
                    this.dom.scroller.scrollBy({ left: this.config.keyboardScrollAmount, behavior: 'smooth' });
                } else if (e.key === 'ArrowLeft') {
                    e.preventDefault(); // Prevents the whole page from scrolling.
                    this.dom.scroller.scrollBy({ left: -this.config.keyboardScrollAmount, behavior: 'smooth' });
                }
            });
        },

        /**
         * Sets up all event listeners related to the scrolling functionality of the nav tabs.
         * This is only called when the navbar is in scroll mode.
         */
        _setupScrollMechanics() {
            if (!this.dom.scroller) return;

            // --- Scroll with Mouse Wheel / Trackpad ---
            // Allows horizontal scrolling with a vertical mouse wheel or a two-finger trackpad swipe.
            this.dom.scroller.addEventListener('wheel', (e) => {
                e.preventDefault();
                this.dom.scroller.scrollLeft += e.deltaX + e.deltaY;
            }, { passive: false });

            // --- Arrow Button Clicks ---
            // Clicking the right arrow scrolls to the very end of the tab list.
            this.dom.rightArrow?.addEventListener('click', () => {
                this.dom.scroller.scrollTo({ left: this.dom.scroller.scrollWidth, behavior: 'smooth' });
            });
            // Clicking the left arrow scrolls back to the very beginning.
            this.dom.leftArrow?.addEventListener('click', () => {
                this.dom.scroller.scrollTo({ left: 0, behavior: 'smooth' });
            });

            // Listeners to update arrow visibility during scrolling and window resizing.
            this.dom.scroller.addEventListener('scroll', () => this._updateArrowVisibility());
            window.addEventListener('resize', () => this._updateArrowVisibility());

            // Initial check to set the correct arrow visibility after rendering.
            setTimeout(() => this._updateArrowVisibility(), 150);
        },

        // --- ACTIONS & HELPERS ---

        /**
         * Caches references to DOM elements that are created/destroyed during `render`.
         */
        _cacheDynamicDOMElements() {
            this.dom.scroller = document.getElementById('nav-tabs-scroller');
            this.dom.leftArrow = document.getElementById('nav-arrow-left');
            this.dom.rightArrow = document.getElementById('nav-arrow-right');
            this.dom.accountMenu = document.getElementById('account-menu');
            this.dom.accountButton = document.getElementById('account-button');
        },

        /**
         * Toggles the visibility of the user account dropdown menu.
         * @param {Event} e The click event.
         */
        _toggleAccountMenu(e) {
            e.stopPropagation(); // Prevent the global click listener from immediately closing it.
            this.dom.accountMenu?.classList.toggle('menu-hidden');
            this.dom.accountMenu?.classList.toggle('menu-visible');
        },

        /**
         * Explicitly closes the account menu.
         */
        _closeAccountMenu() {
            this.dom.accountMenu?.classList.add('menu-hidden');
            this.dom.accountMenu?.classList.remove('menu-visible');
        },

        /**
         * Sets the application theme.
         * @param {'light' | 'dark'} theme - The theme to apply.
         */
        _setTheme(theme) {
            this.state.currentTheme = theme;
            this.render(); // Re-render to update logo and button states.
        },

        /**
         * Applies the current theme class to the document body.
         */
        _applyThemeToBody() {
             document.body.className = this.state.currentTheme === 'light' ? 'light-mode' : 'dark-mode';
        },

        /**
         * Handles the user logout action.
         */
        _handleLogout() {
            this.state.isLoggedIn = false;
            this.render();
        },

        /**
         * Handles the user login action.
         */
        _handleLogin() {
            this.state.isLoggedIn = true;
            this.render();
        },

        /**
         * Checks the current scroll position of the tab menu and shows/hides the
         * navigation arrows accordingly.
         */
        _updateArrowVisibility() {
            if (!this.dom.scroller || !this.dom.leftArrow || !this.dom.rightArrow) return;
            
            // Use a 1px tolerance to prevent floating point inaccuracies from causing flickering.
            const tolerance = 1;
            const maxScroll = this.dom.scroller.scrollWidth - this.dom.scroller.clientWidth;

            // Show right arrow if not scrolled all the way to the end.
            this.dom.rightArrow.classList.toggle('visible', this.dom.scroller.scrollLeft < maxScroll - tolerance);
            
            // Show left arrow if not scrolled all the way to the beginning.
            this.dom.leftArrow.classList.toggle('visible', this.dom.scroller.scrollLeft > tolerance);
        }
    };

    // Start the application.
    NavbarManager.init();
});
