const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'ad_inquiry'
};

async function initDatabase() {
  const connection = await mysql.createConnection(dbConfig);

  try {
    console.log('🚀 开始初始化数据库...');

    // 创建数据库
    await connection.execute('CREATE DATABASE IF NOT EXISTS ad_inquiry CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    await connection.execute('USE ad_inquiry');

    // 1. 创建城市表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS cities (
        id INT AUTO_INCREMENT PRIMARY KEY,
        province VARCHAR(50) NOT NULL COMMENT '省份',
        city VARCHAR(50) NOT NULL COMMENT '城市',
        tier VARCHAR(20) NOT NULL COMMENT '城市分级（一线/新一线/二线/三线/其他）',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_city (city)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='城市信息表'
    `);
    console.log('✅ 城市表创建完成');

    // 2. 创建资源位表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS ad_slots (
        slot_id VARCHAR(50) PRIMARY KEY COMMENT '资源位ID',
        slot_name VARCHAR(100) NOT NULL COMMENT '资源位名称',
        media VARCHAR(50) NOT NULL COMMENT '媒体',
        description TEXT COMMENT '资源位描述',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资源位信息表'
    `);
    console.log('✅ 资源位表创建完成');

    // 3. 创建业务因子表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS business_factors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        factor_key VARCHAR(50) NOT NULL COMMENT '因子键',
        factor_value DECIMAL(10,4) NOT NULL COMMENT '因子值',
        description VARCHAR(200) COMMENT '描述',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_factor_key (factor_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='业务因子配置表'
    `);
    console.log('✅ 业务因子表创建完成');

    // 4. 创建系数表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS coefficients (
        id INT AUTO_INCREMENT PRIMARY KEY,
        slot_id VARCHAR(50) NOT NULL COMMENT '资源位ID',
        city_tier VARCHAR(20) NOT NULL COMMENT '城市分级',
        coefficient_value DECIMAL(10,4) NOT NULL COMMENT '系数值',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_slot_tier (slot_id, city_tier)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系数配置表'
    `);
    console.log('✅ 系数表创建完成');

    // 5. 创建基础数据表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS base_data (
        id INT AUTO_INCREMENT PRIMARY KEY,
        slot_id VARCHAR(50) NOT NULL COMMENT '资源位ID',
        city VARCHAR(50) NOT NULL COMMENT '城市',
        device_count INT NOT NULL COMMENT '设备数',
        screen_size DECIMAL(10,4) NOT NULL COMMENT '屏幕尺寸',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_slot_city (slot_id, city)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='基础数据表'
    `);
    console.log('✅ 基础数据表创建完成');

    // 6. 创建询量记录表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS inquiry_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        inquiry_id VARCHAR(50) NOT NULL COMMENT '询量ID',
        inquiry_name VARCHAR(120) NOT NULL COMMENT '询量名称',
        advertiser VARCHAR(120) COMMENT '广告主',
        brand VARCHAR(120) COMMENT '品牌',
        media VARCHAR(50) NOT NULL COMMENT '媒体',
        slot_id VARCHAR(50) NOT NULL COMMENT '资源位ID',
        effective_days INT NOT NULL COMMENT '有效投放天数',
        provinces JSON COMMENT '省份列表',
        city_tiers JSON COMMENT '城市分级列表',
        request_multiplier DECIMAL(10,4) DEFAULT 1.0 COMMENT '请求倍率',
        theoretical_inventory BIGINT COMMENT '理论可售卖量',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_inquiry_id (inquiry_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='询量记录表'
    `);
    console.log('✅ 询量记录表创建完成');

    // 插入示例数据
    await insertSampleData(connection);

    console.log('🎉 数据库初始化完成！');
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

async function insertSampleData(connection) {
  console.log('📝 插入示例数据...');

  // 插入城市数据
  const cities = [
    // 一线城市
    { province: '北京', city: '北京', tier: '一线' },
    { province: '上海', city: '上海', tier: '一线' },
    { province: '广东', city: '广州', tier: '一线' },
    { province: '广东', city: '深圳', tier: '一线' },
    // 新一线城市
    { province: '四川', city: '成都', tier: '新一线' },
    { province: '浙江', city: '杭州', tier: '新一线' },
    { province: '重庆', city: '重庆', tier: '新一线' },
    { province: '陕西', city: '西安', tier: '新一线' },
    { province: '江苏', city: '苏州', tier: '新一线' },
    { province: '湖北', city: '武汉', tier: '新一线' },
    { province: '江苏', city: '南京', tier: '新一线' },
    { province: '天津', city: '天津', tier: '新一线' },
    // 二线城市
    { province: '广东', city: '佛山', tier: '二线' },
    { province: '湖南', city: '长沙', tier: '二线' },
    { province: '河南', city: '郑州', tier: '二线' },
    { province: '云南', city: '昆明', tier: '二线' },
    { province: '山东', city: '青岛', tier: '二线' },
    { province: '辽宁', city: '沈阳', tier: '二线' },
    { province: '山东', city: '济南', tier: '二线' },
    { province: '福建', city: '厦门', tier: '二线' },
    { province: '黑龙江', city: '哈尔滨', tier: '二线' },
    // 三线城市
    { province: '广西', city: '南宁', tier: '三线' },
    { province: '河北', city: '石家庄', tier: '三线' },
    { province: '山西', city: '太原', tier: '三线' },
    { province: '贵州', city: '贵阳', tier: '三线' },
    { province: '吉林', city: '长春', tier: '三线' },
    { province: '江西', city: '南昌', tier: '三线' },
    { province: '甘肃', city: '兰州', tier: '三线' }
  ];

  for (const city of cities) {
    await connection.execute(
      'INSERT IGNORE INTO cities (province, city, tier) VALUES (?, ?, ?)',
      [city.province, city.city, city.tier]
    );
  }
  console.log('✅ 城市数据插入完成');

  // 插入资源位数据
  const slots = [
    { slot_id: 'banana_splash', slot_name: '开屏广告', media: 'banana', description: 'APP启动时的全屏广告' },
    { slot_id: 'banana_feed', slot_name: '信息流广告', media: 'banana', description: '信息流中的原生广告' },
    { slot_id: 'banana_banner', slot_name: 'Banner广告', media: 'banana', description: '页面顶部的横幅广告' },
    { slot_id: 'banana_interstitial', slot_name: '插屏广告', media: 'banana', description: '页面切换时的插屏广告' }
  ];

  for (const slot of slots) {
    await connection.execute(
      'INSERT IGNORE INTO ad_slots (slot_id, slot_name, media, description) VALUES (?, ?, ?, ?)',
      [slot.slot_id, slot.slot_name, slot.media, slot.description]
    );
  }
  console.log('✅ 资源位数据插入完成');

  // 插入业务因子
  const factors = [
    { factor_key: 'daily_exposure', factor_value: 1.0, description: '日均曝光系数' },
    { factor_key: 'click_rate', factor_value: 0.02, description: '点击率' },
    { factor_key: 'conversion_rate', factor_value: 0.05, description: '转化率' }
  ];

  for (const factor of factors) {
    await connection.execute(
      'INSERT IGNORE INTO business_factors (factor_key, factor_value, description) VALUES (?, ?, ?)',
      [factor.factor_key, factor.factor_value, factor.description]
    );
  }
  console.log('✅ 业务因子数据插入完成');

  // 插入系数数据
  const coefficients = [
    { slot_id: 'banana_splash', city_tier: '一线', coefficient_value: 1.5 },
    { slot_id: 'banana_splash', city_tier: '新一线', coefficient_value: 1.3 },
    { slot_id: 'banana_splash', city_tier: '二线', coefficient_value: 1.0 },
    { slot_id: 'banana_splash', city_tier: '三线', coefficient_value: 0.8 },
    { slot_id: 'banana_feed', city_tier: '一线', coefficient_value: 1.4 },
    { slot_id: 'banana_feed', city_tier: '新一线', coefficient_value: 1.2 },
    { slot_id: 'banana_feed', city_tier: '二线', coefficient_value: 1.0 },
    { slot_id: 'banana_feed', city_tier: '三线', coefficient_value: 0.7 }
  ];

  for (const coef of coefficients) {
    await connection.execute(
      'INSERT IGNORE INTO coefficients (slot_id, city_tier, coefficient_value) VALUES (?, ?, ?)',
      [coef.slot_id, coef.city_tier, coef.coefficient_value]
    );
  }
  console.log('✅ 系数数据插入完成');

  // 插入基础数据（示例）
  const baseData = [
    { slot_id: 'banana_splash', city: '北京', device_count: 1000000, screen_size: 6.5 },
    { slot_id: 'banana_splash', city: '上海', device_count: 900000, screen_size: 6.5 },
    { slot_id: 'banana_splash', city: '广州', device_count: 800000, screen_size: 6.5 },
    { slot_id: 'banana_splash', city: '深圳', device_count: 850000, screen_size: 6.5 },
    { slot_id: 'banana_splash', city: '成都', device_count: 600000, screen_size: 6.5 },
    { slot_id: 'banana_splash', city: '杭州', device_count: 550000, screen_size: 6.5 },
    { slot_id: 'banana_feed', city: '北京', device_count: 1000000, screen_size: 6.5 },
    { slot_id: 'banana_feed', city: '上海', device_count: 900000, screen_size: 6.5 },
    { slot_id: 'banana_feed', city: '广州', device_count: 800000, screen_size: 6.5 },
    { slot_id: 'banana_feed', city: '深圳', device_count: 850000, screen_size: 6.5 }
  ];

  for (const data of baseData) {
    await connection.execute(
      'INSERT IGNORE INTO base_data (slot_id, city, device_count, screen_size) VALUES (?, ?, ?, ?)',
      [data.slot_id, data.city, data.device_count, data.screen_size]
    );
  }
  console.log('✅ 基础数据插入完成');
}

// 执行初始化
initDatabase().catch(console.error);
