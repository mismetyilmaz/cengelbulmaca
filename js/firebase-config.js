/**
 * FIREBASE-CONFIG.js
 * ------------------------------------------------------------------
 * Firebase Console > Project Settings > General > "Your apps" bölümünden
 * kopyalayacağın config objesini aşağıya yapıştır. (CityHive için
 * kullandığın projeyle aynı mantık — istersen aynı projeyi, istersen
 * yeni bir Firebase projesi açıp onu kullanabilirsin.)
 *
 * Realtime Database'i etkinleştirmeyi unutma:
 * Firebase Console > Build > Realtime Database > Create Database
 *
 * Test aşamasında güvenlik kurallarını geçici olarak açık bırakabilirsin:
 * {
 *   "rules": { ".read": true, ".write": true }
 * }
 * Yayına almadan önce bunu sıkılaştırmak gerekir.
 */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBBticMfohmYMhybuZcCpthEcfdMuNftNw",
  authDomain: "cengelbulmaca-31f11.firebaseapp.com",
  databaseURL: "https://cengelbulmaca-31f11-default-rtdb.firebaseio.com",
  projectId: "cengelbulmaca-31f11",
  storageBucket: "cengelbulmaca-31f11.firebasestorage.app",
  messagingSenderId: "67767346083",
  appId: "1:67767346083:web:6d03a748eda88366acf016",
  measurementId: "G-0D3FQTWMFH"
};

firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.database();
