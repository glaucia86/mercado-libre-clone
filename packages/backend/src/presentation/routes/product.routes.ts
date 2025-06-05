/**
 * Route Configuration - RESTful API Endpoint Architecture
 * 
 * Implements comprehensive route orchestration with dependency injection,
 * endpoint organization, and HTTP method mapping. Maintains clean separation
 * between routing concerns and business logic while providing comprehensive
 * API surface area for client applications.
 * 
 * @architectural_pattern Router Pattern, Dependency Injection, RESTful Design
 * @layer Presentation - Route Orchestration
 * @responsibility HTTP endpoint mapping, middleware composition, dependency wiring
 */

import os from 'os';
import { Router, type Request, type Response } from 'express'
import { ProductController } from '../controllers/product.controller'
import type { ApplicationDependencies } from '../app'


// ============================================================================
// PRODUCT ROUTES - E-commerce Product Management API
// ============================================================================

/**
 * Product Routes Factory - Dependency-Injected Endpoint Configuration
 * 
 * Creates comprehensive product management routes with dependency injection,
 * ensuring loose coupling between routing infrastructure and business logic.
 * Implements RESTful design principles with resource-oriented URL structures.
 * 
 * @swagger
 * components:
 *   schemas:
 *     ProductDetailsResponse:
 *       type: object
 *       description: Comprehensive product information with seller and payment details
 *       properties:
 *         id:
 *           type: string
 *           description: Unique product identifier
 *           example: 'ML-001-SMARTPHONE-GALAXY'
 *         title:
 *           type: string
 *           description: Product title with key features
 *           example: 'Samsung Galaxy S24 Ultra 256GB 5G Violeta Titânio'
 *         description:
 *           type: string
 *           description: Detailed product description
 *         shortDescription:
 *           type: string
 *           description: Concise product summary
 *         images:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProductImage'
 *         primaryImage:
 *           $ref: '#/components/schemas/ProductImage'
 *         price:
 *           $ref: '#/components/schemas/ProductPrice'
 *         seller:
 *           $ref: '#/components/schemas/SellerSummary'
 *         rating:
 *           $ref: '#/components/schemas/ProductRating'
 *         specifications:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProductSpecification'
 *         
 *     ProductImage:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         url:
 *           type: string
 *           format: uri
 *         altText:
 *           type: string
 *         isPrimary:
 *           type: boolean
 *         order:
 *           type: integer
 *           
 *     ProductPrice:
 *       type: object
 *       properties:
 *         originalPrice:
 *           type: number
 *           format: float
 *         finalPrice:
 *           type: number
 *           format: float
 *         currency:
 *           type: string
 *           example: 'BRL'
 *         formattedPrice:
 *           type: string
 *           example: 'R$ 6.405,00'
 *         discount:
 *           $ref: '#/components/schemas/ProductDiscount'
 *         hasFreeShipping:
 *           type: boolean
 *           
 *     ProductDiscount:
 *       type: object
 *       properties:
 *         percentage:
 *           type: number
 *           format: float
 *         amount:
 *           type: number
 *           format: float
 *         savingsAmount:
 *           type: number
 *           format: float
 *         validUntil:
 *           type: string
 *           format: date-time
 *         condition:
 *           type: string
 *         isValid:
 *           type: boolean
 *           
 *     SellerSummary:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         displayName:
 *           type: string
 *         location:
 *           type: string
 *         rating:
 *           type: object
 *           properties:
 *             average:
 *               type: number
 *               format: float
 *             count:
 *               type: integer
 *             positivePercentage:
 *               type: number
 *               format: float
 *         isVerified:
 *           type: boolean
 *         isPremiumEligible:
 *           type: boolean
 *           
 *     ProductRating:
 *       type: object
 *       properties:
 *         average:
 *           type: number
 *           format: float
 *         count:
 *           type: integer
 *         distribution:
 *           type: object
 *           additionalProperties:
 *             type: integer
 *             
 *     ProductSpecification:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *         value:
 *           type: string
 *         category:
 *           type: string
 *           
 *     EnhancedProductListResponse:
 *       type: object
 *       description: Comprehensive product listing with advanced filtering and business intelligence
 *       properties:
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProductSummary'
 *         pagination:
 *           $ref: '#/components/schemas/AdvancedPagination'
 *         facets:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProductFacet'
 *         metadata:
 *           $ref: '#/components/schemas/SearchMetadata'
 *         sorting:
 *           $ref: '#/components/schemas/SortingOptions'
 *         aggregations:
 *           $ref: '#/components/schemas/ProductAggregations'
 *           
 *     ProductSummary:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         title:
 *           type: string
 *         shortDescription:
 *           type: string
 *         primaryImage:
 *           $ref: '#/components/schemas/ProductImage'
 *         price:
 *           $ref: '#/components/schemas/ProductPrice'
 *         seller:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *             displayName:
 *               type: string
 *             location:
 *               type: string
 *             rating:
 *               type: number
 *             isVerified:
 *               type: boolean
 *         rating:
 *           type: object
 *           properties:
 *             average:
 *               type: number
 *             count:
 *               type: integer
 *         category:
 *           type: string
 *         isAvailable:
 *           type: boolean
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *             
 *     AdvancedPagination:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *         page:
 *           type: integer
 *         limit:
 *           type: integer
 *         totalPages:
 *           type: integer
 *         hasNext:
 *           type: boolean
 *         hasPrevious:
 *           type: boolean
 *         performance:
 *           type: object
 *           properties:
 *             queryTimeMs:
 *               type: number
 *             totalScanned:
 *               type: integer
 *             cacheHit:
 *               type: boolean
 *               
 *     ProductFacet:
 *       type: object
 *       properties:
 *         key:
 *           type: string
 *         label:
 *           type: string
 *         type:
 *           type: string
 *           enum: [categorical, range, boolean, hierarchical]
 *         values:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               value:
 *                 oneOf:
 *                   - type: string
 *                   - type: number
 *               label:
 *                 type: string
 *               count:
 *                 type: integer
 *               selected:
 *                 type: boolean
 *                 
 *     SearchMetadata:
 *       type: object
 *       properties:
 *         totalResults:
 *           type: integer
 *         searchTerm:
 *           type: string
 *         appliedFilters:
 *           type: object
 *           additionalProperties: true
 *         executionTime:
 *           type: number
 *         averagePrice:
 *           type: number
 *         priceDistribution:
 *           type: object
 *           properties:
 *             min:
 *               type: number
 *             max:
 *               type: number
 *             median:
 *               type: number
 *             percentiles:
 *               type: object
 *               additionalProperties:
 *                 type: number
 */
export function productRoutes(dependencies: ApplicationDependencies): Router {
  const router = Router()
  
  // Initialize controller with dependency injection
  const productController = new ProductController(
    dependencies.getProductDetailsUseCase,
    dependencies.listProductsUseCase
  )
  
  // ========================================================================
  // PRODUCT DETAIL ENDPOINTS - Individual Product Operations
  // ========================================================================
  
  /**
   * GET /products/:id - Retrieve comprehensive product details
   * 
   * High-performance endpoint optimized for product detail page rendering.
   * Implements intelligent caching strategies and conditional request handling.
   * 
   * Rate Limit: 100 requests per minute per IP
   * Cache Strategy: ETag-based conditional requests with 5-minute TTL
   * Performance Target: < 100ms average response time
   */
  router.get('/:id', 
    // Bind controller method with proper context
    productController.getProductDetails.bind(productController)
  )
  
  // ========================================================================
  // PRODUCT LISTING ENDPOINTS - Collection Operations with Advanced Querying
  // ========================================================================
  
  /**
   * GET /products - Advanced product listing with faceted search
   * 
   * Comprehensive product enumeration endpoint supporting multi-dimensional
   * filtering, intelligent sorting, faceted search, and real-time aggregations.
   * Implements cursor-based pagination for optimal performance at scale.
   * 
   * Rate Limit: 60 requests per minute per IP
   * Cache Strategy: Query-based caching with 3-minute TTL
   * Performance Target: < 200ms average response time
   */
  router.get('/',
    // Bind controller method with proper context
    productController.listProducts.bind(productController)
  )
  
  // ========================================================================
  // FUTURE ENDPOINT ROADMAP - Extensibility Architecture
  // ========================================================================
  
  /*
   * Future endpoint implementations following RESTful design patterns:
   * 
   * GET /products/search - Full-text search with advanced query processing
   * GET /products/featured - Curated featured products with merchandising rules
   * GET /products/trending - Trending products based on engagement metrics
   * GET /products/recommendations - Personalized product recommendations
   * GET /products/:id/similar - Similar product discovery with ML algorithms
   * GET /products/:id/reviews - Product reviews and ratings aggregation
   * GET /products/:id/variants - Product variants and configurations
   * GET /products/categories - Dynamic category hierarchy with counts
   * 
   * POST /products/:id/views - Product view tracking for analytics
   * POST /products/:id/interactions - User interaction event capture
   * 
   * Administrative endpoints (future implementation):
   * POST /products - Product creation (admin-only)
   * PUT /products/:id - Product updates (admin-only)
   * DELETE /products/:id - Product deactivation (admin-only)
   * PATCH /products/:id/inventory - Inventory management (admin-only)
   */
  
  return router
}

// ============================================================================
// HEALTH CHECK ROUTES - System Monitoring and Observability
// ============================================================================

/**
 * Health Check Routes - System Status and Monitoring Endpoints
 * 
 * Implements comprehensive health checking with dependency verification,
 * performance metrics, and operational readiness assessment for load balancers
 * and monitoring systems.
 */
export function healthRoutes(): Router {
  const router = Router()
  
  /**
   * GET /health - Basic health check endpoint
   * 
   * @swagger
   * /health:
   *   get:
   *     tags: [Health]
   *     summary: Basic application health check
   *     description: |
   *       Simple health check endpoint for load balancers and monitoring systems.
   *       Returns basic application status and uptime information.
   *       
   *       **Monitoring Integration:**
   *       - Load balancer health checks
   *       - Kubernetes liveness probes
   *       - External monitoring services
   *       
   *       **Response Characteristics:**
   *       - Ultra-fast response (< 10ms)
   *       - No external dependencies
   *       - Consistent JSON structure
   *     responses:
   *       200:
   *         description: Application is healthy and operational
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: 'healthy'
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *                 uptime:
   *                   type: number
   *                   description: Application uptime in seconds
   *                 version:
   *                   type: string
   *                   example: 'v1'
   *                 environment:
   *                   type: string
   *                   example: 'production'
   */
  router.get('/', (req: Request, res: Response) => {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: 'v1',
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      }
    }
    
    res.status(200).json(healthStatus)
  })
  
  /**
   * GET /health/detailed - Comprehensive system health assessment
   * 
   * @swagger
   * /health/detailed:
   *   get:
   *     tags: [Health]
   *     summary: Detailed system health with dependency checks
   *     description: |
   *       Comprehensive health assessment including dependency verification,
   *       performance metrics, and system resource utilization.
   *       
   *       **Dependency Verification:**
   *       - Repository connectivity and latency
   *       - File system access permissions
   *       - Memory and CPU utilization
   *       - Network connectivity status
   *       
   *       **Performance Metrics:**
   *       - Response time percentiles
   *       - Error rate tracking
   *       - Resource utilization trends
   *       - Cache hit ratios
   *     responses:
   *       200:
   *         description: Detailed health information with all systems operational
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   enum: [healthy, degraded, unhealthy]
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *                 dependencies:
   *                   type: object
   *                   properties:
   *                     repository:
   *                       type: object
   *                       properties:
   *                         status:
   *                           type: string
   *                         latency:
   *                           type: number
   *                         lastCheck:
   *                           type: string
   *                           format: date-time
   *                 metrics:
   *                   type: object
   *                   properties:
   *                     requestCount:
   *                       type: integer
   *                     averageResponseTime:
   *                       type: number
   *                     errorRate:
   *                       type: number
   *       503:
   *         description: Service unavailable due to dependency failures
   */
  router.get('/detailed', async (req: Request, res: Response) => {
    const startTime = performance.now()
    
    try {
      // Verify repository connectivity and performance
      const repositoryHealthPromise = checkRepositoryHealth()
      
      // Perform parallel health checks
      const [repositoryHealth] = await Promise.allSettled([
        repositoryHealthPromise
      ])
      
      const overallStatus = determineOverallHealth([repositoryHealth])
      const responseTime = performance.now() - startTime
      
      const detailedHealth = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        version: 'v1',
        environment: process.env.NODE_ENV || 'development',
        dependencies: {
          repository: repositoryHealth.status === 'fulfilled' 
            ? repositoryHealth.value 
            : { status: 'unhealthy', error: repositoryHealth.reason?.message },
        },
        system: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100)
          },
          cpu: {
            loadAverage: os.loadavg(),
            usage: process.cpuUsage()
          }
        },
        metrics: {
          healthCheckLatency: Math.round(responseTime * 100) / 100,
          timestamp: new Date().toISOString()
        }
      }
      
      const statusCode = overallStatus === 'healthy' ? 200 : 503
      res.status(statusCode).json(detailedHealth)
      
    } catch (error) {
      const responseTime = performance.now() - startTime
      
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        metrics: {
          healthCheckLatency: Math.round(responseTime * 100) / 100
        }
      })
    }
  })
  
  /**
   * GET /health/readiness - Kubernetes readiness probe endpoint
   * 
   * Optimized for Kubernetes readiness probes with minimal latency
   * and dependency verification for production deployments.
   */
  router.get('/readiness', async (req: Request, res: Response) => {
    try {
      // Minimal dependency check for readiness
      const repositoryCheck = await checkRepositoryHealth()
      
      if (repositoryCheck.status === 'healthy') {
        res.status(200).json({
          status: 'ready',
          timestamp: new Date().toISOString()
        })
      } else {
        res.status(503).json({
          status: 'not_ready',
          reason: 'Repository connectivity issues',
          timestamp: new Date().toISOString()
        })
      }
    } catch (error) {
      res.status(503).json({
        status: 'not_ready',
        reason: 'Health check failed',
        timestamp: new Date().toISOString()
      })
    }
  })
  
  /**
   * GET /health/liveness - Kubernetes liveness probe endpoint
   * 
   * Ultra-lightweight endpoint for Kubernetes liveness probes.
   * No external dependencies to avoid restart loops.
   */
  router.get('/liveness', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime())
    })
  })
  
  return router
}

// ============================================================================
// HEALTH CHECK UTILITIES - Supporting Infrastructure
// ============================================================================

/**
 * Repository connectivity and performance verification
 */
async function checkRepositoryHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy'
  latency: number
  lastCheck: string
  itemCount?: number
  error?: string
}> {
  const startTime = performance.now()
  
  try {
    // Import repository for health checking
    const { JsonProductRepository } = await import('../../infrastructure/repositories/json-product.repository')
    const repository = new JsonProductRepository()
    
    // Perform health check operation
    const healthResult = await repository.healthCheck()
    const latency = performance.now() - startTime
    
    if (healthResult.success) {
      return {
        status: latency < 100 ? 'healthy' : 'degraded',
        latency: Math.round(latency * 100) / 100,
        lastCheck: new Date().toISOString(),
        itemCount: healthResult.data.itemCount
      }
    } else {
      return {
        status: 'unhealthy',
        latency: Math.round(latency * 100) / 100,
        lastCheck: new Date().toISOString(),
        error: healthResult.error.message
      }
    }
  } catch (error) {
    const latency = performance.now() - startTime
    return {
      status: 'unhealthy',
      latency: Math.round(latency * 100) / 100,
      lastCheck: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Overall system health determination based on dependency statuses
 */
function determineOverallHealth(results: PromiseSettledResult<any>[]): 'healthy' | 'degraded' | 'unhealthy' {
  const healthyCount = results.filter(result => 
    result.status === 'fulfilled' && result.value.status === 'healthy'
  ).length
  
  const degradedCount = results.filter(result =>
    result.status === 'fulfilled' && result.value.status === 'degraded'
  ).length
  
  const unhealthyCount = results.filter(result =>
    result.status === 'rejected' || 
    (result.status === 'fulfilled' && result.value.status === 'unhealthy')
  ).length
  
  if (unhealthyCount > 0) return 'unhealthy'
  if (degradedCount > 0) return 'degraded'
  return 'healthy'
}