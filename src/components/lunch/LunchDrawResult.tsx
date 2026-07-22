import type {
  LunchDrawResult as LunchDrawResultType,
  LunchMenu,
} from "../../types";

export type LunchDrawResultProps = {
  drawResult: LunchDrawResultType | null;
  sortedResultMenus: LunchMenu[];
  confirmingMenuId: string | null;
  resultMessage: string;

  onConfirmSelectedMenu: () => Promise<void>;
  onDrawLunch: () => void;
};

export default function LunchDrawResult({
  drawResult,
  sortedResultMenus,
  confirmingMenuId,
  resultMessage,
  onConfirmSelectedMenu,
  onDrawLunch,
}: LunchDrawResultProps) {
  if (!drawResult) {
    return (
      <div className="panel result-panel">
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
      </div>
    );
  }

  return (
    <div className="panel result-panel">
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
            void onConfirmSelectedMenu();
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
            공동 1위 {drawResult.topMenus.map(menu => menu.name).join(", ")}{" "}
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

          {sortedResultMenus.map(menu => {
            const count = drawResult.counts[menu.id] ?? 0;

            const barWidth = `${(count / 10) * 100}%`;

            return (
              <div className="result-row" key={menu.id}>
                <div className="result-row__top">
                  <span className="result-row__name">{menu.name}</span>

                  <strong className="result-row__count">{count}회</strong>
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

        <button className="retry-button" type="button" onClick={onDrawLunch}>
          다시 뽑기
        </button>
      </div>
    </div>
  );
}
