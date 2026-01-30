import { initializeFirebase, getStorageBucket, listVideosByWasteType } from '../utils/firebase.js';
import colors from 'colors';

colors.enable();

/**
 * Test script to verify Firebase configuration
 * Run with: node scripts/test-firebase.js
 */

async function testFirebaseSetup() {
  console.log('\n🔥 Testing Firebase Setup...\n'.cyan.bold);

  try {
    // Test 1: Initialize Firebase
    console.log('1. Initializing Firebase Admin SDK...'.yellow);
    initializeFirebase();
    console.log('   ✓ Firebase initialized successfully\n'.green);

    // Test 2: Get Storage Bucket
    console.log('2. Connecting to Storage Bucket...'.yellow);
    const bucket = getStorageBucket();
    const [metadata] = await bucket.getMetadata();
    console.log(`   ✓ Connected to bucket: ${metadata.name}`.green);
    console.log(`   ✓ Location: ${metadata.location}`.green);
    console.log(`   ✓ Storage class: ${metadata.storageClass}\n`.green);

    // Test 3: Check video folders
    console.log('3. Checking video folder structure...'.yellow);
    const wasteTypes = ['WET', 'DRY', 'RECYCLABLE'];
    
    for (const wasteType of wasteTypes) {
      try {
        const videos = await listVideosByWasteType(wasteType);
        console.log(`   ✓ ${wasteType} wastes folder: ${videos.length} video(s) found`.green);
        
        if (videos.length > 0) {
          videos.forEach((video, index) => {
            console.log(`     ${index + 1}. ${video.name}`.gray);
          });
        }
      } catch (error) {
        console.log(`   ⚠ ${wasteType} wastes folder: No videos yet (this is okay)`.yellow);
      }
    }

    console.log('\n✅ Firebase setup test completed successfully!\n'.green.bold);
    console.log('You can now:'.cyan);
    console.log('  1. Upload videos via the backend API'.white);
    console.log('  2. Create video mappings in the database'.white);
    console.log('  3. Test notification system with videos\n'.white);

  } catch (error) {
    console.error('\n❌ Firebase setup test failed:\n'.red.bold);
    
    if (error.message.includes('FIREBASE_PROJECT_ID')) {
      console.error('Error: Firebase credentials not configured'.red);
      console.error('\nPlease follow these steps:'.yellow);
      console.error('1. Create a Firebase project at https://console.firebase.google.com'.white);
      console.error('2. Enable Cloud Storage'.white);
      console.error('3. Download service account credentials'.white);
      console.error('4. Add credentials to server/.env file'.white);
      console.error('5. See FIREBASE_SETUP.md for detailed instructions\n'.white);
    } else {
      console.error(`Error details: ${error.message}\n`.red);
    }

    process.exit(1);
  }
}

// Run the test
testFirebaseSetup();
