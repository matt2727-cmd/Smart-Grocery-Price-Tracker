/**
 * SMART GROCERY & BUDGET SAFETY TRACKER
 * Native Mobile PWA Logic for Supermarket Trolley Shopping
 */

(function () {
  'use strict';

  // --- STATE STORAGE KEYS ---
  const STORAGE_KEY_ITEMS = 'sg_trolley_items_v2';
  const STORAGE_KEY_BUDGET = 'sg_budget_limit_v2';
  const STORAGE_KEY_HISTORY = 'sg_shopping_history_v2';
  const STORAGE_KEY_REF_PRICES = 'sg_ref_prices_v2';
  const STORAGE_KEY_STORE = 'sg_store_location_v2';
  const STORAGE_KEY_DATE = 'sg_shopping_date_v2';
  const STORAGE_KEY_AUTH = 'sg_auth_user_v2';
  const STORAGE_KEY_DEVICE_ID = 'sg_device_client_id_v2';

  // Identifikasi unik tiap device (HP / PC) agar sinkronisasi realtime saling mengenali
  function getDeviceId() {
    let devId = localStorage.getItem(STORAGE_KEY_DEVICE_ID);
    if (!devId) {
      devId = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      localStorage.setItem(STORAGE_KEY_DEVICE_ID, devId);
    }
    return devId;
  }

  // --- DEFAULT SEED DATA (REALISTIS UNTUK SISWA RANTAU) ---
  const DEFAULT_REF_PRICES = {
    'beras': { name: 'Beras Ramos 5kg', price: 69000, unit: 'kg' },
    'minyak goreng': { name: 'Minyak Goreng 2L', price: 36500, unit: 'pack' },
    'telur': { name: 'Telur Ayam 1kg', price: 28000, unit: 'kg' },
    'mi instan': { name: 'Mi Instan Goreng', price: 3100, unit: 'pcs' },
    'detergen': { name: 'Detergen Cair 800ml', price: 22000, unit: 'pack' },
    'kopi susu': { name: 'Kopi Susu Instan 10s', price: 14000, unit: 'pack' },
    'susu uht': { name: 'Susu UHT Full Cream 1L', price: 18500, unit: 'pcs' },
    'sabun mandi': { name: 'Sabun Mandi Cair Refill', price: 21000, unit: 'pack' },
    'pasta gigi': { name: 'Pasta Gigi 190g', price: 14500, unit: 'pcs' },
    'bawang merah': { name: 'Bawang Merah 500g', price: 18000, unit: 'pack' },
    'nugget ayam': { name: 'Nugget Ayam 500g', price: 44000, unit: 'pack' },
    'kecap manis': { name: 'Kecap Manis 550ml', price: 20000, unit: 'pcs' }
  };

  const DEFAULT_TROLLEY_ITEMS = [
    {
      id: 'item-1',
      name: 'Beras Ramos 5kg',
      category: 'pokok',
      unit: 'pack',
      qty: 1,
      unitPrice: 74000,
      discountInput: '',
      inTrolley: true
    },
    {
      id: 'item-2',
      name: 'Minyak Goreng 2L',
      category: 'pokok',
      unit: 'pack',
      qty: 1,
      unitPrice: 34000,
      discountInput: '',
      inTrolley: true
    },
    {
      id: 'item-3',
      name: 'Telur Ayam 1kg',
      category: 'protein',
      unit: 'kg',
      qty: 1,
      unitPrice: 28000,
      discountInput: '',
      inTrolley: false
    },
    {
      id: 'item-4',
      name: 'Mi Instan Goreng',
      category: 'pokok',
      unit: 'pcs',
      qty: 10,
      unitPrice: 3100,
      discountInput: '10%',
      inTrolley: true
    },
    {
      id: 'item-5',
      name: 'Detergen Cair 800ml',
      category: 'kebersihan',
      unit: 'pack',
      qty: 1,
      unitPrice: 24000,
      discountInput: '30% + 10%',
      inTrolley: false
    },
    {
      id: 'item-6',
      name: 'Kopi Susu Instan 10s',
      category: 'minuman',
      unit: 'pack',
      qty: 2,
      unitPrice: 14000,
      discountInput: '',
      inTrolley: true
    }
  ];

  const POPULAR_SUGGESTIONS = [
    { name: 'Beras Ramos 5kg', cat: 'pokok', unit: 'pack', price: 74000 },
    { name: 'Minyak Goreng 2L', cat: 'pokok', unit: 'pack', price: 34000 },
    { name: 'Telur Ayam 1kg', cat: 'protein', unit: 'kg', price: 28000 },
    { name: 'Mi Instan Goreng', cat: 'pokok', unit: 'pcs', price: 3100 },
    { name: 'Susu UHT Full Cream 1L', cat: 'minuman', unit: 'pcs', price: 19500 },
    { name: 'Detergen Cair 800ml', cat: 'kebersihan', unit: 'pack', price: 23500 },
    { name: 'Sabun Mandi Cair Refill', cat: 'kebersihan', unit: 'pack', price: 20000 },
    { name: 'Nugget Ayam 500g', cat: 'protein', unit: 'pack', price: 42000 },
    { name: 'Bawang Merah 500g', cat: 'sayur', unit: 'pack', price: 19000 },
    { name: 'Kecap Manis 550ml', cat: 'bumbu', unit: 'pcs', price: 21000 }
  ];

  // --- STATE MANAGEMENT ---
  let appState = {
    budgetLimit: 500000,
    storeLocation: 'Superindo Sudirman',
    shoppingDate: new Date().toISOString().split('T')[0],
    items: [],
    history: [],
    refPrices: {},
    activeCategoryFilter: 'all',
    searchQuery: '',
    editingItemId: null,
    currentUser: { username: 'Keluarga Rantau', loggedIn: true },
    syncStatus: 'connecting',
    lastUpdatedBy: '',
    lastUpdatedAt: ''
  };

  // --- HELPER FORMATTERS ---
  const formatRupiah = (number) => {
    return 'Rp ' + Math.round(number || 0).toLocaleString('id-ID');
  };

  const parseNumber = (str) => {
    if (typeof str === 'number') return str;
    if (!str) return 0;
    const clean = str.toString().replace(/[^0-9]/g, '');
    return parseInt(clean, 10) || 0;
  };

  // --- DISKONTING BERTINGKAT MATHEMATICAL ENGINE ---
  /**
   * Menghitung diskon tunggal maupun diskon bertumpuk (bertingkat)
   * Contoh input: "25%", "50% + 20%", "30+10", "15000" (nominal)
   */
  function calculateTieredDiscount(basePrice, discountString) {
    if (!discountString || !discountString.toString().trim()) {
      return {
        effectiveUnitPrice: basePrice,
        savingPerUnit: 0,
        discountLabel: '',
        effectivePercent: 0,
        steps: []
      };
    }

    const cleanStr = discountString.toString().trim();
    const steps = [];

    // Cek jika input bertumpuk menggunakan '+'
    if (cleanStr.includes('+')) {
      const parts = cleanStr.split('+').map(p => p.trim());
      let currentPrice = basePrice;
      const percentParts = [];

      parts.forEach((p, idx) => {
        const pct = parseFloat(p.replace('%', ''));
        if (!isNaN(pct) && pct > 0) {
          const cut = currentPrice * (pct / 100);
          const nextPrice = Math.max(0, currentPrice - cut);
          steps.push({
            step: idx + 1,
            percent: pct,
            prevPrice: currentPrice,
            cutAmount: cut,
            resultingPrice: nextPrice
          });
          currentPrice = nextPrice;
          percentParts.push(`${pct}%`);
        }
      });

      const effectiveUnitPrice = currentPrice;
      const savingPerUnit = basePrice - effectiveUnitPrice;
      const effectivePercent = basePrice > 0 ? (savingPerUnit / basePrice) * 100 : 0;

      return {
        effectiveUnitPrice: Math.round(effectiveUnitPrice),
        savingPerUnit: Math.round(savingPerUnit),
        discountLabel: percentParts.join(' + '),
        effectivePercent: Math.round(effectivePercent * 10) / 10,
        steps: steps
      };
    }

    // Cek jika input mengandung persentase tunggal (misal "25%")
    if (cleanStr.includes('%')) {
      const pct = parseFloat(cleanStr.replace('%', ''));
      if (!isNaN(pct) && pct > 0) {
        const cut = basePrice * (pct / 100);
        const effectiveUnitPrice = Math.max(0, basePrice - cut);
        const savingPerUnit = basePrice - effectiveUnitPrice;
        return {
          effectiveUnitPrice: Math.round(effectiveUnitPrice),
          savingPerUnit: Math.round(savingPerUnit),
          discountLabel: `${pct}%`,
          effectivePercent: pct,
          steps: [{ step: 1, percent: pct, prevPrice: basePrice, cutAmount: cut, resultingPrice: effectiveUnitPrice }]
        };
      }
    }

    // Cek jika input berupa nominal angka langsung (misal "5000" atau "Rp 5.000")
    const nominal = parseNumber(cleanStr);
    if (nominal > 0) {
      const effectiveUnitPrice = Math.max(0, basePrice - nominal);
      const savingPerUnit = basePrice - effectiveUnitPrice;
      const effectivePercent = basePrice > 0 ? (savingPerUnit / basePrice) * 100 : 0;
      return {
        effectiveUnitPrice: Math.round(effectiveUnitPrice),
        savingPerUnit: Math.round(savingPerUnit),
        discountLabel: `Potongan ${formatRupiah(nominal)}`,
        effectivePercent: Math.round(effectivePercent * 10) / 10,
        steps: [{ step: 1, percent: effectivePercent, prevPrice: basePrice, cutAmount: nominal, resultingPrice: effectiveUnitPrice }]
      };
    }

    return {
      effectiveUnitPrice: basePrice,
      savingPerUnit: 0,
      discountLabel: '',
      effectivePercent: 0,
      steps: []
    };
  }

  // --- KOMPARATOR HARGA REALTIME VS BULAN LALU ---
  function comparePriceWithLastMonth(itemName, currentUnitPrice) {
    if (!itemName) return { status: 'none', label: '', diff: 0, diffPercent: 0 };

    const normName = itemName.toLowerCase().trim();
    let matchedRef = null;

    // Fuzzy matching sederhana terhadap kamus harga acuan
    for (const [key, data] of Object.entries(appState.refPrices)) {
      if (normName.includes(key) || key.includes(normName)) {
        matchedRef = data;
        break;
      }
    }

    if (!matchedRef || !matchedRef.price) {
      return {
        status: 'new',
        label: '★ Item Baru',
        diff: 0,
        diffPercent: 0,
        lastMonthPrice: null
      };
    }

    const lastPrice = matchedRef.price;
    const diff = currentUnitPrice - lastPrice;
    const diffPercent = Math.round(((diff / lastPrice) * 100) * 10) / 10;

    if (diff > 0) {
      return {
        status: 'up',
        label: `↑ Naik ${formatRupiah(diff)} (+${diffPercent}%)`,
        diff: diff,
        diffPercent: diffPercent,
        lastMonthPrice: lastPrice
      };
    } else if (diff < 0) {
      return {
        status: 'down',
        label: `↓ Turun ${formatRupiah(Math.abs(diff))} (${diffPercent}%)`,
        diff: diff,
        diffPercent: diffPercent,
        lastMonthPrice: lastPrice
      };
    } else {
      return {
        status: 'equal',
        label: '= Sama dgn bln lalu',
        diff: 0,
        diffPercent: 0,
        lastMonthPrice: lastPrice
      };
    }
  }

  // --- INITIALIZATION & LOCALSTORAGE ---
  function initApp() {
    loadStateFromStorage();
    setupClock();
    setupEventListeners();
    setupPWA();
    checkAuthStatus();
    initFirebaseRealtime();
    renderAll();
  }

  function loadStateFromStorage() {
    try {
      const storedBudget = localStorage.getItem(STORAGE_KEY_BUDGET);
      if (storedBudget) {
        appState.budgetLimit = parseInt(storedBudget, 10) || 500000;
      }

      const storedStore = localStorage.getItem(STORAGE_KEY_STORE);
      if (storedStore) {
        appState.storeLocation = storedStore;
      }

      const storedDate = localStorage.getItem(STORAGE_KEY_DATE);
      if (storedDate) {
        appState.shoppingDate = storedDate;
      }

      const storedRefPrices = localStorage.getItem(STORAGE_KEY_REF_PRICES);
      if (storedRefPrices) {
        appState.refPrices = JSON.parse(storedRefPrices);
      } else {
        appState.refPrices = { ...DEFAULT_REF_PRICES };
        saveRefPrices();
      }

      const storedItems = localStorage.getItem(STORAGE_KEY_ITEMS);
      if (storedItems) {
        appState.items = JSON.parse(storedItems);
      } else {
        appState.items = [...DEFAULT_TROLLEY_ITEMS];
        saveItems();
      }

      const storedHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (storedHistory) {
        appState.history = JSON.parse(storedHistory);
      } else {
        // Preload satu riwayat bulan lalu sebagai acuan awal
        appState.history = [
          {
            id: 'hist-1',
            dateStr: '15 September 2026',
            totalSpent: 412000,
            totalSaved: 38000,
            itemCount: 6,
            items: [
              { name: 'Beras Ramos 5kg', qty: 1, unit: 'pack', price: 69000 },
              { name: 'Minyak Goreng 2L', qty: 1, unit: 'pack', price: 36500 },
              { name: 'Telur Ayam 1kg', qty: 1, unit: 'kg', price: 28000 },
              { name: 'Mi Instan Goreng', qty: 10, unit: 'pcs', price: 3100 },
              { name: 'Detergen Cair 800ml', qty: 1, unit: 'pack', price: 22000 },
              { name: 'Kopi Susu Instan 10s', qty: 2, unit: 'pack', price: 14000 }
            ]
          }
        ];
        saveHistory();
      }
    } catch (e) {
      console.warn('Error loading storage, fallback to defaults', e);
      appState.items = [...DEFAULT_TROLLEY_ITEMS];
      appState.refPrices = { ...DEFAULT_REF_PRICES };
    }
  }

  function saveItems() {
    localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(appState.items));
  }

  function saveBudget() {
    localStorage.setItem(STORAGE_KEY_BUDGET, appState.budgetLimit.toString());
  }

  function saveHistory() {
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(appState.history));
  }

  function saveRefPrices() {
    localStorage.setItem(STORAGE_KEY_REF_PRICES, JSON.stringify(appState.refPrices));
  }

  function saveAllToStorage() {
    saveItems();
    saveBudget();
    localStorage.setItem(STORAGE_KEY_STORE, appState.storeLocation || '');
    localStorage.setItem(STORAGE_KEY_DATE, appState.shoppingDate || '');
    saveHistory();
    saveRefPrices();
    if (appState.currentUser) {
      localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(appState.currentUser));
    }
  }

  // --- SINKRONISASI CLOUD FIRESTORE REALTIME & LOCALSTORAGE ---
  function syncToCloud(immediate = false) {
    saveAllToStorage();
    const data = computeTotals();

    if (window.FirebaseSync && typeof window.FirebaseSync.pushSessionState === 'function') {
      const payload = {
        storeLocation: appState.storeLocation,
        shoppingDate: appState.shoppingDate,
        walletLimit: appState.budgetLimit,
        items: appState.items,
        totalSpent: data.grandTotal,
        totalSaved: data.totalSavings,
        itemCount: data.items.length,
        history: appState.history,
        refPrices: appState.refPrices,
        lastUpdated: new Date().toISOString(),
        updatedBy: appState.currentUser ? appState.currentUser.username : 'Troli Bersama',
        deviceId: getDeviceId()
      };
      window.FirebaseSync.pushSessionState(payload, immediate);
    }
  }

  function getCurrentStateForCloud() {
    const data = computeTotals();
    return {
      storeLocation: appState.storeLocation,
      shoppingDate: appState.shoppingDate,
      walletLimit: appState.budgetLimit,
      items: appState.items,
      totalSpent: data.grandTotal,
      totalSaved: data.totalSavings,
      itemCount: data.items.length,
      history: appState.history,
      refPrices: appState.refPrices,
      lastUpdated: new Date().toISOString(),
      updatedBy: appState.currentUser ? appState.currentUser.username : 'Troli Bersama',
      deviceId: getDeviceId()
    };
  }

  function applyRemoteState(cloudData) {
    if (!cloudData) return;

    const myDeviceId = getDeviceId();
    const isFromOtherDevice = Boolean(cloudData.deviceId && cloudData.deviceId !== myDeviceId);

    if (cloudData.storeLocation && cloudData.storeLocation !== appState.storeLocation) {
      appState.storeLocation = cloudData.storeLocation;
      const storeInput = document.getElementById('session-store-location');
      if (storeInput && document.activeElement !== storeInput) {
        storeInput.value = cloudData.storeLocation;
      }
    }

    if (cloudData.shoppingDate && cloudData.shoppingDate !== appState.shoppingDate) {
      appState.shoppingDate = cloudData.shoppingDate;
      const dateInput = document.getElementById('session-shopping-date');
      if (dateInput && document.activeElement !== dateInput) {
        dateInput.value = cloudData.shoppingDate;
      }
    }

    const newLimit = typeof cloudData.walletLimit === 'number' ? cloudData.walletLimit : (cloudData.budgetLimit || appState.budgetLimit);
    if (typeof newLimit === 'number' && newLimit > 0 && newLimit !== appState.budgetLimit) {
      appState.budgetLimit = newLimit;
      const budgetInput = document.getElementById('budget-limit-input');
      if (budgetInput && document.activeElement !== budgetInput) {
        budgetInput.value = newLimit;
      }
    }

    // Pastikan item-item dari cloud terisi lengkap tanpa missing properties
    if (Array.isArray(cloudData.items)) {
      appState.items = cloudData.items.map(it => ({
        id: String(it.id || ('item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5))),
        name: String(it.name || '').trim(),
        unitPrice: Number(it.unitPrice || it.price || 0),
        qty: Math.max(1, Number(it.qty || 1)),
        discountInput: String(it.discountInput || ''),
        category: String(it.category || 'pokok'),
        unit: String(it.unit || 'pcs'),
        inTrolley: Boolean(it.inTrolley)
      }));
    }

    if (Array.isArray(cloudData.history)) {
      appState.history = cloudData.history;
    }

    if (cloudData.refPrices && typeof cloudData.refPrices === 'object') {
      appState.refPrices = cloudData.refPrices;
    }

    if (cloudData.updatedBy) {
      appState.lastUpdatedBy = cloudData.updatedBy;
    }
    if (cloudData.lastUpdated) {
      appState.lastUpdatedAt = cloudData.lastUpdated;
    }

    // Simpan salinan terbaru ke LocalStorage (Offline Fallback aman saat F5!)
    saveAllToStorage();

    // Render ulang layar seketika tanpa perlu refresh browser
    renderAll();

    // Update status bar editor
    const lastEditorEl = document.getElementById('session-last-editor');
    if (lastEditorEl && cloudData.updatedBy) {
      lastEditorEl.textContent = `Update: ${cloudData.updatedBy}`;
    }

    // Tampilkan notifikasi jika perubahan datang dari perangkat lain (HP di supermarket / PC di rumah)
    if (isFromOtherDevice) {
      const who = cloudData.updatedBy || 'perangkat lain';
      showToast(`⚡ Troli diperbarui dari ${who}!`, 'success');
    }
  }

  function updateSyncStatus(statusObj) {
    const syncPill = document.getElementById('session-sync-pill');
    const syncText = document.getElementById('session-sync-text');
    const lastEditorEl = document.getElementById('session-last-editor');

    if (!syncPill || !syncText) return;

    if (statusObj.status === 'connected') {
      syncPill.className = 'session-sync-indicator';
      syncText.textContent = 'Realtime Multi-Device Aktif';
      if (lastEditorEl) {
        if (statusObj.updatedBy) {
          lastEditorEl.textContent = `Update: ${statusObj.updatedBy}`;
        } else {
          lastEditorEl.textContent = 'HP & PC Terhubung';
        }
      }
    } else if (statusObj.status === 'syncing') {
      syncPill.className = 'session-sync-indicator';
      syncText.textContent = statusObj.text || 'Menyinkronkan...';
    } else {
      syncPill.className = 'session-sync-indicator sync-offline';
      syncText.textContent = statusObj.text || 'Mode Offline (LocalStorage)';
      if (lastEditorEl) {
        lastEditorEl.textContent = 'Data aman di perangkat';
      }
    }
  }

  // --- SISTEM 1 AKUN MULTI-DEVICE (HP & PC) ---
  function checkAuthStatus() {
    const storedAuth = localStorage.getItem(STORAGE_KEY_AUTH);
    if (storedAuth) {
      try {
        appState.currentUser = JSON.parse(storedAuth);
      } catch (e) {
        appState.currentUser = { username: 'Keluarga Rantau', loggedIn: true };
      }
    } else {
      openLoginModal();
    }
    updateUserBadge();
  }

  function updateUserBadge() {
    const badgeText = document.getElementById('active-user-name');
    if (badgeText && appState.currentUser) {
      badgeText.textContent = appState.currentUser.username || 'Keluarga';
    }
  }

  function openLoginModal() {
    const modal = document.getElementById('login-modal-overlay');
    if (modal) {
      modal.style.display = 'flex';
      const usernameInput = document.getElementById('login-username');
      if (usernameInput && appState.currentUser) {
        usernameInput.value = appState.currentUser.username || 'Keluarga Rantau';
      }
    }
  }

  function closeLoginModal() {
    const modal = document.getElementById('login-modal-overlay');
    if (modal) modal.style.display = 'none';
  }

  function handleLogin() {
    const usernameInput = document.getElementById('login-username');
    const username = (usernameInput && usernameInput.value.trim()) || 'Keluarga Rantau';

    // Tidak diverifikasi, langsung dianggap benar untuk kemudahan akses bersama
    appState.currentUser = {
      username: username,
      loggedIn: true,
      loginAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(appState.currentUser));
    updateUserBadge();
    closeLoginModal();
    showToast(`Akun '${username}' aktif! Troli tersinkron.`, 'success');

    // Langsung dorong state terkini ke cloud dengan nama akun baru
    syncToCloud(true);
  }

  function initFirebaseRealtime() {
    if (window.FirebaseSync && typeof window.FirebaseSync.initFirebaseSync === 'function') {
      window.FirebaseSync.initFirebaseSync(applyRemoteState, updateSyncStatus);
    } else {
      setTimeout(initFirebaseRealtime, 200);
    }
  }

  // --- CLOCK STATUS BAR ---
  function setupClock() {
    const timeEl = document.getElementById('phone-time');
    function updateTime() {
      if (!timeEl) return;
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      timeEl.textContent = `${hours}:${mins}`;
    }
    updateTime();
    setInterval(updateTime, 30000);
  }

  // --- COMPUTATIONS FOR SAFETY CAP ---
  function computeTotals() {
    let grandTotal = 0;
    let totalSavings = 0;
    let checkedCount = 0;

    const enrichedItems = appState.items.map(item => {
      const discountData = calculateTieredDiscount(item.unitPrice, item.discountInput);
      const lineTotal = discountData.effectiveUnitPrice * item.qty;
      const lineSavings = discountData.savingPerUnit * item.qty;
      const comparator = comparePriceWithLastMonth(item.name, item.unitPrice);

      grandTotal += lineTotal;
      totalSavings += lineSavings;
      if (item.inTrolley) checkedCount++;

      return {
        ...item,
        effectiveUnitPrice: discountData.effectiveUnitPrice,
        savingPerUnit: discountData.savingPerUnit,
        discountLabel: discountData.discountLabel,
        effectivePercent: discountData.effectivePercent,
        lineTotal: lineTotal,
        comparator: comparator
      };
    });

    const budgetLimit = appState.budgetLimit || 1;
    const remaining = budgetLimit - grandTotal;
    const spentPercent = Math.min(150, Math.round((grandTotal / budgetLimit) * 100));

    let status = 'safe';
    let statusLabel = 'Aman ✅';

    if (spentPercent >= 100) {
      status = 'danger';
      statusLabel = `⚠️ OVER BUDGET! (+${formatRupiah(Math.abs(remaining))})`;
    } else if (spentPercent >= 85) {
      status = 'warning';
      statusLabel = 'Hati-hati, Dekat Limit! ⚠️';
    }

    return {
      items: enrichedItems,
      grandTotal,
      totalSavings,
      checkedCount,
      budgetLimit,
      remaining,
      spentPercent,
      status,
      statusLabel
    };
  }

  // --- RENDER FUNCTIONS ---
  function renderAll() {
    const data = computeTotals();
    renderSafetyCapHeader(data);
    renderTrolleyList(data);
    renderCategoryAnalytics(data);
    renderHistoryTab();
    renderNavBadges(data);
  }

  function renderSafetyCapHeader(data) {
    const headerEl = document.getElementById('safety-header');
    const spentValEl = document.getElementById('spent-val');
    const statusTagEl = document.getElementById('safety-status-tag');
    const progressFillEl = document.getElementById('safety-progress-fill');
    const progressSubtextEl = document.getElementById('progress-subtext');
    const quickBudgetBtn = document.getElementById('quick-budget-val');

    if (!headerEl) return;

    // Remove previous classes
    headerEl.classList.remove('warning', 'danger');
    statusTagEl.className = 'safety-status-tag ' + data.status;

    if (data.status === 'warning') {
      headerEl.classList.add('warning');
    } else if (data.status === 'danger') {
      headerEl.classList.add('danger');
      // Trigger haptic vibration on mobile if over budget
      if (navigator.vibrate) {
        try { navigator.vibrate([100, 50, 100]); } catch (e) {}
      }
    }

    spentValEl.textContent = formatRupiah(data.grandTotal);
    statusTagEl.textContent = data.statusLabel;

    // Progress bar fill width & color
    progressFillEl.style.width = `${Math.min(100, data.spentPercent)}%`;
    progressFillEl.className = 'progress-fill ' + (data.status !== 'safe' ? data.status : '');

    if (quickBudgetBtn) {
      quickBudgetBtn.textContent = formatRupiah(data.budgetLimit);
    }

    if (progressSubtextEl) {
      const remainingText = data.remaining >= 0
        ? `Sisa Anggaran: ${formatRupiah(data.remaining)}`
        : `Defisit Dompet: -${formatRupiah(Math.abs(data.remaining))}`;
      progressSubtextEl.innerHTML = `
        <span>${data.spentPercent}% Terpakai</span>
        <span>${remainingText}</span>
      `;
    }
  }

  function renderTrolleyList(data) {
    const listContainer = document.getElementById('grocery-list-container');
    const emptyStateEl = document.getElementById('empty-trolley-state');
    const bannerSavingsEl = document.getElementById('trolley-savings-summary');
    const bannerCountEl = document.getElementById('trolley-item-count');
    const checkoutDock = document.getElementById('checkout-bar-dock');
    const checkoutTotalEl = document.getElementById('checkout-btn-total');

    if (!listContainer) return;

    // Update banner savings & counts
    if (bannerSavingsEl) {
      bannerSavingsEl.textContent = data.totalSavings > 0
        ? `Hemat: ${formatRupiah(data.totalSavings)} 🎉`
        : 'Diskon bertingkat siap';
    }
    if (bannerCountEl) {
      bannerCountEl.textContent = `${data.checkedCount}/${data.items.length} di Troli`;
    }
    if (checkoutTotalEl) {
      checkoutTotalEl.textContent = formatRupiah(data.grandTotal);
    }

    // Filter items based on active category and search
    let filteredItems = data.items.filter(item => {
      const matchCat = appState.activeCategoryFilter === 'all' || item.category === appState.activeCategoryFilter;
      const matchQuery = !appState.searchQuery || item.name.toLowerCase().includes(appState.searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });

    if (data.items.length === 0) {
      listContainer.innerHTML = '';
      if (emptyStateEl) emptyStateEl.style.display = 'block';
      if (checkoutDock) checkoutDock.style.display = 'none';
      return;
    }

    if (emptyStateEl) emptyStateEl.style.display = 'none';
    if (checkoutDock) checkoutDock.style.display = 'block';

    if (filteredItems.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align:center; padding: 30px 10px; color: var(--text-muted); font-size: 13px;">
          Tidak ada barang belanja pada kategori ini.
        </div>
      `;
      return;
    }

    listContainer.innerHTML = filteredItems.map(item => {
      const hasDiscount = item.savingPerUnit > 0;
      const comp = item.comparator;

      // Category Icon & Name
      const catEmojiMap = {
        pokok: '🌾 Pokok',
        protein: '🥩 Protein',
        sayur: '🥬 Sayur/Buah',
        bumbu: '🧂 Dapur',
        kebersihan: '🧴 Bersih',
        minuman: '☕ Minuman',
        camilan: '🍪 Snack'
      };
      const catLabel = catEmojiMap[item.category] || '📦 Lainnya';

      // Comparator Tag
      let compTagHtml = '';
      if (comp.status !== 'none') {
        compTagHtml = `<div class="comparator-tag ${comp.status}">${comp.label}</div>`;
      }

      return `
        <div class="grocery-card ${item.inTrolley ? 'checked' : ''}" data-id="${item.id}">
          <div class="card-top-row">
            <button class="check-trolley-btn" onclick="window.SmartGrocery.toggleCheckItem('${item.id}')" title="Tandai sudah masuk troli">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </button>
            <div class="card-info">
              <div class="card-title-row">
                <div class="item-name">${escapeHtml(item.name)}</div>
                <div class="card-actions-quick">
                  <button class="action-icon-btn" onclick="window.SmartGrocery.openEditModal('${item.id}')" title="Edit">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button class="action-icon-btn delete" onclick="window.SmartGrocery.deleteItem('${item.id}')" title="Hapus">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="item-badge-category">${catLabel}</div>
              
              <!-- Comparator Tag -->
              ${compTagHtml}

              <!-- Price & Discount Line -->
              <div class="price-display-row">
                ${hasDiscount 
                  ? `<span class="unit-price-base strikethrough">${formatRupiah(item.unitPrice)}</span>
                     <span class="discount-pill">🏷️ -${item.discountLabel}</span>
                     <span class="unit-price-effective">${formatRupiah(item.effectiveUnitPrice)}</span>`
                  : `<span class="unit-price-effective">${formatRupiah(item.unitPrice)}</span>`
                }
                <span style="font-size:11px; color:var(--text-dim);">/ ${escapeHtml(item.unitunit || item.unit || 'pcs')}</span>
              </div>
            </div>
          </div>

          <!-- Card Bottom: Touch Stepper & Subtotal -->
          <div class="card-bottom-row">
            <div class="stepper-container">
              <button class="stepper-btn" onclick="window.SmartGrocery.updateQty('${item.id}', -1)">-</button>
              <span class="stepper-value">${item.qty}</span>
              <span class="stepper-unit">${escapeHtml(item.unit || 'pcs')}</span>
              <button class="stepper-btn" onclick="window.SmartGrocery.updateQty('${item.id}', 1)">+</button>
            </div>
            
            <div class="card-subtotal-group">
              <div class="subtotal-label">Subtotal</div>
              <div class="subtotal-amount">${formatRupiah(item.lineTotal)}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderCategoryAnalytics(data) {
    const container = document.getElementById('category-bars-container');
    if (!container) return;

    const catTotals = {};
    const catLabels = {
      pokok: 'Bahan Pokok',
      protein: 'Lauk & Protein',
      sayur: 'Sayur & Buah',
      bumbu: 'Dapur & Bumbu',
      kebersihan: 'Mandi & Kebersihan',
      minuman: 'Minuman',
      camilan: 'Camilan & Jajan'
    };

    data.items.forEach(item => {
      const cat = item.category || 'pokok';
      catTotals[cat] = (catTotals[cat] || 0) + item.lineTotal;
    });

    const entries = Object.entries(catTotals);
    if (entries.length === 0) {
      container.innerHTML = '<div style="font-size:12px; color:var(--text-muted); text-align:center; padding:12px;">Belum ada pengeluaran belanja tercatat.</div>';
      return;
    }

    container.innerHTML = entries.map(([cat, total]) => {
      const pct = data.grandTotal > 0 ? Math.round((total / data.grandTotal) * 100) : 0;
      const label = catLabels[cat] || cat;
      return `
        <div class="cat-bar-item">
          <div class="cat-bar-header">
            <span>${label} (${pct}%)</span>
            <span>${formatRupiah(total)}</span>
          </div>
          <div class="cat-progress-track">
            <div class="cat-progress-fill" style="width: ${pct}%"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderHistoryTab() {
    const listEl = document.getElementById('history-list-container');
    const refContainer = document.getElementById('ref-prices-list');
    if (!listEl) return;

    if (appState.history.length === 0) {
      listEl.innerHTML = `
        <div style="text-align:center; padding: 25px 10px; color: var(--text-muted); font-size: 13px;">
          Belum ada riwayat belanja. Tekan <strong>Selesaikan Belanja (Checkout)</strong> di tab Belanja setelah selesai belanja.
        </div>
      `;
    } else {
      listEl.innerHTML = appState.history.map((hist, idx) => {
        return `
          <div class="history-card ${idx === 0 ? 'expanded' : ''}" id="hist-${hist.id}">
            <div class="history-card-header" onclick="window.SmartGrocery.toggleHistoryCard('hist-${hist.id}')">
              <div>
                <div class="history-date">🛒 ${escapeHtml(hist.dateStr)}</div>
                <div class="history-meta">${hist.itemCount || hist.items.length} Barang Belanja</div>
              </div>
              <div class="history-total-badge">
                <div class="history-total-val">${formatRupiah(hist.totalSpent)}</div>
                ${hist.totalSaved > 0 ? `<div class="history-discount-saved">Hemat ${formatRupiah(hist.totalSaved)}</div>` : ''}
              </div>
            </div>
            <div class="history-card-body">
              <div style="margin: 8px 0;">
                ${hist.items.map(it => `
                  <div class="history-item-row">
                    <div>
                      <strong>${escapeHtml(it.name)}</strong>
                      <span style="color:var(--text-dim); margin-left:4px;">x${it.qty} ${escapeHtml(it.unit || '')}</span>
                    </div>
                    <div>${formatRupiah((it.price || it.unitPrice || 0) * (it.qty || 1))}</div>
                  </div>
                `).join('')}
              </div>
              <div class="history-actions-row">
                <button class="btn-history-action" onclick="window.SmartGrocery.copyHistorySummary('${hist.id}')">
                  📋 Salin Catatan WA
                </button>
                <button class="btn-history-action" onclick="window.SmartGrocery.restoreHistoryToCart('${hist.id}')">
                  🔁 Pakai Ulang Daftar
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    // Render Reference Price Database
    if (refContainer) {
      const refList = Object.entries(appState.refPrices);
      refContainer.innerHTML = refList.map(([key, data]) => {
        return `
          <div class="ref-item-row">
            <div>
              <div class="ref-name">${escapeHtml(data.name || key)}</div>
              <div style="font-size:10.5px; color:var(--text-dim);">Satuan acuan: ${escapeHtml(data.unit || 'pcs')}</div>
            </div>
            <div class="ref-price">${formatRupiah(data.price)}</div>
          </div>
        `;
      }).join('');
    }
  }

  function renderNavBadges(data) {
    const badgeEl = document.getElementById('nav-trolley-badge');
    if (badgeEl) {
      const remainingToPick = data.items.length - data.checkedCount;
      if (data.items.length > 0) {
        badgeEl.style.display = 'block';
        badgeEl.textContent = data.items.length;
      } else {
        badgeEl.style.display = 'none';
      }
    }
  }

  // --- ACTIONS & ITEM HANDLERS ---
  function updateQty(itemId, change) {
    const item = appState.items.find(i => i.id === itemId);
    if (!item) return;

    const newQty = item.qty + change;
    if (newQty <= 0) {
      deleteItem(itemId);
      return;
    }

    item.qty = newQty;
    saveItems();
    syncToCloud(false);
    renderAll();
  }

  function toggleCheckItem(itemId) {
    const item = appState.items.find(i => i.id === itemId);
    if (!item) return;
    item.inTrolley = !item.inTrolley;
    saveItems();
    syncToCloud(true);
    renderAll();
  }

  function deleteItem(itemId) {
    appState.items = appState.items.filter(i => i.id !== itemId);
    saveItems();
    syncToCloud(true);
    renderAll();
    showToast('Barang dihapus dari troli');
  }

  function populatePresetItems() {
    appState.items = [...DEFAULT_TROLLEY_ITEMS];
    saveItems();
    syncToCloud(true);
    renderAll();
    showToast('Daftar barang kebutuhan pokok ditambahkan!', 'success');
  }

  // --- BOTTOM SHEET MODAL (ADD / EDIT ITEM) ---
  function openAddModal() {
    appState.editingItemId = null;
    document.getElementById('modal-sheet-title').textContent = 'Tambah Barang Belanja';
    document.getElementById('item-input-name').value = '';
    document.getElementById('item-input-price').value = '';
    document.getElementById('item-input-qty').value = '1';
    document.getElementById('item-input-discount').value = '';

    // Set default category & unit
    selectModalCategory('pokok');
    selectModalUnit('pcs');

    updateModalRealtimeCalculator();
    document.getElementById('item-modal-overlay').classList.add('open');
  }

  function openEditModal(itemId) {
    const item = appState.items.find(i => i.id === itemId);
    if (!item) return;

    appState.editingItemId = itemId;
    document.getElementById('modal-sheet-title').textContent = 'Edit Barang Belanja';
    document.getElementById('item-input-name').value = item.name;
    document.getElementById('item-input-price').value = item.unitPrice;
    document.getElementById('item-input-qty').value = item.qty;
    document.getElementById('item-input-discount').value = item.discountInput || '';

    selectModalCategory(item.category || 'pokok');
    selectModalUnit(item.unit || 'pcs');

    updateModalRealtimeCalculator();
    document.getElementById('item-modal-overlay').classList.add('open');
  }

  function closeModal() {
    document.getElementById('item-modal-overlay').classList.remove('open');
    appState.editingItemId = null;
  }

  function selectModalCategory(cat) {
    document.querySelectorAll('.cat-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cat === cat);
    });
  }

  function selectModalUnit(unit) {
    document.querySelectorAll('.unit-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.unit === unit);
    });
  }

  function getSelectedModalCategory() {
    const active = document.querySelector('.cat-pill.active');
    return active ? active.dataset.cat : 'pokok';
  }

  function getSelectedModalUnit() {
    const active = document.querySelector('.unit-pill.active');
    return active ? active.dataset.unit : 'pcs';
  }

  // --- REALTIME MODAL CALCULATOR & COMPARATOR ---
  function updateModalRealtimeCalculator() {
    const nameVal = document.getElementById('item-input-name').value.trim();
    const priceVal = parseNumber(document.getElementById('item-input-price').value);
    const qtyVal = parseInt(document.getElementById('item-input-qty').value, 10) || 1;
    const discountVal = document.getElementById('item-input-discount').value.trim();

    // 1. Comparator Realtime Preview
    const compBox = document.getElementById('modal-comp-box');
    const compStatusVal = document.getElementById('modal-comp-status');
    const compDetailVal = document.getElementById('modal-comp-detail');

    if (nameVal && priceVal > 0) {
      const comp = comparePriceWithLastMonth(nameVal, priceVal);
      compBox.style.display = 'flex';
      compStatusVal.className = 'safety-status-tag ' + (comp.status === 'up' ? 'danger' : (comp.status === 'down' ? 'safe' : 'warning'));
      compStatusVal.textContent = comp.label;

      if (comp.lastMonthPrice) {
        compDetailVal.textContent = `Harga bulan lalu: ${formatRupiah(comp.lastMonthPrice)}`;
      } else {
        compDetailVal.textContent = 'Belum ada riwayat harga barang ini.';
      }
    } else {
      compBox.style.display = 'none';
    }

    // 2. Kalkulator Diskon Bertingkat Preview
    const discPreview = document.getElementById('discount-calc-preview');
    if (priceVal > 0 && discountVal) {
      const disc = calculateTieredDiscount(priceVal, discountVal);
      if (disc.savingPerUnit > 0) {
        discPreview.style.display = 'block';
        const lineTotal = disc.effectiveUnitPrice * qtyVal;
        
        let stepsHtml = '';
        if (disc.steps.length > 1) {
          stepsHtml = `
            <div style="font-size:10.5px; color:var(--text-muted); margin: 4px 0;">
              Rumus Bertingkat: ${disc.steps.map(s => `${formatRupiah(s.prevPrice)} - ${s.percent}% = ${formatRupiah(s.resultingPrice)}`).join('<br>')}
            </div>
          `;
        }

        discPreview.innerHTML = `
          <div>Harga Awal: <del>${formatRupiah(priceVal)}</del></div>
          ${stepsHtml}
          <div>Harga Setelah Diskon: <strong>${formatRupiah(disc.effectiveUnitPrice)}</strong> (Hemat ${formatRupiah(disc.savingPerUnit * qtyVal)})</div>
          <div>Total Baris (x${qtyVal}): <strong>${formatRupiah(lineTotal)}</strong></div>
        `;
      } else {
        discPreview.style.display = 'none';
      }
    } else {
      discPreview.style.display = 'none';
    }
  }

  function handleSaveModalItem() {
    const name = document.getElementById('item-input-name').value.trim();
    const price = parseNumber(document.getElementById('item-input-price').value);
    const qty = parseInt(document.getElementById('item-input-qty').value, 10) || 1;
    const discount = document.getElementById('item-input-discount').value.trim();
    const category = getSelectedModalCategory();
    const unit = getSelectedModalUnit();

    if (!name) {
      showToast('Harap isi nama produk!', 'danger');
      return;
    }
    if (price <= 0) {
      showToast('Harap isi harga satuan barang!', 'danger');
      return;
    }

    if (appState.editingItemId) {
      const item = appState.items.find(i => i.id === appState.editingItemId);
      if (item) {
        item.name = name;
        item.unitPrice = price;
        item.qty = qty;
        item.discountInput = discount;
        item.category = category;
        item.unit = unit;
      }
      showToast('Barang berhasil diperbarui!', 'success');
    } else {
      const newItem = {
        id: 'item-' + Date.now(),
        name,
        unitPrice: price,
        qty,
        discountInput: discount,
        category,
        unit,
        inTrolley: false
      };
      appState.items.unshift(newItem);
      showToast('Barang masuk ke troli!', 'success');
    }

    saveItems();
    syncToCloud(true);
    closeModal();
    renderAll();
  }

  // --- CHECKOUT / SELESAIKAN BELANJA BULAN INI ---
  function handleCheckout() {
    if (appState.items.length === 0) {
      showToast('Troli belanja masih kosong!', 'danger');
      return;
    }

    const data = computeTotals();
    const confirmed = confirm(
      `Selesaikan Belanja Bulan Ini?\n\n` +
      `Total Belanja: ${formatRupiah(data.grandTotal)}\n` +
      `Total Penghematan Diskon: ${formatRupiah(data.totalSavings)}\n` +
      `Jumlah Barang: ${data.items.length} item\n\n` +
      `Data akan diarsipkan ke Riwayat dan harga terbaru akan disimpan sebagai acuan bulan depan!`
    );

    if (!confirmed) return;

    // 1. Simpan ke Riwayat
    const now = new Date();
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const dateStr = `${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;

    const newHistoryEntry = {
      id: 'hist-' + Date.now(),
      dateStr: dateStr,
      totalSpent: data.grandTotal,
      totalSaved: data.totalSavings,
      itemCount: data.items.length,
      items: data.items.map(it => ({
        name: it.name,
        qty: it.qty,
        unit: it.unit,
        price: it.effectiveUnitPrice
      }))
    };

    appState.history.unshift(newHistoryEntry);
    saveHistory();

    // 2. Update Database Acuan Harga Bulan Lalu dengan harga belanja saat ini
    data.items.forEach(it => {
      const normKey = it.name.toLowerCase().trim();
      appState.refPrices[normKey] = {
        name: it.name,
        price: it.unitPrice,
        unit: it.unit
      };
    });
    saveRefPrices();

    // 3. Bersihkan keranjang belanja
    appState.items = [];
    saveItems();
    syncToCloud(true);

    renderAll();
    switchTab('history');
    showToast('Belanja selesai & tersimpan di Riwayat!', 'success');
  }

  // --- RESTORE HISTORY LIST TO CART ---
  function restoreHistoryToCart(histId) {
    const hist = appState.history.find(h => h.id === histId);
    if (!hist) return;

    const confirmed = confirm(`Gunakan daftar belanja "${hist.dateStr}" untuk troli belanja hari ini?`);
    if (!confirmed) return;

    appState.items = hist.items.map((it, idx) => ({
      id: 'item-restored-' + Date.now() + '-' + idx,
      name: it.name,
      category: 'pokok',
      unit: it.unit || 'pcs',
      qty: it.qty || 1,
      unitPrice: it.price || it.unitPrice || 0,
      discountInput: '',
      inTrolley: false
    }));

    saveItems();
    syncToCloud(true);
    renderAll();
    switchTab('trolley');
    showToast('Daftar berhasil disalin ke Troli!', 'success');
  }

  // --- COPY HISTORY SUMMARY (WHATSAPP SHAREABLE) ---
  function copyHistorySummary(histId) {
    const hist = appState.history.find(h => h.id === histId);
    if (!hist) return;

    let text = `🛒 *RINGKASAN BELANJA BULANAN*\n`;
    text += `📅 Tanggal: ${hist.dateStr}\n`;
    text += `💰 Total Pengeluaran: ${formatRupiah(hist.totalSpent)}\n`;
    if (hist.totalSaved > 0) {
      text += `🎉 Total Hemat Diskon: ${formatRupiah(hist.totalSaved)}\n`;
    }
    text += `\n*Daftar Belanja:*\n`;
    hist.items.forEach((it, i) => {
      text += `${i + 1}. ${it.name} (${it.qty} ${it.unit || 'pcs'}) = ${formatRupiah((it.price || 0) * (it.qty || 1))}\n`;
    });
    text += `\n_Dicatat dengan Smart Grocery Tracker PWA_`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('Ringkasan disalin ke clipboard! Siap kirim WA.', 'success');
      }).catch(() => {
        fallbackCopyText(text);
      });
    } else {
      fallbackCopyText(text);
    }
  }

  function fallbackCopyText(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showToast('Ringkasan disalin ke clipboard!', 'success');
    } catch (err) {
      showToast('Gagal menyalin otomatis', 'danger');
    }
    document.body.removeChild(textArea);
  }

  // --- TAB SWITCHING ---
  function switchTab(tabName) {
    document.querySelectorAll('.tab-view').forEach(view => {
      view.classList.toggle('active', view.id === `tab-view-${tabName}`);
    });
    document.querySelectorAll('.nav-item-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Scroll to top of main content
    const scroller = document.querySelector('.main-content');
    if (scroller) scroller.scrollTop = 0;
  }

  // --- TOAST NOTIFICATION ---
  function showToast(message, type = 'normal') {
    const toast = document.getElementById('toast-notice');
    if (!toast) return;

    toast.textContent = message;
    toast.className = 'toast-notice show ' + (type === 'danger' ? 'danger' : (type === 'success' ? 'success' : ''));

    setTimeout(() => {
      toast.classList.remove('show');
    }, 2400);
  }

  function escapeHtml(string) {
    if (!string) return '';
    return String(string)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- EVENT LISTENERS SETUP ---
  function setupEventListeners() {
    // Nav Tab Buttons
    document.querySelectorAll('.nav-item-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        switchTab(tab);
      });
    });

    // Category Filter Chips in Trolley
    document.querySelectorAll('.chip-btn').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.chip-btn').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        appState.activeCategoryFilter = chip.dataset.cat;
        renderAll();
      });
    });

    // Search bar
    const searchInput = document.getElementById('search-item-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        appState.searchQuery = e.target.value.trim();
        renderAll();
      });
    }

    // Modal Category & Unit selection
    document.querySelectorAll('.cat-pill').forEach(pill => {
      pill.addEventListener('click', () => selectModalCategory(pill.dataset.cat));
    });
    document.querySelectorAll('.unit-pill').forEach(pill => {
      pill.addEventListener('click', () => selectModalUnit(pill.dataset.unit));
    });

    // Realtime changes inside modal
    ['item-input-name', 'item-input-price', 'item-input-qty', 'item-input-discount'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', updateModalRealtimeCalculator);
      }
    });

    // Suggestion chips in modal
    const suggestWrap = document.getElementById('modal-suggestions');
    if (suggestWrap) {
      suggestWrap.innerHTML = POPULAR_SUGGESTIONS.map(s => {
        return `<button type="button" class="suggest-chip" onclick="window.SmartGrocery.applySuggestion('${escapeHtml(s.name)}', '${s.cat}', '${s.unit}', ${s.price})">${escapeHtml(s.name)}</button>`;
      }).join('');
    }

    // Modal Qty Stepper buttons
    const btnDecQty = document.getElementById('modal-qty-dec');
    const btnIncQty = document.getElementById('modal-qty-inc');
    const inputQty = document.getElementById('item-input-qty');
    if (btnDecQty && inputQty) {
      btnDecQty.addEventListener('click', () => {
        let val = parseInt(inputQty.value, 10) || 1;
        if (val > 1) inputQty.value = val - 1;
        updateModalRealtimeCalculator();
      });
    }
    if (btnIncQty && inputQty) {
      btnIncQty.addEventListener('click', () => {
        let val = parseInt(inputQty.value, 10) || 1;
        inputQty.value = val + 1;
        updateModalRealtimeCalculator();
      });
    }

    // Quick discount chips in modal
    document.querySelectorAll('.quick-disc-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const discInput = document.getElementById('item-input-discount');
        discInput.value = btn.dataset.val;
        updateModalRealtimeCalculator();
      });
    });

    // Session Store Location Input (Realtime sync HP & PC)
    const storeLocationInput = document.getElementById('session-store-location');
    if (storeLocationInput) {
      storeLocationInput.value = appState.storeLocation || 'Superindo Sudirman';
      storeLocationInput.addEventListener('input', (e) => {
        appState.storeLocation = e.target.value.trim() || 'Superindo';
        syncToCloud(false);
      });
    }

    // Session Shopping Date Input (Realtime sync HP & PC)
    const shoppingDateInput = document.getElementById('session-shopping-date');
    if (shoppingDateInput) {
      shoppingDateInput.value = appState.shoppingDate || new Date().toISOString().split('T')[0];
      shoppingDateInput.addEventListener('change', (e) => {
        appState.shoppingDate = e.target.value;
        syncToCloud(true);
      });
    }

    // Budget Input in Tab 3
    const budgetInput = document.getElementById('budget-limit-input');
    if (budgetInput) {
      budgetInput.value = appState.budgetLimit;
      budgetInput.addEventListener('change', (e) => {
        const val = parseNumber(e.target.value);
        if (val > 0) {
          appState.budgetLimit = val;
          saveBudget();
          syncToCloud(true);
          renderAll();
          showToast('Batas anggaran berhasil disimpan!', 'success');
        }
      });
    }

    // Preset Budget Chips in Tab 3
    document.querySelectorAll('.preset-budget-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.dataset.val, 10);
        if (val) {
          appState.budgetLimit = val;
          if (budgetInput) budgetInput.value = val;
          saveBudget();
          syncToCloud(true);
          renderAll();
          showToast(`Anggaran diset ke ${formatRupiah(val)}!`, 'success');
        }
      });
    });
  }

  // --- PWA SERVICE WORKER SETUP ---
  function setupPWA() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(reg => {
          console.log('ServiceWorker registered with scope:', reg.scope);
        }).catch(err => {
          console.log('ServiceWorker registration failed:', err);
        });
      });
    }
  }

  // --- EXPOSE GLOBAL METHODS FOR INLINE ONCLICK HANDLERS & FIREBASE ---
  window.SmartGrocery = {
    updateQty,
    toggleCheckItem,
    deleteItem,
    openAddModal,
    openEditModal,
    closeModal,
    handleSaveModalItem,
    populatePresetItems,
    handleCheckout,
    restoreHistoryToCart,
    copyHistorySummary,
    openLoginModal,
    closeLoginModal,
    handleLogin,
    getCurrentStateForCloud,
    applyRemoteState,
    updateSyncStatus,
    syncToCloud,
    toggleHistoryCard: (cardId) => {
      const card = document.getElementById(cardId);
      if (card) card.classList.toggle('expanded');
    },
    applySuggestion: (name, cat, unit, price) => {
      document.getElementById('item-input-name').value = name;
      document.getElementById('item-input-price').value = price;
      selectModalCategory(cat);
      selectModalUnit(unit);
      updateModalRealtimeCalculator();
    },
    switchTab
  };

  // Start the app when DOM is ready
  document.addEventListener('DOMContentLoaded', initApp);
})();
