/* Wig Party — Learn library mobile slider (sections/learn-library.liquid).
 * Below 750px the topic grid is a horizontal scroll-snap row; the dots follow the scroll
 * position and scroll to their panel when pressed. Nothing runs on desktop, where the dots are hidden. */
if (!customElements.get('aria-learn-library')) {
  customElements.define(
    'aria-learn-library',
    class AriaLearnLibrary extends HTMLElement {
      connectedCallback() {
        this.track = this.querySelector('.aria-learn-library__grid');
        this.panels = Array.from(this.querySelectorAll('.aria-learn-library__topic'));
        this.dots = Array.from(this.querySelectorAll('.aria-learn-library__page'));
        if (!this.track || this.dots.length === 0) return;

        this.dots.forEach((dot, i) =>
          dot.addEventListener('click', () => {
            const panel = this.panels[i];
            if (panel) this.track.scrollTo({ left: panel.offsetLeft - this.track.offsetLeft - this.gutter(), behavior: 'smooth' });
          })
        );

        let ticking = false;
        this.track.addEventListener(
          'scroll',
          () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
              ticking = false;
              this.update();
            });
          },
          { passive: true }
        );
      }

      gutter() {
        return parseFloat(getComputedStyle(this.track).paddingLeft) || 0;
      }

      update() {
        const left = this.track.scrollLeft;
        let current = 0;
        let best = Infinity;
        this.panels.forEach((panel, i) => {
          const d = Math.abs(panel.offsetLeft - this.track.offsetLeft - this.gutter() - left);
          if (d < best) {
            best = d;
            current = i;
          }
        });
        this.dots.forEach((dot, i) => {
          if (i === current) dot.setAttribute('aria-current', 'true');
          else dot.removeAttribute('aria-current');
        });
      }
    }
  );
}
