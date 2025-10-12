// firestore.js
import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCMk7Kkol-v2PwVt_ySCFnXYVw9oCdRuB8",
  authDomain: "appforge-24de0.firebaseapp.com",
  projectId: "appforge-24de0",
  storageBucket: "appforge-24de0.firebasestorage.app",
  messagingSenderId: "753392130997",
  appId: "1:753392130997:web:9809c7da239a2cf3dbd7fc",
  measurementId: "G-11KM1J1D4C"
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with persistence (using AsyncStorage)
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),  // Set persistence
});

// Initialize Firestore
const db = getFirestore(app);

// Export auth and db instances
export { auth, db };