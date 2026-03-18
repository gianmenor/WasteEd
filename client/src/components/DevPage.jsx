import React, { useState, useMemo, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { API_ENDPOINTS, API_BASE_URL } from '../config/api';

const DEV_PASSWORD = '123456';
const DEV_AUTH_KEY = 'devPageAuthorized';

export default function DevPage() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const [lastRequest, setLastRequest] = useState(null);
  const [clearDataText, setClearDataText] = useState('');
  const [form, setForm] = useState({ recyclable: 20, biodegradable: 4, nonBiodegradable: 8 });
  const [recyclableForm, setRecyclableForm] = useState({ recyclable: 20 });
  const [wetForm, setWetForm] = useState({ biodegradable: 15 });
  const [dryForm, setDryForm] = useState({ nonBiodegradable: 10 });
  const [binType, setBinType] = useState(1);

  const total = useMemo(() => (Number(form.recyclable)||0) + (Number(form.biodegradable)||0) + (Number(form.nonBiodegradable)||0), [form]);

  useEffect(() => {
    const authorized = sessionStorage.getItem(DEV_AUTH_KEY);
    if (authorized === 'true') {
      setIsAuthorized(true);
    }
  }, []);

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordInput === DEV_PASSWORD) {
      setIsAuthorized(true);
      sessionStorage.setItem(DEV_AUTH_KEY, 'true');
      setPasswordError('');
    } else {
      setPasswordError('Invalid password');
      setPasswordInput('');
    }
  };

  const handleLogout = () => {
    setIsAuthorized(false);
    sessionStorage.removeItem(DEV_AUTH_KEY);
    setPasswordInput('');
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-[calc(100vh-100px)] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl p-10 shadow-lg">
          <div className="text-5xl text-center mb-4">🔒</div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 text-center mb-2">Developer Access</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-8">Enter password to access developer tools</p>
          
          <form onSubmit={handlePasswordSubmit} className="m-0">
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1.5">Password</label>
              <input
                type="password"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-all duration-150 focus:outline-none focus:border-blue-600 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-600 dark:disabled:text-gray-400 disabled:cursor-not-allowed"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter password"
                autoFocus
              />
            </div>
            
            {passwordError && (
              <div className="px-4 py-3 mb-4 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md text-red-600 dark:text-red-400 text-sm">
                {passwordError}
              </div>
            )}
            
            <button type="submit" className="w-full px-4 py-2 text-sm font-medium rounded-md border border-transparent cursor-pointer transition-all duration-150 inline-flex items-center justify-center gap-1.5 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
              Access Developer Tools
            </button>
          </form>
        </div>
      </div>
    );
  }

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

  const clampNum = (val) => {
    const n = Number(val);
    if (Number.isNaN(n) || n < 0) return 0;
    return Math.floor(n);
  };

  const step = (key, delta) => setForm((f) => ({ ...f, [key]: clampNum((Number(f[key]) || 0) + delta) }));

  const presets = [
    { label: 'Low', values: { recyclable: 5, biodegradable: 2, nonBiodegradable: 1 } },
    { label: 'Medium', values: { recyclable: 20, biodegradable: 4, nonBiodegradable: 8 } },
    { label: 'High', values: { recyclable: 50, biodegradable: 10, nonBiodegradable: 15 } },
  ];

  const buildCurl = ({ url, method = 'GET', body }) => {
    const parts = [
      `curl -X ${method.toUpperCase()} "${url}"`,
      "-H 'Content-Type: application/json'",
    ];
    if (body) parts.push(`-d '${JSON.stringify(body)}'`);
    return parts.join(' ');
  };

  const callApi = async (config) => {
    setLoading(true);
    setResult(null);
    setError(null);
    setLastRequest(null);
    try {
      const res = await fetch(config.url, {
        method: config.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {})
        },
        body: config.body ? JSON.stringify(config.body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      setLastRequest({ url: config.url, method: config.method || 'GET', body: config.body || null, status: res.status });
      if (!res.ok) {
        showToast('Request failed', 'error');
        throw { status: res.status, statusText: res.statusText, data: json };
      }
      setResult(json);
      showToast('Request successful');
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 font-sans">
      {loading && <LoadingSpinner fullscreen message="Calling API..." />}

      <div className="pb-4 mb-6 border-b border-gray-300 dark:border-gray-700 flex flex-col sm:flex-row items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Developer Tools</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 m-0">Trigger common backend actions, seed data, and debug payloads.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700">Env: {import.meta.env.MODE}</span>
          <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700">API: {API_BASE_URL || 'relative'}</span>
          <button onClick={handleLogout} className="px-2.5 py-1 text-xs font-medium rounded-md bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 cursor-pointer transition-all duration-150 hover:bg-red-100 dark:hover:bg-red-900/50" title="Lock developer tools">
            🔒 Lock
          </button>
        </div>
      </div>

      {toast && (
        <div className={`mb-4 px-4 py-3 rounded-md text-sm font-medium animate-slideDown ${
          toast.type === 'success' 
            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-800'
            : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
        }`}>
          {toast.message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5 mb-6">
        <section className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-5 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 m-0">Bin: Mark Full</h2>
            <span className="text-[11px] px-2 py-0.5 rounded font-mono font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">POST /api/bin/full</span>
          </div>
          <div className="p-5">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-normal">
              Simulate the device notifying that a bin is full. This also broadcasts to connected clients.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1.5">Bin Type</label>
              <select
                value={binType}
                onChange={(e) => setBinType(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-all duration-150 focus:outline-none focus:border-blue-600 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-600 dark:disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                <option value={1}>1 - Recyclable Wastes</option>
                <option value={2}>2 - Wet Wastes</option>
                <option value={3}>3 - Dry Wastes</option>
              </select>
            </div>
            
            <button
              className="px-4 py-2 text-sm font-medium rounded-md border border-transparent cursor-pointer transition-all duration-150 inline-flex items-center gap-1.5 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
              onClick={() => callApi({ url: API_ENDPOINTS.BIN_FULL, method: 'POST', body: { bin: binType } })}
            >
              Trigger Bin Full
            </button>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-5 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 m-0">Waste: Delete Today</h2>
            <span className="text-[11px] px-2 py-0.5 rounded font-mono font-semibold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">POST /api/waste/delete-today</span>
          </div>
          <div className="p-5">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-normal">
              Removes today's waste records. Useful when a duplicate was added.
            </p>
            <button
              className="px-4 py-2 text-sm font-medium rounded-md border border-transparent cursor-pointer transition-all duration-150 inline-flex items-center gap-1.5 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
              onClick={() => {
                if (confirm('Delete today\'s records? This cannot be undone.')) {
                  callApi({ url: API_ENDPOINTS.WASTE_DELETE_TODAY, method: 'POST' });
                }
              }}
            >
              Delete Today's Records
            </button>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-5 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 m-0">Add Recyclable Wastes</h2>
            <span className="text-[11px] px-2 py-0.5 rounded font-mono font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">POST /api/waste/add</span>
          </div>
          <div className="p-5">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-normal">
              Add recyclable waste record. Triggers recyclable waste video notification.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1.5">Recyclable Wastes Count</label>
              <div className="flex items-center gap-2">
                <button 
                  type="button" 
                  className="w-8 h-8 p-0 text-base font-semibold flex items-center justify-center border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 cursor-pointer transition-all duration-150 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-600" 
                  onClick={() => setRecyclableForm(f => ({ recyclable: Math.max(0, (f.recyclable || 0) - 1) }))}
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  className="flex-1 text-center font-medium px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-all duration-150 focus:outline-none focus:border-blue-600 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-600 dark:disabled:text-gray-400 disabled:cursor-not-allowed"
                  value={recyclableForm.recyclable}
                  onChange={(e) => setRecyclableForm({ recyclable: clampNum(e.target.value) })}
                />
                <button 
                  type="button" 
                  className="w-8 h-8 p-0 text-base font-semibold flex items-center justify-center border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 cursor-pointer transition-all duration-150 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-600" 
                  onClick={() => setRecyclableForm(f => ({ recyclable: (f.recyclable || 0) + 1 }))}
                >
                  +
                </button>
              </div>
            </div>
            
            <button
              className="px-4 py-2 text-sm font-medium rounded-md border border-transparent cursor-pointer transition-all duration-150 inline-flex items-center gap-1.5 bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
              onClick={() => callApi({ 
                url: API_ENDPOINTS.WASTE_ADD, 
                method: 'POST', 
                body: { recyclable: recyclableForm.recyclable, biodegradable: 0, nonBiodegradable: 0 }
              })}
            >
              ♻️ Add Recyclable Waste
            </button>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-5 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 m-0">Add Wet Wastes</h2>
            <span className="text-[11px] px-2 py-0.5 rounded font-mono font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">POST /api/waste/add</span>
          </div>
          <div className="p-5">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-normal">
              Add wet/biodegradable waste record. Triggers wet waste video notification.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1.5">Wet Wastes Count</label>
              <div className="flex items-center gap-2">
                <button 
                  type="button" 
                  className="w-8 h-8 p-0 text-base font-semibold flex items-center justify-center border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 cursor-pointer transition-all duration-150 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-600" 
                  onClick={() => setWetForm(f => ({ biodegradable: Math.max(0, (f.biodegradable || 0) - 1) }))}
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  className="flex-1 text-center font-medium px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-all duration-150 focus:outline-none focus:border-blue-600 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-600 dark:disabled:text-gray-400 disabled:cursor-not-allowed"
                  value={wetForm.biodegradable}
                  onChange={(e) => setWetForm({ biodegradable: clampNum(e.target.value) })}
                />
                <button 
                  type="button" 
                  className="w-8 h-8 p-0 text-base font-semibold flex items-center justify-center border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 cursor-pointer transition-all duration-150 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-600" 
                  onClick={() => setWetForm(f => ({ biodegradable: (f.biodegradable || 0) + 1 }))}
                >
                  +
                </button>
              </div>
            </div>
            
            <button
              className="px-4 py-2 text-sm font-medium rounded-md border border-transparent cursor-pointer transition-all duration-150 inline-flex items-center gap-1.5 bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
              onClick={() => callApi({ 
                url: API_ENDPOINTS.WASTE_ADD, 
                method: 'POST', 
                body: { recyclable: 0, biodegradable: wetForm.biodegradable, nonBiodegradable: 0 }
              })}
            >
              🍎 Add Wet Waste
            </button>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-5 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 m-0">Add Dry Wastes</h2>
            <span className="text-[11px] px-2 py-0.5 rounded font-mono font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">POST /api/waste/add</span>
          </div>
          <div className="p-5">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-normal">
              Add dry/non-biodegradable waste record. Triggers dry waste video notification.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1.5">Dry Wastes Count</label>
              <div className="flex items-center gap-2">
                <button 
                  type="button" 
                  className="w-8 h-8 p-0 text-base font-semibold flex items-center justify-center border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 cursor-pointer transition-all duration-150 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-600" 
                  onClick={() => setDryForm(f => ({ nonBiodegradable: Math.max(0, (f.nonBiodegradable || 0) - 1) }))}
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  className="flex-1 text-center font-medium px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-all duration-150 focus:outline-none focus:border-blue-600 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-600 dark:disabled:text-gray-400 disabled:cursor-not-allowed"
                  value={dryForm.nonBiodegradable}
                  onChange={(e) => setDryForm({ nonBiodegradable: clampNum(e.target.value) })}
                />
                <button 
                  type="button" 
                  className="w-8 h-8 p-0 text-base font-semibold flex items-center justify-center border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 cursor-pointer transition-all duration-150 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-600" 
                  onClick={() => setDryForm(f => ({ nonBiodegradable: (f.nonBiodegradable || 0) + 1 }))}
                >
                  +
                </button>
              </div>
            </div>
            
            <button
              className="px-4 py-2 text-sm font-medium rounded-md border border-transparent cursor-pointer transition-all duration-150 inline-flex items-center gap-1.5 bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
              onClick={() => callApi({ 
                url: API_ENDPOINTS.WASTE_ADD, 
                method: 'POST', 
                body: { recyclable: 0, biodegradable: 0, nonBiodegradable: dryForm.nonBiodegradable }
              })}
            >
              🗑️ Add Dry Waste
            </button>
          </div>
        </section>

        <section className="col-span-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-5 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 m-0">Add Mixed Waste Record</h2>
            <span className="text-[11px] px-2 py-0.5 rounded font-mono font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">POST /api/waste/add</span>
          </div>
          <div className="p-5">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-normal">
              Add a mixed waste record with all types. Video notification shows the predominant waste type.
            </p>

            <div className="flex flex-wrap gap-2 mb-4">
              {presets.map((p) => (
                <button 
                  key={p.label} 
                  className="px-4 py-2 text-sm font-medium rounded-md border cursor-pointer transition-all duration-150 inline-flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => setForm(p.values)}
                >
                  {p.label}
                </button>
              ))}
              <button 
                className="px-4 py-2 text-sm font-medium rounded-md border cursor-pointer transition-all duration-150 inline-flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed" 
                onClick={() => setForm({ recyclable: 0, biodegradable: 0, nonBiodegradable: 0 })}
              >
                Reset
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(['recyclable','biodegradable','nonBiodegradable']).map((key) => {
                const labels = {
                  recyclable: 'Recyclable Wastes',
                  biodegradable: 'Wet Wastes',
                  nonBiodegradable: 'Dry Wastes'
                };
                return (
                  <div key={key} className="mb-4">
                    <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1.5">
                      {labels[key]}
                    </label>
                    <div className="flex items-center gap-2">
                      <button 
                        type="button" 
                        className="w-8 h-8 p-0 text-base font-semibold flex items-center justify-center border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 cursor-pointer transition-all duration-150 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-600" 
                        onClick={() => step(key, -1)}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={0}
                        className="flex-1 text-center font-medium px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-all duration-150 focus:outline-none focus:border-blue-600 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-600 dark:disabled:text-gray-400 disabled:cursor-not-allowed"
                        value={form[key]}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: clampNum(e.target.value) }))}
                      />
                      <button 
                        type="button" 
                        className="w-8 h-8 p-0 text-base font-semibold flex items-center justify-center border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 cursor-pointer transition-all duration-150 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-600" 
                        onClick={() => step(key, 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-300 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total: <span className="font-bold text-gray-900 dark:text-gray-100 text-base">{total}</span>
              </div>
              <button
                className="px-4 py-2 text-sm font-medium rounded-md border border-transparent cursor-pointer transition-all duration-150 inline-flex items-center gap-1.5 bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
                onClick={() => callApi({ url: API_ENDPOINTS.WASTE_ADD, method: 'POST', body: form })}
              >
                Add Record
              </button>
            </div>
          </div>
        </section>

        <section className="col-span-full bg-white dark:bg-gray-900 border border-red-200 dark:border-red-800 rounded-lg overflow-hidden">
          <div className="px-5 py-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 flex items-center justify-between">
            <h2 className="text-base font-semibold text-red-700 dark:text-red-300 m-0">Developer: Clear Waste & Coupon Data</h2>
            <span className="text-[11px] px-2 py-0.5 rounded font-mono font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">POST /api/accounts/dev/clear-data</span>
          </div>
          <div className="p-5">
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 leading-normal">
              This will remove all waste records, remove all coupon transactions, and reset coupon balances.
            </p>
            <p className="text-xs text-red-700 dark:text-red-300 mb-3">
              Type <span className="font-mono font-semibold">CLEAR ALL DATA</span> to enable this action.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <input
                type="text"
                value={clearDataText}
                onChange={(e) => setClearDataText(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-red-200 dark:border-red-800 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100 dark:focus:ring-red-900/30"
                placeholder="Type CLEAR ALL DATA"
              />
              <button
                className="px-4 py-2 text-sm font-medium rounded-md border border-transparent cursor-pointer transition-all duration-150 inline-flex items-center justify-center gap-1.5 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading || clearDataText !== 'CLEAR ALL DATA'}
                onClick={() => {
                  if (confirm('This will permanently clear waste and coupon data. Continue?')) {
                    callApi({
                      url: API_ENDPOINTS.DEV_CLEAR_DATA,
                      method: 'POST',
                      body: { confirmationText: clearDataText }
                    });
                  }
                }}
              >
                Clear Data
              </button>
            </div>
          </div>
        </section>
      </div>

      {(result || error || lastRequest) && (
        <section className="mt-6 col-span-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-5 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 m-0">Request & Response</h2>
            {lastRequest?.status != null && (
              <span className={`text-[11px] px-2 py-0.5 rounded font-semibold ${lastRequest.status >= 400 ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'}`}>
                Status: {lastRequest.status}
              </span>
            )}
          </div>
          <div className="p-5">
            {lastRequest && (
              <div className="mb-4">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Request</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 font-mono">
                  {lastRequest.method} {lastRequest.url}
                </div>
                {lastRequest.body && (
                  <pre className="bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-3 overflow-auto font-mono text-xs leading-normal text-gray-900 dark:text-gray-100 max-h-96">{JSON.stringify(lastRequest.body, null, 2)}</pre>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    className="px-4 py-2 text-sm font-medium rounded-md border cursor-pointer transition-all duration-150 inline-flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => navigator.clipboard.writeText(buildCurl(lastRequest))}
                  >
                    📋 Copy cURL
                  </button>
                </div>
              </div>
            )}

            {result && (
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Response</div>
                <pre className="bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-3 overflow-auto font-mono text-xs leading-normal text-gray-900 dark:text-gray-100 max-h-96">{JSON.stringify(result, null, 2)}</pre>
              </div>
            )}
            
            {error && (
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Error</div>
                <pre className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-md p-3 overflow-auto font-mono text-xs leading-normal max-h-96">{JSON.stringify(error, null, 2)}</pre>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
