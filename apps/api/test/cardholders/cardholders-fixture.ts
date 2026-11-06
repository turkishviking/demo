import { EventEnvelopeFactory } from '../../src/shared/application/event-envelope';
import { SimpleCommandBus } from '../../src/shared/application/command-bus';
import { AsyncLocalCorrelationContext } from '../../src/shared/infrastructure/context/async-local-correlation-context';
import { FixedClock } from '../fakes/clocks';
import { InMemoryUnitOfWork, RecordingEventPublisher } from '../fakes/in-memory-messaging';
import { SequentialIdGenerator } from '../fakes/sequential-id-generator';
import { InMemoryGroupRepository, InMemoryPersonRepository } from './in-memory-cardholders';

export const NOW = new Date('2026-01-01T10:00:00.000Z');

/** Dépendances in-memory partagées par les tests de handlers Cardholders. */
export function cardholdersFixture() {
  const clock = new FixedClock(NOW);
  const ids = new SequentialIdGenerator();
  const publisher = new RecordingEventPublisher();
  const envelopes = new EventEnvelopeFactory(clock, ids, new AsyncLocalCorrelationContext());
  const persons = new InMemoryPersonRepository(envelopes, publisher);
  const groups = new InMemoryGroupRepository(envelopes, publisher);
  const uow = new InMemoryUnitOfWork();
  const commands = new SimpleCommandBus();
  return { clock, ids, publisher, envelopes, persons, groups, uow, commands };
}
