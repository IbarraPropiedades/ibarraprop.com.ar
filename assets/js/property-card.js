/* Tarjeta de propiedad: la usan el generador (Node) y el listado (navegador). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PropertyCard = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function specs(p) {
    var items = [];
    if (p.surface) items.push(["bi-aspect-ratio", Math.round(p.surface) + " m²"]);
    if (p.rooms) items.push(["bi-door-open", p.rooms + " amb."]);
    if (p.baths) items.push(["bi-droplet", p.baths + (p.baths === 1 ? " baño" : " baños")]);
    if (p.garages) items.push(["bi-car-front", p.garages + " coch."]);
    return items
      .map(function (item) {
        return '<li><i class="bi ' + item[0] + '" aria-hidden="true"></i>' + escapeHtml(item[1]) + "</li>";
      })
      .join("");
  }

  function render(p, options) {
    var eager = options && options.eager;
    var list = specs(p);
    return (
      '<article class="prop-card">' +
      '<a class="prop-card__media" href="' + escapeHtml(p.url) + '">' +
      '<img src="' + escapeHtml(p.cover) + '" alt="' + escapeHtml(p.title) + '" width="675" height="506" decoding="async" loading="' + (eager ? "eager" : "lazy") + '" />' +
      '<span class="prop-card__badge">' + escapeHtml(p.operation) + "</span>" +
      (p.photoCount > 1
        ? '<span class="prop-card__count"><i class="bi bi-images" aria-hidden="true"></i> ' + p.photoCount + "</span>"
        : "") +
      "</a>" +
      '<div class="prop-card__body">' +
      '<p class="prop-card__price">' + escapeHtml(p.priceLabel) + "</p>" +
      '<h3 class="prop-card__title"><a href="' + escapeHtml(p.url) + '">' + escapeHtml(p.title) + "</a></h3>" +
      '<p class="prop-card__location">' + escapeHtml(p.type) + " · " + escapeHtml(p.locationLabel) + "</p>" +
      (list ? '<ul class="prop-card__specs">' + list + "</ul>" : "") +
      '<a class="prop-card__whatsapp" href="' + escapeHtml(p.whatsappUrl) + '" target="_blank" rel="noopener">' +
      '<i class="bi bi-whatsapp" aria-hidden="true"></i> Consultar por WhatsApp</a>' +
      "</div></article>"
    );
  }

  return { render: render, escapeHtml: escapeHtml };
});
