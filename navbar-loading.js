/**
 * @file navbar-loading.js
 * @description Dynamically creates and manages the site's navigation bar, including a full Firebase authentication flow using Google Sign-In.
 */
document.addEventListener('DOMContentLoaded', () => {
    const NavbarManager = {
        config: {
            navbarHeight: '65px',
            logoUrl: 'https://raw.githubusercontent.com/4simpleproblems/Proj-Vanadium/main/images/logo.png'
        },
        state: { isLoggedIn: false, user: null, navLinks: [] },
        dom: {},
        firebase: {},

        async init() {
            await this._fetchNavLinks();
            this._injectCSS();
            this._createNavbarContainer();
            // Auth modals are no longer created, as Google Sign-In uses a popup.
            this._initializeFirebase();
        },

        async _fetchNavLinks() {
            try {
                const response = await fetch('./Pages.json');
                if (!response.ok) throw new Error('Failed to fetch navigation links');
                this.state.navLinks = (await response.json()).filter(p => p.showInNav);
            } catch (error) {
                console.error("Navbar Error:", error);
                this.state.navLinks = [{ name: "Home", path: "#" }];
            }
        },
        
        _initializeFirebase() {
             if (typeof firebase === 'undefined') {
                console.error("Firebase is not loaded. Ensure Firebase SDKs are included in your HTML.");
                this.render(); // Render in a logged-out state as a fallback.
                return;
            }
            try {
                 if (!firebase.apps.length) {
                    firebase.initializeApp(firebaseConfig);
                 }
                this.firebase.app = firebase.app();
                this.firebase.auth = firebase.auth();
                this.firebase.db = firebase.firestore();
                // Set up the Google Auth Provider
                this.firebase.provider = new firebase.auth.GoogleAuthProvider();

                this.firebase.auth.onAuthStateChanged(user => {
                    this.state.isLoggedIn = !!user;
                    this.state.user = user ? { uid: user.uid, email: user.email, displayName: user.displayName, photoURL: user.photoURL } : null;
                    this.render();
                });
            } catch (error) {
                console.error("Firebase init failed:", error);
                this.render();
            }
        },

        _injectCSS() {
            const css = `
                :root { --bg-primary-dark:#121212;--bg-secondary-dark:#1E1E1E;--text-primary-dark:#EAEAEA;--text-secondary-dark:#AAAAAA;--border-dark:#2A2A2A;--accent-dark:#FFFFFF; }
                #navbar { z-index: 50; position: fixed; top: 0; left: 0; right: 0; transition: all 0.3s ease; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); background-color: rgba(18,18,18,0.7); border-bottom: 1px solid var(--border-dark); }
                .nav-tabs-container { flex-grow:1; display:flex; justify-content:center; align-items:center; opacity:1; transition:opacity .3s ease; }
                .nav-tabs-container.logged-out { opacity:0; pointer-events:none; }
                .nav-scroll-wrapper { position:relative; display:flex; align-items:center; width:100%; max-width:1000px; }
                .nav-tabs-scroller { display:flex; overflow-x:hidden; scrollbar-width:none; -ms-overflow-style:none; scroll-behavior:smooth; width:100%; justify-content:center; }
                .nav-arrow { position:absolute; top:50%; transform:translateY(-50%); z-index:10; cursor:pointer; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; transition:all .2s ease; opacity:0; pointer-events:none; background-color:rgba(0,0,0,0.5); }
                .nav-arrow:hover { background-color:rgba(255,255,255,0.2); }
                .nav-arrow.visible { opacity:1; pointer-events:auto; }
                #nav-arrow-left { left:4px; } #nav-arrow-right { right:4px; }
                .nav-link { transition:all .2s ease; padding:10px 16px; border-radius:10px; white-space:nowrap; border-bottom:2px solid transparent; flex-shrink:0; color:var(--text-secondary-dark); text-decoration: none; }
                .nav-link:hover { color:var(--text-primary-dark); }
                .nav-link.active { color:var(--text-primary-dark) !important; position:relative; }
                .nav-link.active::after { content:''; position:absolute; left:16px; right:16px; bottom:0; height:2px; background-color:var(--accent-dark); }
                #account-controls { position:relative; }
                .account-menu { position:absolute; top: -8px; right: -8px; width:280px; background-color:rgba(30,30,30,0.7); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border:1px solid rgba(255,255,255,0.1); box-shadow:0 10px 20px rgba(0,0,0,0.25); transition:all .2s ease-out; transform-origin:top right; border-radius:12px; padding:8px; display:flex; flex-direction:column; gap:4px; }
                .menu-hidden { opacity:0; transform:scale(.95) translateY(-10px); pointer-events:none; }
                .menu-visible { opacity:1; transform:scale(1) translateY(0); pointer-events:auto; }
                .account-menu-header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid var(--border-dark); padding: 8px; }
                .user-info { overflow:hidden; white-space:nowrap; margin-right:12px; }
                .user-info .name { font-weight:bold; color:var(--text-primary-dark); display:block; font-size: 0.9rem; }
                .user-info .email { font-size:.75rem; color:var(--text-secondary-dark); display:block; }
                .profile-pic { width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; background-color:#4A5568; color:var(--text-primary-dark); font-weight:bold; font-size:1rem; cursor:pointer; transition:filter .2s ease; flex-shrink:0; }
                .profile-pic:hover { filter:brightness(1.2); }
                .profile-pic img { width:100%; height:100%; border-radius:50%; object-fit:cover; }
                .menu-button { width:100%; text-align:left; padding:8px 12px; border-radius:8px; background-color:transparent; color:var(--text-primary-dark); transition:background-color .2s ease; display:flex; align-items:center; gap:12px; border:none; font-size: 0.9rem;}
                .menu-button:hover { background-color:rgba(255,255,255,0.1); }
                .menu-button.danger:hover { background-color:rgba(239,68,68,0.2); color:#F87171; }
                .google-btn { background-color: #4285F4; color: white; }
                .google-btn:hover { background-color: #357ae8; }
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

        render() {
             if (!this.dom.navbar) return;
            const navTabsHTML = this._generateNavTabsHTML();
            const accountControlsHTML = this._generateAccountControlsHTML();
            this.dom.navbar.innerHTML = `<div class="h-full flex items-center justify-between px-4 sm:px-8 max-w-7xl mx-auto"><a href="#" class="flex items-center"><img src="${this.config.logoUrl}" alt="Logo" class="h-8 w-8 object-contain"></a>${navTabsHTML}${accountControlsHTML}</div>`;
            this._cacheDynamicDOMElements();
            this._attachEventListeners();
            this._updateArrowVisibility();
            this._checkUserInfoOverflow();
        },

        _generateNavTabsHTML() {
            const loggedOutClass = this.state.isLoggedIn ? '' : 'logged-out';
            const linkHTML = this.state.navLinks.map(link => `<a href="${link.path}" class="nav-link ${window.location.pathname.endsWith(link.path) || (window.location.pathname.endsWith('/') && link.id === 'dashboard') ? 'active' : ''}">${link.name}</a>`).join('');
            return `<div class="nav-tabs-container ${loggedOutClass}"><div class="nav-scroll-wrapper"><button id="nav-arrow-left" class="nav-arrow"><svg class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg></button><div id="nav-tabs-scroller" class="nav-tabs-scroller"><div class="flex items-center space-x-2">${linkHTML}</div></div><button id="nav-arrow-right" class="nav-arrow"><svg class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg></button></div></div>`;
        },
        
        _getProfileContent() {
            if (this.state.isLoggedIn && this.state.user.photoURL) return `<img src="${this.state.user.photoURL}" alt="Profile">`;
            if (this.state.isLoggedIn && this.state.user.displayName) return this.state.user.displayName.charAt(0).toUpperCase();
            return `<i class="fa-solid fa-user"></i>`;
        },
        
        _generateAccountControlsHTML() {
            const profileContent = this._getProfileContent();
            let menuHeader, menuActions;

            if (this.state.isLoggedIn && this.state.user) {
                menuHeader = `<div class="user-info"><div class="user-info-text"><span class="name">${this.state.user.displayName}</span><span class="email">${this.state.user.email}</span></div></div>`;
                menuActions = `<button id="settings-btn" class="menu-button"><i class="fa-solid fa-gear w-5 text-center"></i>Settings</button><button id="logout-btn" class="menu-button danger"><i class="fa-solid fa-right-from-bracket w-5 text-center"></i>Logout</button>`;
            } else {
                menuHeader = `<div class="user-info"><span class="name">Welcome</span><span class="email">Sign in to continue</span></div>`;
                menuActions = `<button id="google-signin-btn" class="menu-button google-btn"><i class="fa-brands fa-google w-5 text-center"></i>Sign In with Google</button>`;
            }

            return `<div id="account-controls"><button id="account-button-toggle" class="profile-pic">${profileContent}</button><div id="account-menu" class="account-menu menu-hidden"><div class="account-menu-header">${menuHeader}<div id="account-button-in-menu" class="profile-pic">${profileContent}</div></div><div class="flex flex-col gap-1">${menuActions}</div></div></div>`;
        },

        _cacheDynamicDOMElements() {
            this.dom.scroller = document.getElementById('nav-tabs-scroller');
            this.dom.leftArrow = document.getElementById('nav-arrow-left');
            this.dom.rightArrow = document.getElementById('nav-arrow-right');
            this.dom.accountMenu = document.getElementById('account-menu');
        },
        
        _attachEventListeners() {
            // Use a single, delegated event listener on the body to handle clicks
            document.body.addEventListener('click', (e) => {
                if (e.target.closest('#account-button-toggle') || e.target.closest('#account-button-in-menu')) {
                    this._toggleAccountMenu();
                } else if (e.target.closest('#logout-btn')) {
                    this.firebase.auth.signOut();
                } else if (e.target.closest('#google-signin-btn')) {
                    this._handleGoogleSignIn();
                } else if (this.dom.accountMenu && !this.dom.accountMenu.classList.contains('menu-hidden') && !e.target.closest('#account-controls')) {
                    this._closeAccountMenu();
                }
            });
            if(this.dom.scroller) this.dom.scroller.addEventListener('scroll', () => this._updateArrowVisibility());
            window.addEventListener('resize', () => this._updateArrowVisibility());
        },

        async _handleGoogleSignIn() {
            try {
                const result = await this.firebase.auth.signInWithPopup(this.firebase.provider);
                const isNewUser = firebase.auth.getAdditionalUserInfo(result).isNewUser;
                
                if (isNewUser) {
                    await this._createUserDocument(result.user);
                }
                this._closeAccountMenu();
            } catch (error) {
                console.error("Google Sign-In Error:", error);
                // You could show a user-facing error message here
            }
        },

        async _createUserDocument(user) {
            if (!this.firebase.db || !user) return;
            const userRef = this.firebase.db.collection('users').doc(user.uid);
            const userSnapshot = await userRef.get();
            // Check if document already exists to be safe
            if (!userSnapshot.exists) {
                await userRef.set({
                    uid: user.uid,
                    username: user.displayName,
                    email: user.email,
                    creationDate: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        },
        
        _toggleAccountMenu() { this.dom.accountMenu?.classList.toggle('menu-hidden'); this.dom.accountMenu?.classList.toggle('menu-visible'); },
        _closeAccountMenu() { this.dom.accountMenu?.classList.add('menu-hidden'); this.dom.accountMenu?.classList.remove('menu-visible'); },
        
        _checkUserInfoOverflow() {
            if (!this.state.isLoggedIn) return;
            const userInfoText = document.querySelector('.user-info-text');
            if (userInfoText && userInfoText.scrollWidth > userInfoText.clientWidth) {
                userInfoText.classList.add('marquee');
            }
        },
        _updateArrowVisibility() {
            if (!this.dom.scroller) return;
            const { scrollLeft, scrollWidth, clientWidth } = this.dom.scroller;
            this.dom.leftArrow.classList.toggle('visible', scrollLeft > 1);
            this.dom.rightArrow.classList.toggle('visible', scrollLeft < scrollWidth - clientWidth - 1);
        },
    };

    NavbarManager.init();
});

