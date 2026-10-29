/**
 * SMART GROCERY - FIREBASE CLOUD FIRESTORE MULTI-DEVICE REALTIME SYNC
 * Menggunakan onSnapshot() untuk sinkronisasi detik-per-detik antara HP & PC
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot
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
let isApplyingRemote = false;
let pendingWritePayload = null;

// Kumpulan subscriber status & remote changes
let onRemoteStateCallback = null;
let onSyncStatusCallback = null;

// Sanitasi items agar bebas dari undefined yang dapat menyebabkan setDoc error di HP
function sanitizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map(it => ({
    id: String(it.id || 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5)),
    name: String(it.name || '').trim(),
    unitPrice: Number(it.unitPrice || it.price || 0),
    qty: Math.max(1, Number(it.qty || 1)),
    discountInput: String(it.discountInput || ''),
    category: String(it.category || 'pokok'),
    unit: String(it.unit || 'pcs'),
    inTrolley: Boolean(it.inTrolley)
  }));
}

function sanitizeRefPrices(refPrices) {
  if (!refPrices || typeof refPrices !== 'object') return {};
  const clean = {};
  for (const [k, v] of Object.entries(refPrices)) {
    if (k && v && typeof v === 'object') {
      clean[k] = {
        name: String(v.name || k),
        price: Number(v.price || 0),
        unit: String(v.unit || 'pcs')
      };
    }
  }
  return clean;
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.map(h => ({
    id: String(h.id || 'hist-' + Date.now()),
    dateStr: String(h.dateStr || ''),
    totalSpent: Number(h.totalSpent || 0),
    totalSaved: Number(h.totalSaved || 0),
    itemCount: Number(h.itemCount || (h.items ? h.items.length : 0)),
    items: Array.isArray(h.items) ? h.items.map(it => ({
      name: String(it.name || ''),
      qty: Number(it.qty || 1),
      unit: String(it.unit || 'pcs'),
      price: Number(it.price || it.unitPrice || 0)
    })) : []
  }));
}

export function initFirebaseSync(onRemoteChange, onStatusChange) {
  onRemoteStateCallback = onRemoteChange;
  onSyncStatusCallback = onStatusChange;

  try {
    if (!app) {
      app = initializeApp(firebaseConfig);
      // Menggunakan in-memory cache murni untuk koneksi realtime tanpa lock antar-tab
      db = getFirestore(app);
    }

    // Document tunggal bersama untuk 1 akun multi-device (HP & PC)
    sessionDocRef = doc(db, "groceries", "shared_session");

    startRealtimeListener();

    // Jalankan antrean write jika ada yang memanggil sebelum listener siap
    if (pendingWritePayload) {
      const { stateData, immediate } = pendingWritePayload;
      pendingWritePayload = null;
      pushSessionState(stateData, immediate);
    }

    // Listen online / offline browser events
    window.addEventListener('online', () => {
      if (onSyncStatusCallback) {
        onSyncStatusCallback({
          status: 'connected',
          text: 'Terhubung Realtime (HP & PC)',
          isOnline: true
        });
      }
      if (window.SmartGrocery && typeof window.SmartGrocery.getCurrentStateForCloud === 'function') {
        const state = window.SmartGrocery.getCurrentStateForCloud();
        pushSessionState(state, true);
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
 * Setiap perubahan di HP langsung diterima PC seketika.
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

  // onSnapshot tanpa includeMetadataChanges agar murni mendengarkan perubahan data dokumen di cloud
  unsubscribeSnapshot = onSnapshot(
    sessionDocRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();

        // Terapkan data ke appState dengan try...finally agar isApplyingRemote selalu ter-reset
        isApplyingRemote = true;
        try {
          if (onRemoteStateCallback) {
            onRemoteStateCallback(data);
          }
        } catch (errCallback) {
          console.error('[Firebase] Error saat applyRemoteState:', errCallback);
        } finally {
          isApplyingRemote = false;
        }

        if (onSyncStatusCallback) {
          const updatedWho = data.updatedBy ? ` (oleh ${data.updatedBy})` : '';
          onSyncStatusCallback({
            status: 'connected',
            text: 'Realtime Aktif' + updatedWho,
            lastUpdated: data.lastUpdated,
            updatedBy: data.updatedBy,
            isOnline: true
          });
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
  // Jika sedang menerapkan data dari remote, jangan broadcast balik untuk mencegah echo-loop
  if (isApplyingRemote) return;

  if (!sessionDocRef) {
    console.warn('[Firebase] sessionDocRef belum siap, simpan ke antrean sinkronisasi.');
    pendingWritePayload = { stateData, immediate };
    return;
  }

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

      // Pastikan field bersih tanpa undefined agar Firestore tidak reject di HP
      const cleanData = {
        storeLocation: String(stateData.storeLocation || 'Superindo Sudirman'),
        shoppingDate: String(stateData.shoppingDate || new Date().toISOString().split('T')[0]),
        walletLimit: Number(stateData.walletLimit || 500000),
        items: sanitizeItems(stateData.items),
        totalSpent: Number(stateData.totalSpent || 0),
        totalSaved: Number(stateData.totalSaved || 0),
        itemCount: Number(stateData.itemCount || (stateData.items ? stateData.items.length : 0)),
        lastUpdated: new Date().toISOString(),
        updatedBy: String(stateData.updatedBy || 'Troli Bersama'),
        deviceId: String(stateData.deviceId || '')
      };

      if (stateData.history) cleanData.history = sanitizeHistory(stateData.history);
      if (stateData.refPrices) cleanData.refPrices = sanitizeRefPrices(stateData.refPrices);

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
    debounceTimeout = setTimeout(performWrite, 200);
  }
}

// Pasang ke window agar dapat dipanggil dari script vanilla app.js
window.FirebaseSync = {
  initFirebaseSync,
  pushSessionState
};
