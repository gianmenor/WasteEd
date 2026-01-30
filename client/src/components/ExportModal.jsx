import React, { useState } from 'react';
import './ExportModal.css';

const ExportModal = ({ isOpen, onClose, onExport, title = "Export Data" }) => {
  const [exportFormat, setExportFormat] = useState('excel');
  const [includeTypes, setIncludeTypes] = useState({
    recyclable: true,
    wet: true,
    dry: true
  });
  const [dateRange, setDateRange] = useState('all');

  if (!isOpen) return null;

  const handleExport = () => {
    onExport({
      format: exportFormat,
      includeTypes,
      dateRange
    });
    onClose();
  };

  return (
    <div className="export-modal-overlay" onClick={onClose}>
      <div className="export-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="export-modal-header">
          <h2 className="export-modal-title">{title}</h2>
          <button className="export-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="export-modal-body">
          {/* Export Format Selection */}
          <div className="export-form-group">
            <label className="export-form-label">Export Format</label>
            <select
              className="export-select"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
            >
              <option value="excel">📊 Excel (XLSX) - Separate sheets per waste type</option>
              <option value="pdf">📄 PDF - Formatted report with charts</option>
            </select>
          </div>

          {/* Waste Types Selection */}
          <div className="export-form-group">
            <label className="export-form-label">Include Waste Types</label>
            <div className="export-checkbox-group">
              <label className="export-checkbox-label">
                <input
                  type="checkbox"
                  checked={includeTypes.recyclable}
                  onChange={(e) => setIncludeTypes(prev => ({ ...prev, recyclable: e.target.checked }))}
                />
                <span>♻️ Recyclable Wastes</span>
              </label>
              
              <label className="export-checkbox-label">
                <input
                  type="checkbox"
                  checked={includeTypes.wet}
                  onChange={(e) => setIncludeTypes(prev => ({ ...prev, wet: e.target.checked }))}
                />
                <span>🍃 Wet Wastes</span>
              </label>
              
              <label className="export-checkbox-label">
                <input
                  type="checkbox"
                  checked={includeTypes.dry}
                  onChange={(e) => setIncludeTypes(prev => ({ ...prev, dry: e.target.checked }))}
                />
                <span>🗑️ Dry Wastes</span>
              </label>
            </div>
          </div>

          {/* Date Range Selection */}
          <div className="export-form-group">
            <label className="export-form-label">Date Range</label>
            <select
              className="export-select"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
            </select>
          </div>
        </div>

        <div className="export-modal-footer">
          <button className="export-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="export-btn-primary" 
            onClick={handleExport}
            disabled={!includeTypes.recyclable && !includeTypes.wet && !includeTypes.dry}
          >
            Export Data
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
