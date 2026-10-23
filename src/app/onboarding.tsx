import { Image, type ImageSource } from "expo-image";
import { Link, router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type ScrollViewInstance } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import type { IconName } from "@/components/icons";
import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "@/i18n";

type Slide = { key: "log" | "approve" | "pay"; image: ImageSource; icon: IconName };

// Photos are from Unsplash, see assets/images/onboarding/CREDITS.md.
const slides: Slide[] = [
  { key: "log", image: require("@/assets/images/onboarding/log.jpg"), icon: "hours" },
  { key: "approve", image: require("@/assets/images/onboarding/approve.jpg"), icon: "approvals" },
  { key: "pay", image: require("@/assets/images/onboarding/pay.jpg"), icon: "salary" },
];

export default function Onboarding() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pager = useRef<ScrollViewInstance>(null);
  const [page, setPage] = useState(0);
  // Pages in a horizontal ScrollView have no definite height, so they get the pager's measured one.
  const [pagerHeight, setPagerHeight] = useState(0);
  const last = page === slides.length - 1;

  function goTo(index: number) {
    pager.current?.scrollTo({ x: index * width, animated: true });
    setPage(index);
  }

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="h-ghost flex-row items-center justify-between px-4">
        <View className="flex-row items-center gap-2">
          <View className="size-8 items-center justify-center rounded-sm bg-primary">
            <Icon name="route" size="sm" color="on-primary" />
          </View>
          <ThemedText variant="title">{t("app.name")}</ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => goTo(slides.length - 1)}
          disabled={last}
          hitSlop={12}
          className={last ? "opacity-0" : ""}
        >
          <ThemedText variant="label" color="secondary-ink">
            {t("onboarding.skip")}
          </ThemedText>
        </Pressable>
      </View>

      <View className="mt-2 flex-1" onLayout={(e) => setPagerHeight(e.nativeEvent.layout.height)}>
        <ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        >
          {slides.map((slide) => (
            <View key={slide.key} style={{ width, height: pagerHeight }}>
              <View className="mx-4 flex-1 overflow-hidden rounded-lg bg-neutral-soft">
                <Image
                  source={slide.image}
                  contentFit="cover"
                  transition={{ duration: 200, skipOnCacheHit: "all" }}
                  accessible={false}
                  style={StyleSheet.absoluteFill}
                />
                <View className="absolute bottom-0 left-0 m-4 h-tag flex-row items-center gap-1.5 rounded-full bg-glass px-3">
                  <Icon name={slide.icon} size="xs" />
                  <ThemedText variant="label" numberOfLines={1}>
                    {t(`onboarding.${slide.key}.eyebrow`)}
                  </ThemedText>
                </View>
              </View>
              {/* Room for a 2-line headline and 3 body lines, so the photo keeps its size across slides. */}
              <View className="min-h-45 px-4 pt-6">
                <ThemedText variant="display" accessibilityRole="header" numberOfLines={2} adjustsFontSizeToFit>
                  {t(`onboarding.${slide.key}.title`)}
                </ThemedText>
                <ThemedText variant="body" className="mt-3">
                  {t(`onboarding.${slide.key}.body`)}
                </ThemedText>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      <View className="gap-4 px-4 pt-6 pb-2">
        <View
          className="flex-row justify-center gap-2"
          accessible
          accessibilityLabel={t("onboarding.step", { current: page + 1, total: slides.length })}
        >
          {slides.map((slide, index) => (
            <Pressable key={slide.key} onPress={() => goTo(index)} hitSlop={8}>
              <View className={index === page ? "h-2 w-6 rounded-full bg-primary" : "size-2 rounded-full bg-border"} />
            </Pressable>
          ))}
        </View>
        {last ? (
          <Button title={t("onboarding.signIn")} onPress={() => router.push("/sign-in")} />
        ) : (
          <Button title={t("onboarding.next")} trailingIcon="arrow" onPress={() => goTo(page + 1)} />
        )}
        <Link href="/sign-up" asChild>
          <Pressable accessibilityRole="link" className="h-ghost items-center justify-center">
            <ThemedText variant="body" weight="semibold" color="secondary-ink">
              {t("onboarding.createAccount")}
            </ThemedText>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}
