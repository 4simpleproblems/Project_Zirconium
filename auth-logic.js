/**
 * auth-logic.js
 * Centralized logic for Firebase Authentication and Firestore profile creation.
 */

// Global Firebase setup (assuming firebase-app-compat.js, firebase-auth-compat.js,
// and firebase-firestore-compat.js have been loaded in the HTML)
const app = firebase.app();
const auth = firebase.auth();
const db = firebase.firestore();

// Global variable for Canvas App ID
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Utility to safely retrieve authentication method display name
function getAuthProviderName(user) {
    if (user.providerData && user.providerData.length > 0) {
        // Find the provider that created this user record
        const providerId = user.providerData[0].providerId;
        switch (providerId) {
            case 'google.com':
                return 'Google';
            case 'github.com':
                return 'GitHub';
            case 'microsoft.com':
                return 'Microsoft';
            case 'password':
                return 'Email/Password';
            default:
                return providerId;
        }
    }
    return 'Unknown';
}

/**
 * Creates or updates a user's profile document in Firestore.
 * This runs after ANY successful sign-in (email/pass or social).
 * @param {firebase.User} user - The authenticated Firebase user object.
 * @param {string} authMethod - The recognized authentication method.
 */
async function saveUserProfile(user, authMethod) {
    const userRef = db.doc(`artifacts/${appId}/users/${user.uid}/user-profile/user-data`);

    const data = {
        email: user.email,
        username: user.displayName || user.email.split('@')[0], // Use displayName if available
        authMethod: authMethod,
        lastSignInTime: firebase.firestore.FieldValue.serverTimestamp(),
        // Only set creationDate if the document doesn't exist
    };

    try {
        await userRef.set(data, { merge: true });
        console.log("User profile saved successfully for:", user.uid);
    } catch (error) {
        console.error("Error saving user profile to Firestore:", error);
    }
}

/**
 * Handles social login using a specific provider.
 * @param {string} providerId - 'google', 'github', or 'microsoft'.
 */
async function handleSocialSignIn(providerId) {
    let provider;
    let authMethod;

    switch (providerId) {
        case 'google':
            provider = new firebase.auth.GoogleAuthProvider();
            authMethod = 'Google';
            break;
        case 'github':
            provider = new firebase.auth.GithubAuthProvider();
            authMethod = 'GitHub';
            break;
        case 'microsoft':
            provider = new firebase.auth.OAuthProvider('microsoft.com');
            authMethod = 'Microsoft';
            break;
        default:
            console.error("Invalid provider ID.");
            return;
    }

    try {
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        
        await saveUserProfile(user, authMethod);
        
        // Redirect to the main logged-in page
        window.location.href = 'dashboard.html'; 

    } catch (error) {
        console.error("Social Sign-In Error:", error);
        
        // Handle common errors like pop-up closed or account already exists
        let errorMessage = 'An error occurred during sign-in.';
        if (error.code === 'auth/popup-closed-by-user') {
            errorMessage = 'Sign-in window closed. Please try again.';
        } else if (error.code === 'auth/account-exists-with-different-credential') {
             errorMessage = 'An account already exists with that email using a different login method.';
        }
        
        document.getElementById('error-message').textContent = errorMessage;
        document.getElementById('error-message').classList.remove('hidden');
    }
}

/**
 * Handles email and password sign in.
 */
async function handleEmailPasswordSignIn(email, password) {
    try {
        const result = await auth.signInWithEmailAndPassword(email, password);
        const user = result.user;

        if (!user.emailVerified) {
            // If not verified, redirect to verification page
            window.location.href = 'verify.html';
            return;
        }

        await saveUserProfile(user, 'Email/Password');

        // Redirect to the main logged-in page
        window.location.href = 'dashboard.html'; 

    } catch (error) {
        console.error("Sign-In Error:", error);
        let errorMessage = 'Sign-in failed. Please check your email and password.';
        
        if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
            errorMessage = 'Invalid email or password.';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Access temporarily blocked due to too many failed attempts.';
        }
        
        document.getElementById('error-message').textContent = errorMessage;
        document.getElementById('error-message').classList.remove('hidden');
    }
}

/**
 * Handles email and password sign up.
 */
async function handleEmailPasswordSignUp(email, password, username) {
    try {
        // 1. Create User
        const result = await auth.createUserWithEmailAndPassword(email, password);
        const user = result.user;

        // 2. Update Profile (username)
        await user.updateProfile({ displayName: username });

        // 3. Send Verification Email
        await user.sendEmailVerification();

        // 4. Save initial profile to Firestore (even though unverified)
        await saveUserProfile(user, 'Email/Password');
        
        // 5. Redirect to verification page
        window.location.href = 'verify.html';

    } catch (error) {
        console.error("Sign-Up Error:", error);
        let errorMessage = 'Sign-up failed.';
        
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'This email is already in use.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'The password is too weak.';
        }
        
        document.getElementById('error-message').textContent = errorMessage;
        document.getElementById('error-message').classList.remove('hidden');
    }
}
