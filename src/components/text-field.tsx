import { useRef, useState, type ReactNode, type Ref } from "react";
import { Pressable, TextInput, View, type TextInputInstance, type TextInputProps } from "react-native";

import { Icon } from "./icon";
import type { IconName } from "./icons";
import { ThemedText, useFontClass } from "./themed-text";

// Design Board 05.
export function TextField({
  ref,
  label,
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
  ref?: Ref<TextInputInstance>;
  /** Visible label above the input; makes the field the taller two-line style. */
  label?: string;
  icon?: IconName;
  trailing?: ReactNode;
  /** Shown under the field; also turns the border red. */
  error?: string;
  /** With secureTextEntry, adds a show/hide button with these labels. */
  secureToggleLabels?: { show: string; hide: string };
  /** Required: unlabeled fields have no visible text, and labeled ones should repeat the label. */
  accessibilityLabel: string;
  /** Layout only, applied to the outer wrapper. */
  className?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [typed, setTyped] = useState(props.defaultValue ?? "");
  const inputRef = useRef<TextInputInstance>(null);
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
      {/* Tapping anywhere on the field (icon, label) focuses the input. */}
      <Pressable
        accessible={false}
        onPress={() => inputRef.current?.focus()}
        className={`${label ? "h-field-labeled" : "h-field"} flex-row items-center gap-3 rounded-md border-[1.5px] px-3.5 ${state}`}
      >
        {icon ? (
          <Icon
            name={icon}
            size={label ? "md" : "sm"}
            color={label || !(empty && !focused && !error) ? "ink" : "ink-muted"}
          />
        ) : null}
        <View className="flex-1 justify-center self-stretch">
          {label ? (
            <ThemedText variant="caption" accessible={false}>
              {label}
            </ThemedText>
          ) : null}
          <TextInput
            ref={(node) => {
              inputRef.current = node;
              if (typeof ref === "function") ref(node);
              else if (ref) ref.current = node;
            }}
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
            className={`${label ? "p-0 text-caption" : "flex-1 text-body"} self-stretch text-ink placeholder:text-ink-muted web:outline-none ${fontClass}`}
            {...props}
          />
        </View>
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
      </Pressable>
      {error ? (
        <ThemedText variant="footnote" weight="regular" color="danger" className="ml-1">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}
