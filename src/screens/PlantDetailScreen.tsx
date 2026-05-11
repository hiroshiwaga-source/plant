import { useCallback, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { supabase } from "../lib/supabase";
import type { MainStackParamList } from "../navigation/types";
import { palette, radius, shadow } from "../theme/gris";
import type { CareLogType, Database } from "../types/database";

type Plant = Database["public"]["Tables"]["plants"]["Row"];
type CareLog = Database["public"]["Tables"]["care_logs"]["Row"];

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

  const load = useCallback(async () => {
    setError(null);
    const [{ data: p, error: pErr }, { data: l, error: lErr }] = await Promise.all([
      supabase.from("plants").select("*").eq("id", plantId).maybeSingle(),
      supabase
        .from("care_logs")
        .select("*")
        .eq("plant_id", plantId)
        .order("occurred_at", { ascending: false }),
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

      <Text style={styles.section}>記録を追加</Text>
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
});
