#!/usr/bin/env node

import express from 'express';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.IMAGE_SERVER_PORT || 5178;
const DATA_DIR = process.env.VITE_LOCAL_DATA_DIR || path.join(process.cwd(), '.data');
const SERVER_BASE = process.env.VITE_LOCAL_SERVER_BASE || `http://localhost:${PORT}`;

// Enable CORS for all routes
app.use(cors());

// Serve static files for galaxy images
app.get('/:galaxyId/:imageName', (req, res) => {
  const { galaxyId, imageName } = req.params;
  const { quality } = req.query;
  
  // Construct file path
  let filePath = path.join(DATA_DIR, galaxyId, imageName);
  
  // Handle quality parameter - you might have different subdirectories
  // or file naming conventions for different qualities
  if (quality && quality !== 'medium') {
    const qualityDir = path.join(DATA_DIR, quality, galaxyId);
    filePath = path.join(qualityDir, imageName);
  }
  
  // Security: ensure the file is within DATA_DIR
  const resolvedPath = path.resolve(filePath);
  const resolvedDataDir = path.resolve(DATA_DIR);
  
  if (!resolvedPath.startsWith(resolvedDataDir)) {
    return res.status(403).send('Access denied');
  }
  
  // Send the file
  res.sendFile(resolvedPath, (err) => {
    if (err) {
      console.error(`Error serving file ${resolvedPath}:`, err.message);
      res.status(404).send('Image not found');
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', dataDir: DATA_DIR });
});

app.listen(PORT, () => {
  console.log(`Image server running on ${SERVER_BASE}`);
  console.log(`Serving images from: ${DATA_DIR}`);
  console.log(`Example: ${SERVER_BASE}/galaxy123/image.fits`);
});
