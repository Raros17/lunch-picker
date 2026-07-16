export type LunchMenu = {
  id: string;
  name: string;
  weight: number;
};

export type LunchDrawResult = {
  selectedMenu: LunchMenu;
  drawResults: LunchMenu[];
  counts: Record<string, number>;
  topMenus: LunchMenu[];
  maxCount: number;
  usedMinimumRule: boolean;
};
