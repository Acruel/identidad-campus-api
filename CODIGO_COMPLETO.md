# C?digo completo, archivo por archivo

La arquitectura usa AuthModule para Google OAuth y JWT, UsersModule para las cuentas y PrismaModule para PostgreSQL. La configuraci?n se valida al iniciar. GoogleStrategy adapta el perfil y delega la persistencia en UsersService; JwtStrategy recupera el usuario de las rutas privadas. El modelo h?brido admite Google ID y hash de contrase?a opcionales.

El ?rbol completo, los comandos, el flujo y las pruebas manuales est?n en [DOCUMENTACION.md](DOCUMENTACION.md). Las cinco decisiones est?n en [DECISIONES_TECNICAS.md](DECISIONES_TECNICAS.md). Las comprobaciones realizadas est?n en [VERIFICACION.md](VERIFICACION.md).

Este documento reproduce los archivos de c?digo y configuraci?n, con sus rutas. `package-lock.json` se entrega como archivo generado por npm y no se transcribe aqu? por su tama?o. `node_modules/`, `dist/` y `.tmp/` no forman parte de la entrega.

## 1. `package.json`

Archivo: [package.json](package.json)

```json
{
  "name": "identidad-campus-api",
  "version": "1.0.0",
  "private": true,
  "description": "Trabajo práctico: identidad federada con Google y acceso a una API mediante JWT",
  "engines": { "node": ">=20.19" },
  "scripts": {
    "build": "nest build",
    "start": "node dist/main.js",
    "start:dev": "nest start --watch",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio",
    "postinstall": "prisma generate"
  },
  "dependencies": {
    "@nestjs/common": "^11.1.0",
    "@nestjs/config": "^4.0.2",
    "@nestjs/core": "^11.1.0",
    "@nestjs/jwt": "^11.0.0",
    "@nestjs/passport": "^11.0.5",
    "@nestjs/platform-express": "^11.1.0",
    "@prisma/client": "6.19.0",
    "cookie-parser": "^1.4.7",
    "passport": "^0.7.0",
    "passport-google-oauth20": "^2.0.0",
    "passport-jwt": "^4.0.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.2"
  },
  "overrides": {
    "@prisma/config": {
      "deepmerge-ts": "^8.0.2",
      "effect": "^3.20.0"
    }
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@types/cookie-parser": "^1.4.9",
    "@types/express": "^5.0.0",
    "@types/node": "^22.15.0",
    "@types/passport-google-oauth20": "^2.0.16",
    "@types/passport-jwt": "^4.0.1",
    "prisma": "6.19.0",
    "typescript": "~5.8.3"
  }
}
```

## 2. `.env.example`

Archivo: [.env.example](.env.example)

```dotenv
# Completar con las credenciales de una aplicación OAuth de tipo Web.
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/redirect
# Generar un secreto aleatorio de al menos 32 caracteres.
JWT_SECRET=
DATABASE_URL=postgresql://campus:campus_dev@localhost:5432/identidad_campus?schema=public
# Se aceptan segundos enteros o duraciones: 15m, 1h, 7d.
JWT_EXPIRES_IN=15m
PORT=3000
NODE_ENV=development
```

## 3. `.gitignore`

Archivo: [.gitignore](.gitignore)

```text
node_modules/
dist/
.env
.env.*
!.env.example
*.log
.tmp/
*.zip
```

## 4. `compose.yaml`

Archivo: [compose.yaml](compose.yaml)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: campus
      POSTGRES_PASSWORD: campus_dev
      POSTGRES_DB: identidad_campus
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - campus_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U campus -d identidad_campus"]
      interval: 5s
      timeout: 5s
      retries: 10
volumes:
  campus_data:
```

## 5. `nest-cli.json`

Archivo: [nest-cli.json](nest-cli.json)

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": { "deleteOutDir": true }
}
```

## 6. `tsconfig.json`

Archivo: [tsconfig.json](tsconfig.json)

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "moduleResolution": "node",
    "declaration": true,
    "sourceMap": true,
    "outDir": "./dist",
    "strict": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

## 7. `tsconfig.build.json`

Archivo: [tsconfig.build.json](tsconfig.build.json)

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist"]
}
```

## 8. `prisma/migrations/20261003000000_create_users/migration.sql`

Archivo: [prisma/migrations/20261003000000_create_users/migration.sql](prisma/migrations/20261003000000_create_users/migration.sql)

```sql
-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE', 'LOCAL');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "displayName" VARCHAR(200) NOT NULL,
    "googleId" VARCHAR(255),
    "profilePicture" TEXT,
    "authProvider" "AuthProvider" NOT NULL DEFAULT 'GOOGLE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
```

## 9. `prisma/migrations/20261003010000_add_password_hash/migration.sql`

Archivo: [prisma/migrations/20261003010000_add_password_hash/migration.sql](prisma/migrations/20261003010000_add_password_hash/migration.sql)

```sql
-- Las cuentas federadas no requieren contraseña local.
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
```

## 10. `prisma/migrations/migration_lock.toml`

Archivo: [prisma/migrations/migration_lock.toml](prisma/migrations/migration_lock.toml)

```toml
provider = "postgresql"
```

## 11. `prisma/schema.prisma`

Archivo: [prisma/schema.prisma](prisma/schema.prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum AuthProvider {
  GOOGLE
  LOCAL
}

model User {
  id             String       @id @default(uuid()) @db.Uuid
  email          String       @unique @db.VarChar(320)
  displayName    String       @db.VarChar(200)
  passwordHash   String?      @db.Text
  googleId       String?      @unique @db.VarChar(255)
  profilePicture String?      @db.Text
  authProvider   AuthProvider @default(GOOGLE)
  createdAt      DateTime     @default(now()) @db.Timestamptz(3)
  updatedAt      DateTime     @updatedAt @db.Timestamptz(3)
}
```

## 12. `src/app.module.ts`

Archivo: [src/app.module.ts](src/app.module.ts)

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { validateEnvironment } from './config/environment';
import { UsersModule } from './users/users.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }), AuthModule, UsersModule],
})
export class AppModule {}
```

## 13. `src/auth/auth.controller.ts`

Archivo: [src/auth/auth.controller.ts](src/auth/auth.controller.ts)

```typescript
import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { GoogleAuthGuard } from './guards/google-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  google(): void { /* Passport escribe la redirección antes de ejecutar el handler. */ }

  @Get('google/redirect')
  @Header('Cache-Control', 'no-store')
  @UseGuards(GoogleAuthGuard)
  googleRedirect(@CurrentUser() user: User) {
    return this.auth.issueAccessToken(user);
  }
}
```

## 14. `src/auth/auth.module.ts`

Archivo: [src/auth/auth.module.ts](src/auth/auth.module.ts)

```typescript
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ session: false }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: config.getOrThrow<number>('JWT_EXPIRES_IN'),
          issuer: 'identidad-campus',
          audience: 'identidad-campus-api',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, GoogleStrategy, JwtStrategy],
})
export class AuthModule {}
```

## 15. `src/auth/auth.service.ts`

Archivo: [src/auth/auth.service.ts](src/auth/auth.service.ts)

```typescript
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { PublicUserDto } from '../users/dto/public-user.dto';
import { AccessTokenDto } from './dto/access-token.dto';
import { JwtPayloadDto } from './dto/jwt-payload.dto';

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  async issueAccessToken(user: User): Promise<AccessTokenDto> {
    const payload: JwtPayloadDto = { sub: user.id, email: user.email };
    return { accessToken: await this.jwt.signAsync(payload), user: new PublicUserDto(user) };
  }
}
```

## 16. `src/auth/decorators/current-user.decorator.ts`

Archivo: [src/auth/decorators/current-user.decorator.ts](src/auth/decorators/current-user.decorator.ts)

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@prisma/client';
import { Request } from 'express';

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): User => {
  return context.switchToHttp().getRequest<Request & { user: User }>().user;
});
```

## 17. `src/auth/dto/access-token.dto.ts`

Archivo: [src/auth/dto/access-token.dto.ts](src/auth/dto/access-token.dto.ts)

```typescript
import { PublicUserDto } from '../../users/dto/public-user.dto';

export interface AccessTokenDto {
  accessToken: string;
  user: PublicUserDto;
}
```

## 18. `src/auth/dto/jwt-payload.dto.ts`

Archivo: [src/auth/dto/jwt-payload.dto.ts](src/auth/dto/jwt-payload.dto.ts)

```typescript
export interface JwtPayloadDto {
  sub: string;
  email: string;
}
```

## 19. `src/auth/guards/google-auth.guard.ts`

Archivo: [src/auth/guards/google-auth.guard.ts](src/auth/guards/google-auth.guard.ts)

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {}
```

## 20. `src/auth/guards/jwt-auth.guard.ts`

Archivo: [src/auth/guards/jwt-auth.guard.ts](src/auth/guards/jwt-auth.guard.ts)

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

## 21. `src/auth/oauth/google-state.store.ts`

Archivo: [src/auth/oauth/google-state.store.ts](src/auth/oauth/google-state.store.ts)

```typescript
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
```

## 22. `src/auth/strategies/google.strategy.ts`

Archivo: [src/auth/strategies/google.strategy.ts](src/auth/strategies/google.strategy.ts)

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { UsersService } from '../../users/users.service';
import { GoogleStateStore } from '../oauth/google-state.store';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService, private readonly users: UsersService) {
    super({
      clientID: config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: config.getOrThrow<string>('GOOGLE_CALLBACK_URL'),
      scope: ['profile', 'email'],
      state: true,
      store: new GoogleStateStore(config.get<string>('NODE_ENV') === 'production'),
    });
  }

  async validate(_accessToken: string, _refreshToken: string, profile: Profile) {
    const email = profile.emails?.[0]?.value;
    const claims = profile._json as { email_verified?: boolean; verified_email?: boolean };
    if (!email || !profile.id || !(claims.email_verified === true || claims.verified_email === true)) {
      throw new UnauthorizedException('Google no devolvió una identidad con correo verificado.');
    }
    return this.users.resolveGoogleIdentity({
      email,
      displayName: profile.displayName || email,
      googleId: profile.id,
      profilePicture: profile.photos?.[0]?.value ?? null,
    });
  }
}
```

## 23. `src/auth/strategies/jwt.strategy.ts`

Archivo: [src/auth/strategies/jwt.strategy.ts](src/auth/strategies/jwt.strategy.ts)

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService, private readonly users: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      algorithms: ['HS256'],
      ignoreExpiration: false,
      issuer: 'identidad-campus',
      audience: 'identidad-campus-api',
    });
  }

  async validate(payload: unknown) {
    if (!payload || typeof payload !== 'object') throw new UnauthorizedException('Token inválido.');
    const claims = payload as { sub?: unknown; email?: unknown };
    if (typeof claims.sub !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claims.sub) || typeof claims.email !== 'string') {
      throw new UnauthorizedException('Token inválido.');
    }
    const user = await this.users.findById(claims.sub);
    if (!user) throw new UnauthorizedException('La cuenta asociada al token no existe.');
    return user;
  }
}
```

## 24. `src/config/environment.ts`

Archivo: [src/config/environment.ts](src/config/environment.ts)

```typescript
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
```

## 25. `src/main.ts`

Archivo: [src/main.ts](src/main.ts)

```typescript
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  // El prefijo separa la firma de cookies de los tokens de acceso.
  app.use(cookieParser(`oauth-state:${config.getOrThrow<string>('JWT_SECRET')}`));
  app.enableShutdownHooks();
  await app.listen(config.getOrThrow<number>('PORT'));
}

void bootstrap();
```

## 26. `src/prisma/prisma.module.ts`

Archivo: [src/prisma/prisma.module.ts](src/prisma/prisma.module.ts)

```typescript
import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
```

## 27. `src/prisma/prisma.service.ts`

Archivo: [src/prisma/prisma.service.ts](src/prisma/prisma.service.ts)

```typescript
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService) {
    super({ datasources: { db: { url: config.getOrThrow<string>('DATABASE_URL') } } });
  }

  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}
```

## 28. `src/users/dto/google-identity.dto.ts`

Archivo: [src/users/dto/google-identity.dto.ts](src/users/dto/google-identity.dto.ts)

```typescript
// Objeto interno: proviene de Google, nunca del body enviado por el cliente.
export interface GoogleIdentityDto {
  email: string;
  displayName: string;
  googleId: string;
  profilePicture: string | null;
}
```

## 29. `src/users/dto/public-user.dto.ts`

Archivo: [src/users/dto/public-user.dto.ts](src/users/dto/public-user.dto.ts)

```typescript
import { AuthProvider, User } from '@prisma/client';

export class PublicUserDto {
  id: string;
  email: string;
  displayName: string;
  profilePicture: string | null;
  authProvider: AuthProvider;

  constructor(user: User) {
    this.id = user.id;
    this.email = user.email;
    this.displayName = user.displayName;
    this.profilePicture = user.profilePicture;
    this.authProvider = user.authProvider;
  }
}
```

## 30. `src/users/users.controller.ts`

Archivo: [src/users/users.controller.ts](src/users/users.controller.ts)

```typescript
import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PublicUserDto } from './dto/public-user.dto';

@Controller('users')
export class UsersController {
  @Get('me')
  @Header('Cache-Control', 'no-store')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: User): PublicUserDto {
    return new PublicUserDto(user);
  }
}
```

## 31. `src/users/users.module.ts`

Archivo: [src/users/users.module.ts](src/users/users.module.ts)

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({ imports: [PrismaModule], controllers: [UsersController], providers: [UsersService], exports: [UsersService] })
export class UsersModule {}
```

## 32. `src/users/users.service.ts`

Archivo: [src/users/users.service.ts](src/users/users.service.ts)

```typescript
import { ConflictException, Injectable } from '@nestjs/common';
import { AuthProvider, Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleIdentityDto } from './dto/google-identity.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async resolveGoogleIdentity(identity: GoogleIdentityDto): Promise<User> {
    const email = identity.email.trim().toLowerCase();
    const data = {
      displayName: identity.displayName.trim().slice(0, 200) || email,
      googleId: identity.googleId,
      profilePicture: identity.profilePicture,
    };

    // Una restricción UNIQUE resuelve carreras que una búsqueda previa no evita.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const existing = await this.prisma.user.findUnique({ where: { email } });
        if (!existing) {
          return await this.prisma.user.create({ data: { email, ...data, authProvider: AuthProvider.GOOGLE } });
        }
        if (existing.googleId && existing.googleId !== identity.googleId) {
          throw new ConflictException('El correo ya está vinculado a otra identidad de Google.');
        }
        // La condición impide que dos identidades distintas se vinculen a la vez.
        const updated = await this.prisma.user.updateMany({
          where: { id: existing.id, OR: [{ googleId: null }, { googleId: identity.googleId }] },
          data,
        });
        if (!updated.count) throw new ConflictException('La vinculación de la cuenta cambió; volvé a iniciar sesión.');
        const user = await this.findById(existing.id);
        if (!user) throw new ConflictException('La cuenta dejó de estar disponible.');
        return user;
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
        if (attempt === 2) throw new ConflictException('El correo o la identidad de Google ya están vinculados.');
      }
    }
    throw new ConflictException('No se pudo vincular la cuenta.');
  }
}
```

