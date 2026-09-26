declare module "lunar-javascript" {
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar;
    getLunar(): Lunar;
  }

  export class Lunar {
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    getMonthInChinese(): string;
    getDayInChinese(): string;
    getYearShengXiao(): string;
    getDayInGanZhi(): string;
    getDayChong(): string;
    getDayChongShengXiao(): string;
    getDayYi(sect?: number): string[];
    getDayJi(sect?: number): string[];
    getPengZuGan(): string;
    getPengZuZhi(): string;
    getZhiXing(): string;
    getDayNaYin(): string;
  }
}
