// Iconos de la barra de pestañas: los de la carpeta SamsungIcons (estilo One UI), cada uno
// relleno para la pestaña abierta y de contorno para las demás. Van en currentColor para
// seguir al tema; cambiar uno es cambiar su par aquí.

const PAIRS = {
  // home.svg / home_outline.svg
  inicio: ["<path d=\"M18.7204 8.46198L13.6396 3.70139C12.6534 2.77675 11.1544 2.7647 10.1543 3.67487L4.89313 8.45957C4.32562 8.97553 4 9.71934 4 10.5017V17.2791C4 18.7824 5.17573 20 6.62475 20H8.25751C8.80874 20 9.25647 19.5359 9.25647 18.9645V13.3335C9.25647 12.8513 9.60535 12.3691 10.1868 12.3691H13.3977C13.9117 12.3691 14.328 12.8018 14.328 13.3347V18.9645C14.328 19.5359 14.7758 20 15.327 20H16.9598C18.4088 20 19.5833 18.7824 19.5833 17.2791V10.4776C19.5833 9.70969 19.2705 8.97674 18.7204 8.46198Z\" fill-rule=\"evenodd\" clip-rule=\"evenodd\" fill=\"currentColor\"/>", "<path d=\"M13.2672 4.65599L18.8742 9.33199C19.6142 9.94899 20.0422 10.864 20.0422 11.827V17.471C20.0422 18.852 18.9232 19.971 17.5422 19.971L15.0182 19.9703L15.0187 13.8903C15.0187 13.111 14.4234 12.4699 13.6631 12.3972L13.5187 12.3903H10.7727C9.94474 12.3903 9.27274 13.0623 9.27274 13.8903V19.7703L14.9892 19.9703L6.75024 19.971C5.36924 19.971 4.25024 18.852 4.25024 17.471V11.827C4.25024 10.864 4.67824 9.94899 5.41824 9.33199L11.0252 4.65599C11.6742 4.11499 12.6172 4.11499 13.2672 4.65599Z\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke=\"currentColor\"/>"],
  // recent.svg / recent_outline.svg
  cronologia: ["<path d=\"M15.005 12.456H12.196C11.508 12.456 10.946 11.894 10.946 11.206V7.456C10.946 7.042 11.282 6.706 11.696 6.706C12.111 6.706 12.446 7.042 12.446 7.456V10.956H15.005C15.419 10.956 15.755 11.292 15.755 11.706C15.755 12.12 15.419 12.456 15.005 12.456ZM12 3.625C7.382 3.625 3.625 7.382 3.625 12C3.625 16.618 7.382 20.375 12 20.375C16.618 20.375 20.375 16.618 20.375 12C20.375 7.382 16.618 3.625 12 3.625Z\" fill-rule=\"evenodd\" clip-rule=\"evenodd\" fill=\"currentColor\"/>", "<path d=\"M12 7.5957V11.3657C12 11.6457 12.227 11.8737 12.507 11.8737H15.576M20.5 12C20.5 7.305 16.695 3.5 12 3.5C7.306 3.5 3.5 7.305 3.5 12C3.5 16.695 7.306 20.5 12 20.5C16.695 20.5 20.5 16.695 20.5 12Z\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke=\"currentColor\"/>"],
  // lightning.svg / lightning_outline.svg
  marketing: ["<path d=\"M13.3729 10.0288L16.9243 10.0289L6.43799 21.0519L10.3823 12.2869L13.3729 10.0288Z\" fill-rule=\"evenodd\" clip-rule=\"evenodd\" fill=\"currentColor\"/><path d=\"M8.8172 3.5L6 12.2871H10.3824L14.966 3.5H8.8172Z\" fill-rule=\"evenodd\" clip-rule=\"evenodd\" fill=\"currentColor\"/><path d=\"M10.3823 12.2871L13.3729 10.0288H11.5581L10.3823 12.2871Z\" fill-rule=\"evenodd\" clip-rule=\"evenodd\" fill=\"currentColor\"/>", "<path d=\"M17 10.1956L6.441 21.5L10.4126 12.5113L6 12.5114L8.8367 3.5H15.0281L11.598 10.195L17 10.1956Z\" stroke-width=\"1.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke=\"currentColor\"/>"],
  // folder.svg / folder_outline.svg
  recursos: ["<path d=\"M20.75 9.5001C20.75 8.1001 19.65 7.0001 18.25 7.0001H13.05C12.65 7.0001 12.55 6.9001 12.35 6.7001L10.65 5.1001C10.45 4.8001 9.95 4.6001 9.55 4.6001H5.75C4.35 4.6001 3.25 5.7001 3.25 7.1001V16.9001C3.25 18.3001 4.35 19.4001 5.75 19.4001H18.25C19.65 19.4001 20.75 18.3001 20.75 16.9001V9.5001Z\" fill=\"currentColor\"/>", "<path d=\"M18.25 7.161H13.625C13.213 7.161 12.634 6.925 12.339 6.637L10.945 5.274C10.65 4.986 10.071 4.75 9.658 4.75H5.75C4.37 4.75 3.25 5.869 3.25 7.25V16.75C3.25 18.131 4.37 19.25 5.75 19.25H18.25C19.631 19.25 20.75 18.131 20.75 16.75V9.661C20.75 8.28 19.631 7.161 18.25 7.161Z\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke=\"currentColor\"/>"],
  // inbox.svg / inbox_outline.svg
  peticiones: ["<path d=\"M8.404 14.475C8.751 16.141 10.231 17.397 12 17.397C13.769 17.397 15.249 16.141 15.596 14.475H20V17.5C20 18.875 18.875 20 17.5 20H6.5C5.125 20 4 18.875 4 17.5V14.475H8.404ZM17.5 4C18.875 4 20 5.125 20 6.5V12.975H14.923C14.509 12.975 14.173 13.31 14.173 13.725C14.173 14.923 13.198 15.897 12 15.897C10.802 15.897 9.827 14.923 9.827 13.725C9.827 13.31 9.491 12.975 9.077 12.975H4V6.5C4 5.125 5.125 4 6.5 4H17.5Z\" fill=\"currentColor\"/>", "<path d=\"M19 12.75V6.75C19 5.7832 18.2168 5 17.25 5H6.75C5.7832 5 5 5.7832 5 6.75V12.75H9C9.4142 12.75 9.75 13.0858 9.75 13.5C9.75 14.7426 10.7574 15.75 12 15.75C13.1909 15.75 14.1656 14.8248 14.2448 13.654L14.25 13.5C14.25 13.1203 14.5322 12.8065 14.8982 12.7568L15 12.75H19ZM19 14.25H15.673L15.6689 14.2794C15.3235 15.9135 13.9138 17.1551 12.1992 17.2448L12 17.25C10.1962 17.25 8.6898 15.9764 8.3311 14.2794L8.326 14.25H5V17.25C5 18.2168 5.7832 19 6.75 19H17.25C18.2168 19 19 18.2168 19 17.25V14.25ZM17.25 3.5C19.0452 3.5 20.5 4.9548 20.5 6.75V17.25C20.5 19.0452 19.0452 20.5 17.25 20.5H6.75C4.9548 20.5 3.5 19.0452 3.5 17.25V6.75C3.5 4.9548 4.9548 3.5 6.75 3.5H17.25Z\" fill-rule=\"evenodd\" clip-rule=\"evenodd\" fill=\"currentColor\"/>"],
};

const svg = (paths, cls) => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;

/** Los dos dibujos de una pestaña, uno encima del otro: el CSS enseña el que toca. */
export function tabIcon(tab) {
  const [solid, outline] = PAIRS[tab] || PAIRS.inicio;
  const span = document.createElement('span');
  span.className = 'ic cl-tab-ic';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = svg(outline, 'is-off') + svg(solid, 'is-on');
  return span;
}
