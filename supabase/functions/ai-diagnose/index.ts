import { corsHeaders } from "../_shared/cors.ts";
import { supabaseForRequest, supabaseServiceRole } from "../_shared/supabase.ts";

type Body = {
  plant_id: string;
  photo_id?: string;
};

/**
 * Server-side AI orchestration. Provider keys must live in Edge secrets only.
 * This stub returns possibility-framed copy without calling external APIs.
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

  const supabaseUser = supabaseForRequest(req);
  const {
    data: { user },
    error: userErr,
  } = await supabaseUser.auth.getUser();

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

  const { data: plant, error: plantErr } = await supabaseUser
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

  if (body.photo_id) {
    const { data: photo, error: photoErr } = await supabaseUser
      .from("plant_photos")
      .select("id, storage_path")
      .eq("id", body.photo_id)
      .eq("plant_id", body.plant_id)
      .maybeSingle();

    if (photoErr || !photo) {
      return new Response(JSON.stringify({ error: "photo_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Server-side read for real AI would use service role + storage_path here.
    // Do not log storage_path, signed URLs, or image bytes.
    const admin = supabaseServiceRole();
    const { error: dlErr } = await admin.storage
      .from("plant-photos")
      .download(photo.storage_path);

    if (dlErr) {
      return new Response(JSON.stringify({ error: "storage_read_failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const summary =
    "Based on the limited information available, your plant might benefit from " +
    "checking soil moisture and light levels. This is not a definitive diagnosis; " +
    "consider local conditions and consult references or a specialist if problems persist.";

  const { data: inserted, error: insErr } = await supabaseUser
    .from("plant_diagnoses")
    .insert({
      plant_id: body.plant_id,
      source_photo_id: body.photo_id ?? null,
      model_provider: "stub",
      model_name: "none",
      summary,
      structured: {
        possible_issues: ["insufficient_data"],
        confidence: "low",
      },
    })
    .select("id, summary, created_at")
    .single();

  if (insErr || !inserted) {
    return new Response(JSON.stringify({ error: "persist_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      diagnosis_id: inserted.id,
      summary: inserted.summary,
      created_at: inserted.created_at,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
