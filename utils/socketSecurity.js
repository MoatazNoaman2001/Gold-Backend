// Socket.io Security Configuration for Production
export const SOCKET_SECURITY_CONFIG = {
  // Rate limiting configuration
  RATE_LIMITS: {
    sendMessage: { window: 60000, max: 10 }, // 10 messages per minute
    createConversation: { window: 300000, max: 5 }, // 5 conversations per 5 minutes
    joinConversation: { window: 60000, max: 20 }, // 20 joins per minute
    getMessages: { window: 60000, max: 30 }, // 30 requests per minute
    markAsRead: { window: 60000, max: 50 }, // 50 marks per minute
  },

  // Content validation
  CONTENT_LIMITS: {
    maxMessageLength: 1000,
    maxConcurrentConnections: 5, // Max connections per user
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  },

  // Security headers
  SECURITY_HEADERS: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
  },

  // Input sanitization patterns
  SANITIZATION_PATTERNS: {
    htmlTags: /<[^>]*>/g,
    scriptTags: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    eventHandlers: /on\w+\s*=/gi,
    javascriptProtocol: /javascript:/gi,
    dataProtocol: /data:/gi,
    vbscriptProtocol: /vbscript:/gi,
  },

  // MongoDB ObjectId validation
  OBJECT_ID_PATTERN: /^[a-fA-F0-9]{24}$/,

  // Suspicious activity detection
  SUSPICIOUS_PATTERNS: {
    sqlInjection: /(\b(union|select|insert|update|delete|drop|create|alter)\b)/gi,
    xssAttempts: /<script|javascript:|on\w+\s*=|data:text\/html/gi,
    pathTraversal: /\.\.\/|\.\.\\/gi,
  }
};

// Enhanced input sanitization for production
export const sanitizeInput = (input, options = {}) => {
  if (typeof input !== 'string') return '';
  
  const { maxLength = 1000, allowHtml = false } = options;
  
  let sanitized = input.trim();
  
  if (!allowHtml) {
    // Remove HTML tags
    sanitized = sanitized.replace(SOCKET_SECURITY_CONFIG.SANITIZATION_PATTERNS.htmlTags, '');
    
    // Remove script tags
    sanitized = sanitized.replace(SOCKET_SECURITY_CONFIG.SANITIZATION_PATTERNS.scriptTags, '');
    
    // Remove event handlers
    sanitized = sanitized.replace(SOCKET_SECURITY_CONFIG.SANITIZATION_PATTERNS.eventHandlers, '');
    
    // Remove dangerous protocols
    sanitized = sanitized.replace(SOCKET_SECURITY_CONFIG.SANITIZATION_PATTERNS.javascriptProtocol, '');
    sanitized = sanitized.replace(SOCKET_SECURITY_CONFIG.SANITIZATION_PATTERNS.dataProtocol, '');
    sanitized = sanitized.replace(SOCKET_SECURITY_CONFIG.SANITIZATION_PATTERNS.vbscriptProtocol, '');
  }
  
  // Check for suspicious patterns
  const suspiciousPatterns = Object.values(SOCKET_SECURITY_CONFIG.SUSPICIOUS_PATTERNS);
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(sanitized)) {
      console.warn(`Suspicious input detected: ${sanitized.substring(0, 100)}...`);
      return ''; // Return empty string for suspicious content
    }
  }
  
  // Limit length
  return sanitized.substring(0, maxLength);
};

// Enhanced rate limiting with sliding window
export class RateLimiter {
  constructor() {
    this.requests = new Map();
  }

  isAllowed(userId, eventType, limit = 10, window = 60000) {
    const key = `${userId}-${eventType}`;
    const now = Date.now();
    const userRequests = this.requests.get(key) || [];
    
    // Remove old requests outside the window
    const recentRequests = userRequests.filter(time => now - time < window);
    
    if (recentRequests.length >= limit) {
      return false;
    }
    
    recentRequests.push(now);
    this.requests.set(key, recentRequests);
    return true;
  }

  cleanup() {
    const now = Date.now();
    for (const [key, requests] of this.requests.entries()) {
      const recentRequests = requests.filter(time => now - time < 60000);
      if (recentRequests.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, recentRequests);
      }
    }
  }
}

// Security monitoring and logging
export const SecurityLogger = {
  logEvent: (eventName, userId, data) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Event: ${eventName} | User: ${userId} | Data: ${JSON.stringify(data)}`);
  },

  logSuspiciousActivity: (userId, activity, details) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] SUSPICIOUS ACTIVITY | User: ${userId} | Activity: ${activity} | Details: ${details}`);
  },

  logSecurityViolation: (userId, violation, details) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] SECURITY VIOLATION | User: ${userId} | Violation: ${violation} | Details: ${details}`);
  }
};

// Connection monitoring
export class ConnectionMonitor {
  constructor() {
    this.connections = new Map();
    this.maxConnectionsPerUser = SOCKET_SECURITY_CONFIG.CONTENT_LIMITS.maxConcurrentConnections;
  }

  addConnection(userId, socketId) {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    
    const userConnections = this.connections.get(userId);
    
    if (userConnections.size >= this.maxConnectionsPerUser) {
      return false; // Too many connections
    }
    
    userConnections.add(socketId);
    return true;
  }

  removeConnection(userId, socketId) {
    const userConnections = this.connections.get(userId);
    if (userConnections) {
      userConnections.delete(socketId);
      if (userConnections.size === 0) {
        this.connections.delete(userId);
      }
    }
  }

  getConnectionCount(userId) {
    const userConnections = this.connections.get(userId);
    return userConnections ? userConnections.size : 0;
  }
} 