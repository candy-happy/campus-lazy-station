const fs = require('fs');
let html = fs.readFileSync('app.html', 'utf8');
const errorHandler = `<script>
  window.onerror=function(msg,url,line){document.body.innerHTML='<div style="padding:20px;color:red;font-family:monospace"><h2>❌ JS错误</h2><p><b>错误:</b> '+msg+'</p><p><b>文件:</b> '+(url||'未知')+'</p><p><b>行号:</b> '+line+'</p></div>';return true};
</script>`;
html = html.replace('<script src="api.js', errorHandler + '\n<script src="api.js');
fs.writeFileSync('app.html', html);
console.log('✅ 错误捕获代码已添加');
