import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Proves cross-tenant reads fail when RLS is applied.
 *
 *   npm run test:integration
 * (loads .env via vitest.integration.config.ts)
 *
 * If `signUp` hits **email rate limit**, set `SUPABASE_SERVICE_ROLE_KEY` in `.env`
 * (Dashboard → Settings → API → service_role). **Never** put that key in the mobile app.
 * Tests will create confirmed users via Admin API and delete them in `afterAll`.
 */
const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

const run = Boolean(url && anon);

function anonClient(): SupabaseClient {
  return createClient(url!, anon!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function adminClient(): SupabaseClient {
  return createClient(url!, serviceRole!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

describe.skipIf(!run)("RLS: users cannot read other tenants’ data", () => {
  const password = "Test-rls-password-1!";
  let emailA: string;
  let emailB: string;
  let userIdA: string;
  let userIdB: string;
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;
  let plantIdA: string;
  let logIdA: string;
  let photoIdA: string;
  let diagnosisIdA: string;
  let createdViaAdmin = false;

  beforeAll(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    emailA = `plant-rls-a-${suffix}@example.com`;
    emailB = `plant-rls-b-${suffix}@example.com`;
    clientA = anonClient();
    clientB = anonClient();

    if (serviceRole) {
      createdViaAdmin = true;
      const admin = adminClient();
      const { data: uA, error: eA } = await admin.auth.admin.createUser({
        email: emailA,
        password,
        email_confirm: true,
      });
      const { data: uB, error: eB } = await admin.auth.admin.createUser({
        email: emailB,
        password,
        email_confirm: true,
      });
      if (eA || !uA.user) throw eA ?? new Error("admin create user A");
      if (eB || !uB.user) throw eB ?? new Error("admin create user B");
      userIdA = uA.user.id;
      userIdB = uB.user.id;
    } else {
      const { error: signUpAErr } = await clientA.auth.signUp({
        email: emailA,
        password,
      });
      const { error: signUpBErr } = await clientB.auth.signUp({
        email: emailB,
        password,
      });
      const rateLimited = (e: { message?: string } | null) =>
        Boolean(e?.message?.toLowerCase().includes("rate limit"));
      if (signUpAErr) {
        if (rateLimited(signUpAErr)) {
          throw new Error(
            "Auth signUp hit email rate limit. Add SUPABASE_SERVICE_ROLE_KEY to .env (Dashboard → Settings → API → service_role). Integration tests use it only to create/delete test users. Never put service_role in EXPO_PUBLIC_* or the mobile app.",
          );
        }
        throw signUpAErr;
      }
      if (signUpBErr) {
        if (rateLimited(signUpBErr)) {
          throw new Error(
            "Auth signUp hit email rate limit. Add SUPABASE_SERVICE_ROLE_KEY to .env — see README.",
          );
        }
        throw signUpBErr;
      }
    }

    const { data: inA, error: inAErr } = await clientA.auth.signInWithPassword({
      email: emailA,
      password,
    });
    if (inAErr || !inA.session) throw inAErr ?? new Error("no session A");
    userIdA = inA.session.user.id;

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
    const { data: inB, error: inBErr } = await clientB.auth.signInWithPassword({
      email: emailB,
      password,
    });
    if (inBErr || !inB.session) throw inBErr ?? new Error("no session B");
    userIdB = inB.session.user.id;
  });

  afterAll(async () => {
    await clientB.auth.signOut();
    if (createdViaAdmin && serviceRole && url) {
      const admin = adminClient();
      await admin.auth.admin.deleteUser(userIdA);
      await admin.auth.admin.deleteUser(userIdB);
    }
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
