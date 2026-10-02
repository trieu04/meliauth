// Vietnamese mobile numbers may be entered in national or international form.
// All newly written values use E.164; legacy forms remain lookup candidates.
const VIETNAM_MOBILE = /^(?:0|84|\+84)([35789]\d{8})$/;
const E164_PHONE = /^\+[1-9]\d{7,14}$/;

export function normalizePhoneNumber(value: string): string | null {
  const phoneNumber = value.trim();
  const vietnamese = VIETNAM_MOBILE.exec(phoneNumber);
  if (vietnamese) return `+84${vietnamese[1]}`;

  // Do not let a malformed Vietnamese number fall through as generic E.164.
  if (phoneNumber.startsWith("+84")) return null;
  return E164_PHONE.test(phoneNumber) ? phoneNumber : null;
}

export function storedPhoneCandidates(value: string): string[] {
  const normalized = normalizePhoneNumber(value);
  if (!normalized) return [];
  if (!normalized.startsWith("+84")) return [normalized];

  const nationalNumber = normalized.slice(3);
  return [normalized, `0${nationalNumber}`, `84${nationalNumber}`];
}

export function phoneLoginCandidates(identifier: string): string[] | null {
  if (!/^(?:\+|\d{9,})/.test(identifier)) return null;
  return storedPhoneCandidates(identifier);
}
