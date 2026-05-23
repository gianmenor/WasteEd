import fs from 'fs';
import path from 'path';
import { initializeFirebase, getStorageBucket } from './utils/firebase.js';

const __dirname = path.resolve();
const idleFilePath = path.join(__dirname, '..', 'IDLE.mp4');
const targetPath = 'videos/idle/idle.mp4';

const uploadIdle = async () => {
  try {
    initializeFirebase();
    const bucket = getStorageBucket();
    const fileBuffer = fs.readFileSync(idleFilePath);
    const file = bucket.file(targetPath);
    await file.save(fileBuffer, {
      metadata: {
        contentType: 'video/mp4',
        metadata: {
          uploadedAt: new Date().toISOString(),
        },
      },
    });
    await file.makePublic();
    console.log('Idle video uploaded successfully:', targetPath);
    console.log('Public URL: https://storage.googleapis.com/' + bucket.name + '/' + targetPath);
  } catch (error) {
    console.error('Failed to upload idle video:', error);
    process.exit(1);
  }
};

uploadIdle();
