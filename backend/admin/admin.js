const state={csrf:"",admin:null,items:[],sales:[],inquiries:[],settings:{},system:null};
let calendarCursor=new Date();
calendarCursor.setDate(1);
const $=id=>document.getElementById(id);
const loginView=$("loginView"),portalView=$("portalView"),message=$("portalMessage");
function money(cents){if(cents===null||cents===undefined)return"Price on request";return new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD"}).format(cents/100)}
function esc(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function flash(t){message.textContent=t;message.classList.remove("hidden");clearTimeout(flash.timer);flash.timer=setTimeout(()=>message.classList.add("hidden"),3000)}
async function api(url,options={}){const init={credentials:"same-origin",...options,headers:{...(options.headers||{})}};if(options.body&&!(options.body instanceof FormData)&&!init.headers["Content-Type"])init.headers["Content-Type"]="application/json";if(state.csrf&&!["GET","HEAD"].includes((init.method||"GET").toUpperCase()))init.headers["X-CSRF-Token"]=state.csrf;const res=await fetch(url,init);const data=await res.json().catch(()=>({}));if(res.status===401){showLogin();throw new Error("Please sign in again.")}if(!res.ok)throw new Error(data.error||"Request failed.");return data}
function showLogin(){state.csrf="";state.admin=null;portalView.classList.add("hidden");loginView.classList.remove("hidden")}
function showPortal(){loginView.classList.add("hidden");portalView.classList.remove("hidden");$("signedInAs").textContent=(state.admin?.display_name?state.admin.display_name+" · ":"")+(state.admin?.email||"")}
async function loadSummary(){try{const data=await api("/api/admin/summary");const s=data.stats||{};$("summaryStrip").innerHTML=[["Available",s.available_items||0],["Pending",s.pending_items||0],["Sold",s.sold_items||0],["Hidden",s.hidden_items||0],["Published Sales",s.published_sales||0],["New Inquiries",s.new_inquiries||0]].map(([label,value])=>'<div class="summary-box"><strong>'+value+'</strong><span>'+esc(label)+'</span></div>').join("")}catch{}}
function renderPreview(){const salesById=new Map(state.sales.map(s=>[s.id,s]));const visible=state.items.filter(item=>item.status!=="hidden"&&(!item.sale_id||salesById.get(item.sale_id)?.status==="published"));$("previewEmpty").classList.toggle("hidden",visible.length>0);$("previewGrid").innerHTML=visible.map(item=>{const img=item.images?.[0];const media=img?'<img src="'+esc(img.url)+'" alt="'+esc(img.alt_text||item.title)+'">':'<div class="preview-placeholder">Photo coming soon</div>';return '<article class="preview-card">'+media+'<div class="preview-copy"><div class="meta"><span class="badge '+esc(item.status)+'">'+esc(item.status)+'</span><span class="badge">'+esc(item.item_code||"")+'</span></div><h3>'+esc(item.title)+'</h3><div class="preview-price">'+esc(money(item.price_cents))+'</div><p>'+esc(item.description||item.condition_text||"Vintage piece from Saddle & Stone.")+'</p><span class="preview-inquire">Ask About This Item</span></div></article>'}).join("")}
async function bootstrap(){try{const data=await api("/api/auth/me");state.csrf=data.csrf_token;state.admin=data.admin;showPortal();await Promise.all([loadItems(),loadSales(),loadSummary()]);renderPreview()}catch{showLogin()}}
$("loginForm").addEventListener("submit",async e=>{e.preventDefault();$("loginError").textContent="";try{const data=await api("/api/auth/login",{method:"POST",body:JSON.stringify({email:$("loginEmail").value,password:$("loginPassword").value})});state.csrf=data.csrf_token;state.admin=data.admin;$("loginPassword").value="";showPortal();await Promise.all([loadItems(),loadSales()])}catch(err){$("loginError").textContent=err.message}});
$("logoutBtn").addEventListener("click",async()=>{try{await api("/api/auth/logout",{method:"POST"})}catch{}showLogin()});
async function activateTab(name){const btn=document.querySelector('[data-tab="'+name+'"]');if(!btn)return;document.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("active",b===btn));document.querySelectorAll(".tab-panel").forEach(p=>p.classList.add("hidden"));$(name+"Tab").classList.remove("hidden");if(name==="inquiries")await loadInquiries();if(name==="preview")renderPreview();if(name==="calendar")renderCalendar();if(name==="maintenance")await loadMaintenance()}
document.querySelectorAll("[data-tab]").forEach(btn=>btn.addEventListener("click",()=>activateTab(btn.dataset.tab)));
function populateSaleSelect(){const sel=$("itemSale"),current=sel.value;sel.innerHTML='<option value="">Standalone catalog item</option>'+state.sales.map(s=>'<option value="'+s.id+'">'+esc(s.title)+' ('+esc(s.status)+')</option>').join("");sel.value=current}
async function loadItems(){const data=await api("/api/admin/items");state.items=data.items||[];renderItems();renderPreview();loadSummary()}
function renderItems(){
  $("itemsEmpty").classList.toggle("hidden",state.items.length>0);
  $("itemsList").innerHTML=state.items.map(item=>{
    const img=item.images?.[0];
    const media=img
      ? '<img class="card-image" src="'+esc(img.url)+'" alt="'+esc(img.alt_text||item.title)+'">'
      : '<div class="card-image card-placeholder">No photo</div>';
    const hidden=item.status==="hidden";
    const statusLabel=hidden?"HIDDEN — NOT PUBLIC":item.status;
    const visibilityNote=hidden
      ? '<div class="hidden-warning">This item is hidden and cannot be seen in the public catalog.</div>'
      : '';
    const visibilityAction=hidden
      ? '<button type="button" class="ghost" data-unhide-item="'+item.id+'">Make Available</button>'
      : '<button type="button" class="ghost" data-hide-item="'+item.id+'">Hide</button>';

    return '<article class="card '+(hidden?'hidden-item':'')+'">'+media+
      '<div><h3>'+esc(item.title)+'</h3>'+
      '<div class="meta"><span class="badge '+esc(item.status)+'">'+esc(statusLabel)+'</span>'+
      '<span class="badge">'+esc(item.item_code||"")+'</span>'+
      (item.featured?'<span class="badge">Featured</span>':'')+'</div>'+
      visibilityNote+
      '<div>'+esc(money(item.price_cents))+'</div>'+
      '<div class="card-actions">'+
        '<button type="button" data-edit-item="'+item.id+'">Edit</button>'+
        visibilityAction+
        '<button type="button" class="danger" data-delete-item="'+item.id+'">Delete</button>'+
      '</div></div></article>';
  }).join("");

  document.querySelectorAll("[data-edit-item]").forEach(b=>b.addEventListener("click",()=>openItem(Number(b.dataset.editItem))));
  document.querySelectorAll("[data-hide-item]").forEach(b=>b.addEventListener("click",()=>hideItem(Number(b.dataset.hideItem))));
  document.querySelectorAll("[data-unhide-item]").forEach(b=>b.addEventListener("click",()=>unhideItem(Number(b.dataset.unhideItem))));
  document.querySelectorAll("[data-delete-item]").forEach(b=>b.addEventListener("click",()=>deleteItem(Number(b.dataset.deleteItem))));
}
$("newItemBtn").addEventListener("click",()=>openItem());$("cancelItemBtn").addEventListener("click",()=>$("itemForm").classList.add("hidden"));
function openItem(id=null){const item=id?state.items.find(x=>x.id===id):null;$("itemId").value=item?.id||"";$("itemFormTitle").textContent=item?"Edit Item":"Add Item";$("itemTitle").value=item?.title||"";$("itemCategory").value=item?.category||"";$("itemPrice").value=item?.price_cents==null?"":(item.price_cents/100).toFixed(2);$("itemStatus").value=item?.status||"available";$("itemFeatured").checked=Boolean(item?.featured);$("itemCondition").value=item?.condition_text||"";$("itemDescription").value=item?.description||"";$("itemSale").value=item?.sale_id||"";$("imageInput").value="";renderItemImages(item);renderPendingImages();$("itemForm").classList.remove("hidden");$("itemForm").scrollIntoView({behavior:"smooth",block:"start"})}
function renderItemImages(item){$("itemImages").innerHTML=(item?.images||[]).map(img=>'<div class="image-tile"><img src="'+esc(img.url)+'" alt="'+esc(img.alt_text||item.title)+'"><span class="saved-photo">Saved</span><button type="button" aria-label="Delete image" data-delete-image="'+img.id+'">×</button></div>').join("");document.querySelectorAll("[data-delete-image]").forEach(b=>b.addEventListener("click",()=>deleteImage(Number(b.dataset.deleteImage))))}
function renderPendingImages(){const files=[...$("imageInput").files];$("photoCount").textContent=files.length+(files.length===1?" selected":" selected");$("pendingImages").innerHTML="";files.forEach(file=>{const tile=document.createElement("div");tile.className="image-tile pending";const img=document.createElement("img");img.alt=file.name;const url=URL.createObjectURL(file);img.src=url;img.addEventListener("load",()=>URL.revokeObjectURL(url),{once:true});const tag=document.createElement("span");tag.className="pending-photo";tag.textContent="Ready to upload";tile.append(img,tag);$("pendingImages").appendChild(tile)})}
$("imageInput").addEventListener("change",renderPendingImages);
async function uploadSelectedImages(itemId,files){if(!files.length)return;const body=new FormData();files.forEach(file=>body.append("images",file));await api("/api/admin/items/"+itemId+"/images",{method:"POST",body})}
$("itemForm").addEventListener("submit",async e=>{e.preventDefault();const saveBtn=$("saveItemBtn");const selectedFiles=[...$("imageInput").files];saveBtn.disabled=true;saveBtn.textContent=selectedFiles.length?"Saving & uploading photos…":"Saving…";try{const id=$("itemId").value,rawPrice=$("itemPrice").value.trim();const body={title:$("itemTitle").value,category:$("itemCategory").value,price_cents:rawPrice===""?null:Math.round(Number(rawPrice)*100),status:$("itemStatus").value,featured:$("itemFeatured").checked,condition_text:$("itemCondition").value,description:$("itemDescription").value,sale_id:$("itemSale").value||null};const data=await api(id?"/api/admin/items/"+id:"/api/admin/items",{method:id?"PUT":"POST",body:JSON.stringify(body)});try{await uploadSelectedImages(data.item.id,selectedFiles)}catch(photoErr){await loadItems();openItem(data.item.id);flash("Item saved, but the photos did not upload: "+photoErr.message);return}$("imageInput").value="";await loadItems();openItem(data.item.id);flash(selectedFiles.length?"Item and photos saved.":"Item saved.")}catch(err){flash(err.message)}finally{saveBtn.disabled=false;saveBtn.textContent="Save Item"}});
async function hideItem(id){
  const item=state.items.find(x=>x.id===id);
  if(!confirm('Hide "'+(item?.title||"this item")+'" from the public catalog?\n\nIt will stay in the Owner Portal and can be restored later.'))return;
  try{await api("/api/admin/items/"+id,{method:"DELETE"});await loadItems();flash("Item hidden from the public catalog.")}catch(err){flash(err.message)}
}
async function unhideItem(id){
  const item=state.items.find(x=>x.id===id);if(!item)return;
  try{
    const body={title:item.title,category:item.category,price_cents:item.price_cents,status:"available",featured:item.featured,condition_text:item.condition_text,description:item.description,sale_id:item.sale_id};
    await api("/api/admin/items/"+id,{method:"PUT",body:JSON.stringify(body)});
    await loadItems();flash("Item is available in the public catalog again.");
  }catch(err){flash(err.message)}
}
async function deleteItem(id){
  const item=state.items.find(x=>x.id===id);if(!item)return;
  const warning='Permanently delete "'+item.title+'"?\n\nThis cannot be undone. Its uploaded photos and any inquiries attached to this item will also be removed.';
  if(!confirm(warning))return;
  if(!confirm("Final confirmation: permanently remove this item?"))return;
  try{
    await api("/api/admin/items/"+id+"/permanent",{method:"DELETE"});
    if(String($("itemId").value)===String(id))$("itemForm").classList.add("hidden");
    await loadItems();
    flash("Item permanently deleted.");
  }catch(err){flash(err.message)}
}

async function deleteImage(imageId){const itemId=$("itemId").value;if(!itemId||!confirm("Delete this photo?"))return;try{await api("/api/admin/items/"+itemId+"/images/"+imageId,{method:"DELETE"});await loadItems();openItem(Number(itemId));flash("Photo removed.")}catch(err){flash(err.message)}}
async function loadSales(){const data=await api("/api/admin/sales");state.sales=data.sales||[];populateSaleSelect();renderSales();renderPreview();renderCalendar();loadSummary()}
function sameDay(a,b){return a&&b&&a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate()}
function renderCalendar(){
  const title=$("calendarTitle"),grid=$("calendarGrid");if(!title||!grid)return;
  const year=calendarCursor.getFullYear(),month=calendarCursor.getMonth();
  title.textContent=new Intl.DateTimeFormat("en-CA",{month:"long",year:"numeric"}).format(calendarCursor);
  const first=new Date(year,month,1),start=new Date(year,month,1-first.getDay()),today=new Date();today.setHours(0,0,0,0);
  let out="";
  for(let i=0;i<42;i++){
    const day=new Date(start);day.setDate(start.getDate()+i);
    const outside=day.getMonth()!==month;
    const events=state.sales.filter(s=>{
      if(!s.start_at)return false;
      const startDate=new Date(s.start_at);
      if(Number.isNaN(startDate.getTime()))return false;
      const endDate=s.end_at?new Date(s.end_at):new Date(startDate);
      if(Number.isNaN(endDate.getTime()))return false;
      const d=new Date(day);d.setHours(12,0,0,0);
      const a=new Date(startDate);a.setHours(0,0,0,0);
      const b=new Date(endDate);b.setHours(23,59,59,999);
      return d>=a&&d<=b;
    });
    out+='<div class="calendar-day'+(outside?" outside":"")+(sameDay(day,today)?" today":"")+'"><span class="calendar-date">'+day.getDate()+'</span>'+events.map(s=>'<button type="button" class="calendar-event '+esc(s.status)+'" data-calendar-sale="'+s.id+'">'+esc(s.title)+'</button>').join("")+'</div>';
  }
  grid.innerHTML=out;
  document.querySelectorAll("[data-calendar-sale]").forEach(btn=>btn.addEventListener("click",async()=>{await activateTab("sales");openSale(Number(btn.dataset.calendarSale))}));
}
$("calendarPrev").addEventListener("click",()=>{calendarCursor.setMonth(calendarCursor.getMonth()-1);renderCalendar()});
$("calendarNext").addEventListener("click",()=>{calendarCursor.setMonth(calendarCursor.getMonth()+1);renderCalendar()});
$("calendarToday").addEventListener("click",()=>{calendarCursor=new Date();calendarCursor.setDate(1);renderCalendar()});

function renderSales(){
  $("salesEmpty").classList.toggle("hidden",state.sales.length>0);
  $("salesList").innerHTML=state.sales.map(s=>'<article class="card"><div class="card-image card-placeholder">Estate<br>Sale</div><div><h3>'+esc(s.title)+'</h3><div class="meta"><span class="badge">'+esc(s.status)+'</span><span class="badge">'+(s.item_count||0)+' items</span></div><div class="muted">'+esc(s.city||"")+(s.region?", "+esc(s.region):"")+'</div><div class="card-actions"><button type="button" data-edit-sale="'+s.id+'">Edit</button><button type="button" class="danger" data-delete-sale="'+s.id+'">Delete</button></div></div></article>').join("");
  document.querySelectorAll("[data-edit-sale]").forEach(b=>b.addEventListener("click",()=>openSale(Number(b.dataset.editSale))));
  document.querySelectorAll("[data-delete-sale]").forEach(b=>b.addEventListener("click",()=>deleteSale(Number(b.dataset.deleteSale))));
}
async function deleteSale(id){
  const sale=state.sales.find(x=>x.id===id);if(!sale)return;
  const linked=Number(sale.item_count||0);
  const note=linked
    ?"\n\n"+linked+" linked catalog item"+(linked===1?" will":"s will")+" be kept and changed to Standalone."
    :"";
  if(!confirm('Permanently delete "'+sale.title+'"?'+note))return;
  try{
    const data=await api("/api/admin/sales/"+id,{method:"DELETE"});
    if(String($("saleId").value)===String(id))$("saleForm").classList.add("hidden");
    await Promise.all([loadSales(),loadItems()]);
    flash("Sale deleted. "+(data.deleted?.items_made_standalone||0)+" linked item(s) kept as standalone.");
  }catch(err){flash(err.message)}
}
$("newSaleBtn").addEventListener("click",()=>openSale());$("cancelSaleBtn").addEventListener("click",()=>$("saleForm").classList.add("hidden"));
function localDateValue(v){return v?String(v).slice(0,16):""}
function openSale(id=null){const s=id?state.sales.find(x=>x.id===id):null;$("saleId").value=s?.id||"";$("saleFormTitle").textContent=s?"Edit Sale":"Add Sale";$("saleTitle").value=s?.title||"";$("saleStatus").value=s?.status||"draft";$("saleStart").value=localDateValue(s?.start_at);$("saleEnd").value=localDateValue(s?.end_at);$("saleCity").value=s?.city||"";$("saleRegion").value=s?.region||"";$("saleAddress").value=s?.address_public||"";$("saleSummary").value=s?.summary||"";$("saleForm").classList.remove("hidden");$("saleForm").scrollIntoView({behavior:"smooth",block:"start"})}
$("saleForm").addEventListener("submit",async e=>{e.preventDefault();const id=$("saleId").value,body={title:$("saleTitle").value,status:$("saleStatus").value,start_at:$("saleStart").value||null,end_at:$("saleEnd").value||null,city:$("saleCity").value,region:$("saleRegion").value,address_public:$("saleAddress").value,summary:$("saleSummary").value};if(body.start_at&&body.end_at&&new Date(body.end_at)<new Date(body.start_at)){flash("Sale end must be after the start.");return}try{await api(id?"/api/admin/sales/"+id:"/api/admin/sales",{method:id?"PUT":"POST",body:JSON.stringify(body)});$("saleForm").classList.add("hidden");await loadSales();flash("Sale saved.")}catch(err){flash(err.message)}});
async function loadMaintenance(){
  try{
    const [settingsData,systemData,backupData]=await Promise.all([api("/api/admin/site-settings"),api("/api/admin/system"),api("/api/admin/backups")]);
    state.settings=settingsData.settings||{};state.system=systemData;
    $("settingBusinessName").value=state.settings.business_name||"";
    $("settingTagline").value=state.settings.tagline||"";
    $("settingPhone").value=state.settings.phone||"";
    $("settingEmail").value=state.settings.email||"";
    $("settingServiceArea").value=state.settings.service_area||"";
    $("settingInstagram").value=state.settings.instagram||"";
    $("settingFacebook").value=state.settings.facebook||"";
    const mb=((Number(state.system.database_bytes)||0)/1048576).toFixed(2);
    $("systemStatus").innerHTML=[["Backend","Healthy"],["Schema","v"+esc(state.system.schema_version||"—")],["Database",mb+" MB"],["Uploaded photos",String(state.system.upload_count||0)],["Server backups",String(state.system.backup_count||0)]].map(([label,value])=>'<div class="system-line"><span>'+label+'</span><strong>'+value+'</strong></div>').join("");
    $("adminAccessCard").classList.toggle("hidden",state.admin?.role!=="owner");
    renderBackups(backupData.backups||[]);
    if(state.admin?.role==="owner")await loadMaintenanceAccess();
  }catch(err){flash(err.message)}
}
function renderBackups(backups){
  $("backupList").innerHTML=backups.length?backups.slice(0,5).map(b=>'<div class="backup-row"><strong>'+esc(b.name)+'</strong><span>'+esc(b.created_at?new Date(b.created_at).toLocaleString():"")+'</span></div>').join(""):'<p class="muted">No server backups created from the portal yet.</p>';
}
async function loadMaintenanceAccess(){
  const data=await api("/api/admin/users");
  const users=data.users||[];
  $("adminUsersList").innerHTML=users.map(u=>{
    const remove=u.role==="owner"?"":'<button type="button" class="ghost danger-outline" data-remove-admin="'+u.id+'">Remove Access</button>';
    return '<div class="admin-user"><div class="admin-user-main"><strong>'+esc(u.display_name||u.email)+'<span class="role-badge">'+esc(u.role)+'</span></strong><small>'+esc(u.email)+'</small></div>'+remove+'</div>';
  }).join("");
  document.querySelectorAll("[data-remove-admin]").forEach(btn=>btn.addEventListener("click",async()=>{
    if(!confirm("Remove this administrator's access?"))return;
    try{
      await api("/api/admin/users/"+btn.dataset.removeAdmin,{method:"DELETE"});
      await loadMaintenanceAccess();
      flash("Administrator access removed.");
    }catch(err){flash(err.message)}
  }));
}
$("adminUserForm").addEventListener("submit",async e=>{
  e.preventDefault();
  $("adminUserError").textContent="";
  try{
    await api("/api/admin/users",{method:"POST",body:JSON.stringify({
      display_name:$("adminDisplayName").value,
      email:$("adminEmail").value,
      password:$("adminTempPassword").value
    })});
    $("adminDisplayName").value="";
    $("adminEmail").value="";
    $("adminTempPassword").value="";
    await loadMaintenanceAccess();
    flash("Administrator added.");
  }catch(err){
    $("adminUserError").textContent=err.message;
  }
});
$("createBackupBtn").addEventListener("click",async()=>{const btn=$("createBackupBtn");btn.disabled=true;btn.textContent="Creating…";try{await api("/api/admin/backups",{method:"POST"});await loadMaintenance();flash("Backup created.")}catch(err){flash(err.message)}finally{btn.disabled=false;btn.textContent="Create Backup Now"}});

$("siteSettingsForm").addEventListener("submit",async e=>{e.preventDefault();try{const body={business_name:$("settingBusinessName").value,tagline:$("settingTagline").value,phone:$("settingPhone").value,email:$("settingEmail").value,service_area:$("settingServiceArea").value,instagram:$("settingInstagram").value,facebook:$("settingFacebook").value};const data=await api("/api/admin/site-settings",{method:"PUT",body:JSON.stringify(body)});state.settings=data.settings||body;flash("Site details saved.")}catch(err){flash(err.message)}});
$("refreshMaintenanceBtn").addEventListener("click",loadMaintenance);

async function loadInquiries(){try{const data=await api("/api/admin/inquiries");state.inquiries=data.inquiries||[];renderInquiries();loadSummary()}catch(err){flash(err.message)}}
function renderInquiries(){$("inquiriesEmpty").classList.toggle("hidden",state.inquiries.length>0);$("inquiriesList").innerHTML=state.inquiries.map(q=>{const opts=["new","read","closed"].map(s=>'<option value="'+s+'" '+(q.status===s?"selected":"")+'>'+s+'</option>').join("");return '<article class="inquiry '+esc(q.status)+'"><div class="inquiry-head"><div><strong>'+esc(q.name)+'</strong><div class="muted">'+esc(q.item_code)+' · '+esc(q.item_title)+'</div></div><select data-inquiry-status="'+q.id+'">'+opts+'</select></div><p>'+esc(q.message||"No message supplied.")+'</p><div class="muted">'+esc(q.email)+(q.phone?" · "+esc(q.phone):"")+'</div></article>'}).join("");document.querySelectorAll("[data-inquiry-status]").forEach(sel=>sel.addEventListener("change",async()=>{try{await api("/api/admin/inquiries/"+sel.dataset.inquiryStatus,{method:"PATCH",body:JSON.stringify({status:sel.value})});await loadInquiries()}catch(err){flash(err.message)}}))}
$("refreshInquiriesBtn").addEventListener("click",loadInquiries);
$("passwordForm").addEventListener("submit",async e=>{e.preventDefault();$("passwordError").textContent="";const current=$("currentPassword").value,next=$("newPassword").value,confirm=$("confirmPassword").value;if(next!==confirm){$("passwordError").textContent="New passwords do not match.";return}try{await api("/api/admin/change-password",{method:"POST",body:JSON.stringify({current_password:current,new_password:next})});$("currentPassword").value="";$("newPassword").value="";$("confirmPassword").value="";alert("Password changed. Please sign in again.");showLogin()}catch(err){$("passwordError").textContent=err.message}});
bootstrap();
