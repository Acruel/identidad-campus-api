// Objeto interno: proviene de Google, nunca del body enviado por el cliente.
export interface GoogleIdentityDto {
  email: string;
  displayName: string;
  googleId: string;
  profilePicture: string | null;
}
