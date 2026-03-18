import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import { API_ENDPOINTS } from '../config/api';
import { getCachedVideoUrl } from '../config/firebase';

const VIDEO_CACHE_KEY = 'kioskVideoUrlCache.v1';
const VIDEO_CACHE_TTL = 1000 * 60 * 60 * 24;
const RETURN_TO_IDLE_DELAY_MS = 4000;

const WASTE_TYPES = ['RECYCLABLE', 'WET', 'DRY'];

const readVideoCache = () => {
  try {
    const raw = localStorage.getItem(VIDEO_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeVideoCache = (cache) => {
  try {
    localStorage.setItem(VIDEO_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore write failures. Kiosk can still run without local persistence.
  }
};

const resolveCachedUrl = async (cacheKey, resolver) => {
  const cache = readVideoCache();
  const entry = cache[cacheKey];

  if (entry && Date.now() - entry.timestamp < VIDEO_CACHE_TTL) {
    return entry.url;
  }

  const url = await resolver();
  cache[cacheKey] = {
    url,
    timestamp: Date.now(),
  };
  writeVideoCache(cache);
  return url;
};

const detectWasteType = (payload) => {
  if ((payload?.recyclable || 0) > 0) {
    return 'RECYCLABLE';
  }

  if ((payload?.biodegradable || 0) > 0) {
    return 'WET';
  }

  return 'DRY';
};

const KioskMode = () => {
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [idleVideoUrl, setIdleVideoUrl] = useState('');
  const [activeVideoUrl, setActiveVideoUrl] = useState('');
  const [isIdlePlayback, setIsIdlePlayback] = useState(true);

  const wasteVideoMapRef = useRef({});
  const returnToIdleTimerRef = useRef(null);

  const resetToIdle = useCallback(() => {
    if (!idleVideoUrl) {
      return;
    }

    setActiveVideoUrl(idleVideoUrl);
    setIsIdlePlayback(true);
  }, [idleVideoUrl]);

  const queueIdleReset = useCallback(() => {
    if (returnToIdleTimerRef.current) {
      clearTimeout(returnToIdleTimerRef.current);
    }

    returnToIdleTimerRef.current = setTimeout(() => {
      resetToIdle();
    }, RETURN_TO_IDLE_DELAY_MS);
  }, [resetToIdle]);

  const playWasteVideo = useCallback((wasteType) => {
    const wasteVideoUrl = wasteVideoMapRef.current[wasteType];

    if (!wasteVideoUrl) {
      resetToIdle();
      return;
    }

    if (returnToIdleTimerRef.current) {
      clearTimeout(returnToIdleTimerRef.current);
    }

    setIsIdlePlayback(false);
    setActiveVideoUrl(wasteVideoUrl);
  }, [resetToIdle]);

  useEffect(() => {
    let isMounted = true;

    const fetchWasteVideoUrl = async (wasteType) => {
      return resolveCachedUrl(`waste-${wasteType}`, async () => {
        const response = await fetch(API_ENDPOINTS.VIDEO_MAPPING_BY_TYPE(wasteType));
        if (!response.ok) {
          return '';
        }

        const data = await response.json();
        return data?.data?.videoUrl || '';
      });
    };

    const loadKioskMedia = async () => {
      try {
        const idleUrl = await resolveCachedUrl('idle', async () => {
          return getCachedVideoUrl('videos/idle/idle.mp4', VIDEO_CACHE_TTL);
        });

        const wastePairs = await Promise.all(
          WASTE_TYPES.map(async (type) => [type, await fetchWasteVideoUrl(type)])
        );

        if (!isMounted) {
          return;
        }

        const wasteMap = Object.fromEntries(wastePairs);
        wasteVideoMapRef.current = wasteMap;

        setIdleVideoUrl(idleUrl);
        setActiveVideoUrl(idleUrl);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        console.error('Failed to load kiosk media:', loadError);
        setError('Unable to load kiosk videos. Please check Firebase configuration.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadKioskMedia();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const eventSource = new EventSource(API_ENDPOINTS.BIN_NOTIFICATIONS_STREAM);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data?.type === 'connected') {
          return;
        }

        if (data?.type === 'WASTE_INSERTED') {
          const wasteType = detectWasteType(data.data || {});
          playWasteVideo(wasteType);
        }
      } catch (parseError) {
        console.error('Kiosk SSE parse error:', parseError);
      }
    };

    eventSource.onerror = () => {
      // Keep kiosk running silently if the stream reconnects.
    };

    return () => {
      eventSource.close();
    };
  }, [playWasteVideo]);

  useEffect(() => {
    return () => {
      if (returnToIdleTimerRef.current) {
        clearTimeout(returnToIdleTimerRef.current);
      }
    };
  }, []);

  const onVideoEnded = useCallback(() => {
    if (isIdlePlayback) {
      return;
    }

    queueIdleReset();
  }, [isIdlePlayback, queueIdleReset]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black text-white flex items-center justify-center">
        <p className="text-lg">Preparing kiosk...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {activeVideoUrl ? (
        <div className="w-full h-full flex items-center justify-center p-2 sm:p-3 md:p-0">
          <video
            key={activeVideoUrl}
            className="max-w-full max-h-full w-auto h-auto object-contain"
            src={activeVideoUrl}
            autoPlay
            muted
            loop={isIdlePlayback}
            playsInline
            controls={false}
            onEnded={onVideoEnded}
            onError={() => setError('Video playback failed. Please verify the uploaded file.')}
          />
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-white">
          <p>No video source configured.</p>
        </div>
      )}

      {error && (
        <div className="absolute top-4 left-4 px-3 py-2 rounded-lg text-white text-sm font-medium bg-red-500/90">
          {error}
        </div>
      )}

      <button
        type="button"
        aria-label="Open admin login"
        title="Open admin dashboard"
        className="absolute top-1/2 -translate-y-1/2 right-4 h-14 w-14 rounded-full border border-white/30 bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 transition-colors duration-200 flex items-center justify-center"
        onClick={() => navigate('/kiosk-admin')}
      >
        <AdminPanelSettingsOutlinedIcon />
      </button>
    </div>
  );
};

export default KioskMode;
