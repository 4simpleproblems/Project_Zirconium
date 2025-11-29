import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
        import { 
            getAuth, 
            onAuthStateChanged, 
            signOut,
            EmailAuthProvider, 
            reauthenticateWithCredential, 
            updatePassword,
            // NEW AUTH IMPORTS
            GoogleAuthProvider,
            GithubAuthProvider,
            OAuthProvider,
            linkWithPopup,
            unlink,
            reauthenticateWithPopup,
            deleteUser
        } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
        import { 
            getFirestore, 
            doc, 
            getDoc, 
            updateDoc, 
            collection,
            query,
            where,
            getDocs,
            serverTimestamp,
            deleteDoc // NEW FIREBASE IMPORT
        } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
        
        // --- Import Firebase Config (Assumed to exist in a relative file) ---
        import { firebaseConfig } from "../firebase-config.js"; 
        
        // --- NEW: Import Site Mapping (from index.html logic) ---
        // This file MUST exist at ../site-mapping.js for import/export to work
        import { siteMapping } from "../site-mapping.js";


        if (!firebaseConfig || !firebaseConfig.apiKey) {
            console.error("FATAL ERROR: Firebase configuration is missing or invalid.");
        }

        // --- Firebase Initialization ---
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);

        // --- Global State and Element References ---
        const sidebarTabs = document.querySelectorAll('.settings-tab');
        const mainView = document.getElementById('settings-main-view');
        let currentUser = null; // To store the authenticated user object
        
        // --- NEW: Global var for loading overlay (from index.html) ---
        let loadingTimeout = null;
        
        // Constants for validation and limits
        const MIN_LENGTH = 6; 
        const MAX_LENGTH = 24;
        const MAX_CHANGES = 5; 


        // Tab Content Data Structure (can be expanded later)
        const tabContent = {
            'general': { title: 'General Settings', icon: 'fa-gear' },
            'privacy': { title: 'Privacy & Security', icon: 'fa-shield-halved' },
            'personalization': { title: 'Personalization', icon: 'fa-palette' },
            'data': { title: 'Data Management', icon: 'fa-database' },
            'about': { title: 'About 4SP', icon: 'fa-circle-info' },
        };
        
        // Constants for providers (NEW)
        const PROVIDER_CONFIG = {
            'google.com': { 
                name: 'Google', 
                icon: '../images/google-icon.png', 
                instance: () => new GoogleAuthProvider() 
            },
            'github.com': { 
                name: 'GitHub', 
                icon: '../images/github-mark-white.png', 
                instance: () => new GithubAuthProvider() 
            },
            'microsoft.com': { 
                name: 'Microsoft', 
                icon: '../images/microsoft.png', 
                instance: () => new OAuthProvider('microsoft.com') 
            },
            'twitter.com': { // NEW: X (Twitter) Provider
                name: 'X (Twitter)',
                icon: '../images/x.png',
                instance: () => new OAuthProvider('twitter.com')
            },
            'password': { 
                name: 'Email & Password', 
                icon: '<i class="fa-solid fa-at fa-lg mr-3"></i>', 
                isCredential: true
            }
        };

        // --- NEW: Constants for Privacy Settings ---
        
        // IndexedDB Config for Panic Key
        const DB_NAME = 'userLocalSettingsDB';
        const STORE_NAME = 'panicKeyStore';
        
        // localStorage Key for URL Changer
        const URL_CHANGER_KEY = 'selectedUrlPreset';
        
        // --- NEW: Constant for Theme Storage ---
        // (Copied from navigation.js)
        const THEME_STORAGE_KEY = 'user-navbar-theme';


        // Presets copied from url-changer.js
        const urlChangerPresets = [
            { id: 'hac', name: 'HAC', title: 'Login', favicon: '../favicons/hac.png', category: 'websites' },
            { id: 'gmm', name: 'GMM', title: 'Get More Math!', favicon: '../favicons/gmm.png', category: 'websites' },
            { id: 'kahoot', name: 'Kahoot', title: 'Kahoot! | Learning games | Make learning awesome!', favicon: '../favicons/kahoot.png', category: 'websites' },
            { id: 'g_classroom', name: 'Google Classroom', title: 'Home', favicon: '../favicons/google-classroom.png', category: 'websites' },
            { id: 'g_docs', name: 'Google Docs', title: 'Google Docs', favicon: '../favicons/google-docs.png', category: 'websites' },
            { id: 'g_slides', name: 'Google Slides', title: 'Google Slides', favicon: '../favicons/google-slides.png', category: 'websites' },
            { id: 'g_drive', name: 'Google Drive', title: 'Home - Google Drive', favicon: '../favicons/google-drive.png', category: 'websites' },
            { id: 'wikipedia', name: 'Wikipedia', title: 'Wikipedia', favicon: '../favicons/wikipedia.png', category: 'websites' },
            { id: 'clever', name: 'Clever', title: 'Clever | Connect every student to a world of learning', favicon: '../favicons/clever.png', category: 'websites' },
            { id: '_LIVE_CURRENT_TIME', name: 'Current Time', title: 'Live Time', favicon: '', category: 'live', live: true }
        ];

        
        // --- Shared Helper Functions ---
        const getUserDocRef = (userId) => doc(db, 'users', userId);
        
        const showMessage = (element, text, type = 'error') => {
            // Prevent clearing a success message if a warning is generated elsewhere
            if (element && element.innerHTML.includes('success') && type !== 'error') return;
            if (element) {
                element.innerHTML = text;
                element.className = `general-message-area text-sm ${type}-message`;
            }
        };
        
        const checkProfanity = async (text) => {
            try {
                const response = await fetch(`https://www.purgomalum.com/service/containsprofanity?text=${encodeURIComponent(text)}`);
                const result = await response.text();
                return result.toLowerCase() === 'true';
            } catch (error) { console.error('Profanity API error:', error); return false; }
        };

        const isUsernameTaken = async (username) => {
            const q = query(collection(db, 'users'), where('username', '==', username));
            const querySnapshot = await getDocs(q);
            return !querySnapshot.empty;
        };
        
        // --- NEW: IndexedDB Helper Functions ---

        /**
         * Opens the IndexedDB and creates the object store if needed.
         */
        function openDB() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME);
                request.onupgradeneeded = event => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    }
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }
        
        /**
         * Fetches all panic key settings from IndexedDB.
         */
        async function getPanicKeySettings() {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.getAll();
                request.onsuccess = () => {
                    const settingsMap = new Map(request.result.map(item => [item.id, item]));
                    db.close();
                    resolve(settingsMap);
                };
                request.onerror = () => {
                     db.close();
                    reject(request.error);
                };
            });
        }
        
        /**
         * Saves panic key settings to IndexedDB.
         */
        async function savePanicKeySettings(settingsArray) {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                
                let completed = 0;
                const total = settingsArray.length;

                settingsArray.forEach(setting => {
                    const request = store.put(setting);
                    request.onsuccess = () => {
                        completed++;
                        if (completed === total) {
                            db.close();
                            resolve();
                        }
                    };
                    request.onerror = () => {
                         db.close();
                        reject(request.error); // Stop on first error
                    };
                });
                
                // Handle case where array is empty
                if (total === 0) {
                     db.close();
                    resolve();
                }
            });
        }

        // --- NEW: localStorage Helper Functions ---
        
        function getSavedUrlChangerSetting() {
            const savedSettingsJSON = localStorage.getItem(URL_CHANGER_KEY);
            let savedSettings = { type: 'none' };
            if (savedSettingsJSON) {
                try { 
                    savedSettings = JSON.parse(savedSettingsJSON); 
                } catch (e) { 
                    console.error("Failed to parse saved tab settings, reverting to default.", e); 
                } 
            }
            return savedSettings;
        }

        function saveUrlChangerSetting(settings) {
            try {
                localStorage.setItem(URL_CHANGER_KEY, JSON.stringify(settings));
                return true;
            } catch (e) {
                console.error("Failed to save URL changer settings:", e);
                return false;
            }
        }
        
        // --- NEW: Modal and Loading Functions (from index.html) ---
        
        function openModal(text, buttons = []) {
            const modal = document.getElementById('modalPrompt');
            const modalText = document.getElementById('modalText');
            const modalButtons = document.getElementById('modalButtons');
            
            modalText.textContent = text;
            modalButtons.innerHTML = "";
            buttons.forEach(btn => {
                const buttonEl = document.createElement("button");
                // MODIFICATION: Use settings page button styles
                buttonEl.className = "btn-toolbar-style";
                if (btn.text.toLowerCase() === 'yes') {
                    buttonEl.classList.add('btn-primary-override-danger'); // Make 'Yes' destructive
                } else {
                    buttonEl.classList.add('btn-primary-override');
                }
                buttonEl.textContent = btn.text;
                buttonEl.onclick = btn.onclick;
                modalButtons.appendChild(buttonEl);
            });
            modal.style.display = "flex";
        }
        
        function showLoading(text = "Loading...") {
            const loadingOverlay = document.getElementById('loadingOverlay');
            const loadingText = document.getElementById('loadingText');
            
            loadingText.textContent = text;
            loadingOverlay.style.display = "flex";
            loadingOverlay.classList.add("active");
            if (loadingTimeout) clearTimeout(loadingTimeout);
            loadingTimeout = setTimeout(() => {
                hideLoading();
            }, 5000); // 5 second timeout
        }

        function hideLoading() {
            const loadingOverlay = document.getElementById('loadingOverlay');
            if (loadingTimeout) {
                clearTimeout(loadingTimeout);
                loadingTimeout = null;
            }
            loadingOverlay.classList.remove("active");
            loadingOverlay.style.display = "none";
        }
        
        // --- NEW: Core Data Functions (from index.html) ---
        
        function getAllLocalStorageData() {
            const data = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                // Skip theme key
                if (key === THEME_STORAGE_KEY) continue;
                // Skip URL changer key
                if (key === URL_CHANGER_KEY) continue;
                
                const value = localStorage.getItem(key);
                data[key] = value;
            }
            return data;
        }

        function setAllLocalStorageData(data) {
            // Don't clear *everything*, just the keys in the data
            // This avoids wiping the user's theme setting
            for (const [key, value] of Object.entries(data)) {
                localStorage.setItem(key, value);
            }
        }

        async function getAllIndexedDBData() {
            if (!indexedDB.databases) return {};
            let dbList = [];
            try {
                dbList = await indexedDB.databases();
            } catch (error) {
                console.error("Error fetching IndexedDB databases:", error);
                return {};
            }
            const result = {};
            for (const dbInfo of dbList) {
                if (!dbInfo.name) continue;
                // Skip our own settings DB
                if (dbInfo.name === DB_NAME) continue; 
                
                result[dbInfo.name] = await getDataFromDatabase(dbInfo.name);
            }
            return result;
        }

        function getDataFromDatabase(dbName) {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(dbName);
                request.onsuccess = event => {
                    const db = event.target.result;
                    const storeNames = Array.from(db.objectStoreNames);
                    const dbData = {};
                    let pending = storeNames.length;
                    if (pending === 0) {
                        db.close();
                        resolve(dbData);
                        return;
                    }
                    storeNames.forEach(storeName => {
                        const transaction = db.transaction(storeName, "readonly");
                        const store = transaction.objectStore(storeName);
                        const items = [];
                        const cursorRequest = store.openCursor();
                        cursorRequest.onsuccess = evt => {
                            const cursor = evt.target.result;
                            if (cursor) {
                                items.push({ key: cursor.key, value: cursor.value });
                                cursor.continue();
                            } else {
                                dbData[storeName] = items;
                                pending--;
                                if (pending === 0) {
                                    db.close();
                                    resolve(dbData);
                                }
                            }
                        };
                        cursorRequest.onerror = evt => {
                            pending--;
                            if (pending === 0) {
                                db.close();
                                resolve(dbData);
                            }
                        };
                    });
                };
                request.onerror = event => {
                    reject(event.target.error);
                };
            });
        }

        async function setAllIndexedDBData(indexedData) {
            for (const dbName in indexedData) {
                const storesData = indexedData[dbName];
                await new Promise(resolve => {
                    const deleteRequest = indexedDB.deleteDatabase(dbName);
                    deleteRequest.onsuccess = () => resolve();
                    deleteRequest.onerror = () => resolve();
                    deleteRequest.onblocked = () => resolve();
                });
                const openRequest = indexedDB.open(dbName, 1);
                openRequest.onupgradeneeded = function (event) {
                    const db = event.target.result;
                    for (const storeName in storesData) {
                        if (!db.objectStoreNames.contains(storeName)) {
                            db.createObjectStore(storeName, { autoIncrement: false });
                        }
                    }
                };
                const dbInstance = await new Promise((resolve, reject) => {
                    openRequest.onsuccess = event => {
                        resolve(event.target.result);
                    };
                    openRequest.onerror = event => {
                        reject(event.target.error);
                    };
                });
                for (const storeName in storesData) {
                    await new Promise(resolve => {
                        const transaction = dbInstance.transaction(storeName, "readwrite");
                        transaction.oncomplete = () => resolve();
                        transaction.onerror = () => resolve();
                        const store = transaction.objectStore(storeName);
                        const clearRequest = store.clear();
                        clearRequest.onsuccess = async () => {
                            for (const record of storesData[storeName]) {
                                await new Promise(r => {
                                    const putRequest = store.put(record.value, record.key);
                                    putRequest.onsuccess = () => r();
                                    putRequest.onerror = () => r();
                                });
                            }
                        };
                    });
                }
                dbInstance.close();
            }
        }
        
        // --- NEW: Domain Key Functions (from index.html) ---
        
        function getCurrentSiteKey() {
            const currentURL = window.location.href;
            const keys = Object.keys(siteMapping);
            keys.sort((a, b) => b.length - a.length);
            for (const key of keys) {
                const normalizedKey = key.replace(/^https?:\/\//, ""); // Fixed regex: removed '\]' and correctly escaped '/'
                if (currentURL.includes(normalizedKey)) {
                    return normalizedKey;
                }
            }
            return window.location.host + window.location.pathname.replace(/\/$/, ""); // Fixed regex: correctly escaped '/'
        }
        
        function normalizeDomainKey(str) {
            return str.replace(/^https?:\/\//, "").replace(/\/$/, ""); // Fixed regex: removed '\]' and correctly escaped '/'
        }
        
        function replaceDomainsInData(dataObj, currentDomain) {
            const currentDomainKey = getCurrentSiteKey(); // Get current domain
            const keysToCheck = Object.keys(siteMapping).map(k => normalizeDomainKey(k));
            const normalizedCurrentDomain = normalizeDomainKey(currentDomainKey);

            function replaceInString(str) {
                for (const oldDomain of keysToCheck) {
                    if (str.includes(oldDomain)) {
                        const idx = str.indexOf(oldDomain);
                        if (idx === 0) {
                            return normalizedCurrentDomain + str.substring(oldDomain.length);
                        } else {
                            return str.replace(oldDomain, normalizedCurrentDomain);
                        }
                    }
                }
                return str;
            }
            
            // Check if dataObj is the root object {localStorageBackup: ..., indexedDBBackup: ...}
            if (dataObj.localStorageBackup || dataObj.indexedDBBackup) {
                 if (dataObj.localStorageBackup) {
                    const localObj = dataObj.localStorageBackup;
                     for (const k in localObj) {
                        const newKey = replaceInString(k);
                        let newVal = localObj[k];
                        if (typeof newVal === "string") {
                            newVal = replaceInString(newVal);
                        }
                        if (newKey !== k) {
                            delete localObj[k];
                            localObj[newKey] = newVal;
                        } else {
                            localObj[k] = newVal;
                        }
                    }
                 }
                 // Note: IndexedDB data is less likely to contain domain keys in its structure
                 // so we primarily focus on localStorage keys and values.
            }
        }
        
        // --- NEW: Import/Export Handlers (from index.html) ---
        
        async function downloadAllSaves() {
            showLoading("Preparing download...");
            const localData = getAllLocalStorageData();
            const indexedData = await getAllIndexedDBData();
            const dataToDownload = {
                localStorageBackup: localData,
                indexedDBBackup: indexedData,
            };
            hideLoading();
            const blob = new Blob([JSON.stringify(dataToDownload, null, 2)], {
                type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "4sp_saves.json"; // Changed name
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        }

        function handleFileUpload() {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".json";
            input.onchange = async e => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async evt => {
                    const content = evt.target.result;
                    let parsed;
                    try {
                        parsed = JSON.parse(content);
                    } catch (err) {
                        alert("Invalid file format");
                        return;
                    }
                    
                    // This is the domain key logic from index.html
                    replaceDomainsInData(parsed, ""); // Pass empty string, replaceDomainsInData will get it

                    openModal(
                        "Are you sure you would like to upload this save? It will overwrite all current local data.",
                        [
                            {
                                text: "Yes",
                                onclick: async () => {
                                    modal.style.display = "none";
                                    showLoading("Uploading save...");
                                    
                                    let loadedLocalData = parsed.localStorageBackup;
                                    let loadedIndexedData = parsed.indexedDBBackup;

                                    if (loadedLocalData)
                                        setAllLocalStorageData(loadedLocalData);
                                    if (loadedIndexedData)
                                        await setAllIndexedDBData(loadedIndexedData);
                                        
                                    hideLoading();
                                    alert("Upload complete! Refreshing the page...");
                                    setTimeout(() => location.reload(), 1000);
                                },
                            },
                            {
                                text: "No",
                                onclick: () => {
                                    modal.style.display = "none";
                                },
                            },
                        ]
                    );
                };
                reader.readAsText(file);
            };
            input.click();
        }

        /**
         * Generates the HTML for the "Change Password" section.
         */
        function getChangePasswordSection() {
            return `
                <h3 class="text-xl font-bold text-white mb-2 mt-8">Change Password</h3>
                <div id="passwordChangeSection" class="settings-box w-full p-4">
                    <p class="text-sm font-light text-gray-400 mb-3">
                        Change your password. You must provide your current password for security.
                    </p>
                    
                    <div class="flex flex-col gap-3">
                        <input type="password" id="currentPasswordInput" placeholder="Current Password" class="input-text-style">
                        <input type="password" id="newPasswordInput" placeholder="New Password (min 6 characters)" class="input-text-style">
                        <input type="password" id="confirmPasswordInput" placeholder="Confirm New Password" class="input-text-style">
                    </div>
                    
                    <div class="flex justify-between items-center pt-4">
                        <p id="passwordMessage" class="general-message-area text-sm"></p>
                        <button id="applyPasswordBtn" class="btn-toolbar-style btn-primary-override w-32" disabled style="padding: 0.5rem 0.75rem;">
                            <i class="fa-solid fa-lock mr-1"></i> Apply
                        </button>
                    </div>
                </div>
            `;
        }
        
        /**
         * Renders the Linked Providers and Account Deletion section.
         */
        function getAccountManagementContent(providerData) {
            // Determine the Primary Provider (the first one in the list)
            const primaryProviderId = providerData && providerData.length > 0 ? providerData[0].providerId : null;
            
            let linkedProvidersHtml = providerData.map(info => {
                const id = info.providerId;
                const config = PROVIDER_CONFIG[id] || { name: id, icon: '<i class="fa-solid fa-puzzle-piece fa-lg mr-3"></i>' };
                
                const isPrimary = (id === primaryProviderId); // Check if this is the primary provider
                const canUnlink = providerData.length > 1 && !(id === 'password' && primaryProviderId === 'password');
                
                // NEW: Determine if "Set as Primary" button should be shown
                // Show if no primary is explicitly set, it's not the current primary, and it's not the password provider.
                const showSetPrimaryButton = !isPrimary && primaryProviderId === null && id !== 'password';

                // Determine if icon is an image or a FontAwesome icon
                let iconHtml = config.icon.startsWith('<i') ? config.icon : `<img src="${config.icon}" alt="${config.name} Icon" class="w-6 h-6 mr-3">`;

                return `
                    <div class="flex justify-between items-center px-4 py-4 border-b border-[#252525] last:border-b-0">
                        <div class="flex items-center text-lg text-white">
                            ${iconHtml}
                            ${config.name}
                            ${isPrimary ? '<span class="text-xs text-yellow-400 ml-2 font-normal">(Primary)</span>' : ''}
                        </div>
                        <div class="flex items-center gap-2"> <!-- Container for buttons -->
                            ${showSetPrimaryButton ? 
                                `<button class="btn-toolbar-style btn-primary-override" data-provider-id="${id}" data-action="set-primary" style="padding: 0.5rem 0.75rem;">
                                    <i class="fa-solid fa-star mr-1"></i> Set Primary
                                </button>` : ''
                            }
                            ${canUnlink ? 
                                `<button class="btn-toolbar-style text-red-400 hover:border-red-600 hover:text-red-600" data-provider-id="${id}" data-action="unlink" style="padding: 0.5rem 0.75rem;">
                                    <i class="fa-solid fa-unlink mr-1"></i> Unlink
                                </button>` : 
                                // Show "Cannot Unlink" if not able to unlink (e.g., it's the only provider, or it's password and primary)
                                (providerData.length === 1 || (id === 'password' && primaryProviderId === 'password')) ? 
                                    `<span class="text-xs text-custom-light-gray font-light ml-4">Cannot Unlink</span>` : ''
                            }
                        </div>
                    </div>
                `;
            }).join('');

            // Filter out already linked social providers for the linking list
            const linkedIds = providerData.map(p => p.providerId);
            let availableProvidersHtml = Object.keys(PROVIDER_CONFIG)
                .filter(id => id !== 'password' && !linkedIds.includes(id))
                .map(id => {
                    const config = PROVIDER_CONFIG[id];
                    let iconHtml = config.icon.startsWith('<i') ? config.icon : `<img src="${config.icon}" alt="${config.name} Icon" class="w-6 h-6 mr-3">`;

                    return `
                        <div class="flex justify-between items-center px-4 py-4 border-b border-[#252525] last:border-b-0">
                            <div class="flex items-center text-lg text-white">
                                ${iconHtml}
                                ${config.name}
                            </div>
                            <button class="btn-toolbar-style btn-primary-override" data-provider-id="${id}" data-action="link" style="padding: 0.5rem 0.75rem;">
                                <i class="fa-solid fa-link mr-1"></i> Link Provider
                            </button>
                        </div>
                    `;
                }).join('');
                
            if (availableProvidersHtml === '') {
                availableProvidersHtml = `
                    <div class="px-4 py-4">
                        <p class="text-sm text-gray-500 text-center">All available social providers are linked.</p>
                    </div>
                `;
            }


            // --- Account Deletion Section ---
            let deletionContent = '';
            
            if (!primaryProviderId) { // No primary provider found
                deletionContent = `
                    <h3 class="text-xl font-bold text-white mb-2 mt-8">Delete Account</h3>
                    <div id="deletionSection" class="settings-box w-full bg-red-900/10 border-red-700/50 p-4">
                        <p class="text-sm font-light text-red-300 mb-3">
                            <i class="fa-solid fa-triangle-exclamation mr-1"></i> 
                            WARNING: Deleting your account is permanent. No primary authentication method found. Please contact support.
                        </p>
                    </div>
                `;
            } else if (primaryProviderId === 'password') {
                deletionContent = `
                    <h3 class="text-xl font-bold text-white mb-2 mt-8">Delete Account</h3>
                    <div id="deletionSection" class="settings-box w-full bg-red-900/10 border-red-700/50 p-4">
                        <p class="text-sm font-light text-red-300 mb-3">
                            <i class="fa-solid fa-triangle-exclamation mr-1"></i> 
                            WARNING: Deleting your account is permanent and cannot be undone.
                        </p>
                        
                        <div id="passwordDeletionStep1">
                            <label for="deletePasswordInput" class="block text-red-300 text-sm font-light mb-2">Confirm Current Password</label>
                            <input type="password" id="deletePasswordInput" placeholder="Current Password" class="input-text-style w-full bg-red-900/20 border-red-700/50 mb-3">
                            
                            <label for="deleteConfirmText" class="block text-red-300 text-sm font-light mb-2">Type "Delete My Account" to confirm (Case-insensitive)</label>
                            <input type="text" id="deleteConfirmText" placeholder="Delete My Account" class="input-text-style w-full bg-red-900/20 border-red-700/50">
                            
                            <div class="flex justify-between items-center pt-4">
                                <p id="deleteMessage" class="general-message-area text-sm"></p>
                                <button id="finalDeleteBtn" class="btn-toolbar-style btn-primary-override-danger w-48" disabled style="padding: 0.5rem 0.75rem;">
                                     <i class="fa-solid fa-trash mr-1"></i> Delete Account
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                deletionContent = `
                    <h3 class="text-xl font-bold text-white mb-2 mt-8">Delete Account</h3>
                    <div id="deletionSection" class="settings-box w-full bg-red-900/10 border-red-700/50 p-4">
                        <p class="text-sm font-light text-red-300 mb-3">
                            <i class="fa-solid fa-triangle-exclamation mr-1"></i> 
                            WARNING: Deleting your account is permanent. You must re-authenticate with ${PROVIDER_CONFIG[primaryProviderId].name} to proceed.
                        </p>
                        
                        <div class="flex justify-between items-center pt-2">
                            <p id="deleteMessage" class="general-message-area text-sm"></p>
                            <button id="reauthenticateBtn" class="btn-toolbar-style w-48 btn-primary-override" data-provider-id="${primaryProviderId}" style="padding: 0.5rem 0.75rem;">
                                 <i class="fa-solid fa-key mr-1"></i> Re-authenticate
                            </button>
                            <button id="finalDeleteBtn" class="btn-toolbar-style btn-primary-override-danger w-48 hidden" style="padding: 0.5rem 0.75rem;">
                                 <i class="fa-solid fa-trash mr-1"></i> Delete Account
                            </button>
                        </div>
                    </div>
                `;
            }

            // --- Combined HTML for Account Management ---
            return `
                <h3 class="text-xl font-bold text-white mb-2 mt-8">Linked Providers</h3>
                <div class="settings-box w-full mb-4 p-0" data-section="linked-providers">
                    ${linkedProvidersHtml}
                </div>
                
                <h3 class="text-xl font-bold text-white mb-2">Link New Providers</h3>
                <div class="settings-box w-full flex flex-col gap-0 p-0">
                    ${availableProvidersHtml}
                </div>
                
                ${deletionContent}
            `;
        }


        /**
         * Generates the HTML for the "General Settings" section.
         */
        function getGeneralContent(currentUsername, changesRemaining, changesThisMonth, currentMonthName, isEmailPasswordUser, providerData) {
             const changesUsed = changesThisMonth;
             
             // Conditionally generate the password section HTML
             let passwordSectionHtml = '';
             if (isEmailPasswordUser) {
                 passwordSectionHtml = getChangePasswordSection();
             }

             return `
                 <h2 class="text-3xl font-bold text-white mb-6">General Settings</h2>
                 
                 <div class="w-full">
                    
                    <div class="flex justify-between items-center mb-4 settings-box p-4">
                        <p class="text-sm font-light text-gray-300">
                           <i class="fa-solid fa-calendar-alt mr-2 text-yellow-500"></i>
                           Changes this month (<span class="text-emphasis text-yellow-300">${currentMonthName}</span>):
                        </p>
                        <span class="text-lg font-semibold ${changesRemaining > 0 ? 'text-green-400' : 'text-red-400'}">
                            ${changesUsed}/${MAX_CHANGES} used
                        </span>
                    </div>

                    <h3 class="text-xl font-bold text-white mb-2">Account Username</h3>
                    
                    <div id="usernameSection" class="settings-box transition-all duration-300 p-4">
                        
                        <div id="viewMode" class="flex justify-between items-center">
                            <p class="text-lg text-gray-400 leading-relaxed">
                                Current: <span id="currentUsernameText" class="text-emphasis text-blue-400">${currentUsername}</span>
                            </p>
                            <button id="enterEditModeBtn" class="btn-toolbar-style" style="padding: 0.5rem 0.75rem;">
                                 <i class="fa-solid fa-pen-to-square mr-1"></i> Change
                            </button>
                        </div>

                        <div id="editMode" class="hidden flex-col gap-3 pt-4 border-t border-[#252525]">
                            <label for="newUsernameInput" class="block text-gray-400 text-sm font-light">New Username</label>
                            <input type="text" id="newUsernameInput" value="${currentUsername}" maxlength="${MAX_LENGTH}"
                                   class="input-text-style w-full" 
                                   placeholder="${MIN_LENGTH}-${MAX_LENGTH} characters, only allowed symbols">
                            
                            <div class="flex justify-between items-center pt-2">
                                <p class="text-xs text-gray-500 font-light whitespace-nowrap">
                                    Length: <span id="minLength" class="font-semibold text-gray-400">${MIN_LENGTH}</span>/<span id="charCount" class="font-semibold text-gray-400">${currentUsername.length}</span>/<span id="maxLength" class="font-semibold text-gray-400">${MAX_LENGTH}</span>
                                </p>
                                
                                <div class="flex gap-2">
                                    <button id="applyUsernameBtn" class="btn-toolbar-style btn-primary-override w-24 transition-opacity duration-300" disabled style="padding: 0.5rem 0.75rem;">
                                        <i class="fa-solid fa-check"></i> Apply
                                    </button>
                                    <button id="cancelEditBtn" class="btn-toolbar-style w-24 transition-opacity duration-300" style="padding: 0.5rem 0.75rem;">
                                        <i class="fa-solid fa-xmark"></i> Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div id="usernameChangeMessage" class="general-message-area text-sm"></div>
                </div>
                
                ${passwordSectionHtml}
                
                ${getAccountManagementContent(providerData)}
             `;
         }

        /**
         * NEW: Generates the HTML for the "Privacy & Security" section.
         */
        function getPrivacyContent() {
            // Generate preset options
            const presetOptions = urlChangerPresets.map(preset => 
                `<option value="${preset.id}">${preset.name}</option>`
            ).join('');

            return `
                <h2 class="text-3xl font-bold text-white mb-6">Privacy & Security</h2>
                
                <div class="w-full">
                    <h3 class="text-xl font-bold text-white mb-2">Panic Key Settings</h3>
                    <div id="panicKeySection" class="settings-box transition-all duration-300 p-4">
                        <p class="text-sm font-light text-gray-400 mb-4">
                            Configure up to 3 panic keys. Pressing the specified key (without Shift, Ctrl, or Alt) on any page will redirect you to the URL you set.
                            <br>
                            <span class="text-yellow-400">Valid keys:</span> a-z, 0-9, and \` - = [ ] \ \ ; ' , . /
                        </p>
                        
                        <div class="flex items-center gap-4 px-2 mb-2">
                            <label class="block text-gray-400 text-sm font-light" style="width: 4rem; text-align: center;">Key</label>
                            <label class="block text-gray-400 text-sm font-light flex-grow">Redirect URL</label>
                        </div>

                        <div class="flex items-center gap-4 mb-3">
                            <input type="text" id="panicKey1" data-key-id="1" class="input-key-style panic-key-input" placeholder="-" maxlength="1">
                            <input type="url" id="panicUrl1" class="input-text-style" placeholder="e.g., https://google.com">
                        </div>
                        
                        <div class="flex items-center gap-4 mb-3">
                            <input type="text" id="panicKey2" data-key-id="2" class="input-key-style panic-key-input" placeholder="-" maxlength="1">
                            <input type="url" id="panicUrl2" class="input-text-style" placeholder="e.g., https://youtube.com/feed/subscriptions">
                        </div>
                        
                        <div class="flex items-center gap-4 mb-3">
                            <input type="text" id="panicKey3" data-key-id="3" class="input-key-style panic-key-input" placeholder="-" maxlength="1">
                            <input type="url" id="panicUrl3" class="input-text-style" placeholder="e.g., https://wikipedia.org">
                        </div>
                        
                        <div class="flex justify-between items-center pt-4 border-t border-[#252525]">
                            <p id="panicKeyMessage" class="general-message-area text-sm"></p>
                            <button id="applyPanicKeyBtn" class="btn-toolbar-style btn-primary-override w-36" style="padding: 0.5rem 0.75rem;">
                                <i class="fa-solid fa-check mr-1"></i> Apply Keys
                            </button>
                        </div>
                    </div>
                    
                    <div id="panicKeyGlobalMessage" class="general-message-area text-sm"></div>
                </div>
                
                <div class="w-full mt-8">
                    <h3 class="text-xl font-bold text-white mb-2">Tab Disguise (URL Changer)</h3>
                    <div id="urlChangerSection" class="settings-box transition-all duration-300 p-4">
                        <p class="text-sm font-light text-gray-400 mb-4">
                            Change the title and favicon of the website to disguise it. This setting is saved locally in your browser.
                        </p>
                        
                        <div class="flex flex-col gap-4">
                            <div>
                                <label for="tabDisguiseMode" class="block text-gray-400 text-sm font-light mb-2">Mode</label>
                                <select id="tabDisguiseMode" class="input-select-style">
                                    <option value="none">None (Use 4SP Default)</option>
                                    <option value="preset">Use a Preset</option>
                                    <option value="custom">Use Custom Title/Favicon</option>
                                </select>
                            </div>
                            
                            <div id="tabDisguisePresetGroup" class="hidden">
                                <label for="tabDisguisePreset" class="block text-gray-400 text-sm font-light mb-2">Preset</label>
                                <select id="tabDisguisePreset" class="input-select-style">
                                    ${presetOptions}
                                </select>
                            </div>
                            
                            <div id="tabDisguiseCustomGroup" class="hidden flex flex-col gap-4">
                                <div>
                                    <label for="customTabTitle" class="block text-gray-400 text-sm font-light mb-2">Custom Title</label>
                                    <input type="text" id="customTabTitle" class="input-text-style" placeholder="e.g., Google Docs">
                                </div>
                                
                                <div class="form-group">
                                    <label for="faviconFetchInput" class="block text-gray-400 text-sm font-light mb-2">Custom Favicon (Fetch from Domain)</label>
                                    <div class="flex items-center gap-2">
                                        <input type="text" id="faviconFetchInput" class="input-text-style" placeholder="e.g., google.com">
                                        <button type="button" id="fetchFaviconBtn" class="btn-toolbar-style btn-primary-override w-28" style="padding: 0.5rem 0.75rem;">Fetch</button>
                                        <div id="favicon-fetch-preview-container" class="w-10 h-10 border border-[#252525] bg-[#111111] rounded-md flex items-center justify-center p-1 flex-shrink-0">
                                            <img src="" alt="Preview" class="w-full h-full object-contain" style="display: none;">
                                        </div>
                                    </div>
                                </div>
                                </div>
                        </div>

                        <div class="flex justify-between items-center pt-4 mt-4 border-t border-[#252525]">
                            <p id="urlChangerMessage" class="general-message-area text-sm"></p>
                            <button id="applyUrlChangerBtn" class="btn-toolbar-style btn-primary-override w-36" style="padding: 0.5rem 0.75rem;">
                                <i class="fa-solid fa-check mr-1"></i> Apply Tab
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

        
        /**
         * NEW: Generates the HTML for the "Personalization" section.
         */
        function getPersonalizationContent() {
             return `
                <style>
                    /* Custom Range Slider Styling */
                    .mac-slider {
                        -webkit-appearance: none;
                        appearance: none;
                        background: transparent; /* Track color handled by Tailwind classes */
                    }
                    .mac-slider::-webkit-slider-thumb {
                        -webkit-appearance: none;
                        appearance: none;
                        width: 20px;
                        height: 20px;
                        background: black;
                        border: 2px solid white;
                        border-radius: 50%;
                        cursor: pointer;
                        margin-top: -6px; /* Adjust based on track height */
                    }
                    .mac-slider::-moz-range-thumb {
                        width: 20px;
                        height: 20px;
                        background: black;
                        border: 2px solid white;
                        border-radius: 50%;
                        cursor: pointer;
                    }
                    .mac-slider::-webkit-slider-runnable-track {
                        height: 0.5rem;
                        border-radius: 0.5rem;
                        background: #374151; /* gray-700 */
                    }
                    .mac-slider::-moz-range-track {
                        height: 0.5rem;
                        border-radius: 0.5rem;
                        background: #374151;
                    }
                    /* Live preview scaling for orientation mode */
                    .mac-preview-scaled {
                        transition: transform 0.3s ease;
                        transform-origin: center;
                    }
                </style>
                <h2 class="text-3xl font-bold text-white mb-6">Personalization</h2>
                
                <div class="w-full">
                    <!-- PROFILE PICTURE SECTION -->
                    <h3 class="text-xl font-bold text-white mb-2">Profile Picture</h3>
                    <div id="pfpSection" class="settings-box transition-all duration-300 p-4 mb-8">
                        <p class="text-sm font-light text-gray-400 mb-4">
                            Choose how you appear across the site.
                        </p>
                        
                        <div class="flex flex-col gap-4">
                            <!-- Mode Selection Dropdown -->
                            <div>
                                <label for="pfpModeSelect" class="block text-gray-400 text-sm font-light mb-2">Display Mode</label>
                                <select id="pfpModeSelect" class="input-select-style">
                                    <option value="google">Use Google Profile Picture</option>
                                    <option value="mibi">Use Mibi Avatar</option>
                                    <option value="custom">Upload Custom Image</option>
                                </select>
                            </div>

                            <!-- Mibi Avatar Settings (Hidden by default) -->
                            <div id="pfpMibiSettings" class="hidden flex flex-col gap-4 mt-2">
                                <p class="text-sm font-light text-gray-400 mb-4">
                                    Create your custom Mibi Avatar!
                                </p>
                                <button id="open-mac-menu-btn" class="btn-toolbar-style btn-primary-override">
                                    <i class="fa-solid fa-paintbrush mr-2"></i> Open Mibi Avatar Creator
                                </button>
                                
                                <!-- MAC Modal -->
                                <div id="mibi-mac-menu" class="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 hidden backdrop-blur-sm">
                                    <div class="relative bg-black rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden border border-[#333]">
                                        
                                        <!-- Header -->
                                        <div class="flex justify-between items-center p-6 border-b border-[#333] bg-black">
                                            <h3 class="text-2xl font-bold text-white">Mibi Avatar Creator</h3>
                                            <button id="mac-close-x-btn" class="btn-toolbar-style w-10 h-10 flex items-center justify-center p-0">
                                                <i class="fa-solid fa-xmark fa-xl"></i>
                                            </button>
                                        </div>
                                        
                                        <!-- Main Content Area (Split View) -->
                                        <div class="flex flex-grow overflow-hidden relative">
                                            
                                            <!-- LEFT: Live Preview -->
                                            <div id="mac-preview-wrapper" class="w-1/2 flex flex-col items-center justify-center bg-[#0a0a0a] p-8 border-r border-[#333] transition-all duration-500 ease-in-out z-10">
                                                <div class="relative h-64 md:h-80 aspect-square rounded-full overflow-hidden border-4 border-[#333] shadow-lg mb-6 transition-all duration-300 hover:border-dashed hover:border-white cursor-pointer flex-shrink-0" id="mac-preview-container" style="aspect-ratio: 1/1;">
                                                    <!-- Background (Static) -->
                                                    <div id="mac-preview-bg" class="absolute inset-0 w-full h-full transition-colors duration-300"></div>
                                                    
                                                    <!-- Avatar Layers Container (Rotates/Scales/Moves) -->
                                                    <div id="mac-layers-container" class="absolute inset-0 w-full h-full transition-transform duration-75 ease-out origin-center pointer-events-none">
                                                        <img id="mac-layer-head" src="../mibi-avatars/head.png" class="absolute inset-0 w-full h-full object-contain z-10">
                                                        <img id="mac-layer-eyes" class="absolute inset-0 w-full h-full object-contain z-20 hidden">
                                                        <img id="mac-layer-mouth" class="absolute inset-0 w-full h-full object-contain z-20 hidden">
                                                        <img id="mac-layer-hat" class="absolute inset-0 w-full h-full object-contain z-30 hidden">
                                                    </div>
                                                </div>
                                                
                                                <div id="mac-sliders-container" class="hidden flex-col gap-6 w-full max-w-xs transition-opacity duration-300 opacity-0">
                                                    <div class="flex flex-col gap-2">
                                                        <label class="text-xs text-gray-400 uppercase tracking-wider font-bold">Size</label>
                                                        <input type="range" id="mac-size-slider" min="50" max="150" value="100" list="mac-size-ticks" class="mac-slider w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer">
                                                        <datalist id="mac-size-ticks">
                                                            <option value="100"></option>
                                                        </datalist>
                                                    </div>
                                                    <div class="flex flex-col gap-2">
                                                        <label class="text-xs text-gray-400 uppercase tracking-wider font-bold">Rotation</label>
                                                        <input type="range" id="mac-rotation-slider" min="-180" max="180" value="0" list="mac-rotation-ticks" class="mac-slider w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer">
                                                        <datalist id="mac-rotation-ticks">
                                                            <option value="0"></option>
                                                        </datalist>
                                                    </div>
                                                    <p class="text-center text-gray-500 text-sm font-mono mt-2"><i class="fa-solid fa-hand-pointer mr-1"></i> Drag avatar to position</p>
                                                </div>
                                                
                                                <p class="text-gray-500 text-sm font-mono mt-2" id="mac-preview-label">Click preview to adjust orientation</p>
                                            </div>

                                            <!-- RIGHT: Controls & Options -->
                                            <div id="mac-controls-wrapper" class="w-1/2 flex flex-col bg-black transition-transform duration-500 ease-in-out translate-x-0">
                                                
                                                <!-- Tabs -->
                                                <div class="flex border-b border-[#333]">
                                                    <button class="mac-tab-btn flex-1 py-4 text-gray-400 hover:text-white hover:bg-[#252525] transition-colors border-b-2 border-transparent font-medium active-tab" data-tab="hats">
                                                        <i class="fa-solid fa-hat-wizard mr-2"></i> Hats
                                                    </button>
                                                    <button class="mac-tab-btn flex-1 py-4 text-gray-400 hover:text-white hover:bg-[#252525] transition-colors border-b-2 border-transparent font-medium" data-tab="eyes">
                                                        <i class="fa-solid fa-eye mr-2"></i> Eyes
                                                    </button>
                                                    <button class="mac-tab-btn flex-1 py-4 text-gray-400 hover:text-white hover:bg-[#252525] transition-colors border-b-2 border-transparent font-medium" data-tab="mouths">
                                                        <i class="fa-solid fa-face-smile mr-2"></i> Mouths
                                                    </button>
                                                    <button class="mac-tab-btn flex-1 py-4 text-gray-400 hover:text-white hover:bg-[#252525] transition-colors border-b-2 border-transparent font-medium" data-tab="bg">
                                                        <i class="fa-solid fa-palette mr-2"></i> Color
                                                    </button>
                                                </div>

                                                <!-- Options Grid (Scrollable) -->
                                                <div class="flex-grow overflow-y-auto p-6 custom-scrollbar" id="mac-options-container">
                                                    <!-- Dynamic Content Loaded Here -->
                                                    <div class="grid grid-cols-3 gap-4" id="mac-grid">
                                                        <!-- JS populates this -->
                                                    </div>
                                                </div>

                                            </div>
                                        </div>
                                        
                                        <!-- Footer Actions -->
                                        <div class="p-6 border-t border-[#333] bg-black flex justify-end gap-4 items-center">
                                            <button id="mac-reset-btn" class="btn-toolbar-style mr-auto px-4 py-2 rounded-xl" title="Reset Avatar">
                                                <i class="fa-solid fa-rotate-left"></i>
                                            </button>
                                            <button id="mac-cancel-btn" class="btn-toolbar-style px-6 py-2 rounded-xl">Cancel</button>
                                            <button id="mac-confirm-btn" class="btn-toolbar-style btn-primary-override px-6 py-2 rounded-xl">
                                                <i class="fa-solid fa-check mr-2"></i> Confirm Avatar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Custom Upload Settings (Hidden by default) -->
                            <div id="pfpCustomSettings" class="hidden mt-2">
                                <div class="flex items-center gap-4">
                                    <!-- Preview -->
                                    <div class="w-16 h-16 rounded-full overflow-hidden border border-gray-600 flex-shrink-0 bg-black relative">
                                        <img id="customPfpPreview" src="" class="w-full h-full object-cover" style="display: none;">
                                        <div id="customPfpPlaceholder" class="w-full h-full flex items-center justify-center text-gray-600">
                                            <i class="fa-solid fa-user"></i>
                                        </div>
                                    </div>
                                    
                                    <!-- Upload Button -->
                                    <div>
                                        <button id="uploadPfpBtn" class="btn-toolbar-style btn-primary-override">
                                            <i class="fa-solid fa-upload mr-2"></i> Upload Image
                                        </button>
                                        <input type="file" id="pfpFileInput" accept="image/*" style="display: none;">
                                        <p class="text-xs text-gray-500 mt-1">Max size: 2MB. Images are cropped to square.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div id="pfpMessage" class="general-message-area text-sm"></div>
                    </div>

                    <!-- THEME SECTION -->
                    <h3 class="text-xl font-bold text-white mb-2">Navigation Bar Theme</h3>
                    <div id="themeSection" class="settings-box transition-all duration-300 p-4">
                        <p class="text-sm font-light text-gray-400 mb-4">
                            Select a theme for your navigation bar. This setting is saved locally and will apply a live preview.
                        </p>
                        
                        <div id="theme-picker-container">
                            <div class="flex items-center justify-center p-8">
                                <i class="fa-solid fa-spinner fa-spin fa-2x text-gray-500"></i>
                            </div>
                        </div>
                        
                        <div id="themeMessage" class="general-message-area text-sm"></div>
                    </div>
                </div>
             `;
        }
        
        // --- NEW: Loads data and adds event listeners for the Data tab ---
        async function loadDataTab() {
            // Get elements (buttons, modal)
            const exportBtn = document.getElementById('exportDataBtn');
            const importBtn = document.getElementById('importDataBtn');
            const modal = document.getElementById('modalPrompt');
            const modalClose = document.getElementById('modalClose');
            
            // Wire up buttons
            if (exportBtn) exportBtn.addEventListener('click', downloadAllSaves);
            if (importBtn) importBtn.addEventListener('click', handleFileUpload);
            
            // Wire up modal close events
            if (modalClose) {
                modalClose.addEventListener('click', () => {
                    modal.style.display = "none";
                });
            }
            // Use a new listener specific to this page
            const modalBackground = document.getElementById('modalPrompt');
            if (modalBackground) {
                modalBackground.addEventListener('click', event => {
                    if (event.target === modalBackground) {
                        modal.style.display = "none";
                    }
                });
            }
        }


        /**
         * Handles the switching of tabs and updating the main content view.
         */
        async function switchTab(tabId) {
            // 1. Update active class on sidebar tabs
            sidebarTabs.forEach(tab => {
                tab.classList.remove('active');
            });
            document.getElementById(`tab-${tabId}`).classList.add('active');

            // 2. Update the main view content and alignment
            mainView.style.justifyContent = 'flex-start';
            mainView.style.alignItems = 'flex-start';

            if (tabId === 'general') {
                await loadGeneralTab(); 
            }
            else if (tabId === 'privacy') {
                // NEW: Load Privacy Tab
                mainView.innerHTML = getPrivacyContent(); // Render HTML first
                await loadPrivacyTab(); // Then load data and add listeners
            }
            else if (tabId === 'personalization') {
                // --- NEW: Load Personalization Tab ---
                mainView.innerHTML = getPersonalizationContent(); // Render HTML
                await loadPersonalizationTab(); // Load data and add listeners
            }
            else if (tabId === 'data') {
                // --- NEW: Load Data Management Tab ---
                mainView.innerHTML = getDataManagementContent(); // Render HTML
                await loadDataTab(); // Load data and add listeners
            }
            else if (tabId === 'about') {
                mainView.innerHTML = getAboutContent();
            } else {
                const content = tabContent[tabId];
                mainView.innerHTML = getComingSoonContent(content.title);
            }
            
            // 3. New: Smoothly scroll the window back to the top (y=0)
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }

        // --- Initialization on Load ---
        
        // Add listener to each sidebar button
        sidebarTabs.forEach(tab => {
            tab.addEventListener('click', async () => {
                await switchTab(tab.dataset.tab);
            });
        });


        // --- AUTHENTICATION/REDIRECT LOGIC (Retained and Modified) ---
        function initializeAuth() {
            onAuthStateChanged(auth, (user) => {
                if (!user) {
                    // No user is logged in, redirect to authentication.html (path corrected)
                    window.location.href = '../authentication.html'; 
                } else {
                    currentUser = user; 
                    // Set initial state to 'General' (or the first tab)
                    switchTab('general'); 
                }
            });
        }
        
                // Use a short timeout to allow the rest of the script to run before auth check
                // Increased delay to ensure all functions are defined before initial auth check
                setTimeout(() => { initializeAuth(); }, 500); 