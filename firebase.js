
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
    import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
    import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js"; // Firestore import
    
    const firebaseConfig = {
        apiKey: "AIzaSyCdQD76M1BsVvYz1wqBG3wQjrzYFAxcFhw",
  authDomain: "medianest-b5bbe.firebaseapp.com",
  databaseURL: "https://medianest-b5bbe-default-rtdb.firebaseio.com",
  projectId: "medianest-b5bbe",
  storageBucket: "medianest-b5bbe.firebasestorage.app",
  messagingSenderId: "38562067961",
  appId: "1:38562067961:web:0c76369a869e4270ff3928"
    };
    
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app); // Initialize Firestore
    
    // Export Firebase services
    export { auth, db, createUserWithEmailAndPassword, signInWithEmailAndPassword, doc, setDoc, getDoc };
    