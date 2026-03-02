# Razorpay Setup (Firebase Functions)

This project now uses server-side Razorpay order creation and signature verification.

## 0) If Firebase Functions is not initialized yet

Run:

```bash
firebase init functions
```

When prompted:

- Select your existing Firebase project.
- Keep JavaScript runtime.
- Use `functions` as source directory.
- Do not overwrite existing `functions/index.js`.

## 1) Install Functions dependencies

```bash
cd functions
npm install
```

## 2) Set Razorpay keys (server-side only)

Use test keys first:

```bash
firebase functions:config:set razorpay.key_id="rzp_test_xxxxx" razorpay.key_secret="xxxxxx"
```

You can also use environment variables instead:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`

## 3) Deploy Cloud Functions

From project root:

```bash
firebase deploy --only functions
```

Deployed endpoints used by frontend:

- `createRazorpayOrder`
- `verifyRazorpayPayment`

Both are expected in region `asia-south1`.

## 4) Test payment flow

1. Login as a normal user.
2. Open pricing section.
3. Click a paid plan.
4. Complete Razorpay test payment.
5. Verify `students/{uid}.plan` updates in Firestore.
6. Verify `payments/{orderId}` status becomes `paid`.

## 5) Go live

1. Replace test keys with live Razorpay keys.
2. Add your production domain in Razorpay dashboard settings.
3. Redeploy functions.
