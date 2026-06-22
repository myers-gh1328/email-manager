import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { repo } from './app';

const sessionCookie = 'scuba_email_session';
const setupCookie = 'scuba_email_setup';
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;
const maxLoginFailures = 3;
const loginLockoutMs = 5 * 60 * 1000;
const loginFailures = new Map<string, { count: number; lockedUntil: number }>();

export function hasAdminPassword() {
  return Boolean(repo.getSetting('auth.passwordHash'));
}

export function setAdminPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  repo.setSetting('auth.passwordHash', `${salt}:${hash}`);
  revokeAllSessions();
}

export function verifyAdminPassword(password: string) {
  const stored = repo.getSetting('auth.passwordHash');
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = hashPassword(password, salt);
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(hash));
}

export function createSession(cookies: Cookies) {
  const token = randomBytes(32).toString('hex');
  repo.setSetting(sessionSettingKey(token), new Date().toISOString());
  cookies.set(sessionCookie, token, cookieOptions());
}

export function clearSession(cookies: Cookies) {
  const token = cookies.get(sessionCookie);
  if (token) repo.deleteSetting(sessionSettingKey(token));
  cookies.delete(sessionCookie, { path: '/' });
}

export function isAuthenticated(cookies: Cookies) {
  const token = cookies.get(sessionCookie);
  if (!token) return false;
  const key = sessionSettingKey(token);
  const createdAt = repo.getSetting(key);
  if (!createdAt) return false;
  if (isExpiredSession(createdAt)) {
    repo.deleteSetting(key);
    return false;
  }
  return true;
}

export function sessionSettingKey(token: string) {
  return `session.${createHash('sha256').update(token).digest('hex')}`;
}

export function revokeAllSessions() {
  for (const key of repo.listSettingKeysByPrefix('session.')) {
    repo.deleteSetting(key);
  }
}

export function loginThrottleStatus(key: string) {
  const state = loginFailures.get(key);
  if (!state) return { limited: false, retryAfterSeconds: 0 };
  if (!state.lockedUntil) return { limited: false, retryAfterSeconds: 0 };
  if (state.lockedUntil <= Date.now()) {
    loginFailures.delete(key);
    return { limited: false, retryAfterSeconds: 0 };
  }
  return {
    limited: true,
    retryAfterSeconds: Math.ceil((state.lockedUntil - Date.now()) / 1000)
  };
}

export function recordLoginFailure(key: string) {
  const current = loginFailures.get(key);
  const count = (current?.lockedUntil ?? 0) > Date.now() ? current?.count ?? 0 : (current?.count ?? 0) + 1;
  loginFailures.set(key, {
    count,
    lockedUntil: count >= maxLoginFailures ? Date.now() + loginLockoutMs : 0
  });
}

export function clearLoginFailures(key: string) {
  loginFailures.delete(key);
}

export function createSetupCookie(cookies: Cookies) {
  cookies.set(setupCookie, '1', cookieOptions());
}

export function getAuthRedirect({
  hasPassword,
  isAuthenticated,
  path
}: {
  hasPassword: boolean;
  isAuthenticated: boolean;
  path: string;
}) {
  if (!hasPassword) return path === '/setup' ? undefined : '/setup';
  if (path.startsWith('/auth/external/')) return undefined;
  if (!isAuthenticated) return path === '/login' ? undefined : '/login';
  return path === '/login' || path === '/setup' ? '/' : undefined;
}

function hashPassword(password: string, salt: string) {
  return pbkdf2Sync(password, salt, 210_000, 32, 'sha256').toString('hex');
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.SCUBA_EMAIL_SECURE_COOKIES === 'true',
    path: '/',
    maxAge: sessionMaxAgeSeconds
  };
}

function isExpiredSession(createdAt: string) {
  const createdTime = new Date(createdAt).getTime();
  if (Number.isNaN(createdTime)) return true;
  return Date.now() - createdTime > sessionMaxAgeSeconds * 1000;
}
