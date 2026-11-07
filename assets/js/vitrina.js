/* Vitrina de propiedades: avanza sola, frena con el mouse o el foco y se puede deslizar. */
(function () {
  "use strict";

  var SPEED = 45; // píxeles por segundo
  var TOUCH_RESUME_DELAY = 2500;

  var vitrina = document.querySelector("[data-vitrina]");
  if (!vitrina) return;

  var track = vitrina.querySelector(".vitrina__track");
  var originals = Array.prototype.slice.call(track.children);
  if (originals.length < 2) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  function appendCopy() {
    originals.forEach(function (item) {
      var copy = item.cloneNode(true);
      copy.setAttribute("aria-hidden", "true");
      copy.querySelectorAll("a").forEach(function (link) {
        link.tabIndex = -1;
      });
      track.appendChild(copy);
    });
  }

  // Ancho de un juego completo de tarjetas, con su separación incluida.
  function setWidth() {
    return track.children[originals.length].offsetLeft - originals[0].offsetLeft;
  }

  appendCopy();
  // Copias suficientes para que nunca se vea un hueco, aun en pantallas muy anchas.
  while (track.scrollWidth < setWidth() + vitrina.clientWidth) appendCopy();

  var hovering = false;
  var focused = false;
  var touching = false;
  var resumeTimer = null;
  var position = 0;
  var lastTime = null;

  function step(time) {
    if (lastTime !== null && !hovering && !focused && !touching) {
      var width = setWidth();
      position = (position + (SPEED * (time - lastTime)) / 1000) % width;
      vitrina.scrollLeft = position;
    } else if (hovering || focused || touching) {
      // Al retomar sigue desde donde lo dejó la persona.
      position = vitrina.scrollLeft % setWidth();
    }
    lastTime = time;
    window.requestAnimationFrame(step);
  }

  vitrina.addEventListener("mouseenter", function () {
    hovering = true;
  });
  vitrina.addEventListener("mouseleave", function () {
    hovering = false;
  });
  vitrina.addEventListener("focusin", function () {
    focused = true;
  });
  vitrina.addEventListener("focusout", function () {
    focused = false;
  });
  vitrina.addEventListener(
    "touchstart",
    function () {
      touching = true;
      window.clearTimeout(resumeTimer);
    },
    { passive: true },
  );
  vitrina.addEventListener(
    "touchend",
    function () {
      resumeTimer = window.setTimeout(function () {
        touching = false;
      }, TOUCH_RESUME_DELAY);
    },
    { passive: true },
  );

  window.requestAnimationFrame(step);
})();
