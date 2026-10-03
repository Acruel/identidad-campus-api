# Decisiones técnicas

## 1. Separar cuentas de autenticación

`UsersService` concentra la búsqueda, creación y actualización de usuarios. `AuthService` recibe una cuenta ya autenticada y emite el JWT. Esto permite agregar otro proveedor o contraseña reutilizando el mismo manejo de usuarios sin convertir AuthService en una función gigante. Los controllers sólo coordinan entradas y respuestas; Prisma vive detrás del servicio de cuentas.

## 2. Usar email único y conservar el ID al vincular Google

La consigna pide reutilizar una cuenta existente del mismo correo. Normalizamos email a minúsculas, buscamos primero y reutilizamos el UUID; `@unique` impide duplicados incluso cuando dos solicitudes crean a la vez. El servicio reintenta una colisión `P2002` y exige que un Google ID vinculado no cambie por otro. `googleId` es opcional y único, por lo que el modelo admite cuentas LOCAL antes de vincular Google. `authProvider` conserva el proveedor de creación.

El modelo híbrido solicitado en la guía incluye también `passwordHash` opcional. Una cuenta Google puede tener ese campo vacío; una cuenta local puede almacenar allí un hash, con `googleId` vacío hasta que se vincule. Al ingresar con Google no se modifica el hash de una cuenta existente. `PublicUserDto` selecciona explícitamente los campos visibles para no exponerlo.

Exigimos email verificado. Al agregar los endpoints de autenticación local será necesario verificar ese correo y aplicar la misma normalización. La vinculación por email cubre el trabajo práctico; en un sistema público agregaríamos confirmación de la cuenta existente, especialmente para correos externos cuya titularidad Google no garantiza permanentemente.

## 3. Usar `sub` como identidad estable del JWT

El `sub` contiene el UUID de nuestra base. A diferencia del email, esa clave no depende de que cambie un dato de contacto. El payload de aplicación sólo agrega `email`; la librería incluye los metadatos de emisión, expiración, emisor y audiencia. No se incluyen el objeto User, el Google ID ni tokens de Google. Se restringe el algoritmo a HS256 y el token expira según configuración. Los datos públicos se obtienen nuevamente de PostgreSQL.

## 4. Mantener GoogleStrategy y JwtStrategy separadas

GoogleStrategy actúa durante el ingreso, transforma el perfil federado y delega en UsersService. JwtStrategy actúa en solicitudes posteriores: extrae el Bearer token, verifica el contexto de firma y obtiene la cuenta por `sub`. Esto permite reemplazar o ampliar el ingreso sin cambiar las rutas privadas. El flujo OAuth incluye un `StateStore` con cookie firmada y vencimiento para evitar callbacks ajenos sin agregar sesiones en memoria.

## 5. Proteger rutas con Guards

`JwtAuthGuard extends AuthGuard('jwt')` bloquea `/users/me` antes de ejecutar el controller si el token falta o es inválido. `GoogleAuthGuard` activa Passport en las dos rutas OAuth. Así no repetimos validaciones de tokens en cada handler y `request.user` sólo se consume después de autenticar. Este trabajo implementa autorización básica para usuarios autenticados; no presenta roles que todavía no existen.

## Mejoras futuras

- **Refresh tokens:** access tokens cortos y renovación con rotación, almacenamiento de hashes y detección de reutilización.
- **Autenticación local:** implementar registro y login aprovechando `passwordHash`, con verificación de email, hashing seguro y vinculación explícita con proveedores.
- **Logout y revocación:** blacklist por identificador de token o una versión de sesión persistida. Actualmente un token sigue vigente hasta expirar, salvo eliminación de la cuenta o rotación del secreto.
- **Roles y permisos:** agregar permisos reales sobre recursos mediante guards especializados.
- **Pruebas automatizadas:** incorporarlas en una ampliación futura; esta entrega documenta pruebas manuales.
- **Actualizar herramientas:** migrar Prisma siguiendo su guía oficial y revisar los avisos de seguridad de las dependencias de desarrollo antes de usar este backend fuera del trabajo práctico.

## Alcance de versiones

NestJS 11 y Prisma 6.19.0 permiten mantener el proyecto CommonJS sencillo. Se entrega un lockfile para reproducibilidad. Prisma 7 y posteriores modifican la configuración de datasource y cliente; una actualización mayor requiere trabajo explícito, no cambiar solamente los números de versión.

`package.json` actualiza mediante `overrides` dos dependencias transitivas de `@prisma/config`: `deepmerge-ts` y `effect`. Estas versiones corregidas eliminan los avisos encontrados sin cambiar la versión mayor de Prisma. Se verificaron la generación del cliente, la validación del esquema y las migraciones con esta resolución. El lockfile conserva las versiones concretas.
