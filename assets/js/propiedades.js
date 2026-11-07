/* Listado de propiedades. Los datos los genera scripts/build-propiedades.mjs. */
(() => {
  "use strict";

  const DATA_URL = "/data/propiedades.json";
  const PAGE_SIZE = 12;
  const OPERATION_ALIASES = { "alquiler-temporario": "alquiler-temporal" };
  const state = { all: [], filtered: [], visible: PAGE_SIZE };

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));
  const { render, escapeHtml } = window.PropertyCard;

  const elements = {
    grid: $("#tokko-properties-grid"),
    count: $("#tokko-results-count"),
    more: $("#tokko-load-more"),
    operation: $("#filtro-operacion"),
    order: $("#filtro-orden"),
  };

  const normalize = (value = "") =>
    String(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  const prettify = (slug) =>
    slug.split("-").filter(Boolean).map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");

  const unique = (values) =>
    [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));

  const checkbox = (value, label) =>
    `<label><input type="checkbox" value="${escapeHtml(value)}" /> ${escapeHtml(label)}</label>`;

  const checked = (id) => $$(`#dropdown-${id} input:checked`).map((input) => input.value);

  function fillFilters() {
    const operations = unique(state.all.map((p) => p.operation));
    elements.operation.innerHTML =
      '<option value="">Operación</option>' +
      operations.map((name) => `<option value="${normalize(name)}">${escapeHtml(name)}</option>`).join("");

    const zones = unique(state.all.flatMap((p) => [p.partido, p.barrio]));
    $("#dropdown-zona").innerHTML = zones.map((name) => checkbox(normalize(name), name)).join("");

    const types = unique(state.all.map((p) => p.type));
    $("#dropdown-tipo").innerHTML = types.map((name) => checkbox(normalize(name), name)).join("");
  }

  // Marca un filtro; si la URL pide algo sin stock, lo agrega para mostrar qué se filtró.
  function checkValue(id, value) {
    const dropdown = $(`#dropdown-${id}`);
    let input = $$("input", dropdown).find((item) => item.value === value);
    if (!input) {
      dropdown.insertAdjacentHTML("afterbegin", checkbox(value, prettify(value)));
      input = $("input", dropdown);
    }
    input.checked = true;
  }

  function applyUrlFilters() {
    const params = new URLSearchParams(window.location.search);
    const operation = normalize(params.get("operacion") || "");
    if (operation) {
      const value = OPERATION_ALIASES[operation] || operation;
      if (!$$("option", elements.operation).some((option) => option.value === value)) {
        elements.operation.insertAdjacentHTML(
          "beforeend",
          `<option value="${escapeHtml(value)}">${escapeHtml(prettify(value))}</option>`,
        );
      }
      elements.operation.value = value;
    }
    params.getAll("tipo").forEach((tipo) => checkValue("tipo", normalize(tipo)));
    params.getAll("zona").forEach((zona) => checkValue("zona", normalize(zona).replace(/-centro$/, "")));
  }

  // USD primero, después pesos, y al final los "Consultar": comparar montos de
  // monedas distintas pondría un alquiler en pesos arriba de una venta en dólares.
  function comparePrice(a, b, direction) {
    const rank = (p) => (!p.amount ? 2 : p.currency === "USD" ? 0 : 1);
    return rank(a) - rank(b) || direction * (a.amount - b.amount);
  }

  function sorted(list, order) {
    const items = [...list];
    switch (order) {
      case "precio-asc":
        return items.sort((a, b) => comparePrice(a, b, 1));
      case "precio-desc":
        return items.sort((a, b) => comparePrice(a, b, -1));
      case "titulo-asc":
        return items.sort((a, b) => a.title.localeCompare(b.title, "es"));
      case "titulo-desc":
        return items.sort((a, b) => b.title.localeCompare(a.title, "es"));
      case "fecha-asc":
        return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      default:
        return items; // el JSON ya viene de más nuevas a más antiguas
    }
  }

  function renderList() {
    const visible = state.filtered.slice(0, state.visible);
    const whatsapp =
      "https://api.whatsapp.com/send?phone=5491121805630&text=" +
      encodeURIComponent("Hola Ibarra Propiedades. Estoy buscando una propiedad.");

    elements.grid.innerHTML = visible.length
      ? visible
          .map((p, index) => `<div class="col-xl-4 col-md-6">${render(p, { eager: index < 3 })}</div>`)
          .join("")
      : `<div class="col-12 text-center py-5">
           <h3>Hoy no tenemos propiedades con esos filtros.</h3>
           <p>Contanos qué buscás y te avisamos cuando ingrese algo así.</p>
           <a class="btn btn-primary" href="${whatsapp}" target="_blank" rel="noopener">Escribinos por WhatsApp</a>
         </div>`;

    const total = state.filtered.length;
    elements.count.textContent = total ? `Mostrando ${visible.length} de ${total} propiedades` : "";
    elements.more.classList.toggle("d-none", state.visible >= total);
  }

  function applyFilters() {
    const operation = elements.operation.value;
    const zones = checked("zona");
    const types = checked("tipo");

    const filtered = state.all.filter(
      (p) =>
        (!operation || p.operationSlug === operation) &&
        (!zones.length || zones.some((zone) => p.search.includes(zone))) &&
        (!types.length || types.includes(p.typeSlug)),
    );

    state.filtered = sorted(filtered, elements.order.value);
    state.visible = PAGE_SIZE;
    renderList();

    $$(".custom-multiselect").forEach((wrapper) => {
      const count = wrapper.querySelector(".dropdown-count");
      const selected = checked(wrapper.dataset.id).length;
      if (count) count.textContent = selected ? `(${selected})` : "";
      wrapper.querySelector(".dropdown-button-text").textContent = wrapper.dataset.label;
    });
  }

  function closeDropdowns() {
    $$(".dropdown-options").forEach((dropdown) => {
      dropdown.style.display = "none";
      dropdown.classList.remove("is-open");
    });
  }

  function resetFilters() {
    elements.operation.value = "";
    elements.order.value = "";
    $$("#dropdown-zona input, #dropdown-tipo input").forEach((input) => {
      input.checked = false;
    });
    closeDropdowns();
    applyFilters();
  }

  function bindFilters() {
    elements.operation.addEventListener("change", applyFilters);
    elements.order.addEventListener("change", applyFilters);
    $("#limpiar-filtros").addEventListener("click", resetFilters);

    $$(".custom-multiselect").forEach((wrapper) => {
      wrapper.querySelector(".dropdown-button").addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const dropdown = $(`#dropdown-${wrapper.dataset.id}`);
        const open = dropdown.classList.contains("is-open");
        closeDropdowns();
        if (!open) {
          dropdown.style.display = "block";
          dropdown.classList.add("is-open");
        }
      });
    });

    document.addEventListener("change", (event) => {
      if (event.target.matches("#dropdown-zona input, #dropdown-tipo input")) applyFilters();
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".custom-multiselect")) closeDropdowns();
    });
    elements.more.addEventListener("click", () => {
      state.visible += PAGE_SIZE;
      renderList();
    });
  }

  function bindMobileFilters() {
    const openButton = $("#open-mobile-filters");
    const closeButton = $("#close-mobile-filters");
    const overlay = $("#mobile-filters-overlay");
    const sidebar = $(".properties-sidebar");
    const setOpen = (open) => {
      document.body.classList.toggle("mobile-filters-open", open);
      openButton.setAttribute("aria-expanded", String(open));
    };

    sidebar.id = "properties-mobile-sidebar";
    openButton.setAttribute("aria-controls", sidebar.id);
    openButton.setAttribute("aria-expanded", "false");
    openButton.addEventListener("click", () => setOpen(true));
    closeButton.addEventListener("click", () => setOpen(false));
    overlay.addEventListener("click", () => setOpen(false));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setOpen(false);
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth >= 992) setOpen(false);
    });
  }

  async function init() {
    bindFilters();
    bindMobileFilters();
    try {
      const response = await fetch(DATA_URL);
      if (!response.ok) throw new Error(`Respuesta ${response.status}`);
      state.all = (await response.json()).properties;
      fillFilters();
      applyUrlFilters();
      applyFilters();
    } catch (error) {
      console.error("Error cargando propiedades:", error);
      elements.grid.innerHTML = `
        <div class="col-12 text-center py-5">
          <h3>No pudimos cargar las propiedades.</h3>
          <p>Intentá de nuevo en unos minutos o escribinos por WhatsApp.</p>
        </div>`;
    }
  }

  init();
})();
