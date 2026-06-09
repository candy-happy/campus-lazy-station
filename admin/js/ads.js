// === 广告管理 ===

let adsFilter = 'all';
let adsList = [];

 async function loadAds() {
 adsList = await API.getAdminAds();
 // 更新广告统计
 document.getElementById('statAdsTotal').textContent = adsList.length;
 document.getElementById('statAdsActive').textContent = adsList.filter(a=>a.status==='active').length;
 document.getElementById('statAdsViews').textContent = adsList.reduce((s,a)=>s+(a.view_count||0),0);
 document.getElementById('statAdsClicks').textContent = adsList.reduce((s,a)=>s+(a.click_count||0),0);
 renderAdsTable();
 }

 function filterAds(filter, btn) {
 adsFilter = filter;
 document.querySelectorAll('.ads-filter-btn').forEach(b => b.classList.toggle('active', b === btn));
 renderAdsTable();
 }

 function renderAdsTable() {
 const tb = document.getElementById('adsTable'); if (!tb) return;
 const now = new Date();
 // 过滤
 const filtered = adsList.filter(a => {
   if (adsFilter === 'all') return true;
   if (adsFilter === 'active') {
     if (a.status !== 'active') return false;
     if (a.end_time && new Date(a.end_time) <= now) return false;
     return true;
   }
   if (adsFilter === 'ended') {
     if (a.end_time && new Date(a.end_time) <= now) return true;
     if (a.status === 'inactive') return false;
     return false;
   }
   if (adsFilter === 'inactive') return a.status === 'inactive';
   return true;
 });
 const countEl = document.getElementById('adsFilterCount');
 if (countEl) countEl.textContent = filtered.length + ' / ' + adsList.length + ' 条';
 const statusLabel = (s, a) => {
   if (a.end_time && new Date(a.end_time) <= new Date()) return '<span class="badge badge-yellow">已结束</span>';
   return s === 'active' ? '<span class="badge badge-green">启用</span>' : '<span class="badge badge-gray">停用</span>';
 };
 const mediaPreview = (url, img) => {
  if (!url) return '<span style="font-size:20px">'+(img||'🎁')+'</span>';
  const isVid = url.match(/\.(mp4|webm|mov)$/i);
  if (isVid) return '<video src="'+url+'" style="width:60px;height:36px;object-fit:cover;border-radius:6px" muted></video>';
  return '<img src="'+url+'" style="width:60px;height:36px;object-fit:cover;border-radius:6px" onerror="this.style.display=none">';
 };
 const linkLabel = a => {
  if (a.link_url) return '<a href="'+escHtml(a.link_url)+'" target="blank" style="color:var(--orange);font-size:12px">🔗外部链接</a>';
  const lt = { order:'下单', coupon:'优惠券', page:'页面', url:'外部链接', none:'-' };
  return lt[a.link_type] || '-';
 };
 tb.innerHTML = filtered.map(a => {
  const ctr = a.view_count > 0 ? (a.click_count / a.view_count * 100).toFixed(1) + '%' : '-';
  return `<tr><td>${mediaPreview(a.media_url, a.image)}</td><td>${escHtml(a.title)}</td><td style="text-align:center">${a.view_count||0}</td><td style="text-align:center">${a.click_count||0}</td><td style="text-align:center">${ctr}</td><td>${a.sort_order}</td><td>${statusLabel(a.status,a)}</td><td>${linkLabel(a)}</td><td>${a.end_time||'永久'}</td><td><button class="btn btn-sm" onclick="editAd(${a.id})">编辑</button> <button class="btn btn-sm btn-danger" onclick="deleteAd(${a.id})">删除</button></td></tr>`;
 }).join('');
 }

 function showAdForm(ad) {
 document.getElementById('adEditId').value = ad ? ad.id : '';
 document.getElementById('adFormTitle').textContent = ad ? '编辑广告' : '新增广告';
 document.getElementById('adTitle').value = ad ? ad.title : '';
 document.getElementById('adDesc').value = ad ? ad.description : '';
 document.getElementById('adImage').value = ad ? ad.image : '\ud83c\udf81';
 document.getElementById('adLinkType').value = ad ? ad.link_type : 'none';
 document.getElementById('adLinkValue').value = ad ? ad.link_value : '';
 document.getElementById('adLinkUrl').value = ad ? (ad.link_url||'') : '';
 document.getElementById('adMediaUrl').value = ad ? (ad.media_url||'') : '';
 const preview = document.getElementById('adMediaPreview');
 if (ad && ad.media_url) {
  const isVid = ad.media_url.match(/\.(mp4|webm|mov)$/i);
  preview.innerHTML = isVid
   ? '<video src="'+ad.media_url+'" style="max-width:200px;max-height:100px;border-radius:8px" controls muted></video> <button type="button" class="btn btn-danger btn-sm" onclick="clearAdMedia()">移除</button>'
   : '<img src="'+ad.media_url+'" style="max-width:200px;max-height:100px;border-radius:8px" onerror="this.style.display=\'none\'"> <button type="button" class="btn btn-danger btn-sm" onclick="clearAdMedia()">移除</button>';
  preview.style.display = 'block';
 } else { preview.innerHTML = ''; preview.style.display = 'none'; }
 document.getElementById('adMediaFile').value = '';
 document.getElementById('adSort').value = ad ? ad.sort_order : 0;
 document.getElementById('adStatus').value = ad ? ad.status : 'active';
 document.getElementById('adStartTime').value = ad && ad.start_time ? ad.start_time.replace(' ','T') : '';
 document.getElementById('adEndTime').value = ad && ad.end_time ? ad.end_time.replace(' ','T') : '';
 showModal('adFormModal');
 }

 function editAd(id) {
 const ad = adsList.find(a => a.id === id);
 if (ad) showAdForm(ad);
 }

 async function saveAd(e) {
 e.preventDefault();
 const id = document.getElementById('adEditId').value;
 const rawLinkType = document.getElementById('adLinkType').value;
 const rawLinkValue = document.getElementById('adLinkValue').value.trim();
 // 自动修复：link_value 是 URL 但 link_type 不是 url
 let linkType = rawLinkType;
 if (rawLinkValue && /^https?:\/\//i.test(rawLinkValue) && rawLinkType === 'none') {
  linkType = 'url';
 }
 const data = {
 title: document.getElementById('adTitle').value,
 description: document.getElementById('adDesc').value,
 image: document.getElementById('adImage').value,
 media_url: document.getElementById('adMediaUrl').value,
 link_url: document.getElementById('adLinkUrl').value,
 link_type: linkType,
 link_value: rawLinkValue,
 sort_order: parseInt(document.getElementById('adSort').value) || 0,
 status: document.getElementById('adStatus').value,
 start_time: document.getElementById('adStartTime').value ? document.getElementById('adStartTime').value.replace('T',' ') : null,
 end_time: document.getElementById('adEndTime').value ? document.getElementById('adEndTime').value.replace('T',' ') : null
 };
 try {
 if (id) { await API.updateAd(id, data); showToast('广告已更新'); }
 else { await API.addAd(data); showToast('广告已添加'); }
 closeModal('adFormModal'); await loadAds();
 } catch(err) { showToast(err.message); }
 }

 async function uploadAdMedia() {
  const fileInput = document.getElementById('adMediaFile');
  if (!fileInput.files.length) return showToast('请先选择文件');
  const fd = new FormData();
  fd.append('media', fileInput.files[0]);
  try {
   const res = await fetch('/api/ads/admin/upload', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('lazy_admin_token') || '') },
    body: fd
   }).then(r => r.json());
   if (res.error) return showToast(res.error);
   document.getElementById('adMediaUrl').value = res.url;
   const preview = document.getElementById('adMediaPreview');
   if (res.isVideo) {
    preview.innerHTML = '<video src="'+res.url+'" style="max-width:200px;max-height:100px;border-radius:8px" controls muted></video> <button type="button" class="btn btn-danger btn-sm" onclick="clearAdMedia()">移除</button>';
   } else {
    preview.innerHTML = '<img src="'+res.url+'" style="max-width:200px;max-height:100px;border-radius:8px"> <button type="button" class="btn btn-danger btn-sm" onclick="clearAdMedia()">移除</button>';
   }
   preview.style.display = 'block';
   showToast('媒体上传成功');
  } catch(err) { showToast('上传失败: '+err.message); }
 }

 function clearAdMedia() {
  document.getElementById('adMediaUrl').value = '';
  document.getElementById('adMediaPreview').innerHTML = '';
  document.getElementById('adMediaPreview').style.display = 'none';
  document.getElementById('adMediaFile').value = '';
 }

  async function deleteAd(id) {
 if (!confirm('确定删除此广告？')) return;
 try { await API.deleteAd(id); showToast('已删除'); await loadAds(); } catch(err) { showToast(err.message); }
 }

// window exports
window.loadAds = loadAds;
window.filterAds = filterAds;
window.renderAdsTable = renderAdsTable;
window.showAdForm = showAdForm;
window.editAd = editAd;
window.saveAd = saveAd;
window.uploadAdMedia = uploadAdMedia;
window.clearAdMedia = clearAdMedia;
window.deleteAd = deleteAd;
