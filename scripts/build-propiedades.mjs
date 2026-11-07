#!/usr/bin/env node
/*
 * Genera el contenido dinámico del sitio a partir de Tokko Broker.
 * La clave nunca llega al navegador: se lee de TOKKO_API_KEY al generar.
 *
 *   TOKKO_API_KEY=xxxx node scripts/build-propiedades.mjs
 *
 * Genera data/propiedades.json, propiedades/<slug>/, zonas/<slug>/ y sitemap.xml,
 * y reemplaza los bloques <!-- GEN:nombre --> de las páginas fijas.
 * El resultado es determinístico: sin cambios en Tokko no hay nada que commitear.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { render: renderCard, escapeHtml: e } = require("../assets/js/property-card.js");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://ibarraprop.com.ar";
const PHONE = "5491121805630";
const INSTAGRAM = "https://www.instagram.com/ibarrapropiedades/";
const FALLBACK_IMAGE = "/assets/img/properties/property-1.jpg";
const TOKKO_URL = "https://www.tokkobroker.com/api/v1/property/";
const PAGE_SIZE = 50;
const MIN_ZONE_PROPERTIES = 3;
const SHOWCASE_SIZE = 8;

/* Nombres de Tokko que conviene mostrar mejor */
const LOCATION_LABELS = {
  "S.Isi.-Centro": "San Isidro Centro",
  Martinez: "Martínez",
  "Las Lomas-Golf": "Las Lomas Golf",
};
const PLURAL_TYPES = {
  Casa: "Casas",
  Departamento: "Departamentos",
  Terreno: "Terrenos",
  Oficina: "Oficinas",
  Local: "Locales",
  Cochera: "Cocheras",
  Campo: "Campos",
  Galpón: "Galpones",
  Depósito: "Depósitos",
};

const slug = (value) =>
  String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const label = (value) => LOCATION_LABELS[value] || value;
const number = (value) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value);
const positive = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const whatsappUrl = (text) =>
  `https://api.whatsapp.com/send?phone=${PHONE}&text=${encodeURIComponent(text)}`;

function write(path, content) {
  const full = join(ROOT, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

/* ---------- Tokko ---------- */

async function fetchInventory() {
  const key = process.env.TOKKO_API_KEY;
  if (!key) throw new Error("Falta la variable de entorno TOKKO_API_KEY");

  const objects = [];
  let total = Infinity;
  while (objects.length < total) {
    const params = new URLSearchParams({
      format: "json",
      key,
      lang: "es_ar",
      limit: PAGE_SIZE,
      offset: objects.length,
    });
    const response = await fetch(`${TOKKO_URL}?${params}`);
    if (!response.ok) throw new Error(`Tokko respondió ${response.status}`);
    const page = await response.json();
    total = page.meta?.total_count ?? 0;
    if (!page.objects?.length) break;
    objects.push(...page.objects);
  }
  // Un error de Tokko no debe borrar las propiedades publicadas.
  if (!objects.length) throw new Error("Tokko no devolvió propiedades; no se genera nada");
  return objects;
}

const ENTITIES = {
  nbsp: " ", amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", ndash: "–", mdash: "—",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ",
};

function cleanDescription(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&([a-zA-Z]+);/g, (match, name) => ENTITIES[name] ?? match)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalize(raw) {
  const parts = (raw.location?.full_location || "").split("|").map((part) => part.trim()).filter(Boolean);
  const barrio = raw.location?.name || parts.at(-1) || "Zona Norte";
  const partido = parts[2] || barrio;
  const barrioLabel = label(barrio);
  const partidoLabel = label(partido);
  const type = raw.type?.name || "Propiedad";
  const operation = raw.operations?.[0] || {};
  const price = operation.prices?.[0] || {};
  const amount = positive(price.price);
  const operationName = operation.operation_type || "Consultar";

  // Si Tokko publica una dirección distinta de la real, el mapa no marca el punto exacto.
  const hidden = (raw.real_address || "") !== (raw.fake_address || "");
  const lat = Number(raw.geo_lat);
  const lng = Number(raw.geo_long);
  const hasGeo = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
  const round = (value) => (hidden ? Math.round(value * 1000) / 1000 : value);

  let title = raw.publication_title || raw.fake_address || `${type} en ${barrioLabel}`;
  for (const [from, to] of Object.entries(LOCATION_LABELS)) {
    title = title.split(from).join(to);
  }

  const url = `/propiedades/${slug(type)}-${slug(barrioLabel)}-${raw.id}/`;
  const allPhotos = raw.photos || [];
  const photos = allPhotos
    .filter((photo) => !photo.is_blueprint)
    .sort((a, b) => Number(b.is_front_cover) - Number(a.is_front_cover) || (a.order || 0) - (b.order || 0))
    .map((photo) => photo.image || photo.original)
    .filter(Boolean);
  const blueprints = allPhotos
    .filter((photo) => photo.is_blueprint)
    .map((photo) => photo.image || photo.original)
    .filter(Boolean);
  const locationLabel = barrioLabel === partidoLabel ? barrioLabel : `${barrioLabel}, ${partidoLabel}`;
  const ref = raw.reference_code || String(raw.id);

  return {
    id: raw.id,
    ref,
    url,
    title,
    type,
    typeSlug: slug(type),
    operation: operationName,
    operationSlug: slug(operationName),
    currency: price.currency || "",
    amount,
    priceLabel: amount ? `${price.currency || "USD"} ${number(amount)}` : "Consultar",
    barrio: barrioLabel,
    partido: partidoLabel,
    locationLabel,
    search: slug(`${parts.slice(2).join(" ")} ${barrioLabel}`),
    surface: positive(raw.total_surface) || positive(raw.roofed_surface) || positive(raw.surface),
    roofed: positive(raw.roofed_surface),
    rooms: positive(raw.room_amount),
    bedrooms: positive(raw.suite_amount) || positive(raw.bedroom_amount),
    baths: positive(raw.bathroom_amount),
    toilets: positive(raw.toilet_amount),
    garages: positive(raw.parking_lot_amount),
    expenses: positive(raw.expenses),
    cover: photos[0] || FALLBACK_IMAGE,
    photoCount: photos.length,
    createdAt: raw.created_at || "",
    whatsappUrl: whatsappUrl(
      `Hola Ibarra Propiedades. Quiero consultar por: ${title} (${locationLabel}). Código ${ref}. ${SITE}${url}`,
    ),
    // Solo para la ficha: no se publica en data/propiedades.json
    detail: {
      description: cleanDescription(raw.rich_description || raw.description),
      tags: (raw.tags || []).map((tag) => tag.name).filter(Boolean),
      photos: photos.length ? photos : [FALLBACK_IMAGE],
      blueprints,
      videos: (raw.videos || []).map((video) => video.url || video.video || video.embed_url).filter(Boolean),
      map: hasGeo ? `${round(lat)},${round(lng)}` : "",
      approximateMap: hidden,
    },
  };
}

/* ---------- Partes comunes ---------- */

function header(active = "") {
  const link = (href, text, key) =>
    `<li><a href="${href}"${key && key === active ? ' class="active"' : ""}>${text}</a></li>`;
  return `<header id="header" class="header d-flex align-items-center fixed-top">
      <div class="container-fluid container-xl position-relative d-flex align-items-center justify-content-between">
        <a href="/" class="logo d-flex align-items-center" aria-label="Ibarra Propiedades - Inicio">
          <img src="/assets/img/ibarra-logo-white.png" alt="Ibarra Propiedades" width="140" height="80" decoding="async" />
        </a>
        <nav id="navmenu" class="navmenu" aria-label="Navegación principal">
          <ul>
            ${link("/", "Inicio", "inicio")}
            ${link("/propiedades.html", "Propiedades", "propiedades")}
            ${link("/#services", "Vender", "")}
            ${link("/#about", "Quiénes somos", "")}
            ${link("/#zonas", "Zonas", "")}
            <li class="tasar"><a href="/tasacion.html" style="color: black; margin-right: 15px">Tasá ahora</a></li>
          </ul>
          <i class="mobile-nav-toggle d-xl-none bi bi-list" role="button" tabindex="0" aria-label="Abrir menú de navegación"></i>
        </nav>
      </div>
    </header>`;
}

function footer() {
  return `<footer id="footer" class="footer light-background">
      <div class="container">
        <div class="row gy-3">
          <div class="col-lg-3 col-md-6 d-flex">
            <div class="address">
              <img src="/assets/img/ibarra-logo-white.png" alt="Ibarra Propiedades" width="140" height="80" style="height: 80px" loading="lazy" decoding="async" />
              <p class="mt-3 mb-0">Inmobiliaria especializada en venta, alquiler y tasación de propiedades en Zona Norte.</p>
            </div>
          </div>
          <div class="col-lg-3 col-md-6 d-flex">
            <i class="bi bi-telephone-fill icon" aria-hidden="true"></i>
            <div>
              <h3 class="h4">Contacto</h3>
              <p>
                <strong>Teléfono:</strong> <a href="tel:+5491121805630">+54 9 11 2180 5630</a><br />
                <strong>Email:</strong> <a href="mailto:info@ibarraprop.com.ar">info@ibarraprop.com.ar</a><br />
              </p>
            </div>
          </div>
          <div class="col-lg-3 col-md-6 d-flex">
            <i class="bi bi-clock-fill icon" aria-hidden="true"></i>
            <div>
              <h3 class="h4">Horarios de atención</h3>
              <p>
                <strong>Lunes a viernes:</strong> <span>10:00 - 18:00 hs</span><br />
                <strong>Sábados:</strong> <span>Consultar disponibilidad</span><br />
                <strong>Domingo:</strong> <span>Cerrado</span>
              </p>
            </div>
          </div>
          <div class="col-lg-3 col-md-6">
            <h3 class="h4">Seguinos en redes</h3>
            <div class="social-links d-flex">
              <a href="${INSTAGRAM}" class="instagram" target="_blank" rel="noopener noreferrer" aria-label="Instagram de Ibarra Propiedades">
                <i class="bi bi-instagram" aria-hidden="true"></i>
              </a>
            </div>
            <nav class="footer-links mt-3" aria-label="Enlaces del pie de página">
              <a href="/propiedades.html">Propiedades</a><br />
              <a href="/tasacion.html">Tasaciones</a><br />
              <a href="/#about">Quiénes somos</a><br />
              <a href="/politica-de-privacidad.html">Política de privacidad</a>
            </nav>
          </div>
        </div>
      </div>
      <div class="container copyright text-center mt-4">
        <p id="copyright">© IBARRA Propiedades. Todos los derechos reservados. Argentina, Buenos Aires.</p>
        <div class="credits">
          <a href="https://raven3.com.ar/webs-para-inmobiliarias" target="_blank" rel="noopener" title="Diseño y desarrollo de sitios web para inmobiliarias - Raven3" style="font-size: 10px; text-decoration: none;">by <strong>Raven3</strong></a>
        </div>
      </div>
    </footer>`;
}

function tasacionForm() {
  const types = ["Departamento", "Casa", "PH", "Terreno", "Local", "Oficina", "Otro"];
  return `<form action="https://formspree.io/f/mgaverye" method="POST" class="tasa-form lead-form" data-lead-type="tasacion" aria-label="Formulario para solicitar tasación inmobiliaria">
                <div class="form-row">
                  <div class="form-field">
                    <label class="visually-hidden" for="name">Nombre y apellido</label>
                    <input type="text" name="name" id="name" placeholder="Nombre y apellido" autocomplete="name" required />
                  </div>
                  <div class="form-field">
                    <label class="visually-hidden" for="telefono">Teléfono</label>
                    <input type="tel" name="telefono" id="telefono" placeholder="Teléfono" autocomplete="tel" required />
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-field">
                    <label class="visually-hidden" for="direccion">Dirección o zona de la propiedad</label>
                    <input type="text" name="direccion" id="direccion" placeholder="Dirección o zona de la propiedad" autocomplete="street-address" required />
                  </div>
                  <div class="form-field">
                    <label class="visually-hidden" for="tipo_inmueble">Tipo de inmueble</label>
                    <select name="tipo_inmueble" id="tipo_inmueble" required>
                      <option value="">Tipo de inmueble</option>
                      ${types.map((type) => `<option>${type}</option>`).join("\n                      ")}
                    </select>
                  </div>
                </div>
                <input type="hidden" name="_subject" value="Nueva solicitud de tasación - Ibarra Prop" />
                <input type="text" name="_gotcha" class="lead-honeypot" tabindex="-1" autocomplete="off" aria-hidden="true" />
                <div class="form-status" role="status" aria-live="polite"></div>
                <div style="text-align: center">
                  <button type="submit" class="tasa-btn">Pedir tasación sin compromiso</button>
                </div>
                <p class="lead-legal">Al enviar aceptás nuestra <a href="/politica-de-privacidad.html">política de privacidad</a>.</p>
              </form>`;
}

const FONTS =
  "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&family=Raleway:wght@700;800;900&display=swap";

function page({ title, description, path, image, jsonLd, css = [], scripts = [], bodyClass, active, whatsapp, main }) {
  const canonical = `${SITE}${path}`;
  const ogImage = image?.startsWith("http") ? image : `${SITE}${image || "/assets/img/ibarra-logo-red.jpg"}`;
  const styles = [
    "/assets/vendor/bootstrap/css/bootstrap.min.css",
        ...css.filter((href) => href.includes("swiper")),
    "/assets/css/main.css",
    "/assets/css/propiedades.css",
    "/assets/css/propiedad-card.css",
    ...css.filter((href) => !href.includes("swiper")),
  ];
  return `<!doctype html>
<html lang="es-AR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script async src="https://www.googletagmanager.com/gtag/js?id=AW-18440838855"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag() {
        dataLayer.push(arguments);
      }
      gtag("js", new Date());
      gtag("config", "AW-18440838855");
      gtag("config", "G-JXQJ55SG0R");
    </script>
    <title>${e(title)}</title>
    <meta name="description" content="${e(description)}" />
    <meta name="robots" content="index,follow,max-image-preview:large" />
    <meta name="theme-color" content="#de223a" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:locale" content="es_AR" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Ibarra Propiedades" />
    <meta property="og:title" content="${e(title)}" />
    <meta property="og:description" content="${e(description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${e(ogImage)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${e(title)}" />
    <meta name="twitter:description" content="${e(description)}" />
    <meta name="twitter:image" content="${e(ogImage)}" />
    <link href="/assets/img/favicon/favicon.ico" rel="icon" />
    <link href="/assets/img/favicon/apple-touch-icon.png" rel="apple-touch-icon" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="preconnect" href="https://static.tokkobroker.com" />
    <link href="${FONTS}" rel="stylesheet" media="print" onload="this.media='all'" />
    <link href="/assets/vendor/bootstrap-icons/bootstrap-icons.min.css" rel="stylesheet" media="print" onload="this.media='all'" />
    ${styles.map((href) => `<link href="${href}" rel="stylesheet" />`).join("\n    ")}
    ${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>` : ""}
  </head>
  <body class="${bodyClass}">
    <div class="wasap" style="animation-name: tada">
      <a href="${e(whatsapp)}" target="_blank" rel="noopener noreferrer" aria-label="Consultar por WhatsApp a Ibarra Propiedades">
        <img src="/assets/img/svg/logo-wapp-01.svg" alt="WhatsApp de Ibarra Propiedades" width="64" height="64" decoding="async" />
      </a>
    </div>
    ${header(active)}
    <main class="main">
${main}
    </main>
    ${footer()}
    <a href="#" id="scroll-top" class="scroll-top d-flex align-items-center justify-content-center" aria-label="Volver arriba">
      <i class="bi bi-arrow-up-short" aria-hidden="true"></i>
    </a>
    ${[...scripts, "/assets/js/main.js", "/assets/js/contact-form.js"].map((src) => `<script src="${src}" defer></script>`).join("\n    ")}
  </body>
</html>
`;
}

const breadcrumbLd = (items) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, path], index) => ({
    "@type": "ListItem",
    position: index + 1,
    name,
    item: `${SITE}${path}`,
  })),
});

const grid = (properties, eagerCount = 0) =>
  properties
    .map((p, index) => `<div class="col-xl-4 col-md-6">${renderCard(p, { eager: index < eagerCount })}</div>`)
    .join("\n          ");

/* ---------- Ficha ---------- */

function propertyPage(p, all) {
  const d = p.detail;
  const similar = all
    .filter((other) => other.id !== p.id)
    .map((other) => ({
      other,
      score:
        (other.typeSlug === p.typeSlug ? 2 : 0) +
        (other.partido === p.partido ? 2 : 0) +
        (other.operationSlug === p.operationSlug ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score || b.other.id - a.other.id)
    .slice(0, 3)
    .map((item) => item.other);

  const summary = [
    ["Código", p.ref],
    ["Operación", p.operation],
    ["Precio", p.priceLabel],
    ["Ubicación", p.locationLabel],
    ["Tipo", p.type],
    ["Superficie total", p.surface && `${number(p.surface)} m²`],
    ["Cubiertos", p.roofed && `${number(p.roofed)} m²`],
    ["Ambientes", p.rooms],
    ["Dormitorios", p.bedrooms],
    ["Baños", p.baths],
    ["Toilettes", p.toilets],
    ["Cocheras", p.garages],
    ["Expensas", p.expenses && `ARS ${number(p.expenses)}`],
  ].filter(([, value]) => value);

  const slides = d.photos
    .map(
      (photo, index) =>
        `<div class="swiper-slide"><img src="${e(photo)}" alt="${e(p.title)} - foto ${index + 1}" ${index === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" /></div>`,
    )
    .join("\n              ");

  const specText = [p.surface && `${number(p.surface)} m²`, p.rooms && `${p.rooms} ambientes`, p.baths && `${p.baths} baños`]
    .filter(Boolean)
    .join(", ");
  const description = `${p.operation} de ${p.type.toLowerCase()} en ${p.locationLabel}. ${p.priceLabel}${specText ? `. ${specText}` : ""}. Consultá con Ibarra Propiedades.`;

  const listing = {
    "@type": "RealEstateListing",
    name: p.title,
    description,
    url: `${SITE}${p.url}`,
    image: d.photos.slice(0, 6),
    ...(p.createdAt ? { datePosted: p.createdAt.slice(0, 10) } : {}),
    ...(p.amount
      ? { offers: { "@type": "Offer", price: p.amount, priceCurrency: p.currency || "USD", availability: "https://schema.org/InStock" } }
      : {}),
  };
  const { "@context": _context, ...breadcrumb } = breadcrumbLd([["Inicio", "/"], ["Propiedades", "/propiedades.html"], [p.title, p.url]]);

  const main = `      <div class="page-title">
        <div class="heading">
          <div class="container">
            <div class="row d-flex justify-content-center text-center">
              <div class="col-lg-9">
                <h1>${e(p.title)}</h1>
                <p class="mb-0">${e(p.operation)} · ${e(p.type)} · ${e(p.locationLabel)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section id="real-estate-2" class="real-estate-2 section tokko-detail-section">
        <div class="container">
          <nav class="ficha-breadcrumb" aria-label="Migas de pan">
            <a href="/">Inicio</a> <span aria-hidden="true">/</span>
            <a href="/propiedades.html">Propiedades</a> <span aria-hidden="true">/</span>
            <span aria-current="page">${e(p.title)}</span>
          </nav>
          <div class="portfolio-details-slider swiper tokko-detail-swiper" data-slides="${d.photos.length}">
            <div class="swiper-wrapper align-items-center">
              ${slides}
            </div>
            ${
              d.photos.length > 1
                ? `<button type="button" class="swiper-button-prev tokko-detail-prev" aria-label="Foto anterior"></button>
            <button type="button" class="swiper-button-next tokko-detail-next" aria-label="Foto siguiente"></button>
            <div class="swiper-pagination tokko-detail-pagination"></div>`
                : ""
            }
          </div>

          <div class="row justify-content-between gy-4 mt-4">
            <div class="col-lg-8">
              <div class="portfolio-description tokko-detail-description-card">
                <div class="tokko-detail-price">${e(p.priceLabel)}</div>
                <h2>${e(p.title)}</h2>
                <p>${e(d.description || "Consultanos para recibir más información sobre esta propiedad.")}</p>
              </div>
              ${
                d.tags.length
                  ? `<div class="tokko-detail-tags mt-4">
                <h3>Características</h3>
                <div class="tokko-detail-tags-list">${d.tags.map((tag) => `<span>${e(tag)}</span>`).join("")}</div>
              </div>`
                  : ""
              }
              ${
                d.videos.length
                  ? `<div class="tokko-detail-tab-content mt-4">
                <h3>Video</h3>
                <a class="tokko-detail-external" href="${e(d.videos[0])}" target="_blank" rel="noopener">Ver video de la propiedad</a>
              </div>`
                  : ""
              }
              ${
                d.blueprints.length
                  ? `<div class="tokko-detail-tab-content mt-4">
                <h3>Planos</h3>
                ${d.blueprints.map((src) => `<img src="${e(src)}" alt="Plano de ${e(p.title)}" class="img-fluid mb-3" loading="lazy" />`).join("")}
              </div>`
                  : ""
              }
              ${
                d.map
                  ? `<div class="tokko-detail-tab-content mt-4">
                <h3>Ubicación${d.approximateMap ? " aproximada" : ""}</h3>
                <iframe src="https://www.google.com/maps?q=${encodeURIComponent(d.map)}&amp;z=15&amp;output=embed" title="Mapa de ${e(p.locationLabel)}" style="border: 0; width: 100%; height: 400px" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
              </div>`
                  : ""
              }
            </div>

            <div class="col-lg-4">
              <aside class="portfolio-info tokko-detail-summary-card">
                <h3>Resumen</h3>
                <ul>
                  ${summary.map(([name, value]) => `<li><strong>${e(name)}:</strong> <span>${e(value)}</span></li>`).join("\n                  ")}
                </ul>
                <div class="tokko-detail-actions">
                  <a class="tokko-detail-primary-btn" href="${e(p.whatsappUrl)}" target="_blank" rel="noopener">Consultar por WhatsApp</a>
                </div>
                <form action="https://formspree.io/f/mgaverye" method="POST" class="ficha-form lead-form" data-lead-type="consulta" aria-label="Consultar por esta propiedad">
                  <h3>O dejanos tus datos</h3>
                  <label for="ficha-nombre">Nombre</label>
                  <input type="text" id="ficha-nombre" name="name" autocomplete="name" required />
                  <label for="ficha-telefono">Teléfono</label>
                  <input type="tel" id="ficha-telefono" name="telefono" autocomplete="tel" required />
                  <input type="hidden" name="propiedad" value="${e(`${p.title} - ${p.ref} - ${SITE}${p.url}`)}" />
                  <input type="hidden" name="_subject" value="${e(`Consulta por propiedad ${p.ref} - Ibarra Prop`)}" />
                  <input type="text" name="_gotcha" class="lead-honeypot" tabindex="-1" autocomplete="off" aria-hidden="true" />
                  <div class="form-status" role="status" aria-live="polite"></div>
                  <button type="submit">Quiero que me contacten</button>
                  <p class="lead-legal">Al enviar aceptás nuestra <a href="/politica-de-privacidad.html">política de privacidad</a>.</p>
                </form>
                <a class="tokko-detail-back" href="/propiedades.html">← Volver a propiedades</a>
              </aside>
            </div>
          </div>

          ${
            similar.length
              ? `<div class="ficha-similares">
            <h2>Propiedades similares</h2>
            <div class="row gy-4">
              ${grid(similar)}
            </div>
          </div>`
              : ""
          }
        </div>
      </section>`;

  return page({
    title: `${p.title} | Ibarra Propiedades`,
    description,
    path: p.url,
    image: p.cover,
    jsonLd: { "@context": "https://schema.org", "@graph": [listing, breadcrumb] },
    css: ["/assets/vendor/swiper/swiper-bundle.min.css", "/assets/css/detalle-propiedad.css"],
    scripts: ["/assets/vendor/swiper/swiper-bundle.min.js", "/assets/js/ficha.js"],
    bodyClass: "property-single-page properties-page",
    active: "propiedades",
    whatsapp: p.whatsappUrl,
    main,
  });
}

/* ---------- Zonas ---------- */

function buildZones(properties) {
  const zones = [];
  const seen = new Set();
  const add = (name) => {
    const items = properties.filter((p) => p.barrio === name || p.partido === name);
    const key = items.map((p) => p.id).join(",");
    if (items.length < MIN_ZONE_PROPERTIES || seen.has(key)) return;
    seen.add(key);
    zones.push({ name, slug: slug(name), url: `/zonas/${slug(name)}/`, items });
  };
  // Primero barrios: si un partido tiene las mismas propiedades que un barrio, gana el barrio.
  [...new Set(properties.map((p) => p.barrio))].forEach(add);
  [...new Set(properties.map((p) => p.partido))].forEach(add);
  return zones;
}

function zonePage(zone) {
  const onlySale = zone.items.every((p) => p.operationSlug === "venta");
  const noun = onlySale ? "en venta" : "en venta y alquiler";
  const counts = Object.entries(Object.groupBy(zone.items, (p) => p.type))
    .map(([type, items]) => `${items.length} ${(items.length === 1 ? type : PLURAL_TYPES[type] || type).toLowerCase()}`)
    .join(", ");
  const heading = `Propiedades ${noun} en ${zone.name}`;
  const n = zone.items.length;
  const main = `      <div class="page-title">
        <div class="heading">
          <div class="container">
            <div class="row d-flex justify-content-center text-center">
              <div class="col-lg-8">
                <h1>${e(heading)}</h1>
                <p class="mb-0">${n} propiedades disponibles hoy: ${e(counts)}.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <section class="section">
        <div class="container">
          <div class="row gy-4">
          ${grid(zone.items, 3)}
          </div>
          <div class="zona-cta">
            <h2>¿Tenés una propiedad en ${e(zone.name)}?</h2>
            <p>Coordinamos una tasación sin compromiso y te asesoramos en persona.</p>
            <a class="btn btn-primary" href="/tasacion.html">Tasá tu propiedad</a>
          </div>
        </div>
      </section>`;
  return page({
    title: `${heading} | Ibarra Propiedades`,
    description: `${n} propiedades ${noun} en ${zone.name}: ${counts}. Consultá con Ibarra Propiedades, inmobiliaria en Zona Norte.`,
    path: zone.url,
    image: zone.items[0].cover,
    jsonLd: breadcrumbLd([["Inicio", "/"], ["Propiedades", "/propiedades.html"], [zone.name, zone.url]]),
    bodyClass: "properties-page",
    active: "propiedades",
    whatsapp: whatsappUrl(`Hola Ibarra Propiedades. Quiero consultar por propiedades en ${zone.name}.`),
    main,
  });
}

/* ---------- Bloques de las páginas fijas ---------- */

function inject(file, blocks) {
  const path = join(ROOT, file);
  let html = readFileSync(path, "utf8");
  for (const [name, content] of Object.entries(blocks)) {
    const pattern = new RegExp(`(<!-- GEN:${name} -->)[\\s\\S]*?(<!-- /GEN:${name} -->)`);
    if (!pattern.test(html)) throw new Error(`${file}: falta el bloque ${name}`);
    html = html.replace(pattern, (_, open, close) => `${open}\n${content}\n${close}`);
  }
  writeFileSync(path, html);
}

function countBy(list, key) {
  const map = new Map();
  list.forEach((p) => map.set(p[key], (map.get(p[key]) || 0) + 1));
  return [...map.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), "es"));
}

function homeBlocks(properties, zones) {
  const option = ([name]) => `<option value="${slug(name)}">${e(name)}</option>`;
  const operations = countBy(properties, "operation").map(option).join("\n                ");
  const types = countBy(properties, "type").map(option).join("\n                ");

  const groups = countBy(properties, "partido")
    .sort((a, b) => a[0].localeCompare(b[0], "es"))
    .map(([partido]) => {
      const barrios = [...new Set(properties.filter((p) => p.partido === partido).map((p) => p.barrio))]
        .filter((barrio) => barrio !== partido)
        .sort((a, b) => a.localeCompare(b, "es"));
      return `<optgroup label="${e(partido)}">
                  <option value="${slug(partido)}">Todo ${e(partido)}</option>
                  ${barrios.map((barrio) => `<option value="${slug(barrio)}">${e(barrio)}</option>`).join("\n                  ")}
                </optgroup>`;
    })
    .join("\n                ");

  const facts = [
    ["bi-award", "+20", "Años en Zona Norte"],
    ["bi-house-door", properties.length, "Propiedades disponibles hoy"],
    ["bi-geo-alt", new Set(properties.map((p) => p.barrio)).size, "Barrios con propiedades"],
    ["bi-shop", "1", "Oficina propia en Lomas de San Isidro"],
  ]
    .map(
      ([icon, value, text]) => `<div class="col-lg-3 col-md-6">
              <div class="stats-item d-flex align-items-center w-100 h-100">
                <i class="bi ${icon} flex-shrink-0" aria-hidden="true"></i>
                <div>
                  <span>${e(value)}</span>
                  <p>${e(text)}</p>
                </div>
              </div>
            </div>`,
    )
    .join("\n            ");

  const typeLinks = countBy(properties, "type")
    .map(
      ([name, n]) =>
        `<div class="col-md-3 col-6"><a class="zone-link" href="/propiedades.html?tipo=${slug(name)}">${e(n === 1 ? name : PLURAL_TYPES[name] || name)} (${n})</a></div>`,
    )
    .join("\n            ");

  // Zonas con página propia y, después, los demás partidos con stock.
  const covered = new Set(zones.flatMap((zone) => zone.items.map((p) => p.partido)));
  const zoneLinks = [
    ...zones.map((zone) => [zone.name, zone.items.length, zone.url]),
    ...countBy(properties, "partido")
      .filter(([name]) => !covered.has(name))
      .map(([name, n]) => [name, n, `/propiedades.html?zona=${slug(name)}`]),
  ]
    .map(([name, n, url]) => `<div class="col-md-3 col-6"><a class="zone-link" href="${url}">${e(name)} (${n})</a></div>`)
    .join("\n            ");

  return {
    "opciones-operacion": `                <option value="" selected>Operación</option>\n                ${operations}`,
    "opciones-tipo": `                <option value="" selected>Tipo</option>\n                ${types}`,
    "opciones-zona": `                <option value="" selected>Zona</option>\n                ${groups}`,
    datos: `            ${facts}`,
    destacadas: `          <div class="vitrina" data-vitrina role="region" aria-label="Últimas propiedades publicadas">
            <div class="vitrina__track">
            ${properties.slice(0, SHOWCASE_SIZE).map((p) => `<div class="vitrina__item">${renderCard(p)}</div>`).join("\n            ")}
            </div>
          </div>
          <div class="text-center mt-4 mb-5">
            <a class="btn btn-primary" href="/propiedades.html">Ver las ${properties.length} propiedades</a>
          </div>
          <div class="row gy-3">
            ${typeLinks}
          </div>`,
    zonas: `            ${zoneLinks}`,
  };
}

/* ---------- Principal ---------- */

const raw = await fetchInventory();
const properties = raw
  .map(normalize)
  .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "") || b.id - a.id);
const zones = buildZones(properties);

rmSync(join(ROOT, "propiedades"), { recursive: true, force: true });
rmSync(join(ROOT, "zonas"), { recursive: true, force: true });

for (const property of properties) {
  write(`${property.url.slice(1)}index.html`, propertyPage(property, properties));
}
for (const zone of zones) {
  write(`${zone.url.slice(1)}index.html`, zonePage(zone));
}

// Datos públicos del listado: sin direcciones reales ni datos internos.
const publicData = properties.map(({ detail, createdAt, ...rest }) => ({ ...rest, createdAt: createdAt.slice(0, 10) }));
write("data/propiedades.json", `${JSON.stringify({ count: publicData.length, properties: publicData }, null, 1)}\n`);

const shared = (active) => ({ header: header(active), footer: footer() });
inject("index.html", { ...shared("inicio"), "form-tasacion": tasacionForm(), ...homeBlocks(properties, zones) });
inject("propiedades.html", shared("propiedades"));
inject("politica-de-privacidad.html", shared(""));
inject("tasacion.html", { ...shared(""), "form-tasacion": tasacionForm() });

const urls = [
  "/",
  "/propiedades.html",
  "/tasacion.html",
  "/politica-de-privacidad.html",
  ...zones.map((zone) => zone.url),
  ...properties.map((p) => p.url),
];
write(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${SITE}${url}</loc></url>`).join("\n")}
</urlset>
`,
);

console.log(
  `Generadas ${properties.length} propiedades y ${zones.length} zonas: ${zones.map((zone) => `${zone.name} (${zone.items.length})`).join(", ")}`,
);
