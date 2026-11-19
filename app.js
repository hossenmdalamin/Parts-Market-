// PARTS MARKET storefront. Configure Supabase in config.js before publishing.
const CFG = window.PM_CONFIG || {};
const supabaseReady = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase);
const db = supabaseReady ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;
let products = [], categories = [], cart = JSON.parse(localStorage.getItem("pm_cart") || "[]"), activeCategory = "সব", currentUser = null;

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
  renderProducts();
}
function renderProducts(){
 const term=$("search").value.trim().toLowerCase();
 const list=products.filter(p=>(activeCategory==="সব"||p.category===activeCategory)&&(`${p.name} ${p.category} ${p.compatibility||""}`.toLowerCase().includes(term)));
 $("productCount").textContent=`${list.length}টি পণ্য`;
 $("productGrid").innerHTML=list.length?list.map(p=>`<article class="product-card"><div class="product-image">${p.image_url||p.image?`<img src="${esc(p.image_url||p.image)}" alt="${esc(p.name)}" loading="lazy">`:'<span class="placeholder">⚙</span>'}<span class="stock-tag">${Number(p.stock)>0?"স্টকে আছে":"স্টক শেষ"}</span></div><div class="product-info"><small>${esc(p.category||"OTHER")}</small><h3>${esc(p.name)}</h3><p>${esc(p.compatibility||p.description||"")}</p><div class="product-bottom"><b class="price">${money(p.price)}</b><button class="add-btn" data-add="${esc(p.id)}" ${Number(p.stock)<1?"disabled":""}>কার্টে +</button></div></div></article>`).join(""):'<div class="empty">কোনো পণ্য পাওয়া যায়নি।</div>';
 document.querySelectorAll("[data-add]").forEach(b=>b.addEventListener("click",()=>addToCart(b.dataset.add)));
}
function addToCart(id){const p=products.find(x=>String(x.id)===String(id));if(!p)return;const found=cart.find(x=>String(x.id)===String(id));if(found){if(found.qty>=Number(p.stock)){toast("স্টকের চেয়ে বেশি যোগ করা যাবে না");return}found.qty++}else cart.push({id:p.id,name:p.name,price:Number(p.price),qty:1,stock:Number(p.stock)});saveCart();toast("কার্টে যোগ হয়েছে")}
function renderCart(){
 $("cartCount").textContent=cart.reduce((n,x)=>n+x.qty,0);
 $("cartItems").innerHTML=cart.length?cart.map(x=>`<div class="cart-row"><div><b>${esc(x.name)}</b><small>${money(x.price)} × ${x.qty}</small></div><div class="qty-controls"><button data-dec="${esc(x.id)}">−</button><b>${x.qty}</b><button data-inc="${esc(x.id)}">+</button></div></div>`).join(""):'<div class="empty">কার্ট এখনো খালি।</div>';
 $("cartTotal").textContent=money(cart.reduce((n,x)=>n+x.price*x.qty,0));
 document.querySelectorAll("[data-dec]").forEach(b=>b.onclick=()=>changeQty(b.dataset.dec,-1));
 document.querySelectorAll("[data-inc]").forEach(b=>b.onclick=()=>changeQty(b.dataset.inc,1));
}
function changeQty(id,d){const x=cart.find(i=>String(i.id)===String(id));if(!x)return;if(d>0&&x.qty>=x.stock){toast("স্টকের চেয়ে বেশি যোগ করা যাবে না");return}x.qty+=d;if(x.qty<1)cart=cart.filter(i=>String(i.id)!==String(id));saveCart()}
async function checkout(e){
 e.preventDefault();if(!cart.length){toast("কার্ট খালি");return}
 const f=new FormData(e.target), payload={p_customer_name:f.get("customer_name").trim(),p_phone:f.get("phone").trim(),p_address:f.get("address").trim(),p_note:f.get("note").trim(),p_items:cart.map(x=>({product_id:x.id,quantity:x.qty}))};
 $("checkoutMessage").textContent="অর্ডার পাঠানো হচ্ছে...";
 if(!db){$("checkoutMessage").textContent="ডেটাবেস সেটআপ করা হয়নি। Supabase কনফিগার করে আবার চেষ্টা করুন।";return}
 const {data,error}=await db.rpc("place_order",payload);
 if(error){$("checkoutMessage").textContent=error.message;return}
 cart=[];saveCart();e.target.reset();$("checkoutMessage").textContent=`অর্ডার সফল! অর্ডার নম্বর: ${data}`;toast("অর্ডার সফলভাবে গ্রহণ করা হয়েছে");setTimeout(()=>{hideModal("checkoutModal");closeCart()},2200);
}
async function refreshAdmin(){
 const {data:ps,error}=await db.from("products").select("*").order("created_at",{ascending:false});
 if(error){$("adminProducts").textContent=error.message;return}
 await refreshCategoryManager();
 $("adminProducts").innerHTML=(ps||[]).map(p=>`<div class="admin-item"><span><b>${esc(p.name)}</b><br>${money(p.price)} · স্টক ${p.stock}</span><span><button data-edit="${p.id}">এডিট</button><button data-delete="${p.id}">ডিলিট</button></span></div>`).join("")||"কোনো পণ্য নেই";
 document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>editProduct(ps.find(p=>String(p.id)===b.dataset.edit)));
 document.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>deleteProduct(b.dataset.delete));
 const {data:orders, error:oe}=await db.from("orders").select("*").order("created_at",{ascending:false}).limit(20);
 $("adminOrders").innerHTML=oe?esc(oe.message):(orders||[]).map(o=>`<div class="admin-item"><span><b>#${esc(o.id)}</b> · ${esc(o.customer_name)}<br>${esc(o.phone)} · ${money(o.total)} · ${esc(o.status)}</span><select data-status="${o.id}"><option ${o.status==="pending"?"selected":""}>pending</option><option ${o.status==="confirmed"?"selected":""}>confirmed</option><option ${o.status==="shipped"?"selected":""}>shipped</option><option ${o.status==="delivered"?"selected":""}>delivered</option><option ${o.status==="cancelled"?"selected":""}>cancelled</option></select></div>`).join("")||"এখনো কোনো অর্ডার নেই";
 document.querySelectorAll("[data-status]").forEach(s=>s.onchange=async()=>{const {error}=await db.from("orders").update({status:s.value}).eq("id",s.dataset.status);if(error)toast(error.message);else toast("অর্ডারের অবস্থা আপডেট হয়েছে")});
}
function editProduct(p){const f=$("productForm");["id","name","price","stock","category","compatibility","description"].forEach(k=>f.elements[k].value=p[k]??"");$("productMessage").textContent="এডিট মোড"}
async function deleteProduct(id){if(!confirm("এই পণ্যটি মুছে ফেলতে চান?"))return;const {error}=await db.from("products").delete().eq("id",id);if(error)toast(error.message);else{toast("পণ্য মুছে ফেলা হয়েছে");await refreshAdmin();await loadProducts()}}
async function saveProduct(e){
 e.preventDefault();const f=e.target,fd=new FormData(f),id=fd.get("id");let image_url=null;const file=f.elements.image.files[0];
 $("productMessage").textContent="সেভ হচ্ছে...";
 if(file){const ext=file.name.split(".").pop().toLowerCase(),path=`${crypto.randomUUID()}.${ext}`;const {error:upErr}=await db.storage.from("product-images").upload(path,file,{upsert:false,contentType:file.type});if(upErr){$("productMessage").textContent=upErr.message;return}image_url=db.storage.from("product-images").getPublicUrl(path).data.publicUrl}
 const row={name:fd.get("name").trim(),price:Number(fd.get("price")),stock:Number(fd.get("stock")),category:fd.get("category"),compatibility:fd.get("compatibility"),description:fd.get("description"),active:true};
 if(image_url)row.image_url=image_url;
 let q=id?db.from("products").update(row).eq("id",id):db.from("products").insert(row);
 const {error}=await q;if(error){$("productMessage").textContent=error.message;return}
 $("productMessage").textContent="সফলভাবে সেভ হয়েছে";f.reset();f.elements.id.value="";await refreshAdmin();await loadProducts();
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
 $("adminAuth").hidden=true;$("adminPanel").hidden=false;await refreshAdmin();
}
$("search").addEventListener("input",renderProducts);$("searchBtn").onclick=renderProducts;
document.querySelectorAll("[data-category]").forEach(b=>b.onclick=()=>{activeCategory=b.dataset.category;document.querySelectorAll("[data-category]").forEach(x=>x.classList.toggle("active",x===b));renderProducts()});
$("cartOpen").onclick=openCart;$("cartClose").onclick=closeCart;$("overlay").onclick=()=>{closeCart();document.querySelectorAll(".modal.show").forEach(m=>hideModal(m.id))};
$("checkoutOpen").onclick=()=>{if(!cart.length){toast("কার্ট খালি");return}showModal("checkoutModal")};
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>hideModal(b.dataset.close));
$("checkoutForm").onsubmit=checkout;$("adminOpen").onclick=openAdmin;
$("loginForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);$("loginMessage").textContent="লগইন হচ্ছে...";const {data,error}=await db.auth.signInWithPassword({email:f.get("email"),password:f.get("password")});if(error){$("loginMessage").textContent=error.message;return}currentUser=data.user;await updateAdminView()};
$("logoutBtn").onclick=async()=>{await db.auth.signOut();currentUser=null;await updateAdminView()};
$("productForm").onsubmit=saveProduct;$("categoryForm").onsubmit=saveCategory;$("resetCategory").onclick=()=>{$("categoryForm").reset();$("categoryForm").elements.old_name.value="";$("categoryMessage").textContent=""};$("resetProduct").onclick=()=>{$("productForm").reset();$("productForm").elements.id.value="";$("productMessage").textContent=""};
$("year").textContent=new Date().getFullYear();renderCart();loadCategories().then(loadProducts);
