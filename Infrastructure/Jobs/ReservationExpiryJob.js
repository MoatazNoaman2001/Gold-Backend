import { RESERVATION_STATUS } from '../../Domain/ValueObjects/ReservationStatus.js';

export class ReservationExpiryJob {
  constructor(reservationRepository, paymentService, eventPublisher) {
    this.reservationRepository = reservationRepository;
    this.paymentService = paymentService;
    this.eventPublisher = eventPublisher;
  }

  async execute() {
    try {
      console.log('Running reservation expiry job...');
      const expiredReservations = await this.reservationRepository.findExpiredReservations();
      for (const reservation of expiredReservations) {
        await this.expireReservation(reservation);
      }
      
      console.log(`Processed ${expiredReservations.length} expired reservations`);
    } catch (error) {
      console.error('Error in reservation expiry job:', error);
    }
  }

  async expireReservation(reservation) {
    try {
      reservation.status = RESERVATION_STATUS.EXPIRED;
      await this.reservationRepository.save(reservation);
      const refundAmount = reservation.calculateRefundAmount();
      if (refundAmount > 0 && reservation.stripePaymentIntentId) {
        await this.paymentService.createRefund({
          paymentIntentId: reservation.stripePaymentIntentId,
          amount: Math.round(refundAmount * 100),
          reason: 'expired'
        });
      }
      await this.eventPublisher.publish('ReservationExpired', {
        reservationId: reservation.id,
        userId: reservation.userId,
        refundAmount
      });
    } catch (error) {
      console.error(`Error expiring reservation ${reservation.id}:`, error);
    }
  }
} 