
/**
 * Product Response DTOs - Application Layer Data Transfer Objects
 * 
 * Defines the structure for data exchange between layers, ensuring
 * clean separation between domain entities and external representations.
 * 
 * @architectural_pattern DTO Pattern, Interface Segregation
 * @layer Application Layer
 * @purpose API Response standardization, data serialization
 */

export interface ProductImageDto {
  readonly id: string;
  readonly url: string;
  readonly altText: string;
  readonly isPrimary: boolean;
  readonly order: number;
}

export interface ProductRatingDto {
  readonly average: number;
  readonly count: number;
  readonly distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface ProductSpecificationDto {
  readonly name: string;
  readonly value: string;
  readonly category: string;
}

export interface ProductConditionDto {
  readonly type: 'new' | 'used' | 'refurbished';
  readonly description?: string;
}

export interface ProductStockDto {
  readonly available: number;
  readonly reserved: number;
  readonly threshold: number;
  readonly isAvailable: boolean;
}

export interface ProductDimensionsDto {
  readonly weight: number;
  readonly height: number;
  readonly width: number;
  readonly depth: number;
  readonly unit: 'cm' | 'in';
}

export interface ProductDiscountDto {
  readonly percentage: number;
  readonly amount: number;
  readonly savingsAmount: number;
  readonly validUntil?: string;
  readonly condition?: string;
  readonly isValid: boolean;
}

export interface ProductPriceDto {
  readonly originalPrice: number;
  readonly finalPrice: number;
  readonly currency: string;
  readonly formattedPrice: string;
  readonly discount?: ProductDiscountDto;
  readonly hasFreeShipping: boolean;
}

export interface SellerSummaryDto {
  readonly id: string;
  readonly username: string;
  readonly displayName: string;
  readonly profileImage?: string;
  readonly location: string;
  readonly rating: {
    readonly average: number;
    readonly count: number;
    readonly positivePercentage: number;
  }
  readonly metrics: {
    readonly totalSales: number
    readonly experienceYears: number
    readonly responseTimeTier: 'excellent' | 'good' | 'average' | 'slow'
    readonly reliabilityIndicator: 'high' | 'medium' | 'low'
  }
  readonly certifications: readonly {
    readonly type: string
    readonly description: string
    readonly isActive: boolean
  }[]
  readonly shippingPolicy: {
    readonly hasFreeShipping: boolean
    readonly freeShippingMinimum: number
    readonly averageProcessingTime: number
    readonly shippingMethods: readonly string[]
  }
  readonly isActive: boolean
  readonly isVerified: boolean
  readonly isPremiumEligible: boolean
}

export interface PaymentMethodSummaryDto {
  readonly id: string;
  readonly type: string;
  readonly displayName: string;
  readonly description: string;
  readonly logoUrl: string;
  readonly isInstallmentEnabled: boolean;
  readonly maxInstallments: number
  readonly installmentOptions?: readonly {
    readonly quantity: number
    readonly amount: number
    readonly totalAmount: number
    readonly interestRate: number
    readonly isInterestFree: boolean
    readonly recommendedByMerchant: boolean
  }[]
  readonly securityBadges: readonly string[]
  readonly processingTimeDescription: string
  readonly riskScore: number
}

/**
 * Complete Product Details Response DTO
 * 
 * Comprehensive product information optimized for client consumption
 * with computed fields and business logic results.
 */

export interface ProductDetailsResponseDto {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly shortDescription: string
  readonly images: readonly ProductImageDto[]
  readonly primaryImage: ProductImageDto
  readonly category: string
  readonly subcategory: string
  readonly condition: ProductConditionDto
  readonly price: ProductPriceDto
  readonly seller: SellerSummaryDto
  readonly paymentMethods: readonly PaymentMethodSummaryDto[]
  readonly rating: ProductRatingDto
  readonly specifications: readonly ProductSpecificationDto[]
  readonly stock: ProductStockDto
  readonly dimensions: ProductDimensionsDto
  readonly tags: readonly string[]
  readonly metadata: {
    readonly createdAt: string
    readonly updatedAt: string
    readonly isActive: boolean
    readonly availability: {
      readonly isAvailable: boolean
      readonly availabilityText: string
      readonly stockLevel: 'high' | 'medium' | 'low' | 'out_of_stock'
    }
    readonly seo: {
      readonly slug: string
      readonly metaTitle: string
      readonly metaDescription: string
    }
  }
}

/**
 * Product Summary Response DTO
 * 
 * Lightweight product information for listing and search results.
 */
export interface ProductSummaryDto {
  readonly id: string
  readonly title: string
  readonly shortDescription: string
  readonly primaryImage: ProductImageDto
  readonly price: ProductPriceDto
  readonly seller: {
    readonly id: string
    readonly displayName: string
    readonly location: string
    readonly rating: number
    readonly isVerified: boolean
  }
  readonly rating: {
    readonly average: number
    readonly count: number
  }
  readonly category: string
  readonly subcategory: string
  readonly isAvailable: boolean
  readonly tags: readonly string[]
  readonly createdAt: string
}

/**
 * Paginated Product List Response DTO
 */
export interface ProductListResponseDto {
  readonly items: readonly ProductSummaryDto[]
  readonly pagination: {
    readonly total: number
    readonly offset: number
    readonly limit: number
    readonly hasNext: boolean
    readonly hasPrevious: boolean
    readonly totalPages: number
    readonly currentPage: number
  }
  readonly filters: {
    readonly appliedFilters: Record<string, unknown>
    readonly availableFilters: {
      readonly categories: readonly string[]
      readonly priceRanges: readonly {
        readonly min: number
        readonly max: number
        readonly label: string
      }[]
      readonly conditions: readonly string[]
      readonly brands: readonly string[]
    }
  }
  readonly sorting: {
    readonly currentSort: string
    readonly availableSorts: readonly {
      readonly key: string
      readonly label: string
      readonly direction: 'asc' | 'desc'
    }[]
  }
}