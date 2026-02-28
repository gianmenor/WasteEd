import { useEffect } from 'react';
import { useBinNotifications } from '../contexts/BinNotificationContext';

const BinFullModal = () => {
  const { showModal, latestNotification, closeModal } = useBinNotifications();

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    };

    if (showModal) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'auto';
    };
  }, [showModal, closeModal]);

  // Don't render if modal shouldn't be shown
  if (!showModal || !latestNotification) {
    return null;
  }

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <>
      {/* Modal Backdrop */}
      <div 
        className="fixed inset-0 bg-[rgba(248,253,248,0.9)] backdrop-blur-sm z-[9998] animate-fadeIn" 
        onClick={closeModal} 
      />
      
      {/* Modal Container */}
      <div className="fixed inset-0 flex items-center justify-center z-[9999] p-5">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl max-w-[500px] w-full max-h-[90vh] overflow-y-auto animate-slideIn">
          {/* Header */}
          <div className="flex items-center gap-4 px-6 pt-6 pb-4 border-b border-gray-200 relative bg-white">
            <div className="relative flex items-center justify-center">
              <span className="text-[2.5rem] z-[1] relative">🗑️</span>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60px] h-[60px] bg-red-500/20 rounded-full animate-pulseRing"></div>
            </div>
            <div className="flex-1">
              <h2 className="text-red-500 text-2xl font-bold m-0 mb-1">{latestNotification.title}</h2>
              <p className="text-gray-600 text-sm m-0">Immediate attention required</p>
            </div>
            <button 
              className="absolute top-4 right-4 bg-transparent border-none text-2xl text-gray-500 cursor-pointer w-8 h-8 flex items-center justify-center rounded-md transition-all duration-200 hover:bg-gray-100 hover:text-gray-900"
              onClick={closeModal}
              aria-label="Close notification"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="p-6 bg-white">
            <div className="flex gap-6 items-center max-md:flex-col max-md:text-center">
              <div className="flex-shrink-0">
                <div className="relative w-20 h-[100px]">
                  <div className="w-[60px] h-20 bg-gray-100 border-2 border-gray-200 rounded-t-lg rounded-b-xl relative overflow-hidden">
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-red-500 to-red-400 h-full rounded-b-lg transition-all duration-1000 animate-binFillUp"></div>
                    <div className="absolute -top-[10px] left-1/2 -translate-x-1/2 w-5 h-5 bg-red-500 rounded-t-full animate-overflow"></div>
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center font-bold text-sm animate-bounce">!</div>
                </div>
              </div>
              
              <div>
                <h3 className="text-gray-900 text-xl font-semibold m-0 mb-4">{latestNotification.binName ? `${latestNotification.binName} Bin is Full!` : 'Bin is Full!'}</h3>
                <p className="text-gray-500 leading-relaxed m-0 mb-3">
                  The {latestNotification.binName ? latestNotification.binName.toLowerCase() + ' ' : ''}bin reached capacity at <strong>{formatTime(latestNotification.timestamp)}</strong>
                </p>
                <p className="text-gray-500 leading-relaxed m-0 mb-3">
                  Please empty the {latestNotification.binName ? latestNotification.binName.toLowerCase() + ' ' : ''}bin as soon as possible.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pt-4 pb-6 border-t border-gray-200">
            <div className="flex gap-3 mb-4 max-md:flex-col">
              <button 
                className="flex-1 px-4 py-3 rounded-lg border border-gray-200 font-medium cursor-pointer transition-all duration-200 text-sm bg-gray-100 text-gray-900 hover:bg-gray-200"
                onClick={closeModal}
              >
                📋 Mark as Acknowledged
              </button>
              <button 
                className="flex-1 px-4 py-3 rounded-lg border-none font-medium cursor-pointer transition-all duration-200 text-sm bg-red-500 text-white hover:bg-red-600"
                onClick={() => {
                  closeModal();
                  // Could add navigation to analytics or waste management page
                  window.location.href = '/waste';
                }}
              >
                🗑️ Go to Waste Management
              </button>
            </div>
            
            <div className="text-center">
              <small className="text-gray-400 text-xs">
                🔔 You will continue to receive notifications until the bin is emptied
              </small>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default BinFullModal;