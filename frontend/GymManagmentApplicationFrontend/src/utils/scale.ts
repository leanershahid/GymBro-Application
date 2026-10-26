import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base design is 390×844 (iPhone 14). Everything scales from here.
const BASE_W = 390;
const BASE_H = 844;

// Scaling never shrinks below 85% (so small phones keep usable touch targets and legible
// text) and never grows past 125% (so tablets don't get giant UI). Values are computed at
// startup — for layouts that must react to rotation/resizing use useLayout() instead.
const clampFactor = (f: number) => Math.min(1.25, Math.max(0.85, f));

export const scaleW = (px: number) => clampFactor(SCREEN_WIDTH / BASE_W) * px;
export const scaleH = (px: number) => clampFactor(SCREEN_HEIGHT / BASE_H) * px;
export const rs = (px: number) => Math.round(scaleW(px)); // font / radius scale
