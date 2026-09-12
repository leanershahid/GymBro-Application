import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base design is 390×844 (iPhone 14). Everything scales from here.
const BASE_W = 390;
const BASE_H = 844;

export const scaleW = (px: number) => (SCREEN_WIDTH / BASE_W) * px;
export const scaleH = (px: number) => (SCREEN_HEIGHT / BASE_H) * px;
export const rs = (px: number) => Math.round(scaleW(px)); // font / radius scale
