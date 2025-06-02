/**
 * Product Repository Port - Data Access Abstraction Layer
 * 
 * Defines the contract for product data persistence operations while maintaining
 * domain purity through dependency inversion. This interface serves as a boundary
 * between the application core and infrastructure concerns.
 * 
 * @architectural_pattern Repository Pattern, Dependency Inversion Principle
 * @design_principle Single Responsibility, Interface Segregation
 * @persistence_agnostic JSON, Database, Cache, or any storage mechanism
 */

import { Product } from "@/domain/entities/product.entity";

/**
 * Query specification for product filtering and pagination
 * 
 * @rationale Encapsulates query complexity while maintaining type safety
 * @pattern Specification Pattern for complex query composition
 */

export interface ProductQuerySpecification {
  readonly filters?: {
    readonly category?: string;
    readonly subcategory?: string;
    readonly sellerId?: string;
    readonly minPrice?: number;
    readonly maxPrice?: number;
    readonly condition?: string;
    readonly isActive?: boolean;
    readonly hasDiscount?: boolean;
    readonly inStock?: boolean;
    readonly tags?: readonly string[];
  }
  readonly sorting?: {
    readonly field: 'price' | 'rating' | 'createdAt' | 'title' | 'popularity';
    readonly direction: 'asc' | 'desc';
  }
  readonly pagination?: {
    readonly offset: number;
    readonly limit: number;
  }
}

/**
 * Paginated result container with metadata
 * 
 * @rationale Provides comprehensive pagination information for client implementations
 */

export interface PaginatedResult<T> {
  readonly items: T[];
  readonly pagination: {
    readonly total: number;
    readonly offset: number;
    readonly limit: number;
    readonly hasNext: boolean;
    readonly hasPrevious: boolean;
  }
}

/**
 * Repository operation result with error handling
 * 
 * @rationale Implements Result pattern for explicit error handling without exceptions
 * @pattern Result/Either monad for functional error handling
 */
export type RepositoryResult<T> = 
  | { success: true; data: T }
  | { success: false; error: RepositoryError }

/**
 * Domain-specific repository errors
 * 
 * @rationale Provides structured error information for application layer handling
 */
export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly code: RepositoryErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export enum RepositoryErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PERSISTENCE_ERROR = 'PERSISTENCE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CONFLICT_ERROR = 'CONFLICT_ERROR'
}

/**
 * Product Repository Interface - Data Access Contract
 * 
 * Defines all product-related data operations with comprehensive error handling,
 * pagination support, and query flexibility. Maintains persistence agnosticism
 * while providing robust data access capabilities.
 */
export interface IProductRepository {

  /**
   * Retrieves a single product by its unique identifier
   * 
   * @rationale Primary access method for product detail operations
   * @param productId Unique product identifier
   * @returns Repository result containing product or error information
   * @complexity O(1) for indexed lookups, O(n) for sequential search
   */
  findById(productId: string): Promise<RepositoryResult<Product | null>>;

  /**
   * Retrieves multiple products based on query specifications
   * 
   * @rationale Supports complex product listing and search functionality
   * @param specification Query parameters for filtering, sorting, and pagination
   * @returns Paginated result with products matching the criteria
   * @complexity Varies based on filtering and sorting requirements
   */
  findMany(specification: ProductQuerySpecification): Promise<RepositoryResult<PaginatedResult<Product>>>;

  /**
   * Retrieves all products associated with a specific seller
   * 
   * @rationale Enables seller-specific product management and display
   * @param sellerId Unique seller identifier
   * @param specification Optional query refinement parameters
   * @returns Paginated result of seller's products
   */
  findBySeller(sellerId: string, specification?: Omit<ProductQuerySpecification, 'filters'>): Promise<RepositoryResult<PaginatedResult<Product>>>;

  /**
   * Retrieves products by category with optional subcategory filtering
   * 
   * @rationale Supports category-based navigation and product discovery
   * @param category Primary product category
   * @param subcategory Optional subcategory for refined filtering
   * @param specification Additional query parameters
   * @returns Paginated result of categorized products
   */
  findByCategory(
    category: string,
    subcategory?: string,
    specification?: Omit<ProductQuerySpecification, 'filters'>
  ): Promise<RepositoryResult<PaginatedResult<Product>>>;

  /**
   * Performs full-text search across product attributes
   * 
   * @rationale Enables comprehensive product discovery through text search
   * @param searchTerm Text to search for in product fields
   * @param specification Optional filtering and pagination parameters
   * @returns Paginated search results with relevance scoring
   */
  search(searchTerm: string, specification?: ProductQuerySpecification): Promise<RepositoryResult<PaginatedResult<Product>>>;

  /**
   * Retrieves products with active discount promotions
   * 
   * @rationale Supports promotional product displays and marketing campaigns
   * @param specification Optional query refinement parameters
   * @returns Paginated result of discounted products
   */
  findDiscountedProducts(specification?: Omit<ProductQuerySpecification, 'filters'>): Promise<RepositoryResult<PaginatedResult<Product>>>;

  /**
   * Retrieves featured or recommended products
   * 
   * @rationale Supports marketing and recommendation engine integration
   * @param specification Optional query parameters for featured products
   * @returns Paginated result of featured products
   */
  findFeaturedProducts(specification?: Omit<ProductQuerySpecification, 'filters'>): Promise<RepositoryResult<PaginatedResult<Product>>>;

  /**
   * Checks product availability and stock status
   * 
   * @rationale Enables real-time inventory validation without full product retrieval
   * @param productId Unique product identifier
   * @returns Boolean indicating current availability status
   */
  checkAvailability(productId: string): Promise<RepositoryResult<boolean>>;

  /**
   * Retrieves multiple products by their identifiers efficiently
   * 
   * @rationale Optimized bulk retrieval for shopping cart and recommendation scenarios
   * @param productIds Array of unique product identifiers
   * @returns Array of products found (may be partial if some IDs are invalid)
   */
  findByIds(productIds: string[]): Promise<RepositoryResult<readonly Product[]>>;

  /**
   * Retrieves products with similar characteristics for recommendations
   * 
   * @rationale Supports recommendation algorithms and related product suggestions
   * @param productId Reference product for similarity matching
   * @param specification Optional query parameters for similar products
   * @returns Paginated result of similar products
   */
  findSimilarProducts(productId: string, specification?: Omit<ProductQuerySpecification, 'filters'>): Promise<RepositoryResult<PaginatedResult<Product>>>;

  /**
   * Validates repository connection and data integrity
   * 
   * @rationale Enables health checks and monitoring for operational visibility
   * @returns Health status information including connection state and performance metrics
   */
  healthCheck(): Promise<RepositoryResult<{
    isConnected: boolean;
    latency: number;
    itemCount: number;
    lastUpdate: Date;
  }>>;
}

/**
 * Repository configuration interface
 * 
 * @rationale Provides standardized configuration for repository implementations
 */
export interface RepositoryConfiguration {
  readonly dataSource: {
    readonly type: 'json' | 'csv' | 'memory' | 'database';
    readonly location: string;
    readonly options?: Record<string, unknown>;
  };
  readonly cache?: {
    readonly enabled: boolean;
    readonly ttl: number;
    readonly maxSize: number;
  }
  readonly performance?: {
    readonly timeout: number;
    readonly retryAttempts: number;
    readonly batchSize: number;
  }
}

/**
 * Repository factory interface for dependency injection
 * 
 * @rationale Enables different repository implementations based on configuration
 * @pattern Abstract Factory Pattern
 */
export interface IRepositoryFactory {
  createProductRepository(config: RepositoryConfiguration): IProductRepository;
}

/**
 * Repository metrics interface for monitoring and observability
 * 
 * @rationale Provides operational insights for performance optimization
 */
export interface RepositoryMetrics {
  readonly operationCounts: Record<string, number>;
  readonly averageLatency: Record<string, number>;
  readonly errorRates: Record<string, number>;
  readonly cacheHitRatio?: number;
}

/**
 * Repository event interface for audit and integration purposes
 * 
 * @rationale Enables event-driven architectures and audit trail implementation
 */
export interface RepositoryEvent {
  readonly eventType: 'read' | 'write' | 'delete' | 'error';
  readonly entityType: 'product';
  readonly entityId: string;
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;
}



