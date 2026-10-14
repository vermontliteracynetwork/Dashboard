// A picture for every element (Build Queue 169, her words 2026-10-14: "i want images for each element
// added representing the element. this adds and enhances the visual feel claudia and i are requring for
// this program"). Cut from her upload, "The Periodic Table of the Elements, in Pictures" by Keith
// Enevoldsen (elements.wlonk.com), Creative Commons Attribution-ShareAlike 4.0, so the credit stays on
// the card. All 118 are in public/games/scienceLab/elements/: SYM.png is the picture, SYM-card.png the
// whole cell (symbol, name, picture and what it is used for). Works offline; nothing is fetched.
export const elementPic = (sym: string) => `/games/scienceLab/elements/${sym}.png`;
export const elementCard = (sym: string) => `/games/scienceLab/elements/${sym}-card.png`;
export const ELEMENT_PIC_CREDIT = 'Picture: Keith Enevoldsen, elements.wlonk.com (CC BY-SA 4.0)';

export default function ElementPhoto({ name, sym, card = true }: { name: string; sym: string; card?: boolean }) {
  return (
    <figure className="lab-photo">
      <img src={card ? elementCard(sym) : elementPic(sym)} alt={`${name}: a picture of what it is used for`} loading="lazy" />
      <figcaption>{ELEMENT_PIC_CREDIT}</figcaption>
    </figure>
  );
}
