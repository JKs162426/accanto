# API REST

Todas las rutas viven bajo `/api` (sin prefijo de idioma) y responden JSON. Los mensajes (`error.message` y los `fieldErrors`) se devuelven en el idioma de la cabecera `x-locale` (`it` | `en`), o en su defecto en el de la cookie `NEXT_LOCALE`; si no hay ninguno, en italiano. El campo `code` no cambia con el idioma. La autenticación usa la cookie de sesión `accanto_session` (httpOnly), que se obtiene con `POST /api/auth/login`.

**Errores:** siempre con esta forma:

```json
{ "error": { "code": "TABLE_TAKEN", "message": "Texto para mostrar al usuario", "details": { "fieldErrors": { "campo": ["…"] } } } }
```

| Status | Cuándo                                                                              |
| ------ | ----------------------------------------------------------------------------------- |
| 400    | Validación (`VALIDATION_ERROR` con `fieldErrors`), JSON inválido                    |
| 401    | Sin sesión (`UNAUTHORIZED`), credenciales incorrectas                               |
| 403    | Sin permiso (`FORBIDDEN`), petición desde otro origen (`BAD_ORIGIN`)                |
| 404    | No existe **o no es tuyo** (mismo código para no revelar IDs ajenos)                |
| 409    | Conflicto: mesa ocupada, reserva no cancelable, número de mesa repetido…            |
| 422    | Regla de negocio: día cerrado, hora fuera de horario, grupo demasiado grande        |
| 429    | Límite de peticiones (login/registro: 10 cada 15 min por IP; reservas: 10/h por usuario) |
| 500    | Error interno (mensaje genérico; el detalle solo se registra en el servidor)        |

Las peticiones `POST`/`PATCH`/`DELETE` con un `Origin` distinto al del sitio se rechazan (protección CSRF).

Permisos: 🌐 público · 👤 usuario autenticado · 🛡️ solo admin

## Auth

| Método | Ruta                 |    | Body / notas                                                         |
| ------ | -------------------- | -- | -------------------------------------------------------------------- |
| POST   | `/api/auth/register` | 🌐 | `{ name, email, phone?, password }` → `201 { user }` e inicia sesión |
| POST   | `/api/auth/login`    | 🌐 | `{ email, password, adminOnly? }` → `{ user }`                       |
| POST   | `/api/auth/logout`   | 🌐 | Borra la cookie                                                      |
| GET    | `/api/auth/me`       | 🌐 | `{ user \| null }`                                                   |

## Disponibilidad

`GET /api/reservations/availability` 🌐

| Query                  | Descripción                                                   |
| ---------------------- | ------------------------------------------------------------- |
| `date`                 | `YYYY-MM-DD` (hora local del restaurante), obligatorio        |
| `partySize`            | 1–20, por defecto 2                                           |
| `time`                 | `HH:mm`; si se indica, devuelve las mesas libres              |
| `preference`           | `INTERIOR` · `TERRACE` · `WINDOW` · `PRIVATE` · `VIP`         |
| `excludeReservationId` | Ignora esa reserva (para calcular un cambio de horario)       |

```json
{
  "date": "2026-10-08", "open": true,
  "slots": [{ "time": "20:00", "shift": "DINNER", "free": 7 }],
  "time": "20:00",
  "tables": [{ "id": "…", "number": 11, "capacity": 2, "location": "INTERIOR", "type": "VIP", "isWindow": true, "status": "ACTIVE", "notes": null }]
}
```

Si el día está cerrado, la fecha ya pasó o queda fuera del margen de reserva: `open: false` con un `message`.

## Reservas

| Método | Ruta                     |    | Notas                                                                                     |
| ------ | ------------------------ | -- | ----------------------------------------------------------------------------------------- |
| GET    | `/api/reservations`      | 👤 | Cliente: solo las suyas. Admin: todas. Query: `q, date, from, to, status, scope=upcoming\|past\|all, page` → `{ items, total, page, pageSize }` |
| POST   | `/api/reservations`      | 👤 | El idioma de la petición queda guardado en la reserva para sus emails. `{ date, time, partySize, tableId, guestName, guestEmail, guestPhone?, notes? }`. El admin puede añadir `clientId?` e `internalNotes?` → `201 { reservation }` |
| GET    | `/api/reservations/:id`  | 👤 | Propietario o admin. El admin recibe además `history[]`                                   |
| PATCH  | `/api/reservations/:id`  | 👤 | Cliente: `{ date?, time?, partySize?, notes?, guestPhone? }`. Admin: también `tableId?, status? (CONFIRMED\|ATTENDED\|NO_SHOW), internalNotes?, guestName?` |
| DELETE | `/api/reservations/:id`  | 👤 | Cancela; las reservas nunca se borran                                                     |

Un cliente solo puede modificar o cancelar reservas `CONFIRMED` que aún no han empezado. Si al modificarla su mesa deja de estar libre, se asigna automáticamente otra (preferentemente de la misma zona). `internalNotes` nunca se envía a clientes.

## Mesas 🛡️

| Método | Ruta              | Notas                                                                    |
| ------ | ----------------- | ------------------------------------------------------------------------ |
| GET    | `/api/tables`     | Incluye `liveState` (`FREE`, `OCCUPIED`, `RESERVED_SOON`, `OUT_OF_SERVICE`), `current` y `next` |
| POST   | `/api/tables`     | `{ number, capacity, location, type, isWindow?, status?, notes? }`       |
| GET    | `/api/tables/:id` |                                                                          |
| PATCH  | `/api/tables/:id` | Parcial. `status: "OUT_OF_SERVICE"` la saca de la disponibilidad         |
| DELETE | `/api/tables/:id` | `{ archived }`. 409 si tiene reservas futuras; se archiva si tiene historial |

## Usuarios

| Método | Ruta                           |       | Notas                                                    |
| ------ | ------------------------------ | ----- | -------------------------------------------------------- |
| GET    | `/api/users`                   | 🛡️    | Clientes, `?q=&page=`                                    |
| GET    | `/api/users/me`                | 👤    | Perfil propio                                            |
| PATCH  | `/api/users/me`                | 👤    | `{ name?, phone?, remind24h?, remind2h? }`               |
| POST   | `/api/users/me/password`       | 👤    | `{ currentPassword, newPassword }`                       |
| GET    | `/api/users/:id`               | 🛡️    | Ficha con `adminNotes` y estadísticas                    |
| PATCH  | `/api/users/:id`               | 🛡️    | `{ adminNotes?, phone?, name? }`                         |

## Restaurante

| Método | Ruta                                  |    | Notas                                                                 |
| ------ | ------------------------------------- | -- | --------------------------------------------------------------------- |
| GET    | `/api/restaurant`                     | 🌐 | Información, reglas, `openingHours[]` y `closedDates[]`               |
| PATCH  | `/api/restaurant`                     | 🛡️ | Campos parciales. `openingHours` **reemplaza** el horario semanal     |
| POST   | `/api/restaurant/closed-dates`        | 🛡️ | `{ date, reason? }`                                                   |
| DELETE | `/api/restaurant/closed-dates?id=…`   | 🛡️ |                                                                       |

## Reportes 🛡️

| Método | Ruta                                       | Notas                                      |
| ------ | ------------------------------------------ | ------------------------------------------ |
| GET    | `/api/reports?from=YYYY-MM-DD&to=…`        | Ocupación, ingresos, tasas, frecuentes, series |
| GET    | `/api/reports/export?from=…&to=…`          | CSV (UTF-8 con BOM para Excel)             |

## Notificaciones y emails

| Método | Ruta                  |    | Notas                                                                 |
| ------ | --------------------- | -- | --------------------------------------------------------------------- |
| GET    | `/api/notifications`  | 👤 | Últimas 15 y `unread`                                                 |
| PATCH  | `/api/notifications`  | 👤 | `{ ids? }`; sin ids las marca todas como leídas                       |
| GET    | `/api/emails`         | 🔑 | Cron. `Authorization: Bearer $CRON_SECRET`. Encola recordatorios y envía la cola |
| POST   | `/api/emails`         | 🛡️ | Lo mismo, lanzado manualmente desde el panel                          |
