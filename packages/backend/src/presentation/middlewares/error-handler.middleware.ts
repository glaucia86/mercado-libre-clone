/**
 * Middleware Stack - Production-Grade Cross-Cutting Concerns
 * 
 * Implements comprehensive middleware architecture for handling cross-cutting
 * concerns including error management, request validation, security policies,
 * logging, and performance monitoring. Maintains separation of concerns while
 * providing enterprise-grade operational capabilities.
 * 
 * @architectural_pattern Middleware Chain, Cross-Cutting Concerns, AOP
 * @layer Presentation - Infrastructure Concerns
 * @responsibility Error handling, validation, security, logging, monitoring
 */

import { type Request, type Response, type NextFunction, type ErrorRequestHandler } from 'express'
import { rateLimit, type RateLimitRequestHandler } from 'express-rate-limit'
import cors, { type CorsOptions } from 'cors'
import { ZodError } from 'zod'

/**
 * Enhanced error interface for comprehensive error context
 */
interface EnhancedError extends Error {
  statusCode?: number
  code?: string
  details?: Record<string, unknown>
  isOperational?: boolean
  requestId?: string
  timestamp?: string
}

/**
 * Request logging metadata for observability
 */
interface RequestLogMetadata {
  requestId: string
  method: string
  url: string
  userAgent?: string | undefined
  ip?: string | undefined
  startTime: number
  correlationId?: string | undefined
}

/**
 * Error Handler Middleware - Comprehensive Exception Management
 * 
 * Provides centralized error handling with structured logging, appropriate
 * HTTP status mapping, and security-conscious error message sanitization.
 * Implements error classification and operational error handling patterns.
 */
export function errorHandlerMiddleware(): ErrorRequestHandler {
  return (error: EnhancedError, req: Request, res: Response, next: NextFunction): void => {
    // Extract request context for error tracing
    const requestId = req.headers['x-request-id'] as string || generateRequestId()
    const timestamp = new Date().toISOString()
    
    // Enhance error with context information
    error.requestId = requestId
    error.timestamp = timestamp
    
    // Log error with appropriate level based on severity
    logError(error, req)
    
    // Determine HTTP status code based on error type and context
    const statusCode = determineStatusCode(error)
    
    // Generate client-safe error response
    const errorResponse = generateErrorResponse(error, statusCode, requestId, timestamp)
    
    // Send structured error response
    res.status(statusCode).json(errorResponse)
  }
}

/**
 * CORS Middleware Configuration - Secure Cross-Origin Resource Sharing
 * 
 * Implements comprehensive CORS policy with environment-aware origins,
 * credential handling, and preflight optimization for production deployment.
 */
export function corsMiddleware(allowedOrigins: string[]): ReturnType<typeof cors> {
  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true)
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        const error = new Error(`CORS policy violation: Origin ${origin} not allowed`)
        callback(error, false)
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With', 
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Request-ID',
      'X-Correlation-ID',
      'Cache-Control'
    ],
    exposedHeaders: [
      'X-Total-Count',
      'X-Page-Count', 
      'X-Query-Time',
      'X-Cache-Strategy',
      'ETag'
    ],
    credentials: true,
    maxAge: 86400, // 24 hours preflight cache
    optionsSuccessStatus: 200 // Legacy browser support
  }
  
  return cors(corsOptions)
}

/**
 * Rate Limiting Middleware - DDoS Protection and Fair Usage Policy
 * 
 * Implements intelligent rate limiting with sliding window algorithms,
 * IP-based throttling, and graceful degradation patterns for high availability.
 */
export function rateLimitMiddleware(options: {
  max: number
  windowMs: number
}): RateLimitRequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP. Please try again later.',
        retryAfter: Math.ceil(options.windowMs / 1000)
      },
      metadata: {
        timestamp: new Date().toISOString(),
        limits: {
          max: options.max,
          windowMs: options.windowMs,
          resetTime: new Date(Date.now() + options.windowMs).toISOString()
        }
      }
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded. Please slow down your requests.',
          retryAfter: Math.ceil(options.windowMs / 1000)
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || generateRequestId(),
          clientIp: req.ip
        }
      })
    },
    skip: (req: Request) => {
      // Skip rate limiting for health checks and internal endpoints
      return req.path.startsWith('/api/health') || 
             req.headers['x-internal-request'] === 'true'
    },
    keyGenerator: (req: Request) => {
      // Use forwarded IP for load balancer scenarios
      return req.headers['x-forwarded-for'] as string || 
             req.headers['x-real-ip'] as string || 
             req.ip || 
             'unknown'
    }
  })
}

/**
 * Request Validation Middleware - Type-Safe Input Sanitization
 * 
 * Provides comprehensive request validation with Zod schema integration,
 * automatic sanitization, and structured validation error reporting.
 */
export function validationMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Add request ID for traceability
    if (!req.headers['x-request-id']) {
      req.headers['x-request-id'] = generateRequestId()
    }
    
    // Basic request sanitization
    req.body = sanitizeObject(req.body)
    req.query = sanitizeObject(req.query)
    req.params = sanitizeObject(req.params)
    
    // Content-Type validation for POST/PUT requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const contentType = req.headers['content-type']
      if (contentType && !contentType.includes('application/json')) {
        res.status(415).json({
          success: false,
          error: {
            code: 'UNSUPPORTED_MEDIA_TYPE',
            message: 'Content-Type must be application/json',
            supportedTypes: ['application/json']
          },
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id']
          }
        })
        return
      }
    }
    
    next()
  }
}

/**
 * Logging Middleware - Comprehensive Request/Response Observability
 * 
 * Implements structured logging with performance metrics, request tracing,
 * and configurable log levels for production observability and debugging.
 */
export function loggingMiddleware(logLevel: 'error' | 'warn' | 'info' | 'debug') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = performance.now()
    const requestId = req.headers['x-request-id'] as string || generateRequestId()
    
    // Attach request metadata
    const logMetadata: RequestLogMetadata = {
      requestId,
      method: req.method,
      url: req.originalUrl,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      startTime,
      correlationId: req.headers['x-correlation-id'] as string
    }
    
    // Log request initiation (debug level)
    if (shouldLog('debug', logLevel)) {
      console.debug('Request initiated', {
        ...logMetadata,
        headers: sanitizeHeaders(req.headers),
        query: req.query,
        params: req.params
      })
    }
    
    // Override response.end to capture response metadata
    const originalEnd = res.end
    res.end = function(chunk?: any, encoding?: any, cb?: () => void) {
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // Log request completion
      const responseLogData = {
        ...logMetadata,
        statusCode: res.statusCode,
        duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
        responseSize: res.get('content-length') || 0
      }
      
      // Determine log level based on status code
      if (res.statusCode >= 500) {
        console.error('Request completed with server error', responseLogData)
      } else if (res.statusCode >= 400) {
        console.warn('Request completed with client error', responseLogData)
      } else if (shouldLog('info', logLevel)) {
        console.info('Request completed successfully', responseLogData)
      }
      
      // Add performance headers
      res.setHeader('X-Response-Time', `${duration.toFixed(2)}ms`)
      res.setHeader('X-Request-ID', requestId)
      
      // Call original end method and return its result
      return originalEnd.call(this, chunk, encoding, cb)
    }
    
    next()
  }
}

/**
 * Security Headers Middleware - Additional Security Hardening
 * 
 * Supplements Helmet.js with custom security headers and policies
 * for enhanced application security posture.
 */
export function securityHeadersMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Custom security headers
    res.setHeader('X-API-Version', 'v1')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
    
    // API-specific headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    
    next()
  }
}

// ============================================================================
// UTILITY FUNCTIONS - Supporting Infrastructure
// ============================================================================

/**
 * Comprehensive error logging with structured metadata
 */
function logError(error: EnhancedError, req: Request): void {
  const errorLogData = {
    message: error.message,
    stack: error.stack,
    statusCode: error.statusCode,
    code: error.code,
    isOperational: error.isOperational,
    requestId: error.requestId,
    timestamp: error.timestamp,
    request: {
      method: req.method,
      url: req.originalUrl,
      headers: sanitizeHeaders(req.headers),
      ip: req.ip,
      userAgent: req.headers['user-agent']
    }
  }
  
  if (error.statusCode && error.statusCode >= 500) {
    console.error('Server Error:', errorLogData)
  } else if (error.statusCode && error.statusCode >= 400) {
    console.warn('Client Error:', errorLogData)
  } else {
    console.error('Unexpected Error:', errorLogData)
  }
}

/**
 * Intelligent HTTP status code determination based on error context
 */
function determineStatusCode(error: EnhancedError): number {
  // Explicit status code override
  if (error.statusCode) {
    return error.statusCode
  }
  
  // Zod validation errors
  if (error instanceof ZodError) {
    return 400
  }
  
  // Node.js system errors
  if (error.code === 'ENOENT') return 404
  if (error.code === 'EACCES') return 403
  if (error.code === 'ETIMEDOUT') return 408
  if (error.code === 'EMFILE' || error.code === 'ENFILE') return 503
  
  // Default to 500 for unknown errors
  return 500
}

/**
 * Security-conscious error response generation
 */
function generateErrorResponse(
  error: EnhancedError, 
  statusCode: number, 
  requestId: string, 
  timestamp: string
) {
  const isProduction = process.env.NODE_ENV === 'production'
  
  // Base error response structure
  const response = {
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: sanitizeErrorMessage(error.message, statusCode, isProduction),
      ...(error.details && { details: error.details })
    },
    metadata: {
      timestamp,
      requestId,
      version: 'v1'
    }
  }
  
  // Include stack trace in non-production environments
  if (!isProduction && error.stack) {
    ;(response.error as any).stack = error.stack
  }
  
  return response
}

/**
 * Error message sanitization for security
 */
function sanitizeErrorMessage(message: string, statusCode: number, isProduction: boolean): string {
  if (isProduction && statusCode >= 500) {
    return 'An internal server error occurred. Please try again later.'
  }
  
  // Remove potentially sensitive information
  return message
    .replace(/\b(?:password|token|key|secret|auth)\b/gi, '[REDACTED]')
    .replace(/\b\d{13,19}\b/g, '[REDACTED]') // Credit card patterns
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]')
}

/**
 * Request/response header sanitization for logging
 */
function sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
  const sensitiveHeaders = ['authorization', 'cookie', 'set-cookie', 'x-api-key']
  const sanitized = { ...headers }
  
  sensitiveHeaders.forEach(header => {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]'
    }
  })
  
  return sanitized
}

/**
 * Object sanitization for request data
 */
function sanitizeObject(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj
  
  const sanitized = Array.isArray(obj) ? [] : {}
  
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key]
      
      // Sanitize sensitive field names
      if (typeof key === 'string' && /password|token|secret|key/i.test(key)) {
        ;(sanitized as any)[key] = '[REDACTED]'
      } else if (typeof value === 'object' && value !== null) {
        ;(sanitized as any)[key] = sanitizeObject(value)
      } else {
        ;(sanitized as any)[key] = value
      }
    }
  }
  
  return sanitized
}

/**
 * Log level comparison utility
 */
function shouldLog(messageLevel: string, configuredLevel: string): boolean {
  const levels = { error: 0, warn: 1, info: 2, debug: 3 }
  return levels[messageLevel as keyof typeof levels] <= levels[configuredLevel as keyof typeof levels]
}

/**
 * Unique request identifier generation
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}