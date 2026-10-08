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

1. **Proyecto:** `vercel link --yes --project accanto` crea el proyecto y lo conecta al repo de GitHub. A partir de ahí, cada push a `main` despliega en producción.
2. **Base de datos (Neon, Fráncfort):**
   ```bash
   vercel integration add neon --plan free_v3 -m region=fra1 -m auth=false -e production --no-env-pull
   ```
   Así se crean `DATABASE_URL` (con pooler) y `DATABASE_URL_UNPOOLED` (directa, para migraciones). `--no-env-pull` evita que la CLI sobrescriba tu `.env.local`. Las funciones están fijadas en `fra1` en `vercel.json`, junto a la base de datos.
3. **Variables:**
   - Secretos: `AUTH_SECRET` y `CRON_SECRET`, con `--sensitive`.
   - Email: `EMAIL_FROM`, `RESEND_API_KEY`, `ADMIN_NOTIFICATION_EMAIL` y `EMAIL_RECIPIENT_ALLOWLIST`.
   - `APP_URL` es opcional: en Vercel se usa el dominio de producción del proyecto.
4. **Migrar y sembrar (una vez, antes del primer build):** el build prerenderiza la landing y necesita los datos del restaurante.
   ```bash
   vercel env pull /ruta/fuera/del/repo/prod.env --environment=production
   # exporta DATABASE_URL y DATABASE_URL_UNPOOLED de ese archivo, y luego:
   npx prisma migrate deploy
   NODE_ENV=production SEED_FORCE=1 SEED_ADMIN_PASSWORD=... SEED_CLIENT_PASSWORD=... npx tsx prisma/seed.ts
   ```
   En producción, el seed exige contraseñas propias: las de desarrollo son públicas, porque están en el repo.
5. **Desplegar:** haz `git push` a `main`. El build (`npm run vercel-build`) aplica las migraciones pendientes antes de `next build`.
6. **Recordatorios cada 15 min (opcional):** en Vercel Hobby los crons solo pueden ser diarios. Añade los secretos `APP_URL` y `CRON_SECRET` en GitHub para el workflow `.github/workflows/email-cron.yml`.

## Problemas habituales

- **`AUTH_SECRET is missing or shorter than 32 characters`**: genera uno con openssl.
- **`El restaurante no está configurado`**: falta ejecutar `npm run db:seed`.
- **Errores de transacción con `prisma dev`**: comprueba que `DATABASE_POOL_MAX="1"`.
- **Los tipos `PageProps`/`LayoutProps` no existen**: ejecuta `npx next typegen`; `next dev` y `next build` también los generan.
