const db = require('better-sqlite3')('lazy_station.db');

// 确保账号存在
const user = db.prepare("SELECT phone FROM users WHERE phone='13800000001'").get();
if (!user) {
  db.prepare("INSERT INTO users (phone, nickname, created_at) VALUES ('13800000001', '测试用户', datetime('now'))").run();
  console.log('创建测试用户 13800000001');
}

const now = new Date().toISOString().replace('T',' ').slice(0,19);

const items = [
  {
    title: 'iPhone 14 Pro 256GB 暗紫色',
    description: '去年10月购入，一直带壳贴膜使用，外观95新。电池健康度91%，无拆无修，原装充电器和线都在。因为换了新手机所以出掉。',
    price: 5200,
    original_price: 8999,
    category: 'electronics',
    condition_level: '95成新',
    images: '["https://picsum.photos/seed/iphone1/400/300","https://picsum.photos/seed/iphone2/400/300","https://picsum.photos/seed/iphone3/400/300"]',
    status: 'active',
    contact: '微信: test_wx'
  },
  {
    title: 'Cherry MX3.0S 机械键盘 茶轴',
    description: 'Cherry原厂茶轴，RGB背光，全键无冲。用了半年左右，键帽略有打油但不影响使用。包装盒都在，送拔键器和清洁套装。',
    price: 280,
    original_price: 599,
    category: 'electronics',
    condition_level: '9成新',
    images: '["https://picsum.photos/seed/keyboard1/400/300","https://picsum.photos/seed/keyboard2/400/300"]',
    status: 'active',
    contact: 'QQ: 123456'
  },
  {
    title: '捷安特ATX 860 山地自行车 27.5寸',
    description: '去年买的捷安特山地车，27.5寸车架适合170-180身高。禧玛诺27速变速，油压碟刹。车况很好，买来通勤用的，现在不需要了。送车锁和水壶架。',
    price: 1200,
    original_price: 2998,
    category: 'sports',
    condition_level: '9成新',
    images: '["https://picsum.photos/seed/bike1/400/300","https://picsum.photos/seed/bike2/400/300","https://picsum.photos/seed/bike3/400/300","https://picsum.photos/seed/bike4/400/300"]',
    status: 'active',
    contact: '微信: bike_seller'
  },
  {
    title: '全新大学英语四级词汇 星火式',
    description: '买来没翻过几页，几乎全新。星火式巧记速记，里面带词根词缀记忆法，比死记硬背好用很多。',
    price: 18,
    original_price: 39.8,
    category: 'textbook',
    condition_level: '几乎全新',
    images: '["https://picsum.photos/seed/book1/400/300"]',
    status: 'active',
    contact: '微信: book_123'
  },
  {
    title: '小米台灯1S LED智能护眼台灯',
    description: '小米智能台灯，支持色温亮度无极调节，可以用米家APP控制。带阅读模式和电脑模式，国AA级照度标准。用了不到一年，家里还有一台所以出了。',
    price: 89,
    original_price: 179,
    category: 'daily',
    condition_level: '9成新',
    images: '["https://picsum.photos/seed/lamp1/400/300","https://picsum.photos/seed/lamp2/400/300"]',
    status: 'active',
    contact: '微信: lamp_sale'
  },
  {
    title: '2025考研数学复习全书 李永乐',
    description: '2025版李永乐考研数学复习全书，数学一专用。做了前两章，后面基本全新。附送历年真题解析和660题。',
    price: 35,
    original_price: 89,
    category: 'textbook',
    condition_level: '8成新',
    images: '["https://picsum.photos/seed/mathbook/400/300"]',
    status: 'active',
    contact: 'QQ: 789012'
  },
  {
    title: 'AirPods Pro 2代 降噪耳机',
    description: '2023年6月买的，很少用，续航还很好。主动降噪效果一流，通透模式也很自然。包装盒、充电线和替换耳塞都在。',
    price: 850,
    original_price: 1899,
    category: 'electronics',
    condition_level: '95成新',
    images: '["https://picsum.photos/seed/airpods1/400/300","https://picsum.photos/seed/airpods2/400/300"]',
    status: 'active',
    contact: '微信: audio_lover'
  },
  {
    title: '迷你宿舍用小冰箱 20L',
    description: '20升迷你冰箱，放宿舍刚好。制冷/制热两用，夏天冰饮料冬天热牛奶。噪音很小不会影响室友休息。9成新，毕业了所以出。',
    price: 150,
    original_price: 350,
    category: 'daily',
    condition_level: '9成新',
    images: '["https://picsum.photos/seed/fridge1/400/300","https://picsum.photos/seed/fridge2/400/300","https://picsum.photos/seed/fridge3/400/300"]',
    status: 'active',
    contact: '电话: 138****8888'
  }
];

const stmt = db.prepare(`
  INSERT INTO market_items (seller_phone, title, description, price, original_price, category, condition_level, images, status, contact, views, created_at, updated_at, trade_status)
  VALUES (@seller_phone, @title, @description, @price, @original_price, @category, @condition_level, @images, @status, @contact, 0, @created_at, @created_at, 'available')
`);

const insertMany = db.transaction((items) => {
  for (const item of items) {
    stmt.run({ ...item, seller_phone: '13800000001', created_at: now });
  }
});

insertMany(items);
console.log(`插入 ${items.length} 条二手商品成功`);
