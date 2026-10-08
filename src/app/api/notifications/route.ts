import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, parseBody, requireApiUser } from "@/lib/api";
import { db } from "@/lib/db";

/** The caller's latest in-app notifications (used by the admin bell, polled with SWR). */
export const GET = handle(async () => {
  const user = await requireApiUser();
  const [items, unread] = await Promise.all([
    db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    db.notification.count({ where: { userId: user.id, read: false } }),
  ]);
  return NextResponse.json({ items, unread });
});

/** Mark some (ids) or all of the caller's notifications as read. */
export const PATCH = handle(async (request) => {
  const user = await requireApiUser();
  const { ids } = await parseBody(request, z.object({ ids: z.array(z.string()).max(100).optional() }));
  await db.notification.updateMany({
    where: { userId: user.id, read: false, ...(ids ? { id: { in: ids } } : {}) },
    data: { read: true },
  });
  return NextResponse.json({ ok: true });
});
