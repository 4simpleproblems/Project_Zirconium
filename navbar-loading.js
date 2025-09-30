/**
 * @file navbar-loading.js
 * @description A completely redesigned, robust module to dynamically create and manage the site's navigation bar.
 * It features a modern UI, a reliable "Sign in with Google" flow via Firebase, and comprehensive error handling.
 */
document.addEventListener('DOMContentLoaded', () => {
    const NavbarManager = {
        // --- CONFIGURATION & STATE ---
        config: {
            navbarHeight: '65px',
            logoUrl: 'https://raw.githubusercontent.com/4simpleproblems/Proj-Vanadium/main/images/logo.png'
        },
        state: {
            isLoggedIn: false,
            user: null,
            navLinks: [],
            isMenuOpen: false
        },
        dom: {
            navbar: null,
            scroller: null,
            leftArrow: null,
            rightArrow: null,
            accountMenu: null,
            accountControls: null,
            accountButton: null
        },
        firebase: {},

        // --- INITIALIZATION ---
        async init() {
            this._injectCSS();
            this._createNavbarContainer();
            await this._fetchNavLinks();
            this._initializeFirebase();
        },
        
        _initializeFirebase() {
            // Check for presence of Firebase SDK and config object.
            if (typeof firebase === 'undefined' || typeof firebaseConfig === 'undefined') {
                console.error("CRITICAL: Firebase SDK or firebase-config.js is not loaded. Ensure they are included in your HTML before this script.");
                this.render(); // Render a fallback UI.
                return;
            }
            // Check if the user has replaced the placeholder API key.
            if (firebaseConfig.apiKey.includes('YOUR_API_KEY') || firebaseConfig.apiKey === "AIzaSy...Example") {
                console.error("CRITICAL: Your Firebase API key is a placeholder. Please update ../firebase-config.js with your actual project credentials.");
                this.render(); // Render a fallback UI.
                return;
            }

            try {
                // Initialize Firebase only once.
                if (!firebase.apps.length) {
                    firebase.initializeApp(firebaseConfig);
                }
                this.firebase.app = firebase.app();
                this.firebase.auth = firebase.auth();
                this.firebase.db = firebase.firestore();
                this.firebase.provider = new firebase.auth.GoogleAuthProvider();

                // Central listener for authentication state changes.
                this.firebase.auth.onAuthStateChanged(user => {
                    this.state.isLoggedIn = !!user;
                    this.state.user = user ? { uid: user.uid, email: user.email, displayName: user.displayName, photoURL: user.photoURL } : null;
                    this.render(); // Re-render the navbar whenever auth state changes.
                });

            } catch (error) {
                console.error("Firebase initialization failed:", error);
                this.render(); // Render a fallback UI in case of other errors.
            }
        },

        async _fetchNavLinks() {
            try {
                const response = await fetch('./Pages.json');
                if (!response.ok) throw new Error('Network response failed for Pages.json');
                const pages = await response.json();
                this.state.navLinks = pages.filter(p => p.showInNav);
            } catch (error) {
                console.error("Navbar Link Error:", error);
                // Provide a default link if the fetch fails so the navbar isn't empty.
                this.state.navLinks = [{ name: "Dashboard", path: "./dashboard.html", id: "dashboard" }];
            }
        },
        
        // --- DOM & STYLING ---
        _injectCSS() {
            const css = `
                @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');
                :root { 
                    --nav-bg: rgba(18,18,18,0.7); 
                    --nav-border: #2A2A2A; 
                    --text-primary: #EAEAEA; 
                    --text-secondary: #AAAAAA; 
                    --accent: #FFFFFF; 
                    --font-primary: 'Inter', sans-serif;
                    --font-special: 'Poppins', sans-serif;
                }
                body { font-family: var(--font-primary); }
                #navbar { z-index: 1000; position: fixed; top: 0; left: 0; right: 0; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); background-color: var(--nav-bg); border-bottom: 1px solid var(--nav-border); transition: top 0.3s ease-in-out; }
                .nav-tabs-container { flex-grow: 1; display: flex; justify-content: center; align-items: center; min-width: 0; opacity: 0; transition: opacity .4s ease; }
                .nav-tabs-container.visible { opacity: 1; }
                .nav-scroll-wrapper { position: relative; display: flex; align-items: center; width: 100%; max-width: 1000px; }
                .nav-tabs-scroller { display: flex; overflow-x: hidden; scrollbar-width: none; -ms-overflow-style: none; scroll-behavior: smooth; width: 100%; justify-content: center; }
                .nav-tabs-scroller::-webkit-scrollbar { display: none; }
                .nav-arrow { position: absolute; top: 50%; transform: translateY(-50%); z-index: 10; cursor: pointer; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all .2s ease; opacity: 0; pointer-events: none; background-color: rgba(40,40,40,0.8); }
                .nav-arrow:hover { background-color: rgba(60,60,60,0.9); }
                .nav-arrow.visible { opacity: 1; pointer-events: auto; }
                #nav-arrow-left { left: 8px; } #nav-arrow-right { right: 8px; }
                .nav-link { font-size: 0.95rem; text-decoration: none; transition: all .2s ease; padding: 10px 16px; border-radius: 8px; white-space: nowrap; color: var(--text-secondary); }
                .nav-link:hover { color: var(--text-primary); background-color: #2a2a2a; }
                .nav-link.active { color: var(--text-primary); font-weight: 500; }
                
                #account-controls.menu-active .account-menu {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                    pointer-events: auto;
                }
                #account-controls.menu-active #account-button {
                    position: absolute;
                    top: 16px;
                    right: 16px;
                    border-color: #3B82F6;
                    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3);
                }

                .account-menu { 
                    position: absolute; 
                    top: calc(100% - 20px); 
                    right: -10px; 
                    width: 320px; 
                    background-color: rgba(30,30,30,0.8); 
                    backdrop-filter: blur(24px); 
                    -webkit-backdrop-filter: blur(24px); 
                    border: 1px solid rgba(255,255,255,0.1); 
                    box-shadow: 0 10px 40px rgba(0,0,0,0.4); 
                    transition: all .3s cubic-bezier(0.4, 0, 0.2, 1); 
                    transform-origin: top right; 
                    border-radius: 16px; 
                    padding-top: 64px;
                    opacity: 0; 
                    transform: scale(.90) translateY(-20px); 
                    pointer-events: none;
                }
                .account-menu-header { padding: 8px 16px 16px; border-bottom: 1px solid var(--nav-border); text-align: center; }
                .user-info .name { font-family: var(--font-special); font-weight: 600; color: var(--text-primary); display: block; font-size: 1.25rem; }
                .user-info .email { font-size: .9rem; color: var(--text-secondary); display: block; text-overflow: ellipsis; overflow: hidden; }
                
                .profile-pic { 
                    width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background-color: #4A5568; 
                    color: var(--text-primary); font-weight: bold; cursor: pointer; transition: all .3s ease; flex-shrink: 0; border: 2px solid transparent; 
                    position: relative; z-index: 10;
                }
                .profile-pic:hover { filter: brightness(1.2); }
                .profile-pic img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
                
                .menu-button { width: 100%; text-align: left; padding: 12px 16px; border-radius: 8px; background-color: transparent; color: var(--text-secondary); transition: background-color .2s ease, color .2s ease; display: flex; align-items: center; gap: 14px; border: none; font-size: 1rem; }
                .menu-button:hover { background-color: rgba(255,255,255,0.08); color: var(--text-primary); }
                .menu-button.danger:hover { background-color: rgba(239,68,68,0.15); color: #F87171; }
                .menu-button i { width: 22px; text-align: center; }
                .google-btn { background-color: #4285F4; color: white !important; font-weight: 500; font-family: var(--font-special); }
                .google-btn:hover { background-color: #5a95f5; }
            `;
            const style = document.createElement('style');
            style.textContent = css;
            document.head.appendChild(style);
        },

        _createNavbarContainer() {
            const navbar = document.createElement('nav');
            navbar.id = 'navbar';
            navbar.style.height = this.config.navbarHeight;
            document.body.prepend(navbar);
            this.dom.navbar = navbar;
            document.body.style.paddingTop = this.config.navbarHeight; // Prevent content from hiding behind the fixed navbar.
        },

        // --- RENDERING ---
        render() {
            if (!this.dom.navbar) return;
            const navTabsHTML = this._generateNavTabsHTML();
            const accountControlsHTML = this._generateAccountControlsHTML();
            this.dom.navbar.innerHTML = `
                <div class="h-full flex items-center justify-between px-4 sm:px-6 max-w-screen-2xl mx-auto">
                    <a href="./dashboard.html" class="flex items-center gap-3">
                        <img src="${this.config.logoUrl}" alt="Logo" class="h-8 w-8 object-contain">
                        <span class="font-bold text-xl hidden sm:inline" style="font-family: var(--font-special);">4SP</span>
                    </a>
                    ${navTabsHTML}
                    ${accountControlsHTML}
                </div>
            `;
            this._cacheDynamicDOMElements();
            this._attachEventListeners();
            this._updateArrowVisibility();
        },

        _generateNavTabsHTML() {
            const visibleClass = this.state.isLoggedIn ? 'visible' : '';
            const linkHTML = this.state.navLinks.map(link => `<a href="${link.path}" class="nav-link ${window.location.pathname.endsWith(link.path) ? 'active' : ''}">${link.name}</a>`).join('');
            return `<div class="nav-tabs-container ${visibleClass}"><div class="nav-scroll-wrapper"><button id="nav-arrow-left" class="nav-arrow"><i class="fa-solid fa-chevron-left text-white"></i></button><div id="nav-tabs-scroller" class="nav-tabs-scroller"><div class="flex items-center space-x-1">${linkHTML}</div></div><button id="nav-arrow-right" class="nav-arrow"><i class="fa-solid fa-chevron-right text-white"></i></button></div></div>`;
        },

        _generateAccountControlsHTML() {
            const user = this.state.user;
            const profilePicContent = user?.photoURL ? `<img src="${user.photoURL}" alt="Profile">` : (user?.displayName ? user.displayName.charAt(0).toUpperCase() : `<i class="fa-solid fa-user"></i>`);
            const menuContainerState = this.state.isMenuOpen ? 'menu-active' : '';

            let menuContent;

            if (this.state.isLoggedIn && user) {
                menuContent = `
                    <div class="account-menu-header">
                        <div class="user-info">
                            <span class="name">${user.displayName}</span>
                            <span class="email">${user.email}</span>
                        </div>
                    </div>
                    <div class="flex flex-col gap-1 p-2">
                        <a href="./dashboard.html" class="menu-button"><i class="fa-solid fa-table-columns"></i>Dashboard</a>
                        <button id="settings-btn" class="menu-button"><i class="fa-solid fa-gear"></i>Settings</button>
                        <button id="logout-btn" class="menu-button danger"><i class="fa-solid fa-right-from-bracket"></i>Logout</button>
                    </div>
                `;
            } else {
                menuContent = `
                    <div class="p-4 text-center">
                        <p class="font-semibold text-xl" style="font-family: var(--font-special);">Welcome</p>
                        <p class="text-md text-gray-400 mt-1">Sign in to continue</p>
                    </div>
                    <div class="p-2">
                        <button id="google-signin-btn" class="menu-button google-btn"><i class="fa-brands fa-google"></i>Sign In with Google</button>
                    </div>
                `;
            }

            return `
                <div id="account-controls" class="relative ${menuContainerState}">
                    <button id="account-button" class="profile-pic">${profilePicContent}</button>
                    <div id="account-menu" class="account-menu">
                        ${menuContent}
                    </div>
                </div>`;
        },
        
        // --- EVENT HANDLING & ACTIONS ---
        _cacheDynamicDOMElements() {
            this.dom.scroller = document.getElementById('nav-tabs-scroller');
            this.dom.leftArrow = document.getElementById('nav-arrow-left');
            this.dom.rightArrow = document.getElementById('nav-arrow-right');
            this.dom.accountControls = document.getElementById('account-controls');
            this.dom.accountMenu = document.getElementById('account-menu');
            this.dom.accountButton = document.getElementById('account-button');
        },

        _attachEventListeners() {
            // A single, delegated event listener is more efficient.
            document.body.addEventListener('click', this._handleGlobalClick.bind(this));
            if (this.dom.scroller) {
                this.dom.scroller.addEventListener('scroll', this._updateArrowVisibility.bind(this));
            }
            window.addEventListener('resize', this._updateArrowVisibility.bind(this));
        },
        
        _handleGlobalClick(e) {
            const target = e.target;
            // Toggle menu
            if (target.closest('#account-button')) {
                this.state.isMenuOpen = !this.state.isMenuOpen;
                this.dom.accountControls.classList.toggle('menu-active', this.state.isMenuOpen);
            } 
            // Handle actions inside the menu
            else if (target.closest('#logout-btn')) {
                this.firebase.auth.signOut();
                this.state.isMenuOpen = false;
            } else if (target.closest('#google-signin-btn')) {
                this._handleGoogleSignIn();
            } 
            // Handle nav arrows
            else if (target.closest('#nav-arrow-left')) {
                this.dom.scroller.scrollBy({ left: -250, behavior: 'smooth' });
            } else if (target.closest('#nav-arrow-right')) {
                this.dom.scroller.scrollBy({ left: 250, behavior: 'smooth' });
            } 
            // Close menu if clicking outside
            else if (this.state.isMenuOpen && !target.closest('#account-menu')) {
                this.state.isMenuOpen = false;
                this.dom.accountControls.classList.remove('menu-active');
            }
        },

        async _handleGoogleSignIn() {
            if (!this.firebase.auth || !this.firebase.provider) {
                console.error("Cannot sign in: Firebase is not correctly initialized.");
                return;
            }
            try {
                const result = await this.firebase.auth.signInWithPopup(this.firebase.provider);
                if (result.additionalUserInfo.isNewUser) {
                    await this._createUserDocument(result.user);
                }
                this.state.isMenuOpen = false; // This will trigger a re-render which hides the menu.
            } catch (error) {
                console.error("Google Sign-In Failed:", error.message);
            }
        },

        async _createUserDocument(user) {
            if (!this.firebase.db || !user) return;
            const userRef = this.firebase.db.collection('users').doc(user.uid);
            try {
                await userRef.set({
                    uid: user.uid,
                    username: user.displayName,
                    email: user.email,
                    photoURL: user.photoURL,
                    creationDate: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true }); // Use merge to avoid overwriting existing data if run accidentally
            } catch (error) {
                console.error("Failed to create user document in Firestore:", error);
            }
        },

        _updateArrowVisibility() {
            if (!this.dom.scroller) return;
            const { scrollLeft, scrollWidth, clientWidth } = this.dom.scroller;
            const tolerance = 5;
            this.dom.leftArrow.classList.toggle('visible', scrollLeft > tolerance);
            this.dom.rightArrow.classList.toggle('visible', scrollLeft < scrollWidth - clientWidth - tolerance);
        }
    };

    NavbarManager.init();
});

