import { useEffect, useMemo, useState } from "react";

import type { LunchMenu, OurhomeDailyMenu, OurhomeWeeklyMenus } from "../types";

import "./OurhomeMenuCard.css";

type WeightOption = {
  value: number;
  label: string;
};

type OurhomeMenuCardProps = {
  menu: LunchMenu;
  dailyMenu: OurhomeDailyMenu | null;
  weeklyMenus: OurhomeWeeklyMenus;
  weightOptions: WeightOption[];

  onSaveWeeklyMenus: (weekMenuTexts: Record<string, string>) => Promise<void>;

  onClearDailyMenu: () => Promise<void>;

  onWeightChange: (weight: number) => void;
};

type WeekdayItem = {
  dateKey: string;
  weekdayText: string;
  dateText: string;
};

const ONE_DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

const weekdayIndexMap: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

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

function getCurrentWeekdays(): WeekdayItem[] {
  const today = new Date();

  const currentWeekdayText = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
  }).format(today);

  const currentWeekdayIndex = weekdayIndexMap[currentWeekdayText] ?? 1;

  const daysFromMonday =
    currentWeekdayIndex === 0 ? -6 : 1 - currentWeekdayIndex;

  const monday = new Date(
    today.getTime() + daysFromMonday * ONE_DAY_MILLISECONDS,
  );

  return Array.from(
    {
      length: 5,
    },
    (_, index) => {
      const date = new Date(monday.getTime() + index * ONE_DAY_MILLISECONDS);

      return {
        dateKey: getSeoulDateKey(date),

        weekdayText: new Intl.DateTimeFormat("ko-KR", {
          timeZone: "Asia/Seoul",
          weekday: "short",
        }).format(date),

        dateText: new Intl.DateTimeFormat("ko-KR", {
          timeZone: "Asia/Seoul",
          month: "numeric",
          day: "numeric",
        }).format(date),
      };
    },
  );
}

function getTodayDisplayText(): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date());
}

function getUpdatedTimeText(updatedAt: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(updatedAt));
}

function splitMenuItems(menuText: string): string[] {
  return menuText
    .split(/[,·\n]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "식단 저장에 실패했습니다.";
}

function OurhomeMenuCard({
  menu,
  dailyMenu,
  weeklyMenus,
  weightOptions,
  onSaveWeeklyMenus,
  onClearDailyMenu,
  onWeightChange,
}: OurhomeMenuCardProps) {
  const weekdays = useMemo(() => getCurrentWeekdays(), []);

  const [isWeeklyMenuOpen, setIsWeeklyMenuOpen] = useState(false);

  const [isEditing, setIsEditing] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  const [draftMenus, setDraftMenus] = useState<Record<string, string>>({});

  const [inputMessage, setInputMessage] = useState("");

  const menuItems = useMemo(
    () => splitMenuItems(dailyMenu?.menuText ?? ""),
    [dailyMenu],
  );

  const createDraftMenus = (): Record<string, string> =>
    weekdays.reduce<Record<string, string>>((nextDraftMenus, weekday) => {
      nextDraftMenus[weekday.dateKey] =
        weeklyMenus[weekday.dateKey]?.menuText ?? "";

      return nextDraftMenus;
    }, {});

  const openWeeklyMenu = () => {
    setDraftMenus(createDraftMenus());
    setInputMessage("");
    setIsEditing(false);
    setIsWeeklyMenuOpen(true);
  };

  const closeWeeklyMenu = () => {
    if (isSaving) {
      return;
    }

    setInputMessage("");
    setIsEditing(false);
    setIsWeeklyMenuOpen(false);
  };

  const startEditing = () => {
    setDraftMenus(createDraftMenus());
    setInputMessage("");
    setIsEditing(true);
  };

  const cancelEditing = () => {
    if (isSaving) {
      return;
    }

    setDraftMenus(createDraftMenus());
    setInputMessage("");
    setIsEditing(false);
  };

  const updateDraftMenu = (dateKey: string, menuText: string) => {
    setDraftMenus(previousMenus => ({
      ...previousMenus,
      [dateKey]: menuText,
    }));

    setInputMessage("");
  };

  const saveMenus = async (): Promise<void> => {
    const hasAtLeastOneMenu = Object.values(draftMenus).some(
      menuText => menuText.trim().length > 0,
    );

    if (!hasAtLeastOneMenu) {
      setInputMessage("식단을 하나 이상 입력해주세요.");

      return;
    }

    try {
      setIsSaving(true);
      setInputMessage("");

      await onSaveWeeklyMenus(draftMenus);

      setIsEditing(false);
    } catch (error) {
      setInputMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!isWeeklyMenuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) {
        closeWeeklyMenu();
      }
    };

    document.body.style.overflow = "hidden";

    window.addEventListener("keydown", handleEscapeKey);

    return () => {
      document.body.style.overflow = previousOverflow;

      window.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isSaving, isWeeklyMenuOpen]);

  return (
    <>
      <article className="ourhome-card">
        <div className="ourhome-card__header">
          <div className="ourhome-card__brand">
            <span className="ourhome-card__emoji">🥗</span>

            <div>
              <div className="ourhome-card__name-row">
                <strong className="ourhome-card__name">아워홈</strong>

                <span className="ourhome-card__default-badge">기본 후보</span>
              </div>

              <span className="ourhome-card__date">
                {getTodayDisplayText()}
              </span>
            </div>
          </div>

          <select
            className="ourhome-card__weight-select"
            value={menu.weight}
            onChange={event => onWeightChange(Number(event.target.value))}
            aria-label="아워홈 가중치"
          >
            {weightOptions.map(option => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {dailyMenu ? (
          <div className="ourhome-menu">
            <div className="ourhome-menu__heading">
              <div>
                <span className="ourhome-menu__eyebrow">TODAY&apos;S MENU</span>

                <h3 className="ourhome-menu__title">오늘의 점심</h3>
              </div>

              <button
                className="ourhome-menu__edit-button"
                type="button"
                onClick={openWeeklyMenu}
              >
                이번 주는?
              </button>
            </div>

            <div className="ourhome-menu__items">
              {menuItems.map((menuItem, index) => (
                <span
                  className="ourhome-menu__item"
                  key={`${menuItem}-${index}`}
                >
                  {menuItem}
                </span>
              ))}
            </div>

            <div className="ourhome-menu__footer">
              <span>{getUpdatedTimeText(dailyMenu.updatedAt)} 수정됨</span>

              <button
                className="ourhome-menu__clear-button"
                type="button"
                onClick={() => {
                  void onClearDailyMenu();
                }}
              >
                오늘 식단 비우기
              </button>
            </div>
          </div>
        ) : (
          <div className="ourhome-empty">
            <div className="ourhome-empty__icon">🍚</div>

            <div className="ourhome-empty__content">
              <strong>오늘 식단이 아직 없어요</strong>

              <p>이번 주 식단을 확인하거나 등록해주세요.</p>
            </div>

            <button
              className="ourhome-empty__button"
              type="button"
              onClick={openWeeklyMenu}
            >
              이번 주는?
            </button>
          </div>
        )}
      </article>

      {isWeeklyMenuOpen && (
        <div
          className="weekly-menu-modal"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget && !isSaving) {
              closeWeeklyMenu();
            }
          }}
        >
          <section
            className="weekly-menu-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="weekly-menu-title"
          >
            <header className="weekly-menu-dialog__header">
              <div>
                <span className="weekly-menu-dialog__eyebrow">
                  OURHOME WEEKLY MENU
                </span>

                <h2 id="weekly-menu-title">이번 주 아워홈 메뉴</h2>

                <p>월요일부터 금요일까지 한눈에 확인할 수 있어요.</p>
              </div>

              <button
                className="weekly-menu-dialog__close"
                type="button"
                onClick={closeWeeklyMenu}
                aria-label="창 닫기"
                disabled={isSaving}
              >
                ×
              </button>
            </header>

            {isEditing ? (
              <>
                <div className="weekly-menu-edit-list">
                  {weekdays.map(weekday => (
                    <label
                      className="weekly-menu-edit-row"
                      key={weekday.dateKey}
                    >
                      <span className="weekly-menu-edit-row__date">
                        <strong>{weekday.weekdayText}</strong>

                        <small>{weekday.dateText}</small>
                      </span>

                      <textarea
                        className="weekly-menu-edit-row__textarea"
                        value={draftMenus[weekday.dateKey] ?? ""}
                        onChange={event =>
                          updateDraftMenu(weekday.dateKey, event.target.value)
                        }
                        placeholder="예: 제육볶음, 된장국, 계란말이"
                        maxLength={300}
                        rows={2}
                        disabled={isSaving}
                      />
                    </label>
                  ))}
                </div>

                <p className="weekly-menu-dialog__guide">
                  쉼표, 가운데점 또는 줄바꿈으로 메뉴를 구분해주세요. 비워둔
                  날짜는 기존 식단이 삭제됩니다.
                </p>

                {inputMessage && (
                  <p className="weekly-menu-dialog__message">{inputMessage}</p>
                )}

                <footer className="weekly-menu-dialog__footer">
                  <button
                    className="weekly-menu-dialog__secondary-button"
                    type="button"
                    onClick={cancelEditing}
                    disabled={isSaving}
                  >
                    편집 취소
                  </button>

                  <button
                    className="weekly-menu-dialog__primary-button"
                    type="button"
                    onClick={() => {
                      void saveMenus();
                    }}
                    disabled={isSaving}
                  >
                    {isSaving ? "저장 중..." : "변경사항 저장"}
                  </button>
                </footer>
              </>
            ) : (
              <>
                <div className="weekly-menu-view-list">
                  {weekdays.map(weekday => {
                    const menuText =
                      weeklyMenus[weekday.dateKey]?.menuText.trim() ?? "";

                    return (
                      <article
                        className="weekly-menu-view-row"
                        key={weekday.dateKey}
                      >
                        <div className="weekly-menu-view-row__date">
                          <strong>{weekday.weekdayText}</strong>

                          <span>{weekday.dateText}</span>
                        </div>

                        <div className="weekly-menu-view-row__content">
                          {menuText ? (
                            splitMenuItems(menuText).map((menuItem, index) => (
                              <span
                                className="weekly-menu-view-row__item"
                                key={`${menuItem}-${index}`}
                              >
                                {menuItem}
                              </span>
                            ))
                          ) : (
                            <span className="weekly-menu-view-row__empty">
                              등록된 식단이 없습니다.
                            </span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>

                <footer className="weekly-menu-dialog__footer">
                  <button
                    className="weekly-menu-dialog__secondary-button"
                    type="button"
                    onClick={closeWeeklyMenu}
                  >
                    닫기
                  </button>

                  <button
                    className="weekly-menu-dialog__primary-button"
                    type="button"
                    onClick={startEditing}
                  >
                    편집
                  </button>
                </footer>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}

export default OurhomeMenuCard;
