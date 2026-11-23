const CFG=window.PM_CONFIG||{},db=window.supabase?.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY),$=id=>document.getElementById(id),money=n=>'৳'+Number(n||0).toLocaleString('en-BD'),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let product=null,selectedColor='',selectedVariant=null,currentImages=[];
function toast(t){$('detailToast').textContent=t;$('detailToast').classList.add('show');setTimeout(()=>$('detailToast').classList.remove('show'),2300)}

function videoEmbed(type,url){
 if(!url)return '';
 let u;try{u=new URL(url)}catch{return '<a class="product-video-link" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">মূল ভিডিও দেখুন ↗</a>'}
 if(!['http:','https:'].includes(u.protocol))return '<span class="product-video-fallback">ভিডিও লিংকটি সঠিক নয়।</span>';
 const host=u.hostname.toLowerCase().replace(/^www\./,'');
 const title={youtube:'YouTube',facebook:'Facebook',tiktok:'TikTok'}[type]||'Video';
 let frame='';
 if(type==='youtube'&&['youtube.com','m.youtube.com','youtu.be','youtube-nocookie.com'].includes(host)){
  const id=host==='youtu.be'?u.pathname.split('/').filter(Boolean)[0]:(u.searchParams.get('v')||u.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1]);
  if(id&&/^[\w-]{6,20}$/.test(id))frame='<iframe src="https://www.youtube-nocookie.com/embed/'+esc(id)+'" title="YouTube video" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>';
 }else if(type==='facebook'&&['facebook.com','m.facebook.com','fb.watch'].includes(host)){
  frame='<div class="product-video-frame facebook-resolve" data-facebook-url="'+esc(u.href)+'"><p class="product-video-fallback">Facebook ভিডিও লোড হচ্ছে...</p></div>';
 }else if(type==='tiktok'&&['tiktok.com','m.tiktok.com','vt.tiktok.com','vm.tiktok.com'].includes(host)){
  const id=u.pathname.match(/\/video\/(\d+)/)?.[1];
  if(id)frame='<iframe src="https://www.tiktok.com/player/v1/'+esc(id)+'?controls=1&description=1" title="TikTok video" loading="lazy" allow="fullscreen" allowfullscreen></iframe>';
  else frame='<div class="product-video-frame tiktok-resolve" data-tiktok-url="'+esc(u.href)+'"><p class="product-video-fallback">TikTok ভিডিও লোড হচ্ছে...</p></div>';
 }
 const fallback='<a class="product-video-link" href="'+esc(u.href)+'" target="_blank" rel="noopener noreferrer">মূল '+title+' ভিডিও দেখুন ↗</a>';
 return '<article class="product-video-card"><h3>'+title+'</h3>'+(frame?'<div class="product-video-frame">'+frame+'</div>':'<p class="product-video-fallback">এই লিংকটি Embed করা যাচ্ছে না।</p>')+fallback+'</article>';
}
async function resolveFacebookEmbeds(){
 const frames=[...document.querySelectorAll('.facebook-resolve[data-facebook-url]')];
 await Promise.all(frames.map(async frame=>{
  try{
   const response=await fetch('/api/resolve-facebook?url='+encodeURIComponent(frame.dataset.facebookUrl),{headers:{Accept:'application/json'}});
   if(!response.ok)throw new Error('Meta oEmbed '+response.status);
   const result=await response.json();
   if(!result.src||!/^https:\/\/(www\\.)?facebook\\.com\//.test(result.src))throw new Error('invalid Meta embed URL');
   const iframe=document.createElement('iframe');
   iframe.src=result.src;iframe.title='Facebook video';iframe.loading='lazy';
   iframe.allow='autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share';iframe.allowFullscreen=true;
   frame.replaceChildren(iframe);frame.classList.remove('facebook-resolve');
  }catch(error){
   console.warn('Facebook oEmbed failed',error);
   frame.innerHTML='<p class="product-video-fallback">Facebook ভিডিওটি এখানে Embed করা যায়নি। নিচের লিংকে মূল ভিডিওটি খুলুন।</p>';
  }
 }));
}
async function resolveTikTokEmbeds(){
 const frames=[...document.querySelectorAll('.tiktok-resolve[data-tiktok-url]')];
 await Promise.all(frames.map(async frame=>{
  const original=frame.dataset.tiktokUrl;
  try{
   const response=await fetch('/api/resolve-tiktok?url='+encodeURIComponent(original),{headers:{Accept:'application/json'}});
   if(!response.ok)throw new Error('resolver '+response.status);
   const result=await response.json();
   if(!result.id||!/^\d{10,25}$/.test(String(result.id)))throw new Error('invalid video id');
   const iframe=document.createElement('iframe');
   iframe.src='https://www.tiktok.com/player/v1/'+encodeURIComponent(result.id)+'?controls=1&description=1';
   iframe.title='TikTok video';iframe.loading='lazy';iframe.allow='fullscreen';iframe.allowFullscreen=true;
   const wrapper=document.createElement('div');wrapper.className='product-video-frame';wrapper.appendChild(iframe);frame.replaceWith(wrapper);
  }catch(error){
   console.warn('TikTok short-link resolution failed',error);
   frame.innerHTML='<p class="product-video-fallback">TikTok ভিডিওটি এখানে Embed করা যায়নি। নিচের লিংকে মূল ভিডিওটি খুলুন।</p>';
  }
 }));
}
window.addEventListener('message',event=>{
 if(!/^(https:\/\/)?(www\.)?tiktok\.com$/.test(event.origin))return;
 const message=event.data;
 if(!message||message['x-tiktok-player']!==true||message.type!=='onPlayerError')return;
 const frame=[...document.querySelectorAll('.product-video-frame iframe')].find(item=>item.contentWindow===event.source);
 if(!frame)return;
 const fallback=frame.closest('.product-video-card')?.querySelector('.product-video-link');
 if(fallback){fallback.textContent='ভিডিও চালু হয়নি—TikTok-এ খুলুন ↗';fallback.style.display='inline-block'}
});
function parseFacebookEmbeds(){
 if(window.FB?.XFBML?.parse)window.FB.XFBML.parse(document.getElementById('productDetail'));
}
function renderProductVideos(){const entries=[['youtube',product.youtube_video_url],['facebook',product.facebook_video_url],['tiktok',product.tiktok_video_url]].filter(x=>String(x[1]||'').trim());return entries.length?'<section class="product-videos"><h2>Product Videos</h2><div class="product-video-grid">'+entries.map(([type,url])=>videoEmbed(type,String(url).trim())).join('')+'</div></section>':''}
async function showAdminProductShortcut(){const tools=$('adminProductTools');if(!tools||!db)return;try{const {data:{session}}=await db.auth.getSession();if(!session?.user)return;const {data,error}=await db.from('profiles').select('role').eq('id',session.user.id).single();if(error||!['admin','main_admin'].includes(data?.role))return;tools.innerHTML='<a class="detail-admin-edit" href="./admin.html?edit='+encodeURIComponent(product.id)+'">✎ Edit Product</a>';tools.hidden=false}catch(e){console.warn('Admin shortcut permission check failed',e)}}

function addDetailCart(){if(!product)return;const variants=Array.isArray(product.variants)?product.variants:[],legacy=Array.isArray(product.colors)?product.colors:[];if((variants.length||legacy.length)&&!selectedColor){toast('কার্টে যোগ করার আগে Colour নির্বাচন করুন');return}const price=selectedVariant?Number(selectedVariant.price):Number(product.price),stock=selectedVariant?Number(selectedVariant.stock):Number(product.stock),image=currentImages[0]||product.image_url||'';if(stock<1){toast('দুঃখিত, নির্বাচিত Colour স্টক আউট');return}let cart=[];try{cart=JSON.parse(localStorage.getItem('pm_cart')||'[]')}catch{}const key=String(product.id)+'::'+selectedColor,found=cart.find(x=>String(x.id)+'::'+(x.color||'')===key);if(found){if(found.qty>=stock){toast('স্টকের চেয়ে বেশি যোগ করা যাবে না');return}found.qty++}else cart.push({id:product.id,name:product.name,price,qty:1,stock,color:selectedColor,image});localStorage.setItem('pm_cart',JSON.stringify(cart));toast('কার্টে যোগ হয়েছে');$('detailCart').hidden=false}
function openDetailImageViewer(src,alt='পণ্যের ছবি'){const viewer=document.createElement('div');viewer.className='product-image-viewer';const close=document.createElement('button');close.type='button';close.className='product-image-viewer-close';close.textContent='✕';close.setAttribute('aria-label','ছবি বন্ধ করুন');const img=document.createElement('img');img.src=src;img.alt=alt;viewer.append(close,img);document.body.appendChild(viewer);document.body.style.overflow='hidden';const dismiss=()=>{viewer.remove();document.body.style.overflow='';document.removeEventListener('keydown',onKey)};const onKey=e=>{if(e.key==='Escape')dismiss()};close.onclick=dismiss;viewer.addEventListener('click',e=>{if(e.target===viewer)dismiss()});document.addEventListener('keydown',onKey)}
function showImage(url,index){const main=$('detailMainImage');main.innerHTML=url?'<img src="'+esc(url)+'" alt="'+esc(product.name)+'" title="বড় করে দেখতে ট্যাপ করুন">':'<span class="placeholder">⚙</span>';const image=main.querySelector('img');if(image){image.style.cursor='zoom-in';image.addEventListener('click',()=>openDetailImageViewer(image.currentSrc||image.src,image.alt||'পণ্যের ছবি'))}document.querySelectorAll('.detail-thumb').forEach((b,i)=>b.classList.toggle('active',i===index))}
function renderGallery(images){currentImages=[...new Set((images||[]).filter(Boolean))];$('detailThumbs').innerHTML=currentImages.map((url,i)=>'<button class="detail-thumb '+(i===0?'active':'')+'" data-image="'+i+'" aria-label="ছবি '+(i+1)+'"><img src="'+esc(url)+'" alt="'+esc(product.name)+' ছবি '+(i+1)+'"></button>').join('');showImage(currentImages[0]||'',0);document.querySelectorAll('[data-image]').forEach(b=>b.onclick=()=>showImage(currentImages[Number(b.dataset.image)],Number(b.dataset.image)))}
function updateSelectedVariant(name){const variants=Array.isArray(product.variants)?product.variants:[];selectedColor=name||'';selectedVariant=variants.find(v=>String(v.name).toLocaleLowerCase()===String(selectedColor).toLocaleLowerCase())||null;const variant=selectedVariant;const images=variant&&Array.isArray(variant.images)&&variant.images.length?variant.images:[product.image_url,...(Array.isArray(product.images)?product.images:[])];renderGallery(images);$('detailPrice').textContent=money(variant?variant.price:product.price);const stock=variant?Number(variant.stock):Number(product.stock);$('detailStock').textContent=stock>0?'ইন স্টক':'স্টক আউট';$('detailAdd').disabled=stock<1;document.querySelectorAll('[data-color]').forEach(b=>{const active=b.dataset.color===selectedColor;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active))});const base=document.querySelector('[data-main-image]');if(base){base.classList.toggle('selected',!selectedColor);base.setAttribute('aria-pressed',String(!selectedColor))}}
function render(){const variants=Array.isArray(product.variants)?product.variants:[],colors=variants.length?variants.map(v=>v.name):(Array.isArray(product.colors)?product.colors:[]),baseImages=[product.image_url,...(Array.isArray(product.images)?product.images:[])];$('productDetail').innerHTML='<div class="detail-layout"><section class="detail-gallery"><div class="detail-main-image" id="detailMainImage"></div><div class="detail-thumbs" id="detailThumbs"></div></section><section class="detail-info"><span class="detail-category">'+esc(product.category||'অন্যান্য')+'</span><h1>'+esc(product.name)+'</h1><div class="detail-price" id="detailPrice">'+money(product.price)+'</div><div class="detail-meta"><span>বাইক মডেল: <b>'+esc(product.compatibility||'উল্লেখ নেই')+'</b></span><span>স্টক: <b id="detailStock">'+(Number(product.stock)>0?'ইন স্টক':'স্টক আউট')+'</b></span><span>ক্যাটাগরি: <b>'+esc(product.category||'উল্লেখ নেই')+'</b></span></div><div class="detail-description">'+esc(product.description||'এই পণ্যের জন্য বিস্তারিত বিবরণ দেওয়া হয়নি।')+'</div><div id="adminProductTools" class="detail-admin-tools" hidden></div>'+(colors.length?'<div class="detail-color"><b>Colour নির্বাচন করুন</b><div class="detail-color-options"><button type="button" class="detail-color-option" data-main-image aria-pressed="true">মূল ছবি</button>'+colors.map(c=>'<button type="button" class="detail-color-option" data-color="'+esc(c)+'" aria-pressed="false">'+esc(c)+'</button>').join('')+'</div></div>':'')+'<div class="detail-actions"><button class="detail-add" id="detailAdd" '+(Number(product.stock)<1?'disabled':'')+'>Add to Cart</button><a class="detail-cart" id="detailCart" href="./?cart=1" hidden>কার্ট দেখুন</a></div></section></div>';renderGallery(baseImages);$('detailAdd').onclick=addDetailCart;document.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>updateSelectedVariant(b.dataset.color));const mainImageButton=document.querySelector('[data-main-image]');if(mainImageButton)mainImageButton.onclick=()=>updateSelectedVariant('');if(!colors.length){selectedColor='';selectedVariant=null}const videoMarkup=renderProductVideos();if(videoMarkup){$('productDetail').insertAdjacentHTML('beforeend',videoMarkup);resolveTikTokEmbeds();resolveFacebookEmbeds()}showAdminProductShortcut()}
async function init(){const id=new URLSearchParams(location.search).get('id');if(!id||!db){$('productDetail').innerHTML='<div class="empty">পণ্যটি পাওয়া যায়নি। <a href="./">হোমপেজে ফিরে যান</a></div>';return}const {data,error}=await db.from('products').select('*').eq('id',id).eq('active',true).maybeSingle();if(error||!data){$('productDetail').innerHTML='<div class="empty">পণ্যটি পাওয়া যায়নি অথবা মুছে ফেলা হয়েছে। <a href="./">হোমপেজে ফিরে যান</a></div>';return}product=data;let recent=[];try{recent=JSON.parse(localStorage.getItem("pm_recently_viewed")||"[]").map(String)}catch{}recent=[String(product.id),...recent.filter(x=>x!==String(product.id))].slice(0,8);localStorage.setItem("pm_recently_viewed",JSON.stringify(recent));document.title=product.name+" | PARTS MARKET";render()}
init();