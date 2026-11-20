// PARTS MARKET storefront. Configure Supabase in config.js before publishing.
const CFG = window.PM_CONFIG || {};
const supabaseReady = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase);
const db = supabaseReady ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;
let appliedCoupon = {code:"", discount:0};
let products = [], categories = [], cart = JSON.parse(localStorage.getItem("pm_cart") || "[]"), activeCategory = "সব", currentUser = null, wishlistIds = JSON.parse(localStorage.getItem("pm_wishlist") || "[]"), wishlistMode = false;

const $ = (id) => document.getElementById(id);
const money = (n) => "৳" + Number(n || 0).toLocaleString("en-BD");
const esc = (s="") => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function toast(msg){$("toast").textContent=msg;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),2500)}
function saveCart(){localStorage.setItem("pm_cart",JSON.stringify(cart));renderCart()}
function showModal(id){$(id).classList.add("show");$("overlay").classList.add("show")}
function hideModal(id){$(id).classList.remove("show");if(!document.querySelector(".modal.show")&&!$("cartDrawer").classList.contains("open"))$("overlay").classList.remove("show")}
function openCart(){$("cartDrawer").classList.add("open");$("overlay").classList.add("show")}
function closeCart(){$("cartDrawer").classList.remove("open");if(!document.querySelector(".modal.show"))$("overlay").classList.remove("show")}
function fallbackProducts(){return [
{id:"demo-1",name:"CNC Master Cylinder",price:5000,category:"Brake",stock:5,compatibility:"Universal",description:"Premium CNC brake master cylinder",image:"",demo:true},
{id:"demo-2",name:"Adeline Clutch Lever",price:2800,category:"Clutch",stock:8,compatibility:"Universal",description:"Precision clutch lever",image:"",demo:true},
{id:"demo-3",name:"Mini LED Turn Signal",price:950,category:"Lighting",stock:12,compatibility:"Universal",description:"Compact bright LED indicator",image:"",demo:true},
{id:"demo-4",name:"Handle Crown Set",price:4000,category:"Accessories",stock:3,compatibility:"Sports Bikes",description:"Stylish alloy handle crown",image:"",demo:true}
]}
async function loadCategories(){
  if(!db){categories=["Brake","Clutch","Accessories","Lighting","Other"].map(name=>({name}));renderCategories();return}
  const {data,error}=await db.from("categories").select("name").order("name");
  if(error){console.error("Category load:",error);$("categoryGrid").innerHTML='<div class="empty">ক্যাটাগরি লোড করা যায়নি।</div>';return}
  categories=data||[];renderCategories();renderCategoryOptions();
}
function renderCategories(){
  const grid=$("categoryGrid");if(!grid)return;
  grid.innerHTML='<button class="category-tile '+(activeCategory==="সব"?"active":"")+'" data-category="সব"><span>⚙</span><b>সব পণ্য</b></button>'+categories.map((c,i)=>'<button class="category-tile '+(activeCategory===c.name?"active":"")+'" data-category="'+esc(c.name)+'"><span>'+(["◉","⌁","✦","☼","⚙"][i%5])+'</span><b>'+esc(c.name)+'</b></button>').join("");
  grid.querySelectorAll("[data-category]").forEach(b=>b.onclick=()=>{activeCategory=b.dataset.category;renderCategories();renderProducts()});
}
function renderCategoryOptions(selected=""){
  const select=$("productCategory");if(!select)return;
  select.innerHTML=categories.map(c=>'<option value="'+esc(c.name)+'">'+esc(c.name)+'</option>').join("");
  if(selected&&categories.some(c=>c.name===selected))select.value=selected;
}
async function refreshCategoryManager(){
  const {data,error}=await db.from("categories").select("name").order("name");
  if(error){$("adminCategories").textContent=error.message;return}
  categories=data||[];renderCategories();renderCategoryOptions();
  $("adminCategories").innerHTML=categories.map(c=>'<div class="admin-item"><b>'+esc(c.name)+'</b><span><button data-cat-edit="'+esc(c.name)+'">এডিট</button><button data-cat-delete="'+esc(c.name)+'">ডিলিট</button></span></div>').join("")||"কোনো ক্যাটাগরি নেই";
  document.querySelectorAll("[data-cat-edit]").forEach(b=>b.onclick=()=>{const f=$("categoryForm");f.elements.old_name.value=b.dataset.catEdit;f.elements.name.value=b.dataset.catEdit;$("categoryMessage").textContent="এডিট মোড"});
  document.querySelectorAll("[data-cat-delete]").forEach(b=>b.onclick=()=>deleteCategory(b.dataset.catDelete));
}
async function saveCategory(e){
  e.preventDefault();const f=e.target,old=f.elements.old_name.value.trim(),name=f.elements.name.value.trim();
  if(!name){$("categoryMessage").textContent="ক্যাটাগরির নাম লিখুন";return}
  $("categoryMessage").textContent="সেভ হচ্ছে...";
  if(old){
    const {count,error:countError}=await db.from("products").select("id",{count:"exact",head:true}).eq("category",old);
    if(countError){$("categoryMessage").textContent=countError.message;return}
    const {error}=await db.from("categories").update({name}).eq("name",old);
    if(error){$("categoryMessage").textContent=error.message;return}
    if(old!==name&&count){const {error:moveError}=await db.from("products").update({category:name}).eq("category",old);if(moveError){$("categoryMessage").textContent="ক্যাটাগরি বদলেছে, কিন্তু পণ্য আপডেট হয়নি: "+moveError.message;return}}
  }else{
    const {error}=await db.from("categories").insert({name});
    if(error){$("categoryMessage").textContent=error.message;return}
  }
  f.reset();$("categoryMessage").textContent="ক্যাটাগরি সেভ হয়েছে";await refreshCategoryManager();await loadProducts();
}
async function deleteCategory(name){
  if(!confirm('"'+name+'" ক্যাটাগরি মুছতে চান?'))return;
  const {count,error:countError}=await db.from("products").select("id",{count:"exact",head:true}).eq("category",name);
  if(countError){toast(countError.message);return}
  if(count>0){toast("এই ক্যাটাগরিতে পণ্য আছে। আগে পণ্যগুলো অন্য ক্যাটাগরিতে সরান।");return}
  const {error}=await db.from("categories").delete().eq("name",name);
  if(error){toast(error.message);return}
  if(activeCategory===name)activeCategory="সব";
  toast("ক্যাটাগরি মুছে ফেলা হয়েছে");await refreshCategoryManager();
}
async function loadProducts(){
  $("productGrid").innerHTML='<div class="loading">পণ্য লোড হচ্ছে...</div>';
  if(db){const {data,error}=await db.from("products").select("*").eq("active",true).order("created_at",{ascending:false});if(!error)products=data||[];else{console.error(error);products=[]}}
  else products=fallbackProducts();
  renderCompatibilityOptions();renderProducts();
}
function renderCompatibilityOptions(){
 const select=$("bikeFilter");if(!select)return;
 const current=select.value;
 const models=[...new Set(products.map(p=>String(p.compatibility||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
 select.innerHTML='<option value="">সব বাইকের পার্টস</option>'+models.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join("");
 if(models.includes(current))select.value=current;
}
function toggleWishlist(id){
 const key=String(id);
 wishlistIds=wishlistIds.map(String);
 wishlistIds=wishlistIds.includes(key)?wishlistIds.filter(x=>x!==key):[...wishlistIds,key];
 localStorage.setItem("pm_wishlist",JSON.stringify(wishlistIds));
 updateWishlistButton();renderProducts();
}
function updateWishlistButton(){
 const b=$("wishlistToggle");if(!b)return;
 $("wishlistCount").textContent=wishlistIds.length;
 b.setAttribute("aria-pressed",String(wishlistMode));
 b.classList.toggle("active",wishlistMode);
 b.innerHTML=(wishlistMode?"♥":"♡")+" পছন্দের পণ্য <span id=\"wishlistCount\">"+wishlistIds.length+"</span>";
}
function renderProducts(){
 const term=$("search").value.trim().toLowerCase(),bike=$("bikeFilter")?.value||"";
 const list=products.filter(p=>(activeCategory==="সব"||p.category===activeCategory)&&(!bike||String(p.compatibility||"").trim()===bike)&&(!wishlistMode||wishlistIds.includes(String(p.id)))&&(`${p.name} ${p.category} ${p.compatibility||""}`.toLowerCase().includes(term)));
 $("productCount").textContent=`${list.length}টি পণ্য`;
 $("productGrid").innerHTML=list.length?list.map(p=>{
  const saved=wishlistIds.includes(String(p.id));
  return `<article class="product-card"><button type="button" class="wishlist-heart ${saved?"saved":""}" data-wishlist="${esc(p.id)}" aria-label="পছন্দের তালিকায় ${saved?"আছে":"যোগ করুন"}">${saved?"♥":"♡"}</button><a class="product-card-link" href="./product.html?id=${encodeURIComponent(p.id)}" aria-label="${esc(p.name)} বিস্তারিত দেখুন"><div class="product-image">${p.image_url||p.image?`<img src="${esc(p.image_url||p.image)}" alt="${esc(p.name)}" loading="lazy">`:'<span class="placeholder">⚙</span>'}<span class="stock-tag">${Number(p.stock)>0?"ইন স্টক":"স্টক আউট"}</span></div><div class="product-info"><small>${esc(p.category||"OTHER")}</small><h3>${esc(p.name)}</h3><p>${esc(p.compatibility||p.description||"")}</p><div class="product-bottom"><b class="price">${money(p.price)}</b><span class="add-btn">View Details →</span></div></div></a></article>`;
 }).join(""):'<div class="empty">কোনো পণ্য পাওয়া যায়নি।</div>';
 document.querySelectorAll("[data-wishlist]").forEach(b=>b.onclick=()=>toggleWishlist(b.dataset.wishlist));
 updateWishlistButton();
}function cartKey(x){return String(x.id)+"::"+(x.color||"")}
function addToCart(id,color=""){
 const p=products.find(x=>String(x.id)===String(id));if(!p)return;
 const available=Array.isArray(p.colors)?p.colors:[];
 if(available.length&&!available.includes(color)){toast("কার্টে যোগ করার আগে কালার নির্বাচন করুন");return}
 const found=cart.find(x=>cartKey(x)===String(id)+"::"+color);
 if(found){if(found.qty>=Number(p.stock)){toast("স্টকের চেয়ে বেশি যোগ করা যাবে না");return}found.qty++}
 else cart.push({id:p.id,name:p.name,price:Number(p.price),qty:1,stock:Number(p.stock),color});
 saveCart();toast("কার্টে যোগ হয়েছে");
}
function renderCart(){
 $("cartCount").textContent=cart.reduce((n,x)=>n+x.qty,0);
 $("cartItems").innerHTML=cart.length?cart.map(x=>`<div class="cart-row"><div><b>${esc(x.name)}</b><small>${x.color?"কালার: "+esc(x.color)+" · ":""}${money(x.price)} × ${x.qty}</small></div><div class="qty-controls"><button data-dec="${esc(cartKey(x))}">−</button><b>${x.qty}</b><button data-inc="${esc(cartKey(x))}">+</button></div></div>`).join(""):'<div class="empty">কার্ট এখনো খালি।</div>';
 $("cartTotal").textContent=money(cart.reduce((n,x)=>n+x.price*x.qty,0));
 document.querySelectorAll("[data-dec]").forEach(b=>b.onclick=()=>changeQty(b.dataset.dec,-1));
 document.querySelectorAll("[data-inc]").forEach(b=>b.onclick=()=>changeQty(b.dataset.inc,1));
}
function changeQty(key,d){const x=cart.find(i=>cartKey(i)===key);if(!x)return;if(d>0&&x.qty>=x.stock){toast("স্টকের চেয়ে বেশি যোগ করা যাবে না");return}x.qty+=d;if(x.qty<1)cart=cart.filter(i=>cartKey(i)!==key);saveCart()}

function renderCouponSummary(){const subtotal=cart.reduce((n,x)=>n+Number(x.price||0)*Number(x.qty||0),0);const area=$('checkoutForm')?.elements.delivery_area?.value;const fee=area==='inside_dhaka'?80:area==='outside_dhaka'?150:0;const discount=appliedCoupon.code?Math.min(appliedCoupon.discount,subtotal):0;if($('checkoutSubtotal'))$('checkoutSubtotal').textContent=money(subtotal);if($('checkoutDiscount'))$('checkoutDiscount').textContent=money(discount);if($('checkoutDelivery'))$('checkoutDelivery').textContent=money(fee);if($('checkoutGrandTotal'))$('checkoutGrandTotal').textContent=money(subtotal-discount+fee);if($('removeCoupon'))$('removeCoupon').hidden=!appliedCoupon.code}
async function applyCoupon(){const code=$('couponCode').value.trim().toUpperCase();if(!code){$('couponMessage').textContent='কুপন কোড লিখুন।';return}if(!db){$('couponMessage').textContent='সার্ভারের সাথে সংযোগ নেই।';return}$('couponMessage').textContent='কুপন যাচাই হচ্ছে...';const {data,error}=await db.rpc('get_coupon_discount',{p_coupon_code:code});if(error){$('couponMessage').textContent='কুপন যাচাই করা যায়নি: '+error.message;return}if(data==null){$('couponMessage').textContent='কুপনটি ভুল, বন্ধ অথবা ব্যবহারের সীমা শেষ।';appliedCoupon={code:'',discount:0};renderCouponSummary();return}const subtotal=cart.reduce((n,x)=>n+Number(x.price||0)*Number(x.qty||0),0);appliedCoupon={code,discount:Number(data)};$('couponMessage').textContent='সফল! '+money(Math.min(Number(data),subtotal))+' ছাড় প্রযোজ্য হয়েছে।';renderCouponSummary()}
async function checkout(e) {
  e.preventDefault();

  if (!cart.length) {
    toast("কার্ট খালি");
    return;
  }

  const f = new FormData(e.target);

  const customer = {
    name: f.get("customer_name").trim(),
    phone: f.get("phone").trim(),
    address: f.get("address").trim(),
    note: f.get("note").trim(),
    deliveryArea: f.get("delivery_area")
  };

  const deliveryFee = customer.deliveryArea === "inside_dhaka" ? 80 :
    customer.deliveryArea === "outside_dhaka" ? 150 : null;
  if (deliveryFee === null) {
    $("checkoutMessage").textContent = "ডেলিভারি এলাকা নির্বাচন করুন।";
    return;
  }
  const paymentLast3 = String(f.get("payment_last3") || "").trim();
  if (!/^[0-9]{3}$/.test(paymentLast3)) {
    $("checkoutMessage").textContent = "পেমেন্টের ট্রানজেকশনের শেষ ৩টি সংখ্যা লিখুন।";
    return;
  }

  const orderedItems = cart.map(x => ({ ...x }));
  const subtotal = orderedItems.reduce(
    (sum, x) => sum + x.price * x.qty, 0
  );
  const couponCode = appliedCoupon.code || "";
  const discount = couponCode ? Math.min(appliedCoupon.discount, subtotal) : 0;
  const total = subtotal - discount + deliveryFee;

  const payload = {
    p_customer_name: customer.name,
    p_phone: customer.phone,
    p_address: customer.address,
    p_note: customer.note,
    p_delivery_area: customer.deliveryArea,
    p_delivery_fee: deliveryFee,
    p_payment_last3: String(f.get("payment_last3") || "").trim(),
    p_coupon_code: couponCode || null,
    p_items: orderedItems.map(x => ({
      product_id: x.id,
      selected_color: x.color || null,
      quantity: x.qty
    }))
  };

  $("checkoutMessage").textContent = "অর্ডার পাঠানো হচ্ছে...";

  if (!db) {
    $("checkoutMessage").textContent =
      "Supabase সেটআপ করা হয়নি।";
    return;
  }

  const { data, error } = await db.rpc("place_order", payload);

  if (error) {
    $("checkoutMessage").textContent = error.message;
    return;
  }

  // Create WhatsApp order message
  const itemText = orderedItems.map((x, i) =>
    `${i + 1}. ${x.name}${x.color ? " (Color: " + x.color + ")" : ""} × ${x.qty} = ${money(x.price * x.qty)}`
  ).join("\n");

  const message =
`🛒 NEW ORDER - PARTS MARKET

Order Number: ${data}

Customer Name: ${customer.name}
Phone: ${customer.phone}
Address: ${customer.address}

ORDER DETAILS:
${itemText}

পণ্যের মূল্য: ${money(subtotal)}
অগ্রিম কুরিয়ার চার্জ: ${money(deliveryFee)}
পণ্য হাতে পেয়ে COD পরিশোধ: ${money(subtotal)}
সর্বমোট অর্ডার মূল্য: ${money(total)}
পেমেন্ট মাধ্যম: বিকাশ মার্চেন্ট / নগদ পার্সোনাল
ট্রানজেকশনের শেষ ৩ সংখ্যা: ${paymentLast3}
পেমেন্ট স্ক্রিনশট: এই WhatsApp চ্যাটে সংযুক্ত করে পাঠাবেন।

Customer Note: ${customer.note || "নেই"}

Order Status: Pending — অগ্রিম পেমেন্ট যাচাই বাকি

অর্ডার নিশ্চিত হওয়ার পর ৭২ ঘণ্টার মধ্যে ডেলিভারি (ইনশাআল্লাহ)।
- Parts Market`;

  const whatsappURL =
    "https://wa.me/8801954191730?text=" +
    encodeURIComponent(message);

  // Clear cart after successful database order
  cart = [];
  saveCart();
  e.target.reset();

  $("checkoutMessage").textContent =
    "🎉 আপনার অর্ডার প্রায় সম্পন্ন!";

  // Remove previous WhatsApp button
  document.getElementById("whatsappOrderButton")?.remove();

  // Show instruction
  const instruction = document.createElement("p");
  instruction.textContent =
    "অর্ডারটি এখন Pending। WhatsApp-এ অর্ডারের মেসেজ পাঠিয়ে ডেলিভারি চার্জের পেমেন্ট স্ক্রিনশট সংযুক্ত করুন। পেমেন্ট যাচাইয়ের পর আমরা অর্ডার Confirmed করব।";

  instruction.style.cssText =
    "margin:12px 0;padding:12px;background:#e8f7ed;color:#176b35;border-radius:10px;line-height:1.7;";

  $("checkoutMessage").appendChild(instruction);

  // Create WhatsApp button
  const button = document.createElement("button");
  button.id = "whatsappOrderButton";
  button.type = "button";
  button.textContent = "🟢 Send Order on WhatsApp";

  button.style.cssText =
    "width:100%;padding:14px;margin-top:10px;background:#25D366;color:white;border:0;border-radius:10px;font-size:16px;font-weight:bold;cursor:pointer;";

  button.onclick = () => {
    window.open(whatsappURL, "_blank");
  };

  $("checkoutMessage").appendChild(button);

  toast("অর্ডার সফলভাবে সংরক্ষিত হয়েছে");
}

let adminOrdersCache=[], adminOrderFilter="all";
const bnNum=n=>Number(n||0).toLocaleString("bn-BD");
function setAdminTab(tab){
 document.querySelectorAll("[data-admin-view]").forEach(v=>v.classList.toggle("active",v.dataset.adminView===tab));
 document.querySelectorAll("[data-admin-tab]").forEach(b=>b.classList.toggle("active",b.dataset.adminTab===tab));
 const titles={dashboard:"ড্যাশবোর্ড",products:"পণ্য ব্যবস্থাপনা",categories:"ক্যাটাগরি",orders:"অর্ডার",customers:"কাস্টমার",settings:"সেটিংস"};
 $("adminPageTitle").textContent=titles[tab]||"ড্যাশবোর্ড";
 if(tab==="products") $("adminProductSearch")?.focus();
}
function renderAdminOrders(){
 const list=adminOrderFilter==="all"?adminOrdersCache:adminOrdersCache.filter(o=>o.status===adminOrderFilter);
 $("adminOrders").innerHTML=list.length?list.map(o=>`<article class="order-card"><div class="order-card-top"><div><b>#${esc(o.id)} · ${esc(o.customer_name)}</b><small>${new Date(o.created_at).toLocaleString("bn-BD")}</small></div><span class="order-badge status-${esc(o.status)}">${esc(o.status)}</span></div><div class="order-customer"><span>☎ ${esc(o.phone)}</span><span>মোট: ${money(o.total)}</span></div><p class="order-address">${esc(o.address)}</p><div class="payment-note" style="margin:8px 0;padding:10px;border-radius:8px;background:#25252b;color:#fff;line-height:1.7"><b>অগ্রিম পেমেন্ট যাচাই</b><br>ডেলিভারি চার্জ: ${money(o.delivery_fee)} · COD আদায়: ${money(Math.max(0,Number(o.total||0)-Number(o.delivery_fee||0)))}<br>ট্রানজেকশনের শেষ ৩ সংখ্যা: <b>${esc(o.payment_last3||"তথ্য নেই")}</b><br><small>WhatsApp-এ পাঠানো পেমেন্ট স্ক্রিনশট দেখে যাচাই করে তারপর Confirmed করুন।</small></div><div class="order-card-bottom"><button class="text-action" data-order-detail="${esc(o.id)}">বিস্তারিত</button><select data-status="${esc(o.id)}"><option value="pending" ${o.status==="pending"?"selected":""}>Pending</option><option value="confirmed" ${o.status==="confirmed"?"selected":""}>Confirmed</option><option value="shipped" ${o.status==="shipped"?"selected":""}>Shipped</option><option value="delivered" ${o.status==="delivered"?"selected":""}>Delivered</option><option value="cancelled" ${o.status==="cancelled"?"selected":""}>Cancelled</option></select></div><div class="courier-editor"><label>Steadfast Consignment ID<input id="consignment-${esc(o.id)}" value="${esc(o.consignment_id||"")}" placeholder="Consignment ID"></label><label>Tracking Code<input id="tracking-${esc(o.id)}" value="${esc(o.tracking_code||"")}" placeholder="Tracking Code"></label><label>কুরিয়ার স্ট্যাটাস<input id="courier-status-${esc(o.id)}" value="${esc(o.courier_status||"")}" placeholder="যেমন: Picked, In Transit, Delivered"></label><button type="button" class="text-action" data-save-courier="${esc(o.id)}">কুরিয়ার তথ্য সেভ করুন</button></div><div class="order-detail" id="orderDetail-${esc(o.id)}" hidden><b>নোট:</b> ${esc(o.note||"কোনো নোট নেই")}<div id="orderItems-${esc(o.id)}">পণ্যের তথ্য লোড হচ্ছে...</div></div></article>`).join(""):'<div class="empty">এই ক্যাটাগরিতে কোনো অর্ডার নেই।</div>';
 document.querySelectorAll("[data-status]").forEach(s=>s.onchange=async()=>{const {error}=await db.from("orders").update({status:s.value}).eq("id",s.dataset.status);if(error){toast(error.message);return}const o=adminOrdersCache.find(x=>String(x.id)===s.dataset.status);if(o)o.status=s.value;toast("অর্ডারের অবস্থা আপডেট হয়েছে");updateAdminStats();renderAdminOrders()});
 document.querySelectorAll("[data-save-courier]").forEach(b=>b.onclick=async()=>{const id=b.dataset.saveCourier;b.disabled=true;b.textContent="সেভ হচ্ছে...";const payload={consignment_id:$("consignment-"+id).value.trim()||null,tracking_code:$("tracking-"+id).value.trim()||null,courier_status:$("courier-status-"+id).value.trim()||null,courier_name:"Steadfast"};const {error}=await db.from("orders").update(payload).eq("id",id);b.disabled=false;b.textContent="কুরিয়ার তথ্য সেভ করুন";if(error){toast("সেভ হয়নি: "+error.message);return}const order=adminOrdersCache.find(x=>String(x.id)===id);if(order)Object.assign(order,payload);toast("Steadfast তথ্য সেভ হয়েছে")});
 document.querySelectorAll("[data-order-detail]").forEach(b=>b.onclick=async()=>{const id=b.dataset.orderDetail,box=$("orderDetail-"+id);box.hidden=!box.hidden;if(!box.hidden){const {data,error}=await db.from("order_items").select("product_name,unit_price,quantity,selected_color").eq("order_id",id);$("orderItems-"+id).innerHTML=error?esc(error.message):(data||[]).map(x=>`<p>${esc(x.product_name)}${x.selected_color ? " · কালার: "+esc(x.selected_color) : ""} × ${x.quantity} — ${money(x.unit_price*x.quantity)}</p>`).join("")||"পণ্যের তথ্য নেই"}});
}
function updateAdminStats(ps=[]){
 const total=adminOrdersCache.reduce((n,o)=>n+Number(o.total||0),0),pending=adminOrdersCache.filter(o=>o.status==="pending").length;
 $("statProducts").textContent=bnNum(ps.length);$("statCategories").textContent=bnNum(categories.length);$("statOrders").textContent=bnNum(adminOrdersCache.length);$("statPending").textContent=bnNum(pending);$("statRevenue").textContent=money(total);
 $("navPendingCount").textContent=bnNum(pending);
 const counts={all:adminOrdersCache.length,pending:pending,confirmed:0,shipped:0,delivered:0,cancelled:0};adminOrdersCache.forEach(o=>{if(o.status in counts)counts[o.status]++});
 Object.entries(counts).forEach(([k,v])=>{const el=$("count"+k[0].toUpperCase()+k.slice(1));if(el)el.textContent=bnNum(v)});
}
function renderCustomers(){
 const map=new Map();adminOrdersCache.forEach(o=>{const key=o.phone||o.customer_name;if(!map.has(key))map.set(key,{name:o.customer_name,phone:o.phone,address:o.address,orders:0,total:0});const c=map.get(key);c.orders++;c.total+=Number(o.total||0)});
 const term=($("adminCustomerSearch")?.value||"").toLowerCase();
 const rows=[...map.values()].filter(c=>(c.name+" "+c.phone).toLowerCase().includes(term));
 $("adminCustomers").innerHTML=rows.length?rows.map(c=>`<div class="customer-row"><span class="customer-avatar">${esc((c.name||"?").slice(0,1))}</span><div><b>${esc(c.name)}</b><small>${esc(c.phone)} · ${c.orders}টি অর্ডার</small><small>${esc(c.address||"")}</small></div><strong>${money(c.total)}</strong></div>`).join(""):'<div class="empty">কোনো কাস্টমার পাওয়া যায়নি।</div>';
}
async function refreshAdmin(){
 const [{data:ps,error:pe},{data:orders,error:oe}]=await Promise.all([
  db.from("products").select("*").order("created_at",{ascending:false}),
  db.from("orders").select("*").order("created_at",{ascending:false})
 ]);
 if(pe){$("adminProducts").textContent=pe.message;return}
 if(oe){$("adminOrders").textContent=oe.message;return}
 await refreshCategoryManager();adminOrdersCache=orders||[];updateAdminStats(ps||[]);
 const productTerm=($("adminProductSearch")?.value||"").toLowerCase();
 const filtered=(ps||[]).filter(p=>(p.name+" "+p.category+" "+(p.compatibility||"")).toLowerCase().includes(productTerm));
 $("adminProducts").innerHTML=filtered.map(p=>`<div class="admin-item"><span><b>${esc(p.name)}</b><br><small>${esc(p.category)} · ${money(p.price)} · ${Number(p.stock)>0?"ইন স্টক":"স্টক আউট"}</small></span><span><button data-edit="${p.id}">এডিট</button><button data-delete="${p.id}">ডিলিট</button></span></div>`).join("")||'<div class="empty">কোনো পণ্য নেই</div>';
 document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>{editProduct((ps||[]).find(p=>String(p.id)===b.dataset.edit));$("productForm").hidden=false;$("productForm").scrollIntoView({behavior:"smooth",block:"start"})});
 document.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>deleteProduct(b.dataset.delete));
 $("dashboardRecentOrders").innerHTML=adminOrdersCache.slice(0,5).map(o=>`<div class="recent-order-row"><b>#${esc(o.id)} · ${esc(o.customer_name)}</b><span>${money(o.total)}</span><i class="order-badge status-${esc(o.status)}">${esc(o.status)}</i></div>`).join("")||'<div class="empty">এখনো কোনো অর্ডার নেই</div>';
 renderAdminOrders();renderCustomers();$("adminEmail").textContent=currentUser?.email||"—";
}

function ensureProductColorField(){
 const form=$("productForm");
 if(!form||form.elements.colors)return;
 const nameField=form.querySelector('[name="name"]');
 if(!nameField)return;
 const wrap=document.createElement("label");
 wrap.style.cssText="display:block;margin:14px 0;padding:12px;border:2px solid #e63946;border-radius:9px;background:#24171b;color:#fff;font-weight:700";
 wrap.innerHTML='🎨 পণ্যের কালার / রং<input name="colors" type="text" placeholder="যেমন: Black, Red, Blue" style="display:block;width:100%;margin-top:8px;padding:12px;background:#101318;color:#fff;border:1px solid #e63946;border-radius:7px"><small style="display:block;margin-top:7px;color:#ffd1d5;font-weight:400">একাধিক কালার হলে কমা দিয়ে আলাদা করুন। যেমন: Black, Red, Blue</small>';
 nameField.parentElement.insertAdjacentElement("afterend",wrap);
}
function editProduct(p){ensureProductColorField();const f=$("productForm");["id","name","price","stock","category","compatibility","description"].forEach(k=>f.elements[k].value=p[k]??"");f.elements.colors.value=(p.colors||[]).join(", ");$("productMessage").textContent="এডিট মোড";renderCategoryOptions(p.category)}
async function deleteProduct(id){if(!confirm("এই পণ্যটি মুছে ফেলতে চান?"))return;const {error}=await db.from("products").delete().eq("id",id);if(error)toast(error.message);else{toast("পণ্য মুছে ফেলা হয়েছে");await refreshAdmin();await loadProducts()}}
async function optimizeProductImage(file){
 if(!file.type.startsWith("image/"))throw new Error("শুধু ছবির ফাইল আপলোড করুন।");
 const image=new Image(),objectUrl=URL.createObjectURL(file);
 try{
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error("ছবিটি পড়া যাচ্ছে না। JPG বা PNG ছবি ব্যবহার করুন।"));image.src=objectUrl});
  const scale=Math.min(1,1200/Math.max(image.naturalWidth,image.naturalHeight));
  const width=Math.max(1,Math.round(image.naturalWidth*scale)),height=Math.max(1,Math.round(image.naturalHeight*scale));
  const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("ছবি কমপ্রেস করা যাচ্ছে না।");
  ctx.drawImage(image,0,0,width,height);
  const makeBlob=type=>new Promise(resolve=>canvas.toBlob(resolve,type,0.85));
  let blob=await makeBlob("image/webp"),ext="webp";
  if(!blob||blob.type!=="image/webp"){blob=await makeBlob("image/jpeg");ext="jpg"}
  if(!blob)throw new Error("ছবি কমপ্রেস করা যায়নি। অন্য ছবি দিয়ে চেষ্টা করুন।");
  return new File([blob],`${crypto.randomUUID()}.${ext}`,{type:blob.type,lastModified:Date.now()});
 }finally{URL.revokeObjectURL(objectUrl)}
}
async function saveProduct(e){
 e.preventDefault();const f=e.target,fd=new FormData(f),id=fd.get("id");let image_url=null;const file=f.elements.image.files[0];
 $("productMessage").textContent="সেভ হচ্ছে...";
 if(file){
  let optimizedFile;
  try{optimizedFile=await optimizeProductImage(file)}
  catch(err){$("productMessage").textContent=err.message||"ছবি প্রস্তুত করা যায়নি।";return}
  const path=optimizedFile.name;
  const {error:upErr}=await db.storage.from("product-images").upload(path,optimizedFile,{upsert:false,contentType:optimizedFile.type});
  if(upErr){$("productMessage").textContent=upErr.message;return}
  image_url=db.storage.from("product-images").getPublicUrl(path).data.publicUrl;
  const savedKB=Math.max(1,Math.round(optimizedFile.size/1024));
  $("productMessage").textContent=`ছবি কমপ্রেস হয়েছে (${savedKB} KB)। পণ্য সেভ হচ্ছে...`;
 }
 const colors=[...new Set(String(fd.get("colors")||"").split(",").map(c=>c.trim()).filter(Boolean))];
  const row={name:fd.get("name").trim(),price:Number(fd.get("price")),stock:Number(fd.get("stock")),category:fd.get("category"),compatibility:fd.get("compatibility"),description:fd.get("description"),colors,active:true};
 if(image_url)row.image_url=image_url;
 let q=id?db.from("products").update(row).eq("id",id):db.from("products").insert(row);
 const {error}=await q;if(error){$("productMessage").textContent=error.message;return}
 $("productMessage").textContent="সফলভাবে সেভ হয়েছে";f.reset();f.elements.id.value="";$("productForm").hidden=true;await refreshAdmin();await loadProducts();
}
async function openAdmin(){
 showModal("adminModal");
 if(!db){$("adminAuth").innerHTML='<p class="form-message">Supabase সেটআপ করা হয়নি। README অনুসরণ করে config.js তৈরি করুন।</p>';return}
 const {data:{session}}=await db.auth.getSession();currentUser=session?.user||null;await updateAdminView();
}
async function updateAdminView(){
 if(!currentUser){$("adminAuth").hidden=false;$("adminPanel").hidden=true;return}
 const {data:profile,error}=await db.from("profiles").select("role").eq("id",currentUser.id).single();
 if(error||profile?.role!=="admin"){await db.auth.signOut();currentUser=null;$("loginMessage").textContent="এই অ্যাকাউন্টে অ্যাডমিন অনুমতি নেই।";$("adminAuth").hidden=false;$("adminPanel").hidden=true;return}
 $("adminAuth").hidden=true;$("adminPanel").hidden=false;setAdminTab("dashboard");await refreshAdmin();
}
$("search").addEventListener("input",renderProducts);$("searchBtn").onclick=renderProducts;$("bikeFilter")?.addEventListener("change",renderProducts);$("wishlistToggle")?.addEventListener("click",()=>{wishlistMode=!wishlistMode;updateWishlistButton();renderProducts();$("products").scrollIntoView({behavior:"smooth"})});
document.querySelectorAll("[data-category]").forEach(b=>b.onclick=()=>{activeCategory=b.dataset.category;document.querySelectorAll("[data-category]").forEach(x=>x.classList.toggle("active",x===b));renderProducts()});
$("cartOpen").onclick=openCart;$("cartClose").onclick=closeCart;$("overlay").onclick=()=>{closeCart();document.querySelectorAll(".modal.show").forEach(m=>hideModal(m.id))};
$("checkoutOpen").onclick=()=>{if(!cart.length){toast("কার্ট খালি");return}showModal("checkoutModal")};
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>hideModal(b.dataset.close));
$("checkoutForm").onsubmit=checkout;$("applyCoupon").onclick=applyCoupon;$("removeCoupon").onclick=()=>{appliedCoupon={code:"",discount:0};$("couponCode").value="";$("couponMessage").textContent="কুপন সরানো হয়েছে।";renderCouponSummary()};$("checkoutForm").elements.delivery_area.onchange=renderCouponSummary;$("adminOpen").onclick=openAdmin;
$("loginForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);$("loginMessage").textContent="লগইন হচ্ছে...";const {data,error}=await db.auth.signInWithPassword({email:f.get("email"),password:f.get("password")});if(error){$("loginMessage").textContent=error.message;return}currentUser=data.user;await updateAdminView()};
$("logoutBtn").onclick=async()=>{await db.auth.signOut();currentUser=null;await updateAdminView()};
$("productForm").onsubmit=saveProduct;$("categoryForm").onsubmit=saveCategory;
$("resetCategory").onclick=()=>{$("categoryForm").reset();$("categoryForm").elements.old_name.value="";$("categoryMessage").textContent=""};
$("resetProduct").onclick=()=>{$("productForm").reset();$("productForm").elements.id.value="";$("productMessage").textContent=""};
$("showProductForm").onclick=()=>{ensureProductColorField();$("productForm").hidden=false;$("productForm").scrollIntoView({behavior:"smooth",block:"start"})};
$("closeProductForm").onclick=()=>{$("productForm").hidden=true};
$("adminRefresh").onclick=async()=>{await refreshAdmin();toast("ড্যাশবোর্ড আপডেট হয়েছে")};
$("adminProductSearch").oninput=refreshAdmin;$("adminCustomerSearch").oninput=renderCustomers;
document.querySelectorAll("[data-admin-tab]").forEach(b=>b.onclick=()=>setAdminTab(b.dataset.adminTab));
document.querySelectorAll("[data-go-tab]").forEach(b=>b.onclick=()=>setAdminTab(b.dataset.goTab));
document.querySelectorAll("[data-order-filter]").forEach(b=>b.onclick=()=>{adminOrderFilter=b.dataset.orderFilter;document.querySelectorAll("[data-order-filter]").forEach(x=>x.classList.toggle("active",x===b));renderAdminOrders()});
$("settingsLogout").onclick=$("mobileLogoutBtn").onclick=$("logoutBtn").onclick=async()=>{await db.auth.signOut();currentUser=null;await updateAdminView()};
$("year").textContent=new Date().getFullYear();renderCart();renderCouponSummary();updateWishlistButton();loadCategories().then(loadProducts);

async function loadStoreBranding(){
  if(!db)return;
  const {data,error}=await db.from("store_settings").select("store_name,logo_url,facebook_url,youtube_url,tiktok_url").eq("id",1).maybeSingle();
  if(error||!data)return;
  const name=data.store_name||"PARTS MARKET";
  $("siteBrandName").textContent=name;
  document.title=name+" | Everything in One Place";
  if(data.logo_url){$("siteLogo").src=data.logo_url;$("siteLogo").hidden=false;$("brandMark").hidden=true}
  const items=[["facebook_url","Facebook","f"],["youtube_url","YouTube","▶"],["tiktok_url","TikTok","♪"]];
  $("socialLinks").innerHTML=items.filter(([key])=>data[key]).map(([key,label,mark])=>'<a href="'+esc(data[key])+'" target="_blank" rel="noopener noreferrer" aria-label="'+label+'">'+mark+' '+label+'</a>').join("");
}
loadStoreBranding();
if(new URLSearchParams(location.search).get("cart")==="1"){openCart();history.replaceState({}, "", location.pathname)}
