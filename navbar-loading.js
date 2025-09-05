/**
 * @file navbar-loading.js
 * @description A self-contained module to create, style, and manage the website's navigation bar.
 * This script injects its own CSS, creates the navbar HTML, and handles all interactive
 * functionality, including a theme switcher and a responsive, scrollable tab menu.
 */
document.addEventListener('DOMContentLoaded', () => {

    const NavbarManager = {
        // --- CONFIGURATION & STATE ---
        config: {
            navbarHeight: '65px',
            logoBaseUrl: 'https://raw.githubusercontent.com/4simpleproblems/Proj-Vanadium/main/images/',
            scrollThreshold: 8, // Activate scroll mode if navLink count is greater than this.
            keyboardScrollAmount: 150,
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

        state: {
            isLoggedIn: true,
            currentTheme: 'dark',
        },

        dom: {
            navbar: null,
            scroller: null,
            leftArrow: null,
            rightArrow: null,
            accountMenu: null,
            accountButton: null,
        },

        // --- INITIALIZATION ---

        init() {
            this._injectCSS(); // **Inject all necessary styles into the document head**
            this._createNavbarContainer();
            this._attachGlobalEventListeners();
            this.render();
        },

        /**
         * Creates a <style> tag and injects all the necessary CSS for the navbar
         * and its components into the document's <head>.
         */
        _injectCSS() {
            const css = `
                /* --- THEME VARIABLES --- */
                :root {
                    --bg-primary-light: #F0F2F5; --bg-secondary-light: #FFFFFF; --text-primary-light: #1A202C;
                    --text-secondary-light: #4A5568; --border-light: #E2E8F0; --accent-light: #000000;
                    --accent-text-light: #FFFFFF; --bg-primary-dark: #121212; --bg-secondary-dark: #1E1E1E;
                    --text-primary-dark: #EAEAEA; --text-secondary-dark: #AAAAAA; --border-dark: #2A2A2A;
                    --accent-dark: #FFFFFF; --accent-text-dark: #000000;
                }
                /* --- THEME STYLES --- */
                body.light-mode { background-color: var(--bg-primary-light); color: var(--text-primary-light); }
                body.dark-mode { background-color: var(--bg-primary-dark); color: var(--text-primary-dark); }
                .primary-font { font-family: sans-serif; } .secondary-font { font-family: monospace; }
                /* --- NAVBAR STYLES --- */
                #navbar {
                    transition: background-color 0.3s ease, border-color 0.3s ease, opacity 0.3s ease;
                    backdrop-filter: blur(12px) saturate(150%);
                    -webkit-backdrop-filter: blur(12px) saturate(150%);
                }
                .light-mode #navbar { background-color: rgba(240, 242, 245, 0.8); border-bottom: 1px solid var(--border-light); }
                .dark-mode #navbar { background-color: rgba(18, 18, 18, 0.75); border-bottom: 1px solid var(--border-dark); }
                /* --- SCROLLABLE NAV MENU --- */
                .nav-tabs-container { flex-grow: 1; display: flex; justify-content: center; align-items: center; width: 100%; }
                .nav-scroll-wrapper {
                    position: relative; display: flex; align-items: center; width: 100%;
                    padding-left: 2.5rem; padding-right: 2.5rem;
                }
                .nav-tabs-scroller {
                    display: flex; overflow-x: hidden; scrollbar-width: none; -ms-overflow-style: none;
                    scroll-behavior: smooth;
                }
                .nav-tabs-scroller::-webkit-scrollbar { display: none; }
                .nav-arrow {
                    position: absolute; top: 50%; transform: translateY(-50%); z-index: 10; cursor: pointer;
                    width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center;
                    justify-content: center; transition: all 0.2s ease; opacity: 0; pointer-events: none;
                }
                .nav-arrow.visible { opacity: 1; pointer-events: auto; }
                .dark-mode .nav-arrow { background-color: rgba(42, 42, 42, 0.9); }
                .light-mode .nav-arrow { background-color: rgba(234, 234, 234, 0.9); }
                .dark-mode .nav-arrow:hover { background-color: var(--border-dark); }
                .light-mode .nav-arrow:hover { background-color: var(--border-light); }
                #nav-arrow-left { left: 4px; } #nav-arrow-right { right: 4px; }
                .nav-link {
                    position: relative; transition: all 0.2s ease; padding: 10px 16px; border-radius: 10px;
                    white-space: nowrap; border-bottom: 2px solid transparent; flex-shrink: 0;
                }
                .dark-mode .nav-link { color: var(--text-secondary-dark); }
                .light-mode .nav-link { color: var(--text-secondary-light); }
                .dark-mode .nav-link:hover { color: var(--text-primary-dark); }
                .light-mode .nav-link:hover { color: var(--text-primary-light); }
                .nav-link.active { color: var(--text-primary-dark) !important; }
                .light-mode .nav-link.active { color: var(--text-primary-light) !important; }
                .nav-link.active::after {
                    content: ''; position: absolute; left: 16px; right: 16px; bottom: 0;
                    height: 2px; background-color: var(--accent-dark);
                }
                .light-mode .nav-link.active::after { background-color: var(--accent-light); }
                /* --- ACCOUNT MENU --- */
                .account-menu { transition: all 0.2s ease-out; transform-origin: top right; border-radius: 10px; }
                .dark-mode .account-menu { background-color: #222222; border: 1px solid var(--border-dark); }
                .light-mode .account-menu { background-color: var(--bg-secondary-light); border: 1px solid var(--border-light); }
                .menu-hidden { opacity: 0; transform: scale(0.95) translateY(-10px); pointer-events: none; }
                .menu-visible { opacity: 1; transform: scale(1) translateY(0); pointer-events: auto; }
                .menu-item {
                    transition: background-color 0.2s ease; display: flex; align-items: center; gap: 12px;
                    width: 100%; text-align: left; padding: 10px 16px; border-radius: 6px;
                }
                .dark-mode .menu-item:hover { background-color: var(--bg-secondary-dark); }
                .light-mode .menu-item:hover { background-color: var(--bg-primary-light); }
                .menu-item svg { width: 18px; height: 18px; }
                .dark-mode .menu-item svg { color: var(--text-secondary-dark); }
                .light-mode .menu-item svg { color: var(--text-secondary-light); }
                /* --- THEME SWITCHER --- */
                .light-mode .theme-switcher { background-color: #E2E8F0; }
                .dark-mode .theme-switcher { background-color: var(--bg-primary-dark); }
                .light-mode .theme-switcher button { color: var(--text-secondary-light); }
                .dark-mode .theme-switcher button { color: var(--text-secondary-dark); }
                .light-mode .theme-switcher button.active { background-color: var(--accent-light) !important; color: var(--accent-text-light) !important; }
                .dark-mode .theme-switcher button.active { background-color: var(--accent-dark) !important; color: var(--accent-text-dark) !important; }
            `;
            const styleElement = document.createElement('style');
            styleElement.innerHTML = css;
            document.head.appendChild(styleElement);
        },
        
        _createNavbarContainer() {
            const navbar = document.createElement('nav');
            navbar.id = 'navbar';
            navbar.className = 'fixed top-0 left-0 right-0 z-50'; // Assuming Tailwind is available on the page
            navbar.style.height = this.config.navbarHeight;
            navbar.style.opacity = '0';
            document.body.prepend(navbar);
            this.dom.navbar = navbar;
            document.body.style.marginTop = this.config.navbarHeight;
            setTimeout(() => { this.dom.navbar.style.opacity = '1'; }, 10);
        },

        // --- RENDERING ---

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
                        <img src="${logoUrl}" alt="Logo" class="h-8 w-8 object-contain" loading="eager">
                    </div>
                    <div class="flex-grow flex justify-center min-w-0">${navTabsHTML}</div>
                    ${accountControlsHTML}
                </div>`;
            
            this._cacheDynamicDOMElements();
            this._applyThemeToBody();
            if (this.config.navLinks.length > this.config.scrollThreshold) {
                this._setupScrollMechanics();
            }
        },

        _generateNavTabsHTML() {
            const linkHTML = this.config.navLinks.map(link =>
                `<a href="${link.href}" class="nav-link ${link.active ? 'active' : ''}">${link.text}</a>`
            ).join('');
            const needsScrolling = this.config.navLinks.length > this.config.scrollThreshold;
            if (needsScrolling) {
                return `<div class="nav-tabs-container scrolling">
                    <div class="nav-scroll-wrapper">
                        <button id="nav-arrow-left" class="nav-arrow">
                            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width:20px;height:20px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <div id="nav-tabs-scroller" class="nav-tabs-scroller">
                            <div class="flex items-center space-x-2 primary-font">${linkHTML}</div>
                        </div>
                        <button id="nav-arrow-right" class="nav-arrow">
                            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width:20px;height:20px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                </div>`;
            } else {
                return `<div class="nav-tabs-container">
                    <div class="flex items-center space-x-2 primary-font">${linkHTML}</div>
                </div>`;
            }
        },

        _generateLoggedInControlsHTML() {
            return `<div class="relative">
                <button id="account-button" class="w-9 h-9 bg-gray-700 rounded-full flex items-center justify-center font-bold text-gray-300 hover:bg-gray-600 focus:outline-none primary-font">S</button>
                <div id="account-menu" class="account-menu menu-hidden absolute right-0 mt-2 w-64 shadow-lg p-2 z-50">
                    <div class="px-2 py-2 border-b border-[var(--border-dark)] light:border-[var(--border-light)]">
                        <p class="text-sm truncate primary-font">student@school.edu</p>
                        <p class="text-xs secondary-font text-[var(--text-secondary-dark)] light:text-[var(--text-secondary-light)]">StudentUsername</p>
                    </div>
                    <div class="mt-2 flex flex-col space-y-1">
                        <a href="#" class="menu-item primary-font"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M4 13h6c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v8c0 .55.45 1 1 1zm0 8h6c.55 0 1-.45 1-1v-4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1zm10 0h6c.55 0 1-.45 1-1v-8c0-.55-.45-1-1-1h-6c-.55 0-1 .45-1 1v8c0 .55.45 1 1 1zM13 4v4c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1h-6c-.55 0-1 .45-1 1z"/></svg>Dashboard</a>
                        <a href="#" class="menu-item primary-font"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.44.17-.48.41l-.36 2.54c-.59-.24-1.13-.57-1.62-.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.34 8.85c-.11.2-.06.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23-.41-.12-.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.04.24.24.41.48.41h3.84c.24 0 .44-.17-.48.41l.36 2.54c.59-.24-1.13-.57-1.62-.94l2.39.96c.22.08.47 0 .59.22l1.92-3.32c.12-.22.06-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>Settings</a>
                    </div>
                    <div class="border-t border-[var(--border-dark)] light:border-[var(--border-light)] mt-2 pt-2">
                        <div class="px-2 py-1 text-xs secondary-font text-[var(--text-secondary-dark)] light:text-[var(--text-secondary-light)]">Theme</div>
                        <div class="theme-switcher p-1 rounded-md flex justify-around">
                            <button id="theme-light-btn" class="primary-font text-sm py-1 w-full rounded-md transition-colors ${this.state.currentTheme === 'light' ? 'active' : ''}">Light</button>
                            <button id="theme-dark-btn" class="primary-font text-sm py-1 w-full rounded-md transition-colors ${this.state.currentTheme === 'dark' ? 'active' : ''}">Dark</button>
                        </div>
                    </div>
                    <div class="border-t border-[var(--border-dark)] light:border-[var(--border-light)] mt-2 pt-2">
                        <button id="logout-btn" class="menu-item primary-font text-red-400" style="color: #F87171;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>Logout</button>
                    </div>
                </div>
            </div>`;
        },

        _generateLoggedOutControlsHTML() {
            return `<div class="flex items-center space-x-4">
                <button id="login-btn" class="btn-primary primary-font text-sm">Login</button>
            </div>`;
        },

        // --- EVENT HANDLING & ACTIONS ---

        _attachGlobalEventListeners() {
            this.dom.navbar.addEventListener('click', (e) => {
                const target = e.target;
                if (target.closest('#account-button')) { this._toggleAccountMenu(e); }
                else if (target.closest('#logout-btn')) { this.state.isLoggedIn = false; this.render(); } 
                else if (target.closest('#login-btn')) { this.state.isLoggedIn = true; this.render(); } 
                else if (target.closest('#theme-light-btn')) { this._setTheme('light'); } 
                else if (target.closest('#theme-dark-btn')) { this._setTheme('dark'); }
            });
            document.addEventListener('click', (e) => {
                if (this.dom.accountMenu && this.dom.accountButton &&
                    !this.dom.accountMenu.contains(e.target) &&
                    !this.dom.accountButton.contains(e.target)) {
                    this._closeAccountMenu();
                }
            });
            document.addEventListener('keydown', (e) => {
                if (!this.dom.scroller || (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
                if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    this.dom.scroller.scrollBy({ left: this.config.keyboardScrollAmount, behavior: 'smooth' });
                } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    this.dom.scroller.scrollBy({ left: -this.config.keyboardScrollAmount, behavior: 'smooth' });
                }
            });
        },

        _setupScrollMechanics() {
            if (!this.dom.scroller) return;
            this.dom.scroller.addEventListener('wheel', (e) => {
                e.preventDefault();
                this.dom.scroller.scrollLeft += e.deltaX + e.deltaY;
            }, { passive: false });
            this.dom.rightArrow?.addEventListener('click', () => {
                this.dom.scroller.scrollTo({ left: this.dom.scroller.scrollWidth, behavior: 'smooth' });
            });
            this.dom.leftArrow?.addEventListener('click', () => {
                this.dom.scroller.scrollTo({ left: 0, behavior: 'smooth' });
            });
            this.dom.scroller.addEventListener('scroll', () => this._updateArrowVisibility());
            window.addEventListener('resize', () => this._updateArrowVisibility());
            setTimeout(() => this._updateArrowVisibility(), 150);
        },

        _cacheDynamicDOMElements() {
            this.dom.scroller = document.getElementById('nav-tabs-scroller');
            this.dom.leftArrow = document.getElementById('nav-arrow-left');
            this.dom.rightArrow = document.getElementById('nav-arrow-right');
            this.dom.accountMenu = document.getElementById('account-menu');
            this.dom.accountButton = document.getElementById('account-button');
        },

        _toggleAccountMenu(e) {
            e.stopPropagation();
            this.dom.accountMenu?.classList.toggle('menu-hidden');
            this.dom.accountMenu?.classList.toggle('menu-visible');
        },

        _closeAccountMenu() {
            this.dom.accountMenu?.classList.add('menu-hidden');
            this.dom.accountMenu?.classList.remove('menu-visible');
        },

        _setTheme(theme) {
            this.state.currentTheme = theme;
            this.render();
        },

        _applyThemeToBody() {
             document.body.className = this.state.currentTheme === 'light' ? 'light-mode' : 'dark-mode';
        },

        _updateArrowVisibility() {
            if (!this.dom.scroller || !this.dom.leftArrow || !this.dom.rightArrow) return;
            const tolerance = 1;
            const maxScroll = this.dom.scroller.scrollWidth - this.dom.scroller.clientWidth;
            this.dom.rightArrow.classList.toggle('visible', this.dom.scroller.scrollLeft < maxScroll - tolerance);
            this.dom.leftArrow.classList.toggle('visible', this.dom.scroller.scrollLeft > tolerance);
        }
    };

    // Initialize the navbar.
    NavbarManager.init();
});
