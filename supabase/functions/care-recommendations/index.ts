import { corsHeaders } from "../_shared/cors.ts";
import { supabaseForRequest } from "../_shared/supabase.ts";

type Body = {
  plant_id: string;
  for_date?: string;
};

/**
 * Today's care suggestions. Rules-based stub; AI path would stay server-side with minimized context.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = supabaseForRequest(req);
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body.plant_id) {
    return new Response(JSON.stringify({ error: "plant_id_required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: plant, error: plantErr } = await supabase
    .from("plants")
    .select("id")
    .eq("id", body.plant_id)
    .maybeSingle();

  if (plantErr || !plant) {
    return new Response(JSON.stringify({ error: "plant_not_found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const forDate = body.for_date ?? new Date().toISOString().slice(0, 10);

  const { data: recentLogs } = await supabase
    .from("care_logs")
    .select("log_type, occurred_at")
    .eq("plant_id", body.plant_id)
    .order("occurred_at", { ascending: false })
    .limit(10);

  const lastWater = recentLogs?.find(
    (l: { log_type: string }) => l.log_type === "water",
  );
  const actions: { kind: string; note: string }[] = [];

  if (!lastWater) {
    actions.push({
      kind: "water",
      note:
        "No recent watering logged; you might check soil moisture before adding water.",
    });
  } else {
    actions.push({
      kind: "observe",
      note:
        "Review leaves and soil today; adjust care if you notice changes. This is general guidance, not a certainty.",
    });
  }

  const { data: saved, error: saveErr } = await supabase
    .from("care_recommendations")
    .upsert(
      {
        plant_id: body.plant_id,
        for_date: forDate,
        actions,
        source: "rules",
      },
      { onConflict: "user_id,plant_id,for_date" },
    )
    .select("id, for_date, actions, source")
    .single();

  if (saveErr || !saved) {
    return new Response(JSON.stringify({ error: "persist_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(saved), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
