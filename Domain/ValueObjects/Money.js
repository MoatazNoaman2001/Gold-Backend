export class Money {
  constructor(amount, currency = 'EGP') {
    if (amount < 0) throw new Error('Amount cannot be negative');
    this.amount = Math.round(amount * 100) / 100;
    this.currency = currency;
  }

  static fromEGP(amount) {
    return new Money(amount, 'EGP');
  }

  multiply(factor) {
    return new Money(this.amount * factor, this.currency);
  }

  subtract(other) {
    if (this.currency !== other.currency) {
      throw new Error('Cannot subtract different currencies');
    }
    return new Money(this.amount - other.amount, this.currency);
  }

  toStripeAmount() {
    return Math.round(this.amount * 100);
  }
} 