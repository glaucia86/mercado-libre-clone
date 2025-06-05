/**
 * Validation Middleware - Request Validation & Sanitization Infrastructure
 * 
 * Implements comprehensive input validation, sanitization, and type safety
 * enforcement using Zod schemas for all incoming HTTP requests. Provides
 * protection against malformed data, injection attacks, and ensures
 * business rule compliance at the HTTP boundary.
 * 
 * @architectural_pattern Chain of Responsibility, Validation Strategy
 * @layer Presentation - Cross-Cutting Concerns
 * @dependencies Zod validation library, Express types
 */

import { type Request, type Response, type NextFunction } from 'express'
import { z, type ZodError, type ZodSchema } from 'zod'

/**
 * Enhanced request validation error with detailed context
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'VALIDATION_ERROR',
    public readonly details?: Record<string, unknown>,
    public readonly field?: string
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * Validation context for request processing
 */
interface ValidationContext {
  readonly requestId: string
  readonly timestamp: string
  readonly clientIp: string
  readonly userAgent?: string | undefined
  readonly correlationId?: string | undefined
}

/**
 * Validation middleware configuration options
 */
interface ValidationOptions {
  readonly skipValidation?: boolean
  readonly sanitizeInput?: boolean
  readonly strictMode?: boolean
  readonly maxRequestSize?: number
  readonly allowUnknownFields?: boolean
  readonly customErrorMessage?: string
}

/**
 * Core validation middleware factory
 * Creates Express middleware for request validation using Zod schemas
 */
export function validationMiddleware<T>(
  schema: ZodSchema<T>,
  target: 'body' | 'query' | 'params' | 'headers' = 'body',
  options: ValidationOptions = {}
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const context = extractValidationContext(req)
      
      // Skip validation if explicitly disabled
      if (options.skipValidation) {
        return next()
      }

      // Extract target data for validation
      const targetData = extractTargetData(req, target)
      
      // Apply preprocessing if enabled
      const preprocessedData = options.sanitizeInput 
        ? sanitizeInput(targetData, context)
        : targetData

      // Perform Zod validation
      const validationResult = schema.safeParse(preprocessedData)

      if (!validationResult.success) {
        const error = transformZodError(validationResult.error, target, context)
        return handleValidationError(error, res, context, options)
      }

      // Attach validated data to request
      attachValidatedData(req, target, validationResult.data)
      
      // Log successful validation in debug mode
      logValidationSuccess(target, context)
      
      next()
    } catch (error) {
      const validationError = new ValidationError(
        options.customErrorMessage || 'Request validation failed',
        'VALIDATION_PROCESSING_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      )
      
      handleValidationError(validationError, res, extractValidationContext(req), options)
    }
  }
}

/**
 * Comprehensive body validation middleware
 */
export function validateBody<T>(schema: ZodSchema<T>, options?: ValidationOptions) {
  return validationMiddleware(schema, 'body', options)
}

/**
 * Query parameters validation middleware
 */
export function validateQuery<T>(schema: ZodSchema<T>, options?: ValidationOptions) {
  return validationMiddleware(schema, 'query', options)
}

/**
 * URL parameters validation middleware
 */
export function validateParams<T>(schema: ZodSchema<T>, options?: ValidationOptions) {
  return validationMiddleware(schema, 'params', options)
}

/**
 * Headers validation middleware
 */
export function validateHeaders<T>(schema: ZodSchema<T>, options?: ValidationOptions) {
  return validationMiddleware(schema, 'headers', options)
}

/**
 * Composite validation middleware for multiple targets
 */
export function validateRequest(schemas: {
  body?: ZodSchema<any>
  query?: ZodSchema<any>
  params?: ZodSchema<any>
  headers?: ZodSchema<any>
}, options?: ValidationOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const validationChain: Array<(req: Request, res: Response, next: NextFunction) => void> = []

    if (schemas.params) {
      validationChain.push(validateParams(schemas.params, options))
    }
    if (schemas.headers) {
      validationChain.push(validateHeaders(schemas.headers, options))
    }
    if (schemas.query) {
      validationChain.push(validateQuery(schemas.query, options))
    }
    if (schemas.body) {
      validationChain.push(validateBody(schemas.body, options))
    }

    // Execute validation chain sequentially
    executeValidationChain(validationChain, 0, req, res, next)
  }
}

/**
 * Advanced input sanitization middleware
 */
export function inputSanitizationMiddleware(options: {
  trimStrings?: boolean
  removeEmptyStrings?: boolean
  convertEmptyToNull?: boolean
  normalizeWhitespace?: boolean
  maxStringLength?: number
} = {}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body, options)
      }
      
      if (req.query && typeof req.query === 'object') {
        req.query = sanitizeObject(req.query, options)
      }

      next()
    } catch (error) {
      const sanitizationError = new ValidationError(
        'Input sanitization failed',
        'SANITIZATION_ERROR',
        { error: error instanceof Error ? error.message : String(error) }
      )
      
      handleValidationError(sanitizationError, res, extractValidationContext(req))
    }
  }
}

/**
 * Content-Type validation middleware
 */
export function validateContentType(allowedTypes: readonly string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentType = req.get('Content-Type')
    
    if (!contentType) {
      const error = new ValidationError(
        'Content-Type header is required',
        'MISSING_CONTENT_TYPE'
      )
      return handleValidationError(error, res, extractValidationContext(req))
    }

    const baseContentType = contentType.split(';')[0]?.trim().toLowerCase()
    
    if (!baseContentType || !allowedTypes.includes(baseContentType)) {
      const error = new ValidationError(
        `Unsupported Content-Type: ${baseContentType}. Allowed types: ${allowedTypes.join(', ')}`,
        'INVALID_CONTENT_TYPE',
        { provided: baseContentType, allowed: allowedTypes }
      )
      return handleValidationError(error, res, extractValidationContext(req))
    }

    next()
  }
}

// ============================================================================
// UTILITY FUNCTIONS - Internal validation processing helpers
// ============================================================================

/**
 * Extracts validation context from request
 */
function extractValidationContext(req: Request): ValidationContext {
  return {
    requestId: req.get('X-Request-ID') || generateRequestId(),
    timestamp: new Date().toISOString(),
    clientIp: (req.ip || req.connection.remoteAddress || 'unknown'),
    userAgent: req.get('User-Agent'),
    correlationId: req.get('X-Correlation-ID')
  }
}

/**
 * Extracts target data from request based on validation target
 */
function extractTargetData(req: Request, target: 'body' | 'query' | 'params' | 'headers'): unknown {
  switch (target) {
    case 'body':
      return req.body
    case 'query':
      return req.query
    case 'params':
      return req.params
    case 'headers':
      return req.headers
    default:
      throw new Error(`Unknown validation target: ${target}`)
  }
}

/**
 * Sanitizes input data according to options
 */
function sanitizeInput(data: unknown, context: ValidationContext): unknown {
  if (!data || typeof data !== 'object') {
    return data
  }

  return sanitizeObject(data, {
    trimStrings: true,
    removeEmptyStrings: false,
    normalizeWhitespace: true,
    maxStringLength: 10000
  })
}

/**
 * Transforms Zod validation error to validation error
 */
function transformZodError(zodError: ZodError, target: string, context: ValidationContext): ValidationError {
  const firstIssue = zodError.issues[0]
  const fieldPath = firstIssue?.path.join('.') || 'unknown'
  
  const message = `Validation failed for ${target}.${fieldPath}: ${firstIssue?.message || 'Invalid value'}`
  
  return new ValidationError(
    message,
    'SCHEMA_VALIDATION_ERROR',
    {
      target,
      field: fieldPath,
      issues: zodError.issues.map(issue => ({
        path: issue.path,
        message: issue.message,
        code: issue.code,
        received: 'received' in issue ? issue.received : undefined
      })),
      requestId: context.requestId
    },
    fieldPath
  )
}

/**
 * Handles validation errors with appropriate HTTP responses
 */
function handleValidationError(
  error: ValidationError,
  res: Response,
  context: ValidationContext,
  options?: ValidationOptions
): void {
  // Log validation error
  console.error('Validation Error:', {
    message: error.message,
    code: error.code,
    details: error.details,
    requestId: context.requestId,
    timestamp: context.timestamp,
    clientIp: context.clientIp
  })

  // Send error response
  res.status(400).json({
    success: false,
    error: {
      code: error.code,
      message: options?.customErrorMessage || error.message,
      details: process.env.NODE_ENV === 'development' ? error.details : undefined
    },
    metadata: {
      timestamp: context.timestamp,
      requestId: context.requestId,
      version: 'v1'
    }
  })
}

/**
 * Attaches validated data to request object
 */
function attachValidatedData(req: Request, target: string, data: unknown): void {
  switch (target) {
    case 'body':
      req.body = data
      break
    case 'query':
      req.query = data as any
      break
    case 'params':
      req.params = data as any
      break
    case 'headers':
      // Headers are typically read-only, so we don't modify them
      break
  }
}

/**
 * Logs successful validation events
 */
function logValidationSuccess(target: string, context: ValidationContext): void {
  if (process.env.NODE_ENV === 'development') {
    console.debug('Validation Success:', {
      target,
      requestId: context.requestId,
      timestamp: context.timestamp
    })
  }
}

/**
 * Executes validation chain sequentially
 */
function executeValidationChain(
  chain: Array<(req: Request, res: Response, next: NextFunction) => void>,
  index: number,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (index >= chain.length) {
    return next()
  }

  const currentValidator = chain[index]
  if (!currentValidator) {
    return next()
  }

  currentValidator(req, res, (error?: any) => {
    if (error) {
      return next(error)
    }
    executeValidationChain(chain, index + 1, req, res, next)
  })
}

/**
 * Recursively sanitizes object properties
 */
function sanitizeObject(obj: any, options: {
  trimStrings?: boolean
  removeEmptyStrings?: boolean
  convertEmptyToNull?: boolean
  normalizeWhitespace?: boolean
  maxStringLength?: number
}): any {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj === 'string') {
    let sanitized = obj

    if (options.trimStrings) {
      sanitized = sanitized.trim()
    }

    if (options.normalizeWhitespace) {
      sanitized = sanitized.replace(/\s+/g, ' ')
    }

    if (options.maxStringLength && sanitized.length > options.maxStringLength) {
      sanitized = sanitized.substring(0, options.maxStringLength)
    }

    if (options.removeEmptyStrings && sanitized === '') {
      return undefined
    }

    if (options.convertEmptyToNull && sanitized === '') {
      return null
    }

    return sanitized
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, options)).filter(item => item !== undefined)
  }

  if (typeof obj === 'object') {
    const sanitized: any = {}
    
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedValue = sanitizeObject(value, options)
      if (sanitizedValue !== undefined) {
        sanitized[key] = sanitizedValue
      }
    }
    
    return sanitized
  }

  return obj
}

/**
 * Generates unique request ID for tracing
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// ============================================================================
// COMMON VALIDATION SCHEMAS - Reusable validation patterns
// ============================================================================

/**
 * Common validation schemas for typical use cases
 */
export const CommonSchemas = {
  /**
   * Pagination parameters validation
   */
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).optional()
  }),

  /**
   * Product ID parameter validation
   */
  productId: z.object({
    id: z.string().min(1).regex(/^[A-Z0-9\-_]+$/, 'Invalid product ID format')
  }),

  /**
   * Search query validation
   */
  searchQuery: z.object({
    q: z.string().min(1).max(500).optional(),
    category: z.string().max(100).optional(),
    sortBy: z.enum(['price', 'rating', 'createdAt', 'title', 'popularity', 'relevance']).optional(),
    sortDirection: z.enum(['asc', 'desc']).default('asc'),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional()
  }),

  /**
   * Request headers validation
   */
  standardHeaders: z.object({
    'content-type': z.string().optional(),
    'user-agent': z.string().optional(),
    'x-request-id': z.string().optional(),
    'x-correlation-id': z.string().optional()
  }).passthrough()
} as const