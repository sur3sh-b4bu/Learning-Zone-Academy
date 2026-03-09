const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();
const REGION = 'asia-south1';
const OTP_VALIDITY_MS = 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
const OTP_MAX_ATTEMPTS = 5;

const ALLOWED_ORIGINS = new Set([
    'https://nellailearningacademy.in',
    'https://www.nellailearningacademy.in',
    'https://nellailearningacademy.web.app',
    'https://nellailearningacademy.firebaseapp.com'
]);

// --- EMAIL CONFIGURATION ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'admin@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-code-here'
    }
});

function isAllowedOrigin(origin) {
    if (!origin) return true;
    if (ALLOWED_ORIGINS.has(origin)) return true;
    return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

function setCorsHeaders(req, res) {
    const origin = String(req.get('origin') || '').trim();
    if (!origin) {
        // Non-browser clients (curl/postman).
        res.set('Access-Control-Allow-Origin', '*');
    } else if (isAllowedOrigin(origin)) {
        res.set('Access-Control-Allow-Origin', origin);
        res.set('Vary', 'Origin');
    } else {
        res.set('Access-Control-Allow-Origin', 'https://nellailearningacademy.in');
        res.set('Vary', 'Origin');
    }
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function handlePreflight(req, res) {
    if (req.method === 'OPTIONS') {
        const origin = String(req.get('origin') || '').trim();
        if (origin && !isAllowedOrigin(origin)) {
            setCorsHeaders(req, res);
            res.status(403).send('Origin not allowed.');
            return true;
        }
        setCorsHeaders(req, res);
        res.status(204).send('');
        return true;
    }
    return false;
}

function rejectIfDisallowedOrigin(req, res) {
    const origin = String(req.get('origin') || '').trim();
    if (origin && !isAllowedOrigin(origin)) {
        sendError(req, res, 403, 'Origin not allowed.');
        return true;
    }
    return false;
}

function sendError(req, res, status, message) {
    setCorsHeaders(req, res);
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

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function hashOtp(email, otp) {
    return crypto.createHash('sha256').update(`${normalizeEmail(email)}:${String(otp)}`).digest('hex');
}

function getRazorpayCredentials() {
    // process.env is populated from .env (local) or Firebase secret env vars (deployed).
    // functions.config() is legacy and may still hold old TEST keys; always prefer process.env.
    const config = typeof functions.config === 'function' ? functions.config() : {};
    const rp = config && config.razorpay ? config.razorpay : {};
    const keyId = process.env.RAZORPAY_KEY_ID || rp.key_id;
    const keySecret = process.env.RAZORPAY_KEY_SECRET || rp.key_secret;
    if (!keyId || !keySecret) throw new Error('Razorpay keys missing.');
    if (keyId.startsWith('rzp_test_') && process.env.FUNCTIONS_EMULATOR !== 'true') {
        console.warn('[RAZORPAY] WARNING: Test key is active in production environment.');
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
    const normalizedPrice = typeof priceValue === 'string'
        ? priceValue.replace(/[^0-9.]/g, '')
        : priceValue;
    const numericPrice = Number(normalizedPrice);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) throw new Error('Invalid plan amount.');
    return Math.round(numericPrice * 100);
}

function normalizeText(value, maxLen = 2000) {
    return String(value == null ? '' : value).replace(/\u0000/g, '').trim().slice(0, maxLen);
}

function parseAdminAlertEmails() {
    const raw = [
        process.env.ADMIN_ALERT_EMAILS || '',
        process.env.ADMIN_EMAIL || '',
        process.env.EMAIL_USER || '',
        'admin@gmail.com'
    ].join(',');

    const parsed = raw
        .split(',')
        .map((item) => normalizeEmail(item))
        .filter((item) => isValidEmail(item));

    return Array.from(new Set(parsed));
}

async function getContactAlertRecipients() {
    const fallback = parseAdminAlertEmails();
    try {
        const snap = await db.collection('students').where('isAdmin', '==', true).get();
        if (snap.empty) return fallback;

        const firestoreEmails = [];
        snap.forEach((doc) => {
            const data = doc.data() || {};
            const candidates = [
                data.email,
                data.contactEmail,
                data.adminEmail
            ];
            candidates.forEach((value) => {
                const normalized = normalizeEmail(value);
                if (isValidEmail(normalized)) firestoreEmails.push(normalized);
            });
        });

        const merged = Array.from(new Set([...firestoreEmails, ...fallback]));
        return merged.length ? merged : fallback;
    } catch (error) {
        console.warn('Admin email lookup failed, using fallback recipients:', error.message || error);
        return fallback;
    }
}

async function resolvePlanDocument(planIdInput) {
    const rawPlanId = String(planIdInput || '').trim();
    const normalizedPlanId = normalizePlanId(rawPlanId);
    if (!normalizedPlanId || normalizedPlanId === 'free') return null;

    const plansRef = db.collection('plans');
    const candidateIds = [];
    if (normalizedPlanId) candidateIds.push(normalizedPlanId);
    if (rawPlanId && rawPlanId !== normalizedPlanId) candidateIds.push(rawPlanId);

    for (const candidate of candidateIds) {
        // eslint-disable-next-line no-await-in-loop
        const doc = await plansRef.doc(candidate).get();
        if (doc.exists) {
            return { id: doc.id, data: doc.data() || {} };
        }
    }

    const snap = await plansRef.get();
    const matched = snap.docs.find((doc) => normalizePlanId(doc.id) === normalizedPlanId);
    if (!matched) return null;
    return { id: matched.id, data: matched.data() || {} };
}

// --- OTP FUNCTIONS ---

exports.sendVerificationOTP = functions.region(REGION).https.onRequest(async (req, res) => {
    if (handlePreflight(req, res)) return;
    if (req.method !== 'POST') return sendError(req, res, 405, 'Method not allowed.');
    if (rejectIfDisallowedOrigin(req, res)) return;

    try {
        const { email: rawEmail } = getRequestBody(req);
        const email = normalizeEmail(rawEmail);
        if (!isValidEmail(email)) return sendError(req, res, 400, 'Valid email is required.');

        const otpRef = db.collection('otp_verifications').doc(email);
        const existing = await otpRef.get();
        if (existing.exists) {
            const previous = existing.data() || {};
            const updatedAt = Number(previous.updatedAt || 0);
            const elapsed = Date.now() - updatedAt;
            if (elapsed < OTP_RESEND_COOLDOWN_MS) {
                const waitSeconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000);
                return sendError(req, res, 429, `Please wait ${waitSeconds}s before requesting another OTP.`);
            }
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + OTP_VALIDITY_MS;
        const otpHash = hashOtp(email, otp);

        await otpRef.set({
            email,
            otpHash,
            failedAttempts: 0,
            expiresAt,
            updatedAt: Date.now(),
            lastAttemptAt: null
        }, { merge: true });

        const mailOptions = {
            from: `"NLA Support" <${process.env.EMAIL_USER || 'admin@gmail.com'}>`,
            to: email,
            subject: 'Verify Your Email - NLA',
            html: `<div style="font-family: Arial; padding: 20px; text-align: center; background: #f8fafc;">
                    <h2 style="color: #10b981;">Welcome to NLA!</h2>
                    <p style="font-size: 1.1rem;">Your verification code is:</p>
                    <div style="font-size: 2.5rem; font-weight: 800; color: #0f172a; margin: 20px 0; letter-spacing: 5px;">${otp}</div>
                    <p style="color: #64748b;">This code is valid up to 1 minute.</p>
                   </div>`
        };

        try {
            await transporter.sendMail(mailOptions);
        } catch (mailErr) {
            console.warn('OTP email send failed:', mailErr.message);
        }

        setCorsHeaders(req, res);
        res.status(200).json({
            ok: true,
            expiresAt,
            validForSeconds: Math.floor(OTP_VALIDITY_MS / 1000),
            cooldownSeconds: Math.floor(OTP_RESEND_COOLDOWN_MS / 1000)
        });
    } catch (error) {
        console.error('sendVerificationOTP failed:', error);
        sendError(req, res, 500, 'Failed to send OTP.');
    }
});

exports.verifySignupOTP = functions.region(REGION).https.onRequest(async (req, res) => {
    if (handlePreflight(req, res)) return;
    if (req.method !== 'POST') return sendError(req, res, 405, 'Method not allowed.');
    if (rejectIfDisallowedOrigin(req, res)) return;

    try {
        const { email: rawEmail, otp } = getRequestBody(req);
        const email = normalizeEmail(rawEmail);
        if (!isValidEmail(email)) return sendError(req, res, 400, 'Valid email is required.');
        if (!/^\d{6}$/.test(String(otp || ''))) return sendError(req, res, 400, 'Invalid OTP format.');

        const otpRef = db.collection('otp_verifications').doc(email);
        const otpDoc = await otpRef.get();
        if (!otpDoc.exists) return sendError(req, res, 400, 'No verification found.');

        const data = otpDoc.data() || {};
        const now = Date.now();
        const expiresAt = Number(data.expiresAt || 0);
        const failedAttempts = Number(data.failedAttempts || 0);

        if (!expiresAt || now > expiresAt) {
            await otpRef.delete().catch(() => null);
            return sendError(req, res, 400, 'OTP expired.');
        }

        if (failedAttempts >= OTP_MAX_ATTEMPTS) {
            await otpRef.delete().catch(() => null);
            return sendError(req, res, 429, 'Too many invalid attempts. Request a new OTP.');
        }

        const incomingHash = hashOtp(email, otp);
        if (incomingHash !== data.otpHash) {
            const nextAttempts = failedAttempts + 1;
            await otpRef.set({
                failedAttempts: nextAttempts,
                lastAttemptAt: now
            }, { merge: true });
            if (nextAttempts >= OTP_MAX_ATTEMPTS) {
                return sendError(req, res, 429, 'Too many invalid attempts. Request a new OTP.');
            }
            return sendError(req, res, 400, 'Invalid OTP.');
        }

        await otpRef.delete();
        setCorsHeaders(req, res);
        res.status(200).json({ ok: true, message: 'Verified' });
    } catch (error) {
        console.error('verifySignupOTP failed:', error);
        sendError(req, res, 500, 'Verification failed.');
    }
});

exports.completeRegistration = functions.region(REGION).https.onRequest(async (req, res) => {
    if (handlePreflight(req, res)) return;
    if (req.method !== 'POST') return sendError(req, res, 405, 'Method not allowed.');
    if (rejectIfDisallowedOrigin(req, res)) return;

    try {
        const { idToken, studentData } = getRequestBody(req);
        const user = await verifyUser(idToken);

        const batch = db.batch();
        const studentRef = db.collection('students').doc(user.uid);

        const finalData = {
            name: studentData.name || 'Learner',
            email: user.email,
            phone: studentData.phone || '',
            qualification: studentData.qualification || '',
            address: studentData.address || '',
            plan: 'free',
            isAdmin: user.email === (process.env.ADMIN_EMAIL || 'admin@gmail.com'),
            enrolled: admin.firestore.FieldValue.serverTimestamp(),
            lastLogin: admin.firestore.FieldValue.serverTimestamp()
        };

        batch.set(studentRef, finalData, { merge: true });
        await batch.commit();

        setCorsHeaders(req, res);
        res.status(200).json({ ok: true });
    } catch (error) {
        console.error('completeRegistration failed:', error);
        sendError(req, res, 500, error.message);
    }
});

exports.sendContactFeedbackAlert = functions.region(REGION).https.onRequest(async (req, res) => {
    if (handlePreflight(req, res)) return;
    if (req.method !== 'POST') return sendError(req, res, 405, 'Method not allowed.');
    if (rejectIfDisallowedOrigin(req, res)) return;

    let feedbackRef = null;
    try {
        const body = getRequestBody(req);
        const name = normalizeText(body.name, 120);
        const email = normalizeEmail(body.email);
        const phone = normalizeText(body.phone, 30);
        const subject = normalizeText(body.subject, 180) || 'New Contact Inquiry';
        const message = normalizeText(body.message, 5000);

        if (name.length < 2) return sendError(req, res, 400, 'Please enter your name.');
        if (!isValidEmail(email)) return sendError(req, res, 400, 'Please enter a valid email address.');
        if (message.length < 5) return sendError(req, res, 400, 'Please enter your message.');

        feedbackRef = await db.collection('contact_messages').add({
            name,
            email,
            phone,
            subject,
            message,
            origin: String(req.get('origin') || '').trim(),
            userAgent: String(req.get('user-agent') || '').slice(0, 500),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            alertStatus: 'pending'
        });

        const adminEmails = await getContactAlertRecipients();
        const to = adminEmails[0] || 'admin@gmail.com';
        const bcc = adminEmails.slice(1);
        const sentAt = new Date();

        const mailOptions = {
            from: `"NLA Contact Alerts" <${process.env.EMAIL_USER || 'admin@gmail.com'}>`,
            to,
            bcc: bcc.length ? bcc.join(',') : undefined,
            replyTo: email,
            subject: `[Contact] ${subject}`,
            text: [
                'New Contact Form Submission',
                `Name: ${name}`,
                `Email: ${email}`,
                `Phone: ${phone || 'N/A'}`,
                `Subject: ${subject}`,
                '',
                'Message:',
                message,
                '',
                `Time: ${sentAt.toISOString()}`,
                `Feedback ID: ${feedbackRef.id}`
            ].join('\n'),
            html: `<div style="font-family: Arial, sans-serif; line-height: 1.6;">
                    <h2 style="margin-bottom: 12px; color: #0f172a;">New Contact Form Submission</h2>
                    <p><b>Name:</b> ${name}</p>
                    <p><b>Email:</b> ${email}</p>
                    <p><b>Phone:</b> ${phone || 'N/A'}</p>
                    <p><b>Subject:</b> ${subject}</p>
                    <p><b>Message:</b><br>${message.replace(/\n/g, '<br>')}</p>
                    <hr style="margin: 20px 0; border: 0; border-top: 1px solid #e2e8f0;">
                    <p style="color: #64748b; font-size: 12px; margin: 0;">
                        Time: ${sentAt.toISOString()}<br>
                        Feedback ID: ${feedbackRef.id}
                    </p>
                   </div>`
        };

        await transporter.sendMail(mailOptions);

        await feedbackRef.set({
            alertStatus: 'email_sent',
            alertSentAt: admin.firestore.FieldValue.serverTimestamp(),
            adminEmails
        }, { merge: true });

        setCorsHeaders(req, res);
        res.status(200).json({ ok: true, message: 'Message sent successfully.' });
    } catch (error) {
        console.error('sendContactFeedbackAlert failed:', error);
        if (feedbackRef) {
            await feedbackRef.set({
                alertStatus: 'email_failed',
                alertError: String(error && error.message || 'unknown error'),
                alertFailedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true }).catch(() => null);
        }
        sendError(req, res, 500, 'Unable to send message right now. Please try again.');
    }
});

// --- RAZORPAY FUNCTIONS ---

exports.createRazorpayOrder = functions.region(REGION).https.onRequest(async (req, res) => {
    if (handlePreflight(req, res)) return;
    if (req.method !== 'POST') return sendError(req, res, 405, 'Method not allowed.');
    if (rejectIfDisallowedOrigin(req, res)) return;

    try {
        const body = getRequestBody(req);
        const { idToken, planId } = body;
        const planKey = normalizePlanId(planId);
        if (!planKey || planKey === 'free') return sendError(req, res, 400, 'Invalid plan.');

        const user = await verifyUser(idToken);
        const resolvedPlan = await resolvePlanDocument(planId);
        if (!resolvedPlan) return sendError(req, res, 404, 'Plan not found.');

        const resolvedPlanId = normalizePlanId(resolvedPlan.id);
        const plan = resolvedPlan.data || {};
        const amountPaise = getAmountInPaise(plan.price);
        const { keyId, keySecret } = getRazorpayCredentials();
        const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

        const receipt = `gl_${user.uid}_${Date.now()}`.substring(0, 40);
        const order = await razorpay.orders.create({
            amount: amountPaise,
            currency: 'INR',
            receipt,
            notes: { uid: user.uid, planId: resolvedPlanId }
        });

        await db.collection('payments').doc(order.id).set({
            orderId: order.id,
            studentUid: user.uid,
            studentEmail: user.email || '',
            planId: resolvedPlanId,
            planName: plan.name || resolvedPlanId.toUpperCase(),
            amount: amountPaise / 100,
            amountPaise,
            currency: 'INR',
            status: 'created',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        setCorsHeaders(req, res);
        res.status(200).json({
            ok: true,
            keyId,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            planId: resolvedPlanId,
            planName: plan.name || resolvedPlanId.toUpperCase()
        });
    } catch (error) {
        console.error('createRazorpayOrder failed:', error);
        sendError(req, res, 500, error.message);
    }
});

exports.verifyRazorpayPayment = functions.region(REGION).https.onRequest(async (req, res) => {
    if (handlePreflight(req, res)) return;
    if (req.method !== 'POST') return sendError(req, res, 405, 'Method not allowed.');
    if (rejectIfDisallowedOrigin(req, res)) return;

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
        const user = await verifyUser(idToken);
        const paymentRef = db.collection('payments').doc(razorpayOrderId);
        const paymentDoc = await paymentRef.get();
        if (!paymentDoc.exists) return sendError(req, res, 404, 'Order not found.');
        const payment = paymentDoc.data() || {};

        if (payment.studentUid && payment.studentUid !== user.uid) {
            return sendError(req, res, 403, 'Order does not belong to this user.');
        }

        const resolvedPlanId = normalizePlanId(payment.planId || normalizedPlanId);
        if (!resolvedPlanId || resolvedPlanId === 'free') {
            return sendError(req, res, 400, 'Invalid plan for verification.');
        }

        const { keySecret } = getRazorpayCredentials();
        const generatedSignature = crypto
            .createHmac('sha256', keySecret)
            .update(`${razorpayOrderId}|${razorpayPaymentId}`)
            .digest('hex');

        if (generatedSignature !== razorpaySignature) {
            await paymentRef.set({ status: 'signature_mismatch' }, { merge: true });
            return sendError(req, res, 400, 'Signature mismatch.');
        }

        const studentRef = db.collection('students').doc(user.uid);
        const now = admin.firestore.FieldValue.serverTimestamp();
        const batch = db.batch();
        batch.set(studentRef, {
            plan: resolvedPlanId,
            subscriptionStatus: 'active',
            subscriptionUpdatedAt: now
        }, { merge: true });
        batch.set(paymentRef, {
            status: 'paid',
            planId: resolvedPlanId,
            razorpayPaymentId,
            razorpaySignature,
            verifiedAt: now,
            updatedAt: now
        }, { merge: true });
        await batch.commit();

        setCorsHeaders(req, res);
        res.status(200).json({ ok: true, message: 'Payment verified.', planId: resolvedPlanId });
    } catch (error) {
        console.error('verifyRazorpayPayment failed:', error);
        sendError(req, res, 500, error.message);
    }
});
