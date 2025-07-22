import { ReservationEventHandlers } from './ReservationEventHandlers.js';

export const setupReservationEventHandlers = (container) => {
  try {
    console.log('🎭 Setting up reservation event handlers...');
    
    // Get services from container
    const eventPublisher = container.resolve('eventPublisher');
    const notificationService = container.resolve('notificationService');
    
    // Create event handlers instance
    const eventHandlers = new ReservationEventHandlers(
      notificationService
    );
    
    // Subscribe to all reservation events
    eventPublisher.subscribe('ReservationCreated', eventHandlers.handleReservationCreated);
    eventPublisher.subscribe('ReservationActivated', eventHandlers.handleReservationActivated);
    eventPublisher.subscribe('ReservationConfirmed', eventHandlers.handleReservationConfirmed);
    eventPublisher.subscribe('ReservationCompleted', eventHandlers.handleReservationCompleted);
    eventPublisher.subscribe('ReservationCancelled', eventHandlers.handleReservationCancelled);
    eventPublisher.subscribe('ReservationExpired', eventHandlers.handleReservationExpired);
    
    console.log('✅ Reservation event handlers registered successfully');
    
    return eventHandlers;
  } catch (error) {
    console.error('❌ Error setting up reservation event handlers:', error);
    throw error;
  }
};