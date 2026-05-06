/* =========================================================
   Ibarra Propiedades - Detalle de propiedad Tokko Broker
   Archivo sugerido: assets/js/tokko-detalle-propiedad.js
   URL esperada: detalle-propiedad.html?id=8017343
   ========================================================= */

const TOKKO_DETAIL_CONFIG = {
  apiKey: "a0312df7c197e91ad1f54928d591b8ee616fdbb2",
  baseUrl: "https://www.tokkobroker.com/api/v1/property/",
  lang: "es_ar",
  shared: true,
  fallbackImage: "assets/img/properties/property-1.jpg",
  listPage: "propiedades.html",
  whatsappPhone: "5491121805630",
};

const $ = (selector, parent = document) => parent.querySelector(selector);

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function getTitle(property) {
  return property.publication_title || property.web_title || property.title || property.fake_address || "Propiedad disponible";
}

function getLocation(property) {
  return property.location?.full_location || property.location?.name || property.fake_address || property.real_address || "Consultar ubicación";
}

function getShortLocation(property) {
  return property.location?.short_location || property.location?.name || "Consultar ubicación";
}

function getType(property) {
  return property.type?.name || property.property_type?.name || "Propiedad";
}

function getOperations(property) {
  return Array.isArray(property.operations) ? property.operations : [];
}

function getOperationName(operation) {
  return operation.operation_type || operation.type || operation.name || "Consultar";
}

function translateOperation(operationName = "") {
  const normalized = normalizeText(operationName);

  if (normalized.includes("sale") || normalized.includes("venta")) return "Venta";
  if (normalized.includes("temporary") || normalized.includes("tempor")) return "Alquiler temporal";
  if (normalized.includes("rent") || normalized.includes("alquiler")) return "Alquiler";

  return operationName || "Consultar";
}

function getMainOperation(property) {
  return getOperations(property)[0] || {};
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

  const formatted = new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
  }).format(amount);

  return `${currency || "USD"} ${formatted}`;
}

function formatNumber(value) {
  const number = Number(value);
  if (!number) return "-";
  return number.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function getSurface(property) {
  return property.total_surface || property.surface || property.roofed_surface || "0";
}

function getPhotos(property) {
  const photos = Array.isArray(property.photos) ? property.photos : [];
  const sorted = [...photos].sort((a, b) => {
    if (a.is_front_cover) return -1;
    if (b.is_front_cover) return 1;
    return (a.order || 0) - (b.order || 0);
  });

  if (!sorted.length) {
    return [{ image: TOKKO_DETAIL_CONFIG.fallbackImage, description: getTitle(property) }];
  }

  return sorted;
}

function getPhotoUrl(photo) {
  return photo.original || photo.image || photo.url || photo.thumb || TOKKO_DETAIL_CONFIG.fallbackImage;
}

function buildTokkoDetailUrl(id) {
  const params = new URLSearchParams({
    format: "json",
    key: TOKKO_DETAIL_CONFIG.apiKey,
    lang: TOKKO_DETAIL_CONFIG.lang,
  });

  if (TOKKO_DETAIL_CONFIG.shared) params.set("shared", "true");

  return `${TOKKO_DETAIL_CONFIG.baseUrl}${encodeURIComponent(id)}/?${params.toString()}`;
}

function buildTokkoListUrl() {
  const params = new URLSearchParams({
    format: "json",
    key: TOKKO_DETAIL_CONFIG.apiKey,
    lang: TOKKO_DETAIL_CONFIG.lang,
    limit: 100,
    offset: 0,
  });

  if (TOKKO_DETAIL_CONFIG.shared) params.set("shared", "true");

  return `${TOKKO_DETAIL_CONFIG.baseUrl}?${params.toString()}`;
}

async function fetchPropertyById(id) {
  const detailResponse = await fetch(buildTokkoDetailUrl(id));

  if (detailResponse.ok) {
    return detailResponse.json();
  }

  // Fallback: algunas cuentas no exponen el detalle directo.
  // En ese caso buscamos dentro del listado público por id/reference_code.
  const listResponse = await fetch(buildTokkoListUrl());

  if (!listResponse.ok) {
    throw new Error(`Tokko respondió con error ${detailResponse.status}`);
  }

  const data = await listResponse.json();
  const property = (data.objects || []).find((item) => {
    return String(item.id) === String(id) || String(item.reference_code) === String(id);
  });

  if (!property) {
    throw new Error("No se encontró la propiedad solicitada");
  }

  return property;
}

function buildWhatsAppUrl(property) {
  const text = `Hola Ibarra Propiedades. Quiero consultar por esta propiedad: ${getTitle(property)} - ${getLocation(property)}. Link: ${window.location.href}`;
  return `https://api.whatsapp.com/send?phone=${TOKKO_DETAIL_CONFIG.whatsappPhone}&text=${encodeURIComponent(text)}`;
}

function buildMapUrl(property) {
  const lat = property.geo_lat;
  const lng = property.geo_long;

  if (!lat || !lng) return "";

  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}&output=embed`;
}

function setText(selector, value) {
  const element = $(selector);
  if (element) element.textContent = value;
}

function renderSlider(property) {
  const wrapper = $("#tokko-detail-slider-wrapper");
  if (!wrapper) return;

  wrapper.innerHTML = getPhotos(property)
    .map((photo) => {
      const url = getPhotoUrl(photo);
      const alt = photo.description || getTitle(property);

      return `
        <div class="swiper-slide">
          <img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy" />
        </div>
      `;
    })
    .join("");

  if (window.Swiper) {
    new Swiper(".tokko-detail-swiper", {
      loop: getPhotos(property).length > 1,
      speed: 600,
      autoplay: getPhotos(property).length > 1 ? { delay: 5000 } : false,
      slidesPerView: 1,
      navigation: {
        nextEl: ".tokko-detail-next",
        prevEl: ".tokko-detail-prev",
      },
      pagination: {
        el: ".tokko-detail-pagination",
        type: "bullets",
        clickable: true,
      },
    });
  }
}

function renderSummary(property) {
  const operation = translateOperation(getOperationName(getMainOperation(property)));

  const summaryItems = [
    ["Código", property.reference_code || property.id || "-"],
    ["Operación", operation],
    ["Precio", formatPrice(property)],
    ["Ubicación", getShortLocation(property)],
    ["Tipo", getType(property)],
    ["Superficie total", `${formatNumber(getSurface(property))} m²`],
    ["Cubiertos", `${formatNumber(property.roofed_surface)} m²`],
    ["Ambientes", property.room_amount || "-"],
    ["Dormitorios", property.suite_amount || property.bedroom_amount || "-"],
    ["Baños", property.bathroom_amount || "-"],
    ["Toilettes", property.toilet_amount || "-"],
    ["Cocheras", property.parking_lot_amount || "-"],
    ["Expensas", property.expenses ? `ARS ${formatNumber(property.expenses)}` : "-"],
  ];

  const list = $("#tokko-detail-summary");
  if (!list) return;

  list.innerHTML = summaryItems
    .map(([label, value]) => `
      <li>
        <strong>${escapeHtml(label)}:</strong>
        <span>${escapeHtml(value)}</span>
      </li>
    `)
    .join("");
}

function renderTags(property) {
  const tagsContainer = $("#tokko-detail-tags");
  if (!tagsContainer) return;

  const tags = Array.isArray(property.tags) ? property.tags : [];

  if (!tags.length) {
    tagsContainer.innerHTML = "";
    return;
  }

  tagsContainer.innerHTML = `
    <h3>Características</h3>
    <div class="tokko-detail-tags-list">
      ${tags.map((tag) => `<span>${escapeHtml(tag.name)}</span>`).join("")}
    </div>
  `;
}

function renderMap(property) {
  const iframe = $("#tokko-detail-map");
  const mapUrl = buildMapUrl(property);

  if (!iframe) return;

  if (!mapUrl) {
    iframe.closest(".tab-pane").innerHTML = `<p class="tokko-detail-muted">Ubicación exacta no disponible.</p>`;
    return;
  }

  iframe.src = mapUrl;
}

function renderVideo(property) {
  const videoPane = $("#real-estate-2-tab1");
  if (!videoPane) return;

  const videos = Array.isArray(property.videos) ? property.videos : [];

  if (!videos.length) {
    videoPane.innerHTML = `<p class="tokko-detail-muted">Esta propiedad no tiene video cargado.</p>`;
    return;
  }

  const video = videos[0];
  const url = video.url || video.video || video.embed_url || "";

  if (!url) {
    videoPane.innerHTML = `<p class="tokko-detail-muted">Esta propiedad no tiene video cargado.</p>`;
    return;
  }

  videoPane.innerHTML = `
    <a class="tokko-detail-external" href="${escapeHtml(url)}" target="_blank" rel="noopener">
      Ver video de la propiedad
    </a>
  `;
}

function renderBlueprints(property) {
  const blueprintPane = $("#real-estate-2-tab2");
  if (!blueprintPane) return;

  const blueprints = getPhotos(property).filter((photo) => photo.is_blueprint);

  if (!blueprints.length) {
    blueprintPane.innerHTML = `<p class="tokko-detail-muted">Esta propiedad no tiene planos cargados.</p>`;
    return;
  }

  blueprintPane.innerHTML = blueprints
    .map((photo) => `<img src="${escapeHtml(getPhotoUrl(photo))}" alt="Plano de ${escapeHtml(getTitle(property))}" class="img-fluid mb-3" loading="lazy" />`)
    .join("");
}

function renderProperty(property) {
  const title = getTitle(property);
  const location = getLocation(property);
  const description = property.rich_description || property.description || "Consultanos para recibir más información sobre esta propiedad.";
  const operation = translateOperation(getOperationName(getMainOperation(property)));

  document.title = `${title} | Ibarra Propiedades`;

  setText("#tokko-detail-title", title);
  setText("#tokko-detail-subtitle", `${operation} · ${getType(property)} · ${location}`);
  setText("#tokko-detail-breadcrumb", title);
  setText("#tokko-detail-heading", title);
  setText("#tokko-detail-description", description);

  const price = $("#tokko-detail-price");
  if (price) price.textContent = formatPrice(property);

  const whatsapp = $("#tokko-detail-whatsapp");
  if (whatsapp) whatsapp.href = buildWhatsAppUrl(property);

  const external = $("#tokko-detail-external");
  if (external && property.public_url) {
    external.href = property.public_url;
    external.classList.remove("d-none");
  }

  renderSlider(property);
  renderSummary(property);
  renderTags(property);
  renderMap(property);
  renderVideo(property);
  renderBlueprints(property);

  if (window.AOS) AOS.refreshHard();
}

function showDetailError(message) {
  const main = $("#tokko-detail-main");

  if (!main) return;

  main.innerHTML = `
    <section class="section">
      <div class="container text-center py-5">
        <h1>No pudimos cargar la propiedad</h1>
        <p>${escapeHtml(message)}</p>
        <a class="btn btn-primary mt-3" href="${TOKKO_DETAIL_CONFIG.listPage}">Volver a propiedades</a>
      </div>
    </section>
  `;
}

async function initTokkoDetail() {
  const id = getQueryParam("id");

  if (!id) {
    showDetailError("Falta el id de la propiedad en la URL.");
    return;
  }

  if (!TOKKO_DETAIL_CONFIG.apiKey) {
    showDetailError("Falta configurar la API Key de Tokko.");
    return;
  }

  try {
    const property = await fetchPropertyById(id);
    renderProperty(property);
  } catch (error) {
    console.error("Error cargando detalle de propiedad:", error);
    showDetailError("La propiedad no existe, no está compartida o no pudo consultarse desde Tokko Broker.");
  }
}

document.addEventListener("DOMContentLoaded", initTokkoDetail);
