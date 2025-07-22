import { Money } from '../ValueObjects/Money.js';
import { RESERVATION_STATUS } from '../ValueObjects/ReservationStatus.js';

export class ReservationDomainService {
  static calculateReservationAmount(productPrice) {
    const totalAmount = Money.fromEGP(productPrice);
    const reservationAmount = totalAmount.multiply(0.10);
    const remainingAmount = totalAmount.subtract(reservationAmount);
    return {
      totalAmount,
      reservationAmount,
      remainingAmount
    };
  }

  static calculateExpiryDate(reservationDate, daysToExpiry = 7) {
    const expiryDate = new Date(reservationDate);
    expiryDate.setDate(expiryDate.getDate() + daysToExpiry);
    return expiryDate;
  }

  static validateReservationRules(product, user) {
    const errors = [];
    if (!product) {
      errors.push('Product not found');
    }
    if (product && !product.isAvailable) {
      errors.push('Product is not available for reservation');
    }
    if (!user) {
      errors.push('User must be authenticated');
    }
    return {
      isValid: errors.length === 0,
      errors
    };
  }
} 