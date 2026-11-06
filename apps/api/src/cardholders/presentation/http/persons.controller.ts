import { Body, Controller, HttpCode, HttpStatus, Inject, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CreatedDto } from '@cardsim/shared';
import { COMMAND_BUS, type CommandBus } from '../../../shared/application/command-bus';
import { uuidParam } from '../../../shared/presentation/http/uuid-param.pipe';
import {
  DeactivatePersonCommand,
  RegisterPersonCommand,
  RenamePersonCommand,
} from '../../application/commands/person.commands';
import { CreatedResponseDto, RegisterPersonDto, RenamePersonDto } from './dto/person.dto';

/** Commandes sur les personnes. Les lectures (`GET /persons`) sont servies par Reporting. */
@ApiTags('persons')
@Controller('persons')
export class PersonsController {
  constructor(@Inject(COMMAND_BUS) private readonly commands: CommandBus) {}

  @Post()
  @ApiOperation({ summary: 'Enregistrer une personne (US-CH-1)' })
  @ApiCreatedResponse({ type: CreatedResponseDto })
  register(@Body() dto: RegisterPersonDto): Promise<CreatedDto> {
    return this.commands.execute(new RegisterPersonCommand(dto.firstName, dto.lastName, dto.email));
  }

  @Post(':id/rename')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Renommer une personne' })
  @ApiNoContentResponse()
  async rename(@Param('id', uuidParam()) id: string, @Body() dto: RenamePersonDto): Promise<void> {
    await this.commands.execute(new RenamePersonCommand(id, dto.firstName, dto.lastName));
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Désactiver une personne (US-CH-2)' })
  @ApiNoContentResponse()
  async deactivate(@Param('id', uuidParam()) id: string): Promise<void> {
    await this.commands.execute(new DeactivatePersonCommand(id));
  }
}
