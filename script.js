const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.main-nav');

if (menuButton && nav) {
  menuButton.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(open));
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      menuButton.setAttribute('aria-expanded', 'false');
    });
  });
}

const sections = [...document.querySelectorAll('main section[id]')];
const navLinks = [...document.querySelectorAll('.main-nav a')];

const updateActiveNav = () => {
  let current = 'top';
  for (const section of sections) {
    if (window.scrollY >= section.offsetTop - 160) current = section.id;
  }
  navLinks.forEach((link) => {
    const target = link.getAttribute('href').replace('#', '');
    link.classList.toggle('active', target === current || (current === 'top' && target === 'top'));
  });
};

window.addEventListener('scroll', updateActiveNav, { passive: true });
updateActiveNav();
