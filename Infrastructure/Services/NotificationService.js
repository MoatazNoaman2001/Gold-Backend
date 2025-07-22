export class NotificationService {
  constructor(emailService, smsService, pushService) {
    this.emailService = emailService;
    this.smsService = smsService;
    this.pushService = pushService;
  }

  async sendReservationConfirmation(userId, reservation) {
    try {
      const user = await this.getUserById(userId);
      const emailData = {
        to: user.email,
        subject: 'Reservation Confirmed',
        template: 'reservation-confirmation',
        data: {
          userName: user.name,
          productTitle: reservation.productId.title,
          reservationAmount: reservation.reservationAmount,
          remainingAmount: reservation.remainingAmount,
          expiryDate: reservation.expiryDate,
          reservationId: reservation.id
        }
      };
      await this.emailService.send(emailData);
      if (user.pushNotificationsEnabled) {
        await this.pushService.send(userId, {
          title: 'Reservation Confirmed',
          body: `Your reservation for ${reservation.productId.title} has been confirmed.`,
          data: { reservationId: reservation.id, type: 'reservation' }
        });
      }
    } catch (error) {
      console.error('Error sending reservation confirmation:', error);
    }
  }

  async sendReservationReminder(userId, reservation) {
    try {
      const user = await this.getUserById(userId);
      const daysUntilExpiry = Math.ceil((reservation.expiryDate - new Date()) / (1000 * 60 * 60 * 24));
      const emailData = {
        to: user.email,
        subject: 'Reservation Expiring Soon',
        template: 'reservation-reminder',
        data: {
          userName: user.name,
          productTitle: reservation.productId.title,
          daysUntilExpiry,
          reservationId: reservation.id,
          confirmationUrl: `${process.env.CLIENT_URL}/reservations/${reservation.id}/confirm`
        }
      };
      await this.emailService.send(emailData);
    } catch (error) {
      console.error('Error sending reservation reminder:', error);
    }
  }

  async getUserById(userId) {
    const User = (await import('../../models/userModel.js')).default;
    return await User.findById(userId);
  }
} 