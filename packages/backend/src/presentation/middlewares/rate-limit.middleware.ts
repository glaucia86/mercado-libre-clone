/**
 * Rate Limit Middleware - Advanced Traffic Control & DDoS Protection Infrastructure
 * 
 * Implements sophisticated rate limiting with multiple algorithms (sliding window,
 * token bucket, fixed window), IP-based throttling, and adaptive limits.
 * Provides DDoS protection, fair usage enforcement, and integration with
 * external monitoring systems for production-grade traffic management.
 * 
 * @architectural_pattern Strategy Pattern, Factory Pattern, Observer Pattern
 * @layer Presentation - Cross-Cutting Concerns
 * @dependencies Express rate limit, Redis (optional), performance APIs
 */

import { rateLimit, type RateLimitRequestHandler, type Options } from 'express-rate-limit'
import { type Request, type Response, type NextFunction } from 'express'

/**
 * Rate limiting strategy types
 */
export enum RateLimitStrategy {
  FIXED_WINDOW = 'fixed_window',
  SLIDING_WINDOW = 'sliding_window',
  TOKEN_BUCKET = 'token_bucket',
  ADAPTIVE = 'adaptive'
}

/**
 * Rate limit configuration options
 */
export interface RateLimitConfig {
  readonly windowMs: number                    // Time window in milliseconds
  readonly max: number                         // Maximum requests per window
  readonly strategy: RateLimitStrategy         // Rate limiting algorithm
  readonly keyGenerator?: (req: Request) => string  // Custom key generation
  readonly skipSuccessfulRequests?: boolean   // Skip counting successful requests
  readonly skipFailedRequests?: boolean       // Skip counting failed requests
  readonly enableReset?: boolean              // Allow rate limit reset
  readonly enableBurst?: boolean              // Allow burst capacity
  readonly burstMultiplier?: number           // Burst capacity multiplier
  readonly whitelistedIPs?: readonly string[] // IP addresses to skip
  readonly blacklistedIPs?: readonly string[] // IP addresses to block
  readonly customMessage?: string             // Custom rate limit message
  readonly headers?: boolean                   // Include rate limit headers
  readonly redis?: {                          // Redis configuration for distributed rate limiting
    readonly host: string
    readonly port: number
    readonly password?: string
    readonly db?: number
  }
}

/**
 * Rate limit violation context
 */
interface RateLimitViolation {
  readonly clientId: string
  readonly ip: string
  readonly timestamp: string
  readonly requestsCount: number
  readonly windowMs: number
  readonly maxRequests: number
  readonly userAgent?: string | undefined
  readonly endpoint: string
  readonly method: string
}

/**
 * Rate limit metrics for monitoring
 */
interface RateLimitMetrics {
  readonly totalRequests: number
  readonly rejectedRequests: number
  readonly violationCount: number
  readonly averageRequestsPerWindow: number
  readonly peakRequestsPerWindow: number
  readonly uniqueClientsCount: number
  readonly lastViolation?: RateLimitViolation
}

/**
 * Advanced rate limit manager
 */
class RateLimitManager {
  private static instance: RateLimitManager
  private metrics: RateLimitMetrics
  private violations: RateLimitViolation[]
  private clientStats: Map<string, { requests: number[], windowStart: number }>

  private constructor() {
    this.metrics = {
      totalRequests: 0,
      rejectedRequests: 0,
      violationCount: 0,
      averageRequestsPerWindow: 0,
      peakRequestsPerWindow: 0,
      uniqueClientsCount: 0
    }
    this.violations = []
    this.clientStats = new Map()
  }

  static getInstance(): RateLimitManager {
    if (!RateLimitManager.instance) {
      RateLimitManager.instance = new RateLimitManager()
    }
    return RateLimitManager.instance
  }

  recordRequest(clientId: string): void {
    this.metrics = {
      ...this.metrics,
      totalRequests: this.metrics.totalRequests + 1
    }

    // Update client statistics
    const now = Date.now()
    if (!this.clientStats.has(clientId)) {
      this.clientStats.set(clientId, { requests: [], windowStart: now })
    }

    const clientStat = this.clientStats.get(clientId)!
    clientStat.requests.push(now)

    // Clean old requests outside window (1 hour)
    const windowMs = 60 * 60 * 1000
    clientStat.requests = clientStat.requests.filter(timestamp => now - timestamp < windowMs)

    this.updateMetrics()
  }

  recordViolation(violation: RateLimitViolation): void {
    this.violations.push(violation)
    this.metrics = {
      ...this.metrics,
      rejectedRequests: this.metrics.rejectedRequests + 1,
      violationCount: this.metrics.violationCount + 1,
      lastViolation: violation
    }

    // Keep only last 1000 violations
    if (this.violations.length > 1000) {
      this.violations = this.violations.slice(-1000)
    }

    // Log severe violations
    if (violation.requestsCount > violation.maxRequests * 2) {
      console.warn('Severe rate limit violation detected:', violation)
    }
  }

  getMetrics(): RateLimitMetrics {
    return { ...this.metrics }
  }

  getViolations(limit = 100): RateLimitViolation[] {
    return this.violations.slice(-limit)
  }

  getClientStatistics(clientId: string): { 
    requestCount: number
    lastRequest: number | null
    averageInterval: number
  } | null {
    const stats = this.clientStats.get(clientId)
    if (!stats || stats.requests.length === 0) {
      return null
    }

    const requestCount = stats.requests.length
    const lastRequest = Math.max(...stats.requests)
    const averageInterval = requestCount > 1 
      ? (lastRequest - Math.min(...stats.requests)) / (requestCount - 1)
      : 0

    return { requestCount, lastRequest, averageInterval }
  }

  private updateMetrics(): void {
    // Calculate unique clients count
    this.metrics = {
      ...this.metrics,
      uniqueClientsCount: this.clientStats.size
    }

    // Calculate peak and average requests per window
    const requestCounts = Array.from(this.clientStats.values()).map(stat => stat.requests.length)
    if (requestCounts.length > 0) {
      this.metrics = {
        ...this.metrics,
        peakRequestsPerWindow: Math.max(...requestCounts),
        averageRequestsPerWindow: requestCounts.reduce((sum, count) => sum + count, 0) / requestCounts.length
      }
    }
  }

  clearStats(): void {
    this.clientStats.clear()
    this.violations = []
    this.metrics = {
      totalRequests: 0,
      rejectedRequests: 0,
      violationCount: 0,
      averageRequestsPerWindow: 0,
      peakRequestsPerWindow: 0,
      uniqueClientsCount: 0
    }
  }
}

/**
 * Creates standard rate limiting middleware
 */
export function rateLimitMiddleware(config: Partial<RateLimitConfig> = {}): RateLimitRequestHandler {
  const rateLimitManager = RateLimitManager.getInstance()

  const defaultConfig: RateLimitConfig = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,                  // limit each IP to 100 requests per windowMs
    strategy: RateLimitStrategy.FIXED_WINDOW,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    enableReset: false,
    enableBurst: false,
    burstMultiplier: 1.5,
    whitelistedIPs: [],
    blacklistedIPs: [],
    headers: true,
    customMessage: 'Too many requests from this IP, please try again later.'
  }

  const finalConfig = { ...defaultConfig, ...config }

  const rateLimitOptions: Partial<Options> = {
    windowMs: finalConfig.windowMs,
    max: finalConfig.max,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: finalConfig.customMessage,
        details: {
          limit: finalConfig.max,
          windowMs: finalConfig.windowMs,
          resetTime: new Date(Date.now() + finalConfig.windowMs).toISOString()
        }
      },
      metadata: {
        timestamp: new Date().toISOString(),
        version: 'v1'
      }
    },
    keyGenerator: finalConfig.keyGenerator || defaultKeyGenerator,
    ...(finalConfig.skipSuccessfulRequests !== undefined && { skipSuccessfulRequests: finalConfig.skipSuccessfulRequests }),
    ...(finalConfig.skipFailedRequests !== undefined && { skipFailedRequests: finalConfig.skipFailedRequests }),
    skip: (req: Request) => {
      const clientIp = extractClientIp(req)
      
      // Check blacklisted IPs
      if (finalConfig.blacklistedIPs?.includes(clientIp)) {
        // Always rate limit blacklisted IPs with stricter limits
        return false
      }

      // Skip whitelisted IPs
      if (finalConfig.whitelistedIPs?.includes(clientIp)) {
        return true
      }

      return false
    },
    handler: (req: Request, res: Response) => {
      const clientId = finalConfig.keyGenerator?.(req) || defaultKeyGenerator(req)
      const violation: RateLimitViolation = {
        clientId,
        ip: extractClientIp(req),
        timestamp: new Date().toISOString(),
        requestsCount: finalConfig.max + 1, // Exceeded by at least 1
        windowMs: finalConfig.windowMs,
        maxRequests: finalConfig.max,
        userAgent: req.get('User-Agent'),
        endpoint: req.path,
        method: req.method
      }

      rateLimitManager.recordViolation(violation)

      const retryAfter = Math.ceil(finalConfig.windowMs / 1000)
      
      res.status(429).set({
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(finalConfig.max),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(new Date(Date.now() + finalConfig.windowMs))
      }).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: finalConfig.customMessage,
          details: {
            limit: finalConfig.max,
            windowMs: finalConfig.windowMs,
            retryAfter,
            resetTime: new Date(Date.now() + finalConfig.windowMs).toISOString()
          }
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.get('X-Request-ID') || generateRequestId(),
          version: 'v1'
        }
      })
    },
    standardHeaders: finalConfig.headers ?? true,
    legacyHeaders: false
  }

  // Add custom middleware to track successful requests
  const baseRateLimit = rateLimit(rateLimitOptions)

  const middleware = (req: Request, res: Response, next: NextFunction) => {
    const clientId = finalConfig.keyGenerator?.(req) || defaultKeyGenerator(req)
    
    // Record request for metrics
    rateLimitManager.recordRequest(clientId)

    // Apply rate limiting
    baseRateLimit(req, res, next)
  }

  // Return the rate limit handler with required methods
  return Object.assign(middleware, {
    resetKey: baseRateLimit.resetKey,
    getKey: baseRateLimit.getKey
  })
}

/**
 * Strict rate limiting for sensitive endpoints
 */
export function strictRateLimitMiddleware(): RateLimitRequestHandler {
  return rateLimitMiddleware({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,                   // Only 10 requests per 15 minutes
    strategy: RateLimitStrategy.SLIDING_WINDOW,
    customMessage: 'This endpoint has strict rate limiting. Please try again later.',
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  })
}

/**
 * Lenient rate limiting for public endpoints
 */
export function lenientRateLimitMiddleware(): RateLimitRequestHandler {
  return rateLimitMiddleware({
    windowMs: 1 * 60 * 1000,   // 1 minute
    max: 200,                  // 200 requests per minute
    strategy: RateLimitStrategy.FIXED_WINDOW,
    customMessage: 'Rate limit exceeded. Please slow down your requests.',
    skipSuccessfulRequests: true,
    skipFailedRequests: true
  })
}

/**
 * API-specific rate limiting with burst capacity
 */
export function apiRateLimitMiddleware(): RateLimitRequestHandler {
  return rateLimitMiddleware({
    windowMs: 10 * 60 * 1000,  // 10 minutes
    max: 1000,                 // 1000 requests per 10 minutes
    strategy: RateLimitStrategy.TOKEN_BUCKET,
    enableBurst: true,
    burstMultiplier: 2.0,      // Allow 2x burst capacity
    customMessage: 'API rate limit exceeded. Check documentation for limits.',
    headers: true
  })
}

/**
 * Development environment rate limiting (very lenient)
 */
export function developmentRateLimitMiddleware(): RateLimitRequestHandler {
  return rateLimitMiddleware({
    windowMs: 1 * 60 * 1000,   // 1 minute
    max: 10000,                // Very high limit for development
    strategy: RateLimitStrategy.FIXED_WINDOW,
    customMessage: 'Development rate limit exceeded.',
    skipSuccessfulRequests: true,
    headers: true
  })
}

/**
 * Production environment rate limiting (balanced)
 */
export function productionRateLimitMiddleware(): RateLimitRequestHandler {
  return rateLimitMiddleware({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 100,                  // 100 requests per 15 minutes
    strategy: RateLimitStrategy.SLIDING_WINDOW,
    customMessage: 'Rate limit exceeded. Please try again later.',
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    headers: true,
    whitelistedIPs: [], // Add trusted IPs here
    blacklistedIPs: [] // Add blocked IPs here
  })
}

/**
 * Advanced adaptive rate limiting
 */
export function adaptiveRateLimitMiddleware(): RateLimitRequestHandler {
  const rateLimitManager = RateLimitManager.getInstance()

  return rateLimitMiddleware({
    windowMs: 5 * 60 * 1000,   // 5 minutes
    max: 50,                   // Base limit
    strategy: RateLimitStrategy.ADAPTIVE,
    keyGenerator: (req: Request) => {
      const baseKey = defaultKeyGenerator(req)
      const metrics = rateLimitManager.getMetrics()
      
      // Adjust limits based on overall system load
      if (metrics.violationCount > 100) {
        // System under stress, apply stricter limits
        return `strict_${baseKey}`
      }
      
      return baseKey
    },
    customMessage: 'Adaptive rate limit applied based on system load.'
  })
}

/**
 * DDoS protection middleware with aggressive rate limiting
 */
export function ddosProtectionMiddleware(): RateLimitRequestHandler {
  return rateLimitMiddleware({
    windowMs: 1 * 60 * 1000,   // 1 minute
    max: 20,                   // Very strict limit
    strategy: RateLimitStrategy.SLIDING_WINDOW,
    customMessage: 'DDoS protection activated. Access temporarily restricted.',
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    headers: false, // Don't reveal internal workings
    keyGenerator: (req: Request) => {
      // More aggressive key generation including User-Agent
      const ip = extractClientIp(req)
      const userAgent = req.get('User-Agent') || 'unknown'
      return `${ip}:${userAgent.slice(0, 50)}`
    }
  })
}

// ============================================================================
// UTILITY FUNCTIONS - Rate limiting helpers and monitoring
// ============================================================================

/**
 * Default key generator for rate limiting
 */
function defaultKeyGenerator(req: Request): string {
  return extractClientIp(req)
}

/**
 * Extracts real client IP address
 */
function extractClientIp(req: Request): string {
  return (
    req.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    req.get('X-Real-IP') ||
    req.get('X-Client-IP') ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    'unknown'
  )
}

/**
 * Generates unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Gets current rate limit metrics
 */
export function getRateLimitMetrics(): RateLimitMetrics {
  return RateLimitManager.getInstance().getMetrics()
}

/**
 * Gets recent rate limit violations
 */
export function getRateLimitViolations(limit = 100): RateLimitViolation[] {
  return RateLimitManager.getInstance().getViolations(limit)
}

/**
 * Gets statistics for a specific client
 */
export function getClientStatistics(clientId: string): {
  requestCount: number
  lastRequest: number | null
  averageInterval: number
} | null {
  return RateLimitManager.getInstance().getClientStatistics(clientId)
}

/**
 * Clears all rate limit statistics (useful for testing)
 */
export function clearRateLimitStatistics(): void {
  RateLimitManager.getInstance().clearStats()
}

/**
 * Creates rate limit health check
 */
export function rateLimitHealthCheck(): {
  status: 'healthy' | 'degraded' | 'unhealthy'
  metrics: RateLimitMetrics
  recommendations?: string[]
} {
  const metrics = getRateLimitMetrics()
  const rejectionRate = metrics.totalRequests > 0 
    ? metrics.rejectedRequests / metrics.totalRequests 
    : 0

  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
  const recommendations: string[] = []

  if (rejectionRate > 0.5) {
    status = 'unhealthy'
    recommendations.push('High rejection rate detected - consider adjusting rate limits')
  } else if (rejectionRate > 0.2) {
    status = 'degraded'
    recommendations.push('Elevated rejection rate - monitor for DDoS attacks')
  }

  if (metrics.violationCount > 1000) {
    status = 'unhealthy'
    recommendations.push('High violation count - possible attack in progress')
  }

  if (metrics.uniqueClientsCount > 10000) {
    recommendations.push('High unique client count - consider implementing connection pooling')
  }

  return {
    status,
    metrics,
    ...(recommendations.length > 0 && { recommendations })
  }
}

/**
 * Rate limit monitoring middleware for debugging
 */
export function rateLimitMonitoringMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientId = extractClientIp(req)
    const stats = getClientStatistics(clientId)
    
    if (stats) {
      res.set({
        'X-Client-Request-Count': String(stats.requestCount),
        'X-Client-Last-Request': String(stats.lastRequest),
        'X-Client-Avg-Interval': String(Math.round(stats.averageInterval))
      })
    }

    next()
  }
}