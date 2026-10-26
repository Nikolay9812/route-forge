// Dev-only showcase of the design system, sectioned like the Design Board.
// Sample copy is hardcoded on purpose: this screen never ships (see prompts/02-design-system.md).
import { Image } from "expo-image";
import { Redirect, Stack } from "expo-router";
import { useState, type PropsWithChildren, type ReactNode } from "react";
import { ScrollView, View } from "react-native";

import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { Chip } from "@/components/chip";
import { Divider } from "@/components/divider";
import { Icon } from "@/components/icon";
import { IconButton } from "@/components/icon-button";
import { icons, type IconName } from "@/components/icons";
import { SegmentedControl } from "@/components/segmented-control";
import { Stepper } from "@/components/stepper";
import { Surface } from "@/components/surface";
import { Tag } from "@/components/tag";
import { TextField } from "@/components/text-field";
import { ThemedText, type TextVariant } from "@/components/themed-text";
import { Toggle } from "@/components/toggle";
import { colorTokens, FontScriptProvider } from "@/theme";

const swatchClasses: Record<(typeof colorTokens)[number], string> = {
  primary: "bg-primary",
  "on-primary": "bg-on-primary",
  "primary-soft": "bg-primary-soft",
  secondary: "bg-secondary",
  "secondary-soft": "bg-secondary-soft",
  "secondary-ink": "bg-secondary-ink",
  ink: "bg-ink",
  "ink-muted": "bg-ink-muted",
  surface: "bg-surface",
  canvas: "bg-canvas",
  border: "bg-border",
  glass: "bg-glass",
  success: "bg-success",
  "success-soft": "bg-success-soft",
  danger: "bg-danger",
  "danger-soft": "bg-danger-soft",
  info: "bg-info",
  "info-soft": "bg-info-soft",
  neutral: "bg-neutral",
  "neutral-soft": "bg-neutral-soft",
  inverse: "bg-inverse",
  "on-inverse": "bg-on-inverse",
  "on-inverse-muted": "bg-on-inverse-muted",
  white: "bg-white",
  scrim: "bg-scrim",
};

// Board 03: units next to a number are 15 SemiBold ink-muted.
function Unit({ children }: PropsWithChildren) {
  return (
    <ThemedText variant="body" weight="semibold">
      {children}
    </ThemedText>
  );
}

const typeSamples: [TextVariant, ReactNode, ReactNode][] = [
  ["display", "Log today's shift", "Подай смяната"],
  ["heading", "Sofia North Depot", "Депо София Север"],
  [
    "number",
    <>
      8<Unit> h </Unit>24<Unit> min</Unit>
    </>,
    <>
      8<Unit> ч </Unit>24<Unit> мин</Unit>
    </>,
  ],
  ["title", "Thursday shift", "Смяна в четвъртък"],
  ["button", "Submit shift", "Изпрати смяната"],
  [
    "body",
    "Add your hours, packages and kilometers. Your dispatcher approves the shift before it counts toward pay.",
    "Въведете часове, пратки и километри.",
  ],
  ["label", "Schicht einreichen", "Филтър по депо"],
  ["caption", "CA 4821 KM · Sofia North", "CA 4821 KM · София Север"],
  ["footnote", "More than 800 km in one shift.", "Повече от 800 км за една смяна."],
  ["micro", "Today", "Днес"],
];

function Section({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <Surface className="gap-3.5 p-4.5">
      <ThemedText variant="label" weight="bold">
        {title}
      </ThemedText>
      {children}
    </Surface>
  );
}

export default function DesignSystem() {
  const [status, setStatus] = useState("This week");
  const [depot, setDepot] = useState("all");
  const [view, setView] = useState<"list" | "calendar">("list");
  const [period, setPeriod] = useState<"week" | "month">("month");
  const [reminders, setReminders] = useState(true);
  const [darkMap, setDarkMap] = useState(false);
  const [packages, setPackages] = useState(142);
  const [loading, setLoading] = useState(false);

  if (!__DEV__) return <Redirect href="/" />;

  return (
    <ScrollView contentContainerClassName="gap-3 px-4 py-5" contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: "Design system" }} />

      <Section title="02. Color palette">
        <View className="flex-row flex-wrap gap-3">
          {colorTokens.map((token) => (
            <View key={token} className="w-24 gap-1">
              <View className={`h-14.5 rounded-md border border-border ${swatchClasses[token]}`} />
              <ThemedText variant="micro">{token}</ThemedText>
            </View>
          ))}
        </View>
      </Section>

      <Section title="03. Typography">
        {typeSamples.map(([variant, latin, cyrillic]) => (
          <View key={variant} className="gap-1">
            <ThemedText variant="footnote">{variant}</ThemedText>
            <ThemedText variant={variant}>{latin}</ThemedText>
            <FontScriptProvider script="cyrillic">
              <ThemedText variant={variant}>{cyrillic}</ThemedText>
            </FontScriptProvider>
          </View>
        ))}
      </Section>

      <Section title="04. Buttons">
        <Button title="Submit shift" trailingIcon="arrow" />
        <Button title="Save as draft" variant="secondary" />
        <Button title="Reject shift" variant="destructive" />
        <Button title="Submit shift" loading={loading} onPress={() => setLoading(true)} />
        <Button title="Submit shift" disabled />
        <Button title="Submit shift" size="sm" />
        <Button
          title="Continue with Google"
          variant="secondary"
          size="social"
          leading={<Image source={require("@/assets/images/auth/google-g.png")} style={{ width: 20, height: 20 }} />}
        />
        <Divider label="or" />
        <View className="flex-row gap-2.5">
          <IconButton icon="plus" variant="primary" accessibilityLabel="New shift" />
          <IconButton icon="search" accessibilityLabel="Search" />
          <IconButton icon="shifts" accessibilityLabel="Calendar" />
          <IconButton icon="filter" accessibilityLabel="Filter" />
          <IconButton icon="back" variant="outline" size="sm" accessibilityLabel="Back" />
        </View>
      </Section>

      <Section title="05. Input fields">
        <TextField icon="search" defaultValue="Shifts this week" accessibilityLabel="Search" trailing={<Icon name="filter" size="sm" />} />
        <TextField icon="car" placeholder="Plate number" accessibilityLabel="Plate number" />
        <TextField icon="packages" defaultValue="142" keyboardType="number-pad" accessibilityLabel="Packages" />
        <TextField icon="km" defaultValue="1260 km" error="More than 800 km in one shift. Check the number." accessibilityLabel="Kilometers" />
        <TextField label="Email address" icon="mail" placeholder="you@example.com" accessibilityLabel="Email address" />
        <TextField
          icon="lock"
          defaultValue="hunter2hunter"
          secureTextEntry
          secureToggleLabels={{ show: "Show password", hide: "Hide password" }}
          accessibilityLabel="Password"
        />
      </Section>

      <Section title="06. Filter chips">
        <View className="flex-row flex-wrap gap-2">
          {["This week", "Submitted", "Rejected", "Approved"].map((s) => (
            <Chip key={s} label={s} selected={status === s} onPress={() => setStatus(s)} />
          ))}
        </View>
        <View className="flex-row flex-wrap gap-2">
          {[
            ["all", "All depots", "depot"],
            ["sofia", "Sofia North", "pin"],
            ["plovdiv", "Plovdiv", "pin"],
            ["varna", "Varna", "pin"],
          ].map(([value, label, icon]) => (
            <Chip
              key={value}
              label={label}
              icon={icon as IconName}
              tone="primary"
              selected={depot === value}
              onPress={() => setDepot(value)}
            />
          ))}
        </View>
      </Section>

      <Section title="11. Iconography">
        <View className="flex-row flex-wrap gap-y-3">
          {(Object.keys(icons) as IconName[]).map((name) => (
            <View key={name} className="w-1/4 items-center gap-1">
              <Icon name={name} />
              <ThemedText variant="micro" color="ink-muted">
                {name}
              </ThemedText>
            </View>
          ))}
        </View>
      </Section>

      <Section title="12. Segmented control">
        <SegmentedControl
          options={[
            { value: "list", label: "List", icon: "list" },
            { value: "calendar", label: "Calendar", icon: "shifts" },
          ]}
          value={view}
          onChange={setView}
        />
        <SegmentedControl
          options={[
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
          ]}
          value={period}
          onChange={setPeriod}
        />
      </Section>

      <Section title="13. Toggles / Steppers">
        <View className="flex-row items-center justify-between">
          <ThemedText variant="label">Shift reminders</ThemedText>
          <Toggle value={reminders} onValueChange={setReminders} accessibilityLabel="Shift reminders" />
        </View>
        <View className="flex-row items-center justify-between">
          <ThemedText variant="label">Dark map</ThemedText>
          <Toggle value={darkMap} onValueChange={setDarkMap} accessibilityLabel="Dark map" />
        </View>
        <View className="flex-row items-center justify-between">
          <ThemedText variant="label">Packages</ThemedText>
          <Stepper
            value={packages}
            onChange={setPackages}
            accessibilityLabel="Packages"
            decrementLabel="Less"
            incrementLabel="More"
          />
        </View>
      </Section>

      <Section title="14. Status / Alerts">
        <Alert tone="success" message="Shift sent for approval" onDismiss={() => {}} dismissLabel="Dismiss" />
        <Alert tone="danger" message="Couldn't save. Try again." onDismiss={() => {}} dismissLabel="Dismiss" />
        <Alert tone="offline" message="No connection. What you typed stays here." onDismiss={() => {}} dismissLabel="Dismiss" />
      </Section>

      <Section title="15. Tags / Badges">
        <View className="flex-row flex-wrap gap-2">
          <Tag tone="draft" label="Draft" />
          <Tag tone="submitted" label="Submitted" />
          <Tag tone="approved" label="Approved" />
          <Tag tone="rejected" label="Rejected" />
          <Tag tone="approved" label="Approved" size="sm" />
        </View>
        <View className="flex-row flex-wrap gap-2">
          <Tag tone="role" label="Owner" />
          <Tag tone="role" label="Dispatcher" />
          <Tag tone="role" label="Courier" />
          <Tag tone="highlight" label="New rate from 1 Nov" />
          <Tag tone="info" label="Corrected" />
        </View>
      </Section>

      <Section title="Surfaces">
        <Surface variant="outlined" className="p-4">
          <ThemedText variant="title">Outlined surface</ThemedText>
          <ThemedText>For cards inside a raised panel.</ThemedText>
        </Surface>
      </Section>
    </ScrollView>
  );
}
