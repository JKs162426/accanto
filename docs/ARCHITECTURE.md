# Arquitectura

## Capas

```
Navegador ──► proxy.ts ──► Page (Server Component) ──► services/* ──► Prisma ──► PostgreSQL
    │                         ▲
    └── fetch ──► app/api/*/route.ts ──┘   (Zod en la entrada, handle() en la salida)
```

- **`services/`** contiene toda la lógica de negocio y es la única capa que habla con la base de datos. Cada función recibe el usuario que actúa y comprueba ella misma el rol o la propiedad, así que la seguridad no depende de la UI ni de la ruta.
- **`lib/scheduling.ts`** es la lógica pura de horarios: franjas, cierres, solapes y selección de mesa. No tiene dependencias, y la usan el servidor, el cliente (para sugerir días abiertos) y los tests.
- **Lectura:** las páginas son Server Components que llaman a los servicios directamente.
- **Escritura:** los formularios cliente llaman a la API REST y después hacen `router.refresh()`. La API REST también es el contrato para otros consumidores (móvil, integraciones).
- **SWR** se usa donde el dato cambia sin que el usuario haga nada: la disponibilidad (polling cada 30 s), el estado de las mesas y las notificaciones del admin.

## Puntos críticos

### Dobles reservas

`reservationService` comprueba la disponibilidad e inserta dentro de una transacción que primero toma un **advisory lock de Postgres por día de servicio** (`pg_advisory_xact_lock(hashtext('booking:<restaurante>:<fecha>'))`). Si dos peticiones intentan reservar la misma mesa a la vez, la segunda espera a que la primera confirme, ve su reserva y recibe un `409 TABLE_TAKEN`.

- El bloqueo es por día y no por mesa porque la reasignación automática puede tocar cualquier mesa del día.
- Una modificación que cambia de fecha bloquea ambos días, en orden, para que no haya interbloqueos.
- El test `tests/integration/reservations.test.ts` lanza dos reservas concurrentes y comprueba que solo una prospera.

**Alternativa considerada:** una restricción `EXCLUDE USING gist (tableId WITH =, tstzrange(startsAt, endsAt) WITH &&)`. Es más fuerte, pero necesita la extensión `btree_gist` y no funciona en la base de datos local de `prisma dev`.

### Zonas horarias

- El cliente elige fecha y hora en la **hora local del restaurante** (`Restaurant.timezone`). Se guardan como `date` (`@db.Date`) y `time` (`"HH:mm"`), que es lo que se muestra.
- Además se guardan `startsAt` y `endsAt` en **UTC**, que es lo que se usa para solapes, recordatorios y ocupación en vivo.
- La conversión (`zonedToUtc` / `utcToZoned` en `lib/helpers.ts`) usa `Intl` y está probada en los cambios de horario de verano.
- "Hoy" siempre se calcula en la zona del restaurante, nunca en la del servidor (Vercel corre en UTC).

### Reglas de horario

- **Franjas:** un turno de 12:00 a 15:00 con 2 h de duración y franjas cada 30 min ofrece 12:00, 12:30 y 13:00. La última franja empieza `cierre − duración` para que la mesa se libere antes de cerrar.
- **Duración:** una reserva bloquea la mesa durante `turnoverMinutes` (el "tiempo mínimo entre reservas" del enunciado). Los intervalos son semiabiertos, así que una reserva de 18:00 a 20:00 y otra a las 20:00 no chocan.
- **Disponibilidad:** solo se ofrecen mesas activas, no archivadas, con capacidad suficiente y que cumplan la preferencia, ordenadas de menor a mayor capacidad (una pareja no ocupa una mesa de 8 si hay una de 2).

### Emails (outbox)

Cada cambio inserta `EmailLog` con estado `PENDING` en la **misma transacción**: si el cambio no se confirma, no se envía ningún email. El envío ocurre en `after()`, tras responder al usuario, y en el cron.

- Cada fila se reclama con un `UPDATE … WHERE attempts = n`, así que dos procesos no envían el mismo email.
- Hay 3 reintentos.
- Los recordatorios se marcan (`reminder24hSentAt` / `reminder2hSentAt`) antes de encolarse, lo que los hace idempotentes.

Se descartó Bull/Redis: en un despliegue serverless añade infraestructura y la tabla de la base de datos ya da durabilidad y trazabilidad (se ve en `EmailLog`).

### Autenticación

- La sesión es un JWT HS256 firmado con `jose` en una cookie `httpOnly`, `SameSite=Lax` y `Secure` en producción, válida 7 días.
- El JWT es solo un puntero: en cada petición se vuelve a leer el usuario de la base de datos (memoizado por petición con `React.cache`), así que borrar un usuario o cambiar su rol tiene efecto inmediato.
- Contraseñas con bcrypt (coste 12). El login compara contra un hash ficticio cuando el email no existe, para que el tiempo de respuesta no revele qué emails están registrados.
- **Sesiones versionadas:** el token lleva `User.sessionVersion`. Al cambiar la contraseña se incrementa, lo que cierra todas las demás sesiones; la actual recibe un token nuevo.
- **CSRF:** cookie `SameSite=Lax` más tres comprobaciones en `proxy.ts` para métodos que modifican datos:
  1. `Sec-Fetch-Site` no puede ser cross-site.
  2. `Origin`, si existe, debe ser el propio.
  3. Si hay cuerpo, debe ser `application/json`, algo que un `<form>` de otro sitio no puede enviar.
- **Logout:** siempre es un POST desde un botón. La página `/logout` pide confirmación, así que un enlace externo no puede cerrar la sesión de nadie.
- **Por qué no NextAuth:** el enunciado permitía "NextAuth.js o JWT con cookies". NextAuth v4 no está pensado para Next 16 ni Cache Components y v5 sigue en beta; con email y contraseña, una sesión propia resulta más pequeña y fácil de auditar.

### Next.js 16 y Cache Components

- `cacheComponents: true`: toda lectura de cookies, parámetros de URL o datos no cacheados va dentro de un `<Suspense>`. Por eso cada página es un *shell* estático (título, navegación) con el contenido dinámico en streaming (`◐ Partial Prerender` en el build).
- La información pública del restaurante (`getCachedRestaurant`) usa `"use cache"` con `cacheTag("restaurant")` y se invalida con `revalidateTag` al guardar los ajustes.
- `middleware.ts` ahora se llama `proxy.ts` (convención de Next 16).
- Los Client Components que usan `usePathname()` en layouts compartidos (enlace activo del menú) están en su propio `<Suspense>`, porque en rutas `[id]` la URL solo se conoce en la petición.

### Seguridad, resumen

- Zod valida en el cliente (feedback inmediato) y en el servidor (autoritativo).
- Se autoriza en el servicio: un 404 idéntico para lo inexistente y lo ajeno, y `internalNotes`/`adminNotes` nunca llegan al cliente.
- **Límites (en memoria, best-effort por instancia):**
  - Login y registro: por cuenta (10 / 15 min) y por IP (20 / 15 min, solo si la plataforma informa la IP; nunca hay un cubo compartido "unknown").
  - Disponibilidad pública: 120 / min por IP.
  - Reservas: por usuario contra la base de datos (global).
- **IP del cliente:** `x-vercel-forwarded-for` → `x-real-ip` → `x-forwarded-for`. En self-hosting, el proxy inverso debe sobrescribir estas cabeceras.
- **Cuerpos:** máximo 64 KB, rechazados con 413 antes de leerse enteros.
- **Respuestas de la API:** llevan `Cache-Control: private, no-store`.
- **Datos públicos:** la API de disponibilidad devuelve mesas sin notas internas (`PublicTableDTO`).
- **Emails:** las reservas de clientes notifican siempre al email de la cuenta, de modo que el formulario no permite escribir a terceros. `EMAIL_RECIPIENT_ALLOWLIST` limita los destinatarios en demos públicas.
- **Redirecciones:** el `?next=` del login se resuelve con `URL` y se exige el mismo origen, lo que bloquea `//evil` y `/\evil`.
- **Errores:** los inesperados devuelven un 500 genérico y el detalle solo se registra en el servidor. Las páginas convierten los 404 de servicio en la página "no encontrado", y `[lang]/error.tsx` muestra un error localizado sin detalles.
- **Cron:** el secreto se compara en tiempo constante (`timingSafeEqual`).
- **Reportes y CSV:** rango máximo de un año.
- **Escapado:** las plantillas de email escapan todas las variables y el CSV neutraliza la inyección de fórmulas.
- **Cabeceras:**
  - CSP estática: sin *nonce*, porque es incompatible con el prerender parcial. Permite `'unsafe-inline'` solo en scripts y estilos; todo lo demás queda limitado a `'self'`, con `frame-ancestors 'none'`, `object-src 'none'` y `form-action 'self'`.
  - HSTS en producción, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` y `Cross-Origin-Opener-Policy`.
- **Credenciales demo:** se muestran en desarrollo o con `DEMO_MODE=true`.
- **Dependencias:** `overrides` en `package.json` fuerzan versiones parcheadas de `mysql2` y `deepmerge-ts` (usadas por la CLI de Prisma). Queda `braces`, en el plugin de ESLint y solo en desarrollo, sin versión corregida publicada.

### Internacionalización (IT / EN)

- **Routing:** se usa un segmento raíz `app/[lang]` con `generateStaticParams` (`it`, `en`), según la guía de i18n de Next 16, así que cada página tiene un shell prerenderizado por idioma. El `proxy.ts` redirige las rutas sin idioma y recuerda la elección en la cookie `NEXT_LOCALE`.
- **Server Components:** leen el idioma con `next/root-params` (`getI18n()` en `src/i18n/server.ts`), sin pasar `lang` por props.
- **Client Components:** usan `useI18n()`. El diccionario se pasa una sola vez desde el layout raíz a `I18nProvider`.
- **`LocaleLink`:** antepone el idioma a las rutas internas. `localePath` es idempotente y nunca prefija `/api`.
- **Errores y validación:** los servicios lanzan `AppError(status, code, params)` sin texto. `handle()` traduce el código al idioma de la petición (`x-locale` → cookie → `it`). Los mensajes de Zod son claves del diccionario, de modo que el mismo schema sirve en cliente y servidor y en ambos idiomas.
- **Datos persistidos:** `Reservation.locale` guarda el idioma en que se reservó, que se usa en los emails al cliente, incluidos recordatorios y cancelaciones hechas desde el panel en otro idioma. `Notification.data` guarda datos estructurados, y la campana compone el texto en el idioma de quien la mira.
- **Bundle:** los componentes cliente importan solo `i18n/config`, `format` y `translate`, que no incluyen diccionarios. El diccionario activo llega por el provider.

## Modelo de datos

```
Restaurant 1─* OpeningHour     (día × turno, "HH:mm")
           1─* ClosedDate
           1─* Table           (soft delete con deletedAt)
           1─* Reservation *─1 Table
User 1─* Reservation           (clientId opcional: reservas telefónicas sin cuenta)
Reservation 1─* ReservationHistory   (acción + diff JSON + actor)
User 1─* Notification          (campana del admin)
EmailLog                       (outbox)
```

Respecto al enunciado:

- `openingHours[]` se modela como tabla `OpeningHour` (un registro por día y turno). Así el admin edita turnos de almuerzo y cena por separado.
- `Reservation` añade `startsAt`/`endsAt` (UTC), datos del invitado, `internalNotes` y las marcas de recordatorio.
- `EmailLog` añade `status`, `attempts`, `template` y `payload` para funcionar como cola.

## Pendiente / v2

- Pagos y señal para grupos, lista de espera, reseñas.
- Tests e2e con Playwright (la carpeta `tests/e2e/` está preparada).
