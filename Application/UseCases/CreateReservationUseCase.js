import { ReservationDomainService } from '../../Domain/Services/ReservationDomainService.js';
import { ReservationEntity } from '../../Domain/Entities/ReservationEntity.js';
import { RESERVATION_STATUS } from '../../Domain/ValueObjects/ReservationStatus.js';

export class CreateReservationUseCase {
  constructor(
    reservationRepository,
    productRepository,
    paymentService,
    notificationService,
    eventPublisher
  ) {
    this.reservationRepository = reservationRepository;
    this.productRepository = productRepository;
    this.paymentService = paymentService;
    this.notificationService = notificationService;
    this.eventPublisher = eventPublisher;
  }

  async execute(command) {
    const { userId, productId, paymentMethodId } = command;
    if (!userId || !productId || !paymentMethodId) {
      throw new Error('Missing required fields');
    }
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new Error('Product not found');
    }
    const validation = ReservationDomainService.validateReservationRules(product, { id: userId });
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }
    const existingReservation = await this.reservationRepository.findActiveByProduct(productId);
    if (existingReservation) {
      throw new Error('Product is already reserved');
    }
    const amounts = ReservationDomainService.calculateReservationAmount(product.price);
    const expiryDate = ReservationDomainService.calculateExpiryDate(new Date());
    const paymentIntent = await this.paymentService.createPaymentIntent({
      amount: amounts.reservationAmount.toStripeAmount(),
      currency: 'egp',
      paymentMethodId,
      customerId: userId,
      metadata: {
        type: 'reservation',
        productId,
        userId
      }
    });
    const reservation = new ReservationEntity({
      userId,
      productId,
      shopId: product.shop,
      reservationAmount: amounts.reservationAmount.amount,
      remainingAmount: amounts.remainingAmount.amount,
      totalAmount: amounts.totalAmount.amount,
      status: RESERVATION_STATUS.PENDING,
      expiryDate,
      stripePaymentIntentId: paymentIntent.id
    });
    const savedReservation = await this.reservationRepository.save(reservation);
    await this.eventPublisher.publish('ReservationCreated', {
      reservationId: savedReservation.id,
      userId,
      productId,
      amount: amounts.reservationAmount.amount
    });
    return {
      reservation: savedReservation,
      clientSecret: paymentIntent.client_secret
    };
  }
} 