// Inline script that runs before hydration to apply persisted dark-mode
// preference and avoid a flash of light theme.
export function DarkModeScript() {
  const code = `
(function() {
  try {
    var t = localStorage.getItem('wh-theme');
    if (t === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`.trim();
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
