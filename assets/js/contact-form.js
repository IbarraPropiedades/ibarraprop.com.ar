(function () {
  "use strict";

  const form = document.getElementById("contactForm");
  if (!form) return;

  const statusEl = document.getElementById("form-status");
  const submitButton = document.getElementById("submit-button");
  const defaultButtonText = submitButton ? submitButton.textContent : "";

  form.addEventListener("submit", function (e) {
    e.preventDefault();

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
          if (statusEl) {
            statusEl.textContent =
              "¡Gracias! Recibimos tu solicitud y te vamos a contactar a la brevedad.";
            statusEl.className = "form-status form-status--success";
          }
          form.reset();
          // Google Ads: conversión "Lead de tasación"
          if (typeof gtag === "function") {
            gtag("event", "conversion", {
              send_to: "AW-18440838855/vf60COWgtv8cEMe9o9lE",
            });
          }
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
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = defaultButtonText;
        }
      });
  });
})();
