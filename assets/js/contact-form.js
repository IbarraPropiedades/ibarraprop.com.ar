(function () {
  "use strict";

  const THANK_YOU_URL = "/gracias.html";
  const ERROR_MESSAGE =
    "Ocurrió un error al enviar el formulario. Probá de nuevo en unos minutos o escribinos por WhatsApp.";

  // Eventos por tipo de formulario. La conversión "Lead de tasación" de Google Ads
  // es solo para tasaciones; las consultas por una propiedad se miden en GA4.
  function leadEvents(type) {
    const analytics = {
      name: "generate_lead",
      params: {
        send_to: "G-JXQJ55SG0R",
        form_name: type === "tasacion" ? "solicitar_tasacion" : "consulta_propiedad",
      },
    };
    if (type !== "tasacion") return [analytics];
    return [
      { name: "conversion", params: { send_to: "AW-18440838855/vf60COWgtv8cEMe9o9lE" } },
      analytics,
    ];
  }

  // Dispara los eventos y recién después navega, para que la navegación no corte
  // el envío. Si gtag está bloqueado o no responde, redirige igual a los 1,5 s.
  function trackLeadAndRedirect(type) {
    let done = false;

    function go() {
      if (done) return;
      done = true;
      window.location.href = THANK_YOU_URL;
    }

    if (typeof gtag !== "function") {
      go();
      return;
    }

    setTimeout(go, 1500);
    const events = leadEvents(type);
    let pending = events.length;
    events.forEach(function (event) {
      gtag("event", event.name, {
        ...event.params,
        event_callback: function () {
          pending -= 1;
          if (pending <= 0) go();
        },
      });
    });
  }

  function setupForm(form) {
    const statusEl = form.querySelector(".form-status");
    const submitButton = form.querySelector('button[type="submit"]');
    const defaultButtonText = submitButton ? submitButton.textContent : "";
    let redirecting = false;

    function setStatus(text, state) {
      if (!statusEl) return;
      statusEl.textContent = text;
      statusEl.className = "form-status form-status--" + state;
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (redirecting) return;

      setStatus("Enviando...", "pending");
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
            setStatus("¡Gracias! Recibimos tu solicitud.", "success");
            form.reset();
            trackLeadAndRedirect(form.dataset.leadType);
            return;
          }
          return response.json().then(function (data) {
            const message =
              data && data.errors && data.errors.length
                ? data.errors.map((err) => err.message).join(", ")
                : ERROR_MESSAGE;
            throw new Error(message);
          });
        })
        .catch(function (error) {
          setStatus(error.message || ERROR_MESSAGE, "error");
        })
        .finally(function () {
          // Mientras redirige, el botón queda deshabilitado para evitar reenvíos.
          if (submitButton && !redirecting) {
            submitButton.disabled = false;
            submitButton.textContent = defaultButtonText;
          }
        });
    });
  }

  document.querySelectorAll("form.lead-form").forEach(setupForm);
})();
