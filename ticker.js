// Shared storefront news ticker. Reads only the public store settings row.
(async function(){
  const host=document.getElementById("siteNewsTicker");
  if(!host)return;
  const cfg=window.PM_CONFIG||{};
  const client=window.supabase?.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
  if(!client)return;
  try{
    const {data,error}=await client.from("store_settings").select("ticker_message,ticker_enabled").eq("id",1).maybeSingle();
    const message=String(data?.ticker_message||"").trim();
    if(error||!data?.ticker_enabled||!message){host.hidden=true;return}
    const safe=message.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
    host.innerHTML='<span class="news-ticker-label">NEWS</span><div class="news-ticker-track"><div class="news-ticker-content"><span>'+safe+'</span><span aria-hidden="true">'+safe+'</span></div></div>';
    host.hidden=false;
  }catch(error){console.warn("News ticker could not be loaded:",error);host.hidden=true}
})();