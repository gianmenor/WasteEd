import React, { useState, useMemo } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { API_ENDPOINTS, API_BASE_URL } from '../config/api';

export default function DevPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const [lastRequest, setLastRequest] = useState(null); // { url, method, body, status }
  const [form, setForm] = useState({ recyclable: 20, biodegradable: 4, nonBiodegradable: 8 });

  const total = useMemo(() => (Number(form.recyclable)||0) + (Number(form.biodegradable)||0) + (Number(form.nonBiodegradable)||0), [form]);

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
        headers: { 'Content-Type': 'application/json' },
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
    <div className="p-6 max-w-6xl mx-auto">
      {loading && <LoadingSpinner fullscreen message="Calling API..." />}

      {/* Top header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Developer Tools</h1>
          <p className="text-sm text-gray-600">Trigger common backend actions, seed data, and debug payloads.</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-1 rounded bg-gray-100">Env: {import.meta.env.MODE}</span>
          <span className="px-2 py-1 rounded bg-gray-100">API: {API_BASE_URL || 'relative'}</span>
        </div>
      </div>

      {toast && (
        <div className={`mb-4 rounded px-3 py-2 text-sm ${toast.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {toast.message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bin Full */}
        <section className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Bin: Mark Full</h2>
            <span className="text-[11px] rounded bg-blue-50 text-blue-700 px-2 py-0.5">POST /api/bin/full</span>
          </div>
          <p className="text-xs text-gray-600 mb-3">Simulate the device notifying that a bin is full. This also broadcasts to connected clients.</p>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={loading}
            onClick={() => callApi({ url: API_ENDPOINTS.BIN_FULL, method: 'POST' })}
          >
            Trigger Bin Full
          </button>
        </section>

        {/* Delete Today */}
        <section className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Waste: Delete Today</h2>
            <span className="text-[11px] rounded bg-red-50 text-red-700 px-2 py-0.5">POST /api/waste/delete-today</span>
          </div>
          <p className="text-xs text-gray-600 mb-3">Removes todays waste records. Useful when a duplicate was added.</p>
          <button
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            disabled={loading}
            onClick={() => {
              if (confirm('Delete today\'s records? This cannot be undone.')) {
                callApi({ url: API_ENDPOINTS.WASTE_DELETE_TODAY, method: 'POST' });
              }
            }}
          >
            Delete Todays Records
          </button>
        </section>

        {/* Add Daily Record */}
        <section className="md:col-span-2 border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Waste: Add Daily Record</h2>
            <span className="text-[11px] rounded bg-green-50 text-green-700 px-2 py-0.5">POST /api/waste/add</span>
          </div>
          <p className="text-xs text-gray-600 mb-4">Creates a record for today. If a record already exists, the API returns a 409 with the existing entry.</p>

          {/* Presets */}
          <div className="flex flex-wrap gap-2 mb-3">
            {presets.map((p) => (
              <button key={p.label} className="px-2 py-1 text-xs rounded border hover:bg-gray-50"
                onClick={() => setForm(p.values)}>
                {p.label}
              </button>
            ))}
            <button className="px-2 py-1 text-xs rounded border hover:bg-gray-50" onClick={() => setForm({ recyclable: 0, biodegradable: 0, nonBiodegradable: 0 })}>Reset</button>
          </div>

          {/* Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(['recyclable','biodegradable','nonBiodegradable']).map((key) => (
              <div key={key}>
                <label className="block text-xs text-gray-600 mb-1 capitalize">{key.replace('nonBiodegradable','non-biodegradable')}</label>
                <div className="flex items-center gap-2">
                  <button type="button" className="px-2 py-1 rounded border hover:bg-gray-50" onClick={() => step(key, -1)}>-</button>
                  <input
                    type="number"
                    min={0}
                    className="border rounded p-2 w-full"
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: clampNum(e.target.value) }))}
                  />
                  <button type="button" className="px-2 py-1 rounded border hover:bg-gray-50" onClick={() => step(key, 1)}>+</button>
                </div>
              </div>
            ))}
          </div>

          {/* Summary and submit */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-700">Total: <span className="font-semibold">{total}</span></div>
            <div className="flex items-center gap-2">
              <button
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                disabled={loading}
                onClick={() => callApi({ url: API_ENDPOINTS.WASTE_ADD, method: 'POST', body: form })}
              >
                Add Record
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Request/Response */}
      {(result || error || lastRequest) && (
        <section className="border rounded-lg p-4 mt-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Request & Response</h2>
            {lastRequest?.status != null && (
              <span className={`text-[11px] px-2 py-0.5 rounded ${lastRequest.status >= 400 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                Status: {lastRequest.status}
              </span>
            )}
          </div>

          {/* Request details */}
          {lastRequest && (
            <div className="mb-3">
              <div className="text-xs text-gray-600 mb-1">{lastRequest.method} {lastRequest.url}</div>
              {lastRequest.body && (
                <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto">{JSON.stringify(lastRequest.body, null, 2)}</pre>
              )}
              <div className="mt-2 flex gap-2">
                <button
                  className="px-2 py-1 text-xs rounded border hover:bg-gray-50"
                  onClick={() => navigator.clipboard.writeText(buildCurl(lastRequest))}
                >Copy cURL</button>
              </div>
            </div>
          )}

          {/* Response */}
          {result && (
            <div className="mb-2">
              <div className="text-xs text-gray-600 mb-1">Response</div>
              <pre className="text-sm bg-gray-50 p-3 rounded overflow-auto">{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
          {error && (
            <div className="mb-2">
              <div className="text-xs text-gray-600 mb-1">Error</div>
              <pre className="text-sm bg-red-50 p-3 rounded overflow-auto text-red-800">{JSON.stringify(error, null, 2)}</pre>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
