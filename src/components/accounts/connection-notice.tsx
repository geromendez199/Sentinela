const MESSAGES: Record<string, string> = {
 missing_parameters: 'La autorización quedó incompleta. Iniciá una nueva vinculación desde Cuentas.',
 state_invalid_or_expired: 'El enlace de vinculación venció o ya fue utilizado. Iniciá uno nuevo.',
 state_consume_failed: 'No pudimos verificar este intento. Volvé a iniciar la vinculación.',
 code_exchange_failed: 'Mercado Libre no devolvió una autorización válida para mantener la conexión. Revisá la configuración de la aplicación y volvé a intentar.',
 seller_already_linked: 'Ese vendedor ya está vinculado a otra organización.',
 link_failed: 'La autorización llegó, pero no pudimos guardar la conexión. Contactá al administrador.',
};
export function ConnectionNotice({ error, linked }: { error?: string; linked?: string }) {
 if (!error && !linked) return null;
 return <div role={error?'alert':'status'} className="mb-7 rounded-xl border bg-white p-5 text-sm leading-relaxed">{error ? MESSAGES[error] ?? 'No pudimos completar la vinculación. Intentá nuevamente desde Cuentas.' : 'Cuenta vinculada. Entrá a tu organización y revisá el estado de sincronización en Cuentas.'}</div>;
}
