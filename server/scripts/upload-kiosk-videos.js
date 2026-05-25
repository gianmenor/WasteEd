import fs from 'fs';
import path from 'path';
import colors from 'colors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { initializeFirebase, getStorageBucket } from '../utils/firebase.js';
import { prisma } from '../utils/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const uploadTargets = [
  {
    name: 'Recyclable waste video',
    source: path.join(__dirname, '../../RECYCLABLEE.mp4'),
    targetPath: 'videos/recyclable-wastes/Recyclable.mp4',
    wasteType: 'RECYCLABLE'
  },
  {
    name: 'Wet waste video',
    source: path.join(__dirname, '../../WET.mp4'),
    targetPath: 'videos/wet-wastes/WetWaste.mp4',
    wasteType: 'WET'
  },
  {
    name: 'Dry waste video',
    source: path.join(__dirname, '../../DRY.mp4'),
    targetPath: 'videos/dry-wastes/DryWaste.mp4',
    wasteType: 'DRY'
  },
  {
    name: 'Idle video',
    source: path.join(__dirname, '../../IDLE.mp4'),
    targetPath: 'videos/idle/idle.mp4',
    wasteType: null
  }
];

const uploadVideoFile = async (bucket, source, targetPath) => {
  const fileBuffer = fs.readFileSync(source);
  const file = bucket.file(targetPath);

  await file.save(fileBuffer, {
    metadata: {
      contentType: 'video/mp4',
      metadata: {
        uploadedAt: new Date().toISOString(),
        source: 'upload-kiosk-videos.js'
      }
    }
  });

  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${targetPath}`;
};

const main = async () => {
  try {
    console.log(colors.cyan('\nUploading kiosk videos to Firebase...\n'));

    initializeFirebase();
    const bucket = getStorageBucket();

    for (const item of uploadTargets) {
      if (!fs.existsSync(item.source)) {
        throw new Error(`Source file not found: ${item.source}`);
      }

      const publicUrl = await uploadVideoFile(bucket, item.source, item.targetPath);
      console.log(colors.green(`Uploaded ${item.name}`));
      console.log(colors.gray(`  ${publicUrl}`));

      if (item.wasteType) {
        await prisma.videoMapping.upsert({
          where: { wasteType: item.wasteType },
          update: {
            videoUrl: publicUrl,
            videoPath: item.targetPath
          },
          create: {
            wasteType: item.wasteType,
            videoUrl: publicUrl,
            videoPath: item.targetPath,
            thumbnail: null,
            duration: null
          }
        });

        console.log(colors.blue(`Updated DB mapping for ${item.wasteType}`));
      }

      console.log('');
    }

    console.log(colors.green('✅ All kiosk videos uploaded and mappings updated.'));
    process.exit(0);
  } catch (error) {
    console.error(colors.red('❌ Upload failed:'), error.message);
    process.exit(1);
  }
};

main();
