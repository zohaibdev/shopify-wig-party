/* Wig Party — Learn guides chip filter (sections/learn-guides.liquid).
 * Each chip carries a topic handle ('' = everything); each card lists its topic handles in
 * data-topics. Pressing a chip shows only the matching cards, or the empty line if none match. */
if (!customElements.get('aria-learn-guides')) {
  customElements.define(
    'aria-learn-guides',
    class AriaLearnGuides extends HTMLElement {
      connectedCallback() {
        this.chips = Array.from(this.querySelectorAll('.aria-learn-guides__chip'));
        this.cards = Array.from(this.querySelectorAll('.aria-learn-guides__card'));
        this.empty = this.querySelector('.aria-learn-guides__empty');
        this.chips.forEach((chip) => chip.addEventListener('click', () => this.select(chip)));
        document.fonts.ready.then(() => this.roundWidths());
      }

      // Figma sizes each hugging chip (and the label) to a whole pixel, rounding up; the browser
      // keeps fractions, which drifts the row up to ~5px by the last chip. Round them the same way.
      roundWidths() {
        const label = this.querySelector('.aria-learn-guides__filter-label');
        [label, ...this.chips].forEach((el) => {
          if (!el) return;
          el.style.width = '';
          el.style.width = `${Math.ceil(el.getBoundingClientRect().width)}px`;
        });
      }

      select(chip) {
        const topic = chip.dataset.topic;
        this.chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
        let shown = 0;
        this.cards.forEach((card) => {
          const match = !topic || (card.dataset.topics || '').split(' ').includes(topic);
          card.hidden = !match;
          if (match) shown += 1;
        });
        if (this.empty) this.empty.hidden = shown > 0;
      }
    }
  );
}
