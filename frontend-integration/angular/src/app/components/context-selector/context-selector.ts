/**
 * Context Selector Component
 *
 * A multi-step wizard for gathering user context for business location analysis.
 * Collects: analysis type, POI category, and radius.
 */

import {
  Component,
  Output,
  EventEmitter,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  SEMANTIC_CONFIG,
  AnalysisType,
  BusinessType,
  RadiusOption,
  DrivetimeOption,
  LocationOption,
} from '../../config/semantic-config';
import { UserContext } from '../../models/message.model';

// Re-export UserContext from message.model for backward compatibility
export { UserContext } from '../../models/message.model';

@Component({
  selector: 'app-context-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './context-selector.html',
  styleUrl: './context-selector.css',
})
export class ContextSelectorComponent implements OnChanges {
  @Input() collapsed = false;
  @Input() initialContext?: UserContext;
  @Output() contextSubmit = new EventEmitter<UserContext>();
  @Output() toggleCollapse = new EventEmitter<void>();

  // Step tracking
  currentStep = 1;

  get totalSteps(): number {
    return this.isDemographicAnalysis() ? 3 : 4;
  }

  // Configuration from semantic layer
  analysisTypes = SEMANTIC_CONFIG.analysisTypes;
  businessTypes = SEMANTIC_CONFIG.businessTypes;
  radiusOptions = SEMANTIC_CONFIG.radiusOptions;
  drivetimeOptions = SEMANTIC_CONFIG.drivetimeOptions;
  locationOptions = SEMANTIC_CONFIG.locationOptions;

  // User selections
  selectedAnalysisType: AnalysisType | null = null;
  selectedBusinessTypes: BusinessType[] = [];
  selectedRadius: RadiusOption | null = null;
  selectedDrivetime: DrivetimeOption | null = null;
  selectedLocation: LocationOption | null = null;
  customLocationText = '';

  constructor() {
    // Auto-select the only enabled analysis type
    const enabledType = this.analysisTypes.find(at => at.enabled);
    if (enabledType) {
      this.selectedAnalysisType = enabledType;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Initialize component with initialContext when provided (for editing)
    if (changes['initialContext']?.currentValue) {
      const context = changes['initialContext'].currentValue as UserContext;
      if (context) {
        this.initializeFromContext(context);
      }
    }
  }

  // Initialize component state from existing context
  private initializeFromContext(context: UserContext): void {
    // Set analysis type
    if (context.analysisType) {
      const analysisType = this.analysisTypes.find(at => at.id === context.analysisType);
      if (analysisType) {
        this.selectedAnalysisType = analysisType;
      }
    }

    // Set business types (POI categories) - support both single and array formats
    this.selectedBusinessTypes = [];
    if (context.businessTypes && Array.isArray(context.businessTypes) && context.businessTypes.length > 0) {
      // Array format (new)
      context.businessTypes.forEach(btId => {
        const businessType = this.businessTypes.find(bt => bt.id === btId);
        if (businessType) {
          this.selectedBusinessTypes.push(businessType);
        }
      });
    } else if (context.businessType) {
      // Single value format (backward compat)
      const businessType = this.businessTypes.find(bt => bt.id === context.businessType);
      if (businessType) {
        this.selectedBusinessTypes.push(businessType);
      }
    }

    // Set radius or drivetime
    if (context.selectedRadius !== undefined) {
      const radius = this.radiusOptions.find(ro => ro.value === context.selectedRadius);
      if (radius) {
        this.selectedRadius = radius;
      }
    }
    if (context.selectedDrivetime !== undefined) {
      const drivetime = this.drivetimeOptions.find(dto => dto.value === context.selectedDrivetime);
      if (drivetime) {
        this.selectedDrivetime = drivetime;
      }
    }

    // Set location
    if (context.selectedLocation) {
      const location = this.locationOptions.find(lo => lo.id === context.selectedLocation);
      if (location) {
        this.selectedLocation = location;
        // If it's a custom location, set the custom text
        if (location.id === 'custom' && context.customLocation) {
          this.customLocationText = context.customLocation;
        }
      }
    }

    // If all fields are set, go to the last step to show the complete form
    const isDemographic = this.isDemographicAnalysis();
    const hasStep2 = isDemographic 
      ? this.selectedDrivetime !== null 
      : this.selectedBusinessTypes.length > 0;
    const hasStep3 = isDemographic 
      ? this.selectedLocation !== null 
      : this.selectedRadius !== null;
    const hasStep4 = !isDemographic && this.selectedLocation !== null;
    
    if (this.selectedAnalysisType && hasStep2 && hasStep3 && (isDemographic || hasStep4)) {
      this.currentStep = this.totalSteps;
    }
  }

  // Step navigation
  nextStep(): void {
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
    }
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  goToStep(step: number): void {
    if (step >= 1 && step <= this.totalSteps) {
      this.currentStep = step;
    }
  }

  // Analysis type selection
  selectAnalysisType(at: AnalysisType): void {
    if (at.enabled) {
      const previousAnalysisType = this.selectedAnalysisType;
      this.selectedAnalysisType = at;
      
      // If analysis type changed, reset to step 1 and clear relevant selections
      if (previousAnalysisType?.id !== at.id) {
        this.currentStep = 1;
        // Clear POI selections if switching to demographic
        if (at.id === 'demographic_analysis') {
          this.selectedBusinessTypes = [];
        }
        // Clear drivetime if switching from demographic
        if (previousAnalysisType?.id === 'demographic_analysis') {
          this.selectedDrivetime = null;
        }
        // Clear radius if switching to demographic
        if (at.id === 'demographic_analysis') {
          this.selectedRadius = null;
        }
      }
    }
  }

  isAnalysisTypeSelected(at: AnalysisType): boolean {
    return this.selectedAnalysisType?.id === at.id;
  }

  // Business type (POI category) selection - multi-select
  toggleBusinessType(bt: BusinessType): void {
    const index = this.selectedBusinessTypes.findIndex(b => b.id === bt.id);
    if (index >= 0) {
      this.selectedBusinessTypes.splice(index, 1);
    } else {
      this.selectedBusinessTypes.push(bt);
    }
  }

  isBusinessTypeSelected(bt: BusinessType): boolean {
    return this.selectedBusinessTypes.some(b => b.id === bt.id);
  }

  selectAllBusinessTypes(): void {
    this.selectedBusinessTypes = [...this.businessTypes];
  }

  deselectAllBusinessTypes(): void {
    this.selectedBusinessTypes = [];
  }

  areAllBusinessTypesSelected(): boolean {
    return this.selectedBusinessTypes.length === this.businessTypes.length;
  }

  // Radius selection
  selectRadius(ro: RadiusOption): void {
    this.selectedRadius = ro;
  }

  isRadiusSelected(ro: RadiusOption): boolean {
    return this.selectedRadius?.id === ro.id;
  }

  // Drivetime selection
  selectDrivetime(dto: DrivetimeOption): void {
    this.selectedDrivetime = dto;
  }

  isDrivetimeSelected(dto: DrivetimeOption): boolean {
    return this.selectedDrivetime?.id === dto.id;
  }

  // Helper methods
  isDemographicAnalysis(): boolean {
    return this.selectedAnalysisType?.id === 'demographic_analysis';
  }

  // Location selection
  selectLocation(lo: LocationOption): void {
    this.selectedLocation = lo;
    // Clear custom text if not custom location
    if (lo.id !== 'custom') {
      this.customLocationText = '';
    }
  }

  isLocationSelected(lo: LocationOption): boolean {
    return this.selectedLocation?.id === lo.id;
  }

  // Validation
  canProceedFromStep(step: number): boolean {
    switch (step) {
      case 1:
        return this.selectedAnalysisType !== null;
      case 2:
        // Step 2: drivetime for demographic, POI categories for others
        if (this.isDemographicAnalysis()) {
          return this.selectedDrivetime !== null;
        }
        return this.selectedBusinessTypes.length > 0;
      case 3:
        // Step 3: location for demographic, radius for others
        if (this.isDemographicAnalysis()) {
          // For custom location, require text input
          if (this.selectedLocation?.id === 'custom') {
            return this.customLocationText.trim().length > 0;
          }
          return this.selectedLocation !== null;
        }
        return this.selectedRadius !== null;
      case 4:
        // Step 4: Only for non-demographic, location selection
        if (this.isDemographicAnalysis()) {
          return false; // Should never reach here for demographic
        }
        // For custom location, require text input
        if (this.selectedLocation?.id === 'custom') {
          return this.customLocationText.trim().length > 0;
        }
        return this.selectedLocation !== null;
      default:
        return false;
    }
  }

  // Submit context
  submitContext(): void {
    if (!this.selectedAnalysisType || !this.selectedLocation) {
      return;
    }

    const isDemographic = this.isDemographicAnalysis();
    
    // Validate step 2 - drivetime for demographic, POI categories for others
    if (isDemographic && !this.selectedDrivetime) {
      return;
    }
    if (!isDemographic && this.selectedBusinessTypes.length === 0) {
      return;
    }

    // Validate step 3 - location for demographic (already checked above), radius for others
    if (!isDemographic && !this.selectedRadius) {
      return;
    }

    const businessTypeIds = this.selectedBusinessTypes.map(bt => bt.id);
    const businessTypeNames = this.selectedBusinessTypes.map(bt => bt.name);

    const context: UserContext = {
      analysisType: this.selectedAnalysisType.id,
      analysisTypeName: this.selectedAnalysisType.name,
      country: 'United States',
      // Business types - optional for demographic analysis
      businessType: this.selectedBusinessTypes.length === 1 ? this.selectedBusinessTypes[0].id : undefined,
      businessTypeName: this.selectedBusinessTypes.length === 1 ? this.selectedBusinessTypes[0].name : undefined,
      businessTypes: businessTypeIds.length > 0 ? businessTypeIds : undefined,
      businessTypeNames: businessTypeNames.length > 0 ? businessTypeNames : undefined,
      // Radius or drivetime depending on analysis type
      selectedRadius: !isDemographic && this.selectedRadius ? this.selectedRadius.value : undefined,
      radiusUnit: !isDemographic && this.selectedRadius ? 'miles' : undefined,
      selectedDrivetime: isDemographic && this.selectedDrivetime ? this.selectedDrivetime.value : undefined,
      drivetimeUnit: isDemographic && this.selectedDrivetime ? 'minutes' : undefined,
      selectedLocation: this.selectedLocation.id,
      selectedLocationName: this.selectedLocation.id === 'custom'
        ? this.customLocationText
        : this.selectedLocation.name,
      customLocation: this.selectedLocation.id === 'custom'
        ? this.customLocationText
        : undefined,
      locationCoordinates: this.selectedLocation.coordinates,
    };

    this.contextSubmit.emit(context);
  }

  // Reset wizard
  reset(): void {
    this.currentStep = 1;
    this.selectedBusinessTypes = [];
    this.selectedRadius = null;
    this.selectedDrivetime = null;
    this.selectedLocation = null;
    this.customLocationText = '';
    // Re-select the only enabled analysis type
    const enabledType = this.analysisTypes.find(at => at.enabled);
    if (enabledType) {
      this.selectedAnalysisType = enabledType;
    } else {
      this.selectedAnalysisType = null;
    }
  }

  handleToggleCollapse(): void {
    this.toggleCollapse.emit();
  }

  getStepTitle(): string {
    switch (this.currentStep) {
      case 1:
        return 'Select Analysis Type';
      case 2:
        if (this.isDemographicAnalysis()) {
          return 'Select Drivetime';
        }
        return 'Select POI Category';
      case 3:
        if (this.isDemographicAnalysis()) {
          return 'Select Location';
        }
        return 'Select Radius';
      case 4:
        return 'Select Location';
      default:
        return '';
    }
  }

  getStepDescription(): string {
    switch (this.currentStep) {
      case 1:
        return 'What type of analysis do you want to perform?';
      case 2:
        if (this.isDemographicAnalysis()) {
          return 'How many minutes of driving time from your location should we analyze?';
        }
        return 'Which categories of points of interest are you looking for? (Select one or more)';
      case 3:
        if (this.isDemographicAnalysis()) {
          return 'Where should we focus the analysis?';
        }
        return 'How far from your location should we search?';
      case 4:
        return 'Where should we focus the analysis?';
      default:
        return '';
    }
  }
}
