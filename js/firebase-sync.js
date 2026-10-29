/**
 * SMART GROCERY - FIREBASE CLOUD FIRESTORE MULTI-DEVICE REALTIME SYNC
 * Menggunakan onSnapshot() untuk sinkronisasi detik-per-detik antara HP & PC
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Firebase Configuration milik pengguna
const firebaseConfig = {
  apiKey: "AIzaSyAVBqn05S10eyRsNzHXApHgLWujiXwj-oI",
  authDomain: "smart-grocery-b0faf.firebaseapp.com",
  databaseURL: "https://smart-grocery-b0faf-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "smart-grocery-b0faf",
  storageBucket: "smart-grocery-b0faf.firebasestorage.app",
  messagingSenderId: "361585769655",
  appId: "1:361585769655:web:d76175e166ea48e26d6132"
};

// Inisialisasi Firebase App & Firestore
let app = null;
let db = null;
let sessionDocRef = null;
let unsubscribeSnapshot = null;
let debounceTimeout = null;
let isFirstSync = true;
let isApplyingRemote = false;

// Kumpulan subscriber status & remote changes
let onRemoteStateCallback = null;
let onSyncStatusCallback = null;

export function initFirebaseSync(onRemoteChange, onStatusChange) {
  onRemoteStateCallback = onRemoteChange;
  onSyncStatusCallback = onStatusChange;

  try {
    if (!app) {
      app = initializeApp(firebaseConfig);
      db = getFirestore(app);

      // Aktifkan offline persistence IndexedDb jika browser mendukung
      try {
        enableIndexedDbPersistence(db).catch((err) => {
          if (err.code === 'failed-precondition') {
            console.warn('[Firebase] Multi-tab persistence: tab lain sedang aktif.');
          } else if (err.code === 'unimplemented') {
            console.warn('[Firebase] Browser tidak mendukung persistence IndexedDB.');
          }
        });
      } catch (errPersist) {
        console.warn('[Firebase] Persistence init warning:', errPersist);
      }
    }

    // Document tunggal bersama untuk 1 akun multi-device (HP & PC)
    sessionDocRef = doc(db, "groceries", "shared_session");

    startRealtimeListener();

    // Listen online / offline browser events
    window.addEventListener('online', () => {
      if (onSyncStatusCallback) {
        onSyncStatusCallback({
          status: 'connected',
          text: 'Terhubung Realtime (HP & PC)',
          isOnline: true
        });
      }
    });

    window.addEventListener('offline', () => {
      if (onSyncStatusCallback) {
        onSyncStatusCallback({
          status: 'offline',
          text: 'Mode Offline (LocalStorage Tersimpan)',
          isOnline: false
        });
      }
    });

  } catch (error) {
    console.error('[Firebase] Inisialisasi error:', error);
    if (onSyncStatusCallback) {
      onSyncStatusCallback({
        status: 'error',
        text: 'Firebase Error: ' + error.message,
        isOnline: false
      });
    }
  }
}

/**
 * PENTING: Menggunakan onSnapshot() realtime listener
 * Bukan getDoc()/getDocs(). Setiap perubahan di HP langsung diterima PC seketika.
 */
function startRealtimeListener() {
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
  }

  if (onSyncStatusCallback) {
    onSyncStatusCallback({
      status: 'syncing',
      text: 'Menghubungkan ke Cloud Firestore...'
    });
  }

  unsubscribeSnapshot = onSnapshot(
    sessionDocRef,
    { includeMetadataChanges: true },
    (snapshot) => {
      const hasPending = snapshot.metadata.hasPendingWrites;
      const fromCache = snapshot.metadata.fromCache;

      if (snapshot.exists()) {
        const data = snapshot.data();

        // Jika perubahan berasal dari server (perangkat lain seperti HP di supermarket)
        // dan BUKAN hasil pending write lokal kita sendiri:
        if (!hasPending) {
          isApplyingRemote = true;
          if (onRemoteStateCallback) {
            onRemoteStateCallback(data);
          }
          isApplyingRemote = false;

          if (onSyncStatusCallback) {
            const updatedWho = data.updatedBy ? ` (dari ${data.updatedBy})` : '';
            onSyncStatusCallback({
              status: 'connected',
              text: 'Realtime Aktif' + updatedWho,
              lastUpdated: data.lastUpdated,
              updatedBy: data.updatedBy,
              isOnline: !fromCache
            });
          }
        } else {
          // Sedang ada penulisan lokal yang sedang di-sync ke cloud
          if (onSyncStatusCallback) {
            onSyncStatusCallback({
              status: 'syncing',
              text: 'Mengirim update ke cloud...'
            });
          }
        }
      } else {
        // Dokumen di Firestore belum ada sama sekali (pertama kali dibuat)
        // Dorong state awal lokal ke cloud untuk inisialisasi dokumen
        console.log('[Firebase] Dokumen shared_session belum ada di cloud. Siap inisialisasi.');
        if (window.SmartGrocery && typeof window.SmartGrocery.getCurrentStateForCloud === 'function') {
          const initialState = window.SmartGrocery.getCurrentStateForCloud();
          pushSessionState(initialState, true);
        }
      }
      isFirstSync = false;
    },
    (error) => {
      console.error('[Firebase] Realtime onSnapshot listener error:', error);
      if (onSyncStatusCallback) {
        onSyncStatusCallback({
          status: 'offline',
          text: 'Offline: ' + (error.message || 'Sinyal terputus'),
          isOnline: false
        });
      }
    }
  );
}

/**
 * Mengirim data state keranjang ke Firestore
 * Mendukung debounce agar saat menekan + / - berkali-kali tidak spamming network
 */
export function pushSessionState(stateData, immediate = false) {
  if (!sessionDocRef || isApplyingRemote) return;

  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
  }

  const performWrite = async () => {
    try {
      if (onSyncStatusCallback) {
        onSyncStatusCallback({
          status: 'syncing',
          text: 'Menyinkronkan ke HP & PC...'
        });
      }

      // Pastikan field bersih tanpa undefined
      const cleanData = {
        storeLocation: stateData.storeLocation || 'Superindo Sudirman',
        shoppingDate: stateData.shoppingDate || new Date().toISOString().split('T')[0],
        walletLimit: Number(stateData.walletLimit || 500000),
        items: Array.isArray(stateData.items) ? stateData.items : [],
        totalSpent: Number(stateData.totalSpent || 0),
        totalSaved: Number(stateData.totalSaved || 0),
        itemCount: Number(stateData.itemCount || (stateData.items ? stateData.items.length : 0)),
        lastUpdated: new Date().toISOString(),
        updatedBy: stateData.updatedBy || 'Troli Bersama'
      };

      if (stateData.history) cleanData.history = stateData.history;
      if (stateData.refPrices) cleanData.refPrices = stateData.refPrices;

      await setDoc(sessionDocRef, cleanData, { merge: true });

      if (onSyncStatusCallback) {
        onSyncStatusCallback({
          status: 'connected',
          text: 'Tersinkron Realtime (HP & PC)',
          lastUpdated: cleanData.lastUpdated,
          updatedBy: cleanData.updatedBy
        });
      }
    } catch (err) {
      console.warn('[Firebase] Gagal mengirim ke Firestore, data aman di LocalStorage:', err);
      if (onSyncStatusCallback) {
        onSyncStatusCallback({
          status: 'offline',
          text: 'Tersimpan Offline di Perangkat',
          isOnline: false
        });
      }
    }
  };

  if (immediate) {
    performWrite();
  } else {
    debounceTimeout = setTimeout(performWrite, 250);
  }
}

// Pasang ke window agar dapat dipanggil dari script vanilla app.js
window.FirebaseSync = {
  initFirebaseSync,
  pushSessionState
};
