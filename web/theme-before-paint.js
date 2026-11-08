// Light or dark, decided before the page is drawn so it never flashes the wrong theme.
// Loaded by index.html in <head>, before the stylesheets apply; plain JavaScript, not bundled.
//
// The choice is "auto" (follow the device), "light" or "dark", saved in localStorage. This
// script turns it into data-theme="light" or "dark" on <html>, which base.css reads, and keeps
// it right when the device switches (in auto) or the page picks another choice: the page calls
// chooseTheme() in web/scripts/utils/theme-choice.ts, which fires the event below.
(() => {
  const STORAGE_KEY = 'expenses.theme'; // the same key as in theme-choice.ts
  const BAR_COLORS = { light: '#ffffff', dark: '#181c2e' }; // the top bar's background
  const deviceIsDark = matchMedia('(prefers-color-scheme: dark)');

  function savedChoice() {
    try {
      const choice = localStorage.getItem(STORAGE_KEY);
      return choice === 'light' || choice === 'dark' ? choice : 'auto';
    } catch {
      return 'auto'; // storage blocked, for example private browsing
    }
  }

  function apply() {
    const choice = savedChoice();
    const theme = choice === 'auto' ? (deviceIsDark.matches ? 'dark' : 'light') : choice;
    document.documentElement.dataset.theme = theme;
    // The phone's browser bar takes the theme's color too.
    let barColor = document.querySelector('meta[name="theme-color"]');
    if (!barColor) {
      barColor = document.createElement('meta');
      barColor.name = 'theme-color';
      document.head.append(barColor);
    }
    barColor.content = BAR_COLORS[theme];
  }

  apply();
  deviceIsDark.addEventListener('change', apply);
  addEventListener('expenses:theme-chosen', apply);
  addEventListener('storage', (storageEvent) => storageEvent.key === STORAGE_KEY && apply()); // another tab chose
})();
