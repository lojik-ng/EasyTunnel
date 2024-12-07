import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { TunnelRequest, TunnelResponse, ClientConnection, JWTPayload } from './types';
import logger from './utils/logger';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['*']
}));
app.use(express.json());

// Store client connection
let activeClient: ClientConnection | null = null;

// Authentication middleware for Socket.IO
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    logger.error('Authentication failed: No token provided', { socketId: socket.id });
    return next(new Error('Authentication token required'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as JWTPayload;
    
    // Validate token payload
    if (!decoded.clientId || decoded.type !== 'tunnel-client') {
      logger.error('Authentication failed: Invalid token payload', { 
        socketId: socket.id,
        payload: decoded 
      });
      return next(new Error('Invalid token payload'));
    }

    socket.data.clientId = decoded.clientId;
    logger.info('Client authenticated successfully', { 
      clientId: decoded.clientId, 
      socketId: socket.id,
      tokenType: decoded.type
    });
    next();
  } catch (err) {
    logger.error('Authentication failed: Token verification error', { 
      socketId: socket.id, 
      error: err,
      token: token.substring(0, 10) + '...' // Log only the beginning of the token for debugging
    });
    next(new Error('Invalid token'));
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info('Client connected', { clientId: socket.data.clientId, socketId: socket.id });

  // Only allow one active client
  if (activeClient) {
    logger.warn('Connection rejected: Another client is already connected', {
      existingClientId: activeClient.socket.data.clientId,
      newClientId: socket.data.clientId
    });
    socket.emit('error', 'Another client is already connected');
    socket.disconnect();
    return;
  }

  activeClient = {
    socket,
    authenticated: true,
    lastHeartbeat: Date.now()
  };

  // Handle heartbeat
  socket.on('heartbeat', () => {
    if (activeClient) {
      activeClient.lastHeartbeat = Date.now();
      socket.emit('heartbeat_ack');
      logger.debug('Heartbeat received', { clientId: socket.data.clientId });
    }
  });

  // Handle tunnel response
  socket.on('tunnel_response', (response: TunnelResponse) => {
    logger.debug('Received tunnel response', {
      clientId: socket.data.clientId,
      statusCode: response.statusCode
    });
  });

  socket.on('disconnect', () => {
    logger.info('Client disconnected', { clientId: socket.data.clientId, socketId: socket.id });
    if (activeClient?.socket.id === socket.id) {
      activeClient = null;
    }
  });

  socket.on('error', (error) => {
    logger.error('Socket error', { clientId: socket.data.clientId, error });
  });
});

// HTTP request handling
app.all('*', async (req, res) => {
  if (!activeClient) {
    logger.error('Request failed: No tunnel client connected', {
      method: req.method,
      path: req.path
    });
    return res.status(503).json({ error: 'Tunnel client not connected' });
  }

  const tunnelRequest: TunnelRequest = {
    method: req.method,
    path: req.path,
    headers: req.headers as Record<string, string>,
    body: req.body
  };

  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    clientId: activeClient.socket.data.clientId
  });

  try {
    const responsePromise = new Promise<TunnelResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        logger.error('Request timeout', {
          method: req.method,
          path: req.path,
          clientId: activeClient?.socket.data.clientId
        });
        reject(new Error('Request timeout'));
      }, 30000);

      activeClient?.socket.emit('tunnel_request', tunnelRequest, (response: TunnelResponse) => {
        clearTimeout(timeout);
        resolve(response);
      });
    });

    const response = await responsePromise;

    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: response.statusCode,
      clientId: activeClient.socket.data.clientId
    });

    // Set response headers
    Object.entries(response.headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    res.status(response.statusCode).send(response.body);
  } catch (error) {
    logger.error('Error processing request', {
      method: req.method,
      path: req.path,
      error,
      clientId: activeClient.socket.data.clientId
    });
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

httpServer.listen(PORT, () => {
  logger.info(`Tunnel server listening on http://${HOST}:${PORT}`);
});
