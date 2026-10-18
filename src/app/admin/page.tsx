// src/app/admin/page.tsx
import {
    getAllWholesalerAccounts,
    toggleWholesalerStatus,
    deleteInactiveWholesalerAccount,
  } from './actions';

  export const dynamic = 'force-dynamic';
  
  export default async function SuperAdminDashboard() {
    const tenants = await getAllWholesalerAccounts();
  
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-2xl font-bold text-emerald-400">
                SaaS Super Admin Panel — Durian POS
              </h1>
              <p className="text-sm text-slate-400">
                Zero-Knowledge Mode Active: Financial figures & farmer/reseller records are client-side encrypted (AES-256-GCM).
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-lg text-sm">
              Total Wholesalers: <span className="font-bold text-white">{tenants.length}</span> / 100
            </div>
          </div>
  
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/60 text-slate-300 uppercase text-xs">
                <tr>
                  <th className="p-4">Business / SSM</th>
                  <th className="p-4">Email & Phone</th>
                  <th className="p-4">Receipts Issued</th>
                  <th className="p-4">Last Active</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {tenants.map((t) => {
                  const daysInactive = Math.floor(
                    (Date.now() - new Date(t.last_active_at).getTime()) / (1000 * 60 * 60 * 24)
                  );
  
                  return (
                    <tr key={t.id} className="hover:bg-slate-800/30">
                      <td className="p-4">
                        <div className="font-semibold text-white">{t.business_name}</div>
                        <div className="text-xs text-slate-400">SSM: {t.ssm_brn || 'N/A'}</div>
                      </td>
                      <td className="p-4">
                        <div>{t.email}</div>
                        <div className="text-xs text-slate-400">{t.phone}</div>
                      </td>
                      <td className="p-4">
                        <span className="text-amber-400 font-mono">Buy: {t.buy_seq}</span> |{' '}
                        <span className="text-emerald-400 font-mono">Sell: {t.sell_seq}</span>
                      </td>
                      <td className="p-4">
                        <div>{new Date(t.last_active_at).toLocaleDateString('en-MY')}</div>
                        <div className="text-xs text-slate-400">{daysInactive} days ago</div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            t.is_active
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-red-500/20 text-red-300'
                          }`}
                        >
                          {t.is_active ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <form
                          action={async () => {
                            'use server';
                            await toggleWholesalerStatus(t.id, !t.is_active);
                          }}
                          className="inline"
                        >
                          <button
                            type="submit"
                            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium"
                          >
                            {t.is_active ? 'Suspend' : 'Activate'}
                          </button>
                        </form>
  
                        <form
                          action={async () => {
                            'use server';
                            await deleteInactiveWholesalerAccount(t.id);
                          }}
                          className="inline"
                        >
                          <button
                            type="submit"
                            className="px-3 py-1.5 rounded bg-red-600/20 hover:bg-red-600/40 text-red-300 text-xs font-medium"
                          >
                            Delete Account
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }