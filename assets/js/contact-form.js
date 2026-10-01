(function () {
  "use strict";

  const form = document.getElementById("contactForm");
  if (!form) return;

  const statusEl = document.getElementById("form-status");
  const submitButton = document.getElementById("submit-button");
  const defaultButtonText = submitButton ? submitButton.textContent : "";
  const THANK_YOU_URL = "gracias.html";
  let redirecting = false;

  // Dispara las conversiones y recién después navega a la página de gracias,
  // para que la navegación no corte el envío. Si gtag está bloqueado o no
  // responde, redirige igual al cumplirse el tiempo máximo.
  function trackLeadAndRedirect() {
    let pending = 2;
    let done = false;

    function go() {
      if (done) return;
      done = true;
      window.location.href = THANK_YOU_URL;
    }

    function onSent() {
      pending -= 1;
      if (pending <= 0) go();
    }

    setTimeout(go, 1500);

    if (typeof gtag !== "function") {
      go();
      return;
    }

    // Google Ads: conversión "Lead de tasación"
    gtag("event", "conversion", {
      send_to: "AW-18440838855/vf60COWgtv8cEMe9o9lE",
      event_callback: onSent,
    });
    // Google Analytics: lead de tasación
    gtag("event", "generate_lead", {
      send_to: "G-JXQJ55SG0R",
      form_name: "solicitar_tasacion",
      event_callback: onSent,
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (redirecting) return;

    if (statusEl) {
      statusEl.textContent = "Enviando...";
      statusEl.className = "form-status form-status--pending";
    }
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Enviando...";
    }

    fetch(form.action, {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" },
    })
      .then(function (response) {
        if (response.ok) {
          redirecting = true;
          if (statusEl) {
            statusEl.textContent = "¡Gracias! Recibimos tu solicitud.";
            statusEl.className = "form-status form-status--success";
          }
          form.reset();
          trackLeadAndRedirect();
        } else {
          return response.json().then(function (data) {
            const message =
              data && data.errors && data.errors.length
                ? data.errors.map((err) => err.message).join(", ")
                : "Ocurrió un error al enviar el formulario. Probá de nuevo en unos minutos.";
            throw new Error(message);
          });
        }
      })
      .catch(function (error) {
        if (statusEl) {
          statusEl.textContent =
            error.message ||
            "Ocurrió un error al enviar el formulario. Probá de nuevo en unos minutos.";
          statusEl.className = "form-status form-status--error";
        }
      })
      .finally(function () {
        // Mientras redirige, el botón queda deshabilitado para evitar reenvíos.
        if (submitButton && !redirecting) {
          submitButton.disabled = false;
          submitButton.textContent = defaultButtonText;
        }
      });
  });
})();
