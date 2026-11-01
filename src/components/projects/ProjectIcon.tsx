import { defaultProjectIcon } from "./project-icons";

export function ProjectIcon({name, svg, className = ''}: {name:string; svg?:string|null; className?:string}) {
  return <img className={`project-custom-icon ${className}`} width={32} height={32} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg || defaultProjectIcon(name))}`} alt="" aria-hidden="true" draggable={false}/>;
}
