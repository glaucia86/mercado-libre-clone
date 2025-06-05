/**
 * Route Index - Composition Root & Dependency Injection Orchestration
 * 
 * Implements comprehensive route aggregation and composition architecture serving
 * as the central orchestration point for all API endpoints. Manages dependency
 * injection propagation, route namespace organization, and middleware inheritance
 * across modular route components for scalable API architecture.
 * 
 * @architectural_pattern Composition Root, Module Aggregation, Dependency Injection
 * @layer Presentation - Route Orchestration
 * @responsibility Route composition, dependency propagation, namespace management
 */

import { Router } from 'express'
import { productRoutes } from './product.routes'
import { healthRoutes } from './health.routes'
import type { ApplicationDependencies } from '../app'

/**
 * Route module metadata for documentation and monitoring
 */
interface RouteModuleMetadata {
  readonly name: string
  readonly version: string
  readonly endpoints: readonly string[]
  readonly description: string
  readonly requiresAuthentication: boolean
  readonly rateLimit?: {
    readonly max: number
    readonly windowMs: number
  }
}

/**
 * API route configuration with metadata and middleware settings
 */
interface ApiRouteConfiguration {
  readonly path: string
  readonly router: Router
  readonly metadata: RouteModuleMetadata
}

/**
 * Comprehensive route registry for API documentation and monitoring
 */
const routeRegistry: Record<string, RouteModuleMetadata> = {
  products: {
    name: 'Products API',
    version: 'v1',
    endpoints: [
      'GET /products',
      'GET /products/:id',
      'GET /products/search',
      'GET /products/featured',
      'GET /products/discounted',
      'GET /products/:id/similar'
    ],
    description: 'Comprehensive e-commerce product management and discovery API',
    requiresAuthentication: false,
    rateLimit: {
      max: 100,
      windowMs: 900000 // 15 minutes
    }
  },
  health: {
    name: 'Health Monitoring API',
    version: 'v1',
    endpoints: [
      'GET /health',
      'GET /health/detailed',
      'GET /health/readiness',
      'GET /health/liveness',
      'GET /health/metrics'
    ],
    description: 'System health monitoring and observability endpoints',
    requiresAuthentication: false
  }
}

/**
 * Main Route Composition Factory - Dependency Injection Orchestration
 * 
 * Creates and configures the complete API route hierarchy with dependency
 * injection propagation, ensuring consistent dependency management across
 * all route modules while maintaining modular architecture principles.
 * 
 * @param dependencies - Application-wide dependency injection container
 * @returns Configured Express router with all API routes and middleware
 */
export function createRoutes(dependencies: ApplicationDependencies): Router {
  const router = Router()
  
  // Route module configuration with dependency injection
  const routeConfigurations: readonly ApiRouteConfiguration[] = [
    {
      path: '/products',
      router: productRoutes(dependencies),
      metadata: routeRegistry.products!
    },
    {
      path: '/health', 
      router: healthRoutes(),
      metadata: routeRegistry.health!
    }
  ]
  
  // Register route modules with metadata tracking
  routeConfigurations.forEach(({ path, router: moduleRouter, metadata }) => {
    // Apply route-level middleware if specified
    if (metadata.rateLimit) {
      // Route-level rate limiting could be applied here
      // router.use(path, rateLimitMiddleware(metadata.rateLimit))
    }
    
    // Register route module with namespace
    router.use(path, moduleRouter)
    
    // Log route registration for debugging and monitoring
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔗 Registered route module: ${metadata.name} at ${path}`)
      metadata.endpoints.forEach(endpoint => {
        console.log(`   └─ ${endpoint}`)
      })
    }
  })
  
  // API root endpoint with comprehensive service discovery
  router.get('/', (req, res) => {
    const apiInformation = {
      name: 'MercadoLibre Clone API',
      version: 'v1',
      description: 'Enterprise-grade e-commerce API with Clean Architecture implementation',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      
      // Service discovery information
      endpoints: Object.entries(routeRegistry).reduce((acc, [key, metadata]) => {
        acc[key] = {
          name: metadata.name,
          version: metadata.version,
          description: metadata.description,
          endpoints: metadata.endpoints,
          requiresAuthentication: metadata.requiresAuthentication,
          ...(metadata.rateLimit && { rateLimit: metadata.rateLimit })
        }
        return acc
      }, {} as Record<string, any>),
      
      // API documentation links
      documentation: {
        swagger: process.env.ENABLE_SWAGGER !== 'false' ? '/api/docs' : null,
        openapi: process.env.ENABLE_SWAGGER !== 'false' ? '/api/docs.json' : null
      },
      
      // Health and monitoring endpoints
      monitoring: {
        health: '/api/v1/health',
        readiness: '/api/v1/health/readiness',
        liveness: '/api/v1/health/liveness',
        metrics: '/api/v1/health/metrics'
      },
      
      // Architecture and technical information
      architecture: {
        pattern: 'Clean Architecture',
        layers: ['Domain', 'Application', 'Infrastructure', 'Presentation'],
        principles: [
          'Dependency Inversion',
          'Single Responsibility', 
          'Open/Closed',
          'Interface Segregation',
          'Domain-Driven Design'
        ]
      },
      
      // Request/response format information
      apiFormat: {
        requestFormat: 'application/json',
        responseFormat: 'application/json',
        errorFormat: {
          success: false,
          error: {
            code: 'string',
            message: 'string',
            details: 'object (optional)'
          },
          metadata: {
            timestamp: 'ISO 8601',
            requestId: 'string',
            version: 'string'
          }
        }
      }
    }
    
    res.json(apiInformation)
  })
  
  return router
}

/**
 * Route Registry Export for External Documentation and Monitoring Systems
 * 
 * Provides external access to route metadata for API documentation generation,
 * monitoring system configuration, and automated testing infrastructure.
 */
export function getRouteRegistry(): Record<string, RouteModuleMetadata> {
  return { ...routeRegistry }
}

/**
 * API Endpoint Discovery Utility for Client SDK Generation
 * 
 * Generates comprehensive endpoint information for automatic client SDK
 * generation, API contract testing, and integration documentation.
 */
export function getApiEndpoints(): {
  readonly baseUrl: string
  readonly version: string
  readonly endpoints: readonly {
    readonly module: string
    readonly method: string
    readonly path: string
    readonly fullPath: string
    readonly description?: string
  }[]
} {
  const baseUrl = '/api/v1'
  const endpoints: Array<{
    module: string
    method: string
    path: string
    fullPath: string
    description?: string
  }> = []
  
  Object.entries(routeRegistry).forEach(([moduleName, metadata]) => {
    metadata.endpoints.forEach(endpoint => {
      const [method, path] = endpoint.split(' ')
      if (!method || !path) return // Skip invalid endpoint format
      
      const modulePath = moduleName === 'health' ? '/health' : `/${moduleName}`
      const fullPath = `${baseUrl}${modulePath}${path.replace(`/${moduleName}`, '')}`
      
      endpoints.push({
        module: moduleName,
        method,
        path,
        fullPath,
        description: metadata.description
      })
    })
  })
  
  return {
    baseUrl,
    version: 'v1',
    endpoints
  }
}

/**
 * Route Health Check Utility for System Monitoring
 * 
 * Provides route-level health information for load balancer configuration
 * and monitoring system integration across all registered route modules.
 */
export function checkRoutesHealth(): {
  readonly status: 'healthy' | 'degraded' | 'unhealthy'
  readonly modules: Record<string, {
    readonly registered: boolean
    readonly endpointCount: number
    readonly metadata: RouteModuleMetadata
  }>
  readonly totalEndpoints: number
} {
  const moduleStatus = Object.entries(routeRegistry).reduce((acc, [moduleName, metadata]) => {
    acc[moduleName] = {
      registered: true,
      endpointCount: metadata.endpoints.length,
      metadata
    }
    return acc
  }, {} as Record<string, any>)
  
  const totalEndpoints = Object.values(routeRegistry)
    .reduce((sum, metadata) => sum + metadata.endpoints.length, 0)
  
  return {
    status: 'healthy', // All modules are statically registered
    modules: moduleStatus,
    totalEndpoints
  }
}

/**
 * Future Route Module Registration for Dynamic API Extension
 * 
 * Provides infrastructure for dynamic route module registration in future
 * implementations supporting plugin architecture and runtime API extension.
 */
export interface RouteModuleRegistration {
  readonly register: (path: string, router: Router, metadata: RouteModuleMetadata) => void
  readonly unregister: (path: string) => void
  readonly list: () => readonly string[]
}

/**
 * Export route module metadata for external consumption
 */
export { routeRegistry }

/**
 * Export type definitions for external module development
 */
export type { ApiRouteConfiguration, RouteModuleMetadata, ApplicationDependencies }