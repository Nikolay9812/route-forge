import { SymbolView } from "expo-symbols";

import { useThemeColor, type ColorToken } from "@/theme";

import { icons, type IconName } from "./icons";

// Design Board 11: 22 default, 18 sm, 15 xs.
const sizes = { md: 22, sm: 18, xs: 15 } as const;

export function Icon({
  name,
  size = "md",
  color = "ink",
  className,
}: {
  name: IconName;
  size?: keyof typeof sizes;
  color?: ColorToken;
  className?: string;
}) {
  const { ios, android } = icons[name];
  return (
    <SymbolView
      name={{ ios, android, web: android }}
      size={sizes[size]}
      tintColor={useThemeColor(color)}
      className={className}
      accessible={false}
    />
  );
}
