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
        <ActivityIndicator size="large" color="#2e7d32" />
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
        placeholder="例: リビングのモンステラ"
        placeholderTextColor="#999"
      />
      <Text style={styles.label}>品種・学名（任意）</Text>
      <TextInput
        style={styles.input}
        value={speciesName}
        onChangeText={setSpeciesName}
        placeholder="例: Monstera deliciosa"
        placeholderTextColor="#999"
      />
      <Text style={styles.label}>メモ（任意）</Text>
      <TextInput
        style={[styles.input, styles.notes]}
        value={notes}
        onChangeText={setNotes}
        placeholder="置き場所や好みなど"
        placeholderTextColor="#999"
        multiline
      />
      <Pressable
        style={[styles.save, saving && styles.saveDisabled]}
        onPress={() => void save()}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
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
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 18,
    backgroundColor: "#fff",
  },
  notes: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  error: {
    color: "#c62828",
    marginBottom: 12,
  },
  save: {
    backgroundColor: "#2e7d32",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  saveDisabled: {
    opacity: 0.6,
  },
  saveText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
