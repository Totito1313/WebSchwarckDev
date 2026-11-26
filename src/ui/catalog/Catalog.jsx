// /admin/ui/: todos los componentes de HeroUI con el tema de Schwarck, agrupados
// como en su documentación y con ejemplos de lo que llevan Negocio y el portal.
// Es la referencia visual de las dos apps nuevas: si algo se ve bien aquí, se
// ve igual allí.
import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowUpRightFromSquare } from '@gravity-ui/icons';
import { Card, Chip, Link, ScrollShadow, SearchField } from '@heroui/react';
import { ThemeSwitch } from '../kit/ThemeSwitch.jsx';
import { ACCIONES } from './acciones.jsx';
import { FORMULARIOS } from './formularios.jsx';
import { DATOS } from './datos.jsx';
import { NAVEGACION } from './navegacion.jsx';
import { PRO } from './pro.jsx';

const HEROUI = [...ACCIONES, ...FORMULARIOS, ...DATOS, ...NAVEGACION];
const GROUPS = [...HEROUI, ...PRO];
const OWN = PRO.reduce((n, g) => n + g.items.length, 0);
const namesOf = (item) => [...item.name.split(' + '), ...(item.also || [])];
const TOTAL = new Set(HEROUI.flatMap((g) => g.items.flatMap(namesOf)).filter((n) => n !== 'EmptyState' && n !== 'FieldGroup' && n !== 'SwitchGroup')).size;
const plain = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function Demo({ item }) {
  const Render = item.render;
  return (
    <Card className={`min-w-0 ${item.wide ? "lg:col-span-2" : ""}`} id={`c-${item.doc}-${item.name.split(' ')[0]}`}>
      <Card.Header className="flex-row items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Card.Title className="font-mono text-sm">{item.name}</Card.Title>
          <Card.Description>{item.desc}</Card.Description>
        </div>
        <Link
          className="shrink-0 text-xs text-muted"
          href={item.inspired ? `https://heroui.pro/docs/react/demos/${item.inspired}` : `https://heroui.com/docs/react/components/${item.doc}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={item.inspired ? `Demo de HeroUI Pro en la que se inspira ${item.name}` : `Documentación de ${item.name}`}
        >
          {item.inspired ? 'Inspiración' : 'Docs'}
          <ArrowUpRightFromSquare className="size-3" />
        </Link>
      </Card.Header>
      <Card.Content className="flex min-h-24 min-w-0 items-start pt-2">
        <Render />
      </Card.Content>
    </Card>
  );
}

export function Catalog() {
  const [query, setQuery] = useState('');
  const groups = useMemo(() => {
    const q = plain(query.trim());
    if (!q) return GROUPS;
    return GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => plain(`${i.name} ${i.desc} ${(i.also || []).join(' ')} ${g.title}`).includes(q)) })).filter((g) => g.items.length);
  }, [query]);

  return (
    <div className="min-h-screen">
      <header className="sw-glass sticky top-0 z-30 border-x-0 border-t-0">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/admin/" className="flex items-center gap-1 text-sm text-muted">
            <ArrowLeft className="size-4" />
            Panel
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h1 className="truncate text-lg font-semibold tracking-tight">Componentes</h1>
            <Chip size="sm" variant="soft" color="accent">
              {TOTAL} de HeroUI
            </Chip>
            <Chip size="sm" variant="soft">
              {OWN} propios
            </Chip>
          </div>
          <SearchField aria-label="Buscar un componente" value={query} onChange={setQuery} className="w-full sm:w-64">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Buscar un componente…" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ThemeSwitch />
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] gap-8 px-4 py-8 sm:px-6">
        <nav aria-label="Grupos" className="sticky top-24 hidden h-[calc(100vh-7rem)] w-52 shrink-0 lg:block">
          <ScrollShadow className="h-full pe-2">
            <ul className="flex flex-col gap-4 text-sm">
              {groups.map((g) => (
                <li key={g.id}>
                  <a href={`#${g.id}`} className="sw-eyebrow block hover:text-foreground">
                    {g.title}
                  </a>
                  <ul className="mt-2 flex flex-col gap-1 border-s border-separator ps-3">
                    {g.items.map((i) => (
                      <li key={i.name}>
                        <a href={`#c-${i.doc}-${i.name.split(' ')[0]}`} className="block truncate text-muted hover:text-foreground">
                          {i.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </ScrollShadow>
        </nav>

        <main className="flex min-w-0 flex-1 flex-col gap-12">
          <section className="flex flex-col gap-2">
            <p className="sw-eyebrow">Sistema de diseño</p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Las piezas de Negocio y del portal</h2>
            <p className="max-w-2xl text-muted">
              Cada componente de HeroUI v3 con los colores, la letra y las esquinas de Schwarck (los de CeroFiao), en claro y en oscuro. Lo que se ve aquí es exactamente lo
              que usan las dos apps nuevas. Nada se guarda.
            </p>
          </section>

          {groups.length === 0 && <p className="text-muted">Ningún componente coincide con «{query}».</p>}

          {groups.map((g) => (
            <section key={g.id} id={g.id} className="flex scroll-mt-24 flex-col gap-4" aria-labelledby={`${g.id}-t`}>
              <div className="flex items-baseline gap-3">
                <h2 id={`${g.id}-t`} className="text-xl font-semibold tracking-tight">
                  {g.title}
                </h2>
                <span className="text-sm text-muted">{g.items.length}</span>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {g.items.map((item) => (
                  <Demo key={item.name} item={item} />
                ))}
              </div>
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}
