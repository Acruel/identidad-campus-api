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
