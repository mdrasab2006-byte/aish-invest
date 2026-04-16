import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCRZxy_DaxQaU9jUyUYZkwZFQhXO3OOw3s",
  authDomain: "aish-invest.firebaseapp.com",
  projectId: "aish-invest",
  storageBucket: "aish-invest.firebasestorage.app",
  messagingSenderId: "480484001807",
  appId: "1:480484001807:web:2c2308de4dbe355065fb7a"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
