import { memo } from 'react';

const DashboardSkeleton = memo(() => {
  return (
    <div className="fixed top-0 left-0 w-screen h-screen flex bg-white overflow-hidden z-[9999]">
      {/* Sidebar Skeleton */}
      <aside className="hidden md:flex w-[280px] bg-white border-r border-gray-200 flex-col p-6">
        <div className="mb-8">
          <div className="w-12 h-12 rounded-full bg-gray-200 mb-3 animate-skeletonPulse"></div>
          <div className="w-[150px] h-6 rounded bg-gray-200 animate-skeletonPulse"></div>
        </div>
        <nav className="flex flex-col gap-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="w-full h-11 rounded-lg bg-gray-200 animate-skeletonPulse"></div>
          ))}
        </nav>
      </aside>

      {/* Main Content Skeleton */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar Skeleton */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-8">
          <div className="w-[200px] h-7 rounded bg-gray-200 animate-skeletonPulse"></div>
          <div className="flex gap-4 items-center">
            <div className="w-10 h-10 rounded-full bg-gray-200 animate-skeletonPulse"></div>
            <div className="w-[120px] h-10 rounded-[20px] bg-gray-200 animate-skeletonPulse"></div>
          </div>
        </header>

        {/* Page Content Skeleton */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-6 border border-gray-200">
                <div className="w-12 h-12 rounded-lg bg-gray-200 mb-4 animate-skeletonPulse"></div>
                <div className="w-20 h-8 rounded bg-gray-200 mb-2 animate-skeletonPulse"></div>
                <div className="w-[120px] h-5 rounded bg-gray-200 animate-skeletonPulse"></div>
              </div>
            ))}
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(400px,1fr))] gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 border border-gray-200 min-h-[300px]">
              <div className="w-[150px] h-6 rounded bg-gray-200 mb-6 animate-skeletonPulse"></div>
              <div className="h-[220px] flex items-end">
                <div className="w-full h-full flex items-end gap-2">
                  {[...Array(8)].map((_, i) => (
                    <div 
                      key={i} 
                      className="flex-1 bg-gradient-to-b from-green-600 to-green-500 rounded-t opacity-20 animate-skeletonPulse" 
                      style={{ height: `${Math.random() * 60 + 20}%` }}
                    ></div>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200 min-h-[300px]">
              <div className="w-[150px] h-6 rounded bg-gray-200 mb-6 animate-skeletonPulse"></div>
              <div className="h-[220px] flex items-end">
                <div className="w-full h-full flex items-end gap-2">
                  {[...Array(8)].map((_, i) => (
                    <div 
                      key={i} 
                      className="flex-1 bg-gradient-to-b from-green-600 to-green-500 rounded-t opacity-20 animate-skeletonPulse" 
                      style={{ height: `${Math.random() * 60 + 20}%` }}
                    ></div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Table Skeleton */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="w-[200px] h-7 rounded bg-gray-200 mb-6 animate-skeletonPulse"></div>
            <div className="flex flex-col gap-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-full h-12 rounded-lg bg-gray-200 animate-skeletonPulse"></div>
              ))}
            </div>
          </div>
        </main>
      </div>

      {/* Loading Overlay */}
      <div className="fixed top-0 left-0 w-full h-full bg-white/95 backdrop-blur-lg flex items-center justify-center z-[10000]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-6 border-4 border-gray-200 border-t-green-600 rounded-full animate-spin"></div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">Opening Dashboard</h2>
          <p className="text-base text-gray-500">Please wait while we prepare your workspace...</p>
        </div>
      </div>
    </div>
  );
});

DashboardSkeleton.displayName = 'DashboardSkeleton';

export default DashboardSkeleton;
