import type { LunchDrawResult, LunchMenu } from "../types";

function weightedRandomChoice(menus: LunchMenu[]): LunchMenu {
  const availableMenus = menus.filter(menu => menu.weight > 0);

  if (availableMenus.length === 0) {
    throw new Error("추첨 가능한 메뉴가 없습니다.");
  }

  const totalWeight = availableMenus.reduce(
    (sum, menu) => sum + menu.weight,
    0,
  );

  let randomValue = Math.random() * totalWeight;

  for (const menu of availableMenus) {
    randomValue -= menu.weight;

    if (randomValue <= 0) {
      return menu;
    }
  }

  return availableMenus[availableMenus.length - 1];
}

export function drawLunchMenu(
  menus: LunchMenu[],
  drawCount = 10,
  candidateMinimumCount = 3,
): LunchDrawResult {
  const availableMenus = menus.filter(menu => menu.weight > 0);

  if (availableMenus.length === 0) {
    throw new Error("가중치가 0보다 큰 메뉴를 하나 이상 설정해주세요.");
  }

  const drawResults = Array.from({ length: drawCount }, () =>
    weightedRandomChoice(availableMenus),
  );

  const counts = drawResults.reduce<Record<string, number>>(
    (menuCounts, menu) => {
      menuCounts[menu.id] = (menuCounts[menu.id] ?? 0) + 1;
      return menuCounts;
    },
    {},
  );

  const minimumCandidates = availableMenus.filter(
    menu => (counts[menu.id] ?? 0) >= candidateMinimumCount,
  );

  const usedMinimumRule = minimumCandidates.length > 0;

  // 3회 이상 나온 메뉴가 없다면 전체 메뉴 중 최다 득표 메뉴를 사용
  const candidateMenus = usedMinimumRule ? minimumCandidates : availableMenus;

  const maxCount = Math.max(
    ...candidateMenus.map(menu => counts[menu.id] ?? 0),
  );

  const topMenus = candidateMenus.filter(
    menu => (counts[menu.id] ?? 0) === maxCount,
  );

  const selectedMenu = topMenus[Math.floor(Math.random() * topMenus.length)];

  return {
    selectedMenu,
    drawResults,
    counts,
    topMenus,
    maxCount,
    usedMinimumRule,
  };
}
