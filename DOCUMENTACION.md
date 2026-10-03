# Google OAuth y JWT: guía para explicar el trabajo práctico

## Qué construimos

Construimos una API llamada **Identidad Campus**. Una persona ingresa con Google, el backend crea o reutiliza su cuenta en PostgreSQL y entrega un JWT propio. Ese token habilita la consulta de `/users/me`.

El proyecto contiene los tres módulos exigidos. La organización agrega una pequeña carpeta de configuración, DTOs para los contratos y un almacén de `state` OAuth mediante cookie firmada. No utiliza repositorios abstractos, CQRS ni otras capas innecesarias para este alcance.

## Relación con la guía del trabajo práctico

La guía «Trabajo Práctico: Autenticación OAuth2 Google en NestJS» organiza la evaluación en cuatro criterios. La implementación sigue ese recorrido y mantiene la separación de responsabilidades elegida para el proyecto:

| Criterio de la guía | Cómo se aborda en esta entrega |
| --- | --- |
| Configuración inicial y OAuth — 25 puntos | `ConfigModule`, `.env.example`, instrucciones de Google Cloud y callback autorizado |
| Estrategia y arquitectura — 30 puntos | GoogleStrategy con Passport, AuthController y AuthService dentro de un módulo; persistencia delegada a UsersService |
| Base de datos y Prisma — 25 puntos | Modelo híbrido con `googleId` y `passwordHash` opcionales, perfil, fechas y email único |
| Seguridad y firma JWT — 20 puntos | JWT propio firmado tras el callback, payload mínimo y ruta privada protegida por JwtAuthGuard |

El flujo desarrollado es registro e inicio de sesión mediante Google. El modelo también puede almacenar cuentas locales con email y hash de contraseña; los endpoints de registro y login local son una ampliación futura. Las pruebas del ingreso se explican de forma manual para la demostración del trabajo.

## OAuth 2.0 explicado de manera sencilla

OAuth 2.0 permite que una aplicación reciba acceso limitado a recursos de otra aplicación con autorización del usuario. En este trabajo usamos el flujo authorization code de Google y su endpoint de perfil para obtener una identidad federada. Pedimos únicamente nombre, correo y fotografía; no permisos sobre Drive ni Gmail.

Google autentica a la persona y permite compartir esos datos. Nuestro backend es el cliente OAuth, el navegador transporta las redirecciones y Google opera los servicios de autorización y perfil. OAuth es un protocolo de autorización; el inicio de sesión se construye sobre el perfil que devuelve Google. OpenID Connect es una capa específica para autenticación sobre OAuth y sería otra alternativa para ampliar el proyecto.

El **authorization code** es un código temporal y de uso único que Google entrega al callback. No es el JWT de nuestra API. Passport lo intercambia desde el backend por un access token de Google usando las credenciales OAuth; después consulta el perfil.

La contraseña se escribe y valida en Google. Nuestro backend recibe el código y los datos autorizados, nunca necesita conocer ni almacenar la contraseña de Google. Las operaciones del flujo se describen en la [documentación oficial de OAuth para servidores web](https://developers.google.com/identity/protocols/oauth2/web-server).

## Flujo completo, en orden

1. El cliente abre `GET /auth/google` desde el navegador.
2. `GoogleAuthGuard` ejecuta la estrategia `google`. Passport genera la URL y NestJS redirige a Google. Se genera además un `state` aleatorio y se guarda en una cookie firmada de cinco minutos.
3. La persona inicia sesión y acepta compartir perfil y email. Si había autorizado antes, Google puede omitir la pantalla de consentimiento.
4. Google redirige al navegador hacia `/auth/google/redirect` con un authorization code y el mismo `state`.
5. Passport verifica que el `state` coincida con la cookie y no haya vencido. Luego intercambia el código con Google mediante una solicitud desde el backend.
6. Google entrega un access token y Passport lo utiliza para obtener el perfil. `GoogleStrategy.validate()` comprueba que haya email verificado y transforma email, nombre, Google ID y fotografía.
7. La estrategia delega en `UsersService.resolveGoogleIdentity()`: primero busca por email en PostgreSQL, reutiliza y actualiza la cuenta si existe, o crea una nueva si no existe.
8. Passport coloca el usuario devuelto en `request.user`. El controller lo pasa a `AuthService.issueAccessToken()`, que genera el JWT de nuestra API y devuelve JSON.
9. El cliente copia ese JWT y lo envía en `Authorization: Bearer TOKEN` para las solicitudes siguientes.
10. En `/users/me`, `JwtAuthGuard` ejecuta `JwtStrategy`: Passport verifica firma, vencimiento, algoritmo, emisor y audiencia. Luego `validate()` obtiene el usuario por `sub` y lo coloca en `request.user` antes de ejecutar el controller.

```mermaid
sequenceDiagram
    participant N as Navegador
    participant A as API NestJS
    participant G as Google
    participant P as PostgreSQL
    N->>A: GET /auth/google
    A-->>N: 302 hacia Google + cookie state
    N->>G: Inicio de sesión y autorización
    G-->>N: Redirección al callback con code y state
    N->>A: GET /auth/google/redirect?code=...&state=...
    A->>A: Verificar state
    A->>G: Intercambiar code y obtener perfil
    G-->>A: Identidad Google
    A->>P: Buscar por email, crear o actualizar
    P-->>A: User
    A-->>N: JSON con JWT propio y datos públicos
    N->>A: GET /users/me + Bearer JWT
    A->>A: Verificar JWT
    A->>P: Buscar por sub
    P-->>A: Usuario actual
    A-->>N: 200 con datos públicos
```

## OAuth vs. JWT

No se reemplazan mutuamente. Google OAuth participa en el ingreso inicial. El JWT mantiene después la autorización de acceso a nuestra API sin guardar una sesión en memoria. Las solicitudes privadas no consultan Google nuevamente.

| Elemento | Quién lo entrega | Para qué se usa |
| --- | --- | --- |
| Authorization code | Google | Intercambio temporal realizado por Passport |
| Access token de Google | Google | Consultar el perfil autorizado |
| JWT `accessToken` de nuestra API | `AuthService` | Acceder a `/users/me` |

El token propio incluye `sub` y `email`, más los metadatos estándar agregados al firmar: `iat`, `exp`, `iss` y `aud`. `sub` contiene el UUID de PostgreSQL, no el Google ID. El token vence por defecto en quince minutos. Su firma usa HS256 y `JWT_SECRET`.

Un JWT firmado no está cifrado: cualquiera que lo tenga puede decodificar su payload. Por eso no incluimos secretos, contraseñas ni objetos completos. Para autorizar se comprueba la firma, no alcanza con decodificarlo.

La API es stateless respecto de las sesiones, pero sí consulta PostgreSQL en cada ruta privada. Esto permite devolver datos actuales y rechazar cuentas eliminadas. El email del token es informativo; el identificador estable utilizado para buscar es `sub`.

## Arquitectura y responsabilidades

**Controller:** recibe solicitudes y entrega respuestas. `AuthController.googleRedirect()` recibe el usuario autenticado y devuelve el resultado del servicio. `UsersController.me()` presenta los datos públicos. Ninguno conoce consultas Prisma.

**Service:** resuelve lógica de la aplicación. `UsersService` normaliza correos, busca cuentas, crea usuarios y actualiza el perfil. `AuthService` sólo emite el JWT y construye la respuesta de autenticación.

**Module:** declara providers, controllers, imports y exports para la inyección de dependencias. `UsersModule` exporta `UsersService`; `AuthModule` lo importa para las estrategias; `PrismaModule` exporta un único `PrismaService` compartido. No se necesita una dependencia circular entre Users y Auth: el guard utiliza la estrategia registrada en Passport.

**Strategy:** define cómo interpretar y validar un mecanismo de autenticación. `GoogleStrategy` adapta el perfil federado y delega su persistencia. `JwtStrategy` valida la identidad asociada a un JWT previamente verificado por Passport. Son dos estrategias diferentes porque reciben entradas y se ejecutan en momentos distintos.

**Guard:** decide si la solicitud puede llegar al controller. `GoogleAuthGuard` activa el flujo OAuth; `JwtAuthGuard`, basado en `AuthGuard('jwt')`, exige un token válido para `/users/me`. El guard aporta autorización básica de acceso autenticado. No implementamos permisos por rol.

**PrismaService:** centraliza el cliente de PostgreSQL, lee la conexión desde `ConfigService`, conecta al iniciar y desconecta al apagar. `UsersService` lo recibe mediante inyección.

**DTO:** define un contrato de datos. `GoogleIdentityDto` es un objeto interno que sólo produce la estrategia; `JwtPayloadDto` define el payload mínimo; `PublicUserDto` selecciona los campos visibles para el cliente. No recibimos bodies de formularios, por lo que no agregamos validadores de entrada que no se utilizan.

**Configuración:** `ConfigModule` carga `.env`. `validateEnvironment()` exige los valores necesarios, valida URL, puerto y secreto, y transforma `JWT_EXPIRES_IN` a segundos. Los demás componentes consultan `ConfigService` en lugar de leer `process.env` directamente.

**Decorador `CurrentUser`:** permite extraer `request.user` de forma tipada. Sólo se utiliza después de un guard de autenticación.

## Modelo y vinculación de cuentas

El esquema se encuentra en `prisma/schema.prisma`.

| Campo | Función |
| --- | --- |
| `id` | UUID de nuestra cuenta, independiente de Google |
| `email` | Correo único, normalizado a minúsculas al ingresar |
| `displayName` | Nombre visible |
| `passwordHash` | Hash de contraseña local opcional, nunca una contraseña en texto plano |
| `googleId` | Identidad Google opcional y única |
| `profilePicture` | URL de fotografía opcional |
| `authProvider` | Proveedor con el que se creó la cuenta: GOOGLE o LOCAL |
| `createdAt` | Fecha de creación |
| `updatedAt` | Última actualización administrada por Prisma |

Una cuenta local puede tener `googleId = null` y `passwordHash` con un hash de contraseña. Una cuenta exclusivamente Google puede tener `passwordHash = null`. Esto permite almacenar los dos tipos de registros en la misma tabla, como solicita la guía. Los endpoints con contraseña todavía no están implementados; para agregarlos será necesario incorporar hashing seguro y verificación del correo. Nunca se guarda una contraseña en texto plano.

Cuando se vincula Google con una cuenta existente, UsersService actualiza los datos del perfil y Google ID, conservando cualquier hash local. `PublicUserDto` no devuelve `passwordHash`, y el JWT tampoco lo contiene.

La primera búsqueda es por email. Por ejemplo, si ya existe una cuenta LOCAL con `alumno@gmail.com`, ingresar con ese correo en Google conserva su `id`, fechas de creación y proveedor original, pero vincula `googleId` y actualiza nombre y fotografía. `authProvider` expresa el origen de la cuenta; un usuario LOCAL con `googleId` vinculado también puede ingresar con Google.

Esto evita que cada método cree una fila distinta para la misma persona. Normalizar el email y compartir esta regla con la futura autenticación local es necesario: `@unique` sobre texto distingue mayúsculas y minúsculas en PostgreSQL. Todas las altas de este backend pasan por la normalización del servicio; una futura alta local deberá hacer lo mismo.

La búsqueda previa sola no evita carreras. Si dos callbacks buscan al mismo tiempo y no encuentran una fila, uno crea el usuario y la restricción UNIQUE impide que el segundo lo duplique. Prisma informa `P2002`; el servicio vuelve a buscar, hasta tres intentos. La actualización incluye una condición que impide reemplazar una identidad Google diferente. Si un Google ID pertenece a otro correo, se responde `409 Conflict` y no se fusionan cuentas silenciosamente.

El email debe venir verificado desde Google. Esta vinculación automática satisface la consigna académica. Para producción, especialmente con correos externos a Gmail o Workspace, sería conveniente exigir confirmación desde la cuenta existente: Google advierte que un correo externo previamente verificado puede haber cambiado de titular. Ver [consideraciones oficiales sobre titularidad del email](https://developers.google.com/identity/sign-in/web/backend-auth).

## Protección del callback OAuth

`GoogleStateStore` implementa la interfaz de Passport para almacenar el estado en una cookie firmada. La cookie contiene un valor aleatorio y una fecha límite; se compara con el `state` devuelto por Google. Evita aceptar un callback perteneciente a un inicio de sesión que otro navegador inició.

Se utiliza `HttpOnly`, `SameSite=Lax`, un path limitado y cinco minutos de vigencia. En producción se exige callback HTTPS y se agrega `Secure`. Al verificar el callback se borra la cookie. No guardamos sesiones OAuth en memoria y no usamos `express-session`.

La firma de cookie usa un prefijo separado del uso del secreto para JWT. La firma protege integridad, no confidencialidad. Sólo se admite un intento OAuth pendiente por navegador: iniciar otro en una segunda pestaña reemplaza el estado anterior. Si un callback falla o pasa el plazo, empezar nuevamente desde `/auth/google`. Esta cookie temporal no es el mecanismo de sesión de nuestra API.

Passport usa por defecto un estado en sesión; este proyecto utiliza su extensión `StateStore` para conservar la protección sin una sesión en memoria. Referencia: [validación del estado en Passport](https://www.passportjs.org/tutorials/google/state/).

## Configuración desde cero

### 1. Crear el proyecto NestJS

Para reconstruirlo en otra carpeta vacía:

```bash
npx @nestjs/cli@11 new identidad-campus-api --package-manager npm --skip-git
cd identidad-campus-api
```

Para ejecutar esta entrega, ya creada, no hay que correr `nest new` encima. Instalar directamente con `npm install` o `npm ci`.

### 2. Instalar dependencias

```bash
npm install @nestjs/config@4 @nestjs/passport@11 @nestjs/jwt@11 passport@0.7 passport-google-oauth20@2 passport-jwt@4 cookie-parser@1 @prisma/client@6.19.0
npm install -D prisma@6.19.0 @types/passport-google-oauth20 @types/passport-jwt @types/cookie-parser @types/express@5
```

Nest genera las dependencias base, TypeScript y herramientas de compilación. El `package.json` entregado es la referencia exacta para scripts y versiones, y `package-lock.json` fija las dependencias transitivas.

Se usa Prisma **6.19.0** de forma explícita con CommonJS. Versiones mayores cambian la configuración y la conexión; no combinar este esquema con una instalación de Prisma sin versión. Ver la [guía oficial de cambios de Prisma 7](https://docs.prisma.io/docs/guides/upgrade-prisma-orm/v7).

### 3. Configurar PostgreSQL

Alternativa simple con Docker Desktop abierto:

```bash
docker compose up -d postgres
docker compose ps
```

`compose.yaml` expone el puerto sólo en localhost y conserva la base en un volumen. El usuario `campus`, la contraseña `campus_dev` y la base `identidad_campus` son valores de desarrollo locales.

Alternativa con instalación local: ingresar a `psql` o pgAdmin como administrador y crear un usuario y una base:

```sql
CREATE ROLE campus WITH LOGIN PASSWORD 'campus_dev' CREATEDB;
CREATE DATABASE identidad_campus OWNER campus;
```

`CREATEDB` permite que `prisma migrate dev` cree su shadow database. Es un privilegio para desarrollo. En un despliegue se utilizarían credenciales y permisos adecuados, y `prisma migrate deploy` para aplicar migraciones ya revisadas.

Si el puerto 5432 está ocupado, usar la instalación existente o cambiar el puerto del compose y de `DATABASE_URL` al mismo valor. No levantar dos servidores sobre el mismo puerto.

### 4. Instalar e inicializar Prisma

La instalación se hizo en el paso de dependencias. En un proyecto nuevo:

```bash
npx prisma init --datasource-provider postgresql
```

Esto crea el esquema y un archivo de entorno. En esta entrega ambos ya existen; no volver a inicializar. Reemplazar el esquema generado por el `schema.prisma` entregado, que contiene `AuthProvider` y `User`.

### 5. Crear credenciales Google

Ingresar en [Google Cloud Console](https://console.cloud.google.com/), crear o seleccionar un proyecto y configurar su aplicación en Google Auth Platform (o la sección OAuth de APIs y servicios según la interfaz).

Completar el nombre de la aplicación y los correos de contacto. Elegir el público adecuado. Si la aplicación externa queda en modo de prueba, agregar la cuenta con la que se hará la demostración entre los usuarios de prueba.

Crear un **cliente OAuth de tipo aplicación web** y registrar como URI de redirección autorizada:

```text
http://localhost:3000/auth/google/redirect
```

Copiar Client ID y Client Secret únicamente a `.env`. El redirect URI debe coincidir exactamente en protocolo, host, puerto y path; una barra adicional o cambiar localhost por 127.0.0.1 puede producir `redirect_uri_mismatch`. No se necesita habilitar Drive, Gmail ni una antigua API de Google+ para obtener este perfil. El registro de cliente y callback está explicado en la [guía oficial de configuración de identidad de Google](https://developers.google.com/identity/openid-connect/openid-connect).

### 6. Crear `.env`

```powershell
Copy-Item .env.example .env
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Editar `.env` y completar:

```dotenv
GOOGLE_CLIENT_ID=REEMPLAZAR_CON_CLIENT_ID
GOOGLE_CLIENT_SECRET=REEMPLAZAR_CON_CLIENT_SECRET
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/redirect
JWT_SECRET=REEMPLAZAR_CON_SECRETO_ALEATORIO_DE_AL_MENOS_32_CARACTERES
DATABASE_URL=postgresql://campus:campus_dev@localhost:5432/identidad_campus?schema=public
JWT_EXPIRES_IN=15m
PORT=3000
NODE_ENV=development
```

Estos son marcadores y credenciales locales de ejemplo, no credenciales Google reales. `.gitignore` excluye `.env`. Un password con caracteres especiales en la URL de PostgreSQL requiere codificación URL.

`JWT_EXPIRES_IN` acepta segundos enteros (`900`) o unidades `s`, `m`, `h`, `d`. La aplicación convierte siempre el valor a segundos, evitando la interpretación ambigua de strings numéricos de algunas librerías JWT.

### 7. Crear y aplicar migraciones

En un proyecto reconstruido desde cero, después de escribir el modelo:

```bash
npx prisma migrate dev --name create_users
npx prisma generate
```

En esta entrega ya están incluidas la migración inicial y la que agrega `passwordHash`; ejecutar:

```bash
npx prisma migrate dev
npx prisma generate
```

Prisma aplica el SQL a PostgreSQL y genera el cliente TypeScript. `npm install` ya ejecuta `prisma generate` mediante `postinstall`, pero repetirlo aquí permite que el cliente refleje cualquier modificación posterior del esquema.

### 8. Iniciar la API

```bash
npm run start:dev
```

La API escucha por defecto en `http://localhost:3000`. Abre `/auth/google` para iniciar el ingreso; no hay una página de inicio en `/`. Los mensajes de NestJS mostrarán los tres endpoints registrados.

Para compilar y ejecutar sin watch:

```bash
npm run build
npm start
```

## Pruebas manuales

1. Iniciar PostgreSQL, aplicar migraciones y ejecutar la API.
2. Abrir `http://localhost:3000/auth/google` desde un navegador con cookies habilitadas.
3. Iniciar sesión con una cuenta habilitada en Google y aceptar los permisos solicitados.
4. El navegador muestra el JSON del callback. Copiar únicamente el valor de `accessToken`.
5. En Postman o Insomnia, crear una solicitud `GET http://localhost:3000/users/me`. Seleccionar Bearer Token y pegar el valor. Alternativamente:

```bash
curl -i http://localhost:3000/users/me -H "Authorization: Bearer PEGAR_TOKEN"
```

En PowerShell usar `curl.exe` si `curl` es un alias. No utilizar el access token de Google: la ruta espera el JWT emitido por esta API.

Ejemplo conceptual del callback:

```json
{
  "accessToken": "JWT_EMITIDO_POR_LA_API",
  "user": {
    "id": "83784a0f-6f13-466d-aab6-e0062a192b19",
    "email": "alumno@gmail.com",
    "displayName": "Alumno",
    "profilePicture": null,
    "authProvider": "GOOGLE"
  }
}
```

El ejemplo es ficticio. `/users/me` devuelve directamente el objeto público del usuario, sin otro token.

| Prueba | Resultado esperado |
| --- | --- |
| Sin header Authorization | `401 Unauthorized` |
| `Bearer falso`, firma alterada o token de otra API | `401 Unauthorized` |
| Token vencido | `401 Unauthorized`; volver a ingresar con Google |
| Token válido y usuario existente | `200 OK` con datos actuales |
| Token válido cuya cuenta fue eliminada | `401 Unauthorized` |
| Callback con código pero sin cookie/state válido | `401 Unauthorized`, no se emite JWT |
| Email vinculado a otro Google ID | `409 Conflict`, no se reemplaza la vinculación |

### Comprobar que no se duplican cuentas

Ingresar dos veces con la misma cuenta. Abrir Prisma Studio:

```bash
npx prisma studio
```

En la tabla `User` debe haber una sola fila para ese email y el mismo UUID en ambas respuestas. Nombre, fotografía y `updatedAt` pueden cambiar al actualizar el perfil. También puede verificarse mediante SQL:

```sql
SELECT email, count(*) FROM "User" GROUP BY email HAVING count(*) > 1;
```

Debe devolver cero filas. La restricción única de PostgreSQL sostiene esta garantía frente a callbacks simultáneos.

Para demostrar la reutilización de una cuenta local, crear en Studio una fila con correo en minúsculas que pertenezca a la cuenta Google de prueba, `authProvider = LOCAL`, `googleId = null` y un nombre. Luego ingresar con esa cuenta Google: el UUID debe conservarse. Esta es una preparación de datos para la exposición, no un endpoint local de registro implementado.

### Errores habituales

- `redirect_uri_mismatch`: revisar que `.env` y Google tengan exactamente el mismo callback.
- Acceso bloqueado en modo prueba: revisar audiencia y usuarios habilitados en Google.
- Estado inválido: iniciar otra vez desde `/auth/google`, utilizar el mismo navegador y host, y no borrar cookies en medio del flujo.
- Error de conexión Prisma: comprobar que PostgreSQL esté disponible y que `DATABASE_URL` coincida con usuario, puerto y base.
- Error de shadow database: el usuario de desarrollo debe poder crear bases o debe configurarse una shadow database dedicada.
- Error de variable faltante: completar `.env` y reiniciar; la validación ocurre al arrancar.
- `npm.ps1` bloqueado: ejecutar `npm.cmd` y `npx.cmd`, sin cambiar políticas del sistema.

## Compilación y alcance de la verificación

```bash
npm run build
npx prisma validate
```

Estos comandos comprueban que el código TypeScript compile y que el esquema Prisma sea válido. Las migraciones deben aplicarse además sobre PostgreSQL. Para demostrar el flujo completo, seguir las pruebas manuales con credenciales Google reales. `VERIFICACION.md` registra el alcance de las comprobaciones de esta entrega.

## Árbol de archivos de la entrega

Se omiten `node_modules/`, `dist/` y `.tmp/`, que son dependencias, compilación y recursos temporales de verificación.

```text
identidad-campus-api/
├── .env.example
├── .gitignore
├── compose.yaml
├── package.json
├── package-lock.json
├── nest-cli.json
├── tsconfig.json
├── tsconfig.build.json
├── README.md
├── DOCUMENTACION.md
├── DECISIONES_TECNICAS.md
├── CODIGO_COMPLETO.md
├── VERIFICACION.md
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│       ├── migration_lock.toml
│       ├── 20261003000000_create_users/
│       │   └── migration.sql
│       └── 20261003010000_add_password_hash/
│           └── migration.sql
└── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── config/
│   │   └── environment.ts
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   └── dto/
│   │       ├── google-identity.dto.ts
│   │       └── public-user.dto.ts
│   └── auth/
│       ├── auth.module.ts
│       ├── auth.controller.ts
│       ├── auth.service.ts
│       ├── decorators/
│       │   └── current-user.decorator.ts
│       ├── dto/
│       │   ├── access-token.dto.ts
│       │   └── jwt-payload.dto.ts
│       ├── guards/
│       │   ├── google-auth.guard.ts
│       │   └── jwt-auth.guard.ts
│       ├── oauth/
│       │   └── google-state.store.ts
│       └── strategies/
│           ├── google.strategy.ts
│           └── jwt.strategy.ts
```

## Guion breve para la exposición oral

“Google verifica al usuario y nos permite consultar su perfil mediante OAuth. Passport se encarga de las redirecciones y del intercambio del código. Nuestra estrategia adapta la identidad y UsersService busca primero por correo para conservar una sola cuenta. PostgreSQL refuerza esa regla con un índice único. Después AuthService firma un JWT con el UUID de nuestra cuenta. Para consultar el perfil, el cliente envía ese JWT como Bearer; el guard ejecuta JwtStrategy, valida el token y recupera el usuario actual. Así separo el ingreso federado de Google del acceso posterior a mi API.”

Como respaldo técnico del uso de guards y estrategias separados, consultar la [documentación oficial de Passport en NestJS](https://docs.nestjs.com/recipes/passport).
