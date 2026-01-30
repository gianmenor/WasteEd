# Firebase Integration Setup Guide

## Overview
This guide will help you set up Firebase Cloud Storage for storing and serving notification videos in the WASTE-ED application.

## Prerequisites
- Google account
- Access to Firebase Console (https://console.firebase.google.com)

---

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **"Add project"** or **"Create a project"**
3. Enter project name: `waste-ed-smart-waste` (or your preferred name)
4. **Disable Google Analytics** (not needed for this project) or leave it enabled
5. Click **"Create project"** and wait for it to complete
6. Click **"Continue"** when done

---

## Step 2: Enable Cloud Storage

1. In your Firebase project, go to **Build** > **Storage** in the left sidebar
2. Click **"Get started"**
3. Choose **"Start in production mode"** (we'll set custom rules)
4. Click **"Next"**
5. Select your **Cloud Storage location** (choose closest to your users):
   - `asia-southeast1` (Singapore) - Recommended for Philippines
   - `us-central1` (Iowa) - Good default
   - `europe-west1` (Belgium) - For European users
6. Click **"Done"**

---

## Step 3: Set Storage Security Rules

1. In **Storage**, click on the **"Rules"** tab
2. Replace the default rules with the rules from `/firebase-storage.rules` file
3. Click **"Publish"** to apply the rules

**Quick Rule Options:**

**Option A: Public Read (Recommended for simplicity)**
```
allow read: if true;  // Anyone can read videos
allow write: if false; // Only backend can upload
```

**Option B: Authenticated Only**
```
allow read: if request.auth != null;  // Only logged-in users
allow write: if false;
```

---

## Step 4: Get Firebase Admin SDK Credentials (Backend)

1. In Firebase Console, click **⚙️ Settings** > **Project settings**
2. Go to **"Service accounts"** tab
3. Click **"Generate new private key"**
4. Click **"Generate key"** - A JSON file will download
5. Open the downloaded JSON file

6. Add these values to `/server/.env`:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Key-Here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/...
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
```

**Important:** Keep this file secure! Never commit it to git.

---

## Step 5: Get Firebase Client SDK Credentials (Frontend)

1. In Firebase Console, click **⚙️ Settings** > **Project settings**
2. Scroll down to **"Your apps"** section
3. Click the **Web icon** `</>` to add a web app
4. Enter app nickname: `waste-ed-web-app`
5. **Do NOT** enable Firebase Hosting
6. Click **"Register app"**
7. Copy the configuration values

8. Create `/client/.env` file and add:

```env
VITE_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

---

## Step 6: Create Storage Folder Structure

1. In Firebase Console > **Storage**
2. Click **"Create folder"** and name it: `videos`
3. Inside `videos`, create three subfolders:
   - `wet-wastes`
   - `dry-wastes`
   - `recyclable-wastes`

Your structure should look like:
```
videos/
  ├── wet-wastes/
  ├── dry-wastes/
  └── recyclable-wastes/
```

---

## Step 7: Upload Initial Videos (Optional)

You can upload test videos now or later via the API:

1. Go to **Storage** > `videos/wet-wastes/`
2. Click **"Upload file"**
3. Select a video file (MP4 recommended)
4. Repeat for other waste types

**Recommended video specs:**
- Format: MP4 (H.264 codec)
- Resolution: 720p or 1080p
- Duration: 30-60 seconds
- File size: Under 50MB

---

## Step 8: Test Firebase Connection

1. Update your `.env` files with the credentials
2. Restart your backend server:
   ```bash
   cd server
   npm start
   ```
3. You should see: ✓ Firebase initialized (in green)

4. Test frontend (in browser console):
   ```javascript
   // Open your app, then in browser console:
   console.log('Testing Firebase...');
   ```

---

## Step 9: Set Usage Limits (Recommended)

To avoid unexpected charges:

1. Go to **⚙️ Settings** > **Usage and billing**
2. Set up **Budget alerts**:
   - Alert at: 50%, 90%, 100% of budget
   - Monthly budget: $5-10 (should be more than enough)

**Free tier includes:**
- 5GB storage
- 1GB/day downloads
- 20K/day uploads

This should be sufficient for your use case.

---

## Troubleshooting

### Error: "Permission denied" when accessing videos
- Check Storage Rules are set to `allow read: if true;`
- Verify video is in correct folder structure

### Error: "Firebase not initialized"
- Check all environment variables are set correctly
- Ensure private key has `\n` newlines preserved
- Restart server after updating .env

### Videos not loading in frontend
- Check browser console for CORS errors
- Verify bucket name is correct
- Ensure videos are publicly readable

### Backend can't upload videos
- Verify service account has "Storage Admin" role
- Check private key format in .env
- Ensure storage bucket name is correct

---

## Security Notes

1. **Never commit** `.env` files or service account JSON to git
2. Use `.gitignore` to exclude sensitive files
3. Rotate service account keys periodically
4. Monitor Firebase usage dashboard regularly
5. Set up billing alerts to avoid surprises

---

## Next Steps

After Firebase is set up:
1. Test video upload via backend API (we'll create this endpoint)
2. Create video mapping entries in database
3. Test notification system with video playback
4. Upload production videos for each waste type

---

## Need Help?

- Firebase Documentation: https://firebase.google.com/docs/storage
- Firebase Console: https://console.firebase.google.com
- Storage Pricing: https://firebase.google.com/pricing
