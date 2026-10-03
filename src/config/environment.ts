const units: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

export function expirationInSeconds(value: string): number {
  const match = /^([1-9]\d*)([smhd]?)$/.exec(value);
  if (!match) throw new Error('JWT_EXPIRES_IN debe ser un entero positivo o una duración como 15m, 1h o 7d.');
  const seconds = Number(match[1]) * (units[match[2]] ?? 1);
  if (!Number.isSafeInteger(seconds)) throw new Error('JWT_EXPIRES_IN está fuera de rango.');
  return seconds;
}

export function validateEnvironment(env: Record<string, unknown>) {
  const config = { ...env };
  for (const name of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL', 'JWT_SECRET', 'DATABASE_URL']) {
    if (typeof config[name] !== 'string' || !(config[name] as string).trim()) {
      throw new Error(`Falta la variable de entorno ${name}. Revisar .env.example.`);
    }
  }
  if ((config.JWT_SECRET as string).length < 32) throw new Error('JWT_SECRET debe tener al menos 32 caracteres.');
  const callback = new URL(config.GOOGLE_CALLBACK_URL as string);
  const database = new URL(config.DATABASE_URL as string);
  if (!['http:', 'https:'].includes(callback.protocol) || callback.pathname !== '/auth/google/redirect' || callback.search || callback.hash) {
    throw new Error('GOOGLE_CALLBACK_URL debe ser una URL HTTP(S) que termine en /auth/google/redirect.');
  }
  if (!['postgres:', 'postgresql:'].includes(database.protocol)) throw new Error('DATABASE_URL debe ser una URL PostgreSQL.');
  config.NODE_ENV = config.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(config.NODE_ENV as string)) throw new Error('NODE_ENV debe ser development, test o production.');
  if (config.NODE_ENV === 'production' && callback.protocol !== 'https:') throw new Error('El callback de producción debe utilizar HTTPS.');
  const port = Number(config.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT debe estar entre 1 y 65535.');
  config.PORT = port;
  config.JWT_EXPIRES_IN = expirationInSeconds(String(config.JWT_EXPIRES_IN ?? '15m'));
  return config;
}
