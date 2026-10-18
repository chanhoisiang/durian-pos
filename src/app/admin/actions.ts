// src/app/admin/actions.ts
'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

// Admin client bypasses RLS ONLY for account management metadata
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function getAllWholesalerAccounts() {
  const { data, error } = await supabaseAdmin
    .from('tenants')
    .select(`
      id,
      email,
      business_name,
      ssm_brn,
      phone,
      is_active,
      buy_seq,
      sell_seq,
      last_active_at,
      created_at
    `)
    .eq('role', 'wholesaler')
    .order('last_active_at', { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}

export async function toggleWholesalerStatus(tenantId: string, isActive: boolean) {
  const { error } = await supabaseAdmin
    .from('tenants')
    .update({ is_active: isActive })
    .eq('id', tenantId);

  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

export async function deleteInactiveWholesalerAccount(tenantId: string) {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(tenantId);

  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

// Bypasses Supabase email confirmation rate limits completely
export async function registerWholesalerAccount(formData: {
  email: string;
  password: string;
  businessName: string;
  ssmBrn: string;
  tinNumber: string;
  phone: string;
  vaultSalt: string;
}) {
  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email: formData.email,
    password: formData.password,
    email_confirm: true, // Auto-confirms email so no rate limit error occurs!
  });

  if (authErr) throw new Error(authErr.message);
  if (!authData.user) throw new Error('Failed to create user');

  const { error: tenantErr } = await supabaseAdmin.from('tenants').insert({
    id: authData.user.id,
    email: formData.email,
    business_name: formData.businessName,
    ssm_brn: formData.ssmBrn,
    tin_number: formData.tinNumber,
    phone: formData.phone,
    vault_salt: formData.vaultSalt,
  });

  if (tenantErr) throw new Error(tenantErr.message);

  return { userId: authData.user.id };
}