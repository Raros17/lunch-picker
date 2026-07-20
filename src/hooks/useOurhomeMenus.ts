import { useCallback, useEffect, useState } from "react";

import { ensureAnonymousSession } from "../lib/ensureAnonymousSession";
import { supabase } from "../lib/supabase";

import type { OurhomeDailyMenu, OurhomeWeeklyMenus } from "../types";

type OurhomeMenuRow = {
  menu_date: string;
  menu_text: string;
  updated_at: string;
};

type UseOurhomeMenusResult = {
  weeklyMenus: OurhomeWeeklyMenus;
  isLoading: boolean;
  errorMessage: string;

  saveWeeklyMenus: (weekMenuTexts: Record<string, string>) => Promise<void>;

  clearMenu: (menuDate: string) => Promise<void>;
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

  return "알 수 없는 오류가 발생했습니다.";
}

export function useOurhomeMenus(): UseOurhomeMenusResult {
  const [weeklyMenus, setWeeklyMenus] = useState<OurhomeWeeklyMenus>({});

  const [isLoading, setIsLoading] = useState(true);

  const [errorMessage, setErrorMessage] = useState("");

  const loadMenus = useCallback(async (): Promise<void> => {
    try {
      await ensureAnonymousSession();

      const { data, error } = await supabase
        .from("ourhome_menus")
        .select("menu_date, menu_text, updated_at")
        .order("menu_date", {
          ascending: true,
        });

      if (error) {
        throw error;
      }

      const nextMenus = (
        (data ?? []) as OurhomeMenuRow[]
      ).reduce<OurhomeWeeklyMenus>((menuMap, row) => {
        const menu: OurhomeDailyMenu = {
          menuDate: row.menu_date,
          menuText: row.menu_text,
          updatedAt: row.updated_at,
        };

        menuMap[row.menu_date] = menu;

        return menuMap;
      }, {});

      setWeeklyMenus(nextMenus);
      setErrorMessage("");
    } catch (error) {
      console.error("아워홈 식단 조회 실패:", error);

      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveWeeklyMenus = useCallback(
    async (weekMenuTexts: Record<string, string>): Promise<void> => {
      const session = await ensureAnonymousSession();

      const menuEntries = Object.entries(weekMenuTexts);

      const rowsToSave = menuEntries
        .filter(([, menuText]) => menuText.trim().length > 0)
        .map(([menuDate, menuText]) => ({
          menu_date: menuDate,
          menu_text: menuText.trim(),
          updated_by: session.user.id,
        }));

      const datesToDelete = menuEntries
        .filter(([, menuText]) => menuText.trim().length === 0)
        .map(([menuDate]) => menuDate);

      if (rowsToSave.length > 0) {
        const { error: saveError } = await supabase
          .from("ourhome_menus")
          .upsert(rowsToSave, {
            onConflict: "menu_date",
          });

        if (saveError) {
          throw saveError;
        }
      }

      if (datesToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from("ourhome_menus")
          .delete()
          .in("menu_date", datesToDelete);

        if (deleteError) {
          throw deleteError;
        }
      }

      await loadMenus();
    },
    [loadMenus],
  );

  const clearMenu = useCallback(
    async (menuDate: string): Promise<void> => {
      await ensureAnonymousSession();

      const { error } = await supabase
        .from("ourhome_menus")
        .delete()
        .eq("menu_date", menuDate);

      if (error) {
        throw error;
      }

      await loadMenus();
    },
    [loadMenus],
  );

  useEffect(() => {
    void loadMenus();

    const channel = supabase
      .channel("ourhome-menu-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ourhome_menus",
        },
        () => {
          void loadMenus();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadMenus]);

  return {
    weeklyMenus,
    isLoading,
    errorMessage,
    saveWeeklyMenus,
    clearMenu,
  };
}
