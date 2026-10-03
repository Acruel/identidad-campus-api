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
