# 师说教师数据恢复

## 问题
删库重建后，`teachers` 表为空（1062位教师数据丢失），前端"师说"板块无数据显示。

## 根因
- `scripts/seed-teacher-info.js` 只做 `UPDATE teachers SET ...`，假设教师基础数据（id/name/college/title/research）已存在
- `config/database.js` 只创建 teachers 表结构，不插入数据
- 原始1062条教师记录从未有过 INSERT 种子脚本

## 修复
1. 从本地备份 `lazy_station.db.bak` (708KB) 中提取全部1062位教师完整数据
2. 生成 `scripts/seed-teachers-insert.js`：先清空 teacher_likes/teacher_reviews/teachers 三张表，再逐条 INSERT
3. 推送至 GitHub (commit 6dbc7bd)
4. 服务器端执行：`git pull` + `node scripts/seed-teachers-insert.js`

## 服务器操作
```bash
cd /home/ubuntu/campus-lazy-station
git pull
node scripts/seed-teachers-insert.js
```
无需重启 PM2，数据库文件直接操作。
