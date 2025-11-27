// ban-enforcer.js

// Import Firebase (assuming it's loaded globally or via a shared module)
// For now, we'll assume firebase is available globally or initialize it if needed.
// It's preferable if Firebase is initialized once at a higher level (e.g., in navigation.js or a main script).

(function() {
    let auth;
    let db;
    let currentUser = null;
    let isBanCheckRunning = false;

    // Helper to get Firebase app instance if already initialized, or initialize it.
    // This part might need adjustment depending on how firebase is initialized on other pages.
    const getFirebaseApp = () => {
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            return firebase.app();
        }
        // If not initialized, try to get config from a known location (e.g., firebase-config.js)
        // For now, let's assume it's initialized globally on most pages.
        console.warn("Firebase app not found. ban-enforcer.js might not work correctly if Firebase is not initialized globally.");
        return null;
    };

    const initializeFirebaseIfNeeded = () => {
        const app = getFirebaseApp();
        if (app) {
            auth = firebase.auth();
            db = firebase.firestore();
            return true;
        }
        return false;
    };

    const enforceBan = (banDetails) => {
        // Blur the entire body
        document.body.style.filter = 'blur(5px)';
        document.body.style.pointerEvents = 'none'; // Disable interactions with blurred content

        // Create ban overlay
        const overlay = document.createElement('div');
        overlay.id = 'ban-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.85);
            color: white;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 99999;
            font-family: 'Geist', sans-serif;
            text-align: center;
            pointer-events: auto; /* Allow interaction with overlay */
            filter: none; /* Ensure overlay itself is not blurred */
        `;

        let banMessage = `
            <h1 class="text-4xl font-bold mb-4 text-red-500">You Are Banned!</h1>
            <p class="text-xl mb-2">${banDetails.banType === 'permanent' ? 'This is a permanent ban.' : 'This is a temporary ban.'}</p>
        `;

        if (banDetails.reason) {
            banMessage += `<p class="text-lg italic mb-2">Reason: "${banDetails.reason}"</p>`;
        }

        if (banDetails.banType === 'temporary' && banDetails.banEndTime) {
            const banEndTime = banDetails.banEndTime.toDate(); // Convert Firestore Timestamp to Date
            banMessage += `
                <p class="text-lg">Your ban will be lifted on:</p>
                <p class="text-2xl font-semibold mb-4">${banEndTime.toLocaleString()}</p>
            `;
        } else if (banDetails.banType === 'permanent') {
             banMessage += `<p class="text-lg mb-4">Access to the site has been permanently revoked.</p>`;
        }
        
        banMessage += `<p class="text-sm text-gray-400 mt-8">If you believe this is a mistake, please contact support.</p>`;

        overlay.innerHTML = banMessage;
        document.body.appendChild(overlay);
    };

    const checkBanStatus = async (user) => {
        if (!user || isBanCheckRunning) return;
        isBanCheckRunning = true;

        if (!initializeFirebaseIfNeeded()) {
             // Firebase not initialized, try again later or assume it will be initialized by another script
             isBanCheckRunning = false;
             return;
        }

        try {
            const banDocRef = db.collection('bannedUsers').doc(user.uid);
            const banDoc = await banDocRef.get();

            if (banDoc.exists) {
                const banDetails = banDoc.data();
                const now = new Date();

                if (banDetails.banType === 'temporary' && banDetails.banEndTime.toDate() < now) {
                    // Ban has expired, but not yet removed by Cloud Function.
                    // Optimistically unban client-side, Cloud Function will clean up Firestore.
                    console.log(`Client-side: Temporary ban for ${user.uid} has expired. Not enforcing.`);
                    // Optionally, remove the ban document via a callable Cloud Function here if not relying solely on scheduled function
                    // await httpsCallable(functions, 'removeExpiredBan')({ uid: user.uid }); // Example
                    document.body.style.filter = '';
                    document.body.pointerEvents = '';
                } else {
                    console.warn(`User ${user.uid} is banned. Type: ${banDetails.banType}, Reason: ${banDetails.reason || 'N/A'}`);
                    enforceBan(banDetails);
                }
            } else {
                // User is not banned, ensure no ban overlay is present
                const existingOverlay = document.getElementById('ban-overlay');
                if (existingOverlay) {
                    document.body.removeChild(existingOverlay);
                    document.body.style.filter = '';
                    document.body.pointerEvents = '';
                }
            }
        } catch (error) {
            console.error('Error checking ban status:', error);
            // In case of error, assume not banned to avoid locking out legitimate users
            document.body.style.filter = '';
            document.body.pointerEvents = '';
            const existingOverlay = document.getElementById('ban-overlay');
            if (existingOverlay) document.body.removeChild(existingOverlay);
        } finally {
            isBanCheckRunning = false;
        }
    };

    // Listen for Firebase Auth state changes
    // This ensures the ban check runs as soon as user authentication is established.
    document.addEventListener('DOMContentLoaded', () => {
        if (typeof firebase === 'undefined' || !firebase.apps.length) {
            // Firebase not yet initialized, wait for it.
            // This assumes another script (e.g., navigation.js or firebase-config.js) will initialize Firebase.
            // If firebase-config.js is modular, this requires careful handling.
            // For now, a simple retry might be necessary or a direct dependency.
            console.log("ban-enforcer.js: Waiting for Firebase to initialize.");
            const checkFirebaseInterval = setInterval(() => {
                if (initializeFirebaseIfNeeded()) {
                    clearInterval(checkFirebaseInterval);
                    auth.onAuthStateChanged((user) => {
                        currentUser = user;
                        checkBanStatus(currentUser);
                    });
                }
            }, 500); // Check every 500ms
        } else {
            initializeFirebaseIfNeeded(); // Firebase is already initialized
            auth.onAuthStateChanged((user) => {
                currentUser = user;
                checkBanStatus(currentUser);
            });
        }
    });

})();