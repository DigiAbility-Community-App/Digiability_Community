// Diagnostic: check Redis streams and session registry
const Redis = require('ioredis');
const r = new Redis('redis://:redis_secret@localhost:6379');

async function main() {
  console.log('=== Redis Stream State ===');
  const c = await r.xlen('msg:created');
  const p = await r.xlen('msg:persisted');
  console.log('msg:created length:', c);
  console.log('msg:persisted length:', p);

  // Check consumer group info
  try {
    const groups = await r.call('XINFO', 'GROUPS', 'msg:created');
    console.log('\nmsg:created consumer groups:');
    // Parse flat array
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const obj = {};
      for (let j = 0; j < g.length; j += 2) obj[g[j]] = g[j + 1];
      console.log('  Group:', obj.name, '| pending:', obj.pending, '| consumers:', obj.consumers, '| last-delivered:', obj['last-delivered-id']);
    }
  } catch (e) {
    console.log('XINFO error:', e.message);
  }

  // Check WebSocket session registry
  console.log('\n=== WebSocket Sessions ===');
  const sessionKeys = await r.keys('ws:sessions:*');
  console.log('Active user session keys:', sessionKeys.length);
  for (const key of sessionKeys) {
    const sessions = await r.hgetall(key);
    console.log('  ', key);
    for (const [connId, info] of Object.entries(sessions)) {
      try {
        const parsed = JSON.parse(info);
        console.log('    connId:', connId, '| serverId:', parsed.serverId, '| deviceId:', parsed.deviceId);
      } catch {
        console.log('    connId:', connId, '| raw:', info);
      }
    }
  }

  // Check server connections
  const serverKeys = await r.keys('ws:server:*');
  console.log('\nServer connection sets:', serverKeys);
  for (const key of serverKeys) {
    const count = await r.scard(key);
    console.log('  ', key, '→', count, 'connections');
  }

  await r.quit();
}

main().catch(e => { console.error(e); process.exit(1); });
