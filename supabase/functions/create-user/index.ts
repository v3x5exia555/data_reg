// supabase/functions/create-user/index.ts
// One Edge Function, three modes:
//   mode='account'      — Superadmin creates a new account + Accountadmin user
//   mode='user'         — Accountadmin invites a User into their own account
//   mode='manage-user'  — Accountadmin/Superadmin resets password, activates, or deactivates a user
//
// Atomicity: best-effort rollback. If a step fails, the function attempts to
// delete the auth user / accounts row that was already created.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

interface AccountModeBody {
  mode: 'account';
  email: string;
  temp_password: string;
  company_name: string;
  seat_limit?: number;
  seed_sample_data?: boolean;
}
interface UserModeBody {
  mode: 'user';
  email: string;
  temp_password: string;
  account_id: string;
  role?: string;
}
interface ManageUserBody {
  mode: 'manage-user';
  user_id: string;
  action: 'reset-password' | 'activate' | 'deactivate' | 'delete' | 'update';
  new_password?: string;
  new_role?: string;
  new_first_name?: string;
  new_last_name?: string;
}
type Body = AccountModeBody | UserModeBody | ManageUserBody;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) {
    return json({ error: 'Missing Authorization header' }, 401);
  }

  const callerJwt = auth.slice('Bearer '.length);
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${callerJwt}` } },
  });
  const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
  if (callerErr || !caller) return json({ error: 'Invalid caller token' }, 401);

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: callerProfile, error: profileErr } = await adminClient
    .from('user_profiles')
    .select('role, account_id')
    .eq('id', caller.id)
    .single();
  if (profileErr || !callerProfile) return json({ error: 'Caller has no profile' }, 403);

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

  if (body.mode === 'account') {
    if (callerProfile.role !== 'Superadmin') return json({ error: 'Superadmin only' }, 403);
    return await createAccount(adminClient, body);
  }
  if (body.mode === 'user') {
    const isSuper = callerProfile.role === 'Superadmin';
    const isOwnAdmin = callerProfile.role === 'Accountadmin' && callerProfile.account_id === body.account_id;
    if (!isSuper && !isOwnAdmin) return json({ error: 'Not authorized for this account' }, 403);
    return await createUser(adminClient, body);
  }
  if (body.mode === 'manage-user') {
    const isAdmin = callerProfile.role === 'Superadmin' || callerProfile.role === 'Accountadmin';
    if (!isAdmin) return json({ error: 'Admin only' }, 403);
    if (body.user_id === caller.id) return json({ error: 'Cannot manage your own account' }, 400);

    if (callerProfile.role === 'Accountadmin') {
      const { data: targetProfile, error: targetErr } = await adminClient
        .from('user_profiles')
        .select('role, account_id')
        .eq('id', body.user_id)
        .single();
      if (targetErr || !targetProfile) {
        return json({ error: 'Target user not found' }, 404);
      }
      if (targetProfile.role === 'Superadmin') {
        return json({ error: 'Not authorized to manage Superadmin accounts' }, 403);
      }
      if (targetProfile.account_id !== callerProfile.account_id) {
        return json({ error: 'Not authorized for this account' }, 403);
      }
    }
    return await manageUser(adminClient, body);
  }
  return json({ error: 'Unknown mode' }, 400);
});

async function createAccount(admin: ReturnType<typeof createClient>, body: AccountModeBody) {
  const { data: account, error: acctErr } = await admin.from('accounts').insert({
    name: body.company_name,
    seat_limit: body.seat_limit ?? 2,
    status: 'active',
  }).select().single();
  if (acctErr || !account) return json({ error: 'Account insert failed', detail: acctErr?.message }, 500);

  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email: body.email,
    password: body.temp_password,
    email_confirm: true,
  });
  if (authErr || !authUser?.user) {
    await admin.from('accounts').delete().eq('id', account.id);
    const code = authErr?.message?.includes('already') ? 409 : 500;
    return json({ error: 'Auth user create failed', detail: authErr?.message }, code);
  }

  // Upsert because migration 12's on_auth_user_created trigger already inserted a
  // default 'user' profile when auth.admin.createUser() was called above.
  const { error: profileInsErr } = await admin.from('user_profiles').upsert({
    id: authUser.user.id,
    email: body.email,
    role: 'Accountadmin',
    account_id: account.id,
  }, { onConflict: 'id' });
  if (profileInsErr) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    await admin.from('accounts').delete().eq('id', account.id);
    return json({ error: 'Profile insert failed', detail: profileInsErr.message }, 500);
  }

  await admin.from('accounts').update({ accountadmin_user_id: authUser.user.id }).eq('id', account.id);
  await admin.from('companies').insert({ name: body.company_name, account_id: account.id });

  const defaultConsent = [
    { category: 'Customer contact data', title: 'Newsletter & marketing', is_enabled: true },
    { category: 'Customer contact data', title: 'Order confirmations', is_enabled: true },
    { category: 'Customer contact data', title: 'Third-party sharing', is_enabled: false },
    { category: 'Employee personal data', title: 'Payroll processing', is_enabled: true },
    { category: 'Employee personal data', title: 'Training communications', is_enabled: true },
    { category: 'Website analytics', title: 'Analytics cookies', is_enabled: false },
    { category: 'Website analytics', title: 'Functional cookies', is_enabled: true },
  ];
  await admin.from('consent_settings').insert(
    defaultConsent.map(r => ({ ...r, account_id: account.id }))
  );

  if (body.seed_sample_data) {
    // Sample data seeding is left as a server-side TODO marker — implement by
    // porting js/sample_data.js payloads into a SQL function or inline inserts
    // here, all tagged with account_id = account.id. For now we no-op rather
    // than ship partial seeding.
  }

  return json({
    account_id: account.id,
    user_id: authUser.user.id,
    email: body.email,
    temp_password: body.temp_password,
  }, 200);
}

async function createUser(admin: ReturnType<typeof createClient>, body: UserModeBody) {
  const { data: account, error: acctErr } = await admin
    .from('accounts').select('seat_limit').eq('id', body.account_id).single();
  if (acctErr || !account) return json({ error: 'Account not found' }, 404);

  const { count, error: countErr } = await admin
    .from('user_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', body.account_id);
  if (countErr) return json({ error: 'Seat count failed', detail: countErr.message }, 500);
  if ((count ?? 0) >= account.seat_limit) return json({ error: 'Seat limit reached' }, 402);

  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email: body.email,
    password: body.temp_password,
    email_confirm: true,
  });
  if (authErr || !authUser?.user) {
    const code = authErr?.message?.includes('already') ? 409 : 500;
    return json({ error: 'Auth user create failed', detail: authErr?.message }, code);
  }

  const VALID_ROLES = ['Accountadmin', 'security_user', 'useradmin', 'user'];
  const assignedRole = body.role && VALID_ROLES.includes(body.role) ? body.role : 'user';

  // Upsert because migration 12's on_auth_user_created trigger already inserted a
  // default 'user' profile when auth.admin.createUser() was called above.
  const { error: profileInsErr } = await admin.from('user_profiles').upsert({
    id: authUser.user.id,
    email: body.email,
    role: assignedRole,
    account_id: body.account_id,
  }, { onConflict: 'id' });
  if (profileInsErr) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    return json({ error: 'Profile insert failed', detail: profileInsErr.message }, 500);
  }

  return json({
    user_id: authUser.user.id,
    email: body.email,
    temp_password: body.temp_password,
  }, 200);
}

async function manageUser(admin: ReturnType<typeof createClient>, body: ManageUserBody) {
  const { user_id, action, new_password } = body;

  if (action === 'reset-password') {
    if (!new_password || new_password.length < 8) {
      return json({ error: 'Password too short (min 8 chars)' }, 400);
    }
    const { error } = await admin.auth.admin.updateUserById(user_id, { password: new_password });
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true }, 200);
  }

  if (action === 'deactivate') {
    // ~100 years: Supabase has no permanent-ban option
    const { error: authErr } = await admin.auth.admin.updateUserById(user_id, { ban_duration: '876600h' });
    if (authErr) return json({ error: authErr.message }, 500);
    const { error: dbErr } = await admin.from('user_profiles').update({ status: 'suspended' }).eq('id', user_id);
    if (dbErr) {
      await admin.auth.admin.updateUserById(user_id, { ban_duration: 'none' });
      return json({ error: 'DB update failed', detail: dbErr.message }, 500);
    }
    return json({ ok: true }, 200);
  }

  if (action === 'activate') {
    const { error: authErr } = await admin.auth.admin.updateUserById(user_id, { ban_duration: 'none' });
    if (authErr) return json({ error: authErr.message }, 500);
    const { error: dbErr } = await admin.from('user_profiles').update({ status: 'active' }).eq('id', user_id);
    if (dbErr) {
      // ~100 years: Supabase has no permanent-ban option
      await admin.auth.admin.updateUserById(user_id, { ban_duration: '876600h' });
      return json({ error: 'DB update failed', detail: dbErr.message }, 500);
    }
    return json({ ok: true }, 200);
  }

  if (action === 'delete') {
    await admin.from('user_profiles').delete().eq('id', user_id);
    const { error: authErr } = await admin.auth.admin.deleteUser(user_id);
    if (authErr) return json({ error: authErr.message }, 500);
    return json({ ok: true }, 200);
  }

  if (action === 'update') {
    const VALID_ROLES = ['Accountadmin', 'security_user', 'useradmin', 'user'];
    const updates: Record<string, unknown> = {};
    if (body.new_role) {
      if (!VALID_ROLES.includes(body.new_role)) return json({ error: 'Invalid role' }, 400);
      updates.role = body.new_role;
    }
    if (body.new_first_name !== undefined) updates.first_name = body.new_first_name;
    if (body.new_last_name  !== undefined) updates.last_name  = body.new_last_name;
    if (Object.keys(updates).length === 0) return json({ error: 'Nothing to update' }, 400);
    const { error } = await admin.from('user_profiles').update(updates).eq('id', user_id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true }, 200);
  }

  return json({ error: 'Unknown action' }, 400);
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
