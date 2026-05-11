import type { ImagePickerAsset, ImagePickerResult } from "expo-image-picker";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import { supabase } from "./supabase";

export type UploadPlantPhotoResult =
  | { ok: true; photoId: string }
  | { ok: false; error: string; cancelled?: boolean };

export type PlantPhotoSource = "library" | "camera";

function mediaLibraryAllowed(
  res: ImagePicker.MediaLibraryPermissionResponse,
): boolean {
  if (res.granted) return true;
  if (res.accessPrivileges === "limited") return true;
  return false;
}

async function uploadFromAsset(
  plantId: string,
  asset: ImagePickerAsset,
): Promise<UploadPlantPhotoResult> {
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

/**
 * アルバムまたはカメラで取得した画像を Storage へ保存（`plant_photos` 先行登録）。
 *
 * - ライブラリ: `allowsEditing: false` で iOS は PHPicker になりやすく、フル許可が不要な場合があります。
 * - カメラ: 撮影前にカメラ許可を求めます。
 */
export async function pickAndUploadPlantPhoto(
  plantId: string,
  source: PlantPhotoSource = "library",
): Promise<UploadPlantPhotoResult> {
  if (source === "library") {
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

    return uploadFromAsset(plantId, picked.assets[0]);
  }

  const camPerm = await ImagePicker.requestCameraPermissionsAsync();
  if (!camPerm.granted) {
    return {
      ok: false,
      error:
        "カメラへのアクセスが許可されていません。設定アプリでこのアプリへのカメラの許可をオンにしてください。",
    };
  }

  let picked: ImagePickerResult;
  try {
    picked = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.85,
    });
  } catch {
    return {
      ok: false,
      error:
        "カメラを起動できませんでした。シミュレータでは利用できないことがあります。実機で試すか、アルバムから選んでください。",
    };
  }

  if (picked.canceled || !picked.assets?.[0]) {
    return { ok: false, error: "", cancelled: true };
  }

  return uploadFromAsset(plantId, picked.assets[0]);
}
