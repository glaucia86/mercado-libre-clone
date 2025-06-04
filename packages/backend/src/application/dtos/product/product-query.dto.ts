/**
 * Product Query DTOs - Application Layer Input Objects
 * 
 * Defines the structure for input parameters across different product-related
 * use cases, ensuring type safety and validation boundaries.
 * 
 * @architectural_pattern Query Object Pattern, Input Validation
 * @layer Application Layer
 * @purpose Use case input standardization, parameter validation
 */

/**
 * Get Product Details Query
 * 
 * Input parameters for retrieving a single product with full details.
 */
export interface GetProductDetailsQuery {
  readonly productId: string
  readonly includeInactive?: boolean
  readonly calculateInstallments?: boolean
  readonly userLocation?: {
    readonly country: string
    readonly state?: string
    readonly city?: string
  }
}

/**
 * Product List Filters
 * 
 * Comprehensive filtering options for product searches and listings.
 */
export interface ProductFilters {
  readonly category?: string
  readonly subcategory?: string
  readonly sellerId?: string
  readonly minPrice?: number
  readonly maxPrice?: number
  readonly condition?: 'new' | 'used' | 'refurbished'
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
  readonly shipping?: {
    readonly freeShippingOnly?: boolean
    readonly expressDelivery?: boolean
  }
  readonly seller?: {
    readonly verified?: boolean
    readonly premium?: boolean
    readonly minRating?: number
  }
}

/**
 * Product Sorting Options
 * 
 * Available sorting criteria for product lists.
 */
export interface ProductSorting {
  readonly field: 'price' | 'rating' | 'createdAt' | 'title' | 'popularity' | 'relevance'
  readonly direction: 'asc' | 'desc'
}

/**
 * Pagination Parameters
 * 
 * Standard pagination configuration.
 */
export interface PaginationParams {
  readonly offset: number
  readonly limit: number
  readonly page?: number
}

/**
 * List Products Query
 * 
 * Complete query object for product listing with filtering, sorting, and pagination.
 */
export interface ListProductsQuery {
  readonly filters?: ProductFilters
  readonly sorting?: ProductSorting
  readonly pagination?: PaginationParams
  readonly includeFacets?: boolean
  readonly includeMetadata?: boolean
}

/**
 * Search Products Query
 * 
 * Text-based search with additional filtering and ranking options.
 */
export interface SearchProductsQuery {
  readonly searchTerm: string
  readonly filters?: ProductFilters
  readonly sorting?: ProductSorting
  readonly pagination?: PaginationParams
  readonly searchOptions?: {
    readonly fuzzyMatch?: boolean
    readonly includeDescriptions?: boolean
    readonly includeSpecs?: boolean
    readonly boostPopular?: boolean
    readonly boostRecent?: boolean
  }
}

/**
 * Get Similar Products Query
 * 
 * Parameters for finding products similar to a reference product.
 */
export interface GetSimilarProductsQuery {
  readonly productId: string
  readonly maxResults?: number
  readonly similarityFactors?: {
    readonly category?: boolean
    readonly price?: boolean
    readonly seller?: boolean
    readonly tags?: boolean
    readonly specifications?: boolean
  }
  readonly excludeSameCategory?: boolean
  readonly pagination?: PaginationParams
}

/**
 * Get Products by Category Query
 * 
 * Category-specific product retrieval with hierarchy support.
 */
export interface GetProductByCategoryQuery {
  readonly category: string;
  readonly subcategory?: string;
  readonly filters?: Omit<ProductFilters, 'category' | 'subcategory'>
  readonly sorting?: ProductSorting
  readonly pagination?: PaginationParams
  readonly includeSubcategories?: boolean
}

/**
 * Get Products by Seller Query
 * 
 * Seller-specific product listing.
 */
export interface GetProductsBySellerQuery {
  readonly sellerId: string
  readonly filters?: Omit<ProductFilters, 'sellerId'>
  readonly sorting?: ProductSorting
  readonly pagination?: PaginationParams
  readonly includeInactive?: boolean
}

/**
 * Get Discounted Products Query
 * 
 * Retrieve products with active discounts and promotions.
 */
export interface GetDiscountedProductsQuery {
  readonly filters?: Omit<ProductFilters, 'hasDiscount'>
  readonly sorting?: ProductSorting
  readonly pagination?: PaginationParams
  readonly discountOptions?: {
    readonly minDiscountPercentage?: number
    readonly maxDiscountPercentage?: number
    readonly validOnly?: boolean
  }
}

/**
 * Check Product Availability Query
 * 
 * Simple availability check parameters.
 */
export interface CheckProductAvailabilityQuery {
  readonly productId: string
  readonly quantity?: number
  readonly location?: {
    readonly country: string
    readonly zipCode?: string
  }
}

/**
 * Get Products by IDs Query
 * 
 * Bulk product retrieval by identifiers.
 */
export interface GetProductsByIdsQuery {
  readonly productIds: readonly string[]
  readonly includeInactive?: boolean
  readonly calculateInstallments?: boolean
  readonly sortByIds?: boolean
}

/**
 * Use Case Result Types
 * 
 * Standardized result patterns for use case responses.
 */
export type UseCaseResult<T> = 
  | { success: true; data: T }
  | { success: false; error: UseCaseError }

/**
 * Use Case Error
 * 
 * Standardized error structure for application layer.
 */
export class UseCaseError extends Error {
  constructor(
    message: string,
    public readonly code: UseCaseErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'UseCaseError'
  }
}

/**
 * Use Case Error Codes
 * 
 * Categorized error types for different failure scenarios.
 */
export enum UseCaseErrorCode {
  // Input Validation Errors
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // Business Logic Errors  
  PRODUCT_NOT_FOUND = 'PRODUCT_NOT_FOUND',
  PRODUCT_UNAVAILABLE = 'PRODUCT_UNAVAILABLE',
  SELLER_NOT_FOUND = 'SELLER_NOT_FOUND',
  
  // Repository Errors
  REPOSITORY_ERROR = 'REPOSITORY_ERROR',
  DATA_ACCESS_ERROR = 'DATA_ACCESS_ERROR',
  
  // System Errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE'
}  
