import type { KV } from './store/local';

/**
 * Accounts for local mode (no backend yet). Passwords are salted and hashed with PBKDF2-SHA-256
 * via Web Crypto, so they are never stored in plain text. This protects passwords on a shared PC
 * but is NOT server-grade security: anyone with access to this browser profile can read the data.
 * When Supabase (or another backend) is connected, Supabase Auth replaces this module.
 */

export interface Credential {
  email: string;
  profile_id: string;
  salt: string;
  hash: string;
}

const KEY = 'ns-spark-auth-v1';
const ITERATIONS = 120_000;
export const MIN_PASSWORD = 8;

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function derive(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: ITERATIONS }, key, 256);
  return hex(bits);
}

const norm = (email: string) => email.trim().toLowerCase();

export class LocalAuth {
  constructor(private kv: KV) {}

  all(): Credential[] {
    try {
      return JSON.parse(this.kv.get(KEY) ?? '[]') as Credential[];
    } catch {
      return [];
    }
  }
  private save(list: Credential[]) {
    this.kv.set(KEY, JSON.stringify(list));
  }

  hasEmail(email: string) {
    return this.all().some((c) => c.email === norm(email));
  }

  async create(email: string, password: string, profileId: string) {
    if (password.length < MIN_PASSWORD) throw new Error(`Password must be at least ${MIN_PASSWORD} characters.`);
    if (this.hasEmail(email)) throw new Error('An account with this email already exists.');
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
    const hash = await derive(password, salt);
    this.save([...this.all(), { email: norm(email), profile_id: profileId, salt, hash }]);
  }

  /** Returns the profile id on success, null otherwise. Constant work whether or not the email exists. */
  async verify(email: string, password: string): Promise<string | null> {
    const c = this.all().find((x) => x.email === norm(email));
    const h = await derive(password, c?.salt ?? 'no-such-user');
    return c && h === c.hash ? c.profile_id : null;
  }

  async setPassword(profileId: string, password: string) {
    if (password.length < MIN_PASSWORD) throw new Error(`Password must be at least ${MIN_PASSWORD} characters.`);
    const list = this.all();
    const c = list.find((x) => x.profile_id === profileId);
    if (!c) throw new Error('This person has no login yet.');
    c.salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
    c.hash = await derive(password, c.salt);
    this.save(list);
  }

  setEmail(profileId: string, email: string) {
    const list = this.all();
    if (list.some((x) => x.email === norm(email) && x.profile_id !== profileId)) throw new Error('Email already in use.');
    const c = list.find((x) => x.profile_id === profileId);
    if (c) c.email = norm(email);
    this.save(list);
  }

  remove(profileId: string) {
    this.save(this.all().filter((c) => c.profile_id !== profileId));
  }

  replaceAll(list: Credential[]) {
    this.save(list);
  }
}
