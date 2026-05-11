import * as Linking from "expo-linking";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Same parameter order as @supabase/auth-js `parseParametersFromURL`:
 * hash first, then query overrides.
 */
export function parseAuthParamsFromUrl(href: string): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    const url = new URL(href);
    if (url.hash?.startsWith("#")) {
      try {
        const hashSearchParams = new URLSearchParams(url.hash.slice(1));
        hashSearchParams.forEach((value, key) => {
          result[key] = value;
        });
      } catch {
        /* ignore */
      }
    }
    url.searchParams.forEach((value, key) => {
      result[key] = value;
    });
  } catch {
    return result;
  }
  return result;
}

export function looksLikeSupabaseAuthRedirect(url: string): boolean {
  return (
    /(^|[#&?])access_token=/.test(url) ||
    /(^|[?&])code=/.test(url) ||
    /(^|[?&])error(_description)?=/.test(url)
  );
}

/**
 * After email confirmation, Supabase redirects here with tokens in the hash
 * (implicit flow) or `code` (PKCE). Call from `Linking` listeners.
 */
export async function consumeAuthSessionFromUrl(
  client: SupabaseClient,
  url: string,
): Promise<{ consumed: boolean; errorMessage?: string }> {
  if (!looksLikeSupabaseAuthRedirect(url)) {
    return { consumed: false };
  }
  const params = parseAuthParamsFromUrl(url);
  if (params.error || params.error_code) {
    return {
      consumed: true,
      errorMessage: params.error_description || params.error || "認証リンクでエラーが返されました。",
    };
  }
  if (params.code) {
    const { error } = await client.auth.exchangeCodeForSession(params.code);
    if (error) {
      return { consumed: true, errorMessage: error.message };
    }
    return { consumed: true };
  }
  const access_token = params.access_token;
  const refresh_token = params.refresh_token;
  if (access_token && refresh_token) {
    const { error } = await client.auth.setSession({ access_token, refresh_token });
    if (error) {
      return { consumed: true, errorMessage: error.message };
    }
    return { consumed: true };
  }
  return { consumed: false };
}

/**
 * Used as `signUp({ options: { emailRedirectTo } })`.
 * - Prefer `EXPO_PUBLIC_AUTH_EMAIL_REDIRECT_URL` (public https page) when set.
 * - Otherwise deep link into the app (requires Supabase Redirect URLs allow list).
 */
export function getAuthEmailRedirectTo(): string {
  const fixed = process.env.EXPO_PUBLIC_AUTH_EMAIL_REDIRECT_URL?.trim();
  if (fixed) {
    return fixed;
  }
  return Linking.createURL("auth/callback");
}
