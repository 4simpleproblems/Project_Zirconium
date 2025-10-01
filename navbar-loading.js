/**
 * @file navbar-loading.js
 * @description A completely re-architected, performance-focused module for the site's navigation bar.
 * This version uses targeted DOM updates instead of full re-renders for a faster, smoother experience.
 * It includes a "hide on scroll" feature, robust JSON-driven configuration, and enhanced scrolling features.
 */
document.addEventListener('DOMContentLoaded', () => {
    const NavbarManager = {
        // --- CONFIGURATION & STATE ---
        config: {
            navbarHeight: '65px',
            scrollThreshold: 10, // Pixels to scroll before hiding nav
        },
        state: {
            isLoggedIn: false,
            user: null,
            navLinks: [],
            siteConfig: {},
            isMenuOpen: false,
            lastScrollTop: 0,
        },
        dom: {}, // Cached DOM elements will be stored here
        firebase: {},

        // --- INITIALIZATION ---
        async init() {
            this._injectCSS();
            this._createNavbarContainer();
            await this._fetchSiteData();
            this._initializeFirebase();
        },

        _initializeFirebase() {
            if (typeof firebase === 'undefined' || typeof firebaseConfig === 'undefined' || firebaseConfig.apiKey.includes('YOUR_API_KEY')) {
                console.error("CRITICAL: Firebase is not configured correctly. Please check firebase-config.js and ensure the Firebase SDK is loaded.");
                this._renderInitialDOM(); // Render a fallback UI
                return;
            }

            try {
                if (!firebase.apps.length) {
                    firebase.initializeApp(firebaseConfig);
                }
                this.firebase = {
                    app: firebase.app(),
                    auth: firebase.auth(),
                    db: firebase.firestore(),
                    provider: new firebase.auth.GoogleAuthProvider(),
                };

                this.firebase.auth.onAuthStateChanged(user => {
                    const wasLoggedIn = this.state.isLoggedIn;
                    this.state.isLoggedIn = !!user;
                    this.state.user = user ? { uid: user.uid, email: user.email, displayName: user.displayName, photoURL: user.photoURL } : null;
                    
                    if (this.dom.navbar.innerHTML === '') {
                         this._renderInitialDOM();
                    } else {
                        if (wasLoggedIn !== this.state.isLoggedIn) {
                            this._updateUIForAuthStateChange();
                        }
                    }
                });
            } catch (error) {
                console.error("Firebase initialization failed:", error);
                this._renderInitialDOM();
            }
        },

        async _fetchSiteData() {
            try {
                const response = await fetch('./Pages.json');
                if (!response.ok) throw new Error('Network response failed for Pages.json');
                const data = await response.json();
                this.state.navLinks = data.filter(p => p.showInNav);
                this.state.siteConfig = data.config || {}; 
            } catch (error) {
                console.error("Navbar Site Data Error:", error);
                this.state.siteConfig = { logoUrl: 'https://raw.githubusercontent.com/4simpleproblems/Proj-Vanadium/main/images/logo.png', siteName: '4SP' };
                this.state.navLinks = [{ name: "Dashboard", path: "./dashboard.html", id: "dashboard" }];
            }
        },

        // --- DOM & STYLING ---
        _injectCSS() {
            const css = `
                @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');
                :root { 
                    --nav-bg: rgba(18,18,18,0.7); --nav-border: #2A2A2A; --text-primary: #EAEAEA; 
                    --text-secondary: #AAAAAA; --font-primary: 'Inter', sans-serif; --font-special: 'Poppins', sans-serif;
                }
                body { font-family: var(--font-primary); }
                #navbar { z-index: 1000; position: fixed; top: 0; left: 0; right: 0; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); background-color: var(--nav-bg); border-bottom: 1px solid var(--nav-border); transition: top 0.3s ease-in-out; }
                #navbar.nav-hidden { top: -${this.config.navbarHeight}; }
                .nav-tabs-container { flex-grow: 1; display: flex; justify-content: center; align-items: center; min-width: 0; opacity: 0; transition: opacity .4s ease; pointer-events: none; }
                .nav-tabs-container.visible { opacity: 1; pointer-events: auto; }
                .nav-scroll-wrapper { 
                    position: relative; 
                    display: flex; 
                    align-items: center; 
                    width: 100%; 
                    max-width: 1000px; 
                    /* **NEW**: Added CSS mask to create the fading effect on the sides */
                    -webkit-mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent);
                    mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent);
                }
                .nav-tabs-scroller { display: flex; overflow-x: hidden; scrollbar-width: none; -ms-overflow-style: none; scroll-behavior: smooth; width: 100%; justify-content: center; }
                .nav-tabs-scroller::-webkit-scrollbar { display: none; }
                .nav-arrow { position: absolute; top: 50%; transform: translateY(-50%); z-index: 10; cursor: pointer; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all .2s ease; opacity: 0; pointer-events: none; background-color: rgba(40,40,40,0.8); }
                .nav-arrow:hover { background-color: rgba(60,60,60,0.9); }
                .nav-arrow.visible { opacity: 1; pointer-events: auto; }
                #nav-arrow-left { left: 8px; } #nav-arrow-right { right: 8px; }
                .nav-link { font-size: 0.95rem; text-decoration: none; transition: all .2s ease; padding: 10px 16px; border-radius: 8px; white-space: nowrap; color: var(--text-secondary); }
                .nav-link:hover { color: var(--text-primary); background-color: #2a2a2a; }
                .nav-link.active { color: var(--text-primary); font-weight: 500; }
                
                #account-controls.menu-active .account-menu { opacity: 1; transform: scale(1) translateY(0); pointer-events: auto; }
                #account-controls.menu-active #account-button { border-color: #3B82F6; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3); }
                .account-menu { position: absolute; top: calc(100% + 12px); right: 0; width: 300px; background-color: rgba(30,30,30,0.8); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 10px 40px rgba(0,0,0,0.4); transition: all .3s cubic-bezier(0.4, 0, 0.2, 1); transform-origin: top right; border-radius: 12px; padding: 8px; opacity: 0; transform: scale(.95) translateY(-10px); pointer-events: none; }
                .profile-pic { width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background-color: #4A5568; color: var(--text-primary); font-weight: bold; cursor: pointer; transition: all .3s ease; flex-shrink: 0; border: 2px solid transparent; position: relative; z-index: 10; }
                .profile-pic:hover { filter: brightness(1.2); }
                .profile-pic img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
                .menu-button { width: 100%; text-align: left; padding: 12px 16px; border-radius: 8px; background-color: transparent; color: var(--text-secondary); transition: background-color .2s ease, color .2s ease; display: flex; align-items: center; gap: 14px; border: none; font-size: 1rem; }
                .menu-button:hover { background-color: rgba(255,255,255,0.08); color: var(--text-primary); }
                .menu-button.danger:hover { background-color: rgba(239,68,68,0.15); color: #F87171; }
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
            document.body.style.paddingTop = this.config.navbarHeight;
        },

        // --- RENDERING & UI UPDATES ---
        _renderInitialDOM() {
            const logoUrl = this.state.siteConfig.logoUrl || '';
            const siteName = this.state.siteConfig.siteName || 'App';
            const navTabsHTML = this._generateNavTabsHTML();
            const accountControlsHTML = this._generateAccountControlsHTML();

            this.dom.navbar.innerHTML = `
                <div class="h-full flex items-center justify-between px-4 sm:px-6 max-w-screen-2xl mx-auto">
                    <a href="./dashboard.html" class="flex items-center gap-3">
                        <img src="${logoUrl}" alt="Logo" class="h-8 w-8 object-contain">
                        <span class="font-bold text-xl hidden sm:inline" style="font-family: var(--font-special);">${siteName}</span>
                    </a>
                    ${navTabsHTML}
                    ${accountControlsHTML}
                </div>
            `;
            this._cacheDOMElements();
            this._attachEventListeners();
            this._updateArrowVisibility();
        },
        
        _updateUIForAuthStateChange() {
            this.dom.accountMenu.innerHTML = this._generateMenuContent();
            this.dom.accountButton.innerHTML = this._generateProfilePicContent();
            this.dom.navTabsContainer.classList.toggle('visible', this.state.isLoggedIn);
        },

        _generateNavTabsHTML() {
            const visibleClass = this.state.isLoggedIn ? 'visible' : '';
            const linkHTML = this.state.navLinks.map(link => `<a href="${link.path}" class="nav-link ${window.location.pathname.endsWith(link.path) ? 'active' : ''}">${link.name}</a>`).join('');
            return `<div id="nav-tabs-container" class="nav-tabs-container ${visibleClass}"><div class="nav-scroll-wrapper"><button id="nav-arrow-left" class="nav-arrow"><i class="fa-solid fa-chevron-left text-white"></i></button><div id="nav-tabs-scroller" class="nav-tabs-scroller"><div class="flex items-center space-x-1">${linkHTML}</div></div><button id="nav-arrow-right" class="nav-arrow"><i class="fa-solid fa-chevron-right text-white"></i></button></div></div>`;
        },

        _generateAccountControlsHTML() {
            const profilePicContent = this._generateProfilePicContent();
            const menuContent = this._generateMenuContent();
            return `<div id="account-controls" class="relative"><button id="account-button" class="profile-pic">${profilePicContent}</button><div id="account-menu" class="account-menu">${menuContent}</div></div>`;
        },
        
        _generateProfilePicContent() {
            const user = this.state.user;
            return user?.photoURL ? `<img src="${user.photoURL}" alt="Profile">` : (user?.displayName ? user.displayName.charAt(0).toUpperCase() : `<i class="fa-solid fa-user"></i>`);
        },
        
        _generateMenuContent() {
            const user = this.state.user;
            if (this.state.isLoggedIn && user) {
                return `<div class="account-menu-header" style="text-align: center; padding: 8px 16px 16px; border-bottom: 1px solid var(--nav-border);"><div class="user-info"><span style="font-family: var(--font-special); font-weight: 600; color: var(--text-primary); display: block; font-size: 1.25rem;">${user.displayName}</span><span style="font-size: .9rem; color: var(--text-secondary); display: block; text-overflow: ellipsis; overflow: hidden;">${user.email}</span></div></div><div class="flex flex-col gap-1 p-2"><button id="settings-btn" class="menu-button"><i class="fa-solid fa-gear" style="width: 22px; text-align: center;"></i>Settings</button><button id="logout-btn" class="menu-button danger"><i class="fa-solid fa-right-from-bracket" style="width: 22px; text-align: center;"></i>Logout</button></div>`;
            } else {
                return `<div class="p-4 text-center"><p class="font-semibold text-xl" style="font-family: var(--font-special);">Welcome</p><p class="text-md text-gray-400 mt-1">Sign in to continue</p></div><div class="p-2"><button id="google-signin-btn" class="menu-button" style="background-color: #4285F4; color: white !important; font-weight: 500; font-family: var(--font-special);"><i class="fa-brands fa-google" style="width: 22px; text-align: center;"></i>Sign In with Google</button></div>`;
            }
        },

        // --- EVENT HANDLING & ACTIONS ---
        _cacheDOMElements() {
            this.dom = {
                ...this.dom,
                navTabsContainer: document.getElementById('nav-tabs-container'),
                scroller: document.getElementById('nav-tabs-scroller'),
                leftArrow: document.getElementById('nav-arrow-left'),
                rightArrow: document.getElementById('nav-arrow-right'),
                accountControls: document.getElementById('account-controls'),
                accountMenu: document.getElementById('account-menu'),
                accountButton: document.getElementById('account-button'),
            };
        },

        _attachEventListeners() {
            document.body.addEventListener('click', this._handleGlobalClick.bind(this));
            window.addEventListener('scroll', this._handleScroll.bind(this));
            if (this.dom.scroller) {
                this.dom.scroller.addEventListener('scroll', this._updateArrowVisibility.bind(this));
                window.addEventListener('resize', this._updateArrowVisibility.bind(this));
                // **NEW**: Added wheel event listener for touchpad/mouse wheel horizontal scrolling
                this.dom.scroller.addEventListener('wheel', this._handleWheelScroll.bind(this), { passive: false });
            }
        },
        
        // **NEW**: Added this handler for the wheel event
        _handleWheelScroll(e) {
            // This prevents the default vertical page scroll when scrolling over the nav tabs
            e.preventDefault();
            // This takes the vertical scroll amount (deltaY) and applies it to the horizontal scroll position
            this.dom.scroller.scrollLeft += e.deltaY;
        },

        _handleGlobalClick(e) {
            const target = e.target;
            if (target.closest('#account-button')) {
                this.state.isMenuOpen = !this.state.isMenuOpen;
                this.dom.accountControls.classList.toggle('menu-active', this.state.isMenuOpen);
            } else if (target.closest('#logout-btn')) {
                this.firebase.auth.signOut();
                this.state.isMenuOpen = false;
            } else if (target.closest('#google-signin-btn')) {
                this._handleGoogleSignIn();
            } else if (target.closest('#nav-arrow-left')) {
                this.dom.scroller.scrollBy({ left: -250, behavior: 'smooth' });
            } else if (target.closest('#nav-arrow-right')) {
                this.dom.scroller.scrollBy({ left: 250, behavior: 'smooth' });
            } else if (this.state.isMenuOpen && !target.closest('#account-controls')) {
                this.state.isMenuOpen = false;
                this.dom.accountControls.classList.remove('menu-active');
            }
        },
        
        _handleScroll() {
            const st = window.pageYOffset || document.documentElement.scrollTop;
            if (Math.abs(st - this.state.lastScrollTop) <= this.config.scrollThreshold) return;
            if (st > this.state.lastScrollTop && st > this.dom.navbar.offsetHeight){
                this.dom.navbar.classList.add('nav-hidden');
            } else {
                this.dom.navbar.classList.remove('nav-hidden');
            }
            this.state.lastScrollTop = st <= 0 ? 0 : st;
        },

        async _handleGoogleSignIn() {
            try {
                const result = await this.firebase.auth.signInWithPopup(this.firebase.provider);
                if (result.additionalUserInfo.isNewUser) {
                    await this._createUserDocument(result.user);
                }
                this.state.isMenuOpen = false;
                this.dom.accountControls.classList.remove('menu-active');
            } catch (error) {
                console.error("Google Sign-In Failed:", error.message);
            }
        },

        async _createUserDocument(user) {
            try {
                const userRef = this.firebase.db.collection('users').doc(user.uid);
                await userRef.set({
                    uid: user.uid, username: user.displayName, email: user.email,
                    photoURL: user.photoURL, creationDate: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
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
