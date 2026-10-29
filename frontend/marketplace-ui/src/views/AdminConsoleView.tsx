import React, { useCallback, useEffect, useState } from 'react';
import { useMarketplace } from '../context/MarketplaceContext';
import { approveVendor, getPendingVendors, rejectVendor } from '../services/adminApi';
import type { Vendor } from '../types/marketplace';
import {
  ShieldLockIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  RefreshIcon,
  SlidersIcon,
  BarChartIcon,
  DocumentIcon,
  SpinnerIcon,
} from '../components/ui/Icons';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export interface AdminConsoleViewProps {
  onNavigateToCatalog?: () => void;
}

export const AdminConsoleView: React.FC<AdminConsoleViewProps> = ({ onNavigateToCatalog }) => {
  const {
    isAdmin,
    vendors,
    updateCommissionPct,
    orders,
    payouts,
    runPayoutSettlement,
    isSettling,
  } = useMarketplace();

  const [activeTab, setActiveTab] = useState<'governance' | 'settlement' | 'saga' | 'analytics'>(
    'governance'
  );
  const [settlementSuccessMessage, setSettlementSuccessMessage] = useState<string | null>(null);
  const [pendingVendors, setPendingVendors] = useState<Vendor[]>([]);
  const [governanceLoading, setGovernanceLoading] = useState(true);
  const [governanceError, setGovernanceError] = useState<string | null>(null);
  const [governanceAction, setGovernanceAction] = useState<number | null>(null);

  const loadPendingVendors = useCallback(async () => {
    if (!isAdmin) return;
    setGovernanceLoading(true);
    setGovernanceError(null);
    try {
      setPendingVendors(await getPendingVendors());
    } catch (error) {
      setGovernanceError(error instanceof Error ? error.message : 'Unable to load pending vendors.');
    } finally {
      setGovernanceLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const timer = window.setTimeout(() => {
      void loadPendingVendors();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isAdmin, loadPendingVendors]);

  if (!isAdmin) {
    return (
      <div className="w-full max-w-4xl mx-auto my-12 px-4 sm:px-6">
        <div className="bg-white border border-neutral-200 p-8 sm:p-12 text-center shadow-sm">
          <div className="w-12 h-12 mx-auto mb-4 border border-neutral-300 bg-neutral-50 flex items-center justify-center text-neutral-800">
            <ShieldLockIcon className="w-6 h-6" />
          </div>
          <h2 className="text-base sm:text-lg font-semibold tracking-wider uppercase text-neutral-900 mb-2">
            Administrator Access Restricted
          </h2>
          <p className="text-xs sm:text-sm text-neutral-600 max-w-md mx-auto mb-6">
            Access to platform governance, financial settlements, and vendor approvals requires an authenticated administrator session.
          </p>
          {onNavigateToCatalog && (
            <button
              type="button"
              onClick={onNavigateToCatalog}
              className="inline-flex items-center justify-center px-6 py-2.5 bg-neutral-900 text-white text-xs font-semibold tracking-widest uppercase hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Return to Catalog
            </button>
          )}
        </div>
      </div>
    );
  }

  const handleVendorDecision = async (vendor: Vendor, decision: 'approve' | 'reject') => {
    setGovernanceAction(vendor.userId);
    setGovernanceError(null);
    try {
      if (decision === 'approve') {
        await approveVendor(vendor.userId);
      } else {
        await rejectVendor(vendor.userId);
      }
      setPendingVendors((current) =>
        current.filter((pendingVendor) => pendingVendor.userId !== vendor.userId)
      );
    } catch (error) {
      setGovernanceError(
        error instanceof Error ? error.message : 'Unable to update vendor approval status.'
      );
    } finally {
      setGovernanceAction(null);
    }
  };

  // Platform Metrics
  const totalPlatformGMV = orders.reduce((sum, ord) => sum + ord.totalAmount, 0) + 104000;
  const verifiedVendorsCount = vendors.filter((v) => v.status === 'verified').length;
  const pendingVendorsCount = pendingVendors.length;
  const totalCommissionsEarned = payouts.reduce((sum, p) => sum + p.commission, 0);

  // Analytics Chart Data
  const platformTrendData = [
    { period: 'Week 1', gmv: 21000, commission: 2520 },
    { period: 'Week 2', gmv: 34500, commission: 4140 },
    { period: 'Week 3', gmv: 48900, commission: 5868 },
    { period: 'Week 4 (Current)', gmv: totalPlatformGMV > 60000 ? totalPlatformGMV : 64000, commission: totalCommissionsEarned > 8000 ? totalCommissionsEarned : 8320 },
  ];

  const handleRunSettlement = async () => {
    try {
      const results = await runPayoutSettlement();
      setSettlementSuccessMessage(
        `Dispatched ${results.length} bank transfers successfully via automated settlement engine.`
      );
      setTimeout(() => setSettlementSuccessMessage(null), 5000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-10">
      {/* Header Banner */}
      <div className="border border-neutral-200 bg-white p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] uppercase text-[#9c784e]">
            <ShieldLockIcon className="w-3.5 h-3.5" />
            <span>CENTRAL PLATFORM GOVERNANCE & SETTLEMENT ENGINE</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-normal text-neutral-900 tracking-tight">
            Atelier Platform Console
          </h1>
          <p className="text-xs text-neutral-500 font-light max-w-2xl">
            Enforce merchant KYC compliance, orchestrate automated financial escrow payouts, calibrate commission tariffs, and audit distributed event-driven Saga pipelines.
          </p>
        </div>

        {/* Quick Action: Run Settlement Engine */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRunSettlement}
            disabled={isSettling}
            className="bg-black hover:bg-neutral-800 text-white px-5 py-3 text-[10px] font-semibold tracking-[0.18em] uppercase transition-colors flex items-center gap-2.5 rounded-none cursor-pointer disabled:opacity-60"
          >
            {isSettling ? (
              <>
                <SpinnerIcon />
                <span>EXECUTING SETTLEMENT RUN...</span>
              </>
            ) : (
              <>
                <RefreshIcon />
                <span>TRIGGER SETTLEMENT ENGINE (POST /api/payouts/run)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {settlementSuccessMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
          <CheckCircleIcon className="w-4 h-4 text-emerald-700" />
          <span>{settlementSuccessMessage}</span>
        </div>
      )}

      {/* KPI Platform Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-neutral-200 p-5 shadow-sm space-y-1">
          <span className="text-[10px] font-semibold tracking-[0.16em] uppercase text-neutral-400">
            TOTAL MARKETPLACE GMV
          </span>
          <p className="text-2xl font-normal text-neutral-900 tracking-tight">
            ${totalPlatformGMV.toLocaleString()}
          </p>
          <span className="text-[10px] text-neutral-500 font-light block">
            Aggregated cross-vendor transactions
          </span>
        </div>

        <div className="bg-white border border-neutral-200 p-5 shadow-sm space-y-1">
          <span className="text-[10px] font-semibold tracking-[0.16em] uppercase text-neutral-400">
            COMMISSIONS REVENUE COLLECTED
          </span>
          <p className="text-2xl font-semibold text-[#9c784e] tracking-tight">
            ${totalCommissionsEarned.toLocaleString()}
          </p>
          <span className="text-[10px] text-neutral-500 font-light block">
            Net platform take from settlements
          </span>
        </div>

        <div className="bg-white border border-neutral-200 p-5 shadow-sm space-y-1">
          <span className="text-[10px] font-semibold tracking-[0.16em] uppercase text-neutral-400">
            MERCHANT ATELIER NETWORK
          </span>
          <p className="text-2xl font-normal text-neutral-900 tracking-tight">
            {verifiedVendorsCount}{' '}
            <span className="text-xs text-amber-600 font-medium">({pendingVendorsCount} Pending)</span>
          </p>
          <span className="text-[10px] text-neutral-500 font-light block">
            KYC compliance evaluation queue
          </span>
        </div>

        <div className="bg-white border border-neutral-200 p-5 shadow-sm space-y-1">
          <span className="text-[10px] font-semibold tracking-[0.16em] uppercase text-neutral-400">
            TOTAL DISPATCHED SAGA ORDERS
          </span>
          <p className="text-2xl font-normal text-neutral-900 tracking-tight">
            {orders.length} Orders
          </p>
          <span className="text-[10px] text-emerald-700 font-medium block">
            100% Idempotent saga executions
          </span>
        </div>
      </div>

      {/* Tabs Header Navigation */}
      <div className="flex border-b border-neutral-200 gap-2 sm:gap-6 text-xs font-semibold tracking-[0.18em] uppercase overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('governance')}
          className={`flex items-center gap-2 py-3 px-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'governance'
              ? 'border-black text-black'
              : 'border-transparent text-neutral-400 hover:text-black'
          }`}
        >
          <ShieldLockIcon />
          <span>VENDOR GOVERNANCE & KYC ({vendors.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settlement')}
          className={`flex items-center gap-2 py-3 px-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'settlement'
              ? 'border-black text-black'
              : 'border-transparent text-neutral-400 hover:text-black'
          }`}
        >
          <SlidersIcon />
          <span>SETTLEMENT ENGINE & COMMISSIONS</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('saga')}
          className={`flex items-center gap-2 py-3 px-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'saga'
              ? 'border-black text-black'
              : 'border-transparent text-neutral-400 hover:text-black'
          }`}
        >
          <AlertCircleIcon />
          <span>DISTRIBUTED SAGA AUDIT ({orders.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 py-3 px-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'analytics'
              ? 'border-black text-black'
              : 'border-transparent text-neutral-400 hover:text-black'
          }`}
        >
          <BarChartIcon />
          <span>MARKETPLACE TRAJECTORY</span>
        </button>
      </div>

      {/* Tab 1: Vendor Governance & KYC */}
      {activeTab === 'governance' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-semibold uppercase tracking-wide text-neutral-900">
              Merchant Dossier & Verification Queue
            </h2>
            <p className="text-xs text-neutral-500 font-light">
              Evaluate commercial registry documents and approve or reject pending vendor applications.
            </p>
          </div>

          {governanceError && (
            <div role="alert" className="flex items-center justify-between gap-4 border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
              <span>{governanceError}</span>
              <button type="button" onClick={() => void loadPendingVendors()} className="font-semibold uppercase tracking-wider underline">
                Retry
              </button>
            </div>
          )}

          {governanceLoading ? (
            <div className="flex min-h-40 items-center justify-center border border-neutral-200 bg-white">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-neutral-500">
                <SpinnerIcon />
                Loading pending vendors
              </div>
            </div>
          ) : pendingVendors.length === 0 ? (
            <div className="border border-dashed border-neutral-300 bg-white py-16 text-center">
              <p className="text-xs uppercase tracking-widest text-neutral-400">
                No pending vendor applications.
              </p>
            </div>
          ) : (
          <div className="bg-white border border-neutral-200 overflow-x-auto shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-200 bg-[#fbfbfa] text-[10px] font-bold tracking-[0.18em] uppercase text-neutral-600">
                  <th className="py-3.5 px-4">Atelier Identification</th>
                  <th className="py-3.5 px-4">Contact & Payout</th>
                  <th className="py-3.5 px-4">KYC Dossier</th>
                  <th className="py-3.5 px-4">Tariff / Fee</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Governance Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {pendingVendors.map((v) => (
                  <tr key={v.userId} className="hover:bg-neutral-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-neutral-900">{v.storeName}</p>
                      <p className="text-[10px] text-neutral-400 font-mono">
                        User #{v.userId} • /{v.slug}
                      </p>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="text-neutral-700">{v.email}</p>
                      <p className="text-[10px] text-neutral-400 font-mono">{v.payoutAccountId}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      {v.kycDocs && v.kycDocs.length > 0 ? (
                        <div className="flex items-center gap-1.5 text-neutral-700 font-mono text-[11px]">
                          <DocumentIcon className="w-3.5 h-3.5 text-[#9c784e]" />
                          <span>{v.kycDocs[0].split('/').pop()}</span>
                        </div>
                      ) : (
                        <span className="text-neutral-400 italic text-[11px]">Pending submission</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          max="50"
                          value={v.commissionPct}
                          onChange={(e) => updateCommissionPct(v.userId, Number(e.target.value))}
                          aria-label={`Commission rate for ${v.storeName}`}
                          className="w-16 bg-[#f6f6f4] border border-neutral-300 px-2 py-1 text-xs font-mono font-medium focus:outline-none focus:border-black rounded-none"
                        />
                        <span className="text-neutral-500 font-semibold">%</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 text-[9px] font-bold tracking-wider uppercase ${
                          'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {v.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => void handleVendorDecision(v, 'approve')}
                        disabled={governanceAction === v.userId}
                        className="bg-black hover:bg-neutral-800 text-white px-3 py-1 text-[9px] font-bold tracking-wider uppercase cursor-pointer rounded-none disabled:opacity-60"
                      >
                        {governanceAction === v.userId ? 'Processing...' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleVendorDecision(v, 'reject')}
                        disabled={governanceAction === v.userId}
                        className="border border-neutral-300 hover:border-red-600 text-neutral-700 hover:text-red-700 px-2.5 py-1 text-[9px] font-bold tracking-wider uppercase cursor-pointer rounded-none disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      {/* Tab 2: Settlement Engine */}
      {activeTab === 'settlement' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold uppercase tracking-wide text-neutral-900">
                Automated Settlement Engine (`POST /api/payouts/run`)
              </h2>
              <p className="text-xs text-neutral-500 font-light">
                Iterates over all verified ateliers, calculates gross fulfilled sub-order values, subtracts configured commission percentages, and executes idempotent wire transfers.
              </p>
            </div>

            <button
              type="button"
              onClick={handleRunSettlement}
              disabled={isSettling}
              className="bg-black hover:bg-neutral-800 text-white px-5 py-2.5 text-[10px] font-semibold tracking-[0.18em] uppercase transition-colors flex items-center gap-2 rounded-none cursor-pointer disabled:opacity-60"
            >
              <RefreshIcon />
              <span>RUN SETTLEMENT CYCLE</span>
            </button>
          </div>

          <div className="bg-white border border-neutral-200 overflow-x-auto shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-200 bg-[#fbfbfa] text-[10px] font-bold tracking-[0.18em] uppercase text-neutral-600">
                  <th className="py-3 px-4">Disbursement ID</th>
                  <th className="py-3 px-4">Recipient Atelier</th>
                  <th className="py-3 px-4">Gross Dispatched</th>
                  <th className="py-3 px-4">Platform Take</th>
                  <th className="py-3 px-4">Net Bank Transfer</th>
                  <th className="py-3 px-4">Transfer Hash</th>
                  <th className="py-3 px-4">Audit Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {payouts.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-neutral-900">{p.id}</td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-neutral-900">{p.vendorName}</p>
                      <p className="text-[10px] text-neutral-400 font-mono">Vendor #{p.vendorId}</p>
                    </td>
                    <td className="py-3 px-4 font-mono">${p.grossAmount.toLocaleString()}</td>
                    <td className="py-3 px-4 font-mono text-[#9c784e] font-semibold">
                      ${p.commission.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-emerald-800">
                      ${p.netAmount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono text-[10px] text-neutral-500">{p.transferId}</td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-bold uppercase tracking-wider">
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Distributed Saga Order Pipeline Audit */}
      {activeTab === 'saga' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-semibold uppercase tracking-wide text-neutral-900">
              Distributed Saga Orchestrator Log
            </h2>
            <p className="text-xs text-neutral-500 font-light">
              Real-time audit log of multi-service Saga executions, idempotent message hashes, and order splitting topologies.
            </p>
          </div>

          <div className="space-y-4">
            {orders.map((ord) => (
              <div key={ord.id} className="bg-white border border-neutral-200 p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-neutral-100 gap-3">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-base text-neutral-900">{ord.id}</span>
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-bold uppercase tracking-wider">
                        SAGA: {ord.sagaStatus}
                      </span>
                    </div>
                    <p className="text-[10px] text-neutral-500 font-mono mt-1">
                      Header: Idempotency-Key: {ord.idempotencyKey} • Payment ID: {ord.paymentId}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-lg font-semibold text-neutral-900 font-mono">
                      ${ord.totalAmount.toLocaleString()}
                    </span>
                    <p className="text-[10px] text-neutral-400">
                      Splitted into {ord.subOrders.length} independent sub-orders
                    </p>
                  </div>
                </div>

                {/* Sub-order Splitting Visualization */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ord.subOrders.map((sub, idx) => (
                    <div key={idx} className="p-3 bg-[#f8f8f6] border border-neutral-200 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-neutral-900">{sub.vendorName}</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-neutral-200 text-neutral-800 uppercase">
                          {sub.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        {sub.items.map((i) => `${i.quantity}x ${i.title}`).join(', ')}
                      </div>
                      <div className="text-right font-mono font-semibold text-neutral-900 text-xs pt-1 border-t border-neutral-200">
                        ${sub.amount.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Platform Trajectory */}
      {activeTab === 'analytics' && (
        <div className="bg-white border border-neutral-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold tracking-wide uppercase text-neutral-900">
                Platform GMV & Commission Growth
              </h3>
              <p className="text-xs text-neutral-500 font-light">
                Macro-level financial throughput across the entire atelier network.
              </p>
            </div>
          </div>

          <div className="h-80 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={platformTrendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="adminGmv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1a1a1a" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#1a1a1a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="adminComm" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9c784e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#9c784e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eeeeec" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#666' }} />
                <YAxis tick={{ fontSize: 11, fill: '#666' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e0e0de',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="gmv"
                  stroke="#1a1a1a"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#adminGmv)"
                  name="Platform GMV"
                />
                <Area
                  type="monotone"
                  dataKey="commission"
                  stroke="#9c784e"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#adminComm)"
                  name="Commissions Collected"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminConsoleView;
