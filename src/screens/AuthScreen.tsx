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
import type { AuthError } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

const MIN_PASSWORD_LEN = 6;

type Banner = { text: string; tone: "info" | "error" };

function mapSignUpError(error: AuthError): Banner {
  const m = error.message.toLowerCase();
  if (m.includes("already") || m.includes("registered")) {
    return {
      text: "このメールアドレスは既に登録されています。「ログイン」を試してください。",
      tone: "error",
    };
  }
  if (m.includes("password") && (m.includes("least") || m.includes("short"))) {
    return {
      text: `パスワードは${MIN_PASSWORD_LEN}文字以上にしてください。`,
      tone: "error",
    };
  }
  if (m.includes("rate limit")) {
    return {
      text: "試行回数が多すぎます。しばらく待ってから再度お試しください。",
      tone: "error",
    };
  }
  if (m.includes("invalid") && m.includes("email")) {
    return {
      text: "メールアドレスの形式が正しくない可能性があります。",
      tone: "error",
    };
  }
  if (m.includes("signup") && m.includes("disabled")) {
    return {
      text: "現在、新規登録を受け付けていません。管理者に問い合わせてください。",
      tone: "error",
    };
  }
  return {
    text: "登録できませんでした。入力内容と通信環境を確認してください。",
    tone: "error",
  };
}

function mapSignInError(_error: AuthError): Banner {
  return {
    text: "ログインできませんでした。メール・パスワード、またはメール確認が済んでいるか確認してください。",
    tone: "error",
  };
}

export function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);

  function validateInputs(): boolean {
    if (!email.trim()) {
      setBanner({ text: "メールアドレスを入力してください。", tone: "error" });
      return false;
    }
    if (password.length < MIN_PASSWORD_LEN) {
      setBanner({
        text: `パスワードは${MIN_PASSWORD_LEN}文字以上入力してください。`,
        tone: "error",
      });
      return false;
    }
    return true;
  }

  async function signIn() {
    setBanner(null);
    if (!validateInputs()) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) {
      setBanner(mapSignInError(error));
      return;
    }
  }

  async function signUp() {
    setBanner(null);
    if (!validateInputs()) return;
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) {
      setBanner(mapSignUpError(error));
      return;
    }
    if (data.session) {
      setBanner(null);
      return;
    }
    setBanner({
      text: "確認用メールを送信しました。届いたリンクを開いてから「ログイン」してください。",
      tone: "info",
    });
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
        placeholder={`${MIN_PASSWORD_LEN}文字以上`}
        placeholderTextColor="#999"
      />
      {banner ? (
        <Text
          style={
            banner.tone === "error" ? styles.bannerError : styles.bannerInfo
          }
        >
          {banner.text}
        </Text>
      ) : null}
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
  bannerInfo: {
    color: "#1565c0",
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  bannerError: {
    color: "#c62828",
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
