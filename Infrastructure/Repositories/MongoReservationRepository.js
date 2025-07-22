import { ReservationEntity } from '../../Domain/Entities/ReservationEntity.js';
import { RESERVATION_STATUS } from '../../Domain/ValueObjects/ReservationStatus.js';

export class MongoReservationRepository {
  constructor(reservationModel) {
    this.reservationModel = reservationModel;
  }

  async save(reservationEntity) {
    const reservation = new this.reservationModel(reservationEntity);
    const saved = await reservation.save();
    return this.toDomainEntity(saved);
  }

  async findById(id) {
    const reservation = await this.reservationModel.findById(id)
      .populate('productId')
      .populate('shopId', 'name')
      .populate('userId', 'name email');
    return reservation ? this.toDomainEntity(reservation) : null;
  }

  async findActiveByProduct(productId) {
    const reservation = await this.reservationModel.findOne({
      productId,
      status: { $in: [RESERVATION_STATUS.ACTIVE, RESERVATION_STATUS.CONFIRMED] }
    });
    return reservation ? this.toDomainEntity(reservation) : null;
  }

  async findByUser(userId, filters = {}) {
    const query = { userId, ...filters };
    const reservations = await this.reservationModel.find(query)
      .populate('productId')
      .populate('shopId', 'name')
      .sort({ createdAt: -1 });
    return reservations.map(r => this.toDomainEntity(r));
  }

  async findExpiredReservations() {
    const reservations = await this.reservationModel.find({
      status: RESERVATION_STATUS.ACTIVE,
      expiryDate: { $lt: new Date() }
    });
    return reservations.map(r => this.toDomainEntity(r));
  }

  async findByStripePaymentIntent(stripePaymentIntentId) {
    const reservation = await this.reservationModel.findOne({
      stripePaymentIntentId
    });
    return reservation ? this.toDomainEntity(reservation) : null;
  }

  async findByShop(shopId, filters = {}) {
    const query = { shopId, ...filters };
    const reservations = await this.reservationModel.find(query)
      .populate('productId')
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });
    return reservations.map(r => this.toDomainEntity(r));
  }

  toDomainEntity(mongoDoc) {
    return new ReservationEntity({
      id: mongoDoc._id.toString(),
      userId: mongoDoc.userId,
      productId: mongoDoc.productId,
      shopId: mongoDoc.shopId,
      reservationAmount: mongoDoc.reservationAmount,
      remainingAmount: mongoDoc.remainingAmount,
      totalAmount: mongoDoc.totalAmount,
      status: mongoDoc.status,
      reservationDate: mongoDoc.reservationDate,
      expiryDate: mongoDoc.expiryDate,
      stripePaymentIntentId: mongoDoc.stripePaymentIntentId,
      confirmationDate: mongoDoc.confirmationDate,
      cancelationDate: mongoDoc.cancelationDate,
      cancelationReason: mongoDoc.cancelationReason,
      metadata: mongoDoc.metadata
    });
  }
} 