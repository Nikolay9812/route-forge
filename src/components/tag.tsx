import { View } from "react-native";

import type { ColorToken } from "@/theme";

import { ThemedText } from "./themed-text";

// Design Board 15. Status tones match shift states and show a dot.
const tones = {
  draft: { container: "bg-neutral-soft", dot: "bg-neutral", color: "neutral" },
  submitted: { container: "bg-info-soft", dot: "bg-info", color: "info" },
  approved: { container: "bg-success-soft", dot: "bg-success", color: "success" },
  rejected: { container: "bg-danger-soft", dot: "bg-danger", color: "danger" },
  // Same colors as submitted, without the dot: "Corrected" and other info labels.
  info: { container: "bg-info-soft", dot: null, color: "info" },
  role: { container: "bg-canvas border border-border", dot: null, color: "ink" },
  highlight: { container: "bg-primary-soft", dot: null, color: "ink" },
  // Counts without a status dot, such as vehicle check photos: some or none, and all done.
  muted: { container: "bg-neutral-soft", dot: null, color: "neutral" },
  done: { container: "bg-success-soft", dot: null, color: "success" },
} as const satisfies Record<string, { container: string; dot: string | null; color: ColorToken }>;

export type TagTone = keyof typeof tones;

export function Tag({
  label,
  tone,
  size = "md",
  className,
}: {
  label: string;
  tone: TagTone;
  size?: "md" | "sm";
  /** Layout only. */
  className?: string;
}) {
  const t = tones[tone];
  return (
    <View
      className={`flex-row items-center gap-1.5 self-start rounded-full ${
        size === "md" ? "h-tag px-3" : "h-tag-sm px-2.5"
      } ${t.container} ${className ?? ""}`}
    >
      {t.dot ? <View className={`size-2 rounded-full ${t.dot}`} /> : null}
      <ThemedText variant={size === "md" ? "footnote" : "micro"} color={t.color} numberOfLines={1}>
        {label}
      </ThemedText>
    </View>
  );
}
