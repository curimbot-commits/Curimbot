export interface StaggerOptions {
  /** Selector CSS de los elementos a animar. */
  selector: string;
  /** Distancia vertical inicial en píxeles. */
  y?: number;
  /** Distancia horizontal inicial en píxeles. */
  x?: number;
  /** Retraso entre elementos en segundos. */
  stagger?: number;
  /** Duración de la animación en segundos. */
  duration?: number;
  /** Selector del elemento padre que actúa como trigger. Por defecto, el propio elemento. */
  trigger?: string;
  /** Punto de inicio del ScrollTrigger. */
  start?: string;
}

export interface HeroAnimationOptions {
  /** Selector del badge superior. */
  badgeSelector?: string;
  /** Selector del título. */
  titleSelector?: string;
  /** Selector del subtítulo opcional (por ejemplo, subtítulo verde). */
  subtitleSelector?: string;
  /** Selector del párrafo inferior. */
  subSelector?: string;
  /** Selector de la imagen de fondo. */
  imageSelector?: string;
}