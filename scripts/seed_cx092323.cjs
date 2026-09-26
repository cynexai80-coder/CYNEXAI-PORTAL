const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const { createClient } = require(path.join(process.cwd(), 'node_modules/@libsql/client'));
const QRCode = require('qrcode');

const certImgPath = 'C:/Users/kk/.gemini/antigravity/brain/af929d1f-422b-42e9-83b6-818103acbc95/.user_uploaded/media_1790419411385.jpg';

const PROD_URL = 'libsql://cynexai-portal-cynexai-new.aws-ap-south-1.turso.io';
const PROD_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQxOTUyNjcsImlkIjoiMDE5ZjZhNTItN2IwMS03Mzc2LWExMGUtNTViZGRiMzAwZTdlIiwia2lkIjoieUdPOElXY1J5RC1VX2J3UFlHWUJJMmlKZEp1R21CSDY5QzJQZzJUWmZhQSIsInJpZCI6IjcxYmEzODM5LTAyZDEtNDJiNS1hNDM5LTVlOWM4MGJkNGRhNSJ9.O2do8U63KLbS_pXwqivQRIYK1SncnMa1VRuePw6UFagpIIFodykzhY2cr6C_iYE83O86fUXhErbRPKfBMZtUAA';

const DEV_URL = 'libsql://cynex-ai-cynexai.aws-ap-south-1.turso.io';
const DEV_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODA5MTk5MzYsImlkIjoiMDE5ZWE3MTktNzkwMS03Y2Y3LTgxNDItYmI3ZTdhY2RiZGUyIiwicmlkIjoiZDhlZjQ2NjQtNGZjNy00MTc0LWJlMTItOWIwNDczN2RjNGIyIn0.nzy6qJrwAHywKfZwRZ28eMJFbD20IFojBH-tYxX1xS8Ouaokn7SZcKT2FiG_M5umsbw9HN24TXc0vsKgOJlhDw';

async function generateStampedCertificateBase64() {
  console.log('Generating permanent QR code for CX092323...');
  const qrTargetUrl = 'https://www.cynexai.in/certificates/CX092323';

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

          // Draw base certificate
          ctx.drawImage(img, 0, 0);

          // Place QR code in bottom-middle
          const qrSize = 92;
          const qrX = Math.round((canvas.width - qrSize) / 2); // 466
          const qrY = 518;
          const padX = 40;
          const padY = 8;

          // Clean white patch over bottom-middle area for flawless alignment
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(qrX - padX, qrY - padY, qrSize + padX * 2, qrSize + padY * 2 + 30);

          // Draw permanent non-expiring QR code
          ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);

          // Draw crisp official domain text beneath QR code
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

async function seedTargetDb(dbUrl, dbToken, dbLabel, stampedBase64) {
  if (!dbUrl || !dbToken) return;
  console.log(`Connecting to ${dbLabel}...`);
  const client = createClient({ url: dbUrl, authToken: dbToken });
  const now = new Date().toISOString();

  // Insert or update CX092323
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
      'CX092323',
      'STU-CX092323',
      'Ramba Venkata Krishna',
      'AI-GENAI',
      'Artificial Intelligence & Generative AI',
      '2026-06-25T10:00:00.000Z',
      'CX092323',
      'C102097',
      stampedBase64,
      'image/jpeg',
      '2026-06-25',
      'active',
      0
    ]
  });

  // Also insert or update alias C102097
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
      'C102097',
      'STU-CX092323',
      'Ramba Venkata Krishna',
      'AI-GENAI',
      'Artificial Intelligence & Generative AI',
      '2026-06-25T10:00:00.000Z',
      'C102097',
      'CX092323',
      stampedBase64,
      'image/jpeg',
      '2026-06-25',
      'active',
      0
    ]
  });

  console.log(`✓ Successfully seeded CX092323 and C102097 into ${dbLabel}!`);
}

async function run() {
  const stampedBase64 = await generateStampedCertificateBase64();

  // 1. Seed Real Production Database
  await seedTargetDb(PROD_URL, PROD_TOKEN, 'REAL PRODUCTION DATABASE (cynexai-portal-cynexai-new)', stampedBase64);

  // 2. Also seed Dev Database
  await seedTargetDb(DEV_URL, DEV_TOKEN, 'DEV DATABASE (cynex-ai-cynexai)', stampedBase64);

  console.log('Seeding finished successfully!');
}

run().catch(console.error);
