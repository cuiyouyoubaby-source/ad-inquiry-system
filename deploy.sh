#!/bin/bash

# 广告库存询量系统部署脚本
# 服务器: 118.178.234.35
# 域名: sunyucui.com

echo "🚀 开始部署广告库存询量系统..."

# 1. 更新系统
echo "📦 更新系统..."
apt-get update -y

# 2. 安装必要软件
echo "📦 安装必要软件..."
apt-get install -y git nginx mysql-server nodejs npm

# 3. 配置 MySQL
echo "🗄️ 配置 MySQL..."
mysql -e "CREATE DATABASE IF NOT EXISTS ad_inquiry CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS 'ad_user'@'localhost' IDENTIFIED BY 'AdInquiry2024!';"
mysql -e "GRANT ALL PRIVILEGES ON ad_inquiry.* TO 'ad_user'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

# 4. 克隆项目
echo "📥 克隆项目..."
cd /root
rm -rf ad-inquiry-system
git clone https://github.com/cuiyouyoubaby-source/ad-inquiry-system.git ad-inquiry-system 2>/dev/null || mkdir -p ad-inquiry-system

# 5. 安装 Node.js 依赖
echo "📦 安装 Node.js 依赖..."
cd /root/ad-inquiry-system
npm install

# 6. 初始化数据库
echo "🗄️ 初始化数据库..."
npm run init-db

# 7. 配置 Nginx
echo "🌐 配置 Nginx..."
cp /root/ad-inquiry-system/nginx.conf /etc/nginx/sites-available/ad-inquiry
ln -sf /etc/nginx/sites-available/ad-inquiry /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 测试配置
nginx -t

# 重启 Nginx
systemctl restart nginx
systemctl enable nginx

# 8. 配置防火墙
echo "🔥 配置防火墙..."
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp

# 9. 创建 systemd 服务
echo "⚙️ 创建 systemd 服务..."
cat > /etc/systemd/system/ad-inquiry.service << 'EOF'
[Unit]
Description=Ad Inquiry System
After=network.target mysql.service

[Service]
Type=simple
User=root
WorkingDirectory=/root/ad-inquiry-system
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=DB_HOST=localhost
Environment=DB_USER=ad_user
Environment=DB_PASSWORD=AdInquiry2024!
Environment=DB_NAME=ad_inquiry

[Install]
WantedBy=multi-user.target
EOF

# 10. 启动服务
echo "🚀 启动服务..."
systemctl daemon-reload
systemctl enable ad-inquiry
systemctl start ad-inquiry

# 11. 检查状态
echo "✅ 检查服务状态..."
systemctl status ad-inquiry --no-pager
systemctl status nginx --no-pager

echo ""
echo "🎉 部署完成！"
echo ""
echo "🌐 访问地址:"
echo "   - 网站: http://sunyucui.com"
echo "   - API: http://sunyucui.com/api"
echo ""
echo "📋 服务管理命令:"
echo "   - 查看状态: systemctl status ad-inquiry"
echo "   - 重启服务: systemctl restart ad-inquiry"
echo "   - 查看日志: journalctl -u ad-inquiry -f"
echo ""
