import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./src/lib/supabase";
import { AuthScreen } from "./src/screens/AuthScreen";
import { HomeScreen } from "./src/screens/HomeScreen";

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

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>plant</Text>
        <Text style={styles.sub}>植物の世話を記録するアプリ</Text>
        {!configured ? (
          <Text style={styles.muted}>
            `.env` に EXPO_PUBLIC_SUPABASE_URL と
            EXPO_PUBLIC_SUPABASE_ANON_KEY を設定してから、Expo
            を再起動してください。
          </Text>
        ) : session ? (
          <HomeScreen session={session} />
        ) : (
          <AuthScreen />
        )}
      </ScrollView>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scroll: {
    flexGrow: 1,
    padding: 24,
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
  },
  muted: {
    color: "#555",
    textAlign: "center",
    marginTop: 16,
    lineHeight: 22,
  },
});
