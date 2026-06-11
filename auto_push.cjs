// 校园懒人效率站 - 自动提交并推送脚本
// 被 cron 定时任务调用
const { execSync } = require('child_process');
const path = require('path');

const projectDir = path.resolve(__dirname);

function run(cmd) {
  try {
    return execSync(cmd, {
      cwd: projectDir,
      encoding: 'utf-8',
      timeout: 30000,
      env: { ...process.env, https_proxy: 'http://127.0.0.1:7890', http_proxy: 'http://127.0.0.1:7890' }
    }).trim();
  } catch (e) {
    return `ERROR: ${e.message.split('\n')[0]}`;
  }
}

// 检查是否有变更
const status = run('git status --porcelain');
if (!status) {
  console.log('[auto-push] 没有变更，跳过');
  process.exit(0);
}

const changedFiles = status.split('\n').filter(Boolean).length;
console.log(`[auto-push] 检测到 ${changedFiles} 个文件变更`);

// 提交（只添加源代码文件，排除敏感文件）
const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
const commitMsg = `auto-save: ${now}`;

// 先添加所有变更，再撤销敏感文件的暂存
// 这种方式比用 :! 排除模式更可靠，避免 Windows shell 解析和 exit code 问题
run('git add -A');

// 撤销 .db / uploads / .env 的暂存（防止误提交敏感文件）
const resetResult = run('git reset -- "*.db" "uploads/" ".env"');
console.log(`[auto-push] reset excluded: ${resetResult}`);

const commitResult = run(`git commit -m "${commitMsg}"`);
console.log(`[auto-push] commit: ${commitResult.split('\n')[0]}`);

// 推送
const pushResult = run('git push origin main');
console.log(`[auto-push] push: ${pushResult.split('\n').pop()}`);
