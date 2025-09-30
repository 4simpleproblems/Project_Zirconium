/**
 * @file navbar-loading.js
 * @description Dynamically creates and manages the site's navigation bar using data from Pages.json.
 * This script is now fully compatible and does not require ES modules.
 * It relies on Firebase SDK and a global firebaseConfig object being loaded first.
 */
document.addEventListener('DOMContentLoaded', () => {
    const NavbarManager = {
        config: {
            navbarHeight: '65px',
            logoUrl: 'https://raw.githubusercontent.com/4simpleproblems/4simpleproblems.github.io/main/images/logo.png'
        },
        state: {
            isLoggedIn: false,
            user: null,
            navLinks: []
        },
        dom: {},
        firebase: {},

        async init() {
            await this._fetchNavLinks();
            this._injectCSS();
            this._createNavbarContainer();
            this._initializeFirebase();
        },

        async _fetchNavLinks() {
            try {
                const response = await fetch('./Pages.json');
                if (!response.ok) throw new Error('Failed to fetch navigation links');
                const pages = await response.json();
                this.state.navLinks = pages.filter(p => p.showInNav);
            } catch (error) {
                console.error("Navbar Error:", error);
                // Fallback links if JSON fails to load
                this.state.navLinks = [{ name: "Home", path: "#", active: true }];
            }
        },
        
        _initializeFirebase() {
            if (typeof firebase === 'undefined' || typeof firebaseConfig === 'undefined') {
                console.error("Firebase SDK or config is missing.");
                this.render(); // Render logged-out state
                return;
            }
            try {
                this.firebase.app = firebase.initializeApp(firebaseConfig);
                this.firebase.auth = firebase.auth();
                this.firebase.auth.onAuthStateChanged(user => {
                    this.state.isLoggedIn = !!user;
                    this.state.user = user ? {
                        email: user.email,
                        displayName: user.displayName || 'User',
                        photoURL: user.photoURL
                    } : null;
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
                body { background-color: var(--bg-primary-dark); color: var(--text-primary-dark); font-family: sans-serif; }
                #navbar { transition: all 0.3s ease; backdrop-filter: blur(12px) saturate(150%); -webkit-backdrop-filter: blur(12px) saturate(150%); background-color: rgba(18,18,18,0.75); border-bottom: 1px solid var(--border-dark); }
                .nav-tabs-container { flex-grow:1; display:flex; justify-content:center; align-items:center; width:100%; min-width:0; opacity:1; transition:opacity .3s ease; }
                .nav-tabs-container.logged-out { opacity:0; pointer-events:none; }
                .nav-scroll-wrapper { position:relative; display:flex; align-items:center; width:100%; max-width:1000px; }
                .nav-tabs-scroller { display:flex; overflow-x:hidden; scrollbar-width:none; -ms-overflow-style:none; scroll-behavior:smooth; width:100%; justify-content:center; }
                .nav-tabs-scroller::-webkit-scrollbar { display:none; }
                .nav-arrow { position:absolute; top:50%; transform:translateY(-50%); z-index:10; cursor:pointer; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; transition:all .2s ease; opacity:0; pointer-events:none; background-color:#000; }
                .nav-arrow svg { stroke:#FFF; transition:stroke .2s ease; }
                .nav-arrow:hover { background-color:#FFF; }
                .nav-arrow:hover svg { stroke:#000; }
                .nav-arrow.visible { opacity:1; pointer-events:auto; }
                #nav-arrow-left { left:4px; } #nav-arrow-right { right:4px; }
                .nav-link { transition:all .2s ease; padding:10px 16px; border-radius:10px; white-space:nowrap; border-bottom:2px solid transparent; flex-shrink:0; color:var(--text-secondary-dark); text-decoration: none; }
                .nav-link:hover { color:var(--text-primary-dark); }
                .nav-link.active { color:var(--text-primary-dark) !important; position:relative; }
                .nav-link.active::after { content:''; position:absolute; left:16px; right:16px; bottom:0; height:2px; background-color:var(--accent-dark); }
                #account-controls { position:relative; }
                .account-menu { position:absolute; top:-16px; right:-16px; width:300px; background-color:#222; border:1px solid var(--border-dark); box-shadow:0 10px 20px rgba(0,0,0,0.25); transition:all .2s ease-out; transform-origin:top right; border-radius:12px; padding:16px; display:flex; flex-direction:column; gap:16px; }
                .menu-hidden { opacity:0; transform:scale(.95) translateY(-10px); pointer-events:none; }
                .menu-visible { opacity:1; transform:scale(1) translateY(0); pointer-events:auto; }
                .account-menu-header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid var(--border-dark); padding-bottom:12px; }
                .user-info { overflow:hidden; white-space:nowrap; margin-right:16px; }
                .user-info-text { display:inline-block; }
                .user-info-text.marquee { animation:marquee 10s linear infinite; }
                @keyframes marquee{ 0%,20%{transform:translateX(0)} 100%{transform:translateX(calc(-100% + 150px))} }
                .user-info .name { font-weight:bold; color:var(--text-primary-dark); display:block; }
                .user-info .email { font-size:.8rem; color:var(--text-secondary-dark); display:block; }
                .profile-pic { width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; background-color:#4A5568; color:var(--text-primary-dark); font-weight:bold; font-size:1rem; cursor:pointer; transition:filter .2s ease; flex-shrink:0; }
                .profile-pic:hover { filter:brightness(1.2); }
                .profile-pic img { width:100%; height:100%; border-radius:50%; object-fit:cover; }
                .menu-button { width:100%; text-align:left; padding:10px 12px; border-radius:8px; background-color:transparent; color:var(--text-primary-dark); transition:background-color .2s ease; display:flex; align-items:center; gap:12px; border:none; }
                .menu-button:hover { background-color:var(--bg-secondary-dark); }
                .menu-button.danger:hover { background-color:rgba(239,68,68,0.2); color:#F87171; }
                .menu-button svg { width:20px; height:20px; }
            `;
            const style = document.createElement('style');
            style.textContent = css;
            document.head.appendChild(style);
        },
        
        _createNavbarContainer() {
            const navbar = document.createElement('nav');
            navbar.id = 'navbar';
            navbar.className = 'fixed top-0 left-0 right-0 z-50';
            navbar.style.height = this.config.navbarHeight;
            document.body.prepend(navbar);
            this.dom.navbar = navbar;
            document.body.style.marginTop = this.config.navbarHeight;
        },

        render() {
            if (!this.dom.navbar) return;
            const navTabsHTML = this._generateNavTabsHTML();
            const accountControlsHTML = this._generateAccountControlsHTML();

            this.dom.navbar.innerHTML = `
                <div class="h-full flex items-center justify-between px-4 sm:px-8 max-w-7xl mx-auto">
                    <a href="#" class="flex items-center">
                        <img src="${this.config.logoUrl}" alt="Logo" class="h-8 w-8 object-contain">
                    </a>
                    ${navTabsHTML}
                    ${accountControlsHTML}
                </div>`;
            
            this._cacheDynamicDOMElements();
            this._attachEventListeners();
            this._updateArrowVisibility();
            this._checkUserInfoOverflow();
        },

        _generateNavTabsHTML() {
            const loggedOutClass = this.state.isLoggedIn ? '' : 'logged-out';
            const linkHTML = this.state.navLinks.map(link =>
                `<a href="${link.path}" class="nav-link ${window.location.pathname.endsWith(link.path) || (window.location.pathname.endsWith('/') && link.id === 'dashboard') ? 'active' : ''}">${link.name}</a>`
            ).join('');

            return `<div class="nav-tabs-container ${loggedOutClass}">
                <div class="nav-scroll-wrapper">
                    <button id="nav-arrow-left" class="nav-arrow"> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg> </button>
                    <div id="nav-tabs-scroller" class="nav-tabs-scroller"><div class="flex items-center space-x-2">${linkHTML}</div></div>
                    <button id="nav-arrow-right" class="nav-arrow"> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg> </button>
                </div>
            </div>`;
        },
        
        _getProfileContent() {
            if (this.state.isLoggedIn && this.state.user.photoURL) return `<img src="${this.state.user.photoURL}" alt="Profile">`;
            if (this.state.isLoggedIn && this.state.user.displayName) return this.state.user.displayName.charAt(0).toUpperCase();
            return `<i class="fa-solid fa-user"></i>`;
        },

        _generateAccountControlsHTML() {
            const profileContent = this._getProfileContent();
            let menuHeader, menuActions;

            if (this.state.isLoggedIn) {
                menuHeader = `<div class="user-info"><div class="user-info-text"><span class="name">${this.state.user.displayName}</span><span class="email">${this.state.user.email}</span></div></div>`;
                menuActions = `
                    <button id="settings-btn" class="menu-button"><i class="fa-solid fa-gear w-5 text-center"></i>Settings</button>
                    <button id="logout-btn" class="menu-button danger"><i class="fa-solid fa-right-from-bracket w-5 text-center"></i>Logout</button>`;
            } else {
                menuHeader = `<div class="user-info"><span class="name">Welcome</span><span class="email">Please sign in</span></div>`;
                menuActions = `
                    <button id="login-btn" class="menu-button"><i class="fa-solid fa-right-to-bracket w-5 text-center"></i>Login</button>
                    <button id="signup-btn" class="menu-button"><i class="fa-solid fa-user-plus w-5 text-center"></i>Sign Up</button>`;
            }

            return `<div id="account-controls">
                <button id="account-button-toggle" class="profile-pic">${profileContent}</button>
                <div id="account-menu" class="account-menu menu-hidden">
                    <div class="account-menu-header">${menuHeader}<div id="account-button-in-menu" class="profile-pic">${profileContent}</div></div>
                    <div class="flex flex-col gap-2">${menuActions}</div>
                </div>
            </div>`;
        },

        _cacheDynamicDOMElements() {
            this.dom.scroller = document.getElementById('nav-tabs-scroller');
            this.dom.leftArrow = document.getElementById('nav-arrow-left');
            this.dom.rightArrow = document.getElementById('nav-arrow-right');
            this.dom.accountMenu = document.getElementById('account-menu');
        },
        
        _attachEventListeners() {
            // Use event delegation on the navbar itself
            this.dom.navbar.addEventListener('click', (e) => {
                const target = e.target;
                if (target.closest('#account-button-toggle') || target.closest('#account-button-in-menu')) this._toggleAccountMenu();
                else if (target.closest('#logout-btn')) this.firebase.auth.signOut();
                else if (target.closest('#login-btn')) alert("Login popup should appear here.");
                else if (target.closest('#signup-btn')) alert("Sign-up popup should appear here.");
                else if (target.closest('#nav-arrow-right')) this.dom.scroller.scrollTo({ left: this.dom.scroller.scrollWidth, behavior: 'smooth' });
                else if (target.closest('#nav-arrow-left')) this.dom.scroller.scrollTo({ left: 0, behavior: 'smooth' });
            });
            
            // Close menu if clicking outside
            document.addEventListener('click', (e) => {
                if (this.dom.accountMenu && !this.dom.accountMenu.classList.contains('menu-hidden') && !this.dom.navbar.contains(e.target)) {
                    this._closeAccountMenu();
                }
            });

            if(this.dom.scroller) {
                this.dom.scroller.addEventListener('scroll', () => this._updateArrowVisibility());
            }
            window.addEventListener('resize', () => this._updateArrowVisibility());
        },

        _toggleAccountMenu() {
            this.dom.accountMenu?.classList.toggle('menu-hidden');
            this.dom.accountMenu?.classList.toggle('menu-visible');
        },

        _closeAccountMenu() {
            this.dom.accountMenu?.classList.add('menu-hidden');
            this.dom.accountMenu?.classList.remove('menu-visible');
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
            const { scrollLeft, scrollWidth, clientWidth } = this.dom.scroller;
            this.dom.leftArrow.classList.toggle('visible', scrollLeft > 1);
            this.dom.rightArrow.classList.toggle('visible', scrollLeft < scrollWidth - clientWidth - 1);
        }
    };

    NavbarManager.init();
});

