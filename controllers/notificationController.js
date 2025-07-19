import NotificationService from '../services/notificationService.js';
import { catchAsync } from '../utils/wrapperFunction.js';

// Get user notifications
export const getNotifications = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 20, unreadOnly = false } = req.query;

  const result = await NotificationService.getUserNotifications(userId, {
    page: parseInt(page),
    limit: parseInt(limit),
    unreadOnly: unreadOnly === 'true'
  });

  res.json({
    success: true,
    data: result
  });
});

// Get unread notifications count
export const getUnreadCount = catchAsync(async (req, res) => {
  const userId = req.user.id;
  
  const count = await NotificationService.getUnreadCount(userId);

  res.json({
    success: true,
    data: { count }
  });
});

// Mark notification as read
export const markAsRead = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const notification = await NotificationService.markAsRead(id, userId);

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found'
    });
  }

  res.json({
    success: true,
    data: notification
  });
});

// Mark all notifications as read
export const markAllAsRead = catchAsync(async (req, res) => {
  const userId = req.user.id;

  const result = await NotificationService.markAllAsRead(userId);

  res.json({
    success: true,
    data: { modifiedCount: result.modifiedCount }
  });
});

// Delete notification
export const deleteNotification = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const notification = await NotificationService.deleteNotification(id, userId);

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found'
    });
  }

  res.json({
    success: true,
    message: 'Notification deleted successfully'
  });
});
