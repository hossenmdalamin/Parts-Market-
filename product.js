const CFG=window.PM_CONFIG||{},db=window.supabase?.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY),$=id=>document.getElementById(id),money=n=>'৳'+Number(n||0).toLocaleString('en-BD'),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let product=null,selectedColor='',selectedVariant=null,currentImages=[];
function toast(t){$('detailToast').textContent=t;$('detailToast').classList.add('show');setTimeout(()=>$('detailToast').classList.remove('show'),2300)}

function videoEmbed(type,url){
 if(!url)return '';
 let u;try{u=new URL(url)}catch{return '<a class="product-video-link" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">মূল ভিডিও দেখুন ↗</a>'}
 if(!['http:','https:'].includes(u.protocol))return '<span class="product-video-fallback">ভিডিও লিংকটি সঠিক নয়।</span>';
 const host=u.hostname.toLowerCase().replace(/^www\./,'');
 const title={youtube:'YouTube',facebook:'Facebook',tiktok:'TikTok'}[type]||'Video';
 let frame='',frameClass='';
 if(type==='youtube'&&['youtube.com','m.youtube.com','youtu.be','youtube-nocookie.com'].includes(host)){
  const id=host==='youtu.be'?u.pathname.split('/').filter(Boolean)[0]:(u.searchParams.get('v')||u.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1]);
  if(id&&/^[\w-]{6,20}$/.test(id)){if(/\/shorts\//i.test(u.pathname))frameClass=' youtube-shorts-frame';frame='<iframe src="https://www.youtube-nocookie.com/embed/'+esc(id)+'" title="YouTube video" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>'}
 }else if(type==='facebook'&&['facebook.com','m.facebook.com','web.facebook.com','fb.watch'].includes(host)){
  frame='<div class="fb-video" data-href="'+esc(u.href)+'" data-allowfullscreen="true" data-show-text="false" data-lazy="true"><div class="fb-xfbml-parse-ignore"><blockquote cite="'+esc(u.href)+'"><a href="'+esc(u.href)+'">Facebook video</a></blockquote></div></div>';
 }else if(type==='tiktok'&&['tiktok.com','m.tiktok.com','vt.tiktok.com','vm.tiktok.com','tiktokv.com','www.tiktokv.com'].includes(host)){
  const id=u.pathname.match(/\/video\/(\d{10,25})/)?.[1]||u.pathname.match(/\/player\/v1\/(\d{10,25})/)?.[1];
  const allow='accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share';
  if(id)frame='<div class="product-video-frame tiktok-player-frame"><iframe src="https://www.tiktok.com/player/v1/'+esc(id)+'?controls=1&play_button=1&description=1&music_info=1&rel=0" title="TikTok video" loading="lazy" allow="'+allow+'" allowfullscreen></iframe></div>';
  else frame='<div class="product-video-frame tiktok-player-frame tiktok-resolve" data-tiktok-url="'+esc(u.href)+'"><p class="product-video-fallback">TikTok ভিডিও লোড হচ্ছে...</p></div>';
 }
 const fallback='<a class="product-video-link" href="'+esc(u.href)+'" target="_blank" rel="noopener noreferrer">মূল '+title+' ভিডিও দেখুন ↗</a>';
 let playerMarkup='';
 if(type==='facebook'&&frame)playerMarkup='<div class="product-video-frame facebook-video-frame">'+frame+'</div>';
 else if(type==='tiktok'&&frame)playerMarkup=frame;
 else if(frame)playerMarkup='<div class="product-video-frame'+frameClass+'">'+frame+'</div>';
 else playerMarkup='<p class="product-video-fallback">এই লিংকটি Embed করা যাচ্ছে না।</p>';
 return '<article class="product-video-card"><h3>'+title+'</h3>'+playerMarkup+fallback+'</article>';
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
   iframe.src='https://www.tiktok.com/player/v1/'+encodeURIComponent(result.id)+'?controls=1&play_button=1&description=1&music_info=1&rel=0';
   iframe.title='TikTok video';iframe.loading='lazy';iframe.allow='accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share';iframe.allowFullscreen=true;
   const wrapper=document.createElement('div');wrapper.className='product-video-frame tiktok-player-frame';wrapper.appendChild(iframe);frame.replaceWith(wrapper);
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
 const root=$('productDetail');
 if(!root||!root.querySelector('.fb-video'))return;
 const parse=()=>{if(window.FB?.XFBML?.parse){window.FB.XFBML.parse(root);return true}return false};
 if(parse())return;
 const previous=window.fbAsyncInit;
 window.fbAsyncInit=function(){
  try{if(typeof previous==='function')previous()}catch(error){console.warn('Facebook SDK init callback failed',error)}
  parse();
 };
 let sdk=document.querySelector('script[src*="connect.facebook.net"][src*="sdk.js"]');
 if(!sdk){
  sdk=document.createElement('script');sdk.async=true;sdk.defer=true;sdk.crossOrigin='anonymous';
  sdk.src='https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v27.0';
  document.head.appendChild(sdk);
 }
}
function renderProductVideos(){const entries=[['youtube',product.youtube_video_url],['facebook',product.facebook_video_url],['tiktok',product.tiktok_video_url]].filter(x=>String(x[1]||'').trim());return entries.length?'<section class="product-videos"><h2>Product Videos</h2><div class="product-video-grid">'+entries.map(([type,url])=>videoEmbed(type,String(url).trim())).join('')+'</div></section>':''}
async function showAdminProductShortcut(){const tools=$('adminProductTools');if(!tools||!db)return;try{const {data:{session}}=await db.auth.getSession();if(!session?.user)return;const {data,error}=await db.from('profiles').select('role').eq('id',session.user.id).single();if(error||!['admin','main_admin'].includes(data?.role))return;tools.innerHTML='<a class="detail-admin-edit" href="./admin.html?edit='+encodeURIComponent(product.id)+'">✎ Edit Product</a>';tools.hidden=false}catch(e){console.warn('Admin shortcut permission check failed',e)}}

function selectedOrderItem(){if(!product)return null;const variants=Array.isArray(product.variants)?product.variants:[],legacy=Array.isArray(product.colors)?product.colors:[];if((variants.length||legacy.length)&&!selectedColor){toast('অর্ডারের আগে Colour নির্বাচন করুন');return null}const price=selectedVariant?Number(selectedVariant.price):Number(product.price),stock=selectedVariant?Number(selectedVariant.stock):Number(product.stock),image=currentImages[0]||product.image_url||'';if(stock<1){toast('দুঃখিত, নির্বাচিত Colour স্টক আউট');return null}return {id:product.id,name:product.name,price,qty:1,stock,color:selectedColor,image}}
function addDetailCart(){const item=selectedOrderItem();if(!item)return;let cart=[];try{cart=JSON.parse(localStorage.getItem('pm_cart')||'[]')}catch{}const key=String(item.id)+'::'+(item.color||''),found=cart.find(x=>String(x.id)+'::'+(x.color||'')===key);if(found){if(found.qty>=item.stock){toast('স্টকের চেয়ে বেশি যোগ করা যাবে না');return}found.qty++}else cart.push(item);localStorage.setItem('pm_cart',JSON.stringify(cart));toast('কার্টে যোগ হয়েছে');$('detailCart').hidden=false}
function orderDetailNow(){const item=selectedOrderItem();if(!item)return;try{sessionStorage.setItem('pm_direct_order',JSON.stringify([item]));location.href='./?checkout=direct'}catch(error){toast('সরাসরি অর্ডার শুরু করা যায়নি। আবার চেষ্টা করুন।')}}
function showImage(url,index){const main=$('detailMainImage');main.innerHTML=url?'<img src="'+esc(url)+'" alt="'+esc(product.name)+'">':'<span class="placeholder">⚙</span>';document.querySelectorAll('.detail-thumb').forEach((b,i)=>b.classList.toggle('active',i===index))}
function renderGallery(images){currentImages=[...new Set((images||[]).filter(Boolean))];$('detailThumbs').innerHTML=currentImages.map((url,i)=>'<button class="detail-thumb '+(i===0?'active':'')+'" data-image="'+i+'" aria-label="ছবি '+(i+1)+'"><img src="'+esc(url)+'" alt="'+esc(product.name)+' ছবি '+(i+1)+'"></button>').join('');showImage(currentImages[0]||'',0);document.querySelectorAll('[data-image]').forEach(b=>b.onclick=()=>showImage(currentImages[Number(b.dataset.image)],Number(b.dataset.image)))}
function updateSelectedVariant(name){const variants=Array.isArray(product.variants)?product.variants:[];selectedColor=name||'';selectedVariant=variants.find(v=>String(v.name).toLocaleLowerCase()===String(selectedColor).toLocaleLowerCase())||null;const variant=selectedVariant;const images=variant&&Array.isArray(variant.images)&&variant.images.length?variant.images:[product.image_url,...(Array.isArray(product.images)?product.images:[])];renderGallery(images);$('detailPrice').textContent=money(variant?variant.price:product.price);const stock=variant?Number(variant.stock):Number(product.stock);$('detailStock').textContent=stock>0?'ইন স্টক':'স্টক আউট';$('detailAdd').disabled=stock<1;document.querySelectorAll('[data-color]').forEach(b=>{const active=b.dataset.color===selectedColor;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active))});const base=document.querySelector('[data-main-image]');if(base){base.classList.toggle('selected',!selectedColor);base.setAttribute('aria-pressed',String(!selectedColor))}}
function render(){const variants=Array.isArray(product.variants)?product.variants:[],colors=variants.length?variants.map(v=>v.name):(Array.isArray(product.colors)?product.colors:[]),baseImages=[product.image_url,...(Array.isArray(product.images)?product.images:[])];$('productDetail').innerHTML='<div class="detail-layout"><section class="detail-gallery"><div class="detail-main-image" id="detailMainImage"></div><div class="detail-thumbs" id="detailThumbs"></div></section><section class="detail-info"><span class="detail-category">'+esc(product.category||'অন্যান্য')+'</span><h1>'+esc(product.name)+'</h1><div class="detail-price" id="detailPrice">'+money(product.price)+'</div><div class="detail-meta"><span>বাইক মডেল: <b>'+esc(product.compatibility||'উল্লেখ নেই')+'</b></span><span>স্টক: <b id="detailStock">'+(Number(product.stock)>0?'ইন স্টক':'স্টক আউট')+'</b></span><span>ক্যাটাগরি: <b>'+esc(product.category||'উল্লেখ নেই')+'</b></span></div><div class="detail-description">'+esc(product.description||'এই পণ্যের জন্য বিস্তারিত বিবরণ দেওয়া হয়নি।')+'</div><div id="adminProductTools" class="detail-admin-tools" hidden></div>'+(colors.length?'<div class="detail-color"><b>Colour নির্বাচন করুন</b><div class="detail-color-options"><button type="button" class="detail-color-option" data-main-image aria-pressed="true">মূল ছবি</button>'+colors.map(c=>'<button type="button" class="detail-color-option" data-color="'+esc(c)+'" aria-pressed="false">'+esc(c)+'</button>').join('')+'</div></div>':'')+'<div class="detail-actions"><button class="detail-order" id="detailOrder" '+(Number(product.stock)<1?'disabled':'')+'>Order Now</button><button class="detail-add" id="detailAdd" '+(Number(product.stock)<1?'disabled':'')+'>Add to Cart</button><a class="detail-cart" id="detailCart" href="./?cart=1" hidden>কার্ট দেখুন</a></div></section></div>';renderGallery(baseImages);$('detailAdd').onclick=addDetailCart;$('detailOrder').onclick=orderDetailNow;document.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>updateSelectedVariant(b.dataset.color));const mainImageButton=document.querySelector('[data-main-image]');if(mainImageButton)mainImageButton.onclick=()=>updateSelectedVariant('');if(!colors.length){selectedColor='';selectedVariant=null}const videoMarkup=renderProductVideos();if(videoMarkup){$('productDetail').insertAdjacentHTML('beforeend',videoMarkup);parseFacebookEmbeds();resolveTikTokEmbeds()}showAdminProductShortcut()}
async function init(){const id=new URLSearchParams(location.search).get('id');if(!id||!db){$('productDetail').innerHTML='<div class="empty">পণ্যটি পাওয়া যায়নি। <a href="./">হোমপেজে ফিরে যান</a></div>';return}const {data,error}=await db.from('products').select('*').eq('id',id).eq('active',true).maybeSingle();if(error||!data){$('productDetail').innerHTML='<div class="empty">পণ্যটি পাওয়া যায়নি অথবা মুছে ফেলা হয়েছে। <a href="./">হোমপেজে ফিরে যান</a></div>';return}product=data;let recent=[];try{recent=JSON.parse(localStorage.getItem("pm_recently_viewed")||"[]").map(String)}catch{}recent=[String(product.id),...recent.filter(x=>x!==String(product.id))].slice(0,8);localStorage.setItem("pm_recently_viewed",JSON.stringify(recent));document.title=product.name+" | PARTS MARKET";render()}
init();