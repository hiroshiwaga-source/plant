import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";

export function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function signIn() {
    setMessage(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) {
      setMessage("ログインできませんでした。メールとパスワードを確認してください。");
      return;
    }
  }

  async function signUp() {
    setMessage(null);
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) {
      setMessage("登録できませんでした。パスワードの長さや既存アカウントを確認してください。");
      return;
    }
    if (data.session) {
      return;
    }
    setMessage(
      "確認用メールを送信しました。メール内のリンクを開いてから、もう一度ログインしてください。",
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.label}>メールアドレス</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        placeholderTextColor="#999"
      />
      <Text style={styles.label}>パスワード</Text>
      <TextInput
        style={styles.input}
        secureTextEntry
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
        placeholder="6文字以上推奨"
        placeholderTextColor="#999"
      />
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={() => void signIn()}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>ログイン</Text>
        )}
      </Pressable>
      <Pressable
        style={[styles.buttonSecondary, loading && styles.buttonDisabled]}
        onPress={() => void signUp()}
        disabled={loading}
      >
        <Text style={styles.buttonSecondaryText}>アカウント登録</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    maxWidth: 400,
    marginTop: 24,
  },
  label: {
    fontSize: 14,
    color: "#333",
    marginBottom: 6,
    fontWeight: "500",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: "#fafafa",
  },
  message: {
    color: "#1565c0",
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  button: {
    backgroundColor: "#2e7d32",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: "#2e7d32",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonSecondaryText: {
    color: "#2e7d32",
    fontSize: 16,
    fontWeight: "600",
  },
});
