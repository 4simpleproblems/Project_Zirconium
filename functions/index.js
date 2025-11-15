const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initializes the app using credentials automatically found when deployed
admin.initializeApp(); 

const db = admin.firestore();

// --- 1. Function to Notify Friends of a New Daily Post 📸 ---

/**
 * Triggers when a new document is created in the 'daily_photos' collection.
 * 1. Fetches the post creator's profile to find their 'friends' list.
 * 2. Fetches the FCM Token for each friend.
 * 3. Sends a notification to all friends.
 */
exports.notifyFriendsOfNewPost = functions.firestore
    .document('daily_photos/{postId}')
    .onCreate(async (snap, context) => {
        const post = snap.data();
        const creatorUid = post.creatorUid;
        const creatorUsername = post.creatorUsername || 'A friend';
        const postTitle = post.title || 'New Daily Photo';

        // 1. Get the creator's profile to find their friends list
        const creatorProfileRef = db.doc(`users/${creatorUid}`);
        const creatorProfileSnap = await creatorProfileRef.get();

        if (!creatorProfileSnap.exists) {
            console.error(`Creator profile not found for UID: ${creatorUid}`);
            return null;
        }

        const friendUids = creatorProfileSnap.data().friends || [];
        if (friendUids.length === 0) {
            console.log(`User ${creatorUid} has no friends to notify.`);
            return null;
        }
        
        // 2. Fetch all friend profiles to get their FCM tokens
        const friendTokens = [];
        // Firestore can only fetch up to 10 documents directly with a single call,
        // so we map the UIDs to references and use db.getAll() if possible.
        // For production apps with many friends, a more scalable fan-out approach 
        // using Firestore collections might be needed, but this works for now.
        const friendRefs = friendUids.slice(0, 499).map(uid => db.doc(`users/${uid}`));
        const friendSnapshots = await db.getAll(...friendRefs);

        friendSnapshots.forEach(snap => {
            // Assumes the FCM token is stored in the user profile document
            const token = snap.data()?.fcmToken;
            if (token) {
                friendTokens.push(token);
            }
        });

        if (friendTokens.length === 0) {
            console.log('No valid FCM tokens found for friends.');
            return null;
        }

        // 3. Define the notification payload
        const payload = {
            notification: {
                title: `${creatorUsername} posted a photo!`,
                body: postTitle,
                // Ensure this icon path is relative to the *root* of your domain for the service worker.
                icon: '/images/logo.png', 
            },
            data: {
                action: 'VIEW_POST',
                postId: snap.id,
            }
        };

        // 4. Send the message batch (FCM supports up to 500 tokens per multicast message)
        console.log(`Sending post notification to ${friendTokens.length} devices.`);
        
        return admin.messaging().sendEachForMulticast({
            tokens: friendTokens,
            ...payload
        });
    });

// --- 2. Function to Notify of Friend Request/Acceptance 🤝 ---

/**
 * Triggers when a user's profile is updated.
 * 1. Detects changes in 'pending_requests' (New Request).
 * 2. Detects changes in 'friends' (Request Accepted).
 */
exports.notifyFriendStatusChange = functions.firestore
    .document('users/{targetUid}')
    .onUpdate(async (change, context) => {
        const targetUid = context.params.targetUid;
        const beforeData = change.before.data();
        const afterData = change.after.data();

        // Helper function to find a new item added to an array
        const getNewItem = (arrayBefore, arrayAfter) => {
            const beforeSet = new Set(arrayBefore || []);
            const afterSet = new Set(arrayAfter || []);
            // Check if the size increased (item added)
            if (afterSet.size > beforeSet.size) {
                for (const item of afterSet) {
                    if (!beforeSet.has(item)) return item;
                }
            }
            return null;
        };
        
        // A) NEW FRIEND REQUEST RECEIVED (Notify the TARGET user)
        const newRequesterUid = getNewItem(
            beforeData.pending_requests, 
            afterData.pending_requests
        );

        if (newRequesterUid) {
            const requesterSnap = await db.doc(`users/${newRequesterUid}`).get();
            const requesterUsername = requesterSnap.data()?.username || 'Someone';
            const targetToken = afterData.fcmToken;
            
            if (targetToken) {
                const payload = {
                    notification: {
                        title: 'New Friend Request!',
                        body: `${requesterUsername} wants to be friends.`,
                        icon: '/images/logo.png',
                    },
                    data: {
                        action: 'VIEW_REQUESTS',
                    }
                };
                console.log(`Sending request notification to ${targetUid}.`);
                return admin.messaging().send({ token: targetToken, ...payload });
            }
        }
        
        // B) FRIEND REQUEST ACCEPTED (Notify the REQUESTER user)
        const newFriendUid = getNewItem(beforeData.friends, afterData.friends);

        // This watches the "accepter's" profile, but we need to notify the "requester" (newFriendUid).
        if (newFriendUid) {
             const accepterUsername = afterData.username || 'A friend';
             
             // Fetch the accepted friend's token
             const newFriendProfileSnap = await db.doc(`users/${newFriendUid}`).get();
             const newFriendToken = newFriendProfileSnap.data()?.fcmToken;
             
             if (newFriendToken) {
                 const payload = {
                     notification: {
                         title: 'Friend Request Accepted!',
                         body: `${accepterUsername} accepted your friend request.`,
                         icon: '/images/logo.png',
                     },
                     data: {
                         action: 'FRIEND_ACCEPTED',
                     }
                 };
                 console.log(`Sending acceptance notification to ${newFriendUid}.`);
                 return admin.messaging().send({ token: newFriendToken, ...payload });
             }
        }

        // If no relevant changes were found
        return null; 
    });
