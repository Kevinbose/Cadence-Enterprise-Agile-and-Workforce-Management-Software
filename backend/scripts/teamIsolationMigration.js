/**
 * One-shot team isolation migration.
 * Run: node scripts/teamIsolationMigration.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });

const { sequelize } = require('../models');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected to DB.');

    // 1. Add column if missing
    const [cols] = await sequelize.query("SHOW COLUMNS FROM sprints LIKE 'team_id'");
    if (cols.length === 0) {
      await sequelize.query('ALTER TABLE sprints ADD COLUMN team_id INT NULL');
      console.log('team_id column added to sprints table.');
    } else {
      console.log('team_id column already exists — skipping ALTER TABLE.');
    }

    // 2. Backfill from scrum master's team_id
    const [r1] = await sequelize.query(
      'UPDATE sprints s JOIN users u ON s.scrum_master_id = u.id SET s.team_id = u.team_id WHERE s.team_id IS NULL AND s.scrum_master_id IS NOT NULL'
    );
    console.log(`Backfilled ${r1.affectedRows} sprint(s) from scrum master team.`);

    // 3. Fallback for sprints with no scrum master
    const [r2] = await sequelize.query('UPDATE sprints SET team_id = 1 WHERE team_id IS NULL');
    if (r2.affectedRows > 0) {
      console.log(`Fallback teamId=1 applied to ${r2.affectedRows} sprint(s).`);
    }

    // 4. Verify
    const [sprints] = await sequelize.query(
      'SELECT id, name, status, team_id, scrum_master_id FROM sprints ORDER BY team_id, id'
    );
    console.log('\nFinal sprint state:');
    sprints.forEach((s) =>
      console.log(`  Sprint ${s.id} | ${s.name} | ${s.status} | team_id=${s.team_id}`)
    );

    await sequelize.close();
    console.log('\nMigration complete.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    await sequelize.close();
    process.exit(1);
  }
})();
