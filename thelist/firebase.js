import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDPKjpimOZLKwNwfm_IQFm8X4Pv2ZgucIA",
    authDomain: "the-list-175d3.firebaseapp.com",
    databaseURL: "https://the-list-175d3-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "the-list-175d3",
    storageBucket: "the-list-175d3.appspot.com",
    messagingSenderId: "133562798111",
    appId: "1:133562798111:web:34a18cd64c6202314cc52a"
  };

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore(app);

export default db;