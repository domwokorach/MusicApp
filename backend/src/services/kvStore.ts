import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import { config } from '../config';

/** Minimal key-value contract needed by the OAuth flow. */
export interface KeyValueStore {
  readonly kind: 'memory' | 'upstash';
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  get(key: string): Promise<string | null>;
  /** Atomically read and delete: used for single-use values (OAuth state, login tickets). */
  take(key: string): Promise<string | null>;
  del(key: string): Promise<void>;
}

class MemoryStore implements KeyValueStore {
  readonly kind = 'memory' as const;
  private readonly map = new Map<string, { value: string; expiresAt: number }>();

  async set(key: string, value: string, ttlSeconds?: number) {
    this.map.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : Infinity });
  }
  async get(key: string) {
    const hit = this.map.get(key);
    if (!hit) return null;
    if (hit.expiresAt < Date.now()) {
      this.map.delete(key);
      return null;
    }
    return hit.value;
  }
  async take(key: string) {
    const value = await this.get(key);
    this.map.delete(key);
    return value;
  }
  async del(key: string) {
    this.map.delete(key);
  }
}

/** Upstash Redis over its REST API (`POST <url>` with the command as a JSON array). Works from any serverless runtime. */
class UpstashStore implements KeyValueStore {
  readonly kind = 'upstash' as const;
  constructor(private readonly url: string, private readonly token: string) {}

  private async cmd(args: (string | number)[]): Promise<unknown> {
    let res: Response;
    try {
      res = await fetch(this.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new Error('Session store is unreachable.');
    }
    const json = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string };
    if (!res.ok || json.error) throw new Error('Session store request failed.'); // never include the command: it holds tokens
    return json.result;
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    await this.cmd(ttlSeconds ? ['SET', key, value, 'EX', ttlSeconds] : ['SET', key, value]);
  }
  async get(key: string) {
    return ((await this.cmd(['GET', key])) as string | null) ?? null;
  }
  async take(key: string) {
    return ((await this.cmd(['GETDEL', key])) as string | null) ?? null;
  }
  async del(key: string) {
    await this.cmd(['DEL', key]);
  }
}

let instance: KeyValueStore | undefined;

export function kv(): KeyValueStore {
  instance ??= config.kvRestUrl && config.kvRestToken ? new UpstashStore(config.kvRestUrl, config.kvRestToken) : new MemoryStore();
  return instance;
}

// --- encryption of values that contain Spotify tokens when they leave the process ---

const key32 = () => createHash('sha256').update(config.tokenEncryptionKey ?? '').digest();

/** AES-256-GCM: base64(iv | tag | ciphertext). */
export function seal(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key32(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}

export function open(sealed: string): string | null {
  try {
    const raw = Buffer.from(sealed, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', key32(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  } catch {
    return null; // wrong key or tampered value
  }
}
