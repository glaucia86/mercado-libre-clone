/**
 * Main Entry Point - Production-Grade Application Bootstrap Architecture
 * 
 * Implements comprehensive application lifecycle management with environment
 * configuration resolution, dependency injection orchestration, graceful
 * shutdown handling, and production readiness assessment. Serves as the
 * Composition Root for the entire Clean Architecture implementation.
 * 
 * @architectural_pattern Composition Root, Application Bootstrap, Observer Pattern
 * @layer Infrastructure - Application Lifecycle Management
 * @dependencies Express application factory, environment configuration, process management
 */

import { startApplication, type ApplicationConfig } from './presentation/app'

/**
 * Environment configuration interface for type-safe configuration resolution
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
 * Resolves and validates environment configuration from process.env
 */
function resolveEnvironmentConfiguration(): EnvironmentConfiguration {
  const nodeEnv = (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test'
  
  return {
    server: {
      port: parseInt(process.env.PORT || '3001', 10),
      host: process.env.HOST || '0.0.0.0',
      environment: nodeEnv
    },
    api: {
      version: process.env.API_VERSION || 'v1',
      prefix: process.env.API_PREFIX || '/api',
      corsOrigins: process.env.CORS_ORIGINS?.split(',') || [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001'
      ]
    },
    features: {
      enableSwagger: process.env.ENABLE_SWAGGER !== 'false',
      enableCompression: process.env.ENABLE_COMPRESSION !== 'false',
      enableRateLimit: process.env.ENABLE_RATE_LIMIT !== 'false',
      enableDetailedLogging: nodeEnv === 'development'
    },
    security: {
      rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
      rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
      trustedProxies: parseInt(process.env.TRUSTED_PROXIES || '1', 10)
    },
    monitoring: {
      enableHealthChecks: process.env.ENABLE_HEALTH_CHECKS !== 'false',
      enablePerformanceMetrics: process.env.ENABLE_PERFORMANCE_METRICS !== 'false',
      logLevel: (process.env.LOG_LEVEL || (nodeEnv === 'development' ? 'debug' : 'info')) as 'error' | 'warn' | 'info' | 'debug'
    }
  }
}

/**
 * Validates environment configuration for completeness and consistency
 */
function validateConfiguration(config: EnvironmentConfiguration): void {
  const errors: string[] = []

  // Server configuration validation
  if (config.server.port < 1 || config.server.port > 65535) {
    errors.push(`Invalid port: ${config.server.port}. Must be between 1 and 65535.`)
  }

  if (!['development', 'production', 'test'].includes(config.server.environment)) {
    errors.push(`Invalid environment: ${config.server.environment}. Must be development, production, or test.`)
  }

  // Security configuration validation
  if (config.security.rateLimitMax < 1) {
    errors.push(`Invalid rate limit max: ${config.security.rateLimitMax}. Must be greater than 0.`)
  }

  if (config.security.rateLimitWindowMs < 1000) {
    errors.push(`Invalid rate limit window: ${config.security.rateLimitWindowMs}. Must be at least 1000ms.`)
  }

  // API configuration validation
  if (!config.api.version.match(/^v\d+$/)) {
    errors.push(`Invalid API version format: ${config.api.version}. Must match pattern v1, v2, etc.`)
  }

  if (errors.length > 0) {
    console.error('❌ Environment Configuration Validation Failed:')
    errors.forEach(error => console.error(`   • ${error}`))
    process.exit(1)
  }
}

/**
 * Transforms environment configuration to application configuration
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
 * Initializes application with comprehensive startup sequence
 */
async function initializeApplication(): Promise<void> {
  try {
    console.log('🚀 Initializing MercadoLibre Clone API Server...\n')

    // Phase 1: Configuration Resolution & Validation
    console.log('📊 Phase 1: Configuration Resolution & Validation')
    const envConfig = resolveEnvironmentConfiguration()
    validateConfiguration(envConfig)
    console.log('   ✅ Configuration validated successfully\n')

    // Phase 2: Application Configuration Transformation
    console.log('🔧 Phase 2: Application Configuration Transformation')
    const appConfig = transformToApplicationConfig(envConfig)
    console.log('   ✅ Application configuration prepared\n')

    // Phase 3: Production Readiness Assessment
    if (envConfig.server.environment === 'production') {
      console.log('🏭 Phase 3: Production Readiness Assessment')
      assessProductionReadiness(envConfig, appConfig)
      configureProductionOptimizations()
      console.log('   ✅ Production optimizations configured\n')
    }

    // Phase 4: Express Application & Dependency Injection
    console.log('🏗️ Phase 4: Express Application & Dependency Injection')
    const { app, server, dependencies } = await startApplication(appConfig)
    console.log('   ✅ Express application initialized successfully')
    console.log('   ✅ Dependency injection container configured\n')

    // Phase 5: System Health Verification
    console.log('🔍 Phase 5: System Health Verification')
    try {
      const healthResult = await dependencies.productRepository.healthCheck()
      if (healthResult.success) {
        console.log('   ✅ Repository connectivity verified')
        console.log(`   ℹ️  Data source contains ${healthResult.data.itemCount} products`)
        console.log(`   ℹ️  Repository latency: ${healthResult.data.latency.toFixed(2)}ms`)
      } else {
        console.log('   ⚠️  Repository health check failed, continuing with degraded functionality')
      }
    } catch (error) {
      console.log('   ⚠️  Repository health check unavailable, continuing with basic functionality')
    }

    // Phase 6: Production Readiness Assessment
    console.log('\n📈 Phase 6: Production Readiness Assessment')
    console.log(`   ✅ Rate limiting ${envConfig.features.enableRateLimit ? 'enabled' : 'disabled'}`)
    console.log(`   ✅ CORS origins configured: ${envConfig.api.corsOrigins.length} origins`)
    console.log(`   ✅ Response compression ${envConfig.features.enableCompression ? 'enabled' : 'disabled'}`)

    // Phase 7: Startup Completion & Information Display
    console.log('\n🎉 Application Startup Completed Successfully!\n')
    logServerInformation(envConfig, appConfig)

    // Configure graceful shutdown
    configureGracefulShutdown(server, envConfig)

  } catch (error) {
    console.error('💥 Application Startup Failed:')
    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`)
      if (process.env.NODE_ENV === 'development' && error.stack) {
        console.error(`   Stack: ${error.stack}`)
      }
    } else {
      console.error(`   Unknown error: ${String(error)}`)
    }
    process.exit(1)
  }
}

/**
 * Assesses production readiness and logs recommendations
 */
function assessProductionReadiness(
  envConfig: EnvironmentConfiguration,
  appConfig: ApplicationConfig
): void {
  const recommendations: string[] = []

  if (!envConfig.features.enableRateLimit) {
    recommendations.push('Enable rate limiting for production deployment')
  }

  if (envConfig.security.rateLimitMax > 1000) {
    recommendations.push('Consider reducing rate limit for production security')
  }

  if (envConfig.monitoring.logLevel === 'debug') {
    recommendations.push('Use info or warn log level in production')
  }

  if (envConfig.api.corsOrigins.some(origin => origin.includes('localhost'))) {
    recommendations.push('Remove localhost origins from CORS configuration')
  }

  if (recommendations.length > 0) {
    console.log('   📋 Production Recommendations:')
    recommendations.forEach(rec => console.log(`      • ${rec}`))
  }
}

/**
 * Logs comprehensive server information
 */
function logServerInformation(
  envConfig: EnvironmentConfiguration,
  appConfig: ApplicationConfig
): void {
  const serverUrl = `http://${envConfig.server.host === '0.0.0.0' ? 'localhost' : envConfig.server.host}:${envConfig.server.port}`
  const apiBaseUrl = `${serverUrl}${envConfig.api.prefix}/${envConfig.api.version}`

  console.log('╔══════════════════════════════════════════════════════════════════╗')
  console.log('║                    🏪 MERCADOLIBRE CLONE API                     ║')
  console.log('║                     Production-Grade E-commerce API             ║')
  console.log('╚══════════════════════════════════════════════════════════════════╝\n')

  console.log('🌐 Server Information:')
  console.log(`   • Environment: ${envConfig.server.environment.toUpperCase()}`)
  console.log(`   • Server URL: ${serverUrl}`)
  console.log(`   • API Base: ${apiBaseUrl}`)
  console.log(`   • Node.js Version: ${process.version}`)
  console.log(`   • Process ID: ${process.pid}\n`)

  if (envConfig.features.enableSwagger) {
    console.log('📚 API Documentation:')
    console.log(`   • Swagger UI: ${serverUrl}/api/docs`)
    console.log(`   • OpenAPI Spec: ${serverUrl}/api/docs.json\n`)
  }

  console.log('🔗 Primary Endpoints:')
  console.log(`   • Health Check: ${apiBaseUrl}/health`)
  console.log(`   • Products List: ${apiBaseUrl}/products`)
  console.log(`   • Product Details: ${apiBaseUrl}/products/{id}\n`)

  console.log('🚀 Ready to serve requests!')
}

/**
 * Configures production-specific optimizations
 */
function configureProductionOptimizations(): void {
  // Set production-specific Node.js flags
  if (!process.env.NODE_OPTIONS) {
    process.env.NODE_OPTIONS = '--max-old-space-size=2048 --optimize-for-size'
  }

  // Configure V8 garbage collection
  if (process.env.NODE_ENV === 'production') {
    process.env.UV_THREADPOOL_SIZE = '16'
  }
}

/**
 * Configures graceful shutdown handling
 */
function configureGracefulShutdown(server: any, envConfig: EnvironmentConfiguration): void {
  const shutdown = (signal: string) => {
    console.log(`\n📤 Received ${signal}. Starting graceful shutdown...`)
    
    const shutdownTimeout = setTimeout(() => {
      console.log('⚠️  Forceful shutdown due to timeout')
      process.exit(1)
    }, 10000) // 10 seconds timeout

    server.close((error?: Error) => {
      clearTimeout(shutdownTimeout)
      
      if (error) {
        console.error('❌ Error during server shutdown:', error.message)
        process.exit(1)
      }
      
      console.log('✅ Server closed successfully')
      console.log('👋 Graceful shutdown completed')
      process.exit(0)
    })
  }

  // Handle various shutdown signals
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGHUP', () => shutdown('SIGHUP'))

  // Handle uncaught exceptions and unhandled rejections
  process.on('uncaughtException', (error: Error) => {
    console.error('💥 Uncaught Exception:', error.message)
    if (envConfig.server.environment === 'development') {
      console.error('Stack:', error.stack)
    }
    shutdown('UNCAUGHT_EXCEPTION')
  })

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('💥 Unhandled Promise Rejection at:', promise)
    console.error('Reason:', reason)
    shutdown('UNHANDLED_REJECTION')
  })
}

/**
 * Configures global error handlers for production stability
 */
function configureGlobalErrorHandlers(): void {
  // Increase default maximum listeners to prevent warnings
  process.setMaxListeners(20)

  // Configure global error handling
  if (process.env.NODE_ENV === 'production') {
    process.on('warning', (warning) => {
      console.warn('⚠️  Process Warning:', warning.message)
    })
  }
}

/**
 * Main application entry point with error boundary
 */
async function main(): Promise<void> {
  try {
    // Configure global error handlers
    configureGlobalErrorHandlers()
    
    // Initialize application
    await initializeApplication()
    
  } catch (error) {
    console.error('💥 Fatal Application Error:')
    
    if (error instanceof Error) {
      console.error(`Message: ${error.message}`)
      
      if (process.env.NODE_ENV === 'development' && error.stack) {
        console.error(`Stack Trace:\n${error.stack}`)
      }
    } else {
      console.error(`Unknown Error: ${String(error)}`)
    }
    
    console.error('\n📞 If this error persists, please check:')
    console.error('   • Environment variables configuration')
    console.error('   • Network connectivity and port availability')
    console.error('   • Application dependencies and versions')
    console.error('   • System resource availability (memory, disk space)')
    
    process.exit(1)
  }
}

// Execute main function if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('💥 Unhandled error in main:', error)
    process.exit(1)
  })
}