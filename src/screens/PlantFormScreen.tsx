import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import type { MainStackParamList } from "../navigation/types";
import { palette, radius } from "../theme/gris";

type Nav = NativeStackNavigationProp<MainStackParamList, "PlantForm">;
type PlantFormRoute = RouteProp<MainStackParamList, "PlantForm">;

export function PlantFormScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<PlantFormRoute>();
  const plantId = route.params?.plantId;

  const [displayName, setDisplayName] = useState("");
  const [speciesName, setSpeciesName] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(!!plantId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!plantId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error: qErr } = await supabase
        .from("plants")
        .select("display_name, species_name, notes")
        .eq("id", plantId)
        .maybeSingle();
      if (cancelled) return;
      if (qErr || !data) {
        setError("植物を読み込めませんでした。");
        setLoading(false);
        return;
      }
      setDisplayName(data.display_name ?? "");
      setSpeciesName(data.species_name ?? "");
      setNotes(data.notes ?? "");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [plantId]);

  async function save() {
    setError(null);
    setSaving(true);
    if (plantId) {
      const { error: uErr } = await supabase
        .from("plants")
        .update({
          display_name: displayName.trim() || null,
          species_name: speciesName.trim() || null,
          notes: notes.trim() || null,
        })
        .eq("id", plantId);
      setSaving(false);
      if (uErr) {
        setError("保存できませんでした。");
        return;
      }
      navigation.goBack();
      return;
    }
    const { data, error: iErr } = await supabase
      .from("plants")
      .insert({
        display_name: displayName.trim() || null,
        species_name: speciesName.trim() || null,
        notes: notes.trim() || null,
      })
      .select("id")
      .single();
    setSaving(false);
    if (iErr || !data) {
      setError("登録できませんでした。");
      return;
    }
    navigation.replace("PlantDetail", { plantId: data.id });
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={palette.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.inner}
      keyboardShouldPersistTaps="handled"
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.label}>表示名（任意）</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="例: 五葉松（盆栽）、ビカクシダ、リビングのモンステラ"
        placeholderTextColor={palette.inkFaint}
      />
      <Text style={styles.label}>品種・学名（任意）</Text>
      <TextInput
        style={styles.input}
        value={speciesName}
        onChangeText={setSpeciesName}
        placeholder="例: Pinus parviflora、Platycerium、Monstera deliciosa"
        placeholderTextColor={palette.inkFaint}
      />
      <Text style={styles.label}>メモ（任意）</Text>
      <TextInput
        style={[styles.input, styles.notes]}
        value={notes}
        onChangeText={setNotes}
        placeholder="置き場所、用土、水やりの好み、忌避する肥料など"
        placeholderTextColor={palette.inkFaint}
        multiline
      />
      <Pressable
        style={[styles.save, saving && styles.saveDisabled]}
        onPress={() => void save()}
        disabled={saving}
        accessibilityLabel="植物を保存"
        accessibilityRole="button"
      >
        {saving ? (
          <ActivityIndicator color={palette.surfaceElevated} />
        ) : (
          <Text style={styles.saveText}>保存</Text>
        )}
      </Pressable>
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
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: palette.inkMuted,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.mist,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: palette.surfaceElevated,
    color: palette.ink,
  },
  notes: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  error: {
    color: palette.rose,
    marginBottom: 14,
    fontSize: 15,
  },
  save: {
    backgroundColor: palette.accent,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
  },
  saveDisabled: {
    opacity: 0.55,
  },
  saveText: {
    color: palette.surfaceElevated,
    fontSize: 16,
    fontWeight: "500",
    letterSpacing: 1,
  },
});
