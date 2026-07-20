import { useCallback, useEffect, useState } from "react";

import type { RealtimeChannel } from "@supabase/supabase-js";

import { ensureAnonymousSession } from "../lib/ensureAnonymousSession";
import { supabase } from "../lib/supabase";

import type { LunchMenu } from "../types";

const RECENT_EATEN_EXCLUSION_DAYS = 14;
const ARCHIVED_MENU_LIMIT = 10;

type LunchMenuRow = {
  id: string;
  name: string;
  weight: number | string;
  is_default: boolean;
  is_active: boolean;
  last_eaten_at: string | null;
  eaten_count: number;
  created_at: string;
};

type UseLunchMenusResult = {
  menus: LunchMenu[];
  archivedMenus: LunchMenu[];

  isLoading: boolean;
  errorMessage: string;

  addMenu: (menuName: string) => Promise<void>;

  deleteMenu: (menuId: string) => Promise<void>;

  restoreMenu: (menuId: string) => Promise<void>;

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
  };
}

function getRecentEatenCutoff(): string {
  const cutoffDate = new Date();

  cutoffDate.setDate(cutoffDate.getDate() - RECENT_EATEN_EXCLUSION_DAYS);

  return cutoffDate.toISOString();
}

export function useLunchMenus(): UseLunchMenusResult {
  const [menus, setMenus] = useState<LunchMenu[]>([]);

  const [archivedMenus, setArchivedMenus] = useState<LunchMenu[]>([]);

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
          created_at
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
          created_at
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

  const loadMenus = useCallback(async (): Promise<void> => {
    try {
      await ensureAnonymousSession();

      await Promise.all([loadActiveMenus(), loadArchivedMenus()]);

      setErrorMessage("");
    } catch (error) {
      console.error("점심 메뉴 조회 실패:", error);

      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [loadActiveMenus, loadArchivedMenus]);

  const addMenu = useCallback(
    async (menuName: string): Promise<void> => {
      const session = await ensureAnonymousSession();

      const trimmedMenuName = menuName.trim();

      /*
       * 과거 메뉴에 같은 이름이 있으면
       * 새로 만들지 않고 복원한다.
       */
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

  /*
   * 기존 deleteMenu라는 이름은 유지하지만
   * 실제로는 DB에서 삭제하지 않고 숨긴다.
   */
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

  /*
   * 전체 비우기도 완전 삭제가 아니라
   * 일반 메뉴를 모두 과거 메뉴로 이동한다.
   */
  const clearNonDefaultMenus = useCallback(async (): Promise<void> => {
    await ensureAnonymousSession();

    const { error } = await supabase.rpc("archive_all_non_default_lunch_menus");

    if (error) {
      throw error;
    }

    await loadMenus();
  }, [loadMenus]);

  /*
   * 추첨 결과에서 실제로 먹기로 정했을 때 호출.
   * 최근 먹은 날짜와 누적 횟수를 기록한다.
   */
  const confirmEatenMenu = useCallback(
    async (menuId: string): Promise<void> => {
      await ensureAnonymousSession();

      const selectedMenu = menus.find(menu => menu.id === menuId);

      if (!selectedMenu) {
        throw new Error("선택한 메뉴를 찾을 수 없습니다.");
      }

      const nextEatenCount = (selectedMenu.eatenCount ?? 0) + 1;

      const { error } = await supabase
        .from("lunch_menus")
        .update({
          last_eaten_at: new Date().toISOString(),

          eaten_count: nextEatenCount,
        })
        .eq("id", menuId);

      if (error) {
        throw error;
      }

      await loadMenus();
    },
    [loadMenus, menus],
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
        .channel("shared-lunch-menu-changes")
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

    isLoading,
    errorMessage,

    addMenu,
    deleteMenu,
    restoreMenu,
    updateMenuWeight,
    clearNonDefaultMenus,
    confirmEatenMenu,
  };
}
