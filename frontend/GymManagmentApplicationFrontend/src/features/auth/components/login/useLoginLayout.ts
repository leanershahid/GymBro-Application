import { useEffect, useState } from 'react';
import { Keyboard, KeyboardEvent, Platform, useWindowDimensions } from 'react-native';
import { scaleH } from '../../../../utils/scale';

/**
 * How many pixels of the screen the software keyboard covers. Measured from the keyboard's
 * top edge against our own root view, so it is right on both iOS and Android, whether or not
 * Android resized the window (edge-to-edge apps don't get resized — that's why the old
 * KeyboardAvoidingView left the fields hidden behind the keyboard on Android).
 */
export function useKeyboardOverlap(rootHeight: number) {
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: KeyboardEvent) => setKeyboardTop(e.endCoordinates.screenY);
    const onHide = () => setKeyboardTop(null);
    const a = Keyboard.addListener(showEvt, onShow);
    const b = Keyboard.addListener(hideEvt, onHide);
    return () => { a.remove(); b.remove(); };
  }, []);

  const visible = keyboardTop !== null;
  const overlap = visible && rootHeight > 0 ? Math.max(0, rootHeight - keyboardTop) : 0;
  return { visible, overlap };
}

/** Layout split from the live window size — adjusts on very small screens (< 700 px tall). */
export function useLoginLayout() {
  const { width, height } = useWindowDimensions();
  const heroRatio  = height < 700 ? 0.42 : 0.50;
  const heroHeight  = height * heroRatio;
  const sheetHeight = height - heroHeight;
  // The logo sits just above the sheet; cap it by the hero height so it never runs off the top.
  const logoHeight = Math.min(scaleH(190), heroHeight * 0.7);
  const logoWidth  = Math.min(width * 0.90, logoHeight * 2.4);
  return { width, height, heroHeight, sheetHeight, logoHeight, logoWidth };
}
