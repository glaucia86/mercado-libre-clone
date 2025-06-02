/**
 * Payment Method Entity - Financial Transaction Aggregate
 * 
 * Encapsulates payment processing business logic, fee calculations, and compliance rules.
 * Implements financial domain patterns ensuring transaction integrity and regulatory adherence.
 * 
 * @architectural_pattern Value Object, Strategy Pattern for payment processing
 * @business_rules Fee calculation, installment policies, fraud prevention
 * @compliance PCI DSS considerations, financial regulations, audit trails
 */

export type PaymentType = 
  | 'credit_card' 
  | 'debit_card' 
  | 'bank_transfer' 
  | 'pix' 
  | 'boleto' 
  | 'digital_wallet' 
  | 'cash_on_delivery'

export type PaymentProvider = 
  | 'mercado_pago' 
  | 'pag_seguro' 
  | 'paypal' 
  | 'stripe' 
  | 'cielo' 
  | 'rede'

export type CurrencyCode = 'BRL' | 'USD' | 'EUR' | 'ARS'

export interface InstallmentOption {
  readonly quantity: number
  readonly amount: number
  readonly totalAmount: number
  readonly interestRate: number
  readonly isInterestFree: boolean
  readonly recommendedByMerchant: boolean
}

export interface PaymentFees {
  readonly processingFee: number
  readonly platformFee: number
  readonly acquirerFee: number
  readonly totalFeePercentage: number
  readonly fixedFee: number
}

export interface PaymentLimits {
  readonly minimumAmount: number
  readonly maximumAmount: number
  readonly dailyLimit?: number
  readonly monthlyLimit?: number
}

export interface SecurityFeatures {
  readonly requires3DSecure: boolean
  readonly fraudDetection: boolean
  readonly tokenization: boolean
  readonly encryptionStandard: string
  readonly complianceLevel: 'PCI_DSS_LEVEL_1' | 'PCI_DSS_LEVEL_2' | 'PCI_DSS_LEVEL_3'
}

export interface PaymentProcessingTime {
  readonly authorizationTime: number // in seconds
  readonly settlementTime: number // in business days
  readonly refundTime: number // in business days
  readonly chargebackWindow: number // in days
}

/**
 * Payment Method Value Object
 * 
 * Immutable representation of payment methods with embedded business logic
 * for fee calculation, validation, and processing rules.
 */
export class PaymentMethod {
  private constructor(
    public readonly id: string,
    public readonly type: PaymentType,
    public readonly provider: PaymentProvider,
    public readonly name: string,
    public readonly displayName: string,
    public readonly description: string,
    public readonly logoUrl: string,
    public readonly currency: CurrencyCode,
    public readonly isActive: boolean,
    public readonly isInstallmentEnabled: boolean,
    public readonly maxInstallments: number,
    public readonly fees: PaymentFees,
    public readonly limits: PaymentLimits,
    public readonly security: SecurityFeatures,
    public readonly processingTime: PaymentProcessingTime,
    public readonly supportedCountries: readonly string[],
    public readonly acceptedCards: readonly string[], // For card payments
    public readonly metadata: Record<string, unknown>
  ) {
    this.validateBusinessRules()
  }

  /**
   * Factory method for creating PaymentMethod instances with validation
   * 
   * @rationale Ensures financial compliance and business rule adherence
   * @param paymentData Raw payment method configuration
   * @returns Validated PaymentMethod instance
   * @throws PaymentValidationError if compliance rules are violated
   */
  public static create(paymentData: {
    id: string
    type: PaymentType
    provider: PaymentProvider
    name: string
    displayName: string
    description: string
    logoUrl: string
    currency: CurrencyCode
    isActive: boolean
    isInstallmentEnabled: boolean
    maxInstallments: number
    fees: PaymentFees
    limits: PaymentLimits
    security: SecurityFeatures
    processingTime: PaymentProcessingTime
    supportedCountries: string[]
    acceptedCards: string[]
    metadata: Record<string, unknown>
  }): PaymentMethod {
    return new PaymentMethod(
      paymentData.id,
      paymentData.type,
      paymentData.provider,
      paymentData.name,
      paymentData.displayName,
      paymentData.description,
      paymentData.logoUrl,
      paymentData.currency,
      paymentData.isActive,
      paymentData.isInstallmentEnabled,
      paymentData.maxInstallments,
      paymentData.fees,
      paymentData.limits,
      paymentData.security,
      paymentData.processingTime,
      paymentData.supportedCountries,
      paymentData.acceptedCards,
      paymentData.metadata
    )
  }

  /**
   * Financial compliance and business rule validation
   * 
   * @rationale Enforces regulatory requirements and operational constraints
   * @throws PaymentValidationError for any compliance violation
   */
  private validateBusinessRules(): void {
    this.validateFees()
    this.validateLimits()
    this.validateInstallments()
    this.validateSecurity()
    this.validateProcessingTime()
  }

  private validateFees(): void {
    const { processingFee, platformFee, acquirerFee, totalFeePercentage, fixedFee } = this.fees

    if (processingFee < 0 || platformFee < 0 || acquirerFee < 0 || fixedFee < 0) {
      throw new Error('Payment fees cannot be negative')
    }

    if (totalFeePercentage > 15) { // Regulatory limit consideration
      throw new Error('Total fee percentage exceeds regulatory limits')
    }

    const calculatedTotal = processingFee + platformFee + acquirerFee
    if (Math.abs(calculatedTotal - totalFeePercentage) > 0.01) {
      throw new Error('Fee breakdown must match total fee percentage')
    }
  }

  private validateLimits(): void {
    const { minimumAmount, maximumAmount, dailyLimit, monthlyLimit } = this.limits

    if (minimumAmount < 0 || maximumAmount < 0) {
      throw new Error('Payment limits cannot be negative')
    }

    if (minimumAmount > maximumAmount) {
      throw new Error('Minimum amount cannot exceed maximum amount')
    }

    if (dailyLimit && dailyLimit < maximumAmount) {
      throw new Error('Daily limit cannot be less than maximum transaction amount')
    }

    if (monthlyLimit && dailyLimit && monthlyLimit < dailyLimit) {
      throw new Error('Monthly limit cannot be less than daily limit')
    }
  }

  private validateInstallments(): void {
    if (this.isInstallmentEnabled) {
      if (this.maxInstallments < 2 || this.maxInstallments > 24) {
        throw new Error('Installments must be between 2 and 24')
      }

      if (!this.supportsInstallments()) {
        throw new Error(`Payment type ${this.type} does not support installments`)
      }
    }
  }

  private validateSecurity(): void {
    const validCompliances = ['PCI_DSS_LEVEL_1', 'PCI_DSS_LEVEL_2', 'PCI_DSS_LEVEL_3']
    if (!validCompliances.includes(this.security.complianceLevel)) {
      throw new Error('Invalid PCI DSS compliance level')
    }

    if (this.isCardPayment() && !this.security.tokenization) {
      throw new Error('Card payments must support tokenization')
    }
  }

  private validateProcessingTime(): void {
    const { authorizationTime, settlementTime, refundTime, chargebackWindow } = this.processingTime

    if (authorizationTime < 0 || settlementTime < 0 || refundTime < 0 || chargebackWindow < 0) {
      throw new Error('Processing times cannot be negative')
    }

    if (authorizationTime > 30) { // 30 seconds max for authorization
      throw new Error('Authorization time exceeds acceptable limits')
    }
  }

  /**
   * Domain service methods - Financial operation encapsulation
   */

  /**
   * Calculates transaction fees for a given amount
   * 
   * @rationale Provides accurate fee calculation for financial transparency
   * @param amount Transaction amount
   * @returns Detailed fee breakdown
   */
  public calculateTransactionFees(amount: number): {
    processingFee: number
    platformFee: number
    acquirerFee: number
    fixedFee: number
    totalFees: number
    netAmount: number
  } {
    if (amount < this.limits.minimumAmount || amount > this.limits.maximumAmount) {
      throw new Error('Amount is outside payment method limits')
    }

    const percentageFees = amount * (this.fees.totalFeePercentage / 100)
    const totalFees = percentageFees + this.fees.fixedFee

    return {
      processingFee: amount * (this.fees.processingFee / 100),
      platformFee: amount * (this.fees.platformFee / 100),
      acquirerFee: amount * (this.fees.acquirerFee / 100),
      fixedFee: this.fees.fixedFee,
      totalFees,
      netAmount: amount - totalFees
    }
  }

  /**
   * Generates installment options for the payment amount
   * 
   * @rationale Calculates available installment plans based on business rules
   * @param amount Total amount to be financed
   * @returns Array of available installment options
   */
  public calculateInstallmentOptions(amount: number): InstallmentOption[] {
    if (!this.isInstallmentEnabled || amount < this.limits.minimumAmount) {
      return []
    }

    const options: InstallmentOption[] = []

    for (let quantity = 2; quantity <= this.maxInstallments; quantity++) {
      const interestRate = this.getInstallmentInterestRate(quantity)
      const isInterestFree = interestRate === 0
      
      const installmentAmount = isInterestFree 
        ? amount / quantity
        : this.calculateInstallmentWithInterest(amount, quantity, interestRate)

      const totalAmount = installmentAmount * quantity

      options.push({
        quantity,
        amount: Math.round(installmentAmount * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
        interestRate,
        isInterestFree,
        recommendedByMerchant: quantity <= 6 && isInterestFree
      })
    }

    return options.filter(option => option.amount >= 5) // Minimum installment value
  }

  /**
   * Determines if payment method supports given amount
   */
  public supportsAmount(amount: number): boolean {
    return amount >= this.limits.minimumAmount && 
           amount <= this.limits.maximumAmount &&
           this.isActive
  }

  /**
   * Validates if payment method is available in country
   */
  public isAvailableInCountry(countryCode: string): boolean {
    return this.supportedCountries.includes(countryCode)
  }

  /**
   * Checks if payment type supports installments
   */
  public supportsInstallments(): boolean {
    const installmentSupportedTypes: PaymentType[] = ['credit_card']
    return installmentSupportedTypes.includes(this.type)
  }

  /**
   * Determines if this is a card-based payment
   */
  public isCardPayment(): boolean {
    return this.type === 'credit_card' || this.type === 'debit_card'
  }

  /**
   * Determines if payment requires additional verification
   */
  public requiresAdditionalVerification(): boolean {
    return this.security.requires3DSecure || this.type === 'bank_transfer'
  }

  /**
   * Gets estimated processing time description
   */
  public getProcessingTimeDescription(): string {
    const { authorizationTime, settlementTime } = this.processingTime

    if (authorizationTime <= 5) {
      return settlementTime <= 1 ? 'Instant' : `${settlementTime} business day(s)`
    }

    return `${authorizationTime}s authorization, ${settlementTime} business day(s) settlement`
  }

  /**
   * Calculates risk score for fraud prevention
   */
  public getRiskScore(): number {
    let score = 0

    // Base risk by payment type
    const typeRisk = {
      'credit_card': 3,
      'debit_card': 2,
      'bank_transfer': 1,
      'pix': 1,
      'boleto': 1,
      'digital_wallet': 2,
      'cash_on_delivery': 4
    }

    score += typeRisk[this.type] || 0

    // Security features reduce risk
    if (this.security.requires3DSecure) score -= 1
    if (this.security.fraudDetection) score -= 1
    if (this.security.tokenization) score -= 1

    return Math.max(0, Math.min(10, score))
  }

  /**
   * Private helper methods
   */
  private getInstallmentInterestRate(quantity: number): number {
    // Business rule: first 6 installments are interest-free for credit cards
    if (this.type === 'credit_card' && quantity <= 6) {
      return 0
    }

    // Progressive interest rate for longer terms
    if (quantity <= 12) return 2.5
    if (quantity <= 18) return 3.5
    return 4.5
  }

  private calculateInstallmentWithInterest(
    amount: number, 
    quantity: number, 
    monthlyRate: number
  ): number {
    const rate = monthlyRate / 100
    const factor = Math.pow(1 + rate, quantity)
    return (amount * rate * factor) / (factor - 1)
  }

  /**
   * Formatting utilities for display
   */
  public getDisplayIcon(): string {
    const icons = {
      'credit_card': '💳',
      'debit_card': '💳',
      'bank_transfer': '🏦',
      'pix': '⚡',
      'boleto': '📄',
      'digital_wallet': '📱',
      'cash_on_delivery': '💰'
    }

    return icons[this.type] || '💳'
  }

  public getSecurityBadges(): string[] {
    const badges: string[] = []

    if (this.security.requires3DSecure) badges.push('3D Secure')
    if (this.security.fraudDetection) badges.push('Fraud Protection')
    if (this.security.tokenization) badges.push('Tokenized')
    if (this.security.complianceLevel === 'PCI_DSS_LEVEL_1') badges.push('PCI Level 1')

    return badges
  }
}