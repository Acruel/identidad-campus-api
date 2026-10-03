import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Request, CookieOptions } from 'express';
import type { Metadata, StateStore, StateStoreStoreCallback, StateStoreVerifyCallback } from 'passport-oauth2';

const COOKIE = 'campus_oauth_state';

// Passport permite un StateStore propio: no necesitamos express-session.
export class GoogleStateStore implements StateStore {
  constructor(private readonly production: boolean) {}

  private options(): CookieOptions {
    return { httpOnly: true, signed: true, secure: this.production, sameSite: 'lax', path: '/auth/google' };
  }

  store(req: Request, callback: StateStoreStoreCallback): void;
  store(req: Request, meta: Metadata, callback: StateStoreStoreCallback): void;
  store(req: Request, metaOrCallback: Metadata | StateStoreStoreCallback, done?: StateStoreStoreCallback): void {
    const callback = typeof metaOrCallback === 'function' ? metaOrCallback : done!;
    if (!req.res) return callback(new Error('No hay respuesta HTTP disponible.'), undefined);
    const state = randomBytes(32).toString('hex');
    req.res.cookie(COOKIE, { state, expiresAt: Date.now() + 300_000 }, { ...this.options(), maxAge: 300_000 });
    callback(null, state);
  }

  verify(req: Request, state: string, callback: StateStoreVerifyCallback): void;
  verify(req: Request, state: string, meta: Metadata, callback: StateStoreVerifyCallback): void;
  verify(req: Request, state: string, metaOrCallback: Metadata | StateStoreVerifyCallback, done?: StateStoreVerifyCallback): void {
    const callback = typeof metaOrCallback === 'function' ? metaOrCallback : done!;
    const saved = req.signedCookies?.[COOKIE] as unknown;
    req.res?.clearCookie(COOKIE, this.options());
    if (!saved || typeof saved !== 'object') return callback(null, false, { message: 'Estado OAuth ausente o alterado.' });
    const stored = saved as { state?: unknown; expiresAt?: unknown };
    if (typeof state !== 'string' || typeof stored.state !== 'string' || typeof stored.expiresAt !== 'number' || stored.expiresAt <= Date.now()) {
      return callback(null, false, { message: 'Estado OAuth inválido o vencido.' });
    }
    const received = Buffer.from(state);
    const expected = Buffer.from(stored.state);
    const valid = received.length === expected.length && timingSafeEqual(received, expected);
    callback(null, valid, valid ? undefined : { message: 'El estado OAuth no coincide.' });
  }
}
