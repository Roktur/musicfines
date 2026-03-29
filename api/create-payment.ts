import { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { albumId, albumName, price, customerEmail } = req.body;

  if (!albumId || !albumName || !price || !customerEmail) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const merchantLogin = process.env.ROBOKASSA_MERCHANT_LOGIN;
  const pass1 = process.env.ROBOKASSA_PASS1;
  const isTest = process.env.ROBOKASSA_IS_TEST === 'true';

  if (!merchantLogin || !pass1) {
    return res.status(500).json({ error: 'Robokassa not configured' });
  }

  // Generate a unique invoice ID
  const invId = Date.now();
  const outSum = price.toString();

  // Custom parameters must be prefixed with Shp_ and sorted alphabetically for signature
  // Shp_albumId, Shp_customerEmail
  const signatureString = `${merchantLogin}:${outSum}:${invId}:${pass1}:Shp_albumId=${albumId}:Shp_customerEmail=${customerEmail}`;
  const signature = crypto.createHash('md5').update(signatureString).digest('hex');

  const baseUrl = isTest 
    ? 'https://auth.robokassa.ru/Merchant/Index.aspx' 
    : 'https://auth.robokassa.ru/Merchant/Index.aspx'; // Usually the same, but test mode is a param

  const params = new URLSearchParams({
    MerchantLogin: merchantLogin,
    OutSum: outSum,
    InvId: invId.toString(),
    Description: `Покупка альбома: ${albumName}`,
    SignatureValue: signature,
    Shp_albumId: albumId.toString(),
    Shp_customerEmail: customerEmail,
  });

  if (isTest) {
    params.append('IsTest', '1');
  }

  const paymentUrl = `${baseUrl}?${params.toString()}`;

  return res.status(200).json({ paymentUrl });
}
