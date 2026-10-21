import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

/** Spotify tokens for one signed-in app installation. They never leave the server. */
export interface SpotifySession {
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms. */
  expiresAt: number;
  scope: string;
  createdAt: number;
}

/**
 * In-memory session store with optional AES-256-GCM encrypted persistence, so users stay connected across
 * restarts. Without a file/key, sessions live in memory only (users reconnect after a restart).
 */
export class SessionStore {
  private readonly sessions = new Map<string, SpotifySession>();
  private readonly key?: Buffer;

  constructor(private readonly file?: string, secret?: string) {
    if (file && secret) this.key = createHash('sha256').update(secret).digest();
    if (file && !secret) console.warn('[sessions] TOKEN_STORE_FILE is set without TOKEN_ENCRYPTION_KEY: persistence disabled.');
    this.load();
  }

  get persistent() {
    return !!(this.file && this.key);
  }

  get(id: string): SpotifySession | undefined {
    return this.sessions.get(id);
  }

  set(id: string, session: SpotifySession) {
    this.sessions.set(id, session);
    this.save();
  }

  delete(id: string) {
    if (this.sessions.delete(id)) this.save();
  }

  private load() {
    if (!this.file || !this.key || !existsSync(this.file)) return;
    try {
      const raw = Buffer.from(readFileSync(this.file, 'utf8'), 'base64');
      const decipher = createDecipheriv('aes-256-gcm', this.key, raw.subarray(0, 12));
      decipher.setAuthTag(raw.subarray(12, 28));
      const json = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
      for (const [id, s] of Object.entries(JSON.parse(json) as Record<string, SpotifySession>)) this.sessions.set(id, s);
    } catch {
      console.error('[sessions] Could not read the token store (wrong key or corrupted file); starting empty.');
    }
  }

  private save() {
    if (!this.file || !this.key) return;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(JSON.stringify(Object.fromEntries(this.sessions)), 'utf8'), cipher.final()]);
    writeFileSync(this.file, Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64'), { mode: 0o600 });
  }
}
