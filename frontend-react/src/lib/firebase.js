import { initializeApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

// Your Firebase config from Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyAVZSkxMN8UlWtNjR5rvt2YUlDC6_l6rXs",
  authDomain: "self-car-rental-web.firebaseapp.com",
  databaseURL: "https://self-car-rental-web-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "self-car-rental-web",
  storageBucket: "self-car-rental-web.firebasestorage.app",
  messagingSenderId: "957273020710",
  appId: "1:957273020710:web:d72a4ffcd557839afec9e7",
  measurementId: "G-FG76ESJVZH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Enable phone auth persistence
auth.useDeviceLanguage();

export { auth, RecaptchaVerifier, signInWithPhoneNumber };
export default app;
