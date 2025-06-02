/**
 * Product Entity - Aggregate Root
 * 
 * Encapsulates product business logic and maintains invariants.
 * Implements the Aggregate pattern from DDD to ensure consistency boundaries.
 * 
 * @architectural_pattern Aggregate Root, Value Object composition
 * @business_rules Price validation, availabillity constraints, rating calculations
 */


import type { Seller } from './seller.entity';
import type { PaymentMethod } from './payment-method.entity';

export interface ProductImage {
  readonly id: string
  readonly url: string
  readonly altText: string
  readonly isPrimary: boolean
  readonly order: number
}

export interface ProductRating {
  readonly average: number
  readonly count: number
  readonly distribution: Record<1 | 2 | 3 | 4 | 5, number>
}

export interface ProductSpecification {
  readonly name: string
  readonly value: string
  readonly category: string
}

export interface ProductCondition {
  readonly type: 'new' | 'used' | 'refurbished'
  readonly description?: string
}

export interface ProductStock {
  readonly available: number
  readonly reserved: number
  readonly threshold: number // Minimum stock level for availability
}

export interface ProductDimensions {
  readonly weight: number
  readonly height: number
  readonly width: number
  readonly depth: number
  readonly unit: 'cm' | 'in'
}

export interface ProductDiscount {
  readonly percentage: number
  readonly amount: number
  readonly validUntil?: Date
  readonly condition?: string
}

/**
 * Product Aggregate Root
 * 
 * Central entity that maintains product business rules and coordinates
 * with related entities while preserving transactional boundaries.
 */
export class Product {
  private constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly description: string,
    public readonly shortDescription: string,
    public readonly price: number,
    public readonly currency: string,
    public readonly images: readonly ProductImage[],
    public readonly category: string,
    public readonly subcategory: string,
    public readonly condition: ProductCondition,
    public readonly seller: Seller,
    public readonly paymentMethods: readonly PaymentMethod[],
    public readonly rating: ProductRating,
    public readonly specifications: readonly ProductSpecification[],
    public readonly stock: ProductStock,
    public readonly dimensions: ProductDimensions,
    public readonly tags: readonly string[],
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly isActive: boolean = true,
    public readonly discount?: ProductDiscount
  ) {
    this.validateBusinessRules()
  }

  /**
   * Factory method for creating Product instances with validation
   * 
   * @rationale Encapsulates creation logic and ensures all invariants are met
   * @param productData Raw product data
   * @returns Validated Product instance
   * @throws ProductValidationError if business rules are violated
   */
  public static create(productData:{
    id: string
    title: string
    description: string
    shortDescription: string
    price: number
    currency: string
    images: readonly ProductImage[]
    category: string
    subcategory: string
    condition: ProductCondition
    seller: Seller
    paymentMethods: readonly PaymentMethod[]
    rating: ProductRating
    specifications: readonly ProductSpecification[]
    stock: ProductStock
    dimensions: ProductDimensions
    tags: string[]
    createdAt: Date
    updatedAt: Date
    isActive?: boolean
    discount?: ProductDiscount
  }): Product {
    return new Product(
      productData.id,
      productData.title,
      productData.description,
      productData.shortDescription,
      productData.price,
      productData.currency,
      productData.images,
      productData.category,
      productData.subcategory,
      productData.condition,
      productData.seller,
      productData.paymentMethods,
      productData.rating,
      productData.specifications,
      productData.stock,
      productData.dimensions,
      productData.tags,
      productData.createdAt,
      productData.updatedAt,
      productData.isActive,
      productData.discount
    )
  }

  /**
   * Business rule validation - Domain integrity enforcement
   * 
   * @rationale Centralizes all business rule validation to maintain consistency
   * @throws ProductValidationError for any rule violation
   */
  private validateBusinessRules(): void {
    this.validatePrice();
    this.validateImages();
    this.validateRating();
    this.validateStock();
    this.validateDiscount();
  }

  private validatePrice(): void {
    if (this.price <= 0) {
      throw new Error('Price must be greater than zero');
    }

    if (!this.currency || this.currency.length !== 3) {
      throw new Error('Currency must be a valid 3-letter ISO code');
    }
  }

  private validateImages(): void {
    if (this.images.length === 0) {
      throw new Error('Product must have at least one image');
    }

    const primaryImages = this.images.filter(img => img.isPrimary);

    if (primaryImages.length !== 1) {
      throw new Error('Product must have exactly one primary image');
    }
  }

  private validateRating(): void {
    if (this.rating.average < 0 || this.rating.average > 5) {
      throw new Error('Average rating must be between 0 and 5');
    }

    if (this.rating.count < 0){
      throw new Error('Rating count cannot be negative');
    }
  }

  private validateStock(): void {
    if (this.stock.available < 0 || this.stock.reserved < 0) {
      throw new Error('Stock quantities cannot be negative');
    }

    if (this.stock.threshold < 0) {
      throw new Error('Stock threshold cannot be negative');
    }
  }

  private validateDiscount(): void {
    if (this.discount) {
      if (this.discount.percentage < 0 || this.discount.percentage > 100) {
        throw new Error('Discount percentage must be between 0 and 100');
      }

      if (this.discount.amount < 0) {
        throw new Error('Discount amount cannot be negative');
      }

      if (this.discount.validUntil && this.discount.validUntil < new Date()) {
        throw new Error('Discount cannot be valid in the past');
      }
    }
  }

  /**
   * Domain service methods - Business operation encapsulation
   */

  /**
   * Calculates the final price considering active discounts
   * 
   * @rationale Encapsulates pricing logic and discount application rules
   * @returns Final price after discount application
   */
  public getFinalPrice(): number {
    if (!this.discount || !this.isDiscountValid()) {
      return this.price;
    }

    const discountAmount = this.discount.percentage > 0 
      ? this.price * (this.discount.percentage / 100)
      : this.discount.amount;

    return Math.max(this.price - discountAmount);
  }
  
  /**
   * Determines product availability based on business rules
   * 
   * @rationale Centralizes availability logic considering stock and business constraints
   * @returns Boolean indicating if product can be purchased
   */
  public isAvailable(): boolean {
    return this.isActive && 
           this.stock.available > 0 && 
           this.stock.available > this.stock.threshold;
  }

  /**
   * Validates if current discount is active and applicable
   */
  private isDiscountValid(): boolean {
    if (!this.discount) {
      return false;
    }
    return !this.discount.validUntil || this.discount.validUntil > new Date();
  }

  /**
   * Retrieves primary product image for display purposes
   */
  public getPrimaryImage(): ProductImage {
    const primaryImage = this.images.find(img => img.isPrimary);
    if (!primaryImage) {
      throw new Error('Product must have a primary image');
    }

    return primaryImage;
  }

  /**
   * Calculates savings amount when discount is applied
   */
  public getSavingsAmount(): number {
    return this.price - this.getFinalPrice();
  }

  /**
   * Determines if product qualifies for free shipping based on seller policies
   */
  public hasEligibleFreeShipping(): boolean {
    return this.seller.hasFreeShipping && this.getFinalPrice() >= this.seller.freeShippingMinimum;
  }

  /**
   * Formats price for display with currency symbol
   */
  public getFormattedPrice(): string {
    const formatter = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: this.currency,
      minimumFractionDigits: 2,
    });

    return formatter.format(this.getFinalPrice());
  }

  /**
   * Retrieves product images sorted by display order
   */
  public getOrderedImages(): readonly ProductImage[] {
    return [...this.images].sort((a, b) => a.order - b.order);
  }
}