import express from 'express';
import jwt from 'jsonwebtoken';
import { prisma, retryOperation } from '../../utils/database.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = await prisma.account.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid token. User not found.' });
    }

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role
    };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token.' });
  }
};

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }
};

// GET /api/inventory - Get all inventory items (public)
router.get('/', async (req, res) => {
  try {
    const { activeOnly = 'true' } = req.query;
    
    const where = activeOnly === 'true' ? { isActive: true } : {};
    
    const items = await retryOperation(async () => {
      return await prisma.inventoryItem.findMany({
        where,
        orderBy: { name: 'asc' }
      });
    });

    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('Error fetching inventory items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory items',
      error: error.message
    });
  }
});

// GET /api/inventory/:id - Get specific inventory item
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const item = await retryOperation(async () => {
      return await prisma.inventoryItem.findUnique({
        where: { id: parseInt(id) },
        include: {
          redemptions: {
            orderBy: { createdAt: 'desc' },
            take: 10
          }
        }
      });
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    res.json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error('Error fetching inventory item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory item',
      error: error.message
    });
  }
});

// POST /api/inventory - Create new inventory item (admin only)
router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const { name, description, cost, stock, isActive } = req.body;

    if (!name || cost === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Name and cost are required'
      });
    }

    if (cost < 1) {
      return res.status(400).json({
        success: false,
        message: 'Cost must be at least 1 coupon'
      });
    }

    const item = await retryOperation(async () => {
      return await prisma.inventoryItem.create({
        data: {
          name,
          description: description || null,
          cost: parseInt(cost),
          stock: stock !== undefined ? parseInt(stock) : 0,
          isActive: isActive !== undefined ? isActive : true
        }
      });
    });

    res.status(201).json({
      success: true,
      data: item,
      message: 'Inventory item created successfully'
    });
  } catch (error) {
    console.error('Error creating inventory item:', error);
    
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'An item with this name already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create inventory item',
      error: error.message
    });
  }
});

// PATCH /api/inventory/:id - Update inventory item (admin only)
router.patch('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, cost, stock, isActive } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (cost !== undefined) {
      if (cost < 1) {
        return res.status(400).json({
          success: false,
          message: 'Cost must be at least 1 coupon'
        });
      }
      updateData.cost = parseInt(cost);
    }
    if (stock !== undefined) updateData.stock = parseInt(stock);
    if (isActive !== undefined) updateData.isActive = isActive;

    const item = await retryOperation(async () => {
      return await prisma.inventoryItem.update({
        where: { id: parseInt(id) },
        data: updateData
      });
    });

    res.json({
      success: true,
      data: item,
      message: 'Inventory item updated successfully'
    });
  } catch (error) {
    console.error('Error updating inventory item:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'An item with this name already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update inventory item',
      error: error.message
    });
  }
});

// PATCH /api/inventory/:id/stock - Adjust stock (admin only)
router.patch('/:id/stock', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { adjustment } = req.body;

    if (adjustment === undefined || typeof adjustment !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Adjustment amount is required and must be a number'
      });
    }

    const item = await retryOperation(async () => {
      const currentItem = await prisma.inventoryItem.findUnique({
        where: { id: parseInt(id) }
      });

      if (!currentItem) {
        throw new Error('Item not found');
      }

      const newStock = currentItem.stock + parseInt(adjustment);
      
      if (newStock < 0) {
        throw new Error('Stock cannot be negative');
      }

      return await prisma.inventoryItem.update({
        where: { id: parseInt(id) },
        data: { stock: newStock }
      });
    });

    res.json({
      success: true,
      data: item,
      message: `Stock ${adjustment > 0 ? 'increased' : 'decreased'} by ${Math.abs(adjustment)}`
    });
  } catch (error) {
    console.error('Error adjusting stock:', error);
    
    if (error.message === 'Item not found') {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    if (error.message === 'Stock cannot be negative') {
      return res.status(400).json({
        success: false,
        message: 'Stock cannot be negative'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to adjust stock',
      error: error.message
    });
  }
});

// DELETE /api/inventory/:id - Delete inventory item (admin only)
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await retryOperation(async () => {
      return await prisma.inventoryItem.delete({
        where: { id: parseInt(id) }
      });
    });

    res.json({
      success: true,
      message: 'Inventory item deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to delete inventory item',
      error: error.message
    });
  }
});

// POST /api/inventory/:id/redeem - Redeem an item with coupons
router.post('/:id/redeem', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity = 1, notes } = req.body;

    if (quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1'
      });
    }

    const result = await retryOperation(async () => {
      return await prisma.$transaction(async (tx) => {
        // Get the item
        const item = await tx.inventoryItem.findUnique({
          where: { id: parseInt(id) }
        });

        if (!item) {
          throw new Error('Item not found');
        }

        if (!item.isActive) {
          throw new Error('Item is not available for redemption');
        }

        if (item.stock < quantity) {
          throw new Error('Insufficient stock');
        }

        // Get current coupon balance
        const coupon = await tx.coupon.findFirst({
          orderBy: { id: 'desc' }
        });

        if (!coupon) {
          throw new Error('Coupon system not initialized');
        }

        const totalCost = item.cost * parseInt(quantity);

        if (coupon.balance < totalCost) {
          throw new Error('Insufficient coupon balance');
        }

        // Update coupon balance
        const updatedCoupon = await tx.coupon.update({
          where: { id: coupon.id },
          data: {
            balance: coupon.balance - totalCost,
            used: coupon.used + totalCost
          }
        });

        // Record coupon transaction
        await tx.couponTransaction.create({
          data: {
            type: 'USE',
            amount: -totalCost,
            balance: updatedCoupon.balance,
            reason: `Redeemed ${quantity}x ${item.name}`,
            notes: notes || null
          }
        });

        // Update item stock
        const updatedItem = await tx.inventoryItem.update({
          where: { id: parseInt(id) },
          data: { stock: item.stock - parseInt(quantity) }
        });

        // Record redemption
        const redemption = await tx.inventoryRedemption.create({
          data: {
            itemId: parseInt(id),
            quantity: parseInt(quantity),
            totalCost,
            notes: notes || null
          }
        });

        return {
          redemption,
          item: updatedItem,
          newBalance: updatedCoupon.balance
        };
      });
    });

    res.json({
      success: true,
      data: result,
      message: `Successfully redeemed ${quantity}x ${result.item.name}`
    });
  } catch (error) {
    console.error('Error redeeming item:', error);
    
    if (error.message === 'Item not found') {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    if (error.message === 'Item is not available for redemption') {
      return res.status(400).json({
        success: false,
        message: 'This item is not available for redemption'
      });
    }

    if (error.message === 'Insufficient stock') {
      return res.status(400).json({
        success: false,
        message: 'Not enough items in stock'
      });
    }

    if (error.message === 'Insufficient coupon balance') {
      return res.status(400).json({
        success: false,
        message: 'Not enough coupons to redeem this item'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to redeem item',
      error: error.message
    });
  }
});

// GET /api/inventory/redemptions/history - Get redemption history
router.get('/redemptions/history', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [redemptions, total] = await Promise.all([
      retryOperation(async () => {
        return await prisma.inventoryRedemption.findMany({
          include: {
            item: {
              select: {
                name: true,
                description: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum
        });
      }),
      retryOperation(async () => {
        return await prisma.inventoryRedemption.count();
      })
    ]);

    res.json({
      success: true,
      data: {
        redemptions,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching redemption history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch redemption history',
      error: error.message
    });
  }
});

export default router;
