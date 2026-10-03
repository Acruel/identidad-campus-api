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
