# Instalación y entorno

## 1. Dependencias

```bash
npm install   # el postinstall ejecuta `prisma generate`
```

El cliente de Prisma se genera en `src/generated/prisma/` (fuera de git). Regenéralo con `npx prisma generate` cada vez que cambie `prisma/schema.prisma`.

## 2. Base de datos

### Opción A: `prisma dev` (sin Docker)

```bash
npm run db:start      # arranca una instancia local llamada "accanto-local"
npx prisma dev ls     # muestra la URL TCP (postgres://postgres:postgres@localhost:PUERTO/template1?sslmode=disable)
```

En `.env.local`:

```env
DATABASE_URL="postgres://postgres:postgres@localhost:51218/template1?sslmode=disable"
DATABASE_POOL_MAX="1"   # prisma dev solo admite una sesión simultánea
```

`npm run db:stop` la detiene; los datos se conservan entre reinicios.

### Opción B: PostgreSQL propio

Basta con cualquier PostgreSQL 14 o superior (Homebrew, Docker, Neon…). Pon su URL en `DATABASE_URL` y no definas `DATABASE_POOL_MAX`.

### Migraciones y datos

```bash
npm run db:migrate   # prisma migrate dev + generate
npm run db:seed      # fixtures; BORRA reservas, mesas, notificaciones y emails
```

Para cambiar el schema, edita `prisma/schema.prisma` y ejecuta `npm run db:migrate -- --name descripcion_del_cambio`. Las migraciones se versionan en `prisma/migrations/`.

## 3. Secretos

```bash
openssl rand -base64 32   # AUTH_SECRET
openssl rand -hex 16      # CRON_SECRET
```

## 4. Emails

| Entorno    | Configuración                                                              |
| ---------- | -------------------------------------------------------------------------- |
| Desarrollo | Nada: se imprimen en la consola de `npm run dev` (📧 …)                    |
| Resend     | `RESEND_API_KEY` y un `EMAIL_FROM` de un dominio verificado                |
| SMTP/Gmail | `EMAIL_HOST=smtp.gmail.com`, `EMAIL_PORT=587`, `EMAIL_USER` y una *app password* de Google |

Para probar los recordatorios en local:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/emails
```

También puedes usar el botón "Procesar ahora" en **Admin → Ajustes**.

## 5. Tests

```bash
npm test
```

- `tests/unit/`: lógica pura (franjas, solapes, zonas horarias, validación, plantillas). No necesita base de datos.
- `tests/integration/`: se ejecuta contra `DATABASE_URL` (con el seed cargado) y verifica que dos peticiones simultáneas no reservan la misma mesa, la propiedad de las reservas, la reasignación de mesa y la cancelación. Limpia lo que crea. Para saltarlo: `SKIP_DB_TESTS=1 npm test`.

## 6. Despliegue (Vercel)

1. Crea la base de datos (Vercel Postgres/Neon o Supabase) y copia la URL con pooling.
2. Configura las variables de entorno en Vercel: `DATABASE_URL`, `AUTH_SECRET`, `APP_URL` (la URL de producción), `CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM` y `ADMIN_NOTIFICATION_EMAIL`.
3. `vercel.json` ya define el build (`npm run vercel-build`, que aplica las migraciones) y un cron diario.
4. Para recordatorios cada 15 minutos, añade en GitHub los secretos `APP_URL` y `CRON_SECRET`; el workflow `.github/workflows/email-cron.yml` hace el resto.
5. Datos demo (opcional, una vez): `DATABASE_URL=<prod> NODE_ENV=production SEED_FORCE=1 npm run db:seed`.

## Problemas habituales

- **`AUTH_SECRET is missing or shorter than 32 characters`**: genera uno con openssl.
- **`El restaurante no está configurado`**: falta ejecutar `npm run db:seed`.
- **Errores de transacción con `prisma dev`**: comprueba que `DATABASE_POOL_MAX="1"`.
- **Los tipos `PageProps`/`LayoutProps` no existen**: ejecuta `npx next typegen`; `next dev` y `next build` también los generan.
