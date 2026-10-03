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
