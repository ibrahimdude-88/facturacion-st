import { initializeApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';

const rawApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const rawProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

const firebaseConfig = {
  apiKey: rawApiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: rawProjectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app = null;
let auth = null;
let db = null;
let storage = null;
let googleProvider = null;
let isFirebaseConfigured = false;

if (rawApiKey && rawProjectId && rawApiKey !== 'TU_FIREBASE_API_KEY') {
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
    isFirebaseConfigured = true;
  } catch (err) {
    console.error('Error al inicializar Firebase SDK:', err);
    isFirebaseConfigured = false;
  }
}

export { isFirebaseConfigured };

// Auth Helpers
export const loginWithGoogle = async () => {
  if (!isFirebaseConfigured || !auth || !googleProvider) {
    throw new Error('Firebase Auth no está inicializado o configurado correctamente.');
  }
  return await signInWithPopup(auth, googleProvider);
};

export const logoutUser = async () => {
  if (!isFirebaseConfigured || !auth) return;
  return await firebaseSignOut(auth);
};

export const subscribeToAuthChanges = (callback) => {
  if (!isFirebaseConfigured || !auth) {
    return () => {};
  }
  try {
    return onAuthStateChanged(auth, callback);
  } catch (err) {
    console.error('Error en subscribeToAuthChanges:', err);
    return () => {};
  }
};

export { auth, db, storage };
