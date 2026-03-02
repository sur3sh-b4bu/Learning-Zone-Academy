// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDF9hGu9Tm7lu8-VNT5GcEDazuxQgemgBo",
    authDomain: "nellailearningacademy.firebaseapp.com",
    projectId: "nellailearningacademy",
    storageBucket: "nellailearningacademy.firebasestorage.app",
    messagingSenderId: "806298033830",
    appId: "1:806298033830:web:c826fb77328d033cb35e67"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();
const storage = (typeof firebase.storage === 'function') ? firebase.storage() : null;
if (!storage) {
    console.warn("Firebase Storage SDK not loaded on this page. Upload features are unavailable here.");
}

console.log("Firebase initialized successfully (Compat Mode)");
