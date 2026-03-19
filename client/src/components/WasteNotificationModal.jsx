import { useEffect, useState } from 'react';
import { API_ENDPOINTS } from '../config/api';
import RecyclingOutlinedIcon from '@mui/icons-material/RecyclingOutlined';
import SpaOutlinedIcon from '@mui/icons-material/SpaOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

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
      'RECYCLABLE': <RecyclingOutlinedIcon fontSize="inherit" />, 
      'WET': <SpaOutlinedIcon fontSize="inherit" />,
      'DRY': <DeleteOutlineOutlinedIcon fontSize="inherit" />
    };
    return icons[type] || <Inventory2OutlinedIcon fontSize="inherit" />;
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
      <div className="fixed inset-0 bg-green-50/90 backdrop-blur-sm z-[9998] animate-[fadeIn_0.2s_ease-out]" onClick={onClose} />
      
      {/* Modal Container */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] max-w-[700px] w-[90%] max-h-[90vh] overflow-y-auto animate-[slideIn_0.3s_ease-out]">
        <div className="bg-white rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
          {/* Header */}
          <div 
            className="flex items-center gap-4 px-6 py-6 sm:px-4 sm:py-4 border-b-[3px] bg-gradient-to-r from-gray-50 to-white"
            style={{ borderColor: getWasteTypeColor(notification.wasteType) }}
          >
            <div className="relative flex items-center justify-center w-[60px] h-[60px] sm:w-[50px] sm:h-[50px] flex-shrink-0">
              <span className="text-[2.5rem] sm:text-[2rem] z-[1] relative">{getWasteTypeIcon(notification.wasteType)}</span>
              <div 
                className="absolute top-1/2 left-1/2 w-full h-full rounded-full opacity-20 animate-wasteIconPulse"
                style={{ backgroundColor: getWasteTypeColor(notification.wasteType) }}
              ></div>
            </div>
            <div className="flex-1">
              <h2 className="m-0 text-2xl sm:text-xl font-bold text-gray-800">New Waste Record Added</h2>
              <p className="mt-1 mb-0 text-sm text-gray-500 font-medium">
                {formatWasteType(notification.wasteType)} • {notification.quantity || 0} items
              </p>
            </div>
            <button 
              className="w-9 h-9 border-0 bg-gray-100 text-gray-500 rounded-lg cursor-pointer text-2xl flex items-center justify-center transition-all duration-200 hover:bg-gray-200 hover:text-gray-700 flex-shrink-0"
              onClick={onClose}
              aria-label="Close notification"
            >
              <CloseRoundedIcon fontSize="small" />
            </button>
          </div>

          {/* Body - Video Section */}
          <div className="p-6 sm:p-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-gray-50 rounded-lg mb-6">
                <div className="w-10 h-10 border-4 border-gray-200 border-t-green-600 rounded-full animate-spin mb-4"></div>
                <p className="m-0 font-semibold text-gray-700">Loading instructional video...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-gray-50 rounded-lg mb-6">
                <span className="text-5xl mb-3 opacity-50"><WarningAmberOutlinedIcon fontSize="inherit" /></span>
                <p className="m-0 font-semibold text-gray-700">{error}</p>
                <small className="block mt-2 text-gray-500">Contact administrator to upload videos for this waste type</small>
              </div>
            ) : videoUrl ? (
              <div className="mb-6 rounded-lg overflow-hidden bg-gray-100">
                <video 
                  controls 
                  autoPlay
                  className="w-full max-h-[400px] block bg-gray-100"
                  onError={(e) => {
                    console.error('Video playback error:', e);
                    setError('Failed to load video');
                  }}
                >
                  <source src={videoUrl} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
                <p className="px-3 py-3 bg-sky-100 text-gray-900 text-sm m-0 text-center">
                  Proper disposal instructions for {formatWasteType(notification.wasteType)}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-gray-50 rounded-lg mb-6">
                <span className="text-5xl mb-3 opacity-50"><InfoOutlinedIcon fontSize="inherit" /></span>
                <p className="m-0 font-semibold text-gray-700">No instructional video available for this waste type</p>
              </div>
            )}

            {/* Info Section */}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] sm:grid-cols-1 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">Waste Type</div>
                <div className="text-base text-gray-800 font-semibold">
                  <span className="inline-flex items-center gap-1.5">{getWasteTypeIcon(notification.wasteType)} {formatWasteType(notification.wasteType)}</span>
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">Quantity</div>
                <div className="text-base text-gray-800 font-semibold">
                  {notification.quantity || 0} items
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">Status</div>
                <div className="text-base text-gray-800 font-semibold">
                  <span className="inline-flex items-center gap-1.5"><TaskAltOutlinedIcon fontSize="small" className="text-green-600" /> Recorded Successfully</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 flex-wrap sm:flex-col">
              <button 
                className="flex-1 min-w-[150px] sm:w-full px-6 py-3 border-0 rounded-lg text-sm font-semibold cursor-pointer transition-all duration-200 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 hover:bg-gray-200"
                onClick={onClose}
              >
                Close
              </button>
              <button 
                className="flex-1 min-w-[150px] sm:w-full px-6 py-3 border-0 rounded-lg text-sm font-semibold cursor-pointer transition-all duration-200 flex items-center justify-center gap-2 bg-green-600 text-white hover:bg-green-700"
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
