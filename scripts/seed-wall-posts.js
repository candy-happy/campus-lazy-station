// scripts/seed-wall-posts.js - 批量插入高质量校园墙帖子+评论
// 用法: 先 pm2 stop server, 再 node scripts/seed-wall-posts.js, 最后 pm2 start server

const db = require('../config/database');

// 模拟用户
const USERS = [
  { phone: '13800000001', name: '丁卫星', avatar: '' },
  { phone: '13900000001', name: '同学', avatar: '' },
  { phone: '13645653760', name: 'candy', avatar: '/uploads/avatars/user-1780488213066-coxqv0.png' },
  { phone: '13800138000', name: '测试用户', avatar: '' },
  { phone: '13999259060', name: '测试用户A', avatar: '' },
  { phone: '13999432470', name: '测试用户B', avatar: '' },
];

// 高质量帖子内容
const POSTS = [
  // ── 日常 ──
  {
    phone: '13800000001', nickname: '丁卫星', tags: '日常',
    content: '今天图书馆六楼靠窗的位置，阳光刚好洒在书页上，突然觉得考研也没那么难熬了。旁边有个同学一直在打瞌睡，头一点一点的特别可爱，希望他醒来脖子不酸😂',
    like_count: 47, comment_count: 8, exposure_count: 312, exposure_done: 1,
    hours_ago: 1
  },
  {
    phone: '13900000001', nickname: '同学', tags: '日常',
    content: '食堂三楼的麻辣香锅真的绝了！每次去都要排20分钟队，但是那个味道值得。推荐加午餐肉和藕片，酱选微辣就好，中辣真的会冒汗🔥',
    like_count: 89, comment_count: 15, exposure_count: 567, exposure_done: 1,
    hours_ago: 3
  },
  {
    phone: '13645653760', nickname: 'candy', tags: '日常',
    content: '在操场跑步的时候捡到一只小橘猫，耳朵上有剪耳标记应该是TNR过的，特别亲人。现在暂时带回宿舍了，有没有人想领养呀？🐱',
    like_count: 156, comment_count: 23, exposure_count: 892, exposure_done: 1,
    hours_ago: 5
  },

  // ── 求助 ──
  {
    phone: '13999259060', nickname: '测试用户A', tags: '求助',
    content: '有没有学长学姐知道计算机组成原理这门课怎么复习啊？王老师的课完全听不懂，PPT也是天书，下周就考试了急急急！跪求复习资料或者重点🙏',
    like_count: 34, comment_count: 12, exposure_count: 445, exposure_done: 1,
    hours_ago: 2
  },
  {
    phone: '13800138000', nickname: '测试用户', tags: '求助',
    content: '校园卡丢了！今天下午在南区食堂到图书馆的路上丢的，卡号2024XXXX，姓名张XX。捡到的同学请联系我，必有重谢！电话13800138000',
    like_count: 23, comment_count: 5, exposure_count: 234, exposure_done: 1,
    hours_ago: 8
  },

  // ── 吐槽 ──
  {
    phone: '13999432470', nickname: '测试用户B', tags: '吐槽',
    content: '选课系统又崩了！！每次选课都是这样，学校能不能升级一下服务器啊，我们交的学费都去哪了😤 早上8点准时进去就500错误，刷新了半个小时才进去，想选的课全没了',
    like_count: 203, comment_count: 41, exposure_count: 1567, exposure_done: 1,
    hours_ago: 12
  },
  {
    phone: '13800000001', nickname: '丁卫星', tags: '吐槽',
    content: '宿舍的热水器能不能修一下啊，已经报修三次了，每次都是洗到一半变冷水，今天差点感冒。宿管阿姨说已经联系维修了，但是一周了还没人来😅',
    like_count: 67, comment_count: 18, exposure_count: 789, exposure_done: 1,
    hours_ago: 16
  },

  // ── 美食 ──
  {
    phone: '13645653760', nickname: 'candy', tags: '美食',
    content: '后街新开了一家螺蛳粉！味道居然还挺正宗的，汤底浓郁，酸笋脆爽，加个炸蛋绝配。老板是柳州人，说用的都是家乡寄来的料。人均15块，性价比超高🍜',
    like_count: 134, comment_count: 27, exposure_count: 1023, exposure_done: 1,
    hours_ago: 6
  },
  {
    phone: '13900000001', nickname: '同学', tags: '美食',
    content: '分享一个宿舍快手菜：泡面加芝士片和牛奶，煮出来就是奶油芝士面，室友吃了都说好！再加个煎蛋和火腿肠，完美👍 前提是你们宿舍允许用锅哈',
    like_count: 78, comment_count: 19, exposure_count: 567, exposure_done: 1,
    hours_ago: 10
  },

  // ── 情感 ──
  {
    phone: '13999259060', nickname: '测试用户A', tags: '情感',
    content: '毕业季真的来了。今天拍毕业照的时候，大家都在笑，但是拍完之后突然就安静了。四年真的太快了，从大一的懵懂到现在的舍不得，感谢遇见的每一个人。愿我们前程似锦，后会有期🎓',
    like_count: 289, comment_count: 45, exposure_count: 2345, exposure_done: 1,
    hours_ago: 4
  },
  {
    phone: '13800138000', nickname: '测试用户', tags: '情感',
    content: '暗恋一个人是什么感觉？就是每次去图书馆都会不自觉地往三楼看一眼，明知道他每周二四下午都在那个位置，却从来没有勇气坐到对面。也许毕业前应该说点什么吧...',
    like_count: 167, comment_count: 32, exposure_count: 1234, exposure_done: 1,
    hours_ago: 7
  },

  // ── 学习 ──
  {
    phone: '13800000001', nickname: '丁卫星', tags: '学习',
    content: '分享一个超好用的学习方法：费曼学习法！就是学完一个知识点之后，假装给一个完全不懂的人讲解。如果能讲清楚，说明你真的理解了。考研复习用这个方法效率翻倍📚',
    like_count: 112, comment_count: 14, exposure_count: 890, exposure_done: 1,
    hours_ago: 9
  },
  {
    phone: '13645653760', nickname: 'candy', tags: '学习',
    content: '四六级倒计时30天！有没有一起组队打卡背单词的？每天100个单词+1篇阅读理解，互相监督。评论区留下你的目标分数，我们一起冲！💪',
    like_count: 95, comment_count: 38, exposure_count: 678, exposure_done: 1,
    hours_ago: 14
  },

  // ── 考试 ──
  {
    phone: '13999432470', nickname: '测试用户B', tags: '考试',
    content: '期末考试安排出来了！高数周一，线代周三，大物周五，连着三天大考，学校你是认真的吗😭 有没有好心人分享高数复习笔记，救救孩子吧',
    like_count: 145, comment_count: 29, exposure_count: 1123, exposure_done: 1,
    hours_ago: 18
  },

  // ── 闲置 ──
  {
    phone: '13900000001', nickname: '同学', tags: '闲置',
    content: '毕业清仓！九成新iPad Air 4 + Apple Pencil 2，考研用了一年的，无划痕，电池健康97%。原价4800，现在2800出。还有一堆考研资料免费送，先到先得！',
    like_count: 56, comment_count: 21, exposure_count: 456, exposure_done: 1,
    hours_ago: 11
  },

  // ── 活动 ──
  {
    phone: '13800000001', nickname: '丁卫星', tags: '活动',
    content: '本周六晚上7点，学校大礼堂有校园歌手大赛决赛！10组选手都是海选出来的实力派，还有特邀嘉宾表演。门票免费，先到先得，现场还有抽奖环节🎉',
    like_count: 198, comment_count: 16, exposure_count: 1567, exposure_done: 1,
    hours_ago: 15
  },

  // ── 兼职 ──
  {
    phone: '13999259060', nickname: '测试用户A', tags: '兼职',
    content: '学校附近的奶茶店招兼职啦！时薪18元，每天4-6小时，时间灵活可以排课表。要求：有责任心，态度好。工作日晚上和周末优先。有意向的私信我，可以内推💰',
    like_count: 87, comment_count: 25, exposure_count: 678, exposure_done: 1,
    hours_ago: 20
  },

  // ── 租房 ──
  {
    phone: '13800138000', nickname: '测试用户', tags: '租房',
    content: '求合租！下学期想在学校南门附近租房，两室一厅的那种，预算每人1000左右。本人男生，大三，不抽烟不喝酒，作息规律。有房源或者想一起合租的请联系我🏠',
    like_count: 34, comment_count: 9, exposure_count: 234, exposure_done: 1,
    hours_ago: 22
  },

  // ── 社交 ──
  {
    phone: '13645653760', nickname: 'candy', tags: '社交',
    content: '有没有喜欢打羽毛球的同学呀？我每周三周五晚上都会去体育馆打球，目前只有两个人，想凑够4个人打双打。水平业余但热情满满，来的滴滴我🤝',
    like_count: 45, comment_count: 11, exposure_count: 345, exposure_done: 1,
    hours_ago: 24
  },

  // ── 多标签帖子 ──
  {
    phone: '13999432470', nickname: '测试用户B', tags: '日常,吐槽',
    content: '今天早八的课，闹钟响了三次都没起来，最后一路狂奔到教室，发现老师也迟到了哈哈哈哈。全班等了十分钟老师才来，说是因为堵车。所以早八到底是谁在赢啊？🤣',
    like_count: 234, comment_count: 52, exposure_count: 1890, exposure_done: 1,
    hours_ago: 13
  },
  {
    phone: '13800000001', nickname: '丁卫星', tags: '学习,考试',
    content: '考研倒计时200天！今天完成了高数第三章的复习，做了80道题错了23道，正确率71%。虽然不算高但是比上周进步了！坚持就是胜利，冲冲冲✊',
    like_count: 67, comment_count: 8, exposure_count: 456, exposure_done: 1,
    hours_ago: 17
  },
  {
    phone: '13900000001', nickname: '同学', tags: '情感,日常',
    content: '今天在图书馆门口看到一个男生给女生送了一束向日葵，女生笑得特别好看。突然觉得大学里最美好的事情，大概就是在对的时间遇到对的人吧🌻 希望我也能遇到',
    like_count: 178, comment_count: 36, exposure_count: 1345, exposure_done: 1,
    hours_ago: 19
  },
];

// 评论内容
const COMMENT_TEMPLATES = {
  '日常': [
    { content: '哈哈图书馆打瞌睡那个画面感太强了', like: 12 },
    { content: '同款阳光位！六楼真的太舒服了', like: 5 },
    { content: '考研加油！我也是今年考', like: 8 },
    { content: '图书馆六楼是宝藏位置', like: 3 },
  ],
  '求助': [
    { content: '我有王老师去年的复习重点，私信我发你', like: 15 },
    { content: '推荐B站上王道考研的计组课，讲得很清楚', like: 22 },
    { content: '组原重点在指令系统和存储器那两章', like: 9 },
    { content: '校园卡挂失可以在一卡通中心办，很快的', like: 6 },
  ],
  '吐槽': [
    { content: '笑死，选课系统什么时候没崩过', like: 34 },
    { content: '建议学校用阿里云服务器，别省这钱', like: 28 },
    { content: '我上次选课刷新了两个小时才进去', like: 15 },
    { content: '热水器+1，我们楼也是，冬天真的要命', like: 19 },
  ],
  '美食': [
    { content: '螺蛳粉好吃是好吃，但是宿舍不嫌臭吗😂', like: 25 },
    { content: '后街那家我也去过！老板人超好', like: 8 },
    { content: '泡面加芝士这个组合绝了，今晚试试', like: 11 },
    { content: '推荐加个溏心蛋，蛋黄拌面超好吃', like: 7 },
  ],
  '情感': [
    { content: '毕业快乐！前程似锦！🎓', like: 45 },
    { content: '看哭了，大学四年真的太快了', like: 32 },
    { content: '去说吧！不说会后悔一辈子的', like: 28 },
    { content: '暗恋是最美好的遗憾，加油！', like: 19 },
  ],
  '学习': [
    { content: '费曼学习法真的有用！我考研就靠这个', like: 18 },
    { content: '四六级打卡+1！目标550', like: 6 },
    { content: '推荐墨墨背单词APP，用了两年了', like: 14 },
  ],
  '考试': [
    { content: '同款考试安排，已经准备放弃了', like: 23 },
    { content: '高数笔记我有！整理了30页PDF', like: 31 },
    { content: '三天考三科，学校你是魔鬼吗', like: 17 },
  ],
  '闲置': [
    { content: 'iPad还有吗？想要！', like: 5 },
    { content: '考研资料可以发我一份吗？', like: 8 },
    { content: '2800好价，可惜我已经有了', like: 3 },
  ],
  '活动': [
    { content: '已经报名了！期待周六🎉', like: 12 },
    { content: '去年看过，真的很精彩', like: 9 },
    { content: '有直播吗？去不了现场', like: 4 },
  ],
  '兼职': [
    { content: '时薪18在奶茶店算高的了', like: 7 },
    { content: '大二可以吗？晚上都有空', like: 5 },
    { content: '已私信！求内推', like: 3 },
  ],
  '租房': [
    { content: '南门小区了解下，我住那边还不错', like: 4 },
    { content: '1000的预算可以看看教师公寓', like: 6 },
  ],
  '社交': [
    { content: '我也想打！但是水平很菜可以吗', like: 3 },
    { content: '周三晚上可以！私信你了', like: 5 },
  ],
};

// 回复模板
const REPLY_TEMPLATES = [
  '确实是这样！',
  '哈哈哈太真实了',
  '同意！',
  '学到了，谢谢分享',
  '我也是这样觉得的',
  '已私信！',
  '蹲一个',
  '冲冲冲！',
  '太棒了吧',
  '笑死我了',
];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function hoursAgoStr(h) {
  const d = new Date(Date.now() - h * 3600000);
  return d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '').replace(/Z$/, '');
}

// 主逻辑
console.log('开始插入校园墙帖子...');

const insertPost = db.prepare(`
  INSERT INTO wall_posts (phone, nickname, avatar, content, tags, ai_tags, images, gif_urls, like_count, comment_count, exposure_count, exposure_done, created_at, updated_at)
  VALUES (@phone, @nickname, @avatar, @content, @tags, @ai_tags, @images, @gif_urls, @like_count, @comment_count, @exposure_count, @exposure_done, @created_at, @updated_at)
`);

const insertComment = db.prepare(`
  INSERT INTO wall_comments (post_id, phone, nickname, avatar, content, parent_id, reply_to_phone, reply_to_nickname, like_count, created_at)
  VALUES (@post_id, @phone, @nickname, @avatar, @content, @parent_id, @reply_to_phone, @reply_to_nickname, @like_count, @created_at)
`);

const insertLike = db.prepare(`
  INSERT OR IGNORE INTO wall_likes (post_id, phone, created_at)
  VALUES (@post_id, @phone, @created_at)
`);

let postCount = 0;
let commentCount = 0;

const transaction = db.transaction(() => {
  POSTS.forEach((post, idx) => {
    const user = USERS.find(u => u.phone === post.phone) || USERS[0];
    const createdAt = hoursAgoStr(post.hours_ago);

    const result = insertPost.run({
      phone: post.phone,
      nickname: post.nickname || user.name,
      avatar: user.avatar || '',
      content: post.content,
      tags: post.tags,
      ai_tags: '',
      images: '',
      gif_urls: '',
      like_count: post.like_count,
      comment_count: post.comment_count,
      exposure_count: post.exposure_count,
      exposure_done: post.exposure_done,
      created_at: createdAt,
      updated_at: createdAt
    });

    const postId = result.lastInsertRowid;
    postCount++;

    // 添加点赞记录
    const likeUsers = USERS.filter(u => u.phone !== post.phone).slice(0, Math.min(post.like_count, USERS.length - 1));
    likeUsers.forEach(u => {
      insertLike.run({ post_id: postId, phone: u.phone, created_at: hoursAgoStr(post.hours_ago - randomInt(0, 3)) });
    });

    // 添加评论
    const tags = post.tags.split(',');
    const mainTag = tags[0];
    const commentTemplates = COMMENT_TEMPLATES[mainTag] || COMMENT_TEMPLATES['日常'];

    // 顶级评论
    const topComments = commentTemplates.slice(0, Math.min(commentTemplates.length, randomInt(2, 4)));
    topComments.forEach((ct, ci) => {
      const commentUser = USERS[(idx + ci + 1) % USERS.length];
      const commentTime = hoursAgoStr(post.hours_ago - ci - 1);

      const commentResult = insertComment.run({
        post_id: postId,
        phone: commentUser.phone,
        nickname: commentUser.name,
        avatar: commentUser.avatar || '',
        content: ct.content,
        parent_id: null,
        reply_to_phone: '',
        reply_to_nickname: '',
        like_count: ct.like,
        created_at: commentTime
      });
      commentCount++;

      const commentId = commentResult.lastInsertRowid;

      // 给评论添加1-2个回复
      const replyCount = randomInt(0, 2);
      for (let ri = 0; ri < replyCount; ri++) {
        const replyUser = USERS[(idx + ci + ri + 2) % USERS.length];
        if (replyUser.phone === commentUser.phone) continue;
        const replyContent = randomItem(REPLY_TEMPLATES);
        const replyTime = hoursAgoStr(post.hours_ago - ci - ri - 2);

        insertComment.run({
          post_id: postId,
          phone: replyUser.phone,
          nickname: replyUser.name,
          avatar: replyUser.avatar || '',
          content: replyContent,
          parent_id: commentId,
          reply_to_phone: commentUser.phone,
          reply_to_nickname: commentUser.name,
          like_count: randomInt(0, 5),
          created_at: replyTime
        });
        commentCount++;
      }
    });

    // 从其他标签的评论模板中再添加1-2条评论
    const otherTags = Object.keys(COMMENT_TEMPLATES).filter(t => t !== mainTag);
    const extraCount = randomInt(0, 2);
    for (let ei = 0; ei < extraCount; ei++) {
      const extraTag = randomItem(otherTags);
      const extraTemplates = COMMENT_TEMPLATES[extraTag];
      const extraComment = randomItem(extraTemplates);
      const extraUser = USERS[(idx + ei + 3) % USERS.length];
      const extraTime = hoursAgoStr(post.hours_ago - randomInt(1, 5));

      insertComment.run({
        post_id: postId,
        phone: extraUser.phone,
        nickname: extraUser.name,
        avatar: extraUser.avatar || '',
        content: extraComment.content,
        parent_id: null,
        reply_to_phone: '',
        reply_to_nickname: '',
        like_count: extraComment.like,
        created_at: extraTime
      });
      commentCount++;
    }
  });
});

transaction();

console.log(`✅ 完成！插入 ${postCount} 条帖子，${commentCount} 条评论`);
console.log('请重启服务: pm2 restart server');
