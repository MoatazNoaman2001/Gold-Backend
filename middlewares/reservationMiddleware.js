import { setupDIContainer } from '../Infrastructure/DI/Container.js';

export const validateReservationAccess = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    const userId = req.user._id.toString();
    const container = setupDIContainer();
    const repository = container.resolve('reservationRepository');
    const reservation = await repository.findById(reservationId);
    if (!reservation) {
      return res.status(404).json({
        status: 'fail',
        message: 'Reservation not found'
      });
    }
    const hasAccess =
      reservation.userId === userId ||
      req.user.role === 'admin' ||
      (req.user.role === 'shop_owner' && req.user.shopId === reservation.shopId);
    if (!hasAccess) {
      return res.status(403).json({
        status: 'fail',
        message: 'Access denied'
      });
    }
    req.reservation = reservation;
    next();
  } catch (error) {
    console.error('Error in reservation access validation:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
}; 