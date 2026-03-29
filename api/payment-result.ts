import { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
  // For Vercel, we can use environment variables
  // If FIREBASE_SERVICE_ACCOUNT is set, use it. Otherwise, it might use ADC (Application Default Credentials)
  // in a real environment. For this demo, we'll assume it's configured.
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    if (serviceAccount.project_id) {
      initializeApp({
        credential: cert(serviceAccount)
      });
    } else {
      // Fallback for local dev or if using default credentials
      initializeApp({
        projectId: process.env.VITE_FIREBASE_PROJECT_ID
      });
    }
  } catch (e) {
    console.error('Firebase Admin initialization failed:', e);
  }
}

const db = getFirestore();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Robokassa sends parameters via GET or POST depending on configuration
  const data = req.method === 'POST' ? req.body : req.query;
  
  const { OutSum, InvId, SignatureValue, Shp_albumId, Shp_customerEmail } = data;

  if (!OutSum || !InvId || !SignatureValue || !Shp_albumId || !Shp_customerEmail) {
    return res.status(400).send('Missing required fields');
  }

  const pass2 = process.env.ROBOKASSA_PASS2;
  if (!pass2) {
    return res.status(500).send('Robokassa Pass2 not configured');
  }

  // Signature check: OutSum:InvId:Pass2:Shp_albumId=...:Shp_customerEmail=...
  const signatureString = `${OutSum}:${InvId}:${pass2}:Shp_albumId=${Shp_albumId}:Shp_customerEmail=${Shp_customerEmail}`;
  const calculatedSignature = crypto.createHash('md5').update(signatureString).digest('hex').toUpperCase();

  if (calculatedSignature !== (SignatureValue as string).toUpperCase()) {
    console.error('Invalid signature:', { calculatedSignature, SignatureValue });
    return res.status(400).send('Invalid signature');
  }

  try {
    // 1. Fetch album details from Firestore
    const albumDoc = await db.collection('albums').doc(Shp_albumId as string).get();
    if (!albumDoc.exists) {
      console.error('Album not found:', Shp_albumId);
      return res.status(404).send('Album not found');
    }

    const albumData = albumDoc.data();
    const downloadUrl = albumData?.audioUrl;

    if (!downloadUrl) {
      console.error('Download URL not found for album:', Shp_albumId);
      return res.status(500).send('Download URL not found');
    }

    // 2. Mock sending email
    console.log(`[MOCK EMAIL] To: ${Shp_customerEmail}`);
    console.log(`[MOCK EMAIL] Subject: Ваша покупка: ${albumData?.title}`);
    console.log(`[MOCK EMAIL] Body: Спасибо за покупку! Ссылка на скачивание: ${downloadUrl}`);

    // 3. (Optional) Record the transaction in Firestore
    await db.collection('transactions').add({
      albumId: Shp_albumId,
      customerEmail: Shp_customerEmail,
      amount: OutSum,
      invoiceId: InvId,
      timestamp: new Date(),
      status: 'completed'
    });

    // Robokassa expects "OK" + InvId as a response
    return res.status(200).send(`OK${InvId}`);
  } catch (error) {
    console.error('Error processing payment result:', error);
    return res.status(500).send('Internal server error');
  }
}
