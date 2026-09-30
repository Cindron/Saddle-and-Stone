const menuButton=document.querySelector(".menu-toggle");
const nav=document.querySelector(".main-nav");
if(menuButton&&nav){
  menuButton.addEventListener("click",()=>{
    const open=nav.classList.toggle("open");
    menuButton.setAttribute("aria-expanded",String(open));
  });
  nav.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{
    nav.classList.remove("open");
    menuButton.setAttribute("aria-expanded","false");
  }));
}
const page=document.body.dataset.page;
document.querySelectorAll("[data-nav]").forEach(a=>a.classList.toggle("active",a.dataset.nav===page));