/**
 * Main Entry Point - Production-Grade Application Bootstrap Architecture
 * 
 * Implements comprehensive application initialization with enterprise-grade server
 * lifecycle management, graceful shutdown handling, dependency injection orchestration,
 * and operational monitoring capabilities. Serves as the primary composition root
 * for the entire application architecture.
 * 
 * @architectural_pattern Composition Root, Dependency Injection, Server Lifecycle Management
 * @layer Presentation - Application Entry Point
 * @responsibility Server initialization, dependency coordination, lifecycle management
 */

import { startApplication, type ApplicationConfig } from './presentation/app'

/**
 * Environment-aware configuration resolution with comprehensive fallback strategies
 */
interface EnvironmentConfiguration {
  readonly server: {
    readonly port: number
    readonly host: string
    readonly environment: 'development' | 'production' | 'test'
  }
  readonly api: {
    readonly version: string
    readonly prefix: string
    readonly corsOrigins: string[]
  }
  readonly features: {
    readonly enableSwagger: boolean
    readonly enableCompression: boolean
    readonly enableRateLimit: boolean
    readonly enableDetailedLogging: boolean
  }
  readonly security: {
    readonly rateLimitMax: number
    readonly rateLimitWindowMs: number
    readonly trustedProxies: number
  }
  readonly monitoring: {
    readonly enableHealthChecks: boolean
    readonly enablePerformanceMetrics: boolean
    readonly logLevel: 'error' | 'warn' | 'info' | 'debug'
  }
}

/**
 * Production-grade environment configuration resolution with validation
 */
function resolveEnvironmentConfiguration(): EnvironmentConfiguration {
  const nodeEnv = (process.env.NODE_ENV as EnvironmentConfiguration['server']['environment']) ?? 'development'
  const isProduction = nodeEnv === 'production'
  const isDevelopment = nodeEnv === 'development'
  
  return {
    server: {
      port: parseInt(process.env.PORT ?? (isDevelopment ? '3001' : '8080'), 10),
      host: process.env.HOST ?? (isDevelopment ? 'localhost' : '0.0.0.0'),
      environment: nodeEnv
    },
    api: {
      version: process.env.API_VERSION ?? 'v1',
      prefix: process.env.API_PREFIX ?? '/api',
      corsOrigins: process.env.CORS_ORIGINS?.split(',').map(origin => origin.trim()) ?? [
        'http://localhost:3000',  // Next.js development server
        'http://localhost:3001',  // Alternative frontend port
        'http://127.0.0.1:3000',  // Local IP alternative
        'http://localhost:5173',  // Vite development server
        'http://localhost:4173'   // Vite preview server
      ]
    },
    features: {
      enableSwagger: process.env.ENABLE_SWAGGER !== 'false' && !isProduction,
      enableCompression: process.env.ENABLE_COMPRESSION !== 'false',
      enableRateLimit: process.env.ENABLE_RATE_LIMIT !== 'false',
      enableDetailedLogging: process.env.ENABLE_DETAILED_LOGGING !== 'false' && isDevelopment
    },
    security: {
      rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX ?? (isProduction ? '60' : '100'), 10),
      rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '900000', 10), // 15 minutes
      trustedProxies: parseInt(process.env.TRUSTED_PROXIES ?? '1', 10)
    },
    monitoring: {
      enableHealthChecks: process.env.ENABLE_HEALTH_CHECKS !== 'false',
      enablePerformanceMetrics: process.env.ENABLE_PERFORMANCE_METRICS !== 'false',
      logLevel: (process.env.LOG_LEVEL as EnvironmentConfiguration['monitoring']['logLevel']) ?? 
                (isProduction ? 'warn' : 'info')
    }
  }
}

/**
 * Configuration validation with comprehensive business rule enforcement
 */
function validateConfiguration(config: EnvironmentConfiguration): void {
  const errors: string[] = []
  
  // Server configuration validation
  if (config.server.port < 1 || config.server.port > 65535) {
    errors.push(`Invalid port number: ${config.server.port}. Must be between 1 and 65535.`)
  }
  
  if (!['development', 'production', 'test'].includes(config.server.environment)) {
    errors.push(`Invalid environment: ${config.server.environment}. Must be development, production, or test.`)
  }
  
  // Security configuration validation
  if (config.security.rateLimitMax < 1 || config.security.rateLimitMax > 10000) {
    errors.push(`Invalid rate limit max: ${config.security.rateLimitMax}. Must be between 1 and 10000.`)
  }
  
  if (config.security.rateLimitWindowMs < 60000 || config.security.rateLimitWindowMs > 3600000) {
    errors.push(`Invalid rate limit window: ${config.security.rateLimitWindowMs}ms. Must be between 1 minute and 1 hour.`)
  }
  
  // CORS origins validation
  if (config.api.corsOrigins.length === 0) {
    errors.push('At least one CORS origin must be specified.')
  }
  
  config.api.corsOrigins.forEach(origin => {
    try {
      new URL(origin)
    } catch {
      errors.push(`Invalid CORS origin URL: ${origin}`)
    }
  })
  
  // Log level validation
  if (!['error', 'warn', 'info', 'debug'].includes(config.monitoring.logLevel)) {
    errors.push(`Invalid log level: ${config.monitoring.logLevel}. Must be error, warn, info, or debug.`)
  }
  
  if (errors.length > 0) {
    console.error('❌ Configuration validation failed:')
    errors.forEach(error => console.error(`   • ${error}`))
    process.exit(1)
  }
}

/**
 * Application configuration transformation for Express application factory
 */
function transformToApplicationConfig(envConfig: EnvironmentConfiguration): ApplicationConfig {
  return {
    port: envConfig.server.port,
    nodeEnv: envConfig.server.environment,
    apiVersion: envConfig.api.version,
    corsOrigins: envConfig.api.corsOrigins,
    enableSwagger: envConfig.features.enableSwagger,
    enableCompression: envConfig.features.enableCompression,
    enableRateLimit: envConfig.features.enableRateLimit,
    rateLimitMax: envConfig.security.rateLimitMax,
    rateLimitWindowMs: envConfig.security.rateLimitWindowMs,
    logLevel: envConfig.monitoring.logLevel
  }
}

/**
 * Comprehensive application startup sequence with error handling and monitoring
 */
async function initializeApplication(): Promise<void> {
  try {
    console.log('🚀 Initializing MercadoLibre Clone API Server...\n')
    
    // Phase 1: Environment Configuration Resolution & Validation
    console.log('📊 Phase 1: Configuration Resolution & Validation')
    const envConfig = resolveEnvironmentConfiguration()
    validateConfiguration(envConfig)
    console.log('   ✅ Configuration validated successfully')
    
    // Phase 2: Application Configuration Transformation
    console.log('\n🔧 Phase 2: Application Configuration Transformation')
    const appConfig = transformToApplicationConfig(envConfig)
    console.log('   ✅ Application configuration prepared')
    
    // Phase 3: Express Application Initialization
    console.log('\n🏗️ Phase 3: Express Application & Dependency Injection')
    const { app, server, dependencies } = await startApplication(appConfig)
    console.log('   ✅ Express application initialized successfully')
    console.log('   ✅ Dependency injection container configured')
    
    // Phase 4: Health Check Verification
    console.log('\n🔍 Phase 4: System Health Verification')
    try {
      const healthResult = await dependencies.productRepository.healthCheck()
      if (healthResult.success) {
        console.log('   ✅ Repository connectivity verified')
        console.log(`   ℹ️  Data source contains ${healthResult.data.itemCount} products`)
        console.log(`   ℹ️  Repository latency: ${healthResult.data.latency.toFixed(2)}ms`)
      } else {
        console.warn('   ⚠️  Repository health check failed:', healthResult.error.message)
        console.warn('   ⚠️  Continuing with degraded functionality')
      }
    } catch (healthError) {
      console.warn('   ⚠️  Health check execution failed:', healthError)
      console.warn('   ⚠️  Continuing with unknown repository status')
    }
    
    // Phase 5: Production Readiness Assessment
    console.log('\n📈 Phase 5: Production Readiness Assessment')
    assessProductionReadiness(envConfig, dependencies)
    
    // Phase 6: Server Startup Completion Notification
    console.log('\n🎉 Application Startup Completed Successfully!')
    logServerInformation(envConfig, appConfig)
    
    // Production environment specific optimizations
    if (envConfig.server.environment === 'production') {
      configureProductionOptimizations()
    }
    
  } catch (error) {
    console.error('\n❌ Application startup failed:', error)
    
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    }
    
    console.error('\n🛑 Shutting down application due to startup failure...')
    process.exit(1)
  }
}

/**
 * Production readiness assessment with comprehensive system validation
 */
function assessProductionReadiness(
  envConfig: EnvironmentConfiguration, 
  dependencies: any
): void {
  const readinessChecks = []
  
  // Security configuration assessment
  if (envConfig.features.enableRateLimit) {
    readinessChecks.push('✅ Rate limiting enabled')
  } else {
    readinessChecks.push('⚠️  Rate limiting disabled (not recommended for production)')
  }
  
  // CORS configuration assessment
  if (envConfig.api.corsOrigins.length > 0) {
    readinessChecks.push('✅ CORS origins configured')
  } else {
    readinessChecks.push('❌ CORS origins not configured')
  }
  
  // Compression assessment
  if (envConfig.features.enableCompression) {
    readinessChecks.push('✅ Response compression enabled')
  } else {
    readinessChecks.push('⚠️  Response compression disabled')
  }
  
  // Environment-specific assessments
  if (envConfig.server.environment === 'production') {
    if (!envConfig.features.enableSwagger) {
      readinessChecks.push('✅ Swagger documentation disabled in production')
    } else {
      readinessChecks.push('⚠️  Swagger documentation enabled in production')
    }
    
    if (envConfig.monitoring.logLevel === 'warn' || envConfig.monitoring.logLevel === 'error') {
      readinessChecks.push('✅ Appropriate log level for production')
    } else {
      readinessChecks.push('⚠️  Verbose logging enabled in production')
    }
  }
  
  readinessChecks.forEach(check => console.log(`   ${check}`))
}

/**
 * Comprehensive server information logging for operational visibility
 */
function logServerInformation(
  envConfig: EnvironmentConfiguration, 
  appConfig: ApplicationConfig
): void {
  const serverUrl = `http://${envConfig.server.host}:${envConfig.server.port}`
  
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                    🏪 MERCADOLIBRE CLONE API                     ║
║                     Production-Grade E-commerce API             ║
╚══════════════════════════════════════════════════════════════════╝

🌐 Server Information:
   • Environment: ${envConfig.server.environment.toUpperCase()}
   • Server URL: ${serverUrl}
   • API Base: ${serverUrl}${envConfig.api.prefix}/${envConfig.api.version}
   • Node.js Version: ${process.version}
   • Process ID: ${process.pid}

📚 API Documentation:
   • Swagger UI: ${envConfig.features.enableSwagger ? `${serverUrl}/api/docs` : 'Disabled'}
   • OpenAPI Spec: ${envConfig.features.enableSwagger ? `${serverUrl}/api/docs.json` : 'Disabled'}

🔗 Primary Endpoints:
   • Health Check: ${serverUrl}${envConfig.api.prefix}/${envConfig.api.version}/health
   • Products List: ${serverUrl}${envConfig.api.prefix}/${envConfig.api.version}/products
   • Product Details: ${serverUrl}${envConfig.api.prefix}/${envConfig.api.version}/products/{id}

🔧 Feature Configuration:
   • Rate Limiting: ${envConfig.features.enableRateLimit ? `${envConfig.security.rateLimitMax} req/15min` : 'Disabled'}
   • Response Compression: ${envConfig.features.enableCompression ? 'Enabled' : 'Disabled'}
   • CORS Origins: ${envConfig.api.corsOrigins.join(', ')}
   • Log Level: ${envConfig.monitoring.logLevel.toUpperCase()}

🏗️ Architecture Overview:
   ✅ Clean Architecture Implementation
   ✅ Domain-Driven Design Patterns
   ✅ Repository Pattern with JSON Persistence
   ✅ Dependency Injection & IoC Container
   ✅ Comprehensive Error Handling
   ✅ Performance Monitoring & Health Checks
   ✅ Enterprise-Grade Security Headers
   ✅ RESTful API Design with OpenAPI Documentation

🚀 Ready to serve requests!
`)
}

/**
 * Production-specific optimizations and configurations
 */
function configureProductionOptimizations(): void {
  // Optimize garbage collection for production workloads
  if (process.env.NODE_OPTIONS?.includes('--max-old-space-size') === false) {
    console.log('   ℹ️  Consider setting NODE_OPTIONS="--max-old-space-size=2048" for production')
  }
  
  // Enable keep-alive connections for better performance
  process.env.HTTP_KEEP_ALIVE = 'true'
  
  // Configure process title for better process identification
  process.title = 'mercadolibre-clone-api'
  
  console.log('   ✅ Production optimizations applied')
}

/**
 * Unhandled error and rejection handlers for production stability
 */
function configureGlobalErrorHandlers(): void {
  process.on('uncaughtException', (error: Error) => {
    console.error('💥 Uncaught Exception:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    })
    
    // Graceful shutdown on uncaught exceptions in production
    if (process.env.NODE_ENV === 'production') {
      console.error('🛑 Shutting down due to uncaught exception...')
      process.exit(1)
    }
  })
  
  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason)
    
    // Log but don't exit on unhandled rejections in development
    if (process.env.NODE_ENV === 'production') {
      console.error('🛑 Shutting down due to unhandled rejection...')
      process.exit(1)
    }
  })
  
  process.on('SIGTERM', () => {
    console.log('\n🛑 SIGTERM received. Starting graceful shutdown...')
    // Graceful shutdown logic is handled in the Express application
  })
  
  process.on('SIGINT', () => {
    console.log('\n🛑 SIGINT received. Starting graceful shutdown...')
    // Graceful shutdown logic is handled in the Express application
  })
}

/**
 * Application entry point with comprehensive initialization and error handling
 */
async function main(): Promise<void> {
  // Configure global error handlers before any async operations
  configureGlobalErrorHandlers()
  
  // Initialize application with comprehensive error handling
  await initializeApplication()
}

// Bootstrap application execution
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Fatal application error:', error)
    process.exit(1)
  })
}

export { main, resolveEnvironmentConfiguration, validateConfiguration }