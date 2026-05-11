import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { PlantDetailScreen } from "../screens/PlantDetailScreen";
import { PlantFormScreen } from "../screens/PlantFormScreen";
import { PlantsListScreen } from "../screens/PlantsListScreen";
import type { MainStackParamList } from "./types";

const Stack = createNativeStackNavigator<MainStackParamList>();

export function MainNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: "#1b5e20",
        headerTitleStyle: { fontWeight: "600" },
        contentStyle: { backgroundColor: "#f8faf8" },
      }}
    >
      <Stack.Screen
        name="PlantsList"
        component={PlantsListScreen}
        options={{ title: "植物" }}
      />
      <Stack.Screen
        name="PlantDetail"
        component={PlantDetailScreen}
        options={{ title: "植物の詳細" }}
      />
      <Stack.Screen
        name="PlantForm"
        component={PlantFormScreen}
        options={({ route }) => ({
          title: route.params?.plantId ? "植物を編集" : "植物を追加",
        })}
      />
    </Stack.Navigator>
  );
}
