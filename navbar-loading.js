import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
// The path below points to the required placeholder file
import { firebaseConfig } from './firebase-config';

// 1. Initialize Firebase (Ensure firebaseConfig is loaded)
let app;
let auth;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
} catch (e) {
    console.error("Firebase initialization failed. Check firebase-config.js:", e);
    // Use dummy auth if initialization fails
    auth = { onAuthStateChanged: () => () => {}, signOut: async () => console.warn("Dummy SignOut called.") };
}


// Mock data for the static parts of the navigation
const navItems = ['Overview', 'Integrations', 'Deployments', 'Activity', 'Domains', 'Usage', 'Observability', 'Storage', 'Flags', 'AI Gateway', 'Agent', 'Support', 'Settings'];

// Utility Component for User Icon
const UserAvatar = ({ user, onClick }) => {
    // Fallback initials for the profile circle if no photo is available
    const initials = user?.displayName ? user.displayName.substring(0, 2).toUpperCase() : '??';

    // The blue-purple circle color
    const avatarClass = "h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold cursor-pointer";

    if (user && user.photoURL) {
        return (
            <img 
                src={user.photoURL} 
                alt="User Avatar" 
                className={avatarClass} 
                onClick={onClick}
                onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/28x28/1e3a8a/ffffff?text=' + initials; }}
            />
        );
    }

    // Default avatar with initials and purple-blue background
    return (
        <div 
            className={avatarClass}
            onClick={onClick}
        >
            {initials}
        </div>
    );
};

// Main Navigation Component
const NavigationBar = () => {
    const [user, setUser] = useState(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isAuthReady, setIsAuthReady] = useState(false);

    // 2. Firebase Authentication Listener
    useEffect(() => {
        if (!auth.onAuthStateChanged) return; // Exit if dummy auth is used

        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                // Mocking the display name "4sp" to match the image aesthetic,
                // but using the real photoURL if available from Google auth.
                setUser({
                    displayName: currentUser.displayName || '4sp', 
                    email: currentUser.email,
                    photoURL: currentUser.photoURL,
                });
            } else {
                setUser(null);
            }
            setIsAuthReady(true);
        });
        return () => unsubscribe();
    }, []);

    const handleSignOut = async () => {
        if (!auth.signOut) return;
        try {
            await signOut(auth);
            setIsMenuOpen(false);
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    const handleAvatarClick = () => {
        if (isAuthReady) {
            setIsMenuOpen(!isMenuOpen);
        }
    };

    return (
        <header className="bg-gray-900 border-b border-gray-800 p-2 text-white font-[Inter] sticky top-0 z-50">
            {/* Top Bar */}
            <div className="flex items-center justify-between h-10">
                
                {/* Left Section: Logo & Scope Selector */}
                <div className="flex items-center space-x-4">
                    <img 
                        src="../images/logo.png" 
                        alt="Logo" 
                        className="h-6" 
                        onError={(e) => {e.target.onerror = null; e.target.src="https://placehold.co/24x24/10b981/ffffff?text=4S";}}
                    />
                    {/* The "4sp's Hobby" dropdown, simplified as a button */}
                    <button className="flex items-center px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition duration-150">
                        4sp's <span className="text-gray-400 ml-1">Hobby</span>
                        <svg className="ml-2 w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                </div>

                {/* Right Section: Search, Tickets, Feedback, Avatar */}
                <div className="flex items-center space-x-4 relative">
                    <button className="hidden sm:inline-flex text-sm px-3 py-1 border border-gray-700 rounded-lg hover:bg-gray-800 transition duration-150">
                        Ship AI tickets
                    </button>
                    
                    {/* Search Input */}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Find..."
                            className="bg-gray-800 rounded-lg py-1 pl-8 pr-7 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-28 sm:w-36 transition duration-150"
                        />
                        <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400">🔍</span>
                        <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs border border-gray-600 px-1 rounded-sm select-none">F</span>
                    </div>
                    
                    <button className="hidden sm:inline-flex text-sm px-3 py-1 border border-gray-700 rounded-lg hover:bg-gray-800 transition duration-150">
                        Feedback
                    </button>
                    
                    {/* User/Auth Indicator & Dropdown Trigger */}
                    <div className="relative">
                        {isAuthReady && user ? (
                            <UserAvatar user={user} onClick={handleAvatarClick} />
                        ) : (
                            // Show generic placeholder when logged out
                            <button 
                                className="text-sm px-3 py-1 border border-gray-700 rounded-lg hover:bg-gray-800 transition duration-150"
                                onClick={handleAvatarClick}
                            >
                                Log In
                            </button>
                        )}
                        
                        {/* Dropdown Menu - appears when isMenuOpen is true */}
                        {isMenuOpen && (
                            <div className="absolute right-0 top-full mt-2 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
                                {user ? (
                                    <>
                                        <div className="p-3 border-b border-gray-700">
                                            <p className="font-semibold">{user.displayName}</p>
                                            <p className="text-sm text-gray-400 truncate">{user.email}</p>
                                        </div>
                                        <a href="/dashboard.html" className="block px-3 py-2 hover:bg-gray-700 text-sm">
                                            Dashboard
                                        </a>
                                        <a href="/settings.html" className="block px-3 py-2 hover:bg-gray-700 text-sm">
                                            Account Settings
                                        </a>
                                        <div className="border-t border-gray-700 mt-1">
                                            <button 
                                                className="w-full text-left px-3 py-2 hover:bg-red-900 text-sm text-red-400 rounded-b-lg" 
                                                onClick={handleSignOut}
                                            >
                                                Log Out
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    // Logged-out menu
                                    <>
                                        <a href="/login.html" className="block px-3 py-2 hover:bg-gray-700 text-sm rounded-t-lg">
                                            Log In
                                        </a>
                                        <a href="/signup.html" className="block px-3 py-2 hover:bg-gray-700 text-sm rounded-b-lg border-t border-gray-700">
                                            Sign Up
                                        </a>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Nav Items - Only on the Overview page */}
            <nav className="mt-4 hidden md:block">
                <ul className="flex space-x-6 text-sm overflow-x-auto whitespace-nowrap pb-1 scrollbar-hide">
                    {navItems.map(item => (
                        <li key={item} className="flex-shrink-0">
                            <a 
                                href="#" 
                                className={`pb-2 block ${item === 'Overview' ? 'font-semibold border-b-2 border-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                {item}
                            </a>
                        </li>
                    ))}
                </ul>
            </nav>
        </header>
    );
};

export default NavigationBar;
