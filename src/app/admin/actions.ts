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
    .select('*')
    .eq('role', 'wholesaler')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
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

// Update Wholesaler Basic Info, LHDN Details & Subscription Fee
export async function updateWholesalerDetails(formData: {
  id: string;
  business_name: string;
  ssm_brn: string;
  tin_number: string;
  phone: string;
  msic_code: string;
  subscription_plan: string;
  subscription_fee_rm: number;
  subscription_expires_at: string;
  admin_notes: string;
}) {
  const { error } = await supabaseAdmin
    .from('tenants')
    .update({
      business_name: formData.business_name,
      ssm_brn: formData.ssm_brn,
      tin_number: formData.tin_number,
      phone: formData.phone,
      msic_code: formData.msic_code,
      subscription_plan: formData.subscription_plan,
      subscription_fee_rm: formData.subscription_fee_rm,
      subscription_expires_at: formData.subscription_expires_at,
      admin_notes: formData.admin_notes,
    })
    .eq('id', formData.id);

  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

// Quick +30 Days Subscription Renewal
export async function extendWholesalerSubscription(tenantId: string, currentExpiryIso: string | null) {
  const baseDate =
    currentExpiryIso && new Date(currentExpiryIso) > new Date()
      ? new Date(currentExpiryIso)
      : new Date();
  baseDate.setDate(baseDate.getDate() + 30);

  const { error } = await supabaseAdmin
    .from('tenants')
    .update({
      subscription_expires_at: baseDate.toISOString(),
      is_active: true,
    })
    .eq('id', tenantId);

  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

// Reset a Wholesaler's Login Password from Admin Panel
export async function adminResetWholesalerPassword(tenantId: string, newPassword: string) {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }
  const { error } = await supabaseAdmin.auth.admin.updateUserById(tenantId, {
    password: newPassword,
  });

  if (error) throw new Error(error.message);
  return { success: true };
}

// Register Wholesaler Account (Used by both Self-Registration & Admin Onboarding)
export async function registerWholesalerAccount(formData: {
  email: string;
  password: string;
  businessName: string;
  ssmBrn: string;
  tinNumber: string;
  phone: string;
  vaultSalt: string;
  subscriptionPlan?: string;
  subscriptionFeeRm?: number;
}) {
  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email: formData.email,
    password: formData.password,
    email_confirm: true,
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
    subscription_plan: formData.subscriptionPlan || 'Standard',
    subscription_fee_rm: formData.subscriptionFeeRm ?? 99,
  });

  if (tenantErr) throw new Error(tenantErr.message);
  revalidatePath('/admin');
  return { userId: authData.user.id };
}