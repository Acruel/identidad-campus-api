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
