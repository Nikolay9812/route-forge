import { TextField } from "@/components/text-field";
import type { IconName } from "@/components/icons";
import { digitsOnly } from "@/shifts/draft";

// A labeled field for whole numbers (km, packages): number keypad, digits only.
export function NumberField({
  label,
  icon,
  value,
  onChange,
  error,
  editable = true,
  className,
}: {
  label: string;
  icon?: IconName;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  editable?: boolean;
  /** Layout only. */
  className?: string;
}) {
  return (
    <TextField
      label={label}
      accessibilityLabel={label}
      icon={icon}
      value={value}
      onChangeText={(text) => onChange(digitsOnly(text))}
      keyboardType="number-pad"
      inputMode="numeric"
      placeholder="0"
      maxLength={7}
      error={error}
      editable={editable}
      className={className}
    />
  );
}
