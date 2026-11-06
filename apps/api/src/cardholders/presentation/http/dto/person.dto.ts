import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

// Les DTO valident la forme ; les règles métier (longueurs, format d'email) sont dans le domaine.
export class RegisterPersonDto {
  @ApiProperty({ example: 'Ada' })
  @IsString()
  @MaxLength(500)
  firstName!: string;

  @ApiProperty({ example: 'Lovelace' })
  @IsString()
  @MaxLength(500)
  lastName!: string;

  @ApiProperty({ example: 'ada@example.com' })
  @IsString()
  @MaxLength(500)
  email!: string;
}

export class RenamePersonDto {
  @ApiProperty({ example: 'Ada' })
  @IsString()
  @MaxLength(500)
  firstName!: string;

  @ApiProperty({ example: 'King' })
  @IsString()
  @MaxLength(500)
  lastName!: string;
}

export class CreatedResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
}
