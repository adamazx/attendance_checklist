import * as migration_20261103_171936_baseline from './20261103_171936_baseline';
import * as migration_20261103_172140_activity_dimension from './20261103_172140_activity_dimension';
import * as migration_20261105_224406_student_master_record from './20261105_224406_student_master_record';

export const migrations = [
  {
    up: migration_20261103_171936_baseline.up,
    down: migration_20261103_171936_baseline.down,
    name: '20261103_171936_baseline',
  },
  {
    up: migration_20261103_172140_activity_dimension.up,
    down: migration_20261103_172140_activity_dimension.down,
    name: '20261103_172140_activity_dimension',
  },
  {
    up: migration_20261105_224406_student_master_record.up,
    down: migration_20261105_224406_student_master_record.down,
    name: '20261105_224406_student_master_record'
  },
];
