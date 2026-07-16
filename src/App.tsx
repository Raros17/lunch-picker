import { useEffect, useMemo, useState } from "react";
import "./App.css";

import { initialMenus } from "./data/initialMenus";
import { drawLunchMenu } from "./utils/drawLunch";
import type { LunchDrawResult, LunchMenu } from "./types";

const STORAGE_KEY = "lunch-picker-menus";

const weightOptions = [
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

function createInitialMenuList(): LunchMenu[] {
  return initialMenus.map(menu => ({ ...menu }));
}

function loadMenus(): LunchMenu[] {
  try {
    const savedMenus = localStorage.getItem(STORAGE_KEY);

    if (!savedMenus) {
      return createInitialMenuList();
    }

    const parsedMenus = JSON.parse(savedMenus) as LunchMenu[];

    if (!Array.isArray(parsedMenus) || parsedMenus.length === 0) {
      return createInitialMenuList();
    }

    return parsedMenus;
  } catch {
    return createInitialMenuList();
  }
}

function createMenuId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `menu-${Date.now()}-${Math.random()}`;
}

function App() {
  const [menus, setMenus] = useState<LunchMenu[]>(loadMenus);
  const [newMenuName, setNewMenuName] = useState("");
  const [drawResult, setDrawResult] = useState<LunchDrawResult | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(menus));
  }, [menus]);

  const activeMenuCount = useMemo(
    () => menus.filter(menu => menu.weight > 0).length,
    [menus],
  );

  const sortedResultMenus = useMemo(() => {
    if (!drawResult) {
      return [];
    }

    return [...menus].sort((firstMenu, secondMenu) => {
      const firstCount = drawResult.counts[firstMenu.id] ?? 0;
      const secondCount = drawResult.counts[secondMenu.id] ?? 0;

      return secondCount - firstCount;
    });
  }, [drawResult, menus]);

  const addMenu = () => {
    const trimmedMenuName = newMenuName.trim();

    if (!trimmedMenuName) {
      setMessage("메뉴 이름을 입력해주세요.");
      return;
    }

    const alreadyExists = menus.some(
      menu => menu.name.toLowerCase() === trimmedMenuName.toLowerCase(),
    );

    if (alreadyExists) {
      setMessage("이미 등록된 메뉴입니다.");
      return;
    }

    const newMenu: LunchMenu = {
      id: createMenuId(),
      name: trimmedMenuName,
      weight: 1,
    };

    setMenus(previousMenus => [...previousMenus, newMenu]);
    setNewMenuName("");
    setDrawResult(null);
    setMessage(`${trimmedMenuName} 메뉴를 추가했습니다.`);
  };

  const deleteMenu = (menuId: string) => {
    setMenus(previousMenus => previousMenus.filter(menu => menu.id !== menuId));

    setDrawResult(null);
    setMessage("메뉴를 삭제했습니다.");
  };

  const updateMenuWeight = (menuId: string, weight: number) => {
    setMenus(previousMenus =>
      previousMenus.map(menu =>
        menu.id === menuId
          ? {
              ...menu,
              weight,
            }
          : menu,
      ),
    );

    setDrawResult(null);
    setMessage("");
  };

  const clearAllMenus = () => {
    const shouldClear = window.confirm(
      "등록된 메뉴를 모두 삭제할까요?\n삭제한 메뉴는 복구할 수 없습니다.",
    );

    if (!shouldClear) {
      return;
    }

    setMenus([]);
    setDrawResult(null);
    setNewMenuName("");
    setMessage("메뉴를 모두 비웠습니다. 새로운 메뉴를 입력해주세요.");
  };

  const drawLunch = () => {
    try {
      const result = drawLunchMenu(menus, 10, 3);

      setDrawResult(result);
      setMessage("");
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "추첨 도중 오류가 발생했습니다.";

      setMessage(errorMessage);
    }
  };

  const handleMenuInputKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Enter") {
      addMenu();
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
            10번 뽑아서 가장 많이 나온 메뉴를 골라드립니다.
          </p>

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
                <p className="panel-heading__eyebrow">MENU LIST</p>
                <h2 className="panel-heading__title">점심 후보</h2>
              </div>

              <button
                className="text-button text-button--danger"
                type="button"
                onClick={clearAllMenus}
                disabled={menus.length === 0}
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
                placeholder="새로운 메뉴 입력"
                maxLength={30}
              />

              <button className="add-button" type="button" onClick={addMenu}>
                추가
              </button>
            </div>

            {message && <p className="message">{message}</p>}

            <div className="menu-list">
              {menus.length === 0 && (
                <div className="empty-menu-list">
                  <span className="empty-menu-list__icon">＋</span>

                  <strong>등록된 메뉴가 없습니다.</strong>

                  <p>
                    위 입력창에서 오늘의 점심 후보를
                    <br />
                    하나씩 추가해주세요.
                  </p>
                </div>
              )}
              {menus.map((menu, index) => {
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

                      <select
                        className="weight-select"
                        value={menu.weight}
                        onChange={event =>
                          updateMenuWeight(menu.id, Number(event.target.value))
                        }
                        aria-label={`${menu.name} 가중치`}
                      >
                        {weightOptions.map(option => (
                          <option value={option.value} key={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      className="delete-button"
                      type="button"
                      onClick={() => deleteMenu(menu.id)}
                      aria-label={`${menu.name} 삭제`}
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
              onClick={drawLunch}
              disabled={activeMenuCount === 0}
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
                  왼쪽에서 메뉴를 확인한 다음
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

                {drawResult.topMenus.length > 1 && (
                  <p className="tie-message">
                    공동 1위{" "}
                    {drawResult.topMenus.map(menu => menu.name).join(", ")}{" "}
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

                          <strong className="result-row__count">
                            {count}회
                          </strong>
                        </div>

                        <div className="result-bar">
                          <div
                            className="result-bar__fill"
                            style={{ width: barWidth }}
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
      </section>
    </main>
  );
}

export default App;
