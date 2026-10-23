import type { AndroidSymbol, SFSymbol } from "expo-symbols";

type Symbol = { ios: SFSymbol; android: AndroidSymbol };

// Design Board 11 names → SF Symbols (iOS) and Material Symbols (Android, web). Screens use these names only.
export const icons = {
  home: { ios: "house", android: "home" },
  hours: { ios: "clock", android: "schedule" },
  packages: { ios: "shippingbox", android: "package_2" },
  km: { ios: "gauge.with.dots.needle.50percent", android: "speed" },
  car: { ios: "truck.box", android: "local_shipping" },
  depot: { ios: "building.2", android: "warehouse" },
  shifts: { ios: "calendar", android: "calendar_month" },
  salary: { ios: "creditcard", android: "account_balance_wallet" },
  approvals: { ios: "tray", android: "inbox" },
  profile: { ios: "person", android: "person" },
  settings: { ios: "gearshape", android: "settings" },
  offline: { ios: "wifi.slash", android: "wifi_off" },
  search: { ios: "magnifyingglass", android: "search" },
  filter: { ios: "slider.horizontal.3", android: "tune" },
  check: { ios: "checkmark", android: "check" },
  close: { ios: "xmark", android: "close" },
  alert: { ios: "exclamationmark", android: "priority_high" },
  chevron: { ios: "chevron.right", android: "chevron_right" },
  arrow: { ios: "arrow.right", android: "arrow_forward" },
  plus: { ios: "plus", android: "add" },
  minus: { ios: "minus", android: "remove" },
  lock: { ios: "lock", android: "lock" },
  show: { ios: "eye", android: "visibility" },
  hide: { ios: "eye.slash", android: "visibility_off" },
  list: { ios: "list.bullet", android: "list" },
  doc: { ios: "doc.text", android: "description" },
  language: { ios: "globe", android: "language" },
  "sign-out": { ios: "rectangle.portrait.and.arrow.right", android: "logout" },
  pin: { ios: "mappin", android: "location_on" },
  route: { ios: "point.topleft.down.to.point.bottomright.curvepath", android: "route" },
} as const satisfies Record<string, Symbol>;

export type IconName = keyof typeof icons;
