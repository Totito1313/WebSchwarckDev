// Novedades (la campana): lo que pasó desde la última visita, con «Marcar como visto».
// Tocar algo lo abre y cierra la hoja.
import { useState } from 'react';
import { BellSlash, Check } from '@gravity-ui/icons';
import { Button } from '@heroui/react';
import { unread } from '../../../portal/state.js';
import { markSeen, usePortal } from '../store.js';
import { Hoja } from '../ui.jsx';
import { FeedRow } from './Inicio.jsx';
import { PushCard } from './Perfil.jsx';

export function NovedadesHoja({ onClose }) {
  usePortal();
  // Lo que había al abrir: marcar como visto no lo hace desaparecer de golpe.
  const [items] = useState(() => unread());
  const [busy, setBusy] = useState(false);
  return (
    <Hoja
      title="Novedades"
      subtitle={items.length ? `${items.length} ${items.length === 1 ? 'cosa nueva' : 'cosas nuevas'} desde tu última visita` : 'Estás al día'}
      onClose={onClose}
      footer={
        items.length > 0 &&
        ((close) => (
          <Button
            isPending={busy}
            onPress={async () => {
              setBusy(true);
              await markSeen();
              setBusy(false);
              close();
            }}
          >
            <Check />
            Marcar como visto
          </Button>
        ))
      }
    >
      {(close) => (
        <div
          className="flex flex-col gap-3"
          onClickCapture={(e) => {
            // Abrir algo de la lista cierra la hoja y va allí (atrás vuelve a donde se estaba).
            const a = e.target.closest?.('a[href^="#/"]');
            if (!a) return;
            e.preventDefault();
            close(a.getAttribute('href'));
          }}
        >
          <PushCard />
          {items.length ? (
            <ul className="flex flex-col">
              {items.slice(0, 50).map((item) => (
                <li key={item.id}>
                  <FeedRow item={item} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <BellSlash className="size-7 text-muted" />
              <p className="font-medium">Nada nuevo</p>
              <p className="max-w-xs text-sm text-muted">Te avisaremos aquí de cada avance, petición o publicación para revisar.</p>
            </div>
          )}
        </div>
      )}
    </Hoja>
  );
}
