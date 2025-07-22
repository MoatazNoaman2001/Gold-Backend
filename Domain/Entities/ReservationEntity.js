export class ReservationEntity {
  constructor({
    id,
    userId,
    productId,
    shopId,
    reservationAmount,
    remainingAmount,
    totalAmount,
    status,
    reservationDate,
    expiryDate,
    stripePaymentIntentId,
    confirmationDate,
    cancelationDate,
    cancelationReason,
    metadata = {}
  }) {
    this.id = id;
    this.userId = userId;
    this.productId = productId;
    this.shopId = shopId;
    this.reservationAmount = reservationAmount;
    this.remainingAmount = remainingAmount;
    this.totalAmount = totalAmount;
    this.status = status || 'PENDING';
    this.reservationDate = reservationDate || new Date();
    this.expiryDate = expiryDate;
    this.stripePaymentIntentId = stripePaymentIntentId;
    this.confirmationDate = confirmationDate;
    this.cancelationDate = cancelationDate;
    this.cancelationReason = cancelationReason;
    this.metadata = metadata;
  }

  canConfirm() {
    return this.status === 'ACTIVE' && new Date() <= this.expiryDate;
  }

  canCancel() {
    return ['PENDING', 'ACTIVE'].includes(this.status);
  }

  isExpired() {
    return new Date() > this.expiryDate;
  }

  calculateRefundAmount() {
    switch (this.status) {
      case 'PENDING':
        return this.reservationAmount * 0.95;
      case 'ACTIVE':
        return this.reservationAmount * 0.85;
      default:
        return 0;
    }
  }
} 