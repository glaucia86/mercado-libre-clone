/**
 * Seller Entity - Merchant Aggregate Root
 * 
 * Encapsulates merchant business logic, reputation management, and operational constraints.
 * Implements aggregate boundaries to maintain consistency in seller-related operations.
 * 
 * @architectural_pattern Aggregate Root, Value Object composition
 * @business_rules Reputation calculation, shipping policies, performance metrics
 * @domain_invariants Active status validation, rating constraints, policy consistency
 */

export interface SellerAddress {
  readonly street: string;
  readonly number: string;
  readonly complement?: string;
  readonly neighborhood: string;
  readonly city: string;
  readonly state: string;
  readonly zipCode: string;
  readonly country: string;
}

export interface SellerRating {
  readonly average: number;
  readonly count: number;
  readonly positivePercentage: number;
  readonly neutralPercentage: number;
  readonly negativePercentage: number;
  readonly lastTwelveMonths: number;
}

export interface SellerMetrics {
  readonly totalSales: number;
  readonly totalProducts: number;
  readonly averageResponseTime: number; // in hours
  readonly onTimeDeliveryRate: number; // percentage
  readonly customerSatisfactionRate: number; // percentage
  readonly disputeResolutionRate: number
}

export interface ShippingPolicy {
  readonly hasFreeShipping: boolean;
  readonly freeShippingMinimum: number;
  readonly averageProcessingTime: number;
  readonly shippingMethods: readonly string[];
  readonly domesticShipping: boolean;
  readonly internationalShipping: boolean;
}

export interface SellerCertification {
  readonly type: 'verified' | 'premium' | 'top_seller' | 'mercado_lider'
  readonly issuedAt: Date
  readonly validUntil?: Date
  readonly description: string
}

export interface BusinessInfo {
  readonly companyName?: string;
  readonly taxId?: string;
  readonly businessType: 'individual' | 'small_business' | 'corporation';
  readonly establishedYear?: number;
  readonly employees?: number;
}

/**
 * Seller Aggregate Root
 * 
 * Manages seller identity, reputation, policies, and business operations
 * while maintaining transactional consistency across all seller-related data.
 */

export class Seller {
  private constructor(
    public readonly id: string,
    public readonly username: string,
    public readonly displayName: string,
    public readonly email: string,
    public readonly profileImage: string | undefined,
    public readonly address: SellerAddress,
    public readonly rating: SellerRating,
    public readonly metrics: SellerMetrics,
    public readonly shippingPolicy: ShippingPolicy,
    public readonly certifications: readonly SellerCertification[],
    public readonly businessInfo: BusinessInfo,
    public readonly joinedAt: Date,
    public readonly lastActiveAt: Date,
    public readonly isActive: boolean = true,
    public readonly isVerified: boolean = true,
    public readonly description?: string
  ) {
    this.validateBusinessRules();
  }

  /**
   * Factory method for creating Seller instances with comprehensive validation
   * 
   * @rationale Ensures all business invariants are satisfied during construction
   * @param sellerData Raw seller data from external sources
   * @returns Validated Seller instance
   * @throws SellerValidationError if business rules are violated
   */

  public static create(sellerData: {
    id: string,
    username: string,
    displayName: string,
    email: string,
    profileImage?: string,
    address: SellerAddress,
    rating: SellerRating,
    metrics: SellerMetrics,
    shippingPolicy: ShippingPolicy,
    certifications: readonly SellerCertification[],
    businessInfo: BusinessInfo,
    joinedAt: Date,
    lastActiveAt: Date,
    isActive?: boolean,
    isVerified?: boolean,
    description?: string
  
  }): Seller {
    return new Seller(
      sellerData.id,
      sellerData.username,
      sellerData.displayName,
      sellerData.email,
      sellerData.profileImage,
      sellerData.address,
      sellerData.rating,
      sellerData.metrics,
      sellerData.shippingPolicy,
      sellerData.certifications,
      sellerData.businessInfo,
      sellerData.joinedAt,
      sellerData.lastActiveAt,
      sellerData.isActive,
      sellerData.isVerified,
      sellerData.description
    )
  }

  /**
   * Domain invariant validation - Business rule enforcement
   * 
   * @rationale Centralizes validation logic to ensure data consistency
   * @throws SellerValidationError for any invariant violation
   */

  private validateBusinessRules(): void {
    this.validateIdentity();
    this.validateRating();
    this.validateMetrics();
    this.validateShippingPolicy();
    this.validateCertifications();
    this.validateBusinessInfo();
  }

  private validateIdentity(): void {
    if (!this.username || this.username.trim().length < 3) {
      throw new Error('Seller username must be at least 3 characters long');
    }

    if (!this.email || !this.isValidEmail(this.email)) {
      throw new Error('Seller must have a valid email address');
    }

    if (!this.email || this.displayName.trim().length < 2) {
      throw new Error('Seller display name must be at least 2 characters long');
    }
  }

  private validateRating(): void {
    const { average, count, positivePercentage, neutralPercentage, negativePercentage } = this.rating;

    if (average < 0 || average > 5) {
      throw new Error('Seller rating average must be between 0 and 5');
    }

    if (count < 0) {
      throw new Error('Rating count cannot be negative');
    }

    const totalPercentage = positivePercentage + neutralPercentage + negativePercentage;
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new Error('Rating percentages must sum to 100%');
    }
  }

  private validateMetrics(): void {
    const metrics = this.metrics;

    if (metrics.totalSales < 0 || metrics.totalProducts < 0) {
      throw new Error('Sales and product counts cannot be negative');
    }

    if (metrics.averageResponseTime < 0) {
      throw new Error('Average response time cannot be negative');
    }

    if (metrics.onTimeDeliveryRate < 0 || metrics.onTimeDeliveryRate > 100) {
      throw new Error('On-time delivery rate must be between 0 and 100');
    }

    if (metrics.customerSatisfactionRate < 0 || metrics.customerSatisfactionRate > 100) {
      throw new Error('Customer satisfaction rate must be between 0 and 100');
    }
  }

  private validateShippingPolicy(): void {
    const policy = this.shippingPolicy;

    if (policy.freeShippingMinimum < 0) {
      throw new Error('Free shipping minimum cannot be negative');
    }

    if (policy.averageProcessingTime < 0) {
      throw new Error('Average processing time cannot be negative');
    }

    if (policy.shippingMethods.length === 0) {
      throw new Error('Seller must offer at least one shipping method');
    }
  }

  private validateCertifications(): void {
    const now = new Date();

    for (const cert of this.certifications) {
      if (cert.validUntil && cert.validUntil < now) {
        throw new Error(`Certification ${cert.type} has expired`);
      }

      if (cert.issuedAt > now) {
        throw new Error(`Certification ${cert.type} cannot be issued in the future`);
      }
    }  
  }

   private validateBusinessInfo(): void {
    const validBusinessTypes = ['individual', 'small_business', 'corporation']
    if (!validBusinessTypes.includes(this.businessInfo.businessType)) {
      throw new Error('Invalid business type');
    }

    if (this.businessInfo.establishedYear && this.businessInfo.establishedYear > new Date().getFullYear()) {
      throw new Error('Establishment year cannot be in the future');
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Domain service methods - Business operation encapsulation
  */

  /**
   * Calculates seller reputation score based on multiple factors
   * 
   * @rationale Provides a comprehensive reputation assessment for business decisions
   * @returns Normalized reputation score (0-100)
   */
  public getReputationScore(): number {
    const ratingWeight = 0.4;
    const metricsWeight = 0.4;
    const certificationWeight = 0.2;

    const ratingScore = (this.rating.average / 5) * 100;
    const metricsScore = (
      this.metrics.onTimeDeliveryRate + 
      this.metrics.customerSatisfactionRate + 
      this.metrics.disputeResolutionRate
    ) / 3;

    const certificationScore = this.getActiveCertifications().length * 25;

    return Math.min(100,
      ratingScore * ratingWeight + 
      metricsScore * metricsWeight + 
      certificationScore * certificationWeight
    );
  }

  /**
   * Determines if seller qualifies for premium features
   * 
   * @rationale Encapsulates business logic for premium feature access
   * @returns Boolean indicating premium eligibility
   */
  public isPremiumEligible(): boolean {
    return this.isVerified &&
      this.rating.average >= 4.5 &&
      this.metrics.customerSatisfactionRate >= 95 &&
      this.metrics.onTimeDeliveryRate > 90 &&
      this.getActiveCertifications().length > 0;
  }

  /**
   * Calculates response time tier for customer expectations
   * 
   * @rationale Provides standardized response time categorization
   * @returns Response tier classification
   */
  public getResponseTimeTier(): 'excellent' | 'good' | 'average' | 'slow' {
    const hours = this.metrics.averageResponseTime;

    if (hours <= 1) return 'excellent';
    if (hours <= 4) return 'good';
    if (hours <= 24) return 'average';
    return 'slow';
  }

  /**
  * Retrieves active certifications only
  */
  public getActiveCertifications(): SellerCertification[] {
    const now  = new Date();
    return this.certifications.filter(cert => !cert.validUntil || cert.validUntil > now);
  }

  /**
   * Determines if seller has free shipping capability
   */
  public get hasFreeShipping(): boolean {
    return this.shippingPolicy.hasFreeShipping;
  }

  /**
   * Gets minimum amount for free shipping
   */
  public get freeShippingMinimum(): number {
    return this.shippingPolicy.freeShippingMinimum;
  }

  /**
   * Formats seller location for display
   */
  public getLocationDisplay(): string {
    const { city, state } = this.address;
    return `${city}, ${state}`; 
  }

  /**
   * Calculates seller experience in years
   * 
   */
  public getExperienceYears(): number {
    const now = new Date();
    const years = (now.getTime() - this.joinedAt.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    return Math.floor(years);
  }

  /**
   * Determines if seller is currently active based on last activity
   */
  public isCurrentllyActive(): boolean {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return this.isActive && this.lastActiveAt > thirtyDaysAgo;
  }

  /**
   * Gets seller reliability indicator
   */
  public getRealiabilityIndicator(): 'high' | 'medium' | 'low' {
    const score = this.getReputationScore();

    if (score >= 85) return 'high';
    if (score >= 70) return 'medium';
    return 'low';
  }
}

  