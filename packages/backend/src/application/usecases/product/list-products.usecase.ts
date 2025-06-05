/**
 * List Products Use Case - Advanced Query Processing Architecture
 * 
 * Implements sophisticated product enumeration with comprehensive filtering,
 * sorting, pagination, and business intelligence capabilities. Provides
 * enterprise-grade query processing with performance optimization and
 * detailed metadata aggregation for enhanced user experience.
 * 
 * @architectural_pattern CQRS Query Operation, Specification Pattern
 * @layer Application - Business Logic Orchestration
 * @dependencies Domain entities, Repository abstractions, Advanced DTOs
 */

import type { IProductRepository } from '../../ports/repositories/product-repository.port'
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
} from '../../dtos/product/product-list.dto'

/**
 * Performance metrics tracking for query optimization
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
 * Aggregation state for business intelligence calculations
 */
interface AggregationState {
  readonly categoryDistribution: Map<string, number>
  readonly sellerDistribution: Map<string, number>
  readonly priceStatistics: { min: number; max: number; sum: number; count: number }
  readonly availabilityMetrics: { inStock: number; outOfStock: number; lowStock: number; withDiscount: number }
  readonly tagFrequency: Map<string, number>
}

/**
 * List products use case implementation with advanced querying capabilities
 */
export class ListProductsUseCase {
  constructor(
    private readonly productRepository: IProductRepository
  ) {}

  /**
   * Executes product enumeration with comprehensive filtering and business intelligence
   */
  async execute(query: ListProductsQuery): Promise<UseCaseResult<EnhancedProductListResponseDto>> {
    const performanceStartTime = performance.now()
    
    try {
      // Input validation and sanitization
      const validationResult = this.validateAndSanitizeInput(query)
      if (!validationResult.success) {
        return validationResult
      }

      const sanitizedQuery = validationResult.data

      // Repository query execution with specification transformation
      const repositorySpec = {
        filters: this.transformToRepositoryFilters(sanitizedQuery.filters),
        sorting: this.transformToRepositorySorting(sanitizedQuery.sorting),
        pagination: this.transformToRepositoryPagination(sanitizedQuery.pagination)
      }

      const repositoryStartTime = performance.now()
      const repositoryResult = await this.productRepository.findMany(repositorySpec)
      const repositoryEndTime = performance.now()

      if (!repositoryResult.success) {
        return this.handleRepositoryError(repositoryResult)
      }

      // Transform to enhanced response with business intelligence
      const transformationStartTime = performance.now()
      const enhancedResponse = await this.transformToEnhancedResponse(
        repositoryResult.data,
        sanitizedQuery,
        {
          startTime: performanceStartTime,
          repositoryLatency: repositoryEndTime - repositoryStartTime,
          transformationLatency: 0,
          totalLatency: 0,
          itemsProcessed: repositoryResult.data.items.length
        }
      )
      const transformationEndTime = performance.now()

      // Performance metrics calculation
      const metrics: QueryPerformanceMetrics = {
        startTime: performanceStartTime,
        repositoryLatency: repositoryEndTime - repositoryStartTime,
        transformationLatency: transformationEndTime - transformationStartTime,
        totalLatency: transformationEndTime - performanceStartTime,
        itemsProcessed: repositoryResult.data.items.length
      }

      // Performance monitoring and alerting
      this.monitorPerformance(metrics)

      return {
        success: true,
        data: enhancedResponse
      }

    } catch (error) {
      return this.handleUnexpectedError(error)
    }
  }

  /**
   * Validates and sanitizes input with comprehensive business rule enforcement
   */
  private validateAndSanitizeInput(
    query: ListProductsQuery
  ): UseCaseResult<Required<ListProductsQuery>> {
    // Provide defaults for missing optional fields
    const sanitizedQuery: Required<ListProductsQuery> = {
      filters: query.filters || {},
      sorting: query.sorting || { field: 'createdAt', direction: 'desc' },
      pagination: query.pagination || { offset: 0, limit: 20 },
      includeFacets: query.includeFacets ?? true,
      includeMetadata: query.includeMetadata ?? true
    }

    // Pagination validation
    if (sanitizedQuery.pagination.limit < 1 || sanitizedQuery.pagination.limit > 100) {
      return {
        success: false,
        error: new UseCaseError(
          'Invalid pagination limit. Must be between 1 and 100',
          UseCaseErrorCode.INVALID_INPUT,
          { field: 'pagination.limit', value: sanitizedQuery.pagination.limit }
        )
      }
    }

    if (sanitizedQuery.pagination.offset < 0) {
      return {
        success: false,
        error: new UseCaseError(
          'Invalid pagination offset. Must be greater than or equal to 0',
          UseCaseErrorCode.INVALID_INPUT,
          { field: 'pagination.offset', value: sanitizedQuery.pagination.offset }
        )
      }
    }

    // Price range validation
    if (sanitizedQuery.filters.minPrice !== undefined && sanitizedQuery.filters.minPrice < 0) {
      return {
        success: false,
        error: new UseCaseError(
          'Minimum price must be greater than or equal to 0',
          UseCaseErrorCode.INVALID_INPUT,
          { field: 'filters.minPrice', value: sanitizedQuery.filters.minPrice }
        )
      }
    }

    if (sanitizedQuery.filters.maxPrice !== undefined && 
        sanitizedQuery.filters.minPrice !== undefined &&
        sanitizedQuery.filters.maxPrice < sanitizedQuery.filters.minPrice) {
      return {
        success: false,
        error: new UseCaseError(
          'Maximum price must be greater than minimum price',
          UseCaseErrorCode.INVALID_INPUT,
          { 
            minPrice: sanitizedQuery.filters.minPrice,
            maxPrice: sanitizedQuery.filters.maxPrice
          }
        )
      }
    }

    return { success: true, data: sanitizedQuery }
  }

  /**
   * Transforms application filters to repository specification
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
    if (filters.hasDiscount !== undefined) result.hasDiscount = filters.hasDiscount
    if (filters.inStock !== undefined) result.inStock = filters.inStock
    if (filters.tags !== undefined) result.tags = filters.tags
    if (filters.rating !== undefined) result.rating = filters.rating
    if (filters.location !== undefined) result.location = filters.location
    if (filters.seller !== undefined) result.seller = filters.seller

    return Object.keys(result).length > 0 ? result : undefined
  }

  /**
   * Transforms application sorting to repository specification
   */
  private transformToRepositorySorting(sorting?: ListProductsQuery['sorting']) {
    if (!sorting) return undefined

    return {
      field: sorting.field,
      direction: sorting.direction
    }
  }

  /**
   * Transforms application pagination to repository specification
   */
  private transformToRepositoryPagination(pagination?: Required<ListProductsQuery>['pagination']) {
    if (!pagination) return undefined

    return {
      offset: pagination.offset,
      limit: pagination.limit
    }
  }

  /**
   * Transforms repository data to enhanced response with business intelligence
   */
  private async transformToEnhancedResponse(
    repositoryData: { items: readonly Product[]; pagination: any },
    query: Required<ListProductsQuery>,
    metrics: QueryPerformanceMetrics
  ): Promise<EnhancedProductListResponseDto> {
    // Transform products to summary DTOs
    const productSummaries = repositoryData.items.map(product => 
      this.transformProductToSummary(product)
    )

    // Build aggregation state for business intelligence
    const aggregationState = this.buildAggregationState(repositoryData.items)

    // Generate facets if requested
    const facets = query.includeFacets 
      ? this.generateFacets(aggregationState, query.filters)
      : undefined

    // Generate comprehensive metadata
    const searchMetadata: SearchMetadata = {
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
      executionTime: metrics.totalLatency,
      cacheStrategy: metrics.cacheHitRatio ? 'hit' : 'miss'
    }

    // Advanced pagination metadata
    const paginationMetadata: AdvancedPaginationMetadata = {
      total: repositoryData.pagination.total,
      page: Math.floor(query.pagination.offset / query.pagination.limit) + 1,
      limit: query.pagination.limit,
      offset: query.pagination.offset,
      totalPages: Math.ceil(repositoryData.pagination.total / query.pagination.limit),
      hasNext: repositoryData.pagination.hasNext,
      hasPrevious: repositoryData.pagination.hasPrevious,
      performance: {
        queryTimeMs: metrics.repositoryLatency || 0,
        totalScanned: repositoryData.items.length,
        cacheHit: metrics.cacheHitRatio !== undefined
      }
    }

    // Available sorting options
    const availableSortingOptions = this.getAvailableSortingOptions()

    return {
      items: productSummaries,
      pagination: paginationMetadata,
      ...(facets && { facets }),
      metadata: searchMetadata,
      sorting: {
        applied: {
          primary: {
            field: query.sorting.field,
            direction: query.sorting.direction
          }
        },
        available: availableSortingOptions
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
   * Transforms product domain entity to summary DTO
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
        isPrimary: product.getPrimaryImage().isPrimary,
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
   * Builds aggregation state for business intelligence calculations
   */
  private buildAggregationState(products: readonly Product[]): AggregationState {
    const categoryDistribution = new Map<string, number>()
    const sellerDistribution = new Map<string, number>()
    const tagFrequency = new Map<string, number>()
    
    let priceSum = 0
    let priceMin = Number.POSITIVE_INFINITY
    let priceMax = Number.NEGATIVE_INFINITY
    let priceCount = 0

    const availabilityMetrics = {
      inStock: 0,
      outOfStock: 0,
      lowStock: 0,
      withDiscount: 0
    }

    for (const product of products) {
      // Category distribution
      const currentCategoryCount = categoryDistribution.get(product.category) || 0
      categoryDistribution.set(product.category, currentCategoryCount + 1)

      // Seller distribution
      const currentSellerCount = sellerDistribution.get(product.seller.id) || 0
      sellerDistribution.set(product.seller.id, currentSellerCount + 1)

      // Price statistics
      const finalPrice = product.getFinalPrice()
      priceSum += finalPrice
      priceMin = Math.min(priceMin, finalPrice)
      priceMax = Math.max(priceMax, finalPrice)
      priceCount++

      // Availability metrics
      if (product.isAvailable()) {
        if (product.stock.available <= product.stock.threshold) {
          availabilityMetrics.lowStock++
        } else {
          availabilityMetrics.inStock++
        }
      } else {
        availabilityMetrics.outOfStock++
      }

      if (product.discount) {
        availabilityMetrics.withDiscount++
      }

      // Tag frequency
      for (const tag of product.tags) {
        const currentTagCount = tagFrequency.get(tag) || 0
        tagFrequency.set(tag, currentTagCount + 1)
      }
    }

    return {
      categoryDistribution,
      sellerDistribution,
      priceStatistics: {
        min: priceMin === Number.POSITIVE_INFINITY ? 0 : priceMin,
        max: priceMax === Number.NEGATIVE_INFINITY ? 0 : priceMax,
        sum: priceSum,
        count: priceCount
      },
      availabilityMetrics,
      tagFrequency
    }
  }

  /**
   * Generates facets for enhanced filtering capabilities
   */
  private generateFacets(state: AggregationState, appliedFilters?: any): ProductFacet[] {
    const facets: ProductFacet[] = []

    // Category facet
    if (state.categoryDistribution.size > 0) {
      facets.push({
        key: 'category',
        label: 'Categorias',
        type: 'categorical',
        values: Array.from(state.categoryDistribution.entries())
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([category, count]) => ({
            value: category,
            label: category,
            count,
            selected: appliedFilters?.category === category
          })),
        displayPriority: 1
      })
    }

    // Price range facet
    facets.push(...this.generatePriceRangeFacets(state.priceStatistics))

    return facets
  }

  /**
   * Generates price range facets
   */
  private generatePriceRangeFacets(priceStats: AggregationState['priceStatistics']): ProductFacet[] {
    if (priceStats.count === 0) return []

    const ranges = [
      { min: 0, max: 50, label: 'Até R$ 50' },
      { min: 50, max: 100, label: 'R$ 50 a R$ 100' },
      { min: 100, max: 500, label: 'R$ 100 a R$ 500' },
      { min: 500, max: 1000, label: 'R$ 500 a R$ 1.000' },
      { min: 1000, max: Number.POSITIVE_INFINITY, label: 'Mais de R$ 1.000' }
    ]

    return [{
      key: 'priceRange',
      label: 'Faixa de Preço',
      type: 'range',
      values: ranges.map(range => ({
        value: `${range.min}-${range.max}`,
        label: range.label,
        count: 0, // Would require additional calculation
        selected: false
      })),
      displayPriority: 2
    }]
  }

  /**
   * Calculates average price from statistics
   */
  private calculateAveragePrice(priceStats: AggregationState['priceStatistics']): number {
    return priceStats.count > 0 ? priceStats.sum / priceStats.count : 0
  }

  /**
   * Calculates median price from product list
   */
  private calculateMedianPrice(products: readonly Product[]): number {
    if (products.length === 0) return 0

    const prices = products.map(p => p.getFinalPrice()).sort((a, b) => a - b)
    const middle = Math.floor(prices.length / 2)
    
    return prices.length % 2 === 0 
      ? (prices[middle - 1]! + prices[middle]!) / 2
      : prices[middle]!
  }

  /**
   * Calculates price percentiles
   */
  private calculatePricePercentiles(products: readonly Product[]): Record<number, number> {
    if (products.length === 0) return {}

    const prices = products.map(p => p.getFinalPrice()).sort((a, b) => a - b)
    const percentiles = [25, 50, 75, 90, 95]
    
    return Object.fromEntries(
      percentiles.map(p => [
        p,
        prices[Math.floor((p / 100) * (prices.length - 1))] || 0
      ])
    )
  }

  /**
   * Gets popular tags from frequency map
   */
  private getPopularTags(tagFrequency: Map<string, number>): readonly { tag: string; count: number }[] {
    return Array.from(tagFrequency.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }))
  }

  /**
   * Gets available sorting options
   */
  private getAvailableSortingOptions() {
    return [
      { key: 'relevance', label: 'Mais relevantes', field: 'relevance', direction: 'desc' as const, description: 'Ordenação por relevância' },
      { key: 'price_asc', label: 'Menor preço', field: 'price', direction: 'asc' as const, description: 'Produtos mais baratos primeiro' },
      { key: 'price_desc', label: 'Maior preço', field: 'price', direction: 'desc' as const, description: 'Produtos mais caros primeiro' },
      { key: 'rating', label: 'Melhor avaliação', field: 'rating', direction: 'desc' as const, description: 'Melhores avaliações primeiro' },
      { key: 'newest', label: 'Mais recentes', field: 'createdAt', direction: 'desc' as const, description: 'Produtos mais novos primeiro' },
      { key: 'popularity', label: 'Mais populares', field: 'popularity', direction: 'desc' as const, description: 'Produtos mais vendidos' }
    ]
  }

  /**
   * Monitors query performance and logs warnings for slow queries
   */
  private monitorPerformance(metrics: QueryPerformanceMetrics): void {
    const SLOW_QUERY_THRESHOLD = 1000 // ms
    const VERY_SLOW_QUERY_THRESHOLD = 3000 // ms

    if (metrics.totalLatency > VERY_SLOW_QUERY_THRESHOLD) {
      console.warn('Very slow product query detected:', {
        totalLatency: metrics.totalLatency,
        repositoryLatency: metrics.repositoryLatency,
        transformationLatency: metrics.transformationLatency,
        itemsProcessed: metrics.itemsProcessed
      })
    } else if (metrics.totalLatency > SLOW_QUERY_THRESHOLD) {
      console.info('Slow product query detected:', {
        totalLatency: metrics.totalLatency,
        itemsProcessed: metrics.itemsProcessed
      })
    }
  }

  /**
   * Handles repository-specific errors
   */
  private handleRepositoryError(repositoryResult: any): UseCaseResult<never> {
    return {
      success: false,
      error: new UseCaseError(
        'Failed to retrieve product data',
        UseCaseErrorCode.DATA_ACCESS_ERROR,
        { 
          repositoryError: repositoryResult.error?.message || 'Unknown repository error',
          repositoryErrorCode: repositoryResult.error?.code
        }
      )
    }
  }

  /**
   * Handles unexpected errors during query processing
   */
  private handleUnexpectedError(error: unknown): UseCaseResult<never> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    return {
      success: false,
      error: new UseCaseError(
        'An unexpected error occurred while processing product query',
        UseCaseErrorCode.INTERNAL_ERROR,
        { 
          originalError: errorMessage,
          stack: error instanceof Error ? error.stack : undefined
        }
      )
    }
  }
}