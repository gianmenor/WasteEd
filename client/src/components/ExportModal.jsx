import React, { useState } from 'react';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TextField } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import RecyclingOutlinedIcon from '@mui/icons-material/RecyclingOutlined';
import SpaOutlinedIcon from '@mui/icons-material/SpaOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';

const ExportModal = ({ isOpen, onClose, onExport, title = "Export Data", showWasteTypes = true, showDateRange = true }) => {
  const [exportFormat, setExportFormat] = useState('excel');
  const [includeTypes, setIncludeTypes] = useState({
    recyclable: true,
    wet: true,
    dry: true
  });
  const [dateRange, setDateRange] = useState('all');
  const [customDateFrom, setCustomDateFrom] = useState(null);
  const [customDateTo, setCustomDateTo] = useState(null);

  if (!isOpen) return null;

  const handleExport = () => {
    onExport({
      format: exportFormat,
      includeTypes,
      dateRange,
      customDateFrom: customDateFrom ? customDateFrom.toISOString().split('T')[0] : null,
      customDateTo: customDateTo ? customDateTo.toISOString().split('T')[0] : null
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4 backdrop-blur-sm animate-fadeIn max-sm:p-0" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-[500px] w-full max-h-[90vh] overflow-y-auto shadow-[0_20px_60px_rgba(0,0,0,0.3)] animate-slideIn max-sm:max-w-full max-sm:max-h-screen max-sm:rounded-none" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 m-0">{title}</h2>
          <button className="bg-transparent border-none text-2xl text-gray-500 cursor-pointer p-1 leading-none transition-all duration-200 rounded-md hover:bg-gray-100 hover:text-gray-900 inline-flex items-center justify-center" onClick={onClose}>
            <CloseRoundedIcon fontSize="small" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          {/* Export Format Selection */}
          <div className="flex flex-col gap-3">
            <label className="text-sm font-semibold text-gray-900">Export Format</label>
            <select
              className="p-3 border border-gray-200 rounded-md text-sm bg-white text-gray-900 cursor-pointer transition-all duration-200 hover:border-green-500 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
            >
              <option value="excel">Excel (XLSX) - Spreadsheet format</option>
              <option value="pdf">PDF - Formatted report with charts</option>
            </select>
          </div>

          {/* Waste Types Selection */}
          {showWasteTypes && (
            <div className="flex flex-col gap-3">
              <label className="text-sm font-semibold text-gray-900">Include Waste Types</label>
              <div className="flex flex-col gap-3 p-4 bg-gray-50 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-900">
                  <input
                    type="checkbox"
                    className="cursor-pointer w-[18px] h-[18px] accent-green-500"
                    checked={includeTypes.recyclable}
                    onChange={(e) => setIncludeTypes(prev => ({ ...prev, recyclable: e.target.checked }))}
                  />
                  <span className="inline-flex items-center gap-1.5"><RecyclingOutlinedIcon fontSize="small" /> Recyclable Wastes</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-900">
                  <input
                    type="checkbox"
                    className="cursor-pointer w-[18px] h-[18px] accent-green-500"
                    checked={includeTypes.wet}
                    onChange={(e) => setIncludeTypes(prev => ({ ...prev, wet: e.target.checked }))}
                  />
                  <span className="inline-flex items-center gap-1.5"><SpaOutlinedIcon fontSize="small" /> Wet Wastes</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-900">
                  <input
                    type="checkbox"
                    className="cursor-pointer w-[18px] h-[18px] accent-green-500"
                    checked={includeTypes.dry}
                    onChange={(e) => setIncludeTypes(prev => ({ ...prev, dry: e.target.checked }))}
                  />
                  <span className="inline-flex items-center gap-1.5"><DeleteOutlineOutlinedIcon fontSize="small" /> Dry Wastes</span>
                </label>
              </div>
            </div>
          )}

          {/* Date Range Selection */}
          {showDateRange && (
            <div className="flex flex-col gap-3">
            <label className="text-sm font-semibold text-gray-900">Date Range</label>
            <select
              className="p-3 border border-gray-200 rounded-md text-sm bg-white text-gray-900 cursor-pointer transition-all duration-200 hover:border-green-500 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          )}

          {/* Custom Date Range Pickers */}
          {showDateRange && dateRange === 'custom' && (
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <div className="flex flex-col gap-3">
                <label className="text-sm font-semibold text-gray-900">Custom Date Range</label>
                <div className="flex flex-col gap-3">
                  <DatePicker
                    label="From Date"
                    value={customDateFrom}
                    onChange={(newValue) => setCustomDateFrom(newValue)}
                    maxDate={new Date()}
                    renderInput={(params) => <TextField {...params} size="small" />}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                  <DatePicker
                    label="To Date"
                    value={customDateTo}
                    onChange={(newValue) => setCustomDateTo(newValue)}
                    minDate={customDateFrom}
                    maxDate={new Date()}
                    renderInput={(params) => <TextField {...params} size="small" />}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                </div>
              </div>
            </LocalizationProvider>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex gap-3 justify-end max-sm:flex-col-reverse">
          <button className="px-6 py-3 rounded-md text-sm font-medium cursor-pointer transition-all duration-200 border-none bg-white text-gray-900 border border-gray-200 hover:bg-gray-100 hover:border-gray-500 max-sm:w-full" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="px-6 py-3 rounded-md text-sm font-medium cursor-pointer transition-all duration-200 border-none bg-green-500 text-white shadow-sm hover:bg-green-600 hover:shadow-md hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed max-sm:w-full" 
            onClick={handleExport}
            disabled={showWasteTypes && !includeTypes.recyclable && !includeTypes.wet && !includeTypes.dry}
          >
            Export Data
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
