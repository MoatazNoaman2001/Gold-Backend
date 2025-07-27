import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { authenticateUser } from '../middlewares/auth.js';
import { MediaProcessorService } from '../Infrastructure/Services/MediaProcessorService.js';
import { LocalStorageService } from '../Infrastructure/Services/StorageService.js';
import { MongoMediaRepository } from '../Infrastructure/Repositories/MongoMediaRepository.js';
import { UploadMediaUseCase } from '../Application/UseCases/UploadMediaUseCase.js';
import { SendMediaMessageUseCase } from '../Application/UseCases/SendMediaMessageUseCase.js';
import { MEDIA_CONFIG } from '../Domain/ValueObjects/MediaConfiguration.js';

const router = express.Router();

// Configure multer for HTTP uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      ...MEDIA_CONFIG.ALLOWED_TYPES.image,
      ...MEDIA_CONFIG.ALLOWED_TYPES.audio,
      ...MEDIA_CONFIG.ALLOWED_TYPES.video
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  }
});

// Serve media files with authentication
router.get('/media/:filename', authenticateUser, async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Security: Prevent path traversal
    const sanitizedFilename = path.basename(filename);
    
    // Determine file type and path
    let filePath;
    const extension = path.extname(sanitizedFilename).toLowerCase();
    
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(extension)) {
      filePath = path.join(MEDIA_CONFIG.STORAGE_PATHS.image, sanitizedFilename);
    } else if (['.mp3', '.wav', '.ogg', '.m4a', '.webm'].includes(extension)) {
      filePath = path.join(MEDIA_CONFIG.STORAGE_PATHS.audio, sanitizedFilename);
    } else if (['.mp4', '.webm', '.ogg', '.mov'].includes(extension)) {
      filePath = path.join(MEDIA_CONFIG.STORAGE_PATHS.video, sanitizedFilename);
    } else {
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Verify user has access to this media
    const mediaMessage = await MediaMessageModel.findOne({
      $or: [
        { content: { $regex: sanitizedFilename } },
        { mediaUrl: { $regex: sanitizedFilename } }
      ],
      $and: [
        {
          $or: [
            { senderId: req.user._id },
            { receiverId: req.user._id }
          ]
        }
      ]
    });

    if (!mediaMessage) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Set appropriate headers
    const mimeType = mediaMessage.mediaMetadata?.mimeType || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'private, max-age=86400'); // 24 hours
    
    // Support range requests for audio/video streaming
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range && (mimeType.startsWith('audio/') || mimeType.startsWith('video/'))) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      
      const stream = fs.createReadStream(filePath, { start, end });
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': mimeType
      });
      
      stream.pipe(res);
    } else {
      res.setHeader('Content-Length', fileSize);
      fs.createReadStream(filePath).pipe(res);
    }

  } catch (error) {
    console.error('Media serving error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve thumbnails
router.get('/thumbnails/:filename', authenticateUser, async (req, res) => {
  try {
    const { filename } = req.params;
    const sanitizedFilename = path.basename(filename);
    const filePath = path.join(MEDIA_CONFIG.STORAGE_PATHS.thumbnails, sanitizedFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Thumbnail not found' });
    }

    // Verify access
    const mediaMessage = await MediaMessageModel.findOne({
      thumbnailUrl: { $regex: sanitizedFilename },
      $or: [
        { senderId: req.user._id },
        { receiverId: req.user._id }
      ]
    });

    if (!mediaMessage) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=604800'); // 7 days
    fs.createReadStream(filePath).pipe(res);

  } catch (error) {
    console.error('Thumbnail serving error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload endpoint for direct HTTP uploads (alternative to socket)
router.post('/upload', authenticateUser, upload.single('media'), async (req, res) => {
  try {
    const { conversationId, receiverId, type } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Initialize services (in production, these should be injected via DI container)
    const mediaProcessor = new MediaProcessorService();
    const storageService = new LocalStorageService();
    const mediaRepository = new MongoMediaRepository();
    
    const uploadMediaUseCase = new UploadMediaUseCase(
      mediaRepository,
      mediaProcessor,
      storageService
    );

    const sendMediaMessageUseCase = new SendMediaMessageUseCase(
      uploadMediaUseCase,
      mediaRepository,
      {
        publish: async (event, data) => {
          // Import getChatIO dynamically to avoid circular dependencies
          const { getChatIO } = await import('../sockets/enhancedSocketService.js');
          const io = getChatIO();
          io.emit(event, data);
        }
      }
    );

    // Process upload
    const message = await sendMediaMessageUseCase.execute({
      file,
      senderId: req.user._id,
      receiverId,
      conversationId,
      type
    });

    res.json({
      status: 'success',
      message,
      mediaUrl: message.mediaUrl,
      thumbnailUrl: message.thumbnailUrl
    });

  } catch (error) {
    console.error('HTTP upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;