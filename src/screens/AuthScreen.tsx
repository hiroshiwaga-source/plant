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
import { getAuthEmailRedirectTo } from "../lib/authRedirect";
import { supabase } from "../lib/supabase";
import { palette, radius } from "../theme/gris";

const MIN_PASSWORD_LEN = 6;

type Banner = { text: string; tone: "info" | "error" };

const RATE_LIMIT_BANNER: Banner = {
  text:
    "Supabase の認証で一時的に制限されています。目安として 30〜60 分ほど空けてから、もう一度「ログイン」か「アカウント登録」を試してください。開発中に何度も試すと出やすくなります。",
  tone: "error",
};

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
    return RATE_LIMIT_BANNER;
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

function mapSignInError(error: AuthError): Banner {
  const m = error.message.toLowerCase();
  if (m.includes("rate limit")) {
    return RATE_LIMIT_BANNER;
  }
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
      options: {
        emailRedirectTo: getAuthEmailRedirectTo(),
      },
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
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.log(
        "[plant] メール確認後のリダイレクト先（Supabase の Redirect URLs に未登録だとリンクが失敗します）:",
        getAuthEmailRedirectTo(),
      );
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
        placeholderTextColor={palette.inkFaint}
        accessibilityLabel="メールアドレス"
      />
      <Text style={styles.label}>パスワード</Text>
      <TextInput
        style={styles.input}
        secureTextEntry
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
        placeholder={`${MIN_PASSWORD_LEN}文字以上`}
        placeholderTextColor={palette.inkFaint}
        accessibilityLabel="パスワード"
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
        accessibilityLabel="ログイン"
        accessibilityRole="button"
      >
        {loading ? (
          <ActivityIndicator color={palette.surfaceElevated} />
        ) : (
          <Text style={styles.buttonText}>ログイン</Text>
        )}
      </Pressable>
      <Pressable
        style={[styles.buttonSecondary, loading && styles.buttonDisabled]}
        onPress={() => void signUp()}
        disabled={loading}
        accessibilityLabel="アカウント登録"
        accessibilityRole="button"
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
    marginTop: 8,
  },
  label: {
    fontSize: 13,
    color: palette.inkMuted,
    marginBottom: 8,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.mist,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 18,
    backgroundColor: palette.surfaceElevated,
    color: palette.ink,
  },
  bannerInfo: {
    color: palette.haze,
    fontSize: 14,
    marginBottom: 18,
    lineHeight: 22,
    backgroundColor: palette.hazeBg,
    padding: 14,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  bannerError: {
    color: palette.rose,
    fontSize: 14,
    marginBottom: 18,
    lineHeight: 22,
    backgroundColor: palette.roseBg,
    padding: 14,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  button: {
    backgroundColor: palette.accent,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 14,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: palette.surfaceElevated,
    fontSize: 16,
    fontWeight: "500",
    letterSpacing: 1,
  },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: palette.mist,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: palette.surfaceElevated,
  },
  buttonSecondaryText: {
    color: palette.accentInk,
    fontSize: 16,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
});
