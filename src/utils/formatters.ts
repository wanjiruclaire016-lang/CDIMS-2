/**
 * Formatting utilities for Kenyan date/time standards, phone validation, and text display.
 */

export function formatDateKE(dateInput?: string | Date | number | null): string {
  if (!dateInput) return '-';
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);
    // Kenyan format DD/MM/YYYY
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return String(dateInput);
  }
}

export function formatDateTimeKE(dateInput?: string | Date | number | null): string {
  if (!dateInput) return '-';
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);
    const datePart = formatDateKE(d);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${datePart} ${hours}:${minutes}`;
  } catch {
    return String(dateInput);
  }
}

export function formatRelativeTime(dateInput?: string | Date | number | null, lang: 'en' | 'sw' = 'en'): string {
  if (!dateInput) return '';
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '';
    const diffMs = Date.now() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60) {
      return lang === 'sw' ? 'sasa hivi' : 'just now';
    }
    if (diffMin < 60) {
      return lang === 'sw' ? `dakika ${diffMin} zilizopita` : `${diffMin}m ago`;
    }
    if (diffHours < 24) {
      return lang === 'sw' ? `saa ${diffHours} zilizopita` : `${diffHours}h ago`;
    }
    if (diffDays === 1) {
      return lang === 'sw' ? 'jana' : 'yesterday';
    }
    if (diffDays < 7) {
      return lang === 'sw' ? `siku ${diffDays} zilizopita` : `${diffDays} days ago`;
    }
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return lang === 'sw' ? `wiki ${weeks} zilizopita` : `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    }
    return formatDateKE(d);
  } catch {
    return '';
  }
}

/**
 * Validates Kenyan phone numbers.
 * Allowed formats:
 * - 07XXXXXXXX or 01XXXXXXXX (10 digits)
 * - +2547XXXXXXXX or +2541XXXXXXXX (13 chars)
 * - 2547XXXXXXXX or 2541XXXXXXXX (12 digits)
 */
export function isValidKenyanPhone(phone: string): boolean {
  if (!phone) return false;
  const clean = phone.replace(/[\s\-\(\)]/g, '');
  const regex = /^(?:\+254|254|0)(?:7\d{8}|1\d{8})$/;
  return regex.test(clean);
}

export function formatKenyanPhone(phone: string): string {
  if (!phone) return '';
  const clean = phone.replace(/[\s\-\(\)]/g, '');
  if (clean.startsWith('0')) {
    return '+254' + clean.slice(1);
  }
  if (clean.startsWith('254')) {
    return '+' + clean;
  }
  return clean;
}
