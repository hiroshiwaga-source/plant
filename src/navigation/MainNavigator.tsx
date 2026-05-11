import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { PlantDetailScreen } from "../screens/PlantDetailScreen";
import { PlantFormScreen } from "../screens/PlantFormScreen";
import { PlantsListScreen } from "../screens/PlantsListScreen";
import { palette } from "../theme/gris";
import type { MainStackParamList } from "./types";

const Stack = createNativeStackNavigator<MainStackParamList>();

export function MainNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: palette.accent,
        headerTitleStyle: {
          fontWeight: "500",
          fontSize: 17,
          color: palette.ink,
        },
        headerStyle: {
          backgroundColor: palette.surfaceElevated,
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: palette.canvas },
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
        options={{ title: "詳細" }}
      />
      <Stack.Screen
        name="PlantForm"
        component={PlantFormScreen}
        options={({ route }) => ({
          title: route.params?.plantId ? "編集" : "追加",
          presentation: "modal",
          headerStyle: {
            backgroundColor: palette.surface,
          },
        })}
      />
    </Stack.Navigator>
  );
}
