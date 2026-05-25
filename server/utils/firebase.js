import admin from 'firebase-admin';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

let firebaseApp = null;
let storage = null;

/**
 * Initialize Firebase Admin SDK
 * Uses service account credentials from either a JSON path or environment variables
 */
export const initializeFirebase = () => {
  try {
    if (firebaseApp) {
      console.log('Firebase already initialized'.cyan);
      return firebaseApp;
    }

    let serviceAccount;

    if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const serviceAccountPath = path.isAbsolute(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
        ? process.env.FIREBASE_SERVICE_ACCOUNT_PATH
        : path.resolve(__dirname, '..', process.env.FIREBASE_SERVICE_ACCOUNT_PATH);

      if (!fs.existsSync(serviceAccountPath)) {
        throw new Error(`Firebase service account file not found: ${serviceAccountPath}`);
      }

      serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
    } else {
      serviceAccount = {
        type: 'service_account',
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: process.env.FIREBASE_CERT_URL,
      };
    }

    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.appspot.com`;

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket,
    });

    storage = admin.storage();

    console.log('Firebase Admin SDK initialized successfully'.green);
    return firebaseApp;

    storage = admin.storage();

    console.log('Firebase Admin SDK initialized successfully'.green);
    return firebaseApp;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:'.red, error.message);
    throw error;
  }
};

/**
 * Get Firebase Storage bucket instance
 */
export const getStorageBucket = () => {
  if (!storage) {
    initializeFirebase();
  }
  return storage.bucket();
};

/**
 * Upload a video file to Firebase Storage
 * @param {Buffer} fileBuffer - File buffer to upload
 * @param {string} wasteType - Type of waste (WET, DRY, RECYCLABLE)
 * @param {string} fileName - Original filename
 * @returns {Promise<{videoUrl: string, videoPath: string}>}
 */
export const uploadVideo = async (fileBuffer, wasteType, fileName) => {
  try {
    const bucket = getStorageBucket();
    
    // Create a unique filename with timestamp
    const timestamp = Date.now();
    const sanitizedWasteType = wasteType.toLowerCase().replace(/\s+/g, '-');
    const videoPath = `videos/${sanitizedWasteType}/${timestamp}-${fileName}`;
    
    const file = bucket.file(videoPath);
    
    // Upload the file
    await file.save(fileBuffer, {
      metadata: {
        contentType: 'video/mp4',
        metadata: {
          wasteType: wasteType,
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    // Make the file publicly accessible (or use signed URLs for private access)
    await file.makePublic();
    
    // Get the public URL
    const videoUrl = `https://storage.googleapis.com/${bucket.name}/${videoPath}`;
    
    console.log(`Video uploaded successfully: ${videoPath}`.green);
    
    return {
      videoUrl,
      videoPath,
    };
  } catch (error) {
    console.error('Failed to upload video:'.red, error.message);
    throw error;
  }
};

/**
 * Get a signed URL for private video access
 * @param {string} videoPath - Path to the video in storage
 * @param {number} expiresIn - Expiration time in minutes (default 60)
 * @returns {Promise<string>}
 */
export const getSignedVideoUrl = async (videoPath, expiresIn = 60) => {
  try {
    const bucket = getStorageBucket();
    const file = bucket.file(videoPath);
    
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresIn * 60 * 1000,
    });
    
    return url;
  } catch (error) {
    console.error('Failed to get signed URL:'.red, error.message);
    throw error;
  }
};

/**
 * Delete a video from Firebase Storage
 * @param {string} videoPath - Path to the video in storage
 */
export const deleteVideo = async (videoPath) => {
  try {
    const bucket = getStorageBucket();
    const file = bucket.file(videoPath);
    
    await file.delete();
    
    console.log(`Video deleted successfully: ${videoPath}`.green);
  } catch (error) {
    console.error('Failed to delete video:'.red, error.message);
    throw error;
  }
};

/**
 * List all videos for a specific waste type
 * @param {string} wasteType - Type of waste (WET, DRY, RECYCLABLE)
 * @returns {Promise<Array>}
 */
export const listVideosByWasteType = async (wasteType) => {
  try {
    const bucket = getStorageBucket();
    const sanitizedWasteType = wasteType.toLowerCase().replace(/\s+/g, '-');
    const prefix = `videos/${sanitizedWasteType}/`;
    
    const [files] = await bucket.getFiles({ prefix });
    
    return files.map(file => ({
      name: file.name,
      url: `https://storage.googleapis.com/${bucket.name}/${file.name}`,
      metadata: file.metadata,
    }));
  } catch (error) {
    console.error('Failed to list videos:'.red, error.message);
    throw error;
  }
};

export default {
  initializeFirebase,
  getStorageBucket,
  uploadVideo,
  getSignedVideoUrl,
  deleteVideo,
  listVideosByWasteType,
};
