export const ROOT_CAUSES = [
  { id: 'damaged', label: 'Daño en tránsito', terms: ['roto', 'rota', 'golpeado', 'danado', 'danada'], action: 'Revisar embalaje y evidencia de entrega.' },
  { id: 'different', label: 'Producto diferente', terms: ['equivocado', 'equivocada', 'otro producto', 'no coincide'], action: 'Comparar la publicación, variante y producto recibido.' },
  { id: 'missing', label: 'Piezas faltantes', terms: ['falta una pieza', 'faltan piezas', 'incompleto', 'faltante'], action: 'Confirmar el contenido del paquete y las piezas anunciadas.' },
  { id: 'late', label: 'Entrega o despacho tardío', terms: ['no llego', 'no llega', 'demora', 'retraso', 'donde esta'], action: 'Revisar el último evento del envío y su plazo oficial.' },
  { id: 'compatibility', label: 'Compatibilidad o variante', terms: ['compatible', 'no sirve', 'talle', 'voltaje', 'medida'], action: 'Verificar compatibilidad, dimensiones y variante antes de responder.' },
  { id: 'defective', label: 'Falla de funcionamiento', terms: ['no funciona', 'defectuoso', 'defectuosa', 'falla'], action: 'Documentar la falla y revisar las soluciones disponibles.' },
] as const;
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function triageSupport(text: string | null) {
  const normalized = normalize(text ?? '');
  const matches = ROOT_CAUSES.filter(cause => cause.terms.some(term => normalized.includes(term)));
  const signals = ['reclamo', 'mediacion', 'denuncia', 'estafa', 'indignado', 'indignada', 'devolucion'].filter(term => normalized.includes(term));
  return { cause: matches[0] ?? null, matches, signals, priority: signals.length ? 'urgent' : matches.length ? 'watch' : 'routine', available: normalized.trim().length > 0 };
}

export function responseTemplate(text: string | null, channel: 'question' | 'message' | 'claim') {
  const cause = triageSupport(text).cause;
  if (channel === 'question') return 'Hola, gracias por tu consulta. Vamos a verificar la información de esta publicación para darte una respuesta precisa.';
  if (cause?.id === 'late') return 'Hola, gracias por avisarnos. Vamos a revisar el estado del envío y la información disponible en tu compra para orientarte sobre el próximo paso.';
  if (cause?.id === 'damaged' || cause?.id === 'defective') return 'Hola, lamentamos el inconveniente. Vamos a revisar el problema y la evidencia disponible en tu compra para ayudarte con una solución por este medio.';
  return 'Hola, gracias por escribirnos. Vamos a revisar los detalles de tu compra y las opciones disponibles para ayudarte por este medio.';
}

export function validateSupportDraft(text: string, maxChars: number) {
  const issues: string[] = [];
  if (!text.trim()) issues.push('Escribí una respuesta antes de continuar.');
  if (text.length > maxChars) issues.push(`El borrador supera ${maxChars} caracteres.`);
  if (/[\w.+-]+@[\w-]+\.[\w.-]+|https?:\/\/|www\.|\bwa\.me\b|\bwhatsapp\b/i.test(text)) issues.push('Revisá los datos de contacto y enlaces externos.');
  if (/(?:\+\d[\d\s()-]{7,}|\b\d{2,4}[\s-]\d{3,4}[\s-]\d{4}\b)/.test(text)) issues.push('El borrador parece incluir un teléfono.');
  if (/\b(idiota|imbecil|estupido|estupida|inutil)\b/.test(normalize(text))) issues.push('Usá un tono respetuoso y orientado a la solución.');
  return issues;
}
