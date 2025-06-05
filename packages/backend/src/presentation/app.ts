/**
 * Express Application Architecture - Production-Grade Server Infrastructure
 * 
 * Implements comprehensive Express.js application with enterprise-grade middleware
 * stack, security configurations, monitoring capabilities, and Clean Architecture
 * integration. Serves as the primary HTTP interface boundary for the domain.
 * 
 * @architectural_pattern Layered Architecture, Middleware Chain, Dependency Injection
 * @layer Presentation - HTTP Interface
 * @responsibility HTTP request/response handling, middleware orchestration, security
 */

import express, { type Application, type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'

// Application layer imports
import { 
  GetProductDetailsUseCase, 
  ListProductsUseCase,
  type IProductRepository 
} from '../application'

// Infrastructure layer imports
import { JsonProductRepository } from '../infrastructure/repositories/json-product.repository'

// Presentation layer imports
import { productRoutes } from './routes/product.routes'
import { healthRoutes } from './routes/health.routes'
import { errorHandlerMiddleware } from './middlewares/error-handler.middleware'
import { validationMiddleware } from './middlewares/validation.middleware' //./middlewares/validation.middleware
import { corsMiddleware } from './middlewares/cors.middleware'
import { loggingMiddleware } from './middlewares/logging.middleware'
import { rateLimitMiddleware } from './middlewares/rate-limit.middleware'

/**
 * Dependency injection container for application services
 */
export interface ApplicationDependencies {
  readonly productRepository: IProductRepository
  readonly getProductDetailsUseCase: GetProductDetailsUseCase
  readonly listProductsUseCase: ListProductsUseCase
}

/**
 * Application configuration interface
 */
export interface ApplicationConfig {
  readonly port: number
  readonly nodeEnv: 'development' | 'production' | 'test'
  readonly apiVersion: string
  readonly corsOrigins: string[]
  readonly enableSwagger: boolean
  readonly enableCompression: boolean
  readonly enableRateLimit: boolean
  readonly rateLimitMax: number
  readonly rateLimitWindowMs: number
  readonly logLevel: 'error' | 'warn' | 'info' | 'debug'
}

/**
 * Default application configuration with environment-based overrides
 */
const defaultConfig: ApplicationConfig = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: (process.env.NODE_ENV as ApplicationConfig['nodeEnv']) ?? 'development',
  apiVersion: process.env.API_VERSION ?? 'v1',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3000'],
  enableSwagger: process.env.ENABLE_SWAGGER !== 'false',
  enableCompression: process.env.ENABLE_COMPRESSION !== 'false', 
  enableRateLimit: process.env.ENABLE_RATE_LIMIT !== 'false',
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '900000', 10), // 15 minutes
  logLevel: (process.env.LOG_LEVEL as ApplicationConfig['logLevel']) ?? 'info'
}

/**
 * Swagger/OpenAPI configuration for comprehensive API documentation
 */
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MercadoLibre Clone API',
      version: '1.0.0',
      description: `
        Comprehensive e-commerce API implementing Clean Architecture principles
        with advanced product management, filtering, and business intelligence capabilities.
        
        ## Architecture Overview
        - **Clean Architecture**: Separation of concerns with well-defined layer boundaries
        - **Domain-Driven Design**: Rich domain models with encapsulated business logic
        - **CQRS Pattern**: Optimized read/write operations for enhanced performance
        - **Repository Pattern**: Abstracted data access with multiple implementation strategies
        
        ## Key Features
        - Advanced product search and filtering
        - Faceted search with dynamic filter generation
        - Comprehensive business intelligence and analytics
        - Enterprise-grade error handling and validation
        - Performance monitoring and optimization
      `,
      contact: {
        name: 'Engineering Team',
        email: 'engineering@mercadolibre-clone.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001/api/v1',
        description: 'Development server'
      },
      {
        url: 'https://api.mercadolibre-clone.com/v1', 
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      responses: {
        BadRequest: {
          description: 'Invalid request parameters or malformed request body',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  error: {
                    type: 'object',
                    properties: {
                      code: { type: 'string', example: 'INVALID_INPUT' },
                      message: { type: 'string', example: 'Invalid product ID format' },
                      details: { type: 'object', additionalProperties: true }
                    }
                  },
                  timestamp: { type: 'string', format: 'date-time' },
                  path: { type: 'string', example: '/api/v1/products/invalid-id' }
                }
              }
            }
          }
        },
        NotFound: {
          description: 'Requested resource not found',
          content: {
            'application/json': {
              schema: {
                type: 'object', 
                properties: {
                  success: { type: 'boolean', example: false },
                  error: {
                    type: 'object',
                    properties: {
                      code: { type: 'string', example: 'PRODUCT_NOT_FOUND' },
                      message: { type: 'string', example: 'Product with specified ID does not exist' }
                    }
                  }
                }
              }
            }
          }
        },
        InternalServerError: {
          description: 'Internal server error with detailed debugging information',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  error: {
                    type: 'object',
                    properties: {
                      code: { type: 'string', example: 'INTERNAL_ERROR' },
                      message: { type: 'string', example: 'An unexpected error occurred' },
                      requestId: { type: 'string', format: 'uuid' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Products',
        description: 'Product management and search operations'
      },
      {
        name: 'Health',
        description: 'System health and monitoring endpoints'
      }
    ]
  },
  apis: ['./src/presentation/routes/*.ts'] // Path to API route files for documentation extraction
}

/**
 * Express Application Factory - Dependency Injection and Configuration
 * 
 * Creates and configures Express application instance with comprehensive
 * middleware stack, dependency injection, and production-ready security.
 */
export class ExpressApplicationFactory {
  
  /**
   * Creates configured Express application with dependency injection
   */
  static create(config: Partial<ApplicationConfig> = {}): {
    app: Application
    dependencies: ApplicationDependencies
    config: ApplicationConfig
  } {
    const mergedConfig: ApplicationConfig = { ...defaultConfig, ...config }
    
    // Initialize Express application
    const app = express()
    
    // Setup dependency injection container
    const dependencies = ExpressApplicationFactory.setupDependencies()
    
    // Configure middleware stack
    ExpressApplicationFactory.configureMiddleware(app, mergedConfig)
    
    // Setup API documentation
    if (mergedConfig.enableSwagger) {
      ExpressApplicationFactory.configureSwagger(app, mergedConfig)
    }
    
    // Configure application routes
    ExpressApplicationFactory.configureRoutes(app, dependencies, mergedConfig)
    
    // Setup error handling (must be last)
    ExpressApplicationFactory.configureErrorHandling(app)
    
    return { app, dependencies, config: mergedConfig }
  }
  
  /**
   * Initializes and configures dependency injection container
   */
  private static setupDependencies(): ApplicationDependencies {
    // Infrastructure layer dependencies
    const productRepository = new JsonProductRepository()
    
    // Application layer dependencies
    const getProductDetailsUseCase = new GetProductDetailsUseCase(productRepository)
    const listProductsUseCase = new ListProductsUseCase(productRepository)
    
    return {
      productRepository,
      getProductDetailsUseCase,
      listProductsUseCase
    }
  }
  
  /**
   * Configures comprehensive middleware stack with security and performance optimizations
   */
  private static configureMiddleware(app: Application, config: ApplicationConfig): void {
    // Security middleware
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:'],
          scriptSrc: ["'self'"]
        }
      },
      crossOriginEmbedderPolicy: false // Required for Swagger UI
    }))
    
    // CORS configuration
    app.use(corsMiddleware(config.corsOrigins))
    
    // Compression middleware for performance
    if (config.enableCompression) {
      app.use(compression({
        level: 6,
        threshold: 1024,
        filter: (req, res) => {
          if (req.headers['x-no-compression']) {
            return false
          }
          return compression.filter(req, res)
        }
      }))
    }
    
    // Rate limiting middleware
    if (config.enableRateLimit) {
      app.use(rateLimitMiddleware({
        max: config.rateLimitMax,
        windowMs: config.rateLimitWindowMs
      }))
    }
    
    // Request parsing middleware
    app.use(express.json({ 
      limit: '10mb',
      strict: true
    }))
    app.use(express.urlencoded({ 
      extended: true, 
      limit: '10mb' 
    }))
    
    // Logging middleware
    app.use(loggingMiddleware(config.logLevel))
    
    // Request validation middleware (applied per route)
    app.use(validationMiddleware())
  }
  
  /**
   * Configures Swagger/OpenAPI documentation
   */
  private static configureSwagger(app: Application, config: ApplicationConfig): void {
    const specs = swaggerJsdoc(swaggerOptions)
    
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs, {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'MercadoLibre Clone API Documentation',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true
      }
    }))
    
    // Serve OpenAPI spec as JSON
    app.get('/api/docs.json', (req: Request, res: Response) => {
      res.setHeader('Content-Type', 'application/json')
      res.send(specs)
    })
  }
  
  /**
   * Configures application routes with dependency injection
   */
  private static configureRoutes(
    app: Application, 
    dependencies: ApplicationDependencies, 
    config: ApplicationConfig
  ): void {
    const apiPrefix = `/api/${config.apiVersion}`
    
    // Health check routes
    app.use(`${apiPrefix}/health`, healthRoutes())
    
    // Product routes with dependency injection
    app.use(`${apiPrefix}/products`, productRoutes(dependencies))
    
    // Root endpoint
    app.get('/', (req: Request, res: Response) => {
      res.json({
        name: 'MercadoLibre Clone API',
        version: config.apiVersion,
        environment: config.nodeEnv,
        documentation: config.enableSwagger ? '/api/docs' : null,
        endpoints: {
          health: `${apiPrefix}/health`,
          products: `${apiPrefix}/products`,
          swagger: config.enableSwagger ? '/api/docs' : null
        },
        timestamp: new Date().toISOString()
      })
    })
    
    // 404 handler for undefined routes
    app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'ROUTE_NOT_FOUND',
          message: `Route ${req.method} ${req.originalUrl} not found`,
          availableEndpoints: {
            documentation: '/api/docs',
            health: `${apiPrefix}/health`,
            products: `${apiPrefix}/products`
          }
        },
        timestamp: new Date().toISOString()
      })
    })
  }
  
  /**
   * Configures comprehensive error handling middleware
   */
  private static configureErrorHandling(app: Application): void {
    app.use(errorHandlerMiddleware())
  }
}

/**
 * Application bootstrap function with graceful shutdown handling
 */
export async function startApplication(
  config: Partial<ApplicationConfig> = {}
): Promise<{ app: Application; server: any; dependencies: ApplicationDependencies }> {
  
  const { app, dependencies, config: finalConfig } = ExpressApplicationFactory.create(config)
  
  return new Promise((resolve, reject) => {
    const server = app.listen(finalConfig.port, () => {
      console.log(`
🚀 MercadoLibre Clone API Server Started Successfully

📊 Server Information:
   • Port: ${finalConfig.port}
   • Environment: ${finalConfig.nodeEnv}
   • API Version: ${finalConfig.apiVersion}
   • Node.js: ${process.version}

📖 API Documentation:
   • Swagger UI: http://localhost:${finalConfig.port}/api/docs
   • OpenAPI Spec: http://localhost:${finalConfig.port}/api/docs.json

🔗 API Endpoints:
   • Health Check: http://localhost:${finalConfig.port}/api/${finalConfig.apiVersion}/health
   • Products: http://localhost:${finalConfig.port}/api/${finalConfig.apiVersion}/products
   
🔧 Configuration:
   • CORS Origins: ${finalConfig.corsOrigins.join(', ')}
   • Rate Limiting: ${finalConfig.enableRateLimit ? 'Enabled' : 'Disabled'}
   • Compression: ${finalConfig.enableCompression ? 'Enabled' : 'Disabled'}
   • Swagger: ${finalConfig.enableSwagger ? 'Enabled' : 'Disabled'}

🏗️ Architecture:
   • Clean Architecture ✅
   • Domain-Driven Design ✅  
   • Repository Pattern ✅
   • Dependency Injection ✅
      `)
      
      resolve({ app, server, dependencies })
    })
    
    server.on('error', (error: Error) => {
      console.error('❌ Server startup failed:', error)
      reject(error)
    })
    
    // Graceful shutdown handling
    const shutdown = (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`)
      
      server.close(() => {
        console.log('✅ HTTP server closed.')
        process.exit(0)
      })
      
      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('❌ Forced shutdown due to timeout')
        process.exit(1)
      }, 10000)
    }
    
      process.on('SIGTERM', () => shutdown('SIGTERM'))
      process.on('SIGINT', () => shutdown('SIGINT'))
    })
  }