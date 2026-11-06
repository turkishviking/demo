import { describeCardholdersReadModelsContract } from './cardholders-read-models.contract';
import { InMemoryCardholdersReadModels } from './in-memory-cardholders-read-models';

describeCardholdersReadModelsContract('In-memory', async () => {
  const models = new InMemoryCardholdersReadModels();
  return { store: models, readModel: models, run: (work) => work() };
});
