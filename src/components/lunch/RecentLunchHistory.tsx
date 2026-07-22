import type { RecentLunchCard } from "../../utils/lunchDate";

type RecentLunchHistoryProps = {
  cards: RecentLunchCard[];
};

export default function RecentLunchHistory({ cards }: RecentLunchHistoryProps) {
  return (
    <div className="recent-lunch-history">
      {cards.map((historyCard, index) => (
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
  );
}
