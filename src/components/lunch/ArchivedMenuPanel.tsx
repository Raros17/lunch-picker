import RestaurantCommentsButton from "../RestaurantCommentsButton";

import { getRegisteredDateText } from "../../utils/lunchDate";

import type { LunchMenu } from "../../types";

export type ArchivedMenuPanelProps = {
  archivedMenus: LunchMenu[];
  restoringMenuId: string | null;
  deletingArchivedMenuId: string | null;

  restaurantCommentCounts: Record<string, number>;

  onRestoreMenu: (menuId: string, menuName: string) => Promise<void>;

  onDeleteArchivedMenu: (menuId: string, menuName: string) => Promise<void>;

  onRestaurantCommentCountChange: (
    kakaoPlaceId: string,
    nextCommentCount: number,
  ) => void;
};

export default function ArchivedMenuPanel({
  archivedMenus,
  restoringMenuId,
  deletingArchivedMenuId,
  restaurantCommentCounts,
  onRestoreMenu,
  onDeleteArchivedMenu,
  onRestaurantCommentCountChange,
}: ArchivedMenuPanelProps) {
  if (archivedMenus.length === 0) {
    return null;
  }

  return (
    <section className="panel archived-menu-panel">
      <div className="archived-menu-panel__heading">
        <div>
          <p className="archived-menu-panel__eyebrow">PREVIOUS MENU TOP 10</p>

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
        {archivedMenus.map((menu, index) => (
          <article className="archived-menu-item" key={menu.id}>
            <span className="archived-menu-item__rank">
              {String(index + 1).padStart(2, "0")}
            </span>

            <div className="archived-menu-item__content">
              <strong className="archived-menu-item__name">{menu.name}</strong>

              <span className="archived-menu-item__date">
                {getRegisteredDateText(menu.createdAt)}
              </span>
            </div>

            <div className="archived-menu-item__actions">
              {menu.kakaoPlaceId && (
                <RestaurantCommentsButton
                  kakaoPlaceId={menu.kakaoPlaceId}
                  placeName={menu.name}
                  commentCount={restaurantCommentCounts[menu.kakaoPlaceId] ?? 0}
                  onCommentCountChange={(nextCommentCount: number) => {
                    onRestaurantCommentCountChange(
                      menu.kakaoPlaceId as string,
                      nextCommentCount,
                    );
                  }}
                />
              )}

              <button
                className="archived-menu-item__restore-button"
                type="button"
                onClick={() => {
                  void onRestoreMenu(menu.id, menu.name);
                }}
                disabled={
                  restoringMenuId !== null || deletingArchivedMenuId !== null
                }
              >
                {restoringMenuId === menu.id ? "추가 중..." : "후보에 추가"}
              </button>

              <button
                className="archived-menu-item__delete-button"
                type="button"
                onClick={() => {
                  void onDeleteArchivedMenu(menu.id, menu.name);
                }}
                disabled={
                  restoringMenuId !== null || deletingArchivedMenuId !== null
                }
                aria-label={`${menu.name} 완전 삭제`}
                title="완전 삭제"
              >
                {deletingArchivedMenuId === menu.id ? "…" : "×"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
