// How each document field is typed in the section form. The rules themselves live in `@/domain/courier-details`.
import type { KeyboardTypeOptions } from "react-native";

import type { IconName } from "@/components/icons";
import type { CourierDetails, DetailsSection } from "@/domain/types";

export type FieldKind =
  | { kind: "text"; maxLength: number; keyboard?: KeyboardTypeOptions; caps?: "characters" | "words" | "none" }
  | { kind: "date"; role: "birth" | "issued" | "expires" }
  | { kind: "gender" }
  | { kind: "taxClass" }
  | { kind: "classes" };

/** Max lengths a little above the rules', so spaces typed in IBANs and numbers still fit. */
export const fieldKinds: Record<keyof CourierDetails, FieldKind> = {
  idNumber: { kind: "text", maxLength: 30, caps: "characters" },
  nationality: { kind: "text", maxLength: 80, caps: "words" },
  placeOfBirth: { kind: "text", maxLength: 80, caps: "words" },
  birthDate: { kind: "date", role: "birth" },
  gender: { kind: "gender" },
  idAddress: { kind: "text", maxLength: 200, caps: "words" },
  idIssuedOn: { kind: "date", role: "issued" },
  idExpiresOn: { kind: "date", role: "expires" },
  licenceNumber: { kind: "text", maxLength: 30, caps: "characters" },
  licenceClasses: { kind: "classes" },
  licenceIssuedOn: { kind: "date", role: "issued" },
  licenceExpiresOn: { kind: "date", role: "expires" },
  street: { kind: "text", maxLength: 200, caps: "words" },
  postcode: { kind: "text", maxLength: 5, keyboard: "number-pad" },
  city: { kind: "text", maxLength: 80, caps: "words" },
  taxId: { kind: "text", maxLength: 16, keyboard: "number-pad" },
  taxClass: { kind: "taxClass" },
  socialNumber: { kind: "text", maxLength: 16, caps: "characters" },
  healthInsurer: { kind: "text", maxLength: 80, caps: "words" },
  healthNumber: { kind: "text", maxLength: 12, caps: "characters" },
  criminalRecordIssuedOn: { kind: "date", role: "issued" },
  bankHolder: { kind: "text", maxLength: 80, caps: "words" },
  iban: { kind: "text", maxLength: 42, caps: "characters" },
  phone: { kind: "text", maxLength: 30, keyboard: "phone-pad" },
  emergencyName: { kind: "text", maxLength: 80, caps: "words" },
  emergencyPhone: { kind: "text", maxLength: 30, keyboard: "phone-pad" },
};

export const sectionIcons: Record<DetailsSection, IconName> = {
  idCard: "id-card",
  licence: "licence",
  address: "pin",
  tax: "tax",
  social: "social",
  health: "health",
  criminalRecord: "record",
  bank: "bank",
  contacts: "phone",
};

/** Fields with a hint under them, and sections with one above their fields. */
export const fieldHints = ["taxId", "socialNumber", "healthNumber"] as const;
export const sectionHints = ["address"] as const;
