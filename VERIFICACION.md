# Verificación de la entrega

Fecha: 3 de octubre de 2026. Entorno: Windows, Node.js 22.16 y PostgreSQL 16.

## Compilación y esquema

| Comprobación | Resultado |
| --- | --- |
| Instalación de dependencias y `prisma generate` | Correcta |
| `npm run build` | Compilación correcta |
| `prisma validate` | Esquema válido |
| `prisma migrate dev` | Migración inicial y campo `passwordHash` aplicados; esquema sincronizado |
| Resolución de dependencias al instalar | 0 vulnerabilidades informadas por npm |

La entrega incluye pruebas manuales en `DOCUMENTACION.md`. La compilación y la validación del esquema comprueban la consistencia del código, pero no sustituyen el inicio de sesión real.

## Verificación con PostgreSQL real

Se creó un clúster temporal dentro de `.tmp/postgres`, escuchando en `127.0.0.1:55432`, y una base `identidad_campus_test`. No se utilizó ni modificó una base existente. La autenticación trust del clúster estuvo limitada a esta comprobación local temporal; no es la configuración recomendada para ejecutar el proyecto.

Se aplicaron las migraciones de la entrega mediante `prisma migrate dev` y se comprobó:

1. Doce llamadas simultáneas a `UsersService.resolveGoogleIdentity()` con el mismo email crearon una sola fila y devolvieron el mismo UUID.
2. Una fila LOCAL sin Google ID se vinculó conservando UUID y proveedor original, y actualizando su nombre.
3. Intentar vincular otro Google ID a ese correo produjo `409 Conflict`.
4. Insertar directamente otro usuario con el mismo email fue rechazado por PostgreSQL con `P2002`.
5. El campo opcional `passwordHash` permite almacenar un hash local, se conserva al vincular Google y no aparece en el DTO público ni en el token.

El servidor temporal se detuvo al finalizar. `.tmp/` está excluido del repositorio.

## Lo que requiere las credenciales del estudiante

No se inició sesión con una cuenta Google real. La entrega no contiene Client ID ni Client Secret reales. Para completar esa prueba, configurar Google Cloud, completar `.env` y seguir la sección de pruebas manuales de `DOCUMENTACION.md`.

Las comprobaciones de persistencia no verifican la configuración de una aplicación particular de Google, su consentimiento ni sus usuarios de prueba.
