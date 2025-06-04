/**
 * List Products Use Case - Enterprise-Grade Query Processing Architecture
 * 
 * Implements comprehensive product listing with advanced filtering, sorting,
 * faceting, and aggregation capabilities. Orchestrates complex business logic
 * while maintaining clear separation of concerns and optimal performance.
 * 
 * @architectural_pattern Use Case Pattern, Query Object, Specification Pattern
 * @layer Application - Business Logic Orchestration
 * @responsibility Product enumeration, filtering, aggregation, and transformation
 */

import type { IProductRepository } from '../../../domain/repositories/product-repository.port'
import type { Product } from '../../../domain/entities/product.entity'
import {
  ListProductsQuery,
  UseCaseResult,
  UseCaseError,
  UseCaseErrorCode
} from '../../dtos/product/product-query.dto'
import type { ProductSummaryDto } from '../../dtos/product/product-response.dto'
import { 
  AdvancedPaginationMetadata, 
  EnhancedProductListResponseDto, 
  ProductFacet, 
  SearchMetadata 
} from '@/application/dtos/product/product-list.dto'

/**
 * Performance monitoring and caching infrastructure
 */
interface QueryPerformanceMetrics {
  readonly startTime: number
  readonly repositoryLatency?: number
  readonly transformationLatency?: number
  readonly totalLatency: number
  readonly itemsProcessed: number
  readonly cacheHitRatio?: number
}

/**
 * Internal aggregation state for efficient computation
 */
interface AggregationState {
  readonly categoryDistribution: Map<string, number>
  readonly sellerDistribution: Map<string, number>
  readonly priceStatistics: { min: number; max: number; sum: number; count: number }
  readonly availabilityMetrics: { inStock: number; outOfStock: number; lowStock: number; withDiscount: number }
  readonly tagFrequency: Map<string, number>
}

/**
 * ListProductsUseCase - Advanced Product Enumeration with Business Intelligence
 * 
 * Provides comprehensive product listing capabilities with sophisticated filtering,
 * multi-dimensional sorting, faceted search, and real-time aggregations for
 * enhanced user experience and business analytics.
 */
export class ListProductsUseCase {
  private readonly performanceThresholds = {
    queryWarningMs: 500,
    queryErrorMs: 2000,
    maxResultsPerPage: 100,
    defaultPageSize: 20
  } as const

  constructor(
    private readonly productRepository: IProductRepository
  ) {}

  /**
   * Executes comprehensive product listing with advanced filtering and aggregation
   * 
   * @param query - Complex query specification with filters, sorting, and metadata options
   * @returns Structured response with products, pagination, facets, and business intelligence
   */
  async execute(query: ListProductsQuery): Promise<UseCaseResult<EnhancedProductListResponseDto>> {
    const startTime = performance.now()
    
    try {
      // Phase 1: Input Validation & Sanitization
      const validationResult = this.validateAndSanitizeInput(query)
      if (!validationResult.success) {
        return validationResult
      }

      const sanitizedQuery = validationResult.data

      // Phase 2: Repository Query Execution with Performance Monitoring
      const repositoryStartTime = performance.now()
      const repositoryResult = await this.productRepository.findMany({
        filters: this.transformToRepositoryFilters(sanitizedQuery.filters),
        sorting: this.transformToRepositorySorting(sanitizedQuery.sorting),
        pagination: this.transformToRepositoryPagination(sanitizedQuery.pagination)
      })

      if (!repositoryResult.success) {
        return this.handleRepositoryError(repositoryResult.error)
      }

      const repositoryLatency = performance.now() - repositoryStartTime

      // Phase 3: Business Logic Application & Data Transformation
      const transformationStartTime = performance.now()
      const response = await this.transformToEnhancedResponse(
        repositoryResult.data,
        sanitizedQuery,
        {
          startTime,
          repositoryLatency,
          transformationLatency: 0,
          totalLatency: 0,
          itemsProcessed: repositoryResult.data.items.length
        }
      )
      
      const transformationLatency = performance.now() - transformationStartTime
      const totalLatency = performance.now() - startTime

      // Phase 4: Performance Monitoring & Alerting
      this.monitorPerformance({
        startTime,
        repositoryLatency,
        transformationLatency,
        totalLatency,
        itemsProcessed: repositoryResult.data.items.length
      })

      return {
        success: true,
        data: {
          ...response,
          metadata: {
            ...response.metadata,
            executionTime: totalLatency
          }
        }
      }

    } catch (error) {
      return this.handleUnexpectedError(error)
    }
  }

  /**
   * Validates and sanitizes input query with comprehensive business rule checking
   */
  private validateAndSanitizeInput(
    query: ListProductsQuery
  ): UseCaseResult<Required<ListProductsQuery>> {
    // Pagination validation with business constraints
    const pagination = {
      page: Math.max(1, query.pagination?.page ?? 1),
      limit: Math.min(
        Math.max(1, query.pagination?.limit ?? this.performanceThresholds.defaultPageSize),
        this.performanceThresholds.maxResultsPerPage
      ),
      offset: 0
    }
    pagination.offset = (pagination.page - 1) * pagination.limit

    // Price range validation and normalization
    const filters = query.filters ? { ...query.filters } : {}
    if (filters.minPrice !== undefined && filters.maxPrice !== undefined) {
      if (filters.minPrice > filters.maxPrice) {
        return {
          success: false,
          error: new UseCaseError(
            'Invalid price range: minimum price cannot exceed maximum price',
            UseCaseErrorCode.INVALID_INPUT,
            { minPrice: filters.minPrice, maxPrice: filters.maxPrice }
          )
        }
      }
    }

    // Rating validation
    if (filters.rating?.min !== undefined) {
      if (filters.rating.min < 0 || filters.rating.min > 5) {
        return {
          success: false,
          error: new UseCaseError(
            'Invalid rating range: rating must be between 0 and 5',
            UseCaseErrorCode.INVALID_INPUT,
            { rating: filters.rating }
          )
        }
      }
    }

    // Sorting validation and defaulting
    const sorting = query.sorting ?? {
      field: 'relevance',
      direction: 'desc'
    }

    return {
      success: true,
      data: {
        filters,
        sorting,
        pagination,
        includeFacets: query.includeFacets ?? false,
        includeMetadata: query.includeMetadata ?? true
      }
    }
  }

  /**
   * Transforms application-layer filters to repository-layer specification
   */
  private transformToRepositoryFilters(filters?: ListProductsQuery['filters']) {
    if (!filters) return undefined

    const result: any = {}
    
    if (filters.category !== undefined) result.category = filters.category
    if (filters.subcategory !== undefined) result.subcategory = filters.subcategory
    if (filters.sellerId !== undefined) result.sellerId = filters.sellerId
    if (filters.minPrice !== undefined) result.minPrice = filters.minPrice
    if (filters.maxPrice !== undefined) result.maxPrice = filters.maxPrice
    if (filters.condition !== undefined) result.condition = filters.condition
    if (filters.isActive !== undefined) result.isActive = filters.isActive
    else result.isActive = true
    if (filters.hasDiscount !== undefined) result.hasDiscount = filters.hasDiscount
    if (filters.inStock !== undefined) result.inStock = filters.inStock
    if (filters.tags !== undefined) result.tags = filters.tags
    if (filters.rating !== undefined) result.rating = filters.rating

    return result
  }

  /**
   * Transforms application-layer sorting to repository-layer specification
   */
  private transformToRepositorySorting(sorting?: ListProductsQuery['sorting']): { readonly field: "rating" | "price" | "createdAt" | "title" | "popularity"; readonly direction: "asc" | "desc"; } | undefined {
    if (!sorting) return undefined

    // Map relevance to a valid repository field
    const repositoryField = sorting.field === 'relevance' ? 'createdAt' : sorting.field

    return {
      field: repositoryField as "rating" | "price" | "createdAt" | "title" | "popularity",
      direction: sorting.direction
    } as const
  }

  /**
   * Transforms application-layer pagination to repository-layer specification
   */
  private transformToRepositoryPagination(pagination?: Required<ListProductsQuery>['pagination']) {
    if (!pagination) return undefined

    return {
      offset: pagination.offset,
      limit: pagination.limit
    }
  }

  /**
   * Transforms repository results into comprehensive enhanced response
   */
  private async transformToEnhancedResponse(
    repositoryData: { items: Product[]; pagination: any },
    query: Required<ListProductsQuery>,
    metrics: QueryPerformanceMetrics
  ): Promise<EnhancedProductListResponseDto> {
    
    // Transform products to summary DTOs
    const items = repositoryData.items.map(product => 
      this.transformProductToSummary(product)
    )

    // Generate aggregation state for business intelligence
    const aggregationState = this.buildAggregationState(repositoryData.items)

    // Build comprehensive pagination metadata
    const pagination: AdvancedPaginationMetadata = {
      total: repositoryData.pagination.total,
      page: query.pagination.page ?? 1,
      limit: query.pagination.limit ?? this.performanceThresholds.defaultPageSize,
      offset: query.pagination.offset ?? 0,
      totalPages: Math.ceil(repositoryData.pagination.total / (query.pagination.limit ?? this.performanceThresholds.defaultPageSize)),
      hasNext: repositoryData.pagination.hasNext,
      hasPrevious: repositoryData.pagination.hasPrevious,
      performance: {
        queryTimeMs: Math.round(metrics.repositoryLatency || 0),
        totalScanned: repositoryData.items.length,
        cacheHit: false // Repository layer would provide this
      }
    }

    // Generate facets for dynamic filtering (if requested)
    const facets = query.includeFacets 
      ? this.generateFacets(aggregationState, query.filters)
      : []

    // Build comprehensive search metadata
    const metadata: SearchMetadata = {
      totalResults: repositoryData.pagination.total,
      appliedFilters: (query.filters || {}) as Record<string, unknown>,
      averagePrice: this.calculateAveragePrice(aggregationState.priceStatistics),
      priceDistribution: {
        min: aggregationState.priceStatistics.min,
        max: aggregationState.priceStatistics.max,
        median: this.calculateMedianPrice(repositoryData.items),
        percentiles: this.calculatePricePercentiles(repositoryData.items)
      },
      popularTags: this.getPopularTags(aggregationState.tagFrequency),
      executionTime: 0, // Will be set by caller
      cacheStrategy: 'miss' // Repository layer would provide this
    }

    return {
      items,
      pagination,
      facets,
      metadata,
      sorting: {
        applied: {
          primary: {
            field: query.sorting.field,
            direction: query.sorting.direction
          }
        },
        available: this.getAvailableSortingOptions()
      },
      aggregations: {
        categoryDistribution: Object.fromEntries(aggregationState.categoryDistribution),
        sellerDistribution: Object.fromEntries(aggregationState.sellerDistribution),
        priceStatistics: {
          min: aggregationState.priceStatistics.min,
          max: aggregationState.priceStatistics.max,
          average: this.calculateAveragePrice(aggregationState.priceStatistics),
          median: this.calculateMedianPrice(repositoryData.items)
        },
        availabilityMetrics: aggregationState.availabilityMetrics
      }
    }
  }

  /**
   * Transforms Product entity to ProductSummaryDto for list representation
   */
  private transformProductToSummary(product: Product): ProductSummaryDto {
    return {
      id: product.id,
      title: product.title,
      shortDescription: product.shortDescription,
      primaryImage: {
        id: product.getPrimaryImage().id,
        url: product.getPrimaryImage().url,
        altText: product.getPrimaryImage().altText,
        isPrimary: true,
        order: product.getPrimaryImage().order
      },
      price: {
        originalPrice: product.price,
        finalPrice: product.getFinalPrice(),
        currency: product.currency,
        formattedPrice: product.getFormattedPrice(),
        ...(product.discount && {
          discount: {
            percentage: product.discount.percentage,
            amount: product.discount.amount,
            savingsAmount: product.getSavingsAmount(),
            ...(product.discount.validUntil && {
              validUntil: product.discount.validUntil.toISOString()
            }),
            ...(product.discount.condition && {
              condition: product.discount.condition
            }),
            isValid: product.discount.validUntil ? product.discount.validUntil > new Date() : true
          }
        }),
        hasFreeShipping: product.hasEligibleFreeShipping()
      },
      seller: {
        id: product.seller.id,
        displayName: product.seller.displayName,
        location: product.seller.getLocationDisplay(),
        rating: product.seller.rating.average,
        isVerified: product.seller.isVerified
      },
      rating: {
        average: product.rating.average,
        count: product.rating.count
      },
      category: product.category,
      subcategory: product.subcategory,
      isAvailable: product.isAvailable(),
      tags: product.tags,
      createdAt: product.createdAt.toISOString()
    }
  }

  /**
   * Builds aggregation state for comprehensive business intelligence
   */
  private buildAggregationState(products: Product[]): AggregationState {
    const state: AggregationState = {
      categoryDistribution: new Map(),
      sellerDistribution: new Map(),
      priceStatistics: { min: Infinity, max: 0, sum: 0, count: 0 },
      availabilityMetrics: { inStock: 0, outOfStock: 0, lowStock: 0, withDiscount: 0 },
      tagFrequency: new Map()
    }

    for (const product of products) {
      // Category distribution
      const category = `${product.category}|${product.subcategory}`
      state.categoryDistribution.set(
        category, 
        (state.categoryDistribution.get(category) || 0) + 1
      )

      // Seller distribution
      state.sellerDistribution.set(
        product.seller.displayName,
        (state.sellerDistribution.get(product.seller.displayName) || 0) + 1
      )

      // Price statistics
      const finalPrice = product.getFinalPrice()
      state.priceStatistics.min = Math.min(state.priceStatistics.min, finalPrice)
      state.priceStatistics.max = Math.max(state.priceStatistics.max, finalPrice)
      state.priceStatistics.sum += finalPrice
      state.priceStatistics.count++

      // Availability metrics
      if (product.isAvailable()) {
        if (product.stock.available <= product.stock.threshold) {
          state.availabilityMetrics.lowStock++
        } else {
          state.availabilityMetrics.inStock++
        }
      } else {
        state.availabilityMetrics.outOfStock++
      }

      if (product.discount) {
        state.availabilityMetrics.withDiscount++
      }

      // Tag frequency
      for (const tag of product.tags) {
        state.tagFrequency.set(tag, (state.tagFrequency.get(tag) || 0) + 1)
      }
    }

    return state
  }

  /**
   * Generates dynamic facets for enhanced filtering capabilities
   */
  private generateFacets(state: AggregationState, appliedFilters?: any): ProductFacet[] {
    const facets: ProductFacet[] = []

    // Category facet
    if (state.categoryDistribution.size > 0) {
      facets.push({
        key: 'category',
        label: 'Categoria',
        type: 'hierarchical',
        values: Array.from(state.categoryDistribution.entries())
          .sort(([,a], [,b]) => b - a)
          .slice(0, 10)
          .map(([category, count]) => {
            const [main, sub] = category.split('|')
            return {
              value: category,
              label: sub ? `${main} > ${sub}` : main || 'Categoria',
              count,
              selected: appliedFilters?.category === main
            }
          }),
        displayPriority: 1
      })
    }

    // Price range facet
    facets.push({
      key: 'priceRange',
      label: 'Faixa de Preço',
      type: 'range',
      values: this.generatePriceRangeFacets(state.priceStatistics),
      displayPriority: 2
    })

    // Seller facet
    if (state.sellerDistribution.size > 0) {
      facets.push({
        key: 'seller',
        label: 'Vendedor',
        type: 'categorical',
        values: Array.from(state.sellerDistribution.entries())
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([seller, count]) => ({
            value: seller,
            label: seller,
            count,
            selected: false
          })),
        displayPriority: 3
      })
    }

    return facets
  }

  /**
   * Generates intelligent price range facets based on data distribution
   */
  private generatePriceRangeFacets(priceStats: AggregationState['priceStatistics']) {
    const ranges = [
      { min: 0, max: 100, label: 'Até R$ 100' },
      { min: 100, max: 500, label: 'R$ 100 - R$ 500' },
      { min: 500, max: 1000, label: 'R$ 500 - R$ 1.000' },
      { min: 1000, max: 5000, label: 'R$ 1.000 - R$ 5.000' },
      { min: 5000, max: Infinity, label: 'Acima de R$ 5.000' }
    ]

    return ranges.map(range => ({
      value: `${range.min}-${range.max}`,
      label: range.label,
      count: 0, // Would be calculated from actual data distribution
      selected: false
    }))
  }

  /**
   * Utility methods for statistical calculations
   */
  private calculateAveragePrice(priceStats: AggregationState['priceStatistics']): number {
    return priceStats.count > 0 ? priceStats.sum / priceStats.count : 0
  }

  private calculateMedianPrice(products: Product[]): number {
    const prices = products.map(p => p.getFinalPrice()).sort((a, b) => a - b)
    if (prices.length === 0) return 0
    
    const mid = Math.floor(prices.length / 2)
    return prices.length % 2 === 0 
      ? ((prices[mid - 1] ?? 0) + (prices[mid] ?? 0)) / 2 
      : prices[mid] ?? 0
  }

  private calculatePricePercentiles(products: Product[]): Record<number, number> {
    const prices = products.map(p => p.getFinalPrice()).sort((a, b) => a - b)
    const percentiles = [25, 50, 75, 90, 95]
    
    return percentiles.reduce((acc, p) => {
      const index = Math.ceil((p / 100) * prices.length) - 1
      acc[p] = prices[Math.max(0, index)] || 0
      return acc
    }, {} as Record<number, number>)
  }

  private getPopularTags(tagFrequency: Map<string, number>): { tag: string; count: number }[] {
    return Array.from(tagFrequency.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }))
  }

  private getAvailableSortingOptions() {
    return [
      { key: 'relevance', label: 'Mais relevantes', field: 'relevance', direction: 'desc' as const },
      { key: 'price_asc', label: 'Menor preço', field: 'price', direction: 'asc' as const },
      { key: 'price_desc', label: 'Maior preço', field: 'price', direction: 'desc' as const },
      { key: 'rating', label: 'Melhor avaliados', field: 'rating', direction: 'desc' as const },
      { key: 'newest', label: 'Mais recentes', field: 'createdAt', direction: 'desc' as const },
      { key: 'popularity', label: 'Mais populares', field: 'popularity', direction: 'desc' as const }
    ]
  }

  /**
   * Performance monitoring and alerting infrastructure
   */
  private monitorPerformance(metrics: QueryPerformanceMetrics): void {
    if (metrics.totalLatency > this.performanceThresholds.queryErrorMs) {
      console.error('Query performance critical threshold exceeded', {
        latency: metrics.totalLatency,
        threshold: this.performanceThresholds.queryErrorMs,
        itemsProcessed: metrics.itemsProcessed
      })
    } else if (metrics.totalLatency > this.performanceThresholds.queryWarningMs) {
      console.warn('Query performance warning threshold exceeded', {
        latency: metrics.totalLatency,
        threshold: this.performanceThresholds.queryWarningMs,
        itemsProcessed: metrics.itemsProcessed
      })
    }
  }

  /**
   * Error handling methods with comprehensive context preservation
   */
  private handleRepositoryError(repositoryError: any): UseCaseResult<never> {
    return {
      success: false,
      error: new UseCaseError(
        `Repository operation failed: ${repositoryError.message}`,
        UseCaseErrorCode.DATA_ACCESS_ERROR,
        { 
          originalError: repositoryError,
          operation: 'findMany',
          layer: 'repository'
        }
      )
    }
  }

  private handleUnexpectedError(error: unknown): UseCaseResult<never> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    return {
      success: false,
      error: new UseCaseError(
        `Unexpected error in ListProductsUseCase: ${errorMessage}`,
        UseCaseErrorCode.INTERNAL_ERROR,
        { 
          originalError: error,
          operation: 'execute',
          layer: 'usecase'
        }
      )
    }
  }
}