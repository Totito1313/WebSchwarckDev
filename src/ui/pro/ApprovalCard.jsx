// Tarjetas para decidir, inspiradas en la «Approval Card» de HeroUI Pro:
//  · ApprovalCard: algo que espera un sí o un no (una pieza, una cotización, una
//    petición), con su imagen, sus datos en columnas, el desglose con total, una
//    nota y, abajo, «Rechazar» (Esc) y «Aprobar» (Ctrl+Intro). Una casilla opcional
//    para «siempre» y una acción intermedia («Pedir cambios»).
//  · QuestionCard: una pregunta con opciones (una o varias), «Saltar» y «Seguir»,
//    y el avance cuando son varias preguntas seguidas.
import { useRef, useState } from 'react';
import { Xmark } from '@gravity-ui/icons';
import { Button, Checkbox, Chip, Description, Kbd, Label, Radio, RadioGroup, Separator } from '@heroui/react';

/**
 * media: imagen o icono; title; subtitle; details: [[etiqueta, valor]];
 * lines: [[concepto, importe]]; total: [etiqueta, importe]; note: { label, color };
 * approveLabel, rejectLabel, onApprove, onReject, middle?: { label, onPress };
 * always?: { label, checked, onChange }; status?: 'approved' | 'rejected' (ya decidida)
 */
export function ApprovalCard({
  media,
  title,
  subtitle,
  details = [],
  lines = [],
  total,
  note,
  children,
  approveLabel = 'Aprobar',
  rejectLabel = 'Rechazar',
  onApprove,
  onReject,
  middle,
  always,
  status,
  isBusy = false,
}) {
  const box = useRef(null);
  const decided = status === 'approved' || status === 'rejected';
  const onKeyDown = (e) => {
    if (decided || isBusy) return;
    // Se para aquí: dentro de un panel o diálogo, Esc no debe cerrarlo además.
    if (e.key === 'Escape' && onReject) {
      e.preventDefault();
      e.stopPropagation();
      onReject();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && onApprove) {
      e.preventDefault();
      e.stopPropagation();
      onApprove();
    }
  };
  return (
    <section
      ref={box}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      aria-label={title}
      className="flex min-w-0 flex-col gap-4 rounded-3xl bg-surface p-4 shadow-[var(--surface-shadow)] outline-none"
    >
      <header className="flex items-start gap-3">
        {media && <div className="size-14 shrink-0 overflow-hidden rounded-2xl bg-surface-secondary">{media}</div>}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="font-semibold leading-snug">{title}</h3>
          {subtitle && <div className="text-sm text-muted">{subtitle}</div>}
        </div>
        {decided && (
          <Chip size="sm" variant="soft" color={status === 'approved' ? 'success' : 'danger'}>
            {status === 'approved' ? 'Aprobada' : 'Rechazada'}
          </Chip>
        )}
      </header>

      {details.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {details.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="truncate text-sm font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {(lines.length > 0 || total) && (
        <>
          <Separator />
          <dl className="flex flex-col gap-1.5 text-sm">
            {lines.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <dt className="text-muted">{k}</dt>
                <dd className="tabular-nums">{v}</dd>
              </div>
            ))}
            {total && (
              <div className="flex items-center justify-between gap-3 font-semibold">
                <dt>{total[0]}</dt>
                <dd className="tabular-nums">{total[1]}</dd>
              </div>
            )}
          </dl>
        </>
      )}

      {children}

      {note && (
        <Chip size="sm" variant="soft" color={note.color || 'success'} className="self-start">
          {note.label}
        </Chip>
      )}

      {!decided && (onApprove || onReject) && (
        <footer className="flex flex-wrap items-center justify-between gap-3">
          {always ? (
            <Checkbox isSelected={always.checked} onChange={always.onChange}>
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <span className="text-xs text-muted">{always.label}</span>
              </Checkbox.Content>
            </Checkbox>
          ) : (
            <span />
          )}
          <div className="ms-auto flex flex-wrap items-center gap-2">
            {onReject && (
              <Button size="sm" variant="tertiary" onPress={onReject} isDisabled={isBusy}>
                {rejectLabel}
                <Kbd className="hidden sm:inline-flex">
                  <Kbd.Content>Esc</Kbd.Content>
                </Kbd>
              </Button>
            )}
            {middle && (
              <Button size="sm" variant="secondary" onPress={middle.onPress} isDisabled={isBusy}>
                {middle.label}
              </Button>
            )}
            {onApprove && (
              <Button size="sm" onPress={onApprove} isPending={isBusy}>
                {approveLabel}
                <Kbd className="hidden bg-black/15 text-current sm:inline-flex">
                  <Kbd.Abbr keyValue="ctrl" />
                  <Kbd.Content>↵</Kbd.Content>
                </Kbd>
              </Button>
            )}
          </div>
        </footer>
      )}
    </section>
  );
}

/**
 * Pregunta con opciones. options: [[valor, texto, descripción?]]
 * step / steps: avance (por ejemplo 1 de 3); onContinue(valor), onSkip?, onClose?
 * children: algo más debajo de las opciones; puede ser una función (valor) => nodo,
 *   por ejemplo un campo «Otro motivo» solo cuando se elige «Otro».
 * continueVariant: el estilo del botón (danger si la respuesta descarta algo).
 */
export function QuestionCard({ question, description, options, step, steps, onContinue, onSkip, onClose, continueLabel = 'Seguir', continueVariant = 'primary', defaultValue = '', children, className = '' }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <section aria-label={question} className={`flex min-w-0 flex-col gap-4 rounded-3xl bg-surface p-4 shadow-[var(--surface-shadow)] ${className}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="font-semibold leading-snug">{question}</h3>
          {description && <p className="text-sm text-muted">{description}</p>}
        </div>
        {onClose && (
          <Button isIconOnly size="sm" variant="ghost" aria-label="Cerrar" onPress={onClose} className="-me-1 -mt-1">
            <Xmark className="size-4" />
          </Button>
        )}
      </header>
      <RadioGroup aria-label={question} value={value} onChange={setValue} className="flex flex-col gap-3">
        {options.map(([v, text, desc]) => (
          <Radio key={v} value={v}>
            <Radio.Content>
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              <Label className="font-medium">{text}</Label>
            </Radio.Content>
            {desc && <Description>{desc}</Description>}
          </Radio>
        ))}
      </RadioGroup>
      {typeof children === 'function' ? children(value) : children}
      <footer className="flex items-center justify-between gap-3">
        {steps > 1 ? (
          <div className="flex items-center gap-2 text-xs text-muted" aria-label={`Pregunta ${step} de ${steps}`}>
            <span className="flex gap-1" aria-hidden>
              {Array.from({ length: steps }, (_, i) => (
                <span key={i} className={`h-1 rounded-full ${i < step ? 'w-4 bg-foreground' : 'w-2 bg-default'}`} />
              ))}
            </span>
            <span className="tabular-nums">
              {step}/{steps}
            </span>
          </div>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          {onSkip && (
            <Button size="sm" variant="ghost" onPress={onSkip}>
              Saltar
            </Button>
          )}
          <Button size="sm" variant={continueVariant} isDisabled={!value} onPress={() => onContinue?.(value)}>
            {continueLabel}
          </Button>
        </div>
      </footer>
    </section>
  );
}
