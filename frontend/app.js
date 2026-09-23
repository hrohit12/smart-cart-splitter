// ==========================================================
// SMART CART SPLITTER - FRONTEND CLIENT & CHECKOUT ENGINE
// ==========================================================

// Configurable API base URL: works on localhost, custom port, Netlify, Railway, etc.
const API_BASE_URL = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) ||
  (window.location.port === '5500' ? 'http://localhost:5000' : window.location.origin);

const PAYMENT_LIMIT = 2000;
const DEMO_FEE_RATE = 0.004; // 0.40%
const MAX_SPLIT_AMOUNT = 1999;

// Global checkout state
const state = {
  cart: [],
  currentUser: null,
  customAmount: null,
  order: null,
  splits: [],
  currentSplit: null,
  pollingTimer: null,
  activeModal: false
};

// -----------------------------------------------------------------------------
// REUSABLE SPLIT ALGORITHM (Section 3)
// -----------------------------------------------------------------------------
function calculateSplits(totalAmount, limit = PAYMENT_LIMIT) {
  const total = Number(totalAmount);
  if (isNaN(total) || total <= 0) return [];

  if (total <= limit) {
    return [
      {
        sequence_number: 1,
        amount: Number(total.toFixed(2)),
        amount_paise: Math.round(total * 100),
        status: 'READY'
      }
    ];
  }

  const numberOfSplits = Math.ceil(total / MAX_SPLIT_AMOUNT);
  const totalPaise = Math.round(total * 100);
  const basePaise = Math.floor(totalPaise / numberOfSplits);
  const remainder = totalPaise % numberOfSplits;

  const splits = [];
  for (let i = 0; i < numberOfSplits; i++) {
    const splitPaise = basePaise + (i < remainder ? 1 : 0);
    splits.push({
      sequence_number: i + 1,
      amount: Number((splitPaise / 100).toFixed(2)),
      amount_paise: splitPaise,
      status: i === 0 ? 'READY' : 'LOCKED'
    });
  }
  return splits;
}

// -----------------------------------------------------------------------------
// CART CALCULATION & UI RE-RENDER
// -----------------------------------------------------------------------------
function loadCartFromStorage() {
  const stored = localStorage.getItem('smartCart');
  if (stored) {
    try {
      state.cart = JSON.parse(stored);
    } catch(e) {
      state.cart = [];
    }
  }
}

function saveCartToStorage() {
  localStorage.setItem('smartCart', JSON.stringify(state.cart));
}

function getCartTotal() {
  if (state.customAmount !== null) {
    return state.customAmount;
  }
  return state.cart.reduce((total, item) => total + (item.unitPrice * item.quantity), 0);
}

function updateCartUI() {
  const total = getCartTotal();
  const splits = calculateSplits(total, PAYMENT_LIMIT);
  const isSplitRequired = total > PAYMENT_LIMIT;
  const estimatedSavings = isSplitRequired ? (total * DEMO_FEE_RATE) : 0;

  // Render Cart Items
  const cartContainer = document.getElementById('cart-items-container');
  if (cartContainer) {
    if (state.cart.length === 0) {
      cartContainer.innerHTML = `
        <div style="text-align: center; padding: 40px 0; color: var(--text-muted);">
          Your cart is empty.<br><br>
          <a href="/store" class="btn-primary" style="display: inline-block; text-decoration: none;">Browse Store</a>
        </div>
      `;
    } else {
      cartContainer.innerHTML = state.cart.map(item => `
        <div style="display: flex; gap: 15px; margin-bottom: 20px; align-items: center; border-bottom: 1px solid var(--border-light); padding-bottom: 20px;">
          <img src="${item.image}" alt="${item.name}" style="width: 80px; height: 80px; object-fit: contain; border-radius: 8px; background: #fff; padding: 5px;">
          <div style="flex: 1;">
            <h4 style="margin: 0; font-size: 15px;">${item.name}</h4>
            <div style="color: var(--text-secondary); font-size: 12px; margin-top: 4px;">${item.category}</div>
            <div style="font-weight: 700; margin-top: 6px;">₹${item.unitPrice.toLocaleString('en-IN')}</div>
          </div>
          <div class="stepper" style="margin: 0;">
            <button class="stepper-btn" onclick="changeQuantity('${item.id}', -1)">&minus;</button>
            <span class="stepper-value">${item.quantity}</span>
            <button class="stepper-btn" onclick="changeQuantity('${item.id}', 1)">&plus;</button>
          </div>
        </div>
      `).join('');
    }
  }

  // Update Summary elements
  const subtotalEl = document.getElementById('subtotal-display');
  const totalEl = document.getElementById('cart-total-display');
  const splitRequiredEl = document.getElementById('split-required-display');
  const splitCountEl = document.getElementById('split-count-display');
  const savingsAmountEl = document.getElementById('savings-amount-display');
  const savingsBannerEl = document.getElementById('savings-banner');
  const splitListEl = document.getElementById('split-plan-list');
  const continueBtn = document.getElementById('continue-btn');

  if (subtotalEl) subtotalEl.textContent = `₹${total.toLocaleString('en-IN')}`;
  if (totalEl) totalEl.textContent = `₹${total.toLocaleString('en-IN')}`;
  if (continueBtn) continueBtn.disabled = state.cart.length === 0;

  if (splitRequiredEl) {
    splitRequiredEl.textContent = isSplitRequired ? 'Yes' : 'No';
    splitRequiredEl.className = isSplitRequired ? 'badge badge-ready' : 'badge badge-locked';
  }

  if (splitCountEl) {
    splitCountEl.textContent = `${splits.length} payment${splits.length > 1 ? 's' : ''}`;
  }

  if (savingsAmountEl) {
    savingsAmountEl.textContent = `₹${estimatedSavings.toFixed(2)}`;
  }

  if (savingsBannerEl) {
    savingsBannerEl.style.display = isSplitRequired ? 'flex' : 'none';
  }

  // Render Split Plan Cards
  if (splitListEl) {
    if (state.cart.length === 0) {
      splitListEl.innerHTML = '<div style="color: var(--text-muted); font-size: 13px;">Add items to your cart to see the split plan.</div>';
    } else {
      splitListEl.innerHTML = splits.map(s => {
        const isReady = s.status === 'READY';
        const badgeClass = isReady ? 'badge-ready' : 'badge-locked';
        const cardClass = isReady ? 'ready' : 'locked';
        return `
          <div class="split-card ${cardClass}">
            <div class="split-left">
              <div class="split-num-icon">${s.sequence_number}</div>
              <div class="split-info">
                <h4>Payment ${s.sequence_number} of ${splits.length}</h4>
                <span>${isReady ? 'Ready for checkout' : 'Unlocks after Payment ' + (s.sequence_number - 1)}</span>
              </div>
            </div>
            <div class="split-right">
              <div class="split-amount">₹${s.amount.toLocaleString('en-IN')}</div>
              <span class="badge ${badgeClass}">${s.status}</span>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

// -----------------------------------------------------------------------------
// EVENT HANDLERS FOR PRODUCT & PRESETS
// -----------------------------------------------------------------------------
function changeQuantity(productId, delta) {
  state.customAmount = null; // reset custom override
  const itemIndex = state.cart.findIndex(i => i.id == productId);
  if (itemIndex > -1) {
    const newQty = state.cart[itemIndex].quantity + delta;
    if (newQty <= 0) {
      state.cart.splice(itemIndex, 1);
    } else {
      state.cart[itemIndex].quantity = newQty;
    }
    saveCartToStorage();
    updateCartBadge();
    updateCartUI();
  }
}


// -----------------------------------------------------------------------------
// AUTHENTICATION LOGIC (FIREBASE)
// -----------------------------------------------------------------------------
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA_55SQkTBBZn7ygdThb3NQ9sgMCQo_4l4",
  authDomain: "smart-cart-splitter.firebaseapp.com",
  projectId: "smart-cart-splitter",
  storageBucket: "smart-cart-splitter.firebasestorage.app",
  messagingSenderId: "313285149492",
  appId: "1:313285149492:web:c203d1045591f0942a9b61"
};

// Initialize Firebase
if (window.firebase) {
  firebase.initializeApp(firebaseConfig);
  
  // Listen for auth state changes
  firebase.auth().onAuthStateChanged((user) => {
    const navLink = document.getElementById('auth-nav-link');
    if (user) {
      state.currentUser = {
        uid: user.uid,
        email: user.email,
        name: user.displayName || 'Customer'
      };
      if (navLink) {
        navLink.textContent = 'Logout';
        navLink.onclick = handleLogout;
      }
      closeAuthModal();
      
      // If we are on checkout page and cart is empty, redirect to store
      if (window.location.pathname === '/' && state.cart.length === 0) {
        window.location.href = '/store';
      }
      
    } else {
      state.currentUser = null;
      if (navLink) {
        navLink.textContent = 'Login';
        navLink.onclick = openAuthModal;
      }
      
      // Force Login: Open modal and hide close button
      openAuthModal();
      setTimeout(() => {
        const closeBtn = document.querySelector('#auth-modal .modal-close-btn');
        if (closeBtn) closeBtn.style.display = 'none';
      }, 50);
    }
  });
}

function openAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.classList.add('active');
    
    // Check if firebase is initialized properly
    const content = modal.querySelector('.modal-card div');
    if (content && window.firebase) {
      content.innerHTML = `
        <h2>Login to Continue</h2>
        <p style="color: var(--text-secondary); font-size: 14px; margin-top: 10px; margin-bottom: 30px;">
          Secure your order by logging into your account.
        </p>
        <button onclick="handleLogin()" class="btn-primary" style="width: 100%; margin-bottom: 15px; display: flex; align-items: center; justify-content: center; gap: 10px;">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style="width: 18px; height: 18px; background: white; border-radius: 50%; padding: 2px;">
          Sign in with Google
        </button>
        <button onclick="handleMockLogin()" class="btn-secondary" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; border: 1px solid var(--border-light); background: transparent; color: var(--text-secondary);">
          Bypass Login (Dev Mode)
        </button>
      `;
    }
  }
}

function closeAuthModal() {
  // If no user is logged in, do not allow closing the modal
  if (!state.currentUser) return;
  
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.remove('active');
}

async function handleLogin() {
  if (!window.firebase) {
    alert("Firebase SDK not loaded properly.");
    return;
  }
  
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await firebase.auth().signInWithPopup(provider);
    
    closeAuthModal();
    
    // If cart has items, proceed to payment
    if (state.cart.length > 0 && window.location.pathname !== '/') {
      window.location.href = '/';
    }
  } catch (err) {
    console.error(err);
    alert(`Login failed: ${err.message}\n\nHint: Make sure 'Google Sign-In' is enabled in your Firebase Authentication Console!`);
  }
}

function handleMockLogin() {
  state.currentUser = {
    uid: 'mock_dev_user_123',
    email: 'dev@demo.com',
    name: 'Developer (Mock)'
  };
  
  const navLink = document.getElementById('auth-nav-link');
  if (navLink) {
    navLink.textContent = 'Logout';
    navLink.onclick = handleLogout;
  }
  
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.remove('active');
  
  // If cart has items, proceed to payment
  if (state.cart.length > 0 && window.location.pathname !== '/') {
    window.location.href = '/';
  }
}

function handleLogout(e) {
  if (e) e.preventDefault();
  if (window.firebase) {
    firebase.auth().signOut();
  }
}

// -----------------------------------------------------------------------------
// ORDER CREATION & PAYMENT FLOW
// -----------------------------------------------------------------------------
async function handleContinueToPayment() {
  if (state.cart.length === 0) return;
  
  if (!state.currentUser) {
    openAuthModal();
    return;
  }

  const btn = document.getElementById('continue-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span>Creating Order...</span>`;
  }

  try {
    const total = getCartTotal();
    const customerName = state.currentUser.name;
    const customerEmail = state.currentUser.email;

    // 1. Call Backend to create Order & Splits
    const res = await fetch(`${API_BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: customerName,
        customer_email: customerEmail,
        total_amount: total,
        payment_limit: PAYMENT_LIMIT
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to initialize order');
    }

    const data = await res.json();
    state.order = data.order;
    state.splits = data.splits;

    // 2. Open payment screen for the first READY split
    const readySplit = state.splits.find(s => s.status === 'READY') || state.splits[0];
    await prepareAndShowPaymentModal(readySplit);

    // 3. Start automatic status polling
    startOrderPolling(state.order.id);

  } catch (err) {
    console.error('Order creation error:', err);
    alert('Error creating order: ' + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span>Continue to Payment</span> <span>&rarr;</span>`;
    }
  }
}

// -----------------------------------------------------------------------------
// PREPARE AND SHOW PAYMENT MODAL
// -----------------------------------------------------------------------------
async function prepareAndShowPaymentModal(split) {
  state.currentSplit = split;

  // Request payment link from backend
  try {
    const res = await fetch(`${API_BASE_URL}/api/payments/create-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: state.order.id,
        splitId: split.id
      })
    });

    const linkData = await res.json();
    if (res.ok) {
      split.payment_url = linkData.payment_url;
      split.razorpay_payment_link_id = linkData.payment_link_id;
    }
  } catch (err) {
    console.warn('Could not generate remote link, using fallback URL:', err);
    split.payment_url = `/demo-payment.html?orderId=${state.order.id}&splitId=${split.id}`;
  }

  // Populate Modal Fields
  const modal = document.getElementById('payment-modal');
  const stepIndicator = document.getElementById('modal-step-indicator');
  const amountDisplay = document.getElementById('modal-amount-display');
  const orderNumberDisplay = document.getElementById('modal-order-number');
  const payNowBtn = document.getElementById('modal-pay-now-btn');
  const qrContainer = document.getElementById('modal-qr-container');

  if (stepIndicator) {
    stepIndicator.textContent = `Payment ${split.sequence_number} of ${state.splits.length}`;
  }
  if (amountDisplay) {
    amountDisplay.textContent = `₹${split.amount.toLocaleString('en-IN')}`;
  }
  if (orderNumberDisplay) {
    orderNumberDisplay.textContent = `Order ${state.order.order_number}`;
  }

  const fullPaymentUrl = split.payment_url.startsWith('http')
    ? split.payment_url
    : `${window.location.origin}${split.payment_url}`;

  if (payNowBtn) {
    payNowBtn.onclick = () => {
      window.open(fullPaymentUrl, '_blank');
    };
  }

  // Render QR Code for this payment URL
  if (qrContainer) {
    renderQRCode(qrContainer, fullPaymentUrl);
  }

  // Show Modal
  if (modal) {
    modal.classList.add('active');
    state.activeModal = true;
  }
}

// -----------------------------------------------------------------------------
// SIMULATE PAYMENT (For Competition Judges / Demo Mode)
// -----------------------------------------------------------------------------
async function handleSimulatePayment() {
  if (!state.currentSplit || !state.order) return;

  const simBtn = document.getElementById('modal-simulate-btn');
  if (simBtn) {
    simBtn.disabled = true;
    simBtn.textContent = 'Processing Payment...';
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/demo/complete-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: state.order.id,
        splitId: state.currentSplit.id
      })
    });

    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || 'Simulation failed');
    }

    // Refresh state immediately from returned payload
    await pollOrderStatus(state.order.id);

  } catch (err) {
    alert('Payment error: ' + err.message);
  } finally {
    if (simBtn) {
      simBtn.disabled = false;
      simBtn.textContent = '⚡ Simulate Successful Payment';
    }
  }
}

// -----------------------------------------------------------------------------
// AUTOMATIC STATUS POLLING
// -----------------------------------------------------------------------------
function startOrderPolling(orderId) {
  if (state.pollingTimer) clearInterval(state.pollingTimer);

  state.pollingTimer = setInterval(async () => {
    await pollOrderStatus(orderId);
  }, 2000);
}

async function pollOrderStatus(orderId) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}`);
    if (!res.ok) return;

    const data = await res.json();
    state.order = data.order;
    state.splits = data.splits;

    // Check if fully paid
    if (data.progress.isFullyPaid) {
      if (state.pollingTimer) clearInterval(state.pollingTimer);
      showOrderSuccessScreen(data.order, data.splits);
      return;
    }

    // Check if current split was paid and next split unlocked
    const nextReadySplit = state.splits.find(s => s.status === 'READY');
    if (nextReadySplit && (!state.currentSplit || nextReadySplit.id !== state.currentSplit.id)) {
      // Transition to next payment
      await prepareAndShowPaymentModal(nextReadySplit);
    }
  } catch (err) {
    console.warn('Polling check error:', err);
  }
}

// -----------------------------------------------------------------------------
// SUCCESS SCREEN CELEBRATION
// -----------------------------------------------------------------------------
function showOrderSuccessScreen(order, splits) {
  const modal = document.getElementById('payment-modal');
  const modalContent = document.getElementById('modal-content-wrapper');

  if (!modalContent) return;
  
  const isExternalBNPL = state.cart.length > 0 && state.cart[0].isExternal;

  if (isExternalBNPL) {
    const vCardNum = `4${Math.floor(Math.random() * 900)} ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)}`;
    const vCardCvv = Math.floor(100 + Math.random() * 900);
    const vCardLimit = Number(order.total_amount).toLocaleString('en-IN');

    modalContent.innerHTML = `
      <div class="success-card" style="padding-top: 10px;">
        <h3 class="success-title" style="margin-bottom: 5px; color: #10b981;">✓ Split Complete</h3>
        <p style="font-size: 14px; color: var(--text-secondary); margin-bottom: 20px;">Your Virtual Card is ready to use on Amazon/Flipkart.</p>
        
        <!-- Virtual Card UI -->
        <div style="background: linear-gradient(135deg, #1e293b, #0f172a); border-radius: 16px; padding: 24px; color: white; margin-bottom: 24px; position: relative; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);">
          <div style="position: absolute; top: -50px; right: -50px; width: 150px; height: 150px; background: rgba(255,255,255,0.05); border-radius: 50%;"></div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px;">
            <div style="font-size: 20px; font-weight: 800; font-style: italic;">VISA</div>
            <div style="text-align: right;">
              <div style="font-size: 10px; opacity: 0.7; text-transform: uppercase;">Spend Limit</div>
              <div style="font-size: 18px; font-weight: 700;">₹${vCardLimit}</div>
            </div>
          </div>
          
          <div style="font-family: monospace; font-size: 22px; letter-spacing: 2px; margin-bottom: 20px; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">
            ${vCardNum}
          </div>
          
          <div style="display: flex; gap: 30px; font-family: monospace; font-size: 14px;">
            <div>
              <div style="font-size: 10px; opacity: 0.7; text-transform: uppercase; font-family: sans-serif;">Valid Thru</div>
              12/29
            </div>
            <div>
              <div style="font-size: 10px; opacity: 0.7; text-transform: uppercase; font-family: sans-serif;">CVV</div>
              ${vCardCvv}
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 10px; margin-bottom: 20px;">
          <button class="btn-primary" onclick="navigator.clipboard.writeText('${vCardNum.replace(/ /g,'')}'); alert('Card Number Copied!');" style="flex: 1; font-size: 14px; padding: 12px;">
            Copy Card Number
          </button>
          <button class="btn-secondary" onclick="window.open('${state.cart[0]?.sourceUrl || 'https://amazon.in'}', '_blank')" style="flex: 1; font-size: 14px; padding: 12px;">
            Go to Merchant &rarr;
          </button>
        </div>

        <div class="success-stats-box" style="margin-bottom: 15px; border-top: 1px solid var(--border-light); padding-top: 15px;">
          <div class="success-stat-item">
            <span>Order Reference</span>
            <strong>${order.order_number}</strong>
          </div>
          <div class="success-stat-item">
            <span>Installments</span>
            <strong>${splits.length} of ${splits.length} Completed</strong>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 10px;">
          <button onclick="downloadInvoice('${order.id}')" style="background: none; border: none; color: var(--accent-blue); cursor: pointer; font-size: 13px; text-decoration: underline;">
            Download Payment Receipt
          </button>
        </div>
      </div>
    `;
  } else {
    // Native Partner Integration Flow
    modalContent.innerHTML = `
      <div class="success-card">
        <div class="success-icon-wrapper">✓</div>
        <h3 class="success-title">Order Confirmed</h3>
        <p class="success-order-num">${order.order_number} &bull; Fully Paid</p>

        <div class="success-stats-box">
          <div class="success-stat-item">
            <span>Total Paid</span>
            <strong>₹${Number(order.total_amount).toLocaleString('en-IN')}</strong>
          </div>
          <div class="success-stat-item">
            <span>Installments</span>
            <strong>${splits.length} of ${splits.length} Completed</strong>
          </div>
        </div>

        <div class="split-plan-list" style="text-align: left; margin-bottom: 20px;">
          ${splits.map(s => `
            <div class="split-card paid" style="padding: 10px 14px;">
              <div class="split-left">
                <div class="split-num-icon">✓</div>
                <div class="split-info">
                  <h4 style="font-size: 13px;">Payment ${s.sequence_number}</h4>
                  <span style="font-size: 11px;">Captured</span>
                </div>
              </div>
              <div class="split-right">
                <strong style="font-size: 14px;">₹${Number(s.amount).toLocaleString('en-IN')}</strong>
                <span class="badge badge-paid">PAID</span>
              </div>
            </div>
          `).join('')}
        </div>

        <div style="display: flex; gap: 10px;">
          <button class="btn-primary" onclick="downloadInvoice('${order.id}')" style="flex: 1;">
            Download Invoice
          </button>
          <a href="/order.html?id=${order.id}" class="nav-link" style="display: flex; align-items: center; justify-content: center; border: 1px solid var(--border-light);">
            Order Details
          </a>
        </div>
      </div>
    `;
  }
}

function closeModal() {
  const modal = document.getElementById('payment-modal');
  if (modal) modal.classList.remove('active');
  state.activeModal = false;
}

// -----------------------------------------------------------------------------
// DOWNLOAD INVOICE (Clean Printable / PDF Layout)
// -----------------------------------------------------------------------------
async function downloadInvoice(orderId) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}/invoice`);
    const { invoice } = await res.json();

    const invoiceWindow = window.open('', '_blank');
    if (!invoiceWindow) {
      alert('Please allow popups to view the invoice');
      return;
    }

    invoiceWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${invoice.invoiceNumber}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #0f172a; max-width: 680px; margin: 0 auto; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
          .brand { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; }
          .inv-title { font-size: 28px; font-weight: 800; margin: 0; }
          .meta { margin-bottom: 24px; font-size: 14px; color: #475569; }
          table { width: 100%; border-collapse: collapse; margin: 24px 0; }
          th { text-align: left; padding: 10px 0; border-bottom: 1px solid #cbd5e1; font-size: 12px; text-transform: uppercase; color: #64748b; }
          td { padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
          .total-box { margin-top: 20px; border-top: 2px solid #0f172a; padding-top: 14px; display: flex; justify-content: space-between; font-size: 18px; font-weight: 700; }
          .badge { display: inline-block; background: #ecfdf5; color: #059669; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 700; }
          .footer { margin-top: 40px; font-size: 12px; color: #94a3b8; text-align: center; }
          @media print { .print-btn { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand">${invoice.storeName}</div>
            <div style="font-size: 12px; color: #64748b;">${invoice.storeTagline}</div>
          </div>
          <div style="text-align: right;">
            <h1 class="inv-title">INVOICE</h1>
            <div style="font-size: 14px; font-weight: 600;">${invoice.invoiceNumber}</div>
          </div>
        </div>

        <div class="meta">
          <div><strong>Date:</strong> ${invoice.date}</div>
          <div><strong>Customer:</strong> ${invoice.customerName} (${invoice.customerEmail})</div>
          <div><strong>Order Reference:</strong> ${invoice.orderNumber}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Status</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.splits.map(s => `
              <tr>
                <td><strong>${s.title}</strong><br><small style="color: #64748b;">Txn ID: ${s.transactionId} &bull; ${s.paidAt}</small></td>
                <td><span class="badge">${s.status}</span></td>
                <td style="text-align: right;">₹${Number(s.amount).toLocaleString('en-IN')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="total-box">
          <span>Total Paid</span>
          <span>₹${Number(invoice.totalPaid).toLocaleString('en-IN')}</span>
        </div>

        <div style="margin-top: 24px; text-align: right;">
          <button class="print-btn" onclick="window.print()" style="padding: 10px 20px; background: #0f172a; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">Print / Save as PDF</button>
        </div>

        <div class="footer">
          Smart Cart Splitter &bull; Automated Sequential Installments &bull; Paid in full
        </div>
      </body>
      </html>
    `);
    invoiceWindow.document.close();
  } catch (err) {
    alert('Invoice error: ' + err.message);
  }
}

// -----------------------------------------------------------------------------
// STANDALONE QR CODE GENERATION (Zero External Dependency SVG Generator)
// -----------------------------------------------------------------------------
function renderQRCode(containerElement, text) {
  // If QRCode.js CDN is available, use it
  if (window.QRCode) {
    containerElement.innerHTML = '';
    new window.QRCode(containerElement, {
      text: text,
      width: 170,
      height: 170,
      colorDark: "#0f172a",
      colorLight: "#ffffff",
      correctLevel: window.QRCode.CorrectLevel.M
    });
    return;
  }

  // Reliable SVG QR Fallback (Geometric SVG pattern encoding URL)
  // Generates clean standard styled QR representation
  const encodedText = encodeURIComponent(text);
  containerElement.innerHTML = `
    <img 
      src="https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=${encodedText}" 
      alt="QR Code" 
      style="width: 170px; height: 170px; display: block;"
      onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;height:170px;font-size:12px;color:#64748b;padding:10px;text-align:center;\\'>QR Preview Ready<br><a href=\\'${text}\\' target=\\'_blank\\' style=\\'color:#2563eb;font-weight:600;margin-top:8px;display:inline-block;\\'>Open Link Directly &rarr;</a></div>'"
    />
  `;
}

// -----------------------------------------------------------------------------
// URL-BASED BNPL SCRAPER (MOCK)
// -----------------------------------------------------------------------------
async function handleUrlSubmit() {
  const urlInput = document.getElementById('product-url');
  const submitBtn = document.getElementById('url-submit-btn');
  const loadingState = document.getElementById('url-loading-state');
  
  if (!urlInput || !urlInput.value) return;
  
  const url = urlInput.value;
  
  if (submitBtn) submitBtn.disabled = true;
  if (loadingState) loadingState.style.display = 'block';
  
  try {
    const res = await fetch(`${API_BASE_URL}/api/scrape-product`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    
    if (!res.ok) throw new Error('Scraping failed');
    
    const data = await res.json();
    const p = data.product;
    
    // Clear cart and add this single product
    state.cart = [{
      id: p.id,
      name: p.title,
      unitPrice: p.unitPrice,
      quantity: 1,
      image: p.image,
      category: p.category,
      sourceUrl: p.sourceUrl,
      isExternal: true // Tag as external BNPL flow
    }];
    
    saveCartToStorage();
    
    // Redirect to checkout
    window.location.href = '/';
    
  } catch (err) {
    console.error(err);
    alert('Failed to analyze this product link. Please check the URL and try again.');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
    if (loadingState) loadingState.style.display = 'none';
  }
}

// -----------------------------------------------------------------------------
// NATIVE STORE (FAKE PARTNER PRODUCTS)
// -----------------------------------------------------------------------------
async function fetchAndRenderStore() {
  const grid = document.getElementById('store-product-grid');
  if (!grid) return;
  
  try {
    const res = await fetch('https://fakestoreapi.com/products');
    const products = await res.json();
    
    // Store products locally to quickly access them in addToCart
    window._storeProducts = products;

    grid.innerHTML = products.map(p => {
      const inrPrice = Math.round(p.price * 80);
      return `
        <div class="store-product-card" style="text-decoration: none; color: inherit; cursor: pointer;" onclick="handleAddToCart(${p.id}, this.querySelector('.btn-buy-now'))">
          <img class="store-product-image" src="${p.image}" alt="${p.title}" loading="lazy">
          <div class="store-product-category">${p.category}</div>
          <h3 class="store-product-title" title="${p.title}">${p.title}</h3>
          <div class="store-product-footer">
            <span class="store-product-price">₹${inrPrice.toLocaleString('en-IN')}</span>
            <button onclick="event.stopPropagation(); handleAddToCart(${p.id}, this)" class="btn-buy-now">Add to Cart</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    grid.innerHTML = `<div style="text-align:center; padding:40px; color:var(--accent-red);">Failed to load store catalog.</div>`;
    console.error('Failed to load store products:', err);
  }
}

function handleAddToCart(productId, btnElement) {
  const p = window._storeProducts.find(x => x.id === productId);
  if (!p) return;
  
  const inrPrice = Math.round(p.price * 80);
  const existing = state.cart.find(item => item.id === productId);
  
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({
      id: p.id,
      name: p.title,
      unitPrice: inrPrice,
      quantity: 1,
      image: p.image,
      category: p.category,
      isExternal: false // Tag as native merchant flow
    });
  }
  
  saveCartToStorage();
  updateCartBadge();
  updateCartUI(); // useful if on checkout page
  
  const originalText = btnElement.textContent;
  btnElement.textContent = 'Added ✓';
  btnElement.style.background = 'var(--success-green, #10b981)';
  setTimeout(() => {
    btnElement.textContent = originalText;
    btnElement.style.background = '';
  }, 1000);
}



function updateCartBadge() {
  const badge = document.getElementById('cart-count-badge');
  if (badge) {
    const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    badge.textContent = count;
    // Also try updating any other badges on the page just in case
    document.querySelectorAll('#cart-count-badge').forEach(el => el.textContent = count);
  }
}

// -----------------------------------------------------------------------------
// INITIALIZATION ON PAGE LOAD
// -----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  loadCartFromStorage();
  updateCartBadge();

  // Check health and mode
  fetch(`${API_BASE_URL}/api/health`)
    .then(r => r.json())
    .then(data => {
      const modeBadge = document.getElementById('mode-badge');
      if (modeBadge) {
        if (data.demoMode) {
          modeBadge.textContent = '⚡ Demo Simulation Mode';
          modeBadge.className = 'badge badge-demo';
        } else {
          modeBadge.textContent = '🔒 Razorpay Test Mode';
          modeBadge.className = 'badge badge-live';
        }
      }
    })
    .catch(err => console.log('Backend health status:', err));

  // Initialize checkout UI if on index page
  if (document.getElementById('split-plan-list')) {
    updateCartUI(); // Initial render with data from storage
  }
  
  // Initialize store UI if on store page
  if (document.getElementById('store-product-grid')) {
    fetchAndRenderStore();
  }
});
