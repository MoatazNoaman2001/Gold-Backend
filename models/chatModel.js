// Update your chatModel.js file with these schemas:

import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: false
  },
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: false
  },
  type: {
    type: String,
    enum: ['product_chat', 'shop_chat', 'general'],
    default: 'general'
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Additional fields for shop chat
  shopInfo: {
    name: String,
    logoUrl: String
  },
  unreadCount: {
    type: Map,
    of: Number,
    default: new Map()
  }
}, {
  timestamps: true
});

// Add indexes for better performance
conversationSchema.index({ participants: 1 });
conversationSchema.index({ shop: 1, type: 1 });
conversationSchema.index({ product: 1 });
conversationSchema.index({ updatedAt: -1 });

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 1000
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'system' , 'media'],
    default: 'text'
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: false
  },
  attachments: [{
    type: {
      type: String,
      enum: ['image', 'file']
    },
    url: String,
    filename: String,
    size: Number
  }],
  read: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  editedAt: {
    type: Date
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  // For system messages
  systemMessageType: {
    type: String,
    enum: ['conversation_started', 'user_joined', 'user_left', 'shop_info'],
    required: false
  }
}, {
  timestamps: true
});

// Add indexes for better performance
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ receiver: 1, read: 1 });

// Pre-save middleware to update conversation's lastMessage and unread count
messageSchema.pre('save', async function (next) {
  if (this.isNew) {
    try {
      await mongoose.model('Conversation').findByIdAndUpdate(
        this.conversation,
        {
          lastMessage: this._id,
          updatedAt: new Date()
        }
      );

      // Update unread count for receiver
      if (this.receiver) {
        await mongoose.model('Conversation').findByIdAndUpdate(
          this.conversation,
          {
            $inc: { [`unreadCount.${this.receiver}`]: 1 }
          }
        );
      }
    } catch (error) {
      console.error('Error updating conversation:', error);
    }
  }
  next();
});

// Post-save middleware to mark message as read when read field is updated
messageSchema.post('findOneAndUpdate', async function (doc) {
  if (doc && doc.read && !doc.readAt) {
    doc.readAt = new Date();
    await doc.save();

    // Decrease unread count
    if (doc.receiver) {
      await mongoose.model('Conversation').findByIdAndUpdate(
        doc.conversation,
        {
          $inc: { [`unreadCount.${doc.receiver}`]: -1 }
        }
      );
    }
  }
});

// Virtual for formatted creation time
messageSchema.virtual('formattedTime').get(function () {
  return this.createdAt.toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Virtual for formatted date
messageSchema.virtual('formattedDate').get(function () {
  const date = this.createdAt;
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'اليوم';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'أمس';
  } else {
    return date.toLocaleDateString('ar-EG');
  }
});

// Static method to get messages with pagination
messageSchema.statics.getMessagesPaginated = function (conversationId, limit = 50, skip = 0) {
  return this.find({ conversation: conversationId })
    .populate('sender', 'name email avatar')
    .populate('receiver', 'name email avatar')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to mark all messages as read
messageSchema.statics.markAllAsRead = function (conversationId, userId) {
  return this.updateMany(
    {
      conversation: conversationId,
      receiver: userId,
      read: false
    },
    {
      read: true,
      readAt: new Date()
    }
  );
};

// Instance method to mark message as read
messageSchema.methods.markAsRead = function () {
  if (!this.read) {
    this.read = true;
    this.readAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

// Static method for conversation statistics
conversationSchema.statics.getShopConversationStats = function (shopId) {
  return this.aggregate([
    { $match: { shop: mongoose.Types.ObjectId(shopId), type: 'shop_chat' } },
    {
      $lookup: {
        from: 'messages',
        localField: '_id',
        foreignField: 'conversation',
        as: 'messages'
      }
    },
    {
      $project: {
        _id: 1,
        participants: 1,
        createdAt: 1,
        updatedAt: 1,
        messageCount: { $size: '$messages' },
        lastMessage: 1,
        unreadCount: 1
      }
    },
    { $sort: { updatedAt: -1 } }
  ]);
};

// Instance method to get unread count for user
conversationSchema.methods.getUnreadCountForUser = function (userId) {
  return this.unreadCount.get(userId.toString()) || 0;
};

// Instance method to reset unread count for user
conversationSchema.methods.resetUnreadCountForUser = function (userId) {
  this.unreadCount.set(userId.toString(), 0);
  return this.save();
};

export const Conversation = mongoose.model('Conversation', conversationSchema);
export const Message = mongoose.model('Message', messageSchema);

// Additional helper functions for shop chat
export const ChatHelpers = {
  // Create a system message
  createSystemMessage: async (conversationId, type, content) => {
    return await Message.create({
      conversation: conversationId,
      content,
      messageType: 'system',
      systemMessageType: type,
      sender: null, // System messages don't have a sender
      read: true // System messages are always read
    });
  },

  // Get conversation between user and shop
  getShopConversation: async (userId, shopId) => {
    return await Conversation.findOne({
      shop: shopId,
      participants: userId,
      type: 'shop_chat'
    }).populate('participants', 'name email avatar')
      .populate('shop', 'name logoUrl')
      .populate('lastMessage');
  },

  // Get all conversations for a shop owner
  getShopOwnerConversations: async (shopOwnerId, shopId) => {
    return await Conversation.find({
      shop: shopId,
      participants: shopOwnerId,
      type: 'shop_chat'
    }).populate('participants', 'name email avatar')
      .populate('shop', 'name logoUrl')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });
  },

  // Get all conversations for a customer
  getCustomerConversations: async (customerId) => {
    return await Conversation.find({
      participants: customerId,
      type: 'shop_chat'
    }).populate('participants', 'name email avatar')
      .populate('shop', 'name logoUrl')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });
  },

  // Get conversation statistics
  getConversationStats: async (conversationId) => {
    const messages = await Message.countDocuments({ conversation: conversationId });
    const unreadMessages = await Message.countDocuments({
      conversation: conversationId,
      read: false
    });

    return { messages, unreadMessages };
  }
};