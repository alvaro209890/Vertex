import React, { useState, useEffect, useCallback, useMemo } from 'react';
import MetricCard from '../components/MetricCard';
import { LineChart, BarList, DailyBars, TokenMix } from '../components/ChartComponents';
import UserDetailModal from './UserDetailModal';
import CreditModal from './CreditModal';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://vertex-api.cursar.space';
const COST_MARKUP = 1.4;
const DEFAULT_USD_TO_BRL = 5;

function number(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatTokens(v) {
  if (!v) return '0';
  return number(v).toLocaleString('pt-BR');
}

function formatInteger(v) {
  return number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

function formatUSD(value) {
  return `$${number(value).toFixed(6)}`;
}

function formatBRL(value) {
  return `R$ ${number(value).toFixed(4)}`;
}

function formatBRL2(value) {
  return `R$ ${number(value).toFixed(2)}`;
}

function formatSignedBRL(value) {
  const amount = number(value);
  return `${amount < 0 ? '-' : ''}R$ ${Math.abs(amount).toFixed(2)}`;
}

function formatPercent(value) {
  return `${number(value).toFixed(1)}%`;
}

function formatDate(iso) {
  if (!iso) return '-';
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('pt-BR') : '-';
}

function getUserLabel(user) {
  return user.email || user.profile?.email || user.uid?.slice(0, 12) || 'Sem email';
}

function getUserTotals(user) {
  return user.summary?.totals || {};
}

function getLastUsed(user) {
  const recent = user.summary?.analytics?.recent?.[0]?.timestamp;
  if (recent) return recent;

  const models = user.usage?.models || {};
  return Object.values(models)
    .map((model) => model.lastUsed)
    .filter(Boolean)
    .sort()
    .reverse()[0] || null;
}

function buildUserUsageRows(users) {
  return (users || [])
    .map((u) => {
      const totals = getUserTotals(u);
      const input = number(totals.inputTokens);
      const cacheHit = number(totals.cacheReadInputTokens);
      const cacheEligible = input + cacheHit;
      return {
        key: u.uid,
        email: getUserLabel(u),
        tokens: number(totals.tokens),
        costUsd: number(totals.costUsd),
        costBrl: number(totals.costBrl),
        requests: number(totals.requests),
        cacheHitRate: cacheEligible > 0 ? (cacheHit / cacheEligible) * 100 : 0,
        balance: u.credits?.balance,
        totalRecharge: number(u.credits?.totalRecharge),
        blocked: Boolean(u.blocked),
        lastUsed: getLastUsed(u),
      };
    })
    .sort((a, b) => b.tokens - a.tokens || b.costBrl - a.costBrl);
}

function buildDailyActiveUsers(users) {
  const buckets = new Map();
  for (const user of users || []) {
    for (const point of user.summary?.analytics?.daily || []) {
      const existing = buckets.get(point.bucket) || {
        bucket: point.bucket,
        label: point.label,
        activeUsers: 0,
        tokens: 0,
      };
      existing.tokens += number(point.tokens);
      if (number(point.tokens) > 0) existing.activeUsers += 1;
      buckets.set(point.bucket, existing);
    }
  }

  return Array.from(buckets.values()).sort((a, b) => a.bucket.localeCompare(b.bucket));
}

function aggregateGlobalAnalytics(users) {
  if (!users || users.length === 0) return null;

  const allHourly = {};
  const allDaily = {};
  let allRows = [];
  const allTokenTypes = {};
  let totalTokens = 0;
  let totalCostUsd = 0;
  let totalCostBrl = 0;
  let totalRequests = 0;

  for (const u of users) {
    const s = u.summary;
    if (!s) continue;
    totalTokens += number(s.totals?.tokens);
    totalCostUsd += number(s.totals?.costUsd);
    totalCostBrl += number(s.totals?.costBrl);
    totalRequests += number(s.totals?.requests);

    for (const h of (s.analytics?.hourly || [])) {
      if (!allHourly[h.bucket]) allHourly[h.bucket] = { ...h };
      else {
        allHourly[h.bucket].tokens += number(h.tokens);
        allHourly[h.bucket].costBrl += number(h.costBrl);
        allHourly[h.bucket].costUsd += number(h.costUsd);
        allHourly[h.bucket].requests += number(h.requests);
      }
    }
    for (const d of (s.analytics?.daily || [])) {
      if (!allDaily[d.bucket]) allDaily[d.bucket] = { ...d };
      else {
        allDaily[d.bucket].tokens += number(d.tokens);
        allDaily[d.bucket].costBrl += number(d.costBrl);
        allDaily[d.bucket].costUsd += number(d.costUsd);
        allDaily[d.bucket].requests += number(d.requests);
      }
    }
    allRows = allRows.concat(s.rows || []);
    for (const t of (s.analytics?.tokenTypes || [])) {
      allTokenTypes[t.key] = (allTokenTypes[t.key] || 0) + number(t.value);
    }
  }

  const modelMap = {};
  const mergedRows = [];
  for (const r of allRows) {
    if (modelMap[r.model]) {
      const existing = modelMap[r.model];
      existing.tokens += number(r.tokens);
      existing.costUsd = number(existing.costUsd) + number(r.costUsd);
      existing.costBrl = number(existing.costBrl) + number(r.costBrl);
      existing.inputTokens = number(existing.inputTokens) + number(r.inputTokens);
      existing.outputTokens = number(existing.outputTokens) + number(r.outputTokens);
      existing.cacheReadInputTokens = number(existing.cacheReadInputTokens) + number(r.cacheReadInputTokens);
      existing.legacyTokens = number(existing.legacyTokens) + number(r.legacyTokens);
    } else {
      modelMap[r.model] = { ...r };
      mergedRows.push(modelMap[r.model]);
    }
  }

  const labelMap = {
    inputTokens: 'Entrada',
    outputTokens: 'Saida',
    cacheReadInputTokens: 'Cache hit',
    cacheCreationInputTokens: 'Cache miss',
    legacyTokens: 'Legado',
  };

  return {
    hourly: Object.values(allHourly).sort((a, b) => a.bucket.localeCompare(b.bucket)),
    daily: Object.values(allDaily).sort((a, b) => a.bucket.localeCompare(b.bucket)),
    rows: mergedRows.sort((a, b) => number(b.tokens) - number(a.tokens)),
    tokenTypes: Object.entries(allTokenTypes).map(([key, value]) => ({
      key,
      value,
      label: labelMap[key] || key,
    })),
    totals: { tokens: totalTokens, costUsd: totalCostUsd, costBrl: totalCostBrl, requests: totalRequests },
  };
}

function buildFinanceAnalytics(users, userUsageRows, globalAnalytics, globalMetrics, systemConfig) {
  const usdToBrl =
    number(globalAnalytics?.totals?.costUsd) > 0
      ? number(globalAnalytics?.totals?.costBrl) / number(globalAnalytics?.totals?.costUsd)
      : DEFAULT_USD_TO_BRL;
  const totalRechargeBrl = userUsageRows.reduce((acc, row) => acc + number(row.totalRecharge), 0);
  const tariffedUsageBrl = userUsageRows.reduce((acc, row) => acc + number(row.costBrl), 0);
  const tariffedUsageUsd = userUsageRows.reduce((acc, row) => acc + number(row.costUsd), 0);
  const unlimitedUsageBrl = userUsageRows
    .filter((row) => row.balance === -1)
    .reduce((acc, row) => acc + number(row.costBrl), 0);
  const billableUsageBrl = Math.max(0, tariffedUsageBrl - unlimitedUsageBrl);
  const providerCostBrl = tariffedUsageBrl / COST_MARKUP;
  const providerCostUsd = tariffedUsageUsd / COST_MARKUP;
  const grossProfitBrl = billableUsageBrl - providerCostBrl;
  const cashProfitBrl = totalRechargeBrl - providerCostBrl;
  const grossMarginPct = billableUsageBrl > 0 ? (grossProfitBrl / billableUsageBrl) * 100 : 0;
  const cashMarginPct = totalRechargeBrl > 0 ? (cashProfitBrl / totalRechargeBrl) * 100 : 0;
  const customerBalanceBrl = userUsageRows.reduce(
    (acc, row) => acc + (number(row.balance) > 0 ? number(row.balance) : 0),
    0
  );
  const paidUsers = userUsageRows.filter((row) => number(row.totalRecharge) > 0).length;
  const usersWithPaidUsage = userUsageRows.filter(
    (row) => number(row.costBrl) > 0 && row.balance !== -1
  ).length;
  const zeroBalanceUsers = userUsageRows.filter((row) => row.balance === 0).length;
  const lowBalanceUsers = userUsageRows.filter(
    (row) => number(row.balance) > 0 && number(row.balance) < 5
  ).length;
  const apiBalanceUsd = number(systemConfig?.apiBalanceUsd);
  const apiBalanceBrl = apiBalanceUsd * usdToBrl;

  const rechargeByBucket = {};
  for (const point of globalMetrics?.rechargePoints || []) {
    rechargeByBucket[point.bucket] = number(point.amount);
  }

  const dailyMap = new Map();
  for (const point of globalAnalytics?.daily || []) {
    const tariffedBrl = number(point.costBrl);
    dailyMap.set(point.bucket, {
      bucket: point.bucket,
      label: point.label,
      tariffedUsageBrl: tariffedBrl,
      providerCostBrl: tariffedBrl / COST_MARKUP,
      grossProfitBrl: tariffedBrl - tariffedBrl / COST_MARKUP,
      rechargeBrl: 0,
      cashFlowBrl: 0,
    });
  }
  for (const [bucket, amount] of Object.entries(rechargeByBucket)) {
    const existing = dailyMap.get(bucket) || {
      bucket,
      label: bucket.split('-').slice(1).reverse().join('/'),
      tariffedUsageBrl: 0,
      providerCostBrl: 0,
      grossProfitBrl: 0,
      rechargeBrl: 0,
      cashFlowBrl: 0,
    };
    existing.rechargeBrl = amount;
    dailyMap.set(bucket, existing);
  }

  const daily = Array.from(dailyMap.values())
    .map((point) => ({
      ...point,
      cashFlowBrl: number(point.rechargeBrl) - number(point.providerCostBrl),
    }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket));

  const lastSevenDays = daily.slice(-7);
  const last7ProviderCostBrl = lastSevenDays.reduce((acc, point) => acc + number(point.providerCostBrl), 0);
  const avgDailyProviderCostBrl = lastSevenDays.length > 0
    ? last7ProviderCostBrl / Math.min(7, lastSevenDays.length)
    : 0;
  const runwayDays = avgDailyProviderCostBrl > 0 ? apiBalanceBrl / avgDailyProviderCostBrl : null;

  const financeRows = userUsageRows.map((row) => {
    const isUnlimited = row.balance === -1;
    const providerCost = number(row.costBrl) / COST_MARKUP;
    const recognizedRevenue = isUnlimited ? 0 : number(row.costBrl);
    const profit = recognizedRevenue - providerCost;
    return {
      ...row,
      isUnlimited,
      providerCostBrl: providerCost,
      recognizedRevenueBrl: recognizedRevenue,
      profitBrl: profit,
      marginPct: recognizedRevenue > 0 ? (profit / recognizedRevenue) * 100 : 0,
    };
  });

  return {
    usdToBrl,
    totalRechargeBrl,
    tariffedUsageBrl,
    billableUsageBrl,
    unlimitedUsageBrl,
    providerCostBrl,
    providerCostUsd,
    grossProfitBrl,
    cashProfitBrl,
    grossMarginPct,
    cashMarginPct,
    customerBalanceBrl,
    paidUsers,
    usersWithPaidUsage,
    zeroBalanceUsers,
    lowBalanceUsers,
    avgTicketBrl: paidUsers > 0 ? totalRechargeBrl / paidUsers : 0,
    arpuBrl: users.length > 0 ? totalRechargeBrl / users.length : 0,
    apiBalanceUsd,
    apiBalanceBrl,
    avgDailyProviderCostBrl,
    runwayDays,
    daily,
    financeRows,
    topRevenueUsers: financeRows
      .filter((row) => row.recognizedRevenueBrl > 0)
      .sort((a, b) => b.recognizedRevenueBrl - a.recognizedRevenueBrl)
      .slice(0, 8),
    topProfitUsers: financeRows
      .filter((row) => row.profitBrl > 0)
      .sort((a, b) => b.profitBrl - a.profitBrl)
      .slice(0, 8),
    topProviderCostUsers: financeRows
      .filter((row) => row.providerCostBrl > 0)
      .sort((a, b) => b.providerCostBrl - a.providerCostBrl)
      .slice(0, 8),
  };
}

export default function DashboardPage({ token, user, onLogout, onUnauthorized }) {
  const [users, setUsers] = useState([]);
  const [globalMetrics, setGlobalMetrics] = useState(null);
  const [systemConfig, setSystemConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');
  const [selectedUid, setSelectedUid] = useState(null);
  const [creditUid, setCreditUid] = useState(null);
  const [balanceInput, setBalanceInput] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const fetchData = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [usersRes, metricsRes, configRes] = await Promise.all([
        fetch(`${API_BASE}/admin/users`, { headers }),
        fetch(`${API_BASE}/admin/metrics`, { headers }),
        fetch(`${API_BASE}/admin/config`, { headers }),
      ]);
      if ([usersRes, metricsRes, configRes].some((res) => res.status === 401)) {
        onUnauthorized?.();
        return;
      }
      if (!usersRes.ok) throw new Error('Erro ao carregar usuarios');
      if (!metricsRes.ok) throw new Error('Erro ao carregar metricas');
      if (!configRes.ok) throw new Error('Erro ao carregar config');

      const usersData = await usersRes.json();
      const metricsData = await metricsRes.json();
      const configData = await configRes.json();

      setUsers(usersData.users || []);
      setGlobalMetrics(metricsData);
      setSystemConfig(configData);
      setActionMsg((current) => (current.startsWith('Erro:') ? '' : current));
    } catch (err) {
      console.error(err);
      setActionMsg(`Erro: ${err.message || 'Nao foi possivel carregar o painel'}`);
    } finally {
      setLoading(false);
    }
  }, [token, onUnauthorized]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  async function updateSystemBalance(newBalance) {
    try {
      const res = await fetch(`${API_BASE}/admin/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ apiBalanceUsd: newBalance }),
      });
      if (res.status === 401) {
        onUnauthorized?.();
        return;
      }
      if (!res.ok) throw new Error('Erro ao atualizar saldo');
      setActionMsg('Saldo da API atualizado com sucesso');
      await fetchData();
    } catch (err) {
      setActionMsg(`Erro: ${err.message}`);
    }
  }

  const globalAnalytics = useMemo(() => aggregateGlobalAnalytics(users), [users]);
  const userUsageRows = useMemo(() => buildUserUsageRows(users), [users]);
  const dailyActiveUsers = useMemo(() => buildDailyActiveUsers(users), [users]);
  const financeAnalytics = useMemo(
    () => buildFinanceAnalytics(users, userUsageRows, globalAnalytics, globalMetrics, systemConfig),
    [users, userUsageRows, globalAnalytics, globalMetrics, systemConfig]
  );
  const selectedUser = useMemo(
    () => users.find((u) => u.uid === selectedUid) || null,
    [selectedUid, users]
  );
  const creditUser = useMemo(
    () => users.find((u) => u.uid === creditUid) || null,
    [creditUid, users]
  );

  async function toggleBlock(uid, currentlyBlocked) {
    setActionMsg('');
    try {
      const res = await fetch(`${API_BASE}/admin/users/${uid}/toggle-block`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ blocked: !currentlyBlocked }),
      });
      if (res.status === 401) {
        onUnauthorized?.();
        return;
      }
      let data = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      if (!res.ok) throw new Error(data.error);
      setActionMsg(`Usuario ${currentlyBlocked ? 'desbloqueado' : 'bloqueado'} com sucesso`);
      await fetchData();
    } catch (err) {
      setActionMsg(`Erro: ${err.message}`);
    }
  }

  const totalUsers = users.length;
  const activeUsers = users.filter(u => !u.blocked).length;
  const blockedUsers = users.filter(u => u.blocked).length;
  const totalTokens = userUsageRows.reduce((acc, u) => acc + number(u.tokens), 0);
  const totalCostBrl = userUsageRows.reduce((acc, u) => acc + number(u.costBrl), 0);
  const totalRechargeBrl = userUsageRows.reduce((acc, u) => acc + number(u.totalRecharge), 0);
  const totalRequests = userUsageRows.reduce((acc, u) => acc + number(u.requests), 0);
  const usersWithUsage = userUsageRows.filter((u) => u.tokens > 0).length;

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="admin-header-brand">
          <img src="/vertex_logo.png" alt="Vertex Logo" className="admin-header-logo" />
          <h1>Vertex <span>Admin</span></h1>
        </div>
        <div className="header-right">
          <span className="user-badge">{user}</span>
          <button type="button" className="logout-btn" onClick={onLogout}>Sair</button>
        </div>
      </header>

      {actionMsg && (
        <div className="action-bar">
          {actionMsg}
          <button type="button" className="action-close" onClick={() => setActionMsg('')}>×</button>
        </div>
      )}

      <div className="container">
        <div className="system-config-panel card" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px' }}>
          <div>
            <h2 style={{ fontSize: '18px', marginBottom: '4px' }}>Saldo Atual na API (DeepSeek)</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: '13px' }}>
              Este valor é reduzido automaticamente a cada uso dos usuários.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="api-balance-display" style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: (systemConfig?.apiBalanceUsd < 5) ? 'var(--red)' : 'var(--green)' }}>
                {formatUSD(systemConfig?.apiBalanceUsd)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Atualizado em: {formatDate(systemConfig?.updatedAt)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="number"
                step="0.01"
                placeholder="Novo Saldo USD"
                value={balanceInput}
                onChange={(e) => setBalanceInput(e.target.value)}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'white',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  width: '120px'
                }}
              />
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (balanceInput) {
                    updateSystemBalance(Number(balanceInput));
                    setBalanceInput('');
                  }
                }}
                style={{ padding: '8px 16px' }}
              >
                Atualizar
              </button>
            </div>
          </div>
        </div>

        {loading && <div className="loading">Carregando...</div>}

        {!loading && (
          <>
            <div className="admin-tabs" role="tablist" aria-label="Navegacao do painel admin">
              <button
                type="button"
                className={`admin-tab ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                Visao geral
              </button>
              <button
                type="button"
                className={`admin-tab ${activeTab === 'finance' ? 'active' : ''}`}
                onClick={() => setActiveTab('finance')}
              >
                Financeiro
              </button>
            </div>

            {activeTab === 'overview' && (
              <>
            {/* Metricas */}
            <div className="metrics-row">
              <MetricCard label="Total de Usuarios" value={totalUsers} />
              <MetricCard label="Ativos" value={activeUsers} tone="active" />
              <MetricCard label="Bloqueados" value={blockedUsers} tone="blocked" />
              <MetricCard label="Tokens Totais" value={formatTokens(totalTokens)} />
              <MetricCard label="Chamadas" value={formatInteger(totalRequests)} />
              <MetricCard label="Usuarios com uso" value={formatInteger(usersWithUsage)} tone="active" />
              <MetricCard label="Saldo API (USD)" value={formatUSD(systemConfig?.apiBalanceUsd)} tone={(systemConfig?.apiBalanceUsd < 5) ? 'blocked' : 'active'} />
              <MetricCard label="Total Recarregado" value={formatBRL(totalRechargeBrl)} tone="active" />
              <MetricCard label="Custo Total BRL" value={formatBRL(totalCostBrl)} tone="cost" />
            </div>

            {/* Graficos globais */}
            {globalAnalytics && (
              <div className="global-charts-section">
                <h2 className="section-title">Visao Global</h2>
                <div className="charts-grid">
                  <div className="chart-panel wide">
                    <div className="panel-header">
                      <span>Consumo por hora (todos usuarios)</span>
                    </div>
                    {globalAnalytics.totals.tokens > 0 ? (
                      <LineChart points={globalAnalytics.hourly} ariaLabel="Tokens por hora em todos os usuarios" />
                    ) : (
                      <div className="empty-chart">Aguardando dados de uso...</div>
                    )}
                  </div>
                  <div className="chart-panel wide">
                    <div className="panel-header">
                      <span>Recargas Diarias (BRL)</span>
                    </div>
                    {globalMetrics?.rechargePoints?.length > 0 ? (
                      <LineChart
                        points={globalMetrics.rechargePoints}
                        valueKey="amount"
                        format={formatBRL}
                        ariaLabel="Recargas diarias em reais"
                        stroke="#ba68c8"
                      />
                    ) : (
                      <div className="empty-chart">Sem recargas registradas...</div>
                    )}
                  </div>
                  <div className="chart-panel">
                    <div className="panel-header">
                      <span>Recargas por usuario</span>
                    </div>
                    <BarList
                      rows={userUsageRows.filter(u => u.totalRecharge > 0).sort((a, b) => b.totalRecharge - a.totalRecharge).slice(0, 8)}
                      valueKey="totalRecharge"
                      labelKey="email"
                      format={formatBRL}
                    />
                  </div>
                  <div className="chart-panel">
                    <div className="panel-header">
                      <span>Tipos de token</span>
                    </div>
                    <TokenMix items={globalAnalytics.tokenTypes} total={globalAnalytics.totals.tokens} />
                  </div>
                  <div className="chart-panel">
                    <div className="panel-header">
                      <span>Modelos</span>
                    </div>
                    <BarList rows={globalAnalytics.rows} />
                  </div>
                  <div className="chart-panel wide">
                    <div className="panel-header">
                      <span>Consumo diario</span>
                    </div>
                    <DailyBars points={globalAnalytics.daily} />
                  </div>
                  <div className="chart-panel">
                    <div className="panel-header">
                      <span>Usuarios ativos por dia</span>
                    </div>
                    <DailyBars points={dailyActiveUsers} valueKey="activeUsers" format={formatInteger} />
                  </div>
                  <div className="chart-panel">
                    <div className="panel-header">
                      <span>Custo por hora</span>
                    </div>
                    <LineChart
                      points={globalAnalytics.hourly}
                      valueKey="costBrl"
                      format={formatBRL}
                      ariaLabel="Custo por hora em reais"
                      stroke="#4fc3f7"
                    />
                  </div>
                  <div className="chart-panel">
                    <div className="panel-header">
                      <span>Top usuarios por tokens</span>
                    </div>
                    <BarList rows={userUsageRows.slice(0, 8)} labelKey="email" />
                  </div>
                  <div className="chart-panel">
                    <div className="panel-header">
                      <span>Custo por usuario</span>
                    </div>
                    <BarList
                      rows={userUsageRows.slice(0, 8)}
                      valueKey="costBrl"
                      labelKey="email"
                      format={formatBRL}
                    />
                  </div>
                  <div className="chart-panel">
                    <div className="panel-header">
                      <span>Chamadas por usuario</span>
                    </div>
                    <BarList
                      rows={userUsageRows.slice(0, 8)}
                      valueKey="requests"
                      labelKey="email"
                      format={formatInteger}
                    />
                  </div>
                  <div className="chart-panel">
                    <div className="panel-header">
                      <span>Cache hit por usuario</span>
                    </div>
                    <BarList
                      rows={userUsageRows.filter((row) => row.cacheHitRate > 0).slice(0, 8)}
                      valueKey="cacheHitRate"
                      labelKey="email"
                      format={formatPercent}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tabela de usuarios */}
            <div className="card">
              <h2>Usuarios</h2>
              {users.length === 0 ? (
                <p className="empty-state">Nenhum usuario cadastrado.</p>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>UID</th>
                        <th>Cadastro</th>
                        <th>Ultimo Uso</th>
                        <th>Tokens</th>
                        <th>Recarregado</th>
                        <th>Saldo</th>
                        <th>Status</th>
                        <th>Acao</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => {
                        const totals = u.summary?.totals || {};
                        const lastUsed = getLastUsed(u);
                        const totalRecharge = number(u.credits?.totalRecharge);
                        return (
                          <tr key={u.uid} onClick={() => setSelectedUid(u.uid)} style={{ cursor: 'pointer' }}>
                            <td className="email-cell">{u.email || '-'}</td>
                            <td className="uid-cell" title={u.uid}>{u.uid.slice(0, 12)}...</td>
                            <td>{formatDate(u.profile?.createdAt)}</td>
                            <td>{formatDate(lastUsed)}</td>
                            <td className="tokens-cell">{formatTokens(totals.tokens)}</td>
                            <td className="recharge-cell" style={{ color: '#69f0ae', fontWeight: 'bold' }}>
                              {totalRecharge > 0 ? formatBRL(totalRecharge) : '-'}
                            </td>
                            <td className="credits-cell">
                              {u.credits?.balance === -1 ? (
                                <span className="badge-unlimited">Ilimitado</span>
                              ) : u.credits?.balance === 0 ? (
                                <span className="badge-zero">R$ 0,00</span>
                              ) : (
                                <span className="badge-credits">{formatBRL(u.credits?.balance)}</span>
                              )}
                            </td>
                            <td>
                              <span className={`status-badge ${u.blocked ? 'blocked' : 'active'}`}>
                                {u.blocked ? 'Bloqueado' : 'Ativo'}
                              </span>
                            </td>
                            <td>
                              <div className="action-buttons" style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  className="action-btn btn-credit"
                                  onClick={(e) => { e.stopPropagation(); setCreditUid(u.uid); }}
                                  title="Gerenciar creditos"
                                  type="button"
                                >
                                  Recarregar
                                </button>
                                <button
                                  className={`action-btn ${u.blocked ? 'btn-unblock' : 'btn-block'}`}
                                  onClick={(e) => { e.stopPropagation(); toggleBlock(u.uid, u.blocked); }}
                                  type="button"
                                >
                                  {u.blocked ? 'Desbloquear' : 'Bloquear'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
              </>
            )}

            {activeTab === 'finance' && (
              <div className="finance-tab">
                <div className="metrics-row finance-metrics">
                  <MetricCard
                    label="Receita recebida"
                    value={formatBRL2(financeAnalytics.totalRechargeBrl)}
                    detail={`${financeAnalytics.paidUsers} usuarios pagantes`}
                    tone="active"
                  />
                  <MetricCard
                    label="Uso tarifado"
                    value={formatBRL2(financeAnalytics.tariffedUsageBrl)}
                    detail={`Uso cobrado: ${formatBRL2(financeAnalytics.billableUsageBrl)}`}
                    tone="cost"
                  />
                  <MetricCard
                    label="Custo real"
                    value={formatBRL2(financeAnalytics.providerCostBrl)}
                    detail={formatUSD(financeAnalytics.providerCostUsd)}
                  />
                  <MetricCard
                    label="Lucro sobre uso"
                    value={formatSignedBRL(financeAnalytics.grossProfitBrl)}
                    detail={`Margem ${formatPercent(financeAnalytics.grossMarginPct)}`}
                    tone={financeAnalytics.grossProfitBrl >= 0 ? 'active' : 'blocked'}
                  />
                  <MetricCard
                    label="Lucro de caixa"
                    value={formatSignedBRL(financeAnalytics.cashProfitBrl)}
                    detail={`Margem ${formatPercent(financeAnalytics.cashMarginPct)}`}
                    tone={financeAnalytics.cashProfitBrl >= 0 ? 'active' : 'blocked'}
                  />
                  <MetricCard
                    label="Saldo clientes"
                    value={formatBRL2(financeAnalytics.customerBalanceBrl)}
                    detail={`${financeAnalytics.lowBalanceUsers} com saldo baixo`}
                  />
                  <MetricCard
                    label="Saldo API"
                    value={formatUSD(financeAnalytics.apiBalanceUsd)}
                    detail={formatBRL2(financeAnalytics.apiBalanceBrl)}
                    tone={financeAnalytics.apiBalanceUsd < 5 ? 'blocked' : 'active'}
                  />
                  <MetricCard
                    label="Runway"
                    value={financeAnalytics.runwayDays === null ? '-' : `${Math.floor(financeAnalytics.runwayDays)} dias`}
                    detail={`Media diaria ${formatBRL2(financeAnalytics.avgDailyProviderCostBrl)}`}
                    tone={financeAnalytics.runwayDays !== null && financeAnalytics.runwayDays < 7 ? 'blocked' : 'active'}
                  />
                  <MetricCard
                    label="Ticket medio"
                    value={formatBRL2(financeAnalytics.avgTicketBrl)}
                    detail={`ARPU ${formatBRL2(financeAnalytics.arpuBrl)}`}
                  />
                  <MetricCard
                    label="Uso ilimitado"
                    value={formatBRL2(financeAnalytics.unlimitedUsageBrl)}
                    detail="Valor tarifado sem receita direta"
                    tone={financeAnalytics.unlimitedUsageBrl > 0 ? 'blocked' : ''}
                  />
                </div>

                <div className="finance-health-grid">
                  <div className="finance-health-card">
                    <span>Markup aplicado</span>
                    <strong>{formatPercent((COST_MARKUP - 1) * 100)}</strong>
                  </div>
                  <div className="finance-health-card">
                    <span>Cambio usado</span>
                    <strong>{formatBRL2(financeAnalytics.usdToBrl)}</strong>
                  </div>
                  <div className="finance-health-card">
                    <span>Usuarios com uso pago</span>
                    <strong>{formatInteger(financeAnalytics.usersWithPaidUsage)}</strong>
                  </div>
                  <div className="finance-health-card">
                    <span>Usuarios zerados</span>
                    <strong>{formatInteger(financeAnalytics.zeroBalanceUsers)}</strong>
                  </div>
                </div>

                <div className="charts-grid">
                  <div className="chart-panel wide">
                    <div className="panel-header">
                      <span>Recargas diarias</span>
                    </div>
                    <LineChart
                      points={financeAnalytics.daily}
                      valueKey="rechargeBrl"
                      format={formatBRL2}
                      ariaLabel="Recargas diarias em reais"
                      stroke="#00e676"
                    />
                  </div>
                  <div className="chart-panel wide">
                    <div className="panel-header">
                      <span>Lucro bruto diario</span>
                    </div>
                    <LineChart
                      points={financeAnalytics.daily}
                      valueKey="grossProfitBrl"
                      format={formatBRL2}
                      ariaLabel="Lucro bruto diario em reais"
                      stroke="#4fc3f7"
                    />
                  </div>
                  <div className="chart-panel">
                    <div className="panel-header">
                      <span>Custo real diario</span>
                    </div>
                    <DailyBars
                      points={financeAnalytics.daily}
                      valueKey="providerCostBrl"
                      format={formatBRL2}
                    />
                  </div>
                  <div className="chart-panel">
                    <div className="panel-header">
                      <span>Uso tarifado diario</span>
                    </div>
                    <DailyBars
                      points={financeAnalytics.daily}
                      valueKey="tariffedUsageBrl"
                      format={formatBRL2}
                    />
                  </div>
                  <div className="chart-panel">
                    <div className="panel-header">
                      <span>Receita por usuario</span>
                    </div>
                    <BarList
                      rows={financeAnalytics.topRevenueUsers}
                      valueKey="recognizedRevenueBrl"
                      labelKey="email"
                      format={formatBRL2}
                    />
                  </div>
                  <div className="chart-panel">
                    <div className="panel-header">
                      <span>Lucro por usuario</span>
                    </div>
                    <BarList
                      rows={financeAnalytics.topProfitUsers}
                      valueKey="profitBrl"
                      labelKey="email"
                      format={formatBRL2}
                    />
                  </div>
                  <div className="chart-panel">
                    <div className="panel-header">
                      <span>Custo real por usuario</span>
                    </div>
                    <BarList
                      rows={financeAnalytics.topProviderCostUsers}
                      valueKey="providerCostBrl"
                      labelKey="email"
                      format={formatBRL2}
                    />
                  </div>
                  <div className="chart-panel">
                    <div className="panel-header">
                      <span>Saldos em aberto</span>
                    </div>
                    <BarList
                      rows={financeAnalytics.financeRows
                        .filter((row) => number(row.balance) > 0)
                        .sort((a, b) => number(b.balance) - number(a.balance))
                        .slice(0, 8)}
                      valueKey="balance"
                      labelKey="email"
                      format={formatBRL2}
                    />
                  </div>
                </div>

                <div className="card">
                  <h2>Financeiro por usuario</h2>
                  {financeAnalytics.financeRows.length === 0 ? (
                    <p className="empty-state">Nenhum dado financeiro registrado.</p>
                  ) : (
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>Email</th>
                            <th>Recebido</th>
                            <th>Uso tarifado</th>
                            <th>Custo real</th>
                            <th>Lucro</th>
                            <th>Margem</th>
                            <th>Saldo</th>
                            <th>Ultimo uso</th>
                          </tr>
                        </thead>
                        <tbody>
                          {financeAnalytics.financeRows
                            .slice()
                            .sort((a, b) => b.recognizedRevenueBrl - a.recognizedRevenueBrl)
                            .map((row) => (
                              <tr key={row.key} onClick={() => setSelectedUid(row.key)} style={{ cursor: 'pointer' }}>
                                <td className="email-cell">{row.email}</td>
                                <td className="tokens-cell">{formatBRL2(row.totalRecharge)}</td>
                                <td className="tokens-cell">
                                  {row.isUnlimited ? 'Ilimitado' : formatBRL2(row.recognizedRevenueBrl)}
                                </td>
                                <td className="tokens-cell">{formatBRL2(row.providerCostBrl)}</td>
                                <td className={`tokens-cell ${row.profitBrl < 0 ? 'finance-negative' : 'finance-positive'}`}>
                                  {formatSignedBRL(row.profitBrl)}
                                </td>
                                <td>{row.isUnlimited ? '-' : formatPercent(row.marginPct)}</td>
                                <td>
                                  {row.balance === -1 ? (
                                    <span className="badge-unlimited">Ilimitado</span>
                                  ) : row.balance === 0 ? (
                                    <span className="badge-zero">R$ 0,00</span>
                                  ) : (
                                    <span className="badge-credits">{formatBRL2(row.balance)}</span>
                                  )}
                                </td>
                                <td>{formatDate(row.lastUsed)}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          onClose={() => setSelectedUid(null)}
        />
      )}

      {creditUser && (
        <CreditModal
          user={creditUser}
          token={token}
          onClose={() => setCreditUid(null)}
          onUpdate={fetchData}
          onUnauthorized={onUnauthorized}
        />
      )}
    </div>
  );
}
