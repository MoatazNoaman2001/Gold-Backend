import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { MEDIA_CONFIG } from '../../Domain/ValueObjects/MediaConfiguration.js';
import { MediaMessage } from '../../Domain/Entities/MediaMessage.js';
import { MediaMetadata } from '../../Domain/ValueObjects/MediaMetaData.js';

export class UploadMediaUseCase {
  constructor(mediaRepository, fileProcessor, storageService) {
    this.mediaRepository = mediaRepository;
    this.fileProcessor = fileProcessor;
    this.storageService = storageService;
  }

  async execute(command) {
    const { file, senderId, receiverId, conversationId, type } = command;
    
    // Validate file
    this.validateFile(file, type);
    
    console.log(`MEDIA_CONFIG: ${MEDIA_CONFIG.STORAGE_PATHS[type]}`);
    
    // Generate unique filename
    const filename = this.generateFilename(file, type);
    const filePath = path.join(MEDIA_CONFIG.STORAGE_PATHS[type], filename);
    
    console.log(`filePath: ${filePath}`);
    
    try {
      // Process media (compress, generate thumbnail, etc.)
      const processedMedia = await this.fileProcessor.process(file, type);
      
      console.log(`file Process: `);
      
      // Save to storage
      await this.storageService.save(filePath, processedMedia.buffer);
      
      console.log(`saved in media storage`);
      
      // Create metadata
      const metadata = MediaMetadata.fromFile(file, {
        duration: processedMedia.duration,
        dimensions: processedMedia.dimensions,
        thumbnail: processedMedia.thumbnailPath,
        compression: processedMedia.compressionSettings,
        originalSize: file.size
      });
      
      console.log(`medaDate: ${JSON.stringify(metadata)}`);
      
      // Create media message entity
      const mediaMessage = new MediaMessage({
        id: uuidv4(),
        senderId,
        receiverId,
        conversationId,
        type,
        content: filePath,
        mediaMetadata: metadata,
        status: 'uploaded'
      });
      
      // Save to repository
      await this.mediaRepository.save(mediaMessage);
      

      console.log(`mediaMessage: ${mediaMessage}`);
      
      return {
        mediaMessage,
        url: this.generatePublicUrl(filePath),
        thumbnailUrl: processedMedia.thumbnailPath ? 
          this.generatePublicUrl(processedMedia.thumbnailPath) : null
      };
      
    } catch (error) {
      // Clean up on failure
      await this.cleanup(filePath);
      throw new Error(`Media upload failed: ${error.message}`);
    }
  }

  validateFile(file, type) {
    const allowedTypes = MEDIA_CONFIG.ALLOWED_TYPES[type];
    const sizeLimit = MEDIA_CONFIG.SIZE_LIMITS[type];
    
    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`);
    }
    
    if (file.size > sizeLimit) {
      throw new Error(`File too large. Maximum size: ${sizeLimit / (1024 * 1024)}MB`);
    }
  }

  generateFilename(file, type) {
    const timestamp = Date.now();
    const randomId = uuidv4().substring(0, 8);
    const extension = path.extname(file.originalname);
    return `${type}_${timestamp}_${randomId}${extension}`;
  }

  generatePublicUrl(filePath) {
    return `/api/media/${path.basename(filePath)}`;
  }

  async cleanup(filePath) {
    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Cleanup failed:', error);
      }
    }
  }
}