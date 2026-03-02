const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Razorpay = require('razorpay');
const crypto = require('crypto');

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();
const REGION = 'asia-south1';

function setCorsHeaders(res) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function handlePreflight(req, res) {
    if (req.method === 'OPTIONS') {
        setCorsHeaders(res);
        res.status(204).send('');
        return true;
    }
    return false;
}

function sendError(res, status, message) {
    setCorsHeaders(res);
    res.status(status).json({ ok: false, error: message });
}

function getRequestBody(req) {
    if (req.body && typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string') {
        try {
            return JSON.parse(req.body);
        } catch (_) {
            return {};
        }
    }
    return {};
}

function normalizePlanId(planId) {
    return String(planId || '').trim().toLowerCase();
}

function getRazorpayCredentials() {
    const config = typeof functions.config === 'function' ? functions.config() : {};
    const rp = config && config.razorpay ? config.razorpay : {};

    const keyId = process.env.RAZORPAY_KEY_ID || rp.key_id;
    const keySecret = process.env.RAZORPAY_KEY_SECRET || rp.key_secret;

    if (!keyId || !keySecret) {
        throw new Error('Razorpay keys are missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
    }

    return { keyId, keySecret };
}

async function verifyUser(idToken) {
    if (!idToken) throw new Error('Missing authentication token.');
    const decoded = await admin.auth().verifyIdToken(idToken);
    if (!decoded || !decoded.uid) throw new Error('Invalid authentication token.');
    return decoded;
}

function getAmountInPaise(priceValue) {
    const numericPrice = Number(priceValue);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
        throw new Error('Invalid plan amount.');
    }
    return Math.round(numericPrice * 100);
}

exports.createRazorpayOrder = functions.region(REGION).https.onRequest(async (req, res) => {
    if (handlePreflight(req, res)) return;
    if (req.method !== 'POST') {
        sendError(res, 405, 'Method not allowed.');
        return;
    }

    try {
        const body = getRequestBody(req);
        const { idToken, planId } = body;
        const planKey = normalizePlanId(planId);
        if (!planKey || planKey === 'free') {
            sendError(res, 400, 'Please select a valid paid plan.');
            return;
        }

        const user = await verifyUser(idToken);
        const planDoc = await db.collection('plans').doc(planKey).get();
        if (!planDoc.exists) {
            sendError(res, 404, 'Plan not found.');
            return;
        }

        const plan = planDoc.data() || {};
        const amountPaise = getAmountInPaise(plan.price);
        const { keyId, keySecret } = getRazorpayCredentials();
        const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

        const receipt = `gl_${user.uid}_${Date.now()}`.substring(0, 40);
        const order = await razorpay.orders.create({
            amount: amountPaise,
            currency: 'INR',
            receipt,
            notes: {
                uid: user.uid,
                planId: planKey
            }
        });

        await db.collection('payments').doc(order.id).set({
            orderId: order.id,
            studentUid: user.uid,
            studentEmail: user.email || '',
            planId: planKey,
            planName: plan.name || planKey.toUpperCase(),
            amount: amountPaise / 100,
            amountPaise,
            currency: 'INR',
            status: 'created',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        setCorsHeaders(res);
        res.status(200).json({
            ok: true,
            keyId,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            planId: planKey,
            planName: plan.name || planKey.toUpperCase()
        });
    } catch (error) {
        console.error('createRazorpayOrder failed:', error);
        sendError(res, 500, error.message || 'Failed to create order.');
    }
});

exports.verifyRazorpayPayment = functions.region(REGION).https.onRequest(async (req, res) => {
    if (handlePreflight(req, res)) return;
    if (req.method !== 'POST') {
        sendError(res, 405, 'Method not allowed.');
        return;
    }

    try {
        const body = getRequestBody(req);
        const {
            idToken,
            planId,
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature
        } = body;

        const normalizedPlanId = normalizePlanId(planId);
        if (!normalizedPlanId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
            sendError(res, 400, 'Missing payment verification fields.');
            return;
        }

        const user = await verifyUser(idToken);
        const paymentRef = db.collection('payments').doc(razorpayOrderId);
        const paymentDoc = await paymentRef.get();
        if (!paymentDoc.exists) {
            sendError(res, 404, 'Order not found.');
            return;
        }

        const payment = paymentDoc.data() || {};
        if (payment.studentUid !== user.uid) {
            sendError(res, 403, 'Order does not belong to this user.');
            return;
        }

        if (normalizePlanId(payment.planId) !== normalizedPlanId) {
            sendError(res, 400, 'Plan mismatch for this order.');
            return;
        }

        const { keyId, keySecret } = getRazorpayCredentials();
        const generatedSignature = crypto
            .createHmac('sha256', keySecret)
            .update(`${razorpayOrderId}|${razorpayPaymentId}`)
            .digest('hex');

        if (generatedSignature !== razorpaySignature) {
            await paymentRef.set({
                status: 'signature_mismatch',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            sendError(res, 400, 'Payment signature verification failed.');
            return;
        }

        let paymentStatus = 'verified';
        try {
            const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
            const paymentDetails = await razorpay.payments.fetch(razorpayPaymentId);
            if (paymentDetails && paymentDetails.order_id && paymentDetails.order_id !== razorpayOrderId) {
                sendError(res, 400, 'Payment does not match the order.');
                return;
            }
            paymentStatus = paymentDetails && paymentDetails.status ? paymentDetails.status : 'verified';
        } catch (fetchError) {
            console.warn('Payment fetch skipped:', fetchError.message);
        }

        const studentRef = db.collection('students').doc(user.uid);
        const now = admin.firestore.FieldValue.serverTimestamp();

        const batch = db.batch();
        batch.set(studentRef, {
            plan: normalizedPlanId,
            subscriptionStatus: 'active',
            subscriptionUpdatedAt: now
        }, { merge: true });
        batch.set(paymentRef, {
            status: 'paid',
            paymentStatus,
            razorpayPaymentId,
            razorpaySignature,
            verifiedAt: now,
            updatedAt: now
        }, { merge: true });
        await batch.commit();

        setCorsHeaders(res);
        res.status(200).json({
            ok: true,
            message: 'Payment verified and plan upgraded.',
            planId: normalizedPlanId
        });
    } catch (error) {
        console.error('verifyRazorpayPayment failed:', error);
        sendError(res, 500, error.message || 'Payment verification failed.');
    }
});
