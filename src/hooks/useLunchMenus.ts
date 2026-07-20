import { useCallback, useEffect, useState } from "react";

import type { RealtimeChannel } from "@supabase/supabase-js";

import { ensureAnonymousSession } from "../lib/ensureAnonymousSession";
import { supabase } from "../lib/supabase";

import type { LunchMenu } from "../types";

type LunchMenuRow = {
  id: string;
  name: string;
  weight: number | string;
  is_default: boolean;
};

type UseLunchMenusResult = {
  menus: LunchMenu[];
  isLoading: boolean;
  errorMessage: string;

  addMenu: (menuName: string) => Promise<void>;

  deleteMenu: (menuId: string) => Promise<void>;

  updateMenuWeight: (menuId: string, weight: number) => Promise<void>;

  clearNonDefaultMenus: () => Promise<void>;
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

export function useLunchMenus(): UseLunchMenusResult {
  const [menus, setMenus] = useState<LunchMenu[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadMenus = useCallback(async (): Promise<void> => {
    try {
      await ensureAnonymousSession();

      const { data, error } = await supabase
        .from("lunch_menus")
        .select("id, name, weight, is_default")
        .order("is_default", {
          ascending: false,
        })
        .order("created_at", {
          ascending: true,
        });

      if (error) {
        throw error;
      }

      const nextMenus = ((data ?? []) as LunchMenuRow[]).map(row => ({
        id: row.id,
        name: row.name,
        weight: Number(row.weight),
        isDefault: row.is_default,
      }));

      setMenus(nextMenus);
      setErrorMessage("");
    } catch (error) {
      console.error("점심 메뉴 조회 실패:", error);

      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addMenu = useCallback(
    async (menuName: string): Promise<void> => {
      const session = await ensureAnonymousSession();

      const { error } = await supabase.from("lunch_menus").insert({
        name: menuName.trim(),
        weight: 1,
        is_default: false,
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

  const deleteMenu = useCallback(
    async (menuId: string): Promise<void> => {
      await ensureAnonymousSession();

      const { error } = await supabase
        .from("lunch_menus")
        .delete()
        .eq("id", menuId);

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

    const { error } = await supabase
      .from("lunch_menus")
      .delete()
      .eq("is_default", false);

    if (error) {
      throw error;
    }

    await loadMenus();
  }, [loadMenus]);

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
    isLoading,
    errorMessage,
    addMenu,
    deleteMenu,
    updateMenuWeight,
    clearNonDefaultMenus,
  };
}
