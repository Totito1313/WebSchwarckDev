// Interruptor con su texto, armado exactamente como en la documentación de HeroUI:
// el riel (Switch.Control) va DENTRO de Switch.Content, junto al texto, y la
// descripción va fuera, debajo, alineada con el texto. Si el riel queda fuera de
// Content, la base del interruptor (una columna) lo pone encima de la etiqueta y se
// pierden el «hover» y el foco al tocar el texto.
import { Description, Switch } from '@heroui/react';

/** label: texto al lado; description: línea de ayuda debajo; el resto va al Switch. */
export function SwitchField({ label, description, ...props }) {
  return (
    <Switch {...props}>
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        {label}
      </Switch.Content>
      {description && <Description>{description}</Description>}
    </Switch>
  );
}
