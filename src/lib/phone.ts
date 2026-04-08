export function normalizeNorthAmericanPhone(raw: string) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1${digits.slice(1)}`;
  }
  return null;
}
