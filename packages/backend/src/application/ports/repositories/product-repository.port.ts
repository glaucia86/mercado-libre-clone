/**
 * Product Repository Port - Domain-Driven Repository Abstraction
 * 
 * Defines the contract for product data access operations following the Repository Pattern
 * and Dependency Inversion Principle. This port abstracts data persistence concerns from
 * the domain and application layers, enabling multiple implementation strategies.
 * 
 * @architectural_pattern Repository Pattern, Port and Adapter, Dependency Inversion
 * @layer Application - Port Definitions
 * @responsibility Data access contract specification, persistence abstraction
 */

import type { Product } from '../../../domain/entities/product.entity'

/**
 * Product query specification interface for advanced filtering and sorting capabilities
 */
export interface ProductQuerySpecification {
  readonly filters?: {
    readonly category?: string
    readonly subcategory?: string
    readonly sellerId?: string
    readonly minPrice?: number
    readonly maxPrice?: number
    readonly condition?: string
    readonly isActive?: boolean
    readonly hasDiscount?: boolean
    readonly inStock?: boolean
    readonly tags?: readonly string[]
    readonly rating?: {
      readonly min: number
      readonly max?: number
    }
    readonly location?: {
      readonly country?: string
      readonly state?: string
      readonly city?: string
    }
    readonly seller?: {
      readonly verified?: boolean
      readonly premium?: boolean
      readonly minRating?: number
    }
  }
  readonly sorting?: {
    readonly field: 'price' | 'rating' | 'createdAt' | 'title' | 'popularity' | 'relevance'
    readonly direction: 'asc' | 'desc'
  }
  readonly pagination?: {
    readonly offset: number
    readonly limit: number
  }
}

/**
 * Paginated result container with comprehensive pagination metadata
 */
export interface PaginatedResult<T> {
  readonly items: readonly T[]
  readonly pagination: {
    readonly total: number
    readonly offset: number
    readonly limit: number
    readonly hasNext: boolean
    readonly hasPrevious: boolean
  }
}

/**
 * Repository operation result wrapper for comprehensive error handling
 */
export type RepositoryResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: RepositoryError }

/**
 * Repository error classification for comprehensive error handling
 */
export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly code: RepositoryErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'RepositoryError'
  }
}

/**
 * Repository error code enumeration for error classification and handling
 */
export enum RepositoryErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PERSISTENCE_ERROR = 'PERSISTENCE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CONFLICT_ERROR = 'CONFLICT_ERROR'
}

/**
 * Primary repository interface defining product data access operations
 * 
 * Implements the Repository Pattern with comprehensive query capabilities,
 * error handling, and performance monitoring. All methods return wrapped
 * results for consistent error handling across the application.
 */
export interface IProductRepository {
  /**
   * Retrieves a single product by unique identifier
   * 
   * @param productId - Unique product identifier
   * @returns Promise resolving to product entity or null if not found
   * @throws RepositoryError for persistence layer failures
   */
  findById(productId: string): Promise<RepositoryResult<Product | null>>

  /**
   * Retrieves multiple products with advanced filtering, sorting, and pagination
   * 
   * @param specification - Query specification with filters, sorting, and pagination
   * @returns Promise resolving to paginated product collection
   * @throws RepositoryError for query execution failures
   */
  findMany(specification: ProductQuerySpecification): Promise<RepositoryResult<PaginatedResult<Product>>>

  /**
   * Retrieves products by seller with optional filtering and pagination
   * 
   * @param sellerId - Unique seller identifier
   * @param specification - Optional query specification excluding seller filter
   * @returns Promise resolving to paginated product collection for the seller
   * @throws RepositoryError for seller-specific query failures
   */
  findBySeller(
    sellerId: string, 
    specification?: Omit<ProductQuerySpecification, 'filters'>
  ): Promise<RepositoryResult<PaginatedResult<Product>>>

  /**
   * Retrieves products by category and optional subcategory
   * 
   * @param category - Product category
   * @param subcategory - Optional product subcategory
   * @param specification - Optional query specification excluding category filters
   * @returns Promise resolving to paginated category-filtered product collection
   * @throws RepositoryError for category-specific query failures
   */
  findByCategory(
    category: string,
    subcategory?: string,
    specification?: Omit<ProductQuerySpecification, 'filters'>
  ): Promise<RepositoryResult<PaginatedResult<Product>>>

  /**
   * Performs full-text search across product titles, descriptions, and tags
   * 
   * @param searchTerm - Text search query
   * @param specification - Optional query specification for additional filtering
   * @returns Promise resolving to relevance-sorted paginated search results
   * @throws RepositoryError for search index failures
   */
  search(
    searchTerm: string, 
    specification?: ProductQuerySpecification
  ): Promise<RepositoryResult<PaginatedResult<Product>>>

  /**
   * Retrieves products with active discount promotions
   * 
   * @param specification - Optional query specification excluding discount filter
   * @returns Promise resolving to paginated discounted product collection
   * @throws RepositoryError for discount query failures
   */
  findDiscountedProducts(
    specification?: Omit<ProductQuerySpecification, 'filters'>
  ): Promise<RepositoryResult<PaginatedResult<Product>>>

  /**
   * Retrieves featured products based on merchandising rules
   * 
   * @param specification - Optional query specification
   * @returns Promise resolving to paginated featured product collection
   * @throws RepositoryError for featured product query failures
   */
  findFeaturedProducts(
    specification?: Omit<ProductQuerySpecification, 'filters'>
  ): Promise<RepositoryResult<PaginatedResult<Product>>>

  /**
   * Checks product availability and stock status
   * 
   * @param productId - Unique product identifier
   * @returns Promise resolving to boolean availability status
   * @throws RepositoryError for availability check failures
   */
  checkAvailability(productId: string): Promise<RepositoryResult<boolean>>

  /**
   * Retrieves multiple products by their unique identifiers
   * 
   * @param productIds - Array of unique product identifiers
   * @returns Promise resolving to array of found products (may be partial)
   * @throws RepositoryError for bulk retrieval failures
   */
  findByIds(productIds: readonly string[]): Promise<RepositoryResult<readonly Product[]>>

  /**
   * Discovers products similar to a given product using similarity algorithms
   * 
   * @param productId - Reference product identifier
   * @param specification - Optional query specification for similarity constraints
   * @returns Promise resolving to paginated similar product collection
   * @throws RepositoryError for similarity computation failures
   */
  findSimilarProducts(
    productId: string, 
    specification?: Omit<ProductQuerySpecification, 'filters'>
  ): Promise<RepositoryResult<PaginatedResult<Product>>>

  /**
   * Performs repository health check with connectivity and performance verification
   * 
   * @returns Promise resolving to health status with performance metrics
   * @throws RepositoryError for health check failures
   */
  healthCheck(): Promise<RepositoryResult<{
    readonly isConnected: boolean
    readonly latency: number
    readonly itemCount: number
    readonly lastUpdate: Date
  }>>
}

/**
 * Repository configuration interface for implementation-specific settings
 */
export interface RepositoryConfiguration {
  readonly dataSource: {
    readonly type: 'json' | 'csv' | 'memory' | 'database'
    readonly location: string
    readonly options?: Record<string, unknown>
  }
  readonly cache?: {
    readonly enabled: boolean
    readonly ttl: number
    readonly maxSize: number
  }
  readonly performance?: {
    readonly timeout: number
    readonly retryAttempts: number
    readonly batchSize: number
  }
}

/**
 * Repository factory interface for dependency injection and configuration
 */
export interface IRepositoryFactory {
  /**
   * Creates and configures a product repository instance
   * 
   * @param config - Repository configuration specification
   * @returns Configured product repository implementation
   */
  createProductRepository(config: RepositoryConfiguration): IProductRepository
}

/**
 * Repository performance metrics interface for monitoring and optimization
 */
export interface RepositoryMetrics {
  readonly operationCounts: Record<string, number>
  readonly averageLatency: Record<string, number>
  readonly errorRates: Record<string, number>
  readonly cacheHitRatio?: number
}

/**
 * Repository event interface for audit trails and monitoring
 */
export interface RepositoryEvent {
  readonly eventType: 'read' | 'write' | 'delete' | 'error'
  readonly entityType: 'product'
  readonly entityId: string
  readonly timestamp: Date
  readonly metadata?: Record<string, unknown>
}