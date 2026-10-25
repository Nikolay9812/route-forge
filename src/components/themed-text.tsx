import { Text, type TextProps } from "react-native";

import { useFontScript, type ColorToken, type FontScript } from "@/theme";

export type Weight ="regular" | "medium" | "semibold" | "bold" | "extrabold";

// Literal class names so Tailwind sees every one. Weight comes from the family, never fontWeight.
const families: Record<FontScript, Record<Weight, string>> = {
  latin: {
    regular: "font-jakarta-regular",
    medium: "font-jakarta-medium",
    semibold: "font-jakarta-semibold",
    bold: "font-jakarta-bold",
    extrabold: "font-jakarta-extrabold",
  },
  cyrillic: {
    regular: "font-manrope-regular",
    medium: "font-manrope-medium",
    semibold: "font-manrope-semibold",
    bold: "font-manrope-bold",
    extrabold: "font-manrope-extrabold",
  },
};

// Literal classes per color token. Two text-* color classes on one element resolve by stylesheet order,
// not className order, so color is a prop rather than a className override.
export const textColors = {
  primary: "text-primary",
  "on-primary": "text-on-primary",
  "primary-soft": "text-primary-soft",
  secondary: "text-secondary",
  "secondary-soft": "text-secondary-soft",
  "secondary-ink": "text-secondary-ink",
  ink: "text-ink",
  "ink-muted": "text-ink-muted",
  surface: "text-surface",
  canvas: "text-canvas",
  border: "text-border",
  glass: "text-glass",
  success: "text-success",
  "success-soft": "text-success-soft",
  danger: "text-danger",
  "danger-soft": "text-danger-soft",
  info: "text-info",
  "info-soft": "text-info-soft",
  neutral: "text-neutral",
  "neutral-soft": "text-neutral-soft",
  inverse: "text-inverse",
  "on-inverse": "text-on-inverse",
  "on-inverse-muted": "text-on-inverse-muted",
  white: "text-white",
} as const satisfies Record<ColorToken, string>;

// Design Board 03. Size, line height and tracking come from the --text-* tokens.
const variants = {
  display: { className: "text-display", color: "ink", weight: "extrabold" },
  number: { className: "text-number", color: "ink", weight: "extrabold" },
  heading: { className: "text-heading", color: "ink", weight: "bold" },
  title: { className: "text-title", color: "ink", weight: "extrabold" },
  button: { className: "text-button", color: "ink", weight: "bold" },
  body: { className: "text-body", color: "ink-muted", weight: "regular" },
  label: { className: "text-label", color: "ink", weight: "semibold" },
  caption: { className: "text-caption", color: "ink", weight: "medium" },
  footnote: { className: "text-footnote", color: "ink-muted", weight: "semibold" },
  micro: { className: "text-micro", color: "ink", weight: "semibold" },
} as const satisfies Record<string, { className: string; color: ColorToken; weight: Weight }>;

export type TextVariant = keyof typeof variants;

/** Font family class for a weight in the current script, for components that render their own Text or TextInput. */
export function useFontClass(weight: Weight): string {
  return families[useFontScript()][weight];
}

export function ThemedText({
  variant = "body",
  color,
  weight,
  className,
  ...props
}: TextProps & {
  variant?: TextVariant;
  color?: ColorToken;
  weight?: Weight;
  /** Layout only (margins, alignment). Size and color come from variant and color. */
  className?: string;
}) {
  const v = variants[variant];
  const fontClass = useFontClass(weight ?? v.weight);
  return (
    <Text
      className={`${v.className} ${textColors[color ?? v.color]} ${fontClass} ${className ?? ""}`}
      {...props}
    />
  );
}
