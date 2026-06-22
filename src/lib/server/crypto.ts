import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { getAppSecret } from './app-secret';

const algorithm = 'aes-256-gcm';

export function encryptSecret(value: string) {
  if (!value) return '';
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':');
}

export function decryptSecret(value: string) {
  if (!value) return '';
  const [ivHex, tagHex, encryptedHex] = value.split(':');
  if (!ivHex || !tagHex || !encryptedHex) return '';
  const decipher = createDecipheriv(algorithm, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]).toString('utf8');
}

function getKey() {
  return createHash('sha256').update(getAppSecret()).digest();
}
