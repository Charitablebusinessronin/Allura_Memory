/**
 * HACCP Configuration - Configurable Thresholds for Food Safety
 * Story 6.2: Faith Meats Operations
 * 
 * USDA/FDA HACCP-compliant thresholds with per-product configurability.
 * Supports raw beef, raw poultry, cooked products, and frozen storage.
 */

/**
 * HACCP check types
 */
export type HACCPCheckType = 'temperature' | 'sanitation' | 'cross_contamination';

/**
 * Units for measurements
 */
export type HACCPUnit = 'celsius' | 'fahrenheit' | 'ppm' | 'meter';

/**
 * Product categories for HACCP thresholds
 */
export type ProductCategory = 
  | 'raw_beef'
  | 'raw_poultry'
  | 'raw_pork'
  | 'cooked_beef'
  | 'cooked_poultry'
  | 'processed'
  | 'frozen';

/**
 * HACCP threshold configuration
 * Defines acceptable ranges for each check type and product category
 */
export interface HACCPThreshold {
  checkType: HACCPCheckType;
  productCategory: ProductCategory;
  minValue?: number;
  maxValue?: number;
  unit: HACCPUnit;
  description: string;
}

/**
 * Default HACCP thresholds based on USDA/FDA regulations
 * 
 * Temperature thresholds:
 * - Raw beef: 0-4°C (32-40°F) refrigerated
 * - Raw poultry: 0-4°C (32-40°F) refrigerated
 * - Cooked beef: maintain above 63°C (145°F) hot holding
 * - Cooked poultry: maintain above 74°C (165°F) hot holding
 * - Frozen: -18°C (0°F) or below
 * 
 * Sanitation thresholds:
 * - Chlorine: 50-200 ppm for sanitizing
 * - Quaternary ammonia: 200-400 ppm
 * - Hot water sanitizing: 77°C (171°F) minimum
 * 
 * Cross-contamination thresholds:
 * - Minimum distance between raw and cooked: 1 meter
 * - Separate cutting boards required
 * - Dedicated equipment for raw vs cooked
 */
export const DEFAULT_HACCP_THRESHOLDS: HACCPThreshold[] = [
  // Temperature - Raw Beef (refrigerated)
  {
    checkType: 'temperature',
    productCategory: 'raw_beef',
    minValue: 0,
    maxValue: 4,
    unit: 'celsius',
    description: 'Raw beef must be stored at 0-4°C (32-40°F) per USDA guidelines'
  },
  
  // Temperature - Raw Poultry (refrigerated)
  {
    checkType: 'temperature',
    productCategory: 'raw_poultry',
    minValue: 0,
    maxValue: 4,
    unit: 'celsius',
    description: 'Raw poultry must be stored at 0-4°C (32-40°F) per USDA guidelines'
  },
  
  // Temperature - Raw Pork (refrigerated)
  {
    checkType: 'temperature',
    productCategory: 'raw_pork',
    minValue: 0,
    maxValue: 4,
    unit: 'celsius',
    description: 'Raw pork must be stored at 0-4°C (32-40°F) per USDA guidelines'
  },
  
  // Temperature - Cooked Beef (hot holding)
  {
    checkType: 'temperature',
    productCategory: 'cooked_beef',
    minValue: 63,
    maxValue: 74,
    unit: 'celsius',
    description: 'Cooked beef hot holding: 63°C (145°F) minimum per FDA Food Code'
  },
  
  // Temperature - Cooked Poultry (hot holding)
  {
    checkType: 'temperature',
    productCategory: 'cooked_poultry',
    minValue: 74,
    maxValue: 85,
    unit: 'celsius',
    description: 'Cooked poultry hot holding: 74°C (165°F) minimum per FDA Food Code'
  },
  
  // Temperature - Processed meats
  {
    checkType: 'temperature',
    productCategory: 'processed',
    minValue: 0,
    maxValue: 4,
    unit: 'celsius',
    description: 'Processed meats must be stored at 0-4°C (32-40°F)'
  },
  
  // Temperature - Frozen products
  {
    checkType: 'temperature',
    productCategory: 'frozen',
    maxValue: -18,
    unit: 'celsius',
    description: 'Frozen products must be stored at -18°C (0°F) or below'
  },
  
  // Sanitation - Chlorine concentration
  {
    checkType: 'sanitation',
    productCategory: 'raw_beef',
    minValue: 50,
    maxValue: 200,
    unit: 'ppm',
    description: 'Chlorine sanitizer concentration: 50-200 ppm per FDA guidelines'
  },
  
  // Sanitation - Chlorine for poultry
  {
    checkType: 'sanitation',
    productCategory: 'raw_poultry',
    minValue: 50,
    maxValue: 200,
    unit: 'ppm',
    description: 'Chlorine sanitizer for poultry processing: 50-200 ppm'
  },
  
  // Sanitation - Quaternary ammonia
  {
    checkType: 'sanitation',
    productCategory: 'processed',
    minValue: 200,
    maxValue: 400,
    unit: 'ppm',
    description: 'Quaternary ammonia: 200-400 ppm for food contact surfaces'
  },
  
  // Cross-contamination - Raw vs Cooked distance
  {
    checkType: 'cross_contamination',
    productCategory: 'raw_beef',
    minValue: 1,
    unit: 'meter',
    description: 'Minimum 1 meter separation between raw and cooked products'
  },
  
  // Cross-contamination - Poultry separation
  {
    checkType: 'cross_contamination',
    productCategory: 'raw_poultry',
    minValue: 1,
    unit: 'meter',
    description: 'Minimum 1 meter separation - poultry requires extra care due to salmonella risk'
  },
];

/**
 * Temperature conversion utilities
 */
export const TemperatureConverter = {
  celsiusToFahrenheit(celsius: number): number {
    return (celsius * 9/5) + 32;
  },
  
  fahrenheitToCelsius(fahrenheit: number): number {
    return (fahrenheit - 32) * 5/9;
  },
};

/**
 * Find threshold for a specific check type and product category
 * 
 * @param checkType - Type of HACCP check
 * @param productCategory - Product category being checked
 * @returns Matching threshold or undefined if not found
 */
export function findThreshold(
  checkType: HACCPCheckType,
  productCategory: ProductCategory
): HACCPThreshold | undefined {
  return DEFAULT_HACCP_THRESHOLDS.find(
    t => t.checkType === checkType && t.productCategory === productCategory
  );
}

/**
 * Validate a HACCP measurement against its threshold
 * 
 * @param value - Measured value
 * @param unit - Unit of measurement
 * @param threshold - HACCP threshold to validate against
 * @returns true if value is within acceptable range
 */
export function validateHACCPValue(
  value: number,
  unit: HACCPUnit,
  threshold: HACCPThreshold
): { valid: boolean; violation?: string } {
  // Unit mismatch check
  if (unit !== threshold.unit) {
    // Handle temperature conversions
    if (
      (unit === 'celsius' && threshold.unit === 'fahrenheit') ||
      (unit === 'fahrenheit' && threshold.unit === 'celsius')
    ) {
      const convertedValue = unit === 'celsius'
        ? TemperatureConverter.celsiusToFahrenheit(value)
        : TemperatureConverter.fahrenheitToCelsius(value);
      
      const convertedThreshold = { ...threshold };
      if (threshold.unit === 'celsius') {
        convertedThreshold.minValue = threshold.minValue 
          ? TemperatureConverter.celsiusToFahrenheit(threshold.minValue)
          : undefined;
        convertedThreshold.maxValue = threshold.maxValue
          ? TemperatureConverter.celsiusToFahrenheit(threshold.maxValue)
          : undefined;
        convertedThreshold.unit = 'fahrenheit';
      } else {
        convertedThreshold.minValue = threshold.minValue
          ? TemperatureConverter.fahrenheitToCelsius(threshold.minValue)
          : undefined;
        convertedThreshold.maxValue = threshold.maxValue
          ? TemperatureConverter.fahrenheitToCelsius(threshold.maxValue)
          : undefined;
        convertedThreshold.unit = 'celsius';
      }
      
      return validateHACCPValue(convertedValue, convertedThreshold.unit, convertedThreshold);
    }
    
    return {
      valid: false,
      violation: `Unit mismatch: measured in ${unit} but threshold is in ${threshold.unit}`
    };
  }
  
  // Check minimum value
  if (threshold.minValue !== undefined && value < threshold.minValue) {
    return {
      valid: false,
      violation: `Value ${value} ${unit} below minimum ${threshold.minValue} ${unit}`
    };
  }
  
  // Check maximum value
  if (threshold.maxValue !== undefined && value > threshold.maxValue) {
    return {
      valid: false,
      violation: `Value ${value} ${unit} above maximum ${threshold.maxValue} ${unit}`
    };
  }
  
  return { valid: true };
}

/**
 * Get all thresholds for a product category
 * Useful for displaying compliance requirements
 * 
 * @param productCategory - Product category to get thresholds for
 * @returns Array of applicable thresholds
 */
export function getThresholdsForProductCategory(
  productCategory: ProductCategory
): HACCPThreshold[] {
  return DEFAULT_HACCP_THRESHOLDS.filter(
    t => t.productCategory === productCategory
  );
}

/**
 * Get all thresholds for a check type
 * Useful for displaying compliance across all products
 * 
 * @param checkType - Check type to get thresholds for
 * @returns Array of applicable thresholds
 */
export function getThresholdsForCheckType(
  checkType: HACCPCheckType
): HACCPThreshold[] {
  return DEFAULT_HACCP_THRESHOLDS.filter(
    t => t.checkType === checkType
  );
}