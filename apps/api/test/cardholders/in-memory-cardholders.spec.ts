import { cardholdersFixture } from './cardholders-fixture';
import { describeCardholdersRepositoriesContract } from './repositories.contract';

describeCardholdersRepositoriesContract('In-memory', async () => {
  const f = cardholdersFixture();
  return {
    persons: f.persons,
    personLookup: f.persons,
    groups: f.groups,
    groupLookup: f.groups,
    run: (work) => f.uow.run(work),
    publishedEvents: async () =>
      f.publisher.published.map(({ type, aggregateId, aggregateVersion }) => ({
        type,
        aggregateId,
        aggregateVersion,
      })),
  };
});
