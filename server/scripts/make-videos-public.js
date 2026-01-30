import { initializeFirebase, getStorageBucket } from '../utils/firebase.js';
import colors from 'colors';

colors.enable();

/**
 * Make existing videos in Firebase Storage publicly accessible
 */
async function makeVideosPublic() {
  console.log('\n🔓 Making Firebase Storage videos public...\n'.cyan.bold);

  try {
    // Initialize Firebase
    initializeFirebase();
    const bucket = getStorageBucket();

    // List of video paths to make public
    const videoPaths = [
      'videos/recyclable-wastes/Recyclable.mp4',
      'videos/wet-wastes/WetWaste.mp4',
      'videos/dry-wastes/DryWaste.mp4'
    ];

    console.log('Processing videos:'.yellow);

    for (const videoPath of videoPaths) {
      try {
        const file = bucket.file(videoPath);
        
        // Check if file exists
        const [exists] = await file.exists();
        
        if (!exists) {
          console.log(`   ⚠ ${videoPath} - File not found (skipped)`.yellow);
          continue;
        }

        // Make file public
        await file.makePublic();
        
        // Get the public URL
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${videoPath}`;
        
        console.log(`   ✓ ${videoPath}`.green);
        console.log(`     Public URL: ${publicUrl}`.gray);
        
      } catch (error) {
        console.log(`   ✗ ${videoPath} - Error: ${error.message}`.red);
      }
    }

    console.log('\n✅ Operation completed!\n'.green.bold);
    console.log('Videos are now publicly accessible via:'.cyan);
    console.log('  https://storage.googleapis.com/wasted-599ad.appspot.com/videos/...\n'.white);

  } catch (error) {
    console.error('\n❌ Error:'.red.bold, error.message);
    process.exit(1);
  }
}

makeVideosPublic();
