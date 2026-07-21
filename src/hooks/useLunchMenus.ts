import { useCallback, useEffect, useState } from "react";

import type { RealtimeChannel } from "@supabase/supabase-js";

import { ensureAnonymousSession } from "../lib/ensureAnonymousSession";
import { supabase } from "../lib/supabase";

import type { LunchMenu } from "../types";

const RECENT_EATEN_EXCLUSION_DAYS = 14;
const ARCHIVED_MENU_LIMIT = 10;
const ONE_DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

export type RecentLunchHistoryItem = {
  dateKey: string;
  menuName: string;
};

export type RestaurantMenuInput = {
  name: string;
  kakaoPlaceId: string;
  kakaoPlaceUrl: string;
};

type LunchMenuRow = {
  id: string;
  name: string;
  weight: number | string;
  is_default: boolean;
  is_active: boolean;
  last_eaten_at: string | null;
  eaten_count: number;
  created_at: string;
  kakao_place_id: string | null;
  kakao_place_url: string | null;
};

type LunchHistoryRow = {
  lunch_date: string;
  menu_name: string;
};

type UseLunchMenusResult = {
  menus: LunchMenu[];
  archivedMenus: LunchMenu[];
  recentLunchHistory: RecentLunchHistoryItem[];

  isLoading: boolean;
  errorMessage: string;

  addMenu: (menuName: string) => Promise<void>;

  addRestaurantMenu: (restaurant: RestaurantMenuInput) => Promise<void>;

  deleteMenu: (menuId: string) => Promise<void>;

  restoreMenu: (menuId: string) => Promise<void>;

  deleteArchivedMenu: (menuId: string) => Promise<void>;

  updateMenuWeight: (menuId: string, weight: number) => Promise<void>;

  clearNonDefaultMenus: () => Promise<void>;

  confirmEatenMenu: (menuId: string) => Promise<void>;
};

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "알 수 없는 DB 오류가 발생했습니다.";
}

function convertMenuRow(row: LunchMenuRow): LunchMenu {
  return {
    id: row.id,
    name: row.name,
    weight: Number(row.weight),
    isDefault: row.is_default,
    isActive: row.is_active,
    lastEatenAt: row.last_eaten_at,
    eatenCount: row.eaten_count,
    createdAt: row.created_at,
    kakaoPlaceId: row.kakao_place_id,
    kakaoPlaceUrl: row.kakao_place_url,
  };
}

function getSeoulDateKey(date: Date): string {
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const datePartMap = Object.fromEntries(
    dateParts.map(part => [part.type, part.value]),
  );

  return `${datePartMap.year}-${datePartMap.month}-${datePartMap.day}`;
}

function getRecentDateKeys(): string[] {
  return [0, -1, -2].map(dayOffset =>
    getSeoulDateKey(new Date(Date.now() + dayOffset * ONE_DAY_MILLISECONDS)),
  );
}

function getRecentEatenCutoff(): string {
  const cutoffDate = new Date();

  cutoffDate.setDate(cutoffDate.getDate() - RECENT_EATEN_EXCLUSION_DAYS);

  return cutoffDate.toISOString();
}

export function useLunchMenus(): UseLunchMenusResult {
  const [menus, setMenus] = useState<LunchMenu[]>([]);

  const [archivedMenus, setArchivedMenus] = useState<LunchMenu[]>([]);

  const [recentLunchHistory, setRecentLunchHistory] = useState<
    RecentLunchHistoryItem[]
  >([]);

  const [isLoading, setIsLoading] = useState(true);

  const [errorMessage, setErrorMessage] = useState("");

  const loadActiveMenus = useCallback(async (): Promise<void> => {
    const { data, error } = await supabase
      .from("lunch_menus")
      .select(
        `
          id,
          name,
          weight,
          is_default,
          is_active,
          last_eaten_at,
          eaten_count,
          created_at,
          kakao_place_id,
          kakao_place_url
        `,
      )
      .eq("is_active", true)
      .order("is_default", {
        ascending: false,
      })
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      throw error;
    }

    const nextMenus = ((data ?? []) as LunchMenuRow[]).map(convertMenuRow);

    setMenus(nextMenus);
  }, []);

  const loadArchivedMenus = useCallback(async (): Promise<void> => {
    const recentEatenCutoff = getRecentEatenCutoff();

    const { data, error } = await supabase
      .from("lunch_menus")
      .select(
        `
          id,
          name,
          weight,
          is_default,
          is_active,
          last_eaten_at,
          eaten_count,
          created_at,
          kakao_place_id,
          kakao_place_url
        `,
      )
      .eq("is_active", false)
      .eq("is_default", false)
      .or(`last_eaten_at.is.null,last_eaten_at.lt.${recentEatenCutoff}`)
      .order("updated_at", {
        ascending: false,
      })
      .limit(ARCHIVED_MENU_LIMIT);

    if (error) {
      throw error;
    }

    const nextArchivedMenus = ((data ?? []) as LunchMenuRow[]).map(
      convertMenuRow,
    );

    setArchivedMenus(nextArchivedMenus);
  }, []);

  const loadRecentLunchHistory = useCallback(async (): Promise<void> => {
    const recentDateKeys = getRecentDateKeys();

    const { data, error } = await supabase
      .from("lunch_history")
      .select("lunch_date, menu_name")
      .in("lunch_date", recentDateKeys)
      .order("lunch_date", {
        ascending: false,
      });

    if (error) {
      throw error;
    }

    const nextHistory = ((data ?? []) as LunchHistoryRow[]).map(row => ({
      dateKey: row.lunch_date,
      menuName: row.menu_name,
    }));

    setRecentLunchHistory(nextHistory);
  }, []);

  const loadMenus = useCallback(async (): Promise<void> => {
    try {
      await ensureAnonymousSession();

      await Promise.all([
        loadActiveMenus(),
        loadArchivedMenus(),
        loadRecentLunchHistory(),
      ]);

      setErrorMessage("");
    } catch (error) {
      console.error("점심 메뉴 조회 실패:", error);

      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [loadActiveMenus, loadArchivedMenus, loadRecentLunchHistory]);

  const addMenu = useCallback(
    async (menuName: string): Promise<void> => {
      const session = await ensureAnonymousSession();

      const trimmedMenuName = menuName.trim();

      const { data: existingMenu, error: findError } = await supabase
        .from("lunch_menus")
        .select("id, is_active")
        .ilike("name", trimmedMenuName)
        .limit(1)
        .maybeSingle();

      if (findError) {
        throw findError;
      }

      if (existingMenu) {
        if (existingMenu.is_active) {
          throw new Error("이미 등록된 메뉴입니다.");
        }

        const { error: restoreError } = await supabase
          .from("lunch_menus")
          .update({
            is_active: true,
            weight: 1,
          })
          .eq("id", existingMenu.id);

        if (restoreError) {
          throw restoreError;
        }

        await loadMenus();
        return;
      }

      const { error } = await supabase.from("lunch_menus").insert({
        name: trimmedMenuName,
        weight: 1,
        is_default: false,
        is_active: true,
        created_by: session.user.id,
      });

      if (error) {
        if (error.code === "23505") {
          throw new Error("이미 등록된 메뉴입니다.");
        }

        throw error;
      }

      await loadMenus();
    },
    [loadMenus],
  );

  const addRestaurantMenu = useCallback(
    async (restaurant: RestaurantMenuInput): Promise<void> => {
      const session = await ensureAnonymousSession();

      const restaurantName = restaurant.name.trim();
      const kakaoPlaceId = restaurant.kakaoPlaceId.trim();
      const kakaoPlaceUrl = restaurant.kakaoPlaceUrl.trim();

      if (!restaurantName || !kakaoPlaceId || !kakaoPlaceUrl) {
        throw new Error("가게 정보를 확인할 수 없습니다.");
      }

      const { data: existingPlace, error: placeFindError } = await supabase
        .from("lunch_menus")
        .select("id, is_active")
        .eq("kakao_place_id", kakaoPlaceId)
        .limit(1)
        .maybeSingle();

      if (placeFindError) {
        throw placeFindError;
      }

      let existingMenu = existingPlace;

      if (!existingMenu) {
        const { data: existingNameMenu, error: nameFindError } = await supabase
          .from("lunch_menus")
          .select("id, is_active")
          .ilike("name", restaurantName)
          .limit(1)
          .maybeSingle();

        if (nameFindError) {
          throw nameFindError;
        }

        existingMenu = existingNameMenu;
      }

      if (existingMenu) {
        const { error: updateError } = await supabase
          .from("lunch_menus")
          .update({
            is_active: true,
            weight: 1,
            kakao_place_id: kakaoPlaceId,
            kakao_place_url: kakaoPlaceUrl,
          })
          .eq("id", existingMenu.id);

        if (updateError) {
          throw updateError;
        }

        await loadMenus();
        return;
      }

      const { error } = await supabase.from("lunch_menus").insert({
        name: restaurantName,
        weight: 1,
        is_default: false,
        is_active: true,
        created_by: session.user.id,
        kakao_place_id: kakaoPlaceId,
        kakao_place_url: kakaoPlaceUrl,
      });

      if (error) {
        if (error.code === "23505") {
          throw new Error("이미 등록된 가게입니다.");
        }

        throw error;
      }

      await loadMenus();
    },
    [loadMenus],
  );

  const deleteMenu = useCallback(
    async (menuId: string): Promise<void> => {
      await ensureAnonymousSession();

      const { error } = await supabase.rpc("archive_lunch_menu", {
        p_menu_id: menuId,
      });

      if (error) {
        throw error;
      }

      await loadMenus();
    },
    [loadMenus],
  );

  const restoreMenu = useCallback(
    async (menuId: string): Promise<void> => {
      await ensureAnonymousSession();

      const { error } = await supabase
        .from("lunch_menus")
        .update({
          is_active: true,
          weight: 1,
        })
        .eq("id", menuId)
        .eq("is_default", false);

      if (error) {
        throw error;
      }

      await loadMenus();
    },
    [loadMenus],
  );

  const deleteArchivedMenu = useCallback(
    async (menuId: string): Promise<void> => {
      await ensureAnonymousSession();

      const { error } = await supabase.rpc("delete_archived_lunch_menu", {
        p_menu_id: menuId,
      });

      if (error) {
        throw error;
      }

      await loadMenus();
    },
    [loadMenus],
  );

  const updateMenuWeight = useCallback(
    async (menuId: string, weight: number): Promise<void> => {
      await ensureAnonymousSession();

      const { error } = await supabase
        .from("lunch_menus")
        .update({
          weight,
        })
        .eq("id", menuId);

      if (error) {
        throw error;
      }

      await loadMenus();
    },
    [loadMenus],
  );

  const clearNonDefaultMenus = useCallback(async (): Promise<void> => {
    await ensureAnonymousSession();

    const { error } = await supabase.rpc("archive_all_non_default_lunch_menus");

    if (error) {
      throw error;
    }

    await loadMenus();
  }, [loadMenus]);

  const confirmEatenMenu = useCallback(
    async (menuId: string): Promise<void> => {
      await ensureAnonymousSession();

      const { error } = await supabase.rpc(
        "confirm_lunch_and_archive_candidates",
        {
          p_menu_id: menuId,
        },
      );

      if (error) {
        throw error;
      }

      await loadMenus();
    },
    [loadMenus],
  );

  useEffect(() => {
    let isMounted = true;

    let realtimeChannel: RealtimeChannel | null = null;

    async function initializeLunchMenus() {
      await ensureAnonymousSession();

      if (!isMounted) {
        return;
      }

      await loadMenus();

      if (!isMounted) {
        return;
      }

      realtimeChannel = supabase
        .channel("shared-lunch-data-changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "lunch_menus",
          },
          () => {
            void loadMenus();
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "lunch_history",
          },
          () => {
            void loadMenus();
          },
        )
        .subscribe();
    }

    void initializeLunchMenus().catch((error: unknown) => {
      console.error("점심 메뉴 DB 연결 실패:", error);

      if (isMounted) {
        setIsLoading(false);

        setErrorMessage(getErrorMessage(error));
      }
    });

    return () => {
      isMounted = false;

      if (realtimeChannel) {
        void supabase.removeChannel(realtimeChannel);
      }
    };
  }, [loadMenus]);

  return {
    menus,
    archivedMenus,
    recentLunchHistory,

    isLoading,
    errorMessage,

    addMenu,
    addRestaurantMenu,
    deleteMenu,
    restoreMenu,
    deleteArchivedMenu,
    updateMenuWeight,
    clearNonDefaultMenus,
    confirmEatenMenu,
  };
}
