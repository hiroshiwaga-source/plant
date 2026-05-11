import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import { supabase } from "./supabase";

export type UploadPlantPhotoResult =
  | { ok: true; photoId: string }
  | { ok: false; error: string; cancelled?: boolean };

function mediaLibraryAllowed(
  res: ImagePicker.MediaLibraryPermissionResponse,
): boolean {
  if (res.granted) return true;
  // iOS 14+ 「選択した写真のみ」
  if (res.accessPrivileges === "limited") return true;
  return false;
}

/**
 * Inserts `plant_photos` then uploads to Storage (`plant-photos`), per DATABASE_SCHEMA order.
 *
 * `allowsEditing: false` で iOS は PHPicker を使い、フルライブラリ許可が不要な場合があります。
 * （`allowsEditing: true` は旧 UIImagePicker になり、許可が必須になりやすい。）
 */
export async function pickAndUploadPlantPhoto(plantId: string): Promise<UploadPlantPhotoResult> {
  // Android はギャラリー読み取りの明示許可が必要なことが多い。
  if (Platform.OS === "android") {
    const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!mediaLibraryAllowed(libPerm)) {
      return {
        ok: false,
        error:
          "写真ライブラリへのアクセスが許可されていません。設定アプリでこのアプリへの写真の許可をオンにしてください。",
      };
    }
  }

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: false,
    quality: 0.85,
  });

  if (picked.canceled || !picked.assets?.[0]) {
    return { ok: false, error: "", cancelled: true };
  }

  const asset = picked.assets[0];
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "ログインが必要です。" };
  }

  const photoId = crypto.randomUUID();
  const storagePath = `${user.id}/${plantId}/${photoId}`;
  const contentType = asset.mimeType ?? "image/jpeg";

  const fileRes = await fetch(asset.uri);
  const buf = await fileRes.arrayBuffer();

  const { error: insertErr } = await supabase.from("plant_photos").insert({
    id: photoId,
    plant_id: plantId,
    storage_path: storagePath,
    content_type: contentType,
    byte_size: buf.byteLength,
  });

  if (insertErr) {
    return { ok: false, error: "写真の登録に失敗しました。" };
  }

  const { error: uploadErr } = await supabase.storage.from("plant-photos").upload(storagePath, buf, {
    contentType,
    upsert: false,
  });

  if (uploadErr) {
    await supabase.from("plant_photos").delete().eq("id", photoId);
    return { ok: false, error: "写真のアップロードに失敗しました。" };
  }

  return { ok: true, photoId };
}
