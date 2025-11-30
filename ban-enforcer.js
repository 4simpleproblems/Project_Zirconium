/**
 * ban-enforcer.js (v4.0 - Invisible Barrier & Real-Time Enforcement)
 *
 * This script protects the website by immediately injecting an invisible barrier
 * that blocks all interaction until the user's ban status is verified.
 *
 * Key Features:
 * 1. Immediate "Invisible Shield" injection on script load.
 * 2. Real-time Firestore listener (onSnapshot) for ban status.
 * 3. Automatic visual updates if ban details change.
 * 4. Anti-tamper guard to prevent removing the ban screen.
 * 5. Geist Font & Modern UI (Bottom-Left Text, Bottom-Right Home Button).
 */

console.log("Debug: ban-enforcer.js v4.0 loaded.");

// --- Global State ---
let banGuardInterval = null;
let currentBanData = null; // Store current ban data for the guard to use

// --- 1. Immediate Barrier Injection (The "Lock") ---
(function() {
    if (document.getElementById('ban-enforcer-shield')) return;

    const shield = document.createElement('div');
    shield.id = 'ban-enforcer-shield';
    // Full-screen, transparent, high z-index
    shield.style.position = 'fixed';
    shield.style.top = '0';
    shield.style.left = '0';
    shield.style.width = '100vw';
    shield.style.height = '100vh';
    shield.style.zIndex = '2147483646';
    shield.style.backgroundColor = 'transparent'; // Invisible initially
    shield.style.cursor = 'wait'; // Indicate loading/blocking state

    document.documentElement.appendChild(shield);
    document.documentElement.style.overflow = 'hidden'; // Lock scrolling immediately

    console.log("Debug: Invisible barrier deployed. Interaction locked.");
})();

// --- 2. Font Injection (Geist) ---
(function() {
    if (!document.querySelector('link[href*="fonts.googleapis.com/css2?family=Geist"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap';
        document.head.appendChild(link);
    }
    if (!document.querySelector('link[href*="font-awesome"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';
        document.head.appendChild(link);
    }
})();

/**
 * Removes the barrier and unlocks the page.
 * Called when user is confirmed NOT banned (or logged out).
 */
function unlockPage() {
    if (banGuardInterval) {
        clearInterval(banGuardInterval);
        banGuardInterval = null;
    }
    currentBanData = null;

    const elements = [
        'ban-enforcer-shield',
        'ban-enforcer-message',
        'ban-enforcer-home-button'
    ];

    elements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });

    document.documentElement.style.overflow = ''; // Restore scrolling
    document.body.style.overflow = '';
    console.log("Debug: Page unlocked.");
}

/**
 * Renders the ban screen visuals and updates content.
 */
function renderBanVisuals(banData) {
    const shieldId = 'ban-enforcer-shield';
    const messageId = 'ban-enforcer-message';
    const homeButtonId = 'ban-enforcer-home-button';

    // 1. Shield (Barrier) - Ensure it exists and is visible
    let shield = document.getElementById(shieldId);
    if (!shield) {
        shield = document.createElement('div');
        shield.id = shieldId;
        shield.style.position = 'fixed';
        shield.style.top = '0';
        shield.style.left = '0';
        shield.style.width = '100vw';
        shield.style.height = '100vh';
        shield.style.zIndex = '2147483646';
        document.documentElement.appendChild(shield);
    }
    // Make it visible and styled
    shield.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
    shield.style.backdropFilter = 'blur(10px)';
    shield.style.webkitBackdropFilter = 'blur(10px)';
    shield.style.cursor = 'default';

    // 2. Force Fullscreen Exit
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(e => console.error("Fullscreen exit error:", e));
    }

    // 3. Message Box
    let messageBox = document.getElementById(messageId);
    if (!messageBox) {
        messageBox = document.createElement('div');
        messageBox.id = messageId;
        // Styles
        messageBox.style.position = 'fixed';
        messageBox.style.bottom = '60px';
        messageBox.style.left = '60px';
        messageBox.style.color = '#ffffff';
        messageBox.style.fontFamily = "'Geist', sans-serif";
        messageBox.style.zIndex = '2147483647';
        messageBox.style.textAlign = 'left';
        messageBox.style.textShadow = '0 4px 12px rgba(0,0,0,0.5)';
        document.body.appendChild(messageBox);
    }

    // Prepare Content
    const reason = banData.reason ? String(banData.reason).replace(/</g, "&lt;") : 'No reason provided.';
    let banTimestamp = '';
    if (banData.bannedAt && banData.bannedAt.toDate) {
        const date = banData.bannedAt.toDate();
        banTimestamp = `on ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`;
    }

    // Update Content (Idempotent: typically fast enough to just set innerHTML)
    messageBox.innerHTML = `
        <h1 style="font-size: 4rem; color: #ffffff; margin: 0 0 20px 0; font-weight: 800; line-height: 1;">Access<br>Denied</h1>
        <p style="font-size: 1.25rem; margin: 0 0 10px 0; color: #ef4444; font-weight: 500;">Account Suspended</p>
        <div style="width: 50px; height: 4px; background-color: #ef4444; margin-bottom: 20px;"></div>
        <p style="font-size: 1rem; margin: 0 0 10px 0; color: #d1d5db; max-width: 500px; line-height: 1.6;">
            <strong>Reason:</strong> ${reason}
        </p>
        <p style="font-size: 0.85rem; color: #6b7280; margin-top: 20px;">
            Banned by administrator ${banTimestamp}.<br>
            ID: ${banData.uid || 'UNKNOWN'}
        </p>
    `;

    // 4. Home Button
    let homeButton = document.getElementById(homeButtonId);
    if (!homeButton) {
        homeButton = document.createElement('a');
        homeButton.id = homeButtonId;
        homeButton.href = '../index.html';
        homeButton.innerHTML = `<i class="fa-solid fa-house"></i>`;
        
        // Styles
        homeButton.style.position = 'fixed';
        homeButton.style.bottom = '60px';
        homeButton.style.right = '60px';
        homeButton.style.zIndex = '2147483647';
        homeButton.style.width = '60px';
        homeButton.style.height = '60px';
        homeButton.style.display = 'flex';
        homeButton.style.alignItems = 'center';
        homeButton.style.justifyContent = 'center';
        homeButton.style.fontSize = '24px';
        homeButton.style.color = 'white';
        homeButton.style.textDecoration = 'none';
        homeButton.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        homeButton.style.backdropFilter = 'blur(10px)';
        homeButton.style.webkitBackdropFilter = 'blur(10px)';
        homeButton.style.borderRadius = '50%';
        homeButton.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        homeButton.style.transition = 'all 0.3s ease';

        homeButton.onmouseover = () => { 
            homeButton.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'; 
            homeButton.style.transform = 'scale(1.1)';
        };
        homeButton.onmouseout = () => { 
            homeButton.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'; 
            homeButton.style.transform = 'scale(1)';
        };

        document.body.appendChild(homeButton);
    }

    // 5. Lock Scrolling
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
}

/**
 * Entry point: Shows the ban screen and starts the anti-tamper guard.
 */
function lockPageAsBanned(banData) {
    currentBanData = banData; // Store for the guard
    
    // Render immediately
    renderBanVisuals(banData);

    // Start Guard Interval (re-renders if elements are deleted)
    if (banGuardInterval) clearInterval(banGuardInterval);
    banGuardInterval = setInterval(() => {
        if (currentBanData) {
            // Only re-render if elements are missing (light check)
            const shield = document.getElementById('ban-enforcer-shield');
            const msg = document.getElementById('ban-enforcer-message');
            if (!shield || !msg) {
                console.warn("Debug [Guard]: Ban elements missing. Restoring...");
                renderBanVisuals(currentBanData);
            }
            // Ensure scrolling is still locked
            if (document.documentElement.style.overflow !== 'hidden') {
                document.documentElement.style.overflow = 'hidden';
            }
        }
    }, 500);
}

// --- 3. Auth & Firestore Listener ---
document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase === 'undefined') {
        console.error("Ban Enforcer: Firebase not found. Unlocking as failsafe.");
        unlockPage();
        return;
    }

    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            console.log("Debug: User logged in. Listening for ban status...");
            const db = firebase.firestore();
            
            // Real-time listener
            db.collection('bans').doc(user.uid).onSnapshot(doc => {
                if (doc.exists) {
                    console.warn("Debug: User is BANNED.");
                    lockPageAsBanned(doc.data());
                } else {
                    console.log("Debug: User is NOT banned.");
                    unlockPage();
                }
            }, error => {
                console.error("Debug: Ban listener error.", error);
                // In case of error (e.g., permission denied), we might typically unlock
                // OR lock if we want fail-secure. Defaulting to unlock to prevent accidental lockouts due to network.
                unlockPage();
            });
        } else {
            console.log("Debug: No user. Page unlocked.");
            unlockPage();
        }
    });
});
