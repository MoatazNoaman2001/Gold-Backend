import mongoose from 'mongoose';
import { RESERVATION_STATUS } from '../../../Domain/ValueObjects/ReservationStatus.js';

const reservationSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  productId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', 
    required: true 
  },
  shopId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Shop', 
    required: true 
  },
  reservationAmount: { 
    type: Number, 
    required: true 
  },
  remainingAmount: { 
    type: Number, 
    required: true 
  },
  totalAmount: { 
    type: Number, 
    required: true 
  },
  status: {
    type: String,
    enum: Object.values(RESERVATION_STATUS),
    default: RESERVATION_STATUS.PENDING
  },
  reservationDate: { 
    type: Date, 
    default: Date.now 
  },
  expiryDate: { 
    type: Date, 
    required: true 
  },
  stripePaymentIntentId: String,
  confirmationDate: Date,
  cancelationDate: Date,
  cancelationReason: String,
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  }
}, {
  timestamps: true
});

reservationSchema.index({ userId: 1, status: 1 });
reservationSchema.index({ productId: 1, status: 1 });
reservationSchema.index({ shopId: 1, status: 1 });
reservationSchema.index({ expiryDate: 1 });

export default mongoose.model('Reservation', reservationSchema); 