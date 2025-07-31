// utils/mediaUtils.js
import { createCanvas } from 'canvas';
import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { fileTypeFromBuffer } from 'file-type';

// Media configuration
const MEDIA_CONFIG = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm'],
  ALLOWED_AUDIO_TYPES: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm'],
  UPLOAD_DIR: process.env.MEDIA_UPLOAD_DIR || './uploads',
  MAX_AUDIO_DURATION: 300, // 5 minutes
  MAX_VIDEO_DURATION: 600, // 10 minutes
  MAX_IMAGE_WIDTH: 4096,
  MAX_IMAGE_HEIGHT: 4096,
  THUMBNAIL_WIDTH: 320,
  THUMBNAIL_HEIGHT: 240,
};

/**
 * Validate uploaded media file
 * @param {Buffer} buffer - File buffer
 * @param {string} mimeType - MIME type from client
 * @param {string} fileName - Original filename
 * @returns {Object} Validation result
 */
// export async function validateMediaFile(buffer, mimeType, fileName) {
//   try {
//     // Check file size
//     if (buffer.length > MEDIA_CONFIG.MAX_FILE_SIZE) {
//       return {
//         isValid: false,
//         error: `File size exceeds maximum limit of ${MEDIA_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`
//       };
//     }

//     // Detect actual file type from buffer
//     const detectedType = await fileTypeFromBuffer(buffer);
//     if (!detectedType) {
//       return {
//         isValid: false,
//         error: 'Unable to determine file type'
//       };
//     }

//     // Verify MIME type matches detected type
//     if (detectedType.mime !== mimeType) {
//       return {
//         isValid: false,
//         error: `MIME type mismatch. Expected: ${mimeType}, Detected: ${detectedType.mime}`
//       };
//     }

//     // Determine media type and validate
//     let mediaType, resourceType;
//     if (MEDIA_CONFIG.ALLOWED_IMAGE_TYPES.includes(mimeType)) {
//       mediaType = 'image';
//       resourceType = 'image';
//     } else if (MEDIA_CONFIG.ALLOWED_VIDEO_TYPES.includes(mimeType)) {
//       mediaType = 'video';
//       resourceType = 'video';
//     } else if (MEDIA_CONFIG.ALLOWED_AUDIO_TYPES.includes(mimeType)) {
//       mediaType = 'audio';
//       resourceType = 'video'; // Cloudinary treats audio as video resource
//     } else {
//       return {
//         isValid: false,
//         error: `Unsupported file type: ${mimeType}`
//       };
//     }

//     // Additional validation based on media type
//     const additionalValidation = await validateSpecificMediaType(buffer, mediaType, mimeType);
//     if (!additionalValidation.isValid) {
//       return additionalValidation;
//     }

//     return {
//       isValid: true,
//       mediaType,
//       resourceType,
//       dimensions: additionalValidation.dimensions,
//       duration: additionalValidation.duration,
//       fileName: sanitizeFileName(fileName)
//     };

//   } catch (error) {
//     console.error('Error validating media file:', error);
//     return {
//       isValid: false,
//       error: 'File validation failed'
//     };
//   }
// }

export function validateMediaFile(buffer, mimeType, fileName) {
  // Check file size
  if (buffer.length > MEDIA_CONFIG.MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `File too large. Max size: ${MEDIA_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`
    };
  }

  // Check file type
  if (!MEDIA_CONFIG.ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    return {
      isValid: false,
      error: `Unsupported file type: ${mimeType}`
    };
  }

  // Determine media type
  let mediaType = 'file';
  if (mimeType.startsWith('image/')) {
    mediaType = 'image';
  } else if (mimeType.startsWith('video/')) {
    mediaType = 'video';
  }

  return {
    isValid: true,
    mediaType
  };
}

/**
 * Validate specific media type properties
 * @param {Buffer} buffer - File buffer
 * @param {string} mediaType - Type: image, video, or audio
 * @param {string} mimeType - MIME type
 * @returns {Object} Validation result with media-specific data
 */
async function validateSpecificMediaType(buffer, mediaType, mimeType) {
  try {
    switch (mediaType) {
      case 'image':
        return await validateImage(buffer);
      case 'video':
        return await validateVideo(buffer);
      case 'audio':
        return await validateAudio(buffer);
      default:
        return { isValid: false, error: 'Unknown media type' };
    }
  } catch (error) {
    console.error(`Error validating ${mediaType}:`, error);
    return { isValid: false, error: `${mediaType} validation failed` };
  }
}

/**
 * Validate image file
 * @param {Buffer} buffer - Image buffer
 * @returns {Object} Validation result
 */
async function validateImage(buffer) {
  try {
    const metadata = await sharp(buffer).metadata();
    
    if (metadata.width > MEDIA_CONFIG.MAX_IMAGE_WIDTH || 
        metadata.height > MEDIA_CONFIG.MAX_IMAGE_HEIGHT) {
      return {
        isValid: false,
        error: `Image dimensions too large. Maximum: ${MEDIA_CONFIG.MAX_IMAGE_WIDTH}x${MEDIA_CONFIG.MAX_IMAGE_HEIGHT}`
      };
    }

    return {
      isValid: true,
      dimensions: {
        width: metadata.width,
        height: metadata.height
      }
    };
  } catch (error) {
    return {
      isValid: false,
      error: 'Invalid image file'
    };
  }
}

/**
 * Validate video file
 * @param {Buffer} buffer - Video buffer
 * @returns {Object} Validation result
 */
async function validateVideo(buffer) {
  return new Promise((resolve) => {
    // Create temporary file for ffmpeg processing
    const tempPath = `/tmp/temp_video_${Date.now()}.tmp`;
    
    fs.writeFile(tempPath, buffer)
      .then(() => {
        ffmpeg.ffprobe(tempPath, (err, metadata) => {
          // Clean up temp file
          fs.unlink(tempPath).catch(console.error);

          if (err) {
            resolve({
              isValid: false,
              error: 'Invalid video file'
            });
            return;
          }

          const duration = metadata.format.duration;
          const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');

          if (duration > MEDIA_CONFIG.MAX_VIDEO_DURATION) {
            resolve({
              isValid: false,
              error: `Video duration exceeds maximum of ${MEDIA_CONFIG.MAX_VIDEO_DURATION} seconds`
            });
            return;
          }

          resolve({
            isValid: true,
            duration: Math.round(duration),
            dimensions: videoStream ? {
              width: videoStream.width,
              height: videoStream.height
            } : undefined
          });
        });
      })
      .catch(() => {
        resolve({
          isValid: false,
          error: 'Failed to process video file'
        });
      });
  });
}

/**
 * Validate audio file
 * @param {Buffer} buffer - Audio buffer
 * @returns {Object} Validation result
 */
async function validateAudio(buffer) {
  return new Promise((resolve) => {
    // Create temporary file for ffmpeg processing
    const tempPath = `/tmp/temp_audio_${Date.now()}.tmp`;
    
    fs.writeFile(tempPath, buffer)
      .then(() => {
        ffmpeg.ffprobe(tempPath, (err, metadata) => {
          // Clean up temp file
          fs.unlink(tempPath).catch(console.error);

          if (err) {
            resolve({
              isValid: false,
              error: 'Invalid audio file'
            });
            return;
          }

          const duration = metadata.format.duration;

          if (duration > MEDIA_CONFIG.MAX_AUDIO_DURATION) {
            resolve({
              isValid: false,
              error: `Audio duration exceeds maximum of ${MEDIA_CONFIG.MAX_AUDIO_DURATION} seconds`
            });
            return;
          }

          resolve({
            isValid: true,
            duration: Math.round(duration)
          });
        });
      })
      .catch(() => {
        resolve({
          isValid: false,
          error: 'Failed to process audio file'
        });
      });
  });
}

/**
 * Generate thumbnail for video
 * @param {string} videoUrl - Video URL
 * @returns {Promise<Object>} Cloudinary upload result for thumbnail
 */
export async function generateThumbnail(videoUrl) {
  return new Promise((resolve, reject) => {
    const tempThumbnailPath = `/tmp/thumbnail_${Date.now()}.jpg`;
    
    ffmpeg(videoUrl)
      .screenshots({
        timestamps: ['00:00:01'],
        filename: path.basename(tempThumbnailPath),
        folder: path.dirname(tempThumbnailPath),
        size: `${MEDIA_CONFIG.THUMBNAIL_WIDTH}x${MEDIA_CONFIG.THUMBNAIL_HEIGHT}`
      })
      .on('end', async () => {
        try {
          const thumbnailBuffer = await fs.readFile(tempThumbnailPath);
          
          // Upload thumbnail to Cloudinary
          const { uploadToCloudinary } = await import('./cloudinary.js');
          const result = await uploadToCloudinary(thumbnailBuffer, {
            folder: 'thumbnails',
            resource_type: 'image',
            transformation: [
              { width: MEDIA_CONFIG.THUMBNAIL_WIDTH, height: MEDIA_CONFIG.THUMBNAIL_HEIGHT, crop: 'fill' }
            ]
          });
          
          // Clean up temp file
          await fs.unlink(tempThumbnailPath);
          
          resolve(result);
        } catch (error) {
          await fs.unlink(tempThumbnailPath).catch(console.error);
          reject(error);
        }
      })
      .on('error', (err) => {
        fs.unlink(tempThumbnailPath).catch(console.error);
        reject(err);
      });
  });
}

/**
 * Compress image if needed
 * @param {Buffer} buffer - Image buffer
 * @param {number} maxWidth - Maximum width
 * @param {number} maxHeight - Maximum height
 * @param {number} quality - JPEG quality (1-100)
 * @returns {Promise<Buffer>} Compressed image buffer
 */
export async function compressImage(buffer, maxWidth = 1920, maxHeight = 1080, quality = 85) {
  try {
    const metadata = await sharp(buffer).metadata();
    
    // Check if compression is needed
    if (metadata.width <= maxWidth && metadata.height <= maxHeight && buffer.length < 2 * 1024 * 1024) {
      return buffer; // No compression needed
    }

    return await sharp(buffer)
      .resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality })
      .toBuffer();
  } catch (error) {
    console.error('Error compressing image:', error);
    return buffer; // Return original if compression fails
  }
}

/**
 * Extract audio waveform data for visualization
 * @param {string} audioUrl - Audio file URL
 * @returns {Promise<Array>} Waveform data points
 */
export async function extractWaveform(audioUrl) {
  return new Promise((resolve, reject) => {
    const tempPath = `/tmp/waveform_${Date.now()}.json`;
    
    ffmpeg(audioUrl)
      .audioFilters('aformat=channel_layouts=mono,asetnsamples=n=1024')
      .format('null')
      .output(tempPath)
      .on('end', async () => {
        try {
          // This is a simplified version - you might want to use a specialized library
          // for better waveform extraction like 'node-wav' or 'audio-waveform'
          const waveformData = await generateSimpleWaveform(audioUrl);
          resolve(waveformData);
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject)
      .run();
  });
}

/**
 * Generate simple waveform data
 * @param {string} audioUrl - Audio URL
 * @returns {Promise<Array>} Simple waveform data
 */
async function generateSimpleWaveform(audioUrl) {
  // This is a placeholder - implement actual waveform generation
  // based on your needs. You might want to use libraries like:
  // - peaks.js
  // - audiowaveform
  // - Or extract actual audio data with ffmpeg
  
  return Array.from({ length: 100 }, (_, i) => ({
    time: i,
    amplitude: Math.random() * 100
  }));
}

/**
 * Sanitize filename to prevent path traversal
 * @param {string} fileName - Original filename
 * @returns {string} Sanitized filename
 */
function sanitizeFileName(fileName) {
  // Remove path separators and dangerous characters
  const sanitized = fileName
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/^\.+/, '')
    .replace(/\.+$/, '')
    .trim();
  
  // Ensure filename is not empty and has reasonable length
  if (!sanitized || sanitized.length === 0) {
    return `file_${Date.now()}`;
  }
  
  if (sanitized.length > 255) {
    const ext = path.extname(sanitized);
    const name = path.basename(sanitized, ext);
    return name.substring(0, 255 - ext.length) + ext;
  }
  
  return sanitized;
}

/**
 * Get media info for display
 * @param {Object} mediaData - Media data from message
 * @returns {Object} Formatted media info
 */
export function getMediaDisplayInfo(mediaData) {
  const { mediaType, size, duration, dimensions, fileName } = mediaData;
  
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  let displayInfo = {
    fileName,
    size: formatFileSize(size),
    type: mediaType
  };
  
  if (duration) {
    displayInfo.duration = formatDuration(duration);
  }
  
  if (dimensions) {
    displayInfo.dimensions = `${dimensions.width}×${dimensions.height}`;
  }
  
  return displayInfo;
}

export async function saveMediaFile(buffer, fileName, mimeType) {
  try {
    // Generate unique filename
    const ext = path.extname(fileName);
    const timestamp = Date.now();
    const hash = crypto.randomBytes(6).toString('hex');
    const uniqueFileName = `${timestamp}_${hash}${ext}`;
    
    // Save file
    const filePath = path.join(MEDIA_CONFIG.UPLOAD_DIR, uniqueFileName);
    await fs.writeFile(filePath, buffer);
    
    // Generate URL
    const url = `${MEDIA_CONFIG.BASE_URL}/uploads/${uniqueFileName}`;
    
    return {
      url,
      filePath,
      fileName: uniqueFileName,
      originalName: fileName,
      size: buffer.length,
      mimeType
    };

  } catch (error) {
    console.error('Save file error:', error);
    throw new Error('Failed to save file');
  }
}

/**
 * Delete file
 */
export async function deleteMediaFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      await fs.unlink(filePath);
    }
  } catch (error) {
    console.error('Delete file error:', error);
  }
}
