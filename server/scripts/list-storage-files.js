import { initializeFirebase, getStorageBucket } from '../utils/firebase.js';
import colors from 'colors';

colors.enable();

/**
 * List all files in Firebase Storage
 */
async function listAllFiles() {
  console.log('\n📂 Listing all files in Firebase Storage...\n'.cyan.bold);

  try {
    // Initialize Firebase
    initializeFirebase();
    const bucket = getStorageBucket();

    // List all files
    const [files] = await bucket.getFiles();

    if (files.length === 0) {
      console.log('   No files found in storage bucket'.yellow);
    } else {
      console.log(`Found ${files.length} file(s):\n`.green);
      
      files.forEach((file, index) => {
        console.log(`${index + 1}. ${file.name}`.white);
        console.log(`   URL: https://storage.googleapis.com/${bucket.name}/${file.name}`.gray);
      });
    }

    console.log('\n✅ Listing complete!\n'.green.bold);

  } catch (error) {
    console.error('\n❌ Error:'.red.bold, error.message);
    console.error(error);
    process.exit(1);
  }
}

listAllFiles();
