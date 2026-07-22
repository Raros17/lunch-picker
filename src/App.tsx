import "./App.css";

import ArchivedMenuPanel from "./components/lunch/ArchivedMenuPanel";
import LunchCandidatePanel from "./components/lunch/LunchCandidatePanel";
import LunchDrawResult from "./components/lunch/LunchDrawResult";
import RecentLunchHistory from "./components/lunch/RecentLunchHistory";
import NearbyRestaurantSearch from "./components/NearbyRestaurantSearch";
import RandomRestaurantPicker from "./components/RandomRestaurantPicker";

import { useLunchPickerPage } from "./hooks/useLunchPickerPage";

function App() {
  const lunchPickerPage = useLunchPickerPage();

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

          <RecentLunchHistory cards={lunchPickerPage.recentLunchCards} />

          <div className="hero__summary">
            <div className="summary-item">
              <span className="summary-item__value">
                {lunchPickerPage.registeredMenuCount}
              </span>

              <span className="summary-item__label">등록 메뉴</span>
            </div>

            <div className="summary-divider" />

            <div className="summary-item">
              <span className="summary-item__value">
                {lunchPickerPage.activeMenuCount}
              </span>

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
          <LunchCandidatePanel {...lunchPickerPage.candidatePanelProps} />

          <LunchDrawResult {...lunchPickerPage.drawResultProps} />
        </section>

        <RandomRestaurantPicker
          onAddRestaurant={lunchPickerPage.addRestaurantToMenu}
        />

        <NearbyRestaurantSearch
          onAddRestaurant={lunchPickerPage.addRestaurantToMenu}
        />

        <ArchivedMenuPanel {...lunchPickerPage.archivedMenuPanelProps} />
      </section>
    </main>
  );
}

export default App;
