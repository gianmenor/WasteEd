import { useEffect, useState } from 'react';
import { API_ENDPOINTS } from '../config/api';
import './WasteNotificationModal.css';

const WasteNotificationModal = ({ notification, onClose }) => {
  const [videoUrl, setVideoUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchVideoUrl = async () => {
      if (!notification || !notification.wasteType) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Get video mapping for waste type
        const response = await fetch(
          API_ENDPOINTS.VIDEO_MAPPING_BY_TYPE(notification.wasteType),
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );

        if (!response.ok) {
          throw new Error('Video not found for this waste type');
        }

        const data = await response.json();
        if (data.success && data.data) {
          setVideoUrl(data.data.videoUrl);
        } else {
          throw new Error('No video available');
        }
      } catch (err) {
        console.error('Error fetching video:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchVideoUrl();
  }, [notification]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'auto';
    };
  }, [onClose]);

  if (!notification) return null;

  const formatWasteType = (type) => {
    const types = {
      'RECYCLABLE': 'Recyclable Wastes',
      'WET': 'Wet Wastes',
      'DRY': 'Dry Wastes'
    };
    return types[type] || type;
  };

  const getWasteTypeIcon = (type) => {
    const icons = {
      'RECYCLABLE': '♻️',
      'WET': '🍎',
      'DRY': '🗑️'
    };
    return icons[type] || '📦';
  };

  const getWasteTypeColor = (type) => {
    const colors = {
      'RECYCLABLE': '#16a34a', // green
      'WET': '#ca8a04', // yellow
      'DRY': '#dc2626' // red
    };
    return colors[type] || '#6b7280';
  };

  return (
    <>
      {/* Modal Backdrop */}
      <div className="waste-modal-backdrop" onClick={onClose} />
      
      {/* Modal Container */}
      <div className="waste-modal-container">
        <div className="waste-modal-content">
          {/* Header */}
          <div 
            className="waste-modal-header"
            style={{ borderColor: getWasteTypeColor(notification.wasteType) }}
          >
            <div className="waste-modal-icon">
              <span className="waste-icon">{getWasteTypeIcon(notification.wasteType)}</span>
              <div 
                className="waste-icon-pulse"
                style={{ backgroundColor: getWasteTypeColor(notification.wasteType) }}
              ></div>
            </div>
            <div className="waste-modal-title">
              <h2>New Waste Record Added</h2>
              <p className="waste-modal-subtitle">
                {formatWasteType(notification.wasteType)} • {notification.quantity || 0} items
              </p>
            </div>
            <button 
              className="waste-modal-close"
              onClick={onClose}
              aria-label="Close notification"
            >
              ✕
            </button>
          </div>

          {/* Body - Video Section */}
          <div className="waste-modal-body">
            {loading ? (
              <div className="waste-video-loading">
                <div className="spinner"></div>
                <p>Loading instructional video...</p>
              </div>
            ) : error ? (
              <div className="waste-video-error">
                <span className="error-icon">⚠️</span>
                <p>{error}</p>
                <small>Contact administrator to upload videos for this waste type</small>
              </div>
            ) : videoUrl ? (
              <div className="waste-video-container">
                <video 
                  controls 
                  autoPlay
                  className="waste-video"
                  onError={(e) => {
                    console.error('Video playback error:', e);
                    setError('Failed to load video');
                  }}
                >
                  <source src={videoUrl} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
                <p className="waste-video-caption">
                  Proper disposal instructions for {formatWasteType(notification.wasteType)}
                </p>
              </div>
            ) : (
              <div className="waste-video-error">
                <span className="error-icon">ℹ️</span>
                <p>No instructional video available for this waste type</p>
              </div>
            )}

            {/* Info Section */}
            <div className="waste-info-section">
              <div className="waste-info-card">
                <div className="waste-info-label">Waste Type</div>
                <div className="waste-info-value">
                  {getWasteTypeIcon(notification.wasteType)} {formatWasteType(notification.wasteType)}
                </div>
              </div>
              <div className="waste-info-card">
                <div className="waste-info-label">Quantity</div>
                <div className="waste-info-value">
                  {notification.quantity || 0} items
                </div>
              </div>
              <div className="waste-info-card">
                <div className="waste-info-label">Status</div>
                <div className="waste-info-value">
                  ✅ Recorded Successfully
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="waste-modal-actions">
              <button 
                className="btn-secondary"
                onClick={onClose}
              >
                Close
              </button>
              <button 
                className="btn-primary"
                onClick={() => {
                  onClose();
                  window.location.href = '/waste';
                }}
              >
                View Waste Records
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default WasteNotificationModal;
