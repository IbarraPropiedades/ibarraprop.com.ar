/* =========================================================
   Ibarra Propiedades - Integración Tokko Broker
   Archivo sugerido: assets/js/tokko-propiedades.js
   ========================================================= */

const TOKKO_CONFIG = {
  apiKey: "a0312df7c197e91ad1f54928d591b8ee616fdbb2",
  baseUrl: "https://www.tokkobroker.com/api/v1/property/",
  lang: "es_ar",
  limit: 12,
  shared: true,
  fallbackImage: "assets/img/properties/property-1.jpg",
  detailPage: "property-single.html",
  whatsappPhone: "5491121805630",
};

const TOKKO_STATE = {
  allProperties: [],
  filteredProperties: [],
  visibleCount: TOKKO_CONFIG.limit,
  loading: false,
};

const OPERATION_MAP = {
  compra: ["Sale"],
  venta: ["Sale"],
  alquiler: ["Rent"],
  temporal: ["Temporary Rent"],
};

const TYPE_MAP = {
  campo: ["Farm", "Campo"],
  casa: ["House", "Casa"],
  cochera: ["Parking", "Garage", "Cochera"],
  departamento: ["Apartment", "Departamento"],
  deposito: ["Storage", "Depósito", "Deposito"],
  "edificio-comercial": ["Commercial Building", "Edificio Comercial"],
  galpon: ["Warehouse", "Galpón", "Galpon"],
  local: ["Business Premises", "Local", "Local Comercial"],
  oficina: ["Office", "Oficina"],
  ph: ["Condo", "PH"],
  terreno: ["Land", "Terreno", "Lote"],
};

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

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

function getSelectedCheckboxValues(dropdownId) {
  return $$(`#dropdown-${dropdownId} input[type="checkbox"]:checked`).map((input) => input.value);
}

function getPropertyTitle(property) {
  return (
    property.publication_title ||
    property.web_title ||
    property.title ||
    property.address ||
    property.fake_address ||
    "Propiedad disponible"
  );
}

function getPropertyLocation(property) {
  return (
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
  const photos = property.photos || [];
  const firstPhoto = photos[0] || {};

  return (
    firstPhoto.image ||
    firstPhoto.original ||
    firstPhoto.url ||
    firstPhoto.thumb ||
    firstPhoto.thumbnail ||
    TOKKO_CONFIG.fallbackImage
  );
}

function getPropertyOperations(property) {
  return Array.isArray(property.operations) ? property.operations : [];
}

function getOperationName(operation) {
  return operation.operation_type || operation.type || operation.name || "Consultar";
}

function translateOperation(operationName = "") {
  const normalized = operationName.toLowerCase();

  if (normalized.includes("sale") || normalized.includes("venta")) return "Venta";
  if (normalized.includes("temporary")) return "Alquiler temporal";
  if (normalized.includes("rent") || normalized.includes("alquiler")) return "Alquiler";

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

  const currencyLabel = currency || "USD";
  const formattedAmount = new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
  }).format(amount);

  return `${currencyLabel} ${formattedAmount}`;
}

function getComparablePrice(property) {
  const { amount, currency } = getMainPrice(property);
  const currencyWeight = currency === "USD" ? 3 : currency === "ARS" ? 2 : 1;

  return {
    amount: Number(amount || 0),
    currencyWeight,
  };
}

function getSurface(property) {
  return property.total_surface || property.surface || property.roofed_surface || "-";
}

function getRooms(property) {
  return property.room_amount || property.suite_amount || property.bedroom_amount || "-";
}

function getBathrooms(property) {
  return property.bathroom_amount || property.toilet_amount || "-";
}

function getGarages(property) {
  return property.parking_lot_amount || property.garage_amount || property.parking_amount || "-";
}

function getCreatedDate(property) {
  return new Date(property.created_at || property.updated_at || property.publication_date || 0).getTime();
}

function propertyMatchesOperation(property, operationFilter) {
  if (!operationFilter || operationFilter === "operacion") return true;

  const allowedOperations = OPERATION_MAP[operationFilter] || [];
  const propertyOperations = getPropertyOperations(property).map((operation) => getOperationName(operation));

  return propertyOperations.some((operationName) => allowedOperations.includes(operationName));
}

function propertyMatchesZones(property, selectedZones) {
  if (!selectedZones.length) return true;

  const locationText = normalizeText([
    property.location?.name,
    property.location?.full_location,
    property.fake_address,
    property.real_address,
  ].filter(Boolean).join(" "));

  return selectedZones.some((zone) => locationText.includes(normalizeText(zone)));
}

function propertyMatchesTypes(property, selectedTypes) {
  if (!selectedTypes.length) return true;

  const propertyType = getPropertyTypeName(property);
  const normalizedPropertyType = normalizeText(propertyType);

  return selectedTypes.some((typeValue) => {
    const mappedTypes = TYPE_MAP[typeValue] || [typeValue];
    return mappedTypes.some((typeName) => normalizedPropertyType === normalizeText(typeName));
  });
}

function sortProperties(properties, sortValue) {
  const sorted = [...properties];

  switch (sortValue) {
    case "precio-asc":
      return sorted.sort((a, b) => getComparablePrice(a).amount - getComparablePrice(b).amount);
    case "precio-desc":
      return sorted.sort((a, b) => getComparablePrice(b).amount - getComparablePrice(a).amount);
    case "titulo-asc":
      return sorted.sort((a, b) => getPropertyTitle(a).localeCompare(getPropertyTitle(b), "es"));
    case "titulo-desc":
      return sorted.sort((a, b) => getPropertyTitle(b).localeCompare(getPropertyTitle(a), "es"));
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
    operation: $("#filtro-operacion")?.value || "",
    zones: getSelectedCheckboxValues("zona"),
    types: getSelectedCheckboxValues("tipo"),
    order: $("#filtro-orden")?.value || "",
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
}

function buildWhatsAppUrl(property) {
  const title = getPropertyTitle(property);
  const location = getPropertyLocation(property);
  const text = `Hola Ibarra Propiedades. Quiero consultar por esta propiedad: ${title} - ${location}`;

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
  const operationName = translateOperation(getOperationName(getMainOperation(property)));
  const price = formatPrice(property);
  const surface = getSurface(property);
  const rooms = getRooms(property);
  const bathrooms = getBathrooms(property);
  const garages = getGarages(property);
  const delay = 100 + (index % 6) * 100;

  return `
    <div class="col-xl-4 col-md-6" data-aos="fade-up" data-aos-delay="${delay}">
      <div class="card tokko-property-card">
        <a href="${escapeHtml(buildDetailUrl(property))}" aria-label="Ver ${escapeHtml(title)}">
          <img
            src="${escapeHtml(image)}"
            alt="${escapeHtml(title)}"
            class="img-fluid"
            loading="lazy"
          />
        </a>
        <div class="card-body">
          <span class="sale-rent">${escapeHtml(operationName)} | ${escapeHtml(price)}</span>
          <h3>
            <a href="${escapeHtml(buildDetailUrl(property))}" class="stretched-link">
              ${escapeHtml(title)}
            </a>
          </h3>
          <p class="tokko-property-location mb-2">${escapeHtml(location)}</p>
          <p class="tokko-property-type mb-3">${escapeHtml(type)}</p>

          <div class="card-content d-flex flex-column justify-content-center text-center mt-3">
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
                <small>Garage</small>
              </div>
            </div>
            <div class="row mt-2 fw-bold">
              <div class="col">${escapeHtml(surface)} m²</div>
              <div class="col">${escapeHtml(rooms)}</div>
              <div class="col">${escapeHtml(bathrooms)}</div>
              <div class="col">${escapeHtml(garages)}</div>
            </div>
          </div>

          <a class="tokko-card-whatsapp" href="${escapeHtml(buildWhatsAppUrl(property))}" target="_blank" rel="noopener">
            Consultar por WhatsApp
          </a>
        </div>
      </div>
    </div>
  `;
}

function renderProperties() {
  const grid = $("#tokko-properties-grid");
  const loadMoreButton = $("#tokko-load-more");
  const resultsCount = $("#tokko-results-count");

  if (!grid) return;

  const visibleProperties = TOKKO_STATE.filteredProperties.slice(0, TOKKO_STATE.visibleCount);

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
    resultsCount.textContent = total ? `Mostrando ${showing} de ${total} propiedades` : "";
  }

  if (loadMoreButton) {
    const hasMore = TOKKO_STATE.visibleCount < TOKKO_STATE.filteredProperties.length;
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

  if (TOKKO_CONFIG.shared) {
    params.set("shared", "true");
  }

  const response = await fetch(`${TOKKO_CONFIG.baseUrl}?${params.toString()}`);

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
  const grid = $("#tokko-properties-grid");
  if (!grid) return;

  grid.innerHTML = `
    <div class="col-12 text-center py-5" id="tokko-loading-state">
      <p class="mb-0">Cargando propiedades...</p>
    </div>
  `;
}

function showErrorState(error) {
  const grid = $("#tokko-properties-grid");
  if (!grid) return;

  console.error("Error cargando propiedades desde Tokko:", error);

  grid.innerHTML = `
    <div class="col-12 text-center py-5">
      <h3>No pudimos cargar las propiedades.</h3>
      <p>Revisá la API Key de Tokko o intentá nuevamente en unos minutos.</p>
    </div>
  `;
}

function bindFilters() {
  $("#filtro-operacion")?.addEventListener("change", applyFilters);
  $("#filtro-orden")?.addEventListener("change", applyFilters);

  $$("#dropdown-zona input, #dropdown-tipo input").forEach((input) => {
    input.addEventListener("change", applyFilters);
  });

  $("#tokko-load-more")?.addEventListener("click", () => {
    TOKKO_STATE.visibleCount += TOKKO_CONFIG.limit;
    renderProperties();
  });
}

window.resetFiltros = function resetFiltros() {
  const operationSelect = $("#filtro-operacion");
  const orderSelect = $("#filtro-orden");

  if (operationSelect) operationSelect.value = "operacion";
  if (orderSelect) orderSelect.value = "";

  $$("#dropdown-zona input, #dropdown-tipo input").forEach((input) => {
    input.checked = false;
  });

  applyFilters();
};

async function initTokkoProperties() {
  if (TOKKO_CONFIG.apiKey === "PEGAR_API_KEY_DE_TOKKO_ACA") {
    showErrorState(new Error("Falta configurar la API Key de Tokko"));
    return;
  }

  showLoadingState();
  bindFilters();

  try {
    TOKKO_STATE.loading = true;
    TOKKO_STATE.allProperties = await fetchAllTokkoProperties();
    TOKKO_STATE.filteredProperties = [...TOKKO_STATE.allProperties];
    applyFilters();
  } catch (error) {
    showErrorState(error);
  } finally {
    TOKKO_STATE.loading = false;
  }
}

document.addEventListener("DOMContentLoaded", initTokkoProperties);
