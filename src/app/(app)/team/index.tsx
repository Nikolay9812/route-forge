import { router } from "expo-router";
import { Fragment } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { Divider } from "@/components/divider";
import { clock, initials } from "@/components/home/format";
import { SectionEntrance } from "@/components/home/section-entrance";
import { Icon } from "@/components/icon";
import { Notice } from "@/components/notice";
import { Surface } from "@/components/surface";
import { Tag } from "@/components/tag";
import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "@/i18n";
import { useDisplayName } from "@/people/display-name";
import { useTeam, type TeamMember } from "@/team/team";
import { useThemeColor } from "@/theme";

// The couriers a dispatcher (shifts in their depots) or owner (the whole firm) may see, with this month's totals.
// Tapping one opens their month calendar.
export default function Team() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const spinner = useThemeColor("secondary-ink");
  const { resource, refreshing, reload } = useTeam();
  const data = resource.status === "ready" ? resource.data : null;

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-6 px-4 pb-8"
      contentContainerStyle={{ paddingTop: Platform.OS === "ios" ? 8 : insets.top + 8 }}
      refreshControl={
        data ? (
          <RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={spinner} colors={[spinner]} />
        ) : undefined
      }
    >
      <SectionEntrance index={0}>
        <View className="flex-row items-start justify-between gap-3">
          <ThemedText variant="heading" accessibilityRole="header" className="flex-1">
            {t("team.title")}
          </ThemedText>
          {data ? <Tag tone="role" size="sm" label={data.firm.name} /> : null}
        </View>
      </SectionEntrance>

      {resource.status === "loading" ? (
        <View className="gap-3" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View className="h-16 rounded-md bg-border" />
          <View className="h-16 rounded-md bg-border" />
          <View className="h-16 rounded-md bg-border" />
        </View>
      ) : resource.status === "failed" ? (
        resource.failure === "role" ? (
          <Notice icon="profile" title={t("firm.roleNotYet.title")} body={t("firm.roleNotYet.body")} />
        ) : resource.failure === "firmNotSetUp" ? (
          <Notice icon="settings" title={t("firm.notSetUp.title")} body={t("firm.notSetUp.body")} />
        ) : (
          <View className="gap-3">
            <Alert
              tone={resource.failure === "offline" ? "offline" : "danger"}
              message={resource.failure === "offline" ? t("team.offline") : t("team.error")}
            />
            <Button title={t("home.retry")} variant="secondary" onPress={() => reload()} />
          </View>
        )
      ) : resource.data.couriers.length === 0 ? (
        <Notice icon="team" title={t("team.emptyTitle")} body={t("team.emptyBody")} />
      ) : (
        <SectionEntrance index={1}>
          <Surface className="overflow-hidden">
            {resource.data.couriers.map((member, i) => (
              <Fragment key={member.userId}>
                {i > 0 ? <Divider className="mx-4" /> : null}
                <MemberRow member={member} />
              </Fragment>
            ))}
          </Surface>
        </SectionEntrance>
      )}
    </ScrollView>
  );
}

// Full-width row: highlights its background on press.
function MemberRow({ member }: { member: TeamMember }) {
  const { t } = useTranslation();
  const name = useDisplayName()(member.name);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push({ pathname: "/team/[userId]", params: { userId: member.userId, name } })
      }
      className="min-h-16 flex-row items-center gap-3 px-4 py-3 active:bg-canvas"
    >
      <View className="size-10 items-center justify-center rounded-full bg-secondary-soft">
        <ThemedText variant="label" color="secondary-ink">
          {initials(name)}
        </ThemedText>
      </View>
      <View className="flex-1 gap-0.5">
        <ThemedText variant="body" color="ink" numberOfLines={1}>
          {name}
        </ThemedText>
        <ThemedText variant="footnote" numberOfLines={1}>
          {t("team.summary", { shifts: member.shifts, hours: t("units.time", { time: clock(member.minutes) }) })}
        </ThemedText>
      </View>
      {member.former ? <Tag tone="muted" size="sm" label={t("team.former")} /> : null}
      {member.waiting > 0 ? (
        <Tag tone="submitted" size="sm" label={t("team.waiting", { count: member.waiting })} />
      ) : null}
      <Icon name="chevron" size="sm" color="ink-muted" />
    </Pressable>
  );
}
