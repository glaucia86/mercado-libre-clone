/**
 * Get Product Details Use Case - Application Service
 * 
 * Orchestrates the retrieval of comprehensive product information,
 * applying business rules and formatting data for client consumption.
 * 
 * @architectural_pattern Use Case Pattern, Dependency Inversion
 * @layer Application Layer
 * @business_rules Product visibility, pricing calculations, availability checks
 */


import { IProductRepository } from '@/domain/repositories/product-repository.port'
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
 * Get Product Details Use Case
 * 
 * Handles the complete workflow of retrieving and formatting
 * product details for client consumption.
 */
export class GetProductDetailsUseCase {
  constructor(
    private readonly productRepository: IProductRepository
  ) {}

  /**
   * Executes the get product details use case
   * 
   * @rationale Centralizes product detail retrieval logic with business rules
   * @param query Input parameters for product retrieval
   * @returns Formatted product details or error information
   */
  async execute(query: GetProductDetailsQuery): Promise<UseCaseResult<ProductDetailsResponseDto>> {
    try {
      // Input validation
      const validationResult = this.validateInput(query)
      if (!validationResult.success) {
        return validationResult
      }

      // Repository call
      const repositoryResult = await this.productRepository.findById(query.productId)
      if (!repositoryResult.success) {
        return this.handleRepositoryError(repositoryResult.error)
      }

      // Business rule: Product not found
      if (!repositoryResult.data) {
        return {
          success: false,
          error: new UseCaseError(
            `Product not found: ${query.productId}`,
            UseCaseErrorCode.PRODUCT_NOT_FOUND,
            { productId: query.productId }
          )
        }
      }

      const product = repositoryResult.data

      // Business rule: Check product visibility
      if (!this.isProductVisible(product, query.includeInactive)) {
        return {
          success: false,
          error: new UseCaseError(
            'Product is not available for viewing',
            UseCaseErrorCode.PRODUCT_UNAVAILABLE,
            { productId: query.productId, isActive: product.isActive }
          )
        }
      }

      // Transform domain entity to DTO
      const productDetailsDto = await this.transformToDto(product, query)

      return {
        success: true,
        data: productDetailsDto
      }

    } catch (error) {
      return this.handleUnexpectedError(error)
    }
  }

  /**
   * Validates input parameters
   * 
   * @rationale Ensures data integrity and provides early validation feedback
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

    return { success: true, data: undefined }
  }

  /**
   * Determines if product should be visible to user
   * 
   * @rationale Encapsulates business rules for product visibility
   */
  private isProductVisible(product: Product, includeInactive = false): boolean {
    return product.isActive || includeInactive
  }

  /**
   * Transforms domain entity to DTO
   * 
   * @rationale Converts internal representation to external API format
   */
  private async transformToDto(
    product: Product, 
    query: GetProductDetailsQuery
  ): Promise<ProductDetailsResponseDto> {
    // Calculate installments if requested
    const paymentMethodsDto = query.calculateInstallments 
      ? this.transformPaymentMethodsWithInstallments(product)
      : this.transformPaymentMethods(product)

    return {
      id: product.id,
      title: product.title,
      description: product.description,
      shortDescription: product.shortDescription,
      images: this.transformImages(product),
      primaryImage: this.transformPrimaryImage(product),
      category: product.category,
      subcategory: product.subcategory,
      condition: product.condition,
      price: this.transformPrice(product),
      seller: this.transformSeller(product),
      paymentMethods: paymentMethodsDto,
      rating: product.rating,
      specifications: [...product.specifications],
      stock: this.transformStock(product),
      dimensions: product.dimensions,
      tags: [...product.tags],
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
   * Transforms product images
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
   * Gets primary image
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
   * Transforms pricing information
   */
  private transformPrice(product: Product): ProductPriceDto {
    const discount = product.discount ? this.transformDiscount(product) : undefined

    return {
      originalPrice: product.price,
      finalPrice: product.getFinalPrice(),
      currency: product.currency,
      formattedPrice: product.getFormattedPrice(),
      discount,
      hasFreeShipping: product.hasEligibleFreeShipping()
    }
  }

  /**
   * Transforms discount information
   */
  private transformDiscount(product: Product): ProductDiscountDto {
    if (!product.discount) {
      throw new Error('Product has no discount')
    }

    return {
      percentage: product.discount.percentage,
      amount: product.discount.amount,
      savingsAmount: product.getSavingsAmount(),
      validUntil: product.discount.validUntil?.toISOString(),
      condition: product.discount.condition,
      isValid: product.getSavingsAmount() > 0
    }
  }

  /**
   * Transforms seller information
   */
  private transformSeller(product: Product): SellerSummaryDto {
    const seller = product.seller

    return {
      id: seller.id,
      username: seller.username,
      displayName: seller.displayName,
      profileImage: seller.profileImage,
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
        isActive: true
      })),
      shippingPolicy: {
        hasFreeShipping: seller.shippingPolicy.hasFreeShipping,
        freeShippingMinimum: seller.shippingPolicy.freeShippingMinimum,
        averageProcessingTime: seller.shippingPolicy.averageProcessingTime,
        shippingMethods: [...seller.shippingPolicy.shippingMethods]
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
      const baseDto = this.transformPaymentMethods(product).find(pm => pm.id === paymentMethod.id)!
      
      const installmentOptions = paymentMethod.supportsAmount(finalPrice) 
        ? paymentMethod.calculateInstallmentOptions(finalPrice)
        : []

      return {
        ...baseDto,
        installmentOptions
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
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()

    const metaTitle = `${product.title} | ${product.seller.displayName}`
    
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
  private handleRepositoryError(repositoryError: any): UseCaseResult<never> {
    return {
      success: false,
      error: new UseCaseError(
        'Failed to retrieve product from repository',
        UseCaseErrorCode.REPOSITORY_ERROR,
        { originalError: repositoryError.message || 'Unknown repository error' }
      )
    }
  }

  private handleUnexpectedError(error: unknown): UseCaseResult<never> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    return {
      success: false,
      error: new UseCaseError(
        `Unexpected error in GetProductDetailsUseCase: ${errorMessage}`,
        UseCaseErrorCode.INTERNAL_ERROR,
        { originalError: errorMessage }
      )
    }
  }
}