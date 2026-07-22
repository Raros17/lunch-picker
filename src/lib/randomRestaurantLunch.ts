import { ensureAnonymousSession } from "./ensureAnonymousSession";

import { supabase } from "./supabase";

const RECENT_EATEN_EXCLUSION_DAYS = 14;

export type RandomRestaurantInput = {
  name: string;
  kakaoPlaceId: string;
  kakaoPlaceUrl: string;
};

type RestaurantMenuIdRow = {
  id: string;
};

type RecentlyEatenRestaurantRow = {
  kakao_place_id: string | null;
};

function getRecentEatenCutoff(): string {
  const cutoffDate = new Date();

  cutoffDate.setDate(cutoffDate.getDate() - RECENT_EATEN_EXCLUSION_DAYS);

  return cutoffDate.toISOString();
}

async function findRestaurantMenuId(
  restaurant: RandomRestaurantInput,
): Promise<string | null> {
  const { data: existingPlaceMenu, error: existingPlaceError } = await supabase
    .from("lunch_menus")
    .select("id")
    .eq("kakao_place_id", restaurant.kakaoPlaceId)
    .limit(1)
    .maybeSingle();

  if (existingPlaceError) {
    throw existingPlaceError;
  }

  if (existingPlaceMenu) {
    return (existingPlaceMenu as RestaurantMenuIdRow).id;
  }

  const { data: existingNameMenu, error: existingNameError } = await supabase
    .from("lunch_menus")
    .select("id")
    .ilike("name", restaurant.name)
    .limit(1)
    .maybeSingle();

  if (existingNameError) {
    throw existingNameError;
  }

  return existingNameMenu ? (existingNameMenu as RestaurantMenuIdRow).id : null;
}

export async function loadRecentlyEatenRestaurantPlaceIds(): Promise<string[]> {
  await ensureAnonymousSession();

  const recentEatenCutoff = getRecentEatenCutoff();

  const { data, error } = await supabase
    .from("lunch_menus")
    .select("kakao_place_id")
    .not("kakao_place_id", "is", null)
    .gte("last_eaten_at", recentEatenCutoff);

  if (error) {
    throw error;
  }

  return [
    ...new Set(
      ((data ?? []) as RecentlyEatenRestaurantRow[])
        .map(restaurantRow => restaurantRow.kakao_place_id)
        .filter(
          (kakaoPlaceId): kakaoPlaceId is string =>
            typeof kakaoPlaceId === "string" && kakaoPlaceId.length > 0,
        ),
    ),
  ];
}

export async function confirmRandomRestaurantLunch(
  restaurant: RandomRestaurantInput,
): Promise<void> {
  const session = await ensureAnonymousSession();

  const normalizedRestaurant = {
    name: restaurant.name.trim(),
    kakaoPlaceId: restaurant.kakaoPlaceId.trim(),
    kakaoPlaceUrl: restaurant.kakaoPlaceUrl.trim(),
  };

  if (
    !normalizedRestaurant.name ||
    !normalizedRestaurant.kakaoPlaceId ||
    !normalizedRestaurant.kakaoPlaceUrl
  ) {
    throw new Error("가게 정보를 확인할 수 없습니다.");
  }

  let restaurantMenuId = await findRestaurantMenuId(normalizedRestaurant);

  if (restaurantMenuId) {
    const { error: updateError } = await supabase
      .from("lunch_menus")
      .update({
        name: normalizedRestaurant.name,
        is_active: true,
        weight: 1,
        kakao_place_id: normalizedRestaurant.kakaoPlaceId,
        kakao_place_url: normalizedRestaurant.kakaoPlaceUrl,
      })
      .eq("id", restaurantMenuId);

    if (updateError) {
      throw updateError;
    }
  } else {
    const { data: insertedMenu, error: insertError } = await supabase
      .from("lunch_menus")
      .insert({
        name: normalizedRestaurant.name,
        weight: 1,
        is_default: false,
        is_active: true,
        created_by: session.user.id,
        kakao_place_id: normalizedRestaurant.kakaoPlaceId,
        kakao_place_url: normalizedRestaurant.kakaoPlaceUrl,
      })
      .select("id")
      .single();

    if (insertError) {
      if (insertError.code !== "23505") {
        throw insertError;
      }

      restaurantMenuId = await findRestaurantMenuId(normalizedRestaurant);

      if (!restaurantMenuId) {
        throw insertError;
      }
    } else {
      restaurantMenuId = (insertedMenu as RestaurantMenuIdRow).id;
    }
  }

  if (!restaurantMenuId) {
    throw new Error("오늘 점심으로 등록할 가게를 찾지 못했습니다.");
  }

  const { error: confirmError } = await supabase.rpc(
    "confirm_lunch_and_archive_candidates",
    {
      p_menu_id: restaurantMenuId,
    },
  );

  if (confirmError) {
    throw confirmError;
  }
}
