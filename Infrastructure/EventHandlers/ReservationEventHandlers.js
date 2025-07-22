
export class ReservationEventHandlers {
  constructor(notificationService) {
    this.notificationService = notificationService;
  }

  handleReservationCreated = async (eventData) => {
    const { reservationId, userId, productId, amount } = eventData;
    
    try {
      
      console.log(`📊 Analytics tracked: Reservation created ${reservationId}`);
    } catch (error) {
      console.error('Error in handleReservationCreated:', error);
    }
  };

  handleReservationActivated = async (eventData) => {
    const { reservationId, userId, productId } = eventData;
    
    try {
      // Get reservation details
      const reservation = await this.getReservationById(reservationId);
      
      if (reservation) {
        // Send confirmation notification
        await this.notificationService.sendReservationConfirmation(userId, reservation);
        
        // Schedule reminder notifications
        await this.scheduleReservationReminders(reservationId, userId);
        
        // Track analytics
        await this.analyticsService.track('reservation_activated', {
          userId,
          productId,
          timestamp: new Date()
        });
        
        console.log(`✅ Reservation activated successfully: ${reservationId}`);
      }
    } catch (error) {
      console.error('Error handling reservation activated:', error);
    }
  };

  handleReservationConfirmed = async (eventData) => {
    const { reservationId, userId, productId, totalAmount } = eventData;
    
    try {
      await this.analyticsService.track('reservation_confirmed', {
        userId,
        productId,
        totalAmount,
        timestamp: new Date()
      });
      
      console.log(`💰 Reservation confirmed: ${reservationId} for ${totalAmount} EGP`);
    } catch (error) {
      console.error('Error in handleReservationConfirmed:', error);
    }
  };

  handleReservationCompleted = async (eventData) => {
    const { reservationId, userId, productId, totalAmount } = eventData;
    
    try {
      await this.analyticsService.track('purchase_completed', {
        userId,
        productId,
        amount: totalAmount,
        source: 'reservation',
        timestamp: new Date()
      });
      
      console.log(`🎉 Purchase completed: ${reservationId}`);
    } catch (error) {
      console.error('Error in handleReservationCompleted:', error);
    }
  };

  handleReservationCancelled = async (eventData) => {
    const { reservationId, userId, refundAmount } = eventData;
    
    try {
      await this.analyticsService.track('reservation_cancelled', {
        userId,
        reservationId,
        refundAmount,
        timestamp: new Date()
      });
      
      console.log(`❌ Reservation cancelled: ${reservationId}, refund: ${refundAmount} EGP`);
    } catch (error) {
      console.error('Error in handleReservationCancelled:', error);
    }
  };

  handleReservationExpired = async (eventData) => {
    const { reservationId, userId, refundAmount } = eventData;
    
    try {
      // Send expiry notification
      await this.notificationService.sendReservationExpiredNotification(userId, {
        reservationId,
        refundAmount
      });
      
      // Track analytics
      await this.analyticsService.track('reservation_expired', {
        userId,
        reservationId,
        refundAmount,
        timestamp: new Date()
      });
      
      console.log(`⏰ Reservation expired: ${reservationId}`);
    } catch (error) {
      console.error('Error in handleReservationExpired:', error);
    }
  };

  async scheduleReservationReminders(reservationId, userId) {
    try {
      // Get reservation to check expiry date
      const reservation = await this.getReservationById(reservationId);
      
      if (!reservation) {
        console.error(`Reservation not found: ${reservationId}`);
        return;
      }

      // Calculate reminder dates (2 days before expiry)
      const expiryDate = new Date(reservation.expiryDate);
      const reminderDate = new Date(expiryDate);
      reminderDate.setDate(reminderDate.getDate() - 2);

      // Only schedule if reminder date is in the future
      if (reminderDate > new Date()) {
        // Here you would integrate with a job queue like Bull or Agenda
        // For now, we'll just log it
        console.log(`📅 Reminder scheduled for ${reminderDate.toISOString()} for reservation: ${reservationId}`);
        
        // You can implement actual scheduling here:
        // await this.jobQueue.add('send-reservation-reminder', {
        //   reservationId,
        //   userId
        // }, {
        //   delay: reminderDate.getTime() - Date.now()
        // });
      }
    } catch (error) {
      console.error('Error scheduling reservation reminders:', error);
    }
  }

  async getReservationById(reservationId) {
    try {
      // Import your reservation model directly
      const ReservationModel = (await import('../../models/reservationModel.js')).default;
      
      const reservation = await ReservationModel.findById(reservationId)
        .populate('productId', 'title price images')
        .populate('shopId', 'name')
        .populate('userId', 'name email phone');
      
      return reservation;
    } catch (error) {
      console.error('Error getting reservation:', error);
      return null;
    }
  }
}