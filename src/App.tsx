import { useMemo, useState } from "react";

import type { KeyboardEvent } from "react";

import "./App.css";

import NearbyRestaurantSearch from "./components/NearbyRestaurantSearch";
import RestaurantCommentsButton from "./components/RestaurantCommentsButton";
import OurhomeMenuCard from "./components/OurhomeMenuCard";

import { useOurhomeMenus } from "./hooks/useOurhomeMenus";
import { useLunchMenus } from "./hooks/useLunchMenus";
import { drawLunchMenu } from "./utils/drawLunch";

import type { LunchDrawResult, LunchMenu } from "./types";

type WeightOption = {
  value: number;
  label: string;
};

type RecentLunchHistoryItem = {
  dateKey: string;
  menuName: string;
};

const weightOptions: WeightOption[] = [
  {
    value: 0,
    label: "오늘은 제외",
  },
  {
    value: 0.5,
    label: "별로 안 당김",
  },
  {
    value: 1,
    label: "보통",
  },
  {
    value: 1.5,
    label: "조금 당김",
  },
  {
    value: 2,
    label: "매우 당김",
  },
];

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

function getTodayDateKey(): string {
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const datePartMap = Object.fromEntries(
    dateParts.map(part => [part.type, part.value]),
  );

  return `${datePartMap.year}-${datePartMap.month}-${datePartMap.day}`;
}

function getDateKeyByOffset(dayOffset: number): string {
  const targetDate = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000);

  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(targetDate);

  const datePartMap = Object.fromEntries(
    dateParts.map(part => [part.type, part.value]),
  );

  return `${datePartMap.year}-${datePartMap.month}-${datePartMap.day}`;
}

function getRegisteredDateText(createdAt?: string): string {
  if (!createdAt) {
    return "이전에 등록한 메뉴";
  }

  return `${new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(new Date(createdAt))} 등록`;
}

function App() {
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
    weeklyMenus: ourhomeWeeklyMenus,

    isLoading: isOurhomeLoading,

    errorMessage: ourhomeErrorMessage,

    saveWeeklyMenus: saveOurhomeWeeklyMenus,

    clearMenu: clearOurhomeMenu,
  } = useOurhomeMenus();

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

  const todayDateKey = getTodayDateKey();

  const ourhomeDailyMenu = ourhomeWeeklyMenus[todayDateKey] ?? null;

  const recentLunchHistoryMap = useMemo(
    () =>
      new Map(
        recentLunchHistory.map((historyItem: RecentLunchHistoryItem) => [
          historyItem.dateKey,
          historyItem.menuName,
        ]),
      ),
    [recentLunchHistory],
  );

  const recentLunchCards = useMemo(
    () => [
      {
        label: "오늘",
        dateKey: getDateKeyByOffset(0),

        menuName:
          recentLunchHistoryMap.get(getDateKeyByOffset(0)) ?? "아직 미정",
      },
      {
        label: "어제",
        dateKey: getDateKeyByOffset(-1),

        menuName:
          recentLunchHistoryMap.get(getDateKeyByOffset(-1)) ?? "기록 없음",
      },
      {
        label: "그제",
        dateKey: getDateKeyByOffset(-2),

        menuName:
          recentLunchHistoryMap.get(getDateKeyByOffset(-2)) ?? "기록 없음",
      },
    ],
    [recentLunchHistoryMap],
  );

  const activeMenuCount = useMemo(
    () => menus.filter((menu: LunchMenu) => menu.weight > 0).length,
    [menus],
  );

  const hasDeletableMenu = useMemo(
    () => menus.some((menu: LunchMenu) => !menu.isDefault),
    [menus],
  );

  const sortedResultMenus = useMemo(() => {
    if (!drawResult) {
      return [];
    }

    return [...menus].sort(
      (
        firstMenu: LunchMenu,

        secondMenu: LunchMenu,
      ) => {
        const firstCount = drawResult.counts[firstMenu.id] ?? 0;

        const secondCount = drawResult.counts[secondMenu.id] ?? 0;

        return secondCount - firstCount;
      },
    );
  }, [drawResult, menus]);

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

    const alreadyExists = menus.some(
      (menu: LunchMenu) =>
        menu.name.toLowerCase() === trimmedMenuName.toLowerCase(),
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
      const result = drawLunchMenu(menus, 10, 3);

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

  return (
    <main className="app">
      <section className="app-shell">
        <header className="hero">
          <div className="hero__badge">LUNCH PICKER</div>

          <h1 className="hero__title">
            오늘 뭐
            <br />
            먹지?
          </h1>

          <p className="hero__description">
            먹고 싶은 정도를 정하고 버튼만 누르세요.
            <br />
            팀원이 추가한 메뉴가 모두에게 함께 표시됩니다.
          </p>

          <div className="recent-lunch-history">
            {recentLunchCards.map((historyCard, index) => (
              <article
                className={`recent-lunch-history__item ${
                  index === 0 ? "recent-lunch-history__item--today" : ""
                }`}
                key={historyCard.dateKey}
              >
                <span className="recent-lunch-history__label">
                  {historyCard.label}
                </span>

                <strong className="recent-lunch-history__menu">
                  {historyCard.menuName}
                </strong>
              </article>
            ))}
          </div>

          <div className="hero__summary">
            <div className="summary-item">
              <span className="summary-item__value">{menus.length}</span>

              <span className="summary-item__label">등록 메뉴</span>
            </div>

            <div className="summary-divider" />

            <div className="summary-item">
              <span className="summary-item__value">{activeMenuCount}</span>

              <span className="summary-item__label">오늘의 후보</span>
            </div>

            <div className="summary-divider" />

            <div className="summary-item">
              <span className="summary-item__value">10</span>

              <span className="summary-item__label">추첨 횟수</span>
            </div>
          </div>
        </header>

        <section className="content">
          <div className="panel menu-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-heading__eyebrow">SHARED MENU LIST</p>

                <h2 className="panel-heading__title">팀 점심 후보</h2>
              </div>

              <button
                className="text-button text-button--danger"
                type="button"
                onClick={() => {
                  void clearAllMenus();
                }}
                disabled={isLoading || isSaving || !hasDeletableMenu}
              >
                메뉴 전체 비우기
              </button>
            </div>

            <div className="menu-input-row">
              <input
                className="menu-input"
                type="text"
                value={newMenuName}
                onChange={event => setNewMenuName(event.target.value)}
                onKeyDown={handleMenuInputKeyDown}
                placeholder="팀과 공유할 메뉴 입력"
                maxLength={30}
                disabled={isSaving}
              />

              <button
                className="add-button"
                type="button"
                onClick={() => {
                  void addMenu();
                }}
                disabled={isSaving}
              >
                {isSaving ? "저장 중" : "추가"}
              </button>
            </div>

            {isOurhomeLoading && (
              <p className="message">아워홈 식단을 불러오는 중입니다.</p>
            )}

            {ourhomeErrorMessage && (
              <p className="message">아워홈 DB 오류: {ourhomeErrorMessage}</p>
            )}

            {isLoading && (
              <p className="message">공유 메뉴를 불러오는 중입니다.</p>
            )}

            {errorMessage && <p className="message">DB 오류: {errorMessage}</p>}

            {message && <p className="message">{message}</p>}

            <div className="menu-list">
              {menus.map(
                (
                  menu: LunchMenu,

                  index: number,
                ) => {
                  if (menu.isDefault) {
                    return (
                      <OurhomeMenuCard
                        key={menu.id}
                        menu={menu}
                        dailyMenu={ourhomeDailyMenu}
                        weeklyMenus={ourhomeWeeklyMenus}
                        weightOptions={weightOptions}
                        onSaveWeeklyMenus={handleSaveOurhomeWeeklyMenus}
                        onClearDailyMenu={handleClearOurhomeDailyMenu}
                        onWeightChange={(weight: number) => {
                          void updateMenuWeight(menu.id, weight);
                        }}
                      />
                    );
                  }

                  const isDisabled = menu.weight === 0;

                  return (
                    <article
                      className={`menu-item ${
                        isDisabled ? "menu-item--disabled" : ""
                      }`}
                      key={menu.id}
                    >
                      <div className="menu-item__number">
                        {String(index + 1).padStart(2, "0")}
                      </div>

                      <div className="menu-item__content">
                        <strong className="menu-item__name">{menu.name}</strong>

                        <div className="menu-item__controls">
                          <select
                            className="weight-select"
                            value={menu.weight}
                            onChange={event => {
                              void updateMenuWeight(
                                menu.id,
                                Number(event.target.value),
                              );
                            }}
                            aria-label={`${menu.name} 가중치`}
                            disabled={confirmingMenuId !== null}
                          >
                            {weightOptions.map((option: WeightOption) => (
                              <option value={option.value} key={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>

                          {menu.kakaoPlaceId && (
                            <RestaurantCommentsButton
                              kakaoPlaceId={menu.kakaoPlaceId}
                              placeName={menu.name}
                            />
                          )}

                          {menu.kakaoPlaceUrl && (
                            <a
                              className="menu-item__kakao-map-button"
                              href={menu.kakaoPlaceUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              카카오맵
                            </a>
                          )}

                          <button
                            className="menu-item__today-button"
                            type="button"
                            onClick={() => {
                              void confirmMenuDirectly(menu.id, menu.name);
                            }}
                            disabled={confirmingMenuId !== null}
                          >
                            {confirmingMenuId === menu.id
                              ? "등록 중..."
                              : "선택!"}
                          </button>
                        </div>
                      </div>

                      <button
                        className="delete-button"
                        type="button"
                        onClick={() => {
                          void deleteMenu(menu.id, Boolean(menu.isDefault));
                        }}
                        aria-label={`${menu.name} 과거 메뉴로 이동`}
                        disabled={confirmingMenuId !== null}
                      >
                        ×
                      </button>
                    </article>
                  );
                },
              )}
            </div>

            <button
              className="draw-button"
              type="button"
              onClick={drawLunch}
              disabled={isLoading || activeMenuCount === 0}
            >
              <span>오늘 점심 뽑기</span>

              <span className="draw-button__icon">→</span>
            </button>
          </div>

          <div className="panel result-panel">
            {!drawResult ? (
              <div className="empty-result">
                <div className="empty-result__icon">🍽️</div>

                <p className="empty-result__eyebrow">준비 완료</p>

                <h2 className="empty-result__title">
                  오늘 점심을
                  <br />
                  뽑아볼까요?
                </h2>

                <p className="empty-result__description">
                  팀이 함께 등록한 메뉴를 확인한 뒤
                  <br />
                  빨간 버튼을 눌러주세요.
                </p>
              </div>
            ) : (
              <div className="result">
                <p className="result__eyebrow">TODAY&apos;S LUNCH</p>

                <div className="winner-card">
                  <span className="winner-card__label">오늘의 점심</span>

                  <strong className="winner-card__name">
                    {drawResult.selectedMenu.name}
                  </strong>

                  <span className="winner-card__count">
                    10번 중 {drawResult.maxCount}번 당첨
                  </span>
                </div>

                <button
                  className="confirm-eaten-button"
                  type="button"
                  onClick={() => {
                    void confirmSelectedMenu();
                  }}
                  disabled={confirmingMenuId !== null}
                >
                  {confirmingMenuId === drawResult.selectedMenu.id
                    ? "기록 중..."
                    : "오늘 이걸로 결정"}
                </button>

                {resultMessage && (
                  <p className="result-confirm-message">{resultMessage}</p>
                )}

                {drawResult.topMenus.length > 1 && (
                  <p className="tie-message">
                    공동 1위{" "}
                    {drawResult.topMenus
                      .map((menu: LunchMenu) => menu.name)
                      .join(", ")}{" "}
                    중에서 최종 선택했습니다.
                  </p>
                )}

                {!drawResult.usedMinimumRule && (
                  <p className="rule-message">
                    3회 이상 당첨된 메뉴가 없어 최다 득표 메뉴를 선택했습니다.
                  </p>
                )}

                <div className="result-list">
                  <div className="result-list__heading">
                    <h3>10회 추첨 결과</h3>

                    <span>득표순</span>
                  </div>

                  {sortedResultMenus.map((menu: LunchMenu) => {
                    const count = drawResult.counts[menu.id] ?? 0;

                    const barWidth = `${(count / 10) * 100}%`;

                    return (
                      <div className="result-row" key={menu.id}>
                        <div className="result-row__top">
                          <span className="result-row__name">{menu.name}</span>

                          <strong className="result-row__count">
                            {count}회
                          </strong>
                        </div>

                        <div className="result-bar">
                          <div
                            className="result-bar__fill"
                            style={{
                              width: barWidth,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  className="retry-button"
                  type="button"
                  onClick={drawLunch}
                >
                  다시 뽑기
                </button>
              </div>
            )}
          </div>
        </section>

        <NearbyRestaurantSearch onAddRestaurant={addRestaurantToMenu} />

        {archivedMenus.length > 0 && (
          <section className="panel archived-menu-panel">
            <div className="archived-menu-panel__heading">
              <div>
                <p className="archived-menu-panel__eyebrow">
                  PREVIOUS MENU TOP 10
                </p>

                <h2 className="archived-menu-panel__title">다시 먹어볼까요?</h2>

                <p className="archived-menu-panel__description">
                  현재 후보와 최근 14일 안에 먹은 메뉴는 제외하고, 처음 등록한
                  순서대로 최대 10개를 보여줘요.
                </p>
              </div>

              <span className="archived-menu-panel__count">
                TOP {archivedMenus.length}
              </span>
            </div>

            <div className="archived-menu-list">
              {archivedMenus.map(
                (
                  menu: LunchMenu,

                  index: number,
                ) => (
                  <article className="archived-menu-item" key={menu.id}>
                    <span className="archived-menu-item__rank">
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <div className="archived-menu-item__content">
                      <strong className="archived-menu-item__name">
                        {menu.name}
                      </strong>

                      <span className="archived-menu-item__date">
                        {getRegisteredDateText(menu.createdAt)}
                      </span>
                    </div>

                    <div className="archived-menu-item__actions">
                      {menu.kakaoPlaceId && (
                        <RestaurantCommentsButton
                          kakaoPlaceId={menu.kakaoPlaceId}
                          placeName={menu.name}
                        />
                      )}

                      <button
                        className="archived-menu-item__restore-button"
                        type="button"
                        onClick={() => {
                          void restoreMenu(menu.id, menu.name);
                        }}
                        disabled={
                          restoringMenuId !== null ||
                          deletingArchivedMenuId !== null
                        }
                      >
                        {restoringMenuId === menu.id
                          ? "추가 중..."
                          : "후보에 추가"}
                      </button>

                      <button
                        className="archived-menu-item__delete-button"
                        type="button"
                        onClick={() => {
                          void deleteArchivedMenu(menu.id, menu.name);
                        }}
                        disabled={
                          restoringMenuId !== null ||
                          deletingArchivedMenuId !== null
                        }
                        aria-label={`${menu.name} 완전 삭제`}
                        title="완전 삭제"
                      >
                        {deletingArchivedMenuId === menu.id ? "…" : "×"}
                      </button>
                    </div>
                  </article>
                ),
              )}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

export default App;
