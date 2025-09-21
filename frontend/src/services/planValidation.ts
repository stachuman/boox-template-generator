import { Plan, PlanSection, Master, GenerateMode } from '@/types';

export interface ValidationError {
  section: string;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  estimatedPages: number;
}

export class PlanValidationService {
  /**
   * Validate a complete plan configuration
   */
  validatePlan(plan: Plan, masters: Master[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    let estimatedPages = 0;

    // Validate calendar configuration
    const calendarErrors = this.validateCalendar(plan.calendar);
    errors.push(...calendarErrors);

    // Validate sections
    plan.sections.forEach((section, index) => {
      const sectionErrors = this.validateSection(section, index, masters, plan.calendar);
      errors.push(...sectionErrors.errors);
      warnings.push(...sectionErrors.warnings);
      estimatedPages += sectionErrors.estimatedPages;
    });

    // Validate section ordering
    const orderErrors = this.validateSectionOrder(plan.sections, plan.order);
    errors.push(...orderErrors);

    // Check for duplicate section kinds
    const duplicateErrors = this.validateUniqueKinds(plan.sections);
    errors.push(...duplicateErrors);

    // Performance warnings
    if (estimatedPages > 1000) {
      warnings.push({
        section: 'plan',
        field: 'size',
        message: `Plan will generate approximately ${estimatedPages} pages. Consider reducing scope for better performance.`,
        severity: 'warning'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      estimatedPages
    };
  }

  private validateCalendar(calendar: any): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!calendar.start_date) {
      errors.push({
        section: 'calendar',
        field: 'start_date',
        message: 'Start date is required',
        severity: 'error'
      });
    }

    if (!calendar.end_date) {
      errors.push({
        section: 'calendar',
        field: 'end_date',
        message: 'End date is required',
        severity: 'error'
      });
    }

    if (calendar.start_date && calendar.end_date) {
      const startDate = new Date(calendar.start_date);
      const endDate = new Date(calendar.end_date);

      if (startDate >= endDate) {
        errors.push({
          section: 'calendar',
          field: 'date_range',
          message: 'End date must be after start date',
          severity: 'error'
        });
      }

      // Check for unreasonably long date ranges
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 365 * 2) {
        errors.push({
          section: 'calendar',
          field: 'date_range',
          message: 'Date range exceeds 2 years. Consider smaller ranges for better performance.',
          severity: 'warning'
        });
      }
    }

    if (!calendar.pages_per_day || calendar.pages_per_day < 1) {
      errors.push({
        section: 'calendar',
        field: 'pages_per_day',
        message: 'Pages per day must be at least 1',
        severity: 'error'
      });
    }

    if (calendar.pages_per_day > 10) {
      errors.push({
        section: 'calendar',
        field: 'pages_per_day',
        message: 'More than 10 pages per day may impact performance',
        severity: 'warning'
      });
    }

    return errors;
  }

  private validateSection(
    section: PlanSection,
    index: number,
    masters: Master[],
    calendar: any
  ): { errors: ValidationError[]; warnings: ValidationError[]; estimatedPages: number } {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    let estimatedPages = 0;

    const sectionId = `${index}`;

    // Validate required fields
    if (!section.kind?.trim()) {
      errors.push({
        section: sectionId,
        field: 'kind',
        message: 'Section kind is required',
        severity: 'error'
      });
    }

    if (!section.master) {
      errors.push({
        section: sectionId,
        field: 'master',
        message: 'Master template is required',
        severity: 'error'
      });
    } else {
      // Validate master exists
      const masterExists = masters.some(m => m.name === section.master);
      if (!masterExists) {
        errors.push({
          section: sectionId,
          field: 'master',
          message: `Master '${section.master}' does not exist`,
          severity: 'error'
        });
      }
    }

    // Validate generation mode specific requirements
    switch (section.generate) {
      case GenerateMode.COUNT:
        if (!section.count || section.count < 1) {
          errors.push({
            section: sectionId,
            field: 'count',
            message: 'Count must be at least 1',
            severity: 'error'
          });
        } else {
          estimatedPages = section.count;
          if (section.count > 100) {
            warnings.push({
              section: sectionId,
              field: 'count',
              message: `High count (${section.count}) may impact performance`,
              severity: 'warning'
            });
          }
        }
        break;

      case GenerateMode.EACH_DAY:
      case GenerateMode.EACH_MONTH:
        if (!section.start_date || !section.end_date) {
          errors.push({
            section: sectionId,
            field: 'dates',
            message: 'Start and end dates are required',
            severity: 'error'
          });
        } else {
          const startDate = new Date(section.start_date);
          const endDate = new Date(section.end_date);

          if (startDate >= endDate) {
            errors.push({
              section: sectionId,
              field: 'dates',
              message: 'End date must be after start date',
              severity: 'error'
            });
          } else {
            // Estimate pages based on generation mode
            if (section.generate === GenerateMode.EACH_DAY) {
              const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
              estimatedPages = daysDiff * (calendar.pages_per_day || 1);
            } else if (section.generate === GenerateMode.EACH_MONTH) {
              const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
                               (endDate.getMonth() - startDate.getMonth()) + 1;
              estimatedPages = monthsDiff;
            }
          }
        }
        break;

      case GenerateMode.ONCE:
        estimatedPages = 1;
        break;
    }

    // Validate context variables
    if (section.context) {
      Object.entries(section.context).forEach(([key, value]) => {
        if (!key.trim()) {
          warnings.push({
            section: sectionId,
            field: 'context',
            message: 'Empty context variable key',
            severity: 'warning'
          });
        }

        if (typeof value === 'string' && !value.trim()) {
          warnings.push({
            section: sectionId,
            field: 'context',
            message: `Context variable '${key}' has empty value`,
            severity: 'warning'
          });
        }
      });
    }

    return { errors, warnings, estimatedPages };
  }

  private validateSectionOrder(sections: PlanSection[], order: string[]): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check if all section kinds are in order
    const sectionKinds = new Set(sections.map(s => s.kind).filter(k => k.trim()));
    const orderKinds = new Set(order.filter(k => k.trim()));

    const missingFromOrder = Array.from(sectionKinds).filter(kind => !orderKinds.has(kind));
    const extraInOrder = Array.from(orderKinds).filter(kind => !sectionKinds.has(kind));

    if (missingFromOrder.length > 0) {
      errors.push({
        section: 'order',
        field: 'missing_sections',
        message: `Sections not in order: ${missingFromOrder.join(', ')}`,
        severity: 'error'
      });
    }

    if (extraInOrder.length > 0) {
      errors.push({
        section: 'order',
        field: 'extra_sections',
        message: `Order contains non-existent sections: ${extraInOrder.join(', ')}`,
        severity: 'error'
      });
    }

    return errors;
  }

  private validateUniqueKinds(sections: PlanSection[]): ValidationError[] {
    const errors: ValidationError[] = [];
    const kindCounts = new Map<string, number>();

    sections.forEach((section, index) => {
      if (section.kind?.trim()) {
        const kind = section.kind.trim();
        const count = kindCounts.get(kind) || 0;
        kindCounts.set(kind, count + 1);

        if (count > 0) {
          errors.push({
            section: `${index}`,
            field: 'kind',
            message: `Duplicate section kind '${kind}'. Each section must have a unique kind.`,
            severity: 'error'
          });
        }
      }
    });

    return errors;
  }

  /**
   * Validate binding patterns in widget properties
   */
  validateBindingPattern(pattern: string, availableVariables: string[] = []): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!pattern.trim()) {
      return errors;
    }

    // Check for function-like patterns: func(arg)
    const funcPattern = /^(\w+)\(([^)]+)\)$/;
    const funcMatch = pattern.match(funcPattern);

    if (funcMatch) {
      const [, funcName, arg] = funcMatch;

      // Validate known function names
      const validFunctions = ['notes', 'day', 'month', 'year'];
      if (!validFunctions.includes(funcName)) {
        errors.push({
          section: 'binding',
          field: 'pattern',
          message: `Unknown binding function '${funcName}'. Valid functions: ${validFunctions.join(', ')}`,
          severity: 'error'
        });
      }

      // Validate argument format
      if (arg.startsWith('@')) {
        const varName = arg.substring(1);
        if (!availableVariables.includes(varName)) {
          errors.push({
            section: 'binding',
            field: 'pattern',
            message: `Variable '@${varName}' not available in current context`,
            severity: 'warning'
          });
        }
      }
    } else {
      // Check for direct destination patterns
      const destPattern = /^[a-zA-Z0-9_:.{}-]+$/;
      if (!destPattern.test(pattern)) {
        errors.push({
          section: 'binding',
          field: 'pattern',
          message: 'Invalid destination pattern format',
          severity: 'error'
        });
      }
    }

    return errors;
  }
}

export const planValidationService = new PlanValidationService();