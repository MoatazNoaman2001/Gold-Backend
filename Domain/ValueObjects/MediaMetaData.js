export class MediaMetadata {
    constructor({
        fileName,
        fileSize,
        mimeType,
        duration = null, // for audio/video
        dimensions = null, // for images/video { width, height }
        thumbnail = null, // thumbnail URL for video/image
        compression = null, // compression settings used
        originalSize = null // size before compression
    }) {
        this.fileName = fileName;
        this.fileSize = fileSize;
        this.mimeType = mimeType;
        this.duration = duration;
        this.dimensions = dimensions;
        this.thumbnail = thumbnail;
        this.compression = compression;
        this.originalSize = originalSize;
    }

    static fromFile(file, additionalData = {}) {
        return new MediaMetadata({
            fileName: file.originalname,
            fileSize: file.size,
            mimeType: file.mimetype,
            ...additionalData
        });
    }
}