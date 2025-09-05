// navbar-loading.js
document.addEventListener('DOMContentLoaded', function () {
    let loggedIn = true; // Assume logged in for demo
    let currentTheme = 'dark';
    const navbarHeight = '65px';
    const logoBaseUrl = 'https://raw.githubusercontent.com/4simpleproblems/Proj-Vanadium/main/images/';
    const scrollAmount = 300; 

    // Define navigation links here for easier management. 
    // Add more to test the scrolling feature (9+ items activate it).
    const navLinks = [
        { href: "#", text: "Dashboard", active: true },
        { href: "#", text: "Soundboard" },
        { href: "#", text: "Playlists" },
        { href: "#", text: "Games" },
        { href: "#", text: "Notes" },
        { href: "#", text: "Requests" },
        { href: "#", text: "Others" },
        { href: "#", text: "Settings" }
    ];

    function setTheme(theme) {
        currentTheme = theme;
        if (theme === 'light') {
            document.body.classList.remove('dark-mode');
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
            document.body.classList.add('dark-mode');
        }
        updateNavbarContent();
    }

    function createNavbar() {
        const navbar = document.createElement('nav');
        navbar.id = 'navbar';
        navbar.className = 'fixed top-0 left-0 right-0 z-50';
        navbar.style.height = navbarHeight;
        navbar.style.opacity = '0';
        document.body.prepend(navbar);
        
        // Attach persistent event listeners once
        attachDelegatedEventListeners();
        
        // Set initial theme and render content
        setTheme(currentTheme);

        document.body.style.marginTop = navbarHeight;
        setTimeout(() => { navbar.style.opacity = '1'; }, 10);
    }

    // This function uses event delegation and is only called ONCE.
    function attachDelegatedEventListeners() {
        const navbar = document.getElementById('navbar');
        if (!navbar) return;

        navbar.addEventListener('click', (e) => {
            const accountButton = e.target.closest('#account-button');
            if (accountButton) {
                e.stopPropagation();
                const menu = document.getElementById('account-menu');
                if (menu) {
                    menu.classList.toggle('menu-hidden');
                    menu.classList.toggle('menu-visible');
                }
                return;
            }

            if (e.target.closest('#logout-btn')) {
                loggedIn = false;
                updateNavbarContent();
                return;
            }

            if (e.target.closest('#login-btn')) {
                loggedIn = true;
                updateNavbarContent();
                return;
            }

            if (e.target.closest('#theme-light-btn')) {
                setTheme('light');
                return;
            }

            if (e.target.closest('#theme-dark-btn')) {
                setTheme('dark');
                return;
            }
        });
    }
    
    function checkNavArrows() {
        const scroller = document.getElementById('nav-tabs-scroller');
        if (!scroller) return;

        const tolerance = 1;
        const maxScroll = scroller.scrollWidth - scroller.clientWidth;
        
        const rightArrow = document.getElementById('nav-arrow-right');
        const leftArrow = document.getElementById('nav-arrow-left');

        if (rightArrow) rightArrow.classList.toggle('visible', scroller.scrollLeft < maxScroll - tolerance);
        if (leftArrow) leftArrow.classList.toggle('visible', scroller.scrollLeft > tolerance);
    }
    
    // This function is called after every content update to attach listeners to the dynamic scroll elements.
    function setupNavScroll() {
        const scroller = document.getElementById('nav-tabs-scroller');
        if (!scroller) return; 

        scroller.addEventListener('wheel', (e) => {
            e.preventDefault();
            scroller.scrollLeft += e.deltaY;
        }, { passive: false });

        const rightArrow = document.getElementById('nav-arrow-right');
        if (rightArrow) {
            rightArrow.addEventListener('click', () => {
                scroller.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            });
        }
        
        const leftArrow = document.getElementById('nav-arrow-left');
        if (leftArrow) {
            leftArrow.addEventListener('click', () => {
                scroller.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
            });
        }

        scroller.addEventListener('scroll', checkNavArrows);
        window.addEventListener('resize', checkNavArrows);
        setTimeout(checkNavArrows, 150); // Check arrows after render
    }

    function updateNavbarContent() {
        const navbar = document.getElementById('navbar');
        if (!navbar) return;
        
        const logoUrl = currentTheme === 'light' ? `${logoBaseUrl}logo-dark.png` : `${logoBaseUrl}logo.png`;
        
        const linkHTML = navLinks.map(link => 
            `<a href="${link.href}" class="nav-link ${link.active ? 'active' : ''}">${link.text}</a>`
        ).join('');

        let navTabs;

        if (navLinks.length > 8) {
            navTabs = `
                <div class="nav-tabs-container">
                    <div id="nav-scroll-wrapper" class="nav-scroll-wrapper">
                        <div id="nav-arrow-left" class="nav-arrow">
                            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                        </div>
                        <div id="nav-tabs-scroller" class="nav-tabs-scroller">
                            <div class="flex items-center space-x-2 primary-font">
                                ${linkHTML}
                            </div>
                        </div>
                        <div id="nav-arrow-right" class="nav-arrow">
                            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                        </div>
                    </div>
                </div>`;
        } else {
            navTabs = `
                <div class="nav-tabs-container">
                    <div class="flex items-center space-x-2 primary-font">
                        ${linkHTML}
                    </div>
                </div>`;
        }

        if (loggedIn) {
            navbar.innerHTML = `
                <div class="navbar-container h-full flex items-center justify-between px-4 sm:px-8">
                    <div class="flex items-center">
                        <img src="${logoUrl}" alt="4SP Logo" class="h-8 w-8 object-contain" loading="eager" decoding="async">
                    </div>
                    <div class="flex-grow flex justify-center">${navTabs}</div>
                    <div class="relative">
                        <button id="account-button" class="w-9 h-9 bg-gray-700 rounded-full flex items-center justify-center font-bold text-gray-300 hover:bg-gray-600 focus:outline-none primary-font">S</button>
                        <div id="account-menu" class="account-menu menu-hidden absolute right-0 mt-2 w-64 shadow-lg p-2 z-50">
                            <div class="px-2 py-2 border-b border-[var(--border-dark)] light:border-[var(--border-light)]">
                                <p class="text-sm truncate primary-font">student@school.edu</p>
                                <p class="text-xs secondary-font text-[var(--text-secondary-dark)] light:text-[var(--text-secondary-light)]">StudentUsername</p>
                            </div>
                            <div class="mt-2 flex flex-col space-y-1">
                                <a href="#" class="menu-item primary-font"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M4 13h6c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v8c0 .55.45 1 1 1zm0 8h6c.55 0 1-.45 1-1v-4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1zm10 0h6c.55 0 1-.45 1-1v-8c0-.55-.45-1-1-1h-6c-.55 0-1 .45-1 1v8c0 .55.45 1 1 1zM13 4v4c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1h-6c-.55 0-1 .45-1 1z"/></svg>Dashboard</a>
                                <a href="#" class="menu-item primary-font"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.44.17-.48.41l-.36 2.54c-.59-.24-1.13-.57-1.62-.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.34 8.85c-.11.2-.06.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12-.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.04.24.24.41.48.41h3.84c.24 0 .44-.17-.48-.41l.36-2.54c.59-.24-1.13-.57-1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.06-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>Settings</a>
                            </div>
                            <div class="border-t border-[var(--border-dark)] light:border-[var(--border-light)] mt-2 pt-2">
                                <div class="px-2 py-1 text-xs secondary-font text-[var(--text-secondary-dark)] light:text-[var(--text-secondary-light)]">Theme</div>
                                <div class="theme-switcher p-1 rounded-md flex justify-around">
                                    <button id="theme-light-btn" class="primary-font text-sm py-1 w-full rounded-md transition-colors ${currentTheme === 'light' ? 'active' : ''}">Light</button>
                                    <button id="theme-dark-btn" class="primary-font text-sm py-1 w-full rounded-md transition-colors ${currentTheme === 'dark' ? 'active' : ''}">Dark</button>
                                </div>
                            </div>
                            <div class="border-t border-[var(--border-dark)] light:border-[var(--border-light)] mt-2 pt-2">
                                <button id="logout-btn" class="menu-item primary-font text-red-400"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>Logout</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
             navbar.innerHTML = `
                <div class="navbar-container h-full flex items-center justify-between px-4 sm:px-8">
                    <div class="flex items-center">
                         <img src="${logoUrl}" alt="4SP Logo" class="h-8 w-8 object-contain" loading="eager" decoding="async">
                    </div>
                    <div class="flex-grow flex justify-center">${navTabs}</div>
                    <div class="flex items-center space-x-4">
                        <button id="login-btn" class="btn-primary primary-font text-sm">Login</button>
                    </div>
                </div>
            `;
        }
        
        // Setup scroll-specific listeners after the DOM is updated
        if (navLinks.length > 8) {
            setupNavScroll();
        }
    }

    createNavbar();
});

