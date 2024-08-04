import Browser from 'webextension-polyfill';

Browser
  .devtools
  .panels
  .create('Dev Tools', 'icons8-games-folder-32.png', 'src/pages/panel/index.html')
  .catch(console.error);
