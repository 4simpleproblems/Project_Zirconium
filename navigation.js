/**
 * @file navigation.js (Updated Vercel-style Navbar for 4simpleproblems)
 * @description A re-architected module for the site's navigation bar using Vercel's structural conventions.
 * The navbar is now a standard, static (non-fixed) element that pushes down the page content.
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION FOR 4SIMPLEPROBLEMS ---
    const NAV_CONFIG = {
        // Content for the "Toolkit" Mega-Menu
        TOOLKIT_LINKS: [{
            name: "Study Cards",
            description: "Flashcards for efficient subject mastery.",
            href: "/toolkit/study-cards",
            icon: `<svg data-testid="geist-icon" height="20" width="20" viewBox="0 0 16 16"><path fill="currentColor" d="M12.5 0.75H3.5C2.5335 0.75 1.75 1.5335 1.75 2.5V13.5C1.75 14.4665 2.5335 15.25 3.5 15.25H12.5C13.4665 15.25 14.25 14.4665 14.25 13.5V2.5C14.25 1.5335 13.4665 0.75 12.5 0.75ZM3.5 2.25H12.5C12.6381 2.25 12.75 2.36193 12.75 2.5V13.5C12.75 13.6381 12.6381 13.75 12.5 13.75H3.5C3.36193 13.75 3.25 13.6381 3.25 13.5V2.5C3.25 2.36193 3.36193 2.25 3.5 2.25Z"/></svg>`,
        }, {
            name: "Problem Generator",
            description: "Generate math and science problems on demand.",
            href: "/toolkit/generator",
            icon: `<svg data-testid="geist-icon" height="20" width="20" viewBox="0 0 16 16"><path fill="currentColor" d="M8.75 1.75C8.75 1.33579 8.41421 1 8 1C7.58579 1 7.25 1.33579 7.25 1.75V7.25H1.75C1.33579 7.25 1 7.58579 1 8C1 8.41421 1.33579 8.75 1.75 8.75H7.25V14.25C7.25 14.6642 7.58579 15 8 15C8.41421 15 8.75 14.6642 8.75 14.25V8.75H14.25C14.6642 8.75 15 8.41421 15 8C15 7.58579 14.6642 7.25 14.25 7.25H8.75V1.75Z"/></svg>`,
        }, {
            name: "Formula Sheets",
            description: "Access curated, searchable formula lists.",
            href: "/toolkit/formulas",
            icon: `<svg data-testid="geist-icon" height="20" width="20" viewBox="0 0 16 16"><path fill="currentColor" d="M12.5 4H3.5C3.22386 4 3 4.22386 3 4.5V11.5C3 11.7761 3.22386 12 3.5 12H12.5C12.7761 12 13 11.7761 13 11.5V4.5C13 4.22386 12.7761 4 12.5 4ZM4 5H12V11H4V5Z"/></svg>`,
        }],
        // Content for the "Games" Mega-Menu
        GAMES_LINKS: [{
            name: "Math Blitz",
            description: "Rapid-fire arithmetic training game.",
            href: "/games/math-blitz",
            icon: `<svg data-testid="geist-icon" height="20" width="20" viewBox="0 0 16 16"><path fill="currentColor" d="M11 6.5C11 7.88071 9.88071 9 8.5 9C7.11929 9 6 7.88071 6 6.5C6 5.11929 7.11929 4 8.5 4C9.88071 4 11 5.11929 11 6.5Z"/></svg>`,
        }, {
            name: "Periodic Puzzle",
            description: "Test your knowledge of the elements.",
            href: "/games/periodic-puzzle",
            icon: `<svg data-testid="geist-icon" height="20" width="20" viewBox="0 0 16 16"><path fill="currentColor" d="M13.5 7.5H10.5V4.5H13.5V7.5ZM5.5 12.5H2.5V9.5H5.5V12.5Z"/></svg>`,
        }],
    };

    const NavbarManager = {
        // --- CONFIGURATION & STATE ---
        config: {
            navbarHeight: '65px',
        },
        state: {
            isLoggedIn: false,
            user: null,
            isMenuOpen: false,
            activeDropdown: null,
            closeTimer: null,
        },
        dom: {}, 
        firebase: {}, 
        
        // --- INITIALIZATION ---
        async init() {
            this._injectCSS();
            this._createNavbarContainer();
            // await this._fetchSiteData(); // Placeholder for data fetching
            // this._initializeFirebase(); // Placeholder for Firebase
            
            this._bindEvents();
        },

        // --- CORE RENDERING LOGIC ---

        // Generates the Vercel-style HTML markup for the main navigation bar
        _getNavbarHTML(isLoggedIn = false, userName = 'User') {
            const authButton = isLoggedIn ?
                `<button data-testid="sign-out-btn" class="button-module__QyrFCa__base reset-module__ylizOa__reset button-module__QyrFCa__button geist-new-themed geist-new-tertiary button-module__QyrFCa__small" onclick="NavbarManager._signOut()">
                    <span class="button-module__QyrFCa__content button-module__QyrFCa__flex">Dashboard</span>
                </button>` :
                `<button data-testid="sign-in-btn" class="button-module__QyrFCa__base reset-module__ylizOa__reset button-module__QyrFCa__button geist-new-themed button-module__QyrFCa__invert button-module__QyrFCa__small" onclick="NavbarManager._googleSignIn()">
                    <span class="button-module__QyrFCa__content button-module__QyrFCa__flex">Sign In</span>
                </button>`;

            const toolkitMenu = NAV_CONFIG.TOOLKIT_LINKS.map(item => `
                <a href="${item.href}" class="link-module__Q1NRQq__link navigation-menu-module__AENi4G__link flex flex-row items-center p-3 hover:bg-gray-100 rounded-md">
                    <span class="flex-none mr-3 text-gray-700">${item.icon}</span>
                    <div class="flex flex-col">
                        <span class="font-medium text-gray-1000">${item.name}</span>
                        <span class="text-xs text-gray-800">${item.description}</span>
                    </div>
                </a>
            `).join('');

            const gamesMenu = NAV_CONFIG.GAMES_LINKS.map(item => `
                <a href="${item.href}" class="link-module__Q1NRQq__link navigation-menu-module__AENi4G__link flex flex-row items-center p-3 hover:bg-gray-100 rounded-md">
                    <span class="flex-none mr-3 text-gray-700">${item.icon}</span>
                    <div class="flex flex-col">
                        <span class="font-medium text-gray-1000">${item.name}</span>
                        <span class="text-xs text-gray-800">${item.description}</span>
                    </div>
                </a>
            `).join('');

            // NOTE: The 'static-nav' class replaces 'fixed top-0 left-0 right-0 z-50'
            return `
                <nav class="vercel-nav static-nav w-full z-50 bg-background-200 shadow-lg" data-geist-navigation-header>
                    <div class="geist-page-width flex items-center justify-between h-[var(--navbar-height)] px-6">
                        <a href="/" class="link-module__Q1NRQq__link flex items-center h-full mr-4">
                            <span class="text-xl font-bold text-gray-1000">4simpleproblems</span>
                        </a>

                        <div class="hidden lg:flex flex-1 justify-center h-full">
                            <div class="flex items-center gap-1 h-full">
                                
                                <button type="button" class="navigation-menu-module__AENi4G__trigger text-gray-900 px-3 py-2 rounded-lg hover:text-gray-1000 hover:bg-gray-200" data-menu-target="toolkit">
                                    Toolkit
                                    <span class="navigation-menu-module__AENi4G__chevron transition-transform duration-200">
                                        <svg data-testid="geist-icon" height="16" width="16" viewBox="0 0 16 16"><path fill="currentColor" d="M3.7915 5.5915L7.9915 9.7915L12.1915 5.5915C12.3915 5.3915 12.7915 5.3915 12.9915 5.5915C13.1915 5.7915 13.1915 6.1915 12.9915 6.3915L8.3915 10.9915C8.1915 11.1915 7.7915 11.1915 7.5915 10.9915L2.9915 6.3915C2.7915 6.1915 2.7915 5.7915 2.9915 5.5915C3.1915 5.3915 3.5915 5.3915 3.7915 5.5915Z"/></svg>
                                    </span>
                                </button>
                                
                                <button type="button" class="navigation-menu-module__AENi4G__trigger text-gray-900 px-3 py-2 rounded-lg hover:text-gray-1000 hover:bg-gray-200" data-menu-target="games">
                                    Games
                                    <span class="navigation-menu-module__AENi4G__chevron transition-transform duration-200">
                                        <svg data-testid="geist-icon" height="16" width="16" viewBox="0 0 16 16"><path fill="currentColor" d="M3.7915 5.5915L7.9915 9.7915L12.1915 5.5915C12.3915 5.3915 12.7915 5.3915 12.9915 5.5915C13.1915 5.7915 13.1915 6.1915 12.9915 6.3915L8.3915 10.9915C8.1915 11.1915 7.7915 11.1915 7.5915 10.9915L2.9915 6.3915C2.7915 6.1915 2.7915 5.7915 2.9915 5.5915C3.1915 5.3915 3.5915 5.3915 3.7915 5.5915Z"/></svg>
                                    </span>
                                </button>
                                
                                <a href="/community" class="link-module__Q1NRQq__link navigation-menu-module__AENi4G__link text-gray-900 px-3 py-2 rounded-lg hover:text-gray-1000 hover:bg-gray-200">Community</a>
                                <a href="/docs" class="link-module__Q1NRQq__link navigation-menu-module__AENi4G__link text-gray-900 px-3 py-2 rounded-lg hover:text-gray-1000 hover:bg-gray-200">Docs</a>
                                <a href="/pricing" class="link-module__Q1NRQq__link navigation-menu-module__AENi4G__link text-gray-900 px-3 py-2 rounded-lg hover:text-gray-1000 hover:bg-gray-200">Pricing</a>

                            </div>
                        </div>

                        <div class="flex items-center gap-3">
                            <span class="hidden md:inline-flex">${authButton}</span>
                            <button class="lg:hidden p-2 rounded-lg" data-menu-toggle>
                                <svg data-testid="geist-icon" height="20" width="20" viewBox="0 0 16 16"><path fill="currentColor" d="M14.5 3.75H1.5C1.36193 3.75 1.25 3.63807 1.25 3.5C1.25 3.36193 1.36193 3.25 1.5 3.25H14.5C14.6381 3.25 14.75 3.36193 14.75 3.5C14.75 3.63807 14.6381 3.75 14.5 3.75ZM14.5 8.75H1.5C1.36193 8.75 1.25 8.63807 1.25 8.5C1.25 8.36193 1.36193 8.25 1.5 8.25H14.5C14.6381 8.25 14.75 8.36193 14.75 8.5C14.75 8.63807 14.6381 8.75 14.5 8.75ZM14.5 13.75H1.5C1.36193 13.75 1.25 13.6381 1.25 13.5C1.25 13.3619 1.36193 13.25 1.5 13.25H14.5C14.6381 13.25 14.75 13.3619 14.75 13.5C14.75 13.6381 14.6381 13.75 14.5 13.75Z"/></svg>
                            </button>
                        </div>
                    </div>

                    <div class="absolute w-full top-[var(--navbar-height)] left-0 right-0 bg-background-200 shadow-xl hidden" data-dropdown-container>
                        <div data-menu-content="toolkit" class="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto hidden">
                            ${toolkitMenu}
                        </div>
                        <div data-menu-content="games" class="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto hidden">
                            ${gamesMenu}
                        </div>
                    </div>
                    
                    <div class="lg:hidden absolute w-full top-[var(--navbar-height)] left-0 right-0 bg-background-100 shadow-xl p-4 flex flex-col gap-2 transition-transform duration-300 transform -translate-y-full hidden" data-mobile-menu>
                        <a href="/toolkit" class="link-module__Q1NRQq__link p-3 rounded-lg hover:bg-gray-200">Toolkit</a>
                        <a href="/games" class="link-module__Q1NRQq__link p-3 rounded-lg hover:bg-gray-200">Games</a>
                        <a href="/community" class="link-module__Q1NRQq__link p-3 rounded-lg hover:bg-gray-200">Community</a>
                        <a href="/docs" class="link-module__Q1NRQq__link p-3 rounded-lg hover:bg-gray-200">Docs</a>
                        <a href="/pricing" class="link-module__Q1NRQq__link p-3 rounded-lg hover:bg-gray-200">Pricing</a>
                        <div class="p-2 md:hidden">${authButton}</div>
                    </div>
                </nav>
            `;
        },

        _createNavbarContainer() {
            const navbarHTML = this._getNavbarHTML(this.state.isLoggedIn, this.state.user?.displayName);
            
            const navWrapper = document.createElement('div');
            navWrapper.id = 'navbar-container';
            navWrapper.style.setProperty('--navbar-height', this.config.navbarHeight);
            navWrapper.innerHTML = navbarHTML;
            
            // Prepend the navbar wrapper to the <body> so it sits at the top and pushes content down
            document.body.prepend(navWrapper);
            
            // Cache DOM elements
            this.dom.nav = navWrapper.querySelector('[data-geist-navigation-header]');
            this.dom.dropdownContainer = navWrapper.querySelector('[data-dropdown-container]');
            this.dom.mobileMenu = navWrapper.querySelector('[data-mobile-menu]');
            this.dom.menuToggle = navWrapper.querySelector('[data-menu-toggle]');
            this.dom.menuTriggers = navWrapper.querySelectorAll('[data-menu-target]');
            
            this._renderInitialDOM();
        },

        _renderInitialDOM() {
            // Fallback rendering is simple since the main HTML is injected.
        },

        // --- INTERACTIVITY HANDLERS ---
        _bindEvents() {
            // Desktop Dropdown Logic
            this.dom.menuTriggers.forEach(trigger => {
                trigger.addEventListener('mouseenter', () => this._openDropdown(trigger.dataset.menuTarget));
                trigger.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (window.innerWidth >= 1024) { // Lg breakpoint
                        this._openDropdown(trigger.dataset.menuTarget, true); // Toggle mode for click
                    } else {
                        this._toggleMobileMenu();
                    }
                });
            });

            // Close dropdowns when mouse leaves the entire header/dropdown area
            this.dom.nav.addEventListener('mouseleave', () => this._setCloseTimer());
            this.dom.dropdownContainer.addEventListener('mouseenter', () => this._clearCloseTimer());
            this.dom.dropdownContainer.addEventListener('mouseleave', () => this._setCloseTimer());

            // Mobile Menu Toggle
            this.dom.menuToggle.addEventListener('click', () => this._toggleMobileMenu());

            // Note: _handleScroll is REMOVED as the navbar is now static (non-fixed) and does not hide.
        },

        _openDropdown(target, isClick = false) {
            this._clearCloseTimer();

            if (isClick && this.state.activeDropdown === target) {
                this._closeAllDropdowns();
                return;
            }
            
            // If another dropdown is open, close it before opening the new one
            if (this.state.activeDropdown !== null && this.state.activeDropdown !== target) {
                 this._closeAllDropdowns(0); // Close immediately
            }

            this.state.activeDropdown = target;
            this.dom.dropdownContainer.classList.remove('hidden');

            this.dom.nav.querySelectorAll('[data-menu-content]').forEach(content => {
                content.classList.add('hidden');
            });
            const targetContent = this.dom.dropdownContainer.querySelector(`[data-menu-content="${target}"]`);
            if (targetContent) {
                targetContent.classList.remove('hidden');
            }

            // Update active state (for visual indicator on the button)
            this.dom.menuTriggers.forEach(t => {
                const chevron = t.querySelector('.navigation-menu-module__AENi4G__chevron');
                if (t.dataset.menuTarget === target) {
                    t.setAttribute('data-active', 'open');
                    if (chevron) chevron.style.transform = 'rotate(180deg)';
                } else {
                    t.setAttribute('data-active', 'closed');
                    if (chevron) chevron.style.transform = 'rotate(0deg)';
                }
            });
            
            if (this.state.isMenuOpen) this._toggleMobileMenu();
        },

        _closeAllDropdowns(delay = 100) {
            this.state.closeTimer = setTimeout(() => {
                this.state.activeDropdown = null;
                this.dom.dropdownContainer.classList.add('hidden');
                
                this.dom.nav.querySelectorAll('[data-menu-content]').forEach(content => {
                    content.classList.add('hidden');
                });
                
                // Reset active state and chevron rotation
                this.dom.menuTriggers.forEach(t => {
                    t.setAttribute('data-active', 'closed');
                    const chevron = t.querySelector('.navigation-menu-module__AENi4G__chevron');
                    if (chevron) chevron.style.transform = 'rotate(0deg)';
                });
            }, delay); 
        },

        _clearCloseTimer() {
            if (this.state.closeTimer) {
                clearTimeout(this.state.closeTimer);
                this.state.closeTimer = null;
            }
        },
        
        _setCloseTimer() {
            this._closeAllDropdowns();
        },

        _toggleMobileMenu() {
            this.state.isMenuOpen = !this.state.isMenuOpen;
            const menu = this.dom.mobileMenu;
            if (this.state.isMenuOpen) {
                menu.classList.remove('-translate-y-full', 'hidden');
                setTimeout(() => menu.classList.add('translate-y-0'), 10);
                this._closeAllDropdowns(0); // Close desktop dropdowns immediately
            } else {
                menu.classList.remove('translate-y-0');
                menu.classList.add('-translate-y-full');
                setTimeout(() => menu.classList.add('hidden'), 300); 
            }
        },
        
        // --- CSS INJECTION ---
        _injectCSS() {
            const style = document.createElement('style');
            style.textContent = `
                /* --- VERCEL COLOR PALETTE (Minimal Subset) --- */
                :root {
                    /* Assuming dark mode from the Vercel HTML provided */
                    --ds-gray-1000: #fff; /* White */
                    --ds-gray-900: #eaeaea; /* Light Gray */
                    --ds-gray-800: #888; /* Medium Gray */
                    --ds-gray-700: #666; /* Darker Gray */
                    --background-100: #000; /* Primary Background (Black) */
                    --background-200: #111; /* Navbar Background (Slightly Lighter) */
                    --geist-space: 16px;
                    --geist-radius: 5px;
                    --geist-success: #0070f3;
                    --geist-error: #ff001c;
                    --geist-icon-size: 16px;
                }
                
                /* --- GENERAL LAYOUT --- */
                .vercel-nav {
                    --navbar-height: 65px;
                    height: var(--navbar-height);
                    position: relative; /* Container for absolute dropdowns */
                }
                
                .geist-page-width {
                    max-width: 1500px;
                    margin: 0 auto;
                    width: 100%;
                }
                
                /* --- UTILITY CLASSES (Mimicking Vercel/Tailwind) --- */
                .flex { display: flex; }
                .flex-row { flex-direction: row; }
                .flex-col { flex-direction: column; }
                .flex-1 { flex: 1; }
                .flex-none { flex: none; }
                .items-center { align-items: center; }
                .justify-between { justify-content: space-between; }
                .justify-center { justify-content: center; }
                .h-full { height: 100%; }
                .w-full { width: 100%; }
                .hidden { display: none !important; }
                .absolute { position: absolute; }
                .top-0 { top: 0; }
                .left-0 { left: 0; }
                .right-0 { right: 0; }
                .z-50 { z-index: 50; }
                .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
                .p-3 { padding: 0.75rem; }
                .p-4 { padding: 1rem; }
                .p-6 { padding: 1.5rem; }
                .mx-auto { margin-left: auto; margin-right: auto; }
                .mr-3 { margin-right: 0.75rem; }
                .mr-4 { margin-right: 1rem; }
                .gap-1 > * + * { margin-left: 0.25rem; }
                .gap-2 > * + * { margin-left: 0.5rem; }
                .gap-3 > * + * { margin-left: 0.75rem; }
                .gap-6 { gap: 1.5rem; }
                .rounded-md { border-radius: var(--geist-radius); }
                .rounded-lg { border-radius: 8px; }
                .shadow-lg { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1); }
                .shadow-xl { box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); }
                .transition-transform { transition-property: transform; transition-duration: 300ms; }
                .duration-200 { transition-duration: 200ms; }
                .duration-300 { transition-duration: 300ms; }
                .transform { transform: var(--tw-transform); }
                .-translate-y-full { transform: translateY(-100%); }
                .translate-y-0 { transform: translateY(0); }
                .grid { display: grid; }
                .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
                
                /* --- COLOR AND FONT STYLES --- */
                .bg-background-200 { background-color: var(--background-200); }
                .bg-background-100 { background-color: var(--background-100); }
                .text-xl { font-size: 1.25rem; }
                .text-xs { font-size: 0.75rem; }
                .font-bold { font-weight: 700; }
                .font-medium { font-weight: 500; }
                .text-gray-1000 { color: var(--ds-gray-1000); }
                .text-gray-900 { color: var(--ds-gray-900); }
                .text-gray-800 { color: var(--ds-gray-800); }
                .text-gray-700 { color: var(--ds-gray-700); }

                /* --- VERCEL MODULE STYLE REPLICATION --- */
                
                /* geist-new-themed (General Vercel Button Base) */
                .geist-new-themed {
                    --geist-button-bg: var(--ds-gray-900);
                    --geist-button-color: var(--ds-gray-1000);
                    border: none;
                    cursor: pointer;
                    line-height: 1;
                    padding: 0;
                }
                
                /* link-module__Q1NRQq__link (The base link style) */
                .link-module__Q1NRQq__link {
                    text-decoration: none;
                    color: inherit;
                    cursor: pointer;
                }

                /* button-module__QyrFCa__invert (Primary Button) */
                .button-module__QyrFCa__invert {
                    background-color: var(--ds-gray-1000);
                    color: var(--background-100);
                }
                .button-module__QyrFCa__invert:hover {
                    opacity: 0.9;
                }

                /* button-module__QyrFCa__base (Button common properties) */
                .button-module__QyrFCa__base {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: var(--geist-radius);
                }
                .button-module__QyrFCa__small {
                    height: 32px;
                    min-width: 32px;
                    padding: 0 16px;
                    font-size: 14px;
                }
                .button-module__QyrFCa__content {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    white-space: nowrap;
                }

                /* navigation-menu-module__AENi4G__trigger (Nav menu link/button) */
                .navigation-menu-module__AENi4G__trigger {
                    display: flex;
                    align-items: center;
                    background: none;
                    border: none;
                    cursor: pointer;
                    text-decoration: none;
                    transition: background-color 0.15s ease, color 0.15s ease;
                }
                .navigation-menu-module__AENi4G__trigger[data-active="open"] {
                    color: var(--ds-gray-1000);
                    background-color: var(--ds-gray-900);
                }
                .navigation-menu-module__AENi4G__chevron {
                    margin-left: 4px;
                }

                /* Hover states for internal menu items */
                .hover\\:bg-gray-100:hover {
                    background-color: rgba(255, 255, 255, 0.05); /* Light hover effect for dark mode */
                }
                
                /* --- RESPONSIVE ADJUSTMENTS --- */
                @media (min-width: 768px) {
                    .md\\:inline-flex { display: inline-flex !important; }
                    .md\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                }
                @media (min-width: 1024px) {
                    .lg\\:flex { display: flex !important; }
                    .lg\\:hidden { display: none !important; }
                    .md\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
                }
            `;
            document.head.appendChild(style);
        },

        // --- AUTH LOGIC (Placeholders) ---
        async _fetchSiteData() { return new Promise(resolve => setTimeout(resolve, 10)); },
        _initializeFirebase() {},
        async _googleSignIn() { console.log("Google Sign-In Placeholder called."); },
        async _signOut() { console.log("Sign Out Placeholder called."); },
        async _createUserDocument(user) {},
    };

    NavbarManager.init();
});
