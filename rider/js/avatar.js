// avatar.js - 头像上传

 async function uploadRiderAvatar(input) {
   if (!input.files || !input.files[0]) return;
   const file = input.files[0];
   if (!file.type.startsWith('image/')) { showToast('请选择图片文件'); return; }
   if (file.size > 5 * 1024 * 1024) { showToast('图片不能超过5MB'); return; }
   try {
     showToast('上传中...');
     const res = await API.uploadRiderAvatar(currentRider.phone, file);
     if (res.code === 0 || res.avatarUrl) {
       currentRider.avatar = res.avatarUrl || res.data?.avatarUrl;
       localStorage.setItem('lazyRider', JSON.stringify(currentRider));
       // 同步更新 lazy_session 中的 avatar
       try {
         const s = JSON.parse(localStorage.getItem('lazy_session') || '{}');
         s.avatar = currentRider.avatar;
         localStorage.setItem('lazy_session', JSON.stringify(s));
       } catch(e) {}
       showToast('头像更新成功 ✅');
       updateProfile();
       // 刷新设置页头像
       const circle = document.querySelector('.settings-avatar-circle');
       if (circle) {
         if (currentRider.avatar) {
           circle.innerHTML = '<img src="' + currentRider.avatar + '" />';
         } else {
           circle.innerHTML = '\u{1F6F5}';
         }
       }
     } else {
       showToast(res.message || '上传失败');
     }
   } catch(e) {
     showToast('上传失败: ' + (e.message||''));
   }
   input.value = '';
 }

// Exports
window.uploadRiderAvatar = uploadRiderAvatar;
