const $=id=>document.getElementById(id);
const state={items:[],sales:[],activeItem:null};

function esc(v=""){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function money(cents){if(cents===null||cents===undefined)return"Price on request";return new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD"}).format(cents/100)}
function shortText(v,max=115){const s=String(v||"").trim();return s.length>max?s.slice(0,max-1).trim()+"…":s}
function titleCase(v){return String(v||"").replace(/(^|\s)\S/g,m=>m.toUpperCase())}

async function getJson(url,options={}){
  const res=await fetch(url,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error||"Something went wrong.");
  return data;
}

async function load(){
  try{
    const [catalog,sales]=await Promise.all([
      getJson("/api/catalog?limit=100"),
      getJson("/api/sales")
    ]);
    state.items=catalog.items||[];
    state.sales=sales.sales||[];
    buildFilters();
    const params=new URLSearchParams(location.search);
    const requestedSale=params.get("sale");
    if(requestedSale&&[...$("saleFilter").options].some(o=>o.value===requestedSale))$("saleFilter").value=requestedSale;
    const itemSlug=params.get("item");
    if(itemSlug) await showItem(itemSlug,false);
    else showBrowse(false);
  }catch(err){
    $("catalogNotice").textContent="The catalog is temporarily unavailable. Please try again shortly.";
    $("catalogNotice").classList.remove("hidden");
  }
}

function buildFilters(){
  const categories=[...new Set(state.items.map(i=>i.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  $("categoryFilter").innerHTML='<option value="">All categories</option>'+categories.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join("");
  $("saleFilter").innerHTML='<option value="">All collections</option>'+state.sales.map(s=>'<option value="'+esc(s.slug)+'">'+esc(s.title)+'</option>').join("");
}

function filteredItems(){
  const q=$("searchInput").value.trim().toLowerCase();
  const status=$("statusFilter").value;
  const category=$("categoryFilter").value;
  const sale=$("saleFilter").value;
  return state.items.filter(item=>{
    if(status&&item.status!==status)return false;
    if(category&&item.category!==category)return false;
    if(sale&&item.sale_slug!==sale)return false;
    if(q){
      const hay=[item.title,item.description,item.category,item.condition_text,item.item_code,item.sale_title].join(" ").toLowerCase();
      if(!hay.includes(q))return false;
    }
    return true;
  });
}

function card(item){
  const image=item.images?.[0];
  return '<a class="catalog-card" href="/catalog/?item='+encodeURIComponent(item.slug)+'" data-item="'+esc(item.slug)+'">'+
    '<div class="card-media">'+
      (image?'<img loading="lazy" decoding="async" src="'+esc(image.url)+'" alt="'+esc(image.alt_text||item.title)+'">':'<div class="no-photo">Photo coming soon</div>')+
      '<span class="status '+esc(item.status)+'">'+esc(titleCase(item.status))+'</span>'+
      (item.featured?'<span class="featured">Featured</span>':'')+
    '</div>'+
    '<div class="card-copy">'+
      '<div class="card-kicker"><span>'+esc(item.category||"Estate Find")+'</span><span>'+esc(item.item_code||"")+'</span></div>'+
      '<h3>'+esc(item.title)+'</h3>'+
      '<p class="card-description">'+esc(shortText(item.description||item.condition_text||"A curated Saddle & Stone find."))+'</p>'+
      '<div class="card-bottom"><span class="price">'+esc(money(item.price_cents))+'</span><span class="view">View Item →</span></div>'+
    '</div></a>';
}

function render(){
  const items=filteredItems();
  $("catalogCount").textContent=items.length+" "+(items.length===1?"piece":"pieces");
  $("catalogGrid").innerHTML=items.map(card).join("");
  $("catalogEmpty").classList.toggle("hidden",items.length>0);
  document.querySelectorAll("[data-item]").forEach(a=>a.addEventListener("click",async e=>{
    e.preventDefault();
    await showItem(a.dataset.item,true);
  }));
}

function showBrowse(push=true){
  state.activeItem=null;
  $("itemView").classList.add("hidden");
  $("browseView").classList.remove("hidden");
  if(push) history.pushState({view:"browse"},"","/catalog/");
  document.title="Catalog | Saddle & Stone Estate Sales";
  render();
  window.scrollTo({top:0,behavior:"smooth"});
}

async function showItem(slug,push=true){
  try{
    const data=await getJson("/api/catalog/"+encodeURIComponent(slug));
    state.activeItem=data.item;
    renderItem(data.item);
    $("browseView").classList.add("hidden");
    $("itemView").classList.remove("hidden");
    if(push) history.pushState({view:"item",slug},"","/catalog/?item="+encodeURIComponent(slug));
    document.title=data.item.title+" | Saddle & Stone Estate Sales";
    window.scrollTo({top:0,behavior:"smooth"});
  }catch(err){
    $("catalogNotice").textContent=err.message;
    $("catalogNotice").classList.remove("hidden");
    showBrowse(false);
  }
}

function renderItem(item){
  const images=item.images||[];
  const first=images[0];
  const gallery=images.length
    ? '<div class="main-image">'+
        '<img id="mainItemImage" src="'+esc(first.url)+'" alt="'+esc(first.alt_text||item.title)+'">'+
      '</div>'+
      images.map((img,i)=>'<button class="thumb '+(i===0?"active":"")+'" type="button" data-image="'+esc(img.url)+'" data-alt="'+esc(img.alt_text||item.title)+'"><img src="'+esc(img.url)+'" alt=""></button>').join("")
    : '<div class="main-image no-photo">Photo coming soon</div>';

  const canInquire=item.status!=="sold";
  $("itemDetail").innerHTML=
    '<div class="item-layout">'+
      '<div class="item-gallery">'+gallery+'</div>'+
      '<article class="item-copy">'+
        '<p class="eyebrow">'+esc(item.category||"SADDLE & STONE FIND")+'</p>'+
        '<h1>'+esc(item.title)+'</h1>'+
        '<div class="item-meta"><span class="meta-chip">'+esc(titleCase(item.status))+'</span><span class="meta-chip">'+esc(item.item_code||"")+'</span>'+(item.featured?'<span class="meta-chip">Featured</span>':'')+'</div>'+
        '<div class="item-price">'+esc(money(item.price_cents))+'</div>'+
        '<div class="item-description">'+esc(item.description||"This piece is part of the current Saddle & Stone collection.")+'</div>'+
        (item.condition_text?'<div class="condition"><strong>Condition / notes</strong><br>'+esc(item.condition_text)+'</div>':'')+
        (item.sale_title?'<div class="sale-link">Part of: <strong>'+esc(item.sale_title)+'</strong></div>':'')+
        '<button id="askButton" class="primary-button" type="button" '+(canInquire?"":"disabled")+'>'+(canInquire?"Ask About This Item":"This Item Has Sold")+'</button>'+
      '</article>'+
    '</div>';

  document.querySelectorAll(".thumb").forEach(btn=>btn.addEventListener("click",()=>{
    const main=$("mainItemImage"); if(!main)return;
    main.src=btn.dataset.image;main.alt=btn.dataset.alt||item.title;
    document.querySelectorAll(".thumb").forEach(x=>x.classList.remove("active"));btn.classList.add("active");
  }));
  const ask=$("askButton");
  if(ask&&!ask.disabled) ask.addEventListener("click",()=>openInquiry(item));
}

function openInquiry(item){
  state.activeItem=item;
  $("inquiryItemTitle").textContent=item.title;
  $("inquiryRef").textContent=item.item_code?("Reference "+item.item_code):"";
  $("inquiryMessage").value="I’m interested in "+item.title+". ";
  $("inquiryError").textContent="";
  $("inquiryDialog").showModal();
}
function closeInquiry(){$("inquiryDialog").close()}
$("closeInquiry").addEventListener("click",closeInquiry);
$("inquiryDialog").addEventListener("click",e=>{if(e.target===$("inquiryDialog"))closeInquiry()});

$("inquiryForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const item=state.activeItem;
  if(!item)return;
  const email=$("inquiryEmail").value.trim(),phone=$("inquiryPhone").value.trim();
  if(!email&&!phone){$("inquiryError").textContent="Please provide an email address or phone number.";return}
  $("sendInquiry").disabled=true;$("sendInquiry").textContent="Sending…";$("inquiryError").textContent="";
  try{
    await getJson("/api/catalog/"+encodeURIComponent(item.slug)+"/inquiries",{
      method:"POST",
      body:JSON.stringify({
        name:$("inquiryName").value,
        email,phone,
        message:$("inquiryMessage").value,
        website:$("inquiryWebsite").value
      })
    });
    $("inquiryForm").reset();
    closeInquiry();
    alert("Thanks — your inquiry was sent to Saddle & Stone.");
  }catch(err){$("inquiryError").textContent=err.message}
  finally{$("sendInquiry").disabled=false;$("sendInquiry").textContent="Send Inquiry"}
});

$("backToCatalog").addEventListener("click",()=>showBrowse(true));
["searchInput","statusFilter","categoryFilter","saleFilter"].forEach(id=>{
  $(id).addEventListener(id==="searchInput"?"input":"change",render);
});

window.addEventListener("popstate",async()=>{
  const slug=new URLSearchParams(location.search).get("item");
  if(slug) await showItem(slug,false); else showBrowse(false);
});

load();
