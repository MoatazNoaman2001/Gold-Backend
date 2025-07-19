import Notification from '../models/notificationModel.js';
import Shop from '../models/shopModel.js';

class NotificationService {
  // Create a new notification
  static async createNotification({
    recipient,
    sender,
    type,
    title,
    message,
    data = {}
  }) {
    try {
      const notification = await Notification.create({
        recipient,
        sender,
        type,
        title,
        message,
        data
      });

      // Populate sender info for real-time notification
      await notification.populate('sender', 'name email');
      
      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // Create rating notification for shop owner
  static async createRatingNotification(rating, shop, user) {
    try {
      // Find shop owner
      const shopData = await Shop.findById(shop).populate('owner', '_id name');
      if (!shopData || !shopData.owner) {
        console.log('Shop owner not found for rating notification');
        return null;
      }

      const notification = await this.createNotification({
        recipient: shopData.owner._id,
        sender: user,
        type: 'rating',
        title: 'تقييم جديد لمحلك',
        message: `تم تقييم محلك "${shopData.name}" بـ ${rating.rating} نجوم`,
        data: {
          ratingId: rating._id,
          shopId: shop,
          shopName: shopData.name,
          rating: rating.rating,
          comment: rating.comment
        }
      });

      return notification;
    } catch (error) {
      console.error('Error creating rating notification:', error);
      throw error;
    }
  }

  // Get notifications for a user
  static async getUserNotifications(userId, { page = 1, limit = 20, unreadOnly = false } = {}) {
    try {
      const query = { recipient: userId };
      if (unreadOnly) {
        query.read = false;
      }

      const notifications = await Notification.find(query)
        .populate('sender', 'name email')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Notification.countDocuments(query);
      const unreadCount = await Notification.countDocuments({ 
        recipient: userId, 
        read: false 
      });

      return {
        notifications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        unreadCount
      };
    } catch (error) {
      console.error('Error getting user notifications:', error);
      throw error;
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, recipient: userId },
        { read: true, readAt: new Date() },
        { new: true }
      );

      return notification;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // Mark all notifications as read for a user
  static async markAllAsRead(userId) {
    try {
      const result = await Notification.updateMany(
        { recipient: userId, read: false },
        { read: true, readAt: new Date() }
      );

      return result;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  // Delete notification
  static async deleteNotification(notificationId, userId) {
    try {
      const notification = await Notification.findOneAndDelete({
        _id: notificationId,
        recipient: userId
      });

      return notification;
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  // Get unread count for a user
  static async getUnreadCount(userId) {
    try {
      const count = await Notification.countDocuments({
        recipient: userId,
        read: false
      });

      return count;
    } catch (error) {
      console.error('Error getting unread count:', error);
      throw error;
    }
  }
}

export default NotificationService;
