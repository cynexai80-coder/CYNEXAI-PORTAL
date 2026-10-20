/** Phone helpers. Indian 10-digit mobile numbers need the 91 country code for wa.me links. */
export function toWhatsAppNumber(phone: string | null | undefined, defaultCountry = '91'): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return defaultCountry + digits;                         // 9876543210
  if (digits.length === 11 && digits.startsWith('0')) return defaultCountry + digits.slice(1); // 09876543210
  return digits;                                                                    // already international
}

export function normalizePhone(phone: string | null | undefined): string {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}
