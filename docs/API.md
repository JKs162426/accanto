# REST API

All routes live under `/api` (no language prefix) and return JSON. The examples below are real responses from a local server with the seed loaded. Long arrays are cut with `…`.

## Conventions

**Language.** `error.message` and `fieldErrors` use the language from the `x-locale` header (`it` | `en`). Without it, the `NEXT_LOCALE` cookie decides. The default is Italian. `error.code` never changes with the language.

**Authentication.** `POST /api/auth/login` sets the `accanto_session` cookie (httpOnly, 7 days). Send it back on later requests.

| Mark | Meaning                              |
| ---- | ------------------------------------ |
| 🌐   | Public                               |
| 👤   | Signed-in user                       |
| 🛡️   | Admin only                           |
| 🔑   | `Authorization: Bearer $CRON_SECRET` |

**CSRF.** `POST`, `PATCH` and `DELETE` requests from another origin are rejected with `403 BAD_ORIGIN`. Bodies must be `application/json` and at most 64 KB (`413 PAYLOAD_TOO_LARGE`).

**Errors** always have this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the details you entered",
    "details": { "fieldErrors": { "email": ["Invalid email"] } }
  }
}
```

| Status | When                                                                                           |
| ------ | ---------------------------------------------------------------------------------------------- |
| 400    | Validation failed (`VALIDATION_ERROR` with `fieldErrors`) or the JSON is invalid.              |
| 401    | Not signed in (`UNAUTHORIZED`) or wrong credentials (`INVALID_CREDENTIALS`).                   |
| 403    | No permission (`FORBIDDEN`) or cross-origin request (`BAD_ORIGIN`).                            |
| 404    | Not found **or not yours**. Both return the same code, so other users' IDs are never revealed. |
| 409    | Conflict: table taken, booking not cancellable, table number in use…                           |
| 413    | Body larger than 64 KB.                                                                        |
| 422    | Business rule: closed day, time outside opening hours, party too large.                        |
| 429    | Rate limit (`RATE_LIMITED`). See [limits](#rate-limits).                                       |
| 500    | Internal error. The message is generic; details are only logged on the server.                 |
| 503    | `NOT_CONFIGURED`: no restaurant row. Run the seed.                                             |

### Rate limits

| Endpoint           | Limit                                                                  |
| ------------------ | ---------------------------------------------------------------------- |
| Login and register | 10 per account and 20 per IP, per 15 minutes (in memory, per instance) |
| Availability       | 120 per IP per minute (in memory, per instance)                        |
| Create reservation | 10 per user per rolling hour (checked in the database)                 |

---

## Auth

### `POST /api/auth/register` 🌐

Creates a client account and signs it in.

Body: `{ name: string (2–80), email: string, phone?: string | null, password: string (8–72, a letter and a number) }`

Responses: `201 { user }` · `400 VALIDATION_ERROR` · `409 EMAIL_TAKEN` · `429 RATE_LIMITED`

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Origin: http://localhost:3000" -H "Content-Type: application/json" -H "x-locale: en" \
  -d '{"name":"A","email":"bad","password":"x"}'
```

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the details you entered",
    "details": {
      "fieldErrors": {
        "name": ["Enter a name"],
        "email": ["Invalid email"],
        "password": ["At least 8 characters", "Must include at least one number"]
      }
    }
  }
}
```

### `POST /api/auth/login` 🌐

Signs in and sets the session cookie. With `adminOnly: true`, non-admin accounts are rejected (used by the admin login page).

Body: `{ email: string, password: string, adminOnly?: boolean }`

Responses: `200 { user }` · `400 VALIDATION_ERROR` · `401 INVALID_CREDENTIALS` · `403 NOT_ADMIN` (with `adminOnly`) · `429 RATE_LIMITED`

```bash
curl -X POST http://localhost:3000/api/auth/login -c cookies.txt \
  -H "Origin: http://localhost:3000" -H "Content-Type: application/json" \
  -d '{"email":"client1@accanto.local","password":"ClientPass123!"}'
```

```json
{
  "user": {
    "id": "cmwxuw7gc000mupqfp53tfx8w",
    "email": "client1@accanto.local",
    "name": "Giulia Romano",
    "phone": "+39 333 111 2222",
    "role": "CLIENT"
  }
}
```

### `POST /api/auth/logout` 🌐

Clears the session cookie. No body.

Responses: `200 { ok: true }` · `403 BAD_ORIGIN`

```json
{ "ok": true }
```

### `GET /api/auth/me` 🌐

Returns the signed-in user, or `null`.

Responses: `200 { user: User | null }`

```json
{
  "user": {
    "id": "cmwxuw7gc000mupqfp53tfx8w",
    "email": "client1@accanto.local",
    "name": "Giulia Romano",
    "phone": "+39 333 111 2222",
    "role": "CLIENT"
  }
}
```

---

## Availability

### `GET /api/reservations/availability` 🌐

Lists the free time slots for a date. With `time`, it also lists the free tables at that time.

| Query                  | Type                                                  | Notes                                                |
| ---------------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| `date`                 | `YYYY-MM-DD`                                          | Required. Restaurant local date.                     |
| `partySize`            | integer 1–20                                          | Default 2.                                           |
| `time`                 | `HH:mm`                                               | Optional. Adds `tables` to the response.             |
| `preference`           | `INTERIOR` · `TERRACE` · `WINDOW` · `PRIVATE` · `VIP` | Optional.                                            |
| `excludeReservationId` | string                                                | Ignores that booking (used when changing a booking). |

Response fields: `date`, `open`, `slots[]` (`time`, `shift`, `free` tables), `preferenceCapacity` (largest table per preference; `""` is "any"), and `time` + `tables[]` when `time` is given. When the day is closed, past, or beyond the booking window, `open` is `false` and `message` explains why. Public tables never include internal notes.

Responses: `200` · `400 VALIDATION_ERROR` · `429 RATE_LIMITED`

```bash
curl "http://localhost:3000/api/reservations/availability?date=2026-11-29&partySize=2&time=20:00&preference=WINDOW" -H "x-locale: en"
```

```json
{"date":"2026-11-29","preferenceCapacity":{"":8,"INTERIOR":4,"TERRACE":4,"WINDOW":2,"PRIVATE":8,"VIP":2},"open":true,"slots":[{"time":"12:00","shift":"LUNCH","free":1},…,{"time":"21:00","shift":"DINNER","free":2}],"time":"20:00","tables":[{"id":"cmwxuw6w5000jupqfpi4ye6bd","number":11,"capacity":2,"location":"INTERIOR","type":"VIP","isWindow":true,"status":"ACTIVE"},{"id":"cmwxuw6wb000kupqfak7qacgn","number":12,"capacity":2,"location":"INTERIOR","type":"VIP","isWindow":true,"status":"ACTIVE"}]}
```

Closed day (`date=2026-11-30`, a Monday):

```json
{
  "date": "2026-11-30",
  "preferenceCapacity": { "": 8, "INTERIOR": 4, "TERRACE": 4, "WINDOW": 2, "PRIVATE": 8, "VIP": 2 },
  "open": false,
  "slots": [],
  "message": "The restaurant is closed on that day."
}
```

---

## Reservations

A `Reservation` looks like this. `internalNotes` is only sent to admins.

```json
{
  "id": "cmwxuxlbz0000vrqftujyhyob",
  "code": "ACC-T999T5",
  "date": "2026-11-29",
  "time": "20:00",
  "startsAt": "2026-11-29T19:00:00.000Z",
  "endsAt": "2026-11-29T21:00:00.000Z",
  "partySize": 2,
  "status": "CONFIRMED",
  "guestName": "Giulia Romano",
  "guestEmail": "client1@accanto.local",
  "guestPhone": null,
  "notes": "Window seat, please",
  "clientId": "cmwxuw7gc000mupqfp53tfx8w",
  "table": {
    "id": "cmwxuw6w5000jupqfpi4ye6bd",
    "number": 11,
    "capacity": 2,
    "location": "INTERIOR",
    "type": "VIP",
    "isWindow": true
  },
  "createdAt": "2026-11-26T17:59:44.447Z"
}
```

`status` is one of `CONFIRMED`, `ATTENDED`, `NO_SHOW`, `CANCELLED`.

### `GET /api/reservations` 👤

Lists reservations. Clients only see their own. Admins see all.

| Query        | Type                                               |
| ------------ | -------------------------------------------------- |
| `q`          | string: code, guest name, email or phone           |
| `date`       | `YYYY-MM-DD`                                       |
| `from`, `to` | `YYYY-MM-DD`                                       |
| `status`     | `CONFIRMED` · `ATTENDED` · `NO_SHOW` · `CANCELLED` |
| `scope`      | `upcoming` · `past` · `all` (default)              |
| `page`       | integer ≥ 1, default 1                             |

Responses: `200 { items: Reservation[], total, page, pageSize }` (20 per page) · `400` · `401`

```bash
curl "http://localhost:3000/api/reservations?scope=upcoming" -b cookies.txt
```

```json
{"items":[{"id":"cmwxuw7qp000oupqfkdkx1fhq","code":"ACC-R45KUX","date":"2026-11-29","time":"13:00",…},…],"total":…,"page":1,"pageSize":20}
```

### `POST /api/reservations` 👤

Creates a booking and queues the confirmation emails. The request language is saved on the booking and used for its emails. A client's confirmation always goes to the account email.

Body: `{ date: "YYYY-MM-DD", time: "HH:mm", partySize: integer 1–20, tableId: string, guestName: string (2–80), guestEmail: string, guestPhone?: string | null, notes?: string (≤500) | null }`

Admins can also send `clientId?: string | null` and `internalNotes?: string (≤1000) | null`.

Responses: `201 { reservation }` · `400 VALIDATION_ERROR` · `401` · `409 TABLE_TAKEN` · `422` (for example `CLOSED_WEEKDAY`) · `429 RATE_LIMITED`

```bash
curl -X POST http://localhost:3000/api/reservations -b cookies.txt \
  -H "Origin: http://localhost:3000" -H "Content-Type: application/json" -H "x-locale: en" \
  -d '{"date":"2026-11-29","time":"20:00","partySize":2,"tableId":"cmwxuw6w5000jupqfpi4ye6bd","guestName":"Giulia Romano","guestEmail":"client1@accanto.local","notes":"Window seat, please"}'
```

```json
{"reservation":{"id":"cmwxuxlbz0000vrqftujyhyob","code":"ACC-T999T5","date":"2026-11-29","time":"20:00",…,"status":"CONFIRMED",…}}
```

The same request again:

```json
{
  "error": {
    "code": "TABLE_TAKEN",
    "message": "Sorry, someone has just booked that table. Pick another one or change the time."
  }
}
```

### `GET /api/reservations/:id` 👤

Returns one booking. Only the owner or an admin can read it. Admins also get `history[]`.

Responses: `200 { reservation, history? }` · `401` · `404 RESERVATION_NOT_FOUND` (also when the booking belongs to someone else)

```json
{"reservation":{…},"history":[{"id":"cmwxuxlu30005vrqf9g6pm3nb","reservationId":"cmwxuxlbz0000vrqftujyhyob","actorId":"cmwxuw7gc000mupqfp53tfx8w","action":"UPDATED","changes":{"table":{"to":1,"from":11},"partySize":{"to":3,"from":2}},"timestamp":"2026-11-26T17:59:45.099Z","actor":{"name":"Giulia Romano","role":"CLIENT"}},…]}
```

### `PATCH /api/reservations/:id` 👤

Changes a booking. A client can only change `CONFIRMED` bookings that have not started. If the table is no longer free, another one is assigned, preferably in the same area.

Client body: `{ date?, time?, partySize?, notes?, guestPhone? }` (at least one field)

Admin body: also `tableId?: string`, `status?: "CONFIRMED" | "ATTENDED" | "NO_SHOW"`, `internalNotes?: string | null`, `guestName?: string`

Responses: `200 { reservation }` · `400` · `401` · `404` · `409` (`NOT_EDITABLE`, `NOT_EDITABLE_CANCELLED`, `ALREADY_STARTED`, `TABLE_TAKEN`, `NO_AVAILABILITY`) · `422`

```bash
curl -X PATCH http://localhost:3000/api/reservations/cmwxuxlbz0000vrqftujyhyob -b cookies.txt \
  -H "Origin: http://localhost:3000" -H "Content-Type: application/json" \
  -d '{"partySize":3}'
```

```json
{"reservation":{…,"partySize":3,…,"table":{"id":"cmwxuw6s00009upqf12eki2oq","number":1,"capacity":4,"location":"INTERIOR","type":"STANDARD","isWindow":false},…}}
```

### `DELETE /api/reservations/:id` 👤

Cancels a booking. Bookings are never deleted.

Responses: `200 { reservation }` (status `CANCELLED`) · `401` · `404` · `409 NOT_CANCELLABLE` (already cancelled or no longer confirmed) or `ALREADY_STARTED`

```json
{ "error": { "code": "NOT_CANCELLABLE", "message": "This booking can no longer be cancelled." } }
```

---

## Tables 🛡️

A `Table` is `{ id, number, capacity, location: "INTERIOR" | "TERRACE" | "PRIVATE", type: "STANDARD" | "PRIVATE" | "VIP", isWindow, status: "ACTIVE" | "OUT_OF_SERVICE", notes }`.

Non-admins get `403 FORBIDDEN` on every table route.

### `GET /api/tables`

Lists tables with their live state: `liveState` (`FREE`, `OCCUPIED`, `RESERVED_SOON`, `OUT_OF_SERVICE`), `current` and `next` booking.

Responses: `200 { tables }` · `401` · `403`

```json
{"tables":[{"id":"cmwxuw6s00009upqf12eki2oq","number":1,"capacity":4,"location":"INTERIOR","type":"STANDARD","isWindow":false,"status":"ACTIVE","notes":null,"liveState":"FREE","current":null,"next":null},…]}
```

### `POST /api/tables`

Body: `{ number: integer 1–999, capacity: integer 1–30, location, type, isWindow?: boolean, status?, notes?: string (≤300) | null }`

Responses: `201 { table }` · `400` · `409 TABLE_NUMBER_TAKEN`

```bash
curl -X POST http://localhost:3000/api/tables -b admin.txt \
  -H "Origin: http://localhost:3000" -H "Content-Type: application/json" \
  -d '{"number":13,"capacity":6,"location":"TERRACE","type":"STANDARD"}'
```

```json
{
  "table": {
    "id": "cmwxuxsbw000evrqftfl4r36h",
    "number": 13,
    "capacity": 6,
    "location": "TERRACE",
    "type": "STANDARD",
    "isWindow": false,
    "status": "ACTIVE",
    "notes": null
  }
}
```

### `GET /api/tables/:id`

Responses: `200 { table }` · `404 TABLE_NOT_FOUND`

### `PATCH /api/tables/:id`

Any subset of the `POST` fields. `status: "OUT_OF_SERVICE"` removes the table from availability.

Responses: `200 { table }` · `400` · `404` · `409 TABLE_NUMBER_TAKEN`

```json
{
  "table": {
    "id": "cmwxuxsbw000evrqftfl4r36h",
    "number": 13,
    "capacity": 6,
    "location": "TERRACE",
    "type": "STANDARD",
    "isWindow": false,
    "status": "OUT_OF_SERVICE",
    "notes": null
  }
}
```

### `DELETE /api/tables/:id`

Deletes the table, or archives it if it has past bookings.

Responses: `200 { archived: boolean }` · `404` · `409 TABLE_HAS_RESERVATIONS` (it has upcoming bookings)

```json
{
  "error": {
    "code": "TABLE_HAS_RESERVATIONS",
    "message": "This table has 2 upcoming bookings. Reassign or cancel them before deleting it."
  }
}
```

---

## Users

`/api/users/me` is the caller's own profile. Any other ID is admin only.

### `GET /api/users` 🛡️

Lists clients. Query: `q?: string`, `page?: integer`.

Responses: `200 { items, total, page, pageSize }` · `401` · `403`

```json
{
  "items": [
    {
      "id": "cmwxuw7gc000mupqfp53tfx8w",
      "name": "Giulia Romano",
      "email": "client1@accanto.local",
      "phone": "+39 333 111 2222",
      "createdAt": "2026-11-26T17:58:39.804Z",
      "totalReservations": 8,
      "lastVisit": "2026-11-14T20:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20
}
```

### `GET /api/users/me` 👤

Responses: `200 { user }` · `401`

```json
{
  "user": {
    "id": "cmwxuw7gc000mupqfp53tfx8w",
    "email": "client1@accanto.local",
    "name": "Giulia Romano",
    "phone": "+39 333 111 2222",
    "role": "CLIENT",
    "remind24h": true,
    "remind2h": true,
    "createdAt": "2026-11-26T17:58:39.804Z"
  }
}
```

### `PATCH /api/users/me` 👤

Body: `{ name?: string (2–80), phone?: string | null, remind24h?: boolean, remind2h?: boolean }`

Responses: `200 { user }` · `400` · `401`

### `POST /api/users/me/password` 👤

Changes the password and signs out every other session. The current session gets a new token.

Body: `{ currentPassword: string, newPassword: string (8–72, a letter and a number) }`

Responses: `200 { ok: true }` · `400 VALIDATION_ERROR` or `WRONG_PASSWORD` · `401`

```json
{
  "error": {
    "code": "WRONG_PASSWORD",
    "message": "Your current password is incorrect",
    "details": { "fieldErrors": { "currentPassword": ["Your current password is incorrect"] } }
  }
}
```

### `GET /api/users/:id` 🛡️

A client record with `adminNotes` and booking counts per status.

Responses: `200 { user }` · `403` · `404`

```json
{
  "user": {
    "id": "cmwxuw7gc000mupqfp53tfx8w",
    "email": "client1@accanto.local",
    "name": "Giulia Romano",
    "phone": "+39 333 111 2222",
    "role": "CLIENT",
    "adminNotes": "Prefers window tables",
    "createdAt": "2026-11-26T17:58:39.804Z",
    "remind24h": true,
    "remind2h": true,
    "stats": { "CONFIRMED": 4, "ATTENDED": 2, "CANCELLED": 2 }
  }
}
```

### `PATCH /api/users/:id` 🛡️

Body: `{ adminNotes?: string (≤2000) | null, phone?: string | null, name?: string }`

Responses: `200 { user }` · `400` · `403` · `404`

---

## Restaurant

### `GET /api/restaurant` 🌐

Restaurant details, booking rules, `openingHours[]` and `closedDates[]`.

Responses: `200 { restaurant }` · `503 NOT_CONFIGURED`

```json
{"restaurant":{"id":"cmwxuw6qp0000upqfrjjobor7","name":"Accanto",…,"timezone":"Europe/Rome","turnoverMinutes":120,"slotIntervalMinutes":30,"bookingWindowDays":60,"maxPartySize":8,"avgSpendPerGuest":45,"openingHours":[{"dayOfWeek":0,"shift":"LUNCH","opensAt":"12:00","closesAt":"15:00"},…],…}}
```

### `PATCH /api/restaurant` 🛡️

Partial update. `openingHours` **replaces** the whole weekly schedule.

Body (all optional): `name`, `description`, `address`, `phone`, `email`, `timezone` (IANA), `turnoverMinutes` (30–360), `slotIntervalMinutes` (15, 30 or 60), `bookingWindowDays` (1–365), `maxPartySize` (1–30), `avgSpendPerGuest` (0–10000), `openingHours: { dayOfWeek: 0–6, shift: "LUNCH" | "DINNER", opensAt: "HH:mm", closesAt: "HH:mm" }[]` (≤14)

Responses: `200 { restaurant }` · `400` (including `DUPLICATE_SHIFT`) · `403`

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the details you entered",
    "details": { "fieldErrors": { "slotIntervalMinutes": ["Use 15, 30 or 60"] } }
  }
}
```

### `POST /api/restaurant/closed-dates` 🛡️

Body: `{ date: "YYYY-MM-DD", reason?: string (≤200) | null }`

Responses: `201 { closedDate }` · `400` · `403`

```json
{ "closedDate": { "id": "cmwxuy207000fvrqftbw7rcva", "date": "2026-12-25", "reason": "Christmas" } }
```

### `DELETE /api/restaurant/closed-dates?id=…` 🛡️

Responses: `200 { ok: true }` · `403` · `404 DATE_NOT_FOUND`

---

## Reports 🛡️

Both routes take `from` and `to` (`YYYY-MM-DD`). The range can be at most one year.

### `GET /api/reports?from=…&to=…`

Occupancy, revenue, rates, frequent clients and daily series.

Responses: `200` · `400` (`to` before `from`, or range too long) · `403`

```json
{"from":"2026-11-01","to":"2026-11-30","total":10,"byStatus":{"CONFIRMED":2,"ATTENDED":5,"NO_SHOW":1,"CANCELLED":2},"occupancy":0.011437908496732025,"bookedTurns":7,"availableTurns":612,"coversAttended":17,"coversExpected":23,"avgSpendPerGuest":45,"revenueEstimated":765,"revenueProjected":1035,"cancellationRate":0.2,"noShowRate":0.16666666666666666,"frequentClients":[{"key":"cmwxuw7qa000nupqfd3via9yu","name":"Marco Bianchi","email":"client2@accanto.local","clientId":"cmwxuw7qa000nupqfd3via9yu","visits":2,"reservations":4},…],"byDay":[{"label":"2026-11-01","value":0},…],…}
```

### `GET /api/reports/export?from=…&to=…`

CSV download (UTF-8 with BOM, for Excel). Column names are in Italian. Formula-like cells are neutralised.

```
content-type: text/csv; charset=utf-8
content-disposition: attachment; filename="accanto-prenotazioni-2026-11-01_2026-11-30.csv"

codice,data,ora,persone,stato,tavolo,zona,nome,email,telefono,note,note_interne,creata
ACC-RCRKT3,2026-11-12,20:00,2,Presente,11,Interno,Giulia Romano,client1@accanto.local,+39 333 111 2222,,,2026-11-05T19:00:00.000Z
```

---

## Notifications and emails

### `GET /api/notifications` 👤

The latest 15 notifications and the unread count.

Responses: `200 { items, unread }` · `401`

```json
{"items":[{"id":"cmwxuxs8s000dvrqfltea2zvk","userId":"cmwxuw76c000lupqfaoe7b1py","type":"RESERVATION_CANCELLED","subject":"ACC-T999T5","content":"Giulia Romano · 2026-11-29 20:00 · 3 · #1","data":{"code":"ACC-T999T5","date":"2026-11-29","time":"20:00","table":1,"guestName":"Giulia Romano","partySize":3},"href":"/admin/dashboard/reservations/cmwxuxlbz0000vrqftujyhyob","read":false,"createdAt":"2026-11-26T17:59:53.404Z"},…],"unread":…}
```

### `PATCH /api/notifications` 👤

Marks notifications as read. Body: `{ ids?: string[] }`. Without `ids`, all are marked.

Responses: `200 { ok: true }` · `401`

### `GET /api/emails` 🔑

For the cron. Queues due 24 h / 2 h reminders and sends the queue.

Responses: `200 { reminders, delivery }` · `401` (missing or wrong token)

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/emails
```

```json
{ "reminders": { "reminders24h": 0, "reminders2h": 0 }, "delivery": { "sent": 0, "failed": 0 } }
```

### `POST /api/emails` 🛡️

Same as `GET`, started from the admin panel ("Process now").

Responses: `200 { reminders, delivery }` · `401` · `403`
