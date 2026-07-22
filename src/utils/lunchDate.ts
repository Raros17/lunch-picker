export type RecentLunchHistoryItem = {
  dateKey: string;
  menuName: string;
};

export type RecentLunchCard = {
  label: "오늘" | "어제" | "그제";
  dateKey: string;
  menuName: string;
};

export function getTodayDateKey(): string {
  return getDateKeyByOffset(0);
}

export function getDateKeyByOffset(dayOffset: number): string {
  const targetDate = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000);

  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(targetDate);

  const datePartMap = Object.fromEntries(
    dateParts.map(datePart => [datePart.type, datePart.value]),
  );

  return `${datePartMap.year}-${datePartMap.month}-${datePartMap.day}`;
}

export function buildRecentLunchCards(
  recentLunchHistory: RecentLunchHistoryItem[],
): RecentLunchCard[] {
  const historyMap = new Map(
    recentLunchHistory.map(historyItem => [
      historyItem.dateKey,
      historyItem.menuName,
    ]),
  );

  const todayDateKey = getDateKeyByOffset(0);
  const yesterdayDateKey = getDateKeyByOffset(-1);
  const twoDaysAgoDateKey = getDateKeyByOffset(-2);

  return [
    {
      label: "오늘",
      dateKey: todayDateKey,
      menuName: historyMap.get(todayDateKey) ?? "아직 미정",
    },
    {
      label: "어제",
      dateKey: yesterdayDateKey,
      menuName: historyMap.get(yesterdayDateKey) ?? "기록 없음",
    },
    {
      label: "그제",
      dateKey: twoDaysAgoDateKey,
      menuName: historyMap.get(twoDaysAgoDateKey) ?? "기록 없음",
    },
  ];
}

export function getRegisteredDateText(createdAt?: string): string {
  if (!createdAt) {
    return "이전에 등록한 메뉴";
  }

  const registeredDate = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(new Date(createdAt));

  return `${registeredDate} 등록`;
}
