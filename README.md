# Accanto · Sistema de reservas

Sistema de reservas para Accanto, un restaurante italiano en **Turín**. Es bilingüe: **italiano** como idioma principal e **inglés** como alternativa, intercambiables desde el header. Los clientes buscan disponibilidad en tiempo real, reservan mesa y gestionan sus reservas; el equipo administra mesas, horarios, reservas, clientes y reportes desde un panel propio. Incluye notificaciones por email con cola y recordatorios automáticos.

**Stack:** Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · PostgreSQL + Prisma 7 · Zod · Tailwind CSS 4 · SWR · Vitest.

## Inicio rápido

Requisitos: Node.js ≥ 20.9.

```bash
npm install                 # también genera el cliente de Prisma
npm run db:start            # Postgres local sin Docker (prisma dev); copia la URL que imprime
cp .env.example .env.local  # rellena DATABASE_URL, AUTH_SECRET y CRON_SECRET
npm run db:migrate          # aplica las migraciones
npm run db:seed             # carga los datos de prueba
npm run dev                 # http://localhost:3000
```

Con `prisma dev`, pon `DATABASE_POOL_MAX="1"` en `.env.local` (esa base de datos local solo acepta una sesión). Si prefieres tu propio PostgreSQL, usa su URL y omite `db:start`. Hay más detalle en [docs/SETUP.md](docs/SETUP.md).

## Credenciales de prueba

| Rol     | Email                   | Contraseña       |
| ------- | ----------------------- | ---------------- |
| Admin   | `admin@accanto.local`   | `AdminPass123!`  |
| Cliente | `client1@accanto.local` | `ClientPass123!` |
| Cliente | `client2@accanto.local` | `ClientPass123!` |

El panel está en `/it/admin/login` (o `/en/admin/login`). El seed crea:

- **Horario:** de jueves a domingo, almuerzo de 12:00 a 15:00 y cena de 18:00 a 23:00. De lunes a miércoles está cerrado.
- **Duración de cada reserva:** 2 h.
- **12 mesas:**
  - 1–4: interior, 4 plazas.
  - 5–8: terraza, 4 plazas.
  - 9–10: sala privada, 8 plazas.
  - 11–12: VIP junto a la ventana, 2 plazas.
- **16 reservas:** 9 en las próximas semanas y 7 en las dos últimas, con estados presente, no-show y cancelada.

## Idiomas (IT / EN)

- **Rutas:** todas las páginas viven bajo `/it/...` y `/en/...`. La raíz `/` redirige al último idioma elegido (cookie `NEXT_LOCALE`) o, si no hay, a italiano. El selector IT | EN del header (y del sidebar del panel) cambia de idioma sin salir de la página.
- **Textos:** están en `src/i18n/dictionaries/it.ts` (fuente de verdad) y `en.ts`. El inglés está tipado contra el italiano, así que si falta una traducción TypeScript lo marca, y un test comprueba además que no haya claves vacías.
- **API:** los errores llegan traducidos al idioma de la página. El navegador envía `x-locale`, y los servicios lanzan códigos (`TABLE_TAKEN`…) que se traducen en el borde de la API. Las validaciones Zod usan claves (`invalidEmail`), así que el mismo schema sirve para los dos idiomas.
- **Emails:** el cliente los recibe en el idioma en que reservó (`Reservation.locale`). Los avisos al staff van en `ADMIN_EMAIL_LOCALE` (italiano por defecto). Las plantillas HTML solo tienen la estructura; todo el texto sale de los diccionarios.
- **Formatos:** fechas, moneda y porcentajes con `Intl`, en `it-IT` / `en-GB`. La zona horaria del restaurante es `Europe/Rome`.

## Funcionalidades

**Cliente**
- Búsqueda por fecha, número de personas y preferencia (interior, terraza, ventana, privada o VIP). Cada franja horaria indica cuántas mesas quedan libres, y la lista se refresca cada 30 s.
- Reserva en cuatro pasos. La selección vive en la URL, así que sobrevive al login o registro.
- Al confirmar se genera un código único (`ACC-XXXXXX`) y se envía un email de confirmación.
- "Mis reservas" (próximas y pasadas): permite modificar fecha, hora o personas (si la mesa deja de estar libre, se reasigna otra) y cancelar con actualización optimista.
- Perfil con datos personales, preferencias de recordatorio (24 h / 2 h), cambio de contraseña e historial.

**Administración**
- Dashboard con reservas de hoy, la semana y el mes, ocupación en tiempo real, gráficos por hora y por día, estado de cada mesa y notificaciones de nuevas reservas.
- Reservas en lista con búsqueda (código, cliente, email, teléfono), filtros y paginación, o en agenda del día (mesas × horas). Permite crear reservas manuales, cambiar mesa, hora o personas, marcar presente o no-show, añadir notas internas, cancelar y consultar el historial de cambios.
- Mesas: alta, edición y baja (se archivan si tienen historial), marcado como fuera de servicio y estado en vivo.
- Clientes: listado con búsqueda, ficha con estadísticas, historial y notas privadas.
- Ajustes: datos del restaurante, horario semanal por turnos, días cerrados, duración de la reserva, intervalo entre horarios y antelación máxima.
- Reportes: ocupación, ingresos estimados, clientes frecuentes, cancelaciones y no-shows, y exportación a CSV.

**Emails:** confirmación, modificación, cancelación (al cliente y al admin), aviso de nueva reserva al admin y recordatorios a 24 h y 2 h. Ver [Emails](#emails).

## Scripts

| Script                                   | Qué hace                                                      |
| ---------------------------------------- | ------------------------------------------------------------- |
| `npm run dev` / `build` / `start`        | Next.js                                                       |
| `npm test`                               | Vitest: tests unitarios + integración contra la BD si hay `DATABASE_URL` |
| `npm run lint` / `typecheck` / `format`  | ESLint / TypeScript / Prettier                                |
| `npm run db:start` / `db:stop`           | Postgres local con `prisma dev`                               |
| `npm run db:migrate`                     | Crea o aplica migraciones y regenera el cliente               |
| `npm run db:seed`                        | Recarga los fixtures (**borra** reservas y mesas)             |
| `npm run db:reset`                       | Resetea la BD y vuelve a sembrar                              |
| `npm run db:studio`                      | Prisma Studio                                                 |

## Variables de entorno

| Variable                    | Obligatoria | Descripción                                                                |
| --------------------------- | :---------: | -------------------------------------------------------------------------- |
| `DATABASE_URL`              | ✅          | Cadena de conexión de PostgreSQL                                           |
| `DATABASE_URL_UNPOOLED`     |             | Conexión directa para migraciones y seed (Neon/Vercel la crea sola)        |
| `DATABASE_POOL_MAX`         |             | Conexiones por instancia (`1` con `prisma dev`; por defecto 5 en producción) |
| `AUTH_SECRET`               | ✅          | Firma el JWT de sesión, ≥ 32 caracteres (`openssl rand -base64 32`)        |
| `APP_URL`                   | ✅          | URL pública, usada en los enlaces de los emails                            |
| `CRON_SECRET`               | ✅          | Token Bearer de `GET /api/emails` (recordatorios y cola)                   |
| `RESEND_API_KEY`            |             | Si existe, los emails salen por [Resend](https://resend.com)               |
| `EMAIL_HOST` … `EMAIL_PASSWORD` |         | SMTP con Nodemailer (si no hay Resend)                                     |
| `EMAIL_FROM`                |             | Remitente, p. ej. `Accanto <reservas@tudominio.com>`                       |
| `ADMIN_NOTIFICATION_EMAIL`  |             | Destinatarios de los avisos al admin (separados por comas)                 |
| `ADMIN_EMAIL_LOCALE`        |             | Idioma de los avisos al staff: `it` (por defecto) o `en`                   |
| `DEMO_MODE`                 |             | `true` muestra las credenciales demo en producción (demo pública)          |
| `EMAIL_RECIPIENT_ALLOWLIST` |             | Solo envía emails a estas direcciones / `@dominios` (recomendado en demos) |

Sin Resend ni SMTP, los emails se imprimen en la consola del servidor, que es lo práctico en desarrollo.

## Estructura

```
prisma/            schema, migraciones, seed
emails/            plantillas HTML ({{variable}}, {{#bloque}}…{{/bloque}})
src/
  app/
    [lang]/        todas las páginas, por idioma (it | en); layout raíz con <html lang>
      (auth)/      login, register, logout
      (client)/    reserve, my-reservations, profile
      admin/       login, unauthorized, dashboard/*
    api/           API REST (sin prefijo de idioma)
  i18n/            config de idiomas, diccionarios it/en y helpers de traducción
  components/      UI: common, auth, reservations, admin, profile
  hooks/           useAuth, useAvailability, useReservations, useTables, useAsync
  lib/             db, auth, session, validation (Zod), scheduling, email, helpers…
  services/        lógica de negocio (único lugar que habla con la BD)
  types/           DTOs compartidos
  proxy.ts         protección de rutas + comprobación de Origin (antes "middleware")
tests/             unit/ (lógica pura) e integration/ (contra la BD)
docs/              SETUP, API, ARCHITECTURE
```

## Emails

Las emails no se envían dentro de la petición. Cada cambio inserta filas `PENDING` en `EmailLog` dentro de la misma transacción (patrón *outbox*). Después:

1. justo después de responder, `after()` procesa la cola sin bloquear al usuario;
2. `GET /api/emails` (cron) encola los recordatorios pendientes y reintenta los fallidos (hasta 3 veces).

En Vercel Hobby los crons solo pueden ejecutarse una vez al día, así que `vercel.json` trae un cron diario de respaldo. Para que los recordatorios de 2 h funcionen hace falta una ejecución frecuente: el workflow `.github/workflows/email-cron.yml` llama al endpoint cada 15 minutos (requiere los secretos `APP_URL` y `CRON_SECRET` en GitHub).

## Despliegue en Vercel

Producción: Vercel con funciones en `fra1` y Postgres de Neon en Fráncfort, creado desde la integración de Vercel. Los pasos exactos (crear el proyecto, la base de datos, las variables y la siembra inicial) están en [docs/SETUP.md](docs/SETUP.md#6-despliegue-vercel). Después, cada push a `main` despliega y aplica las migraciones pendientes.

**Demo pública o privada:** las credenciales demo solo se muestran con `DEMO_MODE=true`. En producción el seed exige contraseñas propias (`SEED_ADMIN_PASSWORD`, `SEED_CLIENT_PASSWORD`). Con envío real de emails, define `EMAIL_RECIPIENT_ALLOWLIST` para que nadie pueda usar tu dominio para escribir a terceros.

## Cómo extender

- **Reglas de reserva** (duración, franjas, antelación): se configuran en el panel. La lógica está en `src/lib/scheduling.ts`, que es pura y tiene tests.
- **Nuevo tipo de email:** añade el valor a `EmailTemplate` en el schema, crea la plantilla en `emails/` y regístrala en `TEMPLATE_FILES` (`src/lib/email.ts`). Después, encólala desde `emailService`.
- **Nuevo endpoint:** el schema Zod va en `lib/validation.ts`, la lógica en un servicio y la ruta se envuelve en `handle()` con `requireApiUser`/`requireApiAdmin`.
- **Design system:** la guía de marca "Mediterráneo" está en `src/app/globals.css`. Tiene dos capas: la paleta de marca (`--mediterranean-blue`, `--terracotta`, `--olive`…) y los tokens semánticos que usan los componentes (`bg-surface`, `text-primary`, `bg-accent`…). Tipografía: Cormorant Garamond (títulos), Crimson Text (texto) e Inter (interfaz), con la escala `text-h1`…`text-caption`. Algunos colores de marca se oscurecen un paso al usarse como texto pequeño para cumplir WCAG AA; el detalle está comentado en el propio archivo. Tailwind 4 no usa `tailwind.config.ts`: el tema se define con `@theme` en ese CSS.
- **Nuevo idioma:** añade el código a `locales` en `src/i18n/config.ts` y crea `src/i18n/dictionaries/<código>.ts` tipado como `Dictionary`. TypeScript señala cualquier clave que falte.
- **v2:** pagos y señales, lista de espera, reseñas y multi-restaurante (el schema ya tiene `restaurantId` en todas las entidades).

Más detalle en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) y [docs/API.md](docs/API.md).
