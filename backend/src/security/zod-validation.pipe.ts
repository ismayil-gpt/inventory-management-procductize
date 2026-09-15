import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';

/**
 * Validates a request payload against a Zod schema (§4, DESC #20 — input
 * validation at every boundary). Errors follow the localised error envelope.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        messageEn: 'The submitted data is invalid.',
        messageAr: 'البيانات المُدخلة غير صالحة.',
        details: result.error.flatten().fieldErrors,
      });
    }
    return result.data;
  }
}
