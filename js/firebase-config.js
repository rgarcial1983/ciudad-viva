import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { 
  getFirestore, collection, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { 
  getAuth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

const firebaseConfig = {
  projectId: "ciudad-viva-1c19f",
  appId: "1:490349125496:web:27a46fae03141901d9328d",
  storageBucket: "ciudad-viva-1c19f.firebasestorage.app",
  apiKey: "AIzaSyA5FYYnyohOrAFPdjMc_SDzqZfzjaIQxU0",
  authDomain: "ciudad-viva-1c19f.firebaseapp.com",
  messagingSenderId: "490349125496",
  measurementId: "G-9D7RJLHN8P"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const eventsRef = collection(db, "events");
const locationsRef = collection(db, "locations");
const townsRef = collection(db, "towns");
const usersRef = collection(db, "users");

export {
  app,
  db,
  auth,
  eventsRef,
  locationsRef,
  townsRef,
  usersRef,
  addDoc,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
};
