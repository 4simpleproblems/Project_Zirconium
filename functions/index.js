const functions = require('firebase-functions');
const { defineString } = require('firebase-functions/params');
const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Firebase Admin SDK
admin.initializeApp();

// --- Configuration Parameters ---
const DISCORD_CLIENT_ID = defineString('DISCORD_CLIENT_ID');
const DISCORD_CLIENT_SECRET = defineString('DISCORD_CLIENT_SECRET');
const DISCORD_REDIRECT_URI = defineString('DISCORD_REDIRECT_URI');

// Your client-side app URL where the function will redirect the user after token generation.
const FRONTEND_REDIRECT = 'https://v5-4simpleproblems.github.io/auth-handler.html';

// --- Discord OAuth Endpoints ---
const DISCORD_TOKEN_URL = 'https://discord.com/oauth2/token';
const DISCORD_USER_URL = 'https://discord.com/api/users/@me';

/**
 * The main Cloud Function handler for the Discord OAuth redirect.
 */
exports.discordCallback = functions.https.onRequest(async (req, res) => {
    const code = req.query.code;

    if (!code) {
        console.error('No authorization code found in request query.');
        return res.status(400).send('Authorization code missing.');
    }

    try {
        const client_id = DISCORD_CLIENT_ID.value();
        const client_secret = DISCORD_CLIENT_SECRET.value();
        const redirect_uri = DISCORD_REDIRECT_URI.value();

        // 1. Exchange Code for Discord Access Token
        const tokenResponse = await axios.post(
            DISCORD_TOKEN_URL,
            new URLSearchParams({
                client_id: client_id,
                client_secret: client_secret,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: redirect_uri,
                scope: 'identify email'
            }),
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            }
        );

        const { access_token } = tokenResponse.data;

        // 2. Fetch User Profile (Discord ID and Email)
        const userResponse = await axios.get(DISCORD_USER_URL, {
            headers: { Authorization: `Bearer ${access_token}` },
        });

        const { id: discordUserId, email, username } = userResponse.data;

        // 3. Generate Firebase Custom Token
        const firebaseToken = await admin.auth().createCustomToken(discordUserId, {
            email: email,
            username: username
        });

        console.log(`Successfully created Firebase custom token for user: ${discordUserId}`);

        // 4. Redirect back to the frontend with the Firebase Custom Token
        const finalRedirectUrl = `${FRONTEND_REDIRECT}?custom_token=${firebaseToken}`;
        
        return res.redirect(finalRedirectUrl);

    } catch (error) {
        
        // <<< THE CRUCIAL DEBUGGING BLOCK IS HERE >>>
        console.error('Error during Discord authentication flow:', error.message);
        if (error.response) {
            // Log the actual error response from Discord
            console.error('Discord API Error Status:', error.response.status);
            console.error('Discord API Error Data:', error.response.data);
            
            // If the error is 400 (Bad Request), it's almost certainly a mismatch
            if (error.response.status === 400 && error.response.data.error === 'invalid_grant') {
                console.error("DEBUG HINT: 'invalid_grant' means the code was already used or expired (too slow).");
            }
            if (error.response.status === 400 && error.response.data.error === 'invalid_client') {
                console.error("DEBUG HINT: 'invalid_client' means Client ID or Secret is wrong.");
            }
        }
        // <<< END DEBUGGING BLOCK >>>

        // Redirect user back to the frontend with a generic error flag
        return res.redirect(`${FRONTEND_REDIRECT}?error=auth_failed`);
    }
});