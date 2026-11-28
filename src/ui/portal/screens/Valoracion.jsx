// La valoración del mes: del día 20 al 7 del mes siguiente, Inicio pregunta
// «¿Cómo lo hicimos en noviembre?» (1 a 5 estrellas y un comentario que solo ve el
// estudio). Se puede cambiar mientras dure ese plazo, también desde Perfil.
import { useState } from 'react';
import { PaperPlane, Star, StarFill } from '@gravity-ui/icons';
import { Button, Card, Label, TextArea, TextField, toast } from '@heroui/react';
import { dayDate, fMonth } from '../../../portal/kit.js';
import { app, can, has, monthKey } from '../../../portal/state.js';
import { refresh } from '../store.js';
import { Hoja } from '../ui.jsx';

const WORDS = ['', 'Mal', 'Regular', 'Bien', 'Muy bien', '¡Genial!'];
const later = (month) => `portal:rate-later:${month}`;

/** El mes que toca valorar hoy: del 20 en adelante, este; hasta el 7, el anterior. */
export function ratingMonth(today = new Date()) {
  const day = today.getDate();
  if (day >= 20) return monthKey(today.toLocaleDateString('en-CA'));
  if (day <= 7) return monthKey(new Date(today.getFullYear(), today.getMonth() - 1, 15).toLocaleDateString('en-CA'));
  return null;
}
export const canRate = () => has('ratings') && !app.studio && can('rating.send');
const mine = (month) => app.data.ratings.find((r) => r.month === month && r.user_id === app.user?.id) || null;
export const monthName = (m) => fMonth.format(dayDate(m)).split(' ')[0];

/** Cinco estrellas para elegir (radio), o para enseñar una nota. */
export function Stars({ value, onPick, size = 'size-8' }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  if (!onPick) {
    return (
      <span className="flex gap-0.5 text-warning" role="img" aria-label={`${value} de 5`}>
        {[1, 2, 3, 4, 5].map((n) => (n <= Math.round(value) ? <StarFill key={n} className="size-4" /> : <Star key={n} className="size-4 text-muted" />))}
      </span>
    );
  }
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Tu valoración" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={n === value}
          aria-label={`${n}: ${WORDS[n]}`}
          onMouseEnter={() => setHover(n)}
          onClick={() => onPick(n)}
          className="rounded-full p-0.5 text-warning outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-focus active:scale-95"
        >
          {n <= shown ? <StarFill className={size} /> : <Star className={`${size} text-muted`} />}
        </button>
      ))}
    </div>
  );
}

/** En Inicio, cuando toca y todavía no se ha valorado (con «Ahora no» por tres días). */
export function RatingCard() {
  const [gone, setGone] = useState(false);
  if (!canRate() || gone) return null;
  const month = ratingMonth();
  if (!month || mine(month)) return null;
  const skipped = Number(localStorage.getItem(later(month)) || 0);
  if (skipped && Date.now() - skipped < 3 * 86_400_000) return null;
  return (
    <Card className="flex-col items-start gap-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="sw-eyebrow">Tu opinión</span>
        <span className="text-lg font-semibold">¿Cómo lo hicimos en {monthName(month)}?</span>
        <span className="text-xs text-muted">Un toque: nos ayuda a mejorar cada mes.</span>
      </div>
      <Stars value={0} onPick={(n) => (location.hash = `#/valorar/${n}`)} />
      <Button
        size="sm"
        variant="ghost"
        onPress={() => {
          localStorage.setItem(later(month), String(Date.now()));
          setGone(true);
        }}
      >
        Ahora no
      </Button>
    </Card>
  );
}

/** Valorar (o cambiar la valoración de) el mes que toca. */
export function ValorarHoja({ preset = 0, onClose }) {
  const month = ratingMonth();
  const before = month ? mine(month) : null;
  const [score, setScore] = useState(Number(preset) || before?.score || 0);
  const [comment, setComment] = useState(before?.comment || '');
  const [busy, setBusy] = useState(false);
  if (!month || !canRate()) {
    return (
      <Hoja title="Valorar el mes" onClose={onClose}>
        <p className="text-sm text-muted">Se valora del día 20 al 7 del mes siguiente.</p>
      </Hoja>
    );
  }
  const send = async (close) => {
    if (!score) return toast.danger('Elige de 1 a 5 estrellas.');
    setBusy(true);
    try {
      const row = await app.backend.saveRating({ client_id: app.client.id, month, score, comment: comment.trim() || null });
      const i = app.data.ratings.findIndex((r) => r.month === month && r.user_id === app.user?.id);
      if (i >= 0) app.data.ratings[i] = row;
      else app.data.ratings.unshift(row);
      refresh();
      toast.success(score >= 4 ? '¡Gracias! Nos alegra mucho.' : 'Gracias: lo tendremos en cuenta.');
      close();
    } catch (err) {
      toast.danger('No se guardó', { description: err.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Hoja
      title={`${before ? 'Tu valoración de' : 'Valora'} ${monthName(month)}`}
      subtitle="Solo la ve el equipo de Schwarck."
      onClose={onClose}
      footer={(close) => (
        <Button isPending={busy} onPress={() => send(close)}>
          <PaperPlane />
          {before ? 'Guardar' : 'Enviar'}
        </Button>
      )}
    >
      <div className="flex flex-col items-center gap-2 py-2">
        <Stars value={score} onPick={setScore} size="size-10" />
        <span className="text-lg font-semibold">{WORDS[score] || 'Elige de 1 a 5'}</span>
      </div>
      <TextField value={comment} onChange={setComment} maxLength={2000}>
        <Label>Comentario (opcional)</Label>
        <TextArea rows={3} placeholder={score && score <= 3 ? '¿Qué podemos hacer mejor?' : 'Lo que más te gustó, lo que cambiarías…'} />
      </TextField>
    </Hoja>
  );
}
