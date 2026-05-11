/**
 * ナチュラルでシンプルなトーン（GRIS のような水彩・石・霞のイメージ。
 * 参照: https://store.steampowered.com/app/683320/GRIS/?l=japanese
 */
export const palette = {
  /** 紙・砂のような背景 */
  canvas: "#ebe6e0",
  /** 浮かせる面 */
  surface: "#f7f4f0",
  surfaceElevated: "#fdfcfa",
  /** 本文 */
  ink: "#3a3633",
  inkMuted: "#6f6862",
  inkFaint: "#9a928a",
  /** アクセント（鮮やかな緑は避け、灰みのセージ） */
  accent: "#6f8f82",
  accentMuted: "#b8ccc2",
  accentInk: "#3d5248",
  /** 境界 */
  mist: "#ded8d0",
  mistLight: "#ece7e1",
  /** 注意・削除（赤ではなく落ち着いたローズ） */
  rose: "#9c7a78",
  roseBg: "#f3ebe9",
  /** 情報 */
  haze: "#7a8fa3",
  hazeBg: "#e8eef4",
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
} as const;

export const shadow = {
  card: {
    shadowColor: "#2c2218",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
} as const;
