import { RESERVATION_STATUS } from '../../Domain/ValueObjects/ReservationStatus.js';

export class ConfirmReservationUseCase {
  constructor(
    reservationRepository,
    paymentService,
    productRepository,
    eventPublisher
  ) {
    this.reservationRepository = reservationRepository;
    this.paymentService = paymentService;
    this.productRepository = productRepository;
    this.eventPublisher = eventPublisher;
  }

  async execute(command) {
    const { reservationId, userId, paymentMethodId } = command;
    const reservation = await this.reservationRepository.findById(reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }
    if (reservation.userId.toString() !== userId.toString()) {
      throw new Error('Unauthorized access to reservation');
    }
    if (!reservation.canConfirm()) {
      throw new Error('Reservation cannot be confirmed');
    }
    const paymentIntent = await this.paymentService.createPaymentIntent({
      amount: Math.round(reservation.remainingAmount * 100),
      currency: 'egp',
      paymentMethodId,
      customerId: userId,
      metadata: {
        type: 'reservation_confirmation',
        reservationId,
        originalPaymentIntent: reservation.stripePaymentIntentId
      }
    });
    reservation.status = RESERVATION_STATUS.CONFIRMED;
    reservation.confirmationDate = new Date();
    const updatedReservation = await this.reservationRepository.save(reservation);
    await this.productRepository.updateAvailability(reservation.productId, false);
    await this.eventPublisher.publish('ReservationConfirmed', {
      reservationId: updatedReservation.id,
      userId,
      productId: reservation.productId,
      totalAmount: reservation.totalAmount
    });
    return {
      reservation: updatedReservation,
      clientSecret: paymentIntent.client_secret
    };
  }
} 