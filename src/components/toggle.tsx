import { Switch, type SwitchProps } from "react-native";

import { useThemeColor } from "@/theme";

// Design Board 13: the native switch, tinted amber when on.
export function Toggle(props: SwitchProps) {
  const off = useThemeColor("border");
  const on = useThemeColor("primary");
  const thumb = useThemeColor("white");
  // react-native-web colors the "on" thumb with its own activeThumbColor prop (teal by default).
  const webProps = { activeThumbColor: thumb } as object;
  return (
    <Switch
      trackColor={{ false: off, true: on }}
      ios_backgroundColor={off}
      thumbColor={thumb}
      {...webProps}
      {...props}
    />
  );
}
