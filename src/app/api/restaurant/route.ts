import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { handle, parseBody, requireApiAdmin } from "@/lib/api";
import { RESTAURANT_CACHE_TAG } from "@/lib/constants";
import { restaurantSettingsSchema } from "@/lib/validation";
import { getRestaurant, toRestaurantDTO, updateRestaurant } from "@/services/restaurantService";

/** Public restaurant info and schedule. */
export const GET = handle(async () => {
  return NextResponse.json({ restaurant: toRestaurantDTO(await getRestaurant()) });
});

/** Admin: settings, opening hours (replaces the weekly schedule when sent). */
export const PATCH = handle(async (request) => {
  await requireApiAdmin();
  const input = await parseBody(request, restaurantSettingsSchema);
  const restaurant = await updateRestaurant(input);
  revalidateTag(RESTAURANT_CACHE_TAG, "max");
  return NextResponse.json({ restaurant });
});
