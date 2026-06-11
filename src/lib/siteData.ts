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
  problem: string;
  systems: string[];
  href?: string;
};

export const showroomEntities: ShowroomEntity[] = [
  {
    name: 'Tablia',
    type: 'Entidad para restaurantes',
    status: 'online',
    problem:
      'Convierte un restaurante en una presencia operable: landing, menu QR, asistente y flujo owner.',
    systems: ['Landing publica', 'Menu QR', 'AI assistant', 'Owner workflow'],
    href: 'https://tablia.io',
  },
  {
    name: 'Flowtranslate',
    type: 'Entidad de aprendizaje',
    status: 'online',
    problem:
      'Hace que traduccion, mejora de ingles e historial aprendible vivan en un mismo sistema de practica.',
    systems: ['PWA', 'Supabase Auth', 'Gemini', 'Quota', 'Learning'],
    href: 'https://flowtranslate.app',
  },
  {
    name: 'PostalPeek',
    type: 'Entidad de coleccion',
    status: 'experiment',
    problem:
      'Explora discovery, coleccion y medios generativos alrededor de postales acuareladas de lugares reales.',
    systems: ['Feed', 'Collection', 'Generative media', 'Albums'],
    href: 'https://postalpeek.app',
  },
  {
    name: 'Juan Obrach',
    type: 'Entidad profesional',
    status: 'online',
    problem:
      'Organiza prueba profesional, escritura, case studies, asistente y analytics para convertir conversaciones.',
    systems: ['SEO', 'Assistant', 'Analytics', 'Case studies'],
    href: 'https://juanobrach.dev',
  },
  {
    name: 'Zigzag',
    type: 'Entidad de turismo',
    status: 'prototype',
    problem:
      'Investiga como planificar experiencias turisticas desde decisiones, mapas, preferencias y contexto local.',
    systems: ['Routes', 'Places', 'AI enrichment', 'Decision UX'],
  },
];

export const processSteps = [
  {
    label: 'Diagnostico',
    title: 'Entender la entidad',
    body:
      'Partimos de contexto crudo y preguntas dinamicas para separar negocio, operacion, usuario y oportunidad.',
  },
  {
    label: 'Definition Sprint',
    title: 'Volverlo construible',
    body:
      'Convertimos el diagnostico en specs privadas, flujo, riesgos, arquitectura inicial y presupuesto por fases.',
  },
  {
    label: 'Build',
    title: 'Lanzar una primera entidad',
    body:
      'Construimos la version minima online: presencia, workflows, data, analytics y automatizaciones necesarias.',
  },
  {
    label: 'Operate & Evolve',
    title: 'Medir y mejorar',
    body:
      'La entidad aprende con uso real: funnels, leads, operaciones, AI, herramientas internas y nuevas decisiones.',
  },
];
