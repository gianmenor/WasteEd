import express from 'express';

const router = express.Router();

// Store active SSE connections
const activeConnections = new Set();

// SSE endpoint for real-time bin notifications
router.get('/stream', (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send initial connection message
  res.write('data: {"type":"connected","message":"SSE connection established"}\n\n');

  // Add connection to active set
  activeConnections.add(res);
  console.log(`SSE connection opened. Active connections: ${activeConnections.size}`);

  // Handle client disconnect
  req.on('close', () => {
    activeConnections.delete(res);
    console.log(`SSE connection closed. Active connections: ${activeConnections.size}`);
  });

  req.on('aborted', () => {
    activeConnections.delete(res);
    console.log(`SSE connection aborted. Active connections: ${activeConnections.size}`);
  });
});

// Function to broadcast bin notification to all connected clients
export const broadcastBinNotification = (binRecord) => {
  if (activeConnections.size === 0) {
    console.log('No active SSE connections to broadcast to');
    return;
  }

  // Send the raw bin record so client can validate and format it
  const eventData = `data: ${JSON.stringify(binRecord)}\n\n`;
  
  console.log(`Broadcasting bin notification to ${activeConnections.size} connections`);
  
  // Send to all active connections
  activeConnections.forEach(connection => {
    try {
      connection.write(eventData);
    } catch (error) {
      console.error('Error sending SSE message:', error);
      activeConnections.delete(connection);
    }
  });
};

export default router;