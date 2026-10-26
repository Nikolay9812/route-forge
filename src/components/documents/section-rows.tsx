import { Fragment } from "react";
import { Pressable, View } from "react-native";

import { Divider } from "@/components/divider";
import { Icon } from "@/components/icon";
import { Surface } from "@/components/surface";
import { Tag } from "@/components/tag";
import { ThemedText } from "@/components/themed-text";
import { detailsSections } from "@/domain/courier-details";
import type { CourierDocuments, DetailsSection, SectionState } from "@/domain/types";
import { useTranslation } from "@/i18n";

import { ExpiryLine, expiryText } from "./expiry-line";
import { sectionIcons } from "./fields";

// The nine document sections with their state, for the courier's Profile and the owner's courier screen. A
// warning wins over the state; a complete section without one shows a check instead of a tag.
export function SectionRows({
  documents: { sections, details, today },
  onOpen,
}: {
  documents: Pick<CourierDocuments, "sections" | "details" | "today">;
  onOpen: (section: DetailsSection) => void;
}) {
  const { t } = useTranslation();
  return (
    <Surface className="overflow-hidden">
      {detailsSections.map((section, i) => {
        const title = t(`documents.sections.${section}`);
        // ID card and licence show how long they stay valid under the title.
        const expiresOn =
          section === "idCard" ? details.idExpiresOn : section === "licence" ? details.licenceExpiresOn : null;
        const expiry = expiresOn ? expiryText(t, today, expiresOn).text : null;
        return (
          <Fragment key={section}>
            {i > 0 ? <Divider className="mx-4" /> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={[title, expiry, stateLabel(sections[section], t)].filter(Boolean).join(", ")}
              onPress={() => onOpen(section)}
              className="min-h-11 flex-row items-center gap-3 px-4 py-3 active:bg-secondary-soft"
            >
              <Icon name={sectionIcons[section]} color="ink" />
              <View className="flex-1">
                <ThemedText variant="body" color="ink" numberOfLines={1}>
                  {title}
                </ThemedText>
                {expiresOn ? <ExpiryLine today={today} expiresOn={expiresOn} /> : null}
              </View>
              <SectionStatus state={sections[section]} />
              <Icon name="chevron" size="sm" color="ink-muted" />
            </Pressable>
          </Fragment>
        );
      })}
    </Surface>
  );
}

type T = ReturnType<typeof useTranslation>["t"];

function stateLabel({ state, warning }: SectionState, t: T): string {
  if (warning) return t(`documents.warning.${warning}`);
  return t(`documents.state.${state === "complete" ? "done" : state}`);
}

function SectionStatus({ state }: { state: SectionState }) {
  const { t } = useTranslation();
  const label = stateLabel(state, t);
  if (state.warning === "expired") return <Tag tone="rejected" size="sm" label={label} />;
  if (state.warning) return <Tag tone="highlight" size="sm" label={label} />;
  if (state.state === "missing") return <Tag tone="draft" size="sm" label={label} />;
  if (state.state === "incomplete") return <Tag tone="info" size="sm" label={label} />;
  return (
    <View accessibilityLabel={label}>
      <Icon name="check" size="sm" color="success" />
    </View>
  );
}
