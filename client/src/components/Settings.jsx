import { useSettings } from './Dashboard';
import './Settings.css';

const Settings = () => {
  const { settings, updateSettings } = useSettings();

  const fontSizeOptions = [
    { value: 'small', label: 'Small (14px)' },
    { value: 'medium', label: 'Medium (16px)' },
    { value: 'large', label: 'Large (18px)' },
    { value: 'extra-large', label: 'Extra Large (20px)' }
  ];

  const uiScaleOptions = [
    { value: 'compact', label: 'Compact (90%)' },
    { value: 'normal', label: 'Normal (100%)' },
    { value: 'large', label: 'Large (110%)' },
    { value: 'extra-large', label: 'Extra Large (120%)' }
  ];

  const handleSettingChange = (key, value) => {
    updateSettings({ [key]: value });
  };

  const resetSettings = () => {
    updateSettings({
      darkMode: false,
      fontSize: 'medium',
      uiScale: 'normal',
      notifications: true,
      soundEffects: true,
      compactMode: false,
      showTooltips: true,
      autoSave: true
    });
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1 className="settings-title">Settings</h1>
        <p className="settings-subtitle">Customize your WastEd experience</p>
      </div>

      <div className="settings-grid">
        {/* Appearance Settings */}
        <div className="settings-section">
          <h2 className="section-title">
            <span className="section-icon">🎨</span>
            Appearance
          </h2>
          
          <div className="setting-item">
            <div className="setting-info">
              <label className="setting-label">Dark Mode</label>
              <p className="setting-description">Switch between light and dark themes</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.darkMode}
                onChange={(e) => handleSettingChange('darkMode', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <label className="setting-label">Font Size</label>
              <p className="setting-description">Adjust text size for better readability</p>
            </div>
            <select
              className="setting-select"
              value={settings.fontSize}
              onChange={(e) => handleSettingChange('fontSize', e.target.value)}
            >
              {fontSizeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <label className="setting-label">UI Scale</label>
              <p className="setting-description">Scale the entire interface</p>
            </div>
            <select
              className="setting-select"
              value={settings.uiScale}
              onChange={(e) => handleSettingChange('uiScale', e.target.value)}
            >
              {uiScaleOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <label className="setting-label">Compact Mode</label>
              <p className="setting-description">Reduce spacing for more content</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.compactMode}
                onChange={(e) => handleSettingChange('compactMode', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        {/* Notifications Settings */}
        <div className="settings-section">
          <h2 className="section-title">
            <span className="section-icon">🔔</span>
            Notifications
          </h2>

          <div className="setting-item">
            <div className="setting-info">
              <label className="setting-label">Enable Notifications</label>
              <p className="setting-description">Receive alerts and updates</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.notifications}
                onChange={(e) => handleSettingChange('notifications', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <label className="setting-label">Sound Effects</label>
              <p className="setting-description">Play sounds for actions and alerts</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.soundEffects}
                onChange={(e) => handleSettingChange('soundEffects', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        {/* Behavior Settings */}
        <div className="settings-section">
          <h2 className="section-title">
            <span className="section-icon">⚙️</span>
            Behavior
          </h2>

          <div className="setting-item">
            <div className="setting-info">
              <label className="setting-label">Show Tooltips</label>
              <p className="setting-description">Display helpful tips when hovering</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.showTooltips}
                onChange={(e) => handleSettingChange('showTooltips', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <label className="setting-label">Auto Save</label>
              <p className="setting-description">Automatically save changes</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.autoSave}
                onChange={(e) => handleSettingChange('autoSave', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        {/* Preview Section */}
        <div className="settings-section preview-section">
          <h2 className="section-title">
            <span className="section-icon">👁️</span>
            Preview
          </h2>
          
          <div className="preview-container">
            <div className="preview-card">
              <h3 className="preview-title">Sample Card</h3>
              <p className="preview-text">
                This is how your content will look with the current settings.
              </p>
              <button className="preview-button">Sample Button</button>
            </div>
          </div>

          <div className="settings-actions">
            <button className="reset-button" onClick={resetSettings}>
              🔄 Reset to Defaults
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;