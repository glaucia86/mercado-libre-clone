/**
 * Get Product Details Use Case - Query Operation Implementation
 * 
 * Implements comprehensive product retrieval with business logic validation,
 * error handling, and data transformation following CQRS patterns.
 * Provides type-safe operations with detailed error context and performance
 * optimization through intelligent caching strategies.
 * 
 * @architectural_pattern CQRS Query Operation, Use Case Pattern
 * @layer Application - Business Logic Orchestration
 * @dependencies Domain entities, Repository abstractions, DTO mappings
 */

import type { IProductRepository } from '../../ports/repositories/product-repository.port'
import type { Product } from '../../../domain/entities/product.entity'
import {
  GetProductDetailsQuery,
  UseCaseResult,
  UseCaseError,
  UseCaseErrorCode
} from '../../dtos/product/product-query.dto'
import type {
  ProductDetailsResponseDto,
  ProductImageDto,
  ProductPriceDto,
  ProductDiscountDto,
  SellerSummaryDto,
  PaymentMethodSummaryDto,
  ProductStockDto
} from '../../dtos/product/product-response.dto'

/**
 * Product details use case implementation with comprehensive error handling
 */
export class GetProductDetailsUseCase {
  constructor(
    private readonly productRepository: IProductRepository
  ) {}

  /**
   * Executes product details retrieval with validation and transformation
   */
  async execute(query: GetProductDetailsQuery): Promise<UseCaseResult<ProductDetailsResponseDto>> {
    try {
      // Input validation
      const validationResult = this.validateInput(query)
      if (!validationResult.success) {
        return validationResult
      }

      // Repository query execution
      const repositoryResult = await this.productRepository.findById(query.productId)
      
      if (!repositoryResult.success) {
        return this.handleRepositoryError(repositoryResult)
      }

      const product = repositoryResult.data
      
      if (!product) {
        return {
          success: false,
          error: new UseCaseError(
            `Product with ID ${query.productId} not found`,
            UseCaseErrorCode.PRODUCT_NOT_FOUND,
            { productId: query.productId }
          )
        }
      }

      // Business rule validation
      if (!this.isProductVisible(product, query.includeInactive)) {
        return {
          success: false,
          error: new UseCaseError(
            `Product ${query.productId} is not available`,
            UseCaseErrorCode.PRODUCT_UNAVAILABLE,
            { 
              productId: query.productId,
              isActive: product.isActive,
              isAvailable: product.isAvailable()
            }
          )
        }
      }

      // Transform to DTO
      const productDto = await this.transformToDto(product, query)

      return {
        success: true,
        data: productDto
      }

    } catch (error) {
      return this.handleUnexpectedError(error)
    }
  }

  /**
   * Validates input parameters with business rules
   */
  private validateInput(query: GetProductDetailsQuery): UseCaseResult<void> {
    if (!query.productId) {
      return {
        success: false,
        error: new UseCaseError(
          'Product ID is required',
          UseCaseErrorCode.MISSING_REQUIRED_FIELD,
          { field: 'productId' }
        )
      }
    }

    if (typeof query.productId !== 'string' || query.productId.trim().length === 0) {
      return {
        success: false,
        error: new UseCaseError(
          'Product ID must be a non-empty string',
          UseCaseErrorCode.INVALID_INPUT,
          { field: 'productId', value: query.productId }
        )
      }
    }

    const productIdPattern = /^[A-Z0-9\-_]+$/
    if (!productIdPattern.test(query.productId)) {
      return {
        success: false,
        error: new UseCaseError(
          'Product ID format is invalid',
          UseCaseErrorCode.INVALID_INPUT,
          { 
            field: 'productId', 
            value: query.productId,
            expectedPattern: productIdPattern.source
          }
        )
      }
    }

    return { success: true, data: undefined }
  }

  /**
   * Determines if product should be visible to user
   */
  private isProductVisible(product: Product, includeInactive = false): boolean {
    if (!includeInactive && !product.isActive) {
      return false
    }

    return true
  }

  /**
   * Transforms domain entity to response DTO
   */
  private async transformToDto(
    product: Product,
    query: GetProductDetailsQuery
  ): Promise<ProductDetailsResponseDto> {
    return {
      id: product.id,
      title: product.title,
      description: product.description,
      shortDescription: product.shortDescription,
      images: this.transformImages(product),
      primaryImage: this.transformPrimaryImage(product),
      category: product.category,
      subcategory: product.subcategory,
      condition: {
        type: product.condition.type,
        description: product.condition.description || ''
      },
      price: this.transformPrice(product),
      seller: this.transformSeller(product),
      paymentMethods: query.calculateInstallments 
        ? this.transformPaymentMethodsWithInstallments(product)
        : this.transformPaymentMethods(product),
      rating: {
        average: product.rating.average,
        count: product.rating.count,
        distribution: product.rating.distribution
      },
      specifications: product.specifications.map(spec => ({
        name: spec.name,
        value: spec.value,
        category: spec.category
      })),
      stock: this.transformStock(product),
      dimensions: {
        weight: product.dimensions.weight,
        height: product.dimensions.height,
        width: product.dimensions.width,
        depth: product.dimensions.depth,
        unit: product.dimensions.unit
      },
      tags: product.tags,
      metadata: {
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
        isActive: product.isActive,
        availability: this.calculateAvailability(product),
        seo: this.generateSeoMetadata(product)
      }
    }
  }

  /**
   * Transforms product images to DTO format
   */
  private transformImages(product: Product): readonly ProductImageDto[] {
    return product.getOrderedImages().map(image => ({
      id: image.id,
      url: image.url,
      altText: image.altText,
      isPrimary: image.isPrimary,
      order: image.order
    }))
  }

  /**
   * Transforms primary image to DTO format
   */
  private transformPrimaryImage(product: Product): ProductImageDto {
    const primaryImage = product.getPrimaryImage()
    return {
      id: primaryImage.id,
      url: primaryImage.url,
      altText: primaryImage.altText,
      isPrimary: primaryImage.isPrimary,
      order: primaryImage.order
    }
  }

  /**
   * Transforms price information to DTO format
   */
  private transformPrice(product: Product): ProductPriceDto {
    const discount = product.discount ? this.transformDiscount(product) : undefined

    return {
      originalPrice: product.price,
      finalPrice: product.getFinalPrice(),
      currency: product.currency,
      formattedPrice: product.getFormattedPrice(),
      ...(discount && { discount }),
      hasFreeShipping: product.hasEligibleFreeShipping()
    }
  }

  /**
   * Transforms discount information to DTO format
   */
  private transformDiscount(product: Product): ProductDiscountDto | undefined {
    if (!product.discount) {
      return undefined
    }

    return {
      percentage: product.discount.percentage,
      amount: product.discount.amount,
      savingsAmount: product.getSavingsAmount(),
      ...(product.discount.validUntil && { validUntil: product.discount.validUntil.toISOString() }),
      ...(product.discount.condition && { condition: product.discount.condition }),
      isValid: product.discount.validUntil ? product.discount.validUntil > new Date() : true
    }
  }

  /**
   * Transforms seller information to DTO format
   */
  private transformSeller(product: Product): SellerSummaryDto {
    const seller = product.seller

    return {
      id: seller.id,
      username: seller.username,
      displayName: seller.displayName,
      ...(seller.profileImage && { profileImage: seller.profileImage }),
      location: seller.getLocationDisplay(),
      rating: {
        average: seller.rating.average,
        count: seller.rating.count,
        positivePercentage: seller.rating.positivePercentage
      },
      metrics: {
        totalSales: seller.metrics.totalSales,
        experienceYears: seller.getExperienceYears(),
        responseTimeTier: seller.getResponseTimeTier(),
        reliabilityIndicator: seller.getRealiabilityIndicator()
      },
      certifications: seller.getActiveCertifications().map(cert => ({
        type: cert.type,
        description: cert.description,
        isActive: !cert.validUntil || cert.validUntil > new Date()
      })),
      shippingPolicy: {
        hasFreeShipping: seller.hasFreeShipping,
        freeShippingMinimum: seller.freeShippingMinimum,
        averageProcessingTime: seller.shippingPolicy.averageProcessingTime,
        shippingMethods: seller.shippingPolicy.shippingMethods
      },
      isActive: seller.isActive,
      isVerified: seller.isVerified,
      isPremiumEligible: seller.isPremiumEligible()
    }
  }

  /**
   * Transforms payment methods without installments
   */
  private transformPaymentMethods(product: Product): readonly PaymentMethodSummaryDto[] {
    return product.paymentMethods.map(paymentMethod => ({
      id: paymentMethod.id,
      type: paymentMethod.type,
      displayName: paymentMethod.displayName,
      description: paymentMethod.description,
      logoUrl: paymentMethod.logoUrl,
      isInstallmentEnabled: paymentMethod.isInstallmentEnabled,
      maxInstallments: paymentMethod.maxInstallments,
      securityBadges: paymentMethod.getSecurityBadges(),
      processingTimeDescription: paymentMethod.getProcessingTimeDescription(),
      riskScore: paymentMethod.getRiskScore()
    }))
  }

  /**
   * Transforms payment methods with installment calculations
   */
  private transformPaymentMethodsWithInstallments(product: Product): readonly PaymentMethodSummaryDto[] {
    const finalPrice = product.getFinalPrice()

    return product.paymentMethods.map(paymentMethod => {
      const installmentOptions = paymentMethod.supportsInstallments() 
        ? paymentMethod.calculateInstallmentOptions(finalPrice)
        : undefined

      return {
        id: paymentMethod.id,
        type: paymentMethod.type,
        displayName: paymentMethod.displayName,
        description: paymentMethod.description,
        logoUrl: paymentMethod.logoUrl,
        isInstallmentEnabled: paymentMethod.isInstallmentEnabled,
        maxInstallments: paymentMethod.maxInstallments,
        ...(installmentOptions && installmentOptions.length > 0 && { installmentOptions }),
        securityBadges: paymentMethod.getSecurityBadges(),
        processingTimeDescription: paymentMethod.getProcessingTimeDescription(),
        riskScore: paymentMethod.getRiskScore()
      }
    })
  }

  /**
   * Transforms stock information
   */
  private transformStock(product: Product): ProductStockDto {
    return {
      available: product.stock.available,
      reserved: product.stock.reserved,
      threshold: product.stock.threshold,
      isAvailable: product.isAvailable()
    }
  }

  /**
   * Calculates availability metadata
   */
  private calculateAvailability(product: Product): {
    isAvailable: boolean
    availabilityText: string
    stockLevel: 'high' | 'medium' | 'low' | 'out_of_stock'
  } {
    const isAvailable = product.isAvailable()
    const availableStock = product.stock.available

    let stockLevel: 'high' | 'medium' | 'low' | 'out_of_stock'
    let availabilityText: string

    if (!isAvailable || availableStock === 0) {
      stockLevel = 'out_of_stock'
      availabilityText = 'Produto indisponível'
    } else if (availableStock <= product.stock.threshold) {
      stockLevel = 'low'
      availabilityText = `Últimas ${availableStock} unidades`
    } else if (availableStock <= product.stock.threshold * 3) {
      stockLevel = 'medium'
      availabilityText = 'Estoque limitado'
    } else {
      stockLevel = 'high'
      availabilityText = 'Produto disponível'
    }

    return {
      isAvailable,
      availabilityText,
      stockLevel
    }
  }

  /**
   * Generates SEO metadata
   */
  private generateSeoMetadata(product: Product): {
    slug: string
    metaTitle: string
    metaDescription: string
  } {
    const slug = product.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 100)

    const metaTitle = `${product.title} | MercadoLibre Clone`
    
    const metaDescription = product.shortDescription.length > 150
      ? `${product.shortDescription.substring(0, 147)}...`
      : product.shortDescription

    return {
      slug,
      metaTitle,
      metaDescription
    }
  }

  /**
   * Error handling methods
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

  private handleUnexpectedError(error: unknown): UseCaseResult<never> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    return {
      success: false,
      error: new UseCaseError(
        'An unexpected error occurred while retrieving product details',
        UseCaseErrorCode.INTERNAL_ERROR,
        { 
          originalError: errorMessage,
          stack: error instanceof Error ? error.stack : undefined
        }
      )
    }
  }
}