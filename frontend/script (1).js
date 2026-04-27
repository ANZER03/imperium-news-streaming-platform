const mobileMenuButton = document.getElementById('mobileMenuButton');
const closeSidebarButton = document.getElementById('closeSidebarButton');
const mobileSidebar = document.getElementById('mobileSidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');

function openSidebar() {
  if (!mobileSidebar || !sidebarOverlay) return;
  mobileSidebar.classList.remove('hidden');
  sidebarOverlay.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
}

function closeSidebar() {
  if (!mobileSidebar || !sidebarOverlay) return;
  mobileSidebar.classList.add('hidden');
  sidebarOverlay.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
}

function syncSidebarState() {
  if (!mobileSidebar || !sidebarOverlay) return;

  if (window.innerWidth >= 1024) {
    mobileSidebar.classList.remove('hidden');
    sidebarOverlay.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  } else {
    mobileSidebar.classList.add('hidden');
    sidebarOverlay.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }
}

if (mobileMenuButton) {
  mobileMenuButton.addEventListener('click', openSidebar);
}

if (closeSidebarButton) {
  closeSidebarButton.addEventListener('click', closeSidebar);
}

if (sidebarOverlay) {
  sidebarOverlay.addEventListener('click', closeSidebar);
}

window.addEventListener('resize', syncSidebarState);
window.addEventListener('DOMContentLoaded', syncSidebarState);
