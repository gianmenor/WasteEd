import { useState } from 'react';
import './WasteTable.css';

const WasteTable = () => {
  const [page, setPage] = useState(0);

  // Mock data since API might fail
  const records = [
    { id: 1, date: '2025-10-01', recyclable: 25, biodegradable: 30, nonBiodegradable: 15, total: 70 },
    { id: 2, date: '2025-09-30', recyclable: 31, biodegradable: 0, nonBiodegradable: 4, total: 35 },
  ];

  const stats = {
    totalRecyclable: 56,
    totalBiodegradable: 30,
    totalNonBiodegradable: 19,
    grandTotal: 105
  };

  const handleView = (record) => {
    alert(`Record Details:\nDate: ${record.date}\nTotal: ${record.total} kg`);
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this record?')) {
      console.log('Delete:', id);
    }
  };

  return (
    <div className="waste-table-container">
      {/* Header */}
      <div className="header">
        <div className="header-info">
          <h1 className="title">Waste Management</h1>
          <p className="subtitle">Track and monitor daily waste collection data</p>
        </div>
        <button className="add-button">
          <span className="icon">+</span>
          Add Record
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card recyclable">
          <div className="stat-content">
            <div className="stat-info">
              <div className="stat-number">{stats.totalRecyclable}</div>
              <div className="stat-label">Recyclable (kg)</div>
            </div>
            <div className="stat-icon"></div>
          </div>
        </div>
        
        <div className="stat-card organic">
          <div className="stat-content">
            <div className="stat-info">
              <div className="stat-number">{stats.totalBiodegradable}</div>
              <div className="stat-label">Organic (kg)</div>
            </div>
            <div className="stat-icon"></div>
          </div>
        </div>
        
        <div className="stat-card general">
          <div className="stat-content">
            <div className="stat-info">
              <div className="stat-number">{stats.totalNonBiodegradable}</div>
              <div className="stat-label">General (kg)</div>
            </div>
            <div className="stat-icon"></div>
          </div>
        </div>
        
        <div className="stat-card total">
          <div className="stat-content">
            <div className="stat-info">
              <div className="stat-number">{stats.grandTotal}</div>
              <div className="stat-label">Total (kg)</div>
            </div>
            <div className="stat-icon"></div>
          </div>
        </div>
      </div>

      {/* Simple Table */}
      <div className="table-container">
        <h2 className="table-title">Waste Collection Records</h2>
        
        <table className="waste-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Recyclable</th>
              <th>Organic</th>
              <th>General</th>
              <th>Total</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <td>{record.date}</td>
                <td>
                  <span className="chip success">{record.recyclable} kg</span>
                </td>
                <td>
                  <span className="chip orange">{record.biodegradable} kg</span>
                </td>
                <td>
                  <span className="chip default">{record.nonBiodegradable} kg</span>
                </td>
                <td>
                  <span className="total-weight">{record.total} kg</span>
                </td>
                <td>
                  <button 
                    className="action-btn view" 
                    onClick={() => handleView(record)}
                    title="View details"
                  >
                    
                  </button>
                  <button 
                    className="action-btn delete" 
                    onClick={() => handleDelete(record.id)}
                    title="Delete record"
                  >
                    
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default WasteTable;
