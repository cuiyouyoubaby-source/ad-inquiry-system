const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'ad_inquiry',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// 创建连接池
const pool = mysql.createPool(dbConfig);

// 数据库连接测试
async function testDBConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ 数据库连接成功');
    connection.release();
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    console.log('请确保 MySQL 已安装并运行');
  }
}

// ==================== API 路由 ====================

// 获取所有省份
app.get('/api/provinces', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT DISTINCT province FROM cities ORDER BY province');
    res.json({ success: true, data: rows.map(row => row.province) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取省份下的城市
app.get('/api/cities/:province', async (req, res) => {
  try {
    const { province } = req.params;
    const [rows] = await pool.execute(
      'SELECT city, tier FROM cities WHERE province = ? ORDER BY city',
      [province]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取所有城市（按分级）
app.get('/api/cities-by-tier/:tier', async (req, res) => {
  try {
    const { tier } = req.params;
    const [rows] = await pool.execute(
      'SELECT city, province FROM cities WHERE tier = ? ORDER BY city',
      [tier]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取资源位列表
app.get('/api/ad-slots', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM ad_slots ORDER BY slot_name');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取业务因子配置
app.get('/api/business-factors', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM business_factors');
    const factors = {};
    rows.forEach(row => {
      factors[row.factor_key] = {
        value: row.factor_value,
        description: row.description
      };
    });
    res.json({ success: true, data: factors });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 更新业务因子
app.post('/api/business-factors', async (req, res) => {
  try {
    const { factor_key, factor_value, description } = req.body;
    await pool.execute(
      'INSERT INTO business_factors (factor_key, factor_value, description) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE factor_value = ?, description = ?',
      [factor_key, factor_value, description, factor_value, description]
    );
    res.json({ success: true, message: '业务因子更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取系数配置
app.get('/api/coefficients', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM coefficients');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 更新系数
app.post('/api/coefficients', async (req, res) => {
  try {
    const { slot_id, city_tier, coefficient_value } = req.body;
    await pool.execute(
      'INSERT INTO coefficients (slot_id, city_tier, coefficient_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE coefficient_value = ?',
      [slot_id, city_tier, coefficient_value, coefficient_value]
    );
    res.json({ success: true, message: '系数更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取基础数据（设备尺寸）
app.get('/api/base-data', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM base_data ORDER BY slot_id, city');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 添加基础数据
app.post('/api/base-data', async (req, res) => {
  try {
    const { slot_id, city, device_count, screen_size } = req.body;
    await pool.execute(
      'INSERT INTO base_data (slot_id, city, device_count, screen_size) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE device_count = ?, screen_size = ?',
      [slot_id, city, device_count, screen_size, device_count, screen_size]
    );
    res.json({ success: true, message: '基础数据添加成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== 询量计算核心 API ====================

// 创建询量记录
app.post('/api/inquiry', async (req, res) => {
  try {
    const {
      inquiry_name,
      advertiser = '',
      brand = '',
      media = 'banana',
      slot_id,
      effective_days,
      provinces,
      city_tiers,
      request_multiplier
    } = req.body;

    const inquiry_id = uuidv4();
    const created_at = moment().format('YYYY-MM-DD HH:mm:ss');

    // 计算理论可售卖量
    const result = await calculateInquiry({
      slot_id,
      effective_days,
      provinces,
      city_tiers,
      request_multiplier
    });

    // 保存询量记录
    await pool.execute(
      `INSERT INTO inquiry_records 
       (inquiry_id, inquiry_name, advertiser, brand, media, slot_id, effective_days, 
        provinces, city_tiers, request_multiplier, theoretical_inventory, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        inquiry_id,
        inquiry_name,
        advertiser,
        brand,
        media,
        slot_id,
        effective_days,
        JSON.stringify(provinces),
        JSON.stringify(city_tiers),
        request_multiplier,
        result.theoretical_inventory,
        created_at
      ]
    );

    res.json({
      success: true,
      data: {
        inquiry_id,
        inquiry_name,
        theoretical_inventory: result.theoretical_inventory,
        details: result.details,
        created_at
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取询量记录列表
app.get('/api/inquiry', async (req, res) => {
  try {
    const { page = 1, pageSize = 10, search, slot_id } = req.query;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (inquiry_name LIKE ? OR advertiser LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (slot_id) {
      whereClause += ' AND slot_id = ?';
      params.push(slot_id);
    }

    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM inquiry_records ${whereClause}`,
      params
    );

    const [rows] = await pool.execute(
      `SELECT ir.*, ads.slot_name 
       FROM inquiry_records ir 
       LEFT JOIN ad_slots ads ON ir.slot_id = ads.slot_id 
       ${whereClause} 
       ORDER BY ir.created_at DESC 
       LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), parseInt(offset)]
    );

    res.json({
      success: true,
      data: {
        list: rows,
        total: countResult[0].total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取询量详情
app.get('/api/inquiry/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute(
      `SELECT ir.*, ads.slot_name 
       FROM inquiry_records ir 
       LEFT JOIN ad_slots ads ON ir.slot_id = ads.slot_id 
       WHERE ir.inquiry_id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '询量记录不存在' });
    }

    const record = rows[0];
    record.provinces = JSON.parse(record.provinces);
    record.city_tiers = JSON.parse(record.city_tiers);

    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== 询量计算核心逻辑 ====================

async function calculateInquiry({ slot_id, effective_days, provinces, city_tiers, request_multiplier }) {
  try {
    // 获取业务因子
    const [factorRows] = await pool.execute('SELECT * FROM business_factors');
    const factors = {};
    factorRows.forEach(row => {
      factors[row.factor_key] = parseFloat(row.factor_value);
    });

    // 获取系数
    const [coefficientRows] = await pool.execute(
      'SELECT * FROM coefficients WHERE slot_id = ?',
      [slot_id]
    );
    const coefficients = {};
    coefficientRows.forEach(row => {
      coefficients[row.city_tier] = parseFloat(row.coefficient_value);
    });

    // 获取基础数据
    let query = 'SELECT * FROM base_data WHERE slot_id = ?';
    const params = [slot_id];

    if (provinces && provinces.length > 0) {
      query += ` AND city IN (SELECT city FROM cities WHERE province IN (${provinces.map(() => '?').join(',')}))`;
      params.push(...provinces);
    }

    if (city_tiers && city_tiers.length > 0) {
      query += ` AND city IN (SELECT city FROM cities WHERE tier IN (${city_tiers.map(() => '?').join(',')}))`;
      params.push(...city_tiers);
    }

    const [baseDataRows] = await pool.execute(query, params);

    // 计算理论可售卖量
    let totalInventory = 0;
    const details = [];

    for (const data of baseDataRows) {
      const cityTier = await getCityTier(data.city);
      const coefficient = coefficients[cityTier] || 1.0;
      
      // 核心计算公式
      const dailyInventory = data.device_count * data.screen_size * coefficient * (factors.daily_exposure || 1.0);
      const totalCityInventory = dailyInventory * effective_days / (request_multiplier || 1.0);
      
      totalInventory += totalCityInventory;
      
      details.push({
        city: data.city,
        device_count: data.device_count,
        screen_size: data.screen_size,
        coefficient: coefficient,
        daily_inventory: dailyInventory,
        total_inventory: totalCityInventory
      });
    }

    return {
      theoretical_inventory: Math.round(totalInventory),
      details
    };
  } catch (error) {
    console.error('计算询量失败:', error);
    throw error;
  }
}

async function getCityTier(city) {
  const [rows] = await pool.execute('SELECT tier FROM cities WHERE city = ?', [city]);
  return rows.length > 0 ? rows[0].tier : 'other';
}

// ==================== 启动服务 ====================

app.listen(PORT, () => {
  console.log(`🚀 广告库存询量系统已启动`);
  console.log(`📍 访问地址: http://localhost:${PORT}`);
  testDBConnection();
});
