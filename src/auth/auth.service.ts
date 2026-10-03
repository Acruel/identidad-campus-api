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
