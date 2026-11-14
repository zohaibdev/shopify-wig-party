/* Wig Party — Shop by Cap Construction hero slider (sections/cap-hero.liquid).
   One slide shows at a time; the dots switch it. No autoplay, as the design shows none. */
(function () {
  if (customElements.get('aria-cap-hero-slider')) return;

  customElements.define(
    'aria-cap-hero-slider',
    class extends HTMLElement {
      connectedCallback() {
        this.slides = Array.from(this.querySelectorAll('[data-slide]'));
        this.dots = Array.from(this.querySelectorAll('[data-dot]'));
        this.dots.forEach((dot) => {
          dot.addEventListener('click', () => this.show(Number(dot.dataset.dot)));
        });
      }

      show(index) {
        this.slides.forEach((slide, i) => {
          const active = i === index;
          slide.classList.toggle('is-active', active);
          if (active) slide.removeAttribute('aria-hidden');
          else slide.setAttribute('aria-hidden', 'true');
        });
        this.dots.forEach((dot, i) => {
          const active = i === index;
          dot.classList.toggle('is-active', active);
          if (active) dot.setAttribute('aria-current', 'true');
          else dot.removeAttribute('aria-current');
        });
      }
    }
  );
})();
