import express from 'express';
import { prisma, retryOperation } from '../../utils/database.js';
import { uploadVideo, deleteVideo, listVideosByWasteType, getSignedVideoUrl } from '../../utils/firebase.js';
import multer from 'multer';

const router = express.Router();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept video files only
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'), false);
    }
  }
});

// GET /api/video/mapping - Get all video mappings
router.get('/mapping', async (req, res) => {
  try {
    const mappings = await retryOperation(async () => {
      return await prisma.videoMapping.findMany({
        orderBy: { wasteType: 'asc' }
      });
    });

    res.json({
      success: true,
      data: mappings
    });
  } catch (error) {
    console.error('Error fetching video mappings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch video mappings',
      error: error.message
    });
  }
});

// GET /api/video/mapping/:wasteType - Get video for specific waste type
router.get('/mapping/:wasteType', async (req, res) => {
  try {
    const { wasteType } = req.params;
    const normalizedType = wasteType.toUpperCase();

    const mapping = await retryOperation(async () => {
      return await prisma.videoMapping.findUnique({
        where: { wasteType: normalizedType }
      });
    });

    if (!mapping) {
      return res.status(404).json({
        success: false,
        message: `No video mapping found for ${wasteType}`
      });
    }

    res.json({
      success: true,
      data: mapping
    });
  } catch (error) {
    console.error('Error fetching video mapping:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch video mapping',
      error: error.message
    });
  }
});

// POST /api/video/upload - Upload video for waste type
router.post('/upload', upload.single('video'), async (req, res) => {
  try {
    const { wasteType, thumbnail, duration } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No video file provided'
      });
    }

    if (!wasteType) {
      return res.status(400).json({
        success: false,
        message: 'Waste type is required'
      });
    }

    const normalizedType = wasteType.toUpperCase();
    const validTypes = ['WET', 'DRY', 'RECYCLABLE'];

    if (!validTypes.includes(normalizedType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid waste type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    // Upload to Firebase
    const { videoUrl, videoPath } = await uploadVideo(
      req.file.buffer,
      normalizedType,
      req.file.originalname
    );

    // Check if mapping already exists
    const existing = await retryOperation(async () => {
      return await prisma.videoMapping.findUnique({
        where: { wasteType: normalizedType }
      });
    });

    let mapping;

    if (existing) {
      // Delete old video from Firebase if exists
      try {
        await deleteVideo(existing.videoPath);
      } catch (error) {
        console.warn('Could not delete old video:', error.message);
      }

      // Update existing mapping
      mapping = await retryOperation(async () => {
        return await prisma.videoMapping.update({
          where: { wasteType: normalizedType },
          data: {
            videoUrl,
            videoPath,
            thumbnail,
            duration: duration ? parseInt(duration) : null
          }
        });
      });
    } else {
      // Create new mapping
      mapping = await retryOperation(async () => {
        return await prisma.videoMapping.create({
          data: {
            wasteType: normalizedType,
            videoUrl,
            videoPath,
            thumbnail,
            duration: duration ? parseInt(duration) : null
          }
        });
      });
    }

    res.status(201).json({
      success: true,
      message: 'Video uploaded successfully',
      data: mapping
    });
  } catch (error) {
    console.error('Error uploading video:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload video',
      error: error.message
    });
  }
});

// PUT /api/video/update/:wasteType - Update video mapping metadata
router.put('/update/:wasteType', async (req, res) => {
  try {
    const { wasteType } = req.params;
    const { thumbnail, duration, videoUrl, videoPath } = req.body;

    const normalizedType = wasteType.toUpperCase();

    const updateData = {};
    if (thumbnail !== undefined) updateData.thumbnail = thumbnail;
    if (duration !== undefined) updateData.duration = parseInt(duration);
    if (videoUrl !== undefined) updateData.videoUrl = videoUrl;
    if (videoPath !== undefined) updateData.videoPath = videoPath;

    const updated = await retryOperation(async () => {
      return await prisma.videoMapping.update({
        where: { wasteType: normalizedType },
        data: updateData
      });
    });

    res.json({
      success: true,
      message: 'Video mapping updated successfully',
      data: updated
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Video mapping not found'
      });
    }

    console.error('Error updating video mapping:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update video mapping',
      error: error.message
    });
  }
});

// DELETE /api/video/delete/:wasteType - Delete video and mapping
router.delete('/delete/:wasteType', async (req, res) => {
  try {
    const { wasteType } = req.params;
    const normalizedType = wasteType.toUpperCase();

    // Get mapping first
    const mapping = await retryOperation(async () => {
      return await prisma.videoMapping.findUnique({
        where: { wasteType: normalizedType }
      });
    });

    if (!mapping) {
      return res.status(404).json({
        success: false,
        message: 'Video mapping not found'
      });
    }

    // Delete from Firebase
    try {
      await deleteVideo(mapping.videoPath);
    } catch (error) {
      console.warn('Could not delete video from Firebase:', error.message);
    }

    // Delete mapping from database
    await retryOperation(async () => {
      return await prisma.videoMapping.delete({
        where: { wasteType: normalizedType }
      });
    });

    res.json({
      success: true,
      message: 'Video and mapping deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete video',
      error: error.message
    });
  }
});

// GET /api/video/list/:wasteType - List all videos in Firebase for waste type
router.get('/list/:wasteType', async (req, res) => {
  try {
    const { wasteType } = req.params;
    const normalizedType = wasteType.toUpperCase();

    const videos = await listVideosByWasteType(normalizedType);

    res.json({
      success: true,
      data: {
        wasteType: normalizedType,
        videos,
        count: videos.length
      }
    });
  } catch (error) {
    console.error('Error listing videos:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list videos',
      error: error.message
    });
  }
});

// GET /api/video/signed-url/:wasteType - Get signed URL for private access
router.get('/signed-url/:wasteType', async (req, res) => {
  try {
    const { wasteType } = req.params;
    const { expiresIn = 60 } = req.query;
    const normalizedType = wasteType.toUpperCase();

    const mapping = await retryOperation(async () => {
      return await prisma.videoMapping.findUnique({
        where: { wasteType: normalizedType }
      });
    });

    if (!mapping) {
      return res.status(404).json({
        success: false,
        message: 'Video mapping not found'
      });
    }

    const signedUrl = await getSignedVideoUrl(mapping.videoPath, parseInt(expiresIn));

    res.json({
      success: true,
      data: {
        url: signedUrl,
        expiresIn: parseInt(expiresIn)
      }
    });
  } catch (error) {
    console.error('Error getting signed URL:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get signed URL',
      error: error.message
    });
  }
});

export default router;
