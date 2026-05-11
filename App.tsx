import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  DefaultTheme,
  NavigationContainer,
  type Theme,
} from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./src/lib/supabase";
import { MainNavigator } from "./src/navigation/MainNavigator";
import { AuthScreen } from "./src/screens/AuthScreen";
import { palette } from "./src/theme/gris";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [configured, setConfigured] = useState(false);

  const navigationTheme = useMemo<Theme>(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        primary: palette.accent,
        background: palette.canvas,
        card: palette.surfaceElevated,
        text: palette.ink,
        border: palette.mist,
        notification: palette.rose,
      },
    }),
    [],
  );

  useEffect(() => {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    setConfigured(Boolean(url && key));
  }, []);

  useEffect(() => {
    if (!configured) return;
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [configured]);

  if (!configured) {
    return (
      <View style={styles.configRoot}>
        <Text style={styles.title}>plant</Text>
        <Text style={styles.muted}>
          `.env` に EXPO_PUBLIC_SUPABASE_URL と
          EXPO_PUBLIC_SUPABASE_ANON_KEY を設定してから、Expo
          を再起動してください。
        </Text>
        <StatusBar style="dark" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      {!session ? (
        <View style={styles.authWrap}>
          <Text style={styles.title}>plant</Text>
          <Text style={styles.sub}>
            盆栽やビカクシダなど趣味の植物から、{"\n"}
            一般の観葉植物まで。世話を記録します。
          </Text>
          <AuthScreen />
          <StatusBar style="dark" />
        </View>
      ) : (
        <NavigationContainer theme={navigationTheme}>
          <MainNavigator />
          <StatusBar style="dark" />
        </NavigationContainer>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  configRoot: {
    flex: 1,
    backgroundColor: palette.canvas,
    padding: 28,
    paddingTop: 56,
    justifyContent: "center",
  },
  authWrap: {
    flex: 1,
    backgroundColor: palette.canvas,
    paddingHorizontal: 28,
    paddingTop: 56,
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "300",
    letterSpacing: 10,
    color: palette.ink,
    marginBottom: 12,
    textTransform: "lowercase",
  },
  sub: {
    fontSize: 15,
    color: palette.inkMuted,
    marginBottom: 20,
    textAlign: "center",
    lineHeight: 24,
    fontWeight: "400",
    maxWidth: 320,
  },
  muted: {
    color: palette.inkMuted,
    textAlign: "center",
    marginTop: 16,
    lineHeight: 24,
    fontSize: 15,
  },
});
