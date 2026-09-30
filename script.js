const menuButton=document.querySelector(".menu-toggle");
const nav=document.querySelector(".main-nav");

function closeMenu(){
  if(!nav||!menuButton) return;
  nav.classList.remove("open");
  menuButton.setAttribute("aria-expanded","false");
  document.body.classList.remove("nav-open");
}

if(menuButton&&nav){
  menuButton.addEventListener("click",()=>{
    const open=nav.classList.toggle("open");
    menuButton.setAttribute("aria-expanded",String(open));
    document.body.classList.toggle("nav-open",open);
  });

  nav.querySelectorAll("a").forEach(a=>a.addEventListener("click",closeMenu));

  document.addEventListener("keydown",event=>{
    if(event.key==="Escape") closeMenu();
  });

  document.addEventListener("click",event=>{
    if(nav.classList.contains("open")&&!nav.contains(event.target)&&!menuButton.contains(event.target)){
      closeMenu();
    }
  });
}

const page=document.body.dataset.page;
document.querySelectorAll("[data-nav]").forEach(a=>{
  const active=a.dataset.nav===page;
  a.classList.toggle("active",active);
  if(active) a.setAttribute("aria-current","page");
  else a.removeAttribute("aria-current");
});
