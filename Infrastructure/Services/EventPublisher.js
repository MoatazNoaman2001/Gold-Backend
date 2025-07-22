export class EventPublisher {
  constructor() {
    this.handlers = new Map();
  }

  subscribe(eventType, handler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType).push(handler);
  }

  async publish(eventType, eventData) {
    const handlers = this.handlers.get(eventType) || [];
    await Promise.all(
      handlers.map(handler => 
        handler(eventData).catch(error => 
          console.error(`Error in event handler for ${eventType}:`, error)
        )
      )
    );
  }
} 