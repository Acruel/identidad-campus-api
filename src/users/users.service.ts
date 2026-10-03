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
