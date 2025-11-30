/**
 * ban-enforcer.js (v3.2 - Fullscreen & UI Update)
 *
 * This script is the primary enforcement mechanism for website bans, now with real-time updates.
 * It uses a Firestore onSnapshot listener to immediately detect changes to a user's ban status.
 *
 * How it works:
 * 1. It immediately injects a transparent "shield" and disables page scrolling to block all interaction.
 * 2. It listens for authentication state changes. Once a user is logged in, it establishes a
 * real-time connection to their document in the 'bans' collection.
 * 3. The listener will fire instantly and again any time the user's ban status is changed on the server.
 * - If BANNED: The shield becomes a visible, persistent overlay with the ban reason. A guard
 * interval prevents tampering via developer tools. The message and home button appear above the shield.
 * **It will also force the browser to exit any active fullscreen mode.**
 * - If NOT BANNED (or unbanned): The shield, message, and guard are all removed, and scrolling is
 * re-enabled, allowing normal interaction.
 *
 * IMPORTANT:
 * 1. This script must be placed AFTER the Firebase SDK scripts in your HTML.
 * 2. It should be included on EVERY page you want to protect.
 */

console.log("Debug: ban-enforcer.js v3.2 (Fullscreen & UI) script has started.");

// --- Global variable for the persistence guard interval ---
let banGuardInterval = null;

// --- 1. Immediately create shield and lock scrolling ---
// This IIFE (Immediately Invoked Function Expression) runs as soon as the script is parsed.
(function() {
    // Check if the shield already exists to prevent duplication.
    if (document.getElementById('ban-enforcer-shield')) return;

    // Create the shield element
    const shield = document.createElement('div');
    shield.id = 'ban-enforcer-shield';
    // Style the shield to be a full-screen, transparent overlay that blocks clicks.
    shield.style.position = 'fixed';
    shield.style.top = '0';
    shield.style.left = '0';
    shield.style.width = '100vw';
    shield.style.height = '100vh';
    // **MODIFICATION**: Set z-index to be high, but lower than the message and button.
    shield.style.zIndex = '2147483646';
    shield.style.backgroundColor = 'transparent'; // Invisible by default.

    // Append to the root <html> element to ensure it loads before the body is interactive.
    document.documentElement.appendChild(shield);

    // Immediately disable scrolling on the entire page to prevent any interaction
    // during the ban check.
    document.documentElement.style.overflow = 'hidden';

    console.log("Debug: Pre-ban shield deployed and page scrolling locked.");
})();


/**
 * Helper function to remove all ban-related elements and restore page functionality.
 * This is called when the user is verified as not banned or is unbanned in real-time.
 */
function removeBanScreenAndUnlock() {
    // Clear the persistence guard interval to stop it from re-creating the ban screen.
    if (banGuardInterval) {
        clearInterval(banGuardInterval);
        banGuardInterval = null;
    }

    // Remove all visual elements of the ban screen.
    const shield = document.getElementById('ban-enforcer-shield');
    if (shield) shield.remove();

    const messageBox = document.getElementById('ban-enforcer-message');
    if (messageBox) messageBox.remove();
    
    const homeButton = document.getElementById('ban-enforcer-home-button');
    if (homeButton) homeButton.remove();

    // Restore scrolling.
    document.documentElement.style.overflow = '';
    console.log("Debug: All ban elements and guard removed. Page unlocked.");
}


document.addEventListener('DOMContentLoaded', () => {
    console.log("Debug: DOMContentLoaded event fired. Ban enforcer is running.");

    // Check for the Firebase library, which is a critical dependency.
    if (typeof firebase === 'undefined' || typeof firebase.auth === 'undefined' || typeof firebase.firestore === 'undefined') {
        console.error("FATAL ERROR: Firebase is not loaded correctly. Check the script order. Ban enforcement is disabled.");
        removeBanScreenAndUnlock(); // Failsafe
        return;
    }

    // firebase.auth().onAuthStateChanged is the entry point.
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            // A user is logged in. Establish a real-time listener for their ban status.
            console.log("Debug: User is logged in. Attaching real-time ban listener for UID:", user.uid);

            const db = firebase.firestore();
            const banDocRef = db.collection('bans').doc(user.uid);

            // Use onSnapshot for real-time ban enforcement.
            // This listener will fire immediately and then again whenever the ban status changes.
            const unsubscribe = banDocRef.onSnapshot(doc => {
                if (doc.exists) {
                    // --- USER IS BANNED ---
                    const banData = doc.data();
                    console.warn(`User ${user.uid} is BANNED. Reason: ${banData.reason}. Locking page permanently.`);
                    showBanScreen(banData);
                } else {
                    // --- USER IS NOT BANNED ---
                    console.log("Debug: User is not banned. Real-time listener confirmed.");
                    removeBanScreenAndUnlock();
                }
            }, error => {
                console.error("Debug: An error occurred while listening for ban status. Removing shield to prevent lockout.", error);
                removeBanScreenAndUnlock(); // Failsafe in case of permission errors, etc.
            });
            // NOTE: For a multi-page app, this listener is naturally torn down on page navigation.
            // In a Single Page App (SPA), you would need to call `unsubscribe()` when the user logs out.

        } else {
            // --- NO USER LOGGED IN ---
            console.log("Debug: No user is logged in.");
            removeBanScreenAndUnlock();
        }
    });
});

/**
 * Makes the ban screen visible and starts the persistence guard to prevent tampering.
 * @param {object} banData - The data from the user's document in the 'bans' collection.
 */
function showBanScreen(banData) {
    const shieldId = 'ban-enforcer-shield';
    const messageId = 'ban-enforcer-message';
    const homeButtonId = 'ban-enforcer-home-button';

    // This function contains the logic to create/update all visual ban elements.
    // It is called once and then used by the interval guard.
    const enforceBanVisuals = () => {
        // --- NEW (v3.2): Force exit from any active fullscreen mode ---
        // This check runs continuously to prevent the user from re-entering fullscreen.
        if (document.fullscreenElement) {
            console.warn("Debug [Guard]: User is in fullscreen mode. Forcing exit.");
            document.exitFullscreen().catch(err => {
                // This catch block handles potential errors, though they are unlikely here.
                console.error("Debug [Guard]: Error trying to exit fullscreen:", err.message);
            });
        }

        // --- 1. Find or create the main shield ---
        let shield = document.getElementById(shieldId);
        if (!shield) {
            console.warn("Debug [Guard]: Ban shield was removed by user. Re-deploying...");
            shield = document.createElement('div');
            shield.id = shieldId;
            shield.style.position = 'fixed';
            shield.style.top = '0';
            shield.style.left = '0';
            shield.style.width = '100vw';
            shield.style.height = '100vh';
            // **MODIFICATION**: Set z-index to be high, but lower than the message and button.
            shield.style.zIndex = '2147483646';
            document.documentElement.appendChild(shield);
        }

        // --- 2. Apply visible styles to the shield ---
        shield.style.backgroundColor = 'rgba(0, 0, 0, 0.95)'; // Darker, more opaque background
        shield.style.backdropFilter = 'blur(10px)';
        shield.style.webkitBackdropFilter = 'blur(10px)';

        // --- 3. Find or create the message box ---
        let messageBox = document.getElementById(messageId);
        if (!messageBox) {
            console.warn("Debug [Guard]: Ban message was removed by user. Re-displaying...");
            messageBox = document.createElement('div');
            messageBox.id = messageId;

            // --- Sanitize data to prevent potential HTML injection ---
            const reason = banData.reason ? String(banData.reason).replace(/</g, "&lt;").replace(/>/g, "&gt;") : 'No reason provided.';
            
            // **MODIFICATION**: Format the ban timestamp as requested.
            let banTimestamp = '';
            if (banData.bannedAt && banData.bannedAt.toDate) {
                const date = banData.bannedAt.toDate();
                const formattedDate = date.toLocaleDateString(); // e.g., 9/20/2025
                const formattedTime = date.toLocaleTimeString(); // e.g., 2:17:00 AM
                banTimestamp = `on ${formattedDate} at ${formattedTime}`;
            }

            // **MODIFICATION**: Update the innerHTML with the new message format.
            // TEXT ON BOTTOM LEFT
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
            document.body.appendChild(messageBox);
        }

        // --- 4. Apply styles to the message box ---
        messageBox.style.position = 'fixed';
        // BOTTOM LEFT POSITIONING
        messageBox.style.bottom = '60px';
        messageBox.style.left = '60px';
        messageBox.style.textAlign = 'left';
        messageBox.style.color = '#ffffff';
        messageBox.style.fontFamily = "'Geist', sans-serif"; // Use Geist font
        messageBox.style.zIndex = '2147483647';
        messageBox.style.textShadow = '0 4px 12px rgba(0,0,0,0.5)';

        // --- 5. Ensure scrolling remains locked ---
        if (document.documentElement.style.overflow !== 'hidden') {
            document.documentElement.style.overflow = 'hidden';
            console.warn("Debug [Guard]: User tried to re-enable scrolling. Re-locking.");
        }
        if (document.body.style.overflow !== 'hidden') {
            document.body.style.overflow = 'hidden';
        }

        // --- 6. Find or create the Home button ---
        let homeButton = document.getElementById(homeButtonId);
        if (!homeButton) {
            console.warn("Debug [Guard]: Home button was removed. Re-creating...");
            homeButton = document.createElement('a'); // Use an anchor tag for navigation
            homeButton.id = homeButtonId;
            homeButton.href = '../index.html'; // Set the redirection target

            // Add the Font Awesome icon
            homeButton.innerHTML = `<i class="fa-solid fa-house"></i>`;

            // Apply styles
            homeButton.style.position = 'fixed';
            // BOTTOM RIGHT POSITIONING
            homeButton.style.bottom = '60px';
            homeButton.style.right = '60px';
            homeButton.style.top = 'auto'; // Reset top
            
            // **MODIFICATION**: Ensure z-index is higher than the shield.
            homeButton.style.zIndex = '2147483647';
            homeButton.style.width = '60px';
            homeButton.style.height = '60px';
            homeButton.style.display = 'flex';
            homeButton.style.alignItems = 'center';
            homeButton.style.justifyContent = 'center';
            homeButton.style.fontSize = '24px';
            homeButton.style.color = 'white';
            homeButton.style.textDecoration = 'none';
            
            // Minimalist / Clean style
            homeButton.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            homeButton.style.backdropFilter = 'blur(10px)';
            homeButton.style.webkitBackdropFilter = 'blur(10px)'; // For Safari
            homeButton.style.borderRadius = '50%'; // Circular
            homeButton.style.border = '1px solid rgba(255, 255, 255, 0.1)';
            homeButton.style.transition = 'all 0.3s ease';

            // Hover effect for better UX
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
    };

    // --- Inject Font Awesome for the home button icon ---
    // This is safe to run multiple times; the browser won't load the same stylesheet twice.
    if (!document.querySelector('link[href*="font-awesome"]')) {
        const faLink = document.createElement('link');
        faLink.rel = 'stylesheet';
        faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';
        document.head.appendChild(faLink);
    }

    // Inject the custom font (Geist)
    if (!document.querySelector('link[href*="fonts.googleapis.com/css2?family=Geist"]')) {
        const preconnect1 = document.createElement('link');
        preconnect1.rel = 'preconnect';
        preconnect1.href = 'https://fonts.googleapis.com';
        document.head.appendChild(preconnect1);

        const preconnect2 = document.createElement('link');
        preconnect2.rel = 'preconnect';
        preconnect2.href = 'https://fonts.gstatic.com';
        preconnect2.crossOrigin = 'anonymous';
        document.head.appendChild(preconnect2);

        const fontLink = document.createElement('link');
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap';
        document.head.appendChild(fontLink);
    }

    // Run the enforcement function for the first time.
    enforceBanVisuals();

    // Start or re-confirm the persistence guard interval.
    // Clear any previous interval to prevent multiple running guards.
    if (banGuardInterval) clearInterval(banGuardInterval);
    banGuardInterval = setInterval(enforceBanVisuals, 200);
}
