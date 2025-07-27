import mongoose from 'mongoose';

const mediaMessageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  type: { type: String, enum: ['image', 'audio', 'video', 'text'], required: true },
  content: { type: String, required: true }, // File path or text content
  mediaMetadata: {
    fileName: String,
    fileSize: Number,
    mimeType: String,
    duration: Number,
    dimensions: {
      width: Number,
      height: Number
    },
    thumbnail: String,
    compression: mongoose.Schema.Types.Mixed,
    originalSize: Number
  },
  mediaUrl: String, // Public URL
  thumbnailUrl: String,
  status: { 
    type: String, 
    enum: ['pending', 'uploaded', 'delivered', 'read', 'failed'], 
    default: 'pending' 
  },
  expiresAt: Date,
  read: { type: Boolean, default: false },
  readAt: Date
}, {
  timestamps: true
});

const MediaMessageModel = mongoose.model('MediaMessage', mediaMessageSchema);

export class MongoMediaRepository {
  async save(mediaMessage) {
    const model = new MediaMessageModel(mediaMessage);
    return await model.save();
  }

  async findById(id) {
    return await MediaMessageModel.findById(id)
      .populate('senderId', 'name email')
      .populate('receiverId', 'name email');
  }

  async findByConversation(conversationId, limit = 50, skip = 0) {
    return await MediaMessageModel.find({ conversationId })
      .populate('senderId', 'name email')
      .populate('receiverId', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);
  }

  async markAsRead(messageId, userId) {
    return await MediaMessageModel.findOneAndUpdate(
      { _id: messageId, receiverId: userId },
      { read: true, readAt: new Date(), status: 'read' },
      { new: true }
    );
  }

  async createMediaMessage(messageData) {
    const message = new MediaMessageModel(messageData);
    await message.save();
    return await message.populate(['senderId', 'receiverId']);
  }
}