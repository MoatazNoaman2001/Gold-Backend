export const MEDIA_CONFIG = {
    ALLOWED_TYPES: {
        image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm'],
        video: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
    },

    SIZE_LIMITS: {
        image: 10 * 1024 * 1024, // 10MB
        audio: 50 * 1024 * 1024, // 50MB
        video: 100 * 1024 * 1024 // 100MB
    },

    COMPRESSION: {
        image: {
            quality: 0.8,
            maxWidth: 1920,
            maxHeight: 1080
        },
        audio: {
            bitrate: '128k',
            format: 'mp3'
        },
        video: {
            bitrate: '1000k',
            resolution: '720p',
            format: 'mp4'
        }
    },

    STORAGE_PATHS: {
        image: 'uploads/chat/images/',
        audio: 'uploads/chat/audio/',
        video: 'uploads/chat/video/',
        thumbnails: 'uploads/chat/thumbnails/'
    }
};