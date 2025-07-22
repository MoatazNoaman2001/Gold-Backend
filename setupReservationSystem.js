import { setupDIContainer } from './Infrastructure/DI/Container.js';
import { ReservationEventHandlers } from './Infrastructure/EventHandlers/ReservationEventHandlers.js';
import { setupScheduledJobs } from './Infrastructure/Jobs/JobScheduler.js';

export const setupReservationSystem = (app) => {
  const container = setupDIContainer();
  const eventPublisher = container.resolve('eventPublisher');
  const notificationService = container.resolve('notificationService');
  const analyticsService = container.resolve('analyticsService');
  const eventHandlers = new ReservationEventHandlers(
    notificationService,
    analyticsService
  );
  eventPublisher.subscribe('ReservationCreated', eventHandlers.handleReservationCreated);
  eventPublisher.subscribe('ReservationActivated', eventHandlers.handleReservationActivated);
  eventPublisher.subscribe('ReservationConfirmed', eventHandlers.handleReservationConfirmed);
  eventPublisher.subscribe('ReservationCompleted', eventHandlers.handleReservationCompleted);
  eventPublisher.subscribe('ReservationCancelled', eventHandlers.handleReservationCancelled);
  const scheduler = setupScheduledJobs();
  scheduler.startAll();
  process.on('SIGTERM', () => {
    scheduler.stopAll();
    console.log('Reservation system shutdown completed');
  });
  console.log('Reservation system initialized successfully');
}; 