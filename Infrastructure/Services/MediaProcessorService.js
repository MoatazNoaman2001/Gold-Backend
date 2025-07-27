import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import { MEDIA_CONFIG } from '../../Domain/ValueObjects/MediaConfiguration.js';

export class MediaProcessorService {
  async process(file, type) {
    switch (type) {
      case 'image':
        return await this.processImage(file);
      case 'audio':
        return await this.processAudio(file);
      case 'video':
        return await this.processVideo(file);
      default:
        throw new Error(`Unsupported media type: ${type}`);
    }
  }

  async processImage(file) {
    const config = MEDIA_CONFIG.COMPRESSION.image;
    console.log(`start process image`);
    
    const processedBuffer = await sharp(file.buffer)
      .resize(config.maxWidth, config.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: config.quality * 100 })
      .toBuffer();

    const metadata = await sharp(processedBuffer).metadata();
    
    return {
      buffer: processedBuffer,
      dimensions: {
        width: metadata.width,
        height: metadata.height
      },
      compressionSettings: {
        quality: config.quality,
        format: 'jpeg'
      }
    };
  }

  async processAudio(file) {
    return new Promise((resolve, reject) => {
      const tempPath = `/tmp/${Date.now()}_${file.originalname}`;
      const outputPath = `/tmp/${Date.now()}_compressed.mp3`;
      
      // Write buffer to temp file
      fs.writeFileSync(tempPath, file.buffer);
      
      ffmpeg(tempPath)
        .audioBitrate(MEDIA_CONFIG.COMPRESSION.audio.bitrate)
        .format('mp3')
        .on('end', async () => {
          try {
            const buffer = await fs.readFile(outputPath);
            
            // Get duration
            ffmpeg.ffprobe(outputPath, (err, metadata) => {
              if (err) return reject(err);
              
              // Cleanup temp files
              fs.unlinkSync(tempPath);
              fs.unlinkSync(outputPath);
              
              resolve({
                buffer,
                duration: metadata.format.duration,
                compressionSettings: {
                  bitrate: MEDIA_CONFIG.COMPRESSION.audio.bitrate,
                  format: 'mp3'
                }
              });
            });
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject)
        .save(outputPath);
    });
  }

  async processVideo(file) {
    return new Promise((resolve, reject) => {
      const tempPath = `/tmp/${Date.now()}_${file.originalname}`;
      const outputPath = `/tmp/${Date.now()}_compressed.mp4`;
      const thumbnailPath = `/tmp/${Date.now()}_thumb.jpg`;
      
      fs.writeFileSync(tempPath, file.buffer);
      
      ffmpeg(tempPath)
        .videoBitrate(MEDIA_CONFIG.COMPRESSION.video.bitrate)
        .size('1280x720')
        .format('mp4')
        .screenshots({
          timestamps: ['00:00:01'],
          filename: path.basename(thumbnailPath),
          folder: path.dirname(thumbnailPath)
        })
        .on('end', async () => {
          try {
            const buffer = await fs.readFile(outputPath);
            const thumbnailBuffer = await fs.readFile(thumbnailPath);
            
            // Save thumbnail
            const thumbnailFilename = `thumb_${Date.now()}.jpg`;
            const thumbnailSavePath = path.join(MEDIA_CONFIG.STORAGE_PATHS.thumbnails, thumbnailFilename);
            await fs.writeFile(thumbnailSavePath, thumbnailBuffer);
            
            ffmpeg.ffprobe(outputPath, (err, metadata) => {
              if (err) return reject(err);
              
              // Cleanup
              fs.unlinkSync(tempPath);
              fs.unlinkSync(outputPath);
              fs.unlinkSync(thumbnailPath);
              
              resolve({
                buffer,
                duration: metadata.format.duration,
                dimensions: {
                  width: metadata.streams[0].width,
                  height: metadata.streams[0].height
                },
                thumbnailPath: thumbnailSavePath,
                compressionSettings: {
                  bitrate: MEDIA_CONFIG.COMPRESSION.video.bitrate,
                  resolution: '720p',
                  format: 'mp4'
                }
              });
            });
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject)
        .save(outputPath);
    });
  }
}