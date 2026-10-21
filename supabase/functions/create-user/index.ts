import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AccessEntry {
  company_id: string;
  location_id?: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Неоторизиран достъп" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const { data: callerData, error: callerError } = await serviceClient.auth.getUser(token);
    if (callerError || !callerData.user) {
      return new Response(JSON.stringify({ error: "Невалидна сесия" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile, error: profileError } = await serviceClient
      .from("user_profiles")
      .select("role")
      .eq("id", callerData.user.id)
      .single();

    if (profileError || !callerProfile || callerProfile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Достъп само за администратори" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { email, password, full_name, role, company_id, access } = body;

    if (!email || !password || !role) {
      return new Response(JSON.stringify({ error: "Липсват задължителни полета" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (role !== "admin" && role !== "company_user") {
      return new Response(JSON.stringify({ error: "Невалидна роля" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For company_user: either access array or single company_id is required
    const accessList: AccessEntry[] = Array.isArray(access) ? access : (company_id ? [{ company_id, location_id: null }] : []);

    if (role === "company_user" && accessList.length === 0) {
      return new Response(JSON.stringify({ error: "Изберете поне една фирма за този потребител" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create the auth user
    const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create the user profile (keep legacy company_id for backward compat — use first company)
    const firstCompanyId = accessList.length > 0 ? accessList[0].company_id : null;

    const { error: profileInsertError } = await serviceClient.from("user_profiles").insert({
      id: newUser.user.id,
      role,
      company_id: role === "company_user" ? firstCompanyId : null,
      full_name: full_name || null,
    });

    if (profileInsertError) {
      await serviceClient.auth.admin.deleteUser(newUser.user.id);
      return new Response(JSON.stringify({ error: "Грешка при създаване на профил: " + profileInsertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create access entries for company_user
    if (role === "company_user" && accessList.length > 0) {
      const rows = accessList.map((entry) => ({
        user_id: newUser.user.id,
        company_id: entry.company_id,
        location_id: entry.location_id ?? null,
      }));

      const { error: accessError } = await serviceClient.from("user_company_access").insert(rows);

      if (accessError) {
        // Non-fatal: profile is created, just log the error
        console.error("Access insert error:", accessError.message);
      }
    }

    return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
