const pathsEl = document.getElementById('paths');
const pingEl = document.getElementById('ping-result');
const btnPaths = document.getElementById('btn-paths');

const showPaths = async () => {
  const paths = await window.electronAPI.getPaths();
  pathsEl.textContent = JSON.stringify(paths, null, 2);
};

btnPaths.addEventListener('click', showPaths);

pingEl.textContent = `Preload ping: ${window.electronAPI.ping()}`;
showPaths();
