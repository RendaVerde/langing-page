const CONFIG = {
  // Para integrar CRM/n8n/Google Sheets, informe aqui seu webhook HTTPS.
  webhookUrl: "",
  checkoutUrl: "https://expansao.igreenenergy.com.br/?id=29284&checkout=true",
};

const answers = {};
let step = 1;
const maxVisibleStep = 5;
const qs = [...document.querySelectorAll(".q")];
const bar = document.getElementById("bar");
const label = document.getElementById("stepLabel");
const backBtn = document.getElementById("backBtn");
const nextBtn = document.getElementById("nextBtn");
const toast = document.getElementById("toast");

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
}

function render() {
  qs.forEach((q) =>
    q.classList.toggle("active", Number(q.dataset.step) === step),
  );
  bar.style.width = Math.min(100, (step / 4) * 100) + "%";
  label.textContent = step <= 4 ? `PERGUNTA ${step} DE 4` : "RESULTADO";
  backBtn.style.visibility = step > 1 && step < 5 ? "visible" : "hidden";
  nextBtn.style.display = step === 4 ? "inline-flex" : "none";
}

document.querySelectorAll(".opt").forEach((btn) => {
  btn.addEventListener("click", () => {
    const key = btn.dataset.key;
    answers[key] = btn.dataset.value;
    btn.parentElement
      .querySelectorAll(".opt")
      .forEach((x) => x.classList.remove("selected"));
    btn.classList.add("selected");
    setTimeout(() => {
      step++;
      render();
    }, 180);
  });
});

backBtn.addEventListener("click", () => {
  if (step > 1) {
    step--;
    render();
  }
});

function scoreProfile() {
  let s = 0;
  if (
    [
      "Nova atividade profissional",
      "Ampliar carteira atual",
      "Desenvolver equipe",
    ].includes(answers.objetivo)
  )
    s += 2;
  if (
    [
      "5 a 15h por semana",
      "15 a 30h por semana",
      "Dedicação principal",
    ].includes(answers.tempo)
  )
    s += 2;
  if (
    [
      "Já vendo/empreendo",
      "Tenho boa rede de contatos",
      "Quero aprender vendas",
    ].includes(answers.perfil)
  )
    s += 2;
  return s;
}

async function submitLead() {
  const lead = {
    ...answers,
    nome: document.getElementById("nome").value.trim(),
    whatsapp: document.getElementById("whats").value.trim(),
    cidade: document.getElementById("cidade").value.trim(),
    email: document.getElementById("email").value.trim(),
    momento: document.getElementById("momento").value,
    page: location.href,
    utm_source: new URLSearchParams(location.search).get("utm_source") || "",
    utm_campaign:
      new URLSearchParams(location.search).get("utm_campaign") || "",
    gclid: new URLSearchParams(location.search).get("gclid") || "",
    created_at: new Date().toISOString(),
  };

  if (!lead.nome || !lead.whatsapp || !lead.cidade || !lead.momento) {
    showToast("Preencha nome, WhatsApp, cidade e momento.");
    return;
  }

  localStorage.setItem("igreen_lead_last", JSON.stringify(lead));

  if (CONFIG.webhookUrl) {
    try {
      await fetch(CONFIG.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
      });
    } catch (e) {}
  }

  const score = scoreProfile();
  document.getElementById("resultTitle").textContent =
    score >= 5
      ? "Seu perfil mostra boa aderência inicial ao modelo."
      : score >= 3
        ? "Seu perfil tem pontos de aderência que vale explorar."
        : "Vale conhecer o modelo com calma antes de decidir.";

  document.getElementById("resultText").textContent =
    `${lead.nome}, sua resposta indica foco em “${answers.objetivo || "avaliar a oportunidade"}”. O próximo passo é conhecer as regras atuais, contrato, portfólio e forma de atuação.`;

  document.getElementById("checkoutBtn").href = CONFIG.checkoutUrl;
  step = 5;
  render();
}

nextBtn.addEventListener("click", submitLead);
render();
