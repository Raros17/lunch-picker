import { ensureAnonymousSession } from "./ensureAnonymousSession";
import { supabase } from "./supabase";

export type RestaurantComment = {
  id: string;
  kakaoPlaceId: string;
  placeName: string;
  userId: string;
  commentText: string;
  createdAt: string;
  updatedAt: string;
  isMine: boolean;
};

type RestaurantCommentRow = {
  id: string;
  kakao_place_id: string;
  place_name: string;
  user_id: string;
  comment_text: string;
  created_at: string;
  updated_at: string;
};

type RestaurantCommentCountRow = {
  kakao_place_id: string;
};

export async function loadRestaurantCommentCounts(
  kakaoPlaceIds: string[],
): Promise<Record<string, number>> {
  await ensureAnonymousSession();

  const uniqueKakaoPlaceIds = [
    ...new Set(
      kakaoPlaceIds
        .map((kakaoPlaceId: string) => kakaoPlaceId.trim())
        .filter((kakaoPlaceId: string) => kakaoPlaceId.length > 0),
    ),
  ];

  if (uniqueKakaoPlaceIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from("restaurant_comments")
    .select("kakao_place_id")
    .in("kakao_place_id", uniqueKakaoPlaceIds);

  if (error) {
    throw error;
  }

  const commentCountMap: Record<string, number> = {};

  ((data ?? []) as RestaurantCommentCountRow[]).forEach(
    (commentRow: RestaurantCommentCountRow) => {
      commentCountMap[commentRow.kakao_place_id] =
        (commentCountMap[commentRow.kakao_place_id] ?? 0) + 1;
    },
  );

  return commentCountMap;
}

export async function loadRestaurantComments(
  kakaoPlaceId: string,
): Promise<RestaurantComment[]> {
  const session = await ensureAnonymousSession();

  const { data, error } = await supabase
    .from("restaurant_comments")
    .select(
      `
        id,
        kakao_place_id,
        place_name,
        user_id,
        comment_text,
        created_at,
        updated_at
      `,
    )
    .eq("kakao_place_id", kakaoPlaceId)
    .order("updated_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return ((data ?? []) as RestaurantCommentRow[]).map(
    (commentRow: RestaurantCommentRow): RestaurantComment => ({
      id: commentRow.id,
      kakaoPlaceId: commentRow.kakao_place_id,
      placeName: commentRow.place_name,
      userId: commentRow.user_id,
      commentText: commentRow.comment_text,
      createdAt: commentRow.created_at,
      updatedAt: commentRow.updated_at,
      isMine: commentRow.user_id === session.user.id,
    }),
  );
}

export async function saveRestaurantComment(
  kakaoPlaceId: string,
  placeName: string,
  commentText: string,
): Promise<void> {
  const session = await ensureAnonymousSession();

  const trimmedCommentText = commentText.trim();

  if (!trimmedCommentText) {
    throw new Error("한줄평을 입력해주세요.");
  }

  if (trimmedCommentText.length > 100) {
    throw new Error("한줄평은 100자까지 입력할 수 있습니다.");
  }

  const { error } = await supabase.from("restaurant_comments").upsert(
    {
      kakao_place_id: kakaoPlaceId,
      place_name: placeName,
      user_id: session.user.id,
      comment_text: trimmedCommentText,
    },
    {
      onConflict: "kakao_place_id,user_id",
    },
  );

  if (error) {
    throw error;
  }
}

export async function deleteRestaurantComment(
  restaurantCommentId: string,
): Promise<void> {
  const session = await ensureAnonymousSession();

  const { error } = await supabase
    .from("restaurant_comments")
    .delete()
    .eq("id", restaurantCommentId)
    .eq("user_id", session.user.id);

  if (error) {
    throw error;
  }
}
