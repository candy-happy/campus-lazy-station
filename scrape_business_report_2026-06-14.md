# 池州学院商学院教师数据爬取报告

## 时间
2026-06-14 12:49 - 12:52

## 爬取来源
- http://jmx.czu.edu.cn/szdw/jsml.htm (教授名录) ✅ 成功
- http://jmx.czu.edu.cn/szdw/bsml.htm (博士名录) ✅ 成功
- http://jmx.czu.edu.cn/szdw/jsml1.htm (教师名录) ✅ 成功
- http://jmx.czu.edu.cn/szdw/jsml2.htm ❌ 不存在
- http://jmx.czu.edu.cn/szdw/jsml3.htm ❌ 不存在

## 爬取结果
共爬取 **45位教师**（每页15人，无重叠），全部获取了详情页数据：

- **教授名录（jsml.htm）**: 15人（教授6人 + 副教授9人）
- **博士名录（bsml.htm）**: 15人（全部为博士学位持有者）
- **教师名录（jsml1.htm）**: 15人（讲师/硕士/助教为主）

## 数据对比（与 seed-teachers-insert.js）
- **数据库中标记"商学院"的行数**: ~145行（含法学院教师及个人简介中提及商学院的跨院教师）
- **爬取数据与数据库匹配**: 42人已存在
- **新发现教师（数据库中无记录）**: 3人
  - 崔凡 - 助理实验师（经管实验实训管理中心管理员）
  - 焦瑞敏 - 硕士，财务管理教师
  - 李玫 - 数字经济系讲师，英国萨塞克斯大学金融管理硕士

## 学位信息覆盖情况
核心改善：相比数据库中泛化的学位信息（如"博士"、"硕士"），爬取数据精确标注了：
- 院校名称+学位类型：如"中国农业大学管理学博士"、"南京航空航天大学管理科学与工程博士"、"英国伯明翰大学博士"等
- 数据库缺失的学位信息：王文广、王剑程、苏飞、章麓、王丽娟等教师的学位信息得到补充或标记为空

## 输出文件
`C:\Users\19733\.qclaw\workspace\campus-lazy-station\_scraped_business.js`
- 格式: Node.js模块，导出 `BUSINESS_TEACHERS` 数组
- 每条记录含：name, title, degree, department?, bio
