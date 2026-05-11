import { supabase } from "./supabase";

export type AiDiagnoseResponse = {
  diagnosis_id: string;
  summary: string;
  created_at: string;
};

export type CareAction = { kind: string; note: string };

export type CareRecommendationsResponse = {
  id: string;
  for_date: string;
  actions: CareAction[];
  source: string;
};

function invokeErrorMessage(err: { message: string }, fallback: string): string {
  const m = err.message?.trim();
  return m && m !== "Edge Function returned a non-2xx status code" ? m : fallback;
}

export async function invokeAiDiagnose(
  plantId: string,
  photoId?: string,
): Promise<AiDiagnoseResponse> {
  const { data, error } = await supabase.functions.invoke<AiDiagnoseResponse>("ai-diagnose", {
    body: {
      plant_id: plantId,
      ...(photoId ? { photo_id: photoId } : {}),
    },
  });

  if (error) {
    throw new Error(invokeErrorMessage(error, "AI診断のリクエストに失敗しました。"));
  }
  if (!data?.summary) {
    throw new Error("AI診断の応答が空でした。");
  }
  return data;
}

export async function invokeCareRecommendations(
  plantId: string,
  forDate: string,
): Promise<CareRecommendationsResponse> {
  const { data, error } = await supabase.functions.invoke<CareRecommendationsResponse>(
    "care-recommendations",
    {
      body: {
        plant_id: plantId,
        for_date: forDate,
      },
    },
  );

  if (error) {
    throw new Error(invokeErrorMessage(error, "ケア提案の取得に失敗しました。"));
  }
  if (!data?.actions) {
    throw new Error("ケア提案の応答が空でした。");
  }
  return data;
}
