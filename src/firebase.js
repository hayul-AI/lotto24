import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCQfBc4tbjqKrrej7svqAZ9waX0fTMhBA0",
  authDomain: "lotto24-63f1d.firebaseapp.com",
  projectId: "lotto24-63f1d",
  storageBucket: "lotto24-63f1d.firebasestorage.app",
  messagingSenderId: "830281856228",
  appId: "1:830281856228:web:1cca925c585f9be0c428f1"
};

let app;
let db;
let auth;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  console.log("%c[Firebase] Connection Successful", "color: white; background: #10B981; padding: 2px 5px; border-radius: 3px;");
} catch (error) {
  console.error("[Firebase] Connection Failed:", error);
}

export { db, auth };
