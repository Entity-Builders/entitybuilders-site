import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  Mail,
  RotateCcw,
  Send,
} from "lucide-react";
import { useMemo, useState } from "react";
import "./DiagnosticFunnel.css";

type Question = {
  id: string;
  text: string;
  reason?: string;
  recommendedAnswer?: string;
};

type RecommendationOption = {
  id: string;
  label: string;
  recommended?: boolean;
  reason?: string;
};

type InterviewTurn = {
  reading: string;
  checkpoint?: string;
  recommendation: string;
  recommendationItems?: string[];
  recommendationOptions?: RecommendationOption[];
  question: Question;
  canGeneratePreview: boolean;
  isComplete: boolean;
  turnIndex: number;
  maxTurns: number;
};

type InterviewAnswer = {
  id: string;
  question: string;
  answer: string;
  optional: boolean;
  index: number;
};

type Preview = {
  title: string;
  summary: string;
  entityType: string;
  opportunity: string;
  architectureSketch?: {
    currentSurfaces?: string[];
    likelyFlow?: string[];
    missingInfrastructure?: string[];
    recommendedAdditions?: string[];
  };
  openQuestions: string[];
  firstActions: string[];
};

type SubmitResult = {
  emailStatus: "sent" | "failed" | "saved_local";
  leadId?: string;
  storage?: "local_memory";
  message?: string;
};

type DiagnosticResponse =
  | {
    questions: Question[];
    optionalQuestion?: Question;
  }
  | {
    interviewTurn: InterviewTurn;
  }
  | {
    preview: Preview;
  }
  | SubmitResult;

const minimumContextLength = 40;
const maxFallbackTurns = 3;

type LoadingPurpose = "start" | "answer" | "preview" | "brief" | null;
type ArchitectureSection = {
  label: string;
  items: string[];
};

const quickStartOptions = [
  {
    id: "whatsapp",
    label: "WhatsApp sin seguimiento",
    description: "Pedidos, turnos o reservas quedan mezclados en chats.",
    text:
      "Somos un negocio que recibe consultas, pedidos o reservas por WhatsApp. Hoy todo queda mezclado en chats y no tenemos una forma clara de saber que esta recibido, respondido, pendiente o confirmado. Necesitamos ordenar el seguimiento sin cambiar toda la operacion de golpe.",
  },
  {
    id: "conversion",
    label: "Web que no convierte",
    description: "Hay oferta real, pero cuesta explicar y captar consultas.",
    text:
      "Tenemos un negocio real con oferta y clientes, pero la web o las redes no explican bien que hacemos ni convierten buenas consultas. Queremos que el sitio ayude a mostrar la oferta, captar mejores consultas y orientar al cliente antes de hablar con nosotros.",
  },
  {
    id: "operations",
    label: "Operacion desordenada",
    description: "Mensajes, planillas o notas sostienen demasiado trabajo.",
    text:
      "Operamos con mensajes, planillas o notas sueltas. Hay tareas repetidas, estados poco claros y seguimiento manual. Necesitamos una primera entidad digital que organice el flujo y deje claro que pasa despues.",
  },
  {
    id: "expertise",
    label: "Servicio experto",
    description: "Un metodo o conocimiento podria guiar mejor al cliente.",
    text:
      "Vendemos un servicio basado en experiencia o conocimiento. Nos cuesta convertir ese metodo en una experiencia digital que eduque, filtre y acerque clientes adecuados. Queremos ordenar la oferta y el primer flujo de consulta.",
  },
] as const;

const loadingMessages: Record<Exclude<LoadingPurpose, null>, {
  title: string;
  steps: string[];
}> = {
  start: {
    title: "Tomando contexto",
    steps: [
      "Leyendo tu texto y links",
      "Ubicando que negocio hay detras",
      "Preparando una pregunta util",
    ],
  },
  answer: {
    title: "Un momento",
    steps: [
      "Tomando lo que agregaste",
      "Uniendo lo anterior con lo nuevo",
      "Preparando el proximo paso",
    ],
  },
  preview: {
    title: "Armando tu preview",
    steps: [
      "Ordenando la lectura",
      "Separando decisiones y riesgos",
      "Preparando primeras acciones",
    ],
  },
  brief: {
    title: "Preparando el brief completo",
    steps: [
      "Guardando el diagnostico",
      "Armando la version completa",
      "Preparando el envio por email",
    ],
  },
};

function getDiagnosticUrl(): string {
  const explicit = import.meta.env.PUBLIC_DIAGNOSTIC_FUNCTION_URL;
  if (explicit) return explicit;

  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return "";
  return `${
    supabaseUrl.replace(/\/$/, "")
  }/functions/v1/entitybuilders-diagnostic`;
}

function authHeaders(): Record<string, string> {
  const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) return {};
  return {
    apikey: anonKey,
    authorization: `Bearer ${anonKey}`,
  };
}

function lengthBucket(text: string): string {
  if (typeof window !== "undefined") {
    return (
      window.entityBuildersAnalytics?.lengthBucket(text) ??
        localLengthBucket(text)
    );
  }
  return localLengthBucket(text);
}

function localLengthBucket(text: string): string {
  const length = text.trim().length;
  if (length <= 0) return "empty";
  if (length <= 240) return "short";
  if (length <= 900) return "medium";
  return "long";
}

function track(
  event: string,
  properties: Record<string, string | number | boolean | undefined> = {},
) {
  window.entityBuildersAnalytics?.track(event, properties);
}

function readUtmParams(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]
      .map((key) => [key, params.get(key)?.slice(0, 160) ?? ""])
      .filter(([, value]) => value.length > 0),
  );
}

async function callDiagnostic(
  action: string,
  payload: Record<string, unknown>,
): Promise<DiagnosticResponse> {
  const endpoint = getDiagnosticUrl();
  if (!endpoint) {
    throw new Error("diagnostic_unconfigured");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({
      action,
      ...payload,
    }),
  });

  const body = (await response.json().catch(() => null)) as
    | DiagnosticResponse
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(
      body && "error" in body && body.error ? body.error : "diagnostic_failed",
    );
  }

  if (!body) throw new Error("diagnostic_empty_response");
  return body as DiagnosticResponse;
}

function fallbackInterviewTurn(answers: InterviewAnswer[]): InterviewTurn {
  return {
    reading:
      "El proveedor del diagnostico no devolvio un turno contextual confiable.",
    checkpoint:
      "esta activo un fallback seguro; no se invento un diagnostico de negocio.",
    recommendation:
      "Reintentar el turno del modelo o agregar un dato concreto y no sensible. No mostramos una pregunta generica como si fuera del asesor.",
    recommendationItems: [],
    recommendationOptions: [
      {
        id: "add_context",
        label: "Agregar un dato concreto del negocio",
        recommended: true,
        reason: "Evita inventar un diagnostico generico.",
      },
      {
        id: "retry",
        label: "Reintentar el turno del modelo",
        reason: "Sirve si el contexto ya era suficiente.",
      },
    ],
    question: {
      id: "retry_with_context",
      text:
        "No pude generar una pregunta contextual confiable. Agrega un dato concreto del negocio o intenta de nuevo.",
      reason: "El fallback no inventa preguntas diagnosticas prearmadas.",
      recommendedAnswer:
        "Suma una web publica, canal actual, consulta reciente o una friccion especifica.",
    },
    canGeneratePreview: answers.length >= 2,
    isComplete: answers.length >= maxFallbackTurns,
    turnIndex: Math.min(answers.length, maxFallbackTurns),
    maxTurns: maxFallbackTurns,
  };
}

function preferredOptionId(turn: InterviewTurn): string {
  return (
    turn.recommendationOptions?.find((option) => option.recommended)?.id ??
      turn.recommendationOptions?.[0]?.id ??
      ""
  );
}

function answerTextFromSelection(
  option: RecommendationOption | null,
  clarification: string,
): string {
  const cleanClarification = clarification.trim();
  if (!option) return cleanClarification;
  if (!cleanClarification) return option.label;
  return `${option.label}. Aclaracion: ${cleanClarification}`;
}

function answerArray(answers: InterviewAnswer[]) {
  return answers
    .map((answer, index) => ({
      id: answer.id,
      question: answer.question,
      answer: answer.answer.trim(),
      optional: answer.optional,
      index,
    }))
    .filter((item) => item.answer.length > 0);
}

function cleanDisplayText(value: string): string {
  return value
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*\u2022]\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTurnText(value: string): string {
  return cleanDisplayText(value)
    .replace(
      /^(queda|checkpoint|lectura|reading|mi recomendaci.n|recomendacion|recommendation|my recommendation)\s*:\s*/i,
      "",
    )
    .replace(/^pregunta\s+\d+\s*:\s*/i, "")
    .trim();
}

function cleanCheckpointText(value: string): string {
  return cleanTurnText(value)
    .replace(/^queda\s+/i, "")
    .replace(/^pendiente\s+/, "pendiente ")
    .trim();
}

function cleanRecommendationText(value: string): string {
  return cleanTurnText(value)
    .replace(/^mi recomendaci.n\s+es\s+que\s+/i, "")
    .replace(/^mi recomendaci.n\s+es\s+/i, "")
    .trim();
}

function compactText(value: string, max = 260): string {
  const clean = cleanTurnText(value);
  if (clean.length <= max) return clean;
  const sliced = clean.slice(0, max).trimEnd();
  const boundary = sliced.lastIndexOf(" ");
  return `${
    sliced.slice(0, boundary > max * 0.65 ? boundary : max).trimEnd()
  }...`;
}

function firstSentence(value: string, max = 230): string {
  const clean = cleanTurnText(value);
  const sentenceMatch = clean.match(/^(.+?[.!?])\s+/);
  return compactText(sentenceMatch?.[1] ?? clean, max);
}

function previewActionParts(action: string): { title?: string; body: string } {
  const clean = cleanDisplayText(action);
  const [title, ...rest] = clean.split(":");
  const body = rest.join(":").trim();

  if (body && title.trim().length > 0 && title.trim().length <= 52) {
    return { title: title.trim(), body };
  }

  return { body: clean };
}

function cleanPreviewList(value: string[] | undefined, limit = 4): string[] {
  return (value ?? [])
    .map((item) => cleanDisplayText(item))
    .filter(Boolean)
    .slice(0, limit);
}

function LoadingPanel({ purpose }: { purpose: Exclude<LoadingPurpose, null> }) {
  const message = loadingMessages[purpose];

  return (
    <div className="diagnostic__loading" role="status" aria-live="polite">
      <LoaderCircle size={18} aria-hidden="true" />
      <div>
        <strong>{message.title}</strong>
        <ul>
          {message.steps.map((step) => <li key={step}>{step}</li>)}
        </ul>
      </div>
    </div>
  );
}

function generateLocalPreview(
  context: string,
  answers: InterviewAnswer[],
): Preview {
  const joinedAnswers = answerArray(answers)
    .map((item) => item.answer)
    .join(" ");
  const combined = `${context} ${joinedAnswers}`.toLowerCase();
  const entityType =
    combined.includes("restaurant") || combined.includes("restaurante")
      ? "Entidad de atencion y venta"
      : combined.includes("course") ||
          combined.includes("curso") ||
          combined.includes("comunidad")
      ? "Entidad de expertise"
      : combined.includes("operacion") ||
          combined.includes("workflow") ||
          combined.includes("manual")
      ? "Entidad operativa"
      : "Entidad digital mixta";

  return {
    title: "Hay una entidad construible, pero falta elegir el primer foco.",
    summary:
      "El contexto muestra potencial, pero conviene separar oferta, usuario, operacion y validacion. El primer paso no es construir todo: es elegir que parte debe vender, responder u ordenar primero.",
    entityType,
    opportunity:
      "Convertir el conocimiento y la operacion actual en una presencia que capture demanda y reduzca trabajo manual.",
    openQuestions: [
      "Cual es el usuario o cliente que debe recibir valor primero?",
      "Que resultado medible haria que el primer sistema valga la pena?",
      "Que parte del proceso actual esta atrapada en mensajes, planillas o decisiones manuales?",
    ],
    firstActions: [
      "Definir una oferta principal y una accion de conversion.",
      "Mapear el flujo manual actual en 5 pasos.",
      "Elegir una primera entidad minima: showroom, diagnostico, checkout, dashboard o workflow AI.",
    ],
  };
}

export default function DiagnosticFunnel() {
  const [context, setContext] = useState("");
  const [turns, setTurns] = useState<InterviewTurn[]>([]);
  const [interviewAnswers, setInterviewAnswers] = useState<InterviewAnswer[]>(
    [],
  );
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [step, setStep] = useState<
    "context" | "interview" | "preview" | "submitted"
  >("context");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPurpose, setLoadingPurpose] = useState<LoadingPurpose>(null);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);

  const currentTurn = turns[turns.length - 1] ?? null;
  const currentTurnNumber = currentTurn
    ? Math.min(currentTurn.turnIndex + 1, currentTurn.maxTurns)
    : 0;
  const currentCheckpoint = currentTurn
    ? compactText(
      cleanCheckpointText(currentTurn.checkpoint || currentTurn.reading),
      180,
    )
    : "";
  const currentQuestion = currentTurn
    ? cleanTurnText(currentTurn.question.text)
    : "";
  const currentRecommendation = currentTurn
    ? cleanRecommendationText(currentTurn.recommendation)
    : "";
  const currentRecommendationSummary = currentRecommendation
    ? firstSentence(currentRecommendation)
    : "";
  const currentRecommendationItems = currentTurn
    ? (currentTurn.recommendationItems ?? [])
      .map((item) => cleanRecommendationText(item))
      .filter(Boolean)
      .slice(0, 3)
    : [];
  const currentRecommendationOptions = currentTurn
    ? (currentTurn.recommendationOptions ?? [])
      .map((option) => ({
        ...option,
        label: cleanDisplayText(option.label),
        reason: option.reason ? cleanDisplayText(option.reason) : undefined,
      }))
      .filter((option) => option.label.length > 0)
      .slice(0, 4)
    : [];
  const selectedOption = currentRecommendationOptions.find((option) =>
    option.id === selectedOptionId
  ) ?? null;
  const currentAnswerPayload = answerTextFromSelection(
    selectedOption,
    currentAnswer,
  );
  const hasRecommendationDetails =
    currentRecommendation.length > currentRecommendationSummary.length + 24 ||
    currentRecommendationItems.length > 0;
  const architectureSections: ArchitectureSection[] = preview?.architectureSketch
    ? [
      {
        label: "Superficies",
        items: cleanPreviewList(preview.architectureSketch.currentSurfaces),
      },
      {
        label: "Flujo probable",
        items: cleanPreviewList(preview.architectureSketch.likelyFlow),
      },
      {
        label: "Infraestructura faltante",
        items: cleanPreviewList(
          preview.architectureSketch.missingInfrastructure,
        ),
      },
      {
        label: "Agregaria Entity Builders",
        items: cleanPreviewList(
          preview.architectureSketch.recommendedAdditions,
        ),
      },
    ].filter((section) => section.items.length > 0)
    : [];
  const canStartInterview = context.trim().length >= minimumContextLength;
  const canGeneratePreview = useMemo(
    () =>
      interviewAnswers.length >= 2 ||
      currentTurn?.canGeneratePreview === true ||
      currentTurn?.isComplete === true,
    [currentTurn, interviewAnswers.length],
  );
  const startButtonLabel = isLoading
    ? "Leyendo contexto"
    : context.trim().length === 0
    ? "Pega un link o contexto"
    : !canStartInterview
    ? "Agrega una frase mas"
    : "Armar primera lectura";

  async function startInterview() {
    setError(null);
    setIsLoading(true);
    setLoadingPurpose("start");
    setUsingFallback(false);
    track("diagnostic_started", {
      context_length_bucket: lengthBucket(context),
    });

    try {
      const result = await callDiagnostic("start_interview", {
        initialContext: context,
      });
      if (!("interviewTurn" in result)) {
        throw new Error("missing_interview_turn");
      }
      setTurns([result.interviewTurn]);
      setCurrentAnswer("");
      setSelectedOptionId(preferredOptionId(result.interviewTurn));
    } catch {
      const fallbackTurn = fallbackInterviewTurn([]);
      setTurns([fallbackTurn]);
      setSelectedOptionId(preferredOptionId(fallbackTurn));
      setUsingFallback(true);
      setError(
        "No pudimos generar una entrevista contextual ahora. Agrega un dato mas o intenta de nuevo; no vamos a inventar una pregunta generica.",
      );
    } finally {
      setStep("interview");
      setIsLoading(false);
      setLoadingPurpose(null);
    }
  }

  async function submitInterviewAnswer() {
    if (!currentTurn) return;
    const trimmedAnswer = currentAnswerPayload.trim();
    if (!trimmedAnswer) {
      setError(
        "Elige una opcion, agrega una aclaracion o genera el preview con lo que ya hay.",
      );
      return;
    }

    setError(null);
    setIsLoading(true);
    setLoadingPurpose("answer");

    const nextAnswer: InterviewAnswer = {
      id: currentTurn.question.id,
      question: currentTurn.question.text,
      answer: trimmedAnswer,
      optional: false,
      index: interviewAnswers.length,
    };
    const nextAnswers = [...interviewAnswers, nextAnswer];
    setInterviewAnswers(nextAnswers);
    setCurrentAnswer("");
    setSelectedOptionId("");
    track("diagnostic_question_answered", {
      question_index: nextAnswers.length,
      answer_length_bucket: lengthBucket(trimmedAnswer),
    });

    if (nextAnswers.length >= currentTurn.maxTurns) {
      setTurns((current) => [
        ...current.slice(0, -1),
        {
          ...currentTurn,
          canGeneratePreview: true,
          isComplete: true,
        },
      ]);
      setIsLoading(false);
      setLoadingPurpose(null);
      return;
    }

    try {
      const result = await callDiagnostic("continue_interview", {
        initialContext: context,
        answers: answerArray(nextAnswers),
      });
      if (!("interviewTurn" in result)) {
        throw new Error("missing_interview_turn");
      }
      setTurns((current) => [...current, result.interviewTurn]);
      setSelectedOptionId(preferredOptionId(result.interviewTurn));
      setUsingFallback(false);
    } catch {
      const fallbackTurn = fallbackInterviewTurn(nextAnswers);
      setTurns((current) => [...current, fallbackTurn]);
      setSelectedOptionId(preferredOptionId(fallbackTurn));
      setUsingFallback(true);
      setError(
        "La siguiente pregunta contextual no llego. Podes reintentar o generar preview si ya hay suficiente contexto.",
      );
    } finally {
      setIsLoading(false);
      setLoadingPurpose(null);
    }
  }

  async function generatePreview() {
    setError(null);
    setIsLoading(true);
    setLoadingPurpose("preview");
    const answersPayload = answerArray(interviewAnswers);

    try {
      const result = await callDiagnostic("generate_preview", {
        initialContext: context,
        answers: answersPayload,
      });
      if (!("preview" in result)) throw new Error("missing_preview");
      setPreview(result.preview);
      setUsingFallback(false);
      track("diagnostic_preview_generated", {
        context_length_bucket: lengthBucket(context),
        entity_type: result.preview.entityType,
        answer_count: answersPayload.length,
      });
    } catch {
      const localPreview = generateLocalPreview(context, interviewAnswers);
      setPreview(localPreview);
      setUsingFallback(true);
      setError(
        "Generamos un preview base porque el diagnostico personalizado no respondio. Para enviar el brief completo necesitamos recuperar el servicio.",
      );
      track("diagnostic_preview_generated", {
        context_length_bucket: lengthBucket(context),
        entity_type: localPreview.entityType,
        answer_count: answersPayload.length,
        error_category: "fallback_preview",
      });
    } finally {
      setStep("preview");
      setIsLoading(false);
      setLoadingPurpose(null);
    }
  }

  async function submitBrief(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitResult(null);

    if (!preview) return;
    if (!email.trim()) {
      setError("Necesitamos un email para enviarte el brief completo.");
      return;
    }

    setIsLoading(true);
    setLoadingPurpose("brief");
    try {
      const result = await callDiagnostic("submit_brief", {
        initialContext: context,
        answers: answerArray(interviewAnswers),
        dynamicQuestions: turns.map((turn) => turn.question),
        preview,
        contact: {
          email: email.trim(),
          name: name.trim() || undefined,
          companyName: companyName.trim() || undefined,
          websiteUrl: websiteUrl.trim() || undefined,
        },
        source: {
          source: "entitybuilders_site",
          route: "/",
          surface: "diagnostic_interview",
        },
        utm: readUtmParams(),
      });
      const submit = result as SubmitResult;
      setSubmitResult(submit);
      setStep("submitted");
      track("diagnostic_brief_submitted", {
        email_status: submit.emailStatus,
        answer_count: interviewAnswers.length,
      });
      track(
        submit.emailStatus === "sent"
          ? "diagnostic_email_sent"
          : submit.emailStatus === "saved_local"
          ? "diagnostic_lead_saved_local"
          : "diagnostic_email_failed",
        {
          email_status: submit.emailStatus,
        },
      );
    } catch {
      setSubmitResult({ emailStatus: "failed" });
      setStep("submitted");
      setError(
        "No pudimos enviar el brief ahora. Guardamos este intento localmente y podes escribirnos directo.",
      );
      track("diagnostic_email_failed", {
        email_status: "failed",
        error_category: "submit_failed",
      });
    } finally {
      setIsLoading(false);
      setLoadingPurpose(null);
    }
  }

  function reset() {
    setTurns([]);
    setInterviewAnswers([]);
    setCurrentAnswer("");
    setSelectedOptionId("");
    setPreview(null);
    setSubmitResult(null);
    setError(null);
    setLoadingPurpose(null);
    setUsingFallback(false);
    setStep("context");
  }

  function applyQuickStart(option: typeof quickStartOptions[number]) {
    setContext((current) => {
      const trimmed = current.trimEnd();
      return trimmed ? `${trimmed}\n${option.text}` : option.text;
    });
    track("diagnostic_context_pill_selected", {
      option: option.id,
    });
  }

  return (
    <section
      className="diagnostic"
      id="diagnostico"
      aria-label="Diagnostico Entity Builders"
    >
      <div className="diagnostic__header">
        <span>Diagnostico inicial</span>
        <strong>Diagnostico gratis</strong>
      </div>

      {error && (
        <div className="diagnostic__notice" role="status">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {loadingPurpose && <LoadingPanel purpose={loadingPurpose} />}

      {step === "context" && (
        <div className="diagnostic__stage">
          <div className="diagnostic__intro">
            <strong>Elegí el caso más parecido.</strong>
            <p>
              Un clic alcanza para empezar. Después podés pegar tu web o ajustar
              el texto con palabras propias.
            </p>
          </div>
          <div
            className="diagnostic__quickstarts"
            aria-label="Casos rapidos para iniciar diagnostico"
          >
            {quickStartOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={isLoading}
                onClick={() => applyQuickStart(option)}
              >
                <span>{option.label}</span>
                <small>{option.description}</small>
              </button>
            ))}
          </div>
          <label htmlFor="entity-context">
            Tu contexto, web o ajuste rápido
          </label>
          <textarea
            id="entity-context"
            className="diagnostic__context-input"
            value={context}
            onChange={(event) => setContext(event.target.value)}
            placeholder="Ej: sportingbike.com.ar. Somos una bicicleteria y las reservas quedan en WhatsApp. Queremos ordenar pedidos, estados y seguimiento."
            rows={5}
          />
          <p className="diagnostic__hint">
            Si tenés web, pegala junto al texto. No compartas secretos,
            credenciales ni informacion confidencial.
          </p>
          <button
            className="diagnostic__primary"
            type="button"
            disabled={!canStartInterview || isLoading}
            onClick={startInterview}
          >
            <Send size={16} aria-hidden="true" />
            {startButtonLabel}
          </button>
        </div>
      )}

      {step === "interview" && currentTurn && (
        <div className="diagnostic__stage">
          <div className="diagnostic__interview-meta">
            <span>Diagnostico guiado</span>
            <strong>
              {currentTurnNumber} / {currentTurn.maxTurns}
            </strong>
          </div>
          <div className="diagnostic__progress" aria-hidden="true">
            <span
              style={{
                width: `${
                  Math.round((currentTurnNumber / currentTurn.maxTurns) * 100)
                }%`,
              }}
            />
          </div>

          <div className="diagnostic__interview">
            <article
              className="diagnostic__turn diagnostic__turn--grill"
              key={`${currentTurn.question.id}-${currentTurn.turnIndex}`}
            >
              <p className="diagnostic__checkpoint">
                <strong>Queda:</strong>
                <span>{currentCheckpoint}</span>
              </p>
              <div className="diagnostic__question-line">
                <strong>Decision {currentTurnNumber}:</strong>
                <span>{currentQuestion}</span>
              </div>
              <div className="diagnostic__recommendation-block">
                <strong>Mi recomendacion:</strong>
                <p>{currentRecommendationSummary}</p>
                {hasRecommendationDetails && (
                  <details className="diagnostic__details">
                    <summary>Ver criterio completo</summary>
                    {currentRecommendation.length >
                        currentRecommendationSummary.length + 24 && (
                      <p>{currentRecommendation}</p>
                    )}
                    {currentRecommendationItems.length > 0 && (
                      <ul className="diagnostic__recommendation-list">
                        {currentRecommendationItems.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </details>
                )}
              </div>
              {(!currentTurn.isComplete ||
                interviewAnswers[currentTurn.turnIndex]) && (
                <div className="diagnostic__response-area">
                  {!currentTurn.isComplete
                    ? (
                      <>
                        {currentRecommendationOptions.length > 0 && (
                          <div
                            className="diagnostic__option-list"
                            role="radiogroup"
                            aria-label="Opciones recomendadas"
                          >
                            {currentRecommendationOptions.map((option) => {
                              const isSelected = option.id === selectedOptionId;
                              return (
                                <button
                                  key={option.id}
                                  className="diagnostic__option"
                                  type="button"
                                  role="radio"
                                  aria-checked={isSelected}
                                  data-selected={isSelected ? "true" : "false"}
                                  data-recommended={option.recommended
                                    ? "true"
                                    : "false"}
                                  onClick={() => setSelectedOptionId(option.id)}
                                >
                                  <span>
                                    {option.label}
                                    {option.recommended && (
                                      <small>Recomendada</small>
                                    )}
                                  </span>
                                  {option.reason && <em>{option.reason}</em>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <textarea
                          value={currentAnswer}
                          onChange={(event) =>
                            setCurrentAnswer(event.target.value)}
                          rows={3}
                          placeholder={selectedOption
                            ? "Opcional: agrega un matiz si esta opcion necesita contexto."
                            : "Si ninguna opcion encaja, responde corto con lo que sepas."}
                        />
                      </>
                    )
                    : interviewAnswers[currentTurn.turnIndex]
                    ? (
                      <p className="diagnostic__answer">
                        {interviewAnswers[currentTurn.turnIndex].answer}
                      </p>
                    )
                    : null}
                </div>
              )}
              {interviewAnswers.length > 0 && !currentTurn.isComplete && (
                <p className="diagnostic__context-count">
                  {interviewAnswers.length} {interviewAnswers.length === 1
                    ? "respuesta considerada"
                    : "respuestas consideradas"}
                </p>
              )}
            </article>
          </div>

          {currentTurn.isComplete && (
            <p className="diagnostic__hint">
              Con esto ya hay suficiente contexto para armar un preview del
              brief.
            </p>
          )}

          <div className="diagnostic__actions">
            <button
              className="diagnostic__secondary"
              type="button"
              onClick={reset}
            >
              <RotateCcw size={16} aria-hidden="true" />
              Reiniciar
            </button>
            <div className="diagnostic__action-group">
              <button
                className="diagnostic__secondary"
                type="button"
                disabled={!canGeneratePreview || isLoading}
                onClick={generatePreview}
              >
                <ArrowRight size={16} aria-hidden="true" />
                Ver preview
              </button>
              {!currentTurn.isComplete && (
                <button
                  className="diagnostic__primary"
                  type="button"
                  disabled={isLoading || !currentAnswerPayload.trim()}
                  onClick={submitInterviewAnswer}
                >
                  <Send size={16} aria-hidden="true" />
                  {isLoading ? "Pensando" : selectedOption
                    ? "Confirmar"
                    : "Continuar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {step === "preview" && preview && (
        <div className="diagnostic__stage">
          <div className="diagnostic__preview">
            <span className="diagnostic__badge">
              {cleanDisplayText(preview.entityType)}
            </span>
            <h3>{cleanDisplayText(preview.title)}</h3>
            <p>{cleanDisplayText(preview.summary)}</p>
            <div className="diagnostic__preview-grid">
              <div>
                <strong>Oportunidad</strong>
                <p>{cleanDisplayText(preview.opportunity)}</p>
              </div>
              {architectureSections.length > 0 && (
                <div className="diagnostic__architecture">
                  <strong>Esqueleto de entidad actual</strong>
                  <div className="diagnostic__architecture-grid">
                    {architectureSections.map((section) => (
                        <section key={section.label}>
                          <span>{section.label}</span>
                          <ul>
                            {section.items.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </section>
                      ))}
                  </div>
                </div>
              )}
              <div>
                <strong>Primeras acciones</strong>
                <ol className="diagnostic__action-list">
                  {preview.firstActions.slice(0, 3).map((action, index) => {
                    const parts = previewActionParts(action);
                    return (
                      <li
                        className="diagnostic__action-item"
                        key={`${action}-${index}`}
                      >
                        {parts.title && <strong>{parts.title}</strong>}
                        <span>{parts.body}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          </div>
          <form className="diagnostic__contact" onSubmit={submitBrief}>
            <label>
              Email para recibir el brief completo
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                placeholder="tu@email.com"
                required
              />
            </label>
            <div className="diagnostic__contact-grid">
              <label>
                Nombre
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Opcional"
                />
              </label>
              <label>
                Empresa o proyecto
                <input
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder="Opcional"
                />
              </label>
            </div>
            <label>
              Web, redes o plataformas
              <input
                value={websiteUrl}
                onChange={(event) => setWebsiteUrl(event.target.value)}
                placeholder="Sitio, Instagram, WhatsApp, tienda, CRM..."
              />
            </label>
            <button
              className="diagnostic__primary"
              type="submit"
              disabled={isLoading}
            >
              <Mail size={16} aria-hidden="true" />
              {isLoading ? "Preparando brief" : "Enviar brief completo"}
            </button>
            {usingFallback && (
              <p className="diagnostic__hint">
                Este preview fue generado en modo fallback. El envio real
                necesita el backend configurado.
              </p>
            )}
          </form>
        </div>
      )}

      {step === "submitted" && (
        <div className="diagnostic__stage diagnostic__done">
          <CheckCircle2 size={32} aria-hidden="true" />
          <h3>
            {submitResult?.emailStatus === "sent"
              ? "Brief en camino"
              : submitResult?.emailStatus === "saved_local"
              ? "Diagnostico guardado localmente"
              : "Tenemos tu diagnostico"}
          </h3>
          <p>
            {submitResult?.emailStatus === "sent"
              ? "Te enviamos el brief completo. Si queres bajarlo a presupuesto y plan de construccion, responde ese email con contexto extra."
              : submitResult?.emailStatus === "saved_local"
              ? "Modo local: el lead quedo guardado en memoria del Edge Function mientras el servidor este corriendo. El envio por email esta deshabilitado porque Resend no esta configurado localmente."
              : "No pudimos confirmar el envio automatico. Si queres seguir ahora, escribinos directo y usamos este diagnostico como punto de partida."}
          </p>
          {submitResult?.emailStatus === "saved_local" && submitResult.leadId &&
            (
              <p className="diagnostic__hint">
                Lead local: {submitResult.leadId}
              </p>
            )}
          <button
            className="diagnostic__secondary"
            type="button"
            onClick={reset}
          >
            <RotateCcw size={16} aria-hidden="true" />
            Crear otro diagnostico
          </button>
        </div>
      )}
    </section>
  );
}
