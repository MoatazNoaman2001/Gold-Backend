export class SendMediaMessageUseCase {
    constructor(uploadMediaUseCase, messageRepository, eventPublisher) {
        this.uploadMediaUseCase = uploadMediaUseCase;
        this.messageRepository = messageRepository;
        this.eventPublisher = eventPublisher;
    }

    async execute(command) {
        // Upload media first
        const uploadResult = await this.uploadMediaUseCase.execute(command);

        // Create database message record
        const message = await this.messageRepository.createMediaMessage({
            ...uploadResult.mediaMessage,
            mediaUrl: uploadResult.url,
            thumbnailUrl: uploadResult.thumbnailUrl
        });

        // Publish event for real-time delivery
        await this.eventPublisher.publish('MediaMessageSent', {
            message,
            senderId: command.senderId,
            receiverId: command.receiverId,
            conversationId: command.conversationId
        });

        return message;
    }
}
