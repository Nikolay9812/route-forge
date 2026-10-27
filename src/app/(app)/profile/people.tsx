import { router } from "expo-router";
import { Fragment, useState, type ReactNode } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import type { ApiFailure } from "@/api/client";
import { ActionSheet } from "@/components/action-sheet";
import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { Divider } from "@/components/divider";
import { useFormat } from "@/components/home/format";
import { SectionEntrance } from "@/components/home/section-entrance";
import { Notice } from "@/components/notice";
import { RateRow } from "@/components/pay-rates/rate-row";
import { Surface } from "@/components/surface";
import { Tag } from "@/components/tag";
import { ThemedText } from "@/components/themed-text";
import { todayIn } from "@/domain/dates";
import type { PendingInvitation, PeopleList, Person } from "@/domain/types";
import { useTranslation } from "@/i18n";
import { usePeople, usePeopleActions } from "@/people/people";
import { useThemeColor } from "@/theme";

const roles = ["owner", "dispatcher", "courier"] as const;

// The owner's people: owners (read-only), dispatchers with their depots, couriers, then pending invitations
// (tap to revoke). Inviting opens a form sheet; a member opens their own screen.
export default function PeopleScreen() {
  const { t } = useTranslation();
  const spinner = useThemeColor("secondary-ink");
  const { resource, refreshing, reload } = usePeople();
  const actions = usePeopleActions();
  const data = resource.status === "ready" ? resource.data : null;
  const [revoking, setRevoking] = useState<PendingInvitation | null>(null);
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  const revoke = async (invitation: PendingInvitation) => {
    setFailure(null);
    setFailure(await actions.revoke(invitation.id));
  };

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-4 px-4 pt-4 pb-8"
      refreshControl={
        data ? (
          <RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={spinner} colors={[spinner]} />
        ) : undefined
      }
    >
      {resource.status === "loading" ? (
        <View className="gap-4" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View className="h-button rounded-full bg-border" />
          <View className="h-24 rounded-lg bg-border" />
          <View className="h-40 rounded-lg bg-border" />
        </View>
      ) : resource.status === "failed" ? (
        resource.failure === "firmNotSetUp" ? (
          <Notice icon="settings" title={t("firm.notSetUp.title")} body={t("firm.notSetUp.body")} />
        ) : (
          <View className="gap-3">
            <Alert
              tone={resource.failure === "offline" ? "offline" : "danger"}
              message={resource.failure === "offline" ? t("people.offline") : t("people.error")}
            />
            <Button title={t("home.retry")} variant="secondary" onPress={() => reload()} />
          </View>
        )
      ) : (
        <>
          <SectionEntrance index={0}>
            <Button title={t("people.invite")} variant="secondary" onPress={() => router.push("/profile/invite")} />
          </SectionEntrance>
          {failure ? (
            <Alert
              tone={failure === "offline" ? "offline" : "danger"}
              message={failure === "offline" ? t("people.saveOffline") : t("people.saveError")}
            />
          ) : null}
          {roles.map((role, i) => (
            <MemberSection key={role} index={i + 1} role={role} list={resource.data} />
          ))}
          {resource.data.invitations.length > 0 ? (
            <SectionEntrance index={roles.length + 1}>
              <Group title={t("people.sections.pending")}>
                {resource.data.invitations.map((invitation, i) => (
                  <Fragment key={invitation.id}>
                    {i > 0 ? <Divider className="mx-4" /> : null}
                    <InvitationRow
                      invitation={invitation}
                      timeZone={resource.data.firm.timeZone}
                      currency={resource.data.firm.currency}
                      onPress={() => setRevoking(invitation)}
                    />
                  </Fragment>
                ))}
              </Group>
            </SectionEntrance>
          ) : null}
        </>
      )}
      <ActionSheet
        visible={revoking !== null}
        title={t("people.revoke.title", { email: revoking?.email ?? "" })}
        actions={[
          { label: t("people.revoke.action"), destructive: true, onPress: () => revoking && void revoke(revoking) },
        ]}
        cancelLabel={t("people.cancel")}
        onClose={() => setRevoking(null)}
      />
    </ScrollView>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <ThemedText variant="footnote" className="ml-1">
        {title}
      </ThemedText>
      <Surface className="overflow-hidden">{children}</Surface>
    </View>
  );
}

function MemberSection({ role, list, index }: { role: Person["role"]; list: PeopleList; index: number }) {
  const { t } = useTranslation();
  const members = list.members.filter((m) => m.role === role);
  if (members.length === 0) return null;
  return (
    <SectionEntrance index={index}>
      <Group title={t(`people.sections.${role}`)}>
        {members.map((member, i) => (
          <Fragment key={member.userId}>
            {i > 0 ? <Divider className="mx-4" /> : null}
            <RateRow
              title={member.name}
              detail={member.email}
              trailing={
                member.userId === list.you ? (
                  <Tag tone="role" size="sm" label={t("people.you")} />
                ) : role !== "dispatcher" ? null : member.depotIds.length === 0 ? (
                  <Tag tone="warning" size="sm" label={t("people.noDepots")} />
                ) : (
                  <Tag tone="muted" size="sm" label={t("people.depotCount", { count: member.depotIds.length })} />
                )
              }
              // Owners are managed in the Clerk dashboard, so their rows don't open anything.
              onPress={
                role === "owner"
                  ? undefined
                  : () => router.push({ pathname: "/profile/person", params: { userId: member.userId } })
              }
            />
          </Fragment>
        ))}
      </Group>
    </SectionEntrance>
  );
}

function InvitationRow({
  invitation,
  timeZone,
  currency,
  onPress,
}: {
  invitation: PendingInvitation;
  timeZone: string;
  currency: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const format = useFormat(timeZone, currency);
  const day = todayIn(timeZone, new Date(invitation.createdAt));
  return (
    <RateRow
      title={invitation.email}
      detail={t("people.invited", { role: t(`people.roles.${invitation.role}`), date: format.fullDay(day) })}
      onPress={onPress}
    />
  );
}
