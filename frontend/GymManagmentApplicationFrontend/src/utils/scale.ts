import { Dimensions } from 'react-native';
import { makeScale } from './useLayout';

/**
 * @deprecated Use `useScale()` (or `useLayout()`) from utils/useLayout.ts — these values are
 * computed once at start-up and don't follow rotation / window resizing (ARCH-129).
 * Still used by LoginPage's module-level StyleSheet; remove once it moves to useScale().
 */
const { width, height } = Dimensions.get('window');
export const { scaleW, scaleH, rs } = makeScale(width, height);
