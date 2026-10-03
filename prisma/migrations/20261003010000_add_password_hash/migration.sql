-- Las cuentas federadas no requieren contraseña local.
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
