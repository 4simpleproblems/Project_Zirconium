/**
 * @file navbar-loading.js
 * @description A self-contained module to create, style, and manage a dynamic, Firebase-integrated navigation bar.
 * This script injects its own CSS, creates the navbar HTML, and handles all interactive
 * functionality, including a responsive, scrollable tab menu and authentication state.
 *
 * IMPORTANT: This script relies on the Firebase v8 compatibility libraries and expects
 * them to be loaded in your HTML *before* this script. It also expects a global `firebaseConfig` object.
 * * Your HTML's <head> or <body> should include scripts in this order:
 * <!-- 1. Your Firebase Configuration File -->
 * <!-- This file must define a global variable: const firebaseConfig = { ... }; -->
 * <script src="../firebase-config.js"></script>
 *
 * <!-- 2. Firebase SDK (v8 Compatibility Mode) -->
 * <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
 * <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
 *
 * <!-- 3. This Navbar Script -->
 * <script src="path/to/navbar-loading.js"></script>
 */

// This script no longer uses ES6 imports to improve compatibility.
// It relies on the Firebase SDK and firebaseConfig being available globally.

document.addEventListener('DOMContentLoaded', () => {
    const NavbarManager = {
        // --- CONFIGURATION & STATE ---
        config: {
            navbarHeight: '65px',
            logoUrl: 'https://raw.githubusercontent.com/4simpleproblems/Proj-Vanadium/main/images/logo.png',
            scrollThreshold: 8,
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
                { href: "#", "text": "Settings" }
            ]
        },

        state: {
            isLoggedIn: false,
            user: null,
            currentTheme: 'dark', // Let's keep a theme, even if not user-configurable in menu
        },

        dom: {
            navbar: null,
            scroller: null,
            leftArrow: null,
            rightArrow: null,
            accountMenu: null,
            accountButton: null,
        },
        
        firebase: {
            app: null,
            auth: null,
        },

        // --- INITIALIZATION ---
        init() {
            this._injectCSS();
            this._createNavbarContainer();
            this._initializeFirebase();
            // Initial render is now handled by the auth state change listener or after a fallback render.
        },
        
        _initializeFirebase() {
            // Check if Firebase and the config are loaded globally
            if (typeof firebase === 'undefined' || typeof firebaseConfig === 'undefined') {
                console.error("Firebase is not loaded or firebaseConfig is not defined. Please ensure you have included the Firebase SDK and your firebase-config.js file in your HTML before this script.");
                this.render(); // Render in a logged-out state as a fallback
                return;
            }

            try {
                // Use the v8 compat syntax
                this.firebase.app = firebase.initializeApp(firebaseConfig);
                this.firebase.auth = firebase.auth();
                
                this.firebase.auth.onAuthStateChanged((user) => {
                    if (user) {
                        this.state.isLoggedIn = true;
                        this.state.user = {
                            uid: user.uid,
                            email: user.email,
                            displayName: user.displayName || 'User',
                            photoURL: user.photoURL
                        };
                    } else {
                        this.state.isLoggedIn = false;
                        this.state.user = null;
                    }
                    this.render(); // Re-render the navbar whenever auth state changes
                });

            } catch (error) {
                console.error("Firebase initialization failed:", error);
                // Render a fallback navbar if Firebase fails
                this.render();
            }
        },

        _injectCSS() {
            const css = `
                :root {
                    --bg-primary-dark: #121212; --bg-secondary-dark: #1E1E1E;
                    --text-primary-dark: #EAEAEA; --text-secondary-dark: #AAAAAA; 
                    --border-dark: #2A2A2A; --accent-dark: #FFFFFF;
                }
                body { background-color: var(--bg-primary-dark); color: var(--text-primary-dark); font-family: sans-serif; }
                
                #navbar {
                    transition: background-color 0.3s ease, border-color 0.3s ease, opacity 0.3s ease;
                    backdrop-filter: blur(12px) saturate(150%);
                    -webkit-backdrop-filter: blur(12px) saturate(150%);
                    background-color: rgba(18, 18, 18, 0.75); 
                    border-bottom: 1px solid var(--border-dark);
                }
                
                .nav-tabs-container { 
                    flex-grow: 1; display: flex; justify-content: center; 
                    align-items: center; width: 100%; min-width: 0;
                    opacity: 1; transition: opacity 0.3s ease;
                }
                .nav-tabs-container.logged-out {
                    opacity: 0;
                    pointer-events: none;
                }
                .nav-scroll-wrapper {
                    position: relative; display: flex; align-items: center; 
                    width: 100%; max-width: 1000px;
                }
                .nav-tabs-scroller {
                    display: flex; overflow-x: hidden; scrollbar-width: none; 
                    -ms-overflow-style: none; scroll-behavior: smooth;
                    width: 100%; justify-content: center;
                }
                .nav-tabs-scroller::-webkit-scrollbar { display: none; }
                
                .nav-arrow {
                    position: absolute; top: 50%; transform: translateY(-50%); 
                    z-index: 10; cursor: pointer;
                    width: 32px; height: 32px; border-radius: 50%; 
                    display: flex; align-items: center; justify-content: center; 
                    transition: all 0.2s ease; opacity: 0; pointer-events: none;
                    background-color: #000;
                }
                .nav-arrow svg { stroke: #FFF; transition: stroke 0.2s ease; }
                .nav-arrow:hover { background-color: #FFF; }
                .nav-arrow:hover svg { stroke: #000; }
                .nav-arrow.visible { opacity: 1; pointer-events: auto; }
                #nav-arrow-left { left: 4px; } #nav-arrow-right { right: 4px; }
                
                .nav-link {
                    transition: all 0.2s ease; padding: 10px 16px; border-radius: 10px;
                    white-space: nowrap; border-bottom: 2px solid transparent; flex-shrink: 0;
                    color: var(--text-secondary-dark);
                }
                .nav-link:hover { color: var(--text-primary-dark); }
                .nav-link.active { color: var(--text-primary-dark) !important; }
                .nav-link.active::after {
                    content: ''; position: absolute; left: 16px; right: 16px; bottom: 0;
                    height: 2px; background-color: var(--accent-dark);
                }

                /* --- ACCOUNT MENU --- */
                #account-controls { position: relative; }
                .account-menu { 
                    position: absolute;
                    top: -16px; /* Position above the original button spot */
                    right: -16px; /* Position to the right */
                    width: 300px;
                    background-color: #222222; 
                    border: 1px solid var(--border-dark);
                    box-shadow: 0 10px 20px rgba(0,0,0,0.25);
                    transition: all 0.2s ease-out; transform-origin: top right; 
                    border-radius: 12px;
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .menu-hidden { opacity: 0; transform: scale(0.95) translateY(-10px); pointer-events: none; }
                .menu-visible { opacity: 1; transform: scale(1) translateY(0); pointer-events: auto; }

                .account-menu-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    border-bottom: 1px solid var(--border-dark);
                    padding-bottom: 12px;
                }
                .user-info {
                    overflow: hidden;
                    white-space: nowrap;
                    margin-right: 16px;
                }
                .user-info-text { display: inline-block; }
                .user-info-text.marquee {
                    animation: marquee 10s linear infinite;
                }
                @keyframes marquee {
                    0%   { transform: translateX(0); }
                    20%  { transform: translateX(0); }
                    100% { transform: translateX(calc(-100% + 150px)); } /* Adjust 150px to your container width */
                }
                .user-info .name { font-weight: bold; color: var(--text-primary-dark); display: block; }
                .user-info .email { font-size: 0.8rem; color: var(--text-secondary-dark); display: block; }
                
                #account-button-in-menu {
                    flex-shrink: 0;
                }

                .profile-pic {
                    width: 40px; height: 40px; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    background-color: #4A5568; color: var(--text-primary-dark);
                    font-weight: bold; font-size: 1rem;
                    cursor: pointer; transition: filter 0.2s ease;
                }
                .profile-pic:hover { filter: brightness(1.2); }
                .profile-pic img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
                
                .menu-actions { display: flex; flex-direction: column; gap: 8px; }
                .menu-button {
                    width: 100%; text-align: left; padding: 10px 12px;
                    border-radius: 8px; background-color: transparent;
                    color: var(--text-primary-dark);
                    transition: background-color 0.2s ease;
                    display: flex; align-items: center; gap: 12px;
                }
                .menu-button:hover { background-color: var(--bg-secondary-dark); }
                .menu-button.danger:hover { background-color: rgba(239, 68, 68, 0.2); color: #F87171; }
                .menu-button svg { width: 20px; height: 20px; }
            `;
            const styleElement = document.createElement('style');
            styleElement.innerHTML = css;
            document.head.appendChild(styleElement);
        },
        
        _createNavbarContainer() {
            const navbar = document.createElement('nav');
            navbar.id = 'navbar';
            navbar.className = 'fixed top-0 left-0 right-0 z-50';
            navbar.style.height = this.config.navbarHeight;
            navbar.style.opacity = '0';
            document.body.prepend(navbar);
            this.dom.navbar = navbar;
            document.body.style.marginTop = this.config.navbarHeight;
            setTimeout(() => { this.dom.navbar.style.opacity = '1'; }, 10);
            
            // We need to attach listeners here because render might be called multiple times
            this._attachGlobalEventListeners();
        },

        // --- RENDERING ---
        render() {
            if (!this.dom.navbar) return;
            const navTabsHTML = this._generateNavTabsHTML();
            const accountControlsHTML = this._generateAccountControlsHTML();

            this.dom.navbar.innerHTML = `
                <div class="h-full flex items-center justify-between px-4 sm:px-8">
                    <div class="flex items-center">
                        <img src="${this.config.logoUrl}" alt="Logo" class="h-8 w-8 object-contain" loading="eager">
                    </div>
                    ${navTabsHTML}
                    ${accountControlsHTML}
                </div>`;
            
            this._cacheDynamicDOMElements();
            this._applyThemeToBody();
            if (this.state.isLoggedIn && this.config.navLinks.length > this.config.scrollThreshold) {
                this._setupScrollMechanics();
            }
            this._checkUserInfoOverflow();
        },

        _generateNavTabsHTML() {
            const loggedOutClass = this.state.isLoggedIn ? '' : 'logged-out';
            const linkHTML = this.config.navLinks.map(link =>
                `<a href="${link.href}" class="nav-link ${link.active ? 'active' : ''}">${link.text}</a>`
            ).join('');

            return `<div class="nav-tabs-container ${loggedOutClass}">
                <div class="nav-scroll-wrapper">
                    <button id="nav-arrow-left" class="nav-arrow">
                        <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>
                    <div id="nav-tabs-scroller" class="nav-tabs-scroller">
                        <div class="flex items-center space-x-2">${linkHTML}</div>
                    </div>
                    <button id="nav-arrow-right" class="nav-arrow">
                         <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                </div>
            </div>`;
        },
        
        _getProfileContent() {
            if (this.state.user?.photoURL) {
                return `<img src="${this.state.user.photoURL}" alt="Profile">`;
            }
            if (this.state.user?.displayName) {
                return this.state.user.displayName.charAt(0).toUpperCase();
            }
            return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
        },

        _generateAccountControlsHTML() {
            const profileContent = this._getProfileContent();
            
            let menuHeader, menuActions;

            if (this.state.isLoggedIn) {
                menuHeader = `
                    <div class="user-info">
                         <div class="user-info-text">
                            <span class="name">${this.state.user.displayName}</span>
                            <span class="email">${this.state.user.email}</span>
                        </div>
                    </div>
                `;
                menuActions = `
                    <button id="settings-btn" class="menu-button"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>Settings</button>
                    <button id="logout-btn" class="menu-button danger"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>Logout</button>
                `;
            } else {
                 menuHeader = `
                    <div class="user-info">
                        <span class="name">Welcome</span>
                        <span class="email">Please sign in to continue</span>
                    </div>
                `;
                 menuActions = `
                    <button id="login-btn" class="menu-button"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>Login</button>
                    <button id="signup-btn" class="menu-button"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="17" y1="11" x2="23" y2="11"></line></svg>Sign Up</button>
                `;
            }

            return `<div id="account-controls">
                <button id="account-button-toggle" class="profile-pic">${profileContent}</button>
                <div id="account-menu" class="account-menu menu-hidden">
                    <div class="account-menu-header">
                        ${menuHeader}
                        <div id="account-button-in-menu" class="profile-pic">${profileContent}</div>
                    </div>
                    <div class="menu-actions">${menuActions}</div>
                </div>
            </div>`;
        },

        // --- EVENT HANDLING & ACTIONS ---
        _attachGlobalEventListeners() {
            // Use event delegation on the document body to ensure listeners are always active
            document.body.addEventListener('click', (e) => {
                const target = e.target;
                if (target.closest('#account-button-toggle') || target.closest('#account-button-in-menu')) { this._toggleAccountMenu(e); }
                else if (target.closest('#logout-btn')) { this.firebase.auth.signOut(); } 
                else if (target.closest('#login-btn')) { console.log("Login clicked - Add your Firebase login logic here (e.g., signInWithPopup)"); }
                else if (target.closest('#signup-btn')) { console.log("Sign up clicked - Add your Firebase signup logic here"); }
                
                // Close menu if clicking outside
                const accountControls = document.getElementById('account-controls');
                if (this.dom.accountMenu && !this.dom.accountMenu.classList.contains('menu-hidden') && !accountControls.contains(target)) {
                    this._closeAccountMenu();
                }
            });

            document.addEventListener('keydown', (e) => {
                if (!this.dom.scroller || (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
                if (e.key === 'ArrowRight') { e.preventDefault(); this.dom.scroller.scrollBy({ left: this.config.keyboardScrollAmount, behavior: 'smooth' }); } 
                else if (e.key === 'ArrowLeft') { e.preventDefault(); this.dom.scroller.scrollBy({ left: -this.config.keyboardScrollAmount, behavior: 'smooth' });}
            });
        },

        _setupScrollMechanics() {
            if (!this.dom.scroller) return;
            // Use a flag to prevent multiple attachments
            if (this.dom.scroller.dataset.eventsAttached) return;
            this.dom.scroller.dataset.eventsAttached = 'true';

            this.dom.scroller.addEventListener('wheel', (e) => { e.preventDefault(); this.dom.scroller.scrollLeft += e.deltaX + e.deltaY; }, { passive: false });
            this.dom.rightArrow?.addEventListener('click', () => { this.dom.scroller.scrollTo({ left: this.dom.scroller.scrollWidth, behavior: 'smooth' }); });
            this.dom.leftArrow?.addEventListener('click', () => { this.dom.scroller.scrollTo({ left: 0, behavior: 'smooth' }); });
            this.dom.scroller.addEventListener('scroll', () => this._updateArrowVisibility());
            window.addEventListener('resize', () => this._updateArrowVisibility());
            setTimeout(() => this._updateArrowVisibility(), 150);
        },

        _cacheDynamicDOMElements() {
            this.dom.scroller = document.getElementById('nav-tabs-scroller');
            this.dom.leftArrow = document.getElementById('nav-arrow-left');
            this.dom.rightArrow = document.getElementById('nav-arrow-right');
            this.dom.accountMenu = document.getElementById('account-menu');
            this.dom.accountButton = document.getElementById('account-button-toggle');
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

        _applyThemeToBody() {
             document.body.className = this.state.currentTheme === 'light' ? 'light-mode' : 'dark-mode';
        },
        
        _checkUserInfoOverflow() {
            if (!this.state.isLoggedIn) return;
            const userInfoText = document.querySelector('.user-info-text');
            if (userInfoText && userInfoText.scrollWidth > userInfoText.clientWidth) {
                userInfoText.classList.add('marquee');
            }
        },

        _updateArrowVisibility() {
            if (!this.dom.scroller || !this.dom.leftArrow || !this.dom.rightArrow) return;
            const tolerance = 1;
            const maxScroll = this.dom.scroller.scrollWidth - this.dom.scroller.clientWidth;
            this.dom.rightArrow.classList.toggle('visible', this.dom.scroller.scrollLeft < maxScroll - tolerance);
            this.dom.leftArrow.classList.toggle('visible', this.dom.scroller.scrollLeft > tolerance);
        }
    };

    NavbarManager.init();
});

