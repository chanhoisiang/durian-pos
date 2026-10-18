// src/app/admin/page.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  getAllWholesalerAccounts,
  toggleWholesalerStatus,
  deleteInactiveWholesalerAccount,
  updateWholesalerDetails,
  extendWholesalerSubscription,
  adminResetWholesalerPassword,
  registerWholesalerAccount,
} from './actions';
import {
  Users,
  DollarSign,
  FileText,
  ShieldAlert,
  Search,
  Edit3,
  Trash2,
  KeyRound,
  CalendarPlus,
  Plus,
  Download,
  CheckCircle2,
  Ban,
  MessageCircle,
  X,
  RefreshCw,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';

// Custom Durian SVG Badge Component
function DurianLogo({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className}>
      <path d="M32 4V12" stroke="#15803d" strokeWidth="5" strokeLinecap="round" />
      <path
        d="M32 10L38 15L46 13L48 21L56 24L53 32L58 40L51 46L52 54L43 55L38 61L32 57L26 61L21 55L12 54L13 46L6 40L11 32L8 24L16 21L18 13L26 15L32 10Z"
        fill="#166534"
        stroke="#14532d"
        strokeWidth="2.5"
      />
      <ellipse cx="25" cy="36" rx="6" ry="10" fill="#facc15" stroke="#ca8a04" strokeWidth="2" />
      <ellipse cx="39" cy="36" rx="6" ry="10" fill="#facc15" stroke="#ca8a04" strokeWidth="2" />
    </svg>
  );
}

export default function SuperAdminDashboard() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState<number>(0);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED' | 'INACTIVE_30D'>('ALL');

  // Popup Modal States
  const [editingTenant, setEditingTenant] = useState<any | null>(null);
  const [passwordModalTenant, setPasswordModalTenant] = useState<any | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // New Account Onboarding Form State
  const [newAcc, setNewAcc] = useState({
    email: '',
    password: '',
    businessName: '',
    ssmBrn: '',
    tinNumber: '',
    phone: '',
    subscriptionPlan: 'Standard',
    subscriptionFeeRm: 99,
  });

  useEffect(() => {
    setNowMs(Date.now());
    loadTenants();
  }, []);

  async function loadTenants() {
    setLoading(true);
    try {
      const data = await getAllWholesalerAccounts();
      setTenants(data);
      setNowMs(Date.now());
    } catch (err: any) {
      alert('Failed to load accounts: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // SaaS KPI Metrics Calculation
  const kpis = useMemo(() => {
    let activeCount = 0;
    let suspendedCount = 0;
    let mrrRm = 0;
    let totalBuyReceipts = 0;
    let totalSellReceipts = 0;

    tenants.forEach((t) => {
      const fee = Number(t.subscription_fee_rm ?? 99);
      if (t.is_active) {
        activeCount++;
        mrrRm += fee;
      } else {
        suspendedCount++;
      }
      totalBuyReceipts += Number(t.buy_seq || 0);
      totalSellReceipts += Number(t.sell_seq || 0);
    });

    return {
      totalTenants: tenants.length,
      activeCount,
      suspendedCount,
      mrrRm,
      arrRm: mrrRm * 12,
      totalReceipts: totalBuyReceipts + totalSellReceipts,
      totalBuyReceipts,
      totalSellReceipts,
    };
  }, [tenants]);

  // Filtered Wholesalers List
  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        (t.business_name || '').toLowerCase().includes(q) ||
        (t.email || '').toLowerCase().includes(q) ||
        (t.ssm_brn || '').toLowerCase().includes(q) ||
        (t.phone || '').toLowerCase().includes(q);

      if (!matchesSearch) return false;

      const daysInactive = nowMs
        ? Math.floor((nowMs - new Date(t.last_active_at).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      if (statusFilter === 'ACTIVE') return t.is_active === true;
      if (statusFilter === 'SUSPENDED') return t.is_active === false;
      if (statusFilter === 'INACTIVE_30D') return daysInactive >= 30;
      return true;
    });
  }, [tenants, searchQuery, statusFilter, nowMs]);

  // Save Customer Info & Subscription Fee Changes
  async function handleSaveTenantDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTenant) return;
    setSaving(true);
    try {
      await updateWholesalerDetails({
        id: editingTenant.id,
        business_name: editingTenant.business_name,
        ssm_brn: editingTenant.ssm_brn || '',
        tin_number: editingTenant.tin_number || '',
        phone: editingTenant.phone || '',
        msic_code: editingTenant.msic_code || '46312',
        subscription_plan: editingTenant.subscription_plan || 'Standard',
        subscription_fee_rm: Number(editingTenant.subscription_fee_rm) || 0,
        subscription_expires_at:
          editingTenant.subscription_expires_at || new Date().toISOString(),
        admin_notes: editingTenant.admin_notes || '',
      });
      setEditingTenant(null);
      await loadTenants();
    } catch (err: any) {
      alert('Error updating account: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  // Handle Password Reset
  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordModalTenant) return;
    setSaving(true);
    try {
      await adminResetWholesalerPassword(passwordModalTenant.id, newPasswordInput);
      alert(`Password for ${passwordModalTenant.business_name} has been reset!`);
      setPasswordModalTenant(null);
      setNewPasswordInput('');
    } catch (err: any) {
      alert('Reset error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  // Handle Admin Manual Wholesaler Onboarding
  async function handleCreateWholesaler(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const randomBytes = window.crypto.getRandomValues(new Uint8Array(16));
      const saltBase64 = btoa(String.fromCharCode(...randomBytes));

      await registerWholesalerAccount({
        ...newAcc,
        vaultSalt: saltBase64,
      });

      setIsCreateModalOpen(false);
      setNewAcc({
        email: '',
        password: '',
        businessName: '',
        ssmBrn: '',
        tinNumber: '',
        phone: '',
        subscriptionPlan: 'Standard',
        subscriptionFeeRm: 99,
      });
      await loadTenants();
    } catch (err: any) {
      alert('Error creating account: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  // Export All Wholesaler Accounts & Subscription Report to CSV
  function handleExportCsv() {
    const headers = [
      'Business Name',
      'SSM BRN',
      'LHDN TIN',
      'Email',
      'Phone',
      'Status',
      'Plan',
      'Monthly Fee (RM)',
      'Expires At',
      'Buy Receipts',
      'Sell Receipts',
      'Last Active',
    ];
    const rows = tenants.map((t) => [
      `"${(t.business_name || '').replace(/"/g, '""')}"`,
      `"${t.ssm_brn || ''}"`,
      `"${t.tin_number || ''}"`,
      `"${t.email || ''}"`,
      `"${t.phone || ''}"`,
      t.is_active ? 'ACTIVE' : 'SUSPENDED',
      `"${t.subscription_plan || 'Standard'}"`,
      Number(t.subscription_fee_rm ?? 99).toFixed(2),
      t.subscription_expires_at ? new Date(t.subscription_expires_at).toLocaleDateString('en-MY') : 'N/A',
      t.buy_seq || 0,
      t.sell_seq || 0,
      new Date(t.last_active_at).toLocaleDateString('en-MY'),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `durian_pos_wholesalers_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="min-h-screen bg-[#f8faf5] text-slate-900 pb-20">
      {/* Top Durian Husk Green & Gold Header */}
      <header className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-green-900 text-white border-b-4 border-amber-400 px-4 sm:px-8 py-5 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-amber-400 rounded-2xl shadow-md">
              <DurianLogo className="w-10 h-10" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-amber-400 text-slate-950 font-extrabold text-xs rounded-full uppercase">
                  SaaS Owner Control
                </span>
                <span className="text-xs text-emerald-200 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-amber-300" /> Zero-Knowledge E2EE Active
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-0.5">
                Durian King POS — Super Admin Center
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="px-4 py-3 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-emerald-100 font-extrabold text-sm flex items-center gap-2 border border-emerald-600 transition"
            >
              <ArrowLeft className="w-4 h-4" /> Go to POS Terminal
            </Link>
            <button
              onClick={handleExportCsv}
              className="px-4 py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-sm flex items-center gap-2 shadow"
            >
              <Download className="w-4 h-4 text-emerald-700" /> Export CSV
            </button>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm sm:text-base flex items-center gap-2 shadow-lg transition"
            >
              <Plus className="w-5 h-5" /> + Onboard Wholesaler (新增批发商)
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-8 space-y-6">
        {/* 1. SAAS KPI & REVENUE SUMMARY CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Monthly Recurring Revenue (MRR) */}
          <div className="bg-gradient-to-br from-emerald-900 to-green-800 text-white border-2 border-amber-400 rounded-3xl p-6 shadow-md">
            <div className="flex justify-between items-center">
              <span className="text-xs font-extrabold uppercase bg-emerald-950/80 text-amber-300 px-3 py-1 rounded-full">
                Monthly Revenue (每月订阅收入)
              </span>
              <DollarSign className="w-7 h-7 text-amber-400" />
            </div>
            <div className="text-3xl sm:text-4xl font-mono font-extrabold text-amber-300 mt-4">
              RM {kpis.mrrRm.toFixed(2)}
              <span className="text-sm text-emerald-200 font-normal"> /mo</span>
            </div>
            <div className="text-xs font-bold text-emerald-100 mt-2">
              Est. Annual (ARR): <span className="font-mono">RM {kpis.arrRm.toFixed(2)}/yr</span>
            </div>
          </div>

          {/* Card 2: Total Wholesaler Capacity */}
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex justify-between items-center">
              <span className="text-xs font-extrabold uppercase bg-emerald-100 text-emerald-900 px-3 py-1 rounded-full">
                Wholesaler Accounts (客户总数)
              </span>
              <Users className="w-7 h-7 text-emerald-700" />
            </div>
            <div className="text-3xl sm:text-4xl font-mono font-extrabold text-slate-900 mt-4">
              {kpis.totalTenants} <span className="text-lg text-slate-400">/ 100</span>
            </div>
            <div className="text-xs font-bold text-slate-600 mt-2">
              <span className="text-emerald-700">{kpis.activeCount} Active</span> •{' '}
              <span className="text-red-600">{kpis.suspendedCount} Suspended</span>
            </div>
          </div>

          {/* Card 3: Total e-Invoice Receipts Issued */}
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex justify-between items-center">
              <span className="text-xs font-extrabold uppercase bg-amber-100 text-amber-900 px-3 py-1 rounded-full">
                Platform e-Invoices (总开单量)
              </span>
              <FileText className="w-7 h-7 text-amber-600" />
            </div>
            <div className="text-3xl sm:text-4xl font-mono font-extrabold text-slate-900 mt-4">
              {kpis.totalReceipts}
            </div>
            <div className="text-xs font-bold text-slate-600 mt-2">
              Buy (Code 11): <span className="text-amber-700">{kpis.totalBuyReceipts}</span> • Sell
              (Code 01): <span className="text-emerald-700">{kpis.totalSellReceipts}</span>
            </div>
          </div>

          {/* Card 4: Inactive / Suspended Alert */}
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex justify-between items-center">
              <span className="text-xs font-extrabold uppercase bg-red-100 text-red-900 px-3 py-1 rounded-full">
                Account Health (账户状态)
              </span>
              <ShieldAlert className="w-7 h-7 text-red-600" />
            </div>
            <div className="text-3xl sm:text-4xl font-mono font-extrabold text-slate-900 mt-4">
              {kpis.suspendedCount} <span className="text-base font-bold text-slate-500">Suspended</span>
            </div>
            <div className="text-xs font-bold text-slate-600 mt-2">
              Can suspend or delete inactive accounts anytime
            </div>
          </div>
        </div>

        {/* 2. SEARCH BAR & FILTER PILLS */}
        <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 shadow-sm flex flex-wrap justify-between items-center gap-4">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Business Name, Email, Phone, or SSM No..."
              className="w-full bg-slate-50 border-2 border-slate-300 focus:border-emerald-600 rounded-2xl pl-12 pr-4 py-3 text-base font-bold text-slate-900 outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'ALL', label: `All (${tenants.length})` },
              { id: 'ACTIVE', label: `Active (${kpis.activeCount})` },
              { id: 'SUSPENDED', label: `Suspended (${kpis.suspendedCount})` },
              { id: 'INACTIVE_30D', label: 'Inactive > 30 Days (不活跃)' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-4 py-3 rounded-xl font-extrabold text-sm transition ${
                  statusFilter === tab.id
                    ? 'bg-emerald-800 text-amber-300 shadow'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}

            <button
              onClick={loadTenants}
              className="p-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
              title="Refresh List"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 3. WHOLESALER ACCOUNTS TABLE */}
        <div className="bg-white border-2 border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm sm:text-base">
              <thead className="bg-slate-100 text-slate-800 uppercase text-xs sm:text-sm font-extrabold border-b-2 border-slate-200">
                <tr>
                  <th className="p-5">Wholesaler / SSM &amp; TIN</th>
                  <th className="p-5">Contact Info</th>
                  <th className="p-5">Subscription &amp; Fee</th>
                  <th className="p-5">POS Usage</th>
                  <th className="p-5">Last Active</th>
                  <th className="p-5">Status</th>
                  <th className="p-5 text-right">Admin Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-200">
                {filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-slate-500 font-bold text-lg">
                      No wholesaler accounts match your filter.
                    </td>
                  </tr>
                ) : (
                  filteredTenants.map((t) => {
                    const daysInactive = nowMs
                      ? Math.floor(
                          (nowMs - new Date(t.last_active_at).getTime()) / (1000 * 60 * 60 * 24)
                        )
                      : 0;
                    const feeRm = Number(t.subscription_fee_rm ?? 99);
                    const planName = t.subscription_plan || 'Standard';
                    const isExpired =
                      t.subscription_expires_at &&
                      nowMs > 0 &&
                      new Date(t.subscription_expires_at).getTime() < nowMs;

                    const cleanPhone = (t.phone || '').replace(/[^0-9]/g, '');
                    const waPhone = cleanPhone.startsWith('0')
                      ? '6' + cleanPhone
                      : cleanPhone;

                    return (
                      <tr key={t.id} className="hover:bg-amber-50/40 transition">
                        {/* Business Info */}
                        <td className="p-5">
                          <div className="font-extrabold text-lg text-slate-900">
                            {t.business_name}
                          </div>
                          <div className="text-xs font-bold text-slate-500 mt-0.5">
                            SSM: <span className="font-mono text-slate-700">{t.ssm_brn || 'N/A'}</span> • TIN:{' '}
                            <span className="font-mono text-slate-700">{t.tin_number || 'N/A'}</span>
                          </div>
                          {t.admin_notes && (
                            <div className="mt-1.5 inline-block px-2.5 py-0.5 bg-amber-100 border border-amber-300 text-amber-900 rounded-md text-xs font-bold">
                              Note: {t.admin_notes}
                            </div>
                          )}
                        </td>

                        {/* Contact & WhatsApp */}
                        <td className="p-5">
                          <div className="font-bold text-slate-800">{t.email}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm font-mono font-bold text-slate-600">
                              {t.phone || 'No phone'}
                            </span>
                            {waPhone && (
                              <a
                                href={`https://wa.me/${waPhone}?text=${encodeURIComponent(
                                  `Hi ${t.business_name}, this is Durian King POS Admin regarding your account subscription.`
                                )}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-md text-xs font-extrabold inline-flex items-center gap-1"
                              >
                                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                              </a>
                            )}
                          </div>
                        </td>

                        {/* Subscription Plan, Fee & Expiry */}
                        <td className="p-5">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 bg-amber-200 text-amber-950 rounded-lg text-xs font-extrabold uppercase">
                              {planName}
                            </span>
                            <span className="font-mono font-extrabold text-lg text-emerald-800">
                              RM {feeRm.toFixed(2)}/mo
                            </span>
                          </div>
                          <div className="text-xs font-bold mt-1">
                            Expires:{' '}
                            <span className={isExpired ? 'text-red-600 font-extrabold' : 'text-slate-600'}>
                              {t.subscription_expires_at
                                ? new Date(t.subscription_expires_at).toLocaleDateString('en-MY')
                                : 'No Expiry Set'}
                              {isExpired ? ' (EXPIRED)' : ''}
                            </span>
                          </div>
                        </td>

                        {/* Receipt Counters */}
                        <td className="p-5 font-mono font-bold">
                          <div className="text-amber-800 text-sm">Buy: {t.buy_seq || 0}</div>
                          <div className="text-emerald-800 text-sm">Sell: {t.sell_seq || 0}</div>
                        </td>

                        {/* Last Active */}
                        <td className="p-5">
                          <div className="font-bold text-slate-900">
                            {new Date(t.last_active_at).toLocaleDateString('en-MY')}
                          </div>
                          <div
                            className={`text-xs font-extrabold ${
                              daysInactive >= 30 ? 'text-red-600' : 'text-slate-500'
                            }`}
                          >
                            {daysInactive} days ago
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="p-5">
                          <span
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1 ${
                              t.is_active
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : 'bg-red-100 text-red-900 border border-red-300'
                            }`}
                          >
                            {t.is_active ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" /> Active
                              </>
                            ) : (
                              <>
                                <Ban className="w-3.5 h-3.5" /> Suspended
                              </>
                            )}
                          </span>
                        </td>

                        {/* Action Buttons */}
                        <td className="p-5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {/* Edit Info & Fee Button */}
                            <button
                              onClick={() => setEditingTenant({ ...t })}
                              className="px-3.5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 shadow-sm"
                              title="Edit Customer Info & Subscription Fee"
                            >
                              <Edit3 className="w-4 h-4" /> Edit Info &amp; Fee
                            </button>

                            {/* Quick +30 Days Renew Button */}
                            <button
                              onClick={async () => {
                                await extendWholesalerSubscription(
                                  t.id,
                                  t.subscription_expires_at
                                );
                                await loadTenants();
                              }}
                              className="px-3 py-2.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 text-xs font-extrabold flex items-center gap-1"
                              title="Extend Subscription by +30 Days"
                            >
                              <CalendarPlus className="w-4 h-4" /> +30d
                            </button>

                            {/* Reset Password Button */}
                            <button
                              onClick={() => {
                                setPasswordModalTenant(t);
                                setNewPasswordInput('');
                              }}
                              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
                              title="Reset Login Password"
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>

                            {/* Suspend / Activate Toggle */}
                            <button
                              onClick={async () => {
                                await toggleWholesalerStatus(t.id, !t.is_active);
                                await loadTenants();
                              }}
                              className={`px-3 py-2.5 rounded-xl text-xs font-extrabold ${
                                t.is_active
                                  ? 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                                  : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                              }`}
                            >
                              {t.is_active ? 'Suspend' : 'Activate'}
                            </button>

                            {/* Delete Account */}
                            <button
                              onClick={async () => {
                                if (
                                  confirm(
                                    `Are you sure you want to permanently DELETE "${t.business_name}" and wipe all their data?`
                                  )
                                ) {
                                  await deleteInactiveWholesalerAccount(t.id);
                                  await loadTenants();
                                }
                              }}
                              className="p-2.5 rounded-xl bg-red-100 hover:bg-red-600 text-red-700 hover:text-white transition"
                              title="Delete Account Permanently"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* POPUP MODAL 1: EDIT CUSTOMER BASIC INFO, LHDN TIN & SUBSCRIPTION FEE      */}
      {/* ========================================================================= */}
      {editingTenant && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border-4 border-amber-400 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl my-auto">
            <div className="flex justify-between items-center border-b-2 border-slate-100 pb-4 mb-5">
              <div className="flex items-center gap-3">
                <DurianLogo className="w-9 h-9" />
                <div>
                  <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                    Manage Wholesaler Account
                  </h3>
                  <p className="text-xs font-bold text-slate-500">{editingTenant.email}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingTenant(null)}
                className="p-2 rounded-full bg-slate-100 hover:bg-slate-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveTenantDetails} className="space-y-4">
              {/* Section A: Basic Customer & LHDN Info */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="text-xs font-extrabold uppercase text-emerald-800">
                  1. Customer Basic Info &amp; LHDN Profile (基本与税务资料)
                </div>

                <div>
                  <label className="block text-sm font-extrabold text-slate-800 mb-1">
                    Business Name (榴莲批发公司名称)
                  </label>
                  <input
                    type="text"
                    required
                    value={editingTenant.business_name || ''}
                    onChange={(e) =>
                      setEditingTenant({ ...editingTenant, business_name: e.target.value })
                    }
                    className="w-full bg-white border-2 border-slate-300 rounded-xl px-3.5 py-2.5 text-base font-bold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-600 mb-1">
                      SSM BRN No.
                    </label>
                    <input
                      type="text"
                      value={editingTenant.ssm_brn || ''}
                      onChange={(e) =>
                        setEditingTenant({ ...editingTenant, ssm_brn: e.target.value })
                      }
                      className="w-full bg-white border-2 border-slate-300 rounded-xl px-3 py-2 text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-slate-600 mb-1">
                      LHDN TIN No.
                    </label>
                    <input
                      type="text"
                      value={editingTenant.tin_number || ''}
                      onChange={(e) =>
                        setEditingTenant({ ...editingTenant, tin_number: e.target.value })
                      }
                      className="w-full bg-white border-2 border-slate-300 rounded-xl px-3 py-2 text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-slate-600 mb-1">
                      Phone (电话)
                    </label>
                    <input
                      type="text"
                      value={editingTenant.phone || ''}
                      onChange={(e) =>
                        setEditingTenant({ ...editingTenant, phone: e.target.value })
                      }
                      className="w-full bg-white border-2 border-slate-300 rounded-xl px-3 py-2 text-sm font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Section B: Subscription Fee & Billing Plan */}
              <div className="bg-amber-50/70 p-4 rounded-2xl border-2 border-amber-300 space-y-3">
                <div className="text-xs font-extrabold uppercase text-amber-900">
                  2. Subscription Plan &amp; Monthly Fee (订阅配套与月费调整)
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1">
                      Plan Tier (配套)
                    </label>
                    <select
                      value={editingTenant.subscription_plan || 'Standard'}
                      onChange={(e) =>
                        setEditingTenant({ ...editingTenant, subscription_plan: e.target.value })
                      }
                      className="w-full bg-white border-2 border-amber-400 rounded-xl px-3 py-2.5 text-sm font-extrabold"
                    >
                      <option value="Free Trial">Free Trial (试用)</option>
                      <option value="Standard">Standard (标准版)</option>
                      <option value="Seasonal Peak">Seasonal (榴莲季节版)</option>
                      <option value="Enterprise">Enterprise (大型批发)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-emerald-800 mb-1">
                      Monthly Fee (RM/月)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={editingTenant.subscription_fee_rm ?? 99}
                      onChange={(e) =>
                        setEditingTenant({
                          ...editingTenant,
                          subscription_fee_rm: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-white border-2 border-emerald-500 rounded-xl px-3 py-2 text-lg font-mono font-extrabold text-emerald-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1">
                      Expiry Date (到期日)
                    </label>
                    <input
                      type="date"
                      value={
                        editingTenant.subscription_expires_at
                          ? new Date(editingTenant.subscription_expires_at)
                              .toISOString()
                              .slice(0, 10)
                          : ''
                      }
                      onChange={(e) =>
                        setEditingTenant({
                          ...editingTenant,
                          subscription_expires_at: new Date(e.target.value).toISOString(),
                        })
                      }
                      className="w-full bg-white border-2 border-slate-300 rounded-xl px-3 py-2 text-sm font-bold"
                    />
                  </div>
                </div>

                {/* Quick Fee Preset Pills */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs font-bold text-slate-600">Quick Fee Presets:</span>
                  {[0, 49, 99, 149, 199, 299].map((price) => (
                    <button
                      key={price}
                      type="button"
                      onClick={() =>
                        setEditingTenant({ ...editingTenant, subscription_fee_rm: price })
                      }
                      className="px-2.5 py-1 bg-white hover:bg-emerald-50 border border-amber-400 rounded-lg text-xs font-mono font-extrabold text-slate-800"
                    >
                      RM {price}
                    </button>
                  ))}
                </div>
              </div>

              {/* Section C: Admin Internal Notes */}
              <div>
                <label className="block text-xs font-extrabold uppercase text-slate-500 mb-1">
                  Internal Admin Notes (管理员备注 — 仅自己可见)
                </label>
                <input
                  type="text"
                  value={editingTenant.admin_notes || ''}
                  onChange={(e) =>
                    setEditingTenant({ ...editingTenant, admin_notes: e.target.value })
                  }
                  placeholder="e.g. Paid via Maybank QR on 18 Oct, Raub main distributor"
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold"
                />
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingTenant(null)}
                  className="flex-1 py-3.5 rounded-2xl bg-slate-200 text-slate-800 font-extrabold text-base"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-base shadow-lg"
                >
                  {saving ? 'Saving...' : 'Save Changes (保存修改)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* POPUP MODAL 2: RESET WHOLESALER LOGIN PASSWORD                            */}
      {/* ========================================================================= */}
      {passwordModalTenant && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-4 border-emerald-700 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
              <h3 className="text-xl font-extrabold text-slate-900">
                Reset Login Password
              </h3>
              <button
                onClick={() => setPasswordModalTenant(null)}
                className="p-2 rounded-full bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Set a new login password for <strong>{passwordModalTenant.business_name}</strong> (
              {passwordModalTenant.email}).
            </p>
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <input
                type="text"
                required
                minLength={6}
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                placeholder="Enter new password (min 6 chars)"
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-4 py-3 text-lg font-mono font-bold"
              />
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-base shadow-lg"
              >
                {saving ? 'Resetting...' : 'Confirm Password Reset'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* POPUP MODAL 3: ONBOARD NEW WHOLESALER DIRECTLY FROM ADMIN PANEL           */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border-4 border-amber-400 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl my-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-5">
              <div className="flex items-center gap-2.5">
                <DurianLogo className="w-8 h-8" />
                <h3 className="text-xl font-extrabold text-slate-900">
                  Onboard New Wholesaler (新增批发商账户)
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 rounded-full bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWholesaler} className="space-y-4">
              <div>
                <label className="block text-sm font-extrabold text-slate-800 mb-1">
                  Business Name (公司名称) *
                </label>
                <input
                  type="text"
                  required
                  value={newAcc.businessName}
                  onChange={(e) => setNewAcc({ ...newAcc, businessName: e.target.value })}
                  placeholder="e.g. Pahang Musang King Hub Sdn Bhd"
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2.5 text-base font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Login Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={newAcc.email}
                    onChange={(e) => setNewAcc({ ...newAcc, email: e.target.value })}
                    placeholder="boss@durian.com"
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Temp Password *
                  </label>
                  <input
                    type="text"
                    required
                    minLength={6}
                    value={newAcc.password}
                    onChange={(e) => setNewAcc({ ...newAcc, password: e.target.value })}
                    placeholder="durian888"
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2.5 text-sm font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    SSM BRN
                  </label>
                  <input
                    type="text"
                    required
                    value={newAcc.ssmBrn}
                    onChange={(e) => setNewAcc({ ...newAcc, ssmBrn: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    LHDN TIN
                  </label>
                  <input
                    type="text"
                    required
                    value={newAcc.tinNumber}
                    onChange={(e) => setNewAcc({ ...newAcc, tinNumber: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    required
                    value={newAcc.phone}
                    onChange={(e) => setNewAcc({ ...newAcc, phone: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-sm font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-amber-50 p-3.5 rounded-2xl border border-amber-300">
                <div>
                  <label className="block text-xs font-extrabold text-amber-900 mb-1">
                    Subscription Plan
                  </label>
                  <select
                    value={newAcc.subscriptionPlan}
                    onChange={(e) => setNewAcc({ ...newAcc, subscriptionPlan: e.target.value })}
                    className="w-full bg-white border border-amber-400 rounded-xl px-3 py-2 text-sm font-extrabold"
                  >
                    <option value="Free Trial">Free Trial</option>
                    <option value="Standard">Standard</option>
                    <option value="Seasonal Peak">Seasonal Peak</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-emerald-900 mb-1">
                    Monthly Fee (RM)
                  </label>
                  <input
                    type="number"
                    value={newAcc.subscriptionFeeRm}
                    onChange={(e) =>
                      setNewAcc({ ...newAcc, subscriptionFeeRm: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-white border border-emerald-500 rounded-xl px-3 py-2 text-base font-mono font-extrabold text-emerald-900"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-lg shadow-lg"
              >
                {saving ? 'Creating Account...' : 'Create & Activate Wholesaler'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}