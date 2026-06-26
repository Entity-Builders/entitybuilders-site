export type EntityStatus =
  | 'online'
  | 'prototype'
  | 'experiment'
  | 'internal'
  | 'learning';

export type ShowroomEntity = {
  name: string;
  type: string;
  status: EntityStatus;
  statusLabel: string;
  problem: string;
  outcome: string;
  role: string;
  systems: string[];
  href?: string;
};

export const showroomEntities: ShowroomEntity[] = [
  {
    name: 'Tablia',
    type: 'Entidad para restaurantes',
    status: 'online',
    statusLabel: 'Online',
    problem:
      'Un restaurante necesita que carta, QR, consulta y operacion owner no vivan como piezas sueltas.',
    outcome:
      'Convierte presencia publica, menu QR, asistente y flujo owner en una entidad operable de punta a punta.',
    role: 'Sistema operativo comercial para restaurante.',
    systems: ['Landing publica', 'Menu QR', 'AI assistant', 'Owner workflow'],
    href: 'https://tablia.io',
  },
  {
    name: 'Flowtranslate',
    type: 'Entidad de aprendizaje',
    status: 'online',
    statusLabel: 'Online',
    problem:
      'Traducir, mejorar ingles y recordar aprendizajes suele quedar separado entre chats, notas y memoria.',
    outcome:
      'Ordena traduccion, practica, historial y cupos en una PWA con una experiencia de aprendizaje continua.',
    role: 'Herramienta diaria con backend, auth, cuotas y AI.',
    systems: ['PWA', 'Supabase Auth', 'Gemini', 'Quota', 'Learning'],
    href: 'https://flowtranslate.app',
  },
  {
    name: 'PostalPeek',
    type: 'Entidad de coleccion',
    status: 'experiment',
    statusLabel: 'Experimento',
    problem:
      'Una idea creativa necesita probar discovery, coleccion y valor visual antes de prometer un producto maduro.',
    outcome:
      'Explora feed, albumes, colecciones y medios generativos como laboratorio de producto cultural.',
    role: 'Aprendizaje sobre loops de coleccion y generative media.',
    systems: ['Feed', 'Collection', 'Generative media', 'Albums'],
    href: 'https://postalpeek.app',
  },
  {
    name: 'Juan Obrach',
    type: 'Entidad profesional',
    status: 'online',
    statusLabel: 'Online',
    problem:
      'Un perfil senior necesita mostrar criterio, casos y disponibilidad sin depender solo de mensajes privados.',
    outcome:
      'Vuelve portfolio, escritura, casos, asistente y analytics una superficie que sostiene conversaciones comerciales.',
    role: 'Presencia profesional y prueba viva de oficio.',
    systems: ['SEO', 'Assistant', 'Analytics', 'Case studies'],
    href: 'https://juanobrach.dev',
  },
  {
    name: 'Zigzag',
    type: 'Entidad de turismo',
    status: 'prototype',
    statusLabel: 'Prototipo',
    problem:
      'La planificacion turistica mezcla deseos, rutas, lugares, restricciones y contexto local dificil de ordenar.',
    outcome:
      'Investiga como convertir decisiones, mapas y preferencias en una experiencia guiada y construible.',
    role: 'Prototipo para validar arquitectura de decision UX.',
    systems: ['Routes', 'Places', 'AI enrichment', 'Decision UX'],
  },
];

export const processSteps = [
  {
    label: 'Diagnostico',
    title: 'Leer el desorden real',
    body:
      'Partimos de tu web, redes, idea o friccion operativa y hacemos pocas preguntas para ubicar la oportunidad concreta.',
  },
  {
    label: 'Mapa',
    title: 'Definir la primera entidad',
    body:
      'Convertimos contexto suelto en una arquitectura inicial: que captura, que responde, que automatiza y donde necesita revision humana.',
  },
  {
    label: 'Build',
    title: 'Lanzar una version usable',
    body:
      'Construimos la primera version online con flujo, datos, AI si suma, analytics y los limites necesarios para operar con confianza.',
  },
];
