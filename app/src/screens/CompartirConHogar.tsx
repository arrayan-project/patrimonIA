import type { Respuestas } from '../compartirPreguntas';
import { esAMedida, preguntaHogar, preguntaTransferir, type CuentaCompartible } from '../compartirPreguntas';
import { Nota, Segmented } from '../ui';

const SI_NO = ['Sí', 'No'] as const;
const sn = (b: boolean) => (b ? 'Sí' : 'No');

/**
 * Bloque S (G45) — compartir una cuenta con el hogar en dos preguntas (y la de
 * transferir, solo en las del día a día). La usan Agregar cuenta, Ajustes de la
 * cuenta y Qué compartes. Con un solo miembro en el hogar no se muestra (la
 * pantalla no la monta).
 */
export function PreguntasCompartir({
  categoriaFuncional,
  respuestas: r,
  onChange,
  pareja,
  delDiaADia,
  cuentaActual,
}: {
  categoriaFuncional: string;
  respuestas: Respuestas;
  onChange: (r: Respuestas) => void;
  /** Nombre del otro miembro si es uno solo; si no, se habla del hogar. */
  pareja?: string;
  delDiaADia: boolean;
  /** La cuenta tal como está guardada (para avisar si tiene un ajuste a tu medida). */
  cuentaActual?: CuentaCompartible;
}) {
  return (
    <>
      <Segmented
        label={preguntaHogar(categoriaFuncional)}
        options={SI_NO}
        value={sn(r.hogar)}
        formatearOpcion={(v) => v}
        onChange={(v) => onChange({ ...r, hogar: v === 'Sí' })}
      />
      {r.hogar && (
        <Segmented
          label={pareja ? `👀 ¿${pareja} puede ver los movimientos?` : '👀 ¿Los del hogar pueden ver los movimientos?'}
          options={SI_NO}
          value={sn(r.movimientos)}
          formatearOpcion={(v) => v}
          onChange={(v) => onChange({ ...r, movimientos: v === 'Sí' })}
        />
      )}
      {preguntaTransferir(delDiaADia, r) && (
        <Segmented
          label="🔁 ¿Te pueden transferir a esta cuenta?"
          options={SI_NO}
          value={sn(r.transferir)}
          formatearOpcion={(v) => v}
          onChange={(v) => onChange({ ...r, transferir: v === 'Sí' })}
        />
      )}
      {cuentaActual && esAMedida(cuentaActual) && (
        <Nota>⚙️ Hoy tiene un ajuste a tu medida (en Más opciones); al cambiar una respuesta, se reemplaza.</Nota>
      )}
    </>
  );
}
