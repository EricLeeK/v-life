export type ZodiacSign =
  | "aries"
  | "taurus"
  | "gemini"
  | "cancer"
  | "leo"
  | "virgo"
  | "libra"
  | "scorpio"
  | "sagittarius"
  | "capricorn"
  | "aquarius"
  | "pisces";

export type Shengxiao =
  | "rat"
  | "ox"
  | "tiger"
  | "rabbit"
  | "dragon"
  | "snake"
  | "horse"
  | "goat"
  | "monkey"
  | "rooster"
  | "dog"
  | "pig";

export interface FortuneProfile {
  birth_date?: string;
  birth_hour?: number | null;
  birth_place?: string;
  zodiac_sign?: ZodiacSign;
  shengxiao?: Shengxiao;
}

export interface DailyScores {
  overall: number;
  love: number;
  career: number;
  wealth: number;
}

export type FortuneReadingType =
  | "tarot"
  | "iching"
  | "lot"
  | "bazi"
  | "zodiac"
  | "shengxiao"
  | "daily";
