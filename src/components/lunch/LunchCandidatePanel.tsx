import type { KeyboardEvent } from "react";

import OurhomeMenuCard from "../OurhomeMenuCard";
import RestaurantCommentsButton from "../RestaurantCommentsButton";

import type {
  LunchMenu,
  OurhomeDailyMenu,
  OurhomeWeeklyMenus,
} from "../../types";

type WeightOption = {
  value: number;
  label: string;
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

export type LunchCandidatePanelProps = {
  menus: LunchMenu[];
  newMenuName: string;
  isSaving: boolean;
  isLoading: boolean;
  errorMessage: string | null | undefined;
  message: string;
  activeMenuCount: number;
  hasDeletableMenu: boolean;
  confirmingMenuId: string | null;

  ourhomeDailyMenu: OurhomeDailyMenu | null;
  ourhomeWeeklyMenus: OurhomeWeeklyMenus;
  isOurhomeLoading: boolean;
  ourhomeErrorMessage: string | null | undefined;

  restaurantCommentCounts: Record<string, number>;

  onNewMenuNameChange: (nextMenuName: string) => void;

  onMenuInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;

  onAddMenu: () => Promise<void>;
  onClearAllMenus: () => Promise<void>;

  onSaveOurhomeWeeklyMenus: (
    weekMenuTexts: Record<string, string>,
  ) => Promise<void>;

  onClearOurhomeDailyMenu: () => Promise<void>;

  onUpdateMenuWeight: (menuId: string, weight: number) => Promise<void>;

  onConfirmMenuDirectly: (menuId: string, menuName: string) => Promise<void>;

  onDeleteMenu: (menuId: string, isDefault: boolean) => Promise<void>;

  onRestaurantCommentCountChange: (
    kakaoPlaceId: string,
    nextCommentCount: number,
  ) => void;

  onDrawLunch: () => void;
};

export default function LunchCandidatePanel({
  menus,
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
  onNewMenuNameChange,
  onMenuInputKeyDown,
  onAddMenu,
  onClearAllMenus,
  onSaveOurhomeWeeklyMenus,
  onClearOurhomeDailyMenu,
  onUpdateMenuWeight,
  onConfirmMenuDirectly,
  onDeleteMenu,
  onRestaurantCommentCountChange,
  onDrawLunch,
}: LunchCandidatePanelProps) {
  return (
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
            void onClearAllMenus();
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
          onChange={event => onNewMenuNameChange(event.target.value)}
          onKeyDown={onMenuInputKeyDown}
          placeholder="팀과 공유할 메뉴 입력"
          maxLength={30}
          disabled={isSaving}
        />

        <button
          className="add-button"
          type="button"
          onClick={() => {
            void onAddMenu();
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

      {isLoading && <p className="message">공유 메뉴를 불러오는 중입니다.</p>}

      {errorMessage && <p className="message">DB 오류: {errorMessage}</p>}

      {message && <p className="message">{message}</p>}

      <div className="menu-list">
        {menus.map((menu, index) => {
          if (menu.isDefault) {
            return (
              <OurhomeMenuCard
                key={menu.id}
                menu={menu}
                dailyMenu={ourhomeDailyMenu}
                weeklyMenus={ourhomeWeeklyMenus}
                weightOptions={weightOptions}
                onSaveWeeklyMenus={onSaveOurhomeWeeklyMenus}
                onClearDailyMenu={onClearOurhomeDailyMenu}
                onWeightChange={(weight: number) => {
                  void onUpdateMenuWeight(menu.id, weight);
                }}
              />
            );
          }

          const isDisabled = menu.weight === 0;

          return (
            <article
              className={`menu-item ${isDisabled ? "menu-item--disabled" : ""}`}
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
                      void onUpdateMenuWeight(
                        menu.id,
                        Number(event.target.value),
                      );
                    }}
                    aria-label={`${menu.name} 가중치`}
                    disabled={confirmingMenuId !== null}
                  >
                    {weightOptions.map(option => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  {menu.kakaoPlaceId && (
                    <RestaurantCommentsButton
                      kakaoPlaceId={menu.kakaoPlaceId}
                      placeName={menu.name}
                      commentCount={
                        restaurantCommentCounts[menu.kakaoPlaceId] ?? 0
                      }
                      onCommentCountChange={(nextCommentCount: number) => {
                        onRestaurantCommentCountChange(
                          menu.kakaoPlaceId as string,
                          nextCommentCount,
                        );
                      }}
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
                      void onConfirmMenuDirectly(menu.id, menu.name);
                    }}
                    disabled={confirmingMenuId !== null}
                  >
                    {confirmingMenuId === menu.id ? "등록 중..." : "선택"}
                  </button>
                </div>
              </div>

              <button
                className="delete-button"
                type="button"
                onClick={() => {
                  void onDeleteMenu(menu.id, Boolean(menu.isDefault));
                }}
                aria-label={`${menu.name} 과거 메뉴로 이동`}
                disabled={confirmingMenuId !== null}
              >
                ×
              </button>
            </article>
          );
        })}
      </div>

      <button
        className="draw-button"
        type="button"
        onClick={onDrawLunch}
        disabled={isLoading || activeMenuCount === 0}
      >
        <span>오늘 점심 뽑기</span>
        <span className="draw-button__icon">→</span>
      </button>
    </div>
  );
}
