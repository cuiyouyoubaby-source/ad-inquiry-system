const fs = require('fs');

// 读取原始数据
const data = fs.readFileSync('/Users/cuifan/.qwenpaw/workspaces/default/media/c3d09c11a0699e5d904ba554.text', 'utf8');

const provinces = {};
const cities = {};

// 解析每一行
const lines = data.split('\n').filter(line => line.trim());

for (const line of lines) {
    const parts = line.split('=');
    if (parts.length !== 2) continue;
    
    const code = parts[0].trim();
    const name = parts[1].trim();
    
    if (!code || !name) continue;
    
    // 判断级别
    if (code.endsWith('0000')) {
        // 省级：后4位是0000
        provinces[code] = name;
    } else if (code.endsWith('00')) {
        // 市级：后2位是00，但不是省级
        const provinceCode = code.substring(0, 2) + '0000';
        if (!cities[provinceCode]) {
            cities[provinceCode] = [];
        }
        cities[provinceCode].push({
            code: code,
            name: name
        });
    }
}

// 输出结果
console.log('=== 省份列表 ===');
for (const [code, name] of Object.entries(provinces)) {
    console.log(code + ': ' + name);
    if (cities[code]) {
        console.log('  下属城市：');
        for (const city of cities[code]) {
            console.log('    ' + city.code + ': ' + city.name);
        }
    }
}

// 生成 SQL
console.log('\n=== 生成的 SQL ===');
console.log('-- 省份数据');
for (const [code, name] of Object.entries(provinces)) {
    console.log("INSERT INTO provinces (province_code, province_name) VALUES ('" + code + "', '" + name + "');");
}

console.log('\n-- 城市数据');
for (const [provinceCode, cityList] of Object.entries(cities)) {
    for (const city of cityList) {
        console.log("INSERT INTO cities (city_code, city_name, province_code) VALUES ('" + city.code + "', '" + city.name + "', '" + provinceCode + "');");
    }
}
