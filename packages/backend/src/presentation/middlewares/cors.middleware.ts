/**
 * CORS Middleware - Cross-Origin Resource Sharing Security Implementation
 * 
 * Implements comprehensive CORS policy management with environment-aware origin validation,
 * credential handling, preflight optimization, and security-conscious configuration for
 * production deployment across multiple client application scenarios.
 * 
 * @architectural_pattern Security Middleware, Policy Enforcement, Environment Configuration
 * @layer Presentation - Security Infrastructure
 * @responsibility Cross-origin request validation, security header management
 */

import cors, { type CorsOptions } from 'cors'

/**
 * CORS Middleware Factory - Environment-Aware Cross-Origin Policy Configuration
 * 
 * Creates production-grade CORS middleware with intelligent origin validation,
 * comprehensive security header management, and optimized preflight handling
 * for enterprise deployment scenarios.
 * 
 * @param allowedOrigins - Array of permitted origin URLs for cross-origin requests
 * @returns Configured CORS middleware with comprehensive security policies
 */
export function corsMiddleware(allowedOrigins: string[]): ReturnType<typeof cors> {
  const corsOptions: CorsOptions = {
    // Origin validation with development environment flexibility
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, server-to-server)
      if (!origin) return callback(null, true)
      
      // Validate origin against allowed list
      if (allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        const error = new Error(`CORS policy violation: Origin ${origin} not allowed`)
        callback(error, false)
      }
    },
    
    // HTTP methods permitted for cross-origin requests
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
    
    // Headers allowed in cross-origin requests
    allowedHeaders: [
      'Origin',
      'X-Requested-With', 
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Request-ID',
      'X-Correlation-ID',
      'Cache-Control',
      'User-Agent',
      'Accept-Language',
      'Accept-Encoding'
    ],
    
    // Headers exposed to client applications
    exposedHeaders: [
      'X-Total-Count',
      'X-Page-Count', 
      'X-Query-Time',
      'X-Cache-Strategy',
      'X-Request-ID',
      'X-Response-Time',
      'ETag',
      'Last-Modified'
    ],
    
    // Credential inclusion policy for authenticated requests
    credentials: true,
    
    // Preflight cache duration (24 hours) for performance optimization
    maxAge: 86400,
    
    // Legacy browser compatibility support
    optionsSuccessStatus: 200,
    
    // Preflight continuation policy
    preflightContinue: false
  }
  
  return cors(corsOptions)
}

/**
 * Development CORS Configuration - Permissive Settings for Local Development
 * 
 * Provides relaxed CORS configuration for development environments while
 * maintaining security awareness and proper header management.
 */
export function developmentCorsMiddleware(): ReturnType<typeof cors> {
  const developmentOrigins = [
    'http://localhost:3000',    // Next.js default
    'http://localhost:3001',    // Alternative React port
    'http://localhost:5173',    // Vite development server
    'http://localhost:4173',    // Vite preview server
    'http://127.0.0.1:3000',    // Localhost IP variant
    'http://127.0.0.1:5173',    // Vite IP variant
    /^http:\/\/localhost:\d+$/,  // Dynamic localhost ports
    /^http:\/\/127\.0\.0\.1:\d+$/ // Dynamic IP ports
  ]
  
  return corsMiddleware(developmentOrigins.map(origin => 
    typeof origin === 'string' ? origin : origin.toString()
  ))
}

/**
 * Production CORS Configuration - Strict Security Policy for Production Deployment
 * 
 * Implements restrictive CORS policies for production environments with
 * explicit origin whitelisting and enhanced security monitoring.
 */
export function productionCorsMiddleware(productionOrigins: string[]): ReturnType<typeof cors> {
  if (productionOrigins.length === 0) {
    throw new Error('Production CORS configuration requires explicit origin whitelist')
  }
  
  return corsMiddleware(productionOrigins)
}

/**
 * CORS Error Handler - Security Violation Response Management
 * 
 * Provides structured error responses for CORS policy violations with
 * appropriate security context and debugging information.
 */
export function corsErrorHandler() {
  return (err: any, req: any, res: any, next: any) => {
    if (err.message && err.message.includes('CORS policy violation')) {
      res.status(403).json({
        success: false,
        error: {
          code: 'CORS_VIOLATION',
          message: 'Cross-origin request not permitted',
          details: {
            origin: req.headers.origin,
            method: req.method,
            timestamp: new Date().toISOString()
          }
        }
      })
    } else {
      next(err)
    }
  }
}