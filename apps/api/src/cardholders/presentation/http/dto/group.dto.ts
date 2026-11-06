import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateGroupDto {
  @ApiProperty({ example: 'Famille Martin' })
  @IsString()
  @MaxLength(500)
  name!: string;

  @ApiPropertyOptional({ example: 10, default: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @IsInt()
  maxMembers?: number;
}

export class RenameGroupDto {
  @ApiProperty({ example: 'Famille Martin-Durand' })
  @IsString()
  @MaxLength(500)
  name!: string;
}

export class AddMemberDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  personId!: string;
}

export class ChangeGroupCapacityDto {
  @ApiProperty({ example: 4, minimum: 1, maximum: 50 })
  @IsInt()
  maxMembers!: number;
}
