import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Robokassa sends parameters via GET or POST depending on configuration
  const data = req.method === 'POST' ? req.body : req.query;
  const { InvId } = data;

  // Return a simple HTML page with a success message
  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Успешная оплата</title>
      <style>
        body {
          background-color: #0a0a0a;
          color: white;
          font-family: 'Inter', sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
          text-align: center;
        }
        .container {
          padding: 2rem;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          max-width: 400px;
        }
        h1 {
          color: #f97316;
          margin-bottom: 1rem;
        }
        p {
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.6;
        }
        .btn {
          display: inline-block;
          margin-top: 2rem;
          padding: 0.75rem 1.5rem;
          background-color: #f97316;
          color: black;
          text-decoration: none;
          border-radius: 12px;
          font-weight: bold;
          transition: background-color 0.2s;
        }
        .btn:hover {
          background-color: #ea580c;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Спасибо за покупку!</h1>
        <p>Ссылка на скачивание отправлена на ваш email.</p>
        <p>Номер заказа: ${InvId || 'неизвестен'}</p>
        <a href="/" class="btn">Вернуться на главную</a>
      </div>
    </body>
    </html>
  `);
}
