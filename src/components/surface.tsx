import { View, type ViewProps } from "react-native";

// A real card (shift card, sheet content). Use grouped rows, not a Surface per row.
const variants = {
  raised: "bg-surface rounded-lg shadow-card",
  outlined: "bg-surface rounded-lg border border-border",
} as const;

export function Surface({
  variant = "raised",
  className,
  ...props
}: ViewProps & {
  variant?: keyof typeof variants;
  /** Layout and padding. */
  className?: string;
}) {
  return <View className={`${variants[variant]} ${className ?? ""}`} {...props} />;
}
