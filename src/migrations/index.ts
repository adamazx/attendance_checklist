import * as migration_20261103_171936_baseline from './20261103_171936_baseline';
import * as migration_20261103_172140_activity_dimension from './20261103_172140_activity_dimension';

export const migrations = [
  {
    up: migration_20261103_171936_baseline.up,
    down: migration_20261103_171936_baseline.down,
    name: '20261103_171936_baseline',
  },
  {
    up: migration_20261103_172140_activity_dimension.up,
    down: migration_20261103_172140_activity_dimension.down,
    name: '20261103_172140_activity_dimension'
  },
];
