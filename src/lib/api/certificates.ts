import { client, isTursoConfigured } from '../turso';
import QRCode from 'qrcode';

export interface CertificateRecord {
  id: string;
  student_id?: string;
  student_name: string;
  course_id?: string;
  course_title: string;
  issued_at?: string;
  certificate_number: string;
  credential_id?: string;
  file_data?: string;
  file_type?: string;
  issue_date?: string;
  training_period?: string;
  status?: string;
  download_count?: number;
}

export interface StampOptions {
  size?: number;          // Width & height of QR code in pixels
  offsetX?: number;       // Horizontal nudge (-100 to +100)
  offsetY?: number;       // Vertical nudge (-100 to +100)
  domainUrl?: string;     // Override base URL (defaults to canonical cynexai.in)
  showWebsiteText?: boolean; // Draw 'www.cynexai.in' under QR
}

const CANONICAL_DOMAIN = 'https://www.cynexai.in';

/**
 * Returns permanent verification URL for a certificate.
 * Direct domain URL without third-party redirects guarantees it never expires.
 */
export function getPermanentVerificationUrl(certId: string, domain = CANONICAL_DOMAIN): string {
  const cleanId = encodeURIComponent(certId.trim());
  return `${domain.replace(/\/+$/, '')}/certificates/${cleanId}`;
}

/**
 * Generates a high-res permanent QR code as a PNG data URL.
 */
export async function generatePermanentQRDataUrl(certId: string, size = 256): Promise<string> {
  const url = getPermanentVerificationUrl(certId);
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: size,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  });
}

/**
 * Client-side HTML5 Canvas Stamper.
 * Overlays the non-expiring permanent QR code cleanly onto the bottom-middle of any certificate image.
 */
export async function stampPermanentQR(
  imageSrc: string,
  certId: string,
  options: StampOptions = {}
): Promise<string> {
  const qrUrl = getPermanentVerificationUrl(certId, options.domainUrl);

  // 1. Generate high-res QR code data URL (512px for crisp vector-like sharpness)
  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 512,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  });

  return new Promise((resolve, reject) => {
    const certImg = new Image();
    certImg.crossOrigin = 'anonymous';

    certImg.onload = () => {
      const qrImg = new Image();
      qrImg.crossOrigin = 'anonymous';

      qrImg.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = certImg.naturalWidth || certImg.width;
          canvas.height = certImg.naturalHeight || certImg.height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get 2D canvas context'));
            return;
          }

          // Draw the base certificate
          ctx.drawImage(certImg, 0, 0, canvas.width, canvas.height);

          // Calculate bottom-middle coordinates
          // For the standard CynexAI certificate layout:
          // Center X is ~50% width
          // Bottom QR is at ~72% to 84% height
          const defaultQrSize = Math.round(canvas.width * 0.088); // ~90px on 1024px width
          const qrSize = options.size || defaultQrSize;

          const centerX = canvas.width / 2;
          const defaultY = Math.round(canvas.height * 0.722);

          const qrX = Math.round(centerX - qrSize / 2 + (options.offsetX || 0));
          const qrY = Math.round(defaultY + (options.offsetY || 0));

          // Draw clean white protective card behind QR code to cover old / expired QR codes
          // Draw clean white protective card behind QR code to cover old / expired QR codes & previous URL text
          const padX = Math.max(24, Math.round(qrSize * 0.38));
          const padY = Math.max(6, Math.round(qrSize * 0.08));
          const textHeight = (options.showWebsiteText !== false) ? Math.round(qrSize * 0.28) : 0;

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(
            qrX - padX,
            qrY - padY,
            qrSize + padX * 2,
            qrSize + padY * 2 + textHeight
          );

          // Draw the permanent QR code
          ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

          // Draw the official URL text beneath the QR code
          if (options.showWebsiteText !== false) {
            const fontSize = Math.max(10, Math.round(qrSize * 0.145));
            ctx.fillStyle = '#1e293b';
            ctx.font = `600 ${fontSize}px "Segoe UI", Roboto, system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(
              'www.cynexai.in',
              qrX + qrSize / 2,
              qrY + qrSize + 5
            );
          }

          // Return high quality JPEG data URL
          const resultDataUrl = canvas.toDataURL('image/jpeg', 0.95);
          resolve(resultDataUrl);
        } catch (err) {
          reject(err);
        }
      };

      qrImg.onerror = (err) => reject(new Error('Failed to load QR image for stamping: ' + err));
      qrImg.src = qrDataUrl;
    };

    certImg.onerror = (err) => reject(new Error('Failed to load base certificate image: ' + err));
    certImg.src = imageSrc;
  });
}

/**
 * Queries certificate from DB by ID, certificate_number, or credential_id (case-insensitive)
 */
export async function getCertificateById(idOrNumber: string): Promise<CertificateRecord | null> {
  const query = idOrNumber.trim().toLowerCase();
  if (!query) return null;

  if (isTursoConfigured && client) {
    try {
      const res = await client.execute({
        sql: `
          SELECT * FROM certificates 
          WHERE LOWER(TRIM(id)) = ? 
             OR LOWER(TRIM(certificate_number)) = ? 
             OR LOWER(TRIM(credential_id)) = ?
          LIMIT 1
        `,
        args: [query, query, query]
      });

      if (res.rows && res.rows.length > 0) {
        return res.rows[0] as unknown as CertificateRecord;
      }
    } catch (e) {
      console.warn('Error querying certificate from Turso:', e);
    }
  }

  // Local storage fallback for offline / mock testing
  try {
    const local = localStorage.getItem('cynex_certificates');
    if (local) {
      const list: CertificateRecord[] = JSON.parse(local);
      const found = list.find(c => 
        (c.id && c.id.trim().toLowerCase() === query) ||
        (c.certificate_number && c.certificate_number.trim().toLowerCase() === query) ||
        (c.credential_id && c.credential_id.trim().toLowerCase() === query)
      );
      if (found) return found;
    }
  } catch (e) {
    console.error('Local fallback read error:', e);
  }

  return null;
}

/**
 * Fetches all certificates from database.
 */
export async function getAllCertificates(): Promise<CertificateRecord[]> {
  if (isTursoConfigured && client) {
    try {
      const res = await client.execute({
        sql: `SELECT id, student_id, student_name, course_id, course_title, issued_at, certificate_number, credential_id, issue_date, status, download_count, LENGTH(file_data) as file_size FROM certificates ORDER BY rowid DESC`
      });
      return (res.rows || []) as unknown as CertificateRecord[];
    } catch (e) {
      console.warn('Error fetching all certificates:', e);
    }
  }

  try {
    const local = localStorage.getItem('cynex_certificates');
    return local ? JSON.parse(local) : [];
  } catch {
    return [];
  }
}

/**
 * Inserts or updates certificate record in database.
 */
export async function saveCertificate(cert: CertificateRecord): Promise<boolean> {
  const certId = cert.id || `CX-${Date.now()}`;
  const certNumber = cert.certificate_number || certId;
  const now = new Date().toISOString();

  if (isTursoConfigured && client) {
    try {
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
          certId,
          cert.student_id || 'STU-' + certId,
          cert.student_name || 'Student',
          cert.course_id || 'COURSE-GEN',
          cert.course_title || 'Professional Certification',
          cert.issued_at || now,
          certNumber,
          cert.credential_id || certNumber,
          cert.file_data || '',
          cert.file_type || 'image/jpeg',
          cert.issue_date || now.split('T')[0],
          cert.status || 'active',
          cert.download_count || 0
        ]
      });
      return true;
    } catch (e) {
      console.error('Error saving certificate to Turso:', e);
    }
  }

  // Also sync to local storage fallback
  try {
    const local = localStorage.getItem('cynex_certificates');
    const list: CertificateRecord[] = local ? JSON.parse(local) : [];
    const idx = list.findIndex(c => c.id === certId || c.certificate_number === certNumber);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...cert, id: certId, certificate_number: certNumber };
    } else {
      list.unshift({ ...cert, id: certId, certificate_number: certNumber });
    }
    localStorage.setItem('cynex_certificates', JSON.stringify(list));
    return true;
  } catch (e) {
    console.error('Error saving certificate locally:', e);
    return false;
  }
}

/**
 * Deletes certificate by ID.
 */
export async function deleteCertificate(id: string): Promise<boolean> {
  if (isTursoConfigured && client) {
    try {
      await client.execute({
        sql: `DELETE FROM certificates WHERE id = ? OR certificate_number = ?`,
        args: [id, id]
      });
    } catch (e) {
      console.warn('Error deleting certificate from Turso:', e);
    }
  }

  try {
    const local = localStorage.getItem('cynex_certificates');
    if (local) {
      const list: CertificateRecord[] = JSON.parse(local);
      const filtered = list.filter(c => c.id !== id && c.certificate_number !== id);
      localStorage.setItem('cynex_certificates', JSON.stringify(filtered));
    }
    return true;
  } catch {
    return false;
  }
}
