import { RESERVATION_STATUS } from '../../Domain/ValueObjects/ReservationStatus.js';

export class CancelReservationUseCase {
  constructor(reservationRepository, paymentService, eventPublisher) {
    this.reservationRepository = reservationRepository;
    this.paymentService = paymentService;
    this.eventPublisher = eventPublisher;
  }

  async execute(command) {
    const { reservationId, userId, reason } = command;
    const reservation = await this.reservationRepository.findById(reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }
    if (reservation.userId.toString() !== userId.toString()) {
      throw new Error('Unauthorized access to reservation');
    }
    if (!reservation.canCancel()) {
      throw new Error('Reservation cannot be cancelled');
    }
    const refundAmount = reservation.calculateRefundAmount();
    if (refundAmount > 0 && reservation.stripePaymentIntentId) {
      await this.paymentService.createRefund({
        paymentIntentId: reservation.stripePaymentIntentId,
        amount: Math.round(refundAmount * 100),
        reason: 'requested_by_customer'
      });
    }
    reservation.status = RESERVATION_STATUS.CANCELLED;
    reservation.cancelationDate = new Date();
    reservation.cancelationReason = reason;
    const updatedReservation = await this.reservationRepository.save(reservation);
    await this.eventPublisher.publish('ReservationCancelled', {
      reservationId: updatedReservation.id,
      userId,
      refundAmount
    });
    return updatedReservation;
  }
} 