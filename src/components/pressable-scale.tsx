import { useState, type ReactNode } from "react";
import { Pressable, View, type PressableProps } from "react-native";
import Animated, { cubicBezier, useReducedMotion, type CSSStyle } from "react-native-reanimated";

// Press feedback for a card-like or round pressable: scale to 0.97 on press-in, a 120 ms CSS transition on the
// UI thread. Reduced motion dims instead of scaling. Full-width list rows highlight their background instead.
export function PressableScale({
  className,
  contentClassName,
  children,
  onPressIn,
  onPressOut,
  ...props
}: Omit<PressableProps, "children"> & {
  children: ReactNode;
  /** Layout only (margins, flex). */
  className?: string;
  /** Size and look of what scales (background, radius, padding). */
  contentClassName?: string;
}) {
  const reduced = useReducedMotion();
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      pressRetentionOffset={16}
      className={className}
      onPressIn={(event) => {
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
      {...props}
    >
      <Animated.View style={[styles.base, pressed && (reduced ? styles.dimmed : styles.pressed)]}>
        <View className={contentClassName}>{children}</View>
      </Animated.View>
    </Pressable>
  );
}

// Animated.View takes no className, so the transition lives in style. StyleSheet.create doesn't type CSS transitions.
const styles = {
  base: {
    opacity: 1,
    transform: [{ scale: 1 }],
    transitionProperty: ["transform", "opacity"],
    transitionDuration: 120,
    transitionTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
  },
  pressed: { transform: [{ scale: 0.97 }] },
  dimmed: { opacity: 0.85 },
} satisfies Record<string, CSSStyle>;
