import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./src/lib/supabase";
import { MainNavigator } from "./src/navigation/MainNavigator";
import { AuthScreen } from "./src/screens/AuthScreen";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [configured, setConfigured] = useState(false);

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
        <StatusBar style="auto" />
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
          <StatusBar style="auto" />
        </View>
      ) : (
        <NavigationContainer>
          <MainNavigator />
          <StatusBar style="auto" />
        </NavigationContainer>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  configRoot: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 24,
    paddingTop: 56,
    justifyContent: "center",
  },
  authWrap: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 24,
    paddingTop: 56,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1b5e20",
    marginBottom: 4,
  },
  sub: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  muted: {
    color: "#555",
    textAlign: "center",
    marginTop: 16,
    lineHeight: 22,
  },
});
