// navbar-loading.js
document.addEventListener('DOMContentLoaded', function () {
    let loggedIn = false;
    let currentTheme = 'dark'; // Default theme is now dark
    const navbarHeight = '65px';
    const logoBaseUrl = 'https://raw.githubusercontent.com/4simpleproblems/Proj-Vanadium/main/images/';

    const scrollAmount = 250; 

    function setTheme(theme) {
        currentTheme = theme;
        document.body.className = theme + '-mode';
        updateNavbarContent();
    }

    function createNavbar() {
        const navbar = document.createElement('nav');
        navbar.id = 'navbar';
        navbar.className = 'fixed top-0 left-0 right-0 z-50';
        navbar.style.height = navbarHeight;
        navbar.style.opacity = '0';
        document.body.prepend(navbar);
        setTheme(currentTheme);

        document.body.style.marginTop = navbarHeight;

        setTimeout(() => { navbar.style.opacity = '1'; }, 10);

        document.addEventListener('click', function(event) {
            const menu = document.getElementById('account-menu');
            const button = document.getElementById('account-button');
            if (menu && button && !menu.contains(event.target) && !button.contains(event.target)) {
                menu.classList.remove('menu-visible');
                menu.classList.add('menu-hidden');
            }
        });
    }

    function attachEventListeners() {
        if (loggedIn) {
            document.getElementById('account-button')?.addEventListener('click', (e) => {
                e.stopPropagation();
                const menu = document.getElementById('account-menu');
                menu.classList.toggle('menu-hidden');
                menu.classList.toggle('menu-visible');
            });
            
            document.getElementById('logout-btn')?.addEventListener('click', toggleLoginState);
            document.getElementById('theme-light-btn')?.addEventListener('click', () => setTheme('light'));
            document.getElementById('theme-dark-btn')?.addEventListener('click', () => setTheme('dark'));
        } else {
            document.getElementById('login-btn')?.addEventListener('click', toggleLoginState);
        }
        setupNavScroll();
    }
    
    function checkNavArrows() {
        const scroller = document.getElementById('nav-tabs-scroller');
        if (!scroller) return;

        const rightArrow = document.getElementById('nav-arrow-right');
        const leftArrow = document.getElementById('nav-arrow-left');
        
        const maxScroll = scroller.scrollWidth - scroller.clientWidth;
        
        rightArrow.classList.toggle('visible', scroller.scrollLeft < maxScroll - 5);
        leftArrow.classList.toggle('visible', scroller.scrollLeft > 5);
    }
    
    function setupNavScroll() {
        const scroller = document.getElementById('nav-tabs-scroller');
        if (!scroller) return;

        scroller.addEventListener('scroll', checkNavArrows);
        window.addEventListener('resize', checkNavArrows);
        setTimeout(checkNavArrows, 150); // Initial check after content loads

        document.getElementById('nav-arrow-right')?.addEventListener('click', () => {
            scroller.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        });
        document.getElementById('nav-arrow-left')?.addEventListener('click', () => {
            scroller.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        });
    }

    function updateNavbarContent() {
        const navbar = document.getElementById('navbar');
        if (!navbar) return;
        
        const logoUrl = currentTheme === 'light' ? `${logoBaseUrl}logo-dark.png` : `${logoBaseUrl}logo.png`;
        const navTabs = `
            <div class="nav-tabs-container">
                <div id="nav-scroll-wrapper" class="nav-scroll-wrapper">
                    <div id="nav-arrow-left" class="nav-arrow">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                    </div>
                    <div id="nav-tabs-scroller" class="nav-tabs-scroller">
                        <div class="flex items-center space-x-2 primary-font">
                            <a href="#" class="nav-link">Dashboard</a>
                            <a href="#" class="nav-link">Soundboard</a>
                            <a href="#" class="nav-link">Playlists</a>
                            <a href="#" class="nav-link">Games</a>
                            <a href="#" class="nav-link">Notes</a>
                            <a href="#" class="nav-link">Requests</a>
                            <a href="#" class="nav-link">Countdowns</a>
                            <a href="#" class="nav-link">Weather</a>
                            <a href="#" class="nav-link">Others</a>
                            <a href="#" class="nav-link">Settings</a>
                        </div>
                    </div>
                    <div id="nav-arrow-right" class="nav-arrow">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                    </div>
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
                            </div>
                        </div>
                    </div>
                    <div class="hidden md:flex flex-grow">${navTabs}</div>
                    <div class="relative">
                        <button id="account-button" class="w-9 h-9 bg-gray-700 rounded-full flex items-center justify-center font-bold text-gray-300 hover:bg-gray-600 focus:outline-none primary-font">S</button>
                        <div id="account-menu" class="account-menu menu-hidden absolute right-0 mt-2 w-64 shadow-lg p-2 z-50">
                            <div class="px-2 py-2 border-b border-[var(--border-dark)]">
                                <p class="text-sm truncate primary-font">student@school.edu</p>
                                <p class="text-xs secondary-font text-[var(--text-secondary-dark)]">StudentUsername</p>
                            </div>
                            <div class="mt-2 flex flex-col space-y-1">
                                <a href="#" class="menu-item primary-font"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M4 13h6c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v8c0 .55.45 1 1 1zm0 8h6c.55 0 1-.45 1-1v-4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1zm10 0h6c.55 0 1-.45 1-1v-8c0-.55-.45-1-1-1h-6c-.55 0-1 .45-1 1v8c0 .55.45 1 1 1zM13 4v4c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1h-6c-.55 0-1 .45-1 1z"/></svg>Dashboard</a>
                                <a href="#" class="menu-item primary-font"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L12 12v7.93zM17.93 10.21A8.01 8.01 0 0012.07 4.28v7.93l5.86-2z"/></svg>My Activity</a>
                                <a href="#" class="menu-item primary-font"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.44.17-.48.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.34 8.85c-.11.2-.06.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.04.24.24.41.48.41h3.84c.24 0 .44-.17-.48-.41l.36-2.54c.59-.24 1.13-.57 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.06-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>Settings</a>
                            </div>
                            <div class="border-t border-[var(--border-dark)] mt-2 pt-2">
                                <div class="px-2 py-1 text-xs secondary-font text-[var(--text-secondary-dark)]">Theme</div>
                                <div class="px-2 flex justify-around theme-switcher bg-[var(--bg-primary-dark)] p-1 rounded-md">
                                    <button id="theme-light-btn" class="primary-font text-sm py-1 w-full rounded-md transition-colors ${currentTheme === 'light' ? 'active' : ''}">Light</button>
                                    <button id="theme-dark-btn" class="primary-font text-sm py-1 w-full rounded-md transition-colors ${currentTheme === 'dark' ? 'active' : ''}">Dark</button>
                                </div>
                            </div>
                            <div class="border-t border-[var(--border-dark)] mt-2 pt-2">
                                <button id="logout-btn" class="menu-item primary-font text-red-400"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>Logout</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
             navbar.innerHTML = `
                <div class="navbar-container h-full flex items-center justify-between px-4 sm:px-8">
                    <div class="flex items-center space-x-3">
                        <img src="${logoUrl}" alt="4SP Logo" class="h-8 w-8 object-contain" loading="eager" decoding="async">
                         <div class="flex flex-col">
                        </div>
                    </div>
                    <div class="hidden md:flex flex-grow">${navTabs}</div>
                    <div class="flex items-center space-x-4">
                        <button id="login-btn" class="btn-primary primary-font text-sm">Login</button>
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

