import { catchAsync } from '../../utils/wrapperFunction.js';

export class ReservationController {
  constructor(
    createReservationUseCase,
    confirmReservationUseCase,
    cancelReservationUseCase,
    reservationRepository
  ) {
    this.createReservationUseCase = createReservationUseCase;
    this.confirmReservationUseCase = confirmReservationUseCase;
    this.cancelReservationUseCase = cancelReservationUseCase;
    this.reservationRepository = reservationRepository;
  }

  createReservation = catchAsync(async (req, res) => {
    const { productId, paymentMethodId } = req.body;
    const userId = req.user._id.toString();
    const result = await this.createReservationUseCase.execute({
      userId,
      productId,
      paymentMethodId
    });
    res.status(201).json({
      status: 'success',
      message: 'Reservation created successfully',
      data: {
        reservation: result.reservation,
        clientSecret: result.clientSecret
      }
    });
  });

  confirmReservation = catchAsync(async (req, res) => {
    const { reservationId } = req.params;
    const { paymentMethodId } = req.body;
    const userId = req.user._id.toString();
    const result = await this.confirmReservationUseCase.execute({
      reservationId,
      userId,
      paymentMethodId
    });
    res.status(200).json({
      status: 'success',
      message: 'Reservation confirmed successfully',
      data: {
        reservation: result.reservation,
        clientSecret: result.clientSecret
      }
    });
  });

  cancelReservation = catchAsync(async (req, res) => {
    const { reservationId } = req.params;
    const { reason } = req.body;
    const userId = req.user._id.toString();
    const reservation = await this.cancelReservationUseCase.execute({
      reservationId,
      userId,
      reason
    });
    res.status(200).json({
      status: 'success',
      message: 'Reservation cancelled successfully',
      data: { reservation }
    });
  });

  getUserReservations = catchAsync(async (req, res) => {
    const userId = req.user._id.toString();
    const { status, page = 1, limit = 10 } = req.query;
    const filters = status ? { status } : {};
    const reservations = await this.reservationRepository.findByUser(userId, filters);
    res.status(200).json({
      status: 'success',
      results: reservations.length,
      data: { reservations }
    });
  });

  getReservationDetails = catchAsync(async (req, res) => {
    const { reservationId } = req.params;
    const userId = req.user._id.toString();
    const reservation = await this.reservationRepository.findById(reservationId);
    if (!reservation) {
      return res.status(404).json({
        status: 'fail',
        message: 'Reservation not found'
      });
    }
    if (reservation.userId.toString() !== userId) {
      return res.status(403).json({
        status: 'fail',
        message: 'Access denied'
      });
    }
    res.status(200).json({
      status: 'success',
      data: { reservation }
    });
  });

  getShopReservations = catchAsync(async (req, res) => {
    const { shopId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;
    // Verify shop ownership or admin access
    if (req.user.role !== 'admin' && req.user.shopId !== shopId) {
      return res.status(403).json({
        status: 'fail',
        message: 'Access denied'
      });
    }
    const filters = { shopId };
    if (status) filters.status = status;
    const reservations = await this.reservationRepository.findByShop(shopId, filters);
    res.status(200).json({
      status: 'success',
      results: reservations.length,
      data: { reservations }
    });
  });

  updateReservationStatus = catchAsync(async (req, res) => {
    const { reservationId } = req.params;
    const { status, notes } = req.body;
    const reservation = await this.reservationRepository.findById(reservationId);
    if (!reservation) {
      return res.status(404).json({
        status: 'fail',
        message: 'Reservation not found'
      });
    }
    // Verify shop ownership
    if (req.user.role !== 'admin' && req.user.shopId !== reservation.shopId) {
      return res.status(403).json({
        status: 'fail',
        message: 'Access denied'
      });
    }
    // Validate status transition
    const validTransitions = {
      'ACTIVE': ['READY_FOR_PICKUP'],
      'CONFIRMED': ['READY_FOR_PICKUP', 'COMPLETED'],
      'READY_FOR_PICKUP': ['COMPLETED', 'CANCELLED']
    };
    const allowedStatuses = validTransitions[reservation.status] || [];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        status: 'fail',
        message: `Cannot transition from ${reservation.status} to ${status}`
      });
    }
    reservation.status = status;
    if (notes) {
      if (!reservation.metadata) reservation.metadata = new Map();
      reservation.metadata.set('shopNotes', notes);
    }
    const updatedReservation = await this.reservationRepository.save(reservation);
    if (this.eventPublisher) {
      await this.eventPublisher.publish('ReservationStatusUpdated', {
        reservationId: reservation.id,
        oldStatus: reservation.status,
        newStatus: status,
        shopId: reservation.shopId
      });
    }
    res.status(200).json({
      status: 'success',
      data: { reservation: updatedReservation }
    });
  });
} 