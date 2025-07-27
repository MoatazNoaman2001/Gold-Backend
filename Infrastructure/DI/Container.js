import ReservationModel from '../Database/Models/reservationModel.js';
import { MongoReservationRepository } from '../Repositories/MongoReservationRepository.js';
import { StripePaymentService } from '../Services/StripePaymentService.js';
import { EventPublisher } from '../Services/EventPublisher.js';
import { CreateReservationUseCase } from '../../Application/UseCases/CreateReservationUseCase.js';
import { ConfirmReservationUseCase } from '../../Application/UseCases/ConfirmReservationUseCase.js';
import { CancelReservationUseCase } from '../../Application/UseCases/CancelReservationUseCase.js';
import { ReservationController } from '../../Interface/Controllers/ReservationController.js';

// Placeholder for productRepository and notificationService
const productRepository = {
  findById: async (id) => { throw new Error('Not implemented'); },
  updateAvailability: async (id, available) => { throw new Error('Not implemented'); }
};
const notificationService = {};

export class DIContainer {
  constructor() {
    this.dependencies = new Map();
  }
  register(name, factory, singleton = true) {
    this.dependencies.set(name, { factory, singleton, instance: null });
  }
  resolve(name) {
    const dependency = this.dependencies.get(name);
    if (!dependency) {
      throw new Error(`Dependency '${name}' not found`);
    }
    if (dependency.singleton) {
      if (!dependency.instance) {
        dependency.instance = dependency.factory(this);
      }
      return dependency.instance;
    }
    return dependency.factory(this);
  }
}

export const setupDIContainer = () => {
  const container = new DIContainer();
  container.register('reservationRepository', () => new MongoReservationRepository(ReservationModel));
  container.register('paymentService', () => new StripePaymentService(process.env.STRIPE_SCRETE));
  container.register('eventPublisher', () => new EventPublisher());
  container.register('productRepository', () => productRepository);
  container.register('notificationService', () => notificationService);
  container.register('createReservationUseCase', (container) => new CreateReservationUseCase(
    container.resolve('reservationRepository'),
    container.resolve('productRepository'),
    container.resolve('paymentService'),
    container.resolve('notificationService'),
    container.resolve('eventPublisher')
  ));
  container.register('confirmReservationUseCase', (container) => new ConfirmReservationUseCase(
    container.resolve('reservationRepository'),
    container.resolve('paymentService'),
    container.resolve('productRepository'),
    container.resolve('eventPublisher')
  ));
  container.register('cancelReservationUseCase', (container) => new CancelReservationUseCase(
    container.resolve('reservationRepository'),
    container.resolve('paymentService'),
    container.resolve('eventPublisher')
  ));
  container.register('reservationController', (container) => new ReservationController(
    container.resolve('createReservationUseCase'),
    container.resolve('confirmReservationUseCase'),
    container.resolve('cancelReservationUseCase'),
    container.resolve('reservationRepository')
  ));
  return container;
}; 