// Direct teacher instruction: emojis across the app are placeholders, to be
// swapped for real icon/image assets as packs become available. This is the
// one place that swap lives — a semantic name (what the icon MEANS, not
// which pack it came from) mapped to a real PNG under public/ui/. Callers
// use <Icon name="close" /> instead of writing "✕" directly, so a later
// swap to a nicer asset (or a missing icon getting filled in) never touches
// call sites again.
//
// Sources, all cleared for this commercial hosted product before use:
//  - kenney  = Kenney UI Pack 2.0 (public/ui/kenney) — CC0.
//  - dobo    = Vector UI Pack by dobo_ui/Duplo (public/ui/dobo) — itch.io,
//              commercial use permitted, credit appreciated not required.
//  - cartoon = Cartoon UI Pack by Chequered Ink (public/ui/cartoon) — any
//              use including commercial, credit optional, no reselling the
//              unaltered pack itself.
//  - penzilla = Basic GUI Bundle by Penzilla Design (public/ui/penzilla) —
//              royalty-free commercial use, MANDATORY credit ("Graphics
//              created by Penzilla Design", given in the app's Credits
//              panel — see CreditsPanel.tsx), no logo/trademark use.
// This is a seed covering the highest-frequency emoji glyphs in the
// codebase (✕/✅/➕/🗑/✏/✓/⭐/❤/🔒/🔗/⚠/❓/🏠/💾/🔄/🎨/🔍/🎁/🏆/💰/🏷/🧩 and a
// handful of others) — not every emoji in the app has an entry yet.
// Extend this table as more get converted; a name with no entry here just
// means that spot hasn't been converted from its emoji placeholder yet.
export const ICON_CATALOG: Record<string, string> = {
  close: '/ui/penzilla/Icons/Icon_Small_Blank_X.png',
  trash: '/ui/kenney/PNG/Red/Default/icon_cross.png',
  check: '/ui/dobo/Icons/tickV1_icon_128px.png',
  checkAlt: '/ui/cartoon/basic black/checkbox tick.png',
  plus: '/ui/dobo/Icons/plusV1_icon_128px.png',
  search: '/ui/penzilla/Icons/Icon_Small_LookingGlass.png',
  settings: '/ui/dobo/Icons/settings_icon_128px.png',
  settingsAlt: '/ui/cartoon/basic black/icons settings.png',
  home: '/ui/cartoon/basic black/icons home.png',
  refresh: '/ui/cartoon/basic black/icons restart.png',
  star: '/ui/cartoon/basic black/star filled.png',
  starEmpty: '/ui/cartoon/basic black/star empty.png',
  heart: '/ui/cartoon/basic black/heart filled.png',
  heartEmpty: '/ui/cartoon/basic black/heart empty.png',
  lock: '/ui/penzilla/Icons/Icon_Small_Lock.png',
  warning: '/ui/dobo/Icons/warningCircle_icon_128px.png',
  question: '/ui/cartoon/basic black/icons question.png',
  info: '/ui/cartoon/basic black/icons info.png',
  coin: '/ui/dobo/Icons/coin_icon_128px.png',
  coins: '/ui/dobo/Icons/coins_icon_128px.png',
  gem: '/ui/penzilla/Icons/Icon_Small_Diamond.png',
  key: '/ui/dobo/Icons/key_icon_128px.png',
  gift: '/ui/dobo/Icons/chestRuby_icon_128px.png',
  shop: '/ui/dobo/Icons/shop_icon_128px.png',
  timer: '/ui/dobo/Icons/timer_icon_128px.png',
  mail: '/ui/dobo/Icons/mail_icon_128px.png',
  skills: '/ui/dobo/Icons/skills_icon_128px.png',
  sound: '/ui/cartoon/basic black/icons sound on.png',
  soundOff: '/ui/cartoon/basic black/icons sound off.png',
  play: '/ui/cartoon/basic black/icons play.png',
  pause: '/ui/cartoon/basic black/icons pause.png',
  menu: '/ui/cartoon/basic black/icons menu.png',
  arrowUp: '/ui/cartoon/basic black/arrow up.png',
  arrowDown: '/ui/cartoon/basic black/arrow down.png',
  arrowLeft: '/ui/cartoon/basic black/arrow left.png',
  arrowRight: '/ui/cartoon/basic black/arrow right.png',
  trophy: '/ui/dobo/Icons/adventure_icon_128px.png',
  ribbon: '/ui/cartoon/basic black/ribbon.png',
};

export type IconName = keyof typeof ICON_CATALOG;

export function iconSrc(name: string): string | undefined {
  return ICON_CATALOG[name];
}
