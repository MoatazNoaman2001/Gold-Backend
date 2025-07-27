export class MediaMessage {
    constructor({
        id,
        senderId,
        receiverId,
        conversationId,
        type,
        content,
        mediaMetadata = {},
        timestamp,
        status = 'pending',
        expiresAt = null
    }) {
        this.id = id;
        this.senderId = senderId;
        this.receiverId = receiverId;
        this.conversationId = conversationId;
        this.type = type;
        this.content = content;
        this.mediaMetadata = mediaMetadata;
        this.timestamp = timestamp || new Date();
        this.status = status;
        this.expiresAt = expiresAt;
    }

    isExpired() {
        return this.expiresAt && new Date() > this.expiresAt;
    }

    canBeDelivered() {
        return this.status === 'uploaded' && !this.isExpired();
    }

    markAsDelivered() {
        this.status = 'delivered';
    }

    markAsRead() {
        this.status = 'read';
    }

    markAsFailed(reason) {
        this.status = 'failed';
        this.mediaMetadata.failureReason = reason;
    }
}