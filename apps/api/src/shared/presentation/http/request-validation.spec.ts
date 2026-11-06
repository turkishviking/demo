import type { ArgumentMetadata } from '@nestjs/common';
import { IsInt, IsNotEmpty, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import {
  createValidationPipe,
  flattenValidationErrors,
  RequestValidationException,
} from './request-validation';

class AmountDto {
  @IsInt()
  @Min(1)
  amountMinor!: number;
}

class CreateThingDto {
  @IsNotEmpty()
  name!: string;

  @ValidateNested()
  @Type(() => AmountDto)
  amount!: AmountDto;
}

const metadata: ArgumentMetadata = { type: 'body', metatype: CreateThingDto };

describe('createValidationPipe', () => {
  const pipe = createValidationPipe();

  it('accepts and transforms a valid body', async () => {
    const result = await pipe.transform({ name: 'x', amount: { amountMinor: 10 } }, metadata);
    expect(result).toBeInstanceOf(CreateThingDto);
  });

  it('reports every invalid field with its nested path', async () => {
    const error = await pipe
      .transform({ name: '', amount: { amountMinor: 0 } }, metadata)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RequestValidationException);
    expect((error as RequestValidationException).issues).toEqual([
      { field: 'name', messages: ['name should not be empty'] },
      { field: 'amount.amountMinor', messages: ['amountMinor must not be less than 1'] },
    ]);
  });

  it('rejects unknown properties', async () => {
    const error = await pipe
      .transform({ name: 'x', amount: { amountMinor: 1 }, admin: true }, metadata)
      .catch((e: unknown) => e);
    expect((error as RequestValidationException).issues).toEqual([
      { field: 'admin', messages: ['property admin should not exist'] },
    ]);
  });
});

describe('flattenValidationErrors', () => {
  it('returns nothing for no errors', () => {
    expect(flattenValidationErrors([])).toEqual([]);
  });
});
