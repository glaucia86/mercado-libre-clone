/**
 * Enhanced Product List DTOs - Advanced Data Transfer Patterns
 * 
 * Extends the existing DTO architecture to support comprehensive list operations
 * with advanced filtering, faceting, and aggregation capabilities.
 * 
 * @architectural_pattern Extended DTO Pattern, Faceted Search, Result Aggregation
 * @layer Application - Data Transfer Objects
 * @responsibility Data structure definition for complex list operations
 */

import { ProductSummaryDto } from "./product-response.dto";

// ============================================================================
// ENHANCED QUERY DTOs - Extensions to Existing Query Infrastructure
// ============================================================================

/**
 * Advanced filtering criteria with semantic search capabilities
 */

export interface EnhancedProductFilters {
  readonly category?: string;
  readonly subcategory?: string;
  readonly sellerId?: string;
  readonly priceRange?: {
    readonly min?: number;
    readonly max?: number;
    readonly currency?: string;
  }
  readonly condition?: 'new' | 'used' | 'refurbished';
   readonly availability?: {
    readonly inStock?: boolean
    readonly hasDiscount?: boolean
    readonly freeShippingOnly?: boolean
    readonly expressDelivery?: boolean
  }
  readonly seller?: {
    readonly verified?: boolean
    readonly premium?: boolean
    readonly minRating?: number
    readonly responseTimeTier?: 'excellent' | 'good' | 'average' | 'slow'
  }
  readonly rating?: {
    readonly min: number
    readonly max?: number
  }
  readonly tags?: readonly string[]
  readonly specifications?: Record<string, string | number>
  readonly location?: {
    readonly country?: string
    readonly state?: string
    readonly city?: string
    readonly zipCode?: string
  }
  readonly dateRange?: {
    readonly createdAfter?: string
    readonly createdBefore?: string
    readonly updatedAfter?: string
  }
}

/**
 * Multi-dimensional sorting with priority chains
 */
export interface ProductSortingOptions {
  readonly primary: {
    readonly field: 'price' | 'rating' | 'createdAt' | 'title' | 'popularity' | 'relevance' | 'discount';
    readonly direction: 'asc' | 'desc';
  }
  readonly secondary?: {
    readonly field: 'price' | 'rating' | 'createdAt' | 'title' | 'popularity'
    readonly direction: 'asc' | 'desc';
  }
  readonly boosts?: {
    readonly featuredProducts?: number
    readonly premiumSellers?: number
    readonly discountedItems?: number
    readonly highRatings?: number
  }
}

/**
 * Enhanced pagination with performance metadata
 */
export interface AdvancedPaginationParams {
  readonly page: number;
  readonly limit: number;
  readonly offset?: number;
  readonly totalEstimation?: boolean;
  readonly cursorBased?: {
    readonly cursor?: string;
    readonly direction: 'forward' | 'backward';
  }
}

/**
 * Faceted search configuration for dynamic filter generation
 */
export interface FacetConfiguration {
  readonly categories?: {
    readonly enabled: boolean
    readonly maxItems?: number
    readonly includeSubcategories?: boolean
  }
  readonly priceRanges?: {
    readonly enabled: boolean
    readonly ranges?: readonly { min: number; max: number; label: string }[]
    readonly customRanges?: boolean
  }
  readonly sellers?: {
    readonly enabled: boolean
    readonly maxItems?: number
    readonly includeMetrics?: boolean
  }
  readonly brands?: {
    readonly enabled: boolean
    readonly maxItems?: number
  }
  readonly conditions?: {
    readonly enabled: boolean
  }
  readonly ratings?: {
    readonly enabled: boolean
    readonly threshold?: number
  }
}

// ============================================================================
// RESPONSE DTOs - Comprehensive List Response Architecture
// ============================================================================

/**
 * Facet result structure for dynamic filtering UI
 */
export interface ProductFacet {
  readonly key: string
  readonly label: string
  readonly values: readonly {
    readonly value: string | number
    readonly label: string
    readonly count: number
    readonly selected?: boolean
    readonly metadata?: Record<string, unknown>
  }[]
  readonly type: 'categorical' | 'range' | 'boolean' | 'hierarchical'
  readonly displayPriority?: number
}

/**
 * Enhanced pagination metadata with performance insights
 */
export interface AdvancedPaginationMetadata {
  readonly total: number
  readonly page: number
  readonly limit: number
  readonly offset: number
  readonly totalPages: number
  readonly hasNext: boolean
  readonly hasPrevious: boolean
  readonly nextCursor?: string
  readonly previousCursor?: string
  readonly performance?: {
    readonly queryTimeMs: number
    readonly totalScanned: number
    readonly cacheHit?: boolean
  }
}

/**
 * Aggregated search metadata for business intelligence
 */
export interface SearchMetadata {
  readonly totalResults: number
  readonly searchTerm?: string
  readonly appliedFilters: Record<string, unknown>
  readonly suggestions?: readonly string[]
  readonly relatedCategories?: readonly string[]
  readonly averagePrice?: number
  readonly priceDistribution?: {
    readonly min: number
    readonly max: number
    readonly median: number
    readonly percentiles: Record<number, number>
  }
  readonly popularTags?: readonly { tag: string; count: number }[]
  readonly executionTime: number
  readonly cacheStrategy?: 'hit' | 'miss' | 'partial'
}

/**
 * Comprehensive product list response with business intelligence
 */
export interface EnhancedProductListResponseDto {
  readonly items: readonly ProductSummaryDto[]
  readonly pagination: AdvancedPaginationMetadata
  readonly facets?: readonly ProductFacet[]
  readonly metadata: SearchMetadata
  readonly sorting: {
    readonly applied: ProductSortingOptions
    readonly available: readonly {
      readonly key: string
      readonly label: string
      readonly field: string
      readonly direction: 'asc' | 'desc'
      readonly description?: string
    }[]
  }
  readonly recommendations?: {
    readonly featured: readonly ProductSummaryDto[]
    readonly trending: readonly ProductSummaryDto[]
    readonly personalizedForUser?: readonly ProductSummaryDto[]
  }
  readonly aggregations?: {
    readonly categoryDistribution: Record<string, number>
    readonly sellerDistribution: Record<string, number>
    readonly priceStatistics: {
      readonly min: number
      readonly max: number
      readonly average: number
      readonly median: number
    }
    readonly availabilityMetrics: {
      readonly inStock: number
      readonly outOfStock: number
      readonly lowStock: number
      readonly withDiscount: number
    }
  }
}