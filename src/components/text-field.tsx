import { useState, type ReactNode } from "react";
import { Pressable, TextInput, View, type TextInputProps } from "react-native";

import { Icon } from "./icon";
import type { IconName } from "./icons";
import { ThemedText, useFontClass } from "./themed-text";

// Design Board 05.
export function TextField({
  icon,
  trailing,
  error,
  secureTextEntry,
  secureToggleLabels,
  accessibilityLabel,
  className,
  onFocus,
  onBlur,
  onChangeText,
  ...props
}: TextInputProps & {
  icon?: IconName;
  trailing?: ReactNode;
  /** Shown under the field; also turns the border red. */
  error?: string;
  /** With secureTextEntry, adds a show/hide button with these labels. */
  secureToggleLabels?: { show: string; hide: string };
  /** Required: the design has no visible field labels. */
  accessibilityLabel: string;
  /** Layout only, applied to the outer wrapper. */
  className?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [typed, setTyped] = useState(props.defaultValue ?? "");
  const fontClass = useFontClass("medium");
  // The board mutes the leading icon only while the field is empty and idle.
  const empty = (props.value ?? typed) === "";

  const state = error
    ? "border-danger bg-surface"
    : focused
      ? "border-secondary-ink bg-surface shadow-focus"
      : "border-transparent bg-canvas";

  return (
    <View className={`gap-1.5 ${className ?? ""}`}>
      {/* 1.5px border from the board; no border-width token. */}
      <View className={`h-field flex-row items-center gap-3 rounded-md border-[1.5px] px-3.5 ${state}`}>
        {icon ? <Icon name={icon} size="sm" color={empty && !focused && !error ? "ink-muted" : "ink"} /> : null}
        <TextInput
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={error}
          secureTextEntry={secureTextEntry && hidden}
          onChangeText={(text) => {
            setTyped(text);
            onChangeText?.(text);
          }}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          className={`flex-1 self-stretch text-body text-ink placeholder:text-ink-muted web:outline-none ${fontClass}`}
          {...props}
        />
        {secureTextEntry && secureToggleLabels ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? secureToggleLabels.show : secureToggleLabels.hide}
            hitSlop={13}
            onPress={() => setHidden((h) => !h)}
          >
            <Icon name={hidden ? "hide" : "show"} size="sm" color="ink-muted" />
          </Pressable>
        ) : null}
        {trailing}
      </View>
      {error ? (
        <ThemedText variant="footnote" weight="regular" color="danger" className="ml-1">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}
