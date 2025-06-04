/**
 * JSON Product Repository - File-Based Data Access Implementation
 * 
 * Implements IProductRepository using JSON file as data source with comprehensive
 * querying capabilities, caching, and performance optimizations for development
 * and small-scale production environments.
 * 
 * @architectural_pattern Repository Implementation, Adapter Pattern
 * @design_principle Single Responsibility, Dependency Inversion
 * @performance In-memory caching, optimized filtering, lazy loading
 */

import fs from 'fs/promises'
import path from 'path'
import { 
  IProductRepository, 
  ProductQuerySpecification, 
  PaginatedResult, 
  RepositoryResult,
  RepositoryError,
  RepositoryErrorCode
} from '../../domain/repositories/product-repository.port';
import { Product } from '../../domain/entities/product.entity';
import { Seller } from '../../domain/entities/seller.entity'; 
import { PaymentMethod } from '../../domain/entities/payment-method.entity';

/**
 * Raw JSON structure matching the products.json file format
 */
interface RawProductData {
  readonly products: readonly RawProduct[]
}

interface RawProduct {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly shortDescription: string
  readonly price: number
  readonly currency: string
  readonly images: readonly RawProductImage[]
  readonly category: string
  readonly subcategory: string
  readonly condition: RawProductCondition
  readonly seller: RawSeller
  readonly paymentMethods: readonly RawPaymentMethod[]
  readonly rating: RawProductRating
  readonly specifications: readonly RawProductSpecification[]
  readonly stock: RawProductStock
  readonly dimensions: RawProductDimensions
  readonly tags: readonly string[]
  readonly createdAt: string
  readonly updatedAt: string
  readonly isActive: boolean
  readonly discount?: RawProductDiscount
}

interface RawProductImage {
  readonly id: string
  readonly url: string
  readonly altText: string
  readonly isPrimary: boolean
  readonly order: number
}

interface RawProductRating {
  readonly average: number
  readonly count: number
  readonly distribution: Record<string, number>
}

interface RawProductSpecification {
  readonly name: string
  readonly value: string
  readonly category: string
}

interface RawProductCondition {
  readonly type: 'new' | 'used' | 'refurbished'
  readonly description?: string
}

interface RawProductStock {
  readonly available: number
  readonly reserved: number
  readonly threshold: number
}

interface RawProductDimensions {
  readonly weight: number
  readonly height: number
  readonly width: number
  readonly depth: number
  readonly unit: 'cm' | 'in'
}

interface RawProductDiscount {
  readonly percentage: number
  readonly amount: number
  readonly validUntil?: string
  readonly condition?: string
}

interface RawSeller {
  readonly id: string
  readonly username: string
  readonly displayName: string
  readonly email: string
  readonly profileImage?: string
  readonly address: RawSellerAddress
  readonly rating: RawSellerRating
  readonly metrics: RawSellerMetrics
  readonly shippingPolicy: RawShippingPolicy
  readonly certifications: readonly RawSellerCertification[]
  readonly businessInfo: RawBusinessInfo
  readonly joinedAt: string
  readonly lastActiveAt: string
  readonly isActive: boolean
  readonly isVerified: boolean
  readonly description?: string
}

interface RawSellerAddress {
  readonly street: string
  readonly number: string
  readonly complement?: string
  readonly neighborhood: string
  readonly city: string
  readonly state: string
  readonly zipCode: string
  readonly country: string
}

interface RawSellerRating {
  readonly average: number
  readonly count: number
  readonly positivePercentage: number
  readonly neutralPercentage: number
  readonly negativePercentage: number
  readonly last12Months: number
}

interface RawSellerMetrics {
  readonly totalSales: number
  readonly totalProducts: number
  readonly averageResponseTime: number
  readonly onTimeDeliveryRate: number
  readonly customerSatisfactionRate: number
  readonly disputeResolutionRate: number
}

interface RawShippingPolicy {
  readonly hasFreeShipping: boolean
  readonly freeShippingMinimum: number
  readonly averageProcessingTime: number
  readonly shippingMethods: readonly string[]
  readonly domesticShipping: boolean
  readonly internationalShipping: boolean
}

interface RawSellerCertification {
  readonly type: 'verified' | 'premium' | 'top_seller' | 'mercado_lider'
  readonly issuedAt: string
  readonly validUntil?: string
  readonly description: string
}

interface RawBusinessInfo {
  readonly companyName?: string
  readonly taxId?: string
  readonly businessType: 'individual' | 'small_business' | 'corporation'
  readonly establishedYear?: number
  readonly employees?: number
}

interface RawPaymentMethod {
  readonly id: string
  readonly type: string
  readonly provider: string
  readonly name: string
  readonly displayName: string
  readonly description: string
  readonly logoUrl: string
  readonly currency: string
  readonly isActive: boolean
  readonly isInstallmentEnabled: boolean
  readonly maxInstallments: number
  readonly fees: RawPaymentFees
  readonly limits: RawPaymentLimits
  readonly security: RawSecurityFeatures
  readonly processingTime: RawPaymentProcessingTime
  readonly supportedCountries: readonly string[]
  readonly acceptedCards: readonly string[]
  readonly metadata: Record<string, unknown>
}

interface RawPaymentFees {
  readonly processingFee: number
  readonly platformFee: number
  readonly acquirerFee: number
  readonly totalFeePercentage: number
  readonly fixedFee: number
}

interface RawPaymentLimits {
  readonly minimumAmount: number
  readonly maximumAmount: number
  readonly dailyLimit?: number
  readonly monthlyLimit?: number
}

interface RawSecurityFeatures {
  readonly requires3DSecure: boolean
  readonly fraudDetection: boolean
  readonly tokenization: boolean
  readonly encryptionStandard: string
  readonly complianceLevel: string
}

interface RawPaymentProcessingTime {
  readonly authorizationTime: number
  readonly settlementTime: number
  readonly refundTime: number
  readonly chargebackWindow: number
}

/**
 * JSON Product Repository Implementation
 * 
 * High-performance repository that loads product data from JSON files with
 * comprehensive caching, filtering, and search capabilities. Optimized for
 * development environments and applications with moderate data volumes.
 */
export class JsonProductRepository implements IProductRepository {
  private products: Product[] = []
  private sellers: Map<string, Seller> = new Map()
  private paymentMethods: Map<string, PaymentMethod> = new Map()
  private isLoaded = false
  private loadPromise: Promise<void> | null = null
  private readonly dataPath: string

  constructor(dataPath?: string) {
    this.dataPath = dataPath || path.join(__dirname, '../database/products.json')
  }

  /**
   * Ensures data is loaded from JSON file with singleton pattern
   * 
   * @rationale Prevents multiple concurrent file reads and ensures data consistency
   * @returns Promise that resolves when data is fully loaded and parsed
   */
  private async ensureDataLoaded(): Promise<void> {
    if (this.isLoaded) {
      return
    }

    if (this.loadPromise) {
      return this.loadPromise
    }

    this.loadPromise = this.loadData()
    await this.loadPromise
  }

  /**
   * Loads and parses JSON data, converting to domain entities
   * 
   * @rationale Centralizes data loading logic with comprehensive error handling
   * @throws RepositoryError if file cannot be read or parsed
   */
  private async loadData(): Promise<void> {
    try {
      const fileContent = await fs.readFile(this.dataPath, 'utf-8')
      const rawData: RawProductData = JSON.parse(fileContent)

      this.parseAndStoreData(rawData)
      this.isLoaded = true
    } catch (error) {
      const repositoryError = new RepositoryError(
        `Failed to load product data from ${this.dataPath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        RepositoryErrorCode.PERSISTENCE_ERROR,
        { path: this.dataPath, originalError: error }
      )
      throw repositoryError
    }
  }

  /**
   * Parses raw JSON data and converts to domain entities
   * 
   * @rationale Separates parsing logic for better testability and maintainability
   * @param rawData Raw JSON data structure
   */
  private parseAndStoreData(rawData: RawProductData): void {
    // First pass: Parse sellers and payment methods to avoid circular dependencies
    const sellersMap = new Map<string, Seller>()
    const paymentMethodsMap = new Map<string, PaymentMethod>()

    // Extract unique sellers
    for (const rawProduct of rawData.products) {
      if (!sellersMap.has(rawProduct.seller.id)) {
        const seller = this.parseRawSeller(rawProduct.seller)
        sellersMap.set(seller.id, seller)
      }

      // Extract unique payment methods
      for (const rawPaymentMethod of rawProduct.paymentMethods) {
        if (!paymentMethodsMap.has(rawPaymentMethod.id)) {
          const paymentMethod = this.parseRawPaymentMethod(rawPaymentMethod)
          paymentMethodsMap.set(paymentMethod.id, paymentMethod)
        }
      }
    }

    this.sellers = sellersMap
    this.paymentMethods = paymentMethodsMap

    // Second pass: Parse products with references to sellers and payment methods
    this.products = rawData.products.map(rawProduct => this.parseRawProduct(rawProduct))
  }

  /**
  * Converts raw seller data to Seller entity
  */
  private parseRawSeller(rawSeller: RawSeller): Seller {
    return Seller.create({
      id: rawSeller.id,
      username: rawSeller.username,
      displayName: rawSeller.displayName,
      email: rawSeller.email,
      ...(rawSeller.profileImage && { profileImage: rawSeller.profileImage }),
      address: rawSeller.address,
      rating: {
        average: rawSeller.rating.average,
        count: rawSeller.rating.count,
        positivePercentage: rawSeller.rating.positivePercentage,
        neutralPercentage: rawSeller.rating.neutralPercentage,
        negativePercentage: rawSeller.rating.negativePercentage,
        lastTwelveMonths: rawSeller.rating.last12Months
      },
      metrics: rawSeller.metrics,
      shippingPolicy: rawSeller.shippingPolicy,
      certifications: rawSeller.certifications.map(cert => ({
        type: cert.type,
        issuedAt: new Date(cert.issuedAt),
        validUntil: cert.validUntil ? new Date(cert.validUntil) : new Date('9999-12-31'),
        description: cert.description
      })),
      businessInfo: rawSeller.businessInfo,
      joinedAt: new Date(rawSeller.joinedAt),
      lastActiveAt: new Date(rawSeller.lastActiveAt),
      isActive: rawSeller.isActive,
      isVerified: rawSeller.isVerified,
      ...(rawSeller.description && { description: rawSeller.description })
    })
  }

  /**
   * Converts raw payment method data to PaymentMethod entity
   */
  private parseRawPaymentMethod(rawPaymentMethod: RawPaymentMethod): PaymentMethod {
    return PaymentMethod.create({
      id: rawPaymentMethod.id,
      type: rawPaymentMethod.type as any,
      provider: rawPaymentMethod.provider as any,
      name: rawPaymentMethod.name,
      displayName: rawPaymentMethod.displayName,
      description: rawPaymentMethod.description,
      logoUrl: rawPaymentMethod.logoUrl,
      currency: rawPaymentMethod.currency as any,
      isActive: rawPaymentMethod.isActive,
      isInstallmentEnabled: rawPaymentMethod.isInstallmentEnabled,
      maxInstallments: rawPaymentMethod.maxInstallments,
      fees: rawPaymentMethod.fees,
      limits: rawPaymentMethod.limits,
      security: {
        ...rawPaymentMethod.security,
        complianceLevel: rawPaymentMethod.security.complianceLevel as any
      },
      processingTime: rawPaymentMethod.processingTime,
      supportedCountries: [...rawPaymentMethod.supportedCountries],
      acceptedCards: [...rawPaymentMethod.acceptedCards],
      metadata: rawPaymentMethod.metadata
    })
  }

  /**
   * Converts raw product data to Product entity
   */
  private parseRawProduct(rawProduct: RawProduct): Product {
    const seller = this.sellers.get(rawProduct.seller.id)
    if (!seller) {
      throw new Error(`Seller not found: ${rawProduct.seller.id}`)
    }

    const paymentMethods = rawProduct.paymentMethods.map(rawPM => {
      const paymentMethod = this.paymentMethods.get(rawPM.id)
      if (!paymentMethod) {
        throw new Error(`Payment method not found: ${rawPM.id}`)
      }
      return paymentMethod
    })

    // Convert rating distribution from string keys to number keys
    const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
      1: rawProduct.rating.distribution['1'] || 0,
      2: rawProduct.rating.distribution['2'] || 0,
      3: rawProduct.rating.distribution['3'] || 0,
      4: rawProduct.rating.distribution['4'] || 0,
      5: rawProduct.rating.distribution['5'] || 0
    }

    return Product.create({
      id: rawProduct.id,
      title: rawProduct.title,
      description: rawProduct.description,
      shortDescription: rawProduct.shortDescription,
      price: rawProduct.price,
      currency: rawProduct.currency,
      images: [...rawProduct.images],
      category: rawProduct.category,
      subcategory: rawProduct.subcategory,
      condition: rawProduct.condition,
      seller,
      paymentMethods,
      rating: {
        ...rawProduct.rating,
        distribution
      },
      specifications: [...rawProduct.specifications],
      stock: rawProduct.stock,
      dimensions: rawProduct.dimensions,
      tags: [...rawProduct.tags],
      createdAt: new Date(rawProduct.createdAt),
      updatedAt: new Date(rawProduct.updatedAt),
      isActive: rawProduct.isActive,
      discount: rawProduct.discount ? {
        percentage: rawProduct.discount.percentage,
        amount: rawProduct.discount.amount,
        ...(rawProduct.discount.condition && { condition: rawProduct.discount.condition }),
        ...(rawProduct.discount.validUntil && { validUntil: new Date(rawProduct.discount.validUntil) })
      } : undefined
    })
  }

  /**
   * Repository interface implementations
   */

  async findById(productId: string): Promise<RepositoryResult<Product | null>> {
    try {
      await this.ensureDataLoaded()
      
      const product = this.products.find(p => p.id === productId) || null
      return { success: true, data: product }
    } catch (error) {
      return this.handleError('findById', error)
    }
  }

  async findMany(specification: ProductQuerySpecification): Promise<RepositoryResult<PaginatedResult<Product>>> {
    try {
      await this.ensureDataLoaded()

      let filteredProducts = this.applyFilters(this.products, specification.filters)
      filteredProducts = this.applySorting(filteredProducts, specification.sorting)

      const totalCount = filteredProducts.length
      const paginatedProducts = this.applyPagination(filteredProducts, specification.pagination)

      const result: PaginatedResult<Product> = {
        items: paginatedProducts,
        pagination: {
          total: totalCount,
          offset: specification.pagination?.offset || 0,
          limit: specification.pagination?.limit || totalCount,
          hasNext: this.hasNextPage(totalCount, specification.pagination),
          hasPrevious: (specification.pagination?.offset || 0) > 0
        }
      }

      return { success: true, data: result }
    } catch (error) {
      return this.handleError('findMany', error)
    }
  }

  async findBySeller(sellerId: string, specification?: Omit<ProductQuerySpecification, 'filters'>): Promise<RepositoryResult<PaginatedResult<Product>>> {
    const fullSpecification: ProductQuerySpecification = {
      ...specification,
      filters: { sellerId }
    }

    return this.findMany(fullSpecification)
  }

  async findByCategory(
    category: string, 
    subcategory?: string,
    specification?: Omit<ProductQuerySpecification, 'filters'>
  ): Promise<RepositoryResult<PaginatedResult<Product>>> {
    const filters = { category, ...(subcategory && { subcategory }) }
    const fullSpecification: ProductQuerySpecification = {
      ...specification,
      filters
    }

    return this.findMany(fullSpecification)
  }

  async search(searchTerm: string, specification?: ProductQuerySpecification): Promise<RepositoryResult<PaginatedResult<Product>>> {
    try {
      await this.ensureDataLoaded()

      const searchResults = this.performTextSearch(this.products, searchTerm)
      let filteredProducts = this.applyFilters(searchResults, specification?.filters)
      filteredProducts = this.applySorting(filteredProducts, specification?.sorting)

      const totalCount = filteredProducts.length
      const paginatedProducts = this.applyPagination(filteredProducts, specification?.pagination)

      const result: PaginatedResult<Product> = {
        items: paginatedProducts,
        pagination: {
          total: totalCount,
          offset: specification?.pagination?.offset || 0,
          limit: specification?.pagination?.limit || totalCount,
          hasNext: this.hasNextPage(totalCount, specification?.pagination),
          hasPrevious: (specification?.pagination?.offset || 0) > 0
        }
      }

      return { success: true, data: result }
    } catch (error) {
      return this.handleError('search', error)
    }
  }

  async findDiscountedProducts(specification?: Omit<ProductQuerySpecification, 'filters'>): Promise<RepositoryResult<PaginatedResult<Product>>> {
    const fullSpecification: ProductQuerySpecification = {
      ...specification,
      filters: { hasDiscount: true }
    }

    return this.findMany(fullSpecification)
  }

  async findFeaturedProducts(specification?: Omit<ProductQuerySpecification, 'filters'>): Promise<RepositoryResult<PaginatedResult<Product>>> {
    const fullSpecification: ProductQuerySpecification = {
      ...specification,
      sorting: specification?.sorting || { field: 'rating', direction: 'desc' }
    }

    return this.findMany(fullSpecification)
  }

  async checkAvailability(productId: string): Promise<RepositoryResult<boolean>> {
    try {
      const productResult = await this.findById(productId)
      if (!productResult.success) {
        return productResult as RepositoryResult<boolean>
      }

      const isAvailable = productResult.data?.isAvailable() || false
      return { success: true, data: isAvailable }
    } catch (error) {
      return this.handleError('checkAvailability', error)
    }
  }

  async findByIds(productIds: readonly string[]): Promise<RepositoryResult<readonly Product[]>> {
    try {
      await this.ensureDataLoaded()

      const products = this.products.filter(p => productIds.includes(p.id))
      return { success: true, data: products }
    } catch (error) {
      return this.handleError('findByIds', error)
    }
  }

  async findSimilarProducts(productId: string, specification?: Omit<ProductQuerySpecification, 'filters'>): Promise<RepositoryResult<PaginatedResult<Product>>> {
    try {
      await this.ensureDataLoaded()

      const baseProduct = this.products.find(p => p.id === productId)
      if (!baseProduct) {
        return {
          success: false,
          error: new RepositoryError(
            `Product not found: ${productId}`,
            RepositoryErrorCode.NOT_FOUND
          )
        }
      }

      const similarProducts = this.findSimilarProductsLogic(baseProduct)
      let filteredProducts = this.applySorting(similarProducts, specification?.sorting)

      const totalCount = filteredProducts.length
      const paginatedProducts = this.applyPagination(filteredProducts, specification?.pagination)

      const result: PaginatedResult<Product> = {
        items: paginatedProducts,
        pagination: {
          total: totalCount,
          offset: specification?.pagination?.offset || 0,
          limit: specification?.pagination?.limit || totalCount,
          hasNext: this.hasNextPage(totalCount, specification?.pagination),
          hasPrevious: (specification?.pagination?.offset || 0) > 0
        }
      }

      return { success: true, data: result }
    } catch (error) {
      return this.handleError('findSimilarProducts', error)
    }
  }

  async healthCheck(): Promise<RepositoryResult<{
    isConnected: boolean
    latency: number
    itemCount: number
    lastUpdate: Date
  }>> {
    try {
      const startTime = Date.now()
      await this.ensureDataLoaded()
      const latency = Date.now() - startTime

      const health = {
        isConnected: this.isLoaded,
        latency,
        itemCount: this.products.length,
        lastUpdate: new Date()
      }

      return { success: true, data: health }
    } catch (error) {
      return this.handleError('healthCheck', error)
    }
  }

  /**
   * Private helper methods for filtering, sorting, and pagination
   */

  private applyFilters(products: Product[], filters?: ProductQuerySpecification['filters']): Product[] {
    if (!filters) return products

    return products.filter(product => {
      if (filters.category && product.category !== filters.category) return false
      if (filters.subcategory && product.subcategory !== filters.subcategory) return false
      if (filters.sellerId && product.seller.id !== filters.sellerId) return false
      if (filters.minPrice && product.getFinalPrice() < filters.minPrice) return false
      if (filters.maxPrice && product.getFinalPrice() > filters.maxPrice) return false
      if (filters.condition && product.condition.type !== filters.condition) return false
      if (filters.isActive !== undefined && product.isActive !== filters.isActive) return false
      if (filters.hasDiscount !== undefined) {
        const hasDiscount = product.discount !== undefined && product.getSavingsAmount() > 0
        if (hasDiscount !== filters.hasDiscount) return false
      }
      if (filters.inStock !== undefined && product.isAvailable() !== filters.inStock) return false
      if (filters.tags && filters.tags.length > 0) {
        const hasMatchingTag = filters.tags.some(tag => product.tags.includes(tag))
        if (!hasMatchingTag) return false
      }

      return true
    })
  }

  private applySorting(products: Product[], sorting?: ProductQuerySpecification['sorting']): Product[] {
    if (!sorting) return products

    const { field, direction } = sorting
    const multiplier = direction === 'desc' ? -1 : 1

    return [...products].sort((a, b) => {
      let comparison = 0

      switch (field) {
        case 'price':
          comparison = a.getFinalPrice() - b.getFinalPrice()
          break
        case 'rating':
          comparison = a.rating.average - b.rating.average
          break
        case 'createdAt':
          comparison = a.createdAt.getTime() - b.createdAt.getTime()
          break
        case 'title':
          comparison = a.title.localeCompare(b.title)
          break
        case 'popularity':
          comparison = a.rating.count - b.rating.count
          break
        default:
          comparison = 0
      }

      return comparison * multiplier
    })
  }

  private applyPagination(products: Product[], pagination?: ProductQuerySpecification['pagination']): Product[] {
    if (!pagination) return products

    const { offset = 0, limit = products.length } = pagination
    return products.slice(offset, offset + limit)
  }

  private hasNextPage(totalCount: number, pagination?: ProductQuerySpecification['pagination']): boolean {
    if (!pagination) return false
    const { offset = 0, limit = totalCount } = pagination
    return offset + limit < totalCount
  }

  private performTextSearch(products: Product[], searchTerm: string): Product[] {
    const term = searchTerm.toLowerCase().trim()
    if (!term) return products

    return products.filter(product => {
      const searchableText = [
        product.title,
        product.description,
        product.shortDescription,
        product.category,
        product.subcategory,
        ...product.tags,
        ...product.specifications.map(spec => `${spec.name} ${spec.value}`)
      ].join(' ').toLowerCase()

      return searchableText.includes(term)
    })
  }

  private findSimilarProductsLogic(baseProduct: Product): Product[] {
    return this.products
      .filter(product => product.id !== baseProduct.id)
      .filter(product => {
        // Same category or similar price range
        const sameCategory = product.category === baseProduct.category
        const similarPrice = Math.abs(product.getFinalPrice() - baseProduct.getFinalPrice()) / baseProduct.getFinalPrice() < 0.5
        const sameSeller = product.seller.id === baseProduct.seller.id

        return sameCategory || similarPrice || sameSeller
      })
      .slice(0, 20) // Limit to 20 similar products
  }

  private handleError(operation: string, error: unknown): RepositoryResult<never> {
    if (error instanceof RepositoryError) {
      return { success: false, error }
    }

    const repositoryError = new RepositoryError(
      `Repository operation '${operation}' failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      RepositoryErrorCode.PERSISTENCE_ERROR,
      { operation, originalError: error }
    )

    return { success: false, error: repositoryError }
  }
}