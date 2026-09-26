const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const { createClient } = require(path.join(process.cwd(), 'node_modules/@libsql/client'));
const QRCode = require('qrcode');

const envPath = path.join(process.cwd(), '.env');
const dotenv = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
const clean = (val) => val ? val.replace(/^["']|["']$/g, '').trim() : '';
const url = clean((dotenv.match(/VITE_TURSO_DATABASE_URL=([^\r\n]+)/) || [])[1]);
const token = clean((dotenv.match(/VITE_TURSO_AUTH_TOKEN=([^\r\n]+)/) || [])[1]);

const certImgPath = 'C:/Users/kk/.gemini/antigravity/brain/af929d1f-422b-42e9-83b6-818103acbc95/.user_uploaded/media_1790415224431.jpg';

async function generateStampedCertificateBase64() {
  console.log('Generating permanent non-expiring QR code...');
  const certId = 'CX01920';
  const qrTargetUrl = `https://www.cynexai.in/certificates/${certId}`;

  // Generate high-res QR code
  const qrDataUrl = await QRCode.toDataURL(qrTargetUrl, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 512,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  });

  const certBuffer = fs.readFileSync(certImgPath);
  const certBase64 = `data:image/jpeg;base64,${certBuffer.toString('base64')}`;

  console.log('Launching headless browser canvas renderer...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Perform canvas compositing
  const stampedBase64 = await page.evaluate(async ({ baseCert, qrCode }) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const qr = new Image();
        qr.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');

          // 1. Draw base certificate
          ctx.drawImage(img, 0, 0);

          // 2. Exact coordinates in 1024x723 image:
          // Center X is 500 (approx 456 to 544)
          // Old QR is at y: 520..608, text at y: 624
          const qrSize = 92;
          const qrX = Math.round((canvas.width - qrSize) / 2); // 466
          const qrY = 518;
          const padX = 40;
          const padY = 8;

          // Clean white protective patch to completely remove old expired QR and text
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(qrX - padX, qrY - padY, qrSize + padX * 2, qrSize + padY * 2 + 30);

          // 3. Draw permanent non-expiring QR code
          ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);

          // 4. Draw crisp official domain text beneath QR code
          ctx.fillStyle = '#1e293b';
          ctx.font = '600 13.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText('www.cynexai.in', qrX + qrSize / 2, qrY + qrSize + 6);

          resolve(canvas.toDataURL('image/jpeg', 0.96));
        };
        qr.onerror = (e) => reject(new Error('QR load error'));
        qr.src = qrCode;
      };
      img.onerror = (e) => reject(new Error('Base cert load error'));
      img.src = baseCert;
    });
  }, { baseCert: certBase64, qrCode: qrDataUrl });

  await browser.close();
  console.log('Stamped base64 generated, length:', stampedBase64.length);
  return stampedBase64;
}

const PROD_URL = 'libsql://cynexai-portal-cynexai-new.aws-ap-south-1.turso.io';
const PROD_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQxOTUyNjcsImlkIjoiMDE5ZjZhNTItN2IwMS03Mzc2LWExMGUtNTViZGRiMzAwZTdlIiwia2lkIjoieUdPOElXY1J5RC1VX2J3UFlHWUJJMmlKZEp1R21CSDY5QzJQZzJUWmZhQSIsInJpZCI6IjcxYmEzODM5LTAyZDEtNDJiNS1hNDM5LTVlOWM4MGJkNGRhNSJ9.O2do8U63KLbS_pXwqivQRIYK1SncnMa1VRuePw6UFagpIIFodykzhY2cr6C_iYE83O86fUXhErbRPKfBMZtUAA';

async function seedTargetDb(dbUrl, dbToken, dbLabel, stampedBase64) {
  if (!dbUrl || !dbToken) return;
  console.log(`Connecting to ${dbLabel} (${dbUrl.substring(0, 35)}...)...`);
  const client = createClient({ url: dbUrl, authToken: dbToken });
  const now = new Date().toISOString();

  // Insert or update CX01920
  await client.execute({
    sql: `
      INSERT INTO certificates (
        id, student_id, student_name, course_id, course_title,
        issued_at, certificate_number, credential_id, file_data,
        file_type, issue_date, status, download_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        student_name = excluded.student_name,
        course_title = excluded.course_title,
        certificate_number = excluded.certificate_number,
        credential_id = excluded.credential_id,
        file_data = excluded.file_data,
        file_type = excluded.file_type,
        issue_date = excluded.issue_date,
        status = excluded.status
    `,
    args: [
      'CX01920',
      'STU-CX01920',
      'Ramba Venkata Krishna',
      'PYTHON-PROG',
      'Python Programming',
      '2025-12-27T10:00:00.000Z',
      'CX01920',
      'C102028',
      stampedBase64,
      'image/jpeg',
      '2025-12-27',
      'active',
      0
    ]
  });

  // Also insert or update alias C102028
  await client.execute({
    sql: `
      INSERT INTO certificates (
        id, student_id, student_name, course_id, course_title,
        issued_at, certificate_number, credential_id, file_data,
        file_type, issue_date, status, download_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        student_name = excluded.student_name,
        course_title = excluded.course_title,
        certificate_number = excluded.certificate_number,
        credential_id = excluded.credential_id,
        file_data = excluded.file_data,
        file_type = excluded.file_type,
        issue_date = excluded.issue_date,
        status = excluded.status
    `,
    args: [
      'C102028',
      'STU-CX01920',
      'Ramba Venkata Krishna',
      'PYTHON-PROG',
      'Python Programming',
      '2025-12-27T10:00:00.000Z',
      'C102028',
      'CX01920',
      stampedBase64,
      'image/jpeg',
      '2025-12-27',
      'active',
      0
    ]
  });

  console.log(`✓ Successfully seeded CX01920 and C102028 into ${dbLabel}!`);
}

async function run() {
  const stampedBase64 = await generateStampedCertificateBase64();

  // 1. Seed Real Production Database
  await seedTargetDb(PROD_URL, PROD_TOKEN, 'REAL PRODUCTION DATABASE (cynexai-portal-cynexai-new)', stampedBase64);

  // 2. Also seed .env database if different
  if (url && url !== PROD_URL) {
    await seedTargetDb(url, token, 'ENV DATABASE (' + url + ')', stampedBase64);
  }
}

run().catch(console.error);
