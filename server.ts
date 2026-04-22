import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { Resend } from 'resend';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error('ARCHIVAL_SYNC_FAILURE // RESEND_API_KEY is missing from environment.');
    }
    resendClient = new Resend(key);
  }
  return resendClient;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API Routes
  app.post('/api/send-receipt', async (req, res) => {
    const { email, orderDetails, total, shipping } = req.body;

    try {
      const resend = getResendClient();
      const { data, error } = await resend.emails.send({
        from: 'P-THREAD STUDIO <onboarding@resend.dev>',
        to: [email],
        subject: 'ARCHIVE_SECURED // Acquisition Receipt Manifest',
        html: `
          <div style="font-family: monospace; background: #000; color: #fff; padding: 40px; border: 1px solid #e61e1e;">
            <h1 style="color: #e61e1e; font-size: 24px; border-bottom: 2px solid #e61e1e; padding-bottom: 10px;">P-THREAD STUDIO // ACQUISITION_RECEIPT</h1>
            <p style="font-size: 12px; color: #888;">Manifest_ID: ${Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
            
            <div style="margin: 40px 0;">
              <h2 style="font-size: 16px; color: #fff; text-transform: uppercase;">Secured Items:</h2>
              <ul style="list-style: none; padding: 0;">
                ${orderDetails.map((item: any) => `
                  <li style="margin-bottom: 15px; border-left: 2px solid #333; padding-left: 15px;">
                    <strong style="display: block;">${item.name}</strong>
                    <span style="font-size: 12px; color: #888;">${item.color} / ${item.size} // QTY: ${item.quantity}</span>
                    <span style="display: block; color: #e61e1e;">₹${item.price}.00</span>
                  </li>
                `).join('')}
              </ul>
            </div>

            <div style="border-top: 1px solid #333; padding-top: 20px;">
              <div style="display: flex; gap: 20px; flex-direction: column;">
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #888;">SHIPPING_SURCHARGE:</span>
                  <span style="color: #fff;">₹${shipping}.00</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #888;">ACQUISITION_TOTAL:</span>
                  <strong style="color: #fff; font-size: 20px;">₹${total}.00</strong>
                </div>
              </div>
            </div>

            <p style="margin-top: 40px; font-size: 10px; color: #444; line-height: 1.6;">
              LOGISTICS_NOTE: Your items are now moving through the studio distribution grid. Tracking manifests will be updated in your terminal as sectors are cleared.
            </p>
          </div>
        `,
      });

      if (error) {
        console.error('Resend Error:', error);
        return res.status(400).json({ error });
      }

      res.status(200).json({ success: true, data });
    } catch (err) {
      console.error('Server Internal Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`P-THREAD STUDIO Server running at http://0.0.0.0:${PORT}`);
    });
  }
  
  return app;
}

export default await startServer();
