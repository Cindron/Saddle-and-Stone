const menuButton=document.querySelector(".menu-toggle");
const nav=document.querySelector(".main-nav");

if(menuButton&&nav){
  menuButton.addEventListener("click",()=>{
    const open=nav.classList.toggle("open");
    menuButton.setAttribute("aria-expanded",String(open));
  });
  nav.querySelectorAll("a").forEach(link=>link.addEventListener("click",()=>{
    nav.classList.remove("open");
    menuButton.setAttribute("aria-expanded","false");
  }));
}

const sections=[...document.querySelectorAll("main section[id]")];
const navLinks=[...document.querySelectorAll(".main-nav a")];
function updateActiveNav(){
  let current="home";
  for(const section of sections){
    if(window.scrollY>=section.offsetTop-140) current=section.id;
  }
  navLinks.forEach(link=>link.classList.toggle("active",link.getAttribute("href")==="#"+current));
}
window.addEventListener("scroll",updateActiveNav,{passive:true});
updateActiveNav();