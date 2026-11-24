import crypto from 'crypto';

function getEncryptionKeyBuffer(): Buffer {
  const secret =
    process.env.APP_PASSWORD ||
    process.env.GOOGLE_PRIVATE_KEY ||
    process.env.GOOGLE_CLIENT_EMAIL ||
    'health-tracker-v2-garmin-secret';
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptSecretForSheet(plainText: string): string {
  const trimmed = plainText.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('ENC:')) return trimmed;
  const key = getEncryptionKeyBuffer();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(trimmed, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `ENC:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptSecretFromSheet(storedValue: string): string {
  const trimmed = storedValue.trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('ENC:')) {
    return trimmed;
  }
  try {
    const parts = trimmed.split(':');
    if (parts.length !== 4) return '';
    const iv = Buffer.from(parts[1], 'base64');
    const authTag = Buffer.from(parts[2], 'base64');
    const encrypted = Buffer.from(parts[3], 'base64');
    const key = getEncryptionKeyBuffer();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.warn('[GarminConfig] Failed to decrypt stored secret:', err);
    return '';
  }
}
