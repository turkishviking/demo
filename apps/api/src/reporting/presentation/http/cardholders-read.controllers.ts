import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  GroupDetails,
  GroupListItem,
  Page,
  PersonDetails,
  PersonListItem,
} from '@cardsim/shared';
import { QUERY_BUS, type QueryBus } from '../../../shared/application/query-bus';
import { uuidParam } from '../../../shared/presentation/http/uuid-param.pipe';
import {
  GetGroupDetailsQuery,
  GetPersonDetailsQuery,
  ListGroupsQuery,
  ListPersonsQuery,
} from '../../application/queries/cardholders.queries';
import { ListGroupsQueryDto, ListPersonsQueryDto } from './dto/list-query.dto';

/** Lectures des personnes, servies par le read model `rm_people` (cohérence éventuelle). */
@ApiTags('persons')
@Controller('persons')
export class PersonsReadController {
  constructor(@Inject(QUERY_BUS) private readonly queries: QueryBus) {}

  @Get()
  @ApiOperation({ summary: 'Lister les personnes (pagination par curseur)' })
  list(@Query() dto: ListPersonsQueryDto): Promise<Page<PersonListItem>> {
    const { cursor, limit, ...filter } = dto;
    return this.queries.execute(new ListPersonsQuery(filter, cursor, limit));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’une personne' })
  get(@Param('id', uuidParam()) id: string): Promise<PersonDetails> {
    return this.queries.execute(new GetPersonDetailsQuery(id));
  }
}

/** Lectures des groupes, servies par les read models `rm_groups` et `rm_people`. */
@ApiTags('groups')
@Controller('groups')
export class GroupsReadController {
  constructor(@Inject(QUERY_BUS) private readonly queries: QueryBus) {}

  @Get()
  @ApiOperation({ summary: 'Lister les groupes (pagination par curseur)' })
  list(@Query() dto: ListGroupsQueryDto): Promise<Page<GroupListItem>> {
    const { cursor, limit, ...filter } = dto;
    return this.queries.execute(new ListGroupsQuery(filter, cursor, limit));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’un groupe et de ses membres' })
  get(@Param('id', uuidParam()) id: string): Promise<GroupDetails> {
    return this.queries.execute(new GetGroupDetailsQuery(id));
  }
}
