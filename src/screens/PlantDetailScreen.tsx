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
        <ActivityIndicator size="large" color="#2e7d32" />
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
              placeholderTextColor="#999"
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
                  <ActivityIndicator color="#fff" />
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
    backgroundColor: "#f8faf8",
  },
  inner: {
    padding: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8faf8",
    padding: 24,
  },
  headerBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerBtnText: {
    color: "#1b5e20",
    fontSize: 16,
    fontWeight: "600",
  },
  error: {
    color: "#c62828",
    marginBottom: 8,
    textAlign: "center",
  },
  hero: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e0e8e0",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1b3d1b",
  },
  species: {
    marginTop: 6,
    fontSize: 15,
    color: "#558b2f",
  },
  notes: {
    marginTop: 10,
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
  },
  section: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  hint: {
    fontSize: 13,
    color: "#666",
    marginBottom: 10,
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 24,
  },
  actionBtn: {
    backgroundColor: "#e8f5e9",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#a5d6a7",
    minWidth: "22%",
    alignItems: "center",
  },
  actionBtnBusy: {
    opacity: 0.7,
  },
  actionBtnText: {
    color: "#1b5e20",
    fontWeight: "600",
    fontSize: 14,
  },
  emptyLogs: {
    color: "#888",
    marginBottom: 16,
  },
  logRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#eee",
  },
  logMain: {
    flex: 1,
    minWidth: 0,
  },
  logType: {
    fontSize: 15,
    fontWeight: "500",
    color: "#333",
  },
  logNotes: {
    marginTop: 4,
    fontSize: 13,
    color: "#555",
    lineHeight: 18,
  },
  logDate: {
    fontSize: 13,
    color: "#777",
    flexShrink: 0,
  },
  deleteBtn: {
    marginTop: 28,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ffcdd2",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  deleteBtnText: {
    color: "#c62828",
    fontWeight: "600",
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1b3d1b",
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 6,
    color: "#333",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    minHeight: 88,
    textAlignVertical: "top",
    fontSize: 15,
    marginBottom: 20,
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
    color: "#666",
    fontSize: 16,
  },
  modalSave: {
    backgroundColor: "#2e7d32",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 120,
    alignItems: "center",
  },
  modalSaveDisabled: {
    opacity: 0.6,
  },
  modalSaveText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
