import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Proves cross-tenant reads fail when RLS is applied.
 * Run against local Supabase (`npx supabase start`) or a dev project with email auto-confirm.
 *
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... npm run test:integration
 */
const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;

const run = Boolean(url && anon);

function client(): SupabaseClient {
  return createClient(url!, anon!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

describe.skipIf(!run)("RLS: users cannot read other tenants’ data", () => {
  const password = "Test-rls-password-1!";
  let emailA: string;
  let emailB: string;
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;
  let plantIdA: string;
  let logIdA: string;
  let photoIdA: string;
  let diagnosisIdA: string;

  beforeAll(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    emailA = `rls-a-${suffix}@example.test`;
    emailB = `rls-b-${suffix}@example.test`;
    clientA = client();
    clientB = client();

    const { error: signUpAErr } = await clientA.auth.signUp({
      email: emailA,
      password,
    });
    const { error: signUpBErr } = await clientB.auth.signUp({
      email: emailB,
      password,
    });
    if (signUpAErr) throw signUpAErr;
    if (signUpBErr) throw signUpBErr;

    const { data: inA, error: inAErr } = await clientA.auth.signInWithPassword({
      email: emailA,
      password,
    });
    if (inAErr || !inA.session) throw inAErr ?? new Error("no session A");
    const userIdA = inA.session.user.id;

    const { data: plant, error: plantErr } = await clientA
      .from("plants")
      .insert({ display_name: "RLS test plant" })
      .select("id")
      .single();
    if (plantErr || !plant) throw plantErr ?? new Error("plant insert");
    plantIdA = plant.id;

    const { data: log, error: logErr } = await clientA
      .from("care_logs")
      .insert({
        plant_id: plantIdA,
        log_type: "water",
      })
      .select("id")
      .single();
    if (logErr || !log) throw logErr ?? new Error("log insert");
    logIdA = log.id;

    photoIdA = crypto.randomUUID();
    const storagePath = `${userIdA}/${plantIdA}/${photoIdA}`;
    const { data: photo, error: photoErr } = await clientA
      .from("plant_photos")
      .insert({
        id: photoIdA,
        plant_id: plantIdA,
        storage_path: storagePath,
        content_type: "image/jpeg",
      })
      .select("id")
      .single();
    if (photoErr || !photo) throw photoErr ?? new Error("photo insert");

    const { data: dx, error: dxErr } = await clientA
      .from("plant_diagnoses")
      .insert({
        plant_id: plantIdA,
        model_provider: "test",
        model_name: "test",
        summary: "Possible test condition only.",
      })
      .select("id")
      .single();
    if (dxErr || !dx) throw dxErr ?? new Error("diagnosis insert");
    diagnosisIdA = dx.id;

    await clientA.auth.signOut();
    const { error: inBErr } = await clientB.auth.signInWithPassword({
      email: emailB,
      password,
    });
    if (inBErr) throw inBErr;
  });

  afterAll(async () => {
    await clientB.auth.signOut();
  });

  it("user B cannot list user A plants", async () => {
    const { data, error } = await clientB.from("plants").select("id");
    expect(error).toBeNull();
    expect(data?.some((r) => r.id === plantIdA)).toBe(false);
  });

  it("user B cannot select user A plant by id", async () => {
    const { data, error } = await clientB
      .from("plants")
      .select("id")
      .eq("id", plantIdA)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("user B cannot read user A care_logs", async () => {
    const { data } = await clientB
      .from("care_logs")
      .select("id")
      .eq("id", logIdA)
      .maybeSingle();
    expect(data).toBeNull();
  });

  it("user B cannot read user A plant_photos", async () => {
    const { data } = await clientB
      .from("plant_photos")
      .select("id")
      .eq("id", photoIdA)
      .maybeSingle();
    expect(data).toBeNull();
  });

  it("user B cannot read user A plant_diagnoses", async () => {
    const { data } = await clientB
      .from("plant_diagnoses")
      .select("id")
      .eq("id", diagnosisIdA)
      .maybeSingle();
    expect(data).toBeNull();
  });
});

describe("RLS integration env", () => {
  it.skipIf(run)("skips when SUPABASE_URL / SUPABASE_ANON_KEY unset", () => {
    expect(true).toBe(true);
  });
});
