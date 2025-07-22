import cron from 'node-cron';
import { setupDIContainer } from '../DI/Container.js';
import { ReservationExpiryJob } from './ReservationExpiryJob.js';

export class JobScheduler {
  constructor() {
    this.jobs = new Map();
  }

  scheduleJob(name, cronExpression, jobFunction) {
    const task = cron.schedule(cronExpression, jobFunction, {
      scheduled: false,
      timezone: 'Africa/Cairo'
    });
    this.jobs.set(name, task);
    return task;
  }

  startJob(name) {
    const job = this.jobs.get(name);
    if (job) {
      job.start();
      console.log(`Started job: ${name}`);
    }
  }

  stopJob(name) {
    const job = this.jobs.get(name);
    if (job) {
      job.stop();
      console.log(`Stopped job: ${name}`);
    }
  }

  startAll() {
    for (const [name, job] of this.jobs) {
      job.start();
      console.log(`Started job: ${name}`);
    }
  }

  stopAll() {
    for (const [name, job] of this.jobs) {
      job.stop();
      console.log(`Stopped job: ${name}`);
    }
  }
}

export const setupScheduledJobs = () => {
  const scheduler = new JobScheduler();
  const container = setupDIContainer();
  const expiryJob = new ReservationExpiryJob(
    container.resolve('reservationRepository'),
    container.resolve('paymentService'),
    container.resolve('eventPublisher')
  );
  scheduler.scheduleJob(
    'reservation-expiry',
    '0 * * * *', // Every hour
    () => expiryJob.execute()
  );
  scheduler.scheduleJob(
    'reservation-reminders',
    '0 10 * * *', // Daily at 10 AM
    async () => {
      console.log('Running reservation reminder job...');
      // Implementation for sending reminders
    }
  );
  return scheduler;
}; 