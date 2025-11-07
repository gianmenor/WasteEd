import { useEffect } from 'react';
import { useBinNotifications } from '../contexts/BinNotificationContext';
import './BinFullModal.css';

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
      <div className="modal-backdrop" onClick={closeModal} />
      
      {/* Modal Container */}
      <div className="bin-modal-container">
        <div className="bin-modal-content">
          {/* Header */}
          <div className="bin-modal-header">
            <div className="bin-modal-icon">
              <span className="bin-icon">🗑️</span>
              <div className="bin-icon-pulse"></div>
            </div>
            <div className="bin-modal-title">
              <h2>{latestNotification.title}</h2>
              <p className="bin-modal-subtitle">Immediate attention required</p>
            </div>
            <button 
              className="bin-modal-close"
              onClick={closeModal}
              aria-label="Close notification"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="bin-modal-body">
            <div className="bin-alert-content">
              <div className="bin-alert-icon">
                <div className="bin-visual">
                  <div className="bin-container">
                    <div className="bin-fill full"></div>
                    <div className="bin-overflow"></div>
                  </div>
                  <div className="bin-warning-badge">!</div>
                </div>
              </div>
              
              <div className="bin-alert-details">
                <h3>{latestNotification.binName ? `${latestNotification.binName} Bin is Full!` : 'Bin is Full!'}</h3>
                <p>
                  The {latestNotification.binName ? latestNotification.binName.toLowerCase() + ' ' : ''}bin reached capacity at <strong>{formatTime(latestNotification.timestamp)}</strong>
                </p>
                <p>
                  Please empty the {latestNotification.binName ? latestNotification.binName.toLowerCase() + ' ' : ''}bin as soon as possible.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bin-modal-footer">
            <div className="bin-modal-buttons">
              <button 
                className="btn-secondary"
                onClick={closeModal}
              >
                📋 Mark as Acknowledged
              </button>
              <button 
                className="btn-primary"
                onClick={() => {
                  closeModal();
                  // Could add navigation to analytics or waste management page
                  window.location.href = '/waste';
                }}
              >
                🗑️ Go to Waste Management
              </button>
            </div>
            
            <div className="bin-modal-info">
              <small>
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