// Test database connections
const { Client } = require('pg');
const redis = require('redis');

async function testConnections() {
  console.log('🔍 Testing database connections...\n');

  // Test PostgreSQL
  try {
    const pgClient = new Client({
      host: 'localhost',
      port: 5432,
      database: 'logistics_routing_dev',
      user: 'logistics_user',
      password: 'dev_password',
    });

    await pgClient.connect();
    const result = await pgClient.query('SELECT NOW() as current_time');
    console.log('✅ PostgreSQL: Connected successfully');
    console.log(`   Current time: ${result.rows[0].current_time}`);
    await pgClient.end();
  } catch (error) {
    console.log('❌ PostgreSQL: Connection failed');
    console.log(`   Error: ${error.message}`);
  }

  // Test Redis
  try {
    const redisClient = redis.createClient({
      host: 'localhost',
      port: 6379,
    });

    redisClient.on('error', (err) => {
      console.log('❌ Redis: Connection failed');
      console.log(`   Error: ${err.message}`);
    });

    await redisClient.connect();
    await redisClient.set('test_key', 'test_value');
    const value = await redisClient.get('test_key');
    console.log('✅ Redis: Connected successfully');
    console.log(`   Test value: ${value}`);
    await redisClient.disconnect();
  } catch (error) {
    console.log('❌ Redis: Connection failed');
    console.log(`   Error: ${error.message}`);
  }

  console.log('\n🚀 If both connections are successful, you can start the application!');
}

testConnections().catch(console.error);