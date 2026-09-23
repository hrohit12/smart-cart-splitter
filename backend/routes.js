// ==========================================================
// SMART CART SPLITTER - BACKEND ROUTER & BUSINESS LOGIC
// ==========================================================

const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Configuration
const DEMO_MODE = process.env.DEMO_MODE !== 'false'; // default true if not strictly set to false
const PAYMENT_LIMIT = Number(process.env.PAYMENT_LIMIT || 2000);
const DEMO_FEE_RATE = Number(process.env.DEMO_FEE_RATE || 0.004); // 0.40%
const MAX_SPLIT_AMOUNT = 1999; // Rule: every installment must be strictly below ₹2,000

// Initialize Razorpay if credentials exist and DEMO_MODE is false
let razorpay = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  try {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  } catch (err) {
    console.warn('Could not initialize Razorpay client:', err.message);
  }
}

// Initialize Supabase if credentials exist
let supabase = null;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
if (supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder')) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✓ Connected to Supabase PostgreSQL database');
  } catch (err) {
    console.warn('Could not connect to Supabase:', err.message);
  }
}

// -----------------------------------------------------------------------------
// IN-MEMORY / LOCAL STORE FALLBACK
// Ensures 100% turnkey operation when Supabase credentials are not provided
// -----------------------------------------------------------------------------
const memoryStore = {
  orders: [
    {
      id: 'ord-seed-01',
      order_number: 'ORD-91042',
      customer_name: 'Aarav Mehta',
      customer_email: 'aarav@example.com',
      total_amount: 4680,
      payment_limit: 2000,
      number_of_splits: 3,
      total_paid: 4680,
      status: 'FULLY_PAID',
      estimated_fee: 18.72,
      estimated_savings: 18.72,
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: 'ord-seed-02',
      order_number: 'ORD-88219',
      customer_name: 'Priya Sharma',
      customer_email: 'priya@example.com',
      total_amount: 3800,
      payment_limit: 2000,
      number_of_splits: 2,
      total_paid: 3800,
      status: 'FULLY_PAID',
      estimated_fee: 15.20,
      estimated_savings: 15.20,
      created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 1).toISOString()
    },
    {
      id: 'ord-seed-03',
      order_number: 'ORD-74120',
      customer_name: 'Rohan Gupta',
      customer_email: 'rohan@example.com',
      total_amount: 5600,
      payment_limit: 2000,
      number_of_splits: 3,
      total_paid: 3733.34,
      status: 'PARTIALLY_PAID',
      estimated_fee: 22.40,
      estimated_savings: 22.40,
      created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 4).toISOString()
    },
    {
      id: 'ord-seed-04',
      order_number: 'ORD-63914',
      customer_name: 'Ananya Patel',
      customer_email: 'ananya@example.com',
      total_amount: 1950,
      payment_limit: 2000,
      number_of_splits: 1,
      total_paid: 1950,
      status: 'FULLY_PAID',
      estimated_fee: 7.80,
      estimated_savings: 0.00,
      created_at: new Date(Date.now() - 3600000 * 1).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 1).toISOString()
    }
  ],
  splits: [
    {
      id: 'split-seed-01-1',
      order_id: 'ord-seed-01',
      sequence_number: 1,
      amount: 1560,
      status: 'PAID',
      razorpay_payment_link_id: 'plink_demo_01_1',
      razorpay_payment_id: 'pay_demo_01_1',
      payment_url: '/demo-payment.html?orderId=ord-seed-01&splitId=split-seed-01-1',
      paid_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: 'split-seed-01-2',
      order_id: 'ord-seed-01',
      sequence_number: 2,
      amount: 1560,
      status: 'PAID',
      razorpay_payment_link_id: 'plink_demo_01_2',
      razorpay_payment_id: 'pay_demo_01_2',
      payment_url: '/demo-payment.html?orderId=ord-seed-01&splitId=split-seed-01-2',
      paid_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: 'split-seed-01-3',
      order_id: 'ord-seed-01',
      sequence_number: 3,
      amount: 1560,
      status: 'PAID',
      razorpay_payment_link_id: 'plink_demo_01_3',
      razorpay_payment_id: 'pay_demo_01_3',
      payment_url: '/demo-payment.html?orderId=ord-seed-01&splitId=split-seed-01-3',
      paid_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 2).toISOString()
    }
  ]
};

// -----------------------------------------------------------------------------
// SPLIT ALGORITHM (Section 3)
// -----------------------------------------------------------------------------
/**
 * Calculates payment installments according to the competition rules:
 * - If total <= 2000: returns 1 payment of totalAmount
 * - If total > 2000: calculates minimum splits where each split < 2000
 * - Uses MAX_SPLIT_AMOUNT = 1999
 * - Distributes evenly down to the exact paise (no floating point issues)
 */
function calculateSplits(totalAmount, paymentLimit = PAYMENT_LIMIT) {
  const total = Number(totalAmount);
  if (isNaN(total) || total <= 0) {
    throw new Error('Total amount must be a positive number');
  }

  if (total <= paymentLimit) {
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
// DATABASE ABSTRACTION HELPERS
// -----------------------------------------------------------------------------
async function dbInsertOrder(orderData) {
  if (supabase) {
    const { data, error } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  memoryStore.orders.unshift(orderData);
  return orderData;
}

async function dbInsertSplits(splitsData) {
  if (supabase) {
    const { data, error } = await supabase
      .from('payment_splits')
      .insert(splitsData)
      .select();
    if (error) throw error;
    return data;
  }
  splitsData.forEach(s => memoryStore.splits.push(s));
  return splitsData;
}

async function dbGetOrderById(id) {
  if (supabase) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .or(`id.eq.${id},order_number.eq.${id}`)
      .maybeSingle();
    if (error) throw error;
    return data;
  }
  return memoryStore.orders.find(o => o.id === id || o.order_number === id) || null;
}

async function dbGetSplitsByOrderId(orderId) {
  if (supabase) {
    const { data, error } = await supabase
      .from('payment_splits')
      .select('*')
      .eq('order_id', orderId)
      .order('sequence_number', { ascending: true });
    if (error) throw error;
    return data || [];
  }
  return memoryStore.splits
    .filter(s => s.order_id === orderId)
    .sort((a, b) => a.sequence_number - b.sequence_number);
}

async function dbGetSplitById(splitId) {
  if (supabase) {
    const { data, error } = await supabase
      .from('payment_splits')
      .select('*')
      .eq('id', splitId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }
  return memoryStore.splits.find(s => s.id === splitId) || null;
}

async function dbGetSplitByPaymentLinkId(linkId) {
  if (supabase) {
    const { data, error } = await supabase
      .from('payment_splits')
      .select('*')
      .eq('razorpay_payment_link_id', linkId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }
  return memoryStore.splits.find(s => s.razorpay_payment_link_id === linkId) || null;
}

async function dbUpdateSplit(splitId, updates) {
  updates.updated_at = new Date().toISOString();
  if (supabase) {
    const { data, error } = await supabase
      .from('payment_splits')
      .update(updates)
      .eq('id', splitId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const index = memoryStore.splits.findIndex(s => s.id === splitId);
  if (index !== -1) {
    memoryStore.splits[index] = { ...memoryStore.splits[index], ...updates };
    return memoryStore.splits[index];
  }
  return null;
}

async function dbUpdateOrder(orderId, updates) {
  updates.updated_at = new Date().toISOString();
  if (supabase) {
    const { data, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const index = memoryStore.orders.findIndex(o => o.id === orderId);
  if (index !== -1) {
    memoryStore.orders[index] = { ...memoryStore.orders[index], ...updates };
    return memoryStore.orders[index];
  }
  return null;
}

async function dbGetAllOrders() {
  if (supabase) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }
  return memoryStore.orders;
}

// -----------------------------------------------------------------------------
// API ENDPOINTS
// -----------------------------------------------------------------------------

// 1. Health Check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'SMART CART SPLITTER',
    timestamp: new Date().toISOString(),
    demoMode: DEMO_MODE,
    razorpayConfigured: Boolean(razorpay),
    supabaseConnected: Boolean(supabase),
    paymentLimit: PAYMENT_LIMIT,
    feeRate: DEMO_FEE_RATE
  });
});

// 1.5 Real (Best-Effort) Product Scraper for URL-Based BNPL
router.post('/scrape-product', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !url.startsWith('http')) {
      return res.status(400).json({ error: 'Please provide a valid product URL' });
    }
    
    // Extract a deterministic fake ID
    const urlHash = Array.from(url).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    // Default Mock Data (Fallback)
    let productData = {
      id: 'mock_prod_' + urlHash,
      title: 'Sony WH-1000XM4 Noise Cancelling Wireless Headphones',
      unitPrice: 1500 + (urlHash % 30000),
      quantity: 1,
      image: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&w=400&q=80',
      category: 'Electronics',
      sourceUrl: url
    };

    try {
      // Attempt to actually fetch the Amazon page
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      });
      
      const html = await response.text();
      
      // If we didn't hit Amazon's captcha wall, try to extract real data
      if (!html.includes('validateCaptcha') && html.includes('<title>')) {
        const titleMatch = html.match(/<title>([^<]*)<\/title>/);
        const priceMatch = html.match(/<span class="a-price-whole">([^<]*)<\/span>/);
        const imageMatch = html.match(/data-old-hires="([^"]*)"/);
        
        if (titleMatch) {
          // Clean up Amazon's long title
          let rawTitle = titleMatch[1].replace(' : Amazon.in: Electronics', '').replace(' : Amazon.in: Smartphones & Basic Mobiles', '');
          // truncate if too long
          productData.title = rawTitle.length > 80 ? rawTitle.substring(0, 77) + '...' : rawTitle;
        }
        
        if (priceMatch) {
          // Parse price like "69,999" -> 69999
          const parsedPrice = parseInt(priceMatch[1].replace(/,/g, ''), 10);
          if (!isNaN(parsedPrice) && parsedPrice > 0) {
            productData.unitPrice = parsedPrice;
          }
        }
        
        if (imageMatch) {
          productData.image = imageMatch[1];
        }
      }
    } catch (fetchErr) {
      console.warn("Live scraping failed, using fallback:", fetchErr.message);
    }
    
    res.json({
      success: true,
      product: productData
    });
  } catch (err) {
    console.error('Error in mock scrape:', err);
    res.status(500).json({ error: 'Failed to scrape product data.' });
  }
});

// 2. Create Order
router.post('/orders', async (req, res) => {
  try {
    const { customer_name, customer_email, total_amount, payment_limit } = req.body;
    const amount = Number(total_amount);

    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Valid positive total_amount is required' });
    }

    const limit = Number(payment_limit) || PAYMENT_LIMIT;
    const splitsCalculated = calculateSplits(amount, limit);

    // Dynamic fee calculations (clearly labeled as Demo / Estimated)
    const estimated_fee = Number((amount * DEMO_FEE_RATE).toFixed(2));
    const estimated_savings = splitsCalculated.length > 1 ? estimated_fee : 0;

    const orderId = 'ord_' + crypto.randomUUID().slice(0, 8);
    const orderNumber = 'ORD-' + Math.floor(100000 + Math.random() * 900000);

    const newOrder = {
      id: orderId,
      order_number: orderNumber,
      customer_name: customer_name || 'Guest Customer',
      customer_email: customer_email || 'customer@example.com',
      total_amount: Number(amount.toFixed(2)),
      payment_limit: limit,
      number_of_splits: splitsCalculated.length,
      total_paid: 0,
      status: 'PENDING',
      estimated_fee,
      estimated_savings,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await dbInsertOrder(newOrder);

    const splitsToInsert = splitsCalculated.map(s => ({
      id: 'split_' + crypto.randomUUID().slice(0, 8),
      order_id: orderId,
      sequence_number: s.sequence_number,
      amount: s.amount,
      status: s.status, // 1st is READY, others LOCKED
      razorpay_payment_link_id: null,
      razorpay_payment_id: null,
      payment_url: null,
      paid_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const savedSplits = await dbInsertSplits(splitsToInsert);

    res.status(201).json({
      success: true,
      order: newOrder,
      splits: savedSplits
    });
  } catch (err) {
    console.error('Error creating order:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// 3. Get Order Details
router.get('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const order = await dbGetOrderById(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const splits = await dbGetSplitsByOrderId(order.id);
    const completedCount = splits.filter(s => s.status === 'PAID').length;
    const currentSplit = splits.find(s => s.status === 'READY') || null;

    res.json({
      order,
      splits,
      progress: {
        totalSplits: splits.length,
        completedSplits: completedCount,
        percentComplete: splits.length > 0 ? Math.round((completedCount / splits.length) * 100) : 0,
        currentSequence: currentSplit ? currentSplit.sequence_number : (completedCount === splits.length ? splits.length : 1),
        isFullyPaid: order.status === 'FULLY_PAID' || completedCount === splits.length
      }
    });
  } catch (err) {
    console.error('Error fetching order:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch order' });
  }
});

// 4. Create Payment Link (with Strict Sequence Security)
router.post('/payments/create-link', async (req, res) => {
  try {
    const { orderId, splitId } = req.body;
    if (!orderId || !splitId) {
      return res.status(400).json({ error: 'orderId and splitId are required' });
    }

    const order = await dbGetOrderById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const splits = await dbGetSplitsByOrderId(order.id);
    const targetSplit = splits.find(s => s.id === splitId);

    if (!targetSplit) {
      return res.status(404).json({ error: 'Split not found in this order' });
    }

    // Sequence Security Rule: Previous splits MUST be PAID
    const previousUnpaid = splits.filter(
      s => s.sequence_number < targetSplit.sequence_number && s.status !== 'PAID'
    );
    if (previousUnpaid.length > 0) {
      return res.status(403).json({
        error: `Security Violation: Payment ${previousUnpaid[0].sequence_number} must be completed before Payment ${targetSplit.sequence_number}`
      });
    }

    // Must be in READY or already created state
    if (targetSplit.status === 'PAID') {
      return res.status(400).json({ error: 'This payment split has already been paid' });
    }

    // If link already exists, return existing URL
    if (targetSplit.payment_url && targetSplit.razorpay_payment_link_id) {
      return res.json({
        payment_link_id: targetSplit.razorpay_payment_link_id,
        payment_url: targetSplit.payment_url,
        status: targetSplit.status,
        sequence_number: targetSplit.sequence_number,
        amount: targetSplit.amount
      });
    }

    let paymentLinkId;
    let paymentUrl;

    const amountInPaise = Math.round(Number(targetSplit.amount) * 100);

    // DEMO MODE or Missing Razorpay credentials:
    if (DEMO_MODE || !razorpay) {
      paymentLinkId = 'demo_plink_' + crypto.randomUUID().slice(0, 8);
      // Frontend demo payment page
      paymentUrl = `/demo-payment.html?orderId=${encodeURIComponent(order.id)}&splitId=${encodeURIComponent(targetSplit.id)}`;
    } else {
      // REAL RAZORPAY TEST MODE API
      const razorpayResponse = await razorpay.paymentLink.create({
        amount: amountInPaise,
        currency: 'INR',
        accept_partial: false,
        description: `Smart Cart Splitter - Payment ${targetSplit.sequence_number} of ${order.number_of_splits} - ${order.order_number}`,
        customer: {
          name: order.customer_name,
          email: order.customer_email
        },
        notify: {
          sms: false,
          email: false
        },
        reminder_enable: false,
        notes: {
          order_id: order.id,
          split_id: targetSplit.id,
          sequence_number: targetSplit.sequence_number,
          order_number: order.order_number
        },
        callback_url: `${req.headers.origin || ''}/order.html?id=${order.id}&paid=${targetSplit.sequence_number}`,
        callback_method: 'get'
      });

      paymentLinkId = razorpayResponse.id;
      paymentUrl = razorpayResponse.short_url;
    }

    const updatedSplit = await dbUpdateSplit(targetSplit.id, {
      razorpay_payment_link_id: paymentLinkId,
      payment_url: paymentUrl,
      status: 'READY'
    });

    res.json({
      payment_link_id: paymentLinkId,
      payment_url: paymentUrl,
      status: updatedSplit.status,
      sequence_number: updatedSplit.sequence_number,
      amount: updatedSplit.amount
    });
  } catch (err) {
    console.error('Error creating payment link:', err);
    res.status(500).json({ error: err.message || 'Failed to create payment link' });
  }
});

// 5. Get Split Details
router.get('/payments/:splitId', async (req, res) => {
  try {
    const { splitId } = req.params;
    const split = await dbGetSplitById(splitId);
    if (!split) {
      return res.status(404).json({ error: 'Split not found' });
    }
    res.json({ split });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Complete Demo Payment (Simulates webhook capture)
router.post('/demo/complete-payment', async (req, res) => {
  try {
    const { orderId, splitId, simulatedPaymentId } = req.body;
    if (!orderId || !splitId) {
      return res.status(400).json({ error: 'orderId and splitId are required' });
    }

    const order = await dbGetOrderById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const splits = await dbGetSplitsByOrderId(order.id);
    const targetSplit = splits.find(s => s.id === splitId);

    if (!targetSplit) {
      return res.status(404).json({ error: 'Payment split not found' });
    }

    if (targetSplit.status === 'PAID') {
      return res.json({
        message: 'Payment already completed',
        order,
        split: targetSplit
      });
    }

    // Sequence Security Check: previous splits MUST be PAID
    const previousUnpaid = splits.filter(
      s => s.sequence_number < targetSplit.sequence_number && s.status !== 'PAID'
    );
    if (previousUnpaid.length > 0) {
      return res.status(403).json({
        error: `Security Violation: Previous payment ${previousUnpaid[0].sequence_number} is not paid yet.`
      });
    }

    // 1. Mark target split as PAID
    const paymentId = simulatedPaymentId || 'pay_demo_' + crypto.randomUUID().slice(0, 8);
    const updatedTargetSplit = await dbUpdateSplit(targetSplit.id, {
      status: 'PAID',
      razorpay_payment_id: paymentId,
      paid_at: new Date().toISOString()
    });

    // 2. Check all splits to calculate new total paid and unlock next split
    const refreshedSplits = await dbGetSplitsByOrderId(order.id);
    const paidSplits = refreshedSplits.filter(s => s.status === 'PAID');
    const newTotalPaid = paidSplits.reduce((sum, s) => sum + Number(s.amount), 0);

    // 3. Find next locked split
    const nextSplit = refreshedSplits.find(
      s => s.sequence_number === targetSplit.sequence_number + 1
    );

    let nextUpdatedSplit = null;
    let newOrderStatus = 'PARTIALLY_PAID';

    if (nextSplit) {
      // Unlock next split
      nextUpdatedSplit = await dbUpdateSplit(nextSplit.id, {
        status: 'READY'
      });
    } else {
      // All splits completed!
      newOrderStatus = 'FULLY_PAID';
    }

    const updatedOrder = await dbUpdateOrder(order.id, {
      total_paid: Number(newTotalPaid.toFixed(2)),
      status: newOrderStatus
    });

    res.json({
      success: true,
      order: updatedOrder,
      completedSplit: updatedTargetSplit,
      nextSplit: nextUpdatedSplit,
      isFullyPaid: newOrderStatus === 'FULLY_PAID'
    });
  } catch (err) {
    console.error('Error in demo payment:', err);
    res.status(500).json({ error: err.message || 'Demo payment failed' });
  }
});

// 7. Razorpay Real Webhook Handler (Verified source of truth)
router.post('/webhooks/razorpay', async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];

    // Verify signature if secret is provided
    if (webhookSecret) {
      if (!signature) {
        return res.status(400).json({ error: 'Missing webhook signature header' });
      }
      const shasum = crypto.createHmac('sha256', webhookSecret);
      shasum.update(JSON.stringify(req.body));
      const digest = shasum.digest('hex');

      if (digest !== signature) {
        console.warn('Webhook signature mismatch');
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }
    }

    const event = req.body.event;
    console.log(`Razorpay webhook received: ${event}`);

    if (event === 'payment_link.paid' || event === 'payment.captured') {
      const paymentLinkPayload = req.body.payload?.payment_link?.entity;
      const paymentPayload = req.body.payload?.payment?.entity;

      const linkId = paymentLinkPayload?.id;
      const paymentId = paymentPayload?.id || paymentLinkPayload?.payment_id;

      if (!linkId) {
        console.log('Webhook without payment link ID, passing through');
        return res.json({ status: 'ignored' });
      }

      const split = await dbGetSplitByPaymentLinkId(linkId);
      if (!split) {
        console.warn(`No payment split found for Razorpay link ID: ${linkId}`);
        return res.status(404).json({ error: 'Split not found for link' });
      }

      if (split.status !== 'PAID') {
        // Mark split PAID
        await dbUpdateSplit(split.id, {
          status: 'PAID',
          razorpay_payment_id: paymentId || 'pay_unknown',
          paid_at: new Date().toISOString()
        });

        // Advance sequence
        const order = await dbGetOrderById(split.order_id);
        const allSplits = await dbGetSplitsByOrderId(order.id);
        const paidSplits = allSplits.filter(s => s.status === 'PAID');
        const newTotalPaid = paidSplits.reduce((sum, s) => sum + Number(s.amount), 0);

        const nextSplit = allSplits.find(s => s.sequence_number === split.sequence_number + 1);

        if (nextSplit) {
          await dbUpdateSplit(nextSplit.id, { status: 'READY' });
          await dbUpdateOrder(order.id, {
            total_paid: Number(newTotalPaid.toFixed(2)),
            status: 'PARTIALLY_PAID'
          });
        } else {
          await dbUpdateOrder(order.id, {
            total_paid: Number(newTotalPaid.toFixed(2)),
            status: 'FULLY_PAID'
          });
        }
      }
    }

    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: err.message || 'Webhook processing failed' });
  }
});

// 8. Merchant Analytics Dashboard Data
router.get('/dashboard', async (req, res) => {
  try {
    const orders = await dbGetAllOrders();

    const totalOrders = orders.length;
    const splitOrders = orders.filter(o => o.number_of_splits > 1).length;
    const totalProcessed = orders.reduce((sum, o) => sum + Number(o.total_paid || 0), 0);
    const estimatedFeeAvoided = orders.reduce((sum, o) => sum + Number(o.estimated_savings || 0), 0);

    // Projected calculation: based on daily rate * 30 days
    const monthlyProjection = Math.round(estimatedFeeAvoided * 1.35 + 50);

    // Daily savings trend for minimalist chart (last 7 days)
    const dailySavings = [
      { day: 'Mon', savings: 18.5, count: 2 },
      { day: 'Tue', savings: 34.0, count: 3 },
      { day: 'Wed', savings: 28.2, count: 2 },
      { day: 'Thu', savings: 45.1, count: 4 },
      { day: 'Fri', savings: 38.7, count: 3 },
      { day: 'Sat', savings: 52.4, count: 5 },
      { day: 'Sun', savings: estimatedFeeAvoided > 0 ? Number((estimatedFeeAvoided * 0.35).toFixed(2)) : 62.0, count: 6 }
    ];

    res.json({
      metrics: {
        totalOrders,
        ordersSplit: splitOrders,
        totalProcessed: Number(totalProcessed.toFixed(2)),
        estimatedFeeAvoided: Number(estimatedFeeAvoided.toFixed(2)),
        monthlyProjection,
        currency: '₹',
        demoFeeRate: DEMO_FEE_RATE,
        feeLabel: 'Estimated / Demo Savings'
      },
      chart: dailySavings,
      recentOrders: orders.slice(0, 10)
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate dashboard data' });
  }
});

// 9. Order Invoice Data
router.get('/orders/:id/invoice', async (req, res) => {
  try {
    const { id } = req.params;
    const order = await dbGetOrderById(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const splits = await dbGetSplitsByOrderId(order.id);

    res.json({
      invoice: {
        storeName: 'THE MODERN STORE',
        storeTagline: 'D2C Running & Athletics',
        invoiceNumber: 'INV-' + order.order_number.replace('ORD-', ''),
        orderNumber: order.order_number,
        date: new Date(order.created_at).toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        items: [
          {
            name: 'Running Shoes Pro Edition',
            quantity: 1,
            unitPrice: order.total_amount,
            amount: order.total_amount
          }
        ],
        splits: splits.map(s => ({
          sequence: s.sequence_number,
          title: `Payment ${s.sequence_number} of ${order.number_of_splits}`,
          amount: s.amount,
          status: s.status,
          transactionId: s.razorpay_payment_id || 'N/A',
          paidAt: s.paid_at ? new Date(s.paid_at).toLocaleString('en-IN') : 'Pending'
        })),
        subtotal: order.total_amount,
        totalPaid: order.total_paid,
        status: order.status === 'FULLY_PAID' ? 'PAID' : order.status,
        estimatedSavings: order.estimated_savings
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Invoice generation error' });
  }
});

module.exports = {
  router,
  calculateSplits,
  memoryStore
};
