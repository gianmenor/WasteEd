import { initializeApp } from 'firebase/app';
import { getStorage, ref, getDownloadURL, uploadBytes, deleteObject, listAll } from 'firebase/storage';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
let app = null;
let storage = null;

export const initializeFirebase = () => {
  try {
    if (!app) {
      app = initializeApp(firebaseConfig);
      storage = getStorage(app);
      console.log('Firebase initialized successfully');
    }
    return app;
  } catch (error) {
    console.error('Firebase initialization error:', error);
    throw error;
  }
};

// Initialize on module load
initializeFirebase();

/**
 * Get Firebase Storage instance
 */
export const getFirebaseStorage = () => {
  if (!storage) {
    initializeFirebase();
  }
  return storage;
};

/**
 * Get download URL for a video
 * @param {string} videoPath - Path to video in storage (e.g., 'videos/wet-wastes/123456-video.mp4')
 * @returns {Promise<string>}
 */
export const getVideoDownloadUrl = async (videoPath) => {
  try {
    const storage = getFirebaseStorage();
    const videoRef = ref(storage, videoPath);
    const url = await getDownloadURL(videoRef);
    return url;
  } catch (error) {
    console.error('Error getting video URL:', error);
    throw error;
  }
};

/**
 * Upload a video file (Admin function - usually done from backend)
 * @param {File} file - File object to upload
 * @param {string} wasteType - Type of waste (WET, DRY, RECYCLABLE)
 * @returns {Promise<{videoUrl: string, videoPath: string}>}
 */
export const uploadVideoFile = async (file, wasteType) => {
  try {
    const storage = getFirebaseStorage();
    const timestamp = Date.now();
    const sanitizedWasteType = wasteType.toLowerCase().replace(/\s+/g, '-');
    const videoPath = `videos/${sanitizedWasteType}/${timestamp}-${file.name}`;
    
    const videoRef = ref(storage, videoPath);
    
    // Upload file
    await uploadBytes(videoRef, file, {
      contentType: file.type,
      customMetadata: {
        wasteType: wasteType,
        uploadedAt: new Date().toISOString(),
      },
    });
    
    // Get download URL
    const videoUrl = await getDownloadURL(videoRef);
    
    return {
      videoUrl,
      videoPath,
    };
  } catch (error) {
    console.error('Error uploading video:', error);
    throw error;
  }
};

/**
 * Delete a video from storage
 * @param {string} videoPath - Path to video in storage
 */
export const deleteVideoFile = async (videoPath) => {
  try {
    const storage = getFirebaseStorage();
    const videoRef = ref(storage, videoPath);
    await deleteObject(videoRef);
    console.log('Video deleted successfully');
  } catch (error) {
    console.error('Error deleting video:', error);
    throw error;
  }
};

/**
 * List all videos for a waste type
 * @param {string} wasteType - Type of waste (WET, DRY, RECYCLABLE)
 * @returns {Promise<Array>}
 */
export const listVideosByType = async (wasteType) => {
  try {
    const storage = getFirebaseStorage();
    const sanitizedWasteType = wasteType.toLowerCase().replace(/\s+/g, '-');
    const listRef = ref(storage, `videos/${sanitizedWasteType}`);
    
    const result = await listAll(listRef);
    
    const videos = await Promise.all(
      result.items.map(async (itemRef) => {
        const url = await getDownloadURL(itemRef);
        return {
          name: itemRef.name,
          fullPath: itemRef.fullPath,
          url,
        };
      })
    );
    
    return videos;
  } catch (error) {
    console.error('Error listing videos:', error);
    throw error;
  }
};

/**
 * Cache for video URLs to avoid repeated fetches
 */
const videoUrlCache = new Map();

/**
 * Get video URL with caching
 * @param {string} videoPath - Path to video
 * @param {number} cacheDuration - Cache duration in milliseconds (default 1 hour)
 * @returns {Promise<string>}
 */
export const getCachedVideoUrl = async (videoPath, cacheDuration = 3600000) => {
  const cached = videoUrlCache.get(videoPath);
  
  if (cached && Date.now() - cached.timestamp < cacheDuration) {
    return cached.url;
  }
  
  const url = await getVideoDownloadUrl(videoPath);
  videoUrlCache.set(videoPath, {
    url,
    timestamp: Date.now(),
  });
  
  return url;
};

export default {
  initializeFirebase,
  getFirebaseStorage,
  getVideoDownloadUrl,
  uploadVideoFile,
  deleteVideoFile,
  listVideosByType,
  getCachedVideoUrl,
};
