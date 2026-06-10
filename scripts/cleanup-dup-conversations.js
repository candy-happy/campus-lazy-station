const db = require('better-sqlite3')('./lazy_station.db');
db.pragma('foreign_keys = OFF');

// 找 item_id IS NULL 的重复用户对
const dups = db.prepare(`
  SELECT MIN(user1_phone, user2_phone) as p1, MAX(user1_phone, user2_phone) as p2,
         COUNT(*) as cnt, GROUP_CONCAT(id) as ids
  FROM conversations WHERE item_id IS NULL
  GROUP BY p1, p2
  HAVING COUNT(*) > 1
`).all();

console.log('重复组数: ' + dups.length);

for (const d of dups) {
  console.log(d.p1 + ' <-> ' + d.p2 + ' 共' + d.cnt + '条 ids=' + d.ids);
  const ids = d.ids.split(',').map(Number).sort((a, b) => a - b);
  const keep = ids[0];
  for (const rid of ids.slice(1)) {
    const { n } = db.prepare('SELECT COUNT(*) as n FROM messages WHERE conversation_id = ?').get(rid);
    if (n > 0) {
      db.prepare('UPDATE messages SET conversation_id = ? WHERE conversation_id = ?').run(keep, rid);
    }
    db.prepare('DELETE FROM conversations WHERE id = ?').run(rid);
    console.log('  ' + rid + ' -> ' + keep + ' (' + n + ' message(s))');
  }
}

console.log('Done. Remaining:');
const rest = db.prepare('SELECT id, user1_phone, user2_phone, item_id FROM conversations WHERE item_id IS NULL ORDER BY id').all();
console.log(JSON.stringify(rest, null, 2));
