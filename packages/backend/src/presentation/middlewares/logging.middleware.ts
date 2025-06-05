/**
 * Logging Middleware - Structured Request/Response Logging Infrastructure
 * 
 * Implements comprehensive HTTP request/response logging with correlation IDs,
 * performance metrics, and structured JSON output for production observability.
 * Supports multiple log levels, request tracing, and integration with external
 * monitoring systems.
 * 
 * @architectural_pattern Observer Pattern, Chain of Responsibility
 * @layer Presentation - Cross-Cutting Concerns
 * @dependencies Express types, performance measurement APIs
 */

import { type Request, type Response, type NextFunction } from 'express'
import { performance } from 'perf_hooks'

/**
 * Log levels for structured logging
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn', 
  INFO = 'info',
  DEBUG = 'debug'
}

/**
 * Request metadata for logging context
 */
interface RequestLogMetadata {
  readonly requestId: string
  readonly correlationId?: string | undefined
  readonly method: string
  readonly url: string
  readonly originalUrl: string
  readonly baseUrl: string
  readonly path: string
  readonly userAgent?: string | undefined
  readonly referer?: string | undefined
  readonly clientIp: string
  readonly protocol: string
  readonly timestamp: string
  readonly startTime: number
  readonly headers: Record<string, string>
  readonly query: Record<string, any>
  readonly params: Record<string, any>
}

/**
 * Response metadata for logging context
 */
interface ResponseLogMetadata {
  readonly statusCode: number
  readonly statusMessage: string
  readonly contentLength?: number
  readonly contentType?: string
  readonly headers: Record<string, string>
  readonly responseTime: number
  readonly endTime: number
  readonly cached?: boolean
  readonly errorCode?: string
}

/**
 * Complete log entry structure
 */
interface RequestLogEntry {
  readonly level: LogLevel
  readonly message: string
  readonly request: RequestLogMetadata
  readonly response?: ResponseLogMetadata
  readonly error?: {
    readonly name: string
    readonly message: string
    readonly stack?: string
    readonly code?: string
  }
  readonly performance: {
    readonly duration: number
    readonly memoryUsage: NodeJS.MemoryUsage
    readonly cpuUsage?: NodeJS.CpuUsage
  }
  readonly metadata?: Record<string, unknown>
}

/**
 * Logging middleware configuration
 */
interface LoggingOptions {
  readonly level: LogLevel
  readonly enablePerformanceMetrics: boolean
  readonly enableHeaders: boolean
  readonly enableRequestBody: boolean
  readonly enableResponseBody: boolean
  readonly sanitizeHeaders: readonly string[]
  readonly excludePaths: readonly string[]
  readonly slowRequestThreshold: number
  readonly enableCorrelationId: boolean
  readonly customLogFormat?: (entry: RequestLogEntry) => void
  readonly skipSuccessfulRequests?: boolean
  readonly maxBodySize: number
}

/**
 * Default logging configuration
 */
const DEFAULT_LOGGING_OPTIONS: LoggingOptions = {
  level: LogLevel.INFO,
  enablePerformanceMetrics: true,
  enableHeaders: true,
  enableRequestBody: false,
  enableResponseBody: false,
  sanitizeHeaders: ['authorization', 'cookie', 'x-api-key', 'x-auth-token'],
  excludePaths: ['/health', '/favicon.ico'],
  slowRequestThreshold: 1000, // ms
  enableCorrelationId: true,
  skipSuccessfulRequests: false,
  maxBodySize: 10000 // bytes
}

/**
 * Performance metrics tracker
 */
class PerformanceTracker {
  private static instance: PerformanceTracker
  private metrics: Map<string, Array<number>> = new Map()

  static getInstance(): PerformanceTracker {
    if (!PerformanceTracker.instance) {
      PerformanceTracker.instance = new PerformanceTracker()
    }
    return PerformanceTracker.instance
  }

  recordRequestDuration(path: string, duration: number): void {
    if (!this.metrics.has(path)) {
      this.metrics.set(path, [])
    }
    
    const pathMetrics = this.metrics.get(path)!
    pathMetrics.push(duration)
    
    // Keep only last 100 measurements per path
    if (pathMetrics.length > 100) {
      pathMetrics.shift()
    }
  }

  getPathStatistics(path: string): {
    avg: number
    min: number
    max: number
    count: number
    p95: number
  } | null {
    const measurements = this.metrics.get(path)
    if (!measurements || measurements.length === 0) {
      return null
    }

    const sorted = [...measurements].sort((a, b) => a - b)
    const count = sorted.length
    const avg = sorted.reduce((sum, val) => sum + val, 0) / count
    const min = sorted[0]!
    const max = sorted[count - 1]!
    const p95Index = Math.floor(count * 0.95)
    const p95 = sorted[p95Index] || max

    return { avg, min, max, count, p95 }
  }

  getAllMetrics(): Record<string, any> {
    const result: Record<string, any> = {}
    
    for (const [path, measurements] of this.metrics.entries()) {
      result[path] = this.getPathStatistics(path)
    }
    
    return result
  }
}

/**
 * Main logging middleware factory
 */
export function loggingMiddleware(
  options: Partial<LoggingOptions> = {}
): (req: Request, res: Response, next: NextFunction) => void {
  const config = { ...DEFAULT_LOGGING_OPTIONS, ...options }
  const performanceTracker = PerformanceTracker.getInstance()

  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if this path should be excluded from logging
    if (shouldExcludePath(req.path, config.excludePaths)) {
      return next()
    }

    // Initialize request tracking
    const startTime = performance.now()
    const requestId = generateRequestId()
    const correlationId = extractCorrelationId(req, config)
    
    // Attach metadata to request for other middlewares
    req.requestId = requestId
    req.correlationId = correlationId
    req.startTime = startTime

    // Extract request metadata
    const requestMetadata = extractRequestMetadata(req, requestId, correlationId, startTime)
    
    // Log request start
    logRequestStart(requestMetadata, config)

    // Capture original response methods for logging
    const originalSend = res.send
    const originalJson = res.json
    const originalEnd = res.end

    let responseBody: any = null
    let responseSent = false

    // Override response methods to capture response data
    res.send = function(this: Response, body?: any) {
      if (!responseSent) {
        responseBody = body
        responseSent = true
        logRequestCompletion(requestMetadata, res, responseBody, startTime, config, performanceTracker)
      }
      return originalSend.call(this, body)
    }

    res.json = function(this: Response, obj?: any) {
      if (!responseSent) {
        responseBody = obj
        responseSent = true
        logRequestCompletion(requestMetadata, res, responseBody, startTime, config, performanceTracker)
      }
      return originalJson.call(this, obj)
    }

    res.end = function(this: Response, chunk?: any, encoding?: BufferEncoding | (() => void), callback?: () => void) {
      if (!responseSent) {
        responseBody = chunk
        responseSent = true
        logRequestCompletion(requestMetadata, res, responseBody, startTime, config, performanceTracker)
      }
      return originalEnd.call(this, chunk, encoding as BufferEncoding, callback)
    }

    // Handle request completion for cases where response methods aren't called
    res.on('finish', () => {
      if (!responseSent) {
        responseSent = true
        logRequestCompletion(requestMetadata, res, null, startTime, config, performanceTracker)
      }
    })

    // Handle errors
    res.on('error', (error: Error) => {
      logRequestError(requestMetadata, res, error, startTime, config)
    })

    next()
  }
}

/**
 * Development-optimized logging middleware
 */
export function developmentLoggingMiddleware(): ReturnType<typeof loggingMiddleware> {
  return loggingMiddleware({
    level: LogLevel.DEBUG,
    enablePerformanceMetrics: true,
    enableHeaders: true,
    enableRequestBody: true,
    enableResponseBody: true,
    slowRequestThreshold: 500,
    skipSuccessfulRequests: false
  })
}

/**
 * Production-optimized logging middleware
 */
export function productionLoggingMiddleware(): ReturnType<typeof loggingMiddleware> {
  return loggingMiddleware({
    level: LogLevel.INFO,
    enablePerformanceMetrics: true,
    enableHeaders: false,
    enableRequestBody: false,
    enableResponseBody: false,
    slowRequestThreshold: 2000,
    skipSuccessfulRequests: true,
    sanitizeHeaders: [
      'authorization', 'cookie', 'x-api-key', 'x-auth-token', 
      'x-access-token', 'authentication', 'x-csrf-token'
    ]
  })
}

/**
 * High-performance logging middleware for high-traffic environments
 */
export function highPerformanceLoggingMiddleware(): ReturnType<typeof loggingMiddleware> {
  return loggingMiddleware({
    level: LogLevel.WARN,
    enablePerformanceMetrics: false,
    enableHeaders: false,
    enableRequestBody: false,
    enableResponseBody: false,
    excludePaths: ['/health', '/metrics', '/ping', '/favicon.ico', '/_health'],
    slowRequestThreshold: 5000,
    skipSuccessfulRequests: true
  })
}

/**
 * Creates custom logging format for external systems
 */
export function createCustomLogger(formatter: (entry: RequestLogEntry) => void) {
  return loggingMiddleware({
    customLogFormat: formatter
  })
}

// ============================================================================
// UTILITY FUNCTIONS - Internal logging processing helpers
// ============================================================================

/**
 * Extracts comprehensive request metadata
 */
function extractRequestMetadata(
  req: Request, 
  requestId: string, 
  correlationId: string | undefined, 
  startTime: number
): RequestLogMetadata {
  return {
    requestId,
    correlationId,
    method: req.method,
    url: req.url,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    path: req.path,
    userAgent: req.get('User-Agent'),
    referer: req.get('Referer'),
    clientIp: extractClientIp(req),
    protocol: req.protocol,
    timestamp: new Date().toISOString(),
    startTime,
    headers: sanitizeHeaders(req.headers, DEFAULT_LOGGING_OPTIONS.sanitizeHeaders),
    query: req.query || {},
    params: req.params || {}
  }
}

/**
 * Extracts response metadata for logging
 */
function extractResponseMetadata(
  res: Response, 
  responseBody: any, 
  startTime: number,
  options: LoggingOptions
): ResponseLogMetadata {
  const endTime = performance.now()
  const responseTime = endTime - startTime
  const contentLength = getContentLength(responseBody)
  const contentType = res.get('Content-Type')

  const metadata: ResponseLogMetadata = {
    statusCode: res.statusCode,
    statusMessage: res.statusMessage || '',
    headers: sanitizeHeaders(res.getHeaders(), options.sanitizeHeaders),
    responseTime,
    endTime,
    cached: res.get('X-Cache-Status') === 'HIT',
    ...(contentLength !== undefined && { contentLength }),
    ...(contentType !== undefined && { contentType })
  }

  return metadata
}

/**
 * Logs request start event
 */
function logRequestStart(metadata: RequestLogMetadata, options: LoggingOptions): void {
  if (shouldLog(LogLevel.DEBUG, options.level)) {
    const logEntry: Partial<RequestLogEntry> = {
      level: LogLevel.DEBUG,
      message: `Request started: ${metadata.method} ${metadata.path}`,
      request: metadata
    }

    outputLog(logEntry, options)
  }
}

/**
 * Logs successful request completion
 */
function logRequestCompletion(
  requestMetadata: RequestLogMetadata,
  res: Response,
  responseBody: any,
  startTime: number,
  options: LoggingOptions,
  performanceTracker: PerformanceTracker
): void {
  const responseMetadata = extractResponseMetadata(res, responseBody, startTime, options)
  const isError = res.statusCode >= 400
  const isSlow = responseMetadata.responseTime > options.slowRequestThreshold

  // Skip logging successful requests if configured
  if (options.skipSuccessfulRequests && !isError && !isSlow) {
    return
  }

  // Determine log level
  const level = isError ? LogLevel.ERROR : isSlow ? LogLevel.WARN : LogLevel.INFO

  if (!shouldLog(level, options.level)) {
    return
  }

  // Record performance metrics
  if (options.enablePerformanceMetrics) {
    performanceTracker.recordRequestDuration(requestMetadata.path, responseMetadata.responseTime)
  }

  const logEntry: RequestLogEntry = {
    level,
    message: `Request completed: ${requestMetadata.method} ${requestMetadata.path} - ${res.statusCode} (${responseMetadata.responseTime.toFixed(2)}ms)`,
    request: requestMetadata,
    response: responseMetadata,
    performance: {
      duration: responseMetadata.responseTime,
      memoryUsage: process.memoryUsage()
    }
  }

  outputLog(logEntry, options)
}

/**
 * Logs request errors
 */
function logRequestError(
  requestMetadata: RequestLogMetadata,
  res: Response,
  error: Error,
  startTime: number,
  options: LoggingOptions
): void {
  const responseMetadata = extractResponseMetadata(res, null, startTime, options)

  const logEntry: RequestLogEntry = {
    level: LogLevel.ERROR,
    message: `Request failed: ${requestMetadata.method} ${requestMetadata.path} - ${error.message}`,
    request: requestMetadata,
    response: responseMetadata,
    error: {
      name: error.name,
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && error.stack && { stack: error.stack }),
      ...((error as any).code && { code: (error as any).code })
    },
    performance: {
      duration: responseMetadata.responseTime,
      memoryUsage: process.memoryUsage()
    }
  }

  outputLog(logEntry, options)
}

/**
 * Outputs log entry to console or custom formatter
 */
function outputLog(logEntry: Partial<RequestLogEntry>, options: LoggingOptions): void {
  if (options.customLogFormat) {
    options.customLogFormat(logEntry as RequestLogEntry)
  } else {
    console.log(JSON.stringify(logEntry, null, process.env.NODE_ENV === 'development' ? 2 : 0))
  }
}

/**
 * Checks if request path should be excluded from logging
 */
function shouldExcludePath(path: string, excludePaths: readonly string[]): boolean {
  return excludePaths.some(excludePath => 
    path === excludePath || path.startsWith(excludePath + '/')
  )
}

/**
 * Extracts correlation ID from request headers
 */
function extractCorrelationId(req: Request, options: LoggingOptions): string | undefined {
  if (!options.enableCorrelationId) {
    return undefined
  }

  return req.get('X-Correlation-ID') || 
         req.get('X-Request-ID') || 
         req.get('X-Trace-ID')
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
 * Sanitizes headers by removing sensitive information
 */
function sanitizeHeaders(
  headers: any, 
  sensitiveHeaders: readonly string[]
): Record<string, string> {
  const sanitized: Record<string, string> = {}
  
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase()
    if (sensitiveHeaders.includes(lowerKey)) {
      sanitized[key] = '[REDACTED]'
    } else {
      sanitized[key] = Array.isArray(value) ? value.join(', ') : String(value)
    }
  }
  
  return sanitized
}

/**
 * Gets content length from response body
 */
function getContentLength(body: any): number | undefined {
  if (!body) return undefined
  
  if (typeof body === 'string') {
    return Buffer.byteLength(body, 'utf8')
  }
  
  if (typeof body === 'object') {
    return Buffer.byteLength(JSON.stringify(body), 'utf8')
  }
  
  return undefined
}

/**
 * Checks if message should be logged based on level
 */
function shouldLog(messageLevel: LogLevel, configuredLevel: LogLevel): boolean {
  const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG]
  const messageLevelIndex = levels.indexOf(messageLevel)
  const configuredLevelIndex = levels.indexOf(configuredLevel)
  
  return messageLevelIndex <= configuredLevelIndex
}

/**
 * Generates unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// ============================================================================
// PERFORMANCE METRICS EXPORT - External monitoring integration
// ============================================================================

/**
 * Exports performance metrics for external monitoring
 */
export function getPerformanceMetrics(): Record<string, any> {
  return PerformanceTracker.getInstance().getAllMetrics()
}

/**
 * Clears performance metrics (useful for testing)
 */
export function clearPerformanceMetrics(): void {
  const tracker = PerformanceTracker.getInstance()
  ;(tracker as any).metrics.clear()
}

// Extend Express Request interface for TypeScript
declare global {
  namespace Express {
    interface Request {
      requestId?: string
      correlationId?: string | undefined
      startTime?: number
    }
  }
}