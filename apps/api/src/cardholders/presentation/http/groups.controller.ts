import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CreatedDto } from '@cardsim/shared';
import { COMMAND_BUS, type CommandBus } from '../../../shared/application/command-bus';
import { uuidParam } from '../../../shared/presentation/http/uuid-param.pipe';
import {
  AddMemberCommand,
  ArchiveGroupCommand,
  ChangeGroupCapacityCommand,
  CreateGroupCommand,
  RemoveMemberCommand,
  RenameGroupCommand,
} from '../../application/commands/group.commands';
import {
  AddMemberDto,
  ChangeGroupCapacityDto,
  CreateGroupDto,
  RenameGroupDto,
} from './dto/group.dto';
import { CreatedResponseDto } from './dto/person.dto';

/** Commandes sur les groupes (US-CH-3). Les lectures (`GET /groups`) sont servies par Reporting. */
@ApiTags('groups')
@Controller('groups')
export class GroupsController {
  constructor(@Inject(COMMAND_BUS) private readonly commands: CommandBus) {}

  @Post()
  @ApiOperation({ summary: 'Créer un groupe' })
  @ApiCreatedResponse({ type: CreatedResponseDto })
  create(@Body() dto: CreateGroupDto): Promise<CreatedDto> {
    return this.commands.execute(new CreateGroupCommand(dto.name, dto.maxMembers));
  }

  @Post(':id/rename')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Renommer un groupe' })
  @ApiNoContentResponse()
  async rename(@Param('id', uuidParam()) id: string, @Body() dto: RenameGroupDto): Promise<void> {
    await this.commands.execute(new RenameGroupCommand(id, dto.name));
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Ajouter un membre (une personne appartient à au plus un groupe)' })
  @ApiNoContentResponse()
  async addMember(@Param('id', uuidParam()) id: string, @Body() dto: AddMemberDto): Promise<void> {
    await this.commands.execute(new AddMemberCommand(id, dto.personId));
  }

  @Delete(':id/members/:personId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Retirer un membre' })
  @ApiNoContentResponse()
  async removeMember(
    @Param('id', uuidParam()) id: string,
    @Param('personId', uuidParam('personId')) personId: string,
  ): Promise<void> {
    await this.commands.execute(new RemoveMemberCommand(id, personId));
  }

  @Post(':id/capacity')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Changer la capacité (1 à 50, pas sous le nombre de membres)' })
  @ApiNoContentResponse()
  async changeCapacity(
    @Param('id', uuidParam()) id: string,
    @Body() dto: ChangeGroupCapacityDto,
  ): Promise<void> {
    await this.commands.execute(new ChangeGroupCapacityCommand(id, dto.maxMembers));
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archiver un groupe vide' })
  @ApiNoContentResponse()
  async archive(@Param('id', uuidParam()) id: string): Promise<void> {
    await this.commands.execute(new ArchiveGroupCommand(id));
  }
}
