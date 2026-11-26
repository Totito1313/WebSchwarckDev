// Prueba de humo de HeroUI: si el botón y las pestañas se ven con estilo y responden,
// React, Tailwind y HeroUI están bien cargados.
import { useState } from 'react';
import { Button, Tabs, useTheme } from '@heroui/react';

const THEMES = [
  { id: 'light', label: 'Claro' },
  { id: 'dark', label: 'Oscuro' },
  { id: 'system', label: 'Sistema' },
];

export function App() {
  const { theme, setTheme } = useTheme('system');
  const [presses, setPresses] = useState(0);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-10 px-4 py-12">
      <header className="flex flex-col gap-2">
        <a className="text-sm text-muted" href="/admin/">
          Volver al panel
        </a>
        <h1 className="text-3xl font-semibold tracking-tight">HeroUI está listo</h1>
        <p className="text-muted">
          React 19, Tailwind CSS 4 y HeroUI v3. Esta página es la base para pasar el panel y el portal a HeroUI.
        </p>
      </header>

      <section className="flex flex-col gap-4" aria-labelledby="buttons-title">
        <h2 id="buttons-title" className="text-lg font-semibold">
          Botón
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button onPress={() => setPresses((n) => n + 1)}>Botón de HeroUI</Button>
          <Button variant="secondary">Secundario</Button>
          <Button variant="tertiary">Terciario</Button>
          <Button variant="outline">Contorno</Button>
        </div>
        <p className="text-sm text-muted" aria-live="polite">
          {presses === 0 ? 'Todavía no lo has pulsado.' : `Pulsado ${presses} ${presses === 1 ? 'vez' : 'veces'}.`}
        </p>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="theme-title">
        <h2 id="theme-title" className="text-lg font-semibold">
          Pestañas y tema
        </h2>
        <Tabs className="w-full max-w-md" selectedKey={theme} onSelectionChange={(key) => setTheme(String(key))}>
          <Tabs.ListContainer>
            <Tabs.List aria-label="Tema">
              {THEMES.map((t) => (
                <Tabs.Tab key={t.id} id={t.id}>
                  {t.label}
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
          {THEMES.map((t) => (
            <Tabs.Panel key={t.id} id={t.id} className="pt-4 text-muted">
              {t.id === 'system' ? 'Sigue el modo de tu dispositivo.' : `Tema ${t.label.toLowerCase()} activo.`}
            </Tabs.Panel>
          ))}
        </Tabs>
      </section>
    </main>
  );
}
