import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./src/lib/supabase";

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
    <View style={styles.container}>
      <Text style={styles.title}>plant</Text>
      <Text style={styles.muted}>
        {!configured
          ? "Configure EXPO_PUBLIC_SUPABASE_* in .env (see .env.example)."
          : session
            ? `Signed in (${session.user.id.slice(0, 8)}…)`
            : "Signed out — use Auth screens next."}
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 8,
  },
  muted: {
    color: "#555",
    textAlign: "center",
  },
});
