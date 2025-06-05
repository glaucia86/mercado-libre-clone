/**
 * Application Layer - Comprehensive Export Architecture
 * 
 * Central export aggregation point for all application layer components,
 * providing clean API surface for external layers while maintaining
 * internal architectural boundaries and dependency management.
 * 
 * @architectural_pattern Facade Pattern, Barrel Exports
 * @layer Application - Public API Definition
 * @responsibility Controlled interface exposure and dependency orchestration
 */

import { UseCaseError, UseCaseResult } from './dtos/product/product-query.dto'

// ============================================================================
// USE CASE EXPORTS - Business Logic Orchestration Components
// ============================================================================

// Product domain use cases
export { GetProductDetailsUseCase } from './usecases/product/get-product-details.usecase'
export { ListProductsUseCase } from './usecases/product/list-products.usecase'

// Future use case exports (implementation roadmap)
// export { SearchProductsUseCase } from './usecases/product/search-products.usecase'
// export { GetSimilarProductsUseCase } from './usecases/product/get-similar-products.usecase'
// export { GetDiscountedProductsUseCase } from './usecases/product/get-discounted-products.usecase'

// ============================================================================
// DTO EXPORTS - Data Transfer Object Specifications
// ============================================================================

// Core query and response DTOs
export type {
  // Query specifications
  GetProductDetailsQuery,
  ListProductsQuery,
  SearchProductsQuery,
  GetSimilarProductsQuery,
  GetProductByCategoryQuery,
  GetProductsBySellerQuery,
  GetDiscountedProductsQuery,
  CheckProductAvailabilityQuery,
  GetProductsByIdsQuery,
  
  // Filter and pagination specifications
  ProductFilters,
  ProductSorting,
  PaginationParams,
  
  // Result and error handling
  UseCaseResult,
  UseCaseError,
  UseCaseErrorCode
} from './dtos/product/product-query.dto'

// Core response data structures
export type {
  // Product representation DTOs
  ProductDetailsResponseDto,
  ProductSummaryDto,
  ProductListResponseDto,
  
  // Component DTOs
  ProductImageDto,
  ProductRatingDto,
  ProductSpecificationDto,
  ProductConditionDto,
  ProductStockDto,
  ProductDimensionsDto,
  ProductDiscountDto,
  ProductPriceDto,
  
  // Associated entity DTOs
  SellerSummaryDto,
  PaymentMethodSummaryDto
} from './dtos/product/product-response.dto'

// Enhanced list operations and business intelligence DTOs
export type {
  // Advanced query capabilities
  EnhancedProductFilters,
  ProductSortingOptions,
  AdvancedPaginationParams,
  FacetConfiguration,
  
  // Enhanced response structures
  EnhancedProductListResponseDto,
  ProductFacet,
  AdvancedPaginationMetadata,
  SearchMetadata
} from './dtos/product/product-list.dto'

// ============================================================================
// PORT EXPORTS - Interface Contracts and Specifications
// ============================================================================

// Repository interfaces and specifications
export type {
  IProductRepository,
  ProductQuerySpecification,
  PaginatedResult,
  RepositoryResult,
  RepositoryError,
  RepositoryErrorCode,
  RepositoryConfiguration,
  IRepositoryFactory,
  RepositoryMetrics,
  RepositoryEvent
} from './ports/repositories/product-repository.port'; 

// Future service port exports (integration roadmap)
// export type { IEmailService } from './ports/services/email-service.port'
// export type { INotificationService } from './ports/services/notification-service.port'
// export type { ICacheService } from './ports/services/cache-service.port'
// export type { ISearchService } from './ports/services/search-service.port'

// ============================================================================
// UTILITY EXPORTS - Cross-Cutting Concerns and Shared Logic
// ============================================================================

// Error handling utilities
// Note: UseCaseErrorCode is already exported as a type above

// ============================================================================
// TYPE GUARDS AND VALIDATION UTILITIES
// ============================================================================

/**
 * Type guard for successful use case results
 */
export function isSuccessResult<T>(
  result: UseCaseResult<T>
): result is { success: true; data: T } {
  return result.success === true
}

/**
 * Type guard for failed use case results
 */
export function isErrorResult<T>(
  result: UseCaseResult<T>
): result is { success: false; error: UseCaseError } {
  return result.success === false
}

/**
 * Utility function for extracting data from successful results
 */
export function extractData<T>(result: UseCaseResult<T>): T {
  if (!isSuccessResult(result)) {
    throw new Error(`Cannot extract data from failed result: ${result.error.message}`)
  }
  return result.data
}

/**
 * Utility function for extracting error from failed results
 */
export function extractError<T>(result: UseCaseResult<T>): UseCaseError {
  if (!isErrorResult(result)) {
    throw new Error('Cannot extract error from successful result')
  }
  return result.error
}

// ============================================================================
// ARCHITECTURAL METADATA - Development and Documentation Support
// ============================================================================

/**
 * Application layer architectural metadata for tooling and documentation
 */
export const ApplicationLayerMetadata = {
  layer: 'Application',
  patterns: [
    'Use Case Pattern',
    'Data Transfer Object Pattern', 
    'Repository Pattern',
    'Dependency Inversion Principle',
    'Command Query Responsibility Segregation'
  ],
  responsibilities: [
    'Business logic orchestration',
    'Cross-cutting concern coordination', 
    'External interface definition',
    'Data transformation and validation',
    'Error handling and result aggregation'
  ],
  dependencies: {
    upstream: ['Domain Layer'],
    downstream: ['Infrastructure Layer', 'Presentation Layer'],
    external: []
  },
  qualityMetrics: {
    testCoverage: '> 90%',
    complexity: 'Low to Medium',
    coupling: 'Loose',
    cohesion: 'High'
  }
} as const