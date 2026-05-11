import { useCallback, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { formatCareWhen } from "../lib/formatCareWhen";
import { pickAndUploadPlantPhoto } from "../lib/pickAndUploadPlantPhoto";
import { supabase } from "../lib/supabase";
import { invokeAiDiagnose, invokeCareRecommendations } from "../lib/supabaseEdge";
import type { MainStackParamList } from "../navigation/types";
import { palette, radius, shadow } from "../theme/gris";
import type { CareLogType, Database } from "../types/database";

type Plant = Database["public"]["Tables"]["plants"]["Row"];
type CareLog = Database["public"]["Tables"]["care_logs"]["Row"];
type PlantPhoto = Database["public"]["Tables"]["plant_photos"]["Row"];
type PlantDiagnosis = Database["public"]["Tables"]["plant_diagnoses"]["Row"];
type CareRecommendation = Database["public"]["Tables"]["care_recommendations"]["Row"];

function localDateYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type Nav = NativeStackNavigationProp<MainStackParamList, "PlantDetail">;
type PlantDetailRoute = RouteProp<MainStackParamList, "PlantDetail">;

const LOG_ACTIONS: { type: CareLogType; label: string }[] = [
  { type: "water", label: "水やり" },
  { type: "fertilizer", label: "肥料" },
  { type: "pruning", label: "剪定" },
  { type: "repotting", label: "植え替え" },
];

function logTypeLabel(t: CareLogType): string {
  const f = LOG_ACTIONS.find((x) => x.type === t);
  return f?.label ?? t;
}

export function PlantDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<PlantDetailRoute>();
  const { plantId } = route.params;

  const [plant, setPlant] = useState<Plant | null>(null);
  const [logs, setLogs] = useState<CareLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalType, setModalType] = useState<CareLogType | null>(null);
  const [modalNote, setModalNote] = useState("");

  const [photos, setPhotos] = useState<PlantPhoto[]>([]);
  const [photoPreviewUris, setPhotoPreviewUris] = useState<Record<string, string>>({});
  const [diagnoses, setDiagnoses] = useState<PlantDiagnosis[]>([]);
  const [todayCare, setTodayCare] = useState<CareRecommendation | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [careBusy, setCareBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const today = localDateYmd();
    const [
      { data: p, error: pErr },
      { data: l, error: lErr },
      { data: ph, error: phErr },
      { data: dx, error: dxErr },
      { data: rec, error: recErr },
    ] = await Promise.all([
      supabase.from("plants").select("*").eq("id", plantId).maybeSingle(),
      supabase
        .from("care_logs")
        .select("*")
        .eq("plant_id", plantId)
        .order("occurred_at", { ascending: false }),
      supabase
        .from("plant_photos")
        .select("*")
        .eq("plant_id", plantId)
        .order("created_at", { ascending: false }),
      supabase
        .from("plant_diagnoses")
        .select("*")
        .eq("plant_id", plantId)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("care_recommendations")
        .select("*")
        .eq("plant_id", plantId)
        .eq("for_date", today)
        .maybeSingle(),
    ]);
    if (pErr || !p) {
      setError("植物を読み込めませんでした。");
      setPlant(null);
    } else {
      setPlant(p);
    }
    if (lErr) {
      setLogs([]);
    } else {
      setLogs(l ?? []);
    }
    if (phErr) {
      setPhotos([]);
      setPhotoPreviewUris({});
    } else {
      setPhotos(ph ?? []);
      const uris: Record<string, string> = {};
      for (const row of ph ?? []) {
        const { data: signed, error: sErr } = await supabase.storage
          .from("plant-photos")
          .createSignedUrl(row.storage_path, 3600);
        if (!sErr && signed?.signedUrl) {
          uris[row.id] = signed.signedUrl;
        }
      }
      setPhotoPreviewUris(uris);
    }
    if (dxErr) {
      setDiagnoses([]);
    } else {
      setDiagnoses(dx ?? []);
    }
    if (recErr) {
      setTodayCare(null);
    } else {
      setTodayCare(rec ?? null);
    }
    setLoading(false);
  }, [plantId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate("PlantForm", { plantId })}
          hitSlop={12}
          style={styles.headerBtn}
          accessibilityLabel="植物を編集"
          accessibilityRole="button"
        >
          <Text style={styles.headerBtnText}>編集</Text>
        </Pressable>
      ),
    });
  }, [navigation, plantId]);

  function openLogModal(type: CareLogType) {
    setModalNote("");
    setModalType(type);
  }

  function closeLogModal() {
    setModalType(null);
    setModalNote("");
  }

  async function confirmLog() {
    if (!modalType) return;
    setSaving(true);
    setError(null);
    const noteTrim = modalNote.trim();
    const { error: iErr } = await supabase.from("care_logs").insert({
      plant_id: plantId,
      log_type: modalType,
      notes: noteTrim.length > 0 ? noteTrim : null,
    });
    setSaving(false);
    if (iErr) {
      setError("記録を追加できませんでした。");
      return;
    }
    closeLogModal();
    await load();
  }

  function confirmDelete() {
    Alert.alert(
      "植物を削除",
      "この植物と、紐づく世話の記録も削除されます。よろしいですか？",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除",
          style: "destructive",
          onPress: () => void deletePlant(),
        },
      ],
    );
  }

  async function deletePlant() {
    const { error: dErr } = await supabase.from("plants").delete().eq("id", plantId);
    if (dErr) {
      Alert.alert("エラー", "削除できませんでした。");
      return;
    }
    navigation.navigate("PlantsList");
  }

  async function addPlantPhoto() {
    setUploadingPhoto(true);
    setError(null);
    const result = await pickAndUploadPlantPhoto(plantId);
    setUploadingPhoto(false);
    if (!result.ok) {
      if (result.cancelled) return;
      setError(result.error);
      return;
    }
    await load();
  }

  async function runDiagnosis(withLatestPhoto: boolean) {
    const latestPhotoId = photos[0]?.id;
    if (withLatestPhoto && !latestPhotoId) {
      Alert.alert("写真がありません", "先に写真を追加するか、「写真なしで診断」を選んでください。");
      return;
    }
    setAiBusy(true);
    setError(null);
    try {
      await invokeAiDiagnose(plantId, withLatestPhoto ? latestPhotoId : undefined);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "AI診断に失敗しました。";
      setError(msg);
    } finally {
      setAiBusy(false);
    }
  }

  async function refreshCareRecommendation() {
    setCareBusy(true);
    setError(null);
    try {
      await invokeCareRecommendations(plantId, localDateYmd());
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ケア提案の取得に失敗しました。";
      setError(msg);
    } finally {
      setCareBusy(false);
    }
  }

  const modalTitle = modalType ? `${logTypeLabel(modalType)}を記録` : "";

  if (loading && !plant) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={palette.accent} />
      </View>
    );
  }

  if (!plant) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? "データがありません。"}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.inner}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.hero}>
        <Text style={styles.title} accessibilityRole="header">
          {plant.display_name?.trim() || "（名称未設定）"}
        </Text>
        {plant.species_name ? (
          <Text style={styles.species}>{plant.species_name}</Text>
        ) : null}
        {plant.notes ? <Text style={styles.notes}>{plant.notes}</Text> : null}
      </View>

      <Text style={styles.section}>写真</Text>
      <Text style={styles.hint}>アルバムから選ぶとクラウドに保存され、AI診断に使えます。</Text>
      <Pressable
        style={[styles.primaryOutlineBtn, uploadingPhoto && styles.actionBtnBusy]}
        onPress={() => void addPlantPhoto()}
        disabled={uploadingPhoto || saving}
        accessibilityLabel="写真を追加"
        accessibilityRole="button"
      >
        {uploadingPhoto ? (
          <ActivityIndicator color={palette.accentInk} />
        ) : (
          <Text style={styles.primaryOutlineBtnText}>写真を追加</Text>
        )}
      </Pressable>
      {photos.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.photoStrip}
          contentContainerStyle={styles.photoStripInner}
        >
          {photos.map((ph) =>
            photoPreviewUris[ph.id] ? (
              <Image
                key={ph.id}
                source={{ uri: photoPreviewUris[ph.id] }}
                style={styles.photoThumb}
                accessibilityLabel="植物の写真"
              />
            ) : (
              <View key={ph.id} style={[styles.photoThumb, styles.photoThumbPlaceholder]} />
            ),
          )}
        </ScrollView>
      ) : (
        <Text style={styles.emptyLogs}>まだ写真がありません。</Text>
      )}

      <Text style={styles.section}>AI による状態のメモ</Text>
      <Text style={styles.hint}>
        サーバー側で整理したメモです。病気の確定診断ではありません。不安なときは専門家に相談してください。
      </Text>
      <View style={styles.rowBtns}>
        <Pressable
          style={[
            styles.secondaryBtn,
            (aiBusy || photos.length === 0) && styles.actionBtnBusy,
          ]}
          onPress={() => void runDiagnosis(true)}
          disabled={aiBusy || photos.length === 0}
          accessibilityLabel="最新の写真でAI診断"
          accessibilityRole="button"
        >
          {aiBusy ? (
            <ActivityIndicator color={palette.accentInk} />
          ) : (
            <Text style={styles.secondaryBtnText}>最新の写真で診断</Text>
          )}
        </Pressable>
        <Pressable
          style={[styles.secondaryBtn, aiBusy && styles.actionBtnBusy]}
          onPress={() => void runDiagnosis(false)}
          disabled={aiBusy}
          accessibilityLabel="写真なしでAI診断"
          accessibilityRole="button"
        >
          <Text style={styles.secondaryBtnText}>写真なしで診断</Text>
        </Pressable>
      </View>
      {diagnoses.length === 0 ? (
        <Text style={styles.emptyLogs}>まだ診断結果がありません。</Text>
      ) : (
        diagnoses.map((d) => (
          <View key={d.id} style={styles.diagnosisCard}>
            <Text style={styles.diagnosisDate}>
              {new Date(d.created_at).toLocaleString("ja-JP", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
            <Text style={styles.diagnosisSummary}>{d.summary}</Text>
          </View>
        ))
      )}

      <Text style={styles.section}>今日のケア提案</Text>
      <Text style={styles.hint}>
        育成ログと本日の日付をもとにルールで提案します（Edge Functions のスタブ／ルール）。
      </Text>
      <Pressable
        style={[styles.primaryOutlineBtn, careBusy && styles.actionBtnBusy]}
        onPress={() => void refreshCareRecommendation()}
        disabled={careBusy}
        accessibilityLabel="今日のケア提案を取得"
        accessibilityRole="button"
      >
        {careBusy ? (
          <ActivityIndicator color={palette.accentInk} />
        ) : (
          <Text style={styles.primaryOutlineBtnText}>提案を取得・更新</Text>
        )}
      </Pressable>
      {todayCare ? (
        <View style={styles.careCard}>
          {(Array.isArray(todayCare.actions) ? todayCare.actions : []).map((item, i) => {
            const a = item as { kind?: string; note?: string };
            return (
              <Text key={i} style={styles.careLine}>
                • {a.note ?? ""}
              </Text>
            );
          })}
        </View>
      ) : (
        <Text style={styles.emptyLogs}>
          まだ今日の提案がありません。上のボタンで取得してください。
        </Text>
      )}

      <Text style={styles.section}>育成ログ</Text>
      <Text style={styles.hint}>
        タップ後にメモを付けられます（液肥の倍率・剪定部位など）。
      </Text>
      <View style={styles.actions}>
        {LOG_ACTIONS.map(({ type, label }) => (
          <Pressable
            key={type}
            style={[styles.actionBtn, saving && styles.actionBtnBusy]}
            onPress={() => openLogModal(type)}
            disabled={saving}
            accessibilityLabel={`${label}の記録を追加`}
            accessibilityRole="button"
          >
            <Text style={styles.actionBtnText}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>世話の履歴</Text>
      {logs.length === 0 ? (
        <Text style={styles.emptyLogs}>まだ記録がありません。</Text>
      ) : (
        logs.map((log) => (
          <View key={log.id} style={styles.logRow}>
            <View style={styles.logMain}>
              <Text style={styles.logType}>{logTypeLabel(log.log_type)}</Text>
              {log.notes ? (
                <Text style={styles.logNotes} numberOfLines={4}>
                  {log.notes}
                </Text>
              ) : null}
            </View>
            <Text style={styles.logDate}>{formatCareWhen(log.occurred_at)}</Text>
          </View>
        ))
      )}

      <Pressable
        style={styles.deleteBtn}
        onPress={confirmDelete}
        accessibilityLabel="この植物を削除"
        accessibilityRole="button"
      >
        <Text style={styles.deleteBtnText}>この植物を削除</Text>
      </Pressable>

      <Modal
        visible={modalType !== null}
        transparent
        animationType="fade"
        onRequestClose={closeLogModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <Text style={styles.modalLabel}>メモ（任意）</Text>
            <TextInput
              style={styles.modalInput}
              value={modalNote}
              onChangeText={setModalNote}
              placeholder="例: 花宝2倍希釈、強剪定、底面給水"
              placeholderTextColor={palette.inkFaint}
              multiline
              accessibilityLabel="この世話のメモ"
            />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancel}
                onPress={closeLogModal}
                disabled={saving}
                accessibilityLabel="キャンセル"
                accessibilityRole="button"
              >
                <Text style={styles.modalCancelText}>キャンセル</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSave, saving && styles.modalSaveDisabled]}
                onPress={() => void confirmLog()}
                disabled={saving}
                accessibilityLabel="記録を保存"
                accessibilityRole="button"
              >
                {saving ? (
                  <ActivityIndicator color={palette.surfaceElevated} />
                ) : (
                  <Text style={styles.modalSaveText}>記録する</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  inner: {
    padding: 22,
    paddingBottom: 44,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: palette.canvas,
    padding: 28,
  },
  headerBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerBtnText: {
    color: palette.accent,
    fontSize: 16,
    fontWeight: "500",
  },
  error: {
    color: palette.rose,
    marginBottom: 10,
    textAlign: "center",
    fontSize: 15,
  },
  hero: {
    backgroundColor: palette.surfaceElevated,
    borderRadius: radius.lg,
    padding: 20,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: palette.mistLight,
    ...shadow.card,
  },
  title: {
    fontSize: 21,
    fontWeight: "500",
    color: palette.ink,
    letterSpacing: 0.3,
  },
  species: {
    marginTop: 8,
    fontSize: 15,
    color: palette.accentInk,
    opacity: 0.9,
  },
  notes: {
    marginTop: 12,
    fontSize: 14,
    color: palette.inkMuted,
    lineHeight: 22,
  },
  section: {
    fontSize: 14,
    fontWeight: "500",
    color: palette.inkMuted,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  hint: {
    fontSize: 13,
    color: palette.inkFaint,
    marginBottom: 12,
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 28,
  },
  actionBtn: {
    backgroundColor: palette.surface,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.accentMuted,
    minWidth: "22%",
    alignItems: "center",
  },
  actionBtnBusy: {
    opacity: 0.65,
  },
  actionBtnText: {
    color: palette.accentInk,
    fontWeight: "500",
    fontSize: 14,
    letterSpacing: 0.3,
  },
  emptyLogs: {
    color: palette.inkFaint,
    marginBottom: 18,
    fontSize: 14,
  },
  logRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: palette.surfaceElevated,
    padding: 16,
    borderRadius: radius.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: palette.mistLight,
  },
  logMain: {
    flex: 1,
    minWidth: 0,
  },
  logType: {
    fontSize: 15,
    fontWeight: "500",
    color: palette.ink,
  },
  logNotes: {
    marginTop: 6,
    fontSize: 13,
    color: palette.inkMuted,
    lineHeight: 19,
  },
  logDate: {
    fontSize: 12,
    color: palette.inkFaint,
    flexShrink: 0,
  },
  deleteBtn: {
    marginTop: 30,
    paddingVertical: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: palette.mist,
    borderRadius: radius.md,
    backgroundColor: palette.roseBg,
  },
  deleteBtnText: {
    color: palette.rose,
    fontWeight: "500",
    fontSize: 14,
    letterSpacing: 0.4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(58, 54, 51, 0.38)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: palette.surfaceElevated,
    borderRadius: radius.lg,
    padding: 22,
    borderWidth: 1,
    borderColor: palette.mistLight,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "500",
    color: palette.ink,
    marginBottom: 18,
    letterSpacing: 0.3,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 8,
    color: palette.inkMuted,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: palette.mist,
    borderRadius: radius.md,
    padding: 14,
    minHeight: 92,
    textAlignVertical: "top",
    fontSize: 15,
    marginBottom: 22,
    backgroundColor: palette.surface,
    color: palette.ink,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  modalCancel: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  modalCancelText: {
    color: palette.inkMuted,
    fontSize: 15,
  },
  modalSave: {
    backgroundColor: palette.accent,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: radius.md,
    minWidth: 120,
    alignItems: "center",
  },
  modalSaveDisabled: {
    opacity: 0.55,
  },
  modalSaveText: {
    color: palette.surfaceElevated,
    fontSize: 15,
    fontWeight: "500",
    letterSpacing: 0.8,
  },
  primaryOutlineBtn: {
    alignSelf: "flex-start",
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.accentMuted,
    backgroundColor: palette.surface,
    marginBottom: 12,
    minWidth: 160,
    alignItems: "center",
  },
  primaryOutlineBtnText: {
    color: palette.accentInk,
    fontSize: 14,
    fontWeight: "500",
  },
  photoStrip: {
    marginBottom: 22,
    maxHeight: 120,
  },
  photoStripInner: {
    gap: 10,
    paddingVertical: 4,
  },
  photoThumb: {
    width: 108,
    height: 108,
    borderRadius: radius.md,
    backgroundColor: palette.mistLight,
  },
  photoThumbPlaceholder: {
    borderWidth: 1,
    borderColor: palette.mist,
  },
  rowBtns: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  secondaryBtn: {
    flexGrow: 1,
    minWidth: "42%",
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.accentMuted,
    backgroundColor: palette.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
  },
  secondaryBtnText: {
    color: palette.accentInk,
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  diagnosisCard: {
    backgroundColor: palette.surfaceElevated,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: palette.mistLight,
  },
  diagnosisDate: {
    fontSize: 12,
    color: palette.inkFaint,
    marginBottom: 8,
  },
  diagnosisSummary: {
    fontSize: 14,
    color: palette.inkMuted,
    lineHeight: 21,
  },
  careCard: {
    backgroundColor: palette.hazeBg,
    borderRadius: radius.md,
    padding: 16,
    marginTop: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: palette.mistLight,
  },
  careLine: {
    fontSize: 14,
    color: palette.ink,
    lineHeight: 22,
    marginBottom: 6,
  },
});
