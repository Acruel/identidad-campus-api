import { PublicUserDto } from '../../users/dto/public-user.dto';

export interface AccessTokenDto {
  accessToken: string;
  user: PublicUserDto;
}
