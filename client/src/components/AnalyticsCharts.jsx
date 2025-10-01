import React from 'react';

const AnalyticsCharts = ({ waste, wasteMonthly, binDaily, binMonthly, averages }) => {
  // Generate line graph component for daily waste
  const renderLineGraph = (data, title, color = '#4ade80') => {
    if (!data || data.length === 0) {
      return (
        <div className="line-graph">
          <div className="no-data">No data available</div>
        </div>
      );
    }

    const maxValue = Math.max(...data.map(d => d.total || d.count || 1));
    const yLabels = [maxValue, Math.floor(maxValue * 0.75), Math.floor(maxValue * 0.5), Math.floor(maxValue * 0.25), 0];

    return (
      <div className="line-graph" style={{ '--bar-color': color }}>
        <div className="grid-lines">
          {yLabels.map((_, i) => <span key={i}></span>)}
        </div>
        <div className="y-axis-labels">
          {yLabels.map((val, i) => <span key={i}>{val}</span>)}
        </div>
        <div className="bars">
          {data.map((item, i) => {
            const height = ((item.total || item.count || 0) / maxValue) * 100;
            return (
              <div
                key={i}
                className="bar"
                style={{ height: `${height}%` }}
              >
                <div className="bar-value">{item.total || item.count || 0}</div>
              </div>
            );
          })}
        </div>
        <div className="bar-labels">
          {data.map((item, i) => (
            <span key={i}>{item.date || item.month}</span>
          ))}
        </div>
        <div className="x-axis-title">{title}</div>
      </div>
    );
  };

  // Generate stacked bar chart for waste breakdown
  const renderStackedChart = (data, title) => {
    if (!data || data.length === 0) {
      return <div className="no-data">No data available</div>;
    }

    const maxValue = Math.max(...data.map(d => d.total || 1));

    return (
      <div className="stacked-chart">
        <h4 className="chart-title">{title}</h4>
        <div className="chart-container">
          {data.map((item, i) => {
            const recyclablePercent = ((item.recyclable || 0) / (item.total || 1)) * 100;
            const biodegradablePercent = ((item.biodegradable || 0) / (item.total || 1)) * 100;
            const nonBiodegradablePercent = ((item.nonBiodegradable || 0) / (item.total || 1)) * 100;
            const height = ((item.total || 0) / maxValue) * 100;

            return (
              <div key={i} className="chart-bar" style={{ height: `${height}%` }}>
                <div className="bar-segment recyclable" style={{ height: `${recyclablePercent}%` }}></div>
                <div className="bar-segment biodegradable" style={{ height: `${biodegradablePercent}%` }}></div>
                <div className="bar-segment non-biodegradable" style={{ height: `${nonBiodegradablePercent}%` }}></div>
                <div className="bar-label">{item.date || item.month}</div>
                <div className="bar-total">{item.total || 0}</div>
              </div>
            );
          })}
        </div>
        <div className="chart-legend">
          <div className="legend-item">
            <span className="legend-color recyclable"></span>
            <span>Recyclable</span>
          </div>
          <div className="legend-item">
            <span className="legend-color biodegradable"></span>
            <span>Biodegradable</span>
          </div>
          <div className="legend-item">
            <span className="legend-color non-biodegradable"></span>
            <span>Non-biodegradable</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="charts-container">
      <div className="chart-grid">
        {/* Daily Waste Chart */}
        <div className="chart-wrapper large">
          <h3>Daily Waste Items {averages?.wasteDaily && <span className="chart-meta">(Avg {averages.wasteDaily}/day)</span>}</h3>
          {renderStackedChart(waste, "Daily Waste Breakdown")}
        </div>

        {/* Monthly Waste Chart */}
        <div className="chart-wrapper">
          <h3>Monthly Waste Items {averages?.wasteMonthly && <span className="chart-meta">(Avg {averages.wasteMonthly}/mo)</span>}</h3>
          {renderStackedChart([...wasteMonthly].reverse(), "Monthly Waste Breakdown")}
        </div>

        {/* Daily Bin Events */}
        <div className="chart-wrapper">
          <h3>Daily Bin Events {averages?.binDaily && <span className="chart-meta">(Avg {averages.binDaily}/day)</span>}</h3>
          {renderLineGraph(binDaily, "Daily Bin Full Events", '#3b82f6')}
        </div>

        {/* Monthly Bin Events */}
        <div className="chart-wrapper">
          <h3>Monthly Bin Events {averages?.binMonthly && <span className="chart-meta">(Avg {averages.binMonthly}/mo)</span>}</h3>
          {renderLineGraph([...binMonthly].reverse(), "Monthly Bin Full Events", '#3b82f6')}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsCharts;
