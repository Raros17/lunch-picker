import { useMemo, useState } from "react";

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

  const [isEditing, setIsEditing] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  const [draftMenus, setDraftMenus] = useState<Record<string, string>>({});

  const [inputMessage, setInputMessage] = useState("");

  const menuItems = useMemo(
    () => splitMenuItems(dailyMenu?.menuText ?? ""),
    [dailyMenu],
  );

  const startEditing = () => {
    const initialDraftMenus = weekdays.reduce<Record<string, string>>(
      (nextDraftMenus, weekday) => {
        nextDraftMenus[weekday.dateKey] =
          weeklyMenus[weekday.dateKey]?.menuText ?? "";

        return nextDraftMenus;
      },
      {},
    );

    setDraftMenus(initialDraftMenus);

    setInputMessage("");
    setIsEditing(true);
  };

  const cancelEditing = () => {
    if (isSaving) {
      return;
    }

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

  return (
    <article className="ourhome-card">
      <div className="ourhome-card__header">
        <div className="ourhome-card__brand">
          <span className="ourhome-card__emoji">🥗</span>

          <div>
            <div className="ourhome-card__name-row">
              <strong className="ourhome-card__name">아워홈</strong>

              <span className="ourhome-card__default-badge">기본 후보</span>
            </div>

            <span className="ourhome-card__date">{getTodayDisplayText()}</span>
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

      {isEditing ? (
        <div className="ourhome-editor">
          <div className="ourhome-menu__heading">
            <div>
              <span className="ourhome-menu__eyebrow">WEEKLY MENU</span>

              <h3 className="ourhome-menu__title">이번 주 아워홈 식단</h3>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              marginTop: "16px",
            }}
          >
            {weekdays.map(weekday => (
              <label
                key={weekday.dateKey}
                style={{
                  display: "grid",
                  gridTemplateColumns: "64px minmax(0, 1fr)",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "64px",
                    border: "2px solid var(--text)",
                    borderRadius: "12px",
                    background: "var(--yellow)",
                    fontWeight: 900,
                  }}
                >
                  <strong>{weekday.weekdayText}</strong>

                  <small>{weekday.dateText}</small>
                </span>

                <textarea
                  className="ourhome-editor__textarea"
                  value={draftMenus[weekday.dateKey] ?? ""}
                  onChange={event =>
                    updateDraftMenu(weekday.dateKey, event.target.value)
                  }
                  placeholder="예: 제육볶음, 된장국, 계란말이"
                  maxLength={300}
                  rows={2}
                  disabled={isSaving}
                  style={{
                    minHeight: "64px",
                  }}
                />
              </label>
            ))}
          </div>

          <div className="ourhome-editor__guide">
            메뉴를 쉼표 또는 줄바꿈으로 구분해주세요. 비워둔 날짜는 기존 식단이
            삭제됩니다.
          </div>

          {inputMessage && (
            <p className="ourhome-editor__message">{inputMessage}</p>
          )}

          <div className="ourhome-editor__actions">
            <button
              className="ourhome-editor__cancel-button"
              type="button"
              onClick={cancelEditing}
              disabled={isSaving}
            >
              취소
            </button>

            <button
              className="ourhome-editor__save-button"
              type="button"
              onClick={() => {
                void saveMenus();
              }}
              disabled={isSaving}
            >
              {isSaving ? "저장 중..." : "이번 주 식단 저장"}
            </button>
          </div>
        </div>
      ) : dailyMenu ? (
        <div className="ourhome-menu">
          <div className="ourhome-menu__heading">
            <div>
              <span className="ourhome-menu__eyebrow">TODAY&apos;S MENU</span>

              <h3 className="ourhome-menu__title">오늘의 점심</h3>
            </div>

            <button
              className="ourhome-menu__edit-button"
              type="button"
              onClick={startEditing}
            >
              이번 주는?
            </button>
          </div>

          <div className="ourhome-menu__items">
            {menuItems.map((menuItem, index) => (
              <span className="ourhome-menu__item" key={`${menuItem}-${index}`}>
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

            <p>이번 주 식단을 등록해주세요.</p>
          </div>

          <button
            className="ourhome-empty__button"
            type="button"
            onClick={startEditing}
          >
            이번 주 식단 등록
          </button>
        </div>
      )}
    </article>
  );
}

export default OurhomeMenuCard;
