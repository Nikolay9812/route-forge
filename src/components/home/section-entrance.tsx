import { useMemo, type PropsWithChildren } from "react";
import Animated, { Easing, FadeIn, FadeInDown, ReduceMotion, useReducedMotion } from "react-native-reanimated";

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * Fades a Home section up 8 pt when it mounts, staggered 50 ms by index. Sections mount once, when data first
 * arrives, so refreshing or coming back to the tab never replays it. Reduced motion keeps only the fade.
 */
export function SectionEntrance({ index, children }: PropsWithChildren<{ index: number }>) {
  const reduced = useReducedMotion();
  const entering = useMemo(() => {
    const delay = index * 50;
    return reduced
      ? FadeIn.duration(250).delay(delay).easing(EASE_OUT).reduceMotion(ReduceMotion.Never)
      : FadeInDown.duration(250)
          .delay(delay)
          .easing(EASE_OUT)
          .withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] });
  }, [index, reduced]);

  return <Animated.View entering={entering}>{children}</Animated.View>;
}
