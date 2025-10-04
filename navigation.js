// src/context/FirebaseContext.js

import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase-config'; // Assuming auth and db are exported from firebase-config.js
import { onAuthStateChanged } from 'firebase/auth';

const FirebaseContext = createContext();

export const useFirebase = () => useContext(FirebaseContext);

export const FirebaseProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Firebase Auth State Listener
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = {
    user,
    db, // Firestore instance
    auth, // Auth instance
    loading,
  };

  return (
    <FirebaseContext.Provider value={value}>
      {!loading && children}
    </FirebaseContext.Provider>
  );
};
