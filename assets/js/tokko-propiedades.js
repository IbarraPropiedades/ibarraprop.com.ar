/* =========================================================
   Ibarra Propiedades - Integración Tokko Broker
   Archivo sugerido: assets/js/tokko-propiedades.js
   ========================================================= */

(() => {
  "use strict";

  const TOKKO_CONFIG = {
    apiKey: "a0312df7c197e91ad1f54928d591b8ee616fdbb2",
    baseUrl: "https://www.tokkobroker.com/api/v1/property/",
    lang: "es_ar",
    limit: 12,
    shared: true,
    fallbackImage: "assets/img/properties/property-1.jpg",
    detailPage: "detalle-propiedad.html",
    whatsappPhone: "5491121805630",
  };

  const TOKKO_STATE = {
    allProperties: [],
    filteredProperties: [],
    visibleCount: TOKKO_CONFIG.limit,
    loading: false,
  };

  const SELECTORS = {
    grid: "#tokko-properties-grid",
    resultsCount: "#tokko-results-count",
    loadMore: "#tokko-load-more",
    operation: "#filtro-operacion",
    order: "#filtro-orden",
    zoneDropdown: "#dropdown-zona",
    typeDropdown: "#dropdown-tipo",
  };

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) =>
    Array.from(parent.querySelectorAll(selector));

  function normalizeText(value = "") {
    return String(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatLabel(value = "") {
    const text = String(value).trim();
    if (!text) return "Sin especificar";
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function getSelectedCheckboxValues(dropdownId) {
    return $$(`#dropdown-${dropdownId} input[type="checkbox"]:checked`).map(
      (input) => input.value,
    );
  }

  function getPropertyTitle(property) {
    return (
      property.publication_title ||
      property.web_title ||
      property.title ||
      property.fake_address ||
      property.real_address ||
      "Propiedad disponible"
    );
  }

  function getPropertyLocationName(property) {
    return property.location?.name || "";
  }

  function getPropertyLocation(property) {
    return (
      property.location?.short_location ||
      property.location?.full_location ||
      property.location?.name ||
      property.fake_address ||
      property.real_address ||
      "Consultar ubicación"
    );
  }

  function getPropertyTypeName(property) {
    return property.type?.name || property.property_type?.name || "Propiedad";
  }

  function getPropertyImage(property) {
    const photos = Array.isArray(property.photos) ? property.photos : [];
    const cover =
      photos.find((photo) => photo.is_front_cover) || photos[0] || {};

    return (
      cover.image ||
      cover.original ||
      cover.url ||
      cover.thumb ||
      cover.thumbnail ||
      TOKKO_CONFIG.fallbackImage
    );
  }

  function getPropertyOperations(property) {
    return Array.isArray(property.operations) ? property.operations : [];
  }

  function getOperationName(operation = {}) {
    return (
      operation.operation_type ||
      operation.type ||
      operation.name ||
      "Consultar"
    );
  }

  function normalizeOperationName(operationName = "") {
    const normalized = normalizeText(operationName);

    if (["venta", "sale", "compra"].includes(normalized)) return "venta";
    if (["alquiler", "rent"].includes(normalized)) return "alquiler";
    if (
      [
        "alquiler-temporal",
        "alquiler-temporario",
        "temporary-rent",
        "temporal",
      ].includes(normalized)
    ) {
      return "alquiler-temporal";
    }

    return normalized;
  }

  function translateOperation(operationName = "") {
    const normalized = normalizeOperationName(operationName);

    if (normalized === "venta") return "Venta";
    if (normalized === "alquiler") return "Alquiler";
    if (normalized === "alquiler-temporal") return "Alquiler temporal";

    return operationName || "Consultar";
  }

  function getMainOperation(property) {
    return getPropertyOperations(property)[0] || {};
  }

  function getMainPrice(property) {
    const operation = getMainOperation(property);
    const prices = operation.prices || [];
    const price = prices[0] || operation.price || property.price || {};

    if (typeof price === "number") {
      return { amount: price, currency: operation.currency || "" };
    }

    return {
      amount: Number(price.price || price.amount || operation.amount || 0),
      currency: price.currency || operation.currency || "",
    };
  }

  function formatPrice(property) {
    const { amount, currency } = getMainPrice(property);
    if (!amount) return "Consultar";

    const formattedAmount = new Intl.NumberFormat("es-AR", {
      maximumFractionDigits: 0,
    }).format(amount);

    return `${currency || "USD"} ${formattedAmount}`;
  }

  function getComparablePrice(property) {
    const { amount, currency } = getMainPrice(property);
    const currencyWeight = currency === "USD" ? 3 : currency === "ARS" ? 2 : 1;

    return {
      amount: Number(amount || 0),
      currencyWeight,
    };
  }

  function formatMetric(value, suffix = "") {
    if (
      value === null ||
      value === undefined ||
      value === "" ||
      Number(value) === 0
    )
      return "-";
    const number = Number(value);
    const output = Number.isFinite(number)
      ? new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(
          number,
        )
      : value;
    return suffix ? `${output}${suffix}` : output;
  }

  function getSurface(property) {
    return formatMetric(
      property.total_surface || property.surface || property.roofed_surface,
      " m²",
    );
  }

  function getRooms(property) {
    return formatMetric(
      property.room_amount || property.suite_amount || property.bedroom_amount,
    );
  }

  function getBathrooms(property) {
    return formatMetric(property.bathroom_amount || property.toilet_amount);
  }

  function getGarages(property) {
    return formatMetric(
      property.parking_lot_amount ||
        property.garage_amount ||
        property.parking_amount,
    );
  }

  function getCreatedDate(property) {
    return new Date(
      property.created_at ||
        property.updated_at ||
        property.publication_date ||
        0,
    ).getTime();
  }

  function getUniqueSortedValues(values) {
    return [
      ...new Set(values.filter(Boolean).map((value) => String(value).trim())),
    ].sort((a, b) => a.localeCompare(b, "es"));
  }

  function buildCheckboxOption(value, label) {
    return `
      <label>
        <input type="checkbox" value="${escapeHtml(value)}" />
        ${escapeHtml(label)}
      </label>
    `;
  }

  function populateOperationFilter(properties) {
    const select = $(SELECTORS.operation);
    if (!select) return;

    const operations = getUniqueSortedValues(
      properties.flatMap((property) =>
        getPropertyOperations(property).map((operation) =>
          getOperationName(operation),
        ),
      ),
    );

    const preferredOrder = ["Venta", "Alquiler", "Alquiler temporal"];
    const sortedOperations = operations.sort((a, b) => {
      const aIndex = preferredOrder.indexOf(translateOperation(a));
      const bIndex = preferredOrder.indexOf(translateOperation(b));
      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
    });

    select.innerHTML = `
      <option value="">Operación</option>
      ${sortedOperations
        .map((operationName) => {
          const label = translateOperation(operationName);
          const value = normalizeOperationName(operationName);
          return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
        })
        .join("")}
    `;
  }

  function populateCheckboxFilter(dropdownSelector, values, emptyText) {
    const dropdown = $(dropdownSelector);
    if (!dropdown) return;

    const uniqueValues = getUniqueSortedValues(values);

    dropdown.innerHTML = uniqueValues.length
      ? uniqueValues
          .map((value) => buildCheckboxOption(normalizeText(value), value))
          .join("")
      : `<p class="tokko-filter-empty">${escapeHtml(emptyText)}</p>`;
  }

  function populateDynamicFilters(properties) {
    populateOperationFilter(properties);
    populateCheckboxFilter(
      SELECTORS.zoneDropdown,
      properties.map(getPropertyLocationName),
      "Sin zonas disponibles",
    );
    populateCheckboxFilter(
      SELECTORS.typeDropdown,
      properties.map(getPropertyTypeName),
      "Sin tipos disponibles",
    );
    updateDropdownButtonLabels();
  }

  function propertyMatchesOperation(property, operationFilter) {
    if (!operationFilter) return true;

    return getPropertyOperations(property).some((operation) => {
      return (
        normalizeOperationName(getOperationName(operation)) === operationFilter
      );
    });
  }

  function propertyMatchesZones(property, selectedZones) {
    if (!selectedZones.length) return true;

    const locationValues = [
      property.location?.name,
      property.location?.short_location,
      property.location?.full_location,
      property.fake_address,
      property.real_address,
    ]
      .filter(Boolean)
      .map(normalizeText);

    return selectedZones.some((zone) =>
      locationValues.some((locationValue) => locationValue.includes(zone)),
    );
  }

  function propertyMatchesTypes(property, selectedTypes) {
    if (!selectedTypes.length) return true;

    const propertyType = normalizeText(getPropertyTypeName(property));
    return selectedTypes.includes(propertyType);
  }

  function sortProperties(properties, sortValue) {
    const sorted = [...properties];

    switch (sortValue) {
      case "precio-asc":
        return sorted.sort(
          (a, b) => getComparablePrice(a).amount - getComparablePrice(b).amount,
        );
      case "precio-desc":
        return sorted.sort(
          (a, b) => getComparablePrice(b).amount - getComparablePrice(a).amount,
        );
      case "titulo-asc":
        return sorted.sort((a, b) =>
          getPropertyTitle(a).localeCompare(getPropertyTitle(b), "es"),
        );
      case "titulo-desc":
        return sorted.sort((a, b) =>
          getPropertyTitle(b).localeCompare(getPropertyTitle(a), "es"),
        );
      case "fecha-asc":
        return sorted.sort((a, b) => getCreatedDate(a) - getCreatedDate(b));
      case "fecha-desc":
        return sorted.sort((a, b) => getCreatedDate(b) - getCreatedDate(a));
      default:
        return sorted;
    }
  }

  function getCurrentFilters() {
    return {
      operation: $(SELECTORS.operation)?.value || "",
      zones: getSelectedCheckboxValues("zona"),
      types: getSelectedCheckboxValues("tipo"),
      order: $(SELECTORS.order)?.value || "",
    };
  }

  function applyFilters() {
    const filters = getCurrentFilters();

    const filtered = TOKKO_STATE.allProperties.filter((property) => {
      return (
        propertyMatchesOperation(property, filters.operation) &&
        propertyMatchesZones(property, filters.zones) &&
        propertyMatchesTypes(property, filters.types)
      );
    });

    TOKKO_STATE.filteredProperties = sortProperties(filtered, filters.order);
    TOKKO_STATE.visibleCount = TOKKO_CONFIG.limit;
    renderProperties();
    updateDropdownButtonLabels();
  }

  function buildWhatsAppUrl(property) {
    const title = getPropertyTitle(property);
    const location = getPropertyLocation(property);
    const referenceCode = property.reference_code
      ? ` - Código: ${property.reference_code}`
      : "";
    const text = `Hola Ibarra Propiedades. Quiero consultar por esta propiedad: ${title} - ${location}${referenceCode}`;

    return `https://api.whatsapp.com/send?phone=${TOKKO_CONFIG.whatsappPhone}&text=${encodeURIComponent(text)}`;
  }

  function buildDetailUrl(property) {
    const id = property.id || property.reference_code || property.web_id;
    return `${TOKKO_CONFIG.detailPage}?id=${encodeURIComponent(id || "")}`;
  }

  function buildPropertyCard(property, index) {
    const title = getPropertyTitle(property);
    const location = getPropertyLocation(property);
    const type = getPropertyTypeName(property);
    const image = getPropertyImage(property);
    const operationName = translateOperation(
      getOperationName(getMainOperation(property)),
    );
    const price = formatPrice(property);
    const surface = getSurface(property);
    const rooms = getRooms(property);
    const bathrooms = getBathrooms(property);
    const garages = getGarages(property);
    const delay = 100 + (index % 6) * 100;

    return `
      <div class="col-xl-4 col-md-6" data-aos="fade-up" data-aos-delay="${delay}">
        <article class="card tokko-property-card h-100">
          <a class="tokko-card-media" href="${escapeHtml(buildDetailUrl(property))}" aria-label="Ver ${escapeHtml(title)}">
            <img
              src="${escapeHtml(image)}"
              alt="${escapeHtml(title)}"
              class="img-fluid"
              loading="lazy"
              onerror="this.src='${escapeHtml(TOKKO_CONFIG.fallbackImage)}'"
            />
            <span class="sale-rent">${escapeHtml(operationName)} | ${escapeHtml(price)}</span>
          </a>

          <div class="card-body d-flex flex-column">
            <p class="tokko-property-type mb-2">${escapeHtml(type)}</p>
            <h3>
              <a href="${escapeHtml(buildDetailUrl(property))}">
                ${escapeHtml(title)}
              </a>
            </h3>
            <p class="tokko-property-location mb-3">${escapeHtml(location)}</p>

            <div class="card-content d-flex flex-column justify-content-center text-center mt-auto">
              <div class="row propery-info text-muted">
                <div class="col">
                  <i class="fas fa-vector-square"></i><br />
                  <small>Área</small>
                </div>
                <div class="col">
                  <i class="fas fa-bed"></i><br />
                  <small>Amb.</small>
                </div>
                <div class="col">
                  <i class="fas fa-bath"></i><br />
                  <small>Baños</small>
                </div>
                <div class="col">
                  <i class="fas fa-car"></i><br />
                  <small>Coch.</small>
                </div>
              </div>
              <div class="row mt-2 fw-bold">
                <div class="col">${escapeHtml(surface)}</div>
                <div class="col">${escapeHtml(rooms)}</div>
                <div class="col">${escapeHtml(bathrooms)}</div>
                <div class="col">${escapeHtml(garages)}</div>
              </div>
            </div>

            <a class="tokko-card-whatsapp mt-3" href="${escapeHtml(buildWhatsAppUrl(property))}" target="_blank" rel="noopener">
              Consultar por WhatsApp
            </a>
          </div>
        </article>
      </div>
    `;
  }

  function renderProperties() {
    const grid = $(SELECTORS.grid);
    const loadMoreButton = $(SELECTORS.loadMore);
    const resultsCount = $(SELECTORS.resultsCount);

    if (!grid) return;

    const visibleProperties = TOKKO_STATE.filteredProperties.slice(
      0,
      TOKKO_STATE.visibleCount,
    );

    if (!visibleProperties.length) {
      grid.innerHTML = `
        <div class="col-12 text-center py-5">
          <h3>No encontramos propiedades con esos filtros.</h3>
          <p>Probá limpiando los filtros o consultanos por WhatsApp.</p>
        </div>
      `;
    } else {
      grid.innerHTML = visibleProperties.map(buildPropertyCard).join("");
    }

    if (resultsCount) {
      const total = TOKKO_STATE.filteredProperties.length;
      const showing = visibleProperties.length;
      resultsCount.textContent = total
        ? `Mostrando ${showing} de ${total} propiedades`
        : "";
    }

    if (loadMoreButton) {
      const hasMore =
        TOKKO_STATE.visibleCount < TOKKO_STATE.filteredProperties.length;
      loadMoreButton.classList.toggle("d-none", !hasMore);
    }

    if (window.AOS) {
      AOS.refreshHard();
    }
  }

  async function fetchTokkoPage(offset = 0) {
    const params = new URLSearchParams({
      format: "json",
      key: TOKKO_CONFIG.apiKey,
      lang: TOKKO_CONFIG.lang,
      limit: TOKKO_CONFIG.limit,
      offset,
    });

    if (TOKKO_CONFIG.shared) params.set("shared", "true");

    const response = await fetch(
      `${TOKKO_CONFIG.baseUrl}?${params.toString()}`,
    );

    if (!response.ok) {
      throw new Error(`Tokko respondió con error ${response.status}`);
    }

    return response.json();
  }

  async function fetchAllTokkoProperties() {
    const firstPage = await fetchTokkoPage(0);
    const allProperties = [...(firstPage.objects || [])];
    const total = firstPage.meta?.total_count || allProperties.length;

    let offset = TOKKO_CONFIG.limit;

    while (offset < total) {
      const page = await fetchTokkoPage(offset);
      allProperties.push(...(page.objects || []));
      offset += TOKKO_CONFIG.limit;
    }

    return allProperties;
  }

  function showLoadingState() {
    const grid = $(SELECTORS.grid);
    if (!grid) return;

    grid.innerHTML = `
      <div class="col-12 text-center py-5" id="tokko-loading-state">
        <p class="mb-0">Cargando propiedades...</p>
      </div>
    `;
  }

  function showErrorState(error) {
    const grid = $(SELECTORS.grid);
    if (!grid) return;

    console.error("Error cargando propiedades desde Tokko:", error);

    grid.innerHTML = `
      <div class="col-12 text-center py-5">
        <h3>No pudimos cargar las propiedades.</h3>
        <p>Revisá la API Key de Tokko o intentá nuevamente en unos minutos.</p>
      </div>
    `;
  }

  function updateDropdownButtonLabels() {
    $$(".custom-multiselect").forEach((wrapper) => {
      const id = wrapper.dataset.id;
      const label = wrapper.dataset.label || (id === "zona" ? "Zona" : "Tipo");
      const selectedCount = $$(
        `#dropdown-${id} input[type="checkbox"]:checked`,
      ).length;
      const count = wrapper.querySelector(".dropdown-count");

      if (count) {
        count.textContent = selectedCount ? `(${selectedCount})` : "";
      }

      const buttonText = wrapper.querySelector(".dropdown-button-text");
      if (buttonText) {
        buttonText.textContent = label;
      }
    });
  }

  function closeAllDropdowns() {
    $$(".dropdown-options").forEach((dropdown) => {
      dropdown.style.display = "none";
      dropdown.classList.remove("is-open");
    });
  }

  function toggleDropdown(id) {
    const dropdown = $(`#dropdown-${id}`);
    if (!dropdown) return;

    const isOpen =
      dropdown.classList.contains("is-open") ||
      dropdown.style.display === "block";
    closeAllDropdowns();

    if (!isOpen) {
      dropdown.style.display = "block";
      dropdown.classList.add("is-open");
    }
  }

  function bindFilters() {
    $(SELECTORS.operation)?.addEventListener("change", applyFilters);
    $(SELECTORS.order)?.addEventListener("change", applyFilters);

    $$(".custom-multiselect").forEach((wrapper) => {
      const id = wrapper.dataset.id;
      const button = wrapper.querySelector(".dropdown-button");
      button?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleDropdown(id);
      });
    });

    document.addEventListener("change", (event) => {
      if (event.target.matches("#dropdown-zona input, #dropdown-tipo input")) {
        applyFilters();
      }
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".custom-multiselect")) {
        closeAllDropdowns();
      }
    });

    $(SELECTORS.loadMore)?.addEventListener("click", () => {
      TOKKO_STATE.visibleCount += TOKKO_CONFIG.limit;
      renderProperties();
    });
  }

  function resetFiltros() {
    const operationSelect = $(SELECTORS.operation);
    const orderSelect = $(SELECTORS.order);

    if (operationSelect) operationSelect.value = "";
    if (orderSelect) orderSelect.value = "";

    $$("#dropdown-zona input, #dropdown-tipo input").forEach((input) => {
      input.checked = false;
    });

    closeAllDropdowns();
    applyFilters();
  }

  async function initTokkoProperties() {
    window.toggleDropdown = toggleDropdown;
    window.resetFiltros = resetFiltros;

    if (!TOKKO_CONFIG.apiKey) {
      showErrorState(new Error("Falta configurar la API Key de Tokko"));
      return;
    }

    showLoadingState();
    bindFilters();

    try {
      TOKKO_STATE.loading = true;
      TOKKO_STATE.allProperties = await fetchAllTokkoProperties();
      TOKKO_STATE.filteredProperties = [...TOKKO_STATE.allProperties];
      populateDynamicFilters(TOKKO_STATE.allProperties);
      applyFilters();
    } catch (error) {
      showErrorState(error);
    } finally {
      TOKKO_STATE.loading = false;
    }
  }

  document.addEventListener("DOMContentLoaded", initTokkoProperties);

  document.addEventListener("DOMContentLoaded", function () {
    const body = document.body;
    const openButton = document.getElementById("open-mobile-filters");
    const closeButton = document.getElementById("close-mobile-filters");
    const overlay = document.getElementById("mobile-filters-overlay");
    const sidebar = document.querySelector(".properties-sidebar");

    if (!openButton || !closeButton || !overlay || !sidebar) return;

    function openFilters() {
      body.classList.add("mobile-filters-open");
      openButton.setAttribute("aria-expanded", "true");
    }

    function closeFilters() {
      body.classList.remove("mobile-filters-open");
      openButton.setAttribute("aria-expanded", "false");
    }

    openButton.setAttribute("aria-expanded", "false");
    openButton.setAttribute("aria-controls", "properties-mobile-sidebar");

    sidebar.setAttribute("id", "properties-mobile-sidebar");

    openButton.addEventListener("click", openFilters);
    closeButton.addEventListener("click", closeFilters);
    overlay.addEventListener("click", closeFilters);

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeFilters();
      }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth >= 992) {
        closeFilters();
      }
    });
  });
})();
