import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type Props = {
  session: Session;
};

export function HomeScreen({ session }: Props) {
  const email = session.user.email ?? "（メールなし）";

  return (
    <View style={styles.wrap}>
      <Text style={styles.greeting}>ログイン中</Text>
      <Text style={styles.email} numberOfLines={1}>
        {email}
      </Text>
      <Text style={styles.hint}>
        植物の一覧・登録などは、この後の画面から使えるようになります。
      </Text>
      <Pressable
        style={styles.outline}
        onPress={() => void supabase.auth.signOut()}
      >
        <Text style={styles.outlineText}>ログアウト</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    maxWidth: 400,
    marginTop: 24,
    alignItems: "stretch",
  },
  greeting: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1b5e20",
    marginBottom: 8,
  },
  email: {
    fontSize: 15,
    color: "#444",
    marginBottom: 16,
  },
  hint: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginBottom: 24,
  },
  outline: {
    borderWidth: 1,
    borderColor: "#c62828",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  outlineText: {
    color: "#c62828",
    fontSize: 16,
    fontWeight: "600",
  },
});
