import { notFound } from "next/navigation";

/**
 * Any unknown path under /it or /en renders the localized 404 inside the layout.
 * It always calls notFound(), so there's nothing for instant-navigation
 * validation to check — opt this segment out of it.
 */
export const instant = false;

export default function CatchAll() {
  notFound();
}
