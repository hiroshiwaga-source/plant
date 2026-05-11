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
import { palette, radius, shadow } from "../theme/gris";
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
        <ActivityIndicator size="large" color={palette.accent} />
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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={palette.accent}
            colors={[palette.accent]}
          />
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
    backgroundColor: palette.canvas,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: palette.canvas,
  },
  headerBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerBtnText: {
    color: palette.accent,
    fontSize: 16,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  error: {
    color: palette.rose,
    padding: 16,
    textAlign: "center",
    fontSize: 15,
  },
  listContent: {
    padding: 18,
    paddingBottom: 28,
  },
  emptyList: {
    flexGrow: 1,
    padding: 28,
    justifyContent: "center",
  },
  emptyText: {
    color: palette.inkMuted,
    textAlign: "center",
    lineHeight: 24,
    fontSize: 15,
  },
  card: {
    backgroundColor: palette.surfaceElevated,
    borderRadius: radius.lg,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: palette.mistLight,
    ...shadow.card,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "500",
    color: palette.ink,
    letterSpacing: 0.2,
  },
  cardSub: {
    marginTop: 6,
    fontSize: 14,
    color: palette.accentInk,
    opacity: 0.85,
  },
  logout: {
    marginTop: 28,
    marginBottom: 36,
    paddingVertical: 18,
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.mist,
  },
  logoutText: {
    color: palette.inkFaint,
    fontSize: 14,
    letterSpacing: 0.5,
  },
});
