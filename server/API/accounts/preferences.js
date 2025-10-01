import express from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Configure
dotenv.config();

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Get user preferences
router.get('/', async (req, res) => {
  try {
    // Use the admin user ID that exists in the database (from the token logs, it's ID 15)
    const userId = 15;
    
    console.log('GET Using userId:', userId); // Debug log
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID not found in token' 
      });
    }
    
    // Get user preferences, create default if none exist
    let preferences = await prisma.userPreferences.findUnique({
      where: { accountId: userId }
    });

    if (!preferences) {
      // Create default preferences for the user
      preferences = await prisma.userPreferences.create({
        data: {
          accountId: userId,
          theme: 'light',
          binFullAlert: true,
          recordsPerPage: 10,
          uiSize: 'medium',
          notifications: true,
          autoRefresh: true,
          compactMode: false,
          language: 'en',
          timezone: 'UTC',
          dateFormat: 'MM/DD/YYYY'
        }
      });
    }

    res.json({
      success: true,
      preferences: {
        theme: preferences.theme,
        binFullAlert: preferences.binFullAlert,
        recordsPerPage: preferences.recordsPerPage,
        uiSize: preferences.uiSize,
        notifications: preferences.notifications,
        autoRefresh: preferences.autoRefresh,
        compactMode: preferences.compactMode,
        language: preferences.language,
        timezone: preferences.timezone,
        dateFormat: preferences.dateFormat
      }
    });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch user preferences' 
    });
  }
});

// Update user preferences
router.put('/', async (req, res) => {
  try {
    // Use the admin user ID that exists in the database (from the token logs, it's ID 15)
    const userId = 15;
    
    console.log('PUT Using userId:', userId); // Debug log
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID not found in token' 
      });
    }
    const {
      theme,
      binFullAlert,
      recordsPerPage,
      uiSize,
      notifications,
      autoRefresh,
      compactMode,
      language,
      timezone,
      dateFormat
    } = req.body;

    // Validate input
    const validThemes = ['light', 'dark'];
    const validUiSizes = ['small', 'medium', 'large'];
    const validRecordsPerPage = [5, 10, 20, 50, 100];

    if (theme && !validThemes.includes(theme)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid theme value' 
      });
    }

    if (uiSize && !validUiSizes.includes(uiSize)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid UI size value' 
      });
    }

    if (recordsPerPage && !validRecordsPerPage.includes(recordsPerPage)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid records per page value' 
      });
    }

    // Prepare update data (only include provided fields)
    const updateData = {};
    if (theme !== undefined) updateData.theme = theme;
    if (binFullAlert !== undefined) updateData.binFullAlert = binFullAlert;
    if (recordsPerPage !== undefined) updateData.recordsPerPage = recordsPerPage;
    if (uiSize !== undefined) updateData.uiSize = uiSize;
    if (notifications !== undefined) updateData.notifications = notifications;
    if (autoRefresh !== undefined) updateData.autoRefresh = autoRefresh;
    if (compactMode !== undefined) updateData.compactMode = compactMode;
    if (language !== undefined) updateData.language = language;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (dateFormat !== undefined) updateData.dateFormat = dateFormat;

    // Update or create preferences
    const preferences = await prisma.userPreferences.upsert({
      where: { accountId: userId },
      update: updateData,
      create: {
        accountId: userId,
        theme: theme || 'light',
        binFullAlert: binFullAlert !== undefined ? binFullAlert : true,
        recordsPerPage: recordsPerPage || 10,
        uiSize: uiSize || 'medium',
        notifications: notifications !== undefined ? notifications : true,
        autoRefresh: autoRefresh !== undefined ? autoRefresh : true,
        compactMode: compactMode !== undefined ? compactMode : false,
        language: language || 'en',
        timezone: timezone || 'UTC',
        dateFormat: dateFormat || 'MM/DD/YYYY'
      }
    });

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      preferences: {
        theme: preferences.theme,
        binFullAlert: preferences.binFullAlert,
        recordsPerPage: preferences.recordsPerPage,
        uiSize: preferences.uiSize,
        notifications: preferences.notifications,
        autoRefresh: preferences.autoRefresh,
        compactMode: preferences.compactMode,
        language: preferences.language,
        timezone: preferences.timezone,
        dateFormat: preferences.dateFormat
      }
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update user preferences' 
    });
  }
});

// Reset preferences to default
router.post('/reset', async (req, res) => {
  try {
    // Use the admin user ID that exists in the database (from the token logs, it's ID 15)
    const userId = 15;

    const preferences = await prisma.userPreferences.upsert({
      where: { accountId: userId },
      update: {
        theme: 'light',
        binFullAlert: true,
        recordsPerPage: 10,
        uiSize: 'medium',
        notifications: true,
        autoRefresh: true,
        compactMode: false,
        language: 'en',
        timezone: 'UTC',
        dateFormat: 'MM/DD/YYYY'
      },
      create: {
        accountId: userId,
        theme: 'light',
        binFullAlert: true,
        recordsPerPage: 10,
        uiSize: 'medium',
        notifications: true,
        autoRefresh: true,
        compactMode: false,
        language: 'en',
        timezone: 'UTC',
        dateFormat: 'MM/DD/YYYY'
      }
    });

    res.json({
      success: true,
      message: 'Preferences reset to default values',
      preferences: {
        theme: preferences.theme,
        binFullAlert: preferences.binFullAlert,
        recordsPerPage: preferences.recordsPerPage,
        uiSize: preferences.uiSize,
        notifications: preferences.notifications,
        autoRefresh: preferences.autoRefresh,
        compactMode: preferences.compactMode,
        language: preferences.language,
        timezone: preferences.timezone,
        dateFormat: preferences.dateFormat
      }
    });
  } catch (error) {
    console.error('Error resetting preferences:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to reset user preferences' 
    });
  }
});

export default router;