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
  Printer,
  LogOut,
  Plus,
  Trash2,
  Package,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  TrendingUp,
  Coins,
  BookOpen,
  UserCheck,
  Users,
  X,
  ShoppingBag,
  Code2,
  Phone,
} from 'lucide-react';

export interface VarietyConfig {
  code: string;
  name: string;
  short: string;
  grades: Record<string, { buy: number; sell: number }>;
}

export interface SavedPartner {
  id: string;
  type: 'BUY_FARMER' | 'SELL_RESELLER';
  name: string;
  phone: string;
  idValue: string;
  tin: string;
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'EWALLET' | 'CREDIT_TERM';
}

const DEFAULT_VARIETY_CONFIGS: VarietyConfig[] = [
  {
    code: 'D197-MK',
    name: '猫山王 MK',
    short: '猫山王',
    grades: {
      A: { buy: 42, sell: 55 },
      AB: { buy: 36, sell: 46 },
      B: { buy: 28, sell: 36 },
      C: { buy: 18, sell: 25 },
      CC: { buy: 14, sell: 20 },
      CCC: { buy: 10, sell: 15 },
      Z: { buy: 7, sell: 11 },
      ZZ: { buy: 5, sell: 8 },
      BB: { buy: 45, sell: 58 },
    },
  },
  {
    code: 'D200-BT',
    name: '黑刺 BT',
    short: '黑刺',
    grades: {
      A: { buy: 50, sell: 65 },
      AB: { buy: 42, sell: 54 },
      B: { buy: 32, sell: 42 },
      C: { buy: 20, sell: 28 },
    },
  },
  {
    code: 'D24-XO',
    name: 'D24 苏丹',
    short: 'D24',
    grades: {
      A: { buy: 16, sell: 23 },
      B: { buy: 11, sell: 16 },
      C: { buy: 7, sell: 11 },
    },
  },
  {
    code: 'D101',
    name: '红虾 D101',
    short: '红虾',
    grades: {
      A: { buy: 17, sell: 25 },
      B: { buy: 12, sell: 18 },
    },
  },
  {
    code: 'TEKKA',
    name: '竹脚 Tekka',
    short: '竹脚',
    grades: {
      A: { buy: 18, sell: 26 },
      B: { buy: 12, sell: 18 },
    },
  },
  {
    code: 'KAMPUNG',
    name: '甘榜 KP',
    short: '甘榜',
    grades: {
      A: { buy: 7, sell: 12 },
      B: { buy: 4, sell: 8 },
    },
  },
];

const RAGA_TARE_PRESETS = [
  { label: '无萝', kg: 0 },
  { label: '小萝', kg: 1.5 },
  { label: '标准', kg: 2.5 },
  { label: '大萝', kg: 3.0 },
  { label: '特大', kg: 3.5 },
];

// Uses /logo.png with automatic fallback if /logo.png isn't in public/ yet
function AppLogo({ className = 'w-11 h-11' }: { className?: string }) {
  const [imgErr, setImgErr] = useState(false);
  if (imgErr) {
    return (
      <div
        className={`${className} bg-amber-400 rounded-2xl flex items-center justify-center shadow-sm shrink-0`}
      >
        <svg viewBox="0 0 64 64" fill="none" className="w-4/5 h-4/5">
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
      </div>
    );
  }
  return (
    <img
      src="/logo.png"
      alt="Durian POS"
      onError={() => setImgErr(true)}
      className={`${className} rounded-2xl object-cover shadow-sm shrink-0`}
    />
  );
}

export default function DurianPosApp() {
  const supabase = createClient();

  const [user, setUser] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [todayStr, setTodayStr] = useState<string>('');

  // Auth Form State
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [ssmBrn, setSsmBrn] = useState('');
  const [tinNumber, setTinNumber] = useState('');
  const [phone, setPhone] = useState('');

  // Vault PIN State
  const [vaultPin, setVaultPin] = useState('');
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);

  // Navigation Tabs (Includes dedicated CONTACTS tab for Farmer/Reseller Lists!)
  const [activeTab, setActiveTab] = useState<
    'BUY_FARMER' | 'SELL_RESELLER' | 'CONTACTS' | 'PRICE_BOARD' | 'LEDGER' | 'INVENTORY'
  >('BUY_FARMER');

  // Dynamic Variety & Grade Master Config
  const [varietyConfigs, setVarietyConfigs] = useState<VarietyConfig[]>(DEFAULT_VARIETY_CONFIGS);
  const [newGradeInputs, setNewGradeInputs] = useState<Record<string, string>>({});

  // Saved Regular Farmers & Resellers Directory
  const [savedPartners, setSavedPartners] = useState<SavedPartner[]>([]);
  const [contactTabType, setContactTabType] = useState<'BUY_FARMER' | 'SELL_RESELLER'>('BUY_FARMER');
  const [newPartnerForm, setNewPartnerForm] = useState<{
    name: string;
    phone: string;
    idValue: string;
    tin: string;
    paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'EWALLET' | 'CREDIT_TERM';
  }>({
    name: '',
    phone: '',
    idValue: '',
    tin: '',
    paymentMethod: 'CASH',
  });

  // Database Records & Auto-Decrypted Ledger
  const [inventory, setInventory] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [decryptedLedger, setDecryptedLedger] = useState<
    Array<{ meta: any; data: ConfidentialTxPayload }>
  >([]);
  const [ledgerFilter, setLedgerFilter] = useState<'TODAY' | 'ALL'>('TODAY');

  // Cart & Popup Modal States
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
  const [showLhdnJsonModal, setShowLhdnJsonModal] = useState(false);

  // Weighing Popup Form State
  const [modalVarietyCode, setModalVarietyCode] = useState('D197-MK');
  const [modalGrade, setModalGrade] = useState('A');
  const [modalGrossKg, setModalGrossKg] = useState<string>('');
  const [modalTareKg, setModalTareKg] = useState<number>(2.5);
  const [modalPriceRm, setModalPriceRm] = useState<number>(42);

  // Current Order Customer / Farmer State
  const [counterpartyName, setCounterpartyName] = useState('');
  const [counterpartyTin, setCounterpartyTin] = useState('');
  const [counterpartyIdValue, setCounterpartyIdValue] = useState('');
  const [counterpartyPhone, setCounterpartyPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<
    'CASH' | 'BANK_TRANSFER' | 'EWALLET' | 'CREDIT_TERM'
  >('CASH');
  const [submitting, setSubmitting] = useState(false);

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
    setTodayStr(new Date().toLocaleDateString('en-MY'));
    checkSession();
  }, []);

  useEffect(() => {
    if (tenant?.id) {
      const saved = localStorage.getItem(`durian_variety_configs_v3_${tenant.id}`);
      if (saved) {
        try {
          setVarietyConfigs(JSON.parse(saved));
        } catch {}
      }
      const savedBook = localStorage.getItem(`durian_partners_v1_${tenant.id}`);
      if (savedBook) {
        try {
          setSavedPartners(JSON.parse(savedBook));
        } catch {}
      }
    }
  }, [tenant]);

  function saveConfigsToStorage(updated: VarietyConfig[]) {
    setVarietyConfigs(updated);
    if (tenant?.id) {
      localStorage.setItem(`durian_variety_configs_v3_${tenant.id}`, JSON.stringify(updated));
    }
  }

  function savePartnerToBook(
    type: 'BUY_FARMER' | 'SELL_RESELLER',
    name: string,
    phone: string,
    idValue: string,
    tin: string,
    pm: 'CASH' | 'BANK_TRANSFER' | 'EWALLET' | 'CREDIT_TERM'
  ) {
    const cleanName = name.trim();
    if (!cleanName || !tenant?.id) return;

    const existingIdx = savedPartners.findIndex(
      (p) => p.type === type && p.name.toLowerCase() === cleanName.toLowerCase()
    );

    const entry: SavedPartner = {
      id: existingIdx >= 0 ? savedPartners[existingIdx].id : String(Date.now()),
      type,
      name: cleanName,
      phone: phone.trim(),
      idValue: idValue.trim(),
      tin: tin.trim(),
      paymentMethod: pm,
    };

    const next =
      existingIdx >= 0
        ? savedPartners.map((p, idx) => (idx === existingIdx ? entry : p))
        : [entry, ...savedPartners];

    setSavedPartners(next);
    localStorage.setItem(`durian_partners_v1_${tenant.id}`, JSON.stringify(next));
  }

  function deleteSavedPartner(id: string) {
    if (!tenant?.id) return;
    const next = savedPartners.filter((p) => p.id !== id);
    setSavedPartners(next);
    localStorage.setItem(`durian_partners_v1_${tenant.id}`, JSON.stringify(next));
  }

  function selectSavedPartner(p: SavedPartner) {
    setCounterpartyName(p.name);
    setCounterpartyPhone(p.phone);
    setCounterpartyIdValue(p.idValue);
    setCounterpartyTin(p.tin);
    setPaymentMethod(p.paymentMethod);
  }

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

  function openWeighingModal(
    editIdx: number | null = null,
    presetVariety?: string,
    presetGrade?: string
  ) {
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
      const gCode =
        presetGrade && availableGrades.includes(presetGrade)
          ? presetGrade
          : availableGrades[0] || 'A';

      setModalVarietyCode(vObj.code);
      setModalGrade(gCode);
      setModalGrossKg('');
      setModalTareKg(2.5);
      setModalPriceRm(getMasterPrice(vObj.code, gCode, mode));
    }
    setIsAddBasketModalOpen(true);
  }

  function handleSaveBasketToCart(e: React.FormEvent) {
    e.preventDefault();
    const gross = parseFloat(modalGrossKg) || 0;
    if (gross <= 0) {
      alert('请输入毛重 Enter Gross Kg > 0');
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

  function handleAddCustomGrade(varietyCode: string) {
    const rawGrade = (newGradeInputs[varietyCode] || '').trim().toUpperCase();
    if (!rawGrade) return;

    const updated = varietyConfigs.map((v) => {
      if (v.code !== varietyCode) return v;
      if (v.grades[rawGrade]) return v;
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

  function handleDeleteGrade(varietyCode: string, gradeToDelete: string) {
    const updated = varietyConfigs.map((v) => {
      if (v.code !== varietyCode) return v;
      if (Object.keys(v.grades).length <= 1) return v;
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

  async function handleCheckoutTransaction() {
    if (cartItems.length === 0) {
      openWeighingModal(null);
      return;
    }
    if (!counterpartyName.trim()) {
      setIsCustomerModalOpen(true);
      return;
    }

    setSubmitting(true);
    try {
      const currentMode = activeTab === 'SELL_RESELLER' ? 'SELL_RESELLER' : 'BUY_FARMER';

      // Auto-save Farmer or Reseller to the Contacts List for 1-tap reuse next time
      savePartnerToBook(
        currentMode,
        counterpartyName,
        counterpartyPhone,
        counterpartyIdValue,
        counterpartyTin,
        paymentMethod
      );

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

      const isBuying = currentMode === 'BUY_FARMER';
      const stockChanges = computedItems.map((i) => ({
        variety_code: i.varietyCode,
        variety_name: i.varietyName,
        grade: i.grade,
        delta_kg: isBuying ? i.netWeightKg : -i.netWeightKg,
      }));

      const { data: receiptNo, error } = await supabase.rpc('record_durian_transaction', {
        p_tx_type: currentMode,
        p_einvoice_code: isBuying ? '11' : '01',
        p_total_weight: totalNetWeightKg,
        p_encrypted_payload: encryptedPayload,
        p_encryption_iv: iv,
        p_stock_changes: stockChanges,
      });

      if (error) throw error;

      const nowIso = new Date().toISOString();
      const lhdnJson = buildLhdnMyInvoisPayload(
        currentMode,
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

      setCartItems([]);
      setIsCustomerModalOpen(false);

      setSuccessPopupData({
        meta: { receipt_no: receiptNo, tx_type: currentMode, created_at: nowIso },
        decrypted: confidentialPayload,
        lhdnJson,
      });

      await fetchInventoryAndHistory(user.id);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const financialSummary = useMemo(() => {
    let todayBuyRm = 0;
    let todaySellRm = 0;
    let todayBuyKg = 0;
    let todaySellKg = 0;
    let allBuyRm = 0;
    let allSellRm = 0;

    decryptedLedger.forEach(({ meta, data }) => {
      const txDateStr = new Date(meta.created_at).toLocaleDateString('en-MY');
      const isToday = todayStr ? txDateStr === todayStr : true;

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
  }, [decryptedLedger, todayStr]);

  const cartTotalNetKg = cartItems.reduce(
    (s, i) => s + Math.max(0, i.grossWeightKg - i.basketTareKg),
    0
  );
  const cartTotalRm = cartItems.reduce(
    (s, i) => s + Math.max(0, i.grossWeightKg - i.basketTareKg) * i.pricePerKgRm,
    0
  );

  const modalNetKg = Math.max(
    0,
    Number(((parseFloat(modalGrossKg) || 0) - modalTareKg).toFixed(2))
  );
  const modalSubtotalRm = Number((modalNetKg * modalPriceRm).toFixed(2));
  const currentModalVarietyObj =
    varietyConfigs.find((v) => v.code === modalVarietyCode) || varietyConfigs[0];

  const currentModePartners = savedPartners.filter(
    (p) => p.type === (activeTab === 'SELL_RESELLER' ? 'SELL_RESELLER' : 'BUY_FARMER')
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8faf5] text-emerald-900 flex flex-col items-center justify-center gap-4 text-2xl font-extrabold">
        <AppLogo className="w-20 h-20 animate-bounce" />
        <span>Durian POS</span>
      </div>
    );
  }

  // 1. LOGIN / REGISTER
  if (!user || !tenant) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-lime-50 to-emerald-100 text-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border-4 border-emerald-700/20 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center gap-4 mb-6">
            <AppLogo className="w-16 h-16" />
            <div>
              <h1 className="text-2xl font-extrabold text-emerald-950">Durian POS</h1>
              <p className="text-sm text-emerald-700 font-bold">榴莲批发系统</p>
            </div>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-extrabold text-slate-700 mb-1">电邮 Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-300 focus:border-emerald-600 rounded-xl px-4 py-3 text-lg text-slate-900 outline-none"
                placeholder="boss@durian.com"
              />
            </div>
            <div>
              <label className="block text-sm font-extrabold text-slate-700 mb-1">
                密码 Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-300 focus:border-emerald-600 rounded-xl px-4 py-3 text-lg text-slate-900 outline-none"
                placeholder="••••••••"
              />
            </div>

            {isRegistering && (
              <>
                <div>
                  <label className="block text-sm font-extrabold text-slate-700 mb-1">
                    公司名 Business Name
                  </label>
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-4 py-3 text-lg"
                    placeholder="Raub Durian Sdn Bhd"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-extrabold text-slate-700 mb-1">
                      SSM No.
                    </label>
                    <input
                      type="text"
                      required
                      value={ssmBrn}
                      onChange={(e) => setSsmBrn(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-3 text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-extrabold text-slate-700 mb-1">
                      LHDN TIN
                    </label>
                    <input
                      type="text"
                      required
                      value={tinNumber}
                      onChange={(e) => setTinNumber(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-3 text-base"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-extrabold text-slate-700 mb-1">
                    电话 Phone
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-4 py-3 text-lg"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold py-4 rounded-2xl text-xl shadow-lg transition"
            >
              {isRegistering ? '注册 Register' : '登入 Login'}
            </button>
          </form>

          <button
            onClick={() => setIsRegistering(!isRegistering)}
            className="w-full text-center text-base font-bold text-emerald-800 mt-5 py-2"
          >
            {isRegistering ? '← 返回登入 Login' : '+ 注册新账户 Register'}
          </button>
        </div>
      </div>
    );
  }

  // 2. VAULT PIN UNLOCK
  if (!isVaultUnlocked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-lime-50 to-emerald-100 text-slate-900 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white border-4 border-amber-400 rounded-3xl p-8 text-center shadow-2xl">
          <AppLogo className="w-20 h-20 mx-auto mb-4" />
          <h2 className="text-2xl font-extrabold text-slate-900 mb-1">解锁账本 Vault PIN</h2>
          <p className="text-sm text-slate-500 font-bold mb-5">输入6位数保密密码</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (vaultPin.length < 4) return alert('至少4位数字 Min 4 digits');
              setIsVaultUnlocked(true);
            }}
            className="space-y-4"
          >
            <input
              type="password"
              inputMode="numeric"
              required
              value={vaultPin}
              onChange={(e) => setVaultPin(e.target.value)}
              placeholder="••••••"
              className="w-full text-center tracking-widest text-3xl font-extrabold bg-amber-50/50 border-2 border-amber-400 focus:border-emerald-600 rounded-2xl px-4 py-3.5 text-slate-900 outline-none"
            />
            <button
              type="submit"
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold py-4 rounded-2xl text-xl shadow-lg"
            >
              解锁 Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 3. MAIN POS WORKSPACE (CLEAN, SHORT BUTTONS, FULL-SCREEN RESPONSIVE)
  return (
    <div className="min-h-screen bg-[#f8faf5] text-slate-900 pb-28 lg:pb-12">
      <style jsx global>{`
        @keyframes popSpring {
          0% {
            opacity: 0;
            transform: scale(0.88) translateY(12px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-pop-spring {
          animation: popSpring 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* CLEAN COMPACT TOP HEADER (1 Row on Mobile & Desktop!) */}
      <header className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-green-900 text-white border-b-4 border-amber-400 px-3 sm:px-6 py-3 sticky top-0 z-30 shadow-md print:hidden">
        <div className="max-w-[1600px] mx-auto flex justify-between items-center gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <AppLogo className="w-11 h-11 sm:w-12 sm:h-12" />
            <div className="truncate">
              <h1 className="text-lg sm:text-2xl font-extrabold text-amber-300 truncate">
                {tenant.business_name}
              </h1>
              <p className="text-[11px] sm:text-xs text-emerald-100 font-bold truncate">
                SSM: {tenant.ssm_brn}
              </p>
            </div>
          </div>

          {/* Desktop 6-Tab Navigation (Short 1-Line Labels) */}
          <div className="hidden lg:flex items-center gap-2">
            <button
              onClick={() => switchPosMode('BUY_FARMER')}
              className={`px-5 py-3 rounded-2xl text-base font-extrabold flex items-center gap-1.5 transition ${
                activeTab === 'BUY_FARMER'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'bg-emerald-950/60 text-emerald-100 hover:bg-emerald-950'
              }`}
            >
              <ArrowDownLeft className="w-5 h-5" /> 收果 Buy
            </button>
            <button
              onClick={() => switchPosMode('SELL_RESELLER')}
              className={`px-5 py-3 rounded-2xl text-base font-extrabold flex items-center gap-1.5 transition ${
                activeTab === 'SELL_RESELLER'
                  ? 'bg-lime-400 text-slate-950 shadow-md'
                  : 'bg-emerald-950/60 text-emerald-100 hover:bg-emerald-950'
              }`}
            >
              <ArrowUpRight className="w-5 h-5" /> 批发 Sell
            </button>
            <button
              onClick={() => setActiveTab('CONTACTS')}
              className={`px-5 py-3 rounded-2xl text-base font-extrabold flex items-center gap-1.5 transition ${
                activeTab === 'CONTACTS'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'bg-emerald-950/60 text-emerald-100 hover:bg-emerald-950'
              }`}
            >
              <Users className="w-5 h-5" /> 客户 Contacts
            </button>
            <button
              onClick={() => setActiveTab('PRICE_BOARD')}
              className={`px-5 py-3 rounded-2xl text-base font-extrabold flex items-center gap-1.5 transition ${
                activeTab === 'PRICE_BOARD'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'bg-emerald-950/60 text-emerald-100 hover:bg-emerald-950'
              }`}
            >
              <Coins className="w-5 h-5" /> 牌价 Price
            </button>
            <button
              onClick={() => setActiveTab('LEDGER')}
              className={`px-5 py-3 rounded-2xl text-base font-extrabold flex items-center gap-1.5 transition ${
                activeTab === 'LEDGER'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'bg-emerald-950/60 text-emerald-100 hover:bg-emerald-950'
              }`}
            >
              <BookOpen className="w-5 h-5" /> 账本 Ledger
            </button>
            <button
              onClick={() => setActiveTab('INVENTORY')}
              className={`px-5 py-3 rounded-2xl text-base font-extrabold flex items-center gap-1.5 transition ${
                activeTab === 'INVENTORY'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'bg-emerald-950/60 text-emerald-100 hover:bg-emerald-950'
              }`}
            >
              <Package className="w-5 h-5" /> 库存 Stock
            </button>
          </div>

          {/* Right Side: Today Profit Pill + Logout */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setActiveTab('LEDGER')}
              className="bg-emerald-950 border-2 border-amber-400 px-3.5 py-1.5 rounded-2xl text-right"
            >
              <div className="text-[10px] font-extrabold text-amber-200 uppercase">
                今日净利 Profit
              </div>
              <div
                className={`text-base sm:text-xl font-mono font-extrabold ${
                  financialSummary.todayProfitRm >= 0 ? 'text-amber-400' : 'text-red-300'
                }`}
              >
                {financialSummary.todayProfitRm >= 0 ? '+' : ''}RM{' '}
                {financialSummary.todayProfitRm.toFixed(0)}
              </div>
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

      {/* Mobile Bottom Navigation Bar (6 Clean Icons) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t-4 border-emerald-700 grid grid-cols-6 gap-1 p-1.5 z-30 shadow-2xl print:hidden">
        <button
          onClick={() => switchPosMode('BUY_FARMER')}
          className={`flex flex-col items-center justify-center py-2 rounded-xl font-extrabold text-[11px] ${
            activeTab === 'BUY_FARMER' ? 'bg-amber-400 text-slate-950' : 'text-slate-600'
          }`}
        >
          <ArrowDownLeft className="w-5 h-5 mb-0.5" />
          <span>收果</span>
        </button>
        <button
          onClick={() => switchPosMode('SELL_RESELLER')}
          className={`flex flex-col items-center justify-center py-2 rounded-xl font-extrabold text-[11px] ${
            activeTab === 'SELL_RESELLER' ? 'bg-emerald-600 text-white' : 'text-slate-600'
          }`}
        >
          <ArrowUpRight className="w-5 h-5 mb-0.5" />
          <span>批发</span>
        </button>
        <button
          onClick={() => setActiveTab('CONTACTS')}
          className={`flex flex-col items-center justify-center py-2 rounded-xl font-extrabold text-[11px] ${
            activeTab === 'CONTACTS' ? 'bg-amber-400 text-slate-950' : 'text-slate-600'
          }`}
        >
          <Users className="w-5 h-5 mb-0.5" />
          <span>客户</span>
        </button>
        <button
          onClick={() => setActiveTab('PRICE_BOARD')}
          className={`flex flex-col items-center justify-center py-2 rounded-xl font-extrabold text-[11px] ${
            activeTab === 'PRICE_BOARD' ? 'bg-amber-500 text-slate-950' : 'text-slate-600'
          }`}
        >
          <Coins className="w-5 h-5 mb-0.5" />
          <span>牌价</span>
        </button>
        <button
          onClick={() => setActiveTab('LEDGER')}
          className={`flex flex-col items-center justify-center py-2 rounded-xl font-extrabold text-[11px] ${
            activeTab === 'LEDGER' ? 'bg-emerald-800 text-amber-300' : 'text-slate-600'
          }`}
        >
          <BookOpen className="w-5 h-5 mb-0.5" />
          <span>账本</span>
        </button>
        <button
          onClick={() => setActiveTab('INVENTORY')}
          className={`flex flex-col items-center justify-center py-2 rounded-xl font-extrabold text-[11px] ${
            activeTab === 'INVENTORY' ? 'bg-blue-600 text-white' : 'text-slate-600'
          }`}
        >
          <Package className="w-5 h-5 mb-0.5" />
          <span>库存</span>
        </button>
      </nav>

      {/* MAIN WORKSPACE */}
      <main className="max-w-[1600px] mx-auto p-3 sm:p-6 print:hidden">
        {activeTab === 'BUY_FARMER' || activeTab === 'SELL_RESELLER' ? (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            {/* LEFT / TOP AREA: Customer Chip Bar + Weigh Button + Grade Grid */}
            <div className="xl:col-span-7 space-y-4">
              {/* Compact Customer / Farmer Bar + 1-Tap Saved List */}
              <div
                className={`p-4 rounded-3xl border-2 shadow-sm space-y-3 ${
                  activeTab === 'BUY_FARMER'
                    ? 'bg-amber-100/80 border-amber-400'
                    : 'bg-emerald-100/80 border-emerald-500'
                }`}
              >
                <div className="flex justify-between items-center gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`px-3 py-1 rounded-xl font-extrabold text-sm ${
                        activeTab === 'BUY_FARMER'
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-emerald-700 text-white'
                      }`}
                    >
                      {activeTab === 'BUY_FARMER' ? '收果模式 Buy' : '批发模式 Sell'}
                    </span>
                    {counterpartyName && (
                      <span className="font-extrabold text-lg text-slate-900 truncate">
                        {counterpartyName}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsCustomerModalOpen(true)}
                    className="px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-900 border-2 border-slate-900 font-extrabold text-sm flex items-center gap-1.5 shadow-sm shrink-0"
                  >
                    <UserCheck className="w-4 h-4 text-emerald-700" />
                    <span>
                      {counterpartyName
                        ? '换客户 Change'
                        : activeTab === 'BUY_FARMER'
                        ? '+ 选果农 Farmer'
                        : '+ 选客户 Buyer'}
                    </span>
                  </button>
                </div>

                {/* 1-Tap Horizontal Saved Farmer / Reseller Pills */}
                {currentModePartners.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    <span className="text-xs font-extrabold text-slate-600 shrink-0">常客:</span>
                    {currentModePartners.map((p) => {
                      const isSelected =
                        counterpartyName.toLowerCase() === p.name.toLowerCase();
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => selectSavedPartner(p)}
                          className={`px-3.5 py-1.5 rounded-xl font-extrabold text-sm border-2 whitespace-nowrap transition ${
                            isSelected
                              ? 'bg-slate-900 text-amber-300 border-slate-900 shadow'
                              : 'bg-white text-slate-800 border-slate-300 hover:border-slate-500'
                          }`}
                        >
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Big 1-Line Weigh Button + Quick Grade Shortcuts */}
              <div className="bg-white border-2 border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
                <button
                  type="button"
                  onClick={() => openWeighingModal(null)}
                  className="w-full py-5 px-6 rounded-2xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white font-extrabold text-2xl flex items-center justify-center gap-2 shadow-lg transition"
                >
                  <Plus className="w-7 h-7 stroke-[3]" /> 称重 Weigh
                </button>

                {/* Clean 1-Tap Grade Grid */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {varietyConfigs.map((v) =>
                    Object.keys(v.grades).map((g) => {
                      const mode =
                        activeTab === 'SELL_RESELLER' ? 'SELL_RESELLER' : 'BUY_FARMER';
                      const price = getMasterPrice(v.code, g, mode);
                      return (
                        <button
                          key={`${v.code}_${g}`}
                          type="button"
                          onClick={() => openWeighingModal(null, v.code, g)}
                          className="p-2.5 rounded-2xl bg-amber-50/70 hover:bg-amber-100 active:scale-95 border-2 border-amber-300 text-center transition"
                        >
                          <div className="font-extrabold text-sm text-slate-900 truncate">
                            {v.short} <span className="text-emerald-800">{g}</span>
                          </div>
                          <div className="text-xs font-mono font-bold text-slate-600 mt-0.5">
                            RM{price}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT / BOTTOM AREA: Clean 1-Line Cart + Checkout Bar */}
            <div className="xl:col-span-5 space-y-4">
              <div className="bg-white border-2 border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-3">
                  <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-emerald-700" />
                    清单 Cart ({cartItems.length})
                  </h3>
                  {cartItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCartItems([])}
                      className="px-3 py-1 rounded-lg bg-red-50 text-xs font-extrabold text-red-600"
                    >
                      清空
                    </button>
                  )}
                </div>

                {cartItems.length === 0 ? (
                  <div className="py-10 text-center text-slate-400">
                    <Scale className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-base font-extrabold">空清单 Empty Cart</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                    {cartItems.map((item, idx) => {
                      const netKg = Math.max(
                        0,
                        Number((item.grossWeightKg - item.basketTareKg).toFixed(2))
                      );
                      const subRm = Number((netKg * item.pricePerKgRm).toFixed(2));

                      return (
                        <div
                          key={idx}
                          className="py-3 flex justify-between items-center gap-2"
                        >
                          <div
                            onClick={() => openWeighingModal(idx)}
                            className="flex-1 min-w-0 cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-amber-300 text-slate-950 font-extrabold text-xs rounded-md">
                                #{idx + 1}
                              </span>
                              <span className="font-extrabold text-base text-slate-900 truncate">
                                {item.varietyName}
                              </span>
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 font-extrabold text-xs rounded-md">
                                {item.grade}
                              </span>
                            </div>
                            <div className="text-xs text-slate-600 font-bold mt-1">
                              {item.grossWeightKg}kg
                              {item.basketTareKg > 0 ? `-${item.basketTareKg}萝` : '(无萝)'} ={' '}
                              <strong className="font-mono text-slate-900">
                                {netKg.toFixed(2)}kg
                              </strong>{' '}
                              × RM{item.pricePerKgRm}
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0">
                            <span
                              onClick={() => openWeighingModal(idx)}
                              className="text-lg font-mono font-extrabold text-emerald-800 cursor-pointer"
                            >
                              RM {subRm.toFixed(2)}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setCartItems(cartItems.filter((_, i) => i !== idx))
                              }
                              className="p-2 rounded-xl bg-red-50 text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Compact Dark Green & Gold Checkout Box */}
                <div className="mt-4 bg-gradient-to-r from-emerald-950 via-emerald-900 to-green-950 border-4 border-amber-400 text-white p-5 rounded-3xl space-y-4 shadow-xl">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-emerald-200">
                      {cartItems.length} 萝 • 净重{' '}
                      <strong className="text-amber-300 font-mono text-lg">
                        {cartTotalNetKg.toFixed(2)} kg
                      </strong>
                    </span>
                    <span className="text-2xl sm:text-3xl font-mono font-extrabold text-amber-400">
                      RM {cartTotalRm.toFixed(2)}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleCheckoutTransaction}
                    className="w-full py-4 rounded-2xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-extrabold text-xl flex items-center justify-center gap-2 shadow-lg transition"
                  >
                    <CheckCircle2 className="w-6 h-6" />
                    {submitting
                      ? '保存中...'
                      : counterpartyName
                      ? `结账 (${counterpartyName})`
                      : '结账 Checkout'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'CONTACTS' ? (
          /* TAB 3: DEDICATED FARMER LIST & RESELLER LIST DIRECTORY (客户与果农名册) */
          <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-4 bg-white border-2 border-slate-200 p-5 rounded-3xl shadow-sm">
              <div className="flex items-center gap-3">
                <AppLogo className="w-12 h-12" />
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900">
                    常客名册 Contacts List
                  </h2>
                  <p className="text-sm font-bold text-slate-500">
                    保存果农与批发商资料，每天收果/卖果一键选用
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setContactTabType('BUY_FARMER')}
                  className={`px-5 py-3 rounded-2xl font-extrabold text-base transition ${
                    contactTabType === 'BUY_FARMER'
                      ? 'bg-amber-400 text-slate-950 shadow'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  果农名册 Farmers (
                  {savedPartners.filter((p) => p.type === 'BUY_FARMER').length})
                </button>
                <button
                  onClick={() => setContactTabType('SELL_RESELLER')}
                  className={`px-5 py-3 rounded-2xl font-extrabold text-base transition ${
                    contactTabType === 'SELL_RESELLER'
                      ? 'bg-emerald-700 text-white shadow'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  批发商 Resellers (
                  {savedPartners.filter((p) => p.type === 'SELL_RESELLER').length})
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Add New Farmer / Reseller Card */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newPartnerForm.name.trim()) return;
                  savePartnerToBook(
                    contactTabType,
                    newPartnerForm.name,
                    newPartnerForm.phone,
                    newPartnerForm.idValue,
                    newPartnerForm.tin,
                    newPartnerForm.paymentMethod
                  );
                  setNewPartnerForm({
                    name: '',
                    phone: '',
                    idValue: '',
                    tin: '',
                    paymentMethod: 'CASH',
                  });
                }}
                className="lg:col-span-4 bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-4"
              >
                <h3 className="text-lg font-extrabold text-slate-900">
                  {contactTabType === 'BUY_FARMER'
                    ? '+ 新增果农 Add Farmer'
                    : '+ 新增批发商 Add Reseller'}
                </h3>

                <div>
                  <label className="block text-xs font-extrabold text-slate-600 mb-1">
                    姓名 / 店名 Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newPartnerForm.name}
                    onChange={(e) =>
                      setNewPartnerForm({ ...newPartnerForm, name: e.target.value })
                    }
                    placeholder={
                      contactTabType === 'BUY_FARMER' ? 'e.g. 阿林果园 Uncle Lim' : 'e.g. SS2 榴莲档'
                    }
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2.5 text-base font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-600 mb-1">
                      电话 Phone
                    </label>
                    <input
                      type="tel"
                      value={newPartnerForm.phone}
                      onChange={(e) =>
                        setNewPartnerForm({ ...newPartnerForm, phone: e.target.value })
                      }
                      placeholder="012-3456789"
                      className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-slate-600 mb-1">
                      默认付款 Payment
                    </label>
                    <select
                      value={newPartnerForm.paymentMethod}
                      onChange={(e: any) =>
                        setNewPartnerForm({
                          ...newPartnerForm,
                          paymentMethod: e.target.value,
                        })
                      }
                      className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2.5 text-sm font-extrabold"
                    >
                      <option value="CASH">现金 Cash</option>
                      <option value="BANK_TRANSFER">转账 Bank</option>
                      <option value="EWALLET">电子钱包 TNG</option>
                      <option value="CREDIT_TERM">挂账 Credit</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-600 mb-1">
                      IC / SSM No.
                    </label>
                    <input
                      type="text"
                      value={newPartnerForm.idValue}
                      onChange={(e) =>
                        setNewPartnerForm({ ...newPartnerForm, idValue: e.target.value })
                      }
                      placeholder="身份证/注册号"
                      className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-slate-600 mb-1">
                      LHDN TIN
                    </label>
                    <input
                      type="text"
                      value={newPartnerForm.tin}
                      onChange={(e) =>
                        setNewPartnerForm({ ...newPartnerForm, tin: e.target.value })
                      }
                      placeholder="TIN 税号"
                      className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-base shadow"
                >
                  + 保存到名册 Save Contact
                </button>
              </form>

              {/* Saved Contacts Cards List */}
              <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {savedPartners
                  .filter((p) => p.type === contactTabType)
                  .map((p) => (
                    <div
                      key={p.id}
                      className="bg-white border-2 border-slate-200 hover:border-emerald-500 rounded-3xl p-5 shadow-sm flex flex-col justify-between gap-4"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span
                            className={`px-2.5 py-0.5 rounded-lg text-xs font-extrabold ${
                              p.type === 'BUY_FARMER'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-emerald-100 text-emerald-900'
                            }`}
                          >
                            {p.type === 'BUY_FARMER' ? '果农 Farmer' : '批发 Reseller'} •{' '}
                            {p.paymentMethod}
                          </span>
                          <h4 className="text-xl font-extrabold text-slate-900 mt-1">
                            {p.name}
                          </h4>
                          <p className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" /> {p.phone || '无电话'} • IC/SSM:{' '}
                            {p.idValue || 'N/A'}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => deleteSavedPartner(p.id)}
                          className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          selectSavedPartner(p);
                          switchPosMode(p.type);
                        }}
                        className={`w-full py-3 rounded-2xl font-extrabold text-base shadow-sm ${
                          p.type === 'BUY_FARMER'
                            ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                            : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                        }`}
                      >
                        {p.type === 'BUY_FARMER'
                          ? '选用并收果 Weigh Farmer →'
                          : '选用并出货 Weigh Reseller →'}
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        ) : activeTab === 'PRICE_BOARD' ? (
          /* TAB 4: DYNAMIC MASTER PRICE BOARD */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {varietyConfigs.map((v) => {
              const gradeList = Object.keys(v.grades);

              return (
                <div
                  key={v.code}
                  className="bg-white border-2 border-emerald-700/20 rounded-3xl p-5 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-3 mb-3">
                      <AppLogo className="w-9 h-9" />
                      <h3 className="text-xl font-extrabold text-slate-900">{v.name}</h3>
                    </div>

                    <div className="grid grid-cols-12 gap-2 text-xs font-extrabold uppercase text-slate-500 px-2 mb-2">
                      <span className="col-span-4">等级</span>
                      <span className="col-span-3 text-amber-800">收果 Buy</span>
                      <span className="col-span-3 text-emerald-800">批发 Sell</span>
                      <span className="col-span-2 text-right">删</span>
                    </div>

                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {gradeList.map((g) => (
                        <div
                          key={g}
                          className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-2xl border border-slate-200"
                        >
                          <span className="col-span-4 font-extrabold text-base text-slate-900 px-2">
                            {g}
                          </span>
                          <div className="col-span-3">
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.5"
                              value={v.grades[g]?.buy ?? 0}
                              onChange={(e) =>
                                updateGradePrice(
                                  v.code,
                                  g,
                                  'buy',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full bg-amber-50 border-2 border-amber-300 rounded-xl px-2 py-1.5 text-base font-mono font-extrabold text-amber-950"
                            />
                          </div>
                          <div className="col-span-3">
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.5"
                              value={v.grades[g]?.sell ?? 0}
                              onChange={(e) =>
                                updateGradePrice(
                                  v.code,
                                  g,
                                  'sell',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full bg-emerald-50 border-2 border-emerald-300 rounded-xl px-2 py-1.5 text-base font-mono font-extrabold text-emerald-950"
                            />
                          </div>
                          <div className="col-span-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteGrade(v.code, g)}
                              className="p-1.5 rounded-xl bg-red-50 text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2">
                    <input
                      type="text"
                      value={newGradeInputs[v.code] || ''}
                      onChange={(e) =>
                        setNewGradeInputs({ ...newGradeInputs, [v.code]: e.target.value })
                      }
                      placeholder="新等级 e.g. AB, ZZ"
                      className="flex-1 bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-sm font-bold uppercase"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddCustomGrade(v.code)}
                      className="px-4 py-2 rounded-xl bg-emerald-700 text-white font-extrabold text-sm"
                    >
                      + 加等级
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : activeTab === 'LEDGER' ? (
          /* TAB 5: TODAY PROFIT & ACCOUNT LEDGER */
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border-2 border-emerald-500 rounded-3xl p-5 shadow-sm">
                <span className="text-xs font-extrabold uppercase text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
                  今日批发 Sales In
                </span>
                <div className="text-3xl font-mono font-extrabold text-emerald-700 mt-3">
                  +RM {financialSummary.todaySellRm.toFixed(2)}
                </div>
                <div className="text-xs font-bold text-slate-500 mt-1">
                  {financialSummary.todaySellKg.toFixed(2)} kg
                </div>
              </div>

              <div className="bg-white border-2 border-amber-400 rounded-3xl p-5 shadow-sm">
                <span className="text-xs font-extrabold uppercase text-amber-900 bg-amber-100 px-3 py-1 rounded-full">
                  今日收果 Cost Out
                </span>
                <div className="text-3xl font-mono font-extrabold text-amber-700 mt-3">
                  -RM {financialSummary.todayBuyRm.toFixed(2)}
                </div>
                <div className="text-xs font-bold text-slate-500 mt-1">
                  {financialSummary.todayBuyKg.toFixed(2)} kg
                </div>
              </div>

              <div className="bg-gradient-to-br from-emerald-900 to-green-800 text-white border-2 border-amber-400 rounded-3xl p-5 shadow-lg">
                <span className="text-xs font-extrabold uppercase text-amber-300 bg-emerald-950/70 px-3 py-1 rounded-full">
                  今日净利 Net Profit
                </span>
                <div className="text-3xl font-mono font-extrabold text-amber-300 mt-3">
                  {financialSummary.todayProfitRm >= 0 ? '+' : ''}RM{' '}
                  {financialSummary.todayProfitRm.toFixed(2)}
                </div>
                <div className="text-xs font-bold text-emerald-100 mt-1">
                  总累计 All: RM {financialSummary.allProfitRm.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-extrabold text-slate-900">账本记录 Ledger</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLedgerFilter('TODAY')}
                    className={`px-4 py-2 rounded-xl font-extrabold text-sm ${
                      ledgerFilter === 'TODAY'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    今日
                  </button>
                  <button
                    onClick={() => setLedgerFilter('ALL')}
                    className={`px-4 py-2 rounded-xl font-extrabold text-sm ${
                      ledgerFilter === 'ALL'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    全部
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-t border-slate-200">
                  <thead className="bg-slate-100 text-slate-700 text-xs font-extrabold">
                    <tr>
                      <th className="p-3">单号</th>
                      <th className="p-3">客户/果农</th>
                      <th className="p-3 text-right">净重</th>
                      <th className="p-3 text-right">金额</th>
                      <th className="p-3 text-right">单据</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {decryptedLedger
                      .filter(({ meta }) => {
                        if (ledgerFilter === 'ALL' || !todayStr) return true;
                        return (
                          new Date(meta.created_at).toLocaleDateString('en-MY') === todayStr
                        );
                      })
                      .map(({ meta, data }) => {
                        const isBuy = meta.tx_type === 'BUY_FARMER';
                        return (
                          <tr key={meta.id} className="hover:bg-amber-50/40">
                            <td className="p-3 font-mono font-extrabold text-xs">
                              {meta.receipt_no}
                            </td>
                            <td className="p-3 font-extrabold text-slate-900">
                              {data.counterpartyName}
                            </td>
                            <td className="p-3 text-right font-mono font-bold">
                              {Number(meta.total_net_weight_kg).toFixed(1)}kg
                            </td>
                            <td
                              className={`p-3 text-right font-mono font-extrabold ${
                                isBuy ? 'text-amber-700' : 'text-emerald-700'
                              }`}
                            >
                              {isBuy
                                ? `-RM${data.grandTotalRm.toFixed(0)}`
                                : `+RM${data.grandTotalRm.toFixed(0)}`}
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
                                查看
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
          /* TAB 6: LIVE STOCK */
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 shadow-sm">
            <h2 className="text-xl font-extrabold text-slate-900 mb-4">实时库存 Stock</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {inventory.map((stock) => (
                <div
                  key={stock.id}
                  className="bg-gradient-to-br from-amber-50/70 to-lime-50/70 border-2 border-emerald-700/30 p-4 rounded-2xl flex flex-col justify-between"
                >
                  <div className="font-extrabold text-slate-900 text-lg">
                    {stock.variety_name}
                  </div>
                  <div className="mt-3 pt-2 border-t border-emerald-700/20 flex justify-between items-baseline">
                    <span className="px-2.5 py-0.5 bg-amber-300 rounded-lg text-xs font-extrabold text-slate-950">
                      {stock.grade}
                    </span>
                    <span className="text-xl font-mono font-extrabold text-emerald-800">
                      {Number(stock.current_weight_kg).toFixed(1)}kg
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ===================================================================== */}
      {/* POPUP 1: WEIGHING MODAL (SHORT TEXT, BIG BUTTONS)                     */}
      {/* ===================================================================== */}
      {isAddBasketModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto print:hidden">
          <div className="bg-white border-4 border-emerald-700 rounded-3xl max-w-md w-full p-5 shadow-2xl animate-pop-spring my-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <AppLogo className="w-8 h-8" />
                <h3 className="text-xl font-extrabold text-slate-900">称重 Weigh</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddBasketModalOpen(false)}
                className="p-2 rounded-full bg-slate-100 text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBasketToCart} className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {varietyConfigs.map((v) => (
                  <button
                    key={v.code}
                    type="button"
                    onClick={() => {
                      const mode =
                        activeTab === 'SELL_RESELLER' ? 'SELL_RESELLER' : 'BUY_FARMER';
                      const grades = Object.keys(v.grades);
                      const nextGrade = grades.includes(modalGrade)
                        ? modalGrade
                        : grades[0] || 'A';
                      setModalVarietyCode(v.code);
                      setModalGrade(nextGrade);
                      setModalPriceRm(getMasterPrice(v.code, nextGrade, mode));
                    }}
                    className={`py-2.5 px-2 rounded-xl font-extrabold text-sm border-2 transition ${
                      modalVarietyCode === v.code
                        ? 'bg-emerald-700 text-white border-emerald-800'
                        : 'bg-slate-50 text-slate-800 border-slate-200'
                    }`}
                  >
                    {v.short}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5">
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
                    className={`px-4 py-2 rounded-xl font-extrabold text-sm border-2 transition ${
                      modalGrade === g
                        ? 'bg-amber-400 text-slate-950 border-amber-600'
                        : 'bg-slate-50 text-slate-800 border-slate-200'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {RAGA_TARE_PRESETS.map((preset) => (
                  <button
                    key={preset.kg}
                    type="button"
                    onClick={() => setModalTareKg(preset.kg)}
                    className={`py-2 px-1 rounded-xl font-extrabold text-xs border-2 text-center ${
                      modalTareKg === preset.kg
                        ? 'bg-red-600 text-white border-red-800'
                        : 'bg-red-50 text-red-900 border-red-200'
                    }`}
                  >
                    <div className="font-mono">{preset.kg === 0 ? '0kg' : `-${preset.kg}`}</div>
                    <div className="text-[10px]">{preset.label}</div>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    毛重 Gross Kg *
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    autoFocus
                    required
                    value={modalGrossKg}
                    onChange={(e) => setModalGrossKg(e.target.value)}
                    placeholder="0.0"
                    className="w-full bg-amber-50/70 border-2 border-emerald-600 rounded-2xl px-3.5 py-3 text-2xl font-mono font-extrabold text-slate-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-emerald-800 mb-1">
                    单价 RM/kg
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={modalPriceRm}
                    onChange={(e) => setModalPriceRm(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-2xl px-3.5 py-3 text-2xl font-mono font-extrabold text-emerald-800 outline-none"
                  />
                </div>
              </div>

              <div className="bg-slate-900 text-white p-4 rounded-2xl flex justify-between items-center">
                <div>
                  <div className="text-[11px] text-slate-400">净重 Net</div>
                  <div className="text-xl font-mono font-extrabold text-amber-300">
                    {modalNetKg.toFixed(2)} kg
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-400">小计 Subtotal</div>
                  <div className="text-2xl font-mono font-extrabold text-emerald-400">
                    RM {modalSubtotalRm.toFixed(2)}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xl shadow-lg"
              >
                + 确认加果 Add
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* POPUP 2: SELECT OR ADD FARMER / RESELLER                              */}
      {/* ===================================================================== */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print:hidden">
          <div className="bg-white border-4 border-amber-400 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-pop-spring my-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
              <h3 className="text-xl font-extrabold text-slate-900">
                {activeTab === 'BUY_FARMER' ? '选择果农 Farmer' : '选择客户 Reseller'}
              </h3>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="p-2 rounded-full bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {currentModePartners.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-extrabold text-amber-800 mb-2">
                  常客列表 (点击即选):
                </div>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-amber-50/70 rounded-2xl border border-amber-200">
                  {currentModePartners.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectSavedPartner(p)}
                      className={`px-3.5 py-2 rounded-xl text-sm font-extrabold border-2 ${
                        counterpartyName.toLowerCase() === p.name.toLowerCase()
                          ? 'bg-emerald-700 text-white border-emerald-900'
                          : 'bg-white text-slate-900 border-amber-300'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <input
                type="text"
                autoFocus
                value={counterpartyName}
                onChange={(e) => setCounterpartyName(e.target.value)}
                placeholder={
                  activeTab === 'BUY_FARMER' ? '果农姓名 Farmer Name *' : '客户名称 Buyer Name *'
                }
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-4 py-3 text-lg font-bold outline-none"
              />

              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'CASH', label: '现金 Cash' },
                  { id: 'BANK_TRANSFER', label: '转账 Bank' },
                  { id: 'EWALLET', label: '电子钱包 TNG' },
                  { id: 'CREDIT_TERM', label: '挂账 Credit' },
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

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="tel"
                  value={counterpartyPhone}
                  onChange={(e) => setCounterpartyPhone(e.target.value)}
                  placeholder="电话 Phone"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold"
                />
                <input
                  type="text"
                  value={counterpartyIdValue}
                  onChange={(e) => setCounterpartyIdValue(e.target.value)}
                  placeholder="IC / SSM"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const mode =
                      activeTab === 'SELL_RESELLER' ? 'SELL_RESELLER' : 'BUY_FARMER';
                    savePartnerToBook(
                      mode,
                      counterpartyName,
                      counterpartyPhone,
                      counterpartyIdValue,
                      counterpartyTin,
                      paymentMethod
                    );
                    setIsCustomerModalOpen(false);
                  }}
                  className="flex-1 py-3.5 rounded-2xl bg-slate-200 text-slate-900 font-extrabold text-base"
                >
                  确定 OK
                </button>
                {cartItems.length > 0 && counterpartyName.trim() && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleCheckoutTransaction}
                    className="flex-1 py-3.5 rounded-2xl bg-amber-400 text-slate-950 font-extrabold text-base shadow-md"
                  >
                    {submitting ? '保存中...' : '立即结账 Pay'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* POPUP 3: ANIMATED SUCCESS CELEBRATION                                 */}
      {/* ===================================================================== */}
      {successPopupData && (
        <div className="fixed inset-0 z-50 bg-emerald-950/80 backdrop-blur-md flex items-center justify-center p-4 print:hidden">
          <div className="bg-white border-4 border-amber-400 rounded-3xl max-w-sm w-full p-7 text-center shadow-2xl animate-pop-spring">
            <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-12 h-12" />
            </div>

            <h3 className="text-2xl font-extrabold text-slate-900">保存成功 Saved!</h3>
            <p className="text-xs font-mono font-bold text-slate-500 mt-1">
              {successPopupData.meta.receipt_no}
            </p>

            <div className="my-5 p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl">
              <div className="text-sm font-extrabold text-slate-700">
                {successPopupData.decrypted.counterpartyName}
              </div>
              <div className="text-3xl font-mono font-extrabold text-emerald-800 mt-1">
                RM {successPopupData.decrypted.grandTotalRm.toFixed(2)}
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  const receiptToView = successPopupData;
                  setSuccessPopupData(null);
                  setSelectedReceipt(receiptToView);
                }}
                className="w-full py-4 rounded-2xl bg-emerald-700 text-white font-extrabold text-lg flex items-center justify-center gap-2 shadow-lg"
              >
                <Printer className="w-5 h-5" /> 打印收据 Print
              </button>
              <button
                type="button"
                onClick={() => setSuccessPopupData(null)}
                className="w-full py-3.5 rounded-2xl bg-slate-100 text-slate-800 font-extrabold text-base"
              >
                下一单 Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* POPUP 4: SCROLLABLE E-INVOICE & PRINT RECEIPT MODAL                   */}
      {/* ===================================================================== */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto print:static print:bg-white print:p-0">
          <div className="bg-white border-4 border-emerald-700 rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-pop-spring print:max-h-none print:border-none print:shadow-none">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-3xl print:hidden">
              <span className="font-extrabold text-base text-slate-900">
                {selectedReceipt.meta.receipt_no}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowLhdnJsonModal(!showLhdnJsonModal)}
                  className="px-3 py-2 rounded-xl bg-slate-200 text-slate-800 font-extrabold text-xs flex items-center gap-1"
                >
                  <Code2 className="w-4 h-4" /> JSON
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-emerald-700 text-white font-extrabold text-sm flex items-center gap-1.5 shadow"
                >
                  <Printer className="w-4 h-4" /> 打印 Print
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLhdnJsonModal(false);
                    setSelectedReceipt(null);
                  }}
                  className="p-2 rounded-full bg-slate-200 text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 sm:p-7 overflow-y-auto space-y-4 print:overflow-visible print:p-0">
              <div className="text-center border-b-2 border-dashed border-slate-300 pb-4">
                <AppLogo className="w-12 h-12 mx-auto mb-2" />
                <h2 className="text-xl font-extrabold uppercase text-slate-900">
                  {tenant.business_name}
                </h2>
                <p className="text-xs text-slate-600 font-bold">
                  SSM: {tenant.ssm_brn} | TIN: {tenant.tin_number} | Tel: {tenant.phone}
                </p>
                <div className="mt-2 inline-block px-3 py-1 bg-slate-900 text-white text-xs font-extrabold rounded-lg">
                  {selectedReceipt.meta.tx_type === 'BUY_FARMER'
                    ? '榴莲收购单 Self-Billed e-Invoice (Code 11)'
                    : '榴莲批发单 Wholesale e-Invoice (Code 01)'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div>
                  <p className="font-extrabold text-base text-slate-900">
                    {selectedReceipt.decrypted.counterpartyName}
                  </p>
                  <p className="text-slate-600">
                    Tel: {selectedReceipt.decrypted.counterpartyPhone || 'N/A'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-extrabold text-slate-900">
                    {selectedReceipt.meta.receipt_no}
                  </p>
                  <p className="text-slate-600">
                    {new Date(selectedReceipt.meta.created_at).toLocaleString('en-MY')}
                  </p>
                </div>
              </div>

              <table className="w-full text-xs sm:text-sm border-t border-b border-slate-300">
                <thead>
                  <tr className="border-b border-slate-200 text-left bg-slate-100">
                    <th className="py-2 px-1.5 font-extrabold">品种</th>
                    <th className="py-2 px-1.5 text-right font-extrabold">净重</th>
                    <th className="py-2 px-1.5 text-right font-extrabold">RM/kg</th>
                    <th className="py-2 px-1.5 text-right font-extrabold">小计</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedReceipt.decrypted.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-1.5 font-bold">
                        {item.varietyName} ({item.grade})
                      </td>
                      <td className="py-2 px-1.5 text-right font-mono font-extrabold">
                        {item.netWeightKg.toFixed(2)}kg
                      </td>
                      <td className="py-2 px-1.5 text-right font-mono">
                        {item.pricePerKgRm.toFixed(2)}
                      </td>
                      <td className="py-2 px-1.5 text-right font-mono font-extrabold">
                        RM{item.subtotalRm.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between items-center bg-amber-50 border-2 border-amber-400 p-4 rounded-2xl">
                <span className="text-base font-extrabold text-slate-900">总额 TOTAL:</span>
                <span className="text-2xl font-mono font-extrabold text-emerald-800">
                  RM {selectedReceipt.decrypted.grandTotalRm.toFixed(2)}
                </span>
              </div>

              {showLhdnJsonModal && (
                <div className="bg-slate-900 text-emerald-300 p-3 rounded-2xl text-[11px] font-mono overflow-x-auto max-h-52 print:hidden">
                  <pre>{JSON.stringify(selectedReceipt.lhdnJson, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}