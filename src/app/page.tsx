// src/app/page.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  ConfidentialTxPayload,
  encryptTransactionPayload,
  decryptTransactionPayload,
} from '@/lib/crypto';
import { buildLhdnMyInvoisPayload } from '@/lib/einvoice';
import { registerWholesalerAccount } from './admin/actions';
import {
  Scale,
  ShieldCheck,
  Printer,
  LogOut,
  Plus,
  Trash2,
  Lock,
  Package,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  TrendingUp,
  Coins,
  BookOpen,
  UserCheck,
  X,
  ShoppingBag,
  Sparkles,
  Edit3,
} from 'lucide-react';

// Varieties with their default specific grades (Musang King has full A, AB, B, C, CC, CCC, Z, ZZ!)
export interface VarietyConfig {
  code: string;
  name: string;
  short: string;
  grades: Record<string, { buy: number; sell: number }>;
}

const DEFAULT_VARIETY_CONFIGS: VarietyConfig[] = [
  {
    code: 'D197-MK',
    name: 'Musang King (猫山王)',
    short: '猫山王 MK',
    grades: {
      A: { buy: 42, sell: 55 },
      AB: { buy: 36, sell: 46 },
      B: { buy: 28, sell: 36 },
      C: { buy: 18, sell: 25 },
      CC: { buy: 14, sell: 20 },
      CCC: { buy: 10, sell: 15 },
      Z: { buy: 7, sell: 11 },
      ZZ: { buy: 5, sell: 8 },
      'BB (果肉)': { buy: 45, sell: 58 },
    },
  },
  {
    code: 'D200-BT',
    name: 'Black Thorn (黑刺)',
    short: '黑刺 BT',
    grades: {
      A: { buy: 50, sell: 65 },
      AB: { buy: 42, sell: 54 },
      B: { buy: 32, sell: 42 },
      C: { buy: 20, sell: 28 },
    },
  },
  {
    code: 'D24-XO',
    name: 'D24 / Sultan (苏丹)',
    short: 'D24 苏丹',
    grades: {
      A: { buy: 16, sell: 23 },
      B: { buy: 11, sell: 16 },
      C: { buy: 7, sell: 11 },
    },
  },
  {
    code: 'D101',
    name: 'D101 Red Prawn (红虾)',
    short: 'D101 红虾',
    grades: {
      A: { buy: 17, sell: 25 },
      B: { buy: 12, sell: 18 },
    },
  },
  {
    code: 'TEKKA',
    name: 'Tekka / 竹脚 (D160)',
    short: '竹脚 Tekka',
    grades: {
      A: { buy: 18, sell: 26 },
      B: { buy: 12, sell: 18 },
    },
  },
  {
    code: 'KAMPUNG',
    name: 'Kampung (甘榜榴莲)',
    short: '甘榜 KP',
    grades: {
      A: { buy: 7, sell: 12 },
      B: { buy: 4, sell: 8 },
    },
  },
];

// Quick Raga Basket Tare Preset Buttons (Includes 0kg for 1-2 loose durians!)
const RAGA_TARE_PRESETS = [
  { label: 'No Basket (单粒/无萝)', kg: 0 },
  { label: 'Small Raga (小萝)', kg: 1.5 },
  { label: 'Std Raga (标准萝)', kg: 2.5 },
  { label: 'Big Raga (大萝)', kg: 3.0 },
  { label: 'Heavy Raga (特大萝)', kg: 3.5 },
];

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

export default function DurianPosApp() {
  const supabase = createClient();

  // Auth & Tenant State
  const [user, setUser] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Auth Form State
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [ssmBrn, setSsmBrn] = useState('');
  const [tinNumber, setTinNumber] = useState('');
  const [phone, setPhone] = useState('');

  // Zero-Knowledge Vault PIN State
  const [vaultPin, setVaultPin] = useState('');
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);

  // Main Navigation Tabs
  const [activeTab, setActiveTab] = useState<
    'BUY_FARMER' | 'SELL_RESELLER' | 'PRICE_BOARD' | 'LEDGER' | 'INVENTORY'
  >('BUY_FARMER');

  // Dynamic Variety & Grade Master Config
  const [varietyConfigs, setVarietyConfigs] = useState<VarietyConfig[]>(DEFAULT_VARIETY_CONFIGS);
  const [newGradeInputs, setNewGradeInputs] = useState<Record<string, string>>({});

  // Database Records & Auto-Decrypted Ledger
  const [inventory, setInventory] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [decryptedLedger, setDecryptedLedger] = useState<
    Array<{ meta: any; data: ConfidentialTxPayload }>
  >([]);
  const [ledgerFilter, setLedgerFilter] = useState<'TODAY' | 'ALL'>('TODAY');

  // Cart & Popup Modal States (For Clean, No-Scroll Mobile Efficiency!)
  const [cartItems, setCartItems] = useState<
    Array<{
      varietyCode: string;
      varietyName: string;
      grade: string;
      grossWeightKg: number;
      basketTareKg: number;
      pricePerKgRm: number;
    }>
  >([]);

  const [isAddBasketModalOpen, setIsAddBasketModalOpen] = useState(false);
  const [editingCartIndex, setEditingCartIndex] = useState<number | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [successPopupData, setSuccessPopupData] = useState<{
    meta: any;
    decrypted: ConfidentialTxPayload;
    lhdnJson: any;
  } | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<{
    meta: any;
    decrypted: ConfidentialTxPayload;
    lhdnJson: any;
  } | null>(null);

  // Weighing Popup Form State (Single Basket / Item)
  const [modalVarietyCode, setModalVarietyCode] = useState('D197-MK');
  const [modalGrade, setModalGrade] = useState('A');
  const [modalGrossKg, setModalGrossKg] = useState<string>('');
  const [modalTareKg, setModalTareKg] = useState<number>(2.5);
  const [modalPriceRm, setModalPriceRm] = useState<number>(42);

  // Customer / Farmer Popup Form State
  const [counterpartyName, setCounterpartyName] = useState('');
  const [counterpartyTin, setCounterpartyTin] = useState('');
  const [counterpartyIdValue, setCounterpartyIdValue] = useState('');
  const [counterpartyPhone, setCounterpartyPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<
    'CASH' | 'BANK_TRANSFER' | 'EWALLET' | 'CREDIT_TERM'
  >('CASH');
  const [submitting, setSubmitting] = useState(false);

  // Lookup price from Dynamic Master Config
  function getMasterPrice(
    varietyCode: string,
    grade: string,
    mode: 'BUY_FARMER' | 'SELL_RESELLER',
    configs = varietyConfigs
  ): number {
    const v = configs.find((c) => c.code === varietyCode);
    if (!v || !v.grades[grade]) return 0;
    return mode === 'BUY_FARMER' ? v.grades[grade].buy : v.grades[grade].sell;
  }

  useEffect(() => {
    checkSession();
  }, []);

  // Load saved custom grades & master prices per tenant from localStorage
  useEffect(() => {
    if (tenant?.id) {
      const saved = localStorage.getItem(`durian_variety_configs_v2_${tenant.id}`);
      if (saved) {
        try {
          setVarietyConfigs(JSON.parse(saved));
        } catch {}
      }
    }
  }, [tenant]);

  function saveConfigsToStorage(updated: VarietyConfig[]) {
    setVarietyConfigs(updated);
    if (tenant?.id) {
      localStorage.setItem(`durian_variety_configs_v2_${tenant.id}`, JSON.stringify(updated));
    }
  }

  // Auto-decrypt all transactions in memory whenever Vault is unlocked
  useEffect(() => {
    async function decryptAllForLedger() {
      if (!isVaultUnlocked || !vaultPin || !tenant?.vault_salt || transactions.length === 0) {
        setDecryptedLedger([]);
        return;
      }
      const results: Array<{ meta: any; data: ConfidentialTxPayload }> = [];
      for (const tx of transactions) {
        try {
          const d = await decryptTransactionPayload(
            tx.encrypted_payload,
            tx.encryption_iv,
            vaultPin,
            tenant.vault_salt
          );
          results.push({ meta: tx, data: d });
        } catch {}
      }
      setDecryptedLedger(results);
    }
    decryptAllForLedger();
  }, [isVaultUnlocked, vaultPin, tenant, transactions]);

  async function checkSession() {
    setLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
      await fetchTenantProfile(session.user.id);
    }
    setLoading(false);
  }

  async function fetchTenantProfile(userId: string) {
    const { data: profile } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', userId)
      .single();

    if (profile) {
      setTenant(profile);
      await fetchInventoryAndHistory(userId);
    }
  }

  async function fetchInventoryAndHistory(userId: string) {
    const { data: inv } = await supabase
      .from('durian_inventory')
      .select('*')
      .eq('tenant_id', userId)
      .order('variety_code');
    if (inv) setInventory(inv);

    const { data: txs } = await supabase
      .from('transactions')
      .select('*')
      .eq('tenant_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (txs) setTransactions(txs);
  }

  // Switch between Buy & Sell mode and auto-update Cart prices
  function switchPosMode(newMode: 'BUY_FARMER' | 'SELL_RESELLER') {
    setSelectedReceipt(null);
    setActiveTab(newMode);
    setCartItems((prev) =>
      prev.map((item) => ({
        ...item,
        pricePerKgRm: getMasterPrice(item.varietyCode, item.grade, newMode),
      }))
    );
  }

  // Open the Weighing Popup Modal (New Basket or Edit Existing Basket)
  function openWeighingModal(editIdx: number | null = null, presetVariety?: string, presetGrade?: string) {
    const mode = activeTab === 'SELL_RESELLER' ? 'SELL_RESELLER' : 'BUY_FARMER';
    if (editIdx !== null && cartItems[editIdx]) {
      const item = cartItems[editIdx];
      setEditingCartIndex(editIdx);
      setModalVarietyCode(item.varietyCode);
      setModalGrade(item.grade);
      setModalGrossKg(String(item.grossWeightKg));
      setModalTareKg(item.basketTareKg);
      setModalPriceRm(item.pricePerKgRm);
    } else {
      setEditingCartIndex(null);
      const vCode = presetVariety || 'D197-MK';
      const vObj = varietyConfigs.find((v) => v.code === vCode) || varietyConfigs[0];
      const availableGrades = Object.keys(vObj.grades);
      const gCode = presetGrade && availableGrades.includes(presetGrade) ? presetGrade : availableGrades[0] || 'A';

      setModalVarietyCode(vObj.code);
      setModalGrade(gCode);
      setModalGrossKg('');
      setModalTareKg(2.5);
      setModalPriceRm(getMasterPrice(vObj.code, gCode, mode));
    }
    setIsAddBasketModalOpen(true);
  }

  // Save Basket from Weighing Popup Modal into Cart
  function handleSaveBasketToCart(e: React.FormEvent) {
    e.preventDefault();
    const gross = parseFloat(modalGrossKg) || 0;
    if (gross <= 0) {
      alert('Please enter Gross Weight (毛重) greater than 0 kg!');
      return;
    }
    const vObj = varietyConfigs.find((v) => v.code === modalVarietyCode) || varietyConfigs[0];

    const newBasket = {
      varietyCode: vObj.code,
      varietyName: vObj.name,
      grade: modalGrade,
      grossWeightKg: gross,
      basketTareKg: modalTareKg,
      pricePerKgRm: modalPriceRm,
    };

    if (editingCartIndex !== null) {
      const updated = [...cartItems];
      updated[editingCartIndex] = newBasket;
      setCartItems(updated);
    } else {
      setCartItems([...cartItems, newBasket]);
    }
    setIsAddBasketModalOpen(false);
  }

  // Master Price Board: Update Buy/Sell Price for a Variety + Grade
  function updateGradePrice(
    varietyCode: string,
    grade: string,
    field: 'buy' | 'sell',
    value: number
  ) {
    const updated = varietyConfigs.map((v) => {
      if (v.code !== varietyCode) return v;
      return {
        ...v,
        grades: {
          ...v.grades,
          [grade]: {
            buy: v.grades[grade]?.buy ?? 0,
            sell: v.grades[grade]?.sell ?? 0,
            [field]: value,
          },
        },
      };
    });
    saveConfigsToStorage(updated);
  }

  // Master Price Board: Add Custom Grade (e.g., AB, CC, CCC, Z, ZZ, XO) to a Variety
  function handleAddCustomGrade(varietyCode: string) {
    const rawGrade = (newGradeInputs[varietyCode] || '').trim().toUpperCase();
    if (!rawGrade) return alert('Please type a Grade name (e.g. AB, CC, CCC, Z, ZZ)');

    const updated = varietyConfigs.map((v) => {
      if (v.code !== varietyCode) return v;
      if (v.grades[rawGrade]) {
        alert(`Grade ${rawGrade} already exists for ${v.name}`);
        return v;
      }
      return {
        ...v,
        grades: {
          ...v.grades,
          [rawGrade]: { buy: 15, sell: 22 },
        },
      };
    });

    saveConfigsToStorage(updated);
    setNewGradeInputs({ ...newGradeInputs, [varietyCode]: '' });
  }

  // Master Price Board: Remove a Grade from a Variety
  function handleDeleteGrade(varietyCode: string, gradeToDelete: string) {
    const updated = varietyConfigs.map((v) => {
      if (v.code !== varietyCode) return v;
      const gradeKeys = Object.keys(v.grades);
      if (gradeKeys.length <= 1) {
        alert('Each durian variety must have at least 1 grade!');
        return v;
      }
      const nextGrades = { ...v.grades };
      delete nextGrades[gradeToDelete];
      return { ...v, grades: nextGrades };
    });
    saveConfigsToStorage(updated);
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegistering) {
        const randomBytes = window.crypto.getRandomValues(new Uint8Array(16));
        const saltBase64 = btoa(String.fromCharCode(...randomBytes));

        await registerWholesalerAccount({
          email,
          password,
          businessName,
          ssmBrn,
          tinNumber,
          phone,
          vaultSalt: saltBase64,
        });

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setUser(data.user);
        await fetchTenantProfile(data.user.id);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setUser(data.user);
        await fetchTenantProfile(data.user.id);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Final Checkout & Save Encrypted Transaction
  async function handleCheckoutTransaction() {
    if (cartItems.length === 0) {
      alert('Your cart is empty! Tap "+ Weigh & Add Durian" first.');
      return;
    }
    if (!counterpartyName.trim()) {
      setIsCustomerModalOpen(true);
      return;
    }

    setSubmitting(true);
    try {
      const computedItems = cartItems.map((item) => {
        const netWeightKg = Math.max(0, Number((item.grossWeightKg - item.basketTareKg).toFixed(2)));
        const subtotalRm = Number((netWeightKg * item.pricePerKgRm).toFixed(2));
        return {
          ...item,
          netWeightKg,
          subtotalRm,
        };
      });

      const totalNetWeightKg = computedItems.reduce((sum, i) => sum + i.netWeightKg, 0);
      const grandTotalRm = computedItems.reduce((sum, i) => sum + i.subtotalRm, 0);

      const confidentialPayload: ConfidentialTxPayload = {
        counterpartyName: counterpartyName.trim(),
        counterpartyTin,
        counterpartyIdValue,
        counterpartyPhone,
        paymentMethod,
        items: computedItems,
        grandTotalRm,
      };

      const { encryptedPayload, iv } = await encryptTransactionPayload(
        confidentialPayload,
        vaultPin,
        tenant.vault_salt
      );

      const isBuying = activeTab === 'BUY_FARMER';
      const stockChanges = computedItems.map((i) => ({
        variety_code: i.varietyCode,
        variety_name: i.varietyName,
        grade: i.grade,
        delta_kg: isBuying ? i.netWeightKg : -i.netWeightKg,
      }));

      const { data: receiptNo, error } = await supabase.rpc('record_durian_transaction', {
        p_tx_type: activeTab,
        p_einvoice_code: isBuying ? '11' : '01',
        p_total_weight: totalNetWeightKg,
        p_encrypted_payload: encryptedPayload,
        p_encryption_iv: iv,
        p_stock_changes: stockChanges,
      });

      if (error) throw error;

      const nowIso = new Date().toISOString();
      const lhdnJson = buildLhdnMyInvoisPayload(
        activeTab as 'BUY_FARMER' | 'SELL_RESELLER',
        receiptNo,
        nowIso,
        {
          businessName: tenant.business_name,
          tin: tenant.tin_number || 'C0000000000',
          ssmBrn: tenant.ssm_brn || 'N/A',
          msicCode: tenant.msic_code || '46312',
          phone: tenant.phone || '',
        },
        confidentialPayload
      );

      // Clear Cart & Trigger Animated Success Celebration Modal!
      setCartItems([]);
      setCounterpartyName('');
      setCounterpartyTin('');
      setCounterpartyIdValue('');
      setCounterpartyPhone('');
      setIsCustomerModalOpen(false);

      setSuccessPopupData({
        meta: { receipt_no: receiptNo, tx_type: activeTab, created_at: nowIso },
        decrypted: confidentialPayload,
        lhdnJson,
      });

      await fetchInventoryAndHistory(user.id);
    } catch (err: any) {
      alert('Transaction Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Compute Today's Profit & Filtered Account Ledger Metrics
  const financialSummary = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('en-MY');

    let todayBuyRm = 0;
    let todaySellRm = 0;
    let todayBuyKg = 0;
    let todaySellKg = 0;
    let allBuyRm = 0;
    let allSellRm = 0;

    decryptedLedger.forEach(({ meta, data }) => {
      const txDateStr = new Date(meta.created_at).toLocaleDateString('en-MY');
      const isToday = txDateStr === todayStr;

      if (meta.tx_type === 'BUY_FARMER') {
        allBuyRm += data.grandTotalRm;
        if (isToday) {
          todayBuyRm += data.grandTotalRm;
          todayBuyKg += Number(meta.total_net_weight_kg || 0);
        }
      } else {
        allSellRm += data.grandTotalRm;
        if (isToday) {
          todaySellRm += data.grandTotalRm;
          todaySellKg += Number(meta.total_net_weight_kg || 0);
        }
      }
    });

    return {
      todayBuyRm,
      todaySellRm,
      todayProfitRm: todaySellRm - todayBuyRm,
      todayBuyKg,
      todaySellKg,
      allBuyRm,
      allSellRm,
      allProfitRm: allSellRm - allBuyRm,
    };
  }, [decryptedLedger]);

  const cartTotalNetKg = cartItems.reduce(
    (s, i) => s + Math.max(0, i.grossWeightKg - i.basketTareKg),
    0
  );
  const cartTotalRm = cartItems.reduce(
    (s, i) => s + Math.max(0, i.grossWeightKg - i.basketTareKg) * i.pricePerKgRm,
    0
  );

  // Modal Preview Calculations
  const modalNetKg = Math.max(0, Number(((parseFloat(modalGrossKg) || 0) - modalTareKg).toFixed(2)));
  const modalSubtotalRm = Number((modalNetKg * modalPriceRm).toFixed(2));
  const currentModalVarietyObj =
    varietyConfigs.find((v) => v.code === modalVarietyCode) || varietyConfigs[0];

  if (loading) {
    return (
      <div className="min-h-screen bg-amber-50/60 text-emerald-900 flex flex-col items-center justify-center gap-3 text-xl font-extrabold">
        <DurianLogo className="w-16 h-16 animate-bounce" />
        <span>Loading Durian Wholesale POS...</span>
      </div>
    );
  }

  // 1. AUTHENTICATION SCREEN
  if (!user || !tenant) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-lime-50 to-emerald-100 text-slate-900 flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-lg w-full bg-white border-4 border-emerald-700/20 rounded-3xl p-6 sm:p-10 shadow-2xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-amber-100 border-2 border-amber-400 rounded-2xl shadow-sm">
              <DurianLogo className="w-12 h-12" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-emerald-950">
                Durian King POS
              </h1>
              <p className="text-sm sm:text-base text-emerald-700 font-bold">
                榴莲批发收银与账本系统 • LHDN e-Invoice
              </p>
            </div>
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            <div>
              <label className="block text-base font-bold text-slate-800 mb-2">Email Address (电邮)</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-300 focus:border-emerald-600 rounded-xl px-4 py-3.5 text-lg text-slate-900 outline-none"
                placeholder="boss@durian.com"
              />
            </div>
            <div>
              <label className="block text-base font-bold text-slate-800 mb-2">Password (密码)</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-300 focus:border-emerald-600 rounded-xl px-4 py-3.5 text-lg text-slate-900 outline-none"
                placeholder="••••••••"
              />
            </div>

            {isRegistering && (
              <>
                <div>
                  <label className="block text-base font-bold text-slate-800 mb-2">
                    Business Name (榴莲批发公司名称)
                  </label>
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-300 focus:border-emerald-600 rounded-xl px-4 py-3.5 text-lg text-slate-900 outline-none"
                    placeholder="Raub Musang King Trading Sdn Bhd"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-base font-bold text-slate-800 mb-2">SSM BRN No.</label>
                    <input
                      type="text"
                      required
                      value={ssmBrn}
                      onChange={(e) => setSsmBrn(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-300 focus:border-emerald-600 rounded-xl px-4 py-3.5 text-lg text-slate-900 outline-none"
                      placeholder="202401012345"
                    />
                  </div>
                  <div>
                    <label className="block text-base font-bold text-slate-800 mb-2">LHDN TIN No.</label>
                    <input
                      type="text"
                      required
                      value={tinNumber}
                      onChange={(e) => setTinNumber(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-300 focus:border-emerald-600 rounded-xl px-4 py-3.5 text-lg text-slate-900 outline-none"
                      placeholder="C1234567890"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-base font-bold text-slate-800 mb-2">Contact Phone (电话号码)</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-300 focus:border-emerald-600 rounded-xl px-4 py-3.5 text-lg text-slate-900 outline-none"
                    placeholder="012-3456789"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              className="w-full bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white font-extrabold py-4 rounded-xl text-xl shadow-lg transition"
            >
              {isRegistering ? 'Register Wholesaler Account (注册账户)' : 'Login to POS (登入系统)'}
            </button>
          </form>

          <button
            onClick={() => setIsRegistering(!isRegistering)}
            className="w-full text-center text-base font-bold text-emerald-800 hover:text-emerald-950 mt-6 py-2"
          >
            {isRegistering
              ? '← Already have an account? Click here to Login'
              : '+ New Durian Wholesaler? Register New Account'}
          </button>
        </div>
      </div>
    );
  }

  // 2. VAULT PIN UNLOCK SCREEN
  if (!isVaultUnlocked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-lime-50 to-emerald-100 text-slate-900 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white border-4 border-amber-400 rounded-3xl p-6 sm:p-10 text-center shadow-2xl">
          <div className="w-20 h-20 bg-amber-100 border-2 border-amber-400 rounded-full flex items-center justify-center mx-auto mb-5">
            <DurianLogo className="w-12 h-12" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-3">
            Unlock Confidential Ledger Vault
          </h2>
          <p className="text-base text-slate-600 mb-6 leading-relaxed">
            请输入您的 <strong>6位数保密密码 (Vault PIN)</strong>。此密码用于在浏览器内解密您的<strong>今日利润、果农收购价与总账本</strong>。
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (vaultPin.length < 4) return alert('PIN must be at least 4 digits/characters');
              setIsVaultUnlocked(true);
            }}
            className="space-y-5"
          >
            <input
              type="password"
              inputMode="numeric"
              required
              value={vaultPin}
              onChange={(e) => setVaultPin(e.target.value)}
              placeholder="••••••"
              className="w-full text-center tracking-widest text-3xl font-extrabold bg-amber-50/50 border-2 border-amber-400 focus:border-emerald-600 rounded-2xl px-4 py-4 text-slate-900 outline-none"
            />
            <button
              type="submit"
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold py-4 rounded-2xl text-xl shadow-lg"
            >
              Unlock POS & Profit Ledger (解锁收银与账本)
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 3. MAIN COMPACT POS & POPUP WORKFLOW
  return (
    <div className="min-h-screen bg-[#f8faf5] text-slate-900 pb-32 lg:pb-16">
      {/* Custom CSS Keyframe Animations for Popups & Celebration */}
      <style jsx global>{`
        @keyframes popSpring {
          0% {
            opacity: 0;
            transform: scale(0.8) translateY(20px);
          }
          70% {
            transform: scale(1.03) translateY(-2px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes pulseRing {
          0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
          }
          70% {
            transform: scale(1);
            box-shadow: 0 0 0 20px rgba(16, 185, 129, 0);
          }
          100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
          }
        }
        .animate-pop-spring {
          animation: popSpring 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-pulse-ring {
          animation: pulseRing 2s infinite;
        }
      `}</style>

      {/* Top Header */}
      <header className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-green-900 text-white border-b-4 border-amber-400 px-4 sm:px-6 py-3 sticky top-0 z-30 shadow-md print:hidden">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-amber-400 rounded-xl shadow">
              <DurianLogo className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold text-amber-300 leading-tight">
                {tenant.business_name}
              </h1>
              <p className="text-xs text-emerald-100 font-medium">
                SSM: {tenant.ssm_brn} • TIN: {tenant.tin_number}
              </p>
            </div>
          </div>

          {/* Today's Profit Live Badge */}
          <button
            onClick={() => {
              setSelectedReceipt(null);
              setActiveTab('LEDGER');
            }}
            className="bg-emerald-950/90 hover:bg-emerald-950 border-2 border-amber-400 px-3.5 py-1.5 rounded-xl flex items-center gap-2.5 transition"
          >
            <div className="text-left">
              <div className="text-[10px] uppercase font-bold text-amber-200">
                Today Profit (今日净利)
              </div>
              <div
                className={`text-base sm:text-lg font-mono font-extrabold ${
                  financialSummary.todayProfitRm >= 0 ? 'text-amber-400' : 'text-red-300'
                }`}
              >
                {financialSummary.todayProfitRm >= 0 ? '+' : ''}RM{' '}
                {financialSummary.todayProfitRm.toFixed(2)}
              </div>
            </div>
            <TrendingUp className="w-5 h-5 text-amber-400 hidden sm:block" />
          </button>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-2">
            <button
              onClick={() => switchPosMode('BUY_FARMER')}
              className={`px-4 py-2.5 rounded-xl text-sm font-extrabold flex items-center gap-1.5 ${
                activeTab === 'BUY_FARMER'
                  ? 'bg-amber-400 text-slate-950 shadow'
                  : 'bg-emerald-950/60 text-emerald-100 hover:bg-emerald-950'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" /> 收果 Buy
            </button>
            <button
              onClick={() => switchPosMode('SELL_RESELLER')}
              className={`px-4 py-2.5 rounded-xl text-sm font-extrabold flex items-center gap-1.5 ${
                activeTab === 'SELL_RESELLER'
                  ? 'bg-lime-400 text-slate-950 shadow'
                  : 'bg-emerald-950/60 text-emerald-100 hover:bg-emerald-950'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" /> 批发 Sell
            </button>
            <button
              onClick={() => {
                setSelectedReceipt(null);
                setActiveTab('PRICE_BOARD');
              }}
              className={`px-4 py-2.5 rounded-xl text-sm font-extrabold flex items-center gap-1.5 ${
                activeTab === 'PRICE_BOARD'
                  ? 'bg-amber-400 text-slate-950 shadow'
                  : 'bg-emerald-950/60 text-emerald-100 hover:bg-emerald-950'
              }`}
            >
              <Coins className="w-4 h-4" /> 牌价 Prices
            </button>
            <button
              onClick={() => {
                setSelectedReceipt(null);
                setActiveTab('LEDGER');
              }}
              className={`px-4 py-2.5 rounded-xl text-sm font-extrabold flex items-center gap-1.5 ${
                activeTab === 'LEDGER'
                  ? 'bg-amber-400 text-slate-950 shadow'
                  : 'bg-emerald-950/60 text-emerald-100 hover:bg-emerald-950'
              }`}
            >
              <BookOpen className="w-4 h-4" /> 账本 Ledger
            </button>
            <button
              onClick={() => {
                setSelectedReceipt(null);
                setActiveTab('INVENTORY');
              }}
              className={`px-4 py-2.5 rounded-xl text-sm font-extrabold flex items-center gap-1.5 ${
                activeTab === 'INVENTORY'
                  ? 'bg-amber-400 text-slate-950 shadow'
                  : 'bg-emerald-950/60 text-emerald-100 hover:bg-emerald-950'
              }`}
            >
              <Package className="w-4 h-4" /> 库存 Stock
            </button>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                setUser(null);
                setTenant(null);
                setIsVaultUnlocked(false);
              }}
              className="p-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/40 text-red-200"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t-4 border-emerald-700 grid grid-cols-5 gap-1 p-1.5 z-30 shadow-2xl print:hidden">
        <button
          onClick={() => switchPosMode('BUY_FARMER')}
          className={`flex flex-col items-center justify-center py-2 rounded-xl font-extrabold text-xs ${
            activeTab === 'BUY_FARMER' ? 'bg-amber-400 text-slate-950' : 'text-slate-700'
          }`}
        >
          <ArrowDownLeft className="w-5 h-5 mb-0.5" />
          <span>收果 Buy</span>
        </button>
        <button
          onClick={() => switchPosMode('SELL_RESELLER')}
          className={`flex flex-col items-center justify-center py-2 rounded-xl font-extrabold text-xs ${
            activeTab === 'SELL_RESELLER' ? 'bg-emerald-600 text-white' : 'text-slate-700'
          }`}
        >
          <ArrowUpRight className="w-5 h-5 mb-0.5" />
          <span>批发 Sell</span>
        </button>
        <button
          onClick={() => {
            setSelectedReceipt(null);
            setActiveTab('PRICE_BOARD');
          }}
          className={`flex flex-col items-center justify-center py-2 rounded-xl font-extrabold text-xs ${
            activeTab === 'PRICE_BOARD' ? 'bg-amber-500 text-slate-950' : 'text-slate-700'
          }`}
        >
          <Coins className="w-5 h-5 mb-0.5" />
          <span>牌价 Price</span>
        </button>
        <button
          onClick={() => {
            setSelectedReceipt(null);
            setActiveTab('LEDGER');
          }}
          className={`flex flex-col items-center justify-center py-2 rounded-xl font-extrabold text-xs ${
            activeTab === 'LEDGER' ? 'bg-emerald-800 text-amber-300' : 'text-slate-700'
          }`}
        >
          <BookOpen className="w-5 h-5 mb-0.5" />
          <span>账本 Profit</span>
        </button>
        <button
          onClick={() => {
            setSelectedReceipt(null);
            setActiveTab('INVENTORY');
          }}
          className={`flex flex-col items-center justify-center py-2 rounded-xl font-extrabold text-xs ${
            activeTab === 'INVENTORY' ? 'bg-blue-600 text-white' : 'text-slate-700'
          }`}
        >
          <Package className="w-5 h-5 mb-0.5" />
          <span>库存 Stock</span>
        </button>
      </nav>

      {/* Main Content Container */}
      <main className="max-w-4xl mx-auto p-3 sm:p-6">
        {/* PRINTABLE BILINGUAL RECEIPT VIEW */}
        {selectedReceipt ? (
          <div className="space-y-6 animate-pop-spring">
            <div className="flex flex-wrap justify-between items-center gap-4 print:hidden">
              <button
                onClick={() => setSelectedReceipt(null)}
                className="px-6 py-3.5 rounded-2xl bg-white border-2 border-slate-300 hover:bg-slate-100 text-slate-900 text-lg font-extrabold shadow-sm"
              >
                ← Back to POS (返回收银台)
              </button>
              <button
                onClick={() => window.print()}
                className="px-8 py-3.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-lg flex items-center gap-3 shadow-lg"
              >
                <Printer className="w-6 h-6" /> Print / Save PDF (打印收据)
              </button>
            </div>

            <div className="bg-white text-slate-900 p-6 sm:p-10 rounded-3xl border-2 border-slate-300 shadow-xl print:shadow-none print:border-none print:p-0">
              <div className="text-center border-b-2 border-dashed border-slate-400 pb-5 mb-5">
                <h2 className="text-2xl sm:text-3xl font-extrabold uppercase">{tenant.business_name}</h2>
                <p className="text-sm sm:text-base text-slate-700 font-medium mt-1">
                  SSM BRN: {tenant.ssm_brn} | LHDN TIN: {tenant.tin_number} | Tel: {tenant.phone}
                </p>
                <div className="mt-3 inline-block px-4 py-1.5 bg-slate-900 text-white text-sm font-extrabold rounded-lg">
                  {selectedReceipt.meta.tx_type === 'BUY_FARMER'
                    ? 'SELF-BILLED E-INVOICE / 榴莲收购单 (LHDN Code 11)'
                    : 'WHOLESALE TAX INVOICE / 榴莲批发单 (LHDN Code 01)'}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm sm:text-base mb-5">
                <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-300">
                  <p className="font-bold text-slate-500 text-xs uppercase">
                    {selectedReceipt.meta.tx_type === 'BUY_FARMER'
                      ? 'FARMER / SUPPLIER (果农资料):'
                      : 'RESELLER / BUYER (批发客户):'}
                  </p>
                  <p className="font-extrabold text-xl text-slate-900 mt-0.5">
                    {selectedReceipt.decrypted.counterpartyName}
                  </p>
                  <p className="text-slate-700">IC / SSM: {selectedReceipt.decrypted.counterpartyIdValue || 'N/A'}</p>
                  <p className="text-slate-700">Tel: {selectedReceipt.decrypted.counterpartyPhone || 'N/A'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 sm:text-right">
                  <p className="text-lg">
                    <span className="font-bold text-slate-600">Receipt:</span>{' '}
                    <span className="font-mono font-extrabold text-slate-900">{selectedReceipt.meta.receipt_no}</span>
                  </p>
                  <p className="text-slate-700">
                    <span className="font-bold">Date:</span>{' '}
                    {new Date(selectedReceipt.meta.created_at).toLocaleString('en-MY')}
                  </p>
                  <p className="text-slate-700">
                    <span className="font-bold">Payment:</span> {selectedReceipt.decrypted.paymentMethod}
                  </p>
                </div>
              </div>

              <table className="w-full text-sm sm:text-base border-t-2 border-b-2 border-slate-400 my-4">
                <thead>
                  <tr className="border-b border-slate-300 text-left bg-slate-100">
                    <th className="py-2.5 px-2 font-extrabold">Variety & Grade</th>
                    <th className="py-2.5 px-2 text-right font-extrabold">Gross</th>
                    <th className="py-2.5 px-2 text-right font-extrabold">Tare</th>
                    <th className="py-2.5 px-2 text-right font-extrabold">Net Kg</th>
                    <th className="py-2.5 px-2 text-right font-extrabold">RM/kg</th>
                    <th className="py-2.5 px-2 text-right font-extrabold">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedReceipt.decrypted.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-2 font-bold">
                        {item.varietyName} <span className="font-extrabold">({item.grade})</span>
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono">{item.grossWeightKg.toFixed(2)}</td>
                      <td className="py-2.5 px-2 text-right font-mono text-red-600">
                        {item.basketTareKg > 0 ? `-${item.basketTareKg.toFixed(2)}` : '0 (无萝)'}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-extrabold">
                        {item.netWeightKg.toFixed(2)} kg
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono">RM {item.pricePerKgRm.toFixed(2)}</td>
                      <td className="py-2.5 px-2 text-right font-mono font-extrabold">
                        RM {item.subtotalRm.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between items-center bg-amber-50 border-2 border-amber-400 p-4 rounded-2xl mt-4">
                <span className="text-xl font-extrabold text-slate-900">TOTAL (应付总额):</span>
                <span className="text-2xl sm:text-4xl font-mono font-extrabold text-emerald-800">
                  RM {selectedReceipt.decrypted.grandTotalRm.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        ) : activeTab === 'BUY_FARMER' || activeTab === 'SELL_RESELLER' ? (
          /* COMPACT NO-SCROLL POS CART SCREEN (MOBILE-FIRST!) */
          <div className="space-y-4">
            {/* Compact Top Mode Switcher + Customer Bar */}
            <div
              className={`p-4 rounded-3xl border-2 flex flex-wrap justify-between items-center gap-3 shadow-sm ${
                activeTab === 'BUY_FARMER'
                  ? 'bg-amber-100/90 border-amber-400 text-amber-950'
                  : 'bg-emerald-100/90 border-emerald-500 text-emerald-950'
              }`}
            >
              <div className="flex items-center gap-3">
                <DurianLogo className="w-10 h-10" />
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wide opacity-80">
                    {activeTab === 'BUY_FARMER'
                      ? 'LHDN Code 11 • Self-Billed Buy'
                      : 'LHDN Code 01 • Wholesale Sell'}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold">
                    {activeTab === 'BUY_FARMER' ? '向果农收果 (Buy Cart)' : '批发卖果 (Sell Cart)'}
                  </h2>
                </div>
              </div>

              {/* Customer Popup Trigger Button */}
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(true)}
                className="w-full sm:w-auto px-4 py-3 rounded-2xl bg-white hover:bg-slate-50 text-slate-900 border-2 border-slate-900 font-extrabold text-sm sm:text-base flex items-center justify-between sm:justify-center gap-2 shadow-sm"
              >
                <span className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-emerald-700" />
                  {counterpartyName ? (
                    <span>
                      {counterpartyName} ({paymentMethod})
                    </span>
                  ) : (
                    <span className="text-slate-500">
                      {activeTab === 'BUY_FARMER'
                        ? 'Tap to Set Farmer Name (设定果农) *'
                        : 'Tap to Set Reseller Name (设定客户) *'}
                    </span>
                  )}
                </span>
                <Edit3 className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Big Action Button to Open Weighing Popup Modal + Quick Presets */}
            <div className="bg-white border-2 border-slate-200 rounded-3xl p-4 sm:p-5 shadow-sm">
              <button
                type="button"
                onClick={() => openWeighingModal(null)}
                className="w-full py-4 sm:py-5 px-6 rounded-2xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white font-extrabold text-xl sm:text-2xl flex items-center justify-center gap-3 shadow-lg shadow-emerald-700/20 transition"
              >
                <Plus className="w-7 h-7" /> + Weigh &amp; Add Durian (称重加果)
              </button>

              {/* Quick 1-Tap Variety Shortcuts (Opens Weighing Popup directly with that Grade!) */}
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="text-xs font-extrabold text-slate-500 uppercase mb-2">
                  Quick Weigh Shortcuts (点击直接称重):
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {['A', 'AB', 'B', 'C', 'CC', 'CCC', 'Z'].map((g) => (
                    <button
                      key={`mk_${g}`}
                      type="button"
                      onClick={() => openWeighingModal(null, 'D197-MK', g)}
                      className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 font-extrabold text-xs sm:text-sm whitespace-nowrap"
                    >
                      猫山王 {g}
                    </button>
                  ))}
                  {['A', 'B'].map((g) => (
                    <button
                      key={`bt_${g}`}
                      type="button"
                      onClick={() => openWeighingModal(null, 'D200-BT', g)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-950 font-extrabold text-xs sm:text-sm whitespace-nowrap"
                    >
                      黑刺 {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Compact Weighing Cart List (Main Page Only Shows Cart!) */}
            <div className="bg-white border-2 border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-emerald-700" />
                  Current Weighing Cart (当前称重清单: {cartItems.length} 项)
                </h3>
                {cartItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCartItems([])}
                    className="text-xs font-extrabold text-red-600 hover:underline"
                  >
                    Clear All (清空)
                  </button>
                )}
              </div>

              {cartItems.length === 0 ? (
                <div className="py-10 text-center text-slate-400">
                  <Scale className="w-12 h-12 mx-auto mb-2 opacity-40" />
                  <p className="text-base font-bold">
                    No baskets weighed yet. Tap the big green button above to weigh!
                  </p>
                  <p className="text-xs mt-0.5">尚未添加榴莲，请点击上方绿色按钮称重</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {cartItems.map((item, idx) => {
                    const netKg = Math.max(
                      0,
                      Number((item.grossWeightKg - item.basketTareKg).toFixed(2))
                    );
                    const subRm = Number((netKg * item.pricePerKgRm).toFixed(2));

                    return (
                      <div
                        key={idx}
                        className="py-3 flex justify-between items-center gap-3 hover:bg-slate-50 px-2 rounded-xl"
                      >
                        <div
                          onClick={() => openWeighingModal(idx)}
                          className="flex-1 cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-amber-300 text-slate-950 font-extrabold text-xs rounded-md">
                              #{idx + 1}
                            </span>
                            <span className="font-extrabold text-base sm:text-lg text-slate-900">
                              {item.varietyName}
                            </span>
                            <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 font-extrabold text-xs sm:text-sm rounded-lg">
                              Grade {item.grade}
                            </span>
                          </div>
                          <div className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
                            Gross: <strong className="font-mono">{item.grossWeightKg}kg</strong>
                            {' • '}
                            Tare:{' '}
                            <strong className="font-mono text-red-600">
                              {item.basketTareKg === 0 ? '0kg (No Basket/无萝)' : `-${item.basketTareKg}kg`}
                            </strong>
                            {' → '}
                            Net: <strong className="font-mono text-slate-900">{netKg.toFixed(2)}kg</strong>
                            {' × '}
                            <strong className="font-mono text-emerald-700">
                              RM{item.pricePerKgRm}/kg
                            </strong>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-lg sm:text-xl font-mono font-extrabold text-emerald-800">
                              RM {subRm.toFixed(2)}
                            </div>
                            <button
                              type="button"
                              onClick={() => openWeighingModal(idx)}
                              className="text-[11px] font-bold text-blue-600 hover:underline"
                            >
                              Edit (修改)
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCartItems(cartItems.filter((_, i) => i !== idx))}
                            className="p-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sticky / Compact Checkout Summary Bar */}
            <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-green-950 border-4 border-amber-400 text-white p-4 sm:p-6 rounded-3xl flex flex-col sm:flex-row justify-between items-center gap-4 shadow-xl">
              <div className="text-center sm:text-left">
                <div className="text-xs sm:text-sm text-emerald-200 font-bold">
                  {cartItems.length} Baskets • Total Net Weight:{' '}
                  <span className="font-mono font-extrabold text-amber-300 text-lg">
                    {cartTotalNetKg.toFixed(2)} kg
                  </span>
                </div>
                <div className="text-2xl sm:text-4xl font-mono font-extrabold text-amber-400">
                  RM {cartTotalRm.toFixed(2)}
                </div>
              </div>

              <button
                type="button"
                disabled={submitting}
                onClick={handleCheckoutTransaction}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-extrabold text-lg sm:text-xl flex items-center justify-center gap-2 shadow-lg transition"
              >
                <CheckCircle2 className="w-6 h-6" />
                {submitting
                  ? 'Encrypting & Saving...'
                  : counterpartyName
                  ? `Confirm & Save (${counterpartyName})`
                  : 'Next: Set Name & Complete (下一步结账)'}
              </button>
            </div>
          </div>
        ) : activeTab === 'PRICE_BOARD' ? (
          /* TAB 3: DYNAMIC MASTER PRICE BOARD WITH ADD / REMOVE GRADES */
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-300 border-2 border-amber-500 rounded-3xl p-5 sm:p-7 text-slate-950 shadow-md">
              <span className="px-3 py-1 bg-slate-950 text-amber-300 rounded-full text-xs font-extrabold uppercase">
                Custom Grades &amp; One-Place Pricing
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold mt-2">
                Master Price &amp;  Grade Board (榴莲等级与牌价设定)
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {varietyConfigs.map((v) => {
                const gradeList = Object.keys(v.grades);

                return (
                  <div
                    key={v.code}
                    className="bg-white border-2 border-emerald-700/20 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3 mb-4">
                        <div className="flex items-center gap-3">
                          <DurianLogo className="w-8 h-8" />
                          <div>
                            <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">
                              {v.name}
                            </h3>
                            <span className="text-xs font-mono font-bold text-slate-500">
                              {gradeList.length} Grades Active
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-2 text-xs font-extrabold uppercase text-slate-500 px-2 mb-2">
                        <span className="col-span-4">Grade</span>
                        <span className="col-span-3 text-amber-800">Buy 收果</span>
                        <span className="col-span-3 text-emerald-800">Sell 批发</span>
                        <span className="col-span-2 text-right">Del</span>
                      </div>

                      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {gradeList.map((g) => {
                          const buyVal = v.grades[g]?.buy ?? 0;
                          const sellVal = v.grades[g]?.sell ?? 0;

                          return (
                            <div
                              key={g}
                              className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-2xl border border-slate-200"
                            >
                              <span className="col-span-4 font-extrabold text-sm sm:text-base text-slate-900 px-2 truncate">
                                Grade {g}
                              </span>
                              <div className="col-span-3">
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step="0.5"
                                  value={buyVal}
                                  onChange={(e) =>
                                    updateGradePrice(
                                      v.code,
                                      g,
                                      'buy',
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-full bg-amber-50 border-2 border-amber-300 rounded-xl px-2.5 py-2 text-base font-mono font-extrabold text-amber-950"
                                />
                              </div>
                              <div className="col-span-3">
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step="0.5"
                                  value={sellVal}
                                  onChange={(e) =>
                                    updateGradePrice(
                                      v.code,
                                      g,
                                      'sell',
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-full bg-emerald-50 border-2 border-emerald-300 rounded-xl px-2.5 py-2 text-base font-mono font-extrabold text-emerald-950"
                                />
                              </div>
                              <div className="col-span-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteGrade(v.code, g)}
                                  className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600"
                                  title="Remove Grade"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Add New Custom Grade Input Row */}
                    <div className="mt-4 pt-3 border-t-2 border-slate-100 flex gap-2">
                      <input
                        type="text"
                        value={newGradeInputs[v.code] || ''}
                        onChange={(e) =>
                          setNewGradeInputs({ ...newGradeInputs, [v.code]: e.target.value })
                        }
                        placeholder="Enter New Grade"
                        className="flex-1 bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 uppercase"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddCustomGrade(v.code)}
                        className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" /> Add Grade
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : activeTab === 'LEDGER' ? (
          /* TAB 4: TODAY'S PROFIT & ACCOUNT LEDGER */
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border-2 border-emerald-500 rounded-3xl p-5 shadow-sm">
                <span className="text-xs font-extrabold uppercase text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
                  Today&apos;s Sales In (今日批发收入)
                </span>
                <div className="text-3xl font-mono font-extrabold text-emerald-700 mt-3">
                  +RM {financialSummary.todaySellRm.toFixed(2)}
                </div>
                <div className="text-xs font-bold text-slate-600 mt-1">
                  Sold: {financialSummary.todaySellKg.toFixed(2)} kg
                </div>
              </div>

              <div className="bg-white border-2 border-amber-400 rounded-3xl p-5 shadow-sm">
                <span className="text-xs font-extrabold uppercase text-amber-900 bg-amber-100 px-3 py-1 rounded-full">
                  Today&apos;s Fruit Cost (今日收果支出)
                </span>
                <div className="text-3xl font-mono font-extrabold text-amber-700 mt-3">
                  -RM {financialSummary.todayBuyRm.toFixed(2)}
                </div>
                <div className="text-xs font-bold text-slate-600 mt-1">
                  Bought: {financialSummary.todayBuyKg.toFixed(2)} kg
                </div>
              </div>

              <div
                className={`rounded-3xl p-5 shadow-lg border-2 ${
                  financialSummary.todayProfitRm >= 0
                    ? 'bg-gradient-to-br from-emerald-900 to-green-800 text-white border-amber-400'
                    : 'bg-red-900 text-white border-red-400'
                }`}
              >
                <span className="text-xs font-extrabold uppercase text-amber-300 bg-emerald-950/70 px-3 py-1 rounded-full">
                  Today&apos;s Net Profit (今日净赚利润)
                </span>
                <div className="text-3xl font-mono font-extrabold text-amber-300 mt-3">
                  {financialSummary.todayProfitRm >= 0 ? '+' : ''}RM{' '}
                  {financialSummary.todayProfitRm.toFixed(2)}
                </div>
                <div className="text-xs font-bold text-emerald-100 mt-1">
                  All-Time Net: RM {financialSummary.allProfitRm.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm">
              <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                  Account Ledger (榴莲买卖总账本)
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLedgerFilter('TODAY')}
                    className={`px-4 py-2 rounded-xl font-extrabold text-xs sm:text-sm ${
                      ledgerFilter === 'TODAY'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    Today (今日)
                  </button>
                  <button
                    onClick={() => setLedgerFilter('ALL')}
                    className={`px-4 py-2 rounded-xl font-extrabold text-xs sm:text-sm ${
                      ledgerFilter === 'ALL'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    All History (全部)
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-t-2 border-slate-200">
                  <thead className="bg-slate-100 text-slate-700 uppercase text-xs font-extrabold">
                    <tr>
                      <th className="p-3">Time</th>
                      <th className="p-3">Receipt</th>
                      <th className="p-3">Customer / Farmer</th>
                      <th className="p-3 text-right">Net Kg</th>
                      <th className="p-3 text-right">Amount</th>
                      <th className="p-3 text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {decryptedLedger
                      .filter(({ meta }) => {
                        if (ledgerFilter === 'ALL') return true;
                        return (
                          new Date(meta.created_at).toLocaleDateString('en-MY') ===
                          new Date().toLocaleDateString('en-MY')
                        );
                      })
                      .map(({ meta, data }) => {
                        const isBuy = meta.tx_type === 'BUY_FARMER';
                        return (
                          <tr key={meta.id} className="hover:bg-amber-50/40">
                            <td className="p-3 whitespace-nowrap text-xs text-slate-600">
                              {new Date(meta.created_at).toLocaleString('en-MY', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </td>
                            <td className="p-3 font-mono font-extrabold text-xs sm:text-sm">
                              {meta.receipt_no}
                            </td>
                            <td className="p-3 font-extrabold text-slate-900">
                              {data.counterpartyName}
                            </td>
                            <td className="p-3 text-right font-mono font-bold">
                              {Number(meta.total_net_weight_kg).toFixed(2)}kg
                            </td>
                            <td
                              className={`p-3 text-right font-mono font-extrabold ${
                                isBuy ? 'text-amber-700' : 'text-emerald-700'
                              }`}
                            >
                              {isBuy ? `-RM ${data.grandTotalRm.toFixed(2)}` : `+RM ${data.grandTotalRm.toFixed(2)}`}
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => {
                                  const lhdnJson = buildLhdnMyInvoisPayload(
                                    meta.tx_type,
                                    meta.receipt_no,
                                    meta.created_at,
                                    {
                                      businessName: tenant.business_name,
                                      tin: tenant.tin_number || 'C0000000000',
                                      ssmBrn: tenant.ssm_brn || 'N/A',
                                      msicCode: tenant.msic_code || '46312',
                                      phone: tenant.phone || '',
                                    },
                                    data
                                  );
                                  setSelectedReceipt({ meta, decrypted: data, lhdnJson });
                                }}
                                className="px-3 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-extrabold"
                              >
                                Print
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* TAB 5: LIVE DURIAN STOCK INVENTORY */
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-4 flex items-center gap-2">
              <DurianLogo className="w-8 h-8" />
              <span>Live Durian Stock (实时榴莲库存)</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {inventory.map((stock) => (
                <div
                  key={stock.id}
                  className="bg-gradient-to-br from-amber-50/70 to-lime-50/70 border-2 border-emerald-700/30 p-4 rounded-2xl flex flex-col justify-between"
                >
                  <div>
                    <span className="text-xs font-mono font-bold text-emerald-800">
                      {stock.variety_code}
                    </span>
                    <div className="font-extrabold text-slate-900 text-lg mt-0.5">
                      {stock.variety_name}
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-emerald-700/20 flex justify-between items-baseline">
                    <span className="px-3 py-1 bg-amber-300 rounded-xl text-sm font-extrabold text-slate-950">
                      Grade {stock.grade}
                    </span>
                    <span className="text-2xl font-mono font-extrabold text-emerald-800">
                      {Number(stock.current_weight_kg).toFixed(2)} kg
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ===================================================================== */}
      {/* POPUP MODAL 1: WEIGHING & RAGA TARE SELECTOR (NO SCROLLING NEEDED!) */}
      {/* ===================================================================== */}
      {isAddBasketModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border-4 border-emerald-700 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl animate-pop-spring my-auto">
            <div className="flex justify-between items-center border-b-2 border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <DurianLogo className="w-8 h-8" />
                <h3 className="text-xl font-extrabold text-slate-900">
                  {editingCartIndex !== null ? 'Edit Weighed Durian' : 'Weigh Durian (称重加果)'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddBasketModalOpen(false)}
                className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveBasketToCart} className="space-y-4">
              {/* 1. Tap Variety */}
              <div>
                <label className="block text-xs font-extrabold uppercase text-slate-500 mb-1.5">
                  1. Select Variety (选择品种)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {varietyConfigs.map((v) => (
                    <button
                      key={v.code}
                      type="button"
                      onClick={() => {
                        const mode =
                          activeTab === 'SELL_RESELLER' ? 'SELL_RESELLER' : 'BUY_FARMER';
                        const grades = Object.keys(v.grades);
                        const nextGrade = grades.includes(modalGrade) ? modalGrade : grades[0] || 'A';
                        setModalVarietyCode(v.code);
                        setModalGrade(nextGrade);
                        setModalPriceRm(getMasterPrice(v.code, nextGrade, mode));
                      }}
                      className={`py-2.5 px-2 rounded-xl font-extrabold text-xs sm:text-sm border-2 transition ${
                        modalVarietyCode === v.code
                          ? 'bg-emerald-700 text-white border-emerald-800 shadow'
                          : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {v.short}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Tap Grade (Dynamically shows A, AB, B, C, CC, CCC, Z, ZZ for Musang King!) */}
              <div>
                <label className="block text-xs font-extrabold uppercase text-slate-500 mb-1.5">
                  2. Tap Grade (选择等级)
                </label>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(currentModalVarietyObj.grades).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        const mode =
                          activeTab === 'SELL_RESELLER' ? 'SELL_RESELLER' : 'BUY_FARMER';
                        setModalGrade(g);
                        setModalPriceRm(getMasterPrice(modalVarietyCode, g, mode));
                      }}
                      className={`px-4 py-2.5 rounded-xl font-extrabold text-sm sm:text-base border-2 transition ${
                        modalGrade === g
                          ? 'bg-amber-400 text-slate-950 border-amber-600 shadow'
                          : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. One-Tap Raga Tare Buttons (Includes 0kg No Basket!) */}
              <div>
                <label className="block text-xs font-extrabold uppercase text-red-700 mb-1.5">
                  3. Raga Basket Tare Deduction (一键扣萝重 / 无萝单粒)
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {RAGA_TARE_PRESETS.map((preset) => (
                    <button
                      key={preset.kg}
                      type="button"
                      onClick={() => setModalTareKg(preset.kg)}
                      className={`py-2 px-1.5 rounded-xl font-extrabold text-xs border-2 transition text-center ${
                        modalTareKg === preset.kg
                          ? 'bg-red-600 text-white border-red-800 shadow'
                          : 'bg-red-50 text-red-900 border-red-200 hover:bg-red-100'
                      }`}
                    >
                      <div className="font-mono text-sm">
                        {preset.kg === 0 ? '0 kg' : `-${preset.kg} kg`}
                      </div>
                      <div className="text-[10px] opacity-90 truncate">{preset.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Gross Weight Input + Price Input */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-sm font-extrabold text-slate-900 mb-1">
                    Gross Weight (毛重 Kg) *
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    autoFocus
                    required
                    value={modalGrossKg}
                    onChange={(e) => setModalGrossKg(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-amber-50/70 border-2 border-emerald-600 rounded-2xl px-4 py-3 text-2xl font-mono font-extrabold text-slate-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-extrabold text-emerald-800 mb-1">
                    Price (单价 RM/kg)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={modalPriceRm}
                    onChange={(e) => setModalPriceRm(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-2xl px-4 py-3 text-2xl font-mono font-extrabold text-emerald-800 outline-none"
                  />
                </div>
              </div>

              {/* Live Net Kg & Subtotal Preview inside Modal */}
              <div className="bg-slate-900 text-white p-4 rounded-2xl flex justify-between items-center">
                <div>
                  <div className="text-xs text-slate-400">Net Weight (净重)</div>
                  <div className="text-xl font-mono font-extrabold text-amber-300">
                    {modalNetKg.toFixed(2)} kg
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Subtotal (本萝小计)</div>
                  <div className="text-2xl font-mono font-extrabold text-emerald-400">
                    RM {modalSubtotalRm.toFixed(2)}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xl shadow-lg transition"
              >
                {editingCartIndex !== null
                  ? 'Update Basket (更新此萝)'
                  : '+ Add to Cart (加入清单)'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* POPUP MODAL 2: CUSTOMER / FARMER DETAILS & PAYMENT METHOD           */}
      {/* ===================================================================== */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-4 border-amber-400 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-pop-spring">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
              <h3 className="text-xl font-extrabold text-slate-900">
                {activeTab === 'BUY_FARMER'
                  ? 'Farmer Details (果农资料)'
                  : 'Reseller Details (批发客户)'}
              </h3>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="p-2 rounded-full bg-slate-100 hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-extrabold text-slate-800 mb-1">
                  {activeTab === 'BUY_FARMER' ? 'Farmer Name (果农姓名) *' : 'Reseller Name (客户名称) *'}
                </label>
                <input
                  type="text"
                  autoFocus
                  value={counterpartyName}
                  onChange={(e) => setCounterpartyName(e.target.value)}
                  placeholder={activeTab === 'BUY_FARMER' ? 'e.g. Uncle Lim (Raub)' : 'e.g. SS2 Durian Stall'}
                  className="w-full bg-slate-50 border-2 border-slate-300 focus:border-emerald-600 rounded-xl px-4 py-3 text-lg font-bold outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-extrabold text-slate-800 mb-1">
                  Payment Method (付款方式)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'CASH', label: 'Cash (现金)' },
                    { id: 'BANK_TRANSFER', label: 'DuitNow / Bank' },
                    { id: 'EWALLET', label: 'TNG / e-Wallet' },
                    { id: 'CREDIT_TERM', label: 'Credit (挂账)' },
                  ].map((pm) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentMethod(pm.id as any)}
                      className={`py-2.5 px-3 rounded-xl font-extrabold text-sm border-2 ${
                        paymentMethod === pm.id
                          ? 'bg-emerald-700 text-white border-emerald-800'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-slate-600 mb-1">
                    Phone (电话)
                  </label>
                  <input
                    type="tel"
                    value={counterpartyPhone}
                    onChange={(e) => setCounterpartyPhone(e.target.value)}
                    placeholder="012-3456789"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-600 mb-1">
                    IC / SSM (选填)
                  </label>
                  <input
                    type="text"
                    value={counterpartyIdValue}
                    onChange={(e) => setCounterpartyIdValue(e.target.value)}
                    placeholder="IC / SSM No."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="flex-1 py-3.5 rounded-2xl bg-slate-200 text-slate-800 font-extrabold text-base"
                >
                  Save Info (保存资料)
                </button>
                {cartItems.length > 0 && counterpartyName.trim() && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleCheckoutTransaction}
                    className="flex-1 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-base shadow-md"
                  >
                    {submitting ? 'Saving...' : 'Complete Order (立即结账)'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* POPUP MODAL 3: ANIMATED SUCCESS CELEBRATION MODAL                   */}
      {/* ===================================================================== */}
      {successPopupData && (
        <div className="fixed inset-0 z-50 bg-emerald-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border-4 border-amber-400 rounded-3xl max-w-md w-full p-6 sm:p-8 text-center shadow-2xl animate-pop-spring relative overflow-hidden">
            {/* Animated Pulse Checkmark Ring */}
            <div className="w-24 h-24 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-5 animate-pulse-ring">
              <CheckCircle2 className="w-14 h-14" />
            </div>

            <div className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-900 rounded-full text-xs font-extrabold uppercase mb-2">
              <Sparkles className="w-4 h-4 text-amber-600" /> LHDN e-Invoice Ready &amp; Encrypted
            </div>

            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Transaction Saved! (交易成功)
            </h3>

            <p className="text-sm font-mono font-bold text-slate-500 mt-1">
              Receipt No: {successPopupData.meta.receipt_no}
            </p>

            <div className="my-6 p-4 bg-gradient-to-r from-amber-50 to-lime-50 border-2 border-amber-300 rounded-2xl">
              <div className="text-xs font-bold text-slate-600 uppercase">
                {successPopupData. decrypted.counterpartyName}
              </div>
              <div className="text-3xl font-mono font-extrabold text-emerald-800 mt-1">
                RM {successPopupData.decrypted.grandTotalRm.toFixed(2)}
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  const receiptToView = successPopupData;
                  setSuccessPopupData(null);
                  setSelectedReceipt(receiptToView);
                }}
                className="w-full py-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-lg flex items-center justify-center gap-2 shadow-lg"
              >
                <Printer className="w-6 h-6" /> View &amp; Print Receipt (查看与打印收据)
              </button>

              <button
                type="button"
                onClick={() => setSuccessPopupData(null)}
                className="w-full py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-base"
              >
                Start Next Customer (下一位客户)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}