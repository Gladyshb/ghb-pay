import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const appOrigin = Deno.env.get("APP_ORIGIN");
const corsHeaders = {
  "Access-Control-Allow-Origin": appOrigin || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function removeUserFiles(service: ReturnType<typeof createClient>, userId: string) {
  const paths: string[] = [];
  const folders = [userId];

  while (folders.length) {
    const folder = folders.pop()!;
    let offset = 0;
    while (true) {
      const { data, error } = await service.storage
        .from("private-files")
        .list(folder, { limit: 1000, offset });
      if (error) throw error;
      if (!data.length) break;

      for (const entry of data) {
        const path = `${folder}/${entry.name}`;
        if (entry.id === null) folders.push(path);
        else paths.push(path);
      }
      if (data.length < 1000) break;
      offset += data.length;
    }
  }

  for (let index = 0; index < paths.length; index += 100) {
    const { error } = await service.storage.from("private-files").remove(paths.slice(index, index + 100));
    if (error) throw error;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return respond({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return respond({ error: "Supabase function environment is incomplete." }, 500);
  }

  const authorization = request.headers.get("Authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return respond({ error: "Authentication required." }, 401);

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user: actor }, error: authError } = await userClient.auth.getUser(token);
  if (authError || !actor) return respond({ error: "Authentication required." }, 401);

  const { data: actorProfile, error: actorProfileError } = await service
    .from("profiles")
    .select("role, is_blocked")
    .eq("id", actor.id)
    .maybeSingle();
  if (actorProfileError) {
    console.error("Could not verify administrator profile:", actorProfileError);
    return respond({ error: "Unable to authorize this request." }, 500);
  }
  if (actorProfile?.role !== "admin" || actorProfile.is_blocked) {
    return respond({ error: "Administrator access required." }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return respond({ error: "A valid JSON request body is required." }, 400);
  }

  const action = body.action;
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId || !["block", "unblock", "delete", "password", "impersonate"].includes(String(action))) {
    return respond({ error: "Invalid user administration request." }, 400);
  }
  if (userId === actor.id) return respond({ error: "You cannot administer your own account." }, 400);

  const { data: target, error: targetError } = await service
    .from("profiles")
    .select("id, email, role, is_blocked")
    .eq("id", userId)
    .maybeSingle();
  if (targetError) {
    console.error("Could not load target profile:", targetError);
    return respond({ error: "Unable to load the requested profile." }, 500);
  }
  if (!target) return respond({ error: "User not found." }, 404);
  if (target.role === "admin") return respond({ error: "Administrator accounts cannot be changed here." }, 403);

  try {
    if (action === "block") {
      const { error } = await service.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
      if (error) throw error;
      const { error: profileError } = await service.from("profiles").update({ is_blocked: true }).eq("id", userId);
      if (profileError) {
        const { error: rollbackError } = await service.auth.admin.updateUserById(userId, { ban_duration: "none" });
        if (rollbackError) console.error("Could not roll back an incomplete account block:", rollbackError);
        throw profileError;
      }
      return respond({ ok: true });
    }

    if (action === "unblock") {
      const { error: profileError } = await service.from("profiles").update({ is_blocked: false }).eq("id", userId);
      if (profileError) throw profileError;
      const { error } = await service.auth.admin.updateUserById(userId, { ban_duration: "none" });
      if (error) {
        const { error: rollbackError } = await service.from("profiles").update({ is_blocked: true }).eq("id", userId);
        if (rollbackError) console.error("Could not roll back an incomplete account unblock:", rollbackError);
        throw error;
      }
      return respond({ ok: true });
    }

    if (action === "password") {
      const password = typeof body.password === "string" ? body.password : "";
      if (password.length < 12 || password.length > 128) {
        return respond({ error: "The temporary password must contain 12 to 128 characters." }, 400);
      }
      const { error } = await service.auth.admin.updateUserById(userId, { password });
      if (error) throw error;
      return respond({ ok: true });
    }

    if (action === "impersonate") {
      if (target.is_blocked || !target.email) {
        return respond({ error: "This account cannot be impersonated." }, 400);
      }
      const { data, error } = await service.auth.admin.generateLink({
        type: "magiclink",
        email: target.email,
      });
      if (error) throw error;
      const tokenHash = data.properties?.hashed_token;
      if (!tokenHash) throw new Error("Supabase did not return an impersonation token.");
      return respond({ tokenHash });
    }

    await removeUserFiles(service, userId);
    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) throw error;
    return respond({ ok: true });
  } catch (error) {
    console.error(`Admin user action "${action}" failed:`, error);
    return respond({
      error: error instanceof Error ? error.message : "The user administration action failed.",
    }, 500);
  }
});
