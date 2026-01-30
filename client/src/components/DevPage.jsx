import React, { useState, useMemo, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { API_ENDPOINTS, API_BASE_URL } from '../config/api';
import './DevPage.css';

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
      <div className="dev-password-gate">
        <div className="dev-password-card">
          <div className="dev-password-icon">🔒</div>
          <h1 className="dev-password-title">Developer Access</h1>
          <p className="dev-password-subtitle">Enter password to access developer tools</p>
          
          <form onSubmit={handlePasswordSubmit} className="dev-password-form">
            <div className="dev-form-group">
              <label className="dev-form-label">Password</label>
              <input
                type="password"
                className="dev-input"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter password"
                autoFocus
              />
            </div>
            
            {passwordError && (
              <div className="dev-password-error">
                {passwordError}
              </div>
            )}
            
            <button type="submit" className="dev-btn dev-btn-primary" style={{ width: '100%' }}>
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
    <div className="dev-page">
      {loading && <LoadingSpinner fullscreen message="Calling API..." />}

      <div className="dev-header">
        <div className="dev-header-content">
          <h1>Developer Tools</h1>
          <p>Trigger common backend actions, seed data, and debug payloads.</p>
        </div>
        <div className="dev-header-actions">
          <span className="dev-badge">Env: {import.meta.env.MODE}</span>
          <span className="dev-badge">API: {API_BASE_URL || 'relative'}</span>
          <button onClick={handleLogout} className="dev-lock-btn" title="Lock developer tools">
            🔒 Lock
          </button>
        </div>
      </div>

      {toast && (
        <div className={`dev-toast ${toast.type}`}>
          {toast.message}
        </div>
      )}

      <div className="dev-grid">
        <section className="dev-section">
          <div className="dev-section-header">
            <h2 className="dev-section-title">Bin: Mark Full</h2>
            <span className="dev-endpoint-badge post">POST /api/bin/full</span>
          </div>
          <div className="dev-section-body">
            <p className="dev-section-description">
              Simulate the device notifying that a bin is full. This also broadcasts to connected clients.
            </p>
            
            <div className="dev-form-group">
              <label className="dev-form-label">Bin Type</label>
              <select
                value={binType}
                onChange={(e) => setBinType(Number(e.target.value))}
                className="dev-select"
              >
                <option value={1}>1 - Recyclable Wastes</option>
                <option value={2}>2 - Wet Wastes</option>
                <option value={3}>3 - Dry Wastes</option>
              </select>
            </div>
            
            <button
              className="dev-btn dev-btn-primary"
              disabled={loading}
              onClick={() => callApi({ url: API_ENDPOINTS.BIN_FULL, method: 'POST', body: { bin: binType } })}
            >
              Trigger Bin Full
            </button>
          </div>
        </section>

        <section className="dev-section">
          <div className="dev-section-header">
            <h2 className="dev-section-title">Waste: Delete Today</h2>
            <span className="dev-endpoint-badge delete">POST /api/waste/delete-today</span>
          </div>
          <div className="dev-section-body">
            <p className="dev-section-description">
              Removes today's waste records. Useful when a duplicate was added.
            </p>
            <button
              className="dev-btn dev-btn-danger"
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

        <section className="dev-section">
          <div className="dev-section-header">
            <h2 className="dev-section-title">Add Recyclable Wastes</h2>
            <span className="dev-endpoint-badge post">POST /api/waste/add</span>
          </div>
          <div className="dev-section-body">
            <p className="dev-section-description">
              Add recyclable waste record. Triggers recyclable waste video notification.
            </p>
            
            <div className="dev-form-group">
              <label className="dev-form-label">Recyclable Wastes Count</label>
              <div className="dev-input-wrapper">
                <button 
                  type="button" 
                  className="dev-step-btn" 
                  onClick={() => setRecyclableForm(f => ({ recyclable: Math.max(0, (f.recyclable || 0) - 1) }))}
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  className="dev-input"
                  value={recyclableForm.recyclable}
                  onChange={(e) => setRecyclableForm({ recyclable: clampNum(e.target.value) })}
                />
                <button 
                  type="button" 
                  className="dev-step-btn" 
                  onClick={() => setRecyclableForm(f => ({ recyclable: (f.recyclable || 0) + 1 }))}
                >
                  +
                </button>
              </div>
            </div>
            
            <button
              className="dev-btn dev-btn-success"
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

        <section className="dev-section">
          <div className="dev-section-header">
            <h2 className="dev-section-title">Add Wet Wastes</h2>
            <span className="dev-endpoint-badge post">POST /api/waste/add</span>
          </div>
          <div className="dev-section-body">
            <p className="dev-section-description">
              Add wet/biodegradable waste record. Triggers wet waste video notification.
            </p>
            
            <div className="dev-form-group">
              <label className="dev-form-label">Wet Wastes Count</label>
              <div className="dev-input-wrapper">
                <button 
                  type="button" 
                  className="dev-step-btn" 
                  onClick={() => setWetForm(f => ({ biodegradable: Math.max(0, (f.biodegradable || 0) - 1) }))}
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  className="dev-input"
                  value={wetForm.biodegradable}
                  onChange={(e) => setWetForm({ biodegradable: clampNum(e.target.value) })}
                />
                <button 
                  type="button" 
                  className="dev-step-btn" 
                  onClick={() => setWetForm(f => ({ biodegradable: (f.biodegradable || 0) + 1 }))}
                >
                  +
                </button>
              </div>
            </div>
            
            <button
              className="dev-btn dev-btn-success"
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

        <section className="dev-section">
          <div className="dev-section-header">
            <h2 className="dev-section-title">Add Dry Wastes</h2>
            <span className="dev-endpoint-badge post">POST /api/waste/add</span>
          </div>
          <div className="dev-section-body">
            <p className="dev-section-description">
              Add dry/non-biodegradable waste record. Triggers dry waste video notification.
            </p>
            
            <div className="dev-form-group">
              <label className="dev-form-label">Dry Wastes Count</label>
              <div className="dev-input-wrapper">
                <button 
                  type="button" 
                  className="dev-step-btn" 
                  onClick={() => setDryForm(f => ({ nonBiodegradable: Math.max(0, (f.nonBiodegradable || 0) - 1) }))}
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  className="dev-input"
                  value={dryForm.nonBiodegradable}
                  onChange={(e) => setDryForm({ nonBiodegradable: clampNum(e.target.value) })}
                />
                <button 
                  type="button" 
                  className="dev-step-btn" 
                  onClick={() => setDryForm(f => ({ nonBiodegradable: (f.nonBiodegradable || 0) + 1 }))}
                >
                  +
                </button>
              </div>
            </div>
            
            <button
              className="dev-btn dev-btn-success"
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

        <section className="dev-section full-width">
          <div className="dev-section-header">
            <h2 className="dev-section-title">Add Mixed Waste Record</h2>
            <span className="dev-endpoint-badge post">POST /api/waste/add</span>
          </div>
          <div className="dev-section-body">
            <p className="dev-section-description">
              Add a mixed waste record with all types. Video notification shows the predominant waste type.
            </p>

            <div className="dev-presets">
              {presets.map((p) => (
                <button 
                  key={p.label} 
                  className="dev-btn dev-btn-secondary"
                  onClick={() => setForm(p.values)}
                >
                  {p.label}
                </button>
              ))}
              <button 
                className="dev-btn dev-btn-secondary" 
                onClick={() => setForm({ recyclable: 0, biodegradable: 0, nonBiodegradable: 0 })}
              >
                Reset
              </button>
            </div>

            <div className="dev-input-grid">
              {(['recyclable','biodegradable','nonBiodegradable']).map((key) => {
                const labels = {
                  recyclable: 'Recyclable Wastes',
                  biodegradable: 'Wet Wastes',
                  nonBiodegradable: 'Dry Wastes'
                };
                return (
                  <div key={key} className="dev-form-group">
                    <label className="dev-form-label">
                      {labels[key]}
                    </label>
                    <div className="dev-input-wrapper">
                      <button 
                        type="button" 
                        className="dev-step-btn" 
                        onClick={() => step(key, -1)}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={0}
                        className="dev-input"
                        value={form[key]}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: clampNum(e.target.value) }))}
                      />
                      <button 
                        type="button" 
                        className="dev-step-btn" 
                        onClick={() => step(key, 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="dev-summary-row">
              <div className="dev-total">
                Total: <span className="dev-total-value">{total}</span>
              </div>
              <button
                className="dev-btn dev-btn-success"
                disabled={loading}
                onClick={() => callApi({ url: API_ENDPOINTS.WASTE_ADD, method: 'POST', body: form })}
              >
                Add Record
              </button>
            </div>
          </div>
        </section>
      </div>

      {(result || error || lastRequest) && (
        <section className="dev-section response full-width">
          <div className="dev-section-header">
            <h2 className="dev-section-title">Request & Response</h2>
            {lastRequest?.status != null && (
              <span className={`dev-status-badge ${lastRequest.status >= 400 ? 'error' : 'success'}`}>
                Status: {lastRequest.status}
              </span>
            )}
          </div>
          <div className="dev-section-body">
            {lastRequest && (
              <div className="dev-request-details">
                <div className="dev-response-label">Request</div>
                <div className="dev-request-method">
                  {lastRequest.method} {lastRequest.url}
                </div>
                {lastRequest.body && (
                  <pre className="dev-code-block">{JSON.stringify(lastRequest.body, null, 2)}</pre>
                )}
                <div className="dev-code-actions">
                  <button
                    className="dev-btn dev-btn-secondary"
                    onClick={() => navigator.clipboard.writeText(buildCurl(lastRequest))}
                  >
                    📋 Copy cURL
                  </button>
                </div>
              </div>
            )}

            {result && (
              <div>
                <div className="dev-response-label">Response</div>
                <pre className="dev-code-block">{JSON.stringify(result, null, 2)}</pre>
              </div>
            )}
            
            {error && (
              <div>
                <div className="dev-response-label">Error</div>
                <pre className="dev-code-block error">{JSON.stringify(error, null, 2)}</pre>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
