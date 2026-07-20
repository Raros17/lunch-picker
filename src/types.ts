export type LunchMenu = {
  id: string;
  name: string;
  weight: number;
  isDefault?: boolean;
};

export type LunchDrawResult = {
  selectedMenu: LunchMenu;
  drawResults: LunchMenu[];
  counts: Record<string, number>;
  topMenus: LunchMenu[];
  maxCount: number;
  usedMinimumRule: boolean;
};

export type OurhomeDailyMenu = {
  menuDate: string;
  menuText: string;
  updatedAt: string;
};

export type OurhomeWeeklyMenus = Record<string, OurhomeDailyMenu>;
