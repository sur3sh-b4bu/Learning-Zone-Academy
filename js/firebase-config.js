// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDLQkYLlOKurWi7FGVAhqtEd9H5manckl4",
    authDomain: "gov-web-5dedf.firebaseapp.com",
    projectId: "gov-web-5dedf",
    storageBucket: "gov-web-5dedf.firebasestorage.app",
    messagingSenderId: "463649221383",
    appId: "1:463649221383:web:e84453fb77091ad5b1f3a2",
    measurementId: "G-PW4HHC926X"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();
const storage = firebase.storage();

console.log("Firebase initialized successfully (Compat Mode)");


