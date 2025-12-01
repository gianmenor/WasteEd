import { memo } from 'react';
import './DashboardSkeleton.css';

const DashboardSkeleton = memo(() => {
  return (
    <div className="dashboard-skeleton">
      {/* Sidebar Skeleton */}
      <aside className="sidebar-skeleton">
        <div className="sidebar-header-skeleton">
          <div className="skeleton-logo skeleton-pulse"></div>
          <div className="skeleton-brand skeleton-pulse"></div>
        </div>
        <nav className="sidebar-nav-skeleton">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton-nav-item skeleton-pulse"></div>
          ))}
        </nav>
      </aside>

      {/* Main Content Skeleton */}
      <div className="main-content-skeleton">
        {/* Topbar Skeleton */}
        <header className="topbar-skeleton">
          <div className="skeleton-page-title skeleton-pulse"></div>
          <div className="topbar-actions-skeleton">
            <div className="skeleton-notification skeleton-pulse"></div>
            <div className="skeleton-user skeleton-pulse"></div>
          </div>
        </header>

        {/* Page Content Skeleton */}
        <main className="page-content-skeleton">
          {/* Stats Grid */}
          <div className="stats-grid-skeleton">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="stat-card-skeleton">
                <div className="skeleton-stat-icon skeleton-pulse"></div>
                <div className="skeleton-stat-value skeleton-pulse"></div>
                <div className="skeleton-stat-label skeleton-pulse"></div>
              </div>
            ))}
          </div>

          {/* Charts Section */}
          <div className="charts-section-skeleton">
            <div className="chart-skeleton">
              <div className="skeleton-chart-header skeleton-pulse"></div>
              <div className="skeleton-chart-body">
                <div className="skeleton-bars">
                  {[...Array(8)].map((_, i) => (
                    <div 
                      key={i} 
                      className="skeleton-bar skeleton-pulse" 
                      style={{ height: `${Math.random() * 60 + 20}%` }}
                    ></div>
                  ))}
                </div>
              </div>
            </div>
            <div className="chart-skeleton">
              <div className="skeleton-chart-header skeleton-pulse"></div>
              <div className="skeleton-chart-body">
                <div className="skeleton-bars">
                  {[...Array(8)].map((_, i) => (
                    <div 
                      key={i} 
                      className="skeleton-bar skeleton-pulse" 
                      style={{ height: `${Math.random() * 60 + 20}%` }}
                    ></div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Table Skeleton */}
          <div className="table-skeleton">
            <div className="skeleton-table-header skeleton-pulse"></div>
            <div className="skeleton-table-body">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton-table-row skeleton-pulse"></div>
              ))}
            </div>
          </div>
        </main>
      </div>

      {/* Loading Overlay */}
      <div className="loading-overlay">
        <div className="loading-content">
          <div className="loading-spinner-large"></div>
          <h2 className="loading-title">Opening Dashboard</h2>
          <p className="loading-subtitle">Please wait while we prepare your workspace...</p>
        </div>
      </div>
    </div>
  );
});

DashboardSkeleton.displayName = 'DashboardSkeleton';

export default DashboardSkeleton;
