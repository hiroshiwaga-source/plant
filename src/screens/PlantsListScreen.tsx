import { useCallback, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "../lib/supabase";
import type { MainStackParamList } from "../navigation/types";
import type { Database } from "../types/database";

type Plant = Database["public"]["Tables"]["plants"]["Row"];

type Nav = NativeStackNavigationProp<MainStackParamList, "PlantsList">;

export function PlantsListScreen() {
  const navigation = useNavigation<Nav>();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: qErr } = await supabase
      .from("plants")
      .select("*")
      .order("created_at", { ascending: false });
    if (qErr) {
      setError("一覧を読み込めませんでした。");
      setPlants([]);
    } else {
      setPlants(data ?? []);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

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
          onPress={() => navigation.navigate("PlantForm", {})}
          hitSlop={12}
          style={styles.headerBtn}
          accessibilityLabel="植物を追加"
          accessibilityRole="button"
        >
          <Text style={styles.headerBtnText}>追加</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
  }

  if (loading && plants.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2e7d32" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={plants}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
        contentContainerStyle={
          plants.length === 0 ? styles.emptyList : styles.listContent
        }
        ListFooterComponent={
          <Pressable
            style={styles.logout}
            onPress={() => {
              Alert.alert("ログアウト", "ログアウトしますか？", [
                { text: "キャンセル", style: "cancel" },
                {
                  text: "ログアウト",
                  style: "destructive",
                  onPress: () => void supabase.auth.signOut(),
                },
              ]);
            }}
            accessibilityLabel="ログアウト"
            accessibilityRole="button"
          >
            <Text style={styles.logoutText}>ログアウト</Text>
          </Pressable>
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            まだ植物がありません。盆栽から観葉植物まで、右上の「追加」から登録してください。
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() =>
              navigation.navigate("PlantDetail", { plantId: item.id })
            }
            accessibilityRole="button"
            accessibilityLabel={`植物 ${item.display_name?.trim() || "名称未設定"}`}
          >
            <Text style={styles.cardTitle}>
              {item.display_name?.trim() || "（名称未設定）"}
            </Text>
            {item.species_name ? (
              <Text style={styles.cardSub}>{item.species_name}</Text>
            ) : null}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#f8faf8",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8faf8",
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
    padding: 16,
    textAlign: "center",
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  emptyList: {
    flexGrow: 1,
    padding: 24,
    justifyContent: "center",
  },
  emptyText: {
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e8e0",
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1b3d1b",
  },
  cardSub: {
    marginTop: 4,
    fontSize: 14,
    color: "#558b2f",
  },
  logout: {
    marginTop: 24,
    marginBottom: 32,
    paddingVertical: 16,
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ddd",
  },
  logoutText: {
    color: "#666",
    fontSize: 15,
  },
});
