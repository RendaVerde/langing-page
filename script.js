const CONFIG = {
  checkoutUrl: "https://expansao.igreenenergy.com.br/?id=29284&checkout=true",
  whatsappNumber: "5527988021747",
  sheetEndpoint:
    "https://script.google.com/macros/s/AKfycbwrCkcX0mvzbihwCQVqYVoKgnTStFOPb6qkco_47DFNLrP6o1LMoOjErDqX5LyYGgH45Q/exec",
  sheetSiteId: "rendaverde-igreen",
};

// -------------------------
// Quiz / qualificação
// -------------------------
const answers = {};
let step = 1;
const qs = [...document.querySelectorAll(".q")];
const bar = document.getElementById("bar");
const label = document.getElementById("stepLabel");
const backBtn = document.getElementById("backBtn");
const nextBtn = document.getElementById("nextBtn");
const toast = document.getElementById("toast");

function showToast(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function renderQuiz() {
  qs.forEach((q) =>
    q.classList.toggle("active", Number(q.dataset.step) === step),
  );
  if (bar) bar.style.width = Math.min(100, (step / 4) * 100) + "%";
  if (label)
    label.textContent = step <= 4 ? `PERGUNTA ${step} DE 4` : "RESULTADO";
  if (backBtn)
    backBtn.style.visibility = step > 1 && step < 5 ? "visible" : "hidden";
  if (nextBtn) nextBtn.style.display = step === 4 ? "inline-flex" : "none";
}

document.querySelectorAll(".opt").forEach((btn) => {
  btn.addEventListener("click", () => {
    const key = btn.dataset.key;
    answers[key] = btn.dataset.value;
    btn.parentElement
      .querySelectorAll(".opt")
      .forEach((x) => x.classList.remove("selected"));
    btn.classList.add("selected");
    window.setTimeout(() => {
      step++;
      renderQuiz();
    }, 180);
  });
});

if (backBtn) {
  backBtn.addEventListener("click", () => {
    if (step > 1) {
      step--;
      renderQuiz();
    }
  });
}

function scoreProfile() {
  let score = 0;
  if (
    [
      "Nova atividade profissional",
      "Ampliar carteira atual",
      "Desenvolver equipe",
    ].includes(answers.objetivo)
  )
    score += 2;
  if (
    [
      "5 a 15h por semana",
      "15 a 30h por semana",
      "Dedicação principal",
    ].includes(answers.tempo)
  )
    score += 2;
  if (
    [
      "Já vendo/empreendo",
      "Tenho boa rede de contatos",
      "Quero aprender vendas",
    ].includes(answers.perfil)
  )
    score += 2;
  return score;
}

function createWhatsAppLink(lead) {
  let finalMessage;

  if (lead.momento === "Estou pronto para ativar a licença") {
    finalMessage =
      "Estou interessado em ativar a licença e gostaria de tirar uma dúvida antes de concluir.";
  } else if (lead.momento === "Quero começar ainda este mês") {
    finalMessage =
      "Quero começar ainda este mês e gostaria de entender os próximos passos.";
  } else {
    finalMessage =
      "Gostaria de conhecer melhor a oportunidade antes de decidir.";
  }

  const message = [
    "Olá! Fiz a pré-avaliação para a oportunidade de Licenciado iGreen.",
    "",
    `Nome: ${lead.nome}`,
    `Cidade: ${lead.cidade}`,
    `Objetivo: ${lead.objetivo || "-"}`,
    `Tempo disponível: ${lead.tempo || "-"}`,
    `Perfil comercial: ${lead.perfil || "-"}`,
    `Momento: ${lead.momento || "-"}`,
    `Score: ${lead.score || 0}`,
    "",
    finalMessage,
  ].join("\n");

  return (
    `https://wa.me/${CONFIG.whatsappNumber}` +
    `?text=${encodeURIComponent(message)}`
  );
}

async function submitLead() {
  const nome = document.getElementById("nome");
  const whats = document.getElementById("whats");
  const cidade = document.getElementById("cidade");
  const email = document.getElementById("email");
  const momento = document.getElementById("momento");

  const params = new URLSearchParams(window.location.search);

  const score = scoreProfile();

  const lead = {
    ...answers,

    nome: nome?.value.trim() || "",
    whatsapp: whats?.value.trim() || "",
    cidade: cidade?.value.trim() || "",
    email: email?.value.trim() || "",
    momento: momento?.value || "",
    score: score,
    quiz_completed: true,
    page: window.location.href,
    utm_source: params.get("utm_source") || "",
    utm_medium: params.get("utm_medium") || "",
    utm_campaign: params.get("utm_campaign") || "",
    utm_content: params.get("utm_content") || "",
    gclid: params.get("gclid") || "",
    fbclid: params.get("fbclid") || "",
    created_at: new Date().toISOString(),
  };

  /*
   * VALIDAÇÃO
   */
  if (!lead.nome || !lead.whatsapp || !lead.cidade || !lead.momento) {
    showToast("Preencha nome, WhatsApp, cidade e momento.");

    return;
  }

  /*
   * DEFINE O CAMINHO DO LEAD
   */

  const wantsMoreInformation =
    lead.momento === "Quero conhecer antes de decidir";

  const licensedLead = {
    tipo: "licenciado",
    lead_id: createLeadId(),

    nome: lead.nome,
    whatsapp: lead.whatsapp,
    email: lead.email,
    cidade: lead.cidade,

    objetivo: answers.objetivo || "",
    tempo: answers.tempo || "",
    perfil: answers.perfil || "",
    momento: lead.momento,
    score: lead.score,

    rota_resultado: wantsMoreInformation ? "WhatsApp" : "Ativação / WhatsApp",

    ...getTrackingData(),
  };

  await saveLeadToSheet(licensedLead);

  lead.destination = wantsMoreInformation ? "whatsapp" : "activation";

  /*
   * TELAS DE RESULTADO
   */

  const whatsappPath = document.getElementById("whatsappPath");

  const activationPath = document.getElementById("activationPath");

  /*
   * =========================================
   * CAMINHO WHATSAPP
   * =========================================
   */

  if (wantsMoreInformation) {
    if (whatsappPath) whatsappPath.hidden = false;

    if (activationPath) activationPath.hidden = true;

    const whatsappResultText = document.getElementById("whatsappResultText");

    if (whatsappResultText) {
      whatsappResultText.textContent = `${lead.nome}, registramos sua pré-avaliação. Agora você pode conversar com um especialista e entender a oportunidade com mais detalhes.`;
    }

    const whatsappBtn = document.getElementById("whatsappBtn");

    if (whatsappBtn) {
      whatsappBtn.href = createWhatsAppLink(lead);
    }
  } else {
    /*
     * =========================================
     * CAMINHO ATIVAÇÃO
     * =========================================
     */
    if (whatsappPath) whatsappPath.hidden = true;
    if (activationPath) activationPath.hidden = false;

    const resultTitle = document.getElementById("resultTitle");
    const resultText = document.getElementById("resultText");
    const checkoutBtn = document.getElementById("checkoutBtn");
    const activationWhatsappBtn = document.getElementById(
      "activationWhatsappBtn",
    );

    if (checkoutBtn) {
      checkoutBtn.href = CONFIG.checkoutUrl;

      checkoutBtn.onclick = () => {
        if (typeof gtag === "function") {
          gtag("event", "clique_ativar_licenca", {
            event_category: "conversao",
          });
        }
      };
    }

    if (activationWhatsappBtn) {
      activationWhatsappBtn.href = createWhatsAppLink(lead);
    }

    if (activationWhatsappBtn) {
      activationWhatsappBtn.href = createWhatsAppLink(lead);
    }

    if (resultTitle) {
      resultTitle.textContent =
        score >= 5
          ? "Seu perfil mostra boa aderência inicial ao modelo."
          : score >= 3
            ? "Seu perfil tem pontos de aderência que vale explorar."
            : "Vale conhecer o modelo com calma antes de decidir.";
    }

    if (resultText) {
      resultText.textContent = `${lead.nome}, sua resposta indica foco em “${answers.objetivo || "avaliar a oportunidade"}”. O próximo passo é conhecer as regras atuais, contrato, portfólio e forma de atuação.`;
    }
  }

  /*
   * EXIBE RESULTADO
   */

  step = 5;

  renderQuiz();
}

if (nextBtn) nextBtn.addEventListener("click", submitLead);
renderQuiz();

// -------------------------
// Prova social / carrossel + filtros
// -------------------------
const proofSlider = document.getElementById("proofSlider");
const proofSlides = [...document.querySelectorAll(".proof-slide")];
const proofPrev = document.getElementById("proofPrev");
const proofNext = document.getElementById("proofNext");
const proofCategory = document.getElementById("proofCategory");
const proofTitle = document.getElementById("proofTitle");
const proofLocation = document.getElementById("proofLocation");
const proofMetric = document.getElementById("proofMetric");
const proofCurrent = document.getElementById("proofCurrent");
const proofTotal = document.getElementById("proofTotal");
const proofProgressBar = document.getElementById("proofProgressBar");
const proofFilterButtons = [...document.querySelectorAll(".proof-filter")];
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

let activeProofFilter = "Todos";
let visibleProofSlides = [...proofSlides];
let proofIndex = 0;
let proofTimer = null;
let proofProgressTimer = null;
let proofProgress = 0;
const proofIntervalMs = 5200;

function pad2(value) {
  return String(value).padStart(2, "0");
}

function rebuildVisibleProofs() {
  visibleProofSlides = proofSlides.filter(
    (slide) =>
      activeProofFilter === "Todos" ||
      slide.dataset.category === activeProofFilter,
  );
  proofSlides.forEach((slide) =>
    slide.classList.toggle(
      "is-filtered-out",
      !visibleProofSlides.includes(slide),
    ),
  );
  proofIndex = 0;
  updateProof(0);
  startProofAutoplay();
}

function updateProof(index, resetProgress = true) {
  if (!visibleProofSlides.length) return;
  proofIndex = (index + visibleProofSlides.length) % visibleProofSlides.length;
  proofSlides.forEach((slide) => slide.classList.remove("is-active"));
  const active = visibleProofSlides[proofIndex];
  active.classList.add("is-active");
  if (proofCategory)
    proofCategory.textContent = active.dataset.category || "Resultado";
  if (proofTitle) proofTitle.textContent = active.dataset.title || "Destaque";
  if (proofLocation) proofLocation.textContent = active.dataset.location || "";
  if (proofMetric)
    proofMetric.textContent = active.dataset.metric || "Resultado em destaque";
  if (proofCurrent) proofCurrent.textContent = pad2(proofIndex + 1);
  if (proofTotal) proofTotal.textContent = pad2(visibleProofSlides.length);
  if (resetProgress) {
    proofProgress = 0;
    if (proofProgressBar) proofProgressBar.style.width = "0%";
  }
}

function stopProofAutoplay() {
  if (proofTimer) window.clearInterval(proofTimer);
  if (proofProgressTimer) window.clearInterval(proofProgressTimer);
  proofTimer = null;
  proofProgressTimer = null;
}

function startProofAutoplay() {
  if (prefersReducedMotion || visibleProofSlides.length < 2) return;
  stopProofAutoplay();
  proofProgress = 0;
  proofTimer = window.setInterval(
    () => updateProof(proofIndex + 1),
    proofIntervalMs,
  );
  proofProgressTimer = window.setInterval(() => {
    proofProgress += 100 / (proofIntervalMs / 100);
    if (proofProgress >= 100) proofProgress = 0;
    if (proofProgressBar) proofProgressBar.style.width = `${proofProgress}%`;
  }, 100);
}

proofFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeProofFilter = button.dataset.filter || "Todos";
    proofFilterButtons.forEach((item) =>
      item.classList.toggle("is-active", item === button),
    );
    rebuildVisibleProofs();
  });
});

if (proofPrev)
  proofPrev.addEventListener("click", () => {
    updateProof(proofIndex - 1);
    startProofAutoplay();
  });
if (proofNext)
  proofNext.addEventListener("click", () => {
    updateProof(proofIndex + 1);
    startProofAutoplay();
  });
if (proofSlider) {
  proofSlider.addEventListener("mouseenter", stopProofAutoplay);
  proofSlider.addEventListener("mouseleave", startProofAutoplay);
  proofSlider.addEventListener("focusin", stopProofAutoplay);
  proofSlider.addEventListener("focusout", startProofAutoplay);
}

// Pausa o autoplay quando o carrossel sai da área visível.
if ("IntersectionObserver" in window && proofSlider) {
  const proofObserver = new IntersectionObserver(
    (entries) => {
      const [entry] = entries;
      if (entry.isIntersecting) startProofAutoplay();
      else stopProofAutoplay();
    },
    { threshold: 0.2 },
  );
  proofObserver.observe(proofSlider);
}

updateProof(0);
startProofAutoplay();

// -------------------------
// Lightbox das provas
// -------------------------
const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxClose = document.getElementById("lightboxClose");
let lastLightboxTrigger = null;

function openLightbox(img, trigger) {
  if (!lightbox || !lightboxImage) return;
  lastLightboxTrigger = trigger || null;
  lightboxImage.src = img.src;
  lightboxImage.alt = img.alt;
  lightbox.classList.add("is-open");
  lightbox.setAttribute("aria-hidden", "false");
  document.body.classList.add("lightbox-open");
  lightboxClose?.focus();
}

function closeLightbox() {
  if (!lightbox) return;
  lightbox.classList.remove("is-open");
  lightbox.setAttribute("aria-hidden", "true");
  document.body.classList.remove("lightbox-open");
  lastLightboxTrigger?.focus();
}

document.querySelectorAll(".proof-image-button").forEach((button) => {
  button.addEventListener("click", () => {
    const img = button.querySelector("img");
    if (img) openLightbox(img, button);
  });
});

lightboxClose?.addEventListener("click", closeLightbox);
lightbox?.addEventListener("click", (event) => {
  if (event.target === lightbox) closeLightbox();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && lightbox?.classList.contains("is-open"))
    closeLightbox();
  if (
    !lightbox?.classList.contains("is-open") &&
    document.activeElement?.closest?.("#proofSlider")
  ) {
    if (event.key === "ArrowRight") {
      updateProof(proofIndex + 1);
      startProofAutoplay();
    }
    if (event.key === "ArrowLeft") {
      updateProof(proofIndex - 1);
      startProofAutoplay();
    }
  }
});

// Evita múltiplos vídeos tocando ao mesmo tempo
const videos = [...document.querySelectorAll("video")];
videos.forEach((video) => {
  video.addEventListener("play", () => {
    videos.forEach((other) => {
      if (other !== video && !other.paused) other.pause();
    });
  });
});

// -------------------------
// Vídeo BP / autoplay ao entrar na tela
// -------------------------

const bpYoutubeIframe = document.getElementById("bpYoutubeVideo");
const bpVideoSection = bpYoutubeIframe?.closest(".partnership-video");

let bpYoutubePlayer = null;
let bpYoutubeReady = false;
let bpVideoVisible = false;

/**
 * Executa a reprodução conforme a posição atual da seção.
 * O vídeo inicia mudo porque os navegadores bloqueiam
 * autoplay automático com áudio.
 */
function updateBpYoutubePlayback() {
  if (!bpYoutubeReady || !bpYoutubePlayer) return;

  if (bpVideoVisible) {
    bpYoutubePlayer.mute();
    bpYoutubePlayer.playVideo();
  } else {
    bpYoutubePlayer.pauseVideo();
  }
}

if (bpYoutubeIframe && bpVideoSection) {
  // Carrega a API oficial do YouTube
  const youtubeApiScript = document.createElement("script");

  youtubeApiScript.src = "https://www.youtube.com/iframe_api";
  youtubeApiScript.async = true;

  document.head.appendChild(youtubeApiScript);

  // Observa quando o vídeo entra na área visível
  const bpVideoObserver = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];

      /*
       * Só inicia quando pelo menos 55% do vídeo
       * estiver realmente aparecendo na tela.
       */
      bpVideoVisible = entry.isIntersecting && entry.intersectionRatio >= 0.55;

      updateBpYoutubePlayback();
    },
    {
      threshold: [0, 0.25, 0.55, 0.75, 1],
    },
  );

  bpVideoObserver.observe(bpVideoSection);

  // Chamado automaticamente pela API do YouTube
  window.onYouTubeIframeAPIReady = function () {
    bpYoutubePlayer = new YT.Player("bpYoutubeVideo", {
      events: {
        onReady: function () {
          bpYoutubeReady = true;

          // Prepara o vídeo mudo para autoplay
          bpYoutubePlayer.unMute();

          updateBpYoutubePlayback();
        },
      },
    });
  };
}

// -------------------------
// Botão voltar ao topo
// -------------------------

const backToTop = document.getElementById("backToTop");

function updateBackToTop() {
  if (!backToTop) return;

  /*
   * O botão só aparece depois que
   * o visitante se afastou do início.
   */
  const shouldShow = window.scrollY > 500;

  backToTop.classList.toggle("is-visible", shouldShow);
}

if (backToTop) {
  /*
   * Controla a exibição conforme
   * a rolagem da página.
   */
  window.addEventListener("scroll", updateBackToTop, {
    passive: true,
  });

  /*
   * Clique → volta suavemente
   * para o início.
   */
  backToTop.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  });

  /*
   * Define o estado correto
   * assim que a página carregar.
   */
  updateBackToTop();
}

// -------------------------
// Cliente iGreen / popup + WhatsApp
// -------------------------
const clientModal = document.getElementById("clientModal");
const openClientModalBtn = document.getElementById("openClientModal");
const clientLeadForm = document.getElementById("clientLeadForm");
const clientCloseButtons = document.querySelectorAll("[data-client-close]");

function openClientModal() {
  if (!clientModal) return;

  clientModal.classList.add("is-open");
  clientModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("client-modal-open");

  window.setTimeout(() => {
    document.getElementById("clientName")?.focus();
  }, 150);
}

function closeClientModal() {
  if (!clientModal) return;

  clientModal.classList.remove("is-open");
  clientModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("client-modal-open");
}

function createClientWhatsAppLink(data) {
  const message = [
    "Olá! Quero conhecer as soluções para ser cliente iGreen.",
    "",
    `Nome: ${data.name}`,
    `WhatsApp: ${data.phone}`,
    `E-mail: ${data.email}`,
    `Cidade/UF: ${data.city}`,
    `Interesse principal: ${data.interest}`,
    `Perfil: ${data.profile}`,
  ];

  if (data.observation) {
    message.push(`Observação: ${data.observation}`);
  }

  message.push(
    "",
    "Acabei de preencher o formulário no site e gostaria de continuar meu atendimento.",
  );

  return `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(message.join("\n"))}`;
}

openClientModalBtn?.addEventListener("click", openClientModal);

clientCloseButtons.forEach((button) => {
  button.addEventListener("click", closeClientModal);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && clientModal?.classList.contains("is-open")) {
    closeClientModal();
  }
});

clientLeadForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = document.getElementById("clientName")?.value.trim() || "";
  const phone = document.getElementById("clientPhone")?.value.trim() || "";
  const email = document.getElementById("clientEmail")?.value.trim() || "";
  const city = document.getElementById("clientCity")?.value.trim() || "";
  const interest = document.getElementById("clientInterest")?.value || "";
  const profile = document.getElementById("clientProfile")?.value || "";
  const observation =
    document.getElementById("clientObservation")?.value.trim() || "";
  const consent = document.getElementById("clientConsent")?.checked;

  if (!name || !phone || !email || !city || !interest || !profile || !consent) {
    showToast("Preencha os campos obrigatórios para continuar.");
    return;
  }

  const phoneDigits = phone.replace(/\D/g, "");

  if (phoneDigits.length < 10 || phoneDigits.length > 13) {
    showToast("Informe um WhatsApp válido.");
    return;
  }

  const submitButton = clientLeadForm.querySelector('button[type="submit"]');

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "ABRINDO WHATSAPP...";
  }

  const clientData = {
    name,
    phone,
    email,
    city,
    interest,
    profile,
    observation,
  };

  const sheetLead = {
    tipo: "cliente",
    lead_id: createLeadId(),
    nome: name,
    whatsapp: phone,
    email,
    cidade: city,
    interesse: interest,
    perfil: profile,
    observacao: observation,
    ...getTrackingData(),
  };

  const whatsappUrl = createClientWhatsAppLink(clientData);

  await saveLeadToSheet(sheetLead);

  if (typeof gtag === "function") {
    gtag("event", "clique_whatsapp_cliente", {
      event_category: "conversao",
      event_label: "cliente_igreen",
    });
  }

  window.location.href = whatsappUrl;
});

const ecoCards = document.querySelectorAll("[data-eco]");
const mobileQuery = window.matchMedia("(max-width: 620px)");

function closeEco(card) {
  card.classList.remove("is-open");
  const trigger = card.querySelector(".eco-more");
  if (trigger) {
    trigger.setAttribute("aria-expanded", "false");
    trigger.innerHTML = "Ver vantagens ↓";
  }
}

function openEco(card) {
  card.classList.add("is-open");
  const trigger = card.querySelector(".eco-more");
  if (trigger) {
    trigger.setAttribute("aria-expanded", "true");
    trigger.innerHTML = "Ocultar vantagens ↑";
  }
}

function closeAllEco(exceptCard = null) {
  ecoCards.forEach((card) => {
    if (card !== exceptCard) closeEco(card);
  });
}

ecoCards.forEach((card) => {
  const trigger = card.querySelector(".eco-more");
  if (!trigger) return;

  trigger.addEventListener("click", (e) => {
    if (!mobileQuery.matches) return;
    e.preventDefault();
    e.stopPropagation();

    const isOpen = card.classList.contains("is-open");

    if (isOpen) {
      closeEco(card);
    } else {
      closeAllEco(card);
      openEco(card);
    }
  });
});

function resetEcoStateOnDesktop(e) {
  if (!e.matches) {
    closeAllEco();
  }
}

if (mobileQuery.addEventListener) {
  mobileQuery.addEventListener("change", resetEcoStateOnDesktop);
} else {
  mobileQuery.addListener(resetEcoStateOnDesktop);
}

// -------------------------
// Google Sheets / Leads
// -------------------------

function createLeadId() {
  if (window.crypto?.randomUUID) {
    return crypto.randomUUID();
  }

  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getTrackingData() {
  const params = new URLSearchParams(window.location.search);

  return {
    utm_source: params.get("utm_source") || "",
    utm_medium: params.get("utm_medium") || "",
    utm_campaign: params.get("utm_campaign") || "",
    utm_content: params.get("utm_content") || "",
    gclid: params.get("gclid") || "",
    fbclid: params.get("fbclid") || "",
    page_url: window.location.href,
  };
}

async function saveLeadToSheet(data) {
  if (!CONFIG.sheetEndpoint) {
    console.warn("Google Sheets endpoint não configurado.");
    return false;
  }

  const payload = {
    site_id: CONFIG.sheetSiteId,
    ...data,
  };

  const formData = new URLSearchParams();
  formData.set("payload", JSON.stringify(payload));

  /*
   * sendBeacon é ideal para este caso porque
   * a página pode redirecionar logo depois.
   */
  if (navigator.sendBeacon) {
    const queued = navigator.sendBeacon(CONFIG.sheetEndpoint, formData);

    if (queued) {
      return true;
    }
  }

  /*
   * Fallback para navegadores onde Beacon
   * não conseguiu enfileirar a requisição.
   */
  try {
    await fetch(CONFIG.sheetEndpoint, {
      method: "POST",
      mode: "no-cors",
      body: formData,
      keepalive: true,
    });

    return true;
  } catch (error) {
    console.error("Falha ao enviar lead:", error);
    return false;
  }
}
