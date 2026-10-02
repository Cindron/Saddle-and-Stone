const $=id=>document.getElementById(id);
let sales=[];
let cursor=new Date();cursor.setDate(1);
function esc(v=""){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function sameDay(a,b){return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate()}
function fmtDate(v){if(!v)return"";const d=new Date(v);return Number.isNaN(d.getTime())?"":new Intl.DateTimeFormat("en-CA",{month:"short",day:"numeric",year:"numeric"}).format(d)}
function locationText(s){return [s.city,s.region].filter(Boolean).join(", ")||s.address_public||"Location to be announced"}
function render(){
  $("monthTitle").textContent=new Intl.DateTimeFormat("en-CA",{month:"long",year:"numeric"}).format(cursor);
  const y=cursor.getFullYear(),m=cursor.getMonth(),first=new Date(y,m,1),start=new Date(y,m,1-first.getDay()),today=new Date();today.setHours(0,0,0,0);
  let html="";
  for(let i=0;i<42;i++){
    const day=new Date(start);day.setDate(start.getDate()+i);
    const daySales=sales.filter(s=>s.start_at&&sameDay(new Date(s.start_at),day));
    html+='<div class="day'+(day.getMonth()!==m?" outside":"")+(sameDay(day,today)?" today":"")+'"><span class="date">'+day.getDate()+'</span>'+daySales.map(s=>'<a class="sale-pill" href="/catalog/?sale='+encodeURIComponent(s.slug)+'">'+esc(s.title)+'</a>').join("")+'</div>';
  }
  $("calendarGrid").innerHTML=html;

  const sorted=[...sales].sort((a,b)=>new Date(a.start_at||0)-new Date(b.start_at||0));
  $("emptyState").classList.toggle("hidden",sorted.length>0);
  $("salesList").innerHTML=sorted.map(s=>'<article class="sale-card"><div class="sale-date">'+esc(fmtDate(s.start_at))+(s.end_at&&s.end_at!==s.start_at?" – "+esc(fmtDate(s.end_at)):"")+'</div><h3>'+esc(s.title)+'</h3><p>'+esc(s.summary||"Estate sale details coming soon.")+'</p><div class="sale-location">'+esc(locationText(s))+'</div><a class="catalog-link" href="/catalog/?sale='+encodeURIComponent(s.slug)+'">Browse this collection →</a></article>').join("");
}
async function load(){
  try{
    const r=await fetch("/api/sales");const data=await r.json();
    if(!r.ok)throw new Error(data.error||"Unable to load calendar.");
    sales=data.sales||[];render();
  }catch{
    $("emptyState").classList.remove("hidden");
    $("emptyState").innerHTML="<h3>Calendar temporarily unavailable.</h3><p>Please check back shortly.</p>";
  }
}
$("prevMonth").addEventListener("click",()=>{cursor.setMonth(cursor.getMonth()-1);render()});
$("nextMonth").addEventListener("click",()=>{cursor.setMonth(cursor.getMonth()+1);render()});
$("todayMonth").addEventListener("click",()=>{cursor=new Date();cursor.setDate(1);render()});
load();
