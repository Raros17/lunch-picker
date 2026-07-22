import { useEffect, useMemo, useState } from "react";

import type { KeyboardEvent } from "react";

import { useLunchMenus } from "./useLunchMenus";
import { useOurhomeMenus } from "./useOurhomeMenus";

import { loadRestaurantCommentCounts } from "../lib/restaurantComments";

import { drawLunchMenu } from "../utils/drawLunch";

import { buildRecentLunchCards, getTodayDateKey } from "../utils/lunchDate";

import type { ArchivedMenuPanelProps } from "../components/lunch/ArchivedMenuPanel";

import type { LunchCandidatePanelProps } from "../components/lunch/LunchCandidatePanel";

import type { LunchDrawResultProps } from "../components/lunch/LunchDrawResult";

import type {
  LunchDrawResult,
  LunchMenu,
  OurhomeDailyMenu,
  OurhomeWeeklyMenus,
} from "../types";

import type {
  RecentLunchCard,
  RecentLunchHistoryItem,
} from "../utils/lunchDate";

export type UseLunchPickerPageResult = {
  recentLunchCards: RecentLunchCard[];
  registeredMenuCount: number;
  activeMenuCount: number;

  candidatePanelProps: LunchCandidatePanelProps;

  drawResultProps: LunchDrawResultProps;

  archivedMenuPanelProps: ArchivedMenuPanelProps;

  addRestaurantToMenu: (
    restaurantName: string,
    kakaoPlaceId: string,
    kakaoPlaceUrl: string,
  ) => Promise<void>;
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

export function useLunchPickerPage(): UseLunchPickerPageResult {
  const {
    menus,
    archivedMenus,
    recentLunchHistory,
    isLoading,
    errorMessage,

    addMenu: addMenuToDatabase,

    addRestaurantMenu: addRestaurantMenuToDatabase,

    deleteMenu: deleteMenuFromDatabase,

    restoreMenu: restoreMenuToDatabase,

    deleteArchivedMenu: deleteArchivedMenuFromDatabase,

    updateMenuWeight: updateMenuWeightInDatabase,

    clearNonDefaultMenus,
    confirmEatenMenu,
  } = useLunchMenus();

  const {
    weeklyMenus: rawOurhomeWeeklyMenus,

    isLoading: isOurhomeLoading,

    errorMessage: ourhomeErrorMessage,

    saveWeeklyMenus: saveOurhomeWeeklyMenus,

    clearMenu: clearOurhomeMenu,
  } = useOurhomeMenus();

  const typedMenus = menus as LunchMenu[];

  const typedArchivedMenus = archivedMenus as LunchMenu[];

  const typedRecentLunchHistory =
    recentLunchHistory as RecentLunchHistoryItem[];

  const ourhomeWeeklyMenus = rawOurhomeWeeklyMenus as OurhomeWeeklyMenus;

  const [newMenuName, setNewMenuName] = useState("");

  const [drawResult, setDrawResult] = useState<LunchDrawResult | null>(null);

  const [message, setMessage] = useState("");

  const [resultMessage, setResultMessage] = useState("");

  const [isSaving, setIsSaving] = useState(false);

  const [confirmingMenuId, setConfirmingMenuId] = useState<string | null>(null);

  const [restoringMenuId, setRestoringMenuId] = useState<string | null>(null);

  const [deletingArchivedMenuId, setDeletingArchivedMenuId] = useState<
    string | null
  >(null);

  const [restaurantCommentCounts, setRestaurantCommentCounts] = useState<
    Record<string, number>
  >({});

  const todayDateKey = getTodayDateKey();

  const ourhomeDailyMenu: OurhomeDailyMenu | null =
    ourhomeWeeklyMenus[todayDateKey] ?? null;

  const recentLunchCards = useMemo(
    () => buildRecentLunchCards(typedRecentLunchHistory),
    [typedRecentLunchHistory],
  );

  const activeMenuCount = useMemo(
    () => typedMenus.filter(menu => menu.weight > 0).length,
    [typedMenus],
  );

  const hasDeletableMenu = useMemo(
    () => typedMenus.some(menu => !menu.isDefault),
    [typedMenus],
  );

  const sortedResultMenus = useMemo(() => {
    if (!drawResult) {
      return [];
    }

    return [...typedMenus].sort((firstMenu, secondMenu) => {
      const firstCount = drawResult.counts[firstMenu.id] ?? 0;

      const secondCount = drawResult.counts[secondMenu.id] ?? 0;

      return secondCount - firstCount;
    });
  }, [drawResult, typedMenus]);

  useEffect(() => {
    const restaurantPlaceIds = [...typedMenus, ...typedArchivedMenus]
      .map(menu => menu.kakaoPlaceId)
      .filter(
        (kakaoPlaceId: string | null | undefined): kakaoPlaceId is string =>
          typeof kakaoPlaceId === "string" && kakaoPlaceId.length > 0,
      );

    if (restaurantPlaceIds.length === 0) {
      setRestaurantCommentCounts({});

      return;
    }

    let isCancelled = false;

    const loadCommentCounts = async (): Promise<void> => {
      try {
        const nextCommentCounts =
          await loadRestaurantCommentCounts(restaurantPlaceIds);

        if (!isCancelled) {
          setRestaurantCommentCounts(nextCommentCounts);
        }
      } catch (error) {
        console.error("후보 식당 한줄평 개수 조회 실패:", error);
      }
    };

    void loadCommentCounts();

    return () => {
      isCancelled = true;
    };
  }, [typedMenus, typedArchivedMenus]);

  const clearCurrentDraw = () => {
    setDrawResult(null);
    setResultMessage("");
  };

  const addMenu = async (): Promise<void> => {
    const trimmedMenuName = newMenuName.trim();

    if (!trimmedMenuName) {
      setMessage("메뉴 이름을 입력해주세요.");

      return;
    }

    const alreadyExists = typedMenus.some(
      menu => menu.name.toLowerCase() === trimmedMenuName.toLowerCase(),
    );

    if (alreadyExists) {
      setMessage("이미 등록된 메뉴입니다.");

      return;
    }

    try {
      setIsSaving(true);
      setMessage("");

      await addMenuToDatabase(trimmedMenuName);

      setNewMenuName("");

      clearCurrentDraw();

      setMessage(`${trimmedMenuName} 메뉴를 공유 목록에 추가했습니다.`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const deleteMenu = async (
    menuId: string,
    isDefault: boolean,
  ): Promise<void> => {
    if (isDefault) {
      setMessage("아워홈은 기본 메뉴라서 숨길 수 없습니다.");

      return;
    }

    try {
      await deleteMenuFromDatabase(menuId);

      clearCurrentDraw();

      setMessage("메뉴를 과거 메뉴 목록으로 이동했습니다.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  };

  const restoreMenu = async (
    menuId: string,
    menuName: string,
  ): Promise<void> => {
    try {
      setRestoringMenuId(menuId);

      setMessage("");

      await restoreMenuToDatabase(menuId);

      clearCurrentDraw();

      setMessage(`${menuName} 메뉴를 다시 점심 후보에 추가했습니다.`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setRestoringMenuId(null);
    }
  };

  const deleteArchivedMenu = async (
    menuId: string,
    menuName: string,
  ): Promise<void> => {
    const shouldDelete = window.confirm(
      `${menuName} 메뉴를 과거 목록에서도 완전히 삭제할까요?`,
    );

    if (!shouldDelete) {
      return;
    }

    try {
      setDeletingArchivedMenuId(menuId);

      setMessage("");

      await deleteArchivedMenuFromDatabase(menuId);

      clearCurrentDraw();

      setMessage(`${menuName} 메뉴를 완전히 삭제했습니다.`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setDeletingArchivedMenuId(null);
    }
  };

  const updateMenuWeight = async (
    menuId: string,
    weight: number,
  ): Promise<void> => {
    try {
      await updateMenuWeightInDatabase(menuId, weight);

      clearCurrentDraw();

      setMessage("");
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  };

  const clearAllMenus = async (): Promise<void> => {
    const shouldClear = window.confirm(
      "아워홈을 제외한 모든 공유 메뉴를 과거 메뉴 목록으로 옮길까요?",
    );

    if (!shouldClear) {
      return;
    }

    try {
      await clearNonDefaultMenus();

      clearCurrentDraw();

      setNewMenuName("");

      setMessage("아워홈을 제외한 메뉴를 모두 과거 메뉴로 옮겼습니다.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  };

  const handleSaveOurhomeWeeklyMenus = async (
    weekMenuTexts: Record<string, string>,
  ): Promise<void> => {
    try {
      await saveOurhomeWeeklyMenus(weekMenuTexts);

      clearCurrentDraw();

      setMessage("이번 주 아워홈 식단을 저장했습니다.");
    } catch (error) {
      console.error("아워홈 식단 저장 실패:", error);

      throw error;
    }
  };

  const handleClearOurhomeDailyMenu = async (): Promise<void> => {
    const shouldClear = window.confirm("오늘 등록한 아워홈 식단을 비울까요?");

    if (!shouldClear) {
      return;
    }

    try {
      await clearOurhomeMenu(todayDateKey);

      clearCurrentDraw();

      setMessage("오늘 아워홈 식단을 비웠습니다.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "아워홈 식단 삭제에 실패했습니다.",
      );
    }
  };

  const drawLunch = () => {
    try {
      const result = drawLunchMenu(typedMenus, 10, 3);

      setDrawResult(result);
      setResultMessage("");
      setMessage("");
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  };

  const confirmMenuDirectly = async (
    menuId: string,
    menuName: string,
  ): Promise<void> => {
    const shouldConfirm = window.confirm(
      `${menuName}을 오늘 점심으로 결정할까요?\n현재 후보는 모두 비워지고 나머지는 과거 메뉴로 이동합니다.`,
    );

    if (!shouldConfirm) {
      return;
    }

    try {
      setConfirmingMenuId(menuId);

      setMessage("");
      setResultMessage("");

      await confirmEatenMenu(menuId);

      clearCurrentDraw();

      setMessage(
        `${menuName}을 오늘 점심으로 기록했습니다. 나머지 후보는 과거 메뉴로 옮겼습니다.`,
      );
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setConfirmingMenuId(null);
    }
  };

  const confirmSelectedMenu = async (): Promise<void> => {
    if (!drawResult) {
      return;
    }

    const selectedMenu = drawResult.selectedMenu;

    try {
      setConfirmingMenuId(selectedMenu.id);

      setResultMessage("");

      await confirmEatenMenu(selectedMenu.id);

      clearCurrentDraw();

      setMessage(
        `${selectedMenu.name}을 오늘 점심으로 기록했습니다. 나머지 후보는 과거 메뉴로 옮겼습니다.`,
      );
    } catch (error) {
      setResultMessage(getErrorMessage(error));
    } finally {
      setConfirmingMenuId(null);
    }
  };

  const addRestaurantToMenu = async (
    restaurantName: string,

    kakaoPlaceId: string,

    kakaoPlaceUrl: string,
  ): Promise<void> => {
    await addRestaurantMenuToDatabase({
      name: restaurantName,

      kakaoPlaceId,
      kakaoPlaceUrl,
    });

    clearCurrentDraw();

    setMessage(`${restaurantName}을 점심 후보에 추가했습니다.`);
  };

  const handleMenuInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !isSaving) {
      void addMenu();
    }
  };

  const updateRestaurantCommentCount = (
    kakaoPlaceId: string,
    nextCommentCount: number,
  ) => {
    setRestaurantCommentCounts(previousCommentCounts => ({
      ...previousCommentCounts,

      [kakaoPlaceId]: nextCommentCount,
    }));
  };

  return {
    recentLunchCards,

    registeredMenuCount: typedMenus.length,

    activeMenuCount,

    candidatePanelProps: {
      menus: typedMenus,

      newMenuName,
      isSaving,
      isLoading,
      errorMessage,
      message,
      activeMenuCount,
      hasDeletableMenu,
      confirmingMenuId,
      ourhomeDailyMenu,
      ourhomeWeeklyMenus,
      isOurhomeLoading,
      ourhomeErrorMessage,
      restaurantCommentCounts,

      onNewMenuNameChange: setNewMenuName,

      onMenuInputKeyDown: handleMenuInputKeyDown,

      onAddMenu: addMenu,

      onClearAllMenus: clearAllMenus,

      onSaveOurhomeWeeklyMenus: handleSaveOurhomeWeeklyMenus,

      onClearOurhomeDailyMenu: handleClearOurhomeDailyMenu,

      onUpdateMenuWeight: updateMenuWeight,

      onConfirmMenuDirectly: confirmMenuDirectly,

      onDeleteMenu: deleteMenu,

      onRestaurantCommentCountChange: updateRestaurantCommentCount,

      onDrawLunch: drawLunch,
    },

    drawResultProps: {
      drawResult,
      sortedResultMenus,
      confirmingMenuId,
      resultMessage,

      onConfirmSelectedMenu: confirmSelectedMenu,

      onDrawLunch: drawLunch,
    },

    archivedMenuPanelProps: {
      archivedMenus: typedArchivedMenus,

      restoringMenuId,
      deletingArchivedMenuId,
      restaurantCommentCounts,

      onRestoreMenu: restoreMenu,

      onDeleteArchivedMenu: deleteArchivedMenu,

      onRestaurantCommentCountChange: updateRestaurantCommentCount,
    },

    addRestaurantToMenu,
  };
}
